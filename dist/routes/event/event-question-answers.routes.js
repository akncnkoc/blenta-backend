"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = eventQuestionAnswerRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function eventQuestionAnswerRoutes(fastify) {
    fastify.withTypeProvider().route({
        method: "GET",
        url: "/",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventQuestionAnswer"],
            summary: "List Event Question Answers, optionally filtered by questionId, with pagination",
            querystring: v4_1.default.object({
                questionId: v4_1.default.uuid().optional(),
                page: v4_1.default.string().optional(),
                size: v4_1.default.string().optional(),
            }),
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        text: v4_1.default.string(),
                        questionId: v4_1.default.string(),
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
        handler: async (req, reply) => {
            const { questionId, page = "1", size = "10" } = req.query;
            const pageNum = Math.max(1, parseInt(page));
            const sizeNum = Math.max(1, parseInt(size));
            try {
                const offset = (pageNum - 1) * sizeNum;
                const data = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT ON ("text") id, text, "questionId"
        FROM event_question_answers
        ${questionId ? `WHERE "questionId" = '${questionId}'` : ""}
        ORDER BY "text" ASC
        LIMIT ${sizeNum} OFFSET ${offset}
        `);
                const countResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS count FROM (
          SELECT DISTINCT "text"
          FROM event_question_answers
          ${questionId ? `WHERE "questionId" = '${questionId}'` : ""}
        ) AS sub
        `);
                const total = countResult[0]?.count ?? 0;
                reply.code(200).send({
                    data,
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
    // UPDATE Answer
    fastify.withTypeProvider().route({
        method: "PUT",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventQuestionAnswer"],
            summary: "Update an Event Question Answer",
            params: v4_1.default.object({
                id: v4_1.default.uuid(),
            }),
            body: v4_1.default.object({
                text: v4_1.default.string(),
            }),
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    text: v4_1.default.string(),
                    questionId: v4_1.default.string(),
                }),
                404: v4_1.default.object({ message: v4_1.default.string() }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
            },
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { text } = req.body;
            try {
                const existing = await prisma.eventQuestionAnswer.findUnique({
                    where: { id },
                });
                if (!existing) {
                    return reply.status(404).send({ message: "Answer not found" });
                }
                const updated = await prisma.eventQuestionAnswer.update({
                    where: { id },
                    data: { text },
                });
                reply.code(200).send(updated);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
    // DELETE Answer
    fastify.withTypeProvider().route({
        method: "DELETE",
        url: "/:id",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["EventQuestionAnswer"],
            summary: "Delete an Event Question Answer",
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
                const existing = await prisma.eventQuestionAnswer.findUnique({
                    where: { id },
                });
                if (!existing) {
                    return reply.status(404).send({ message: "Answer not found" });
                }
                await prisma.eventQuestionAnswer.delete({
                    where: { id },
                });
                reply.code(204).send(null);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" });
            }
        },
    });
}
