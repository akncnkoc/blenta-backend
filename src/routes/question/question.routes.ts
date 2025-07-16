import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { PrismaClient, UserReferencedCategory } from "@prisma/client";
const prisma = new PrismaClient();

export default async function questionRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/category/:categoryId",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Question"],
      summary: "Get Category Questions",
      params: z.object({
        categoryId: z.string().nonempty(),
      }),
      querystring: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
      }),
    },
    handler: async (req, reply) => {
      var userId = req.user.id;
      const { categoryId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      try {
        const result = await prisma.$transaction(async (tx) => {
          const admin = await tx.admin.findFirst({
            where: { id: userId },
          });
          if (!admin) {
            const user = await tx.user.findFirst({
              where: { id: userId },
            });
            if (!user)
              return { code: 404, error: { message: "User not found" } };
          }

          const category = await tx.category.findFirst({
            where: { id: categoryId },
          });
          if (!category)
            return { code: 404, error: { message: "Category not found" } };

          const [questions, total, userLikedQuestions] = await Promise.all([
            tx.question.findMany({
              where: { categoryId },
              skip,
              take: Number(limit),
              orderBy: { sort: "asc" },
            }),
            tx.question.count({
              where: { categoryId },
            }),
            tx.userLikedQuestion.findMany({
              where: { userId: userId },
            }),
          ]);

          const tempQuestions = questions.map((ques) => ({
            ...ques,
            isQuestionLiked: userLikedQuestions.some(
              (liked) => liked.questionId === ques.id,
            ),
          }));

          return {
            questions: tempQuestions,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / Number(limit)),
          };
        });

        reply.code(200).send(result);
      } catch (error) {
        console.error("getCategoryQuestions error:", error);
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Question"],
      summary: "Get Question",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var question = await tx.question.findFirst({ where: { id: id } });
          if (!question) {
            return { code: 404, error: { message: "Question not found" } };
          }
          var nextQuestion = await tx.question.findFirst({
            where: { sort: question.sort + 1 },
          });

          var questionCreated = {
            ...question,
            nextQuestionId: nextQuestion?.id,
          };
          var isQuestionLiked = await tx.userLikedQuestion.findFirst({
            where: { questionId: id, userId: userId },
          });

          return {
            question: {
              ...questionCreated,
              questionLiked: isQuestionLiked ? true : false,
            },
          };
        });

        reply.code(201).send(result.question);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Question"],
      summary: "Create A Question",
      body: z.object({
        title: z.string().nonempty(),
        description: z.string().nullable(),
        categoryId: z.string().nonempty(),
        sort: z.number(),
      }),
    },
    handler: async (req, reply) => {
      const { title, description, categoryId, sort } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var category = await tx.category.findFirst({
            where: { id: categoryId },
          });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          const createdQuestion = await tx.question.create({
            data: {
              title,
              description,
              categoryId,
              sort,
            },
          });

          return { question: createdQuestion };
        });

        reply.code(201).send(result.question);
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
      tags: ["Question"],
      summary: "Update A Question",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        title: z.string().nonempty(),
        description: z.string().nullable(),
        categoryId: z.string().nonempty(),
        sort: z.number(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      const { title, description, categoryId, sort } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var question = await tx.question.findFirst({ where: { id: id } });
          if (!question) {
            return { code: 404, error: { message: "Question not found" } };
          }
          var category = await tx.category.findFirst({
            where: { id: categoryId },
          });
          if (!category) {
            return { code: 404, error: { message: "Category not found" } };
          }

          const updatedQuestion = await tx.question.update({
            where: { id },
            data: {
              title,
              description,
              categoryId,
              sort,
            },
          });

          return { question: updatedQuestion };
        });

        reply.code(201).send(result.question);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id/questionReaded",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Question"],
      summary: "User read a question",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var question = await tx.question.findFirst({ where: { id: id } });
          if (!question) {
            return { code: 404, error: { message: "Question not found" } };
          }

          const createViewedQuestion = await tx.userViewedQuestion.create({
            data: {
              userId,
              questionId: id,
            },
          });

          return { viewedQuestion: createViewedQuestion };
        });

        reply.code(201).send(result.viewedQuestion);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id/like-question",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Question"],
      summary: "Like a question",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const question = await tx.question.findFirst({ where: { id } });
          if (!question) {
            throw { status: 404, message: "Question not found" };
          }

          const alreadyLiked = await tx.userLikedQuestion.findFirst({
            where: { questionId: id, userId },
          });

          if (alreadyLiked) {
            throw { status: 409, message: "Question already liked" };
          }

          const createLikedQuestion = await tx.userLikedQuestion.create({
            data: { userId, questionId: id },
          });

          return { likedQuestion: createLikedQuestion };
        });

        reply.code(200).send(result);
      } catch (error: any) {
        const status = error?.status ?? 500;
        reply.code(status).send({
          message: error?.message || "Internal Server Error",
        });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id/unlike-question",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Question"],
      summary: "Unlike a question",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const userId = req.user.id;
      const { id } = req.params;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const question = await tx.question.findFirst({ where: { id } });
          if (!question) {
            throw { status: 404, message: "Question not found" };
          }

          const unlikedQuestion = await tx.userLikedQuestion.deleteMany({
            where: { questionId: id, userId },
          });

          return { unlikedQuestion };
        });

        reply.code(200).send(result);
      } catch (error: any) {
        const status = error?.status ?? 500;
        const message = error?.message ?? "Internal Server Error";
        reply.code(status).send({ message });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "DELETE",

    preHandler: [fastify.authenticate],
    schema: {
      tags: ["Question"],
      summary: "Delete a question",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var question = await tx.question.findFirst({ where: { id: id } });
          if (!question) {
            return { code: 404, error: { message: "Question not found" } };
          }
          const deletedQuestion = await tx.question.delete({
            where: { id },
          });

          return { question: deletedQuestion };
        });

        reply.code(201).send(result.question);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
}
