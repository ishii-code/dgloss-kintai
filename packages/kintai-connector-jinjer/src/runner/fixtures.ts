/**
 * Shadow 検証デモ用のフィクスチャビルダー（純粋関数・決定的）。
 *
 * 実 DB を持たない本パッケージで「実際に end-to-end で走らせる」ため、賃金計算に効く
 * バリエーション（管理監督者/非管理監督者・固定残業あり/なし）を備えたサンプル従業員と、
 * その月の現実的な {@link WorkDay}[]（時間外・深夜・休日を含む）を生成する。
 *
 * すべて副作用のない純粋関数で、乱数・現在時刻に依存しない（同じ入力なら常に同じ出力）。
 * 実 jinjer 仕様が判明しても、ここは「自作側の入力」を作るだけなので変更不要。
 */

import type {
  Employee,
  EmployeeId,
  EmploymentContract,
  IsoDate,
  Minutes,
  WorkDay,
  WorkDayId,
  Yen,
  YearMonth,
} from "@dgloss-kintai/contracts";

/** デモの締め対象月（賃金規程第6条: 当月1日〜末日）。 */
export const DEMO_PERIOD: YearMonth = { year: 2025, month: 7 };

/** 区分別労働時間のゼロ値（ここから必要な区分だけ立てる）。 */
const ZERO_CLASSIFIED = {
  nonStatutoryOvertimeMinutes: 0,
  statutoryOvertimeMinutes: 0,
  legalHolidayMinutes: 0,
  scheduledHolidayMinutes: 0,
  nightMinutes: 0,
} as const;

/** {@link makeWorkDay} に渡す1日分の労働時間指定（分）。省略値は0。 */
interface WorkDaySpec {
  /** 実労働時間（休憩控除後・分）。 */
  readonly actualWorkedMinutes: number;
  /** 休憩時間（分）。 */
  readonly breakMinutes?: number;
  /** 遅刻早退等の不就労時間（分・第21条控除対象）。 */
  readonly absenceMinutes?: number;
  /** 日区分（既定は所定労働日）。 */
  readonly dayType?: WorkDay["dayType"];
  /** 法定外時間外（分）。 */
  readonly nonStatutoryOvertimeMinutes?: number;
  /** 法定時間外（分）。 */
  readonly statutoryOvertimeMinutes?: number;
  /** 法定休日労働（分）。 */
  readonly legalHolidayMinutes?: number;
  /** 所定休日労働（分）。 */
  readonly scheduledHolidayMinutes?: number;
  /** 深夜労働（分・他区分と重複可）。 */
  readonly nightMinutes?: number;
}

/** 1日分の {@link WorkDay} を決定的に組み立てる。ID は `{社員番号}:{日付}` で合成。 */
function makeWorkDay(
  employeeId: string,
  date: string,
  spec: WorkDaySpec,
): WorkDay {
  const dayType = spec.dayType ?? "workday";
  return {
    id: `demo:${employeeId}:${date}` as WorkDayId,
    employeeId: employeeId as EmployeeId,
    date: date as IsoDate,
    dayType,
    scheduledStart: dayType === "workday" ? "09:00" : null,
    scheduledEnd: dayType === "workday" ? "18:00" : null,
    actualWorkedMinutes: spec.actualWorkedMinutes as Minutes,
    breakMinutes: (spec.breakMinutes ?? 60) as Minutes,
    absenceMinutes: (spec.absenceMinutes ?? 0) as Minutes,
    leave: null,
    classified: {
      ...ZERO_CLASSIFIED,
      nonStatutoryOvertimeMinutes: spec.nonStatutoryOvertimeMinutes ?? 0,
      statutoryOvertimeMinutes: spec.statutoryOvertimeMinutes ?? 0,
      legalHolidayMinutes: spec.legalHolidayMinutes ?? 0,
      scheduledHolidayMinutes: spec.scheduledHolidayMinutes ?? 0,
      nightMinutes: spec.nightMinutes ?? 0,
    },
  };
}

/** 雇用契約を組み立てる（省略値は非管理監督者・固定残業なし）。 */
function makeContract(overrides: Partial<EmploymentContract> = {}): EmploymentContract {
  return {
    employmentType: "regular",
    workSystem: "fixed",
    office: "headquarters",
    isManagerialEmployee: false,
    basicSalary: 300000 as Yen,
    annualScheduledWorkingHours: 2000,
    fixedOvertimeAllowance: 0 as Yen,
    fixedOvertimeCoverage: {
      overtime: false,
      overtimeOver60: false,
      holiday: false,
      night: false,
    },
    ...overrides,
  };
}

