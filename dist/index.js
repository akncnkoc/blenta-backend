"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="./types/fastify-jwt.d.ts" />
const fastify_1 = __importDefault(require("fastify"));
const error_handler_1 = __importDefault(require("./plugins/error-handler"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const user_routes_1 = __importDefault(require("./routes/user/user.routes"));
const config_1 = require("./config");
const jwt_1 = __importDefault(require("./plugins/jwt"));
const question_routes_1 = __importDefault(require("./routes/question/question.routes"));
const category_routes_1 = __importDefault(require("./routes/category/category.routes"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const OneSignal = __importStar(require("@onesignal/node-onesignal"));
const fastify_type_provider_zod_1 = require("fastify-type-provider-zod");
const cors_1 = __importDefault(require("@fastify/cors"));
const admin_routes_1 = __importDefault(require("./routes/admin/admin.routes"));
const tag_routes_1 = __importDefault(require("./routes/tag/tag.routes"));
const promotion_code_routes_1 = __importDefault(require("./routes/promotion-code/promotion-code.routes"));
const app_version_routes_1 = __importDefault(require("./routes/app-version/app-version.routes"));
const event_routes_1 = __importDefault(require("./routes/event/event.routes"));
const event_question_routes_1 = __importDefault(require("./routes/event/event-question.routes"));
const event_question_answers_routes_1 = __importDefault(require("./routes/event/event-question-answers.routes"));
const notification_1 = __importDefault(require("./routes/notification"));
const fastify = (0, fastify_1.default)({ logger: true }).withTypeProvider();
const start = async () => {
    try {
        fastify.register(cors_1.default, {
            origin: "*", // allow all origins
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], // allowed HTTP methods
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // headers you want to allow
        });
        await fastify.register(swagger_1.default, {
            openapi: {
                info: {
                    title: "Blenta API",
                    description: "API documentation",
                    version: "0.0.1",
                },
                components: {
                    securitySchemes: {
                        BearerAuth: {
                            type: "http",
                            scheme: "bearer",
                            bearerFormat: "JWT",
                        },
                    },
                },
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
            },
            transform: fastify_type_provider_zod_1.jsonSchemaTransform,
            hideUntagged: false,
        });
        fastify.setValidatorCompiler(fastify_type_provider_zod_1.validatorCompiler);
        fastify.setSerializerCompiler(fastify_type_provider_zod_1.serializerCompiler);
        await fastify.register(swagger_ui_1.default, {
            routePrefix: "/docs",
            uiConfig: {
                docExpansion: "none",
            },
        });
        await fastify.register(jwt_1.default);
        fastify.addHook("preHandler", (req, _, next) => {
            req.jwt = fastify.jwt;
            next();
        });
        // cookies
        fastify.register(cookie_1.default, {
            secret: "some-secret-key",
            hook: "preHandler",
        });
        fastify.register(error_handler_1.default);
        await fastify.register(user_routes_1.default, { prefix: "/user" });
        await fastify.register(category_routes_1.default, { prefix: "/category" });
        await fastify.register(tag_routes_1.default, { prefix: "/tag" });
        await fastify.register(promotion_code_routes_1.default, { prefix: "/promotion-code" });
        await fastify.register(app_version_routes_1.default, { prefix: "/app-version" });
        await fastify.register(question_routes_1.default, { prefix: "/question" });
        await fastify.register(event_routes_1.default, { prefix: "/event" });
        await fastify.register(event_question_routes_1.default, { prefix: "/event-question" });
        await fastify.register(notification_1.default, { prefix: "/notification" });
        await fastify.register(event_question_answers_routes_1.default, {
            prefix: "/event-question-answer",
        });
        await fastify.register(admin_routes_1.default, { prefix: "/admin" });
        fastify.get("/healthcheck", { preHandler: [fastify.authenticateAdmin] }, (req, res) => {
            res.send({ message: "Success" });
        });
        var appId = "b8432b15-baab-4b65-8943-139bcd7a31e4";
        const configuration = OneSignal.createConfiguration({
            restApiKey: "os_v2_app_xbbswfn2vnfwlckdcon426rr4rbxgeikxqme5buyydorgcpwil7gbqp52bsb3m22muoztiyvjijlt35hf6sm6iwphx5ymgxtcnwebpy",
        });
        await fastify.listen({ port: Number(config_1.config.port), host: "0.0.0.0" });
        console.log(`🚀 Server running at http://localhost:${config_1.config.port}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
