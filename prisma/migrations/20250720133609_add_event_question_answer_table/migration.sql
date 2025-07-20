/*
  Warnings:

  - You are about to drop the column `eventQuestionId` on the `event_matches` table. All the data in the column will be lost.
  - Added the required column `answerId` to the `event_matches` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "event_matches" DROP CONSTRAINT "event_matches_eventQuestionId_fkey";

-- AlterTable
ALTER TABLE "event_matches" DROP COLUMN "eventQuestionId",
ADD COLUMN     "answerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "event_question_answers" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "event_question_answers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "event_question_answers" ADD CONSTRAINT "event_question_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "event_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_matches" ADD CONSTRAINT "event_matches_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "event_question_answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
