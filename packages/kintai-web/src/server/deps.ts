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
  InMemoryEmployeeRepository,
  InMemoryStampRepository,
} from "@dgloss-kintai/api";
import type {
  Clock,
  EmployeeRepository,
  IdGenerator,
  StampRepository,
} from "@dgloss-kintai/api";
import type {
  Employee,
  EmployeeId,
  IsoDateTime,
  StampId,
  Yen,
} from "@dgloss-kintai/contracts";

import { DEMO_EMPLOYEE_ID } from "@/lib/demo";

/** registerStamp / listStamps に供給する依存一式。 */
export interface ServerDeps {
  readonly stamps: StampRepository;
  readonly employees: EmployeeRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** `crypto.randomUUID()` ベースの ID 採番。 */
class RandomUuidIdGenerator implements IdGenerator {
  stampId(): StampId {
    return `stamp_${crypto.randomUUID()}` as StampId;
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

/** in-memory 実装（既定・デモ従業員シード済み）を組み立てる。 */
function buildInMemoryDeps(): ServerDeps {
  return {
    stamps: new InMemoryStampRepository(),
    employees: new InMemoryEmployeeRepository(createDemoEmployees()),
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
