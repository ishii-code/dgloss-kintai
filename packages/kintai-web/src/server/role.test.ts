/**
 * 役割解決（role.ts）のユニットテスト。
 *
 * allowlist 判定・既定フォールバック・空 env の扱い、および env 依存の resolveRole を検証する。
 */

import { afterEach, describe, it, expect } from "vitest";

import {
  ADMIN_CODES_ENV,
  DEFAULT_ADMIN_EMPLOYEE_CODES,
  parseAdminCodes,
  resolveRole,
  resolveRoleWith,
} from "./role";

describe("parseAdminCodes", () => {
  it("undefined は既定 allowlist を返す", () => {
    expect(parseAdminCodes(undefined)).toEqual(DEFAULT_ADMIN_EMPLOYEE_CODES);
  });

  it("空文字・空白のみは既定へフォールバックする", () => {
    expect(parseAdminCodes("")).toEqual(DEFAULT_ADMIN_EMPLOYEE_CODES);
    expect(parseAdminCodes("   ")).toEqual(DEFAULT_ADMIN_EMPLOYEE_CODES);
    expect(parseAdminCodes(" , , ")).toEqual(DEFAULT_ADMIN_EMPLOYEE_CODES);
  });

  it("カンマ区切りを trim し空要素を除いて返す", () => {
    expect(parseAdminCodes("0001, 0002 ,,0003")).toEqual([
      "0001",
      "0002",
      "0003",
    ]);
  });
});

describe("resolveRoleWith", () => {
  it("allowlist に含まれれば admin", () => {
    expect(resolveRoleWith("0001", ["0001", "0002"])).toBe("admin");
  });

  it("含まれなければ general", () => {
    expect(resolveRoleWith("0009", ["0001", "0002"])).toBe("general");
  });

  it("空 allowlist は常に general", () => {
    expect(resolveRoleWith("0001", [])).toBe("general");
  });
});

describe("resolveRole（env 依存）", () => {
  const original = process.env[ADMIN_CODES_ENV];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ADMIN_CODES_ENV];
    } else {
      process.env[ADMIN_CODES_ENV] = original;
    }
  });

  it("env 未設定なら既定（0001 が admin・他は general）", () => {
    delete process.env[ADMIN_CODES_ENV];
    expect(resolveRole("0001")).toBe("admin");
    expect(resolveRole("0002")).toBe("general");
  });

  it("env で allowlist を上書きできる", () => {
    process.env[ADMIN_CODES_ENV] = "0003,0004";
    expect(resolveRole("0003")).toBe("admin");
    expect(resolveRole("0004")).toBe("admin");
    // 既定の 0001 は上書き後は admin ではない。
    expect(resolveRole("0001")).toBe("general");
  });

  it("空 env は既定へフォールバックする", () => {
    process.env[ADMIN_CODES_ENV] = "";
    expect(resolveRole("0001")).toBe("admin");
  });
});
