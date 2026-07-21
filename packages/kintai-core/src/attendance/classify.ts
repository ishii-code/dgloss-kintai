/**
 * 打刻 →（区分別労働時間）への変換：1 日分の判定。
 *
 * 上位レイヤーが確定させた「労働区間（＝出退勤・休憩控除後の実労働の時刻区間）」と
 * 日の文脈（日区分・所定労働時間）から、割増計算エンジン `calculateWagePremium` に
 * そのまま渡せる `ClassifiedWorkMinutes`（区分別・分）を算出する。
 *
 * 確定ロジックの根拠:
 *  - 深夜(22:00-5:00): 労働区間と深夜帯の重なり（./night.ts）。他区分と重複加算。
 *  - 日区分ルーティング（就業規則第51条）:
 *      legal_holiday    → 全労働を legalHolidayMinutes へ（休日割増 0.35）。
 *      scheduled_holiday→ 全労働を scheduledHolidayMinutes へ（休日割増 0.25）。
 *      休日は日 8h の時間外分割をしない（休日割増で計上し、深夜のみ別途加算）。
 *  - 所定労働日(workday) の時間外分割（就業規則第48条・賃金規程第18-19条）:
 *      実労働 W（休憩控除後）、所定労働時間 S。日 8h = 480 分を法定内／法定外の境界とする。
 *      法定内残業（所定外・法定内）= max(0, min(W, 480) − S) → nonStatutoryOvertimeMinutes
 *      法定外（日 8h 超）        = max(0, W − 480)          → statutoryOvertimeMinutes
 *      所定内（≤ S）は基準内給与（基本給）に含まれるため、いずれの区分にも計上しない。
 *
 * 週 40h ルール（賃金規程第18-19条）は 1 日では判定できないため ./weekly.ts で適用する。
 *
 * TODO(スコープ外): フレックスタイム制の清算（月間清算・過不足の繰越）、事業場外みなし労働、
 * 変形労働時間制の特定日・特定週の所定変更には未対応。これらは日次の実労働 W をそのまま
 * 割増対象とする本実装とは前提が異なる。対応時は DailyWorkInput を判別ユニオンで拡張し、
 * 清算期間単位の集計関数を追加する。未対応の勤務体系を誤って本関数に流すと時間外の
 * 取りこぼし（未払い）を生むため、上位で勤務体系を判別し安全側（実労働ベース）で扱うこと。
 */

import type { ClassifiedWorkMinutes } from "../types.js";
import { nightOverlapMinutes } from "./night.js";
import { assertNonNegativeInteger } from "./validate.js";

/** 日 8h の法定労働時間（分）。就業規則第48条。 */
export const DAILY_STATUTORY_MINUTES = 480;

/**
 * 労働区間（休憩控除後の実労働の 1 セグメント）。
 * 時刻は「その日の 00:00 からの絶対分」で表す（翌 6:00 = 1800 分）。半開区間 [start, end)。
 */
export interface LaborInterval {
  /** 開始（00:00 からの分・非負整数）。 */
  readonly startMinute: number;
  /** 終了（00:00 からの分・非負整数、start より大）。日跨ぎは 1440 超で表現。 */
  readonly endMinute: number;
}

/**
 * 1 日分の勤務入力。日区分で判別する。休憩は控除済みの前提で intervals を受け取る
 * （intervals の合計が実労働時間 W）。
 */
export type DailyWorkInput =
  | {
      readonly dayType: "workday";
      /** 休憩控除後の労働区間（互いに重ならない）。 */
      readonly intervals: readonly LaborInterval[];
      /** 所定労働時間 S（分・非負整数、例 本社 8h=480 / 短日はそれ未満）。 */
      readonly scheduledWorkMinutes: number;
      /**
       * 日の法定内／法定外の境界（分）。既定は 480（日 8h）。
       * 変形労働時間制の特定日など、拡張時のフックとして上書き可能にしてある。
       */
      readonly dailyStatutoryThresholdMinutes?: number;
    }
  | {
      readonly dayType: "legal_holiday" | "scheduled_holiday";
      /** 休憩控除後の労働区間（互いに重ならない）。 */
      readonly intervals: readonly LaborInterval[];
    };

/**
 * 1 日分の判定結果に、週 40h 判定で必要な文脈を添えた内部表現。
 */
