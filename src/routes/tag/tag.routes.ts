import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function tagRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/category/:categoryId",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Tag"],
      summary: "Get Category Tags",
      params: z.object({
        categoryId: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { categoryId } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. categoryTag kayıtlarını al - hem tagId hem categoryTagId dönecek
          const catTags = await tx.categoryTag.findMany({
            where: { categoryId },
            select: {
              id: true, // categoryTagId
              tagId: true,
            },
          });

          const tagIds = catTags.map((ct) => ct.tagId);

          // 2. tag kayıtlarını al
          const tags = await tx.tag.findMany({
            where: { id: { in: tagIds } },
          });

          // 3. categoryTagId ile tag'leri eşleştirerek döndür
          const enrichedTags = catTags.map((ct) => {
            const tag = tags.find((t) => t.id === ct.tagId);
            return {
              categoryTagId: ct.id,
              ...tag,
            };
          });

          return {
            tags: enrichedTags,
          };
        });

        reply.code(200).send(result);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Tag"],
      querystring: z.object({
        page: z.string().min(1),
        size: z.string().min(1).max(100),
        search: z.string().optional().nullable(), // 🔍 add search param
      }),
      summary: "Get All Tags With Pagination",
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
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
      const { page, size, search } = req.query;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const whereClause = {
            ...(search
              ? {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                }
              : {}),
          };

          const [total, tags] = await Promise.all([
            tx.tag.count({
              where: {
                ...whereClause,
              },
            }),
            tx.tag.findMany({
              where: {
                ...whereClause,
              },
              include: { categoryTags: true },
              skip: (Number(page) - 1) * Number(size),
              take: Number(size),
              orderBy: { name: "asc" },
            }),
          ]);

          return {
            data: tags,
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
    method: "POST",
    url: "/",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Tag"],
      summary: "Create A Tag",
      body: z.object({
        name: z.string(),
      }),
    },
    handler: async (req, reply) => {
      const { name } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var tag = await tx.tag.findFirst({
            where: {
              name: {
                contains: name,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          });
          if (tag) {
            return { code: 409, error: { message: "Tag already exists" } };
          }

          const createdTag = await tx.tag.create({
            data: {
              name,
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
      tags: ["Tag"],
      summary: "Update A Tag",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        name: z.string(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const { name } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var tag = await tx.tag.findFirst({ where: { id: id } });
          if (!tag) {
            return { code: 404, error: { message: "Tag not found" } };
          }

          const updatedTag = await tx.tag.update({
            where: { id },
            data: {
              name,
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
      tags: ["Tag"],
      summary: "Delete a TAg",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var tag = await tx.tag.findFirst({ where: { id: id } });
          if (!tag) {
            return { code: 404, error: { message: "Tag not found" } };
          }
          const deletedTag = await tx.tag.delete({
            where: { id },
          });
          const deletedTagRelations = await tx.categoryTag.findMany({
            where: { tagId: id },
          });

          return { tag: deletedTag };
        });

        reply.code(200).send(result.tag);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/categoryTag/:id",
    method: "DELETE",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Tag"],
      summary: "Delete a Category Tag",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var categoryTag = await tx.categoryTag.findFirst({
            where: { id: id },
          });
          if (!categoryTag) {
            return { code: 404, error: { message: "Category Tag not found" } };
          }
          const deletedCategoryTag = await tx.categoryTag.delete({
            where: { id },
          });

          return { deletedCategoryTag };
        });

        reply.code(200).send(result.deletedCategoryTag);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
}
