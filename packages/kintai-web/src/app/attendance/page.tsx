import Link from "next/link";
import type { ReactNode } from "react";
import type { DayType, LeaveType, WorkDay } from "@dgloss-kintai/contracts";

import { MOCK_WORK_DAYS } from "@/lib/mockData";
import { formatDuration } from "@/lib/workTime";

const DAY_TYPE_LABEL: Readonly<Record<DayType, string>> = {
  workday: "所定労働日",
  legal_holiday: "法定休日",
  scheduled_holiday: "所定休日",
};

const LEAVE_LABEL: Readonly<Record<LeaveType, string>> = {
  paid_full: "有給(全日)",
  paid_half: "有給(半日)",
  special: "特別休暇",
  compensatory: "代休",
  absence: "欠勤",
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function overtimeMinutes(day: WorkDay): number {
  const { nonStatutoryOvertimeMinutes, statutoryOvertimeMinutes } =
    day.classified;
  return nonStatutoryOvertimeMinutes + statutoryOvertimeMinutes;
}

export default function AttendancePage(): ReactNode {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">勤怠一覧</h1>
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-base font-medium text-secondary underline-offset-2 hover:underline"
        >
          打刻へ
        </Link>
      </header>

      <p className="text-sm text-neutral-500">
        ※ 現在はモックデータを表示しています（API 未接続）。
      </p>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <ul className="divide-y divide-neutral-100">
          {MOCK_WORK_DAYS.map((day) => {
            const ot = overtimeMinutes(day);
            return (
              <li
                key={day.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-neutral-900">
                    {WEEKDAY_FMT.format(new Date(day.date))}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {DAY_TYPE_LABEL[day.dayType]}
                    {day.leave ? ` ・ ${LEAVE_LABEL[day.leave]}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="flex flex-col">
                    <span className="text-xs text-neutral-400">実労働</span>
                    <span className="font-mono text-lg tabular-nums text-neutral-900">
                      {formatDuration(day.actualWorkedMinutes)}
                    </span>
                  </div>
                  <div className="flex w-20 flex-col">
                    <span className="text-xs text-neutral-400">時間外</span>
                    <span
                      className={`font-mono text-lg tabular-nums ${
                        ot > 0 ? "text-secondary" : "text-neutral-400"
                      }`}
                    >
                      {formatDuration(ot)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
