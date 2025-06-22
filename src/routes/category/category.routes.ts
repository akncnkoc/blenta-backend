import { FastifyInstance } from "fastify";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategory,
  updateCategory,
} from "./category.controller";

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get("/", getAllCategories);
  fastify.get("/id", getCategory);
  fastify.post("/", createCategory);
  fastify.put("/:id", updateCategory);
  fastify.delete("/:id", deleteCategory);
}
