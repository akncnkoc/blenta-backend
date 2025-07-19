"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPaidMembership = isPaidMembership;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function isPaidMembership(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { membershipExpiresAt: true },
    });
    if (!user)
        return false;
    const now = new Date();
    if (user.membershipExpiresAt && user.membershipExpiresAt > now) {
        return true;
    }
    const activePromotionCode = await prisma.userPromotionCode.findFirst({
        where: {
            userId,
            expiresAt: { gt: now },
        },
    });
    return !!activePromotionCode;
}