/** 従業員を組み立てる。 */
function makeEmployee(
  id: string,
  name: string,
  contract: EmploymentContract,
): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: id,
    name,
    email: null,
    hiredOn: "2020-04-01" as IsoDate,
    retiredOn: null,
    contract,
  };
}

/**
 * デモ1名分のシナリオ。自作側の入力（従業員・WorkDay[]）と、jinjer 側に注入する
 * 割増乖離（円）・シナリオ説明を持つ。
 */
export interface DemoScenario {
  /** 締め対象の従業員。 */
  readonly employee: Employee;
  /** 当月の勤怠。 */
  readonly workDays: readonly WorkDay[];
  /**
   * jinjer 側の割増合計に加える差分（円）。
   *  - `0`  … 自作締めと完全一致するケース。
   *  - `>0` … jinjer が自作より高い＝未払い方向（own − jinjer < 0）のケース。
   *  - `<0` … jinjer が自作より低い＝過払い方向のケース。
   */
  readonly jinjerPremiumDelta: number;
  /** レポート・テスト用の人間可読なシナリオ説明。 */
  readonly description: string;
}

/**
 * デモの全シナリオを決定的に生成する（純粋関数）。
 *
 * 賃金計算に効く3類型を用意する:
 *  1. 非管理監督者・固定残業なし（時間外＋深夜）→ 自作と jinjer が一致。
 *  2. 非管理監督者・固定残業あり（時間外を固定残業が充当）→ jinjer が 1 円高い＝未払い方向。
 *  3. 管理監督者（深夜のみ割増・第20条3項4号）→ 自作と jinjer が一致。
 */
export function buildDemoScenarios(): readonly DemoScenario[] {
  // 1. 非管理監督者・固定残業なし。時間外と深夜が発生する現実的な1か月。
  const e1 = makeEmployee("E001", "山田 太郎", makeContract());
  const w1: readonly WorkDay[] = [
    makeWorkDay("E001", "2025-07-07", {
      actualWorkedMinutes: 600,
      statutoryOvertimeMinutes: 120,
    }),
    makeWorkDay("E001", "2025-07-14", {
      actualWorkedMinutes: 660,
      statutoryOvertimeMinutes: 180,
      nightMinutes: 60,
    }),
    makeWorkDay("E001", "2025-07-21", {
      actualWorkedMinutes: 480,
      absenceMinutes: 30,
    }),
    // 所定休日出勤（第20条: 休日割増）。
    makeWorkDay("E001", "2025-07-26", {
      actualWorkedMinutes: 300,
      dayType: "scheduled_holiday",
      scheduledHolidayMinutes: 300,
    }),
  ];

  // 2. 非管理監督者・固定残業あり（月3万円・時間外を充当）。
  const e2 = makeEmployee(
    "E002",
    "佐藤 花子",
    makeContract({
      office: "corporate_sales",
      fixedOvertimeAllowance: 30000 as Yen,
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    }),
  );
  const w2: readonly WorkDay[] = [
    makeWorkDay("E002", "2025-07-08", {
      actualWorkedMinutes: 570,
      statutoryOvertimeMinutes: 90,
    }),
    makeWorkDay("E002", "2025-07-15", {
      actualWorkedMinutes: 600,
      statutoryOvertimeMinutes: 120,
      nightMinutes: 30,
    }),
    makeWorkDay("E002", "2025-07-22", {
      actualWorkedMinutes: 540,
      statutoryOvertimeMinutes: 60,
    }),
  ];

  // 3. 管理監督者（労基法第41条2号）。時間外・休日割増は付かず、深夜のみ割増。
  const e3 = makeEmployee(
    "E003",
    "鈴木 一郎",
    makeContract({
      workSystem: "discretionary",
      isManagerialEmployee: true,
      basicSalary: 500000 as Yen,
    }),
  );
  const w3: readonly WorkDay[] = [
    makeWorkDay("E003", "2025-07-09", {
      actualWorkedMinutes: 660,
      statutoryOvertimeMinutes: 180,
      nightMinutes: 90,
    }),
    makeWorkDay("E003", "2025-07-16", {
      actualWorkedMinutes: 720,
      statutoryOvertimeMinutes: 240,
      nightMinutes: 120,
    }),
  ];

  return [
    {
      employee: e1,
      workDays: w1,
      jinjerPremiumDelta: 0,
      description: "非管理監督者・固定残業なし（時間外＋深夜＋休日）→ 一致",
    },
    {
      employee: e2,
      workDays: w2,
      jinjerPremiumDelta: 1,
      description: "非管理監督者・固定残業あり → jinjer が1円高い（未払い方向）",
    },
    {
      employee: e3,
      workDays: w3,
      jinjerPremiumDelta: 0,
      description: "管理監督者（深夜のみ割増）→ 一致",
    },
  ];
}
