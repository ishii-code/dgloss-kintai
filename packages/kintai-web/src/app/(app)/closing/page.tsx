"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { MonthlyClosing } from "@dgloss-kintai/contracts";

import {
  currentYearMonth,
  formatYearMonth,
  shiftYearMonth,
} from "@/lib/period";
import { formatDuration } from "@/lib/workTime";

const YEN_FMT = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

/** 円を `¥1,234` 表記に整形する。 */
function formatYen(value: number): string {
  return YEN_FMT.format(value);
}

/** 締め取得の結果。`null` は未締め（404）。 */
type ClosingResult =
  | { readonly kind: "loading" }
  | { readonly kind: "none" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "found"; readonly closing: MonthlyClosing };

/** 対象年月の月次締めを取得する（employeeId は cookie セッションで解決）。 */
async function fetchClosing(
  year: number,
  month: number,
): Promise<ClosingResult> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const res = await fetch(`/api/closing?${params.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return { kind: "none" };
  }
  if (!res.ok) {
    return {
      kind: "error",
      message: `月次締めの取得に失敗しました (HTTP ${res.status})`,
    };
  }
  const json = (await res.json()) as { closing: MonthlyClosing };
  return { kind: "found", closing: json.closing };
}

export default function ClosingPage(): ReactNode {
  const [period, setPeriod] = useState(() => currentYearMonth());
  const [result, setResult] = useState<ClosingResult>({ kind: "loading" });

  const reload = useCallback(async (): Promise<void> => {
    setResult({ kind: "loading" });
    try {
      setResult(await fetchClosing(period.year, period.month));
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
        <h1 className="text-2xl font-bold text-neutral-900">月次締め</h1>
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
          <p className="text-xl font-bold text-neutral-700">未締め</p>
          <p className="mt-2 text-base text-neutral-500">
            {formatYearMonth(period)} の月次締めはまだ確定していません。
          </p>
        </div>
      )}

      {result.kind === "found" && <ClosingView closing={result.closing} />}
    </div>
  );
}

/** 締め結果の本体表示。 */
function ClosingView({ closing }: { readonly closing: MonthlyClosing }): ReactNode {
  const closed = closing.status === "closed";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-4 py-1 text-base font-bold ${
            closed
              ? "bg-neutral-800 text-white"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {closed ? "確定済み" : "仮締め"}
        </span>
        {closing.closedAt !== null && (
          <span className="text-sm text-neutral-500">
            確定: {closing.closedAt}
          </span>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <BigCard
          label="総労働時間"
          value={formatDuration(closing.totalWorkedMinutes)}
          highlight
        />
        <BigCard label="割増合計" value={formatYen(closing.premium.total)} highlight />
        <BigCard
          label="遅刻早退控除"
          value={formatYen(closing.latenessDeduction)}
        />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">
          割増賃金（区分別）
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
          <Row label="時間外" value={formatYen(closing.premium.overtimeAllowance)} />
          <Row
            label="60h超"
            value={formatYen(closing.premium.overtimeOver60Allowance)}
          />
          <Row label="休日" value={formatYen(closing.premium.holidayAllowance)} />
          <Row label="深夜" value={formatYen(closing.premium.nightAllowance)} />
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">
          区分別 労働時間
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
          <Row
            label="法定外残業"
            value={formatDuration(closing.classified.nonStatutoryOvertimeMinutes)}
          />
          <Row
            label="法定内残業"
            value={formatDuration(closing.classified.statutoryOvertimeMinutes)}
          />
          <Row
            label="法定休日"
            value={formatDuration(closing.classified.legalHolidayMinutes)}
          />
          <Row
            label="所定休日"
            value={formatDuration(closing.classified.scheduledHolidayMinutes)}
          />
          <Row
            label="深夜"
            value={formatDuration(closing.classified.nightMinutes)}
          />
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">その他</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Row
            label="固定残業差額支給"
            value={formatYen(closing.fixedOvertimeAdditionalPayment)}
          />
          <Row label="遅刻早退控除" value={formatYen(closing.latenessDeduction)} />
        </dl>
      </section>
    </div>
  );
}

interface BigCardProps {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}

function BigCard({ label, value, highlight = false }: BigCardProps): ReactNode {
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
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="font-mono text-lg font-bold tabular-nums text-neutral-900">
        {value}
      </dd>
    </div>
  );
}
