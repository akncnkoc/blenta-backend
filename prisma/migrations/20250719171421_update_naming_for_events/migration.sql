/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventToEventTag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EventToEventTag" DROP CONSTRAINT "EventToEventTag_event_id_fkey";

-- DropForeignKey
ALTER TABLE "EventToEventTag" DROP CONSTRAINT "EventToEventTag_event_tag_id_fkey";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "EventTag";

-- DropTable
DROP TABLE "EventToEventTag";

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "event_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_to_event_tags" (
    "id" TEXT NOT NULL,
    "event_tag_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,

    CONSTRAINT "event_to_event_tags_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "event_to_event_tags" ADD CONSTRAINT "event_to_event_tags_event_tag_id_fkey" FOREIGN KEY ("event_tag_id") REFERENCES "event_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_to_event_tags" ADD CONSTRAINT "event_to_event_tags_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
