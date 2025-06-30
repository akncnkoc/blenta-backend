"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
exports.default = (0, fastify_plugin_1.default)(async function (fastify) {
    fastify.setErrorHandler(function (error, request, reply) {
        request.log.error(error);
        const status = error.statusCode || 500;
        reply.status(status).send({
            error: {
                message: error.message,
                statusCode: status,
            },
        });
    });
});
