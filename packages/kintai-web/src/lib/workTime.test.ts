import { describe, expect, it } from "vitest";

import type {
  EmployeeId,
  Stamp,
  StampId,
  StampType,
  IsoDateTime,
} from "@dgloss-kintai/contracts";

import {
  deriveStatus,
  estimateWorkedMinutes,
  formatDuration,
} from "./workTime";

const EMP = "emp-1" as EmployeeId;

/** テスト用の打刻を簡潔に生成する。 */
function stamp(type: StampType, isoJst: string, seq: number): Stamp {
  return {
    id: `s${seq}` as StampId,
    employeeId: EMP,
    type,
    stampedAt: isoJst as IsoDateTime,
    source: "manual",
    note: null,
  };
}

describe("deriveStatus", () => {
  it("打刻なしは出勤前", () => {
    expect(deriveStatus([])).toBe("before_work");
  });

  it("出勤のみは勤務中", () => {
    expect(deriveStatus([stamp("clock_in", "2026-07-21T09:00:00+09:00", 1)])).toBe(
      "working",
    );
  });

  it("休憩開始で休憩中、休憩終了で勤務中に戻る", () => {
    const base = [
      stamp("clock_in", "2026-07-21T09:00:00+09:00", 1),
      stamp("break_start", "2026-07-21T12:00:00+09:00", 2),
    ];
    expect(deriveStatus(base)).toBe("on_break");
    expect(
      deriveStatus([
        ...base,
        stamp("break_end", "2026-07-21T12:45:00+09:00", 3),
      ]),
    ).toBe("working");
  });

  it("退勤済", () => {
    expect(
      deriveStatus([
        stamp("clock_in", "2026-07-21T09:00:00+09:00", 1),
        stamp("clock_out", "2026-07-21T18:00:00+09:00", 2),
      ]),
    ).toBe("after_work");
  });

  it("順不同でも時刻順に解釈する", () => {
    expect(
      deriveStatus([
        stamp("clock_out", "2026-07-21T18:00:00+09:00", 2),
        stamp("clock_in", "2026-07-21T09:00:00+09:00", 1),
      ]),
    ).toBe("after_work");
  });
});

describe("estimateWorkedMinutes", () => {
  it("打刻なしは 0", () => {
    const s = estimateWorkedMinutes([]);
    expect(s.workedMinutes).toBe(0);
    expect(s.breakMinutes).toBe(0);
    expect(s.spanMinutes).toBe(0);
  });

  it("休憩を控除した実労働を算出（9:00-18:00, 休憩45分 → 実働8時間15分）", () => {
    const stamps = [
      stamp("clock_in", "2026-07-21T09:00:00+09:00", 1),
      stamp("break_start", "2026-07-21T12:00:00+09:00", 2),
      stamp("break_end", "2026-07-21T12:45:00+09:00", 3),
      stamp("clock_out", "2026-07-21T18:00:00+09:00", 4),
    ];
    const s = estimateWorkedMinutes(stamps);
    expect(s.spanMinutes).toBe(9 * 60);
    expect(s.breakMinutes).toBe(45);
    expect(s.workedMinutes).toBe(8 * 60 + 15);
  });

  it("退勤前は nowIso 基準で概算する", () => {
    const stamps = [stamp("clock_in", "2026-07-21T09:00:00+09:00", 1)];
    const s = estimateWorkedMinutes(stamps, "2026-07-21T10:30:00+09:00");
    expect(s.workedMinutes).toBe(90);
  });

  it("進行中の休憩は nowIso まで控除する", () => {
    const stamps = [
      stamp("clock_in", "2026-07-21T09:00:00+09:00", 1),
      stamp("break_start", "2026-07-21T12:00:00+09:00", 2),
    ];
    const s = estimateWorkedMinutes(stamps, "2026-07-21T12:30:00+09:00");
    // 拘束 3.5h、うち休憩 30分 → 実働 3時間
    expect(s.spanMinutes).toBe(210);
    expect(s.breakMinutes).toBe(30);
    expect(s.workedMinutes).toBe(180);
  });
});

describe("formatDuration", () => {
  it("H時間MM分で整形する", () => {
    expect(formatDuration(0)).toBe("0時間00分");
    expect(formatDuration(495)).toBe("8時間15分");
    expect(formatDuration(5)).toBe("0時間05分");
  });

  it("負値は 0 として扱う", () => {
    expect(formatDuration(-10)).toBe("0時間00分");
  });
});
