import "server-only";

/**
 * サーバ側の依存合成（DI）。
 *
 * repository 群・IdGenerator・Clock を **プロセス内シングルトン**で保持する。
 * - `DATABASE_URL` 無し（既定）: @dgloss-kintai/api の in-memory 実装を使い、
 *   デモ従業員を複数シードする（簡易ログインの選択肢が出るよう管理監督者含む数名）。
 *   これにより DB が無いこの環境でも従業員選択→打刻登録・当日照会が成立する。
 * - `DATABASE_URL` 有り: @dgloss-kintai/db を **動的 import** して Prisma 実装へ差し替える。
 *   動的 import なので、既定パスでは Prisma を一切ロードしない（クライアントへも漏れない）。
 *
 * このモジュールは "server-only" ガード付きで、クライアントバンドルへ混入しない。
 */

import {
  InMemoryApprovalRequestRepository,
  InMemoryEmployeeRepository,
  InMemoryImprovementRequestRepository,
  InMemoryMonthlyClosingRepository,
  InMemoryStampRepository,
  InMemoryWorkDayRepository,
} from "@dgloss-kintai/api";
import type {
  ApprovalRequestRepository,
  Clock,
  EmployeeRepository,
  IdGenerator,
  ImprovementRequestRepository,
  MonthlyClosingRepository,
  StampRepository,
  WorkDayRepository,
} from "@dgloss-kintai/api";
import type {
  ApprovalRequest,
  ApprovalRequestId,
  Employee,
  EmployeeId,
  ImprovementRequest,
  ImprovementRequestId,
  IsoDate,
  IsoDateTime,
  Minutes,
  MonthlyClosing,
  StampId,
  WorkDay,
  Yen,
} from "@dgloss-kintai/contracts";

import { DEMO_EMPLOYEE_ID } from "@/lib/demo";

/**
 * サービス層ユースケースに供給する依存一式。
 * 打刻・従業員に加え、日次勤怠・月次締め・改善リクエストのリポジトリを保持する。
 */
