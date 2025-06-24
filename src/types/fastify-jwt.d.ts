import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: { id: string; name: string; surname: string; email: string }; // request.user nesnesi
  }
}
declare module "fastify" {
  interface FastifyRequest {
    jwt: JWT;
  }
}
