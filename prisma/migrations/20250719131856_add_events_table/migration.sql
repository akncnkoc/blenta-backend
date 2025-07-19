-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EventTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventToEventTag" (
    "id" TEXT NOT NULL,
    "event_tag_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,

    CONSTRAINT "EventToEventTag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EventToEventTag" ADD CONSTRAINT "EventToEventTag_event_tag_id_fkey" FOREIGN KEY ("event_tag_id") REFERENCES "EventTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventToEventTag" ADD CONSTRAINT "EventToEventTag_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
