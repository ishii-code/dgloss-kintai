"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { EmployeeDatabaseSummary } from "@dgloss-kintai/api";
import type {
  EmploymentType,
  OfficeDivision,
  WorkSystem,
} from "@dgloss-kintai/contracts";

import { AdminGuard } from "@/components/AdminGuard";
import {
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYMENT_TYPES,
  OFFICE_LABEL,
  OFFICE_OPTIONS,
  WORK_SYSTEM_LABEL,
  WORK_SYSTEM_OPTIONS,
} from "@/lib/employeeLabels";

/** サマリを取得する。 */
async function fetchSummary(): Promise<EmployeeDatabaseSummary> {
  const res = await fetch("/api/admin/summary", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`サマリの取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { summary: EmployeeDatabaseSummary };
  return json.summary;
}

function SummaryBody(): ReactNode {
  const [summary, setSummary] = useState<EmployeeDatabaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setSummary(await fetchSummary());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-neutral-900">
        データベースサマリ
      </h1>

      {error !== null && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
        >
          {error}
        </p>
      )}

      {summary === null ? (
        <p className="rounded-2xl bg-white py-10 text-center text-neutral-400 shadow-sm">
          読み込み中…
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BigStat label="総従業員数" value={summary.total} accent />
            <BigStat label="在籍" value={summary.active} />
            <BigStat label="退職" value={summary.retired} />
            <BigStat label="管理監督者" value={summary.managerialCount} />
          </section>

          <BreakdownCard<EmploymentType>
            title="雇用区分別"
            keys={EMPLOYMENT_TYPES}
            labels={EMPLOYMENT_TYPE_LABEL}
            counts={summary.byEmploymentType}
          />
          <BreakdownCard<WorkSystem>
            title="勤務体系別"
            keys={WORK_SYSTEM_OPTIONS}
            labels={WORK_SYSTEM_LABEL}
            counts={summary.byWorkSystem}
          />
          <BreakdownCard<OfficeDivision>
            title="所属別"
            keys={OFFICE_OPTIONS}
            labels={OFFICE_LABEL}
            counts={summary.byOffice}
          />
        </>
      )}
    </div>
  );
}

/** 大きな数値カード。 */
function BigStat({
  label,
  value,
  accent = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly accent?: boolean;
}): ReactNode {
  return (
    <div
      className={`rounded-2xl p-6 shadow-sm ${
        accent ? "bg-primary/10" : "bg-white"
      }`}
    >
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-900">
        {value}
      </p>
    </div>
  );
}

/** 区分別内訳カード。 */
function BreakdownCard<K extends string>({
  title,
  keys,
  labels,
  counts,
}: {
  readonly title: string;
  readonly keys: readonly K[];
  readonly labels: Readonly<Record<K, string>>;
  readonly counts: Readonly<Record<K, number>>;
}): ReactNode {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-neutral-900">{title}</h2>
      <ul className="flex flex-col gap-2">
        {keys.map((k) => (
          <li
            key={k}
            className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0"
          >
            <span className="text-base text-neutral-700">{labels[k]}</span>
            <span className="text-lg font-bold tabular-nums text-neutral-900">
              {counts[k]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * データベースサマリページ（管理者専用）。従業員マスタの集計をカードで俯瞰する。
 */
export default function SummaryPage(): ReactNode {
  return (
    <AdminGuard>
      <SummaryBody />
    </AdminGuard>
  );
}
