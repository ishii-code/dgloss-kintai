/**
 * 打刻履歴から本日の勤務状態・実労働時間を概算する純粋関数群。
 *
 * ここでは UI に依存しない計算のみを扱い、React 側から切り離してテスト可能にする。
 * 実際の勤怠判定（区分別労働時間・週40h/日8h・深夜割増等）は @dgloss-kintai/core が担う。
 * この概算はあくまで打刻画面での当日サマリ表示用。
 */

import type { Stamp } from "@dgloss-kintai/contracts";

/** 当日の勤務状態。打刻ボタンの活性制御にも使う。 */
export type WorkStatus = "before_work" | "working" | "on_break" | "after_work";

/** 打刻から概算した当日サマリ。 */
export interface WorkTimeSummary {
  /** 実労働時間（休憩控除後・分）。 */
  readonly workedMinutes: number;
  /** 休憩時間の合計（分）。 */
  readonly breakMinutes: number;
  /** 拘束時間（出勤〜退勤 or 現在・分）。 */
  readonly spanMinutes: number;
}

const MS_PER_MINUTE = 60_000;

function toEpochMs(iso: string): number {
  return new Date(iso).getTime();
}

function sortByTime(stamps: readonly Stamp[]): readonly Stamp[] {
  return [...stamps].sort(
    (a, b) => toEpochMs(a.stampedAt) - toEpochMs(b.stampedAt),
  );
}

/**
 * 打刻履歴から現在の勤務状態を導出する。
 * 出勤前 → 勤務中 ⇄ 休憩中 → 退勤済 の単純な状態機械。
 */
export function deriveStatus(stamps: readonly Stamp[]): WorkStatus {
  let status: WorkStatus = "before_work";
  for (const stamp of sortByTime(stamps)) {
    switch (stamp.type) {
      case "clock_in":
        status = "working";
        break;
      case "break_start":
        if (status === "working") status = "on_break";
        break;
      case "break_end":
        if (status === "on_break") status = "working";
        break;
      case "clock_out":
        status = "after_work";
        break;
      default:
        // entry/exit/pc_login/pc_logout は状態遷移に影響させない。
        break;
    }
  }
  return status;
}

/**
 * 打刻履歴から当日の実労働時間・休憩時間を概算する。
 *
 * - 最初の clock_in から clock_out（未打刻なら現在時刻）までを拘束時間とする。
 * - break_start / break_end の対で挟まれた区間を休憩として控除する。
 * - 進行中の休憩は現在時刻（または退勤時刻）まで加算する。
 *
 * @param nowIso 現在時刻の基準（省略時は Date.now()）。テスト用に注入可能。
 */
export function estimateWorkedMinutes(
  stamps: readonly Stamp[],
  nowIso?: string,
): WorkTimeSummary {
  const now = nowIso !== undefined ? toEpochMs(nowIso) : Date.now();

  let clockIn: number | null = null;
  let clockOut: number | null = null;
  let breakStart: number | null = null;
  let breakMs = 0;

  for (const stamp of sortByTime(stamps)) {
    const t = toEpochMs(stamp.stampedAt);
    switch (stamp.type) {
      case "clock_in":
        if (clockIn === null) clockIn = t;
        break;
      case "clock_out":
        clockOut = t;
        break;
      case "break_start":
        if (breakStart === null) breakStart = t;
        break;
      case "break_end":
        if (breakStart !== null) {
          breakMs += Math.max(0, t - breakStart);
          breakStart = null;
        }
        break;
      default:
        break;
    }
  }

  if (clockIn === null) {
    return { workedMinutes: 0, breakMinutes: 0, spanMinutes: 0 };
  }

  const end = clockOut ?? now;
  // 進行中の休憩は現在（or 退勤）まで加算。
  if (breakStart !== null) {
    breakMs += Math.max(0, end - breakStart);
  }

  const spanMs = Math.max(0, end - clockIn);
  const workedMs = Math.max(0, spanMs - breakMs);

  return {
    workedMinutes: Math.floor(workedMs / MS_PER_MINUTE),
    breakMinutes: Math.floor(breakMs / MS_PER_MINUTE),
    spanMinutes: Math.floor(spanMs / MS_PER_MINUTE),
  };
}

/** 分を「H時間M分」表記へ整形する。 */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}時間${String(m).padStart(2, "0")}分`;
}
