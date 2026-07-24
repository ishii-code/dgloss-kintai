/**
 * @dgloss-kintai/contracts
 *
 * 打刻・勤怠・締めのドメイン型、入力バリデーションスキーマ、ドメインイベント。
 * 全パッケージが依存する唯一の型の源泉。計算ロジックは持たない（@dgloss-kintai/core が担う）。
 */

export type {
  Brand,
  EmployeeId,
  StampId,
  WorkDayId,
  MonthlyClosingId,
  ImprovementRequestId,
  IsoDate,
  IsoDateTime,
  YearMonth,
  Yen,
  Minutes,
} from "./common.js";

export type {
  WorkSystem,
  OfficeDivision,
  EmploymentType,
} from "./workSystem.js";
export { WORK_SYSTEMS, OFFICE_DIVISIONS } from "./workSystem.js";

export type {
  Employee,
  EmploymentContract,
  FixedOvertimeCoverage,
} from "./employee.js";

export type { Stamp, StampInput, StampType, StampSource } from "./stamp.js";
export { STAMP_TYPES } from "./stamp.js";

export type {
  WorkDay,
  DayType,
  LeaveType,
  ClassifiedWorkMinutes,
} from "./attendance.js";

export type {
  MonthlyClosing,
  ClosingStatus,
  WagePremiumBreakdown,
  ShadowComparison,
} from "./closing.js";

export type { Payslip, PayslipLine } from "./payslip.js";

export type {
  DomainEvent,
  StampRegistered,
  DailyAttendanceClosed,
  MonthlyClosingCompleted,
  ShadowComparisonMismatch,
} from "./events.js";

export type {
  ImprovementRequest,
  ImprovementRequestInput,
  ImprovementRequestStatus,
  ImprovementRequestCategory,
  ImprovementRequestInputParsed,
} from "./improvement.js";
export {
  improvementRequestInputSchema,
  IMPROVEMENT_REQUEST_STATUSES,
  IMPROVEMENT_REQUEST_CATEGORIES,
} from "./improvement.js";

export {
  isoDateSchema,
  isoDateTimeSchema,
  yearMonthSchema,
  stampInputSchema,
  classifiedWorkMinutesSchema,
  employmentContractSchema,
} from "./schema.js";
export type {
  StampInputParsed,
  ClassifiedWorkMinutesParsed,
  EmploymentContractParsed,
} from "./schema.js";
