"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalRequestType,
} from "@dgloss-kintai/contracts";

import type { EmployeeSummary } from "@/lib/employeeSummary";
import { fetchSession } from "@/lib/session";

/** 種別ラベル。 */
const TYPE_LABEL: Readonly<Record<ApprovalRequestType, string>> = {
  overtime: "残業",
  leave: "休暇",
  stamp_correction: "打刻修正",
};

/** 種別セレクトの選択肢（順序固定）。 */
const TYPE_OPTIONS: readonly ApprovalRequestType[] = [
  "overtime",
  "leave",
  "stamp_correction",
];

/** ステータスのラベルとバッジ配色。 */
const STATUS_BADGE: Readonly<
  Record<
    ApprovalRequestStatus,
    { readonly label: string; readonly className: string }
  >
> = {
  pending: { label: "申請中", className: "bg-secondary/30 text-neutral-800" },
  approved: { label: "承認", className: "bg-primary text-primary-foreground" },
  rejected: { label: "却下", className: "bg-red-100 text-red-700" },
  cancelled: { label: "取消", className: "bg-neutral-200 text-neutral-500" },
};

const CREATED_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 承認申請を新しい順で取得する。 */
async function fetchRequests(): Promise<readonly ApprovalRequest[]> {
  const res = await fetch("/api/workflow", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`承認申請の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { requests: readonly ApprovalRequest[] };
  return json.requests;
}

/** 従業員一覧（id→氏名の表示用）を取得する。 */
async function fetchEmployees(): Promise<readonly EmployeeSummary[]> {
  const res = await fetch("/api/employees", { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as { employees: readonly EmployeeSummary[] };
  return json.employees;
}

/** 申請を起票する（申請者は cookie セッションで解決）。 */
async function postRequest(input: {
  readonly type: ApprovalRequestType;
  readonly subject: string;
  readonly detail: string;
  readonly targetDate?: string;
}): Promise<void> {
  const res = await fetch("/api/workflow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`申請に失敗しました (HTTP ${res.status})`);
  }
}

/** 決裁（承認／却下）。管理者のみ。 */
async function postDecide(
  requestId: string,
  decision: "approve" | "reject",
): Promise<void> {
  const res = await fetch("/api/workflow/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId, decision }),
  });
  if (!res.ok) {
    throw new Error(`決裁に失敗しました (HTTP ${res.status})`);
  }
}

/** 取消（申請者本人）。 */
async function postCancel(requestId: string): Promise<void> {
  const res = await fetch("/api/workflow/cancel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) {
    throw new Error(`取消に失敗しました (HTTP ${res.status})`);
  }
}

export default function WorkflowPage(): ReactNode {
  const [requests, setRequests] = useState<readonly ApprovalRequest[]>([]);
  const [employees, setEmployees] = useState<readonly EmployeeSummary[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [type, setType] = useState<ApprovalRequestType>("overtime");
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      map.set(e.id, `${e.name}（${e.employeeCode}）`);
    }
    return map;
  }, [employees]);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const [reqs, emps] = await Promise.all([
        fetchRequests(),
        fetchEmployees(),
      ]);
      setRequests(reqs);
      setEmployees(emps);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    void reload();
    void (async () => {
      try {
        const { employee, role } = await fetchSession();
        setMeId(employee?.id ?? null);
        setIsAdmin(role === "admin");
      } catch {
        // セッション取得失敗時は決裁・取消ボタンを出さない（AppShell が誘導）。
      }
    })();
  }, [reload]);

  const handleSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      if (subject.trim() === "" || detail.trim() === "") {
        setError("件名と詳細を入力してください");
        return;
      }
      setPending(true);
      void (async () => {
        try {
          await postRequest({
            type,
            subject: subject.trim(),
            detail: detail.trim(),
            ...(targetDate !== "" ? { targetDate } : {}),
          });
          setSubject("");
          setDetail("");
          setTargetDate("");
          setType("overtime");
          setError(null);
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "申請に失敗しました");
        } finally {
          setPending(false);
        }
      })();
    },
    [type, subject, detail, targetDate, reload],
  );

  const act = useCallback(
    (fn: () => Promise<void>): void => {
      setPending(true);
      void (async () => {
        try {
          await fn();
          setError(null);
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "操作に失敗しました");
        } finally {
          setPending(false);
        }
      })();
    },
    [reload],
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">ワークフロー</h1>
        <p className="mt-1 text-sm text-neutral-500">
          残業・休暇・打刻修正を申請し、管理者が承認／却下します（申請中 {pendingCount} 件）。
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">新規申請</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="type" className="text-sm font-medium text-neutral-600">
                種別
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as ApprovalRequestType)}
                className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="targetDate"
                className="text-sm font-medium text-neutral-600"
              >
                対象日（任意）
              </label>
              <input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="subject" className="text-sm font-medium text-neutral-600">
              件名
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
              placeholder="例: 月末締め対応の残業"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="detail" className="text-sm font-medium text-neutral-600">
              詳細
            </label>
            <textarea
              id="detail"
              value={detail}
              maxLength={4000}
              rows={4}
              onChange={(e) => setDetail(e.target.value)}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
              placeholder="理由・時間数などを記入してください"
            />
          </div>

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
            disabled={pending}
            className="self-start rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "送信中…" : "申請する"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          申請一覧（{requests.length}件）
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-2xl bg-white py-10 text-center text-neutral-400 shadow-sm">
            まだ申請がありません
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((req) => {
              const badge = STATUS_BADGE[req.status];
              const isMine = meId !== null && req.applicantEmployeeId === meId;
              const canDecide = isAdmin && req.status === "pending" && !isMine;
              const canCancel = isMine && req.status === "pending";
              const applicant =
                nameById.get(req.applicantEmployeeId) ??
                req.applicantEmployeeId;
              return (
                <li key={req.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-600">
                      {TYPE_LABEL[req.type]}
                    </span>
                    {req.targetDate !== null && (
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-mono tabular-nums text-neutral-600">
                        対象 {req.targetDate}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-xs tabular-nums text-neutral-400">
                      {CREATED_FMT.format(new Date(req.createdAt))}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-neutral-900">
                    {req.subject}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-neutral-600">
                    {req.detail}
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">
                    申請者: {applicant}
                  </p>
                  {req.decidedByEmployeeId !== null && (
                    <p className="mt-1 text-sm text-neutral-500">
                      決裁者:{" "}
                      {nameById.get(req.decidedByEmployeeId) ??
                        req.decidedByEmployeeId}
                      {req.decisionComment !== null &&
                        ` — 「${req.decisionComment}」`}
                    </p>
                  )}

                  {(canDecide || canCancel) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canDecide && (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              act(() => postDecide(req.id, "approve"))
                            }
                            className="rounded-lg bg-primary px-4 py-2 text-base font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                          >
                            承認
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              act(() => postDecide(req.id, "reject"))
                            }
                            className="rounded-lg border border-red-300 px-4 py-2 text-base font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            却下
                          </button>
                        </>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => postCancel(req.id))}
                          className="rounded-lg border border-neutral-300 px-4 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
