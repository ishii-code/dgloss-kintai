/**
 * @dgloss-kintai/compliance
 *
 * 労働基準法第36条・時間外労働の上限規制を監視し、上限への接近・超過をアラートする。
 * 上限値・警告しきい値は config（{@link ThirtySixAgreementLimits}）で外出しし、
 * 法定値を既定（{@link DEFAULT_36_LIMITS}）とする。未払い・違法検知が目的のため、
 * 上限を 1 分でも超えたら必ず `exceeded` として取りこぼさない。
 */

export type { ThirtySixAgreementLimits } from "./config.js";
export {
  DEFAULT_36_LIMITS,
  thirtySixAgreementLimitsSchema,
  resolveLimits,
} from "./config.js";

export type { MonthlyOvertime } from "./aggregate.js";
export {
  aggregateMonthlyOvertime,
  overtimePlusHoliday,
  monthlyOvertimeSchema,
} from "./aggregate.js";

export type {
  ComplianceLevel,
  ComplianceCheckKind,
  ComplianceUnit,
  AlertPeriod,
  ComplianceAlert,
  ComplianceReport,
} from "./types.js";

export { evaluateCompliance } from "./evaluate.js";