export interface ServerDeps {
  readonly stamps: StampRepository;
  readonly employees: EmployeeRepository;
  readonly workDays: WorkDayRepository;
  readonly closings: MonthlyClosingRepository;
  readonly improvements: ImprovementRequestRepository;
  readonly approvals: ApprovalRequestRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** `crypto.randomUUID()` ベースの ID 採番。 */
class RandomUuidIdGenerator implements IdGenerator {
  stampId(): StampId {
    return `stamp_${crypto.randomUUID()}` as StampId;
  }
  improvementRequestId(): ImprovementRequestId {
    return `req_${crypto.randomUUID()}` as ImprovementRequestId;
  }
  employeeId(): EmployeeId {
    return `emp_${crypto.randomUUID()}` as EmployeeId;
  }
  approvalRequestId(): ApprovalRequestId {
    return `apr_${crypto.randomUUID()}` as ApprovalRequestId;
  }
}

/** 実時刻を RFC3339 で返す Clock。 */
class SystemClock implements Clock {
  now(): IsoDateTime {
    return new Date().toISOString() as IsoDateTime;
  }
}

/** デモ従業員を1名生成するヘルパー（in-memory シード用）。 */
function makeDemoEmployee(
  id: EmployeeId,
  employeeCode: string,
  name: string,
  overrides: {
    readonly workSystem?: Employee["contract"]["workSystem"];
    readonly office?: Employee["contract"]["office"];
    readonly isManagerialEmployee?: boolean;
  } = {},
): Employee {
  return {
    id,
    employeeCode,
    name,
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: overrides.workSystem ?? "fixed",
      office: overrides.office ?? "headquarters",
      isManagerialEmployee: overrides.isManagerialEmployee ?? false,
      basicSalary: 300_000 as Yen,
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: 0 as Yen,
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
}

/**
 * デモ用の従業員一式（in-memory シード用）。
 * ログイン画面に複数の選択肢が並ぶよう数名用意し、管理監督者も1名含める。
 * `emp_demo`（{@link DEMO_EMPLOYEE_ID}）は開発フォールバック・テストの既定ログイン先。
 */
function createDemoEmployees(): readonly Employee[] {
  return [
    makeDemoEmployee(DEMO_EMPLOYEE_ID, "0001", "デモ 太郎"),
    makeDemoEmployee("emp_hanako" as EmployeeId, "0002", "デモ 花子", {
      office: "corporate_sales",
    }),
    makeDemoEmployee("emp_manager" as EmployeeId, "0003", "デモ 部長", {
      isManagerialEmployee: true,
    }),
    makeDemoEmployee("emp_flex" as EmployeeId, "0004", "デモ 次郎", {
      workSystem: "flex",
    }),
  ];
}

/** 区分別労働時間ゼロ（ヘルパー・シード用）。 */
function zeroClassified(): WorkDay["classified"] {
  return {
    nonStatutoryOvertimeMinutes: 0,
    statutoryOvertimeMinutes: 0,
    legalHolidayMinutes: 0,
    scheduledHolidayMinutes: 0,
    nightMinutes: 0,
  };
}

/** デモ用の日次勤怠を1件生成するヘルパー（in-memory シード用）。 */
function makeDemoWorkDay(
  date: string,
  actualWorkedMinutes: number,
  overtimeMinutes = 0,
): WorkDay {
  return {
    id: `wd_${date}` as WorkDay["id"],
    employeeId: DEMO_EMPLOYEE_ID,
    date: date as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: actualWorkedMinutes as Minutes,
    breakMinutes: 60 as Minutes,
    absenceMinutes: 0 as Minutes,
    leave: null,
    classified: {
      ...zeroClassified(),
      nonStatutoryOvertimeMinutes: overtimeMinutes,
    },
  };
}

/**
 * デモ用の日次勤怠（当月＝2026-07 の一部平日）。
 * 画面が空にならないよう数日分を用意する。
 */
function createDemoWorkDays(): readonly WorkDay[] {
  return [
    makeDemoWorkDay("2026-07-01", 495, 15),
    makeDemoWorkDay("2026-07-02", 480, 0),
    makeDemoWorkDay("2026-07-03", 600, 120),
    makeDemoWorkDay("2026-07-06", 480, 0),
    makeDemoWorkDay("2026-07-07", 540, 60),
  ];
}

/** デモ用の月次締めを1件生成するヘルパー（in-memory シード用）。 */
function makeDemoClosing(
  year: number,
  month: number,
  status: MonthlyClosing["status"],
): MonthlyClosing {
  const closedAt =
    status === "closed"
      ? (`${year}-${String(month).padStart(2, "0")}-28T18:00:00+09:00` as IsoDateTime)
      : null;
  return {
    id: `mc_${year}${String(month).padStart(2, "0")}_demo` as MonthlyClosing["id"],
    employeeId: DEMO_EMPLOYEE_ID,
    period: { year, month },
    status,
    totalWorkedMinutes: 9_600 as Minutes,
    classified: {
      nonStatutoryOvertimeMinutes: 1_200,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 240,
      scheduledHolidayMinutes: 0,
      nightMinutes: 120,
    },
    premium: {
      overtimeAllowance: 45_000 as Yen,
      overtimeOver60Allowance: 0 as Yen,
      holidayAllowance: 12_000 as Yen,
      nightAllowance: 3_000 as Yen,
      total: 60_000 as Yen,
    },
    fixedOvertimeAdditionalPayment: 0 as Yen,
    latenessDeduction: 1_500 as Yen,
    closedAt,
  };
}

/** デモ用の月次締め（前月＝確定済み・当月＝仮締め）。 */
function createDemoClosings(): readonly MonthlyClosing[] {
  return [
    makeDemoClosing(2026, 6, "closed"),
    makeDemoClosing(2026, 7, "open"),
  ];
}

/** デモ用の改善リクエストを少量生成する（in-memory シード用）。 */
function createDemoImprovements(): readonly ImprovementRequest[] {
  return [
    {
      id: "req_demo_1" as ImprovementRequestId,
      createdByEmployeeId: DEMO_EMPLOYEE_ID,
      category: "feature",
      title: "月次締めの PDF 出力がほしい",
      body: "給与 CSV に加えて、締め結果を PDF で保存できると勤怠管理が楽になります。",
      status: "planned",
      createdAt: "2026-07-10T10:00:00+09:00" as IsoDateTime,
      updatedAt: "2026-07-12T09:00:00+09:00" as IsoDateTime,
    },
    {
      id: "req_demo_2" as ImprovementRequestId,
      createdByEmployeeId: DEMO_EMPLOYEE_ID,
      category: "bug",
      title: "休憩終了の打刻が反映されないことがある",
      body: "連続してタップすると休憩終了が二重に登録されるようです。",
      status: "in_progress",
      createdAt: "2026-07-15T14:30:00+09:00" as IsoDateTime,
      updatedAt: "2026-07-16T11:00:00+09:00" as IsoDateTime,
    },
  ];
}

/** デモ用の承認申請を少量生成する（in-memory シード用）。 */
function createDemoApprovals(): readonly ApprovalRequest[] {
  return [
    {
      id: "apr_demo_1" as ApprovalRequestId,
      type: "overtime",
      applicantEmployeeId: DEMO_EMPLOYEE_ID,
      targetDate: "2026-07-31" as IsoDate,
      subject: "月末締め対応の残業",
      detail: "月次締めの確認のため、19:00〜21:00 の残業を申請します。",
      status: "pending",
      decidedByEmployeeId: null,
      decidedAt: null,
      decisionComment: null,
      createdAt: "2026-07-25T09:00:00+09:00" as IsoDateTime,
      updatedAt: "2026-07-25T09:00:00+09:00" as IsoDateTime,
    },
    {
      id: "apr_demo_2" as ApprovalRequestId,
      type: "leave",
      applicantEmployeeId: "emp_hanako" as EmployeeId,
      targetDate: "2026-08-12" as IsoDate,
      subject: "有給休暇（1日）",
      detail: "私用のため 8/12 を有給で取得したく申請します。",
      status: "approved",
      decidedByEmployeeId: DEMO_EMPLOYEE_ID,
      decidedAt: "2026-07-20T13:00:00+09:00" as IsoDateTime,
      decisionComment: "確認しました。承認します。",
      createdAt: "2026-07-18T11:00:00+09:00" as IsoDateTime,
      updatedAt: "2026-07-20T13:00:00+09:00" as IsoDateTime,
    },
  ];
}

/** in-memory 実装（既定・デモデータシード済み）を組み立てる。 */
function buildInMemoryDeps(): ServerDeps {
  return {
    stamps: new InMemoryStampRepository(),
    employees: new InMemoryEmployeeRepository(createDemoEmployees()),
    workDays: new InMemoryWorkDayRepository(createDemoWorkDays()),
    closings: new InMemoryMonthlyClosingRepository(createDemoClosings()),
    improvements: new InMemoryImprovementRequestRepository(
      createDemoImprovements(),
    ),
    approvals: new InMemoryApprovalRequestRepository(createDemoApprovals()),
    ids: new RandomUuidIdGenerator(),
    clock: new SystemClock(),
  };
}

/**
 * Prisma 実装（DB あり）を組み立てる。
 * @dgloss-kintai/db は動的 import し、既定（DB 無し）パスからは一切参照しない。
 */
async function buildPrismaDeps(): Promise<ServerDeps> {
  const db = await import("@dgloss-kintai/db");
  const prisma = db.createPrismaClient();
  return {
    stamps: new db.PrismaStampRepository(prisma),
    employees: new db.PrismaEmployeeRepository(prisma),
    workDays: new db.PrismaWorkDayRepository(prisma),
    closings: new db.PrismaMonthlyClosingRepository(prisma),
    improvements: new db.PrismaImprovementRequestRepository(prisma),
    approvals: new db.PrismaApprovalRequestRepository(prisma),
    ids: new RandomUuidIdGenerator(),
    clock: new SystemClock(),
  };
}

/**
 * シングルトンの保持。
 * Next.js の dev（HMR）でも再生成を避けるため globalThis に退避する。
 */
interface DepsGlobal {
  __dglossKintaiDeps?: Promise<ServerDeps>;
}
const depsGlobal = globalThis as unknown as DepsGlobal;

/**
 * サーバ依存を取得する（プロセス内シングルトン・遅延初期化）。
 * `DATABASE_URL` の有無で in-memory / Prisma を切り替える。
 */
/**
 * 接続文字列が環境変数に設定されているか（＝DB モードか）を判定する。
 * ホスティング先で変数名が異なる（Vercel の Neon 連携は `POSTGRES_PRISMA_URL`/
 * `POSTGRES_URL` 等）ため、複数の名前を受ける。@dgloss-kintai/db の解決順と一致させる。
 * ここで db を import しない（in-memory パスに Prisma を持ち込まないため）。
 */
function hasDatabaseUrl(): boolean {
  const env = process.env;
  const url =
    env.DATABASE_URL ??
    env.POSTGRES_PRISMA_URL ??
    env.POSTGRES_URL_NON_POOLING ??
    env.DATABASE_URL_UNPOOLED ??
    env.POSTGRES_URL;
  return url !== undefined && url !== "";
}

export function getDeps(): Promise<ServerDeps> {
  if (depsGlobal.__dglossKintaiDeps === undefined) {
    depsGlobal.__dglossKintaiDeps = hasDatabaseUrl()
      ? buildPrismaDeps()
      : Promise.resolve(buildInMemoryDeps());
  }
  return depsGlobal.__dglossKintaiDeps;
}
