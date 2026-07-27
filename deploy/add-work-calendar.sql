-- 勤務カレンダー（休日区分の判定・シングルトン）のテーブルを追加する（既存データは消さない・1文DOブロック）。
-- Neon の SQL Editor / Vercel の Query に貼って実行する。何度実行してもよい（冪等）。
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS "WorkCalendar" (
    "id" TEXT NOT NULL,
    "legalHolidayWeekday" INTEGER NOT NULL,
    "scheduledHolidayWeekdays" INTEGER[] NOT NULL,
    "customHolidays" TEXT[] NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkCalendar_pkey" PRIMARY KEY ("id")
  );
END $$;
