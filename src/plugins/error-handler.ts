import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export default fp(async function (fastify: FastifyInstance) {
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
