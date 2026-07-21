/**
 * デモ用のスタブ jinjer transport と月次締め DTO ビルダー。
 *
 * 実ネットワークを一切呼ばず、{@link JinjerTransport} を実装して月次締めエンドポイント
 * （`monthly_closings`）に対し「自作締めを基に組み立てた jinjer 月次締め DTO」を返す。
 * DTO は本物と同じ snake_case 形（{@link jinjerMonthlyClosingDtoSchema} 準拠）で組むため、
 * pull 側の zod 検証・マッパーを本番同様に通過する。
 *
 * 実 jinjer 仕様が判明したら、この「スタブ transport」を {@link FetchJinjerTransport}
 * （実 HTTP）へ差し替え、DTO ビルダーは不要になる（本物のレスポンスが来るため）。
 */

import type { MonthlyClosing } from "@dgloss-kintai/contracts";

import type { JinjerRequest, JinjerTransport } from "../transport.js";

/**
 * 自作の月次締めを基に jinjer 月次締め DTO（snake_case・raw）を組み立てる。
 *
 * jinjer 側の割増合計が自作と一致するように内訳をそのまま写し、`premiumDelta` で
 * 意図的な乖離（円）を `overtime_allowance` に注入する。総労働時間・区分別労働時間も
 * 自作締めから写すため、`premiumDelta === 0` なら {@link compareShadow} は matched になる。
 *
 * @param own          自作側の月次締め（runMonthlyClosing の結果）
 * @param premiumDelta jinjer 割増合計に加える差分（円）。正なら未払い方向、負なら過払い方向
 * @returns jinjerMonthlyClosingDtoSchema に適合する raw オブジェクト
 */
export function buildJinjerClosingDto(
  own: MonthlyClosing,
  premiumDelta: number,
): unknown {
  return {
    staff_code: own.employeeId,
    year: own.period.year,
    month: own.period.month,
    total_working_minutes: own.totalWorkedMinutes,
    classified: {
      non_statutory_overtime_minutes: own.classified.nonStatutoryOvertimeMinutes,
      statutory_overtime_minutes: own.classified.statutoryOvertimeMinutes,
      legal_holiday_minutes: own.classified.legalHolidayMinutes,
      scheduled_holiday_minutes: own.classified.scheduledHolidayMinutes,
      night_minutes: own.classified.nightMinutes,
    },
    allowances: {
      // 割増合計を一致させるため内訳をそのまま写し、乖離は overtime_allowance に載せる。
      overtime_allowance: own.premium.overtimeAllowance + premiumDelta,
      overtime_over60_allowance: own.premium.overtimeOver60Allowance,
      holiday_allowance: own.premium.holidayAllowance,
      night_allowance: own.premium.nightAllowance,
    },
  };
}

/**
 * 月次締めエンドポイントに固定レスポンスを返すスタブ transport。
 *
 * `monthly_closings` 以外のパスは、デモが叩かない想定なので明示的に拒否する（誤配線の検出）。
 */
export class StubJinjerTransport implements JinjerTransport {
  readonly #closings: readonly unknown[];

  /**
   * @param closings monthly_closings に対して返す jinjer 締め DTO（raw）の配列
   */
  constructor(closings: readonly unknown[]) {
    this.#closings = closings;
  }

  request(req: JinjerRequest): Promise<unknown> {
    if (req.path !== "monthly_closings") {
      return Promise.reject(
        new Error(`スタブ transport は monthly_closings のみ対応: ${req.path}`),
      );
    }
    // 本物のエンベロープ形（{ code, result }）で包んで返す。
    return Promise.resolve({ code: 200, result: this.#closings });
  }
}
