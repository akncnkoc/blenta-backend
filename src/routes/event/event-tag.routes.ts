import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function eventTagRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["EventTag"],
      querystring: z.object({
        lang: z.string().min(1),
        page: z.string().min(1),
        size: z.string().min(1).max(100),
        search: z.string().optional().nullable(), // 🔍 add search param
      }),
      summary: "Get All Event Tags",
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              culture: z.string().nullable(),
              question: z.string(),
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

          const [total, eventTags] = await Promise.all([
            tx.eventTag.count({
              where: {
                ...whereClause,
              },
            }),
            tx.eventTag.findMany({
              where: {
                ...whereClause,
              },
              skip: (Number(page) - 1) * Number(size),
              take: Number(size),
              orderBy: { name: "asc" },
            }),
          ]);

          return {
            data: eventTags,
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
      tags: ["EventTag"],
      params: z.object({
        id: z.string().nonempty(),
      }),
      summary: "Get Event",
      response: {
        200: z.object({
          id: z.string(),
          name: z.string(),
          culture: z.string().nullable(),
          question: z.string(),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var eventTag = await tx.eventTag.findFirst({ where: { id } });
          if (!eventTag) {
            return { code: 404, message: "Event tag not found" };
          }
          return { eventTag };
        });

        reply.code(200).send(result.eventTag);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error: " + error });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/get-random",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["EventTag"],
      summary: "Get Event",
      response: {
        200: z.object({
          id: z.string(),
          name: z.string(),
          culture: z.string().nullable(),
          question: z.string(),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      try {
        const totalCount = await prisma.eventTag.count();

        if (totalCount === 0) {
          return reply.code(404).send({ message: "No event tags available." });
        }

        const randomSkip = Math.floor(Math.random() * totalCount);

        const randomEventTag = await prisma.eventTag.findFirst({
          skip: randomSkip,
        });

        if (!randomEventTag) {
          return reply
            .code(404)
            .send({ message: "Random event tag not found." });
        }

        // Assume question is a string field on eventTag, adapt as needed
        return reply.code(200).send({
          id: randomEventTag.id,
          name: randomEventTag.name,
          culture: randomEventTag.culture,
          question: randomEventTag.question ?? "", // fallback if nullable
        });
      } catch (error) {
        return reply.code(500).send({
          message: "Internal Server Error: " + (error as Error).message,
        });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventTag"],
      summary: "Create A Event Tag",
      body: z.object({
        name: z.string(),
        culture: z.string(),
        question: z.string(),
      }),
    },
    handler: async (req, reply) => {
      const { name, culture, question } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var eventTag = await tx.eventTag.findFirst({
            where: {
              name: {
                contains: name,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          });
          if (eventTag) {
            return { code: 409, error: { message: "Tag already exists" } };
          }

          const createdTag = await tx.eventTag.create({
            data: {
              name,
              culture,
              question,
            },
          });

          return { tag: createdTag };
        });

        reply.code(201).send(result.tag);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "PUT",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventTag"],
      summary: "Update A Event Tag",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        name: z.string(),
        culture: z.string(),
        question: z.string(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const { name, culture, question } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var tag = await tx.eventTag.findFirst({ where: { id: id } });
          if (!tag) {
            return { code: 404, error: { message: "Tag not found" } };
          }

          const updatedTag = await tx.eventTag.update({
            where: { id },
            data: {
              name,
              culture,
              question,
            },
          });

          return { tag: updatedTag };
        });

        reply.code(201).send(result.tag);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "DELETE",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventTag"],
      summary: "Delete a Event Tag",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var tag = await tx.eventTag.findFirst({ where: { id: id } });
          if (!tag) {
            return { code: 404, error: { message: "Tag not found" } };
          }
          const deletedTag = await tx.eventTag.delete({
            where: { id },
          });
          await tx.eventToEventTag.deleteMany({
            where: { event_tag_id: id },
          });

          return { tag: deletedTag };
        });

        reply.code(200).send(result.tag);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
}
