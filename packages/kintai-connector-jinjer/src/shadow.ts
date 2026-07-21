/**
 * Shadow Mode 突合（Ph2・本命）。
 *
 * 同じ打刻を自作エンジンと jinjer 両方で締め、割増・総労働時間を **1円=整数単位**で突き合わせる。
 * jinjer を「正解データ」とした回帰テストであり、差が出れば賃金誤り（特に未払い）の疑い。
 * すべて純粋関数で、副作用も I/O も持たない。
 */

import type {
  MonthlyClosing,
  ShadowComparison,
  ShadowComparisonMismatch,
} from "@dgloss-kintai/contracts";
import type { IsoDateTime } from "@dgloss-kintai/contracts";

import type { JinjerClosingValue } from "./mappers.js";

/** 突合対象の従業員・期間が一致しない場合のエラー。 */
export class ShadowComparisonMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShadowComparisonMismatchError";
  }
}

/**
 * 自作の月次締めと jinjer 締めを 1 円単位で突合する。
 *
 * - `premiumDiff` = 自作割増合計 − jinjer 割増合計（円・整数）。
 * - `workedMinutesDiff` = 自作総労働時間 − jinjer 総労働時間（分・整数）。
 * - `matched` は両差が 0 のときのみ true（1 円でもずれれば不一致）。
 *
 * 従業員 ID・期間が食い違う入力は取り違えなので例外にする。
 *
 * @throws {ShadowComparisonMismatchError} employeeId または period が一致しないとき
 */
export function compareShadow(
  own: MonthlyClosing,
  jinjer: JinjerClosingValue,
): ShadowComparison {
  if (own.employeeId !== jinjer.employeeId) {
    throw new ShadowComparisonMismatchError(
      `従業員 ID が一致しません: own=${own.employeeId} jinjer=${jinjer.employeeId}`,
    );
  }
  if (
    own.period.year !== jinjer.period.year ||
    own.period.month !== jinjer.period.month
  ) {
    throw new ShadowComparisonMismatchError(
      `対象期間が一致しません: own=${own.period.year}-${own.period.month} ` +
        `jinjer=${jinjer.period.year}-${jinjer.period.month}`,
    );
  }

  const premiumDiff = own.premium.total - jinjer.premiumTotal;
  const workedMinutesDiff = own.totalWorkedMinutes - jinjer.totalWorkedMinutes;

  return {
    employeeId: own.employeeId,
    period: own.period,
    ownPremiumTotal: own.premium.total,
    jinjerPremiumTotal: jinjer.premiumTotal,
    premiumDiff,
    workedMinutesDiff,
    matched: premiumDiff === 0 && workedMinutesDiff === 0,
  };
}

/**
 * 不一致を検出したときにドメインイベントへ変換する。一致していれば null。
 *
 * @param comparison compareShadow の結果
 * @param occurredAt イベント発生時刻（RFC3339）
 */
export function toShadowMismatchEvent(
  comparison: ShadowComparison,
  occurredAt: IsoDateTime,
): ShadowComparisonMismatch | null {
  if (comparison.matched) return null;
  return {
    type: "shadow.mismatch",
    occurredAt,
    employeeId: comparison.employeeId,
    period: comparison.period,
    premiumDiff: comparison.premiumDiff,
  };
}

/**
 * 未払いリスクの警告文を生成する（不一致かつ自作 < jinjer のとき）。
 *
 * jinjer を正解とみなすため、自作の割増合計が jinjer を下回るケースは **支給不足＝未払い**の疑い。
 * 逆（自作 > jinjer）は過払い方向なので別文言で通知する。一致時は null。
 */
export function describeShadowRisk(comparison: ShadowComparison): string | null {
  if (comparison.matched) return null;
  const { employeeId, period, premiumDiff, workedMinutesDiff } = comparison;
  const ym = `${period.year}-${String(period.month).padStart(2, "0")}`;
  if (premiumDiff < 0) {
    return (
      `[未払いリスク] ${employeeId} ${ym}: 自作割増が jinjer より ${-premiumDiff} 円少ない` +
      `（労働時間差 ${workedMinutesDiff} 分）。要確認。`
    );
  }
  if (premiumDiff > 0) {
    return (
      `[過払いリスク] ${employeeId} ${ym}: 自作割増が jinjer より ${premiumDiff} 円多い` +
      `（労働時間差 ${workedMinutesDiff} 分）。要確認。`
    );
  }
  return (
    `[要確認] ${employeeId} ${ym}: 割増は一致するが総労働時間が ${workedMinutesDiff} 分ずれている。`
  );
}
