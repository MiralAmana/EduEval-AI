/*
  Warnings:

  - You are about to drop the column `evaluationId` on the `Criterion` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Criterion` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `Criterion` table. All the data in the column will be lost.
  - Added the required column `label` to the `Criterion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionId` to the `Criterion` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Criterion" DROP CONSTRAINT "Criterion_evaluationId_fkey";

-- DropIndex
DROP INDEX "Criterion_evaluationId_idx";

-- AlterTable
ALTER TABLE "Criterion" DROP COLUMN "evaluationId",
DROP COLUMN "type",
DROP COLUMN "value",
ADD COLUMN     "label" TEXT NOT NULL,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "questionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CriterionScore" (
    "id" TEXT NOT NULL,
    "pointsAwarded" DOUBLE PRECISION NOT NULL,
    "criterionId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriterionScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CriterionScore_answerId_idx" ON "CriterionScore"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "CriterionScore_criterionId_answerId_key" ON "CriterionScore"("criterionId", "answerId");

-- CreateIndex
CREATE INDEX "Criterion_questionId_idx" ON "Criterion"("questionId");

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionScore" ADD CONSTRAINT "CriterionScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionScore" ADD CONSTRAINT "CriterionScore_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
