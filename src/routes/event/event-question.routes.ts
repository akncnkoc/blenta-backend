import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function eventQuestionRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["EventQuestion"],
      summary: "Get all Event Questions with their Answers (with pagination)",
      querystring: z.object({
        page: z.string().optional(),
        size: z.string().optional(),
        lang: z.string().optional(), // NEW
        search: z.string().optional(), // NEW
      }),
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              text: z.string(),
              culture: z.string(),
              answers: z.array(
                z.object({
                  id: z.string(),
                  text: z.string(),
                }),
              ),
            }),
          ),
          meta: z.object({
            page: z.number(),
            size: z.number(),
            total: z.number(),
          }),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { page = "1", size = "10", lang, search } = req.query;
      const pageNum = Math.max(1, parseInt(page));
      const sizeNum = Math.max(1, parseInt(size));

      try {
        // WHERE koşulları oluştur
        const whereClauseParts: string[] = [];
        if (lang) whereClauseParts.push(`eq."culture" = '${lang}'`);
        if (search) whereClauseParts.push(`eq."text" ILIKE '%${search}%'`);
        const whereClause =
          whereClauseParts.length > 0
            ? `WHERE ${whereClauseParts.join(" AND ")}`
            : "";

        // Ana soru verilerini çek (random sıralı)
        const questions = await prisma.$queryRawUnsafe<
          { id: string; text: string; culture: string }[]
        >(
          `
      SELECT eq.id, eq.text, eq.culture
      FROM "event_questions" eq
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT ${sizeNum}
      OFFSET ${(pageNum - 1) * sizeNum}
      `,
        );

        // Cevapları ayrı çek
        const questionIds = questions.map((q) => `'${q.id}'`).join(",");
        const answers =
          questionIds.length > 0
            ? await prisma.$queryRawUnsafe<
                { id: string; text: string; eventQuestionId: string }[]
              >(
                `
            SELECT eqa.id, eqa.text, eqa."questionId"
            FROM "event_question_answers" eqa
            WHERE eqa."eventQuestionId" IN (${questionIds})
            ORDER BY eqa.text ASC
            `,
              )
            : [];

        // Cevapları sorulara bağla
        const questionMap = questions.map((q) => ({
          ...q,
          answers: answers
            .filter((a) => a.eventQuestionId === q.id)
            .map((a) => ({ id: a.id, text: a.text })),
        }));

        // Toplam sayıyı çek
        const totalCountResult = await prisma.$queryRawUnsafe<
          { count: number }[]
        >(
          `
      SELECT COUNT(*)::int AS count
      FROM "event_questions" eq
      ${whereClause}
      `,
        );
        const total = totalCountResult[0]?.count ?? 0;

        reply.code(200).send({
          data: questionMap,
          meta: {
            page: pageNum,
            size: sizeNum,
            total,
          },
        });
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  // GET single question by id with answers
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventQuestion"],
      summary: "Get Event Question by id with answers",
      params: z.object({
        id: z.uuid(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          text: z.string(),
          culture: z.string(),
          answers: z.array(
            z.object({
              id: z.string(),
              text: z.string(),
            }),
          ),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
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
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventQuestion"],
      summary: "Create Event Question",
      body: z.object({
        text: z.string(),
        culture: z.string(),
        answers: z.array(z.string()).default([]),
      }),
      response: {
        201: z.object({
          text: z.string(),
          culture: z.string(),
        }),
        409: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
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
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventQuestion"],
      summary: "Update an Event Question",
      params: z.object({
        id: z.uuid(),
      }),
      body: z.object({
        text: z.string(),
        culture: z.string(),
        answers: z.array(z.string()).optional(), // cevap metinleri opsiyonel
      }),
      response: {
        200: z.object({
          id: z.string(),
          text: z.string(),
          culture: z.string(),
          answers: z.array(
            z.object({
              id: z.string(),
              text: z.string(),
              questionId: z.string(),
            }),
          ),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
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
            const newAnswers = answers.filter(
              (a) => !existingAnswerTexts.includes(a),
            );

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
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  // DELETE EventQuestion
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventQuestion"],
      summary: "Delete an Event Question and its related data",
      params: z.object({
        id: z.uuid(),
      }),
      response: {
        204: z.null(),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };

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
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
}
