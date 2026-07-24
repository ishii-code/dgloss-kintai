"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Payslip, PayslipLine } from "@dgloss-kintai/contracts";

import {
  currentYearMonth,
  formatYearMonth,
  shiftYearMonth,
} from "@/lib/period";

const YEN_FMT = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

/** 円を `¥1,234` 表記に整形する。 */
function formatYen(value: number): string {
  return YEN_FMT.format(value);
}

/** 明細取得の結果。`none` は未発行（404）。 */
type PayslipResult =
  | { readonly kind: "loading" }
  | { readonly kind: "none" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "found"; readonly payslip: Payslip };

/** 対象年月の給与明細を取得する（employeeId は cookie セッションで解決）。 */
async function fetchPayslip(
  year: number,
  month: number,
): Promise<PayslipResult> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const res = await fetch(`/api/payslips?${params.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return { kind: "none" };
  }
  if (!res.ok) {
    return {
      kind: "error",
      message: `給与明細の取得に失敗しました (HTTP ${res.status})`,
    };
  }
  const json = (await res.json()) as { payslip: Payslip };
  return { kind: "found", payslip: json.payslip };
}

export default function PayslipsPage(): ReactNode {
  const [period, setPeriod] = useState(() => currentYearMonth());
  const [result, setResult] = useState<PayslipResult>({ kind: "loading" });

  const reload = useCallback(async (): Promise<void> => {
    setResult({ kind: "loading" });
    try {
      setResult(await fetchPayslip(period.year, period.month));
    } catch (e) {
      setResult({
        kind: "error",
        message: e instanceof Error ? e.message : "取得に失敗しました",
      });
    }
  }, [period]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">給与明細</h1>
          <p className="mt-1 text-sm text-neutral-500">
            総支給額まで自社で確定します。所得税・社会保険料は給与ソフト連携（未計上）です。
          </p>
        </div>
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

      {result.kind === "loading" && (
        <p className="py-10 text-center text-neutral-400">読み込み中…</p>
      )}

      {result.kind === "error" && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {result.message}
        </div>
      )}

      {result.kind === "none" && (
        <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-xl font-bold text-neutral-700">未発行</p>
          <p className="mt-2 text-base text-neutral-500">
            {formatYearMonth(period)}{" "}
            の給与明細はまだ発行されていません（月次締めの確定が必要です）。
          </p>
        </div>
      )}

      {result.kind === "found" && <PayslipView payslip={result.payslip} />}
    </div>
  );
}

/** 明細本体の表示。支給・控除・差引支給・法定控除（外部連携）を段組みで示す。 */
function PayslipView({ payslip }: { readonly payslip: Payslip }): ReactNode {
  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <BigCard label="総支給額" value={formatYen(payslip.grossPay)} highlight />
        <BigCard label="控除合計" value={formatYen(payslip.totalDeductions)} />
        <BigCard
          label="差引支給額"
          value={formatYen(payslip.netBeforeStatutory)}
          highlight
          note="所得税・社保 控除前"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <LineSection title="支給" lines={payslip.earnings} total={payslip.grossPay} />
        <LineSection
          title="控除（自社計上）"
          lines={payslip.deductions}
          total={payslip.totalDeductions}
          emptyLabel="控除はありません"
        />
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-neutral-900">
          法定控除（給与ソフト連携）
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          所得税・社会保険料は毎年の法改正に追随するため、給与ソフト側で確定します。本明細では未計上です。
        </p>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {payslip.statutoryPlaceholders.map((line) => (
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

/** 支給／控除の明細行セクション。合計行を末尾に付ける。 */
function LineSection({
  title,
  lines,
  total,
  emptyLabel,
}: {
  readonly title: string;
  readonly lines: readonly PayslipLine[];
  readonly total: number;
  readonly emptyLabel?: string;
}): ReactNode {
  return (
    <section className="flex flex-col rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-neutral-900">{title}</h2>
      {lines.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-400">
          {emptyLabel ?? "項目はありません"}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {lines.map((line) => (
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
      )}
      <div className="mt-auto flex items-center justify-between border-t border-neutral-200 pt-3">
        <span className="text-base font-bold text-neutral-700">合計</span>
        <span className="font-mono text-lg font-bold tabular-nums text-neutral-900">
          {formatYen(total)}
        </span>
      </div>
    </section>
  );
}

interface BigCardProps {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
  readonly note?: string;
}

function BigCard({
  label,
  value,
  highlight = false,
  note,
}: BigCardProps): ReactNode {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl px-5 py-5 shadow-sm ${
        highlight ? "bg-primary/10" : "bg-white"
      }`}
    >
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="font-mono text-2xl font-bold tabular-nums text-neutral-900">
        {value}
      </span>
      {note !== undefined && (
        <span className="text-xs text-neutral-400">{note}</span>
      )}
    </div>
  );
}
