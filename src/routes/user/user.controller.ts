import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getUsers = async (req: FastifyRequest, reply: FastifyReply) => {
  const users = await prisma.user.findMany({
    include: { likedQuestions: true },
  });
  reply.send(users);
};
