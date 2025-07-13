import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { Prisma, PrismaClient, UserReferencedCategory } from "@prisma/client";
const prisma = new PrismaClient();

export default async function promotionCodeRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "GET",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["PromotionCode"],
      querystring: z.object({
        page: z.string().min(1),
        size: z.string().min(1).max(100),
        search: z.string().optional().nullable(), // 🔍 add search param
      }),
      summary: "Get All Promotion Codes",
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              code: z.string(),
              extraTime: z.string(),
            }),
          ),
          meta: z.object({
            total: z.number(),
            page: z.string(),
            size: z.string(),
            pageCount: z.number(),
          }),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (req, reply) => {
      const { page, size, search } = req.query;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const whereClause = {
            ...(search
              ? {
                  code: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                }
              : {}),
          };

          const [total, promotionCodes] = await Promise.all([
            tx.promotionCode.count({
              where: {
                ...whereClause,
              },
            }),
            tx.promotionCode.findMany({
              where: {
                ...whereClause,
              },
              skip: (Number(page) - 1) * Number(size),
              take: Number(size),
              orderBy: { code: "asc" },
            }),
          ]);

          return {
            data: promotionCodes,
            meta: {
              total,
              page,
              size,
              pageCount: Math.ceil(total / Number(size)),
            },
          };
        });

        reply.code(200).send(result);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error: " + error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["PromotionCode"],
      summary: "Create A Promotion Code",
      body: z.object({
        code: z.string(),
        extraTime: z.string(),
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
                mode: Prisma.QueryMode.insensitive,
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
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "PUT",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["PromotionCode"],
      summary: "Update A Promotion Code",
      params: z.object({
        id: z.string().nonempty(),
      }),
      body: z.object({
        code: z.string(),
        extraTime: z.string(),
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
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "DELETE",
    preHandler: [fastify.authenticate],
    schema: {
      tags: ["PromotionCode"],
      summary: "Delete a Promotion Code",
      params: z.object({
        id: z.string().nonempty(),
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
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
}
