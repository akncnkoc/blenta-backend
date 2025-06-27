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
import z from "zod";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", { preHandler: [fastify.authenticate] }, getUsers);

  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/loginWithUserEmail",
    {
      schema: {
        tags: ["User"],
        summary: "Send OTP to user email",
        body: z.object({
          email: z.string().max(50).email(),
        }),
        response: {
          200: z.object({ message: z.string() }),
        },
      },
    },
    loginWithUserEmail,
  );
  // fastify.post("/loginUserWithEmailOtp", loginUserWithEmailOtp);
  // fastify.post("/loginUserWithEmailPassword", loginUserWithEmailPassword);
  // fastify.post("/loginUserWithGoogleToken", loginUserWithGoogleToken);
  // fastify.post("/loginUserWithAppleToken", loginUserWithAppleToken);
  // fastify.post(
  //   "/updateUserInfo",
  //   { preHandler: [fastify.authenticate] },
  //   updateUserInfo,
  // );
}
