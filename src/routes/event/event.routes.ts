import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { Event, Prisma, PrismaClient } from "@prisma/client";
import { isPaidMembership } from "../../lib/isPaidMembership";
import { describe } from "node:test";
const prisma = new PrismaClient();

export default async function eventRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/finder",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Event"],
      summary:
        "Find Events by matching answerTexts (daily limit for non-premium users)",
      body: z.object({
        answerTexts: z.array(z.string().min(1)).nonempty(),
      }),
      response: {
        200: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            culture: z.string(),
          }),
        ),
        400: z.object({ message: z.string() }),
        429: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { answerTexts } = req.body;
      const userId = req.user.id;

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isPaidMembership: true,
            eventSearchCount: true,
            eventSearchLastDate: true,
          },
        });

        if (!user) {
          return reply.code(400).send({ message: "User not found" });
        }

        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );

        let shouldReset = false;
        if (!user.eventSearchLastDate) {
          shouldReset = true;
        } else {
          const lastSearchDate = new Date(user.eventSearchLastDate);
          const lastDate = new Date(
            lastSearchDate.getFullYear(),
            lastSearchDate.getMonth(),
            lastSearchDate.getDate(),
          );
          shouldReset = lastDate.getTime() !== today.getTime();
        }

        const isPremium = await isPaidMembership(user.id);
        if (!isPremium) {
          if (!shouldReset && user.eventSearchCount >= 3) {
            return reply
              .code(429)
              .send({ message: "Daily search limit reached" });
          }

          const newSearchCount = shouldReset ? 1 : user.eventSearchCount + 1;

          await prisma.user.update({
            where: { id: userId },
            data: {
              eventSearchCount: newSearchCount,
              eventSearchLastDate: now,
            },
          });
        }

        const events = (await prisma.$queryRaw`
          SELECT e.id, e.name, e.description, e.culture
          FROM events e
          JOIN event_matches em ON em."eventId" = e.id
          JOIN event_question_answers a ON a.id = em."answerId"
          WHERE a.text = ANY(${answerTexts})
          GROUP BY e.id
          HAVING COUNT(DISTINCT a.text) = ${answerTexts.length}
        `) as {
          id: bigint;
          name: string;
          description: string | null;
          culture: string;
        }[];

        const safeEvents = events.map((e) => ({
          id: e.id.toString(), // Convert BigInt to string for JSON serialization
          name: e.name,
          description: e.description,
          culture: e.culture,
        }));

        return reply.code(200).send(safeEvents);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Create a new Event and link answer matches",
      body: z.object({
        name: z.string(),
        description: z.string().optional(),
        culture: z.string().optional(),
        answerIds: z.array(z.uuid()).nonempty(),
      }),
      response: {
        201: z.object({
          id: z.string(),
          name: z.string().nullable(),
          description: z.string().nullable(),
          culture: z.string().nullable(),
          matches: z.array(
            z.object({
              id: z.string(),
              answerId: z.string(),
            }),
          ),
        }),
        400: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { name, description, culture, answerIds } = request.body as {
        name: string;
        description?: string;
        culture?: string;
        answerIds: string[];
      };

      try {
        const event = await prisma.event.create({
          data: {
            name,
            description,
            culture,
            matches: {
              create: answerIds.map((answerId) => ({
                answerId,
              })),
            },
          },
          include: {
            matches: true,
          },
        });

        return reply.status(201).send(event);
      } catch (error) {
        console.error(error);
        return reply.status(500).send({ message: "Internal Server Error" });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Get all events with matches (paginated & filtered)",
      querystring: z.object({
        page: z.string().optional(),
        size: z.string().optional(),
        lang: z.string().optional(),
        culture: z.string().optional(),
        search: z.string().optional(),
      }),
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              name: z.string().nullable(),
              description: z.string().nullable(),
              culture: z.string().nullable(),
              matches: z.array(
                z.object({
                  id: z.string(),
                  answerId: z.string(),
                }),
              ),
            }),
          ),
          meta: z.object({
            total: z.number(),
            page: z.number(),
            size: z.number(),
          }),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (request, reply) => {
      try {
        const {
          page = "1",
          size = "10",
          lang,
          culture,
          search,
        } = request.query;
        const pageNum = Math.max(1, parseInt(page));
        const sizeNum = Math.max(1, parseInt(size));

        const where: Prisma.EventWhereInput = {
          AND: [
            lang ? { culture: { equals: lang } } : {},
            culture ? { culture: { equals: culture } } : {},
            search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        };

        const [events, total] = await Promise.all([
          prisma.event.findMany({
            where,
            include: {
              matches: true,
            },
            orderBy: {
              name: "asc",
            },
            skip: (pageNum - 1) * sizeNum,
            take: sizeNum,
          }),
          prisma.event.count({ where }),
        ]);

        reply.code(200).send({
          data: events,
          meta: {
            total,
            page: pageNum,
            size: sizeNum,
          },
        });
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });

  // GET event by id
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Get an event by id with matches",
      params: z.object({
        id: z.uuid(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          name: z.string().nullable(),
          description: z.string().nullable(),
          culture: z.string().nullable(),
          matches: z.array(
            z.object({
              id: z.string(),
              answerId: z.string(),
            }),
          ),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const event = await prisma.event.findUnique({
          where: { id },
          include: { matches: true },
        });
        if (!event) {
          return reply.status(404).send({ message: "Event not found" });
        }
        reply.code(200).send(event);
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });

  // UPDATE event by id (replace matches)
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Update event and its answer matches",
      params: z.object({
        id: z.uuid(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().optional(),
        culture: z.string().optional(),
        answerIds: z.array(z.string()).nonempty(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          name: z.string().nullable(),
          description: z.string().nullable(),
          culture: z.string().nullable(),
          matches: z.array(
            z.object({
              id: z.string(),
              answerId: z.string(),
            }),
          ),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const { name, description, culture, answerIds } = req.body;

      try {
        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ message: "Event not found" });
        }

        const updated = await prisma.$transaction(async (tx) => {
          // matches'i temizle
          await tx.eventMatch.deleteMany({ where: { eventId: id } });

          // event güncelle
          const ev = await tx.event.update({
            where: { id },
            data: {
              name,
              description,
              culture,
              matches: {
                create: answerIds.map((answerId) => ({
                  answerId,
                })),
              },
            },
            include: { matches: true },
          });

          return ev;
        });

        reply.code(200).send(updated);
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });

  // DELETE event by id
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Delete an event and its matches",
      params: z.object({
        id: z.uuid(),
      }),
      response: {
        204: z.null(),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };

      try {
        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ message: "Event not found" });
        }

        await prisma.$transaction(async (tx) => {
          await tx.eventMatch.deleteMany({ where: { eventId: id } });
          await tx.event.delete({ where: { id } });
        });

        reply.code(204).send(null);
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });

  // UPDATE event by id (replace matches)
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/:id/like-event",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Event"],
      summary: "Like event",
      params: z.object({
        id: z.uuid(),
      }),
      response: {
        200: z.object({
          message: z.string(),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ message: "Event not found" });
        }

        var userLikedEvent = await prisma.userLikedEvent.findFirst({
          where: {
            userId,
            eventId: id,
          },
        });
        if (userLikedEvent) {
          return reply.status(409).send({ message: "Event already liked" });
        }

        await prisma.userLikedEvent.create({
          data: {
            userId,
            eventId: id,
          },
        });

        reply.code(200).send({ message: "User liked event" });
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/:id/unlike-event",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Event"],
      summary: "Unlike event",
      params: z.object({
        id: z.uuid(),
      }),
      response: {
        200: z.object({
          message: z.string(),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ message: "Event not found" });
        }

        var userLikedEvent = await prisma.userLikedEvent.findFirst({
          where: {
            userId,
            eventId: id,
          },
        });
        if (!userLikedEvent) {
          return reply.status(409).send({ message: "Event not liked before" });
        }

        await prisma.userLikedEvent.deleteMany({
          where: {
            userId,
            eventId: id,
          },
        });

        reply.code(200).send({ message: "User unliked event" });
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
}
