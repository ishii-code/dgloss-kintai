-- 固定残業超過アラート機能のためのスキーマ追加（既存データは消さない・冪等）。
-- Neon の SQL Editor / Vercel の Query に貼って実行する。何度実行してもよい。
--
-- 追加内容:
--   1) Employee に事業部列 department を追加（jinjer 部署名・通知の絞り込み用）
--   2) OvertimeAlert テーブル（従業員×年月で1回だけ通知するための冪等キー）
DO $$
BEGIN
  -- 1) 事業部列（NULL 許容・既存行は NULL のまま）。
  ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "department" TEXT;

  -- 2) 通知済み記録テーブル。
  CREATE TABLE IF NOT EXISTS "OvertimeAlert" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "additionalPayment" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OvertimeAlert_pkey" PRIMARY KEY ("id")
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "OvertimeAlert_employeeId_periodYear_periodMonth_key"
    ON "OvertimeAlert" ("employeeId", "periodYear", "periodMonth");
  CREATE INDEX IF NOT EXISTS "OvertimeAlert_periodYear_periodMonth_idx"
    ON "OvertimeAlert" ("periodYear", "periodMonth");
END $$;
