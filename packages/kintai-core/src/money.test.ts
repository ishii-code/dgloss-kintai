import { describe, it, expect } from "vitest";
import { ceilDiv, floorDiv } from "./money.js";

describe("ceilDiv — 切り上げ整数除算（第20条3項5号）", () => {
  it("割り切れないときは切り上げる", () => {
    expect(ceilDiv(10n, 3n)).toBe(4n);
    expect(ceilDiv(1n, 19n)).toBe(1n);
  });

  it("割り切れるときはそのまま", () => {
    expect(ceilDiv(9n, 3n)).toBe(3n);
  });

  it("分子 0 は 0", () => {
    expect(ceilDiv(0n, 19n)).toBe(0n);
  });

  it("分母が 0 以下なら例外", () => {
    expect(() => ceilDiv(1n, 0n)).toThrow(RangeError);
    expect(() => ceilDiv(1n, -1n)).toThrow(RangeError);
  });

  it("分子が負なら例外", () => {
    expect(() => ceilDiv(-1n, 3n)).toThrow(RangeError);
  });

  it("巨大な値でも誤差なく計算できる（bigint）", () => {
    // 2,700,000 / 19 = 142105.26 → 142106
    expect(ceilDiv(2_700_000n, 19n)).toBe(142_106n);
  });
});

describe("floorDiv — 切り捨て整数除算（第21条2項）", () => {
  it("割り切れないときは切り捨てる", () => {
    expect(floorDiv(10n, 3n)).toBe(3n);
    expect(floorDiv(18n, 19n)).toBe(0n);
  });

  it("割り切れるときはそのまま", () => {
    expect(floorDiv(9n, 3n)).toBe(3n);
  });

  it("分子 0 は 0", () => {
    expect(floorDiv(0n, 19n)).toBe(0n);
  });

  it("分母が 0 以下なら例外", () => {
    expect(() => floorDiv(1n, 0n)).toThrow(RangeError);
  });

  it("分子が負なら例外", () => {
    expect(() => floorDiv(-1n, 3n)).toThrow(RangeError);
  });
});
