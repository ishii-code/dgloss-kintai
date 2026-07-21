import { describe, it, expect } from "vitest";
import { listEmployees } from "./listEmployees.js";
import { InMemoryEmployeeRepository } from "./inMemory.js";
import { makeEmployee } from "./fixtures.js";

describe("InMemoryEmployeeRepository.list", () => {
  it("社員番号昇順で全従業員を返す", async () => {
    const repo = new InMemoryEmployeeRepository([
      makeEmployee("emp_3", { employeeCode: "0003" }),
      makeEmployee("emp_1", { employeeCode: "0001" }),
      makeEmployee("emp_2", { employeeCode: "0002" }),
    ]);
    const list = await repo.list();
    expect(list.map((e) => e.employeeCode)).toEqual(["0001", "0002", "0003"]);
  });

  it("空なら空配列", async () => {
    const repo = new InMemoryEmployeeRepository([]);
    expect(await repo.list()).toEqual([]);
  });
});

describe("listEmployees", () => {
  it("全従業員を成功で返す", async () => {
    const employees = new InMemoryEmployeeRepository([
      makeEmployee("emp_1", { employeeCode: "0001" }),
      makeEmployee("emp_2", { employeeCode: "0002" }),
    ]);
    const result = await listEmployees({ employees });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((e) => e.id)).toEqual(["emp_1", "emp_2"]);
    }
  });
});
