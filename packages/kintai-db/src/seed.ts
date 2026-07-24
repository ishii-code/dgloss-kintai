/**
 * 初期従業員のシード（デプロイ直後に打刻できるようにするためのデモデータ）。
 *
 * 新規 DB は従業員ゼロのためログイン一覧が空になる。本スクリプトはデモ従業員を
 * 冪等に投入する。**本番の実データは jinjer 移行（connector の pullEmployees）または
 * 別途の投入スクリプトで用意する**こと。デモ投入は環境変数 `KINTAI_SEED_DEMO=true` の
 * ときだけ起動時に実行する（docker-compose 参照）。
 *
 * 実行: `node dist/seed.js`（`DATABASE_URL` を参照）。
 */

import { createPrismaClient } from "./client.js";

interface DemoEmployee {
  readonly id: string;
  readonly employeeCode: string;
  readonly name: string;
  readonly hiredOn: string;
  readonly employmentType: "regular" | "non_regular";
  readonly workSystem: "fixed" | "flex" | "shift" | "discretionary";
  readonly office: "headquarters" | "corporate_sales" | "personal_sales";
  readonly isManagerialEmployee: boolean;
  readonly basicSalary: number;
  readonly annualScheduledWorkingHours: number;
  readonly fixedOvertimeAllowance: number;
}

/** デモ従業員。実運用では jinjer 移行データに置き換える。 */
const DEMO_EMPLOYEES: readonly DemoEmployee[] = [
  {
    id: "emp_0001",
    employeeCode: "0001",
    name: "山田 太郎",
    hiredOn: "2020-04-01",
    employmentType: "regular",
    workSystem: "fixed",
    office: "headquarters",
    isManagerialEmployee: false,
    basicSalary: 300000,
    annualScheduledWorkingHours: 1900,
    fixedOvertimeAllowance: 0,
  },
  {
    id: "emp_0002",
    employeeCode: "0002",
    name: "佐藤 花子",
    hiredOn: "2021-04-01",
    employmentType: "regular",
    workSystem: "flex",
    office: "corporate_sales",
    isManagerialEmployee: false,
    basicSalary: 320000,
    annualScheduledWorkingHours: 1900,
    fixedOvertimeAllowance: 45000,
  },
  {
    id: "emp_0003",
    employeeCode: "0003",
    name: "鈴木 一郎",
    hiredOn: "2018-10-01",
    employmentType: "regular",
    workSystem: "shift",
    office: "personal_sales",
    isManagerialEmployee: true,
    basicSalary: 450000,
    annualScheduledWorkingHours: 1900,
    fixedOvertimeAllowance: 0,
  },
  {
    id: "emp_0004",
    employeeCode: "0004",
    name: "田中 みどり",
    hiredOn: "2023-06-01",
    employmentType: "non_regular",
    workSystem: "fixed",
    office: "headquarters",
    isManagerialEmployee: false,
    basicSalary: 220000,
    annualScheduledWorkingHours: 1900,
    fixedOvertimeAllowance: 0,
  },
];

async function main(): Promise<void> {
  // DATABASE_URL は client.ts が環境変数から解決する。
  const prisma = createPrismaClient();
  try {
    for (const e of DEMO_EMPLOYEES) {
      await prisma.employee.upsert({
        where: { id: e.id },
        update: {},
        create: {
          id: e.id,
          employeeCode: e.employeeCode,
          name: e.name,
          email: null,
          hiredOn: new Date(`${e.hiredOn}T00:00:00Z`),
          retiredOn: null,
          contract: {
            create: {
              employmentType: e.employmentType,
              workSystem: e.workSystem,
              office: e.office,
              isManagerialEmployee: e.isManagerialEmployee,
              basicSalary: e.basicSalary,
              annualScheduledWorkingHours: e.annualScheduledWorkingHours,
              fixedOvertimeAllowance: e.fixedOvertimeAllowance,
              coverageOvertime: e.fixedOvertimeAllowance > 0,
              coverageOvertimeOver60: e.fixedOvertimeAllowance > 0,
              coverageHoliday: e.fixedOvertimeAllowance > 0,
              coverageNight: false,
            },
          },
        },
      });
    }
    const count = await prisma.employee.count();
    // eslint-disable-next-line no-console
    console.log(`[seed] デモ従業員を投入しました（現在の従業員数: ${count}）`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[seed] 失敗:", e);
  process.exitCode = 1;
});
