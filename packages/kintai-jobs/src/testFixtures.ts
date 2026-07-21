/**
 * テスト用フィクスチャビルダ（本番コードからは使わない）。
 * ブランド型は string/number からキャストして組み立てる。
 */

import type {
  ClassifiedWorkMinutes,
  Employee,
  EmployeeId,
  EmploymentContract,
  FixedOvertimeCoverage,
  IsoDate,
  Minutes,
  WorkDay,
  WorkDayId,
  Yen,
} from "@dgloss-kintai/contracts";

const zeroCoverage: FixedOvertimeCoverage = {
  overtime: false,
  overtimeOver60: false,
  holiday: false,
  night: false,
};

const zeroClassified: ClassifiedWorkMinutes = {
  nonStatutoryOvertimeMinutes: 0,
  statutoryOvertimeMinutes: 0,
  legalHolidayMinutes: 0,
  scheduledHolidayMinutes: 0,
  nightMinutes: 0,
};

/** 契約オーバーライド。Yen ブランド項目はテストの利便のため素の number で受ける。 */
export type ContractOverrides = Partial<
  Omit<EmploymentContract, "basicSalary" | "fixedOvertimeAllowance">
> & {
  basicSalary?: number;
  fixedOvertimeAllowance?: number;
};

export function makeContract(
  overrides: ContractOverrides = {},
): EmploymentContract {
  const { basicSalary, fixedOvertimeAllowance, ...rest } = overrides;
  return {
    employmentType: "regular",
    workSystem: "fixed",
    office: "headquarters",
    isManagerialEmployee: false,
    basicSalary: (basicSalary ?? 300000) as Yen,
    annualScheduledWorkingHours: 2000,
    fixedOvertimeAllowance: (fixedOvertimeAllowance ?? 0) as Yen,
    fixedOvertimeCoverage: zeroCoverage,
    ...rest,
  };
}

export function makeEmployee(
  id: string,
  contractOverrides: ContractOverrides = {},
  overrides: Partial<Employee> = {},
): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: `EMP-${id}`,
    name: `従業員 ${id}`,
    email: null,
    hiredOn: "2020-04-01",
    retiredOn: null,
    contract: makeContract(contractOverrides),
    ...overrides,
  };
}

export function makeWorkDay(
  employeeId: string,
  date: string,
  overrides: {
    classified?: Partial<ClassifiedWorkMinutes>;
    actualWorkedMinutes?: number;
    absenceMinutes?: number;
    id?: string;
  } = {},
): WorkDay {
  return {
    id: (overrides.id ?? `${employeeId}-${date}`) as WorkDayId,
    employeeId: employeeId as EmployeeId,
    date: date as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: (overrides.actualWorkedMinutes ?? 480) as Minutes,
    breakMinutes: 60 as Minutes,
    absenceMinutes: (overrides.absenceMinutes ?? 0) as Minutes,
    leave: null,
    classified: { ...zeroClassified, ...overrides.classified },
  };
}
