-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_categoryId_fkey";

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
