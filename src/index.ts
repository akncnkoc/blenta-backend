/// <reference path="./types/fastify-jwt.d.ts" />
import Fastify from "fastify";
import errorHandler from "./plugins/error-handler";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import userRoutes from "./routes/user/user.routes";
import { config } from "./config";
import jwtPlugin from "./plugins/jwt";
import questionRoutes from "./routes/question/question.routes";
import categoryRoutes from "./routes/category/category.routes";
import fCookie from "@fastify/cookie";
import * as OneSignal from "@onesignal/node-onesignal";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifyCors from "@fastify/cors";
import adminRoutes from "./routes/admin/admin.routes";
import tagRoutes from "./routes/tag/tag.routes";
import promotionCodeRoutes from "./routes/promotion-code/promotion-code.routes";
import appVersionRoutes from "./routes/app-version/app-version.routes";

const fastify = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
const start = async () => {
  try {
    fastify.register(fastifyCors, {
      origin: "*", // allow all origins
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], // allowed HTTP methods
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // headers you want to allow
    });
    await fastify.register(fastifySwagger, {
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
      transform: jsonSchemaTransform,

      hideUntagged: false,
    });
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    await fastify.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "none",
      },
    });

    fastify.register(jwtPlugin);
    (fastify as any).addHook("preHandler", (req, _, next) => {
      (req as any).jwt = fastify.jwt;
      next();
    });
    // cookies
    fastify.register(fCookie, {
      secret: "some-secret-key",
      hook: "preHandler",
    });
    fastify.register(errorHandler);
    fastify.register(userRoutes, { prefix: "/user" });
    fastify.register(categoryRoutes, { prefix: "/category" });
    fastify.register(tagRoutes, { prefix: "/tag" });
    fastify.register(promotionCodeRoutes, { prefix: "/promotion-code" });
    fastify.register(appVersionRoutes, { prefix: "/app-version" });
    fastify.register(questionRoutes, { prefix: "/question" });
    fastify.register(adminRoutes, { prefix: "/admin" });
    fastify.get("/healthcheck", (req, res) => {
      res.send({ message: "Success" });
    });
    var appId = "b8432b15-baab-4b65-8943-139bcd7a31e4";
    const configuration = OneSignal.createConfiguration({
      organizationApiKey: "",
      restApiKey:
        "os_v2_app_xbbswfn2vnfwlckdcon426rr4rbxgeikxqme5buyydorgcpwil7gbqp52bsb3m22muoztiyvjijlt35hf6sm6iwphx5ymgxtcnwebpy",
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

    await fastify.listen({ port: Number(config.port), host: "0.0.0.0" });
    console.log(`🚀 Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
