import { describe, it, expect } from "vitest";
import {
  demoEmployeeNames,
  formatShadowReport,
  runShadowDemo,
} from "./demo.js";
import { buildDemoScenarios } from "./fixtures.js";

describe("runShadowDemo", () => {
  it("全シナリオを突合する（欠損なし・総件数=シナリオ数）", async () => {
    const result = await runShadowDemo();
    expect(result.total).toBe(buildDemoScenarios().length);
    expect(result.missingCount).toBe(0);
    // 突合できた件数 = 一致 + 不一致（欠損は含まない）。
    expect(result.comparisons).toHaveLength(
      result.matchedCount + result.mismatchedCount,
    );
  });

  it("一致ケース（delta=0）は matched、意図した未払いケース（delta=+1）を検出", async () => {
    const result = await runShadowDemo();
    // delta=0 のシナリオが2件 → 一致2件、delta=+1 が1件 → 不一致1件。
    expect(result.matchedCount).toBe(2);
    expect(result.mismatchedCount).toBe(1);
    expect(result.underpaymentCount).toBeGreaterThanOrEqual(1);
    expect(result.overpaymentCount).toBe(0);
    expect(result.hasMismatch).toBe(true);
    // 未払いケースは own < jinjer（premiumDiff < 0）で乖離1円。
    expect(result.mismatches[0]?.premiumDiff).toBe(-1);
    expect(result.maxAbsolutePremiumDiff).toBe(1);
  });

  it("不一致件数と不一致イベント数が一致する", async () => {
    const result = await runShadowDemo();
    expect(result.mismatchEvents).toHaveLength(result.mismatchedCount);
    expect(result.mismatchEvents[0]?.type).toBe("shadow.mismatch");
  });

  it("決定的: 固定時計注入で2回実行しても同一結果", async () => {
    const a = await runShadowDemo();
    const b = await runShadowDemo();
    expect(a).toStrictEqual(b);
  });

  it("自作締めの割増が実際に正（テストが空回りしていない）", async () => {
    const result = await runShadowDemo();
    // 一致した従業員でも割増合計は正のはず（時間外・深夜が発生する現実的入力）。
    const positives = result.comparisons.filter((c) => c.ownPremiumTotal > 0);
    expect(positives.length).toBeGreaterThan(0);
  });
});

describe("formatShadowReport", () => {
  it("集計値をレポート文字列に反映する", async () => {
    const result = await runShadowDemo();
    const report = formatShadowReport(result, {
      employeeNames: demoEmployeeNames(),
    });
    expect(report).toContain("2025-07");
    expect(report).toContain(`総件数            : ${result.total}`);
    expect(report).toContain(`不一致            : ${result.mismatchedCount}`);
    expect(report).toContain("不一致あり（要確認）");
    // 未払い方向の明細に従業員名が添えられる。
    expect(report).toContain("未払い方向");
    expect(report).toContain("佐藤 花子");
  });

  it("employeeNames 省略時は従業員 ID のみで明細を出す", async () => {
    const result = await runShadowDemo();
    const report = formatShadowReport(result);
    expect(report).toContain("E002");
    expect(report).not.toContain("佐藤 花子");
  });
});
