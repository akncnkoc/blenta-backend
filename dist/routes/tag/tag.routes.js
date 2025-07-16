"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tagRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function tagRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/category/:categoryId",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Tag"],
            summary: "Get Category Tags",
            params: v4_1.default.object({
                categoryId: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { categoryId } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    // 1. categoryTag kayıtlarını al - hem tagId hem categoryTagId dönecek
                    const catTags = await tx.categoryTag.findMany({
                        where: { categoryId },
                        select: {
                            id: true, // categoryTagId
                            tagId: true,
                        },
                    });
                    const tagIds = catTags.map((ct) => ct.tagId);
                    // 2. tag kayıtlarını al
                    const tags = await tx.tag.findMany({
                        where: { id: { in: tagIds } },
                    });
                    // 3. categoryTagId ile tag'leri eşleştirerek döndür
                    const enrichedTags = catTags.map((ct) => {
                        const tag = tags.find((t) => t.id === ct.tagId);
                        return {
                            categoryTagId: ct.id,
                            ...tag,
                        };
                    });
                    return {
                        tags: enrichedTags,
                    };
                });
                reply.code(200).send(result);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Tag"],
            querystring: v4_1.default.object({
                page: v4_1.default.string().min(1),
                size: v4_1.default.string().min(1).max(100),
                search: v4_1.default.string().optional().nullable(), // 🔍 add search param
            }),
            summary: "Get All Tags With Pagination",
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        name: v4_1.default.string(),
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
            const { page, size, search } = req.query;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const whereClause = {
                        ...(search
                            ? {
                                name: {
                                    contains: search,
                                    mode: client_1.Prisma.QueryMode.insensitive,
                                },
                            }
                            : {}),
                    };
                    const [total, tags] = await Promise.all([
                        tx.tag.count({
                            where: {
                                ...whereClause,
                            },
                        }),
                        tx.tag.findMany({
                            where: {
                                ...whereClause,
                            },
                            include: { categoryTags: true },
                            skip: (Number(page) - 1) * Number(size),
                            take: Number(size),
                            orderBy: { name: "asc" },
                        }),
                    ]);
                    return {
                        data: tags,
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
            tags: ["Tag"],
            summary: "Create A Tag",
            body: v4_1.default.object({
                name: v4_1.default.string(),
            }),
        },
        handler: async (req, reply) => {
            const { name } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var tag = await tx.tag.findFirst({
                        where: {
                            name: {
                                contains: name,
                                mode: client_1.Prisma.QueryMode.insensitive,
                            },
                        },
                    });
                    if (tag) {
                        return { code: 409, error: { message: "Tag already exists" } };
                    }
                    const createdTag = await tx.tag.create({
                        data: {
                            name,
                        },
                    });
                    return { tag: createdTag };
                });
                reply.code(201).send(result.tag);
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
            tags: ["Tag"],
            summary: "Update A Tag",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
            body: v4_1.default.object({
                name: v4_1.default.string(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { name } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var tag = await tx.tag.findFirst({ where: { id: id } });
                    if (!tag) {
                        return { code: 404, error: { message: "Tag not found" } };
                    }
                    const updatedTag = await tx.tag.update({
                        where: { id },
                        data: {
                            name,
                        },
                    });
                    return { tag: updatedTag };
                });
                reply.code(201).send(result.tag);
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
            tags: ["Tag"],
            summary: "Delete a TAg",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var tag = await tx.tag.findFirst({ where: { id: id } });
                    if (!tag) {
                        return { code: 404, error: { message: "Tag not found" } };
                    }
                    const deletedTag = await tx.tag.delete({
                        where: { id },
                    });
                    const deletedTagRelations = await tx.categoryTag.findMany({
                        where: { tagId: id },
                    });
                    return { tag: deletedTag };
                });
                reply.code(200).send(result.tag);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/categoryTag/:id",
        method: "DELETE",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Tag"],
            summary: "Delete a Category Tag",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var categoryTag = await tx.categoryTag.findFirst({
                        where: { id: id },
                    });
                    if (!categoryTag) {
                        return { code: 404, error: { message: "Category Tag not found" } };
                    }
                    const deletedCategoryTag = await tx.categoryTag.delete({
                        where: { id },
                    });
                    return { deletedCategoryTag };
                });
                reply.code(200).send(result.deletedCategoryTag);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
}
