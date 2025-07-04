"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = questionRoutes;
const v4_1 = __importDefault(require("zod/v4"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function questionRoutes(fastify) {
    fastify.withTypeProvider().route({
        url: "/category/:categoryId",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Question"],
            summary: "Get Category Questions",
            params: v4_1.default.object({
                categoryId: v4_1.default.string().nonempty(),
            }),
            querystring: v4_1.default.object({
                page: v4_1.default.string().optional(),
                limit: v4_1.default.string().optional(),
            }),
        },
        handler: async (req, reply) => {
            var userId = req.user.id;
            const { categoryId } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const user = await tx.user.findFirst({
                        where: { id: userId },
                    });
                    if (!user)
                        return { code: 404, error: { message: "User not found" } };
                    const category = await tx.category.findFirst({
                        where: { id: categoryId },
                    });
                    if (!category)
                        return { code: 404, error: { message: "Category not found" } };
                    const [questions, total, userLikedQuestions] = await Promise.all([
                        tx.question.findMany({
                            where: { categoryId },
                            skip,
                            take: Number(limit),
                            orderBy: { sort: "asc" },
                        }),
                        tx.question.count({
                            where: { categoryId },
                        }),
                        tx.userLikedQuestion.findMany({
                            where: { userId: userId },
                        }),
                    ]);
                    const tempQuestions = questions.map((ques) => ({
                        ...ques,
                        isQuestionLiked: userLikedQuestions.some((liked) => liked.questionId === ques.id),
                    }));
                    return {
                        questions: tempQuestions,
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / Number(limit)),
                    };
                });
                reply.code(200).send(result);
            }
            catch (error) {
                console.error("getCategoryQuestions error:", error);
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "GET",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Question"],
            summary: "Get Question",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var question = await tx.question.findFirst({ where: { id: id } });
                    if (!question) {
                        return { code: 404, error: { message: "Question not found" } };
                    }
                    var nextQuestion = await tx.question.findFirst({
                        where: { sort: question.sort + 1 },
                    });
                    var questionCreated = {
                        ...question,
                        nextQuestionId: nextQuestion?.id,
                    };
                    var isQuestionLiked = await tx.userLikedQuestion.findFirst({
                        where: { questionId: id, userId: userId },
                    });
                    return {
                        question: {
                            ...questionCreated,
                            questionLiked: isQuestionLiked ? true : false,
                        },
                    };
                });
                reply.code(201).send(result.question);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        method: "POST",
        url: "/",
        schema: {
            tags: ["Question"],
            summary: "Create A Question",
            body: v4_1.default.object({
                title: v4_1.default.string().nonempty(),
                description: v4_1.default.string().nonempty(),
                categoryId: v4_1.default.string().nonempty(),
                culture: v4_1.default.string().nonempty(),
                sort: v4_1.default.number(),
            }),
        },
        handler: async (req, reply) => {
            const { title, description, categoryId, sort, culture } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var category = await tx.category.findFirst({
                        where: { id: categoryId },
                    });
                    if (!category) {
                        return { code: 404, error: { message: "Category not found" } };
                    }
                    const createdQuestion = await tx.question.create({
                        data: {
                            title,
                            description,
                            culture,
                            categoryId,
                            sort,
                        },
                    });
                    return { question: createdQuestion };
                });
                reply.code(201).send(result.question);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Question"],
            summary: "Update A Question",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
            body: v4_1.default.object({
                title: v4_1.default.string().nonempty(),
                description: v4_1.default.string().nonempty(),
                categoryId: v4_1.default.string().nonempty(),
                culture: v4_1.default.string().nonempty(),
                sort: v4_1.default.number(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            const { title, description, categoryId, sort, culture } = req.body;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var question = await tx.question.findFirst({ where: { id: id } });
                    if (!question) {
                        return { code: 404, error: { message: "Question not found" } };
                    }
                    var category = await tx.category.findFirst({
                        where: { id: categoryId },
                    });
                    if (!category) {
                        return { code: 404, error: { message: "Category not found" } };
                    }
                    const updatedQuestion = await tx.question.update({
                        where: { id },
                        data: {
                            title,
                            description,
                            culture,
                            categoryId,
                            sort,
                        },
                    });
                    return { question: updatedQuestion };
                });
                reply.code(201).send(result.question);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id/questionReaded",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Question"],
            summary: "User read a question",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var question = await tx.question.findFirst({ where: { id: id } });
                    if (!question) {
                        return { code: 404, error: { message: "Question not found" } };
                    }
                    const createViewedQuestion = await tx.userViewedQuestion.create({
                        data: {
                            userId,
                            questionId: id,
                        },
                    });
                    return { viewedQuestion: createViewedQuestion };
                });
                reply.code(201).send(result.viewedQuestion);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id/like-question",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Question"],
            summary: "Like a question",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var question = await tx.question.findFirst({ where: { id: id } });
                    if (!question) {
                        return { code: 404, error: { message: "Question not found" } };
                    }
                    var alreadyLiked = await tx.userLikedQuestion.findFirst({
                        where: { questionId: id, userId },
                    });
                    if (alreadyLiked) {
                        return { code: 409, error: { message: "Question already liked" } };
                    }
                    const createLikedQuestion = await tx.userLikedQuestion.create({
                        data: {
                            userId,
                            questionId: id,
                        },
                    });
                    return { likedQuestion: createLikedQuestion };
                });
                reply.code(result.code).send(result);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id/unlike-question",
        method: "PUT",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Question"],
            summary: "Unlike a question",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const userId = req.user.id;
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var question = await tx.question.findFirst({ where: { id: id } });
                    if (!question) {
                        return { code: 404, error: { message: "Question not found" } };
                    }
                    const unlikedQuestion = await tx.userLikedQuestion.deleteMany({
                        where: { questionId: id, userId: userId },
                    });
                    return { unlikedQuestion };
                });
                reply.code(result.code).send(result);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
    fastify.withTypeProvider().route({
        url: "/:id",
        method: "DELETE",
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Question"],
            summary: "Delete a question",
            params: v4_1.default.object({
                id: v4_1.default.string().nonempty(),
            }),
        },
        handler: async (req, reply) => {
            const { id } = req.params;
            try {
                const result = await prisma.$transaction(async (tx) => {
                    var question = await tx.question.findFirst({ where: { id: id } });
                    if (!question) {
                        return { code: 404, error: { message: "Question not found" } };
                    }
                    const deletedQuestion = await tx.question.delete({
                        where: { id },
                    });
                    return { question: deletedQuestion };
                });
                reply.code(201).send(result.question);
            }
            catch (error) {
                reply.code(500).send({ message: "Internal Server Error", error });
            }
        },
    });
}
