/**
 * ロール設定の取得・更新ユースケースのテスト。
 * 実在確認・最低1名・重複除去・締め出し防止を検証する。
 */

import { describe, expect, it } from "vitest";
import type { Employee, EmployeeId, IsoDateTime, Yen } from "@dgloss-kintai/contracts";
import { getRoleSettings } from "./getRoleSettings.js";
import { updateRoleSettings } from "./updateRoleSettings.js";
import {
  FixedClock,
  InMemoryEmployeeRepository,
  InMemoryRoleSettingsRepository,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;
const clock = new FixedClock("2026-07-27T10:00:00+09:00" as IsoDateTime);

function emp(code: string): Employee {
  return {
    id: `emp_${code}` as EmployeeId,
    employeeCode: code,
    name: `従業員 ${code}`,
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: asYen(300_000),
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: asYen(0),
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
}

function deps() {
  return {
    roleSettings: new InMemoryRoleSettingsRepository(),
    employees: new InMemoryEmployeeRepository([
      emp("0001"),
      emp("0002"),
      emp("0003"),
    ]),
    clock,
  };
}

describe("getRoleSettings", () => {
  it("未保存なら null（呼び出し側が env/既定へフォールバック）", async () => {
    const result = await getRoleSettings({
      roleSettings: new InMemoryRoleSettingsRepository(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});

describe("updateRoleSettings", () => {
  it("実在する社員番号を保存し、重複を除去する", async () => {
    const d = deps();
    const result = await updateRoleSettings(
      { adminEmployeeCodes: ["0001", "0002", "0001"] },
      d,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.adminEmployeeCodes).toEqual(["0001", "0002"]);

    const fetched = await getRoleSettings(d);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.value?.adminEmployeeCodes).toEqual(["0001", "0002"]);
  });

  it("空配列は validation エラー（最低1名必須・締め出し防止）", async () => {
    const result = await updateRoleSettings({ adminEmployeeCodes: [] }, deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });

  it("実在しない社員番号は validation エラー", async () => {
    const result = await updateRoleSettings(
      { adminEmployeeCodes: ["0001", "9999"] },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
    expect(result.error.message).toContain("9999");
  });
});
