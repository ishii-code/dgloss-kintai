"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import { findModuleByPath } from "@/lib/modules";
import type { KintaiModule } from "@/lib/modules";

/**
 * 未実装モジュール共通の「準備中」プレースホルダ。
 *
 * 現在のパスから {@link findModuleByPath} で自分の定義を引き、モジュール概要と
 * 「準備中（Phase X で実装予定）」を表示する。ルート定義はカタログ（modules.ts）
 * が単一情報源で、各ページは本コンポーネントを描画するだけ。
 *
 * `requiredRole: "admin"` のモジュールは {@link AdminGuard} で包み、一般ユーザーの
 * URL 直打ちを `/` へ戻す（ロール土台・Phase 1。厳密な権限機構は Phase 4）。
 */
export function ComingSoon(): ReactNode {
  const pathname = usePathname();
  const module = findModuleByPath(pathname);

  if (module === undefined) {
    // カタログに無いパス（想定外）。案内だけ出してホームへ戻す導線を示す。
    return (
      <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-xl font-bold text-neutral-700">準備中</p>
        <p className="mt-4">
          <Link href="/" className="text-base font-bold text-secondary underline">
            ホームへ戻る
          </Link>
        </p>
      </div>
    );
  }

  if (module.requiredRole === "admin") {
    return (
      <AdminGuard>
        <ComingSoonBody module={module} />
      </AdminGuard>
    );
  }
  return <ComingSoonBody module={module} />;
}

/** 準備中の本文（役割ガードを通過したあとに描画）。 */
function ComingSoonBody({
  module,
}: {
  readonly module: KintaiModule;
}): ReactNode {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-4xl leading-none">
          {module.icon}
        </span>
        <h1 className="text-2xl font-bold text-neutral-900">{module.label}</h1>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-bold text-neutral-500">
          準備中
        </span>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-base text-neutral-700">{module.description}</p>
        <p className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-base font-bold text-neutral-800">
          この機能は準備中です
          {module.phase !== undefined
            ? `（Phase ${module.phase} で実装予定）`
            : ""}
          。
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          現在は全体像の可視化（Phase 1）のためのプレースホルダを表示しています。
          稼働中の機能はホームの「よく使う機能」からご利用ください。
        </p>
      </section>

      <div>
        <Link
          href="/"
          className="inline-flex rounded-xl border border-neutral-300 px-5 py-3 text-base font-bold text-neutral-700 hover:bg-neutral-50"
        >
          ← ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
