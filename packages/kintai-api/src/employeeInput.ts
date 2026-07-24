/**
 * 従業員入力スキーマとドメイン組み立て（作成・更新・CSV 取込で共有）。
 *
 * contracts の {@link employmentContractSchema} を土台に、従業員本体（社員番号・氏名・
 * メール・入社日・退職日）を加えた入力を zod で検証する。区分 enum は文字列リテラルと
 * 一致するため、ブランド境界でのみ `as` キャストしてドメイン型へ写す。
 */

import { z } from "zod";
import {
  employmentContractSchema,
  isoDateSchema,
} from "@dgloss-kintai/contracts";
import type {
  EmploymentContract,
  EmploymentType,
  OfficeDivision,
  WorkSystem,
  Yen,
} from "@dgloss-kintai/contracts";

/**
 * 従業員の作成・更新に共通する入力スキーマ（id を持たない本体）。
 * email・retiredOn は任意（未指定・null は在籍中／メール無しを表す）。
 */
export const employeeInputSchema = z.object({
  employeeCode: z.string().min(1, "社員番号は必須です"),
  name: z.string().min(1, "氏名は必須です"),
  email: z.string().email("メールの形式が不正です").nullish(),
  hiredOn: isoDateSchema,
  retiredOn: isoDateSchema.nullish(),
  contract: employmentContractSchema,
});

/** 検証済みの従業員入力（本体・id なし）。 */
export type EmployeeInputParsed = z.infer<typeof employeeInputSchema>;

/** 更新入力スキーマ（id 必須）。 */
export const employeeUpdateInputSchema = employeeInputSchema.extend({
  id: z.string().min(1, "id は必須です"),
});

/** 検証済みの従業員更新入力。 */
export type EmployeeUpdateInputParsed = z.infer<typeof employeeUpdateInputSchema>;

/**
 * 検証済みの契約入力（区分は string 推論）をドメイン契約へ写す。
 * ブランド型・区分 enum はこの境界でのみキャストする。
 */
export function contractFromParsed(
  contract: EmployeeInputParsed["contract"],
): EmploymentContract {
  return {
    employmentType: contract.employmentType as EmploymentType,
    workSystem: contract.workSystem as WorkSystem,
    office: contract.office as OfficeDivision,
    isManagerialEmployee: contract.isManagerialEmployee,
    basicSalary: contract.basicSalary as Yen,
    annualScheduledWorkingHours: contract.annualScheduledWorkingHours,
    fixedOvertimeAllowance: contract.fixedOvertimeAllowance as Yen,
    fixedOvertimeCoverage: contract.fixedOvertimeCoverage,
  };
}
