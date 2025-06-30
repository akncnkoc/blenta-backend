"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.likeCategory = exports.categoryQuestionCompleted = exports.updateCategory = exports.createCategory = exports.getCategory = exports.getAllCategories = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getAllCategories = async (_, reply) => {
    try {
        const result = await prisma.$transaction(async (tx) => {
            const categories = await tx.category.findMany();
            return { categories };
        });
        reply.code(200).send(result.categories);
    }
    catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
    }
};
exports.getAllCategories = getAllCategories;
const getCategory = async (req, reply) => {
    const { id } = req.params;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const category = await tx.category.findUnique({
                where: { id },
                include: { questions: true, userCompletedCategories: true },
            });
            if (!category) {
                return { code: 404, error: { message: "Category not found" } };
            }
            return { category };
        });
        if (result.error) {
            reply.code(result.code).send(result.error);
            return;
        }
        reply.code(200).send(result.category);
    }
    catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
    }
};
exports.getCategory = getCategory;
const createCategory = async (req, reply) => {
    const { name, parentCategoryId, culture, type, color, description } = req.body;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const createdCategory = await tx.category.create({
                data: {
                    name,
                    parentCategoryId,
                    culture,
                    color,
                    description,
                },
            });
            return { category: createdCategory };
        });
        reply.code(201).send(result.category);
    }
    catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, reply) => {
    const { id } = req.params;
    const { name, parentCategoryId, culture, type, color, description } = req.body;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const category = await tx.category.findUnique({ where: { id } });
            if (!category) {
                return { code: 404, error: { message: "Category not found" } };
            }
            const updatedCategory = await tx.category.update({
                where: { id },
                data: {
                    name,
                    parentCategoryId,
                    culture,
                    color,
                    description,
                },
            });
            return { category: updatedCategory };
        });
        if (result.error) {
            reply.code(result.code).send(result.error);
            return;
        }
        reply.code(200).send(result.category);
    }
    catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
    }
};
exports.updateCategory = updateCategory;
const categoryQuestionCompleted = async (req, reply) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const category = await tx.category.findUnique({ where: { id } });
            if (!category) {
                return { code: 404, error: { message: "Category not found" } };
            }
            const userCompletedCategory = await tx.userCompletedCategory.create({
                data: {
                    userId,
                    categoryId: id,
                },
            });
            return { completedCategory: userCompletedCategory };
        });
        if (result.error) {
            reply.code(result.code).send(result.error);
            return;
        }
        reply.code(200).send(result.completedCategory);
    }
    catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
    }
};
exports.categoryQuestionCompleted = categoryQuestionCompleted;
const likeCategory = async (req, reply) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await prisma.$transaction(async (tx) => {
            var category = await tx.category.findFirst({ where: { id: id } });
            if (!category) {
                return { code: 404, error: { message: "Category not found" } };
            }
            const createLikedCategory = await tx.userLikedQuestion.create({
                data: {
                    userId,
                    questionId: id,
                },
            });
            return { likedCategory: createLikedCategory };
        });
        reply.code(201).send(result.likedCategory);
    }
    catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
    }
};
exports.likeCategory = likeCategory;
const deleteCategory = async (req, reply) => {
    const { id } = req.params;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const category = await tx.category.findUnique({ where: { id } });
            if (!category) {
                return { code: 404, error: { message: "Category not found" } };
            }
            const deletedCategory = await tx.category.delete({
                where: { id },
            });
            return { category: deletedCategory };
        });
        if (result.error) {
            reply.code(result.code).send(result.error);
            return;
        }
        reply.code(200).send(result.category);
    }
    catch (error) {
        reply.code(500).send({ message: "Internal Server Error", error });
    }
};
exports.deleteCategory = deleteCategory;
