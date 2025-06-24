import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import bcrypt from "bcrypt";
import { getMailClient } from "../../lib/mailer";
import nodemailer from "nodemailer";
import {
  confirmationEmailEn,
  confirmationEmailTr,
} from "../../lib/emails/confirmation-email";
const SALT_ROUNDS = 10;
export const getUsers = async (_: FastifyRequest, reply: FastifyReply) => {
  const users = await prisma.user.findMany({
    include: { likedQuestions: true },
  });
  reply.send(users);
};

export const loginUserWithEmail = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { lang } = req.params as { lang: string };
  const { email } = req.body as {
    email: string;
  };
  const user = await prisma.user.findUnique({ where: { email: email } });
  if (!user) {
    const createdUser = await prisma.user.create({
      data: {
        email: email,
        name: "",
        surname: "",
        password: "",
        role: "USER",
      },
    });
    var oneTimePassCode = String(Math.floor(Math.random() * 1000000)).padStart(
      6,
      "0",
    );
    await prisma.userOneTimeCode.create({
      data: {
        userId: createdUser.id,
        code: oneTimePassCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
      },
    });
    const mail = await getMailClient();
    var mailTemp =
      lang == "en"
        ? confirmationEmailEn(email, oneTimePassCode)
        : confirmationEmailTr(email, oneTimePassCode);
    const message = await mail.sendMail(mailTemp);
    console.log(nodemailer.getTestMessageUrl(message));
    return reply
      .status(202)
      .send({ message: "OTP email was sent successfully" });
  }
};

export const loginUserWithEmailOtp = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { email, otpCode } = req.body as {
    email: string;
    otpCode: string;
  };

  try {
    let token = "";

    await prisma.$transaction(async (tx) => {
      // Find the user by email
      const user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error("UserNotFound");
      }

      // Validate the OTP code
      const otpCodeUser = await tx.userOneTimeCode.findFirst({
        where: {
          userId: user.id,
          code: otpCode,
        },
      });

      if (!otpCodeUser) {
        throw new Error("InvalidOtpCode");
      }

      // Create JWT token
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      token = req.jwt.sign(payload);

      // Set cookie
      reply.setCookie("access_token", token, {
        path: "/",
        httpOnly: true,
        secure: true,
      });
    });

    // Return token in response body
    return reply.code(200).send({ accessToken: token });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UserNotFound") {
        return reply.status(404).send({ message: "User not found" });
      }
      if (error.message === "InvalidOtpCode") {
        return reply.status(400).send({ message: "Invalid OTP code" });
      }
    }

    console.error("Login failed:", error);
    return reply
      .status(500)
      .send({ message: "An error occurred during login" });
  }
};

export const loginUserWithEmailPassword = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { email, password } = req.body as {
    email: string;
    password: string;
  };
  const user = await prisma.user.findUnique({
    where: {
      email: email,
      password,
    },
  });
  const isMatch = user && (await bcrypt.compare(password, user.password!));
  if (!user || !isMatch) {
    return reply.code(401).send({
      message: "Invalid email or password",
    });
  }
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  const token = req.jwt.sign(payload);
  reply.setCookie("access_token", token, {
    path: "/",
    httpOnly: true,
    secure: true,
  });
  return { accessToken: token };
};

export const updateUserInfo = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = req.user.id;

  const { name, surname, password } = req.body as {
    password: string;
    name: string;
    surname: string;
  };

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error("UserNotFound");
      }

      const hashedPass = await bcrypt.hash(password, SALT_ROUNDS);

      await tx.user.update({
        where: { id: userId },
        data: {
          name,
          surname,
          password: hashedPass,
        },
      });
    });

    return reply.code(200).send({ message: "User updated" });
  } catch (error) {
    if (error instanceof Error && error.message === "UserNotFound") {
      return reply.code(404).send({ message: "User not found" });
    }

    console.error("Update failed:", error);
    return reply.code(500).send({ message: "An error occurred during update" });
  }
};
