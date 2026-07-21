/**
 * @dgloss-kintai/leave
 *
 * 年次有給休暇の付与・消化・繰越エンジン（就業規則第61条・労基法第39条）。
 * 純粋関数で残高を算出し、計算ロジックはこのパッケージに閉じる。
 */

export type { GrantTableRow, LeaveConfig } from "./config.js";
export {
  DEFAULT_LEAVE_CONFIG,
  LEGAL_GRANT_TABLE,
  grantTableRowSchema,
  leaveConfigSchema,
  resolveLeaveConfig,
} from "./config.js";

export { addYears, compareIso, isoDateSchema, toIsoDate } from "./dates.js";

export { grantDaysFor } from "./grant.js";

export type {
  ProportionalGrantTableRow,
  ProportionalLeaveConfig,
  ScheduleGrantConfig,
  WorkSchedule,
} from "./proportional.js";
export {
  DEFAULT_PROPORTIONAL_LEAVE_CONFIG,
  LEGAL_PROPORTIONAL_GRANT_TABLE,
  PROPORTIONAL_ELIGIBILITY,
  grantDaysForSchedule,
  proportionalGrantDaysFor,
  proportionalGrantTableRowSchema,
  proportionalLeaveConfigSchema,
  resolveProportionalLeaveConfig,
  scheduleSchema,
  weeklyEquivalentFromAnnualDays,
} from "./proportional.js";

export type {
  CurrentYearSummary,
  FiveDayObligationStatus,
  LeaveBalance,
  LeaveBucketState,
  LeaveGrant,
  LeaveTransaction,
} from "./balance.js";
export {
  computeBalance,
  fiveDayObligationStatus,
  leaveTransactionSchema,
  leaveTransactionsSchema,
} from "./balance.js";
