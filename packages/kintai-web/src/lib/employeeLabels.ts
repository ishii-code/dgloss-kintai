/**
 * 従業員の区分 enum → 日本語ラベル（クライアント表示用）。
 *
 * CSV 変換の変換表は @dgloss-kintai/api（employeeCsv）が持つが、画面表示のために
 * ここでも同じ対応を軽量な純粋データとして持つ（api 全体をクライアントへ取り込まないため）。
 * enum 型は contracts を参照するので、区分値が増減すれば型エラーで気づける。
 */

import type {
  EmploymentType,
  OfficeDivision,
  WorkSystem,
} from "@dgloss-kintai/contracts";
import { OFFICE_DIVISIONS, WORK_SYSTEMS } from "@dgloss-kintai/contracts";

/** 雇用区分ラベル。 */
export const EMPLOYMENT_TYPE_LABEL: Readonly<Record<EmploymentType, string>> = {
  regular: "正社員",
  non_regular: "非正規",
};

/** 勤務体系ラベル。 */
export const WORK_SYSTEM_LABEL: Readonly<Record<WorkSystem, string>> = {
  fixed: "固定時間制",
  flex: "フレックスタイム制",
  shift: "シフト制",
  discretionary: "裁量労働制",
};

/** 所属区分ラベル。 */
export const OFFICE_LABEL: Readonly<Record<OfficeDivision, string>> = {
  headquarters: "本社",
  corporate_sales: "法人営業",
  personal_sales: "個人営業",
};

/** 雇用区分の全値（セレクト選択肢用・順序固定）。 */
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "regular",
  "non_regular",
];

/** 勤務体系の全値（セレクト選択肢用）。 */
export const WORK_SYSTEM_OPTIONS: readonly WorkSystem[] = WORK_SYSTEMS;

/** 所属区分の全値（セレクト選択肢用）。 */
export const OFFICE_OPTIONS: readonly OfficeDivision[] = OFFICE_DIVISIONS;
