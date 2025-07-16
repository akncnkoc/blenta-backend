import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";
import { Prisma, PrismaClient, UserReferencedCategory } from "@prisma/client";
const prisma = new PrismaClient();

export default async function appVersionRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/",
    method: "GET",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["AppVersion"],
      querystring: z.object({
        page: z.string().min(1),
        size: z.string().min(1).max(100),
        search: z.string().optional().nullable(), // 🔍 add search param
      }),
      summary: "Get All App Version With Pagination",
      response: {
        200: z.object({
          data: z.array(
            z.object({
              id: z.string(),
              version: z.string(),
              created_at: z.date(),
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
                  version: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                }
              : {}),
          };

          const [total, appVersions] = await Promise.all([
            tx.appVersion.count({
              where: {
                ...whereClause,
              },
            }),
            tx.appVersion.findMany({
              where: {
                ...whereClause,
              },
              skip: (Number(page) - 1) * Number(size),
              take: Number(size),
              orderBy: { created_at: "desc" },
            }),
          ]);

          return {
            data: appVersions,
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
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["AppVersion"],
      summary: "Create A App Version",
      body: z.object({
        version: z.string(),
      }),
    },
    handler: async (req, reply) => {
      const { version } = req.body;

      try {
        const result = await prisma.$transaction(async (tx) => {
          var appVersion = await tx.appVersion.findFirst({
            where: {
              version,
            },
          });
          if (appVersion) {
            return {
              code: 409,
              error: { message: "App version already exists" },
            };
          }

          const createdAppVersion = await tx.appVersion.create({
            data: {
              version,
            },
          });

          return { appVersion: createdAppVersion };
        });

        reply.code(201).send(result.appVersion);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });

  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/getLatestVersion",
    method: "GET",
    schema: {
      tags: ["AppVersion"],
      summary: "Get Latest  App Version",
      response: {
        200: z.object({
          id: z.string(),
          version: z.string(),
          created_at: z.date(),
        }),
        500: z.object({ message: z.string() }),
      },
    },
    handler: async (_, reply) => {
      try {
        const result = await prisma.$transaction(async (tx) => {
          var appVersion = await tx.appVersion.findFirst({
            orderBy: { created_at: "desc" },
          });

          if (!appVersion) {
            return { code: 404, error: { message: "App Version not found" } };
          }

          return {
            appVersion: {
              id: appVersion.id,
              version: appVersion.version,
              created_at: appVersion.created_at,
            },
          };
        });

        reply.code(200).send(result.appVersion);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error" + error });
      }
    },
  });
  fastify.withTypeProvider<ZodTypeProvider>().route({
    url: "/:id",
    method: "DELETE",
    preHandler: [fastify.authenticateAdmin],
    schema: {
      tags: ["AppVersion"],
      summary: "Delete a App Version",
      params: z.object({
        id: z.string().nonempty(),
      }),
    },
    handler: async (req, reply) => {
      const { id } = req.params;
      try {
        const result = await prisma.$transaction(async (tx) => {
          var appVersion = await tx.appVersion.findFirst({ where: { id: id } });
          if (!appVersion) {
            return { code: 404, error: { message: "App Version not found" } };
          }
          const deletedAppVersion = await tx.appVersion.delete({
            where: { id },
          });

          return { appVersion: deletedAppVersion };
        });

        reply.code(200).send(result.appVersion);
      } catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
      }
    },
  });
}
