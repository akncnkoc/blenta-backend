import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function eventQuestionAnswerRoutes(
  fastify: FastifyInstance,
) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventQuestionAnswer"],
      summary:
        "List Event Question Answers, optionally filtered by questionId, with pagination",
      querystring: z.object({
        questionId: z.uuid().optional(),
        page: z.string().optional(),
        size: z.string().optional(),
      }),
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              text: z.string(),
              questionId: z.string(),
            }),
          ),
          meta: z.object({
            total: z.number(),
            page: z.number(),
            size: z.number(),
          }),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { questionId, page = "1", size = "10" } = req.query;
      const pageNum = Math.max(1, parseInt(page));
      const sizeNum = Math.max(1, parseInt(size));

      try {
        const offset = (pageNum - 1) * sizeNum;

        const data = await prisma.$queryRawUnsafe<
          { id: string; text: string; questionId: string }[]
        >(
          `
        SELECT DISTINCT ON ("text") id, text, "questionId"
        FROM event_question_answers
        ${questionId ? `WHERE "questionId" = '${questionId}'` : ""}
        ORDER BY "text" ASC
        LIMIT ${sizeNum} OFFSET ${offset}
        `,
        );

        const countResult = await prisma.$queryRawUnsafe<{ count: number }[]>(
          `
        SELECT COUNT(*)::int AS count FROM (
          SELECT DISTINCT "text"
          FROM event_question_answers
          ${questionId ? `WHERE "questionId" = '${questionId}'` : ""}
        ) AS sub
        `,
        );

        const total = countResult[0]?.count ?? 0;

        reply.code(200).send({
          data,
          meta: {
            total,
            page: pageNum,
            size: sizeNum,
          },
        });
      } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
  // UPDATE Answer
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventQuestionAnswer"],
      summary: "Update an Event Question Answer",
      params: z.object({
        id: z.uuid(),
      }),
      body: z.object({
        text: z.string(),
      }),
      response: {
        200: z.object({
          id: z.string(),
          text: z.string(),
          questionId: z.string(),
        }),
        404: z.object({ message: z.string() }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { id } = req.params as { id: string };
      const { text } = req.body as { text: string };

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
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });

  // DELETE Answer
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "DELETE",
    url: "/:id",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["EventQuestionAnswer"],
      summary: "Delete an Event Question Answer",
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
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" });
      }
    },
  });
}
