/**
 * クライアント側のセッション取得ヘルパー。
 *
 * `/api/session` を叩き、ログイン中の従業員（公開サマリ）と役割（admin/general）を返す。
 * ランチャー（ホーム）・{@link file://../components/AppShell.tsx AppShell}・打刻画面・
 * 管理者ガードが共通で使う（従来各所に重複していた取得処理を 1 箇所へ集約）。
 */

import type { EmployeeSummary } from "@/lib/employeeSummary";
import type { Role } from "@/lib/modules";

/** 現在のセッション情報（未ログインは employee/role ともに null）。 */
export interface SessionInfo {
  readonly employee: EmployeeSummary | null;
  readonly role: Role | null;
}

/**
 * 現在のセッション情報を取得する。
 *
 * @returns ログイン中の従業員と役割（未ログインは両方 null）
 * @throws 取得に失敗（HTTP エラー）した場合
 */
export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch("/api/session", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`セッションの取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    employee?: EmployeeSummary | null;
    role?: Role | null;
  };
  return {
    employee: json.employee ?? null,
    role: json.role ?? null,
  };
}
