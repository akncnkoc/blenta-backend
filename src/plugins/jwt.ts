import fp from "fastify-plugin";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { config } from "../config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      id: string;
      name: string;
      surname: string;
      email: string;
      isDeactivated: boolean;
    };
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
        const userId = request.user?.id;

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { isUserDeactivated: true },
        });
        const admin = await prisma.admin.findUnique({
          where: { id: userId },
          select: { isUserDeactivated: true },
        });

        if (user && !admin) {
          if (user.isUserDeactivated) {
            return reply.status(403).send({
              message: "User account is deactivated",
            });
          }
        }

        if (admin && !user) {
          if (admin.isUserDeactivated) {
            return reply.status(403).send({
              message: "User account is deactivated",
            });
          }
        }
      } catch (err) {
        reply.send(err);
      }
    },
  );
});
