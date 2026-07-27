/**
 * buildLeaveBalance のテスト（労基法第39条・就業規則第61条）。
 * 入社日からの付与スケジュールと、WorkDay の休暇区分からの取得を検証する。
 */

import { describe, expect, it } from "vitest";
import { addMonths, buildLeaveBalance } from "./leaveBalance.js";
import { makeEmployee, makeWorkDay } from "./testFixtures.js";

describe("addMonths", () => {
  it("月を加算する（年跨ぎ）", () => {
    expect(addMonths("2024-04-01", 6)).toBe("2024-10-01");
    expect(addMonths("2024-04-01", 18)).toBe("2025-10-01");
    expect(addMonths("2024-11-15", 3)).toBe("2025-02-15");
  });
});

describe("buildLeaveBalance", () => {
  it("入社6か月で10日付与される", () => {
    const employee = makeEmployee("A", {}, { hiredOn: "2024-04-01" });
    // 基準日は初回付与日（6か月後）当日。
    const result = buildLeaveBalance(employee, [], "2024-10-01");
    expect(result.balance.grantedDays).toBe(10);
    expect(result.balance.remainingDays).toBe(10);
    expect(result.balance.takenDays).toBe(0);
  });

  it("6か月未満は付与ゼロ", () => {
    const employee = makeEmployee("B", {}, { hiredOn: "2024-04-01" });
    const result = buildLeaveBalance(employee, [], "2024-09-30");
    expect(result.balance.grantedDays).toBe(0);
    expect(result.balance.remainingDays).toBe(0);
    expect(result.balance.currentYear).toBeNull();
  });

  it("1年6か月で累計21日（10+11）付与される", () => {
    const employee = makeEmployee("C", {}, { hiredOn: "2024-04-01" });
    const result = buildLeaveBalance(employee, [], "2025-10-01");
    expect(result.balance.grantedDays).toBe(21);
  });

  it("WorkDay の paid_full/paid_half を取得として数える", () => {
    const employee = makeEmployee("D", {}, { hiredOn: "2024-04-01" });
    const workDays = [
      makeWorkDay("D", "2024-10-10"),
      makeWorkDay("D", "2024-10-11"),
    ];
    // 休暇区分を上書き（全日1件・半日1件）。
    const withLeave = [
      { ...workDays[0]!, leave: "paid_full" as const },
      { ...workDays[1]!, leave: "paid_half" as const },
    ];
    const result = buildLeaveBalance(employee, withLeave, "2024-12-31");
    // 全日1 + 半日0.5 = 1.5日消化。残 10 - 1.5 = 8.5。
    expect(result.balance.takenDays).toBe(1.5);
    expect(result.balance.remainingDays).toBe(8.5);
  });

  it("年10日以上付与で5日取得義務が発生し、未取得なら未達", () => {
    const employee = makeEmployee("E", {}, { hiredOn: "2024-04-01" });
    const result = buildLeaveBalance(employee, [], "2024-11-01");
    expect(result.obligation.obligated).toBe(true);
    expect(result.obligation.requiredDays).toBe(5);
    expect(result.obligation.remainingObligationDays).toBe(5);
    expect(result.obligation.unmet).toBe(true);
  });

  it("義務期間に5日取得済みなら義務は達成", () => {
    const employee = makeEmployee("F", {}, { hiredOn: "2024-04-01" });
    const takes = ["2024-10-07", "2024-10-08", "2024-10-09", "2024-10-10", "2024-10-11"].map(
      (date) => ({ ...makeWorkDay("F", date), leave: "paid_full" as const }),
    );
    const result = buildLeaveBalance(employee, takes, "2024-12-31");
    expect(result.obligation.takenDays).toBe(5);
    expect(result.obligation.unmet).toBe(false);
  });

  it("年次有給以外の休暇（欠勤・特別休暇）は消化に数えない", () => {
    const employee = makeEmployee("G", {}, { hiredOn: "2024-04-01" });
    const days = [
      { ...makeWorkDay("G", "2024-10-10"), leave: "absence" as const },
      { ...makeWorkDay("G", "2024-10-11"), leave: "special" as const },
    ];
    const result = buildLeaveBalance(employee, days, "2024-12-31");
    expect(result.balance.takenDays).toBe(0);
    expect(result.balance.remainingDays).toBe(10);
  });
});
