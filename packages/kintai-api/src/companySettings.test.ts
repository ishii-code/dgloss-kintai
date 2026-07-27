/**
 * 企業設定の取得・更新ユースケースのテスト。
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "@dgloss-kintai/contracts";
import { getCompanySettings } from "./getCompanySettings.js";
import { updateCompanySettings } from "./updateCompanySettings.js";
import { FixedClock, InMemoryCompanySettingsRepository } from "./inMemory.js";
import type { IsoDateTime } from "@dgloss-kintai/contracts";

const clock = new FixedClock("2026-07-27T10:00:00+09:00" as IsoDateTime);

describe("getCompanySettings", () => {
  it("未保存なら既定を返す", async () => {
    const result = await getCompanySettings({
      companySettings: new InMemoryCompanySettingsRepository(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fiscalYearStartMonth).toBe(
      DEFAULT_COMPANY_SETTINGS.fiscalYearStartMonth,
    );
  });
});

describe("updateCompanySettings", () => {
  it("有効な入力を保存し、以降 get で取得できる", async () => {
    const repo = new InMemoryCompanySettingsRepository();
    const updated = await updateCompanySettings(
      {
        companyName: "テスト株式会社",
        representativeName: "代表 太郎",
        address: "東京都",
        fiscalYearStartMonth: 1,
      },
      { companySettings: repo, clock },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.companyName).toBe("テスト株式会社");
    expect(updated.value.fiscalYearStartMonth).toBe(1);
    expect(updated.value.updatedAt).toBe("2026-07-27T10:00:00+09:00");

    const fetched = await getCompanySettings({ companySettings: repo });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.value.companyName).toBe("テスト株式会社");
  });

  it("会社名が空なら validation エラー", async () => {
    const result = await updateCompanySettings(
      {
        companyName: "",
        representativeName: "",
        address: "",
        fiscalYearStartMonth: 4,
      },
      { companySettings: new InMemoryCompanySettingsRepository(), clock },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });

  it("年度開始月が範囲外なら validation エラー", async () => {
    const result = await updateCompanySettings(
      {
        companyName: "会社",
        representativeName: "",
        address: "",
        fiscalYearStartMonth: 13,
      },
      { companySettings: new InMemoryCompanySettingsRepository(), clock },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
