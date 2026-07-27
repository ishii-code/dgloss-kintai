/**
 * 企業設定（シングルトン）の Prisma 永続化。
 * ドメイン型（contracts.CompanySettings）と Prisma 行を相互変換する。raw SQL は使わない。
 */

import type { CompanySettings, IsoDateTime } from "@dgloss-kintai/contracts";
import type { PrismaClient } from "@prisma/client";
import { dateToIsoDateTime, isoDateTimeToDate } from "./mappers.js";

/** シングルトンの固定 ID。 */
const SINGLETON_ID = "default";

/** Prisma 行の形。 */
interface CompanySettingsRow {
  id: string;
  companyName: string;
  representativeName: string;
  address: string;
  fiscalYearStartMonth: number;
  updatedAt: Date;
}

/** Prisma 行 → 企業設定ドメイン型。 */
export function companySettingsRowToDomain(
  row: CompanySettingsRow,
): CompanySettings {
  return {
    companyName: row.companyName,
    representativeName: row.representativeName,
    address: row.address,
    fiscalYearStartMonth: row.fiscalYearStartMonth,
    updatedAt: dateToIsoDateTime(row.updatedAt) as IsoDateTime,
  };
}

/**
 * 企業設定の Prisma 実装。
 * `@dgloss-kintai/api` の CompanySettingsRepository port を満たす。
 */
export class PrismaCompanySettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 保存済みの企業設定を返す。未保存なら null。 */
  async get(): Promise<CompanySettings | null> {
    const row = await this.prisma.companySettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    return row === null ? null : companySettingsRowToDomain(row);
  }

  /** 企業設定を保存する（シングルトンの upsert）。 */
  async save(settings: CompanySettings): Promise<void> {
    const data = {
      companyName: settings.companyName,
      representativeName: settings.representativeName,
      address: settings.address,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      updatedAt: isoDateTimeToDate(settings.updatedAt),
    };
    await this.prisma.companySettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }
}
