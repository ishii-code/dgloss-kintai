/**
 * ユースケース: 企業設定の更新（管理者専用・呼び出し側で認可）。
 *
 * 入力を companySettingsInputSchema で検証し、更新時刻を付与して保存する。
 */

import { companySettingsInputSchema } from "@dgloss-kintai/contracts";
import type { CompanySettings } from "@dgloss-kintai/contracts";
import type { Clock, CompanySettingsRepository } from "./ports.js";
import { err, ok, validationError, type Result } from "./result.js";

/** updateCompanySettings の依存。 */
export interface UpdateCompanySettingsDeps {
  readonly companySettings: CompanySettingsRepository;
  readonly clock: Clock;
}

/**
 * 企業設定を更新する。
 *
 * @param input 更新入力（未検証の unknown）
 * @param deps  リポジトリ・時刻 port
 */
export async function updateCompanySettings(
  input: unknown,
  deps: UpdateCompanySettingsDeps,
): Promise<Result<CompanySettings>> {
  const parsed = companySettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "企業設定の入力が不正です"));
  }

  const settings: CompanySettings = {
    companyName: parsed.data.companyName,
    representativeName: parsed.data.representativeName,
    address: parsed.data.address,
    fiscalYearStartMonth: parsed.data.fiscalYearStartMonth,
    updatedAt: deps.clock.now(),
  };

  await deps.companySettings.save(settings);
  return ok(settings);
}
