import "@fastify/jwt";
import type { JWT } from "@fastify/jwt"; // ✅ fix here

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: string;
      name: string | null;
      surname: string | null;
      email: string;
      role: string;
    };
    user: {
      id: string;
      name: string;
      surname: string;
      email: string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    jwt: JWT;
  }
}
