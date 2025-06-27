import { FastifyInstance } from "fastify";
import {
  createQuestion,
  deleteQuestion,
  getCategoryQuestions,
  getQuestion,
  likeQuestion,
  questionViewed,
  unlikeQuestion,
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
  // fastify.get(
  //   "/category/:categoryId",
  //   {
  //     schema: getCategoryQuestionsSchema,
  //     preHandler: [fastify.authenticate],
  //   },
  //   getCategoryQuestions,
  // );
  // fastify.get(
  //   "/:id",
  //
  //   { schema: getQuestionSchema, preHandler: [fastify.authenticate] },
  //   getQuestion,
  // );
  // fastify.post("", { schema: createQuestionSchema }, createQuestion);
  // fastify.put("/:id", { schema: updateQuestionSchema }, updateQuestion);
  // fastify.put("/:id/questionReaded", questionViewed);
  // fastify.put("/:id/like-question", likeQuestion);
  // fastify.put("/:id/unlike-question", unlikeQuestion);
  // fastify.delete("/:id", { schema: deleteQuestionSchema }, deleteQuestion);
}
