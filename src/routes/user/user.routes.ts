import { FastifyInstance } from "fastify";
import {
  getUsers,
  loginUserWithEmailOtp,
  loginUserWithEmailPassword,
  loginUserWithEmail as loginWithUserEmail,
  updateUserInfo,
} from "./user.controller";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/", getUsers);
  fastify.post("/loginWithUserEmail", loginWithUserEmail);
  fastify.post("/loginUserWithEmailOtp", loginUserWithEmailOtp);
  fastify.post("/loginUserWithEmailPassword", loginUserWithEmailPassword);
  fastify.post(
    "updateUserInfo",
    { preHandler: [fastify.authenticate] },
    updateUserInfo,
  );
}
