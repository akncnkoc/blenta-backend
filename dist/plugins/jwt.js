"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const config_1 = require("../config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.default = (0, fastify_plugin_1.default)(async function (fastify) {
    fastify.register(jwt_1.default, {
        secret: config_1.config.jwtSecret,
    });
    fastify.decorate("authenticate", async function (request, reply) {
        try {
            await request.jwtVerify();
            const userId = request.user?.id;
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { isUserDeactivated: true },
            });
            const admin = await prisma.admin.findUnique({
                where: { id: userId },
                select: { isUserDeactivated: true },
            });
            if (!user && !admin) {
                return reply.status(401).send({
                    message: "Only users can access this route",
                });
            }
            if (user) {
                if (user.isUserDeactivated) {
                    return reply.status(403).send({
                        message: "User account is deactivated",
                    });
                }
            }
        }
        catch (err) {
            reply.send(err);
        }
    });
    fastify.decorate("authenticateAdmin", async function (request, reply) {
        try {
            await request.jwtVerify();
            const userId = request.user?.id;
            const admin = await prisma.admin.findUnique({
                where: { id: userId },
                select: { isUserDeactivated: true },
            });
            console.log("User ID:", userId);
            console.log("Admin found:", admin);
            if (!admin) {
                return reply.status(401).send({
                    message: "Only admin users can access this route",
                });
            }
            if (admin.isUserDeactivated) {
                return reply.status(403).send({
                    message: "Admin account is deactivated",
                });
            }
        }
        catch (err) {
            console.error("JWT verification failed or other error:", err);
            return reply.status(401).send({ message: "Unauthorized" });
        }
    });
});
