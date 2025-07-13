/*
  Warnings:

  - You are about to drop the `PromotionCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserPromotionCode` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserPromotionCode" DROP CONSTRAINT "UserPromotionCode_promotionCodeId_fkey";

-- DropForeignKey
ALTER TABLE "UserPromotionCode" DROP CONSTRAINT "UserPromotionCode_userId_fkey";

-- DropTable
DROP TABLE "PromotionCode";

-- DropTable
DROP TABLE "UserPromotionCode";

-- CreateTable
CREATE TABLE "promotion_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "extraTime" TEXT NOT NULL,

    CONSTRAINT "promotion_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_promotion_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promotionCodeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_promotion_codes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_promotion_codes" ADD CONSTRAINT "user_promotion_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_promotion_codes" ADD CONSTRAINT "user_promotion_codes_promotionCodeId_fkey" FOREIGN KEY ("promotionCodeId") REFERENCES "promotion_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
