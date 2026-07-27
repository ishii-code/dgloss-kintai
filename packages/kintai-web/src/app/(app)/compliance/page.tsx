"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  ComplianceCheckKind,
  ComplianceLevel,
  ComplianceReportResponse,
} from "@dgloss-kintai/api";

import { AdminGuard } from "@/components/AdminGuard";
import type { EmployeeSummary } from "@/lib/employeeSummary";

/** チェック種別の表示ラベル（労基法第36条）。 */
const CHECK_LABEL: Readonly<Record<ComplianceCheckKind, string>> = {
  monthly_overtime: "単月の時間外（原則45時間）",
  annual_overtime: "年間の時間外（原則360時間）",
  annual_special_overtime: "年間の時間外（特別720時間）",
  monthly_with_holiday: "単月の時間外＋休日（100時間未満）",
  multi_month_average: "2〜6か月平均の時間外＋休日（80時間以下）",
  over45_count: "月45時間超の回数（年6回まで）",
};

/** 深刻度のラベルとバッジ配色。 */
const LEVEL_BADGE: Readonly<
  Record<ComplianceLevel, { readonly label: string; readonly className: string }>
> = {
  ok: { label: "適合", className: "bg-primary/15 text-neutral-800" },
  warning: { label: "接近", className: "bg-amber-100 text-amber-800" },
  exceeded: { label: "超過", className: "bg-red-600 text-white" },
};

/** 分を「N.N時間」表記に整形する。 */
function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}時間`;
}

/** 上限・実績・超過を単位に応じて表示する。 */
function formatValue(value: number, unit: "minutes" | "count"): string {
  return unit === "minutes" ? formatHours(value) : `${value}回`;
}

async function fetchEmployees(): Promise<readonly EmployeeSummary[]> {
  const res = await fetch("/api/employees", { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as { employees: readonly EmployeeSummary[] };
  return json.employees;
}

async function fetchReport(
  employeeId: string,
  year: number,
  startMonth: number,
): Promise<ComplianceReportResponse> {
  const params = new URLSearchParams({
    employeeId,
    year: String(year),
    startMonth: String(startMonth),
  });
  const res = await fetch(`/api/admin/compliance?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`コンプライアンスの取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { report: ComplianceReportResponse };
  return json.report;
}

/** 企業設定から年度開始月を取得する（失敗時は 4）。 */
async function fetchFiscalStartMonth(): Promise<number> {
  try {
    const res = await fetch("/api/admin/settings/company", {
      cache: "no-store",
    });
    if (!res.ok) {
      return 4;
    }
    const json = (await res.json()) as {
      settings: { fiscalYearStartMonth: number };
    };
    return json.settings.fiscalYearStartMonth;
  } catch {
    return 4;
  }
}

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

function ComplianceBody(): ReactNode {
  const [employees, setEmployees] = useState<readonly EmployeeSummary[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [year, setYear] = useState<number>(2026);
  const [startMonth, setStartMonth] = useState<number>(4);
  const [report, setReport] = useState<ComplianceReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [list, fiscalStart] = await Promise.all([
        fetchEmployees(),
        fetchFiscalStartMonth(),
      ]);
      setEmployees(list);
      setStartMonth(fiscalStart);
      if (list.length > 0 && employeeId === "") {
        setEmployeeId(list[0]!.id);
      }
    })();
  }, [employeeId]);

  const reload = useCallback(async (): Promise<void> => {
    if (employeeId === "") {
      return;
    }
    setLoading(true);
    try {
      setReport(await fetchReport(employeeId, year, startMonth));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, startMonth]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const worst = report?.report.worstLevel ?? "ok";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          36協定コンプライアンス
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          時間外労働の上限規制（労基法第36条）を年度・従業員ごとに監視します。
        </p>
      </div>

      <section className="flex flex-wrap items-end gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="employee" className="text-sm font-medium text-neutral-600">
            従業員
          </label>
          <select
            id="employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-base"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}（{emp.employeeCode}）
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="year" className="text-sm font-medium text-neutral-600">
            年度（{startMonth}月起算）
          </label>
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-base"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}年度
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading && (
        <p className="py-10 text-center text-neutral-400">読み込み中…</p>
      )}

      {error !== null && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {report !== null && !loading && (
        <>
          <div
            className={`rounded-2xl p-5 shadow-sm ${
              worst === "exceeded"
                ? "bg-red-50"
                : worst === "warning"
                  ? "bg-amber-50"
                  : "bg-primary/10"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-bold text-neutral-900">
                総合判定
              </span>
              <span
                className={`rounded-full px-4 py-1 text-base font-bold ${LEVEL_BADGE[worst].className}`}
              >
                {report.report.hasViolation
                  ? "違反の疑い"
                  : LEVEL_BADGE[worst].label}
              </span>
              <span className="ml-auto text-sm text-neutral-500">
                評価対象 {report.monthly.length} か月（{report.year}年度）
              </span>
            </div>
          </div>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-neutral-900">
              チェック結果
            </h2>
            {report.report.alerts.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">
                評価対象の締めがありません（月次締めの確定が必要です）。
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {report.report.alerts.map((alert, idx) => {
                  const badge = LEVEL_BADGE[alert.level];
                  return (
                    <li
                      key={`${alert.check}-${idx}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
                    >
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-base text-neutral-800">
                        {CHECK_LABEL[alert.check]}
                      </span>
                      <span className="ml-auto font-mono text-sm tabular-nums text-neutral-600">
                        {formatValue(alert.actual, alert.unit)} /{" "}
                        {formatValue(alert.limit, alert.unit)}
                        {alert.excess > 0 && (
                          <span className="ml-2 font-bold text-red-600">
                            超過 {formatValue(alert.excess, alert.unit)}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * 36協定コンプライアンスページ（管理者専用）。
 * 従業員・年度を選び、時間外労働上限規制の評価レポートを表示する。
 */
export default function CompliancePage(): ReactNode {
  return (
    <AdminGuard>
      <ComplianceBody />
    </AdminGuard>
  );
}
