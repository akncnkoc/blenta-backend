"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = eventTagRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function eventTagRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["EventTag"],
            querystring: v4_1.default.object({
                lang: v4_1.default.string().min(1),
                page: v4_1.default.string().min(1),
                size: v4_1.default.string().min(1).max(100),
                search: v4_1.default.string().optional().nullable(), // 🔍 add search param
            }),
            summary: "Get All Event Tags",
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        name: v4_1.default.string(),
                        culture: v4_1.default.string().nullable(),
                        question: v4_1.default.string(),
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
            const { page, size, search, lang } = req.query;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const whereClause = {
                        culture: lang,
                        ...(search
                            ? {
                                name: {
                                    contains: search,
                                    mode: client_1.Prisma.QueryMode.insensitive,
                                },
                            }
                            : {}),
                    };
                    const [total, eventTags] = await Promise.all([
                        tx.eventTag.count({
                            where: {
                                ...whereClause,
                            },
                        }),
                        tx.eventTag.findMany({
                            where: {
                                ...whereClause,
                            },
                            skip: (Number(page) - 1) * Number(size),
                            take: Number(size),
                            orderBy: { name: "asc" },
                        }),
                    ]);
                    return {
                        data: eventTags,
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
        url: "/:id",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["EventTag"],
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
            summary: "Get Event",
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string(),
                    culture: v4_1.default.string().nullable(),
                    question: v4_1.default.string(),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var eventTag = await tx.eventTag.findFirst({ where: { id } });
                    if (!eventTag) {
                        return { code: 404, message: "Event tag not found" };
                    }
                    return { eventTag };
                });
                reply.code(200).send(result.eventTag);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error: " + error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/get-random",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["EventTag"],
            summary: "Get Event",
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string(),
                    culture: v4_1.default.string().nullable(),
                    question: v4_1.default.string(),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            try {
                const totalCount = await prisma.eventTag.count();
                if (totalCount === 0) {
                    return reply.code(404).send({ message: "No event tags available." });
                }
                const randomSkip = Math.floor(Math.random() * totalCount);
                const randomEventTag = await prisma.eventTag.findFirst({
                    skip: randomSkip,
                });
                if (!randomEventTag) {
                    return reply
                        .code(404)
                        .send({ message: "Random event tag not found." });
                }
                // Assume question is a string field on eventTag, adapt as needed
                return reply.code(200).send({
                    id: randomEventTag.id,
                    name: randomEventTag.name,
                    culture: randomEventTag.culture,
                    question: randomEventTag.question ?? "", // fallback if nullable
                });
            }
            catch (error) {
                return reply.code(500).send({
                    message: "Internal Server Error: " + error.message,
                });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "POST",
        url: "/",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventTag"],
            summary: "Create A Event Tag",
            body: v4_1.default.object({
                name: v4_1.default.string(),
                culture: v4_1.default.string(),
                question: v4_1.default.string(),
            }),
        },
        handler: async (req, reply) => {
            const { name, culture, question } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var eventTag = await tx.eventTag.findFirst({
                        where: {
                            name: {
                                contains: name,
                                mode: client_1.Prisma.QueryMode.insensitive,
                            },
                        },
                    });
                    if (eventTag) {
                        return { code: 409, error: { message: "Tag already exists" } };
                    }
                    const createdTag = await tx.eventTag.create({
                        data: {
                            name,
                            culture,
                            question,
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
            tags: ["EventTag"],
            summary: "Update A Event Tag",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
            body: v4_1.default.object({
                name: v4_1.default.string(),
                culture: v4_1.default.string(),
                question: v4_1.default.string(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { name, culture, question } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var tag = await tx.eventTag.findFirst({ where: { id: id } });
                    if (!tag) {
                        return { code: 404, error: { message: "Tag not found" } };
                    }
                    const updatedTag = await tx.eventTag.update({
                        where: { id },
                        data: {
                            name,
                            culture,
                            question,
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
            tags: ["EventTag"],
            summary: "Delete a Event Tag",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var tag = await tx.eventTag.findFirst({ where: { id: id } });
                    if (!tag) {
                        return { code: 404, error: { message: "Tag not found" } };
                    }
                    const deletedTag = await tx.eventTag.delete({
                        where: { id },
                    });
                    await tx.eventToEventTag.deleteMany({
                        where: { event_tag_id: id },
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
}
