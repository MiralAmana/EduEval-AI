-- CreateEnum
CREATE TYPE "GradedBy" AS ENUM ('AUTO', 'AI', 'TEACHER');

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "gradedBy" "GradedBy";

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "resultsPublished" BOOLEAN NOT NULL DEFAULT false;
