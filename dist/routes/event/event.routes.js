"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = eventRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const isPaidMembership_1 = require("../../lib/isPaidMembership");
const prisma = new client_1.PrismaClient();
async function eventRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/finder",
        method: "POST",
        preHandler: [fastify.authenticate], // kullanıcının kimliğini doğrulamalı
        schema: {
            tags: ["Event"],
            summary: "Find Events by Tags with Daily Limit",
            body: v4_1.default.object({
                culture: v4_1.default.string(),
                tagIds: v4_1.default.array(v4_1.default.uuid()).min(1), // kullanıcı bir veya daha fazla tag gönderir
            }),
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        name: v4_1.default.string(),
                        culture: v4_1.default.string().nullable(),
                    })),
                }),
                403: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { tagIds } = req.body;
            const userId = req.user.id;
            try {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (!user)
                    return reply.code(403).send({ message: "User not found" });
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isNewDay = !user.eventSearchLastDate || user.eventSearchLastDate < today;
                const premium = await (0, isPaidMembership_1.isPaidMembership)(user.id);
                if (!premium) {
                    if (isNewDay) {
                        await prisma.user.update({
                            where: { id: userId },
                            data: {
                                eventSearchCount: 1,
                                eventSearchLastDate: new Date(),
                            },
                        });
                    }
                    else if (user.eventSearchCount >= 3) {
                        return reply.code(403).send({
                            message: "Günlük limitinize ulaştınız. Sınırsız kullanım için premium olun.",
                        });
                    }
                    else {
                        await prisma.user.update({
                            where: { id: userId },
                            data: {
                                eventSearchCount: { increment: 1 },
                            },
                        });
                    }
                }
                // Rastgele bir event döndür
                const randomEvent = (await prisma.$queryRaw `
      SELECT e.id, e.name, e.culture
      FROM "events" e
      JOIN "event_to_event_tags" ett ON e.id = ett.event_id
      WHERE ett.event_tag_id = ANY(${tagIds})
      ORDER BY RANDOM()
      LIMIT 1
    `);
                if (!randomEvent.length) {
                    return reply.code(200).send({ data: [] });
                }
                return reply.code(200).send({ data: [randomEvent[0]] });
            }
            catch (err) {
                return reply
                    .code(500)
                    .send({ message: "Internal Server Error: " + err });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Event"],
            querystring: v4_1.default.object({
                lang: v4_1.default.string().min(1),
                page: v4_1.default.string().min(1),
                size: v4_1.default.string().min(1).max(100),
                search: v4_1.default.string().optional().nullable(), // 🔍 add search param
            }),
            summary: "Get All Events",
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        name: v4_1.default.string(),
                        culture: v4_1.default.string().nullable(),
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
                    const [total, events] = await Promise.all([
                        tx.event.count({
                            where: {
                                ...whereClause,
                            },
                        }),
                        tx.event.findMany({
                            where: {
                                ...whereClause,
                            },
                            skip: (Number(page) - 1) * Number(size),
                            take: Number(size),
                            orderBy: { name: "asc" },
                        }),
                    ]);
                    return {
                        data: events,
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
            tags: ["Event"],
            params: v4_1.default.object({
                id: v4_1.default.string(),
            }),
            summary: "Get Event",
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string(),
                    culture: v4_1.default.string().nullable(),
                    tagIds: v4_1.default.array(v4_1.default.uuid()),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const event = await tx.event.findFirst({
                        where: { id },
                        include: {
                            event_to_event_tags: {
                                select: {
                                    event_tag_id: true, // sadece tag id'lerini alıyoruz
                                },
                            },
                        },
                    });
                    if (!event) {
                        return { code: 404, error: { message: "Event not found" } };
                    }
                    // Tag Id'leri array olarak alalım
                    const tagIds = event.event_to_event_tags.map((t) => t.event_tag_id);
                    // Dönüş objesi
                    return {
                        data: {
                            id: event.id,
                            name: event.name,
                            culture: event.culture,
                            tagIds,
                        },
                    };
                });
                reply.code(200).send(result.data);
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
            tags: ["Event"],
            summary: "Create A Event",
            body: v4_1.default.object({
                name: v4_1.default.string(),
                culture: v4_1.default.string(),
                tagIds: v4_1.default.array(v4_1.default.uuid()).optional().default([]),
            }),
            response: {
                201: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string(),
                }),
                409: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { name, culture, tagIds } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const existingEvent = await tx.event.findFirst({
                        where: {
                            name: {
                                contains: name,
                                mode: client_1.Prisma.QueryMode.insensitive,
                            },
                        },
                    });
                    if (existingEvent) {
                        return { code: 409, error: { message: "Event already exists" } };
                    }
                    const createdEvent = await tx.event.create({
                        data: { name, culture },
                    });
                    if (tagIds.length > 0) {
                        await tx.eventToEventTag.createMany({
                            data: tagIds.map((tagId) => ({
                                event_id: createdEvent.id,
                                event_tag_id: tagId,
                            })),
                            skipDuplicates: true, // aynı tag iki kez gelirse sorun çıkarmaz
                        });
                    }
                    return { createdEvent };
                });
                if ("error" in result) {
                    return reply.code(result.code ?? 500).send(result.error);
                }
                reply.code(201).send(result.createdEvent);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "PUT",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Update A Event",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
            body: v4_1.default.object({
                name: v4_1.default.string(),
                tagIds: v4_1.default.array(v4_1.default.uuid()).optional().default([]),
                culture: v4_1.default.string(),
            }),
            response: {
                201: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string(),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { name, culture, tagIds } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const event = await tx.event.findUnique({ where: { id } });
                    if (!event) {
                        return { code: 404, error: { message: "Event not found" } };
                    }
                    // Event ismini güncelle
                    const updatedEvent = await tx.event.update({
                        where: { id },
                        data: { name, culture },
                    });
                    // Tag ekleme işlemi
                    if (tagIds.length > 0) {
                        const existingTags = await tx.eventToEventTag.findMany({
                            where: {
                                event_id: id,
                                event_tag_id: { in: tagIds },
                            },
                            select: { event_tag_id: true },
                        });
                        const existingTagIds = new Set(existingTags.map((t) => t.event_tag_id));
                        const newTagIds = tagIds.filter((tagId) => !existingTagIds.has(tagId));
                        if (newTagIds.length > 0) {
                            await tx.eventToEventTag.createMany({
                                data: newTagIds.map((tagId) => ({
                                    event_id: id,
                                    event_tag_id: tagId,
                                })),
                                skipDuplicates: true,
                            });
                        }
                    }
                    return { updatedEvent };
                });
                if ("error" in result) {
                    return reply.code(result.code ?? 500).send(result.error);
                }
                reply.code(201).send(result.updatedEvent);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "DELETE",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Delete a Event",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var event = await tx.event.findFirst({ where: { id: id } });
                    if (!event) {
                        return { code: 404, error: { message: "Event not found" } };
                    }
                    await tx.eventToEventTag.deleteMany({
                        where: { event_id: id },
                    });
                    const deletedEvent = await tx.event.delete({
                        where: { id },
                    });
                    return { deletedEvent };
                });
                reply.code(200).send(result.deletedEvent);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/eventToEventTag/:eventId/:eventTagId",
        method: "PUT",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Add To Event A Event Tag",
            params: v4_1.default.object({
                eventId: v4_1.default.string().nonempty(),
                eventTagId: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { eventId, eventTagId } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var event = await tx.event.findFirst({
                        where: { id: event },
                    });
                    if (!event) {
                        return {
                            code: 404,
                            error: { message: "Event not found" },
                        };
                    }
                    var eventTag = await tx.eventTag.findFirst({
                        where: { id: eventTagId },
                    });
                    if (!eventTag) {
                        return {
                            code: 404,
                            error: { message: "Event tag not found" },
                        };
                    }
                    var eventToEventTagExists = await tx.eventToEventTag.findFirst({
                        where: { event_id: eventId, event_tag_id: eventTagId },
                    });
                    if (eventToEventTagExists) {
                        return {
                            code: 409,
                            error: { message: "Event To Event tag already added" },
                        };
                    }
                    var eventToEventTagCreated = await tx.eventToEventTag.create({
                        data: { event_id: eventId, event_tag_id: eventTagId },
                    });
                    return { eventToEventTagCreated };
                });
                reply.code(200).send(result.eventToEventTagCreated);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/eventToEventTag/:eventToEventTagId",
        method: "DELETE",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Delete a Event To Event Tag",
            params: v4_1.default.object({
                eventToEventTagId: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { eventToEventTagId } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var eventToEventTag = await tx.eventToEventTag.findFirst({
                        where: { id: eventToEventTagId },
                    });
                    if (!eventToEventTag) {
                        return {
                            code: 404,
                            error: { message: "Event to event tag not found" },
                        };
                    }
                    const deletedEventToEventTag = await tx.eventToEventTag.delete({
                        where: { id: eventToEventTagId },
                    });
                    return { deletedEventToEventTag };
                });
                reply.code(200).send(result.deletedEventToEventTag);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
}
