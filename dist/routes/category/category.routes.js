"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = categoryRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function categoryRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Category"],
            querystring: v4_1.default.object({
                lang: v4_1.default.string(),
                page: v4_1.default.string().min(1),
                size: v4_1.default.string().min(1).max(100),
            }),
            summary: "Get All Categories with Pagination",
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        name: v4_1.default.string(),
                        description: v4_1.default.string().nullable(),
                        parentCategoryId: v4_1.default.string().nullable(),
                        culture: v4_1.default.string(),
                        color: v4_1.default.string(),
                        isPremiumCat: v4_1.default.boolean(),
                        isRefCat: v4_1.default.boolean(),
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
            const { lang, page, size } = req.query;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const [total, categories] = await Promise.all([
                        tx.category.count({
                            where: {
                                culture: lang,
                            },
                        }),
                        tx.category.findMany({
                            where: {
                                culture: lang,
                            },
                            skip: (Number(page) - 1) * Number(size),
                            take: Number(size),
                            orderBy: { name: "asc" },
                        }),
                    ]);
                    return {
                        data: categories,
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
                reply.code(500).send({ message: "Internal Server Error" + error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Category"],
            summary: "Get A Category",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const category = await tx.category.findUnique({
                        where: { id },
                        include: {
                            questions: true,
                            parentCategory: true,
                            childCategories: true,
                        },
                    });
                    if (!category) {
                        return { code: 404, error: { message: "Category not found" } };
                    }
                    return { category };
                });
                if (result.error) {
                    reply.code(result.code).send(result.error);
                    return;
                }
                reply.code(200).send(result.category);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/",
        method: "POST",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Category"],
            summary: "Create A Category",
            body: v4_1.default.object({
                name: v4_1.default.string(),
                description: v4_1.default.string().nullable(),
                parentCategoryId: v4_1.default.string(),
                culture: v4_1.default.string(),
                color: v4_1.default.string(),
                isPremiumCat: v4_1.default.boolean(),
                isRefCat: v4_1.default.boolean(),
            }),
        },
        handler: async (req, reply) => {
            const { name, parentCategoryId, culture, color, description, isPremiumCat, isRefCat, } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const createdCategory = await tx.category.create({
                        data: {
                            name,
                            parentCategoryId,
                            culture,
                            color,
                            description,
                            isPremiumCat,
                            isRefCat,
                        },
                    });
                    return { category: createdCategory };
                });
                reply.code(201).send(result.category);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Category"],
            summary: "Update A Category",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
            body: v4_1.default.object({
                name: v4_1.default.string(),
                description: v4_1.default.string().nullable(),
                parentCategoryId: v4_1.default.string(),
                culture: v4_1.default.string(),
                color: v4_1.default.string(),
                isPremiumCat: v4_1.default.boolean(),
                isRefCat: v4_1.default.boolean(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { name, parentCategoryId, culture, color, description, isPremiumCat, isRefCat, } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const category = await tx.category.findUnique({ where: { id } });
                    if (!category) {
                        return { code: 404, error: { message: "Category not found" } };
                    }
                    const updatedCategory = await tx.category.update({
                        where: { id },
                        data: {
                            name,
                            parentCategoryId,
                            culture,
                            color,
                            description,
                            isPremiumCat,
                            isRefCat,
                        },
                    });
                    return { category: updatedCategory };
                });
                if (result.error) {
                    reply.code(result.code).send(result.error);
                    return;
                }
                reply.code(200).send(result.category);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id/categoryQuestionCompleted",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Category"],
            summary: "Complete a user category",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const category = await tx.category.findUnique({ where: { id } });
                    if (!category) {
                        return { code: 404, error: { message: "Category not found" } };
                    }
                    const userCompletedCategory = await tx.userCompletedCategory.create({
                        data: {
                            userId,
                            categoryId: id,
                        },
                    });
                    return { completedCategory: userCompletedCategory };
                });
                if (result.error) {
                    reply.code(result.code).send(result.error);
                    return;
                }
                reply.code(200).send(result.completedCategory);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id/likeCategory",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Category"],
            summary: "User like a category",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var category = await tx.category.findFirst({ where: { id: id } });
                    if (!category) {
                        return { code: 404, error: { message: "Category not found" } };
                    }
                    const createLikedCategory = await tx.userLikedQuestion.create({
                        data: {
                            userId,
                            questionId: id,
                        },
                    });
                    return { likedCategory: createLikedCategory };
                });
                reply.code(201).send(result.likedCategory);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "DELETE",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Category"],
            summary: "Delete A Category",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const category = await tx.category.findUnique({ where: { id } });
                    if (!category) {
                        return { code: 404, error: { message: "Category not found" } };
                    }
                    const deletedCategory = await tx.category.delete({
                        where: { id },
                    });
                    await tx.userLikedCategory.deleteMany({
                        where: { categoryId: id },
                    });
                    await tx.userCompletedCategory.deleteMany({
                        where: { categoryId: id },
                    });
                    return { category: deletedCategory };
                });
                if (result.error) {
                    reply.code(result.code).send(result.error);
                    return;
                }
                reply.code(200).send(result.category);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
}
