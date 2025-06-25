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

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", getUsers);
  fastify.post("/loginWithUserEmail", loginWithUserEmail);
  fastify.post("/loginUserWithEmailOtp", loginUserWithEmailOtp);
  fastify.post("/loginUserWithEmailPassword", loginUserWithEmailPassword);
  fastify.post("/loginUserWithGoogleToken", loginUserWithGoogleToken);
  fastify.post("/loginUserWithAppleToken", loginUserWithAppleToken);
  fastify.post(
    "updateUserInfo",
    { preHandler: [fastify.authenticate] },
    updateUserInfo,
  );
}
