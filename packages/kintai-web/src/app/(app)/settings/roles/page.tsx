"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import type { EmployeeSummary } from "@/lib/employeeSummary";

async function fetchEmployees(): Promise<readonly EmployeeSummary[]> {
  const res = await fetch("/api/employees", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`従業員の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { employees: readonly EmployeeSummary[] };
  return json.employees;
}

async function fetchAdminCodes(): Promise<readonly string[]> {
  const res = await fetch("/api/admin/settings/roles", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ロール設定の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { adminEmployeeCodes: readonly string[] };
  return json.adminEmployeeCodes;
}

async function putAdminCodes(
  adminEmployeeCodes: readonly string[],
): Promise<readonly string[]> {
  const res = await fetch("/api/admin/settings/roles", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adminEmployeeCodes }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `保存に失敗しました (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as { adminEmployeeCodes: readonly string[] };
  return json.adminEmployeeCodes;
}

function RoleSettingsBody(): ReactNode {
  const [employees, setEmployees] = useState<readonly EmployeeSummary[]>([]);
  const [adminCodes, setAdminCodes] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [emps, codes] = await Promise.all([
          fetchEmployees(),
          fetchAdminCodes(),
        ]);
        setEmployees(emps);
        setAdminCodes(new Set(codes));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = useCallback((code: string): void => {
    setNotice(null);
    setAdminCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const selectedCount = adminCodes.size;

  const handleSave = useCallback((): void => {
    if (selectedCount === 0) {
      setError("管理者は少なくとも1名選択してください");
      return;
    }
    setSaving(true);
    setNotice(null);
    void (async () => {
      try {
        const saved = await putAdminCodes([...adminCodes]);
        setAdminCodes(new Set(saved));
        setError(null);
        setNotice("保存しました。権限は次回の画面読み込みから反映されます。");
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      } finally {
        setSaving(false);
      }
    })();
  }, [adminCodes, selectedCount]);

  const sorted = useMemo(
    () =>
      [...employees].sort((a, b) =>
        a.employeeCode < b.employeeCode ? -1 : a.employeeCode > b.employeeCode ? 1 : 0,
      ),
    [employees],
  );

  if (loading) {
    return <p className="py-10 text-center text-neutral-400">読み込み中…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">ロール設定</h1>
        <p className="mt-1 text-sm text-neutral-500">
          管理者権限を持つ従業員を指定します。少なくとも1名の管理者が必要です。
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">
            管理者に指定する従業員
          </h2>
          <span className="text-sm text-neutral-500">
            選択中 {selectedCount} 名
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {sorted.map((emp) => {
            const checked = adminCodes.has(emp.employeeCode);
            return (
              <li key={emp.id}>
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(emp.employeeCode)}
                    className="h-5 w-5 accent-[var(--primary,#2563eb)]"
                  />
                  <span className="font-mono text-sm tabular-nums text-neutral-500">
                    {emp.employeeCode}
                  </span>
                  <span className="text-base text-neutral-800">{emp.name}</span>
                  {checked && (
                    <span className="ml-auto rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-neutral-800">
                      管理者
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

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

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || selectedCount === 0}
          className="rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
      </div>
    </div>
  );
}

/**
 * ロール設定ページ（管理者専用）。管理者権限を持つ従業員を指定する。
 */
export default function RoleSettingsPage(): ReactNode {
  return (
    <AdminGuard>
      <RoleSettingsBody />
    </AdminGuard>
  );
}
