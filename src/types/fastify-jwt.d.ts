import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string }; // JWT içine ne koyuyorsan
    user: { userId: string }; // request.user nesnesi
  }
}
declare module "fastify" {
  interface FastifyRequest {
    jwt: JWT;
  }
}
