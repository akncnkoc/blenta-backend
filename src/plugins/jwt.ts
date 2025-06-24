import fp from "fastify-plugin";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { config } from "../config";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user: { id: string; name: string; surname: string; email: string };
  }
}

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
  });

  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    },
  );
});
