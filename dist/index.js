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
const fastify = (0, fastify_1.default)({ logger: true }).withTypeProvider();
const start = async () => {
    try {
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
        // fastify.addSchema({
        //   $id: "Category",
        //   ...CategorySchema,
        // });
        // fastify.addSchema({
        //   $id: "Question",
        //   ...QuestionSchema,
        // });
        //
        // for (let schema of [...userSchemas]) {
        //   fastify.addSchema(schema);
        // }
        fastify.register(jwt_1.default);
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
        fastify.register(user_routes_1.default, { prefix: "/user" });
        fastify.register(category_routes_1.default, { prefix: "/category" });
        fastify.register(question_routes_1.default, { prefix: "/question" });
        fastify.get("/healthcheck", (req, res) => {
            res.send({ message: "Success" });
        });
        var appId = "b8432b15-baab-4b65-8943-139bcd7a31e4";
        const configuration = OneSignal.createConfiguration({
            organizationApiKey: "",
            restApiKey: "os_v2_app_xbbswfn2vnfwlckdcon426rr4rbxgeikxqme5buyydorgcpwil7gbqp52bsb3m22muoztiyvjijlt35hf6sm6iwphx5ymgxtcnwebpy",
        });
        const client = new OneSignal.DefaultApi(configuration);
        // client.createNotification({
        //   app_id: appId,
        //   name: "Test Notification",
        //   contents: {
        //     en: "Test Notification Content",
        //     tr: "Test Bildirim Icerigi",
        //   },
        //   headings: {
        //     en: "Test Notification",
        //     tr: "Test Bildirim",
        //   },
        // });
        await fastify.listen({ port: Number(config_1.config.port) });
        console.log(`🚀 Server running at http://localhost:${config_1.config.port}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
