import { describe, it, expect } from "vitest";
import {
  mapEmployee,
  mapStamp,
  mapWorkDay,
  mapAllowances,
  mapMonthlyClosing,
  JinjerMappingError,
} from "./mappers.js";
import type {
  JinjerEmployeeDto,
  JinjerStampDto,
  JinjerDailyAttendanceDto,
  JinjerMonthlyClosingDto,
} from "./dto.js";

const employeeDto: JinjerEmployeeDto = {
  staff_code: "E001",
  last_name: "山田",
  first_name: "太郎",
  email: "taro@example.com",
  hire_date: "2020-04-01",
  resignation_date: null,
  employment_type: "1",
  work_system: "2",
  office_division: "1",
  is_managerial: false,
  basic_salary: 300000,
  annual_scheduled_working_hours: 1920,
  fixed_overtime_allowance: 20000,
  fixed_overtime_coverage: {
    overtime: true,
    overtime_over60: false,
    holiday: false,
    night: false,
  },
};

describe("mapEmployee", () => {
  it("DTO を contracts.Employee に写像する", () => {
    const e = mapEmployee(employeeDto);
    expect(e.employeeCode).toBe("E001");
    expect(e.name).toBe("山田 太郎");
    expect(e.email).toBe("taro@example.com");
    expect(e.retiredOn).toBeNull();
    expect(e.contract.employmentType).toBe("regular");
    expect(e.contract.workSystem).toBe("flex");
    expect(e.contract.office).toBe("headquarters");
    expect(e.contract.basicSalary).toBe(300000);
    expect(e.contract.fixedOvertimeCoverage.overtime).toBe(true);
  });

  it("email 未設定は null になる", () => {
    const dto: JinjerEmployeeDto = { ...employeeDto };
    delete (dto as { email?: unknown }).email;
    expect(mapEmployee(dto).email).toBeNull();
  });

  it("未知の勤務体系コードは JinjerMappingError", () => {
    expect(() =>
      mapEmployee({ ...employeeDto, work_system: "99" }),
    ).toThrow(JinjerMappingError);
  });
});

describe("mapStamp", () => {
  const dto: JinjerStampDto = {
    staff_code: "E001",
    stamp_type: "1",
    stamped_at: "2025-07-01T09:00:00+09:00",
    note: null,
  };

  it("打刻種別コードを写像し source は jinjer_api", () => {
    const s = mapStamp(dto);
    expect(s.type).toBe("clock_in");
    expect(s.source).toBe("jinjer_api");
    expect(s.employeeId).toBe("E001");
  });

  it("ID は決定的に合成される", () => {
    expect(mapStamp(dto).id).toBe("jinjer:E001:2025-07-01T09:00:00+09:00:clock_in");
  });

  it("未知の打刻種別は JinjerMappingError", () => {
    expect(() => mapStamp({ ...dto, stamp_type: "x" })).toThrow(
      JinjerMappingError,
    );
  });
});

describe("mapWorkDay", () => {
  const dto: JinjerDailyAttendanceDto = {
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
  };

  it("日次勤怠を写像する", () => {
    const w = mapWorkDay(dto);
    expect(w.dayType).toBe("workday");
    expect(w.actualWorkedMinutes).toBe(480);
    expect(w.leave).toBeNull();
    expect(w.id).toBe("jinjer:E001:2025-07-01");
  });

  it("休暇コードを写像する", () => {
    const w = mapWorkDay({ ...dto, leave_type: "paid_full" });
    expect(w.leave).toBe("paid_full");
  });

  it("未知の日区分は JinjerMappingError", () => {
    expect(() => mapWorkDay({ ...dto, day_type: "9" })).toThrow(
      JinjerMappingError,
    );
  });
});

describe("mapAllowances", () => {
  it("total を加算で確定する", () => {
    const p = mapAllowances({
      overtime_allowance: 12000,
      overtime_over60_allowance: 3000,
      holiday_allowance: 5000,
      night_allowance: 1000,
    });
    expect(p.total).toBe(21000);
  });
});

describe("mapMonthlyClosing", () => {
  const dto: JinjerMonthlyClosingDto = {
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
  };

  it("突合用の値に写像する", () => {
    const v = mapMonthlyClosing(dto);
    expect(v.employeeId).toBe("E001");
    expect(v.period).toEqual({ year: 2025, month: 7 });
    expect(v.premiumTotal).toBe(12000);
    expect(v.totalWorkedMinutes).toBe(9600);
  });
});
