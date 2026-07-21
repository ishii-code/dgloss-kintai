import { describe, it, expect } from "vitest";
import type { ApiErrorCode } from "@dgloss-kintai/api";

import { apiErrorStatus, OK_STATUS } from "./httpStatus";

describe("apiErrorStatus", () => {
  it("各 ApiErrorCode を対応する HTTP ステータスへ写す", () => {
    const cases: ReadonlyArray<readonly [ApiErrorCode, number]> = [
      ["validation_error", 400],
      ["not_found", 404],
      ["conflict", 409],
      ["internal_error", 500],
    ];
    for (const [code, status] of cases) {
      expect(apiErrorStatus(code)).toBe(status);
    }
  });

  it("成功ステータスは 200", () => {
    expect(OK_STATUS).toBe(200);
  });
});
