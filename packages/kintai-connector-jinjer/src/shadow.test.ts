import { describe, it, expect } from "vitest";
import type {
  MonthlyClosing,
  EmployeeId,
  Yen,
  Minutes,
} from "@dgloss-kintai/contracts";
import {
  compareShadow,
  toShadowMismatchEvent,
  describeShadowRisk,
  ShadowComparisonMismatchError,
} from "./shadow.js";
import { mapMonthlyClosing } from "./mappers.js";
import type { IsoDateTime } from "@dgloss-kintai/contracts";

/** own 側 MonthlyClosing を組み立てる（テスト用・分/円はブランドへ cast）。 */
function makeOwn(premiumTotal: number, totalWorkedMinutes: number): MonthlyClosing {
  return {
    id: "mc_E001_202507" as MonthlyClosing["id"],
    employeeId: "E001" as EmployeeId,
    period: { year: 2025, month: 7 },
    status: "closed",
    totalWorkedMinutes: totalWorkedMinutes as Minutes,
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 600,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
    premium: {
      overtimeAllowance: premiumTotal as Yen,
      overtimeOver60Allowance: 0 as Yen,
      holidayAllowance: 0 as Yen,
      nightAllowance: 0 as Yen,
      total: premiumTotal as Yen,
    },
    fixedOvertimeAdditionalPayment: 0 as Yen,
    latenessDeduction: 0 as Yen,
    closedAt: "2025-08-01T00:00:00+09:00",
  };
}

/** jinjer 側の値を DTO 経由で組み立てる（ブランド cast を避ける）。 */
function makeJinjer(overtimeAllowance: number, totalWorkedMinutes: number) {
  return mapMonthlyClosing({
    staff_code: "E001",
    year: 2025,
    month: 7,
    total_working_minutes: totalWorkedMinutes,
    classified: {
      non_statutory_overtime_minutes: 0,
      statutory_overtime_minutes: 600,
      legal_holiday_minutes: 0,
      scheduled_holiday_minutes: 0,
      night_minutes: 0,
    },
    allowances: {
      overtime_allowance: overtimeAllowance,
      overtime_over60_allowance: 0,
      holiday_allowance: 0,
      night_allowance: 0,
    },
  });
}

describe("compareShadow", () => {
  it("完全一致なら matched=true, diff=0", () => {
    const c = compareShadow(makeOwn(12000, 9600), makeJinjer(12000, 9600));
    expect(c.matched).toBe(true);
    expect(c.premiumDiff).toBe(0);
    expect(c.workedMinutesDiff).toBe(0);
  });

  it("1 円差でも不一致（未払い方向: own < jinjer）", () => {
    const c = compareShadow(makeOwn(11999, 9600), makeJinjer(12000, 9600));
    expect(c.matched).toBe(false);
    expect(c.premiumDiff).toBe(-1);
  });

  it("大差を検出する（過払い方向: own > jinjer）", () => {
    const c = compareShadow(makeOwn(50000, 10000), makeJinjer(12000, 9600));
    expect(c.matched).toBe(false);
    expect(c.premiumDiff).toBe(38000);
    expect(c.workedMinutesDiff).toBe(400);
  });

  it("割増一致でも労働時間差があれば不一致", () => {
    const c = compareShadow(makeOwn(12000, 9601), makeJinjer(12000, 9600));
    expect(c.matched).toBe(false);
    expect(c.premiumDiff).toBe(0);
    expect(c.workedMinutesDiff).toBe(1);
  });

  it("従業員 ID 不一致は例外", () => {
    const own = makeOwn(12000, 9600);
    const jinjer = { ...makeJinjer(12000, 9600), employeeId: "E999" as EmployeeId };
    expect(() => compareShadow(own, jinjer)).toThrow(
      ShadowComparisonMismatchError,
    );
  });

  it("期間不一致は例外", () => {
    const own = makeOwn(12000, 9600);
    const jinjer = { ...makeJinjer(12000, 9600), period: { year: 2025, month: 6 } };
    expect(() => compareShadow(own, jinjer)).toThrow(
      ShadowComparisonMismatchError,
    );
  });
});

describe("toShadowMismatchEvent", () => {
  const at = "2025-08-01T00:00:00+09:00" as IsoDateTime;

  it("一致なら null", () => {
    const c = compareShadow(makeOwn(12000, 9600), makeJinjer(12000, 9600));
    expect(toShadowMismatchEvent(c, at)).toBeNull();
  });

  it("不一致ならイベントを返す", () => {
    const c = compareShadow(makeOwn(11999, 9600), makeJinjer(12000, 9600));
    const ev = toShadowMismatchEvent(c, at);
    expect(ev?.type).toBe("shadow.mismatch");
    expect(ev?.premiumDiff).toBe(-1);
  });
});

describe("describeShadowRisk", () => {
  it("一致なら null", () => {
    const c = compareShadow(makeOwn(12000, 9600), makeJinjer(12000, 9600));
    expect(describeShadowRisk(c)).toBeNull();
  });

  it("own < jinjer は未払いリスク文言", () => {
    const c = compareShadow(makeOwn(11999, 9600), makeJinjer(12000, 9600));
    expect(describeShadowRisk(c)).toContain("未払いリスク");
    expect(describeShadowRisk(c)).toContain("1 円少ない");
  });

  it("own > jinjer は過払いリスク文言", () => {
    const c = compareShadow(makeOwn(13000, 9600), makeJinjer(12000, 9600));
    expect(describeShadowRisk(c)).toContain("過払いリスク");
  });
});
