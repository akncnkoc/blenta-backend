import { FastifyInstance } from "fastify";
import {
  createQuestion,
  deleteQuestion,
  getCategoryQuestions,
  getQuestion,
  updateQuestion,
} from "./question.controller";
import {
  createQuestionSchema,
  deleteQuestionSchema,
  getCategoryQuestionsSchema,
  getQuestionSchema,
  updateQuestionSchema,
} from "./question.schema";

export default async function questionRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/category/:categoryId",
    { schema: getCategoryQuestionsSchema },
    getCategoryQuestions,
  );
  fastify.get(
    "/:id",

    { schema: getQuestionSchema },
    getQuestion,
  );
  fastify.post("", { schema: createQuestionSchema }, createQuestion);
  fastify.put("/:id", { schema: updateQuestionSchema }, updateQuestion);
  fastify.delete("/:id", { schema: deleteQuestionSchema }, deleteQuestion);
}
