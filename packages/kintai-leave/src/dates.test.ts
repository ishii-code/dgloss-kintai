import { describe, expect, it } from "vitest";
import { addYears, compareIso } from "./dates.js";

describe("addYears", () => {
  it("付与日+2年で時効消滅日を算出する", () => {
    expect(addYears("2025-04-01", 2)).toBe("2027-04-01");
  });

  it("付与日+1年で義務履行期限を算出する", () => {
    expect(addYears("2025-04-01", 1)).toBe("2026-04-01");
  });

  it("2月29日は存在しない年で翌月へ繰り上げる", () => {
    // 2024-02-29 + 1年 → 2025-02-29 は存在しない → 2025-03-01。
    expect(addYears("2024-02-29", 1)).toBe("2025-03-01");
    // 閏年→閏年はそのまま。
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("不正な日付文字列は例外", () => {
    expect(() => addYears("2025/04/01", 1)).toThrow();
  });
});

describe("compareIso", () => {
  it("暦日の時系列を比較する", () => {
    expect(compareIso("2025-04-01", "2025-04-02")).toBeLessThan(0);
    expect(compareIso("2025-04-02", "2025-04-01")).toBeGreaterThan(0);
    expect(compareIso("2025-04-01", "2025-04-01")).toBe(0);
  });
});
