/**
 * buildWorkDaysFromStamps のテスト（打刻→日次勤怠）。
 * 出退勤・休憩の復元、残業・深夜の区分、日付グルーピングを検証する。
 */

import { describe, expect, it } from "vitest";
import type { Stamp, StampType } from "@dgloss-kintai/contracts";
import { buildWorkDaysFromStamps } from "./dailyAttendance.js";
import { makeEmployee } from "./testFixtures.js";

let seq = 0;
/** JST の日付・時刻から打刻を作る。 */
function stamp(type: StampType, date: string, hhmm: string): Stamp {
  seq += 1;
  return {
    id: `st_${seq}` as Stamp["id"],
    employeeId: "E" as Stamp["employeeId"],
    type,
    stampedAt: `${date}T${hhmm}:00+09:00` as Stamp["stampedAt"],
    source: "manual",
    note: null,
  };
}

const employee = makeEmployee("E");

describe("buildWorkDaysFromStamps", () => {
  it("出勤・休憩・退勤から実労働・休憩を復元する（9:00-18:00・休憩1h）", () => {
    const stamps = [
      stamp("clock_in", "2026-07-01", "09:00"),
      stamp("break_start", "2026-07-01", "12:00"),
      stamp("break_end", "2026-07-01", "13:00"),
      stamp("clock_out", "2026-07-01", "18:00"),
    ];
    const [wd] = buildWorkDaysFromStamps(employee, stamps);
    expect(wd?.actualWorkedMinutes).toBe(480); // 9h拘束 − 1h休憩
    expect(wd?.breakMinutes).toBe(60);
    expect(wd?.classified.statutoryOvertimeMinutes).toBe(0);
    expect(wd?.classified.nonStatutoryOvertimeMinutes).toBe(0);
  });

  it("8h超は法定外残業になる（9:00-21:00・休憩1h → 実労働11h）", () => {
    const stamps = [
      stamp("clock_in", "2026-07-02", "09:00"),
      stamp("break_start", "2026-07-02", "12:00"),
      stamp("break_end", "2026-07-02", "13:00"),
      stamp("clock_out", "2026-07-02", "21:00"),
    ];
    const [wd] = buildWorkDaysFromStamps(employee, stamps);
    expect(wd?.actualWorkedMinutes).toBe(660); // 11h
    expect(wd?.classified.statutoryOvertimeMinutes).toBe(180); // 8h超=3h
    // 22:00前まで＝深夜なし
    expect(wd?.classified.nightMinutes).toBe(0);
  });

  it("22:00以降は深夜労働として計上する（18:00-23:00）", () => {
    const stamps = [
      stamp("clock_in", "2026-07-03", "18:00"),
      stamp("clock_out", "2026-07-03", "23:00"),
    ];
    const [wd] = buildWorkDaysFromStamps(employee, stamps);
    // 22:00-23:00 の1hが深夜
    expect(wd?.classified.nightMinutes).toBe(60);
  });

  it("複数日をそれぞれ WorkDay 化する", () => {
    const stamps = [
      stamp("clock_in", "2026-07-01", "09:00"),
      stamp("clock_out", "2026-07-01", "17:00"),
      stamp("clock_in", "2026-07-02", "09:00"),
      stamp("clock_out", "2026-07-02", "17:00"),
    ];
    const wds = buildWorkDaysFromStamps(employee, stamps);
    expect(wds).toHaveLength(2);
    expect(wds.map((w) => w.date)).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("退勤打刻が無い日は労働区間を作らない（未確定）", () => {
    const stamps = [stamp("clock_in", "2026-07-04", "09:00")];
    expect(buildWorkDaysFromStamps(employee, stamps)).toHaveLength(0);
  });

  it("対象外の打刻種別（pc_login等）は無視する", () => {
    const stamps = [
      stamp("pc_login", "2026-07-05", "08:55"),
      stamp("pc_logout", "2026-07-05", "18:05"),
    ];
    expect(buildWorkDaysFromStamps(employee, stamps)).toHaveLength(0);
  });

  it("日跨ぎ勤務は出勤日に帰属し、翌朝までの深夜も計上する（22:00-翌5:00）", () => {
    // 22:00 出勤 → 翌 05:00 退勤（休憩なし・実労働7h）。
    const stamps = [
      stamp("clock_in", "2026-07-10", "22:00"),
      stamp("clock_out", "2026-07-11", "05:00"),
    ];
    const wds = buildWorkDaysFromStamps(employee, stamps);
    // 出勤日(7/10)の1件だけになる（翌日には作らない）。
    expect(wds).toHaveLength(1);
    expect(wds[0]?.date).toBe("2026-07-10");
    expect(wds[0]?.actualWorkedMinutes).toBe(420); // 7h
    // 22:00-24:00(2h) + 00:00-05:00(5h) = 7h すべて深夜帯。
    expect(wds[0]?.classified.nightMinutes).toBe(420);
    // 8h未満なので法定外残業は0。
    expect(wds[0]?.classified.statutoryOvertimeMinutes).toBe(0);
  });

  it("日跨ぎ＋長時間は法定外残業と深夜を両立して算定する（20:00-翌7:00・休憩1h）", () => {
    const stamps = [
      stamp("clock_in", "2026-07-12", "20:00"),
      stamp("break_start", "2026-07-13", "00:00"),
      stamp("break_end", "2026-07-13", "01:00"),
      stamp("clock_out", "2026-07-13", "07:00"),
    ];
    const [wd] = buildWorkDaysFromStamps(employee, stamps);
    // 拘束11h − 休憩1h = 実労働10h。
    expect(wd?.actualWorkedMinutes).toBe(600);
    expect(wd?.breakMinutes).toBe(60);
    // 8h超 = 2h 法定外残業。
    expect(wd?.classified.statutoryOvertimeMinutes).toBe(120);
    // 深夜: 22:00-24:00(2h) + 01:00-05:00(4h) = 6h（00:00-01:00は休憩で除外）。
    expect(wd?.classified.nightMinutes).toBe(360);
  });

  it("WorkDay の id は従業員×日付で決定的", () => {
    const stamps = [
      stamp("clock_in", "2026-07-01", "09:00"),
      stamp("clock_out", "2026-07-01", "17:00"),
    ];
    const [wd] = buildWorkDaysFromStamps(employee, stamps);
    expect(wd?.id).toBe(`wd_${employee.id}_2026-07-01`);
  });
});
