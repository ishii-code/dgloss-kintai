/**
 * 支給率（賃金規程第20条3項2号）。
 *
 * 整数演算を保つため、支給率は 1/100 単位（rate × 100、以下 bp と呼ぶ）で保持する。
 * 例: 0.25 → 25、1.00 → 100、1.25 → 125。
 *
 * 月給制のため、所定外労働の「時給相当分 1.00」は基本給に含まれない分として加算する
 * （第20条3項2号(1)c, (2)d）。深夜の割増分 0.25 は他区分に加算されるのみで、時給相当分を含まない
 * （深夜時間帯の 1.00 は所定内なら基本給、所定外なら時間外/休日側で計上済みのため）。
 */
export const RATE_BP = {
  /** 時給相当分 1.00（第20条3項2号(1)c, (2)d） */
  hourlyEquivalent: 100,
  /** 法定時間外・割増分（60時間まで） 0.25（第20条3項2号(1)a） */
  statutoryOvertimeWithinThreshold: 25,
  /** 法定時間外・割増分（60時間超） 0.50（第20条3項2号(1)b） */
  statutoryOvertimeOverThreshold: 50,
  /** 法定休日・割増分 0.35（第20条3項2号(2)a） */
  legalHoliday: 35,
  /** 所定休日・割増分 0.25（第20条3項2号(2)b） */
  scheduledHoliday: 25,
  /** 深夜・割増分 0.25（第20条3項2号(3)a） */
  night: 25,
} as const;

/**
 * 手当区分ごとの合成支給率（bp）。
 * 端数切り上げは第4条「賃金の構成」の手当ライン単位で行うため、
 * 各ラインに計上される時間の支給率をここで定義する。
 */
export const LINE_RATE_BP = {
  /** 法定内残業（所定外だが法定内）: 時給相当分のみ 1.00 */
  nonStatutoryOvertime: RATE_BP.hourlyEquivalent,
  /** 法定時間外（60時間まで）: 1.00 + 0.25 = 1.25 */
  statutoryOvertimeWithin: RATE_BP.hourlyEquivalent + RATE_BP.statutoryOvertimeWithinThreshold,
  /** 法定時間外（60時間超）: 1.00 + 0.50 = 1.50 */
  statutoryOvertimeOver: RATE_BP.hourlyEquivalent + RATE_BP.statutoryOvertimeOverThreshold,
  /** 法定休日: 1.00 + 0.35 = 1.35 */
  legalHoliday: RATE_BP.hourlyEquivalent + RATE_BP.legalHoliday,
  /** 所定休日: 1.00 + 0.25 = 1.25 */
  scheduledHoliday: RATE_BP.hourlyEquivalent + RATE_BP.scheduledHoliday,
  /** 深夜: 加算のみ 0.25 */
  night: RATE_BP.night,
} as const;
