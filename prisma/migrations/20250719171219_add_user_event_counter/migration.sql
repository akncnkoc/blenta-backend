-- AlterTable
ALTER TABLE "users" ADD COLUMN     "eventSearchCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eventSearchLastDate" TIMESTAMP(3);
