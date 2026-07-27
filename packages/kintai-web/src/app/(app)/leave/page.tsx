"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LeaveBalanceResult } from "@dgloss-kintai/api";

/** 残高取得の結果。 */
type LeaveState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "found"; readonly leave: LeaveBalanceResult };

/** 日数を「N日」表記（小数は 0.5 まで）に整形する。 */
function formatDays(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}日`;
}

/** 基準日時点の有給残高を取得する（employeeId は cookie セッションで解決）。 */
async function fetchLeave(): Promise<LeaveState> {
  const res = await fetch("/api/leave", { cache: "no-store" });
  if (res.status === 401) {
    return { kind: "error", message: "ログインが必要です" };
  }
  if (!res.ok) {
    return {
      kind: "error",
      message: `有給残高の取得に失敗しました (HTTP ${res.status})`,
    };
  }
  const json = (await res.json()) as { leave: LeaveBalanceResult };
  return { kind: "found", leave: json.leave };
}

export default function LeavePage(): ReactNode {
  const [state, setState] = useState<LeaveState>({ kind: "loading" });

  const reload = useCallback(async (): Promise<void> => {
    setState({ kind: "loading" });
    try {
      setState(await fetchLeave());
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "取得に失敗しました",
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">有給休暇</h1>
        <p className="mt-1 text-sm text-neutral-500">
          年次有給休暇の残日数・付与履歴・年5日取得義務の状況を確認します（労基法第39条）。
        </p>
      </div>

      {state.kind === "loading" && (
        <p className="py-10 text-center text-neutral-400">読み込み中…</p>
      )}

      {state.kind === "error" && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {state.message}
        </div>
      )}

      {state.kind === "found" && <LeaveView leave={state.leave} />}
    </div>
  );
}

/** 残高本体の表示。 */
function LeaveView({ leave }: { readonly leave: LeaveBalanceResult }): ReactNode {
  const { balance, obligation } = leave;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-neutral-500">基準日: {leave.asOf}</p>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigCard label="有効残日数" value={formatDays(balance.remainingDays)} highlight />
        <BigCard label="累計付与" value={formatDays(balance.grantedDays)} />
        <BigCard label="累計取得" value={formatDays(balance.takenDays)} />
        <BigCard label="時効消滅" value={formatDays(balance.expiredDays)} />
      </section>

      <ObligationCard obligation={obligation} />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">付与履歴</h2>
        {balance.buckets.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">
            付与はまだありません（入社6か月で初回付与）
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-200 text-sm text-neutral-500">
                  <th className="py-2 pr-4 font-medium">付与日</th>
                  <th className="py-2 pr-4 font-medium">付与日数</th>
                  <th className="py-2 pr-4 font-medium">取得済</th>
                  <th className="py-2 pr-4 font-medium">残</th>
                  <th className="py-2 pr-4 font-medium">時効消滅日</th>
                  <th className="py-2 font-medium">状態</th>
                </tr>
              </thead>
              <tbody>
                {balance.buckets.map((b) => (
                  <tr
                    key={b.grant.grantDate}
                    className="border-b border-neutral-100 text-base"
                  >
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-neutral-800">
                      {b.grant.grantDate}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-neutral-800">
                      {formatDays(b.grant.grantedDays)}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-neutral-600">
                      {formatDays(b.takenDays)}
                    </td>
                    <td className="py-2.5 pr-4 font-bold tabular-nums text-neutral-900">
                      {formatDays(b.remainingDays)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-sm tabular-nums text-neutral-500">
                      {b.grant.expiryDate}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                          b.expired
                            ? "bg-neutral-200 text-neutral-500"
                            : "bg-primary/15 text-neutral-800"
                        }`}
                      >
                        {b.expired ? "時効消滅" : "有効"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-neutral-400">
          ※ 付与は出勤率8割以上を前提に算定しています（実出勤率での精緻化は今後対応）。
        </p>
      </section>
    </div>
  );
}

/** 年5日取得義務のカード。未達なら警告色で強調する。 */
function ObligationCard({
  obligation,
}: {
  readonly obligation: LeaveBalanceResult["obligation"];
}): ReactNode {
  if (!obligation.obligated) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900">
          年5日取得義務
        </h2>
        <p className="mt-1 text-base text-neutral-500">
          当年度の付与が10日未満のため、時季指定義務の対象外です。
        </p>
      </section>
    );
  }
  const unmet = obligation.unmet;
  return (
    <section
      className={`rounded-2xl p-5 shadow-sm ${
        unmet ? "bg-red-50" : "bg-primary/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-neutral-900">年5日取得義務</h2>
        <span
          className={`rounded-full px-3 py-0.5 text-sm font-bold ${
            unmet ? "bg-red-600 text-white" : "bg-neutral-800 text-white"
          }`}
        >
          {unmet ? "未達" : "達成"}
        </span>
      </div>
      <p className="mt-2 text-base text-neutral-700">
        取得 {formatDays(obligation.takenDays)} / 義務 {formatDays(obligation.requiredDays)}
        （残り {formatDays(obligation.remainingObligationDays)}）
      </p>
      {obligation.deadline !== null && (
        <p className="mt-1 text-sm text-neutral-500">
          履行期限: {obligation.deadline}
        </p>
      )}
    </section>
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
