"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { BuildDailyResult, RunClosingResult } from "@dgloss-kintai/api";

import { AdminGuard } from "@/components/AdminGuard";
import type { EmployeeSummary } from "@/lib/employeeSummary";
import { currentYearMonth } from "@/lib/period";

const YEN_FMT = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});
const formatYen = (v: number): string => YEN_FMT.format(v);

async function fetchEmployees(): Promise<readonly EmployeeSummary[]> {
  const res = await fetch("/api/employees", { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as { employees: readonly EmployeeSummary[] };
  return json.employees;
}

async function buildDaily(input: {
  year: number;
  month: number;
  employeeId?: string;
}): Promise<BuildDailyResult> {
  const res = await fetch("/api/admin/attendance-build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `日次化に失敗しました (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as { result: BuildDailyResult };
  return json.result;
}

async function runClosing(input: {
  year: number;
  month: number;
  employeeId?: string;
}): Promise<RunClosingResult> {
  const res = await fetch("/api/admin/closing-run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `締め実行に失敗しました (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as { result: RunClosingResult };
  return json.result;
}

function ClosingRunBody(): ReactNode {
  const init = currentYearMonth();
  const [employees, setEmployees] = useState<readonly EmployeeSummary[]>([]);
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [target, setTarget] = useState<string>("__all__");
  const [result, setResult] = useState<RunClosingResult | null>(null);
  const [daily, setDaily] = useState<BuildDailyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setEmployees(await fetchEmployees());
    })();
  }, []);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      map.set(e.id, `${e.name}（${e.employeeCode}）`);
    }
    return map;
  }, [employees]);

  const targetInput = useCallback(
    () => ({
      year,
      month,
      ...(target !== "__all__" ? { employeeId: target } : {}),
    }),
    [year, month, target],
  );

  const handleBuildDaily = useCallback((): void => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        setDaily(await buildDaily(targetInput()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "日次化に失敗しました");
        setDaily(null);
      } finally {
        setBusy(false);
      }
    })();
  }, [targetInput]);

  const handleRun = useCallback((): void => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        setResult(await runClosing(targetInput()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "締め実行に失敗しました");
        setResult(null);
      } finally {
        setBusy(false);
      }
    })();
  }, [targetInput]);

  const years = [init.year - 1, init.year, init.year + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">勤怠の締め処理</h1>
        <p className="mt-1 text-sm text-neutral-500">
          ①打刻を日次勤怠へ変換し、②その勤怠から月次締め（割増・控除）を確定します。締め結果は給与明細・36協定に反映されます。
        </p>
      </div>

      <section className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <Field label="年" htmlFor="year">
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-base"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </Field>
        <Field label="月" htmlFor="month">
          <select
            id="month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-base"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </Field>
        <Field label="対象" htmlFor="target">
          <select
            id="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-base"
          >
            <option value="__all__">全従業員</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}（{e.employeeCode}）
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          onClick={handleBuildDaily}
          disabled={busy}
          className="rounded-xl border-2 border-primary px-6 py-3 text-lg font-bold text-neutral-800 transition-opacity hover:bg-primary/10 disabled:opacity-50"
        >
          {busy ? "実行中…" : "① 打刻を日次化"}
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={busy}
          className="rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "実行中…" : "② 締めを実行"}
        </button>
      </section>

      {error !== null && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {daily !== null && (
        <div className="rounded-2xl bg-secondary/10 px-5 py-4 shadow-sm">
          <p className="text-base font-bold text-neutral-900">
            {daily.period.year}年{daily.period.month}月 の打刻を日次化しました
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            勤務日 {daily.builtCount} 件を生成（対象 {daily.employeesProcessed} 名・
            うち勤務あり {daily.employeesWithWorkDays} 名）。続けて「② 締めを実行」してください。
          </p>
        </div>
      )}

      {result !== null && (
        <>
          <div className="rounded-2xl bg-primary/10 px-5 py-4 shadow-sm">
            <p className="text-base font-bold text-neutral-900">
              {result.period.year}年{result.period.month}月 の締めを実行しました
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              確定 {result.closedCount} 件
              {result.skippedCount > 0 &&
                `／勤怠なしでスキップ ${result.skippedCount} 件`}
            </p>
          </div>

          {result.closings.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-neutral-900">
                確定した締め
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-neutral-200 text-sm text-neutral-500">
                      <th className="py-2 pr-4 font-medium">従業員</th>
                      <th className="py-2 pr-4 font-medium">総労働</th>
                      <th className="py-2 pr-4 font-medium">割増合計</th>
                      <th className="py-2 font-medium">遅刻早退控除</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.closings.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-neutral-100 text-base"
                      >
                        <td className="py-2.5 pr-4 text-neutral-800">
                          {nameById.get(c.employeeId) ?? c.employeeId}
                        </td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-neutral-600">
                          {Math.floor(c.totalWorkedMinutes / 60)}:
                          {String(c.totalWorkedMinutes % 60).padStart(2, "0")}
                        </td>
                        <td className="py-2.5 pr-4 font-mono font-bold tabular-nums text-neutral-900">
                          {formatYen(c.premium.total)}
                        </td>
                        <td className="py-2.5 font-mono tabular-nums text-neutral-600">
                          {formatYen(c.latenessDeduction)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-600">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * 月次締め実行ページ（管理者専用）。対象月の勤怠から締めを確定・保存する。
 */
export default function ClosingRunPage(): ReactNode {
  return (
    <AdminGuard>
      <ClosingRunBody />
    </AdminGuard>
  );
}
