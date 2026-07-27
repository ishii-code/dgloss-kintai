/**
 * 賞与明細の組み立て（総支給まで）。
 *
 * 従業員の雇用契約（基本給・雇用区分）と賞与パラメータ（支給月数・評価係数・在籍按分・調整額）
 * から、賞与計算エンジン（@dgloss-kintai/core）の内訳を賞与明細（BonusStatement・contracts）に写す
 * 純粋関数。所得税・社会保険料（賞与分）は外部連携（未計上）として明示する。
 *
 * 非正規は賞与なし（就業規則第72条）→ eligible=false・総支給0。
 */

import { calculateBonus, type BonusParams } from "@dgloss-kintai/core";
import type {
  BonusStatement,
  BonusStatementLine,
  Employee,
  Yen,
} from "@dgloss-kintai/contracts";

/** 係数（×100 整数）を「N.NN」表記に整形する（表示補足用）。 */
function formatScaled(value: number): string {
  const intPart = Math.floor(value / 100);
  const frac = String(value % 100).padStart(2, "0");
  return `${intPart}.${frac}`;
}

/** 所得税・社会保険料（賞与分）の未計上プレースホルダ。 */
function statutoryPlaceholders(): BonusStatementLine[] {
  return [
    { label: "所得税（賞与）", amount: 0, note: "外部連携・未計上" },
    { label: "社会保険料（賞与）", amount: 0, note: "外部連携・未計上" },
  ];
}

/**
 * 従業員1名の賞与明細を組み立てる。純粋関数。
 *
 * @param employee 従業員（雇用契約を含む）
 * @param params   支給月数・評価係数・在籍按分・調整額（係数は ×100 整数）
 * @param label    支給期の表示名（例「2026年 夏季賞与」）
 */
export function buildBonusStatement(
  employee: Employee,
  params: BonusParams,
  label: string,
): BonusStatement {
  const breakdown = calculateBonus(
    {
      basicSalary: employee.contract.basicSalary,
      employmentType: employee.contract.employmentType,
    },
    params,
  );

  if (!breakdown.eligible) {
    return {
      employeeId: employee.id,
      label,
      eligible: false,
      lines: [
        {
          label: "賞与対象外",
          amount: 0,
          note: "非正規は賞与なし（就業規則第72条）",
        },
      ],
      grossBonus: 0 as Yen,
      statutoryPlaceholders: statutoryPlaceholders(),
    };
  }

  const lines: BonusStatementLine[] = [
    {
      label: "基本賞与",
      amount: breakdown.baseAmount,
      note: `基本給 × 支給月数 ${formatScaled(params.monthsMultiplier)}月`,
    },
  ];
  if (breakdown.evaluationAdjustment !== 0) {
    lines.push({
      label: "評価調整",
      amount: breakdown.evaluationAdjustment,
      note: `評価係数 ${params.evaluationRate}%`,
    });
  }
  if (breakdown.attendanceAdjustment !== 0) {
    lines.push({
      label: "在籍按分調整",
      amount: breakdown.attendanceAdjustment,
      note: `在籍按分 ${params.attendanceRate}%`,
    });
  }
  if (breakdown.otherAdjustment !== 0) {
    lines.push({ label: "その他調整", amount: breakdown.otherAdjustment });
  }

  return {
    employeeId: employee.id,
    label,
    eligible: true,
    lines,
    grossBonus: breakdown.grossBonus as Yen,
    statutoryPlaceholders: statutoryPlaceholders(),
  };
}
