/**
 * DTO → contracts 型のマッパー（純粋関数）。
 *
 * すべて副作用のない純粋関数として実装し、フィクスチャでテストできるようにする。
 * jinjer のコード体系（勤務体系・打刻種別・日区分・休暇種別・雇用区分）は**想定の変換表**で
 * contracts の列挙に写像する。未知コードは黙って捨てず {@link JinjerMappingError} で失敗させる
 * （移行時の取りこぼし＝賃金誤りに直結するため）。
 */

import type {
  Employee,
  EmploymentContract,
  FixedOvertimeCoverage,
  Stamp,
  StampType,
  WorkDay,
  DayType,
  LeaveType,
  ClassifiedWorkMinutes,
  WagePremiumBreakdown,
} from "@dgloss-kintai/contracts";
import type {
  EmployeeId,
  StampId,
  WorkDayId,
  IsoDate,
  IsoDateTime,
  Yen,
  Minutes,
} from "@dgloss-kintai/contracts";
import type {
  EmploymentType,
  WorkSystem,
  OfficeDivision,
} from "@dgloss-kintai/contracts";

import type {
  JinjerEmployeeDto,
  JinjerStampDto,
  JinjerDailyAttendanceDto,
  JinjerClassifiedMinutesDto,
  JinjerMonthlyClosingDto,
  JinjerAllowancesDto,
} from "./dto.js";

/** マッピング不能（未知コード等）を表すエラー。 */
export class JinjerMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JinjerMappingError";
  }
}

// --- ブランド型ヘルパー（実体は素の値。取り違えをコンパイル時に防ぐためだけの as） ---
const asEmployeeId = (s: string): EmployeeId => s as EmployeeId;
const asStampId = (s: string): StampId => s as StampId;
const asWorkDayId = (s: string): WorkDayId => s as WorkDayId;
const asIsoDate = (s: string): IsoDate => s as IsoDate;
const asIsoDateTime = (s: string): IsoDateTime => s as IsoDateTime;
const asYen = (n: number): Yen => n as Yen;
const asMinutes = (n: number): Minutes => n as Minutes;

// --- コード変換表（想定。実仕様判明時に差し替える） ---

const EMPLOYMENT_TYPE_MAP: Readonly<Record<string, EmploymentType>> = {
  "1": "regular",
  regular: "regular",
  "2": "non_regular",
  non_regular: "non_regular",
};

const WORK_SYSTEM_MAP: Readonly<Record<string, WorkSystem>> = {
  "1": "fixed",
  fixed: "fixed",
  "2": "flex",
  flex: "flex",
  "3": "shift",
  shift: "shift",
  "4": "discretionary",
  discretionary: "discretionary",
};

const OFFICE_DIVISION_MAP: Readonly<Record<string, OfficeDivision>> = {
  "1": "headquarters",
  headquarters: "headquarters",
  "2": "corporate_sales",
  corporate_sales: "corporate_sales",
  "3": "personal_sales",
  personal_sales: "personal_sales",
};

const STAMP_TYPE_MAP: Readonly<Record<string, StampType>> = {
  "1": "clock_in",
  clock_in: "clock_in",
  "2": "clock_out",
  clock_out: "clock_out",
  "3": "break_start",
  break_start: "break_start",
  "4": "break_end",
  break_end: "break_end",
  "5": "entry",
  entry: "entry",
  "6": "exit",
  exit: "exit",
  "7": "pc_login",
  pc_login: "pc_login",
  "8": "pc_logout",
  pc_logout: "pc_logout",
};

const DAY_TYPE_MAP: Readonly<Record<string, DayType>> = {
  "1": "workday",
  workday: "workday",
  "2": "legal_holiday",
  legal_holiday: "legal_holiday",
  "3": "scheduled_holiday",
  scheduled_holiday: "scheduled_holiday",
};

const LEAVE_TYPE_MAP: Readonly<Record<string, LeaveType>> = {
  paid_full: "paid_full",
  paid_half: "paid_half",
  special: "special",
  compensatory: "compensatory",
  absence: "absence",
};

function lookup<T>(
  table: Readonly<Record<string, T>>,
  code: string,
  kind: string,
): T {
  const value = table[code];
  if (value === undefined) {
    throw new JinjerMappingError(`未知の${kind}コード: ${JSON.stringify(code)}`);
  }
  return value;
}

/** 区分別労働時間 DTO → contracts。 */
export function mapClassifiedMinutes(
  dto: JinjerClassifiedMinutesDto,
): ClassifiedWorkMinutes {
  return {
    nonStatutoryOvertimeMinutes: dto.non_statutory_overtime_minutes,
    statutoryOvertimeMinutes: dto.statutory_overtime_minutes,
    legalHolidayMinutes: dto.legal_holiday_minutes,
    scheduledHolidayMinutes: dto.scheduled_holiday_minutes,
    nightMinutes: dto.night_minutes,
  };
}

/** 固定残業充当区分 DTO → contracts。 */
function mapFixedOvertimeCoverage(
  dto: JinjerEmployeeDto["fixed_overtime_coverage"],
): FixedOvertimeCoverage {
  return {
    overtime: dto.overtime,
    overtimeOver60: dto.overtime_over60,
    holiday: dto.holiday,
    night: dto.night,
  };
}

