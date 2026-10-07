/**
 * 固定残業超過アラート通知器のテスト。
 * メッセージ整形と、環境変数による対象事業部・通知器の選択を検証する。
 */

import { afterEach, describe, expect, it } from "vitest";
import type { FixedOvertimeAlert } from "@dgloss-kintai/api";
import type { EmployeeId, IsoDate } from "@dgloss-kintai/contracts";
import {
  GoogleChatOvertimeAlertNotifier,
  NoopOvertimeAlertNotifier,
  createOvertimeAlertNotifier,
  formatOvertimeAlertText,
  overtimeAlertDepartments,
} from "./overtimeAlertNotifier.js";

function alert(overrides: Partial<FixedOvertimeAlert> = {}): FixedOvertimeAlert {
  return {
    employeeId: "e1" as EmployeeId,
    employeeCode: "1001",
    name: "田中 太郎",
    department: "パートナー事業部",
    period: { year: 2026, month: 10 },
    asOf: "2026-10-07" as IsoDate,
    fixedOvertimeAllowance: 40_000,
    overtimeMinutes: 2_550, // 42.5h
    additionalPayment: 12_300,
    ...overrides,
  };
}

describe("formatOvertimeAlertText", () => {
  it("事業部・氏名・固定残業・時間外・超過額を含む", () => {
    const text = formatOvertimeAlertText([alert()]);
    expect(text).toContain("固定残業を超えて残業代が発生");
    expect(text).toContain("2026年10月");
    expect(text).toContain("基準日 2026-10-07");
    expect(text).toContain("[パートナー事業部] 田中 太郎（社員番号 1001）");
    expect(text).toContain("固定残業 ¥40,000");
    expect(text).toContain("42.5時間");
    expect(text).toContain("超過 ¥12,300");
  });

  it("複数人を1通にまとめる", () => {
    const text = formatOvertimeAlertText([
      alert(),
      alert({ employeeCode: "1002", name: "佐藤 花子" }),
    ]);
    expect(text).toContain("田中 太郎");
    expect(text).toContain("佐藤 花子");
    // 「社員番号」は1人につき1回出る。
    expect(text.split("社員番号").length - 1).toBe(2);
  });
});

describe("overtimeAlertDepartments", () => {
  const original = process.env.KINTAI_OVERTIME_ALERT_DEPARTMENTS;
  afterEach(() => {
    if (original === undefined) delete process.env.KINTAI_OVERTIME_ALERT_DEPARTMENTS;
    else process.env.KINTAI_OVERTIME_ALERT_DEPARTMENTS = original;
  });

  it("既定はパートナー・AIテレアポの2事業部", () => {
    delete process.env.KINTAI_OVERTIME_ALERT_DEPARTMENTS;
    expect(overtimeAlertDepartments()).toEqual([
      "パートナー事業部",
      "AIテレアポ事業部",
    ]);
  });

  it("環境変数（カンマ区切り）で上書きできる", () => {
    process.env.KINTAI_OVERTIME_ALERT_DEPARTMENTS = "営業部, 開発部 ,";
    expect(overtimeAlertDepartments()).toEqual(["営業部", "開発部"]);
  });
});

describe("createOvertimeAlertNotifier", () => {
  const original = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_CHAT_WEBHOOK_URL;
    else process.env.GOOGLE_CHAT_WEBHOOK_URL = original;
  });

  it("Webhook ありは Google チャット通知器", () => {
    process.env.GOOGLE_CHAT_WEBHOOK_URL = "https://chat.googleapis.com/x";
    expect(createOvertimeAlertNotifier()).toBeInstanceOf(
      GoogleChatOvertimeAlertNotifier,
    );
  });

  it("Webhook なしは no-op 通知器", () => {
    delete process.env.GOOGLE_CHAT_WEBHOOK_URL;
    expect(createOvertimeAlertNotifier()).toBeInstanceOf(
      NoopOvertimeAlertNotifier,
    );
  });
});
