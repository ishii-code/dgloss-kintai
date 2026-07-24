"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DayType, LeaveType, WorkDay } from "@dgloss-kintai/contracts";

import {
  currentYearMonth,
  formatYearMonth,
  monthDateRange,
  shiftYearMonth,
} from "@/lib/period";
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

/** 時間外（法定内＋法定外）合計。 */
function overtimeMinutes(day: WorkDay): number {
  const { nonStatutoryOvertimeMinutes, statutoryOvertimeMinutes } =
    day.classified;
  return nonStatutoryOvertimeMinutes + statutoryOvertimeMinutes;
}

/** 対象年月の日次勤怠を取得する（employeeId は cookie セッションで解決）。 */
async function fetchWorkDays(
  from: string,
  to: string,
): Promise<readonly WorkDay[]> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/workdays?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`勤怠一覧の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { workDays: readonly WorkDay[] };
  return json.workDays;
}

export default function AttendancePage(): ReactNode {
  const [period, setPeriod] = useState(() => currentYearMonth());
  const [workDays, setWorkDays] = useState<readonly WorkDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { from, to } = monthDateRange(period);
      setWorkDays(await fetchWorkDays(from, to));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totals = useMemo(() => {
    let worked = 0;
    let ot = 0;
    let night = 0;
    for (const d of workDays) {
      worked += d.actualWorkedMinutes;
      ot += overtimeMinutes(d);
      night += d.classified.nightMinutes;
    }
    return { worked, ot, night };
  }, [workDays]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">勤怠一覧</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPeriod((p) => shiftYearMonth(p, -1))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          >
            前月
          </button>
          <span className="min-w-24 text-center font-mono text-lg font-bold tabular-nums text-neutral-900">
            {formatYearMonth(period)}
          </span>
          <button
            type="button"
            onClick={() => setPeriod((p) => shiftYearMonth(p, 1))}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          >
            翌月
          </button>
        </div>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="実労働 合計" value={formatDuration(totals.worked)} highlight />
        <StatCard label="時間外 合計" value={formatDuration(totals.ot)} />
        <StatCard label="深夜 合計" value={formatDuration(totals.night)} />
      </section>

      {error !== null && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {workDays.length === 0 ? (
          <p className="py-10 text-center text-neutral-400">
            {loading ? "読み込み中…" : "この月の勤怠データはありません"}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {workDays.map((day) => {
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
                    <Metric label="実労働" value={formatDuration(day.actualWorkedMinutes)} />
                    <Metric
                      label="時間外"
                      value={formatDuration(ot)}
                      accent={ot > 0}
                    />
                    <Metric
                      label="深夜"
                      value={formatDuration(day.classified.nightMinutes)}
                      accent={day.classified.nightMinutes > 0}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}

function StatCard({ label, value, highlight = false }: StatCardProps): ReactNode {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl px-4 py-4 shadow-sm ${
        highlight ? "bg-primary/10" : "bg-white"
      }`}
    >
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="font-mono text-2xl font-bold tabular-nums text-neutral-900">
        {value}
      </span>
    </div>
  );
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
  readonly accent?: boolean;
}

function Metric({ label, value, accent = false }: MetricProps): ReactNode {
  return (
    <div className="flex w-20 flex-col">
      <span className="text-xs text-neutral-400">{label}</span>
      <span
        className={`font-mono text-lg tabular-nums ${
          accent ? "text-secondary" : "text-neutral-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
