-- CreateTable
CREATE TABLE "user_liked_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "user_liked_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_liked_events" ADD CONSTRAINT "user_liked_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_liked_events" ADD CONSTRAINT "user_liked_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
