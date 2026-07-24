import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";

/**
 * ログイン後の画面グループの共通レイアウト。
 *
 * すべての認証後ページを {@link AppShell}（上部タブナビ・ヘッダ・バージョン自動更新）で包む。
 * ルートグループ `(app)` は URL に現れないため、`/`・`/attendance` などのパスは従来どおり。
 */
export default function AppGroupLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return <AppShell>{children}</AppShell>;
}
