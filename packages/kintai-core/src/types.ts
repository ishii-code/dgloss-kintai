/**
 * 割増賃金計算エンジンのドメイン型。
 *
 * 労働時間はすべて「分」の整数で受け渡す。打刻は分単位で確定するため、
 * 分を最小単位にすることで浮動小数点を排除し、突合の 1 円ずれを防ぐ。
 * 22:00-5:00 の深夜判定・法定/所定の区分は、上位の勤怠判定レイヤーが済ませた前提。
 */

/**
 * 区分別の月間労働時間（分・整数）。
 * 深夜（nightMinutes）は他区分と重複してよい（深夜割増は加算のみのため）。
 */
export interface ClassifiedWorkMinutes {
  /**
   * 所定外だが法定内の時間外労働（いわゆる法定内残業）。
   * 支給率は時給相当分 1.00 のみ（法定割増は発生しない）。
   */
  nonStatutoryOvertimeMinutes: number;
  /**
   * 法定時間外労働の月間合計。エンジンが 60 時間しきい値で 0.25 / 0.50 に分割する
   * （賃金規程第20条3項2号(1)a,b）。
   */
  statutoryOvertimeMinutes: number;
  /** 法定休日労働（賃金規程第20条3項2号(2)a）。 */
  legalHolidayMinutes: number;
  /** 所定休日労働（賃金規程第20条3項2号(2)b）。 */
  scheduledHolidayMinutes: number;
  /**
   * 深夜時間帯(22:00-5:00)に含まれる労働時間の合計。
   * 他区分（時間外・休日・所定内）と重複してよい。深夜割増 0.25 を加算するのみ
   * （賃金規程第20条3項2号(3)a）。
   */
  nightMinutes: number;
}

/** 従業員の賃金プロフィール。 */
export interface EmployeeWageProfile {
  /** 基本給（月額・円・整数）。 */
  basicSalary: number;
  /**
   * 労働基準法第41条2号「監督もしくは管理の地位にある者」に該当するか。
   * 該当者には深夜勤務手当のみ支給する（賃金規程第20条3項4号）。
   */
  isManagerialEmployee: boolean;
}

/**
 * 手当区分別の割増賃金（円・整数、各ラインで切り上げ済み）。
 * 賃金規程第4条「賃金の構成」の基準外給与に対応する。
 */
export interface WagePremiumBreakdown {
  /** 時間外勤務手当（法定内残業 + 法定時間外60時間まで）。 */
  overtimeAllowance: number;
  /** 時間外勤務60時間超手当。 */
  overtimeOver60Allowance: number;
  /** 休日勤務手当（法定休日 + 所定休日）。 */
  holidayAllowance: number;
  /** 深夜勤務手当。 */
  nightAllowance: number;
  /** 上記4手当の合計。 */
  total: number;
}
