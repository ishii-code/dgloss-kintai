"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { EmployeeSummary } from "@/lib/employeeSummary";

/** 従業員一覧を取得する。 */
async function fetchEmployees(): Promise<readonly EmployeeSummary[]> {
  const res = await fetch("/api/employees", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`従業員一覧の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { employees: readonly EmployeeSummary[] };
  return json.employees;
}

/** 選択した従業員でログイン（cookie セッション確立）する。 */
async function login(employeeId: string): Promise<void> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employeeId }),
  });
  if (!res.ok) {
    throw new Error(`ログインに失敗しました (HTTP ${res.status})`);
  }
}

/**
 * キオスク型ログイン画面。
 *
 * 共有 iPad 端末で「打刻する従業員」を選ぶ簡易ログイン。パスワードや SSO は現時点では
 * 求めない（将来の強化事項）。選択すると cookie セッションを確立し打刻画面へ遷移する。
 */
export default function LoginPage(): ReactNode {
  const router = useRouter();
  const [employees, setEmployees] = useState<readonly EmployeeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setEmployees(await fetchEmployees());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      }
    })();
  }, []);

  const handleSelect = useCallback(
    (employeeId: string): void => {
      setPendingId(employeeId);
      void (async () => {
        try {
          await login(employeeId);
          router.push("/");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "ログインに失敗しました");
          setPendingId(null);
        }
      })();
    },
    [router],
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">ディグロス勤怠</h1>
        <p className="text-base text-neutral-500">
          打刻する従業員を選んでください
        </p>
      </header>

      {error !== null && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {employees.length === 0 && error === null ? (
        <p className="py-10 text-center text-neutral-400">読み込み中…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {employees.map((employee) => (
            <li key={employee.id}>
              <button
                type="button"
                disabled={pendingId !== null}
                onClick={() => handleSelect(employee.id)}
                className="flex min-h-[5rem] w-full items-center justify-between rounded-2xl border-2 border-neutral-200 bg-white px-6 py-4 text-left shadow-sm transition select-none touch-manipulation hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-2xl font-bold text-neutral-900">
                  {employee.name}
                </span>
                <span className="font-mono text-lg tabular-nums text-neutral-500">
                  {employee.employeeCode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
