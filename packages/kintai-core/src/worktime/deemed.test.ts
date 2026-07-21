import { describe, it, expect } from "vitest";
import { deemedWorkMinutes } from "./deemed.js";

/**
 * 事業場外みなし労働（就業規則第50条・第72条）を手計算した期待値で検証する。
 * 実労働時間に関わらず、みなし時間（既定＝所定労働時間）を計上し、原則として時間外は 0。
 */

describe("deemedWorkMinutes — 原則（みなし＝所定）", () => {
  it("所定 8h(480)・実労働が 5h でも所定 8h みなし → 時間外 0・深夜 0", () => {
    // 実 5h 勤務は入力に現れない（算定し難いため）。出力は所定 480 分基準。
    const r = deemedWorkMinutes(480);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
    expect(r.statutoryOvertimeMinutes).toBe(0);
    expect(r.legalHolidayMinutes).toBe(0);
    expect(r.scheduledHolidayMinutes).toBe(0);
    expect(r.nightMinutes).toBe(0);
  });

  it("所定 7h(420) → 時間外 0（8h 未満でも所定どおりみなし）", () => {
    const r = deemedWorkMinutes(420);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
    expect(r.statutoryOvertimeMinutes).toBe(0);
  });
});

describe("deemedWorkMinutes — 労使協定でみなし時間 > 所定", () => {
  it("所定 7h(420)・みなし 8h(480) → 法定内残業 60 分（法定外 0）", () => {
    const r = deemedWorkMinutes(420, { deemedMinutes: 480 });
    // min(480,480) − 420 = 60、法定外 = max(0,480−480)=0
    expect(r.nonStatutoryOvertimeMinutes).toBe(60);
    expect(r.statutoryOvertimeMinutes).toBe(0);
  });

  it("所定 8h(480)・みなし 9h(540) → 法定外 60 分（法定内残業 0）", () => {
    const r = deemedWorkMinutes(480, { deemedMinutes: 540 });
    // max(0,540−480)=60、min(540,480)−480=0
    expect(r.statutoryOvertimeMinutes).toBe(60);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
  });

  it("所定 7h(420)・みなし 9h(540) → 法定内残業 60（480−420）＋法定外 60（540−480）", () => {
    const r = deemedWorkMinutes(420, { deemedMinutes: 540 });
    expect(r.nonStatutoryOvertimeMinutes).toBe(60);
    expect(r.statutoryOvertimeMinutes).toBe(60);
  });
});

describe("deemedWorkMinutes — 深夜が明確な場合", () => {
  it("深夜実績 120 分を別途計上（みなし時間からは推定しない）", () => {
    const r = deemedWorkMinutes(480, { nightMinutes: 120 });
    expect(r.nightMinutes).toBe(120);
    // みなし＝所定のため時間外は 0 のまま。
    expect(r.statutoryOvertimeMinutes).toBe(0);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
  });
});

describe("deemedWorkMinutes — 入力バリデーション", () => {
  it("所定が負なら RangeError", () => {
    expect(() => deemedWorkMinutes(-1)).toThrow(RangeError);
  });
  it("非整数の所定は RangeError", () => {
    expect(() => deemedWorkMinutes(100.5)).toThrow(RangeError);
  });
  it("負のみなし時間は RangeError", () => {
    expect(() => deemedWorkMinutes(480, { deemedMinutes: -1 })).toThrow(
      RangeError,
    );
  });
  it("負の深夜時間は RangeError", () => {
    expect(() => deemedWorkMinutes(480, { nightMinutes: -1 })).toThrow(
      RangeError,
    );
  });
});
