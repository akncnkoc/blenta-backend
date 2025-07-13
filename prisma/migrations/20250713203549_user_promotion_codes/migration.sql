-- CreateTable
CREATE TABLE "PromotionCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "extraTime" TEXT NOT NULL,

    CONSTRAINT "PromotionCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPromotionCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promotionCodeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPromotionCode_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserPromotionCode" ADD CONSTRAINT "UserPromotionCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPromotionCode" ADD CONSTRAINT "UserPromotionCode_promotionCodeId_fkey" FOREIGN KEY ("promotionCodeId") REFERENCES "PromotionCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
