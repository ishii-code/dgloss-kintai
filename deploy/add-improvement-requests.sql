-- 改善リクエスト機能のテーブルを追加する（既存データは消さない・1文DOブロック）。
-- Neon の SQL Editor / Vercel の Query に貼って実行する。何度実行してもよい。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImprovementRequestStatus') THEN
    CREATE TYPE "ImprovementRequestStatus" AS ENUM ('open','planned','in_progress','done','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImprovementRequestCategory') THEN
    CREATE TYPE "ImprovementRequestCategory" AS ENUM ('feature','bug','other');
  END IF;

  CREATE TABLE IF NOT EXISTS "ImprovementRequest" (
    "id" TEXT NOT NULL,
    "createdByEmployeeId" TEXT NOT NULL,
    "category" "ImprovementRequestCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ImprovementRequestStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImprovementRequest_pkey" PRIMARY KEY ("id")
  );
  CREATE INDEX IF NOT EXISTS "ImprovementRequest_status_idx" ON "ImprovementRequest"("status");
  CREATE INDEX IF NOT EXISTS "ImprovementRequest_createdAt_idx" ON "ImprovementRequest"("createdAt");
END $$;
