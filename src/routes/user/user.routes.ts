import { FastifyInstance } from "fastify";
import {
  getUsers,
  loginUserWithAppleToken,
  loginUserWithEmailOtp,
  loginUserWithEmailPassword,
  loginUserWithGoogle as loginUserWithGoogleToken,
  loginUserWithEmail as loginWithUserEmail,
  updateUserInfo,
} from "./user.controller";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { PrismaClient } from "@prisma/client";
import { getMailClient } from "../../lib/mailer";
import {
  confirmationEmailEn,
  confirmationEmailTr,
} from "../../lib/emails/confirmation-email";
import nodemailer from "nodemailer";
const prisma = new PrismaClient();
import jsonwebtoken from "jsonwebtoken"; // NOT your app token, Apple's token decoder
const SALT_ROUNDS = 10;

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: [fastify.authenticate] }, getUsers);

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
          },
        });
      }

      const oneTimePassCode = String(
        Math.floor(Math.random() * 1000000),
      ).padStart(6, "0");

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
        const result = await mail.sendMail(mailTemp);
        fastify.log.info("Mail sent successfully:", result?.response);
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
        200: z.object({ accessToken: z.string() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { email, otpCode } = req.body;
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
            surname: user.surname,
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
    },
  });
  // fastify.post("/loginUserWithEmailPassword", loginUserWithEmailPassword);
  // fastify.post("/loginUserWithGoogleToken", loginUserWithGoogleToken);
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
        200: z.object({ accessToken: z.string() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { idToken } = req.body;

      // Apple ID token decode
      const decoded: any = jsonwebtoken.decode(idToken);

      const appleSub = decoded?.sub;
      const email = decoded?.email; // Apple bazen e-posta vermez (ilk girişte verir)
      const name = decoded?.name || null;

      if (!appleSub) {
        return reply.code(400).send({ message: "Invalid Apple token" });
      }

      let user = await prisma.user.findUnique({
        where: { icloudLoginKey: appleSub },
      });

      // ❗ Eğer kullanıcı yoksa oluştur
      if (!user) {
        user = await prisma.user.create({
          data: {
            icloudLoginKey: appleSub,
            email: email ?? `apple_${appleSub}@private.appleid.com`, // fallback mail
            name,
            appEnvironment: "PHONE",
          },
        });
      }

      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.role,
      };

      const token = req.jwt.sign(payload);

      reply.setCookie("access_token", token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });

      return { accessToken: token };
    },
  });
  // fastify.post(
  //   "/updateUserInfo",
  //   { preHandler: [fastify.authenticate] },
  //   updateUserInfo,
  // );
}
