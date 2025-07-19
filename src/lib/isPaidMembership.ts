import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export async function isPaidMembership(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { membershipExpiresAt: true },
  });

  if (!user) return false;

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
