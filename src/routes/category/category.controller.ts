import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type CreateCategoryRequest = {
  name: string;
  parentCategoryId?: string;
  culture: string;
};

type UpdateCategoryRequest = {
  name: string;
  parentCategoryId?: string;
  culture: string;
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
      const category = await tx.category.findUnique({ where: { id } });
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
  const { name, parentCategoryId, culture } = req.body as CreateCategoryRequest;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdCategory = await tx.category.create({
        data: {
          name,
          parentCategoryId,
          culture,
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
  const { name, parentCategoryId, culture } = req.body as UpdateCategoryRequest;

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
