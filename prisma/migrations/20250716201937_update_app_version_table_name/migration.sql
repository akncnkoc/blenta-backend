/*
  Warnings:

  - You are about to drop the `AppVersion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "AppVersion";

-- CreateTable
CREATE TABLE "app_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);
