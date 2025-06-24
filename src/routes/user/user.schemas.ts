import { buildJsonSchemas } from "fastify-zod";
import z, { string } from "zod";
const registerUserSchema = z.object({
  email: string(),
  password: string().min(6),
  name: string(),
  surname: string(),
});
const loginWithUserEmailSchema = z.object({
  email: string().email(),
});
export type CreateUserInput = z.infer<typeof registerUserSchema>;
export const { schemas: userSchemas, $ref } = buildJsonSchemas({
  registerUserSchema,
  loginWithUserEmailSchema,
});
