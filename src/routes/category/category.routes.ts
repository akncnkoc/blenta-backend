import { FastifyInstance } from "fastify";
import z from "zod/v4";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma, PrismaClient } from "@prisma/client";
import { isPaidMembership } from "../../lib/isPaidMembership";
const prisma = new PrismaClient();
const CategorySchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    parentCategoryId: z.string().nullable(),
    culture: z.string(),
    color: z.string(),
    sort: z.number(),
    isPremiumCat: z.boolean(),
    isRefCat: z.boolean(),
    type: z.enum(["QUESTION", "TEST"]),
    questionCount: z.number(),
    isCategoryLiked: z.boolean(),
    isUserReferenced: z.boolean().nullable().optional(),
    categoryTags: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
    childCategories: z.array(CategorySchema), // recursion!
  }),
);
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
        type: z.enum(["QUESTION", "TEST"]).optional().nullable(), // ✅ fix here
        tagIds: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .nullable(),
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
              sort: z.number(),
              isPremiumCat: z.boolean(),
              isRefCat: z.boolean(),
              questionCount: z.number(),
              isCategoryLiked: z.boolean(),
              categoryTags: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                }),
              ),
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
      const { lang, page, size, type, search } = req.query;

      try {
        const result = await prisma.$transaction(async (tx) => {
          let tagIdList: string[] = [];

          if (typeof req.query.tagIds === "string") {
            tagIdList = [req.query.tagIds];
          } else if (Array.isArray(req.query.tagIds)) {
            tagIdList = req.query.tagIds;
          }
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
            ...(tagIdList.length > 0
              ? {
                  categoryTags: {
                    some: {
                      tagId: {
                        in: tagIdList,
                      },
                    },
                  },
                }
              : {}),
            ...(type
              ? {
                  type: type,
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
                include: {
                  categoryTags: {
                    select: {
                      tag: {
                        select: {
                          name: true,
                          id: true,
                        },
                      },
                    },
                  },
                },
                skip: (Number(page) - 1) * Number(size),
                take: Number(size),
                orderBy: { sort: "asc" },
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
            categoryTags: cat.categoryTags.map((ct) => ct.tag), // ❌ tag object
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
        200: CategorySchema,
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const enrichedCategory = await prisma.$transaction(async (tx) => {
          const admin = await tx.admin.findFirst({
            where: { id: userId },
          });

          const user = await tx.user.findFirst({
            where: { id: userId },
            include: { userReferencedCategories: true },
          });

          const root = await tx.category.findUnique({
            where: { id },
            include: {
              categoryTags: {
                select: { tag: { select: { id: true, name: true } } },
              },
              childCategories: true,
            },
          });

          if (!root) {
            return { code: 404, error: { message: "Category not found" } };
          }

          if (!admin && user) {
            var userIsPremium = await isPaidMembership(user.id);
            if (root.isPremiumCat && userIsPremium) {
              return {
                code: 409,
                error: { message: "This user has no right to see category" },
              };
            }
            if (
              root.isRefCat &&
              user?.userReferencedCategories.findIndex(
                (x) => x.categoryId === root.id,
              ) === -1
            ) {
              return {
                code: 409,
                error: { message: "This user has no right to see category" },
              };
            }
          }

          const enrichCategory = async (
            category: typeof root,
            currentUser: typeof user,
          ): Promise<any> => {
            const isUserReferenced =
              user?.userReferencedCategories.some(
                (x) => x.categoryId === category.id,
              ) ?? false;
            const [questionCount, isLiked, tags, children] = await Promise.all([
              tx.question.count({ where: { categoryId: category.id } }),
              tx.userLikedCategory.findFirst({
                where: { categoryId: category.id, userId },
              }),
              tx.category.findUnique({
                where: { id: category.id },
                select: {
                  categoryTags: {
                    select: {
                      tag: { select: { id: true, name: true } },
                    },
                  },
                },
              }),
              tx.category.findMany({
                where: { parentCategoryId: category.id },
                orderBy: { sort: "asc" },
              }),
            ]);

            const childEnriched = await Promise.all(
              children.map((child) =>
                tx.category
                  .findUnique({
                    where: { id: child.id },
                    include: {
                      categoryTags: {
                        select: {
                          tag: { select: { id: true, name: true } },
                        },
                      },
                      childCategories: true,
                    },
                  })
                  .then((fullChild) => enrichCategory(fullChild!, currentUser)),
              ),
            );

            return {
              id: category.id,
              name: category.name,
              description: category.description,
              parentCategoryId: category.parentCategoryId,
              culture: category.culture,
              color: category.color,
              isPremiumCat: category.isPremiumCat,
              isRefCat: category.isRefCat,
              sort: category.sort,
              type: category.type,
              questionCount,
              isCategoryLiked: !!isLiked,
              categoryTags: tags?.categoryTags.map((ct) => ct.tag) || [],
              childCategories: childEnriched,
              isUserReferenced,
            };
          };

          return await enrichCategory(root, user);
        });

        if ("error" in enrichedCategory) {
          reply.code(enrichedCategory.code).send(enrichedCategory.error);
          return;
        }

        reply.code(200).send(enrichedCategory);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error: " + error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "POST",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Category"],
      summary: "Create A Category",
      body: z.object({
        name: z.string(),
        description: z.string().nullable(),
        parentCategoryId: z.string().nullable(),
        culture: z.string(),
        sort: z.number(),
        color: z.string(),
        isPremiumCat: z.boolean(),
        isRefCat: z.boolean(),
        type: z.enum(["QUESTION", "TEST"]),
      }),
    },
    handler: async (req, reply) => {
      const {
        name,
        parentCategoryId,
        culture,
        color,
        sort,
        description,
        isPremiumCat,
        isRefCat,
        type,
      } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const createdCategory = await tx.category.create({
            data: {
              name,
              sort,
              parentCategoryId:
                parentCategoryId == "" ? null : parentCategoryId,
              culture,
              color,
              description,
              isPremiumCat,
              isRefCat,
              type,
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
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Category"],
      summary: "Update A Category",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().nullable(),
        parentCategoryId: z.string().nullable(),
        culture: z.string(),
        sort: z.number(),
        color: z.string(),
        isPremiumCat: z.boolean(),
        isRefCat: z.boolean(),
        type: z.enum(["QUESTION", "TEST"]),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const {
        name,
        parentCategoryId,
        culture,
        color,
        sort,
        description,
        isPremiumCat,
        isRefCat,
        type,
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
              sort,
              parentCategoryId:
                parentCategoryId == "" ? null : parentCategoryId,
              culture,
              color,
              description,
              isPremiumCat,
              isRefCat,
              type,
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
    url: "/:id/addTag",
    method: "PUT",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["Category"],
      summary: "Add Category a tag",
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        tagId: z.string(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const { tagId } = req.body;
      try {
        const result = await prisma.$transaction(async (tx) => {
          const category = await tx.category.findFirst({ where: { id } });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }
          const tag = await tx.tag.findUnique({ where: { id: tagId } });
          if (!tag) {
            return { code: 404, error: { message: "Tag not found" } };
          }

          const categoryTag = await tx.categoryTag.findFirst({
            where: { categoryId: id, tagId: tagId },
          });
          if (categoryTag) {
            return {
              code: 409,
              error: { message: "Tag already added category" },
            };
          }

          const createdCategoryTag = await tx.categoryTag.create({
            data: {
              categoryId: id,
              tagId: tagId,
            },
          });
          return { categoryTag: createdCategoryTag };
        });

        if (result.error) {
          reply.code(result.code).send(result.error);
          return;
        }

        reply.code(200).send(result.categoryTag);
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
    preHandler: [fastify.authenticateAdmin],
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

          await tx.userLikedCategory.deleteMany({
            where: { categoryId: id },
          });

          await tx.userCompletedCategory.deleteMany({
            where: { categoryId: id },
          });

          const deletedCategory = await tx.category.delete({
            where: { id },
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
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (!user) {
            return { code: 404, error: { message: "user not found" } };
          }

          const category = await tx.category.findUnique({ where: { id } });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          var userRefCodes = await tx.user.findMany({
            select: { referenceCode: true },
          });

          if (!userRefCodes.map((ref) => ref.referenceCode).includes(refCode)) {
            return {
              code: 409,
              error: { message: "Reference code not found" },
            };
          }
          if (user.referenceCode == refCode) {
            return {
              code: 409,
              error: { message: "Reference code must not be same as user has" },
            };
          }

          var alreadyExistsReference =
            await tx.userReferencedCategory.findFirst({
              where: { userId, referenceCode: refCode },
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
              referenceCode: refCode,
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
