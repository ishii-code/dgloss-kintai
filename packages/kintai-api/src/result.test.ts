import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ok, err, validationError, notFoundError } from "./result.js";

describe("Result helpers", () => {
  it("ok は成功の Result を作る", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it("err は失敗の Result を作る", () => {
    const r = err({ code: "internal_error", message: "boom" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("internal_error");
  });

  it("validationError は zod の issues をフィールド詳細に変換する", () => {
    const schema = z.object({ n: z.number().int() });
    const parsed = schema.safeParse({ n: 1.5 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const apiError = validationError(parsed.error);
    expect(apiError.code).toBe("validation_error");
    expect(apiError.details?.[0]?.path).toBe("n");
  });

  it("notFoundError は not_found コードを付ける", () => {
    expect(notFoundError("なし").code).toBe("not_found");
  });
});
