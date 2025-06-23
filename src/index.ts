import Fastify from "fastify";
import errorHandler from "./plugins/error-handler";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import userRoutes from "./routes/user/user.routes";
import { config } from "./config";
import jwtPlugin from "./plugins/jwt";
import questionRoutes from "./routes/question/question.routes";
import categoryRoutes from "./routes/category/category.routes";
import { CategorySchema } from "./routes/category/category.schema";
import { QuestionSchema } from "./routes/question/question.schema";

const fastify = Fastify({ logger: true });

const start = async () => {
  try {
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: "Blenta API",
          description: "API documentation",
          version: "0.0.1",
        },
      },
      hideUntagged: true,
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "none",
      },
    });
    fastify.addSchema({
      $id: "Category",
      ...CategorySchema,
    });
    fastify.addSchema({
      $id: "Question",
      ...QuestionSchema,
    });

    fastify.register(jwtPlugin);
    fastify.register(errorHandler);
    fastify.register(userRoutes, { prefix: "/user" });
    fastify.register(categoryRoutes, { prefix: "/category" });
    fastify.register(questionRoutes, { prefix: "/question" });

    // fastify.get(
    //   "/private",
    //   { preHandler: [fastify.authenticate] },
    //   async () => {
    //     return { secret: "you found it!" };
    //   },
    // );

    await fastify.listen({ port: Number(config.port) });
    console.log(`🚀 Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
