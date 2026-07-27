/**
 * ユースケース: 勤務カレンダーの取得・更新（管理者専用は呼び出し側で認可）。
 *
 * 休日区分（法定休日曜日・所定休日曜日・会社休日）を保持する。日次化（打刻→WorkDay）で
 * 参照し、休日勤務手当の算定に反映する。未保存時は既定（日曜法定・土曜所定）へフォールバックする。
 */

import {
  DEFAULT_WORK_CALENDAR,
  workCalendarInputSchema,
} from "@dgloss-kintai/contracts";
import type { WorkCalendar } from "@dgloss-kintai/contracts";
import type { Clock, WorkCalendarRepository } from "./ports.js";
import { err, ok, validationError, type Result } from "./result.js";

/** getWorkCalendar の依存。 */
export interface GetWorkCalendarDeps {
  readonly calendar: WorkCalendarRepository;
}

/** 勤務カレンダーを取得する（未保存は既定）。 */
export async function getWorkCalendar(
  deps: GetWorkCalendarDeps,
): Promise<Result<WorkCalendar>> {
  const stored = await deps.calendar.get();
  return ok(stored ?? DEFAULT_WORK_CALENDAR);
}

/** updateWorkCalendar の依存。 */
export interface UpdateWorkCalendarDeps {
  readonly calendar: WorkCalendarRepository;
  readonly clock: Clock;
}

/**
 * 勤務カレンダーを更新する。会社休日は重複を除いて昇順に整える。
 *
 * @param input 更新入力（未検証の unknown）
 * @param deps  リポジトリ・時刻 port
 */
export async function updateWorkCalendar(
  input: unknown,
  deps: UpdateWorkCalendarDeps,
): Promise<Result<WorkCalendar>> {
  const parsed = workCalendarInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "勤務カレンダーの入力が不正です"));
  }

  const calendar: WorkCalendar = {
    legalHolidayWeekday: parsed.data.legalHolidayWeekday,
    scheduledHolidayWeekdays: [
      ...new Set(parsed.data.scheduledHolidayWeekdays),
    ].sort((a, b) => a - b),
    customHolidays: [...new Set(parsed.data.customHolidays)].sort(),
    updatedAt: deps.clock.now(),
  };

  await deps.calendar.save(calendar);
  return ok(calendar);
}
