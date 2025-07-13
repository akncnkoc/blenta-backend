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
                        id: v4_1.default.string(),
                        name: v4_1.default.string().nullable(),
                        surname: v4_1.default.string().nullable(),
                        email: v4_1.default.string(),
                        phoneNumber: v4_1.default.string().nullable(),
                        gender: v4_1.default.boolean(),
                        age: v4_1.default.string().nullable(),
                        isPaidMembership: v4_1.default.boolean(),
                        isRegistered: v4_1.default.boolean(),
                        referenceCode: v4_1.default.string(),
                        userAppVersion: v4_1.default.string().nullable(),
                        likedQuestions: v4_1.default.array(v4_1.default.object({
                            id: v4_1.default.string(),
                            userId: v4_1.default.string(),
                            questionId: v4_1.default.string(),
                            question: v4_1.default.object({
                                id: v4_1.default.string(),
                                title: v4_1.default.string(),
                            }),
                        })),
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
                            category: v4_1.default.object({
                                id: v4_1.default.string(),
                                name: v4_1.default.string(),
                            }),
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
                    likedQuestions: {
                        include: {
                            question: {
                                select: {
                                    id: true,
                                    title: true,
                                },
                            },
                        },
                    },
                    userAnsweredQuestions: true,
                    userLikedCategories: {
                        include: {
                            category: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
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
        url: "/me/liked-categories",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Get categories liked by current user",
            response: {
                200: v4_1.default.object({
                    categories: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        name: v4_1.default.string(),
                        description: v4_1.default.string().nullable(),
                        color: v4_1.default.string(),
                        isPremiumCat: v4_1.default.boolean(),
                        isRefCat: v4_1.default.boolean(),
                        type: v4_1.default.enum(["QUESTION", "TEST"]),
                    })),
                }),
                401: v4_1.default.object({
                    message: v4_1.default.string(),
                }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            try {
                const likedCategories = await prisma.userLikedCategory.findMany({
                    where: { userId },
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                color: true,
                                isPremiumCat: true,
                                isRefCat: true,
                                type: true,
                            },
                        },
                    },
                });
                const categories = likedCategories.map((like) => like.category);
                reply.code(200).send({ categories });
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/me/liked-questions",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Get questions liked by current user",
            response: {
                200: v4_1.default.object({
                    questions: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        title: v4_1.default.string(),
                        description: v4_1.default.string().nullable(),
                        category: v4_1.default.object({
                            id: v4_1.default.string(),
                            name: v4_1.default.string(),
                        }),
                    })),
                }),
                401: v4_1.default.object({
                    message: v4_1.default.string(),
                }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            try {
                const likedQuestions = await prisma.userLikedQuestion.findMany({
                    where: { userId },
                    include: {
                        question: {
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                category: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                });
                const questions = likedQuestions
                    .map((like) => like.question)
                    .filter((q) => !!q); // güvenlik: null check
                reply.code(200).send({ questions });
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/me/active-membership",
        method: "POST",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Update paid membership details for the current user",
            body: v4_1.default.object({
                paidMembershipId: v4_1.default.string().min(1),
                membershipRenewedAt: v4_1.default.coerce.date(), // ISO string de destekler
                membershipExpiresAt: v4_1.default.coerce.date(),
                memberVendorProductId: v4_1.default.string().min(1),
                memberStore: v4_1.default.string().min(1),
            }),
            response: {
                200: v4_1.default.object({
                    message: v4_1.default.string(),
                    user: v4_1.default.object({
                        id: v4_1.default.string(),
                        isPaidMembership: v4_1.default.boolean(), // 🔄 boolean yap
                        paidMembershipId: v4_1.default.string().nullable(),
                        membershipRenewedAt: v4_1.default.date().nullable(),
                        membershipExpiresAt: v4_1.default.date().nullable(),
                        memberVendorProductId: v4_1.default.string().nullable(),
                        memberStore: v4_1.default.string().nullable(),
                    }),
                }),
                401: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { paidMembershipId, membershipRenewedAt, membershipExpiresAt, memberVendorProductId, memberStore, } = req.body;
            try {
                const updatedUser = await prisma.user.update({
                    where: { id: userId },
                    data: {
                        isPaidMembership: true,
                        paidMembershipId,
                        membershipRenewedAt,
                        membershipExpiresAt,
                        memberVendorProductId,
                        memberStore,
                    },
                    select: {
                        id: true,
                        isPaidMembership: true,
                        paidMembershipId: true,
                        membershipRenewedAt: true,
                        membershipExpiresAt: true,
                        memberVendorProductId: true,
                        memberStore: true,
                    },
                });
                reply.code(200).send({
                    message: "Membership updated successfully",
                    user: updatedUser,
                });
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/me/deactivate-membership",
        method: "DELETE",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Update paid membership details for the current user",
            response: {
                200: v4_1.default.object({
                    message: v4_1.default.string(),
                }),
                401: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            try {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        isPaidMembership: false,
                    },
                });
                reply.code(200).send({
                    message: "Membership updated successfully",
                });
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
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
            await prisma.userOneTimeCode.deleteMany({ where: { userId: user.id } });
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
                409: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { email, otpCode } = req.body;
            try {
                let token = "";
                let payload = {};
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
            }
            catch (error) {
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
                200: v4_1.default.object({ accessToken: v4_1.default.string(), isRegistered: v4_1.default.boolean() }),
                400: v4_1.default.object({ message: v4_1.default.string() }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
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
    fastify.withTypeProvider().route({
        url: "/updateAppVersion",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Update user app version",
            body: v4_1.default.object({
                versionCode: v4_1.default.string().max(20), // adjust length/format as needed
            }),
            response: {
                200: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { versionCode } = req.body;
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                });
                if (!user) {
                    return reply.code(404).send({ message: "User not found" });
                }
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        userAppVersion: versionCode,
                    },
                });
                return reply.code(200).send({ message: "App version updated" });
            }
            catch (error) {
                console.error("App version update failed:", error);
                return reply
                    .code(500)
                    .send({ message: "An error occurred while updating app version" });
            }
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