export interface DailyClassification {
  /** 区分別労働時間（分）。 */
  readonly classified: ClassifiedWorkMinutes;
  /** 実労働時間 W（休憩控除後・分、intervals の合計）。 */
  readonly workedMinutes: number;
  /** 週 40h の算定対象に含めるか（法定休日労働は含めない）。 */
  readonly countsTowardWeekly: boolean;
}

/** 区分をすべて 0 で初期化した `ClassifiedWorkMinutes` を返す。 */
function emptyClassified(): ClassifiedWorkMinutes {
  return {
    nonStatutoryOvertimeMinutes: 0,
    statutoryOvertimeMinutes: 0,
    legalHolidayMinutes: 0,
    scheduledHolidayMinutes: 0,
    nightMinutes: 0,
  };
}

/**
 * 労働区間を検証し、実労働時間 W と深夜労働時間を集計する。
 * 区間は非負整数・end > start・互いに重ならない（並べ替えて隣接チェック）ことを要求する。
 * 重なりを許すと W と深夜の二重計上＝過払いになるため、防御的に拒否する。
 */
function sumIntervals(intervals: readonly LaborInterval[]): {
  workedMinutes: number;
  nightMinutes: number;
} {
  const sorted = [...intervals].sort((a, b) => a.startMinute - b.startMinute);
  let workedMinutes = 0;
  let nightMinutes = 0;
  let previousEnd = -1;
  for (const interval of sorted) {
    assertNonNegativeInteger(interval.startMinute, "interval.startMinute");
    assertNonNegativeInteger(interval.endMinute, "interval.endMinute");
    if (interval.endMinute <= interval.startMinute) {
      throw new RangeError(
        "labor interval must have endMinute greater than startMinute",
      );
    }
    if (interval.startMinute < previousEnd) {
      throw new RangeError("labor intervals must not overlap");
    }
    workedMinutes += interval.endMinute - interval.startMinute;
    nightMinutes += nightOverlapMinutes(
      interval.startMinute,
      interval.endMinute,
    );
    previousEnd = interval.endMinute;
  }
  return { workedMinutes, nightMinutes };
}

/**
 * 1 日分を判定し、週判定に必要な文脈付きで返す（内部用）。
 * 週 40h 適用前の日次確定値。
 */
export function classifyDay(input: DailyWorkInput): DailyClassification {
  const { workedMinutes, nightMinutes } = sumIntervals(input.intervals);
  const classified = emptyClassified();
  classified.nightMinutes = nightMinutes;

  switch (input.dayType) {
    case "legal_holiday": {
      // 法定休日は全労働を休日割増で計上。時間外分割はしない。週 40h 算定に含めない。
      classified.legalHolidayMinutes = workedMinutes;
      return { classified, workedMinutes, countsTowardWeekly: false };
    }
    case "scheduled_holiday": {
      // 所定休日は全労働を休日割増で計上。時間外分割はしないが、週 40h 算定には含める。
      classified.scheduledHolidayMinutes = workedMinutes;
      return { classified, workedMinutes, countsTowardWeekly: true };
    }
    case "workday": {
      assertNonNegativeInteger(
        input.scheduledWorkMinutes,
        "scheduledWorkMinutes",
      );
      const threshold =
        input.dailyStatutoryThresholdMinutes ?? DAILY_STATUTORY_MINUTES;
      assertNonNegativeInteger(threshold, "dailyStatutoryThresholdMinutes");

      // 法定外（日 8h 超）
      classified.statutoryOvertimeMinutes = Math.max(
        0,
        workedMinutes - threshold,
      );
      // 法定内残業（所定外だが法定内）
      classified.nonStatutoryOvertimeMinutes = Math.max(
        0,
        Math.min(workedMinutes, threshold) - input.scheduledWorkMinutes,
      );
      return { classified, workedMinutes, countsTowardWeekly: true };
    }
  }
}

/**
 * 1 日分の勤務を区分別労働時間（分）に変換する（週 40h 適用前の日次確定値）。
 *
 * 週 40h ルールは 1 日では判定できないため、週単位で `applyWeeklyOvertime` を通すこと。
 * 週straddleを跨がない単日利用（例: 単発の休日出勤）ではそのまま月次集計に渡してよい。
 *
 * @param input 1 日分の労働区間・日区分・所定労働時間
 * @returns 割増計算エンジンに渡せる区分別労働時間
 */
export function classifyDailyWork(input: DailyWorkInput): ClassifiedWorkMinutes {
  return classifyDay(input).classified;
}
