-- 企業設定（シングルトン）のテーブルを追加する（既存データは消さない・1文DOブロック）。
-- Neon の SQL Editor / Vercel の Query に貼って実行する。何度実行してもよい（冪等）。
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "fiscalYearStartMonth" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
  );
END $$;
