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
        method: "POST",
        url: "/finder",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Event"],
            summary: "Find Events by matching answerTexts (daily limit for non-premium users)",
            body: v4_1.default.object({
                answerTexts: v4_1.default.array(v4_1.default.string().min(1)).nonempty(),
            }),
            response: {
                200: v4_1.default.array(v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string(),
                    description: v4_1.default.string().nullable(),
                    culture: v4_1.default.string(),
                    isUserLiked: v4_1.default.boolean(),
                })),
                400: v4_1.default.object({ message: v4_1.default.string() }),
                429: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { answerTexts } = req.body;
            const userId = req.user.id;
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        id: true,
                        isPaidMembership: true,
                        eventSearchCount: true,
                        eventSearchLastDate: true,
                    },
                });
                if (!user) {
                    return reply.code(400).send({ message: "User not found" });
                }
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let shouldReset = !user.eventSearchLastDate;
                if (user.eventSearchLastDate) {
                    const lastSearchDate = new Date(user.eventSearchLastDate);
                    const lastDate = new Date(lastSearchDate.getFullYear(), lastSearchDate.getMonth(), lastSearchDate.getDate());
                    shouldReset = lastDate.getTime() !== today.getTime();
                }
                const isPremium = await (0, isPaidMembership_1.isPaidMembership)(user.id);
                if (!isPremium) {
                    if (!shouldReset && user.eventSearchCount >= 3) {
                        return reply
                            .code(429)
                            .send({ message: "Daily search limit reached" });
                    }
                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            eventSearchCount: shouldReset ? 1 : user.eventSearchCount + 1,
                            eventSearchLastDate: now,
                        },
                    });
                }
                const normalizedAnswerTexts = answerTexts.map((t) => t.normalize("NFC").toLowerCase());
                const events = (await prisma.$queryRaw `
        SELECT e.id, e.name, e.description, e.culture
        FROM events e
        JOIN event_matches em ON em."eventId" = e.id
        JOIN event_question_answers a ON a.id = em."answerId"
        WHERE LOWER(a.text) = ANY(${normalizedAnswerTexts})
        GROUP BY e.id
        HAVING COUNT(DISTINCT LOWER(a.text)) = ${normalizedAnswerTexts.length}
      `);
                const eventIds = events.map((e) => e.id.toString());
                const likedEvents = await prisma.userLikedEvent.findMany({
                    where: {
                        userId,
                        eventId: { in: eventIds },
                    },
                    select: { eventId: true },
                });
                const likedEventIdSet = new Set(likedEvents.map((e) => e.eventId));
                const safeEvents = events.map((e) => ({
                    id: e.id.toString(),
                    name: e.name,
                    description: e.description,
                    culture: e.culture,
                    isUserLiked: likedEventIdSet.has(e.id.toString()),
                }));
                return reply.code(200).send(safeEvents);
            }
            catch (error) {
                console.error("Event Finder Error:", error);
                return reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "POST",
        url: "/",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Create a new Event and link answer matches",
            body: v4_1.default.object({
                name: v4_1.default.string(),
                description: v4_1.default.string().optional(),
                culture: v4_1.default.string().optional(),
                answerIds: v4_1.default.array(v4_1.default.uuid()).nonempty(),
            }),
            response: {
                201: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string().nullable(),
                    description: v4_1.default.string().nullable(),
                    culture: v4_1.default.string().nullable(),
                    matches: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        answerId: v4_1.default.string(),
                    })),
                }),
                400: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (request, reply) => {
            const { name, description, culture, answerIds } = request.body;
            try {
                const event = await prisma.event.create({
                    data: {
                        name,
                        description,
                        culture,
                        matches: {
                            create: answerIds.map((answerId) => ({
                                answerId,
                            })),
                        },
                    },
                    include: {
                        matches: true,
                    },
                });
                return reply.status(201).send(event);
            }
            catch (error) {
                console.error(error);
                return reply.status(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "GET",
        url: "/",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Get all events with matches (paginated & filtered)",
            querystring: v4_1.default.object({
                page: v4_1.default.string().optional(),
                size: v4_1.default.string().optional(),
                lang: v4_1.default.string().optional(),
                culture: v4_1.default.string().optional(),
                search: v4_1.default.string().optional(),
            }),
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        name: v4_1.default.string().nullable(),
                        description: v4_1.default.string().nullable(),
                        culture: v4_1.default.string().nullable(),
                        matches: v4_1.default.array(v4_1.default.object({
                            id: v4_1.default.string(),
                            answerId: v4_1.default.string(),
                        })),
                    })),
                    meta: v4_1.default.object({
                        total: v4_1.default.number(),
                        page: v4_1.default.number(),
                        size: v4_1.default.number(),
                    }),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (request, reply) => {
            try {
                const { page = "1", size = "10", lang, culture, search, } = request.query;
                const pageNum = Math.max(1, parseInt(page));
                const sizeNum = Math.max(1, parseInt(size));
                const where = {
                    AND: [
                        lang ? { culture: { equals: lang } } : {},
                        culture ? { culture: { equals: culture } } : {},
                        search
                            ? {
                                OR: [
                                    { name: { contains: search, mode: "insensitive" } },
                                    { description: { contains: search, mode: "insensitive" } },
                                ],
                            }
                            : {},
                    ],
                };
                const [events, total] = await Promise.all([
                    prisma.event.findMany({
                        where,
                        include: {
                            matches: true,
                        },
                        orderBy: {
                            name: "asc",
                        },
                        skip: (pageNum - 1) * sizeNum,
                        take: sizeNum,
                    }),
                    prisma.event.count({ where }),
                ]);
                reply.code(200).send({
                    data: events,
                    meta: {
                        total,
                        page: pageNum,
                        size: sizeNum,
                    },
                });
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    // GET event by id
    fastify.withTypeProvider().route({
        method: "GET",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Get an event by id with matches",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string().nullable(),
                    description: v4_1.default.string().nullable(),
                    culture: v4_1.default.string().nullable(),
                    matches: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        answerId: v4_1.default.string(),
                    })),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const event = await prisma.event.findUnique({
                    where: { id },
                    include: { matches: true },
                });
                if (!event) {
                    return reply.status(404).send({ message: "Event not found" });
                }
                reply.code(200).send(event);
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    // UPDATE event by id (replace matches)
    fastify.withTypeProvider().route({
        method: "PUT",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Update event and its answer matches",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            body: v4_1.default.object({
                name: v4_1.default.string(),
                description: v4_1.default.string().optional(),
                culture: v4_1.default.string().optional(),
                answerIds: v4_1.default.array(v4_1.default.string()).nonempty(),
            }),
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    name: v4_1.default.string().nullable(),
                    description: v4_1.default.string().nullable(),
                    culture: v4_1.default.string().nullable(),
                    matches: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        answerId: v4_1.default.string(),
                    })),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { name, description, culture, answerIds } = req.body;
            try {
                const existing = await prisma.event.findUnique({ where: { id } });
                if (!existing) {
                    return reply.status(404).send({ message: "Event not found" });
                }
                const updated = await prisma.$transaction(async (tx) => {
                    // matches'i temizle
                    await tx.eventMatch.deleteMany({ where: { eventId: id } });
                    // event güncelle
                    const ev = await tx.event.update({
                        where: { id },
                        data: {
                            name,
                            description,
                            culture,
                            matches: {
                                create: answerIds.map((answerId) => ({
                                    answerId,
                                })),
                            },
                        },
                        include: { matches: true },
                    });
                    return ev;
                });
                reply.code(200).send(updated);
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    // DELETE event by id
    fastify.withTypeProvider().route({
        method: "DELETE",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["Event"],
            summary: "Delete an event and its matches",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            response: {
                204: v4_1.default.null(),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const existing = await prisma.event.findUnique({ where: { id } });
                if (!existing) {
                    return reply.status(404).send({ message: "Event not found" });
                }
                await prisma.$transaction(async (tx) => {
                    await tx.eventMatch.deleteMany({ where: { eventId: id } });
                    await tx.event.delete({ where: { id } });
                });
                reply.code(204).send(null);
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    // UPDATE event by id (replace matches)
    fastify.withTypeProvider().route({
        method: "PUT",
        url: "/:id/like-event",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Event"],
            summary: "Like event",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            response: {
                200: v4_1.default.object({
                    message: v4_1.default.string(),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const existing = await prisma.event.findUnique({ where: { id } });
                if (!existing) {
                    return reply.status(404).send({ message: "Event not found" });
                }
                var userLikedEvent = await prisma.userLikedEvent.findFirst({
                    where: {
                        userId,
                        eventId: id,
                    },
                });
                if (userLikedEvent) {
                    return reply.status(409).send({ message: "Event already liked" });
                }
                await prisma.userLikedEvent.create({
                    data: {
                        userId,
                        eventId: id,
                    },
                });
                reply.code(200).send({ message: "User liked event" });
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "PUT",
        url: "/:id/unlike-event",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Event"],
            summary: "Unlike event",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            response: {
                200: v4_1.default.object({
                    message: v4_1.default.string(),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const existing = await prisma.event.findUnique({ where: { id } });
                if (!existing) {
                    return reply.status(404).send({ message: "Event not found" });
                }
                var userLikedEvent = await prisma.userLikedEvent.findFirst({
                    where: {
                        userId,
                        eventId: id,
                    },
                });
                if (!userLikedEvent) {
                    return reply.status(409).send({ message: "Event not liked before" });
                }
                await prisma.userLikedEvent.deleteMany({
                    where: {
                        userId,
                        eventId: id,
                    },
                });
                reply.code(200).send({ message: "User unliked event" });
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
}
