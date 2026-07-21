/**
 * 勤務体系（就業規則第48条ほか）。全勤務体系に対応する。
 */

/**
 * 勤務体系。
 * - fixed         固定時間制（本社 9-18/10-19、法人営業、休憩12-13）
 * - flex          フレックスタイム制（清算期間1か月・起算日毎月1日・コアタイム11-16）
 * - shift         シフト制（個人営業 9-21間シフト8h・前月末シフト提示）
 * - discretionary 裁量労働制（事業場外みなし含む・第50条/72条）
 */
export type WorkSystem = "fixed" | "flex" | "shift" | "discretionary";

export const WORK_SYSTEMS: readonly WorkSystem[] = [
  "fixed",
  "flex",
  "shift",
  "discretionary",
] as const;

/**
 * 所属区分。法定休日の割当や所定労働時間帯に影響する（就業規則第48条・第51条）。
 * - headquarters   本社（9-18 or 10-19、法定休日=日曜）
 * - corporate_sales 法人営業（9-18, 9:30-18:30, 10-19）
 * - personal_sales  個人営業（9-21間シフト8h、法定休日=日曜起算週の最終1日）
 */
export type OfficeDivision =
  | "headquarters"
  | "corporate_sales"
  | "personal_sales";

export const OFFICE_DIVISIONS: readonly OfficeDivision[] = [
  "headquarters",
  "corporate_sales",
  "personal_sales",
] as const;

/** 雇用区分。非正規は別規則（未取込・別 config）で扱う。 */
export type EmploymentType = "regular" | "non_regular";
