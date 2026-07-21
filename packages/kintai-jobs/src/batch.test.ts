import { describe, it, expect } from "vitest";
import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";
import {
  runMonthlyClosingBatch,
  runMonthlyClosingJob,
  type MonthlyClosingJobDeps,
} from "./batch.js";
import { fixedClock } from "./ports.js";
import { makeEmployee, makeWorkDay } from "./testFixtures.js";

const period: YearMonth = { year: 2025, month: 7 };
const clock = fixedClock(new Date("2025-08-01T00:00:00.000Z"));

const e1 = makeEmployee("E1");
const e2 = makeEmployee("E2", { isManagerialEmployee: true });

const daysE1 = [
  makeWorkDay("E1", "2025-07-10", { classified: { statutoryOvertimeMinutes: 1200 } }),
];
const daysE2 = [
  makeWorkDay("E2", "2025-07-10", { classified: { nightMinutes: 600 } }),
];

describe("runMonthlyClosingBatch", () => {
  it("Map で従業員ごとに締める（順序を保つ）", () => {
    const map = new Map<EmployeeId, readonly WorkDay[]>([
      [e1.id, daysE1],
      [e2.id, daysE2],
    ]);
    const results = runMonthlyClosingBatch([e1, e2], map, period, { clock });
    expect(results.map((r) => r.employeeId)).toEqual(["E1", "E2"]);
    expect(results[0]?.premium.overtimeAllowance).toBe(45000);
    expect(results[1]?.premium.nightAllowance).toBe(4500);
  });

  it("Record でも動作する", () => {
    const record: Record<string, readonly WorkDay[]> = {
      E1: daysE1,
      E2: daysE2,
    };
    const results = runMonthlyClosingBatch([e1, e2], record, period, { clock });
    expect(results).toHaveLength(2);
    expect(results[1]?.premium.nightAllowance).toBe(4500);
  });

  it("WorkDay が無い従業員はゼロ締めになる", () => {
    const results = runMonthlyClosingBatch([e1], new Map(), period, { clock });
    expect(results[0]?.premium.total).toBe(0);
    expect(results[0]?.totalWorkedMinutes).toBe(0);
  });
});

describe("runMonthlyClosingJob", () => {
  it("port から取得・保存して締める", async () => {
    const saved: MonthlyClosing[] = [];
    const workDaysById: Record<string, readonly WorkDay[]> = {
      E1: daysE1,
      E2: daysE2,
    };
    const deps: MonthlyClosingJobDeps = {
      employeeDirectory: {
        listEmployeesForClosing: async (_p: YearMonth): Promise<readonly Employee[]> => [e1, e2],
      },
      workDaySource: {
        listWorkDays: async (id: EmployeeId): Promise<readonly WorkDay[]> =>
          workDaysById[id] ?? [],
      },
      sink: {
        save: async (c: MonthlyClosing): Promise<void> => {
          saved.push(c);
        },
      },
      clock,
    };

    const results = await runMonthlyClosingJob(period, deps);
    expect(results.map((r) => r.employeeId)).toEqual(["E1", "E2"]);
    expect(saved).toHaveLength(2);
    expect(saved[0]?.premium.overtimeAllowance).toBe(45000);
    expect(saved[1]?.premium.nightAllowance).toBe(4500);
  });

  it("sink 未指定でも締め結果を返す", async () => {
    const deps: MonthlyClosingJobDeps = {
      employeeDirectory: {
        listEmployeesForClosing: async (): Promise<readonly Employee[]> => [e1],
      },
      workDaySource: {
        listWorkDays: async (): Promise<readonly WorkDay[]> => daysE1,
      },
      clock,
    };
    const results = await runMonthlyClosingJob(period, deps);
    expect(results).toHaveLength(1);
    expect(results[0]?.premium.overtimeAllowance).toBe(45000);
  });
});
