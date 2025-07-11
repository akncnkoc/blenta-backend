/*
  Warnings:

  - You are about to drop the column `paidMembershipKey` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "paidMembershipKey",
ADD COLUMN     "memberStore" TEXT,
ADD COLUMN     "memberVendorProductId" TEXT,
ADD COLUMN     "membershipExpiresAt" TIMESTAMP(3),
ADD COLUMN     "membershipRenewedAt" TIMESTAMP(3),
ADD COLUMN     "paidMembershipId" TEXT;
