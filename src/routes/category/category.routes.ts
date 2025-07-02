import { FastifyInstance } from "fastify";
import z from "zod/v4";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma, PrismaClient } from "@prisma/client";
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
        search: z.string().optional().nullable(), // 🔍 add search param
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
              questionCount: z.number(),
              isCategoryLiked: z.boolean(),
              type: z.enum(["QUESTION", "TEST"]),
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
      const userId = req.user.id;
      const { lang, page, size, search } = req.query;

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

          const [total, categories, userLikedCategories, questionCounts] =
            await Promise.all([
              tx.category.count({
                where: {
                  ...whereClause,
                  parentCategoryId: null,
                },
              }),
              tx.category.findMany({
                where: {
                  ...whereClause,
                  parentCategoryId: null,
                },
                skip: (Number(page) - 1) * Number(size),
                take: Number(size),
                orderBy: { name: "asc" },
              }),
              tx.userLikedCategory.findMany({
                where: { userId },
              }),
              tx.question.groupBy({
                by: ["categoryId"],
                _count: { _all: true },
                where: {
                  categoryId: {
                    in: (
                      await tx.category.findMany({
                        where: whereClause,
                        select: { id: true },
                        skip: (Number(page) - 1) * Number(size),
                        take: Number(size),
                      })
                    ).map((c) => c.id),
                  },
                },
              }),
            ]);

          const countMap = Object.fromEntries(
            questionCounts.map((qc) => [qc.categoryId, qc._count._all]),
          );

          const tempCategories = categories.map((cat) => ({
            ...cat,
            questionCount: countMap[cat.id] || 0,
            isCategoryLiked: userLikedCategories.some(
              (liked) => liked.categoryId === cat.id,
            ),
          }));

          return {
            data: tempCategories,
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
      tags: ["Category"],
      summary: "Get A Category",
      params: z.object({
        id: z.string().nonempty(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          parentCategoryId: z.string().nullable(),
          culture: z.string(),
          color: z.string(),
          isPremiumCat: z.boolean(),
          isRefCat: z.boolean(),
          questionCount: z.number(),
          type: z.enum(["QUESTION", "TEST"]),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findFirst({
            where: { id: userId },
            include: { userReferencedCategories: true },
          });
          const category = await tx.category.findUnique({
            where: { id },
            include: {
              parentCategory: true,
              childCategories: true,
              questions: true,
            },
          });

          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }
          if (category.isPremiumCat && !user?.isPaidMembership) {
            return {
              code: 409,
              error: { message: "This user has no right to see category" },
            };
          }
          if (
            category.isRefCat &&
            user?.userReferencedCategories.findIndex(
              (x) => x.categoryId == category.id,
            ) !== -1
          ) {
            return {
              code: 409,
              error: { message: "This user has no right to see category" },
            };
          }

          const questionCount = await tx.question.count({
            where: { categoryId: id },
          });

          return { category, questionCount };
        });

        if (result.error) {
          reply.code(result.code).send(result.error);
          return;
        }

        reply.code(200).send({
          ...result.category,
          questionCount: result.questionCount,
        });
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" + error });
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
    url: "/:id/category-question-completed",
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
    url: "/:id/like-category",
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

          const createLikedCategory = await tx.userLikedCategory.create({
            data: {
              userId,
              categoryId: id,
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
    url: "/:id/unlike-category",
    method: "DELETE",
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

          await tx.userLikedCategory.deleteMany({
            where: {
              userId,
              categoryId: id,
            },
          });

          return { message: "Like removed" };
        });

        reply.code(200).send(result.message);
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
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id/addRefCode",
    method: "POST",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Category"],
      summary: "Add reference category for user",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        refCode: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;
      const { refCode } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const category = await tx.category.findUnique({ where: { id } });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }
          if (category.referenceCode != refCode) {
            return {
              code: 409,
              error: { message: "Reference code is not match" },
            };
          }
          var alreadyExistsReference =
            await tx.userReferencedCategory.findFirst({
              where: { categoryId: id, userId },
            });
          if (alreadyExistsReference) {
            return {
              code: 409,
              error: { message: "Reference code already exists" },
            };
          }

          const referenceCategory = await tx.userReferencedCategory.create({
            data: {
              userId: userId,
              categoryId: category.id,
            },
          });

          return { category: referenceCategory };
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
