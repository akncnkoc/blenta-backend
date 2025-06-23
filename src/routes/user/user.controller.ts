import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import bcrypt from "bcrypt";
const SALT_ROUNDS = 10;
export const getUsers = async (req: FastifyRequest, reply: FastifyReply) => {
  const users = await prisma.user.findMany({
    include: { likedQuestions: true, userAnsweredQuestions: true },
  });
  reply.send(users);
};

export const registerUser = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { password, email, name, surname } = req.body as {
    email: string;
    password: string;
    name: string;
    surname: string;
  };
  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });
  if (user) {
    return reply.code(401).send({
      message: "User already exists with this email",
    });
  }
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        password: hash,
        email,
        name,
        surname: surname,
      },
    });
    return reply.code(201).send(user);
  } catch (e) {
    return reply.code(500).send(e);
  }
};

export const loginUser = async (req: FastifyRequest, reply: FastifyReply) => {
  const { password, email } = req.body as {
    email: string;
    password: string;
  };
  const user = await prisma.user.findUnique({ where: { email: email } });
  const isMatch = user && (await bcrypt.compare(password, user.password));
  if (!user || !isMatch) {
    return reply.code(401).send({
      message: "Invalid email or password",
    });
  }
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
  };
  const token = req.jwt.sign(payload);
  reply.setCookie("access_token", token, {
    path: "/",
    httpOnly: true,
    secure: true,
  });
  return { accessToken: token };
};
