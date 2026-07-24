"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  ImprovementRequest,
  ImprovementRequestCategory,
  ImprovementRequestStatus,
} from "@dgloss-kintai/contracts";

/** 種別ラベル。 */
const CATEGORY_LABEL: Readonly<Record<ImprovementRequestCategory, string>> = {
  feature: "機能要望",
  bug: "不具合",
  other: "その他",
};

/** 種別セレクトの選択肢（順序固定）。 */
const CATEGORY_OPTIONS: readonly ImprovementRequestCategory[] = [
  "feature",
  "bug",
  "other",
];

/** ステータスのラベルとバッジ配色。 */
const STATUS_BADGE: Readonly<
  Record<
    ImprovementRequestStatus,
    { readonly label: string; readonly className: string }
  >
> = {
  open: { label: "受付", className: "bg-neutral-200 text-neutral-700" },
  planned: { label: "対応予定", className: "bg-primary/20 text-neutral-800" },
  in_progress: {
    label: "対応中",
    className: "bg-secondary/20 text-neutral-800",
  },
  done: { label: "完了", className: "bg-neutral-800 text-white" },
  rejected: { label: "見送り", className: "bg-red-100 text-red-700" },
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

/** 改善リクエストを新しい順で取得する。 */
async function fetchRequests(): Promise<readonly ImprovementRequest[]> {
  const res = await fetch("/api/improvements", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`改善リクエストの取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { requests: readonly ImprovementRequest[] };
  return json.requests;
}

/** 改善リクエストを起票する（起票者は cookie セッションで解決）。 */
async function postRequest(input: {
  readonly category: ImprovementRequestCategory;
  readonly title: string;
  readonly body: string;
}): Promise<void> {
  const res = await fetch("/api/improvements", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`投稿に失敗しました (HTTP ${res.status})`);
  }
}

export default function ImprovementsPage(): ReactNode {
  const [requests, setRequests] = useState<readonly ImprovementRequest[]>([]);
  const [category, setCategory] =
    useState<ImprovementRequestCategory>("feature");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setRequests(await fetchRequests());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      if (title.trim() === "" || body.trim() === "") {
        setError("タイトルと本文を入力してください");
        return;
      }
      setPending(true);
      void (async () => {
        try {
          await postRequest({ category, title: title.trim(), body: body.trim() });
          setTitle("");
          setBody("");
          setCategory("feature");
          setError(null);
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "投稿に失敗しました");
        } finally {
          setPending(false);
        }
      })();
    },
    [category, title, body, reload],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-neutral-900">改善リクエスト</h1>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">新規投稿</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="category" className="text-sm font-medium text-neutral-600">
              種別
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ImprovementRequestCategory)
              }
              className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="text-sm font-medium text-neutral-600">
              タイトル
            </label>
            <input
              id="title"
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
              placeholder="例: 月次締めの PDF 出力がほしい"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="body" className="text-sm font-medium text-neutral-600">
              本文
            </label>
            <textarea
              id="body"
              value={body}
              maxLength={4000}
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-base"
              placeholder="困っていること・提案の詳細を記入してください"
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
            {pending ? "投稿中…" : "投稿する"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          投稿一覧（{requests.length}件）
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-2xl bg-white py-10 text-center text-neutral-400 shadow-sm">
            まだ投稿がありません
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((req) => {
              const badge = STATUS_BADGE[req.status];
              return (
                <li key={req.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-600">
                      {CATEGORY_LABEL[req.category]}
                    </span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-neutral-400">
                      {CREATED_FMT.format(new Date(req.createdAt))}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-neutral-900">
                    {req.title}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-neutral-600">
                    {req.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