/** 従業員 DTO → contracts.Employee（契約情報込み）。 */
export function mapEmployee(dto: JinjerEmployeeDto): Employee {
  const contract: EmploymentContract = {
    employmentType: lookup(EMPLOYMENT_TYPE_MAP, dto.employment_type, "雇用区分"),
    workSystem: lookup(WORK_SYSTEM_MAP, dto.work_system, "勤務体系"),
    office: lookup(OFFICE_DIVISION_MAP, dto.office_division, "所属区分"),
    isManagerialEmployee: dto.is_managerial,
    basicSalary: asYen(dto.basic_salary),
    annualScheduledWorkingHours: dto.annual_scheduled_working_hours,
    fixedOvertimeAllowance: asYen(dto.fixed_overtime_allowance),
    fixedOvertimeCoverage: mapFixedOvertimeCoverage(dto.fixed_overtime_coverage),
  };

  return {
    id: asEmployeeId(dto.staff_code),
    employeeCode: dto.staff_code,
    name: `${dto.last_name} ${dto.first_name}`.trim(),
    email: dto.email ?? null,
    hiredOn: dto.hire_date,
    retiredOn: dto.resignation_date ?? null,
    contract,
  };
}

/**
 * 打刻 DTO → contracts.Stamp。
 * jinjer 打刻に安定 ID が無い想定のため、`jinjer:{社員番号}:{時刻}:{種別}` で決定的に合成する。
 */
export function mapStamp(dto: JinjerStampDto): Stamp {
  const type = lookup(STAMP_TYPE_MAP, dto.stamp_type, "打刻種別");
  const id = `jinjer:${dto.staff_code}:${dto.stamped_at}:${type}`;
  return {
    id: asStampId(id),
    employeeId: asEmployeeId(dto.staff_code),
    type,
    stampedAt: asIsoDateTime(dto.stamped_at),
    source: "jinjer_api",
    note: dto.note ?? null,
  };
}

/**
 * 日次勤怠 DTO → contracts.WorkDay。
 * WorkDayId は `jinjer:{社員番号}:{日付}` で決定的に合成する。
 */
export function mapWorkDay(dto: JinjerDailyAttendanceDto): WorkDay {
  const leave: LeaveType | null =
    dto.leave_type != null ? lookup(LEAVE_TYPE_MAP, dto.leave_type, "休暇種別") : null;
  return {
    id: asWorkDayId(`jinjer:${dto.staff_code}:${dto.work_date}`),
    employeeId: asEmployeeId(dto.staff_code),
    date: asIsoDate(dto.work_date),
    dayType: lookup(DAY_TYPE_MAP, dto.day_type, "日区分"),
    scheduledStart: dto.scheduled_start ?? null,
    scheduledEnd: dto.scheduled_end ?? null,
    actualWorkedMinutes: asMinutes(dto.actual_worked_minutes),
    breakMinutes: asMinutes(dto.break_minutes),
    absenceMinutes: asMinutes(dto.absence_minutes),
    leave,
    classified: mapClassifiedMinutes(dto.classified),
  };
}

/** jinjer 割増賃金 DTO → contracts.WagePremiumBreakdown（total は加算で確定）。 */
export function mapAllowances(dto: JinjerAllowancesDto): WagePremiumBreakdown {
  const total =
    dto.overtime_allowance +
    dto.overtime_over60_allowance +
    dto.holiday_allowance +
    dto.night_allowance;
  return {
    overtimeAllowance: asYen(dto.overtime_allowance),
    overtimeOver60Allowance: asYen(dto.overtime_over60_allowance),
    holidayAllowance: asYen(dto.holiday_allowance),
    nightAllowance: asYen(dto.night_allowance),
    total: asYen(total),
  };
}

/**
 * Shadow Mode の突合に使う jinjer 締めの値。
 * jinjer が算定した割増合計・総労働時間・区分別労働時間・手当内訳を保持する。
 */
export interface JinjerClosingValue {
  readonly employeeId: EmployeeId;
  readonly period: { readonly year: number; readonly month: number };
  /** jinjer 側の割増合計（円）。 */
  readonly premiumTotal: Yen;
  /** jinjer 側の総労働時間（分）。 */
  readonly totalWorkedMinutes: Minutes;
  /** jinjer 側の手当内訳。 */
  readonly premium: WagePremiumBreakdown;
  /** jinjer 側の区分別労働時間。 */
  readonly classified: ClassifiedWorkMinutes;
}

/** 月次締め DTO → Shadow 突合用の値。 */
export function mapMonthlyClosing(dto: JinjerMonthlyClosingDto): JinjerClosingValue {
  const premium = mapAllowances(dto.allowances);
  return {
    employeeId: asEmployeeId(dto.staff_code),
    period: { year: dto.year, month: dto.month },
    premiumTotal: premium.total,
    totalWorkedMinutes: asMinutes(dto.total_working_minutes),
    premium,
    classified: mapClassifiedMinutes(dto.classified),
  };
}
