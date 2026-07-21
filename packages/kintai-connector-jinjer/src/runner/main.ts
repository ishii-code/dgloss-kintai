/**
 * Shadow 検証デモの CLI エントリ。
 *
 * {@link runShadowDemo} を実行し、突合レポートを人間可読に標準出力へ表示する。
 * 時刻は固定注入されるため出力は決定的（毎回同じ）。ネットワークには一切アクセスしない。
 *
 * 実行例（Node22・ワークスペース依存は dist ビルド済み前提）:
 *   pnpm --filter @dgloss-kintai/connector-jinjer build
 *   node packages/kintai-connector-jinjer/dist/runner/main.js
 *
 * 本パッケージは `@types/node` に依存しないため、`console` は最小シグネチャを自前定義し
 * `globalThis.console` を用いる（transport.ts の fetch と同じ方針）。
 */

import { describeShadowRisk } from "../shadow.js";
import {
  demoEmployeeNames,
  formatShadowReport,
  runShadowDemo,
} from "./demo.js";
import { buildDemoScenarios } from "./fixtures.js";

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

/** デモを実行し、シナリオ一覧・突合レポート・未払いリスク文言を標準出力へ表示する。 */
export async function main(): Promise<void> {
  const out = resolveConsole();
  const names = demoEmployeeNames();

  out.log("==== Shadow 検証デモ（スタブ jinjer transport・ネットワーク非依存）====");
  out.log("");
  out.log("---- シナリオ ----");
  for (const s of buildDemoScenarios()) {
    out.log(`- ${s.employee.id}（${s.employee.name}）: ${s.description}`);
  }
  out.log("");

  const result = await runShadowDemo();
  out.log(formatShadowReport(result, { employeeNames: names }));

  if (result.mismatches.length > 0) {
    out.log("");
    out.log("---- リスク警告 ----");
    for (const m of result.mismatches) {
      const risk = describeShadowRisk(m);
      if (risk !== null) {
        out.log(risk);
      }
    }
  }

  out.log("");
  out.log(`不一致イベント生成数: ${result.mismatchEvents.length}`);
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
