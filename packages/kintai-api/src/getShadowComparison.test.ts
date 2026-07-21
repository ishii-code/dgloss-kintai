import { describe, it, expect } from "vitest";
import {
  getShadowComparison,
  type GetShadowComparisonDeps,
} from "./getShadowComparison.js";
import { InMemoryShadowComparisonRepository } from "./inMemory.js";
import { makeShadowComparison } from "./fixtures.js";

function makeDeps(): GetShadowComparisonDeps {
  return {
    shadowComparisons: new InMemoryShadowComparisonRepository([
      makeShadowComparison(
        "emp-1",
        { year: 2025, month: 7 },
        {
          ownPremiumTotal:
            12000 as ReturnType<typeof makeShadowComparison>["ownPremiumTotal"],
          jinjerPremiumTotal:
            11500 as ReturnType<typeof makeShadowComparison>["jinjerPremiumTotal"],
          premiumDiff: 500,
          matched: false,
        },
      ),
    ]),
  };
}

describe("getShadowComparison", () => {
  it("正常系: 突合結果（不一致）を返す", async () => {
    const result = await getShadowComparison(
      { employeeId: "emp-1", period: { year: 2025, month: 7 } },
      makeDeps(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.premiumDiff).toBe(500);
    expect(result.value.matched).toBe(false);
  });

  it("異常系: 突合結果が無ければ not_found", async () => {
    const result = await getShadowComparison(
      { employeeId: "emp-1", period: { year: 2025, month: 9 } },
      makeDeps(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("異常系: 不正な period は validation_error", async () => {
    const result = await getShadowComparison(
      { employeeId: "emp-1", period: { year: 1800, month: 7 } },
      makeDeps(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
