/**
 * ロジックではなく「設定値」として外出しする項目。
 * 就業規則・賃金規程では会社・年度・雇用契約ごとに変わりうる数値を config 化する。
 */

/** 割増賃金計算の設定（賃金規程第20条）。 */
export interface WagePremiumConfig {
  /**
   * 当該年度の所定労働時間数（年間・時間）。
   * 月間平均所定労働時間 = この値 ÷ 12（賃金規程第20条3項1号）。
   * 年度・カレンダーにより変動するため config 化する。
   */
  annualScheduledWorkingHours: number;

  /**
   * 法定時間外労働の割増率が 0.25 → 0.50 に上がる月間しきい値（時間）。
   * 賃金規程第20条3項2号(1)b により既定は 60 時間。
   */
  overtimeIncreasedRateThresholdHours?: number;
}

/** 割増率が上がる月間時間外しきい値の既定値（賃金規程第20条3項2号(1)b）。 */
export const DEFAULT_OVERTIME_INCREASED_RATE_THRESHOLD_HOURS = 60;

/**
 * 設定を検証し、しきい値の既定を解決する。
 * 入力バリデーション必須（不正な年間所定労働時間は 0 除算・未払いに直結するため）。
 */
export function resolveWagePremiumConfig(config: WagePremiumConfig): {
  annualScheduledWorkingHours: number;
  overtimeIncreasedRateThresholdHours: number;
} {
  const { annualScheduledWorkingHours } = config;
  if (
    !Number.isFinite(annualScheduledWorkingHours) ||
    annualScheduledWorkingHours <= 0
  ) {
    throw new RangeError(
      "annualScheduledWorkingHours must be a positive finite number",
    );
  }

  const threshold =
    config.overtimeIncreasedRateThresholdHours ??
    DEFAULT_OVERTIME_INCREASED_RATE_THRESHOLD_HOURS;
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError(
      "overtimeIncreasedRateThresholdHours must be a non-negative finite number",
    );
  }

  return {
    annualScheduledWorkingHours,
    overtimeIncreasedRateThresholdHours: threshold,
  };
}

/**
 * 年間所定労働時間（時間）を「分」の整数に変換する。
 * 月間平均所定を途中で丸めず、分子・分母を整数のまま扱うための基礎値。
 */
export function annualScheduledMinutesOf(
  annualScheduledWorkingHours: number,
): number {
  const minutes = annualScheduledWorkingHours * 60;
  const rounded = Math.round(minutes);
  if (Math.abs(minutes - rounded) > 1e-6) {
    throw new RangeError(
      "annualScheduledWorkingHours must resolve to a whole number of minutes",
    );
  }
  return rounded;
}
