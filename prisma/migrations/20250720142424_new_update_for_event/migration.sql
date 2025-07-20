/*
  Warnings:

  - You are about to drop the column `eventId` on the `event_questions` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "event_questions" DROP CONSTRAINT "event_questions_eventId_fkey";

-- AlterTable
ALTER TABLE "event_questions" DROP COLUMN "eventId";
