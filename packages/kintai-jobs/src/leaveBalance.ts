/**
 * 年次有給休暇の残高組み立て（労基法第39条・就業規則第61条）。
 *
 * 既存データ（従業員の入社日・日次勤怠の休暇区分）だけから、新たな永続化なしに
 * 有給残高を算出する純粋関数。計算そのものは @dgloss-kintai/leave のエンジンに委譲する。
 *
 * - 付与（grant）: 入社日を起点に、6か月後・以降1年ごとの基準日で付与テーブルに従い付与。
 *   出勤率は当バージョンでは満額（8割以上）とみなす（実出勤率での精緻化は将来対応）。
 * - 取得（take）: WorkDay.leave が `paid_full`（全日）・`paid_half`（半日）の日を取得として数える。
 *   `special`/`compensatory`/`absence` は年次有給ではないため対象外。
 */

import {
  computeBalance,
  fiveDayObligationStatus,
  grantDaysFor,
  type FiveDayObligationStatus,
  type LeaveBalance,
  type LeaveTransaction,
} from "@dgloss-kintai/leave";
import type { Employee, IsoDate, WorkDay } from "@dgloss-kintai/contracts";

/** 付与前提の出勤率（8割以上とみなす簡易値）。 */
const ASSUMED_ATTENDANCE_RATE = 1;

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

/** 暦日（`YYYY-MM-DD`）に月数を加算する（UTC 基準・存在しない日は繰り上げ）。 */
export function addMonths(iso: string, months: number): IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) throw new Error(`invalid IsoDate: ${iso}`);
  const [, yStr, mStr, dStr] = match;
  if (yStr === undefined || mStr === undefined || dStr === undefined) {
    throw new Error(`invalid IsoDate: ${iso}`);
  }
  const date = new Date(
    Date.UTC(Number(yStr), Number(mStr) - 1 + months, Number(dStr)),
  );
  return `${pad(date.getUTCFullYear(), 4)}-${pad(
    date.getUTCMonth() + 1,
    2,
  )}-${pad(date.getUTCDate(), 2)}` as IsoDate;
}

/** 有給残高の算定結果。 */
export interface LeaveBalanceResult {
  /** 基準日。 */
  readonly asOf: IsoDate;
  /** 残高（残日数・付与ごとのバケット・当年度要約）。 */
  readonly balance: LeaveBalance;
  /** 年5日取得義務の状況（労基法第39条第7項）。 */
  readonly obligation: FiveDayObligationStatus;
  /** 付与に用いた前提出勤率（当バージョンは満額）。 */
  readonly attendanceRateAssumed: number;
}

/**
 * 入社日から基準日までの付与取引を生成する。
 * k 回目（k=0,1,…）の付与は入社日 + (6 + 12k) か月、勤続月数 = 6 + 12k。
 */
function buildGrantTransactions(
  hiredOn: string,
  asOf: string,
): LeaveTransaction[] {
  const grants: LeaveTransaction[] = [];
  for (let k = 0; ; k += 1) {
    const months = 6 + 12 * k;
    const grantDate = addMonths(hiredOn, months);
    if (grantDate > asOf) break;
    const days = grantDaysFor(months, ASSUMED_ATTENDANCE_RATE);
    if (days > 0) {
      grants.push({ kind: "grant", date: grantDate, days });
    }
  }
  return grants;
}

/** 日次勤怠の休暇区分から取得取引を生成する（年次有給のみ）。 */
function buildTakeTransactions(
  workDays: readonly WorkDay[],
): LeaveTransaction[] {
  const takes: LeaveTransaction[] = [];
  for (const w of workDays) {
    if (w.leave === "paid_full") {
      takes.push({ kind: "take", date: w.date, half: false });
    } else if (w.leave === "paid_half") {
      takes.push({ kind: "take", date: w.date, half: true });
    }
  }
  return takes;
}

/**
 * 従業員1名の有給残高を、入社日と日次勤怠から算定する。純粋関数。
 *
 * @param employee 従業員（入社日を用いる）
 * @param workDays 取得判定に用いる日次勤怠（範囲・従業員は呼び出し側が用意）
 * @param asOf     基準日（`YYYY-MM-DD`）
 */
export function buildLeaveBalance(
  employee: Employee,
  workDays: readonly WorkDay[],
  asOf: string,
): LeaveBalanceResult {
  const transactions: LeaveTransaction[] = [
    ...buildGrantTransactions(employee.hiredOn, asOf),
    ...buildTakeTransactions(workDays),
  ];
  const balance = computeBalance(transactions, asOf);
  const obligation = fiveDayObligationStatus(balance);
  return {
    asOf: asOf as IsoDate,
    balance,
    obligation,
    attendanceRateAssumed: ASSUMED_ATTENDANCE_RATE,
  };
}
