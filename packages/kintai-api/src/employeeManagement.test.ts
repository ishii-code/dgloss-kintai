/**
 * 従業員管理ユースケース（作成・更新・詳細・一覧・サマリ・CSV 往復）のユニットテスト。
 * in-memory 実装を注入し、正常系・重複／不正のエラー・CSV の往復同値を確認する。
 */

import { describe, it, expect } from "vitest";

import { createEmployee } from "./createEmployee.js";
import { updateEmployee } from "./updateEmployee.js";
import { getEmployeeDetail } from "./getEmployeeDetail.js";
import { listEmployeesDetailed } from "./listEmployeesDetailed.js";
import { employeeSummary, summarizeEmployees } from "./employeeSummary.js";
import { exportEmployeesCsv } from "./exportEmployeesCsv.js";
import { importEmployeesCsv } from "./importEmployeesCsv.js";
import { EMPLOYEE_CSV_HEADERS } from "./employeeCsv.js";
import { InMemoryEmployeeRepository, SequentialIdGenerator } from "./inMemory.js";
import { makeEmployee } from "./fixtures.js";

/** 有効な作成入力を作る。 */
function validInput(code: string, overrides: Record<string, unknown> = {}) {
  return {
    employeeCode: code,
    name: "田中 太郎",
    email: "tanaka@example.com",
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: 300000,
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: 0,
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
    ...overrides,
  };
}

