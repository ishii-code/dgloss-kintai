"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import {
  currentYearMonth,
  formatYearMonth,
  shiftYearMonth,
} from "@/lib/period";

/** ダウンロード結果の状態。 */
type DownloadState =
  | { readonly kind: "idle" }
  | { readonly kind: "downloading" }
  | { readonly kind: "done" }
  | { readonly kind: "none" }
  | { readonly kind: "error"; readonly message: string };

export default function PayrollPage(): ReactNode {
  const [period, setPeriod] = useState(() => currentYearMonth());
  const [state, setState] = useState<DownloadState>({ kind: "idle" });

  /** 対象年月の給与 CSV を取得し、ブラウザでダウンロードさせる。 */
  const handleDownload = (): void => {
    setState({ kind: "downloading" });
    void (async () => {
      try {
        const params = new URLSearchParams({
          year: String(period.year),
          month: String(period.month),
        });
        const res = await fetch(`/api/payroll?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          setState({ kind: "none" });
          return;
        }
        if (!res.ok) {
          setState({
            kind: "error",
            message: `CSV の取得に失敗しました (HTTP ${res.status})`,
          });
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll_${formatYearMonth(period)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setState({ kind: "done" });
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "ダウンロードに失敗しました",
        });
      }
    })();
  };

  return (
    <AdminGuard>
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-neutral-900">給与 CSV</h1>

      <section className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-base text-neutral-600">
          対象年月の月次締めから、給与ソフト連携用の CSV
          をダウンロードします（UTF-8 BOM 付き・Excel 取込対応）。
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500">対象年月</span>
          <button
            type="button"
            onClick={() => {
              setPeriod((p) => shiftYearMonth(p, -1));
              setState({ kind: "idle" });
            }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          >
            前月
          </button>
          <span className="min-w-24 text-center font-mono text-lg font-bold tabular-nums text-neutral-900">
            {formatYearMonth(period)}
          </span>
          <button
            type="button"
            onClick={() => {
              setPeriod((p) => shiftYearMonth(p, 1));
              setState({ kind: "idle" });
            }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          >
            翌月
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={state.kind === "downloading"}
          className="rounded-xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state.kind === "downloading"
            ? "生成中…"
            : `${formatYearMonth(period)} の給与 CSV をダウンロード`}
        </button>

        {state.kind === "done" && (
          <p className="text-base font-medium text-neutral-600">
            ダウンロードを開始しました。
          </p>
        )}
        {state.kind === "none" && (
          <p className="rounded-xl bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-600">
            {formatYearMonth(period)}{" "}
            の月次締めが存在しないため CSV を生成できません（未締め）。
          </p>
        )}
        {state.kind === "error" && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
          >
            {state.message}
          </p>
        )}
      </section>
      </div>
    </AdminGuard>
  );
}
