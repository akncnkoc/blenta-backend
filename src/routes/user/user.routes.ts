import { FastifyInstance } from "fastify";
import { getUsers } from "./user.controller";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", getUsers);
}
