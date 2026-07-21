import { describe, it, expect } from "vitest";
import {
  jinjerEmployeeDtoSchema,
  jinjerStampDtoSchema,
  jinjerMonthlyClosingDtoSchema,
  jinjerEmployeeListSchema,
} from "./dto.js";

const validEmployee = {
  staff_code: "E001",
  last_name: "山田",
  first_name: "太郎",
  email: "taro@example.com",
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
};

describe("jinjerEmployeeDtoSchema", () => {
  it("正常な従業員 DTO を通す", () => {
    const parsed = jinjerEmployeeDtoSchema.parse(validEmployee);
    expect(parsed.staff_code).toBe("E001");
  });

  it("email 省略・resignation_date 省略を許容する", () => {
    const { email, resignation_date, ...rest } = validEmployee;
    void email;
    void resignation_date;
    const parsed = jinjerEmployeeDtoSchema.parse(rest);
    expect(parsed.email).toBeUndefined();
  });

  it("負の基本給を弾く", () => {
    expect(() =>
      jinjerEmployeeDtoSchema.parse({ ...validEmployee, basic_salary: -1 }),
    ).toThrow();
  });

  it("不正な日付形式を弾く", () => {
    expect(() =>
      jinjerEmployeeDtoSchema.parse({ ...validEmployee, hire_date: "2020/04/01" }),
    ).toThrow();
  });

  it("staff_code 空文字を弾く", () => {
    expect(() =>
      jinjerEmployeeDtoSchema.parse({ ...validEmployee, staff_code: "" }),
    ).toThrow();
  });
});

describe("jinjerStampDtoSchema", () => {
  it("正常な打刻 DTO を通す", () => {
    const parsed = jinjerStampDtoSchema.parse({
      staff_code: "E001",
      stamp_type: "1",
      stamped_at: "2025-07-01T09:00:00+09:00",
    });
    expect(parsed.stamp_type).toBe("1");
  });

  it("オフセット無しのタイムスタンプを弾く", () => {
    expect(() =>
      jinjerStampDtoSchema.parse({
        staff_code: "E001",
        stamp_type: "1",
        stamped_at: "2025-07-01T09:00:00",
      }),
    ).toThrow();
  });
});

describe("jinjerMonthlyClosingDtoSchema", () => {
  it("正常な月次締め DTO を通す", () => {
    const parsed = jinjerMonthlyClosingDtoSchema.parse({
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
    });
    expect(parsed.month).toBe(7);
  });

  it("13 月を弾く", () => {
    expect(() =>
      jinjerMonthlyClosingDtoSchema.parse({
        staff_code: "E001",
        year: 2025,
        month: 13,
        total_working_minutes: 0,
        classified: {
          non_statutory_overtime_minutes: 0,
          statutory_overtime_minutes: 0,
          legal_holiday_minutes: 0,
          scheduled_holiday_minutes: 0,
          night_minutes: 0,
        },
        allowances: {
          overtime_allowance: 0,
          overtime_over60_allowance: 0,
          holiday_allowance: 0,
          night_allowance: 0,
        },
      }),
    ).toThrow();
  });
});

describe("jinjerEmployeeListSchema", () => {
  it("エンベロープ + 配列を通す", () => {
    const parsed = jinjerEmployeeListSchema.parse({
      code: 200,
      result: [validEmployee],
    });
    expect(parsed.result).toHaveLength(1);
  });

  it("result が配列でないと弾く", () => {
    expect(() =>
      jinjerEmployeeListSchema.parse({ code: 200, result: validEmployee }),
    ).toThrow();
  });
});
