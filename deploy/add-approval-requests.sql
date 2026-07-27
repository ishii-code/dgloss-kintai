-- 承認ワークフロー（申請・承認）のテーブルを追加する（既存データは消さない・1文DOブロック）。
-- Neon の SQL Editor / Vercel の Query に貼って実行する。何度実行してもよい（冪等）。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalRequestType') THEN
    CREATE TYPE "ApprovalRequestType" AS ENUM ('overtime','leave','stamp_correction');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalRequestStatus') THEN
    CREATE TYPE "ApprovalRequestStatus" AS ENUM ('pending','approved','rejected','cancelled');
  END IF;

  CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "type" "ApprovalRequestType" NOT NULL,
    "applicantEmployeeId" TEXT NOT NULL,
    "targetDate" DATE,
    "subject" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL,
    "decidedByEmployeeId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
  );
  CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");
  CREATE INDEX IF NOT EXISTS "ApprovalRequest_applicantEmployeeId_idx" ON "ApprovalRequest"("applicantEmployeeId");
  CREATE INDEX IF NOT EXISTS "ApprovalRequest_createdAt_idx" ON "ApprovalRequest"("createdAt");
END $$;
