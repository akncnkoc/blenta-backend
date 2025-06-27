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
import {
  createCategorySchema,
  deleteCategorySchema,
  getCategorySchema,
  updateCategorySchema,
} from "./category.schema";

export default async function categoryRoutes(fastify: FastifyInstance) {
  // fastify.get("/", getAllCategories);
  // fastify.get("/id", { schema: getCategorySchema }, getCategory);
  // fastify.post("/", { schema: createCategorySchema }, createCategory);
  // fastify.put("/:id", { schema: updateCategorySchema }, updateCategory);
  // fastify.put("/:id/categoryQuestionCompleted", categoryQuestionCompleted);
  // fastify.put("/:id/likeCategory", likeCategory);
  // fastify.delete("/:id", { schema: deleteCategorySchema }, deleteCategory);
}
