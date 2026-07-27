/**
 * ロール設定（シングルトン）の Prisma 永続化。
 * ドメイン型（contracts.RoleSettings）と Prisma 行を相互変換する。raw SQL は使わない。
 */

import type { IsoDateTime, RoleSettings } from "@dgloss-kintai/contracts";
import type { PrismaClient } from "@prisma/client";
import { dateToIsoDateTime, isoDateTimeToDate } from "./mappers.js";
import { isMissingTableError } from "./errors.js";

/** シングルトンの固定 ID。 */
const SINGLETON_ID = "default";

/** Prisma 行の形。 */
interface RoleSettingsRow {
  id: string;
  adminEmployeeCodes: string[];
  updatedAt: Date;
}

/** Prisma 行 → ロール設定ドメイン型。 */
export function roleSettingsRowToDomain(row: RoleSettingsRow): RoleSettings {
  return {
    adminEmployeeCodes: [...row.adminEmployeeCodes],
    updatedAt: dateToIsoDateTime(row.updatedAt) as IsoDateTime,
  };
}

/**
 * ロール設定の Prisma 実装。
 * `@dgloss-kintai/api` の RoleSettingsRepository port を満たす。
 */
export class PrismaRoleSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 保存済みのロール設定を返す。未保存なら null。
   * マイグレーション未適用（テーブル無し）でもログイン・認可が壊れないよう、
   * その場合は null を返して呼び出し側の env/既定フォールバックに委ねる。
   */
  async get(): Promise<RoleSettings | null> {
    try {
      const row = await this.prisma.roleSettings.findUnique({
        where: { id: SINGLETON_ID },
      });
      return row === null ? null : roleSettingsRowToDomain(row);
    } catch (error) {
      if (isMissingTableError(error)) {
        return null;
      }
      throw error;
    }
  }

  /** ロール設定を保存する（シングルトンの upsert）。 */
  async save(settings: RoleSettings): Promise<void> {
    const codes = [...settings.adminEmployeeCodes];
    await this.prisma.roleSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        adminEmployeeCodes: codes,
        updatedAt: isoDateTimeToDate(settings.updatedAt),
      },
      update: {
        adminEmployeeCodes: codes,
        updatedAt: isoDateTimeToDate(settings.updatedAt),
      },
    });
  }
}
