/**
 * Shadow 検証デモの一気通貫オーケストレーションと突合レポート整形。
 *
 * フィクスチャ（{@link buildDemoScenarios}）＋インメモリ勤怠ソース＋スタブ jinjer transport を
 * 組み立てて {@link runShadowVerification} を実際に走らせ、結果を返す。時刻は固定注入するため
 * 出力は決定的（毎回同じ）になる。ネットワーク非依存。
 *
 * 実 jinjer 仕様が判明したら、`connector` の transport を {@link FetchJinjerTransport}
 * （実 HTTP・実 config）に差し替え、`attendanceSource` を実 DB アダプタに差し替えるだけで
 * 本番の Shadow 検証に転用できる（この関数の骨格＝seam はそのまま）。
 */

import type { Clock } from "@dgloss-kintai/jobs";
import { fixedClock, runMonthlyClosing } from "@dgloss-kintai/jobs";
import type { IsoDateTime } from "@dgloss-kintai/contracts";

import { JinjerConnector } from "../pull.js";
import { runShadowVerification } from "../verify.js";
import type { ShadowVerificationResult } from "../verify.js";
import { buildDemoScenarios, DEMO_PERIOD } from "./fixtures.js";
import { InMemoryAttendanceSource } from "./attendanceSource.js";
import { buildJinjerClosingDto, StubJinjerTransport } from "./stubTransport.js";

/** デモの締め確定時刻（固定注入で決定的にする）。 */
export const DEMO_CLOSED_AT = "2025-08-01T00:00:00+09:00";

/** デモの不一致イベント発生時刻。 */
export const DEMO_OCCURRED_AT = DEMO_CLOSED_AT as IsoDateTime;

/** デモ実行の任意オプション（既定はすべて固定値で決定的）。 */
export interface ShadowDemoOptions {
  /** 締め確定・イベント発生時刻を供給する時計（既定は固定時計）。 */
  readonly clock?: Clock;
  /** 不一致イベントの発生時刻（既定は {@link DEMO_OCCURRED_AT}）。 */
  readonly occurredAt?: IsoDateTime;
}

/**
 * デモを一気通貫で実行し、Shadow 検証結果を返す。
 *
 * 手順:
 *  1. フィクスチャからシナリオ（従業員・WorkDay[]・注入乖離）を生成。
 *  2. 各従業員の自作締めを同じ時計で先に算定し、それを基に jinjer 締め DTO を組み立てる
 *     （一致ケースは乖離0、未払いケースは +1 円）。
 *  3. インメモリ勤怠ソース＋スタブ transport を注入して {@link runShadowVerification} を実行。
 *
 * @param options 時計・発生時刻の上書き（既定は固定値）
 * @returns 集計済みの {@link ShadowVerificationResult}
 */
export async function runShadowDemo(
  options: ShadowDemoOptions = {},
): Promise<ShadowVerificationResult> {
  const clock = options.clock ?? fixedClock(new Date(DEMO_CLOSED_AT));
  const occurredAt = options.occurredAt ?? DEMO_OCCURRED_AT;
  const period = DEMO_PERIOD;

  const scenarios = buildDemoScenarios();
  const employees = scenarios.map((s) => s.employee);

  // 1. 自作側の勤怠ソース（インメモリ）を組み立てる。
  const byEmployee = new Map(
    scenarios.map((s) => [s.employee.id as string, s.workDays] as const),
  );
  const attendanceSource = new InMemoryAttendanceSource(byEmployee);

  // 2. jinjer 側の締め DTO を「自作締め＋注入乖離」で組み立てる。
  //    runShadowVerification が内部で使うのと同じ時計で自作締めを算定して基準にする。
  const jinjerClosings = scenarios.map((s) => {
    const own = runMonthlyClosing(
      { employee: s.employee, workDays: s.workDays, period },
      { clock },
    );
    return buildJinjerClosingDto(own, s.jinjerPremiumDelta);
  });
  const connector = new JinjerConnector(new StubJinjerTransport(jinjerClosings));

  // 3. 一気通貫で突合する。
  return runShadowVerification({
    period,
    employees,
    attendanceSource,
    connector,
    clock,
    occurredAt,
  });
}

/** 年月を `YYYY-MM` に整形する。 */
function formatYearMonth(period: { year: number; month: number }): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

/** {@link formatShadowReport} の任意オプション。 */
export interface ShadowReportOptions {
  /** 従業員 ID → 表示名。明細に名前を添えるために使う（無ければ ID のみ）。 */
  readonly employeeNames?: ReadonlyMap<string, string>;
}

/**
 * Shadow 検証結果を人間可読な突合レポート文字列に整形する（副作用なし）。
 *
 * 対象月・総件数・一致/不一致/欠損・最大乖離円・未払い/過払い方向件数、
 * および不一致明細（従業員・乖離円・労働時間差）を含める。
 *
 * @param result Shadow 検証結果
 * @param options 従業員名の対応表（任意）
 * @returns 改行区切りのレポート文字列
 */
export function formatShadowReport(
  result: ShadowVerificationResult,
  options: ShadowReportOptions = {},
): string {
  const names = options.employeeNames;
  const label = (employeeId: string): string => {
    const name = names?.get(employeeId);
    return name ? `${employeeId}（${name}）` : employeeId;
  };

  const lines: string[] = [];
  lines.push("==== jinjer Shadow 検証レポート ====");
  lines.push(`対象月            : ${formatYearMonth(result.period)}`);
  lines.push(`総件数            : ${result.total}`);
  lines.push(`一致              : ${result.matchedCount}`);
  lines.push(`不一致            : ${result.mismatchedCount}`);
  lines.push(`jinjer 側欠損     : ${result.missingCount}`);
  lines.push(`最大乖離（円）    : ${result.maxAbsolutePremiumDiff}`);
  lines.push(`未払い方向        : ${result.underpaymentCount} 件`);
  lines.push(`過払い方向        : ${result.overpaymentCount} 件`);
  lines.push(
    `総合判定          : ${result.hasMismatch ? "不一致あり（要確認）" : "全件一致"}`,
  );

  if (result.mismatches.length > 0) {
    lines.push("");
    lines.push("---- 不一致明細 ----");
    for (const m of result.mismatches) {
      // jinjer を正解とみなすため、own < jinjer（premiumDiff < 0）を未払いとして強調。
      const direction =
        m.premiumDiff < 0 ? "未払い方向" : m.premiumDiff > 0 ? "過払い方向" : "時間差のみ";
      lines.push(
        `- ${label(m.employeeId)}: 割増差 ${m.premiumDiff} 円` +
          `（自作 ${m.ownPremiumTotal} / jinjer ${m.jinjerPremiumTotal}）` +
          ` 労働時間差 ${m.workedMinutesDiff} 分 [${direction}]`,
      );
    }
  }

  if (result.missing.length > 0) {
    lines.push("");
    lines.push("---- jinjer 側欠損（突合不可）----");
    for (const miss of result.missing) {
      lines.push(`- ${label(miss.employeeId)}: ${formatYearMonth(miss.period)} の締めが jinjer 側に無し`);
    }
  }

  return lines.join("\n");
}

/** デモのシナリオから従業員 ID → 表示名の対応表を作る（レポート整形の補助）。 */
export function demoEmployeeNames(): ReadonlyMap<string, string> {
  return new Map(
    buildDemoScenarios().map((s) => [s.employee.id as string, s.employee.name] as const),
  );
}
