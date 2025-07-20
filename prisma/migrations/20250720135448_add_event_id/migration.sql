/*
  Warnings:

  - Added the required column `eventId` to the `event_questions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "event_questions" ADD COLUMN     "eventId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "event_questions" ADD CONSTRAINT "event_questions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
