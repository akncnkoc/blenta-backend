"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = promotionCodeRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function promotionCodeRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/",
        method: "GET",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["PromotionCode"],
            querystring: v4_1.default.object({
                page: v4_1.default.string().min(1),
                size: v4_1.default.string().min(1).max(100),
                search: v4_1.default.string().optional().nullable(), // 🔍 add search param
            }),
            summary: "Get All Promotion Codes",
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        code: v4_1.default.string(),
                        extraTime: v4_1.default.string(),
                        alreadyUsed: v4_1.default.boolean(),
                    })),
                    meta: v4_1.default.object({
                        total: v4_1.default.number(),
                        page: v4_1.default.string(),
                        size: v4_1.default.string(),
                        pageCount: v4_1.default.number(),
                    }),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { page, size, search } = req.query;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const whereClause = {
                        ...(search
                            ? {
                                code: {
                                    contains: search,
                                    mode: client_1.Prisma.QueryMode.insensitive,
                                },
                            }
                            : {}),
                    };
                    const [total, promotionCodes, usedCodes] = await Promise.all([
                        tx.promotionCode.count({ where: whereClause }),
                        tx.promotionCode.findMany({
                            where: whereClause,
                            skip: (Number(page) - 1) * Number(size),
                            take: Number(size),
                            orderBy: { code: "asc" },
                        }),
                        tx.userPromotionCode.findMany({
                            where: {
                                promotionCodeId: {
                                    in: (await tx.promotionCode.findMany({
                                        where: whereClause,
                                        select: { id: true },
                                        skip: (Number(page) - 1) * Number(size),
                                        take: Number(size),
                                    })).map((p) => p.id),
                                },
                            },
                            select: { promotionCodeId: true },
                        }),
                    ]);
                    const usedCodeIds = new Set(usedCodes.map((u) => u.promotionCodeId));
                    const data = promotionCodes.map((code) => ({
                        id: code.id,
                        code: code.code,
                        extraTime: code.extraTime,
                        alreadyUsed: usedCodeIds.has(code.id),
                    }));
                    return {
                        data,
                        meta: {
                            total,
                            page,
                            size,
                            pageCount: Math.ceil(total / Number(size)),
                        },
                    };
                });
                reply.code(200).send(result);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error: " + error });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "POST",
        url: "/",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["PromotionCode"],
            summary: "Create A Promotion Code",
            body: v4_1.default.object({
                code: v4_1.default.string(),
                extraTime: v4_1.default.string(),
            }),
        },
        handler: async (req, reply) => {
            const { code, extraTime } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var promotioncode = await tx.promotionCode.findFirst({
                        where: {
                            code: {
                                contains: code,
                                mode: client_1.Prisma.QueryMode.insensitive,
                            },
                        },
                    });
                    if (promotioncode) {
                        return {
                            code: 409,
                            error: { message: "Promotion Code already exists" },
                        };
                    }
                    const createdPromotionCode = await tx.promotionCode.create({
                        data: {
                            code,
                            extraTime,
                        },
                    });
                    return { promotionCode: createdPromotionCode };
                });
                reply.code(201).send(result.promotionCode);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "PUT",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["PromotionCode"],
            summary: "Update A Promotion Code",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
            body: v4_1.default.object({
                code: v4_1.default.string(),
                extraTime: v4_1.default.string(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { code, extraTime } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var promotionCode = await tx.promotionCode.findFirst({
                        where: { id: id },
                    });
                    if (!promotionCode) {
                        return {
                            code: 404,
                            error: { message: "Promotion Code not found" },
                        };
                    }
                    const updatedPromotionCode = await tx.promotionCode.update({
                        where: { id },
                        data: {
                            code,
                            extraTime,
                        },
                    });
                    return { promotionCode: promotionCode };
                });
                reply.code(201).send(result.promotionCode);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "DELETE",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["PromotionCode"],
            summary: "Delete a Promotion Code",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var promotionCode = await tx.promotionCode.findFirst({
                        where: { id: id },
                    });
                    if (!promotionCode) {
                        return {
                            code: 404,
                            error: { message: "Promotion Code not found" },
                        };
                    }
                    const deletedPromotionCode = await tx.promotionCode.delete({
                        where: { id },
                    });
                    const deletedPromotionCodes = await tx.userPromotionCode.findMany({
                        where: { promotionCodeId: id },
                    });
                    return { promotionCode: promotionCode };
                });
                reply.code(201).send(result.promotionCode);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
}
