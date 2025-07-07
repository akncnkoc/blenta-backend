import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { PrismaClient } from "@prisma/client";
import { getMailClient } from "../../lib/mailer";
import {
  confirmationEmailEn,
  confirmationEmailTr,
} from "../../lib/emails/confirmation-email";
const prisma = new PrismaClient();
import jsonwebtoken from "jsonwebtoken"; // NOT your app token, Apple's token decoder

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/me",
    method: "GET",
    schema: {
      tags: ["User"],
      summary: "Get current user",
      response: {
        401: z.object({ message: z.string() }),
        200: z.object({
          user: z
            .object({
              name: z.string().nullable(),
              surname: z.string().nullable(),
              email: z.string(),
              phoneNumber: z.string().nullable(),
              gender: z.boolean(),
              age: z.string().nullable(),
              isPaidMembership: z.boolean(),
              isRegistered: z.boolean(),
              referenceCode: z.string(),
              userAnsweredQuestions: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  questionId: z.string(),
                }),
              ),
              userViewedQuestions: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  questionId: z.string(),
                  viewedAt: z.date(),
                }),
              ),
              userLikedCategories: z.array(
                z.object({
                  id: z.string(),
                  userId: z.string(),
                  categoryId: z.string(),
                }),
              ),
            })
            .nullable(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (req, reply) => {
      const { id } = req.user;

      let user = await prisma.user.findUnique({
        where: { id },
        include: {
          likedQuestions: true,
          userAnsweredQuestions: true,
          userLikedCategories: true,
          userViewedQuestions: true,
        },
      });

      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      return reply.status(200).send({ user });
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/loginWithUserEmail",
    schema: {
      tags: ["User"],
      summary: "Send OTP to user email",
      querystring: z.object({
        lang: z.string(),
      }),
      body: z.object({
        email: z.string().max(50),
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { lang } = req.query;
      const { email } = req.body;

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        fastify.log.info("User not found, creating new user...");
        user = await prisma.user.create({
          data: {
            email,
            name: "",
            surname: "",
            password: "",
            role: "USER",
            appEnvironment: "PHONE",
            gender: true,
            referenceCode: [...Array(8)]
              .map(() => Math.random().toString(36)[2].toUpperCase())
              .join(""),
          },
        });
      }
      const oneTimePassCode = String("123456");
      await prisma.userOneTimeCode.deleteMany({ where: { userId: user.id } });

      await prisma.userOneTimeCode.create({
        data: {
          userId: user.id,
          code: oneTimePassCode,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      const mail = await getMailClient();
      const mailTemp =
        lang === "en"
          ? confirmationEmailEn(email, oneTimePassCode)
          : confirmationEmailTr(email, oneTimePassCode);
      if (!mailTemp) {
        return reply.status(400).send({ message: "Mail temp not foundd" });
      }

      console.log("Prepared email payload:", JSON.stringify(mailTemp, null, 2));

      try {
        // const result = await mail.sendMail(mailTemp);
        // console.log("Mail sent successfully:", result?.response);
      } catch (err) {
        console.log(err);
      }
      return reply
        .status(200)
        .send({ message: "OTP email was sent successfully" });
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/loginUserWithEmailOtp",
    method: "POST",
    schema: {
      tags: ["User"],
      summary: "Verify otp and login",
      body: z.object({
        email: z.string().max(50),
        otpCode: z.string().max(6),
      }),
      response: {
        200: z.object({ accessToken: z.string(), isRegistered: z.boolean() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { email, otpCode } = req.body;
      try {
        let token = "";
        let payload = {} as {
          id: string;
          email: string;
          name: string | null;
          surname: string | null;
          role: string;
          isRegistered: boolean;
        };

        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { email },
          });

          if (!user) {
            throw new Error("UserNotFound");
          }

          const otpCodeUser = await tx.userOneTimeCode.findFirst({
            where: {
              userId: user.id,
              code: otpCode,
            },
          });

          if (!otpCodeUser) {
            throw new Error("InvalidOtpCode");
          }

          if (otpCodeUser.expiresAt && otpCodeUser.expiresAt < new Date()) {
            throw new Error("OtpExpired");
          }

          payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
            role: user.role,
            isRegistered: user.isRegistered,
          };

          token = req.jwt.sign(payload);

          reply.setCookie("access_token", token, {
            path: "/",
            httpOnly: true,
            secure: true,
          });
        });

        return reply
          .code(200)
          .send({ accessToken: token, isRegistered: payload.isRegistered });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "UserNotFound") {
            return reply.status(404).send({ message: "User not found" });
          }
          if (error.message === "InvalidOtpCode") {
            return reply.status(400).send({ message: "Invalid OTP code" });
          }
          if (error.message === "OtpExpired") {
            return reply.status(409).send({ message: "OTP code expired" });
          }
        }

        console.error("Login failed:", error);
        return reply
          .status(500)
          .send({ message: "An error occurred during login" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/loginUserWithAppleToken",
    method: "POST",
    schema: {
      tags: ["User"],
      summary: "Verify Apple And Login",
      body: z.object({
        idToken: z.string(),
      }),
      response: {
        200: z.object({ accessToken: z.string(), isRegistered: z.boolean() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { idToken } = req.body;

      let user = await prisma.user.findUnique({
        where: {
          icloudLoginKey: idToken,
        },
      });

      // ❗ Eğer kullanıcı yoksa oluştur
      if (!user) {
        user = await prisma.user.create({
          data: {
            gender: true,
            icloudLoginKey: idToken,
            email: idToken + "@apple.id",
            appEnvironment: "PHONE",
            referenceCode: [...Array(8)]
              .map(() => Math.random().toString(36)[2].toUpperCase())
              .join(""),
          },
        });
      }

      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.role,
        isRegistered: user.isRegistered,
      };

      const token = req.jwt.sign(payload);

      reply.setCookie("access_token", token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });

      return { accessToken: token, isRegistered: payload.isRegistered };
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/updateUserInfo",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["User"],
      summary: "Update user info",
      body: z.object({
        name: z.string().max(50),
        surname: z.string().max(50),
        age: z.string(),
        phoneNumber: z.string(),
        gender: z.boolean(),
      }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const userId = req.user.id;

      const { name, surname, age, phoneNumber, gender } = req.body;
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
          });

          if (!user) {
            throw new Error("UserNotFound");
          }

          await tx.user.update({
            where: { id: userId },
            data: {
              name,
              surname,
              age,
              phoneNumber,
              gender,
              isRegistered: true,
            },
          });
        });

        return reply.code(200).send({ message: "User updated" });
      } catch (error) {
        if (error instanceof Error && error.message === "UserNotFound") {
          return reply.code(404).send({ message: "User not found" });
        }

        console.error("Update failed:", error);
        return reply
          .code(500)
          .send({ message: "An error occurred during update" });
      }
    },
  });
}
