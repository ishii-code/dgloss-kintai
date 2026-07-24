/**
 * バージョン比較（純粋関数）のユニットテスト。
 */

import { describe, it, expect } from "vitest";

import { isNewerBuild } from "./version";

describe("isNewerBuild", () => {
  it("識別子が異なれば true（別デプロイ）", () => {
    expect(isNewerBuild("abc123", "def456")).toBe(true);
  });

  it("識別子が同じなら false", () => {
    expect(isNewerBuild("abc123", "abc123")).toBe(false);
  });

  it("いずれかが空文字なら false（未取得は更新扱いしない）", () => {
    expect(isNewerBuild("", "def456")).toBe(false);
    expect(isNewerBuild("abc123", "")).toBe(false);
  });
});
