/**
 * 事業場外みなし労働（就業規則第50条・第72条 / 労働基準法第38条の2）。
 *
 * 出張・テレワーク・営業などで労働者が事業場外で業務に従事し、労働時間を算定し難いときは、
 * 原則として「所定労働時間労働したもの」とみなす（就業規則第50条）。第72条（在宅勤務等）も
 * 同じ枠組みで、みなし時間の算定を本関数に集約する。
 *
 * みなし時間 D の決定:
 *  - 既定は D = 所定労働時間 scheduledMinutes（第50条本文の原則）。
 *  - 当該業務を遂行するために通常所定労働時間を超えて労働することが必要な場合、労使協定で
 *    みなし時間を所定超に定めることができる（労基法第38条の2第1項但書・第2項）。その場合は
 *    `options.deemedMinutes` で D を上書きする（D > 所定 のときのみ時間外が発生しうる）。
 *
 * 区分の確定（D をその日の実労働とみなして日次の時間外分割と同じ規則で振り分ける）:
 *  - statutoryOvertimeMinutes    = max(0, D − 法定 8h)              （法定外）
 *  - nonStatutoryOvertimeMinutes = max(0, min(D, 8h) − 所定)        （所定超・法定内残業）
 *  原則（D = 所定）では両者とも 0、すなわち時間外は発生せず基準内給与に含まれる。
 *
 * 深夜・休日の扱い（行政通達 平11.3.31 基発168 の趣旨）:
 *  みなし労働時間制が適用されるのは「労働時間を算定し難い」通常の労働に限られ、
 *  深夜(22:00-5:00)・休日の労働が明確に把握できる場合は、みなしとは別に実績に基づき
 *  割増（深夜 0.25 等）を支払う必要がある。本関数はみなし時間そのものからは深夜を推定せず、
 *  深夜勤務が明確な場合はその実績分を `options.nightMinutes` として受け取り nightMinutes に
 *  計上する（既定 0）。休日労働が明確な場合は本関数を用いず、休日区分（legalHoliday /
 *  scheduledHoliday）として日次判定へ回すこと。
 */

import type { ClassifiedWorkMinutes } from "../types.js";
import { assertNonNegativeInteger } from "../attendance/validate.js";

/**
 * 事業場外みなし労働の 1 日分の寄与（分・整数）。
 * 構造は `ClassifiedWorkMinutes` と同一で、`aggregateMonthly` や `calculateWagePremium` に
 * そのまま合算・投入できる。命名のみ「1 日分の寄与」であることを表す別名。
 */
export type ClassifiedTimeContribution = ClassifiedWorkMinutes;

/** 法定労働時間（分）。8h = 480 分。 */
export const DAILY_STATUTORY_MINUTES = 480;

/** 事業場外みなし労働のオプション。 */
export interface DeemedWorkOptions {
  /**
   * みなし時間 D（分・非負整数）。労使協定で所定超に定めた場合に上書きする。
   * 省略時は所定労働時間 scheduledMinutes をみなし時間とする（第50条本文の原則）。
   */
  readonly deemedMinutes?: number;
  /**
   * 深夜勤務が明確に把握できる場合の実績深夜労働時間（分・非負整数）。既定 0。
   * みなし時間からは深夜を推定せず、明確な実績のみを深夜割増の対象として計上する。
   */
  readonly nightMinutes?: number;
  /**
   * 法定内／法定外の境界（分）。既定 480（8h）。
   * 変形労働時間制の特定日など、拡張時のフックとして上書き可能。
   */
  readonly statutoryThresholdMinutes?: number;
}

/**
 * 事業場外みなし労働の 1 日分を区分別労働時間（分）に変換する。
 *
 * 実労働時間に関わらず、みなし時間（既定＝所定労働時間）を計上する。原則として時間外は 0。
 * みなし時間が所定・法定 8h を超える設定の場合のみ、超過分を時間外へ振り分ける。
 *
 * @param scheduledMinutes 所定労働時間 S（分・非負整数）
 * @param options みなし時間の上書き・明確な深夜実績・法定境界
 * @returns 割増計算エンジンに渡せる区分別労働時間（`ClassifiedWorkMinutes` と構造同一）
 */
export function deemedWorkMinutes(
  scheduledMinutes: number,
  options: DeemedWorkOptions = {},
): ClassifiedTimeContribution {
  assertNonNegativeInteger(scheduledMinutes, "scheduledMinutes");

  const deemed = options.deemedMinutes ?? scheduledMinutes;
  const nightMinutes = options.nightMinutes ?? 0;
  const threshold =
    options.statutoryThresholdMinutes ?? DAILY_STATUTORY_MINUTES;

  assertNonNegativeInteger(deemed, "deemedMinutes");
  assertNonNegativeInteger(nightMinutes, "nightMinutes");
  assertNonNegativeInteger(threshold, "statutoryThresholdMinutes");

  // みなし時間 D をその日の実労働とみなし、日次の時間外分割と同じ規則で振り分ける。
  const statutoryOvertimeMinutes = Math.max(0, deemed - threshold);
  const nonStatutoryOvertimeMinutes = Math.max(
    0,
    Math.min(deemed, threshold) - scheduledMinutes,
  );

  return {
    nonStatutoryOvertimeMinutes,
    statutoryOvertimeMinutes,
    legalHolidayMinutes: 0,
    scheduledHolidayMinutes: 0,
    nightMinutes,
  };
}
