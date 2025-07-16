"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = appVersionRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function appVersionRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/",
        method: "GET",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["AppVersion"],
            querystring: v4_1.default.object({
                page: v4_1.default.string().min(1),
                size: v4_1.default.string().min(1).max(100),
                search: v4_1.default.string().optional().nullable(), // 🔍 add search param
            }),
            summary: "Get All App Version With Pagination",
            response: {
                200: v4_1.default.object({
                    data: v4_1.default.array(v4_1.default.object({
                        id: v4_1.default.string(),
                        version: v4_1.default.string(),
                        created_at: v4_1.default.date(),
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
                                version: {
                                    contains: search,
                                    mode: client_1.Prisma.QueryMode.insensitive,
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
            tags: ["AppVersion"],
            summary: "Create A App Version",
            body: v4_1.default.object({
                version: v4_1.default.string(),
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
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/getLatestVersion",
        method: "GET",
        schema: {
            tags: ["AppVersion"],
            summary: "Get Latest  App Version",
            response: {
                200: v4_1.default.object({
                    id: v4_1.default.string(),
                    version: v4_1.default.string(),
                    created_at: v4_1.default.date(),
                }),
                500: v4_1.default.object({ message: v4_1.default.string() }),
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
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error" + error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "DELETE",
        preHandler: [fastify.authenticateAdmin],
        schema: {
            tags: ["AppVersion"],
            summary: "Delete a App Version",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
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
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
}
