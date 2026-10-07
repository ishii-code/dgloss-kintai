/**
 * ユースケース: 固定残業超過アラート（当月見込み・毎日実行想定）。
 *
 * 指定した事業部に属し、固定時間外勤務手当を受ける一般従業員について、当月1日〜基準日
 * （asOf）までの日次勤怠を月次締めと同じ計算で集計し、固定残業枠を超えて差額支給が発生
 * （fixedOvertimeAdditionalPayment > 0）した従業員を検出する。
 *
 * 「固定残業超過」は月の残業合計と固定残業枠を比べる月単位の判定のため、月途中の実行では
 * 「当月見込み（基準日までの累計）」になる。同じ従業員・同じ年月で何度も通知しないよう、
 * 通知済み状態（OvertimeAlertStateRepository）で冪等化し、初めて超過した時だけ通知する。
 *
 * 管理監督者・固定残業なし（fixedOvertimeAllowance = 0）は対象外（差額の概念が無いため）。
 * 認可（管理者のみ／Cron 秘密）は呼び出し側で担保する。
 */

import { yearMonthSchema } from "@dgloss-kintai/contracts";
import type {
  Employee,
  IsoDate,
  MonthlyClosing,
  YearMonth,
} from "@dgloss-kintai/contracts";
import { runMonthlyClosing } from "@dgloss-kintai/jobs";
import { z } from "zod";
import type {
  Clock,
  EmployeeRepository,
  FixedOvertimeAlert,
  OvertimeAlertNotifier,
  OvertimeAlertStateRepository,
  WorkDayRepository,
} from "./ports.js";
import { err, ok, validationError, type Result } from "./result.js";

/** アラート判定の入力スキーマ。 */
const checkAlertsInputSchema = z.object({
  /** 対象年月。省略時は asOf（または今日）から導出する。 */
  period: yearMonthSchema.optional(),
  /**
   * 集計の基準日（`YYYY-MM-DD`）。当月1日〜この日までで見込み集計する。
   * 省略時は Clock の現在日（JST）を用いる。
   */
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "asOf は YYYY-MM-DD 形式です")
    .optional(),
  /** 通知対象の事業部名（この一覧に部分一致する従業員のみ対象）。 */
  departments: z.array(z.string().min(1)).min(1, "事業部を1つ以上指定してください"),
});

/** checkFixedOvertimeAlerts の依存。 */
export interface CheckFixedOvertimeAlertsDeps {
  readonly employees: EmployeeRepository;
  readonly workDays: WorkDayRepository;
  readonly alertState: OvertimeAlertStateRepository;
  readonly notifier: OvertimeAlertNotifier;
  readonly clock: Clock;
}

/** アラート判定の結果サマリ。 */
export interface CheckFixedOvertimeAlertsResult {
  readonly period: YearMonth;
  readonly asOf: IsoDate;
  /** 判定対象（事業部・固定残業あり・非管理監督者）の人数。 */
  readonly checkedCount: number;
  /** 今回新たに超過を検出し通知した人数。 */
  readonly triggeredCount: number;
  /** 既に超過しているが通知済みでスキップした人数。 */
  readonly alreadyNotifiedCount: number;
  /** 今回通知したアラート（詳細）。 */
  readonly alerts: readonly FixedOvertimeAlert[];
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 事業部名の緩い正規化（前後空白除去・全半角差を吸収）。 */
function normalizeDept(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

/** 当月の残業相当（分）＝ 法定内時間外 + 法定外時間外。 */
function overtimeMinutesOf(closing: MonthlyClosing): number {
  const c = closing.classified;
  return c.nonStatutoryOvertimeMinutes + c.statutoryOvertimeMinutes;
}

/**
 * 固定残業超過の見込みを判定し、初回超過者だけ通知する。
 *
 * @param input アラート判定入力（未検証）
 * @param deps  リポジトリ・通知器・時計
 */
export async function checkFixedOvertimeAlerts(
  input: unknown,
  deps: CheckFixedOvertimeAlertsDeps,
): Promise<Result<CheckFixedOvertimeAlertsResult>> {
  const parsed = checkAlertsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "アラート判定の入力が不正です"));
  }

  // 基準日（asOf）と対象年月を確定する。asOf 省略時は現在日（JST・RFC3339 の先頭10桁）。
  const asOf: IsoDate = (parsed.data.asOf ??
    deps.clock.now().slice(0, 10)) as IsoDate;
  const period: YearMonth =
    parsed.data.period ??
    {
      year: Number(asOf.slice(0, 4)),
      month: Number(asOf.slice(5, 7)),
    };

  const mm = pad2(period.month);
  const from: IsoDate = `${period.year}-${mm}-01` as IsoDate;
  // 基準日が対象月を超える場合は月末まで、当月なら asOf まで。
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const monthEnd = `${period.year}-${mm}-${pad2(lastDay)}`;
  const to: IsoDate = (asOf < from ? from : asOf > monthEnd ? monthEnd : asOf) as IsoDate;

  const wanted = parsed.data.departments.map(normalizeDept);
  const matchesDept = (dept: string | null | undefined): boolean => {
    if (dept === null || dept === undefined || dept === "") {
      return false;
    }
    const d = normalizeDept(dept);
    return wanted.some((w) => d.includes(w) || w.includes(d));
  };

  const all = await deps.employees.list();
  const targets: readonly Employee[] = all.filter(
    (e) =>
      matchesDept(e.department) &&
      !e.contract.isManagerialEmployee &&
      e.contract.fixedOvertimeAllowance > 0,
  );

  const newAlerts: FixedOvertimeAlert[] = [];
  let alreadyNotifiedCount = 0;
  const notifiedAt = deps.clock.now();

  for (const employee of targets) {
    const workDays = await deps.workDays.listByEmployeeAndDateRange(
      employee.id,
      from,
      to,
    );
    if (workDays.length === 0) {
      continue;
    }
    const closing = runMonthlyClosing({ employee, workDays, period });
    if (closing.fixedOvertimeAdditionalPayment <= 0) {
      continue;
    }
    if (await deps.alertState.wasNotified(employee.id, period)) {
      alreadyNotifiedCount += 1;
      continue;
    }
    newAlerts.push({
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      department: employee.department ?? null,
      period,
      asOf: to,
      fixedOvertimeAllowance: employee.contract.fixedOvertimeAllowance,
      overtimeMinutes: overtimeMinutesOf(closing),
      additionalPayment: closing.fixedOvertimeAdditionalPayment,
    });
  }

  // 送信してから通知済みを記録する（送信失敗時は未記録のまま＝次回再試行される）。
  if (newAlerts.length > 0) {
    await deps.notifier.notify(newAlerts);
    for (const a of newAlerts) {
      await deps.alertState.markNotified({
        employeeId: a.employeeId,
        period: a.period,
        additionalPayment: a.additionalPayment,
        notifiedAt,
      });
    }
  }

  return ok({
    period,
    asOf: to,
    checkedCount: targets.length,
    triggeredCount: newAlerts.length,
    alreadyNotifiedCount,
    alerts: newAlerts,
  });
}
