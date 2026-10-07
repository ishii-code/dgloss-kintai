import "server-only";

/**
 * 固定残業超過アラートの通知器（Google チャット Incoming Webhook・サーバ専用）。
 *
 * 環境変数 `GOOGLE_CHAT_WEBHOOK_URL`（Google チャットのスペースで発行する受信ウェブフック
 * URL・トークンを含む秘密情報）に、超過者の一覧を1通のテキストメッセージとして POST する。
 * URL 未設定時は送信せずログのみ（機能は休止）。送信失敗は例外を投げ、呼び出し側
 * （usecase）が「通知済み」を記録する前に伝播させる＝次回再試行される。
 */

import type { FixedOvertimeAlert, OvertimeAlertNotifier } from "@dgloss-kintai/api";

/** 分 → 「H.H時間」表記（小数1桁）。 */
function minutesToHours(min: number): string {
  return (Math.round((min / 60) * 10) / 10).toFixed(1);
}

/** 円の3桁区切り。 */
function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/** アラート配列を Google チャット向けの1通のテキストに整形する。 */
export function formatOvertimeAlertText(
  alerts: readonly FixedOvertimeAlert[],
): string {
  const first = alerts[0];
  const header =
    first === undefined
      ? "固定残業超過アラート"
      : `⚠️ 固定残業を超えて残業代が発生しています（当月見込み・${first.period.year}年${first.period.month}月 / 基準日 ${first.asOf}）`;
  const lines = alerts.map((a) => {
    const dept = a.department ? `[${a.department}] ` : "";
    return (
      `・${dept}${a.name}（社員番号 ${a.employeeCode}）\n` +
      `　固定残業 ${yen(a.fixedOvertimeAllowance)} / 当月時間外 ${minutesToHours(a.overtimeMinutes)}時間 → 超過 ${yen(a.additionalPayment)}`
    );
  });
  return `${header}\n\n${lines.join("\n")}`;
}

/** Google チャット Incoming Webhook へ送る通知器。 */
export class GoogleChatOvertimeAlertNotifier implements OvertimeAlertNotifier {
  constructor(private readonly webhookUrl: string) {}

  async notify(alerts: readonly FixedOvertimeAlert[]): Promise<void> {
    if (alerts.length === 0) {
      return;
    }
    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text: formatOvertimeAlertText(alerts) }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Google チャット通知に失敗しました: HTTP ${res.status} ${body.slice(0, 200)}`,
      );
    }
  }
}

/** Webhook 未設定時の通知器（送信せずログのみ・機能休止）。 */
export class NoopOvertimeAlertNotifier implements OvertimeAlertNotifier {
  async notify(alerts: readonly FixedOvertimeAlert[]): Promise<void> {
    if (alerts.length > 0) {
      console.warn(
        `[overtime-alert] GOOGLE_CHAT_WEBHOOK_URL 未設定のため ${alerts.length} 件の通知を送信しませんでした。`,
      );
    }
  }
}

/**
 * 環境に応じた通知器を生成する。
 * `GOOGLE_CHAT_WEBHOOK_URL` があれば Google チャットへ、無ければ no-op（ログのみ）。
 */
export function createOvertimeAlertNotifier(): OvertimeAlertNotifier {
  const url = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (url !== undefined && url !== "") {
    return new GoogleChatOvertimeAlertNotifier(url);
  }
  return new NoopOvertimeAlertNotifier();
}

/**
 * 通知対象の事業部名一覧を環境変数から読む（カンマ区切り）。
 * 既定はパートナー事業部・AIテレアポ事業部。
 */
export function overtimeAlertDepartments(): readonly string[] {
  const raw = process.env.KINTAI_OVERTIME_ALERT_DEPARTMENTS;
  const list = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return list.length > 0 ? list : ["パートナー事業部", "AIテレアポ事業部"];
}
