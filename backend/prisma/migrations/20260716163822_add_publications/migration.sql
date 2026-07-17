/*
  Warnings:

  - You are about to drop the column `evaluationId` on the `Attempt` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Evaluation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[publicationId,studentId]` on the table `Attempt` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `publicationId` to the `Attempt` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'FINISHED');

-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_evaluationId_fkey";

-- DropIndex
DROP INDEX "Attempt_evaluationId_studentId_key";

-- DropIndex
DROP INDEX "Evaluation_code_key";

-- AlterTable
ALTER TABLE "Attempt" DROP COLUMN "evaluationId",
ADD COLUMN     "publicationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "code";

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "code" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "availableAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "evaluationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Publication_code_key" ON "Publication"("code");

-- CreateIndex
CREATE INDEX "Publication_evaluationId_idx" ON "Publication"("evaluationId");

-- CreateIndex
CREATE INDEX "Publication_status_idx" ON "Publication"("status");

-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Attempt_publicationId_idx" ON "Attempt"("publicationId");

-- CreateIndex
CREATE INDEX "Attempt_studentId_idx" ON "Attempt"("studentId");

-- CreateIndex
CREATE INDEX "Attempt_status_idx" ON "Attempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_publicationId_studentId_key" ON "Attempt"("publicationId", "studentId");

-- CreateIndex
CREATE INDEX "Choice_questionId_idx" ON "Choice"("questionId");

-- CreateIndex
CREATE INDEX "Criterion_evaluationId_idx" ON "Criterion"("evaluationId");

-- CreateIndex
CREATE INDEX "Evaluation_userId_idx" ON "Evaluation"("userId");

-- CreateIndex
CREATE INDEX "Evaluation_status_idx" ON "Evaluation"("status");

-- CreateIndex
CREATE INDEX "Question_evaluationId_idx" ON "Question"("evaluationId");

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
