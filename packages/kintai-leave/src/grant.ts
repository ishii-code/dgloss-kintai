/**
 * 付与日数の算定（労基法第39条・就業規則第61条）。
 */

import { z } from "zod";
import { DEFAULT_LEAVE_CONFIG, type LeaveConfig } from "./config.js";

const grantDaysForArgsSchema = z.object({
  continuousServiceMonths: z.number().int().nonnegative(),
  attendanceRate: z.number().min(0).max(1),
});

/**
 * 継続勤務月数と出勤率から、その基準日に付与すべき年次有給休暇の日数を返す。
 *
 * - 出勤率が {@link LeaveConfig.attendanceThreshold}（法定=0.8＝8割）未満の
 *   期間は付与0（労基法第39条）。
 * - それ以外は付与テーブルの「`minMonths <= 勤続月数` を満たす最大の行」を採用。
 *   勤続6か月未満（テーブル下限未満）は0。
 *
 * @param continuousServiceMonths 継続勤務月数（例: 6か月ちょうど=6）。
 * @param attendanceRate 当該期間の出勤率（0〜1）。
 * @param config 付与テーブル・しきい値の設定（既定は法定）。
 */
export function grantDaysFor(
  continuousServiceMonths: number,
  attendanceRate: number,
  config: LeaveConfig = DEFAULT_LEAVE_CONFIG,
): number {
  const args = grantDaysForArgsSchema.parse({
    continuousServiceMonths,
    attendanceRate,
  });
  if (args.attendanceRate < config.attendanceThreshold) return 0;

  let days = 0;
  let matchedMonths = -1;
  for (const row of config.grantTable) {
    if (
      args.continuousServiceMonths >= row.minMonths &&
      row.minMonths > matchedMonths
    ) {
      matchedMonths = row.minMonths;
      days = row.days;
    }
  }
  return days;
}
