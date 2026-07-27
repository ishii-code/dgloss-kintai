/**
 * 勤務カレンダー（シングルトン）の Prisma 永続化。
 * ドメイン型（contracts.WorkCalendar）と Prisma 行を相互変換する。raw SQL は使わない。
 */

import type { IsoDateTime, WorkCalendar } from "@dgloss-kintai/contracts";
import type { PrismaClient } from "@prisma/client";
import { dateToIsoDateTime, isoDateTimeToDate } from "./mappers.js";
import { isMissingTableError } from "./errors.js";

/** シングルトンの固定 ID。 */
const SINGLETON_ID = "default";

/** Prisma 行の形。 */
interface WorkCalendarRow {
  id: string;
  legalHolidayWeekday: number;
  scheduledHolidayWeekdays: number[];
  customHolidays: string[];
  updatedAt: Date;
}

/** Prisma 行 → 勤務カレンダードメイン型。 */
export function workCalendarRowToDomain(row: WorkCalendarRow): WorkCalendar {
  return {
    legalHolidayWeekday: row.legalHolidayWeekday,
    scheduledHolidayWeekdays: [...row.scheduledHolidayWeekdays],
    customHolidays: [...row.customHolidays],
    updatedAt: dateToIsoDateTime(row.updatedAt) as IsoDateTime,
  };
}

/**
 * 勤務カレンダーの Prisma 実装。
 * `@dgloss-kintai/api` の WorkCalendarRepository port を満たす。
 */
export class PrismaWorkCalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 保存済みの勤務カレンダーを返す。未保存なら null。
   * マイグレーション未適用（テーブル無し）でも日次化・締めが壊れないよう、その場合は
   * null を返して呼び出し側の既定フォールバックに委ねる。
   */
  async get(): Promise<WorkCalendar | null> {
    try {
      const row = await this.prisma.workCalendar.findUnique({
        where: { id: SINGLETON_ID },
      });
      return row === null ? null : workCalendarRowToDomain(row);
    } catch (error) {
      if (isMissingTableError(error)) {
        return null;
      }
      throw error;
    }
  }

  /** 勤務カレンダーを保存する（シングルトンの upsert）。 */
  async save(calendar: WorkCalendar): Promise<void> {
    const data = {
      legalHolidayWeekday: calendar.legalHolidayWeekday,
      scheduledHolidayWeekdays: [...calendar.scheduledHolidayWeekdays],
      customHolidays: [...calendar.customHolidays],
      updatedAt: isoDateTimeToDate(calendar.updatedAt),
    };
    await this.prisma.workCalendar.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }
}
