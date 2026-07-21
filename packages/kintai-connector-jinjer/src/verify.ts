/**
 * Shadow 検証の一気通貫オーケストレーション（Ph2 本命）。
 *
 * 同じ入力（従業員契約・WorkDay[]）を「自作エンジン」と「jinjer」の両方で締め、突合するパイプライン。
 *  - 自作側: 注入した勤怠データソース（port）から WorkDay[] を取り、
 *    {@link runMonthlyClosing}（@dgloss-kintai/jobs）で自作 MonthlyClosing を算定する。
 *  - jinjer 側: {@link JinjerConnector}（transport 注入）で jinjer の月次締めを pull する。
 *  - 両者を {@link compareShadow} で従業員ごとに 1 円単位で突合し、
 *    不一致は {@link toShadowMismatchEvent} でイベント化する。
 *
 * 副作用は「勤怠データソースの読み取り」と「jinjer pull」のみで、いずれも注入で差し替え可能。
 * 実 DB・実ネットワークは本パッケージには含めない（テストはインメモリ源＋スタブ transport）。
 */

import type {
  Employee,
  EmployeeId,
  IsoDateTime,
  ShadowComparison,
  ShadowComparisonMismatch,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";
import { runMonthlyClosing } from "@dgloss-kintai/jobs";
import type { Clock } from "@dgloss-kintai/jobs";
import { systemClock } from "@dgloss-kintai/jobs";

import type { JinjerClosingValue } from "./mappers.js";
import { JinjerConnector } from "./pull.js";
import { compareShadow, toShadowMismatchEvent } from "./shadow.js";

/**
 * 自作側の締めに使う勤怠データソースの境界（port）。
 * 実 DB 実装はアダプタ層の責務であり、本パッケージには置かない（注入する）。
 */
export interface ShadowAttendanceSource {
  /** 当該従業員・当該期間（当月1日〜末日）の WorkDay を返す。期間外・他従業員が混じっていても可。 */
  listWorkDays(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<readonly WorkDay[]>;
}

/** {@link runShadowVerification} の依存注入。 */
export interface ShadowVerificationDeps {
  /** 突合対象の期間（年月）。 */
  readonly period: YearMonth;
  /** 突合対象の従業員群（雇用契約を含む）。 */
  readonly employees: readonly Employee[];
  /** 自作側の勤怠データソース（port 注入）。 */
  readonly attendanceSource: ShadowAttendanceSource;
  /** jinjer 側の連携クライアント（transport 注入済み）。 */
  readonly connector: JinjerConnector;
  /** 締め確定時刻・イベント発生時刻を供給する時計（既定はシステム時計）。 */
  readonly clock?: Clock;
  /** 不一致イベントの発生時刻（省略時は clock.now() を用いる）。 */
  readonly occurredAt?: IsoDateTime;
}

/** jinjer 側に該当締めが無く突合できなかった従業員。 */
export interface ShadowMissingEntry {
  readonly employeeId: EmployeeId;
  readonly period: YearMonth;
}

/**
 * Shadow 検証の集計結果。
 *
 * jinjer を正解データとみなすため、`underpaymentCount`（自作 < jinjer）は **未払いの疑い**として強調する。
 * `hasMismatch` は 1 名でも 1 円でもずれれば true になる。
 */
export interface ShadowVerificationResult {
  readonly period: YearMonth;
  /** 突合を試みた従業員の総件数。 */
  readonly total: number;
  /** 一致した件数。 */
  readonly matchedCount: number;
  /** 突合できたうち不一致だった件数。 */
  readonly mismatchedCount: number;
  /** jinjer 側に締めが無く突合できなかった（該当者なし）件数。 */
  readonly missingCount: number;
  /** 全突合結果（従業員順）。jinjer 欠損者は含まない。 */
  readonly comparisons: readonly ShadowComparison[];
  /** 不一致の明細（matched=false のみ）。 */
  readonly mismatches: readonly ShadowComparison[];
  /** 不一致から生成したドメインイベント。 */
  readonly mismatchEvents: readonly ShadowComparisonMismatch[];
  /** jinjer 側欠損の明細。 */
  readonly missing: readonly ShadowMissingEntry[];
  /** 最大乖離（|premiumDiff| の最大・円）。不一致が無ければ 0。 */
  readonly maxAbsolutePremiumDiff: number;
  /** 未払い方向（自作 < jinjer, premiumDiff < 0）の件数。 */
  readonly underpaymentCount: number;
  /** 過払い方向（自作 > jinjer, premiumDiff > 0）の件数。 */
  readonly overpaymentCount: number;
  /** 1 名でも不一致があれば true。 */
  readonly hasMismatch: boolean;
}

/** jinjer 締め値を従業員 ID で引けるよう索引化する。 */
function indexByEmployee(
  closings: readonly JinjerClosingValue[],
): ReadonlyMap<string, JinjerClosingValue> {
  const map = new Map<string, JinjerClosingValue>();
  for (const closing of closings) {
    map.set(closing.employeeId, closing);
  }
  return map;
}

/**
 * 対象期間・従業員群について、自作締めと jinjer 締めを一気通貫で突合する（Ph2 本命）。
 *
 * 処理の流れ:
 *  1. jinjer から当該期間の月次締めを一括 pull し、従業員 ID で索引化する。
 *  2. 従業員ごとに勤怠データソースから WorkDay[] を取り、{@link runMonthlyClosing} で自作締めを算定。
 *  3. jinjer 側に該当があれば {@link compareShadow} で突合、不一致は {@link toShadowMismatchEvent} でイベント化。
 *  4. 該当が無ければ「jinjer 側欠損」として集計する。
 *
 * @param deps 期間・従業員群・勤怠ソース（port）・jinjer connector・時計
 * @returns 集計済みの {@link ShadowVerificationResult}
 */
export async function runShadowVerification(
  deps: ShadowVerificationDeps,
): Promise<ShadowVerificationResult> {
  const { period, employees, attendanceSource, connector } = deps;
  const clock = deps.clock ?? systemClock;
  const occurredAt =
    deps.occurredAt ?? (clock.now().toISOString() as IsoDateTime);

  // 1. jinjer 側の月次締めを一括 pull して索引化する。
  const jinjerClosings = await connector.pullMonthlyClosings(period);
  const jinjerByEmployee = indexByEmployee(jinjerClosings);

  const comparisons: ShadowComparison[] = [];
  const mismatches: ShadowComparison[] = [];
  const mismatchEvents: ShadowComparisonMismatch[] = [];
  const missing: ShadowMissingEntry[] = [];

  let matchedCount = 0;
  let maxAbsolutePremiumDiff = 0;
  let underpaymentCount = 0;
  let overpaymentCount = 0;

  for (const employee of employees) {
    // 2. 自作側: 勤怠ソースから WorkDay[] を取り自作締めを算定する。
    const workDays = await attendanceSource.listWorkDays(employee.id, period);
    const own = runMonthlyClosing(
      { employee, workDays, period },
      { clock },
    );

    const jinjer = jinjerByEmployee.get(employee.id);
    if (jinjer === undefined) {
      // 4. jinjer 側欠損（該当者なし）。突合できないため別枠で記録する。
      missing.push({ employeeId: employee.id, period });
      continue;
    }

    // 3. 1 円単位で突合する。
    const comparison = compareShadow(own, jinjer);
    comparisons.push(comparison);

    if (comparison.matched) {
      matchedCount += 1;
      continue;
    }

    mismatches.push(comparison);
    const event = toShadowMismatchEvent(comparison, occurredAt);
    if (event !== null) {
      mismatchEvents.push(event);
    }
    const abs = Math.abs(comparison.premiumDiff);
    if (abs > maxAbsolutePremiumDiff) {
      maxAbsolutePremiumDiff = abs;
    }
    if (comparison.premiumDiff < 0) {
      underpaymentCount += 1;
    } else if (comparison.premiumDiff > 0) {
      overpaymentCount += 1;
    }
  }

  const mismatchedCount = mismatches.length;

  return {
    period,
    total: employees.length,
    matchedCount,
    mismatchedCount,
    missingCount: missing.length,
    comparisons,
    mismatches,
    mismatchEvents,
    missing,
    maxAbsolutePremiumDiff,
    underpaymentCount,
    overpaymentCount,
    hasMismatch: mismatchedCount > 0,
  };
}
