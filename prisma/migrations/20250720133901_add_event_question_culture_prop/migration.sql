/*
  Warnings:

  - Added the required column `culture` to the `event_questions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "event_questions" ADD COLUMN     "culture" TEXT NOT NULL;
