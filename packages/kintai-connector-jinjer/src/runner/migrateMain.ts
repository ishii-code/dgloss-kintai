/**
 * jinjer 移行デモ（Ph0）の CLI エントリ。
 *
 * {@link runMigrationDemo} を実行し、移行レポートを人間可読に標準出力へ表示する。
 * 取得元はスタブ transport・書き込み先はインメモリ sink のため、ネットワークにも実 DB にも
 * 一切アクセスしない。出力は決定的（毎回同じ）。
 *
 * 実行例（Node22・ワークスペース依存は dist ビルド済み前提）:
 *   pnpm -r build
 *   node packages/kintai-connector-jinjer/dist/runner/migrateMain.js
 *
 * 本パッケージは `@types/node` に依存しないため、`console` は最小シグネチャを自前定義し
 * `globalThis.console` を用いる（main.ts / transport.ts と同じ方針）。
 */

import {
  buildMigrationEmployeeDtos,
  formatMigrationReport,
  runMigrationDemo,
} from "./migrateDemo.js";

/** 依存する console の最小シグネチャ。Node の console はこれに構造的に適合する。 */
interface MinimalConsole {
  log(...args: readonly unknown[]): void;
  error(...args: readonly unknown[]): void;
}

/** globalThis.console を最小シグネチャで取り出す（無ければ例外）。 */
function resolveConsole(): MinimalConsole {
  const c = (globalThis as unknown as { console?: MinimalConsole }).console;
  if (c === undefined) {
    throw new Error("console が利用できません。");
  }
  return c;
}

/** 移行デモを実行し、pull 件数・移行レポートを標準出力へ表示する。 */
export async function main(): Promise<void> {
  const out = resolveConsole();

  out.log(
    "==== jinjer 移行デモ（スタブ transport・インメモリ sink・ネットワーク非依存）====",
  );
  out.log("");
  out.log(`pull 対象の従業員 DTO 件数: ${buildMigrationEmployeeDtos().length}`);
  out.log("");

  const demo = await runMigrationDemo();
  out.log(formatMigrationReport(demo));
}

// このファイルが直接実行されたときのみ main を起動する（import 時は起動しない）。
// import.meta.url と実行 argv の一致で判定する（Node の慣用）。
const argv1 = (globalThis as unknown as { process?: { argv?: readonly string[] } })
  .process?.argv?.[1];
const moduleUrl = (import.meta as unknown as { url?: string }).url;
const isDirectRun =
  argv1 !== undefined &&
  moduleUrl !== undefined &&
  moduleUrl === `file://${argv1}`;

if (isDirectRun) {
  main().catch((err: unknown) => {
    const c = (globalThis as unknown as { console?: MinimalConsole }).console;
    c?.error(err);
    const proc = (globalThis as unknown as { process?: { exitCode?: number } })
      .process;
    if (proc !== undefined) {
      proc.exitCode = 1;
    }
  });
}
