import { FastifyInstance } from "fastify";
import {
  categoryQuestionCompleted,
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategory,
  likeCategory,
  updateCategory,
} from "./category.controller";
import z from "zod/v4";

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Category"],
        summary: "Get All Categories",
      },
    },
    getAllCategories,
  );
  fastify.get(
    "/id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Category"],
        summary: "Get A Category",
        params: z.object({
          id: z.string().nonempty(),
        }),
      },
    },
    getCategory,
  );
  fastify.post(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Category"],
        summary: "Create A Category",
        body: z.object({
          name: z.string(),
          parentCategoryId: z.string(),
          culture: z.string(),
          type: z.string(),
          color: z.string(),
          description: z.string(),
        }),
      },
    },
    createCategory,
  );
  fastify.put(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Category"],
        summary: "Update A Category",
        params: z.object({
          id: z.string().nonempty(),
        }),
        body: z.object({
          name: z.string(),
          parentCategoryId: z.string(),
          culture: z.string(),
          type: z.string(),
          color: z.string(),
          description: z.string(),
        }),
      },
    },
    updateCategory,
  );
  fastify.put(
    "/:id/categoryQuestionCompleted",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Category"],
        summary: "Complete a user category",
        params: z.object({
          id: z.string().nonempty(),
        }),
      },
    },
    categoryQuestionCompleted,
  );
  fastify.put(
    "/:id/likeCategory",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Category"],
        summary: "User like a category",
        params: z.object({
          id: z.string().nonempty(),
        }),
      },
    },
    likeCategory,
  );
  fastify.delete(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Category"],
        summary: "Delete A Category",
        params: z.object({
          id: z.string().nonempty(),
        }),
      },
    },
    deleteCategory,
  );
}
