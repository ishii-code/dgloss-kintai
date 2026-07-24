/**
 * モジュールカタログ（modules.ts）の整合性・役割フィルタのユニットテスト。
 *
 * カタログは管理コンソール（ランチャー・ナビ・準備中ページ）の単一情報源のため、
 * ここで不変条件を固定する。特に「全モジュールが実ルート（page.tsx）を持つ」ことを
 * ファイル存在で検証し、active/soon いずれのリンクも遷移先を欠かないことを保証する。
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  CATEGORY_ORDER,
  MODULES,
  findModuleByPath,
  modulesForRole,
  navLinksForRole,
} from "./modules";

/** `(app)` ルートグループのディレクトリ（このテストファイルから解決）。 */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "(app)");

/** モジュールパスから期待する page.tsx の絶対パスを組み立てる。 */
function pageFileFor(path: string): string {
  const segments = path.split("/").filter((s) => s !== "");
  return join(APP_DIR, ...segments, "page.tsx");
}

describe("MODULES カタログの整合性", () => {
  it("id が一意である", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("path が一意で、すべて / から始まる", () => {
    const paths = MODULES.map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) {
      expect(p.startsWith("/")).toBe(true);
    }
  });

  it("category はすべて CATEGORY_ORDER に含まれる", () => {
    for (const m of MODULES) {
      expect(CATEGORY_ORDER).toContain(m.category);
    }
  });

  it("active は phase を持たず、soon は phase を持つ", () => {
    for (const m of MODULES) {
      if (m.status === "active") {
        expect(m.phase).toBeUndefined();
      } else {
        expect(typeof m.phase).toBe("number");
      }
    }
  });

  it("全モジュールが対応するルート（page.tsx）を持つ", () => {
    for (const m of MODULES) {
      const file = pageFileFor(m.path);
      expect(existsSync(file), `${m.id} (${m.path}) の page.tsx が無い`).toBe(
        true,
      );
    }
  });
});

describe("modulesForRole", () => {
  it("admin は全モジュールを参照できる", () => {
    expect(modulesForRole(MODULES, "admin")).toHaveLength(MODULES.length);
  });

  it("general は requiredRole=general のみ（admin 専用は除外）", () => {
    const general = modulesForRole(MODULES, "general");
    expect(general.every((m) => m.requiredRole === "general")).toBe(true);
    expect(general.some((m) => m.requiredRole === "admin")).toBe(false);
  });

  it("null（未ログイン）は general と同じ扱い", () => {
    expect(modulesForRole(MODULES, null)).toEqual(
      modulesForRole(MODULES, "general"),
    );
  });

  it("general 向けには準備中（soon・admin 専用）が含まれない", () => {
    const general = modulesForRole(MODULES, "general");
    expect(general.every((m) => m.status === "active")).toBe(true);
  });
});

describe("navLinksForRole", () => {
  it("先頭は必ずホームである", () => {
    const links = navLinksForRole(MODULES, "general");
    expect(links[0]).toEqual({ href: "/", label: "ホーム" });
  });

  it("admin の主要タブは general の主要タブを包含する", () => {
    const adminHrefs = navLinksForRole(MODULES, "admin").map((l) => l.href);
    const generalHrefs = navLinksForRole(MODULES, "general").map((l) => l.href);
    for (const href of generalHrefs) {
      expect(adminHrefs).toContain(href);
    }
    // admin は給与CSV（admin 専用の主要タブ）を追加で持つ。
    expect(adminHrefs).toContain("/payroll");
    expect(generalHrefs).not.toContain("/payroll");
  });
});

describe("findModuleByPath", () => {
  it("既知パスは対応モジュールを返す", () => {
    expect(findModuleByPath("/stamp")?.id).toBe("stamp");
    expect(findModuleByPath("/settings/company")?.id).toBe("settings-company");
  });

  it("未知パスは undefined", () => {
    expect(findModuleByPath("/nope")).toBeUndefined();
  });
});
