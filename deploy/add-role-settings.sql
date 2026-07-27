-- ロール設定（管理者社員番号・シングルトン）のテーブルを追加する（既存データは消さない・1文DOブロック）。
-- Neon の SQL Editor / Vercel の Query に貼って実行する。何度実行してもよい（冪等）。
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "RoleSettings" (
    "id" TEXT NOT NULL,
    "adminEmployeeCodes" TEXT[] NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoleSettings_pkey" PRIMARY KEY ("id")
  );
END $$;
