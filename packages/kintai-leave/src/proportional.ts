/**
 * 非正規社員（パート・短時間）の年次有給休暇「比例付与」
 * （非正規社員就業規則 第59条②・労基法第39条第3項）。
 *
 * 週所定労働時間 **30時間未満** かつ 週所定労働日数 **4日以下**（週以外で
 * 定める場合は年間所定労働日数 **216日以下**）の者には、通常の付与テーブル
 * （{@link grantDaysFor}）ではなく、所定労働日数に応じた**比例付与テーブル**を
 * 用いる。それ以外（週30時間以上 or 週5日以上）は通常付与を用いる。
 * 出勤率8割未満は付与0（通常付与と同じ・労基法第39条）。
 *
 * ## 通常付与ロジックとの関係
 * 変わるのは「基準日に付与する日数」だけである。半日取得・繰越・当年度優先消化・
 * 5日の時季指定義務（{@link computeBalance} / {@link fiveDayObligationStatus}）は、
 * 付与取引（`kind: "grant"` の `days`）に比例付与日数を積むだけでそのまま機能する
 * （消化・残高側は付与日数の出所を問わない）。
 */

import { z } from "zod";
import type { GrantTableRow, LeaveConfig } from "./config.js";
import { DEFAULT_LEAVE_CONFIG } from "./config.js";
import { grantDaysFor } from "./grant.js";

// ---------------------------------------------------------------------------
// 比例付与テーブル
// ---------------------------------------------------------------------------

/**
 * 比例付与テーブルの1行（週所定労働日数＝1〜4日ごと）。
 * 各行は、通常付与と同じ「勤続月数の下限→付与日数」の段
 * （{@link GrantTableRow}）を勤続段数ぶん持つ。
 */
export interface ProportionalGrantTableRow {
  /** 週所定労働日数（1〜4）。この行を選ぶキー。 */
  readonly weeklyDays: number;
  /** 週以外で定める場合の年間所定労働日数の下限（以上）。 */
  readonly annualDaysMin: number;
  /** 週以外で定める場合の年間所定労働日数の上限（以下）。 */
  readonly annualDaysMax: number;
  /**
   * 勤続月数→付与日数の段。`minMonths` 昇順を想定するが、順不同でも
   * 「`minMonths <= 勤続月数` を満たす最大の段」を採用する。
   */
  readonly grantTable: readonly GrantTableRow[];
}

/**
 * 法定の比例付与テーブル（労基法第39条第3項・非正規社員就業規則 第59条②）。
 * 列は勤続 6か月 / 1年6か月 / 2年6か月 / 3年6か月 / 4年6か月 / 5年6か月 /
 * 6年6か月以上（＝下限月数 6, 18, 30, 42, 54, 66, 78）。
 *
 * | 週所定労働日数[年間所定労働日数] | 6M | 18M | 30M | 42M | 54M | 66M | 78M〜 |
 * | -------------------------------- | -- | --- | --- | --- | --- | --- | ----- |
 * | 週4日（年169〜216日）            | 7  | 8   | 9   | 10  | 12  | 13  | 15    |
 * | 週3日（年121〜168日）            | 5  | 6   | 6   | 8   | 9   | 10  | 11    |
 * | 週2日（年73〜120日）             | 3  | 4   | 4   | 5   | 6   | 6   | 7     |
 * | 週1日（年48〜72日）              | 1  | 2   | 2   | 2   | 3   | 3   | 3     |
 */
