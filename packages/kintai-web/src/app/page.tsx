"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { IsoDateTime, Stamp, StampType } from "@dgloss-kintai/contracts";

import { DigitalClock } from "@/components/DigitalClock";
import { StampButton } from "@/components/StampButton";
import type { StampButtonVariant } from "@/components/StampButton";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import {
  PRIMARY_STAMP_TYPES,
  STAMP_LABELS,
  formatClockTime,
  toIsoDate,
  toIsoDateTime,
} from "@/lib/mockData";
import {
  deriveStatus,
  estimateWorkedMinutes,
  formatDuration,
} from "@/lib/workTime";
import type { WorkStatus } from "@/lib/workTime";

const STATUS_LABEL: Readonly<Record<WorkStatus, string>> = {
  before_work: "出勤前",
  working: "勤務中",
  on_break: "休憩中",
  after_work: "退勤済み",
};

const STATUS_BADGE: Readonly<Record<WorkStatus, string>> = {
  before_work: "bg-neutral-200 text-neutral-700",
  working: "bg-primary text-primary-foreground",
  on_break: "bg-secondary text-secondary-foreground",
  after_work: "bg-neutral-800 text-white",
};

const VARIANT_BY_TYPE: Readonly<Record<StampType, StampButtonVariant>> = {
  clock_in: "primary",
  clock_out: "secondary",
  break_start: "outline",
  break_end: "outline",
  entry: "outline",
  exit: "outline",
  pc_login: "outline",
  pc_logout: "outline",
};

/** 状態ごとに押下可能な打刻種別。 */
function isEnabled(status: WorkStatus, type: StampType): boolean {
  switch (status) {
    case "before_work":
      return type === "clock_in";
    case "working":
      return type === "clock_out" || type === "break_start";
    case "on_break":
      return type === "break_end";
    case "after_work":
      return false;
    default:
      return false;
  }
}

/** 当日（JST）の照会範囲 [from, to] を作る。 */
function todayRange(now: Date = new Date()): {
  from: IsoDateTime;
  to: IsoDateTime;
} {
  const date = toIsoDate(now);
  return {
    from: `${date}T00:00:00+09:00` as IsoDateTime,
    to: `${date}T23:59:59+09:00` as IsoDateTime,
  };
}

/** サーバから当日の打刻を取得する。 */
async function fetchTodayStamps(): Promise<readonly Stamp[]> {
  const { from, to } = todayRange();
  const params = new URLSearchParams({
    employeeId: DEMO_EMPLOYEE_ID,
    from,
    to,
  });
  const res = await fetch(`/api/stamps?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`当日打刻の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { stamps: readonly Stamp[] };
  return json.stamps;
}

/** 打刻をサーバへ登録する。 */
async function postStamp(type: StampType, stampedAt: IsoDateTime): Promise<void> {
  const res = await fetch("/api/stamps", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      employeeId: DEMO_EMPLOYEE_ID,
      type,
      stampedAt,
      source: "manual",
      note: null,
    }),
  });
  if (!res.ok) {
    throw new Error(`打刻の登録に失敗しました (HTTP ${res.status})`);
  }
}

export default function StampPage(): ReactNode {
  const [stamps, setStamps] = useState<readonly Stamp[]>([]);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 当日打刻をサーバから取得して state を同期する。
  const reload = useCallback(async (): Promise<void> => {
    try {
      const next = await fetchTodayStamps();
      setStamps(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  // マウント後に当日打刻を初回取得する。
  useEffect(() => {
    void reload();
  }, [reload]);

  // 実労働時間の概算を定期的に更新する。
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const status = useMemo(() => deriveStatus(stamps), [stamps]);
  const summary = useMemo(
    () => estimateWorkedMinutes(stamps),
    // tick を依存に含め、退勤前でも経過に応じて再計算する。
    [stamps, tick],
  );

  const history = useMemo(
    () =>
      [...stamps].sort(
        (a, b) =>
          new Date(b.stampedAt).getTime() - new Date(a.stampedAt).getTime(),
      ),
    [stamps],
  );

  const handleStamp = useCallback(
    (type: StampType): void => {
      const stampedAt = toIsoDateTime(new Date());
      // 楽観的更新: 仮の打刻を即時反映する。
      const optimistic: Stamp = {
        id: `temp_${crypto.randomUUID()}` as Stamp["id"],
        employeeId: DEMO_EMPLOYEE_ID,
        type,
        stampedAt,
        source: "manual",
        note: null,
      };
      setStamps((prev) => [...prev, optimistic]);
      setPending(true);
      void (async () => {
        try {
          await postStamp(type, stampedAt);
          // 登録後はサーバの当日打刻で整合させる。
          await reload();
        } catch (e) {
          setError(e instanceof Error ? e.message : "打刻に失敗しました");
          // 失敗時は楽観的分を捨て、サーバ状態へ戻す。
          await reload();
        } finally {
          setPending(false);
        }
      })();
    },
    [reload],
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">ディグロス勤怠</h1>
        <Link
          href="/attendance"
          className="rounded-lg px-3 py-2 text-base font-medium text-secondary underline-offset-2 hover:underline"
        >
          勤怠一覧
        </Link>
      </header>

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <span
            className={`rounded-full px-4 py-1 text-lg font-bold ${STATUS_BADGE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <DigitalClock />
        </div>
      </section>

      {error !== null && (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4">
        {PRIMARY_STAMP_TYPES.map((type) => (
          <StampButton
            key={type}
            type={type}
            label={STAMP_LABELS[type]}
            variant={VARIANT_BY_TYPE[type]}
            disabled={pending || !isEnabled(status, type)}
            onStamp={handleStamp}
          />
        ))}
      </section>

      <section className="grid grid-cols-3 gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <SummaryTile label="実労働" value={formatDuration(summary.workedMinutes)} highlight />
        <SummaryTile label="休憩" value={formatDuration(summary.breakMinutes)} />
        <SummaryTile label="拘束" value={formatDuration(summary.spanMinutes)} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">本日の打刻履歴</h2>
        {history.length === 0 ? (
          <p className="py-6 text-center text-neutral-400">
            まだ打刻がありません
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {history.map((stamp) => (
              <li
                key={stamp.id}
                className="flex items-center justify-between py-3"
              >
                <span className="text-lg font-medium text-neutral-800">
                  {STAMP_LABELS[stamp.type]}
                </span>
                <span className="font-mono text-lg tabular-nums text-neutral-600">
                  {formatClockTime(stamp.stampedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-center">
        <button
          type="button"
          onClick={() => void reload()}
          className="text-sm text-neutral-400 underline-offset-2 hover:underline"
        >
          再読み込み
        </button>
      </div>
    </main>
  );
}

interface SummaryTileProps {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}

function SummaryTile({ label, value, highlight = false }: SummaryTileProps): ReactNode {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 ${
        highlight ? "bg-primary/10" : "bg-neutral-50"
      }`}
    >
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-xl font-bold tabular-nums text-neutral-900">
        {value}
      </span>
    </div>
  );
}
