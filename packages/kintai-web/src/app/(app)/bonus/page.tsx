"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { BonusStatement } from "@dgloss-kintai/contracts";

import { AdminGuard } from "@/components/AdminGuard";
import type { EmployeeSummary } from "@/lib/employeeSummary";

const YEN_FMT = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

/** 円を `¥1,234` / `-¥1,234` 表記に整形する（負値対応）。 */
function formatYen(value: number): string {
  return YEN_FMT.format(value);
}

async function fetchEmployees(): Promise<readonly EmployeeSummary[]> {
  const res = await fetch("/api/employees", { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as { employees: readonly EmployeeSummary[] };
  return json.employees;
}

async function postBonus(input: {
  employeeId: string;
  label: string;
  params: {
    monthsMultiplier: number;
    evaluationRate: number;
    attendanceRate: number;
    adjustment: number;
  };
}): Promise<BonusStatement> {
  const res = await fetch("/api/admin/bonus", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `賞与計算に失敗しました (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as { statement: BonusStatement };
  return json.statement;
}

function BonusBody(): ReactNode {
  const [employees, setEmployees] = useState<readonly EmployeeSummary[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [label, setLabel] = useState("2026年 夏季賞与");
  const [months, setMonths] = useState("2.5");
  const [evaluation, setEvaluation] = useState("100");
  const [attendance, setAttendance] = useState("100");
  const [adjustment, setAdjustment] = useState("0");

  const [statement, setStatement] = useState<BonusStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await fetchEmployees();
      setEmployees(list);
      if (list.length > 0 && employeeId === "") {
        setEmployeeId(list[0]!.id);
      }
    })();
  }, [employeeId]);

  const handleCalc = useCallback((): void => {
    if (employeeId === "") {
      return;
    }
    if (label.trim() === "") {
      setError("支給期の名称を入力してください");
      return;
    }
    const monthsMultiplier = Math.round(Number(months) * 100);
    const evaluationRate = Math.round(Number(evaluation));
    const attendanceRate = Math.round(Number(attendance));
    const adjustmentYen = Math.round(Number(adjustment));
    if (
      !Number.isFinite(monthsMultiplier) ||
      !Number.isFinite(evaluationRate) ||
      !Number.isFinite(attendanceRate) ||
      !Number.isFinite(adjustmentYen)
    ) {
      setError("数値を正しく入力してください");
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        setStatement(
          await postBonus({
            employeeId,
            label: label.trim(),
            params: {
              monthsMultiplier,
              evaluationRate,
              attendanceRate,
              adjustment: adjustmentYen,
            },
          }),
        );
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "計算に失敗しました");
        setStatement(null);
      } finally {
        setBusy(false);
      }
    })();
  }, [employeeId, label, months, evaluation, attendance, adjustment]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">賞与計算</h1>
        <p className="mt-1 text-sm text-neutral-500">
          基本給・支給月数・評価係数・在籍按分から賞与（総支給まで）を試算します。所得税・社会保険料は給与ソフト連携（未計上）です。
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2">
        <Field label="従業員" htmlFor="employee">
          <select
            id="employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}（{emp.employeeCode}）
              </option>
            ))}
          </select>
        </Field>
        <Field label="支給期の名称" htmlFor="label">
          <input
            id="label"
            type="text"
            value={label}
            maxLength={100}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>
        <Field label="支給月数（月）" htmlFor="months">
          <input
            id="months"
            type="number"
            step="0.01"
            min="0"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>
        <Field label="評価係数（%）" htmlFor="evaluation">
          <input
            id="evaluation"
            type="number"
            step="1"
            min="0"
            value={evaluation}
            onChange={(e) => setEvaluation(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>
        <Field label="在籍按分（%）" htmlFor="attendance">
          <input
            id="attendance"
            type="number"
            step="1"
            min="0"
            max="100"
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>
        <Field label="その他調整額（円・加減算可）" htmlFor="adjustment">
          <input
            id="adjustment"
            type="number"
            step="1"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>
        <div className="md:col-span-2">
          <button
            type="button"
            onClick={handleCalc}
            disabled={busy || employeeId === ""}
            className="rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "計算中…" : "計算する"}
          </button>
        </div>
      </section>

      {error !== null && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {statement !== null && <BonusView statement={statement} />}
    </div>
  );
}

function BonusView({
  statement,
}: {
  readonly statement: BonusStatement;
}): ReactNode {
  if (!statement.eligible) {
    return (
      <section className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-xl font-bold text-neutral-700">賞与対象外</p>
        <p className="mt-2 text-base text-neutral-500">
          {statement.lines[0]?.note ?? "この従業員は賞与の支給対象ではありません。"}
        </p>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-primary/10 px-5 py-5 shadow-sm">
        <span className="text-sm text-neutral-500">{statement.label}・総支給賞与</span>
        <p className="font-mono text-3xl font-bold tabular-nums text-neutral-900">
          {formatYen(statement.grossBonus)}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">内訳</h2>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {statement.lines.map((line) => (
            <li
              key={line.label}
              className="flex items-center justify-between py-2.5"
            >
              <span className="text-base text-neutral-700">
                {line.label}
                {line.note !== undefined && (
                  <span className="ml-2 rounded-full bg-secondary/60 px-2 py-0.5 text-xs text-secondary-foreground">
                    {line.note}
                  </span>
                )}
              </span>
              <span className="font-mono text-base font-medium tabular-nums text-neutral-900">
                {formatYen(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-neutral-900">
          法定控除（給与ソフト連携）
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          賞与の所得税・社会保険料は給与ソフト側で確定します。本試算では未計上です。
        </p>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {statement.statutoryPlaceholders.map((line) => (
            <li
              key={line.label}
              className="flex items-center justify-between py-2.5"
            >
              <span className="text-base text-neutral-600">
                {line.label}
                {line.note !== undefined && (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                    {line.note}
                  </span>
                )}
              </span>
              <span className="font-mono text-base tabular-nums text-neutral-400">
                —
              </span>
            </li>
          ))}
        </ul>
      </section>
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
 * 賞与計算ページ（管理者専用）。従業員・パラメータから賞与（総支給まで）を試算する。
 */
export default function BonusPage(): ReactNode {
  return (
    <AdminGuard>
      <BonusBody />
    </AdminGuard>
  );
}
