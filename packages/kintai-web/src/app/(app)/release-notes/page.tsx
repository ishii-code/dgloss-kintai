import type { ReactNode } from "react";

import { APP_VERSION } from "@/lib/version";
import {
  RELEASE_NOTES,
  sortReleaseNotesDesc,
} from "@/lib/releaseNotes";
import type { ReleaseChangeKind } from "@/lib/releaseNotes";

/** 変更種別のバッジ表示（ラベル・配色）。 */
const CHANGE_BADGE: Readonly<
  Record<ReleaseChangeKind, { readonly label: string; readonly className: string }>
> = {
  added: { label: "追加", className: "bg-primary/20 text-neutral-800" },
  changed: { label: "変更", className: "bg-secondary/20 text-neutral-800" },
  fixed: { label: "修正", className: "bg-neutral-200 text-neutral-700" },
};

/**
 * リリースノート画面。
 *
 * 静的なバージョン履歴（{@link RELEASE_NOTES}）を新しい順に表示する。先頭が現行版
 * （{@link APP_VERSION}）。静的データのみを扱うためサーバコンポーネントで描画する。
 */
export default function ReleaseNotesPage(): ReactNode {
  const notes = sortReleaseNotesDesc(RELEASE_NOTES);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-neutral-900">リリースノート</h1>

      <ol className="flex flex-col gap-4">
        {notes.map((note, index) => {
          const current = index === 0;
          return (
            <li
              key={note.version}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-xl font-bold tabular-nums text-neutral-900">
                  v{note.version}
                </span>
                {current && note.version === APP_VERSION && (
                  <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                    現行版
                  </span>
                )}
                <span className="font-mono text-sm tabular-nums text-neutral-400">
                  {note.date}
                </span>
              </div>
              <p className="mt-1 text-lg font-bold text-neutral-800">
                {note.title}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {note.changes.map((change, i) => {
                  const badge = CHANGE_BADGE[change.kind];
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-base text-neutral-700">
                        {change.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
