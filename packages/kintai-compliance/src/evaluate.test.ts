import { describe, it, expect } from "vitest";
import type { MonthlyOvertime } from "./aggregate.js";
import type {
  ComplianceAlert,
  ComplianceCheckKind,
  ComplianceReport,
} from "./types.js";
import { evaluateCompliance } from "./evaluate.js";

/**
 * 36協定・上限規制の評価テスト。期待値はすべて手計算（分単位・整数）。
 *
 * 定数: 45h=2700 46h=2760 80h=4800 100h=6000 360h=21600 720h=43200
 *       警告しきい値(90%): 2700→2430 / 6000→5400
 */
const H = 60;
const mo = (
  year: number,
  month: number,
  overtimeMinutes: number,
  holidayMinutes = 0,
): MonthlyOvertime => ({ period: { year, month }, overtimeMinutes, holidayMinutes });

/** 指定チェックの最初のアラートを取得する。 */
function first(
  report: ComplianceReport,
  check: ComplianceCheckKind,
): ComplianceAlert {
  const a = report.alerts.find((x) => x.check === check);
  if (!a) throw new Error(`alert not found: ${check}`);
  return a;
}

/** 指定チェック・指定月数(range)のアラートを取得する。 */
function findRange(
  report: ComplianceReport,
  check: ComplianceCheckKind,
  monthCount: number,
): ComplianceAlert {
  const a = report.alerts.find(
    (x) =>
      x.check === check &&
      x.period.kind === "range" &&
      x.period.monthCount === monthCount,
  );
  if (!a) throw new Error(`range alert not found: ${check}/${monthCount}`);
  return a;
}

describe("単月チェック", () => {
  it("単月45h超過（46h）は exceeded・超過量60分", () => {
    const report = evaluateCompliance([mo(2025, 7, 46 * H)]);
    const a = first(report, "monthly_overtime");
    expect(a.level).toBe("exceeded");
    expect(a.actual).toBe(2760);
    expect(a.limit).toBe(2700);
    expect(a.excess).toBe(60);
    expect(report.hasViolation).toBe(true);
    expect(report.worstLevel).toBe("exceeded");
  });

  it("単月100h超過（時間外40h＋休日65h=105h）は exceeded・超過量301分", () => {
    // 時間外は45h未満に抑え、100h（時間外＋休日）チェックを独立に検証。
    const report = evaluateCompliance([mo(2025, 7, 40 * H, 65 * H)]);
    expect(first(report, "monthly_overtime").level).toBe("ok"); // 2400 < 2430
    const a = first(report, "monthly_with_holiday");
    expect(a.level).toBe("exceeded");
    expect(a.actual).toBe(6300); // 105h
    expect(a.limit).toBe(6000); // 100h
    expect(a.excess).toBe(301); // 6300 - (6000-1)
  });

  it("接近warning（41h は上限45hの90%=40.5h以上）", () => {
    const report = evaluateCompliance([mo(2025, 7, 41 * H)]);
    const a = first(report, "monthly_overtime");
    expect(a.level).toBe("warning");
    expect(a.actual).toBe(2460);
    expect(a.excess).toBe(0);
    expect(report.hasViolation).toBe(false);
    expect(report.worstLevel).toBe("warning");
  });
});

describe("境界値", () => {
  it("ちょうど45h は超過ではなく warning（超えていない）", () => {
    const a = first(evaluateCompliance([mo(2025, 7, 45 * H)]), "monthly_overtime");
    expect(a.level).toBe("warning");
    expect(a.actual).toBe(2700);
    expect(a.excess).toBe(0);
  });

  it("ちょうど100h は『未満』違反で exceeded・超過量1分", () => {
    // 時間外40h＋休日60h = ちょうど100h。
    const a = first(
      evaluateCompliance([mo(2025, 7, 40 * H, 60 * H)]),
      "monthly_with_holiday",
    );
    expect(a.level).toBe("exceeded");
    expect(a.actual).toBe(6000);
    expect(a.excess).toBe(1); // 6000 - 5999
  });

  it("複数月平均ちょうど80h は超過ではなく warning", () => {
    // 3か月とも 時間外40h＋休日40h=80h → 3か月合計 14400 = 上限4800×3。
    const report = evaluateCompliance([
      mo(2025, 7, 40 * H, 40 * H),
      mo(2025, 8, 40 * H, 40 * H),
      mo(2025, 9, 40 * H, 40 * H),
    ]);
    const a = findRange(report, "multi_month_average", 3);
    expect(a.level).toBe("warning");
    expect(a.actual).toBe(14400);
    expect(a.limit).toBe(14400);
    expect(a.excess).toBe(0);
    expect(report.hasViolation).toBe(false);
  });
});

