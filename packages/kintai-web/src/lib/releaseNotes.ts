/**
 * リリースノート（静的なバージョン履歴）。
 *
 * バージョン・リリース日・変更点を配列で保持する。表示は常に新しい順（現行版が先頭）
 * とし、{@link sortReleaseNotesDesc} で整形する（純粋関数・ユニットテスト対象）。
 * 現行版は {@link file://./version.ts APP_VERSION} と一致させること。
 */

import { APP_VERSION } from "./version";

/** 変更種別（バッジ表示に用いる）。 */
export type ReleaseChangeKind = "added" | "changed" | "fixed";

/** 1件の変更点。 */
export interface ReleaseChange {
  readonly kind: ReleaseChangeKind;
  readonly text: string;
}

/** 1つのリリース（バージョン単位）。 */
export interface ReleaseNote {
  /** セマンティックバージョン（例 `1.0.0`）。 */
  readonly version: string;
  /** リリース日（`YYYY-MM-DD`）。 */
  readonly date: string;
  /** 見出し（このリリースの要約）。 */
  readonly title: string;
  /** 変更点の一覧。 */
  readonly changes: readonly ReleaseChange[];
}

/**
 * バージョン履歴（定義順は不問。表示前に {@link sortReleaseNotesDesc} で降順整形する）。
 * 先頭の現行版は {@link APP_VERSION} と一致させる。
 */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: APP_VERSION,
    date: "2026-07-24",
    title: "ダッシュボード UI 全面刷新",
    changes: [
      { kind: "added", text: "上部タブナビ付きの共通アプリシェルを追加" },
      { kind: "added", text: "勤怠一覧・月次締め・給与 CSV 画面を追加" },
      { kind: "added", text: "改善リクエストの投稿・一覧画面を追加" },
      { kind: "added", text: "リリースノート画面とバージョン自動更新通知を追加" },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-30",
    title: "簡易ログインと当日照会",
    changes: [
      { kind: "added", text: "従業員選択によるキオスク型簡易ログインを追加" },
      { kind: "changed", text: "打刻の employeeId を cookie セッションから解決するよう変更" },
      { kind: "fixed", text: "当日打刻一覧の並び順を時刻昇順に修正" },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-01",
    title: "打刻 MVP",
    changes: [
      { kind: "added", text: "出勤・退勤・休憩の打刻ボタンを追加" },
      { kind: "added", text: "実労働時間の概算表示を追加" },
    ],
  },
];

/** バージョン文字列を数値タプルへ分解する（比較用・欠損は 0）。 */
function parseVersion(version: string): readonly [number, number, number] {
  const parts = version.split(".");
  const at = (i: number): number => {
    const raw = parts[i];
    const n = raw === undefined ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  };
  return [at(0), at(1), at(2)];
}

/**
 * リリースノートをバージョン降順（新しい順）で返す新しい配列を作る（純粋関数）。
 * 元配列は変更しない。バージョンが同じなら日付の降順で安定させる。
 *
 * @param notes 整形対象のリリースノート
 * @returns 新しい順に並べ替えた新配列
 */
export function sortReleaseNotesDesc(
  notes: readonly ReleaseNote[],
): readonly ReleaseNote[] {
  return [...notes].sort((a, b) => {
    const [aMaj, aMin, aPat] = parseVersion(a.version);
    const [bMaj, bMin, bPat] = parseVersion(b.version);
    if (aMaj !== bMaj) return bMaj - aMaj;
    if (aMin !== bMin) return bMin - aMin;
    if (aPat !== bPat) return bPat - aPat;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}