describe("createEmployee", () => {
  it("正常系: 従業員を作成し id を採番して返す", async () => {
    const employees = new InMemoryEmployeeRepository();
    const ids = new SequentialIdGenerator();
    const result = await createEmployee(validInput("1001"), {
      employees,
      ids,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.employeeCode).toBe("1001");
    expect(result.value.id).toBe("stamp-emp-1");
    expect(await employees.findById(result.value.id)).not.toBeNull();
  });

  it("異常系: 社員番号重複は conflict", async () => {
    const employees = new InMemoryEmployeeRepository([
      makeEmployee("e1", { employeeCode: "1001" }),
    ]);
    const ids = new SequentialIdGenerator();
    const result = await createEmployee(validInput("1001"), { employees, ids });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("conflict");
  });

  it("異常系: 不正な勤務体系は validation_error", async () => {
    const employees = new InMemoryEmployeeRepository();
    const ids = new SequentialIdGenerator();
    const result = await createEmployee(
      validInput("1002", {
        contract: { ...validInput("1002").contract, workSystem: "unknown" },
      }),
      { employees, ids },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});

describe("updateEmployee", () => {
  it("正常系: 既存従業員を更新する", async () => {
    const employees = new InMemoryEmployeeRepository([
      makeEmployee("e1", { employeeCode: "1001", name: "旧名" }),
    ]);
    const result = await updateEmployee(
      { id: "e1", ...validInput("1001", { name: "新名" }) },
      { employees },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("新名");
  });

  it("異常系: 存在しない id は not_found", async () => {
    const employees = new InMemoryEmployeeRepository();
    const result = await updateEmployee(
      { id: "ghost", ...validInput("1001") },
      { employees },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("異常系: 他従業員と社員番号が衝突すると conflict", async () => {
    const employees = new InMemoryEmployeeRepository([
      makeEmployee("e1", { employeeCode: "1001" }),
      makeEmployee("e2", { employeeCode: "1002" }),
    ]);
    const result = await updateEmployee(
      { id: "e2", ...validInput("1001") },
      { employees },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("conflict");
  });
});

describe("getEmployeeDetail / listEmployeesDetailed", () => {
  it("詳細照会は契約含む全項目を返す", async () => {
    const employees = new InMemoryEmployeeRepository([makeEmployee("e1")]);
    const result = await getEmployeeDetail({ id: "e1" }, { employees });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contract.basicSalary).toBe(300000);
  });

  it("一覧は社員番号順で全件返す", async () => {
    const employees = new InMemoryEmployeeRepository([
      makeEmployee("e2", { employeeCode: "0002" }),
      makeEmployee("e1", { employeeCode: "0001" }),
    ]);
    const result = await listEmployeesDetailed({ employees });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((e) => e.employeeCode)).toEqual(["0001", "0002"]);
  });
});

describe("employeeSummary", () => {
  it("総数・在籍/退職・区分別・管理監督者を集計する", async () => {
    const employees = new InMemoryEmployeeRepository([
      makeEmployee("e1", { employeeCode: "1" }),
      makeEmployee("e2", {
        employeeCode: "2",
        retiredOn: "2025-03-31",
        contract: {
          ...makeEmployee("e2").contract,
          isManagerialEmployee: true,
          office: "corporate_sales",
        },
      }),
      makeEmployee("e3", {
        employeeCode: "3",
        contract: { ...makeEmployee("e3").contract, workSystem: "flex" },
      }),
    ]);
    const result = await employeeSummary({ employees });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.value;
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
    expect(s.retired).toBe(1);
    expect(s.managerialCount).toBe(1);
    expect(s.byWorkSystem.fixed).toBe(2);
    expect(s.byWorkSystem.flex).toBe(1);
    expect(s.byOffice.headquarters).toBe(2);
    expect(s.byOffice.corporate_sales).toBe(1);
  });

  it("summarizeEmployees は空配列でゼロ初期化する", () => {
    const s = summarizeEmployees([]);
    expect(s.total).toBe(0);
    expect(s.byWorkSystem.discretionary).toBe(0);
    expect(s.byEmploymentType.non_regular).toBe(0);
  });
});

describe("CSV export/import 往復", () => {
  it("export した CSV を import すると同値の従業員が復元される", async () => {
    const src = new InMemoryEmployeeRepository([
      makeEmployee("e1", {
        employeeCode: "1001",
        name: "山田, 花子",
        email: "hanako@example.com",
        contract: {
          ...makeEmployee("e1").contract,
          workSystem: "flex",
          office: "personal_sales",
          isManagerialEmployee: true,
          basicSalary: 420000 as never,
          fixedOvertimeAllowance: 50000 as never,
          fixedOvertimeCoverage: {
            overtime: true,
            overtimeOver60: false,
            holiday: true,
            night: false,
          },
        },
      }),
    ]);
    const exported = await exportEmployeesCsv({ employees: src });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    // ヘッダ行が列定義と一致する。
    expect(exported.value.split("\r\n")[0]).toBe(EMPLOYEE_CSV_HEADERS.join(","));

    const dst = new InMemoryEmployeeRepository();
    const ids = new SequentialIdGenerator();
    const result = await importEmployeesCsv(exported.value, {
      employees: dst,
      ids,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(1);
    expect(result.value.succeeded).toBe(1);
    expect(result.value.failed).toBe(0);

    const roundtrip = await dst.list();
    const original = (await src.list())[0];
    expect(original).toBeDefined();
    if (original === undefined) return;
    // id 以外が同値（社員番号・氏名・契約）で復元される。
    const { id: _oid, ...origRest } = original;
    const first = roundtrip[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const { id: _nid, ...newRest } = first;
    expect(newRest).toEqual(origRest);
  });

  it("再取込は社員番号で id を引き継ぎ更新になる（件数が増えない）", async () => {
    const dst = new InMemoryEmployeeRepository();
    const ids = new SequentialIdGenerator();
    const src = new InMemoryEmployeeRepository([
      makeEmployee("e1", { employeeCode: "1001" }),
    ]);
    const exported = await exportEmployeesCsv({ employees: src });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    await importEmployeesCsv(exported.value, { employees: dst, ids });
    await importEmployeesCsv(exported.value, { employees: dst, ids });
    expect((await dst.list()).length).toBe(1);
  });

  it("不正行は失敗として行番号付きで報告し、正常行は取り込む", async () => {
    const header = EMPLOYEE_CSV_HEADERS.join(",");
    const good =
      "1001,田中,t@example.com,2024-04-01,,正社員,固定時間制,本社,いいえ,300000,1920,0,いいえ,いいえ,いいえ,いいえ";
    const bad =
      "1002,佐藤,,2024-04-01,,正社員,謎の体系,本社,いいえ,300000,1920,0,いいえ,いいえ,いいえ,いいえ";
    const csv = [header, good, bad].join("\r\n");
    const dst = new InMemoryEmployeeRepository();
    const ids = new SequentialIdGenerator();
    const result = await importEmployeesCsv(csv, { employees: dst, ids });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(2);
    expect(result.value.succeeded).toBe(1);
    expect(result.value.failed).toBe(1);
    expect(result.value.errors[0]?.row).toBe(3);
  });

  it("ヘッダが不正な CSV は validation_error", async () => {
    const dst = new InMemoryEmployeeRepository();
    const ids = new SequentialIdGenerator();
    const result = await importEmployeesCsv("誤ったヘッダ\n1,2", {
      employees: dst,
      ids,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
