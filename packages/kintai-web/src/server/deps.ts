import "server-only";

/**
 * サーバ側の依存合成（DI）。
 *
 * repository 群・IdGenerator・Clock を **プロセス内シングルトン**で保持する。
 * - `DATABASE_URL` 無し（既定）: @dgloss-kintai/api の in-memory 実装を使い、
 *   デモ従業員（{@link DEMO_EMPLOYEE_ID}）を1件シードする。これにより DB が無い
 *   この環境でも打刻登録・当日照会が成立する。
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

/** デモ用の従業員を1件生成する（in-memory シード用）。 */
function createDemoEmployee(): Employee {
  return {
    id: DEMO_EMPLOYEE_ID,
    employeeCode: "0001",
    name: "デモ 太郎",
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
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

/** in-memory 実装（既定・デモ従業員シード済み）を組み立てる。 */
function buildInMemoryDeps(): ServerDeps {
  return {
    stamps: new InMemoryStampRepository(),
    employees: new InMemoryEmployeeRepository([createDemoEmployee()]),
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
export function getDeps(): Promise<ServerDeps> {
  if (depsGlobal.__dglossKintaiDeps === undefined) {
    depsGlobal.__dglossKintaiDeps =
      process.env.DATABASE_URL !== undefined && process.env.DATABASE_URL !== ""
        ? buildPrismaDeps()
        : Promise.resolve(buildInMemoryDeps());
  }
  return depsGlobal.__dglossKintaiDeps;
}
