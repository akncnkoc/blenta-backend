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
    authenticateAdmin: (
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

        if (!user && !admin) {
          return reply.status(401).send({
            message: "Only users can access this route",
          });
        }
        if (user) {
          if (user.isUserDeactivated) {
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

  fastify.decorate(
    "authenticateAdmin",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
        const userId = request.user?.id;

        const admin = await prisma.admin.findUnique({
          where: { id: userId },
          select: { isUserDeactivated: true },
        });

        console.log("User ID:", userId);
        console.log("Admin found:", admin);

        if (!admin) {
          return reply.status(401).send({
            message: "Only admin users can access this route",
          });
        }

        if (admin.isUserDeactivated) {
          return reply.status(403).send({
            message: "Admin account is deactivated",
          });
        }
      } catch (err) {
        console.error("JWT verification failed or other error:", err);
        return reply.status(401).send({ message: "Unauthorized" });
      }
    },
  );
});
