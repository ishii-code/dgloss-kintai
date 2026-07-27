/**
 * ユースケース: 36協定・時間外労働上限の監視レポート取得（労基法第36条）。
 *
 * 従業員・36協定年度の起点年月から連続する12か月の月次締めを収集し、
 * 上限規制を評価する。評価は @dgloss-kintai/jobs の buildComplianceReport
 * （純粋関数）に委譲する。締めが存在しない月は評価対象から除く（時間外0の月は
 * そもそも締めがあれば0で入るため、欠測＝未締めとして扱う）。
 */

import type { EmployeeId, MonthlyClosing, YearMonth } from "@dgloss-kintai/contracts";
import {
  buildComplianceReport,
  type ComplianceReportResult,
} from "@dgloss-kintai/jobs";
import type {
  EmployeeRepository,
  MonthlyClosingRepository,
} from "./ports.js";
import { complianceQuerySchema } from "./schema.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** getComplianceReport の依存。 */
export interface GetComplianceReportDeps {
  readonly employees: EmployeeRepository;
  readonly closings: MonthlyClosingRepository;
}

/** 起点年月から i か月後の年月を求める（1-12 正規化）。 */
function addMonth(year: number, startMonth: number, i: number): YearMonth {
  const zeroBased = startMonth - 1 + i;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
  };
}

/** レポート結果に対象年度の起点も添える。 */
export interface ComplianceReportResponse extends ComplianceReportResult {
  readonly year: number;
  readonly startMonth: number;
}

/**
 * 従業員・年度で 36協定コンプライアンスレポートを取得する。
 *
 * @param query 照会クエリ（未検証。employeeId・year・startMonth?）
 * @param deps  リポジトリ port
 */
export async function getComplianceReport(
  query: unknown,
  deps: GetComplianceReportDeps,
): Promise<Result<ComplianceReportResponse>> {
  const parsed = complianceQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "照会条件が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const startMonth = parsed.data.startMonth ?? 4;

  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`));
  }

  // 年度内の12か月分の締めを収集する（未締めの月はスキップ）。
  const closings: MonthlyClosing[] = [];
  for (let i = 0; i < 12; i += 1) {
    const period = addMonth(parsed.data.year, startMonth, i);
    const closing = await deps.closings.findByEmployeeAndPeriod(
      employeeId,
      period,
    );
    if (closing !== null) {
      closings.push(closing);
    }
  }

  const result = buildComplianceReport(closings);
  return ok({ ...result, year: parsed.data.year, startMonth });
}
