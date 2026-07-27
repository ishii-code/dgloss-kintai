/**
 * @dgloss-kintai/jobs
 *
 * 締めバッチ。月次締め（賃金規程第6条: 当月1日〜末日）のオーケストレーション。
 * 計算は @dgloss-kintai/core、型は @dgloss-kintai/contracts に依存し、
 * データアクセスは port（interface）として注入する（実 DB 実装は持たない）。
 */

export {
  runMonthlyClosing,
  type MonthlyClosingInput,
  type MonthlyClosingOptions,
} from "./monthlyClosing.js";

export {
  runMonthlyClosingBatch,
  runMonthlyClosingJob,
  type WorkDaysByEmployee,
  type BatchOptions,
  type MonthlyClosingJobDeps,
} from "./batch.js";

export {
  summarizeMonthlyAttendance,
  selectWorkDaysForPeriod,
  type MonthlyAttendanceSummary,
} from "./summarize.js";

export {
  systemClock,
  fixedClock,
  type Clock,
  type EmployeeDirectoryPort,
  type WorkDaySourcePort,
  type MonthlyClosingSinkPort,
} from "./ports.js";

export {
  toPayrollCsvRow,
  serializePayrollCsv,
  buildPayrollCsv,
  PAYROLL_CSV_COLUMNS,
  type PayrollCsvRow,
  type PayrollCsvColumn,
  type PayrollColumnKind,
  type PayrollCsvOptions,
  type CsvNewline,
  type TimeFormat,
} from "./payrollCsv.js";

// 給与明細（総支給まで・第20/21条）。所得税・社保は外部連携（未計上）。
export {
  buildPayslip,
  type BuildPayslipOptions,
} from "./payslip.js";

// 年次有給休暇の残高（労基法第39条）。既存データ（入社日・勤怠の休暇区分）から算定。
export {
  buildLeaveBalance,
  addMonths,
  type LeaveBalanceResult,
} from "./leaveBalance.js";
// 下流（api・web）が型を単一経路で参照できるよう leave の型を再輸出する。
export type {
  LeaveBalance,
  LeaveBucketState,
  LeaveGrant,
  CurrentYearSummary,
  FiveDayObligationStatus,
} from "@dgloss-kintai/leave";

// 36協定・時間外労働上限の監視（労基法第36条）。月次締めから評価する。
export {
  buildComplianceReport,
  type ComplianceReportResult,
} from "./complianceReport.js";
export type {
  ComplianceReport,
  ComplianceAlert,
  ComplianceLevel,
  ComplianceCheckKind,
  ComplianceUnit,
  AlertPeriod,
  MonthlyOvertime,
  ThirtySixAgreementLimits,
} from "@dgloss-kintai/compliance";

// jinjer からの移行（Ph0）。取得元（source）・書き込み先（sink）は port 注入。
// 実 DB 実装・実ネットワークは持たない（batch.ts と同じ方針）。
export {
  migrateEmployees,
  migrateStamps,
  migrateAttendance,
  type EmployeeSink,
  type StampSink,
  type WorkDaySink,
  type EmployeeSource,
  type StampSource,
  type AttendanceSource,
  type MigrateEmployeesDeps,
  type MigrateStampsDeps,
  type MigrateAttendanceDeps,
  type MigrationResult,
  type MigrationFailure,
} from "./migration/migrate.js";
