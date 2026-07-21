import { describe, it, expect } from "vitest";
import { JinjerConnector } from "./pull.js";
import type { JinjerTransport, JinjerRequest } from "./transport.js";
import type { YearMonth } from "@dgloss-kintai/contracts";

const period: YearMonth = { year: 2025, month: 7 };

/** path ごとに固定レスポンスを返すスタブ transport（実ネットワークを呼ばない）。 */
function stubTransport(responses: Record<string, unknown>): {
  transport: JinjerTransport;
  calls: JinjerRequest[];
} {
  const calls: JinjerRequest[] = [];
  const transport: JinjerTransport = {
    request(req: JinjerRequest): Promise<unknown> {
      calls.push(req);
      const body = responses[req.path];
      if (body === undefined) {
        return Promise.reject(new Error(`no stub for ${req.path}`));
      }
      return Promise.resolve(body);
    },
  };
  return { transport, calls };
}

describe("JinjerConnector.pullEmployees", () => {
  it("検証してマップした Employee を返す", async () => {
    const { transport } = stubTransport({
      employees: {
        code: 200,
        result: [
          {
            staff_code: "E001",
            last_name: "山田",
            first_name: "太郎",
            email: null,
            hire_date: "2020-04-01",
            resignation_date: null,
            employment_type: "1",
            work_system: "1",
            office_division: "1",
            is_managerial: false,
            basic_salary: 300000,
            annual_scheduled_working_hours: 1920,
            fixed_overtime_allowance: 0,
            fixed_overtime_coverage: {
              overtime: false,
              overtime_over60: false,
              holiday: false,
              night: false,
            },
          },
        ],
      },
    });
    const employees = await new JinjerConnector(transport).pullEmployees();
    expect(employees).toHaveLength(1);
    expect(employees[0]?.name).toBe("山田 太郎");
  });

  it("スキーマ違反レスポンスは例外", async () => {
    const { transport } = stubTransport({
      employees: { code: 200, result: [{ staff_code: "" }] },
    });
    await expect(
      new JinjerConnector(transport).pullEmployees(),
    ).rejects.toThrow();
  });
});

describe("JinjerConnector.pullStamps", () => {
  it("期間クエリを送り Stamp を返す", async () => {
    const { transport, calls } = stubTransport({
      stamps: {
        code: 200,
        result: [
          {
            staff_code: "E001",
            stamp_type: "1",
            stamped_at: "2025-07-01T09:00:00+09:00",
            note: null,
          },
        ],
      },
    });
    const stamps = await new JinjerConnector(transport).pullStamps(period);
    expect(stamps[0]?.type).toBe("clock_in");
    expect(calls[0]?.query).toEqual({ year: 2025, month: 7 });
  });
});

describe("JinjerConnector.pullAttendance", () => {
  it("日次勤怠を WorkDay にして返す", async () => {
    const { transport } = stubTransport({
      daily_attendances: {
        code: 200,
        result: [
          {
            staff_code: "E001",
            work_date: "2025-07-01",
            day_type: "1",
            scheduled_start: "09:00",
            scheduled_end: "18:00",
            actual_worked_minutes: 480,
            break_minutes: 60,
            absence_minutes: 0,
            leave_type: null,
            classified: {
              non_statutory_overtime_minutes: 0,
              statutory_overtime_minutes: 0,
              legal_holiday_minutes: 0,
              scheduled_holiday_minutes: 0,
              night_minutes: 0,
            },
          },
        ],
      },
    });
    const days = await new JinjerConnector(transport).pullAttendance(period);
    expect(days[0]?.dayType).toBe("workday");
  });
});

describe("JinjerConnector.pullMonthlyClosings", () => {
  it("月次締めを突合用の値にして返す", async () => {
    const { transport } = stubTransport({
      monthly_closings: {
        code: 200,
        result: [
          {
            staff_code: "E001",
            year: 2025,
            month: 7,
            total_working_minutes: 9600,
            classified: {
              non_statutory_overtime_minutes: 0,
              statutory_overtime_minutes: 600,
              legal_holiday_minutes: 0,
              scheduled_holiday_minutes: 0,
              night_minutes: 0,
            },
            allowances: {
              overtime_allowance: 12000,
              overtime_over60_allowance: 0,
              holiday_allowance: 0,
              night_allowance: 0,
            },
          },
        ],
      },
    });
    const closings = await new JinjerConnector(transport).pullMonthlyClosings(
      period,
    );
    expect(closings[0]?.premiumTotal).toBe(12000);
  });
});
