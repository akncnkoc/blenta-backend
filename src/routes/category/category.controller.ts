import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type CreateCategoryRequest = {
  name: string;
  parentCategoryId?: string;
  culture: string;
  type: "general" | "ref" | "premium";
  color: string;
  description: string;
};

type UpdateCategoryRequest = {
  name: string;
  parentCategoryId?: string;
  culture: string;
  type: "general" | "ref" | "premium";
  color: string;
  description: string;
};

export const getAllCategories = async (
  _: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const categories = await tx.category.findMany();

      return { categories };
    });

    reply.code(200).send(result.categories);
  } catch (error) {
    reply.code(500).send({ message: "Internal Server Error", error });
  }
};

export const getCategory = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id },
        include: { questions: true, userCompletedCategories: true },
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
};

export const createCategory = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { name, parentCategoryId, culture, type, color, description } =
    req.body as CreateCategoryRequest;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdCategory = await tx.category.create({
        data: {
          name,
          parentCategoryId,
          culture,
          type,
          color,
          description,
        },
      });

      return { category: createdCategory };
    });

    reply.code(201).send(result.category);
  } catch (error) {
    reply.code(500).send({ message: "Internal Server Error", error });
  }
};

export const updateCategory = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { id } = req.params as { id: string };
  const { name, parentCategoryId, culture, type, color, description } =
    req.body as UpdateCategoryRequest;

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
          type,
          color,
          description,
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
};

export const categoryQuestionCompleted = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = req.user.id;
  const { id } = req.params as { id: string };

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
};

export const likeCategory = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
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
};

export const deleteCategory = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { id } = req.params as { id: string };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id } });
      if (!category) {
        return { code: 404, error: { message: "Category not found" } };
      }

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
};
