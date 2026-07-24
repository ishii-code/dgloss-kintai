/**
 * リリースノート整形（純粋関数）のユニットテスト。
 */

import { describe, it, expect } from "vitest";

import { APP_VERSION } from "./version";
import {
  RELEASE_NOTES,
  sortReleaseNotesDesc,
} from "./releaseNotes";
import type { ReleaseNote } from "./releaseNotes";

describe("sortReleaseNotesDesc", () => {
  it("バージョン降順（新しい順）に並べ替える", () => {
    const input: readonly ReleaseNote[] = [
      { version: "0.1.0", date: "2026-06-01", title: "a", changes: [] },
      { version: "1.0.0", date: "2026-07-24", title: "b", changes: [] },
      { version: "0.2.0", date: "2026-06-30", title: "c", changes: [] },
    ];
    const sorted = sortReleaseNotesDesc(input);
    expect(sorted.map((n) => n.version)).toEqual(["1.0.0", "0.2.0", "0.1.0"]);
  });

  it("元配列を変更しない（純粋）", () => {
    const input: readonly ReleaseNote[] = [
      { version: "0.1.0", date: "2026-06-01", title: "a", changes: [] },
      { version: "1.0.0", date: "2026-07-24", title: "b", changes: [] },
    ];
    const before = input.map((n) => n.version);
    sortReleaseNotesDesc(input);
    expect(input.map((n) => n.version)).toEqual(before);
  });

  it("現行版（APP_VERSION）が先頭に来る", () => {
    const sorted = sortReleaseNotesDesc(RELEASE_NOTES);
    expect(sorted[0]?.version).toBe(APP_VERSION);
  });
});
