"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = userRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const mailer_1 = require("../../lib/mailer");
const confirmation_email_1 = require("../../lib/emails/confirmation-email");
const prisma = new client_1.PrismaClient();
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // NOT your app token, Apple's token decoder
async function userRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/me",
        method: "GET",
        schema: {
            tags: ["User"],
            summary: "Get current user",
            response: {
                401: v4_1.default.object({ message: v4_1.default.string() }),
                200: v4_1.default.object({
                    user: v4_1.default
                        .object({
                        name: v4_1.default.string().nullable(),
                        surname: v4_1.default.string().nullable(),
                        email: v4_1.default.string(),
                        phoneNumber: v4_1.default.string().nullable(),
                        gender: v4_1.default.boolean(),
                        age: v4_1.default.string().nullable(),
                        isPaidMembership: v4_1.default.boolean(),
                        isRegistered: v4_1.default.boolean(),
                        referenceCode: v4_1.default.string(),
                        userAnsweredQuestions: v4_1.default.array(v4_1.default.object({
                            id: v4_1.default.string(),
                            userId: v4_1.default.string(),
                            questionId: v4_1.default.string(),
                        })),
                        userViewedQuestions: v4_1.default.array(v4_1.default.object({
                            id: v4_1.default.string(),
                            userId: v4_1.default.string(),
                            questionId: v4_1.default.string(),
                            viewedAt: v4_1.default.date(),
                        })),
                        userLikedCategories: v4_1.default.array(v4_1.default.object({
                            id: v4_1.default.string(),
                            userId: v4_1.default.string(),
                            categoryId: v4_1.default.string(),
                        })),
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
    fastify.withTypeProvider().route({
        method: "POST",
        url: "/loginWithUserEmail",
        schema: {
            tags: ["User"],
            summary: "Send OTP to user email",
            querystring: v4_1.default.object({
                lang: v4_1.default.string(),
            }),
            body: v4_1.default.object({
                email: v4_1.default.string().max(50),
            }),
            response: {
                200: v4_1.default.object({ message: v4_1.default.string() }),
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
            await prisma.userOneTimeCode.create({
                data: {
                    userId: user.id,
                    code: oneTimePassCode,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                },
            });
            const mail = await (0, mailer_1.getMailClient)();
            const mailTemp = lang === "en"
                ? (0, confirmation_email_1.confirmationEmailEn)(email, oneTimePassCode)
                : (0, confirmation_email_1.confirmationEmailTr)(email, oneTimePassCode);
            if (!mailTemp) {
                return reply.status(400).send({ message: "Mail temp not foundd" });
            }
            console.log("Prepared email payload:", JSON.stringify(mailTemp, null, 2));
            try {
                // const result = await mail.sendMail(mailTemp);
                // console.log("Mail sent successfully:", result?.response);
            }
            catch (err) {
                console.log(err);
            }
            return reply
                .status(200)
                .send({ message: "OTP email was sent successfully" });
        },
    });
    fastify.withTypeProvider().route({
        url: "/loginUserWithEmailOtp",
        method: "POST",
        schema: {
            tags: ["User"],
            summary: "Verify otp and login",
            body: v4_1.default.object({
                email: v4_1.default.string().max(50),
                otpCode: v4_1.default.string().max(6),
            }),
            response: {
                200: v4_1.default.object({ accessToken: v4_1.default.string(), isRegistered: v4_1.default.boolean() }),
                400: v4_1.default.object({ message: v4_1.default.string() }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { email, otpCode } = req.body;
            try {
                let token = "";
                let payload = {};
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
                    payload = {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        surname: user.surname,
                        role: user.role,
                        isRegistered: user.isRegistered,
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
                return reply
                    .code(200)
                    .send({ accessToken: token, isRegistered: payload.isRegistered });
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
    fastify.withTypeProvider().route({
        url: "/loginUserWithAppleToken",
        method: "POST",
        schema: {
            tags: ["User"],
            summary: "Verify Apple And Login",
            body: v4_1.default.object({
                idToken: v4_1.default.string(),
            }),
            response: {
                200: v4_1.default.object({ accessToken: v4_1.default.string() }),
                400: v4_1.default.object({ message: v4_1.default.string() }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { idToken } = req.body;
            // Apple ID token decode
            const decoded = jsonwebtoken_1.default.decode(idToken);
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
                        gender: true,
                        icloudLoginKey: appleSub,
                        email: email ?? `apple_${appleSub}@private.appleid.com`, // fallback mail
                        name,
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
            return { accessToken: token };
        },
    });
    fastify.withTypeProvider().route({
        url: "/updateUserInfo",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Update user info",
            body: v4_1.default.object({
                name: v4_1.default.string().max(50),
                surname: v4_1.default.string().max(50),
                age: v4_1.default.string(),
                phoneNumber: v4_1.default.string(),
                gender: v4_1.default.boolean(),
            }),
            response: {
                200: v4_1.default.object({ message: v4_1.default.string() }),
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
            }
            catch (error) {
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
