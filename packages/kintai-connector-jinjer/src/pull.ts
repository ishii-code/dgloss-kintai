/**
 * 移行 pull（Ph0）と Shadow 用データ取得（Ph2）。
 *
 * transport を注入で受け、レスポンスを必ず zod で検証してから contracts 型へマップする。
 * transport をスタブに差し替えればテストは実ネットワークを呼ばない。
 */

import type { Employee, Stamp, WorkDay, YearMonth } from "@dgloss-kintai/contracts";

import type { JinjerTransport } from "./transport.js";
import {
  jinjerEmployeeListSchema,
  jinjerStampListSchema,
  jinjerDailyAttendanceListSchema,
  jinjerMonthlyClosingListSchema,
} from "./dto.js";
import {
  mapEmployee,
  mapStamp,
  mapWorkDay,
  mapMonthlyClosing,
} from "./mappers.js";
import type { JinjerClosingValue } from "./mappers.js";

/** 取得期間（年月）のクエリを組み立てる。 */
function periodQuery(period: YearMonth): Record<string, number> {
  return { year: period.year, month: period.month };
}

/** jinjer 連携クライアント。transport 抽象にのみ依存する。 */
export class JinjerConnector {
  readonly #transport: JinjerTransport;

  constructor(transport: JinjerTransport) {
    this.#transport = transport;
  }

  /** 従業員マスタを pull する（Ph0 移行）。 */
  async pullEmployees(): Promise<Employee[]> {
    const raw = await this.#transport.request({
      method: "GET",
      path: "employees",
    });
    const parsed = jinjerEmployeeListSchema.parse(raw);
    return parsed.result.map(mapEmployee);
  }

  /** 指定月の打刻を pull する（Ph0 移行）。 */
  async pullStamps(period: YearMonth): Promise<Stamp[]> {
    const raw = await this.#transport.request({
      method: "GET",
      path: "stamps",
      query: periodQuery(period),
    });
    const parsed = jinjerStampListSchema.parse(raw);
    return parsed.result.map(mapStamp);
  }

  /** 指定月の日次勤怠を pull する（Ph0 移行）。 */
  async pullAttendance(period: YearMonth): Promise<WorkDay[]> {
    const raw = await this.#transport.request({
      method: "GET",
      path: "daily_attendances",
      query: periodQuery(period),
    });
    const parsed = jinjerDailyAttendanceListSchema.parse(raw);
    return parsed.result.map(mapWorkDay);
  }

  /** 指定月の月次締め（Shadow の正解データ）を pull する（Ph2）。 */
  async pullMonthlyClosings(period: YearMonth): Promise<JinjerClosingValue[]> {
    const raw = await this.#transport.request({
      method: "GET",
      path: "monthly_closings",
      query: periodQuery(period),
    });
    const parsed = jinjerMonthlyClosingListSchema.parse(raw);
    return parsed.result.map(mapMonthlyClosing);
  }
}
