import { FastifyInstance } from "fastify";
import { getUsers, registerUser } from "./user.controller";
import { $ref } from "./user.schemas";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", getUsers);
  fastify.post(
    "/register",
    {
      schema: {
        body: $ref("registerUserSchema"),
      },
    },
    registerUser,
  );
}
