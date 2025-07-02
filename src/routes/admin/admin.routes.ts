import { FastifyInstance } from "fastify";
import z from "zod/v4";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import bcrypt from "bcrypt";

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/authenticate",
    method: "POST",
    schema: {
      tags: ["Admin"],
      body: z.object({
        email: z.string(),
        password: z.string().min(1),
      }),
      summary: "Login with admin",
      response: {
        200: z.object({
          accessToken: z.string(),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { email, password } = req.body;
      try {
        let token = "";
        let payload = {} as {
          id: string;
          email: string;
          name: string | null;
          surname: string | null;
        };

        await prisma.$transaction(async (tx) => {
          // Find the user by email
          const user = await tx.admin.findUnique({
            where: { email },
          });

          if (!user) {
            throw new Error("UserNotFound");
          }

          const isMatch =
            user && (await bcrypt.compare(password, user.password!));
          if (!user || !isMatch) {
            return reply.code(401).send({
              message: "Invalid email or password",
            });
          }

          // Create JWT token
          payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            surname: user.surname,
          };

          token = req.jwt.sign(payload as any);

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
}
