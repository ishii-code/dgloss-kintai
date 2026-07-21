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
