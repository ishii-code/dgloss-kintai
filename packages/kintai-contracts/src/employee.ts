/**
 * 従業員マスタと雇用契約。jinjer からの移行対象（Ph0）でもある。
 * 計算に関わる設定値（年間所定労働時間・固定残業・管理監督者区分）はここに持つ。
 */

import type { EmployeeId, Yen } from "./common.js";
import type {
  EmploymentType,
  OfficeDivision,
  WorkSystem,
} from "./workSystem.js";

/**
 * 固定時間外勤務手当（みなし残業）の充当対象区分（賃金規程第18条2項）。
 * 計算ロジックは @dgloss-kintai/core の settleWithFixedOvertime が担う。
 */
export interface FixedOvertimeCoverage {
  readonly overtime: boolean;
  readonly overtimeOver60: boolean;
  readonly holiday: boolean;
  readonly night: boolean;
}

/** 雇用契約（従業員ごと・改定で履歴になりうるが現バージョンは最新のみ）。 */
export interface EmploymentContract {
  readonly employmentType: EmploymentType;
  readonly workSystem: WorkSystem;
  readonly office: OfficeDivision;
  /** 労働基準法第41条2号該当（管理監督者）。true なら深夜のみ割増支給（賃金規程第20条3項4号）。 */
  readonly isManagerialEmployee: boolean;
  /** 基本給（月額・円）。 */
  readonly basicSalary: Yen;
  /** 当該年度の年間所定労働時間（時間）。月間平均所定 = ÷12。 */
  readonly annualScheduledWorkingHours: number;
  /** 固定時間外勤務手当の月額（円）。0 または未設定で固定残業なし。 */
  readonly fixedOvertimeAllowance: Yen;
  /** 固定残業が充当する区分。fixedOvertimeAllowance > 0 のとき有効。 */
  readonly fixedOvertimeCoverage: FixedOvertimeCoverage;
}

/** 従業員マスタ。 */
export interface Employee {
  readonly id: EmployeeId;
  /** 社員番号（jinjer 連携キー）。 */
  readonly employeeCode: string;
  readonly name: string;
  readonly email: string | null;
  /** 入社日。 */
  readonly hiredOn: string;
  /** 退職日（在籍中は null）。 */
  readonly retiredOn: string | null;
  readonly contract: EmploymentContract;
}
