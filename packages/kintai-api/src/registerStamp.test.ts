import { describe, it, expect } from "vitest";
import { registerStamp, type RegisterStampDeps } from "./registerStamp.js";
import {
  InMemoryEmployeeRepository,
  InMemoryStampRepository,
  SequentialIdGenerator,
} from "./inMemory.js";
import { makeEmployee } from "./fixtures.js";

function makeDeps(): {
  deps: RegisterStampDeps;
  stamps: InMemoryStampRepository;
} {
  const stamps = new InMemoryStampRepository();
  const deps: RegisterStampDeps = {
    stamps,
    employees: new InMemoryEmployeeRepository([makeEmployee("emp-1")]),
    ids: new SequentialIdGenerator(),
  };
  return { deps, stamps };
}

const validInput = {
  employeeId: "emp-1",
  type: "clock_in",
  stampedAt: "2025-07-01T09:00:00+09:00",
  source: "manual",
  note: null,
};

describe("registerStamp", () => {
  it("正常系: 打刻を登録し ID・source を確定して返す", async () => {
    const { deps, stamps } = makeDeps();
    const result = await registerStamp(validInput, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe("stamp-1");
    expect(result.value.type).toBe("clock_in");
    expect(result.value.employeeId).toBe("emp-1");
    expect(result.value.note).toBeNull();
    expect(stamps.all()).toHaveLength(1);
  });

  it("note 未指定でも null に正規化される", async () => {
    const { deps } = makeDeps();
    const { note, ...withoutNote } = validInput;
    const result = await registerStamp(withoutNote, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.note).toBeNull();
  });

  it("異常系: 不正な打刻種別は validation_error（zod エラーが Result.error に落ちる）", async () => {
    const { deps, stamps } = makeDeps();
    const result = await registerStamp(
      { ...validInput, type: "teleport" },
      deps,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
    expect(result.error.details?.some((d) => d.path === "type")).toBe(true);
    expect(stamps.all()).toHaveLength(0);
  });

  it("異常系: TZ なしの時刻は validation_error", async () => {
    const { deps } = makeDeps();
    const result = await registerStamp(
      { ...validInput, stampedAt: "2025-07-01T09:00:00" },
      deps,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
    expect(result.error.details?.some((d) => d.path === "stampedAt")).toBe(
      true,
    );
  });

  it("異常系: 存在しない従業員は not_found", async () => {
    const { deps } = makeDeps();
    const result = await registerStamp(
      { ...validInput, employeeId: "ghost" },
      deps,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("異常系: 入力が object でない場合も validation_error", async () => {
    const { deps } = makeDeps();
    const result = await registerStamp(null, deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
