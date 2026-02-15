-- AlterTable
ALTER TABLE "users" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "trial_sessions_used" INTEGER NOT NULL DEFAULT 0;
