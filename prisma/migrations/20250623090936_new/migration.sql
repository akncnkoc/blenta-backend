-- CreateTable
CREATE TABLE "UserAnsweredQuestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,

    CONSTRAINT "UserAnsweredQuestions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserAnsweredQuestions" ADD CONSTRAINT "UserAnsweredQuestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
