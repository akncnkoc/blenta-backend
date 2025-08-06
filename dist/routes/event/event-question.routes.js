"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = eventQuestionRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function eventQuestionRoutes(fastify) {
    fastify.withTypeProvider().route({
        method: "GET",
        url: "/",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["EventQuestion"],
            summary: "Get all Event Questions with their Answers (with pagination)",
            querystring: v4_1.default.object({
                page: v4_1.default.string().optional(),
                size: v4_1.default.string().optional(),
                lang: v4_1.default.string().optional(), // NEW
                search: v4_1.default.string().optional(), // NEW
            }),
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        text: v4_1.default.string(),
                        culture: v4_1.default.string(),
                        answers: v4_1.default.array(v4_1.default.object({
                            id: v4_1.default.string(),
                            text: v4_1.default.string(),
                        })),
                    })),
                    meta: v4_1.default.object({
                        page: v4_1.default.number(),
                        size: v4_1.default.number(),
                        total: v4_1.default.number(),
                    }),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { page = "1", size = "10", lang, search } = req.query;
            const pageNum = Math.max(1, parseInt(page));
            const sizeNum = Math.max(1, parseInt(size));
            try {
                // WHERE koşulları oluştur
                const whereClauseParts = [];
                if (lang)
                    whereClauseParts.push(`eq."culture" = '${lang}'`);
                if (search)
                    whereClauseParts.push(`eq."text" ILIKE '%${search}%'`);
                const whereClause = whereClauseParts.length > 0
                    ? `WHERE ${whereClauseParts.join(" AND ")}`
                    : "";
                // Ana soru verilerini çek (random sıralı)
                const questions = await prisma.$queryRawUnsafe(`
      SELECT eq.id, eq.text, eq.culture
      FROM "event_questions" eq
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT ${sizeNum}
      OFFSET ${(pageNum - 1) * sizeNum}
      `);
                // Cevapları ayrı çek
                const questionIds = questions.map((q) => `'${q.id}'`).join(",");
                const answers = questionIds.length > 0
                    ? await prisma.$queryRawUnsafe(`
            SELECT eqa.id, eqa.text, eqa."questionId"
            FROM "event_question_answers" eqa
            WHERE eqa."eventQuestionId" IN (${questionIds})
            ORDER BY eqa.text ASC
            `)
                    : [];
                // Cevapları sorulara bağla
                const questionMap = questions.map((q) => ({
                    ...q,
                    answers: answers
                        .filter((a) => a.eventQuestionId === q.id)
                        .map((a) => ({ id: a.id, text: a.text })),
                }));
                // Toplam sayıyı çek
                const totalCountResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM "event_questions" eq
      ${whereClause}
      `);
                const total = totalCountResult[0]?.count ?? 0;
                reply.code(200).send({
                    data: questionMap,
                    meta: {
                        page: pageNum,
                        size: sizeNum,
                        total,
                    },
                });
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    // GET single question by id with answers
    fastify.withTypeProvider().route({
        method: "GET",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventQuestion"],
            summary: "Get Event Question by id with answers",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    text: v4_1.default.string(),
                    culture: v4_1.default.string(),
                    answers: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        text: v4_1.default.string(),
                    })),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const question = await prisma.eventQuestion.findUnique({
                    where: { id },
                    include: { answers: true },
                });
                if (!question) {
                    return reply
                        .status(404)
                        .send({ message: "Event question not found" });
                }
                reply.code(200).send(question);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "POST",
        url: "/",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventQuestion"],
            summary: "Create Event Question",
            body: v4_1.default.object({
                text: v4_1.default.string(),
                culture: v4_1.default.string(),
                answers: v4_1.default.array(v4_1.default.string()).default([]),
            }),
            response: {
                201: v4_1.default.object({
                    text: v4_1.default.string(),
                    culture: v4_1.default.string(),
                }),
                409: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { answers, culture, text } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const existing = await prisma.eventQuestion.findFirst({
                        where: { text },
                    });
                    if (existing) {
                        return {
                            code: 409,
                            error: { message: "Event question already added" },
                        };
                    }
                    await tx.eventQuestion.create({
                        data: {
                            text,
                            culture,
                            answers: {
                                create: answers.map((a) => ({ text: a })),
                            },
                        },
                        include: { answers: true },
                    });
                    return {
                        text,
                        culture,
                    };
                });
                if ("error" in result) {
                    return reply.code(result.code ?? 500).send(result.error);
                }
                reply.code(201).send(result);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "PUT",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventQuestion"],
            summary: "Update an Event Question",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            body: v4_1.default.object({
                text: v4_1.default.string(),
                culture: v4_1.default.string(),
                answers: v4_1.default.array(v4_1.default.string()).optional(), // cevap metinleri opsiyonel
            }),
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    text: v4_1.default.string(),
                    culture: v4_1.default.string(),
                    answers: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        text: v4_1.default.string(),
                        questionId: v4_1.default.string(),
                    })),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { text, culture, answers } = req.body;
            try {
                // Soru ve cevapları yükle
                const existing = await prisma.eventQuestion.findUnique({
                    where: { id },
                    include: { answers: true },
                });
                if (!existing) {
                    return reply
                        .status(404)
                        .send({ message: "Event question not found" });
                }
                const updated = await prisma.$transaction(async (tx) => {
                    // EventQuestion güncelle
                    await tx.eventQuestion.update({
                        where: { id },
                        data: { text, culture },
                    });
                    if (answers && answers.length > 0) {
                        // Mevcut cevapların metinleri
                        const existingAnswerTexts = existing.answers.map((a) => a.text);
                        // Yeni cevap metinleri - var olanlarda olmayanlar
                        const newAnswers = answers.filter((a) => !existingAnswerTexts.includes(a));
                        if (newAnswers.length > 0) {
                            await tx.eventQuestionAnswer.createMany({
                                data: newAnswers.map((text) => ({
                                    questionId: id,
                                    text,
                                })),
                            });
                        }
                    }
                    // Güncellenmiş soru + cevapları tekrar al
                    const updatedQuestion = await tx.eventQuestion.findUnique({
                        where: { id },
                        include: { answers: true },
                    });
                    if (!updatedQuestion) {
                        throw new Error("Updated question not found after update");
                    }
                    return { updatedQuestion };
                });
                reply.code(200).send(updated.updatedQuestion);
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    // DELETE EventQuestion
    fastify.withTypeProvider().route({
        method: "DELETE",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventQuestion"],
            summary: "Delete an Event Question and its related data",
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
                // 1. Mevcut question var mı kontrol et
                const existing = await prisma.eventQuestion.findUnique({
                    where: { id },
                    include: { answers: true }, // bağlı answerları getir
                });
                if (!existing) {
                    return reply
                        .status(404)
                        .send({ message: "Event question not found" });
                }
                const answerIds = existing.answers.map((a) => a.id);
                // 2. Önce event_matches kayıtlarını sil (answerId üzerinden)
                if (answerIds.length > 0) {
                    await prisma.eventMatch.deleteMany({
                        where: {
                            answerId: { in: answerIds },
                        },
                    });
                    // 3. Sonra answer’ları sil
                    await prisma.eventQuestionAnswer.deleteMany({
                        where: {
                            id: { in: answerIds },
                        },
                    });
                }
                // 4. En son question’ı sil
                await prisma.eventQuestion.delete({
                    where: { id },
                });
                reply.code(204).send(null);
            }
            catch (error) {
                console.error(error);
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
}
