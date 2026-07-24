"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import type { ImportResult } from "@dgloss-kintai/api";

import { AdminGuard } from "@/components/AdminGuard";

/** CSV をアップロードして取込結果を得る。 */
async function uploadCsv(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/employees/import", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      json?.error?.message ?? `取込に失敗しました (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as { result: ImportResult };
  return json.result;
}

function ImportBody(): ReactNode {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      if (file === null) {
        setError("CSV ファイルを選択してください");
        return;
      }
      setPending(true);
      setResult(null);
      void (async () => {
        try {
          const r = await uploadCsv(file);
          setResult(r);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "取込に失敗しました");
        } finally {
          setPending(false);
        }
      })();
    },
    [file],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-neutral-900">インポート</h1>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-bold text-neutral-900">
          従業員 CSV 取込
        </h2>
        <p className="mb-4 text-sm text-neutral-600">
          社員番号をキーに、既存は更新・新規は追加します（1 行の失敗で全体は止まりません）。
          列の並びは下のテンプレートに従ってください。
        </p>

        <a
          href="/api/admin/employees/export"
          className="mb-5 inline-flex rounded-xl border border-neutral-300 px-5 py-2.5 text-base font-bold text-neutral-700 hover:bg-neutral-50"
        >
          ⬇ 現在のデータ（テンプレート）を CSV でダウンロード
        </a>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError(null);
            }}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />

          {error !== null && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || file === null}
            className="self-start rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "取込中…" : "アップロードして取込"}
          </button>
        </form>
      </section>

      {result !== null && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">取込結果</h2>
          <div className="flex flex-wrap gap-4">
            <ResultStat label="処理行数" value={result.total} />
            <ResultStat label="成功" value={result.succeeded} tone="ok" />
            <ResultStat label="失敗" value={result.failed} tone="ng" />
          </div>

          {result.errors.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-base font-bold text-neutral-800">
                エラー明細
              </h3>
              <ul className="flex flex-col gap-2">
                {result.errors.map((err) => (
                  <li
                    key={err.row}
                    className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700"
                  >
                    <span className="font-bold">{err.row} 行目：</span>
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** 取込結果の集計タイル。 */
function ResultStat({
  label,
  value,
  tone = "neutral",
}: {
  readonly label: string;
  readonly value: number;
  readonly tone?: "neutral" | "ok" | "ng";
}): ReactNode {
  const color = tone === "ng" ? "text-red-600" : "text-neutral-900";
  return (
    <div className="min-w-[7rem] rounded-xl bg-neutral-50 px-5 py-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

/**
 * インポートページ（管理者専用）。従業員 CSV のアップロード取込と、
 * エクスポート CSV のテンプレートダウンロード導線を提供する。
 */
export default function ImportPage(): ReactNode {
  return (
    <AdminGuard>
      <ImportBody />
    </AdminGuard>
  );
}
