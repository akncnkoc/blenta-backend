import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { Event, Prisma, PrismaClient } from "@prisma/client";
import { isPaidMembership } from "../../lib/isPaidMembership";
const prisma = new PrismaClient();

export default async function eventRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/finder",
    method: "POST",
    preHandler: [fastify.authenticate], // kullanıcının kimliğini doğrulamalı
    schema: {
      tags: ["Event"],
      summary: "Find Events by Tags with Daily Limit",
      body: z.object({
        culture: z.string(),
        tagIds: z.array(z.uuid()).min(1), // kullanıcı bir veya daha fazla tag gönderir
      }),
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              culture: z.string().nullable(),
            }),
          ),
        }),
        403: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { tagIds } = req.body;
      const userId = req.user.id;

      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return reply.code(403).send({ message: "User not found" });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isNewDay =
          !user.eventSearchLastDate || user.eventSearchLastDate < today;
        const premium = await isPaidMembership(user.id);

        if (!premium) {
          if (isNewDay) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                eventSearchCount: 1,
                eventSearchLastDate: new Date(),
              },
            });
          } else if (user.eventSearchCount >= 3) {
            return reply.code(403).send({
              message:
                "Günlük limitinize ulaştınız. Sınırsız kullanım için premium olun.",
            });
          } else {
            await prisma.user.update({
              where: { id: userId },
              data: {
                eventSearchCount: { increment: 1 },
              },
            });
          }
        }

        // Rastgele bir event döndür
        const randomEvent = (await prisma.$queryRaw`
      SELECT e.id, e.name, e.culture
      FROM "events" e
      JOIN "event_to_event_tags" ett ON e.id = ett.event_id
      WHERE ett.event_tag_id = ANY(${tagIds})
      ORDER BY RANDOM()
      LIMIT 1
    `) as Event[];

        if (!randomEvent.length) {
          return reply.code(200).send({ data: [] });
        }

        return reply.code(200).send({ data: [randomEvent[0]] });
      } catch (err) {
        return reply
          .code(500)
          .send({ message: "Internal Server Error: " + err });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Event"],
      querystring: z.object({
        lang: z.string().min(1),
        page: z.string().min(1),
        size: z.string().min(1).max(100),
        search: z.string().optional().nullable(), // 🔍 add search param
      }),
      summary: "Get All Events",
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              culture: z.string().nullable(),
            }),
          ),
          meta: z.object({
            total: z.number(),
            page: z.string(),
            size: z.string(),
            pageCount: z.number(),
          }),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { page, size, search, lang } = req.query;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const whereClause = {
            culture: lang,
            ...(search
              ? {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                }
              : {}),
          };

          const [total, events] = await Promise.all([
            tx.event.count({
              where: {
                ...whereClause,
              },
            }),
            tx.event.findMany({
              where: {
                ...whereClause,
              },
              skip: (Number(page) - 1) * Number(size),
              take: Number(size),
              orderBy: { name: "asc" },
            }),
          ]);

          return {
            data: events,
            meta: {
              total,
              page,
              size,
              pageCount: Math.ceil(total / Number(size)),
            },
          };
        });

        reply.code(200).send(result);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error: " + error });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Event"],
      params: z.object({
        id: z.string(),
      }),
      summary: "Get Event",
      response: {
        200: z.object({
          id: z.string(),
          name: z.string(),
          culture: z.string().nullable(),
          tagIds: z.array(z.uuid()),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const event = await tx.event.findFirst({
            where: { id },
            include: {
              event_to_event_tags: {
                select: {
                  event_tag_id: true, // sadece tag id'lerini alıyoruz
                },
              },
            },
          });

          if (!event) {
            return { code: 404, error: { message: "Event not found" } };
          }

          // Tag Id'leri array olarak alalım
          const tagIds = event.event_to_event_tags.map((t) => t.event_tag_id);

          // Dönüş objesi
          return {
            data: {
              id: event.id,
              name: event.name,
              culture: event.culture,
              tagIds,
            },
          };
        });

        reply.code(200).send(result.data);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error: " + error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Create A Event",
      body: z.object({
        name: z.string(),
        culture: z.string(),
        tagIds: z.array(z.uuid()).optional().default([]),
      }),
      response: {
        201: z.object({
          id: z.string(),
          name: z.string(),
        }),
        409: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { name, culture, tagIds } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const existingEvent = await tx.event.findFirst({
            where: {
              name: {
                contains: name,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          });

          if (existingEvent) {
            return { code: 409, error: { message: "Event already exists" } };
          }

          const createdEvent = await tx.event.create({
            data: { name, culture },
          });

          if (tagIds.length > 0) {
            await tx.eventToEventTag.createMany({
              data: tagIds.map((tagId) => ({
                event_id: createdEvent.id,
                event_tag_id: tagId,
              })),
              skipDuplicates: true, // aynı tag iki kez gelirse sorun çıkarmaz
            });
          }

          return { createdEvent };
        });

        if ("error" in result) {
          return reply.code(result.code ?? 500).send(result.error);
        }

        reply.code(201).send(result.createdEvent);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "PUT",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Update A Event",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        name: z.string(),
        tagIds: z.array(z.uuid()).optional().default([]),
        culture: z.string(),
      }),
      response: {
        201: z.object({
          id: z.string(),
          name: z.string(),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const { name, culture, tagIds } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const event = await tx.event.findUnique({ where: { id } });
          if (!event) {
            return { code: 404, error: { message: "Event not found" } };
          }

          // Event ismini güncelle
          const updatedEvent = await tx.event.update({
            where: { id },
            data: { name, culture },
          });

          // Tag ekleme işlemi
          if (tagIds.length > 0) {
            const existingTags = await tx.eventToEventTag.findMany({
              where: {
                event_id: id,
                event_tag_id: { in: tagIds },
              },
              select: { event_tag_id: true },
            });

            const existingTagIds = new Set(
              existingTags.map((t) => t.event_tag_id),
            );
            const newTagIds = tagIds.filter(
              (tagId) => !existingTagIds.has(tagId),
            );

            if (newTagIds.length > 0) {
              await tx.eventToEventTag.createMany({
                data: newTagIds.map((tagId) => ({
                  event_id: id,
                  event_tag_id: tagId,
                })),
                skipDuplicates: true,
              });
            }
          }

          return { updatedEvent };
        });

        if ("error" in result) {
          return reply.code(result.code ?? 500).send(result.error);
        }

        reply.code(201).send(result.updatedEvent);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "DELETE",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Delete a Event",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var event = await tx.event.findFirst({ where: { id: id } });
          if (!event) {
            return { code: 404, error: { message: "Event not found" } };
          }
          await tx.eventToEventTag.deleteMany({
            where: { event_id: id },
          });
          const deletedEvent = await tx.event.delete({
            where: { id },
          });

          return { deletedEvent };
        });

        reply.code(200).send(result.deletedEvent);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/eventToEventTag/:eventId/:eventTagId",
    method: "PUT",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Add To Event A Event Tag",
      params: z.object({
        eventId: z.string().nonempty(),
        eventTagId: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { eventId, eventTagId } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var event = await tx.event.findFirst({
            where: { id: event },
          });
          if (!event) {
            return {
              code: 404,
              error: { message: "Event not found" },
            };
          }
          var eventTag = await tx.eventTag.findFirst({
            where: { id: eventTagId },
          });
          if (!eventTag) {
            return {
              code: 404,
              error: { message: "Event tag not found" },
            };
          }
          var eventToEventTagExists = await tx.eventToEventTag.findFirst({
            where: { event_id: eventId, event_tag_id: eventTagId },
          });
          if (eventToEventTagExists) {
            return {
              code: 409,
              error: { message: "Event To Event tag already added" },
            };
          }

          var eventToEventTagCreated = await tx.eventToEventTag.create({
            data: { event_id: eventId, event_tag_id: eventTagId },
          });

          return { eventToEventTagCreated };
        });

        reply.code(200).send(result.eventToEventTagCreated);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/eventToEventTag/:eventToEventTagId",
    method: "DELETE",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Event"],
      summary: "Delete a Event To Event Tag",
      params: z.object({
        eventToEventTagId: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { eventToEventTagId } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var eventToEventTag = await tx.eventToEventTag.findFirst({
            where: { id: eventToEventTagId },
          });
          if (!eventToEventTag) {
            return {
              code: 404,
              error: { message: "Event to event tag not found" },
            };
          }
          const deletedEventToEventTag = await tx.eventToEventTag.delete({
            where: { id: eventToEventTagId },
          });

          return { deletedEventToEventTag };
        });

        reply.code(200).send(result.deletedEventToEventTag);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
}
