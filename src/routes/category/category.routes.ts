import { FastifyInstance } from "fastify";
import z from "zod/v4";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      querystring: z.object({
        lang: z.string(),
        page: z.string().min(1),
        size: z.string().min(1).max(100),
      }),
      summary: "Get All Categories with Pagination",
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              parentCategoryId: z.string().nullable(),
              culture: z.string(),
              color: z.string(),
              isPremiumCat: z.boolean(),
              isRefCat: z.boolean(),
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
      const { lang, page, size } = req.query;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const [total, categories] = await Promise.all([
            tx.category.count({
              where: {
                culture: lang,
              },
            }),
            tx.category.findMany({
              where: {
                culture: lang,
              },
              skip: (Number(page) - 1) * Number(size),
              take: Number(size),
              orderBy: { name: "asc" },
            }),
          ]);

          return {
            data: categories,
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
        reply.code(500).send({ message: "Internal Server Error" + error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      summary: "Get A Category",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const category = await tx.category.findUnique({
            where: { id },
            include: {
              questions: true,
              parentCategory: true,
              childCategories: true,
            },
          });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          return { category };
        });

        if (result.error) {
          reply.code(result.code).send(result.error);
          return;
        }

        reply.code(200).send(result.category);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "POST",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      summary: "Create A Category",
      body: z.object({
        name: z.string(),
        description: z.string().nullable(),
        parentCategoryId: z.string(),
        culture: z.string(),
        color: z.string(),
        isPremiumCat: z.boolean(),
        isRefCat: z.boolean(),
      }),
    },
    handler: async (req, reply) => {
      const {
        name,
        parentCategoryId,
        culture,
        color,
        description,
        isPremiumCat,
        isRefCat,
      } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const createdCategory = await tx.category.create({
            data: {
              name,
              parentCategoryId,
              culture,
              color,
              description,
              isPremiumCat,
              isRefCat,
            },
          });

          return { category: createdCategory };
        });

        reply.code(201).send(result.category);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      summary: "Update A Category",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().nullable(),
        parentCategoryId: z.string(),
        culture: z.string(),
        color: z.string(),
        isPremiumCat: z.boolean(),
        isRefCat: z.boolean(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const {
        name,
        parentCategoryId,
        culture,
        color,
        description,
        isPremiumCat,
        isRefCat,
      } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const category = await tx.category.findUnique({ where: { id } });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          const updatedCategory = await tx.category.update({
            where: { id },
            data: {
              name,
              parentCategoryId,
              culture,
              color,
              description,
              isPremiumCat,
              isRefCat,
            },
          });

          return { category: updatedCategory };
        });

        if (result.error) {
          reply.code(result.code).send(result.error);
          return;
        }

        reply.code(200).send(result.category);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id/categoryQuestionCompleted",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      summary: "Complete a user category",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const category = await tx.category.findUnique({ where: { id } });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          const userCompletedCategory = await tx.userCompletedCategory.create({
            data: {
              userId,
              categoryId: id,
            },
          });

          return { completedCategory: userCompletedCategory };
        });

        if (result.error) {
          reply.code(result.code).send(result.error);
          return;
        }

        reply.code(200).send(result.completedCategory);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id/likeCategory",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      summary: "User like a category",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params as { id: string };
      try {
        const result = await prisma.$transaction(async (tx) => {
          var category = await tx.category.findFirst({ where: { id: id } });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          const createLikedCategory = await tx.userLikedQuestion.create({
            data: {
              userId,
              questionId: id,
            },
          });

          return { likedCategory: createLikedCategory };
        });

        reply.code(201).send(result.likedCategory);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "DELETE",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      summary: "Delete A Category",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const category = await tx.category.findUnique({ where: { id } });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          const deletedCategory = await tx.category.delete({
            where: { id },
          });

          await tx.userLikedCategory.deleteMany({
            where: { categoryId: id },
          });
          await tx.userCompletedCategory.deleteMany({
            where: { categoryId: id },
          });

          return { category: deletedCategory };
        });

        if (result.error) {
          reply.code(result.code).send(result.error);
          return;
        }

        reply.code(200).send(result.category);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
}
