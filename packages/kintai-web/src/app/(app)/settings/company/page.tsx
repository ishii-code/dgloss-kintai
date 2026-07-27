"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CompanySettings } from "@dgloss-kintai/contracts";

import { AdminGuard } from "@/components/AdminGuard";

/** 月の選択肢（1-12）。 */
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

async function fetchSettings(): Promise<CompanySettings> {
  const res = await fetch("/api/admin/settings/company", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`企業設定の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { settings: CompanySettings };
  return json.settings;
}

async function putSettings(input: {
  companyName: string;
  representativeName: string;
  address: string;
  fiscalYearStartMonth: number;
}): Promise<CompanySettings> {
  const res = await fetch("/api/admin/settings/company", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`保存に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { settings: CompanySettings };
  return json.settings;
}

function CompanySettingsBody(): ReactNode {
  const [companyName, setCompanyName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [address, setAddress] = useState("");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(4);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((s: CompanySettings): void => {
    setCompanyName(s.companyName);
    setRepresentativeName(s.representativeName);
    setAddress(s.address);
    setFiscalYearStartMonth(s.fiscalYearStartMonth);
    setUpdatedAt(s.updatedAt);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        apply(await fetchSettings());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [apply]);

  const handleSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      if (companyName.trim() === "") {
        setError("会社名を入力してください");
        return;
      }
      setSaving(true);
      setNotice(null);
      void (async () => {
        try {
          const saved = await putSettings({
            companyName: companyName.trim(),
            representativeName: representativeName.trim(),
            address: address.trim(),
            fiscalYearStartMonth,
          });
          apply(saved);
          setError(null);
          setNotice("保存しました");
        } catch (err) {
          setError(err instanceof Error ? err.message : "保存に失敗しました");
        } finally {
          setSaving(false);
        }
      })();
    },
    [companyName, representativeName, address, fiscalYearStartMonth, apply],
  );

  if (loading) {
    return <p className="py-10 text-center text-neutral-400">読み込み中…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">企業設定</h1>
        <p className="mt-1 text-sm text-neutral-500">
          会社情報と年度開始月を設定します。年度開始月は36協定監視の集計起点に反映されます。
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm"
      >
        <Field label="会社名" htmlFor="companyName">
          <input
            id="companyName"
            type="text"
            value={companyName}
            maxLength={200}
            onChange={(e) => setCompanyName(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>

        <Field label="代表者名（任意）" htmlFor="representativeName">
          <input
            id="representativeName"
            type="text"
            value={representativeName}
            maxLength={100}
            onChange={(e) => setRepresentativeName(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>

        <Field label="所在地（任意）" htmlFor="address">
          <input
            id="address"
            type="text"
            value={address}
            maxLength={300}
            onChange={(e) => setAddress(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
          />
        </Field>

        <Field label="年度開始月" htmlFor="fiscalYearStartMonth">
          <select
            id="fiscalYearStartMonth"
            value={fiscalYearStartMonth}
            onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}
            className="w-40 rounded-xl border border-neutral-300 px-4 py-3 text-base"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </Field>

        {error !== null && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
          >
            {error}
          </p>
        )}
        {notice !== null && (
          <p className="rounded-xl bg-primary/10 px-4 py-3 text-base font-medium text-neutral-800">
            {notice}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
          {updatedAt !== null &&
            updatedAt !== "1970-01-01T00:00:00+09:00" && (
              <span className="text-sm text-neutral-400">
                最終更新: {updatedAt}
              </span>
            )}
        </div>
      </form>
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
 * 企業設定ページ（管理者専用）。会社情報・年度開始月を編集する。
 */
export default function CompanySettingsPage(): ReactNode {
  return (
    <AdminGuard>
      <CompanySettingsBody />
    </AdminGuard>
  );
}
