"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { fetchSession } from "@/lib/session";

/** ガードの状態。役割解決前のちらつき・不正表示を防ぐ。 */
type GuardState = "checking" | "allowed" | "denied";

/**
 * 管理者専用ページのクライアントガード（ロール土台・Phase 1）。
 *
 * `/api/session` の役割を確認し、管理者なら子要素を、そうでなければ `/`（ホーム）へ
 * リダイレクトする。URL 直打ちで管理者ページへ来た一般ユーザーを弾くための土台で、
 * 厳密な権限機構（サーバ強制・RBAC）は Phase 4。判定中は本文を出さない。
 */
export function AdminGuard({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { role } = await fetchSession();
        if (!alive) {
          return;
        }
        if (role === "admin") {
          setState("allowed");
        } else {
          setState("denied");
          router.replace("/");
        }
      } catch {
        // 取得失敗は保険として弾く（AppShell が別途ログインへ誘導する）。
        if (alive) {
          setState("denied");
          router.replace("/");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (state !== "allowed") {
    return (
      <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-base text-neutral-400">読み込み中…</p>
      </div>
    );
  }

  return <>{children}</>;
}
