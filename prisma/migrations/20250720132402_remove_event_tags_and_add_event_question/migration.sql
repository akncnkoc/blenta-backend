/*
  Warnings:

  - You are about to drop the `event_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `event_to_event_tags` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "event_to_event_tags" DROP CONSTRAINT "event_to_event_tags_event_id_fkey";

-- DropForeignKey
ALTER TABLE "event_to_event_tags" DROP CONSTRAINT "event_to_event_tags_event_tag_id_fkey";

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "description" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- DropTable
DROP TABLE "event_tags";

-- DropTable
DROP TABLE "event_to_event_tags";

-- CreateTable
CREATE TABLE "event_questions" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_matches" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventQuestionId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,

    CONSTRAINT "event_matches_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "event_matches" ADD CONSTRAINT "event_matches_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_matches" ADD CONSTRAINT "event_matches_eventQuestionId_fkey" FOREIGN KEY ("eventQuestionId") REFERENCES "event_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
