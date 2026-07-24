import { describe, it, expect } from "vitest";
import type {
  Employee,
  Stamp,
  StampId,
  EmployeeId,
  IsoDateTime,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";
import { makeEmployee, makeWorkDay } from "../testFixtures.js";
import {
  migrateAttendance,
  migrateEmployees,
  migrateStamps,
  type EmployeeSink,
  type StampSink,
  type WorkDaySink,
} from "./migrate.js";

const period: YearMonth = { year: 2025, month: 7 };

/** upsert を記録するインメモリ従業員 sink（failCodes に含む社員番号は例外を投げる）。 */
class RecordingEmployeeSink implements EmployeeSink {
  readonly upserted: Employee[] = [];
  readonly #failCodes: ReadonlySet<string>;
  constructor(failCodes: readonly string[] = []) {
    this.#failCodes = new Set(failCodes);
  }
  upsert(employee: Employee): Promise<void> {
    if (this.#failCodes.has(employee.employeeCode)) {
      return Promise.reject(new Error(`DB 制約違反: ${employee.employeeCode}`));
    }
    this.upserted.push(employee);
    return Promise.resolve();
  }
}

function makeStamp(id: string, employeeId: string): Stamp {
  return {
    id: id as StampId,
    employeeId: employeeId as EmployeeId,
    type: "clock_in",
    stampedAt: "2025-07-01T09:00:00+09:00" as IsoDateTime,
    source: "jinjer_api",
    note: null,
  };
}

describe("migrateEmployees", () => {
  it("正常系: 全件 upsert し succeeded=total・failed=0", async () => {
    const employees = [makeEmployee("E1"), makeEmployee("E2"), makeEmployee("E3")];
    const sink = new RecordingEmployeeSink();
    const result = await migrateEmployees({
      source: { pullEmployees: async (): Promise<readonly Employee[]> => employees },
      sink,
    });
    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.failures).toHaveLength(0);
    expect(sink.upserted.map((e) => e.id)).toEqual(["E1", "E2", "E3"]);
  });

  it("一部失敗: sink が例外を投げても止まらず失敗件数に集計する", async () => {
    const employees = [makeEmployee("E1"), makeEmployee("E2"), makeEmployee("E3")];
    // E2 の employeeCode は EMP-E2（testFixtures 準拠）。
    const sink = new RecordingEmployeeSink(["EMP-E2"]);
    const result = await migrateEmployees({
      source: { pullEmployees: async (): Promise<readonly Employee[]> => employees },
      sink,
    });
    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.id).toBe("EMP-E2");
    expect(result.failures[0]?.error).toContain("DB 制約違反");
    // 失敗しても残りは投入される（E1・E3）。
    expect(sink.upserted.map((e) => e.id)).toEqual(["E1", "E3"]);
  });

  it("空: pull が空なら total=0・succeeded=0", async () => {
    const sink = new RecordingEmployeeSink();
    const result = await migrateEmployees({
      source: { pullEmployees: async (): Promise<readonly Employee[]> => [] },
      sink,
    });
    expect(result).toStrictEqual({
      total: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
    });
    expect(sink.upserted).toHaveLength(0);
  });

  it("total = succeeded + failed が常に成り立つ（全件失敗）", async () => {
    const employees = [makeEmployee("E1"), makeEmployee("E2")];
    const sink = new RecordingEmployeeSink(["EMP-E1", "EMP-E2"]);
    const result = await migrateEmployees({
      source: { pullEmployees: async (): Promise<readonly Employee[]> => employees },
      sink,
    });
    expect(result.succeeded + result.failed).toBe(result.total);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(2);
  });
});

describe("migrateStamps", () => {
  it("正常系: 打刻を全件保存する", async () => {
    const stamps = [makeStamp("S1", "E1"), makeStamp("S2", "E1")];
    const saved: Stamp[] = [];
    const sink: StampSink = {
      save: async (s: Stamp): Promise<void> => {
        saved.push(s);
      },
    };
    const result = await migrateStamps(period, {
      source: { pullStamps: async (): Promise<readonly Stamp[]> => stamps },
      sink,
    });
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(saved.map((s) => s.id)).toEqual(["S1", "S2"]);
  });

  it("一部失敗: 失敗明細に打刻 ID を記録する", async () => {
    const stamps = [makeStamp("S1", "E1"), makeStamp("S2", "E1")];
    const sink: StampSink = {
      save: (s: Stamp): Promise<void> =>
        s.id === "S2" ? Promise.reject(new Error("boom")) : Promise.resolve(),
    };
    const result = await migrateStamps(period, {
      source: { pullStamps: async (): Promise<readonly Stamp[]> => stamps },
      sink,
    });
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures[0]?.id).toBe("S2");
  });
});

describe("migrateAttendance", () => {
  it("正常系: 日次勤怠を全件保存する", async () => {
    const workDays: readonly WorkDay[] = [
      makeWorkDay("E1", "2025-07-10"),
      makeWorkDay("E1", "2025-07-11"),
    ];
    const saved: WorkDay[] = [];
    const sink: WorkDaySink = {
      save: async (w: WorkDay): Promise<void> => {
        saved.push(w);
      },
    };
    const result = await migrateAttendance(period, {
      source: { pullAttendance: async (): Promise<readonly WorkDay[]> => workDays },
      sink,
    });
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(saved.map((w) => w.id)).toEqual(["E1-2025-07-10", "E1-2025-07-11"]);
  });
});
