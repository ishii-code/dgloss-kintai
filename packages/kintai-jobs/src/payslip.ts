/**
 * 給与明細の組み立て（総支給まで）。
 *
 * 月次締め（MonthlyClosing・賃金規程第6条）と雇用契約（基本給・固定時間外勤務手当・
 * 管理監督者区分）から給与明細（Payslip・contracts）を確定する純粋関数。
 *
 * スコープ方針（要件定義 v0.1）:
 *  - 「総支給額（grossPay）」と「自社計上の控除（遅刻早退控除・第21条）」までを自社で確定する。
 *  - 所得税・社会保険料は毎年の法改正が入る重量級のため当面自作せず、jinjer/給与ソフトへ連携する。
 *    本明細では金額0・未計上のプレースホルダとして明示する（statutoryPlaceholders）。
 *
 * 二重計上の回避:
 *  - 固定時間外勤務手当（みなし残業）がある一般従業員は
 *      基本給 + 固定時間外勤務手当 + 時間外勤務手当（差額・第20条4項）
 *    を支給項目とする（実割増は固定額に充当済みで、超過分のみ差額支給されるため）。
 *  - 固定残業なし（または管理監督者）は
 *      基本給 + 実際の割増内訳（時間外・60h超・休日・深夜のうち非ゼロ）
 *    を支給項目とする。管理監督者は深夜割増のみ発生する（第20条3項4号）。
 */

import type {
  Employee,
  MonthlyClosing,
  Payslip,
  PayslipLine,
  Yen,
} from "@dgloss-kintai/contracts";

const asYen = (n: number): Yen => n as Yen;

/** buildPayslip の任意オプション。 */
export interface BuildPayslipOptions {
  /**
   * 通勤手当（月額・円）。総支給額に含める。既定 0。
   * 現バージョンは雇用契約に通勤手当を持たないため呼び出し側から供給する。
   */
  readonly commuteAllowance?: Yen;
}

/** 明細行を作る（金額は正の整数円で保持）。 */
function line(label: string, amount: number, note?: string): PayslipLine {
  return note === undefined
    ? { label, amount: asYen(amount) }
    : { label, amount: asYen(amount), note };
}

/** 明細行の金額合計（円）。 */
function sumLines(lines: readonly PayslipLine[]): number {
  return lines.reduce((acc, l) => acc + l.amount, 0);
}

/**
 * 割増賃金の内訳（非ゼロのみ）を支給項目に写す。
 * 固定残業なし・管理監督者のケースで用いる。
 */
function premiumLines(closing: MonthlyClosing): PayslipLine[] {
  const p = closing.premium;
  const lines: PayslipLine[] = [];
  if (p.overtimeAllowance > 0) {
    lines.push(line("時間外勤務手当", p.overtimeAllowance));
  }
  if (p.overtimeOver60Allowance > 0) {
    lines.push(line("時間外勤務手当（60時間超）", p.overtimeOver60Allowance));
  }
  if (p.holidayAllowance > 0) {
    lines.push(line("休日勤務手当", p.holidayAllowance));
  }
  if (p.nightAllowance > 0) {
    lines.push(line("深夜勤務手当", p.nightAllowance));
  }
  return lines;
}

/**
 * 月次締めと従業員（雇用契約）から給与明細（総支給まで）を組み立てる。純粋関数。
 *
 * @param closing  確定済みの月次締め（従業員・期間が一致していること）
 * @param employee 従業員（雇用契約を含む）
 * @param options  通勤手当など（任意）
 * @returns 総支給・自社控除まで確定した Payslip（所得税・社保は未計上プレースホルダ）
 */
export function buildPayslip(
  closing: MonthlyClosing,
  employee: Employee,
  options: BuildPayslipOptions = {},
): Payslip {
  const contract = employee.contract;
  const commuteAllowance = options.commuteAllowance ?? asYen(0);

  // 固定時間外勤務手当を支給する一般従業員か（管理監督者・固定額0は対象外）。
  const usesFixed =
    !contract.isManagerialEmployee && contract.fixedOvertimeAllowance > 0;

  const earnings: PayslipLine[] = [line("基本給", contract.basicSalary)];

  if (usesFixed) {
    earnings.push(
      line("固定時間外勤務手当", contract.fixedOvertimeAllowance),
    );
    if (closing.fixedOvertimeAdditionalPayment > 0) {
      earnings.push(
        line(
          "時間外勤務手当（差額）",
          closing.fixedOvertimeAdditionalPayment,
          "固定時間外超過分（第20条4項）",
        ),
      );
    }
  } else {
    earnings.push(...premiumLines(closing));
  }

  if (commuteAllowance > 0) {
    earnings.push(line("通勤手当", commuteAllowance));
  }

  const grossPay = sumLines(earnings);

  // 自社計上の控除（遅刻早退控除・第21条）。
  const deductions: PayslipLine[] = [];
  if (closing.latenessDeduction > 0) {
    deductions.push(line("遅刻早退控除", closing.latenessDeduction));
  }
  const totalDeductions = sumLines(deductions);

  // 所得税・社会保険料は外部連携（未計上）。金額0のプレースホルダで明示する。
  const statutoryPlaceholders: PayslipLine[] = [
    line("所得税", 0, "外部連携・未計上"),
    line("社会保険料", 0, "外部連携・未計上"),
  ];

  return {
    employeeId: closing.employeeId,
    period: closing.period,
    earnings,
    grossPay: asYen(grossPay),
    deductions,
    totalDeductions: asYen(totalDeductions),
    netBeforeStatutory: asYen(grossPay - totalDeductions),
    statutoryPlaceholders,
  };
}