describe("年間チェック", () => {
  it("年360h（原則）超過: 40h×10か月=400h は annual_overtime exceeded、720h以内", () => {
    const months = Array.from({ length: 10 }, (_, i) => mo(2025, i + 1, 40 * H));
    const report = evaluateCompliance(months);
    const annual = first(report, "annual_overtime");
    expect(annual.actual).toBe(24000); // 400h
    expect(annual.limit).toBe(21600); // 360h
    expect(annual.level).toBe("exceeded");
    expect(annual.excess).toBe(2400); // 40h
    // 特別条項の年720hは範囲内。
    expect(first(report, "annual_special_overtime").level).not.toBe("exceeded");
    // 各月40hは45h未満なので単月は ok。
    for (const a of report.alerts.filter((x) => x.check === "monthly_overtime")) {
      expect(a.level).toBe("ok");
    }
  });

  it("年720h（特別条項）超過: 61h×12か月=732h は annual_special_overtime exceeded", () => {
    const months = Array.from({ length: 12 }, (_, i) => mo(2025, i + 1, 61 * H));
    const report = evaluateCompliance(months);
    const a = first(report, "annual_special_overtime");
    expect(a.actual).toBe(43920); // 732h
    expect(a.limit).toBe(43200); // 720h
    expect(a.level).toBe("exceeded");
    expect(a.excess).toBe(720); // 12h
  });
});

describe("複数月平均チェック", () => {
  it("平均80h超過: 3か月とも 時間外40h＋休日45h=85h は 3か月窓 exceeded", () => {
    const report = evaluateCompliance([
      mo(2025, 7, 40 * H, 45 * H),
      mo(2025, 8, 40 * H, 45 * H),
      mo(2025, 9, 40 * H, 45 * H),
    ]);
    const a = findRange(report, "multi_month_average", 3);
    expect(a.actual).toBe(15300); // 85h×3
    expect(a.limit).toBe(14400); // 80h×3
    expect(a.level).toBe("exceeded");
    expect(a.excess).toBe(900); // 15300-14400
    // 単月は時間外40h(ok)・時間外＋休日85h<100h(ok)。
    expect(first(report, "monthly_overtime").level).toBe("ok");
    expect(first(report, "monthly_with_holiday").level).toBe("ok");
  });

  it("欠落月がある窓は評価しない（連続していない2か月は判定対象外）", () => {
    // 7月と9月のみ（8月欠落）→ 連続2か月窓は生成されない。
    const report = evaluateCompliance([
      mo(2025, 7, 40 * H, 45 * H),
      mo(2025, 9, 40 * H, 45 * H),
    ]);
    const hasAvg = report.alerts.some((x) => x.check === "multi_month_average");
    expect(hasAvg).toBe(false);
  });
});

describe("月45h超の年間回数", () => {
  it("6回はちょうど上限で warning（超過ではない）", () => {
    // 6か月とも46h超（各月は単月違反だが、回数チェックの level を検証）。
    const months = Array.from({ length: 6 }, (_, i) => mo(2025, i + 1, 46 * H));
    const report = evaluateCompliance(months);
    const a = first(report, "over45_count");
    expect(a.unit).toBe("count");
    expect(a.actual).toBe(6);
    expect(a.limit).toBe(6);
    expect(a.level).toBe("warning");
    expect(a.excess).toBe(0);
  });

  it("7回は exceeded・超過量1回", () => {
    const months = Array.from({ length: 7 }, (_, i) => mo(2025, i + 1, 46 * H));
    const report = evaluateCompliance(months);
    const a = first(report, "over45_count");
    expect(a.actual).toBe(7);
    expect(a.level).toBe("exceeded");
    expect(a.excess).toBe(1);
  });
});

describe("全て範囲内", () => {
  it("20h×3か月は全アラート ok・違反なし", () => {
    const report = evaluateCompliance([
      mo(2025, 7, 20 * H),
      mo(2025, 8, 20 * H),
      mo(2025, 9, 20 * H),
    ]);
    expect(report.worstLevel).toBe("ok");
    expect(report.hasViolation).toBe(false);
    for (const a of report.alerts) {
      expect(a.level).toBe("ok");
      expect(a.excess).toBe(0);
    }
    // 6種すべてのチェックが少なくとも1件は生成されている。
    const kinds = new Set(report.alerts.map((a) => a.check));
    expect(kinds).toEqual(
      new Set([
        "monthly_overtime",
        "annual_overtime",
        "annual_special_overtime",
        "monthly_with_holiday",
        "multi_month_average",
        "over45_count",
      ]),
    );
  });

  it("入力が空ならアラート無し・ok", () => {
    const report = evaluateCompliance([]);
    expect(report.alerts).toHaveLength(0);
    expect(report.worstLevel).toBe("ok");
    expect(report.hasViolation).toBe(false);
  });
});

describe("入力検証・設定上書き", () => {
  it("不正な月次入力（負の分）は zod で弾く", () => {
    expect(() =>
      evaluateCompliance([
        { period: { year: 2025, month: 7 }, overtimeMinutes: -1, holidayMinutes: 0 },
      ]),
    ).toThrow();
  });

  it("会社設定で単月上限を40hに厳格化できる", () => {
    const custom = evaluateCompliance([mo(2025, 7, 42 * H)], {
      monthlyOvertimeLimitMinutes: 40 * H,
      annualOvertimeLimitMinutes: 360 * H,
      annualSpecialOvertimeLimitMinutes: 720 * H,
      monthlyWithHolidayLimitMinutes: 100 * H,
      multiMonthAverageLimitMinutes: 80 * H,
      multiMonthWindowSizes: [2, 3, 4, 5, 6],
      over45CountLimit: 6,
      warningRatioPercent: 90,
    });
    const a = first(custom, "monthly_overtime");
    expect(a.limit).toBe(2400);
    expect(a.level).toBe("exceeded"); // 2520 > 2400
    expect(a.excess).toBe(120);
  });
});
