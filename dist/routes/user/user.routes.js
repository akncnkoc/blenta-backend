"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = userRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
// import { getMailClient } from "../../lib/mailer";
const confirmation_email_1 = require("../../lib/emails/confirmation-email");
const date_fns_1 = require("date-fns");
const mailer_1 = require("../../lib/mailer");
const isPaidMembership_1 = require("../../lib/isPaidMembership");
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
                        gender: v4_1.default.enum(["MAN", "WOMAN", "UNKNOWN"]),
                        age: v4_1.default.string().nullable(),
                        isPaidMembership: v4_1.default.boolean(),
                        promotionExpiresAt: v4_1.default.string().nullable(),
                        isRegistered: v4_1.default.boolean(),
                        referenceCode: v4_1.default.string(),
                        userAppVersion: v4_1.default.string().nullable(),
                        userLikedEvents: v4_1.default.array(v4_1.default.object({
                            id: v4_1.default.string(),
                            userId: v4_1.default.string(),
                            eventId: v4_1.default.string(),
                            event: v4_1.default.object({
                                id: v4_1.default.string(),
                                name: v4_1.default.string().nullable(),
                                description: v4_1.default.string().nullable(),
                            }),
                        })),
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
            const [user, activePromotionCode] = await Promise.all([
                prisma.user.findUnique({
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
                        userLikedEvents: {
                            include: {
                                event: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true,
                                    },
                                },
                            },
                        },
                    },
                }),
                prisma.userPromotionCode.findFirst({
                    where: {
                        userId: id,
                        expiresAt: {
                            gt: new Date(),
                        },
                    },
                }),
            ]);
            if (!user) {
                return reply.status(401).send({ message: "Unauthorized" });
            }
            if (user.isUserDeactivated) {
                return reply.status(409).send({ message: "User Deactivated" });
            }
            // First check membershipExpiresAt
            const now = new Date();
            const hasValidMembership = user.membershipExpiresAt && new Date(user.membershipExpiresAt) > now;
            // Determine membership status
            const isPaidMembership = hasValidMembership || !!activePromotionCode;
            const promotionExpiresAt = activePromotionCode?.expiresAt?.toISOString() ?? null;
            return reply.status(200).send({
                user: {
                    ...user,
                    isPaidMembership,
                    promotionExpiresAt,
                },
            });
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
                500: v4_1.default.object({
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
                500: v4_1.default.object({
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
                        paidMembershipId: "",
                        membershipRenewedAt: null,
                        membershipExpiresAt: null,
                        memberVendorProductId: "",
                        memberStore: "",
                    },
                });
                await prisma.userPromotionCode.updateMany({
                    where: { userId: userId },
                    data: { expiresAt: new Date() },
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
                        gender: "UNKNOWN",
                        referenceCode: [...Array(8)]
                            .map(() => Math.random().toString(36)[2].toUpperCase())
                            .join(""),
                    },
                });
            }
            if (user.isUserDeactivated) {
                return reply.status(409).send({ message: "User Deactivated" });
            }
            var oneTimePassCode = "";
            if (user.email == "test@apple.com") {
                oneTimePassCode = String("123456");
            }
            else {
                oneTimePassCode = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
            }
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
            try {
                if (user.email != "test@apple.com") {
                    const result = await mail.sendMail(mailTemp);
                    console.log("Mail sent successfully:", result?.response);
                }
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
                    if (user.isUserDeactivated) {
                        return reply.status(409).send({ message: "User Deactivated" });
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
                        isDeactivated: user.isUserDeactivated,
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
                        gender: "UNKNOWN",
                        icloudLoginKey: idToken,
                        email: idToken + "@apple.id",
                        appEnvironment: "PHONE",
                        referenceCode: [...Array(8)]
                            .map(() => Math.random().toString(36)[2].toUpperCase())
                            .join(""),
                    },
                });
            }
            if (user.isUserDeactivated) {
                return reply.status(409).send({ message: "User Deactivated" });
            }
            const payload = {
                id: user.id,
                email: user.email,
                name: user.name,
                surname: user.surname,
                role: user.role,
                isRegistered: user.isRegistered,
                isDeactivated: user.isUserDeactivated,
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
        url: "/deactivate-user",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Deactivate current user",
            response: {
                200: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                });
                if (!user) {
                    return reply.code(404).send({ message: "User not found" });
                }
                if (user.isUserDeactivated) {
                    return reply.code(409).send({ message: "User already deactivated" });
                }
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        isUserDeactivated: true,
                    },
                });
                return reply.code(200).send({ message: "User deactivated" });
            }
            catch (error) {
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
                gender: v4_1.default.enum(["MAN", "WOMAN", "UNKNOWN"]),
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
    fastify.withTypeProvider().route({
        url: "/active-promotion-code",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["User"],
            summary: "Active promotion code for user",
            body: v4_1.default.object({
                code: v4_1.default.string(),
            }),
            response: {
                200: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { code } = req.body;
            try {
                await prisma.$transaction(async (tx) => {
                    const user = await tx.user.findUnique({
                        where: { id: userId },
                    });
                    if (!user) {
                        throw new Error("UserNotFound");
                    }
                    var isUserPremium = await (0, isPaidMembership_1.isPaidMembership)(user.id);
                    if (isUserPremium) {
                        throw new Error("UserAlreadyMember");
                    }
                    var promotionCode = await tx.promotionCode.findFirst({
                        where: { code: code },
                    });
                    if (!promotionCode) {
                        throw new Error("PromotionCodeNotFound");
                    }
                    var promotionCodeExists = await tx.userPromotionCode.findFirst({
                        where: {
                            promotionCodeId: promotionCode.id,
                        },
                    });
                    if (promotionCodeExists) {
                        throw new Error("PromotionCodeAlreadyUsed");
                    }
                    const now = new Date();
                    const extraTimeStr = promotionCode.extraTime; // e.g. "34"
                    // Parse string to integer
                    const extraTime = parseInt(extraTimeStr, 10);
                    if (isNaN(extraTime)) {
                        throw new Error(`Invalid extraTime: ${extraTimeStr}`);
                    }
                    const daysToAdd = Math.floor(extraTime / 24);
                    const hoursToAdd = extraTime % 24;
                    let expiresAt = now;
                    if (daysToAdd > 0) {
                        expiresAt = (0, date_fns_1.addDays)(expiresAt, daysToAdd);
                    }
                    if (hoursToAdd > 0) {
                        expiresAt = (0, date_fns_1.addHours)(expiresAt, hoursToAdd);
                    }
                    await tx.userPromotionCode.create({
                        data: {
                            userId,
                            promotionCodeId: promotionCode.id,
                            expiresAt,
                        },
                    });
                });
                return reply.code(200).send({ message: "User updated" });
            }
            catch (error) {
                if (error instanceof Error && error.message === "UserNotFound") {
                    return reply.code(404).send({ message: "User not found" });
                }
                if (error instanceof Error && error.message === "UserAlreadyMember") {
                    return reply.code(409).send({
                        message: "Cannot use promotion code beacuse already membership activated",
                    });
                }
                if (error instanceof Error &&
                    error.message === "PromotionCodeNotFound") {
                    return reply.code(404).send({ message: "Promotion Code not found" });
                }
                if (error instanceof Error &&
                    error.message === "PromotionCodeAlreadyUsed") {
                    return reply
                        .code(409)
                        .send({ message: "Promotion Code already used" });
                }
                console.error("Update failed:", error);
                return reply
                    .code(500)
                    .send({ message: "An error occurred during update" });
            }
        },
    });
}
