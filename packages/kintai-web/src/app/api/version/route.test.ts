/**
 * /api/version ルートハンドラの結合テスト。
 * ビルド識別子と表示バージョンを返すことを確認する（認可不要）。
 */

import { describe, it, expect } from "vitest";

import { GET } from "./route";
import { APP_VERSION } from "@/lib/version";

describe("GET /api/version", () => {
  it("200 で buildId と version を返す", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      buildId: string;
      version: string;
    };
    expect(typeof json.buildId).toBe("string");
    expect(json.buildId.length).toBeGreaterThan(0);
    expect(json.version).toBe(APP_VERSION);
  });
});
