/**
 * ユースケース: 企業設定の取得。
 *
 * 保存済みの企業設定を返す。未保存なら既定（DEFAULT_COMPANY_SETTINGS）を返す。
 * 常に成功する（設定は必ず既定へフォールバックできる）。
 */

import { DEFAULT_COMPANY_SETTINGS } from "@dgloss-kintai/contracts";
import type { CompanySettings } from "@dgloss-kintai/contracts";
import type { CompanySettingsRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** getCompanySettings の依存。 */
export interface GetCompanySettingsDeps {
  readonly companySettings: CompanySettingsRepository;
}

/** 企業設定を取得する（未保存は既定）。 */
export async function getCompanySettings(
  deps: GetCompanySettingsDeps,
): Promise<Result<CompanySettings>> {
  const stored = await deps.companySettings.get();
  return ok(stored ?? DEFAULT_COMPANY_SETTINGS);
}
