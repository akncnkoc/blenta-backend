"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const bcrypt_1 = __importDefault(require("bcrypt"));
async function adminRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/authenticate",
        method: "POST",
        schema: {
            tags: ["Admin"],
            body: v4_1.default.object({
                email: v4_1.default.string(),
                password: v4_1.default.string().min(1),
            }),
            summary: "Login with admin",
            response: {
                200: v4_1.default.object({
                    accessToken: v4_1.default.string(),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { email, password } = req.body;
            try {
                let token = "";
                let payload = {};
                await prisma.$transaction(async (tx) => {
                    // Find the user by email
                    const user = await tx.admin.findUnique({
                        where: { email },
                    });
                    if (!user) {
                        throw new Error("UserNotFound");
                    }
                    const isMatch = user && (await bcrypt_1.default.compare(password, user.password));
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
            }
            catch (error) {
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
