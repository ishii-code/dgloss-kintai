/**
 * 従業員 CSV の列定義テスト。
 * 事業部列の追加と、旧 16 列 CSV（事業部なし）の後方互換を検証する。
 */

import { describe, expect, it } from "vitest";
import type { Employee, EmployeeId, Yen } from "@dgloss-kintai/contracts";
import {
  EMPLOYEE_CSV_HEADERS,
  csvFieldsToRawInput,
  employeeToCsvFields,
  validateCsvHeader,
} from "./employeeCsv.js";

const LEGACY_HEADERS = EMPLOYEE_CSV_HEADERS.slice(0, -1); // 事業部を除いた旧 16 列。

function emp(department?: string): Employee {
  const base: Employee = {
    id: "e1" as EmployeeId,
    employeeCode: "1001",
    name: "田中 太郎",
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: 300_000 as Yen,
      annualScheduledWorkingHours: 1900,
      fixedOvertimeAllowance: 0 as Yen,
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
  return department === undefined ? base : { ...base, department };
}

describe("employeeCsv 事業部列", () => {
  it("ヘッダ最後が『事業部』で全 17 列", () => {
    expect(EMPLOYEE_CSV_HEADERS).toHaveLength(17);
    expect(EMPLOYEE_CSV_HEADERS[EMPLOYEE_CSV_HEADERS.length - 1]).toBe("事業部");
  });

  it("export は事業部を最終列に出す", () => {
    const fields = employeeToCsvFields(emp("パートナー事業部"));
    expect(fields).toHaveLength(17);
    expect(fields[16]).toBe("パートナー事業部");
  });

  it("事業部未設定は空文字で出す", () => {
    expect(employeeToCsvFields(emp())[16]).toBe("");
  });

  it("17 列ヘッダ（事業部あり）を検証 OK", () => {
    expect(validateCsvHeader([...EMPLOYEE_CSV_HEADERS])).toBeNull();
  });

  it("旧 16 列ヘッダ（事業部なし）も後方互換で検証 OK", () => {
    expect(validateCsvHeader([...LEGACY_HEADERS])).toBeNull();
  });

  it("列数が 16/17 以外はエラー", () => {
    expect(validateCsvHeader(EMPLOYEE_CSV_HEADERS.slice(0, 10))).not.toBeNull();
  });

  it("17 列目の値が事業部として取り込まれる", () => {
    const fields = employeeToCsvFields(emp("AIテレアポ事業部"));
    const raw = csvFieldsToRawInput(fields) as { department?: unknown };
    expect(raw.department).toBe("AIテレアポ事業部");
  });

  it("旧 16 列（事業部なし）は department が undefined", () => {
    const fields = employeeToCsvFields(emp()).slice(0, 16);
    const raw = csvFieldsToRawInput(fields) as { department?: unknown };
    expect(raw.department).toBeUndefined();
  });
});
