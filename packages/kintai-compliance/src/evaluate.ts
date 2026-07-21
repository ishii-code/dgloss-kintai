/**
 * 36協定・上限規制の評価エンジン。
 *
 * 月次の時間外・休日労働（{@link MonthlyOvertime}）の系列を受け取り、各上限に対する
 * {@link ComplianceAlert} を生成する。未払い・違法検知が目的のため、上限を 1 分でも
 * 超えたら必ず `exceeded` とし、取りこぼさない。比較・超過量はすべて整数演算。
 */

import type { YearMonth } from "@dgloss-kintai/contracts";
import type { ThirtySixAgreementLimits } from "./config.js";
import { resolveLimits } from "./config.js";
import type { MonthlyOvertime } from "./aggregate.js";
import { monthlyOvertimeSchema, overtimePlusHoliday } from "./aggregate.js";
import type {
  AlertPeriod,
  ComplianceAlert,
  ComplianceCheckKind,
  ComplianceLevel,
  ComplianceReport,
} from "./types.js";

/** 年月を単調増加する整数インデックスに変換する（0 始まりの月通番）。 */
function monthIndex(p: YearMonth): number {
  return p.year * 12 + (p.month - 1);
}

/** 分を「H時間M分」で表す。 */
function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}時間${abs % 60}分`;
}

/** 年月を「YYYY年M月」で表す。 */
function formatYearMonth(p: YearMonth): string {
  return `${p.year}年${p.month}月`;
}

/** レベルの深刻度順位。 */
const LEVEL_RANK: Record<ComplianceLevel, number> = {
  ok: 0,
  warning: 1,
  exceeded: 2,
};

interface Judgement {
  readonly level: ComplianceLevel;
  readonly excess: number;
}

/**
 * 「以下（上限を超えない）」上限の判定。value <= limit なら可。
 * 超過量 = value - limit（超過時のみ正）。警告しきい値 = floor(limit × %/100)。
 */
function judgeAtMost(
  value: number,
  limit: number,
  warningRatioPercent: number,
): Judgement {
  if (value > limit) return { level: "exceeded", excess: value - limit };
  const warn = Math.floor((limit * warningRatioPercent) / 100);
  if (value >= warn) return { level: "warning", excess: 0 };
  return { level: "ok", excess: 0 };
}

/**
 * 「未満」上限の判定。value < limit なら可（整数なので許容最大は limit - 1）。
 * 上限ちょうど（value == limit）は超過とし、超過量 = value - (limit - 1)。
 */
function judgeBelow(
  value: number,
  limit: number,
  warningRatioPercent: number,
): Judgement {
  const maxAllowed = limit - 1;
  if (value > maxAllowed) return { level: "exceeded", excess: value - maxAllowed };
  const warn = Math.floor((limit * warningRatioPercent) / 100);
  if (value >= warn) return { level: "warning", excess: 0 };
  return { level: "ok", excess: 0 };
}

/**
 * 回数上限の判定。count <= limit なら可。警告しきい値 = ceil(limit × %/100)
 * （回数上限ちょうどは接近＝warning）。超過量 = count - limit。
 */
function judgeCount(
  count: number,
  limit: number,
  warningRatioPercent: number,
): Judgement {
  if (count > limit) return { level: "exceeded", excess: count - limit };
  const warn = Math.ceil((limit * warningRatioPercent) / 100);
  if (count >= warn && count > 0) return { level: "warning", excess: 0 };
  return { level: "ok", excess: 0 };
}

/** チェック種別の日本語名。 */
const CHECK_LABEL: Record<ComplianceCheckKind, string> = {
  monthly_overtime: "単月の時間外労働",
  annual_overtime: "年間の時間外労働（原則）",
  annual_special_overtime: "年間の時間外労働（特別条項）",
  monthly_with_holiday: "単月の時間外＋休日労働",
  multi_month_average: "複数月平均の時間外＋休日労働",
  over45_count: "月45時間超の年間回数",
};

/** 分単位チェックのアラートを組み立てる。 */
function minutesAlert(
  check: ComplianceCheckKind,
  period: AlertPeriod,
  actual: number,
  limit: number,
  j: Judgement,
  detail: string,
): ComplianceAlert {
  const label = CHECK_LABEL[check];
  const head =
    j.level === "exceeded"
      ? `【超過】${label}が上限を ${formatMinutes(j.excess)} 超えています`
      : j.level === "warning"
        ? `【接近】${label}が上限に接近しています`
        : `${label}は上限内です`;
  return {
    check,
    level: j.level,
    period,
    actual,
    limit,
    excess: j.excess,
    unit: "minutes",
    message: `${head}（${detail}）。`,
  };
}

/**
 * 月次の時間外・休日労働の系列を評価し、36協定の各上限に対するアラートを返す。
 *
 * @param monthly 月次の時間外・休日労働（同一の36協定対象期間内の各月）。順不同で可。
 * @param limitsInput 上限設定。省略時は法定既定（{@link resolveLimits}）。
 * @returns 全チェックのアラートと最悪レベルを含むレポート。
 */
export function evaluateCompliance(
  monthly: readonly MonthlyOvertime[],
  limitsInput?: ThirtySixAgreementLimits,
): ComplianceReport {
  const limits = resolveLimits(limitsInput);
  // 外部入力を検証してから、月通番で昇順ソート。
  const months = monthly
    .map((m) => monthlyOvertimeSchema.parse(m))
    .sort((a, b) => monthIndex(a.period) - monthIndex(b.period));

  const alerts: ComplianceAlert[] = [];

  // --- 単月チェック（各月）: 時間外45h（以下）／時間外＋休日100h（未満） ---
  for (const m of months) {
    const monthPeriod: AlertPeriod = { kind: "month", period: m.period };

    const jMonthly = judgeAtMost(
      m.overtimeMinutes,
      limits.monthlyOvertimeLimitMinutes,
      limits.warningRatioPercent,
    );
    alerts.push(
      minutesAlert(
        "monthly_overtime",
        monthPeriod,
        m.overtimeMinutes,
        limits.monthlyOvertimeLimitMinutes,
        jMonthly,
        `${formatYearMonth(m.period)}: 時間外 ${formatMinutes(m.overtimeMinutes)} / 上限 ${formatMinutes(limits.monthlyOvertimeLimitMinutes)}`,
      ),
    );

    const withHoliday = overtimePlusHoliday(m);
    const jHoliday = judgeBelow(
      withHoliday,
      limits.monthlyWithHolidayLimitMinutes,
      limits.warningRatioPercent,
    );
    alerts.push(
      minutesAlert(
        "monthly_with_holiday",
        monthPeriod,
        withHoliday,
        limits.monthlyWithHolidayLimitMinutes,
        jHoliday,
        `${formatYearMonth(m.period)}: 時間外＋休日 ${formatMinutes(withHoliday)} / 上限 ${formatMinutes(limits.monthlyWithHolidayLimitMinutes)}未満`,
      ),
    );
  }

  // --- 年間チェック・回数チェック（対象期間全体） ---
  if (months.length > 0) {
    const first = months[0]!;
    const last = months[months.length - 1]!;
    const rangePeriod: AlertPeriod = {
      kind: "range",
      start: first.period,
      end: last.period,
      monthCount: months.length,
    };
    const rangeLabel = `${formatYearMonth(first.period)}〜${formatYearMonth(last.period)}`;

    const annualOvertime = months.reduce((s, m) => s + m.overtimeMinutes, 0);

    // 原則: 年360h（以下）
    const jAnnual = judgeAtMost(
      annualOvertime,
      limits.annualOvertimeLimitMinutes,
      limits.warningRatioPercent,
    );
    alerts.push(
      minutesAlert(
        "annual_overtime",
        rangePeriod,
        annualOvertime,
        limits.annualOvertimeLimitMinutes,
        jAnnual,
        `${rangeLabel}: 時間外合計 ${formatMinutes(annualOvertime)} / 上限 ${formatMinutes(limits.annualOvertimeLimitMinutes)}`,
      ),
    );

    // 特別条項: 年720h（以下）
    const jSpecial = judgeAtMost(
      annualOvertime,
      limits.annualSpecialOvertimeLimitMinutes,
      limits.warningRatioPercent,
    );
    alerts.push(
      minutesAlert(
        "annual_special_overtime",
        rangePeriod,
        annualOvertime,
        limits.annualSpecialOvertimeLimitMinutes,
        jSpecial,
        `${rangeLabel}: 時間外合計 ${formatMinutes(annualOvertime)} / 上限 ${formatMinutes(limits.annualSpecialOvertimeLimitMinutes)}`,
      ),
    );

    // 特別条項: 月45h超は年6回まで（回数）
    const over45Count = months.filter(
      (m) => m.overtimeMinutes > limits.monthlyOvertimeLimitMinutes,
    ).length;
    const jCount = judgeCount(
      over45Count,
      limits.over45CountLimit,
      limits.warningRatioPercent,
    );
    const countHead =
      jCount.level === "exceeded"
        ? `【超過】月45時間超が年間 ${over45Count} 回で上限 ${limits.over45CountLimit} 回を超えています`
        : jCount.level === "warning"
          ? `【接近】月45時間超が年間 ${over45Count} 回で上限 ${limits.over45CountLimit} 回に達しています`
          : `月45時間超は年間 ${over45Count} 回で上限内です`;
    alerts.push({
      check: "over45_count",
      level: jCount.level,
      period: rangePeriod,
      actual: over45Count,
      limit: limits.over45CountLimit,
      excess: jCount.excess,
      unit: "count",
      message: `${countHead}（${rangeLabel}）。`,
    });
  }

  // --- 複数月移動平均（2〜6か月、以下）: 時間外＋休日の窓内合計 <= 上限 × 月数 ---
  for (const windowSize of limits.multiMonthWindowSizes) {
    if (windowSize < 2 || months.length < windowSize) continue;
    for (let i = 0; i + windowSize <= months.length; i++) {
      const window = months.slice(i, i + windowSize);
      // 暦月として連続している窓のみを評価する（欠落月がある場合はスキップ）。
      const contiguous = window.every(
        (m, k) =>
          k === 0 ||
          monthIndex(m.period) === monthIndex(window[k - 1]!.period) + 1,
      );
      if (!contiguous) continue;

      const start = window[0]!;
      const end = window[windowSize - 1]!;
      const sum = window.reduce((s, m) => s + overtimePlusHoliday(m), 0);
      const windowLimit = limits.multiMonthAverageLimitMinutes * windowSize;
      const avg = Math.floor(sum / windowSize);

      const j = judgeAtMost(sum, windowLimit, limits.warningRatioPercent);
      const period: AlertPeriod = {
        kind: "range",
        start: start.period,
        end: end.period,
        monthCount: windowSize,
      };
      const label = `${formatYearMonth(start.period)}〜${formatYearMonth(end.period)}`;
      alerts.push(
        minutesAlert(
          "multi_month_average",
          period,
          sum,
          windowLimit,
          j,
          `${label}(${windowSize}か月): 平均 ${formatMinutes(avg)} / 上限 ${formatMinutes(limits.multiMonthAverageLimitMinutes)}以下`,
        ),
      );
    }
  }

  let worst: ComplianceLevel = "ok";
  for (const a of alerts) {
    if (LEVEL_RANK[a.level] > LEVEL_RANK[worst]) worst = a.level;
  }

  return {
    alerts,
    worstLevel: worst,
    hasViolation: alerts.some((a) => a.level === "exceeded"),
  };
}