export const LEGAL_PROPORTIONAL_GRANT_TABLE: readonly ProportionalGrantTableRow[] =
  [
    {
      weeklyDays: 4,
      annualDaysMin: 169,
      annualDaysMax: 216,
      grantTable: [
        { minMonths: 6, days: 7 },
        { minMonths: 18, days: 8 },
        { minMonths: 30, days: 9 },
        { minMonths: 42, days: 10 },
        { minMonths: 54, days: 12 },
        { minMonths: 66, days: 13 },
        { minMonths: 78, days: 15 },
      ],
    },
    {
      weeklyDays: 3,
      annualDaysMin: 121,
      annualDaysMax: 168,
      grantTable: [
        { minMonths: 6, days: 5 },
        { minMonths: 18, days: 6 },
        { minMonths: 30, days: 6 },
        { minMonths: 42, days: 8 },
        { minMonths: 54, days: 9 },
        { minMonths: 66, days: 10 },
        { minMonths: 78, days: 11 },
      ],
    },
    {
      weeklyDays: 2,
      annualDaysMin: 73,
      annualDaysMax: 120,
      grantTable: [
        { minMonths: 6, days: 3 },
        { minMonths: 18, days: 4 },
        { minMonths: 30, days: 4 },
        { minMonths: 42, days: 5 },
        { minMonths: 54, days: 6 },
        { minMonths: 66, days: 6 },
        { minMonths: 78, days: 7 },
      ],
    },
    {
      weeklyDays: 1,
      annualDaysMin: 48,
      annualDaysMax: 72,
      grantTable: [
        { minMonths: 6, days: 1 },
        { minMonths: 18, days: 2 },
        { minMonths: 30, days: 2 },
        { minMonths: 42, days: 2 },
        { minMonths: 54, days: 3 },
        { minMonths: 66, days: 3 },
        { minMonths: 78, days: 3 },
      ],
    },
  ];

/** 比例付与の設定一式（既定は法定＝{@link LEGAL_PROPORTIONAL_GRANT_TABLE}）。 */
export interface ProportionalLeaveConfig {
  /** 週所定労働日数→比例付与テーブル。 */
  readonly proportionalGrantTable: readonly ProportionalGrantTableRow[];
  /** 付与要件となる出勤率のしきい値（労基法第39条＝0.8＝8割）。 */
  readonly attendanceThreshold: number;
}

/** 比例付与判定に用いる所定労働の閾値（法定）。 */
export const PROPORTIONAL_ELIGIBILITY = {
  /** 週所定労働時間の上限（未満で比例付与対象・30時間未満）。 */
  weeklyHoursExclusiveMax: 30,
  /** 週所定労働日数の上限（以下で比例付与対象・4日以下）。 */
  weeklyDaysInclusiveMax: 4,
  /** 年間所定労働日数の上限（以下で比例付与対象・216日以下）。 */
  annualDaysInclusiveMax: 216,
} as const;

/** 比例付与の既定設定（法定）。 */
export const DEFAULT_PROPORTIONAL_LEAVE_CONFIG: ProportionalLeaveConfig = {
  proportionalGrantTable: LEGAL_PROPORTIONAL_GRANT_TABLE,
  attendanceThreshold: DEFAULT_LEAVE_CONFIG.attendanceThreshold,
};

// ---------------------------------------------------------------------------
// 検証スキーマ
// ---------------------------------------------------------------------------

/** 比例付与テーブル1行の検証スキーマ。 */
export const proportionalGrantTableRowSchema = z.object({
  weeklyDays: z.number().int().min(1).max(4),
  annualDaysMin: z.number().int().nonnegative(),
  annualDaysMax: z.number().int().nonnegative(),
  grantTable: z
    .array(
      z.object({
        minMonths: z.number().int().nonnegative(),
        days: z.number().nonnegative(),
      }),
    )
    .min(1),
});

/** 比例付与設定の検証スキーマ（外部入力の上書きを検証する）。 */
export const proportionalLeaveConfigSchema = z.object({
  proportionalGrantTable: z.array(proportionalGrantTableRowSchema).min(1),
  attendanceThreshold: z.number().min(0).max(1),
});

/**
 * 既定の比例付与設定に部分上書きをマージし、zod で検証して返す。
 * `undefined`/未指定のフィールドは既定値を採用する。
 */
