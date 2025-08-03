/*
  Warnings:

  - You are about to drop the column `isPremiumQue` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `isRefQue` on the `questions` table. All the data in the column will be lost.
  - Made the column `referenceCode` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."CategoryType" AS ENUM ('TEST', 'QUESTION');

-- AlterTable
ALTER TABLE "public"."categories" ADD COLUMN     "type" "public"."CategoryType" NOT NULL DEFAULT 'QUESTION';

-- AlterTable
ALTER TABLE "public"."questions" DROP COLUMN "isPremiumQue",
DROP COLUMN "isRefQue";

-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "referenceCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."category_tags" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "category_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_referenced_categories" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,

    CONSTRAINT "user_referenced_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isUserDeactivated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "public"."admins"("email");

-- AddForeignKey
ALTER TABLE "public"."category_tags" ADD CONSTRAINT "category_tags_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."category_tags" ADD CONSTRAINT "category_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_referenced_categories" ADD CONSTRAINT "user_referenced_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_referenced_categories" ADD CONSTRAINT "user_referenced_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
