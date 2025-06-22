import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export type CreateQuestionRequest = {
  title: string;
  description: string;
  categoryId: string;
  culture: string;
  sort: number;
};

export type UpdateQuestionRequest = {
  title: string;
  description: string;
  categoryId: string;
  culture: string;
  sort: number;
};

export const getCategoryQuestions = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { categoryId } = req.params as { categoryId: string };

  try {
    const result = await prisma.$transaction(async (tx) => {
      var questions = await tx.question.findMany({
        where: { categoryId: categoryId },
      });

      return { questions: questions };
    });

    reply.code(201).send(result.questions);
  } catch (error) {
    reply.code(500).send({ message: "Internal Server Error", error });
  }
};
export const getQuestion = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };

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

      return { question: questionCreated };
    });

    reply.code(201).send(result.question);
  } catch (error) {
    reply.code(500).send({ message: "Internal Server Error", error });
  }
};

export const createQuestion = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { title, description, categoryId, sort, culture } =
    req.body as CreateQuestionRequest;

  try {
    const result = await prisma.$transaction(async (tx) => {
      var category = await tx.category.findFirst({ where: { id: categoryId } });
      if (!category) {
        return { code: 404, error: { message: "Category not found" } };
      }

      const createdQuestion = await tx.question.create({
        data: {
          title,
          description,
          culture,
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
};

export const updateQuestion = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { id } = req.params as { id: string };
  const { title, description, categoryId, sort, culture } =
    req.body as UpdateQuestionRequest;

  try {
    const result = await prisma.$transaction(async (tx) => {
      var question = await tx.question.findFirst({ where: { id: id } });
      if (!question) {
        return { code: 404, error: { message: "Question not found" } };
      }
      var category = await tx.category.findFirst({ where: { id: categoryId } });
      if (!category) {
        return { code: 404, error: { message: "Category not found" } };
      }

      const updatedQuestion = await tx.question.update({
        where: { id },
        data: {
          title,
          description,
          culture,
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
};

export const deleteQuestion = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { id } = req.params as { id: string };

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
};