export function resolveProportionalLeaveConfig(
  override?: Partial<ProportionalLeaveConfig>,
): ProportionalLeaveConfig {
  if (override === undefined) return DEFAULT_PROPORTIONAL_LEAVE_CONFIG;
  const merged = {
    proportionalGrantTable:
      override.proportionalGrantTable ??
      DEFAULT_PROPORTIONAL_LEAVE_CONFIG.proportionalGrantTable,
    attendanceThreshold:
      override.attendanceThreshold ??
      DEFAULT_PROPORTIONAL_LEAVE_CONFIG.attendanceThreshold,
  };
  return proportionalLeaveConfigSchema.parse(merged);
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * 「`minMonths <= 勤続月数` を満たす最大の段」の付与日数を返す
 * （通常付与 {@link grantDaysFor} と同じ据え置きロジック）。段下限未満は0。
 */
function daysFromGrantTable(
  grantTable: readonly GrantTableRow[],
  continuousServiceMonths: number,
): number {
  let days = 0;
  let matchedMonths = -1;
  for (const row of grantTable) {
    if (continuousServiceMonths >= row.minMonths && row.minMonths > matchedMonths) {
      matchedMonths = row.minMonths;
      days = row.days;
    }
  }
  return days;
}

/**
 * 年間所定労働日数を比例付与テーブルの「週相当日数」に対応づける
 * （労基法第39条第3項・週以外で所定労働日数を定める場合）。
 *
 * - 年169〜216日 → 週4日相当
 * - 年121〜168日 → 週3日相当
 * - 年73〜120日  → 週2日相当
 * - 年48〜72日   → 週1日相当（48日未満も最下段の週1日相当に丸める）
 *
 * @returns 対応する週相当日数（1〜4）。
 */
export function weeklyEquivalentFromAnnualDays(annualScheduledDays: number): number {
  if (annualScheduledDays >= 169) return 4;
  if (annualScheduledDays >= 121) return 3;
  if (annualScheduledDays >= 73) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// 比例付与本体
// ---------------------------------------------------------------------------

const proportionalGrantDaysForArgsSchema = z.object({
  weeklyScheduledDays: z.number().int().min(1).max(4),
  continuousServiceMonths: z.number().int().nonnegative(),
  attendanceRate: z.number().min(0).max(1),
});

/**
 * 週所定労働日数（1〜4）と勤続月数・出勤率から、その基準日に比例付与すべき
 * 年次有給休暇の日数を返す（非正規社員就業規則 第59条②・労基法第39条第3項）。
 *
 * - 出勤率が {@link ProportionalLeaveConfig.attendanceThreshold}（法定=0.8＝8割）
 *   未満の期間は付与0（通常付与と同じ・労基法第39条）。
 * - それ以外は該当行（`weeklyDays` 一致）の付与テーブルから「`minMonths <= 勤続月数`
 *   を満たす最大の段」を採用。勤続6か月未満（段下限未満）は0。
 *
 * 「比例付与か通常付与か」の判定は行わない（呼び出し側または
 * {@link grantDaysForSchedule} が判定する）。週相当日数が判明している前提で使う。
 *
 * @param weeklyScheduledDays 週所定労働日数（1〜4。年定めの場合は
 *   {@link weeklyEquivalentFromAnnualDays} で週相当日数に変換した値）。
 * @param continuousServiceMonths 継続勤務月数（例: 6か月ちょうど=6）。
 * @param attendanceRate 当該期間の出勤率（0〜1）。
 * @param config 比例付与テーブル・しきい値の設定（既定は法定）。
 */
export function proportionalGrantDaysFor(
  weeklyScheduledDays: number,
  continuousServiceMonths: number,
  attendanceRate: number,
  config: ProportionalLeaveConfig = DEFAULT_PROPORTIONAL_LEAVE_CONFIG,
): number {
  const args = proportionalGrantDaysForArgsSchema.parse({
    weeklyScheduledDays,
    continuousServiceMonths,
    attendanceRate,
  });
  if (args.attendanceRate < config.attendanceThreshold) return 0;

  const row = config.proportionalGrantTable.find(
    (r) => r.weeklyDays === args.weeklyScheduledDays,
  );
  if (row === undefined) return 0;
  return daysFromGrantTable(row.grantTable, args.continuousServiceMonths);
}

// ---------------------------------------------------------------------------
// 判定ディスパッチャ
// ---------------------------------------------------------------------------

/** 所定労働の情報（外部入力は {@link scheduleSchema} で検証する）。 */
export interface WorkSchedule {
  /** 週所定労働時間。 */
  readonly weeklyScheduledHours: number;
  /** 週所定労働日数。 */
  readonly weeklyScheduledDays: number;
  /** 年間所定労働日数（週以外で所定労働日数を定める場合に指定）。 */
  readonly annualScheduledDays?: number;
}

/** {@link WorkSchedule} の検証スキーマ（非負・整数など）。 */
export const scheduleSchema = z.object({
  weeklyScheduledHours: z.number().nonnegative(),
  weeklyScheduledDays: z.number().int().nonnegative(),
  annualScheduledDays: z.number().int().nonnegative().optional(),
});

/** ディスパッチャの設定（通常付与＋比例付与）。 */
export interface ScheduleGrantConfig {
  /** 通常付与の設定（週30時間以上 or 週5日以上のフォールバックに使用）。 */
  readonly normal: LeaveConfig;
  /** 比例付与の設定。 */
  readonly proportional: ProportionalLeaveConfig;
}

/**
 * 所定労働（{@link WorkSchedule}）に応じて、比例付与と通常付与を振り分けて
 * その基準日の付与日数を返す（非正規社員就業規則 第59条②）。
 *
 * ## 判定
 * 次を**すべて**満たすとき比例付与（{@link proportionalGrantDaysFor}）、
 * 満たさなければ通常付与（{@link grantDaysFor}）:
 * - 週所定労働時間が30時間**未満**、かつ
 * - 週所定労働日数が**1〜4日**、または 年間所定労働日数が指定されていて
 *   **1〜216日**。
 *
 * つまり 週30時間以上、または 週5日以上（かつ年216日以下の定めが無い）は通常付与。
 *
 * ## 週相当日数の対応（年定めの場合）
 * 週所定労働日数が1〜4日ならその値で比例テーブルの行を選ぶ。週所定労働日数が
 * その範囲外（例: 週の所定が固定されず年で定める）で年間所定労働日数が指定されて
 * いる場合は、{@link weeklyEquivalentFromAnnualDays} で週相当日数
 * （年169〜216→週4 / 121〜168→週3 / 73〜120→週2 / 〜72→週1）に変換して行を選ぶ。
 *
 * ## 付与日数以外はそのまま
 * 半日取得・繰越・当年度優先消化・5日の時季指定義務（{@link computeBalance} /
 * {@link fiveDayObligationStatus}）は、この関数が返す付与日数を付与取引の `days`
 * に積むだけでそのまま使える（変わるのは付与日数のみ）。
 *
 * @param schedule 所定労働（週所定労働時間・週所定労働日数・任意で年間所定労働日数）。
 * @param continuousServiceMonths 継続勤務月数。
 * @param attendanceRate 当該期間の出勤率（0〜1）。8割未満は0。
 * @param config 通常付与・比例付与の設定の部分上書き（既定はいずれも法定）。
 */
export function grantDaysForSchedule(
  schedule: WorkSchedule,
  continuousServiceMonths: number,
  attendanceRate: number,
  config?: Partial<ScheduleGrantConfig>,
): number {
  const s = scheduleSchema.parse(schedule);
  const normal = config?.normal ?? DEFAULT_LEAVE_CONFIG;
  const proportional = resolveProportionalLeaveConfig(config?.proportional);

  const weeklyDaysInRange =
    s.weeklyScheduledDays >= 1 &&
    s.weeklyScheduledDays <= PROPORTIONAL_ELIGIBILITY.weeklyDaysInclusiveMax;
  const annualDaysInRange =
    s.annualScheduledDays !== undefined &&
    s.annualScheduledDays >= 1 &&
    s.annualScheduledDays <= PROPORTIONAL_ELIGIBILITY.annualDaysInclusiveMax;

  const isProportional =
    s.weeklyScheduledHours < PROPORTIONAL_ELIGIBILITY.weeklyHoursExclusiveMax &&
    (weeklyDaysInRange || annualDaysInRange);

  if (!isProportional) {
    return grantDaysFor(continuousServiceMonths, attendanceRate, normal);
  }

  // 週相当日数の決定: 週所定労働日数が1〜4ならそれを優先、そうでなければ
  // 年間所定労働日数から週相当日数へ変換する。
  const weeklyDays = weeklyDaysInRange
    ? s.weeklyScheduledDays
    : weeklyEquivalentFromAnnualDays(s.annualScheduledDays as number);

  return proportionalGrantDaysFor(
    weeklyDays,
    continuousServiceMonths,
    attendanceRate,
    proportional,
  );
}
