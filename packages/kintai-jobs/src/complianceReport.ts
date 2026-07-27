/**
 * 36協定・時間外労働上限の監視レポート組み立て（労働基準法第36条）。
 *
 * 既存の月次締め（MonthlyClosing.classified）から、対象期間（36協定年度）の
 * 月次時間外・休日労働を集計し、上限規制の評価を行う純粋関数。
 * 集計・判定は @dgloss-kintai/compliance のエンジンに委譲する。
 */

import {
  aggregateMonthlyOvertime,
  evaluateCompliance,
  type ComplianceReport,
  type MonthlyOvertime,
  type ThirtySixAgreementLimits,
} from "@dgloss-kintai/compliance";
import type { MonthlyClosing } from "@dgloss-kintai/contracts";

/** 36協定監視レポートの結果。 */
export interface ComplianceReportResult {
  /** 上限規制の評価結果（各チェックのアラート・最悪レベル・違反有無）。 */
  readonly report: ComplianceReport;
  /** 評価に用いた月次の時間外・休日労働（月昇順ではなく入力順）。 */
  readonly monthly: readonly MonthlyOvertime[];
}

/**
 * 月次締めの系列（同一 36協定年度内）から上限規制レポートを組み立てる。純粋関数。
 *
 * @param closings 対象期間の月次締め（各月の区分別労働時間を持つ）
 * @param limits   上限設定（省略時は法定既定）
 */
export function buildComplianceReport(
  closings: readonly MonthlyClosing[],
  limits?: ThirtySixAgreementLimits,
): ComplianceReportResult {
  const monthly: MonthlyOvertime[] = closings.map((c) =>
    aggregateMonthlyOvertime(c.period, [c.classified]),
  );
  const report =
    limits !== undefined
      ? evaluateCompliance(monthly, limits)
      : evaluateCompliance(monthly);
  return { report, monthly };
}
