import { describe, it, expect } from "vitest";
import {
  buildMigrationEmployeeDtos,
  formatMigrationReport,
  runMigrationDemo,
  StubEmployeeTransport,
} from "./migrateDemo.js";

describe("runMigrationDemo", () => {
  it("フィクスチャ全件を pull し、失敗 1 件を除いて投入する", async () => {
    const demo = await runMigrationDemo();
    const total = buildMigrationEmployeeDtos().length;
    // total = succeeded + failed が常に成り立つ。
    expect(demo.result.total).toBe(total);
    expect(demo.result.succeeded + demo.result.failed).toBe(demo.result.total);
    // E404 の 1 件だけ sink が拒否する想定。
    expect(demo.result.failed).toBe(1);
    expect(demo.result.succeeded).toBe(total - 1);
  });

  it("失敗明細に投入不可の社員番号を記録する", async () => {
    const demo = await runMigrationDemo();
    expect(demo.result.failures).toHaveLength(1);
    expect(demo.result.failures[0]?.id).toBe("E404");
    expect(demo.result.failures[0]?.error).toContain("DB 制約違反");
  });

  it("投入済み従業員に失敗分は含まれない（成功件数と一致）", async () => {
    const demo = await runMigrationDemo();
    expect(demo.upserted).toHaveLength(demo.result.succeeded);
    const codes = demo.upserted.map((e) => e.employeeCode);
    expect(codes).not.toContain("E404");
    expect(codes).toContain("E001");
  });

  it("pull は本物同様に zod 検証・マッパーを通過する（契約情報が写像される）", async () => {
    const demo = await runMigrationDemo();
    const e003 = demo.upserted.find((e) => e.employeeCode === "E003");
    // work_system "4" → discretionary、is_managerial true が写像されている。
    expect(e003?.contract.workSystem).toBe("discretionary");
    expect(e003?.contract.isManagerialEmployee).toBe(true);
  });

  it("決定的: 2 回実行しても同一結果", async () => {
    const a = await runMigrationDemo();
    const b = await runMigrationDemo();
    expect(a).toStrictEqual(b);
  });
});

describe("formatMigrationReport", () => {
  it("集計値と失敗明細をレポート文字列に反映する", async () => {
    const demo = await runMigrationDemo();
    const report = formatMigrationReport(demo);
    expect(report).toContain(`総件数            : ${demo.result.total}`);
    expect(report).toContain(`失敗              : ${demo.result.failed}`);
    expect(report).toContain("一部失敗あり（要確認）");
    expect(report).toContain("E404");
    expect(report).toContain("山田");
  });
});

describe("StubEmployeeTransport", () => {
  it("employees 以外のパスは拒否する（誤配線検出）", async () => {
    const transport = new StubEmployeeTransport([]);
    await expect(transport.request({ method: "GET", path: "stamps" })).rejects.toThrow(
      "employees のみ対応",
    );
  });
});
