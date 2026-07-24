"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { EmployeeSummary } from "@/lib/employeeSummary";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MODULES,
  modulesForRole,
  modulesInCategory,
} from "@/lib/modules";
import type { KintaiModule, Role } from "@/lib/modules";
import { fetchSession } from "@/lib/session";
import { APP_VERSION } from "@/lib/version";

/** 挨拶ヘッダに出す日付（JST の `YYYY年M月D日(曜)`）。 */
const GREETING_DATE_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

/** 時刻帯に応じた挨拶文（純粋・JST 概算）。 */
function greetingWord(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hour < 5) {
    return "お疲れさまです";
  }
  if (hour < 11) {
    return "おはようございます";
  }
  if (hour < 18) {
    return "こんにちは";
  }
  return "お疲れさまです";
}

/**
 * ランチャー型ホーム（jinjer 風の管理コンソール・トップ）。
 *
 * 挨拶ヘッダ＋「よく使う機能」タイル群＋（管理者のみ）カテゴリ別の「準備中」タイルを、
 * すべて {@link MODULES} カタログから役割でフィルタして描画する（単一情報源）。
 * 一般ユーザーは打刻・勤怠一覧中心、管理者は人事・給与・各種設定の全体像も見える。
 */
export default function HomePage(): ReactNode {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    void (async () => {
      try {
        const session = await fetchSession();
        setEmployee(session.employee);
        setRole(session.role);
      } catch {
        // 取得失敗は AppShell 側がログインへ誘導するため、ここでは黙って諦める。
      }
    })();
  }, []);

  // 役割で参照可能なモジュールに絞り込む。
  const visible = useMemo(() => modulesForRole(MODULES, role), [role]);
  // 「よく使う機能」＝稼働中モジュール。
  const active = useMemo(
    () => visible.filter((m) => m.status === "active"),
    [visible],
  );
  // 「準備中」＝カテゴリ別に並べて全体像を可視化する。
  const soonByCategory = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        modules: modulesInCategory(visible, category).filter(
          (m) => m.status === "soon",
        ),
      })).filter((group) => group.modules.length > 0),
    [visible],
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-400">
            {now === null ? " " : GREETING_DATE_FMT.format(now)}
          </span>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
            {now === null ? "こんにちは" : greetingWord(now)}、
            {employee?.name ?? "ゲスト"} さん
          </h1>
          <span className="text-sm text-neutral-500">
            {role === "admin" ? "管理者" : "一般"}アカウントでサインイン中
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs tabular-nums text-neutral-500">
            ディグロス勤怠 v{APP_VERSION}
          </span>
          <Link
            href="/stamp"
            className="rounded-xl bg-primary px-5 py-2 text-base font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            打刻する
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-neutral-900">よく使う機能</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {active.map((module) => (
            <ModuleTile key={module.id} module={module} />
          ))}
        </div>
      </section>

      {soonByCategory.map((group) => (
        <section key={group.category} className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-neutral-900">
              {CATEGORY_LABELS[group.category]}
            </h2>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-500">
              準備中
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.modules.map((module) => (
              <ModuleTile key={module.id} module={module} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * ランチャーの 1 タイル（アイコン＋ラベル＋概要）。
 * 稼働中は実画面へ、準備中は共通プレースホルダへ遷移する（どちらも押下可）。
 */
function ModuleTile({ module }: { readonly module: KintaiModule }): ReactNode {
  const soon = module.status === "soon";
  return (
    <Link
      href={module.path}
      aria-label={module.label}
      className={`group flex min-h-[8.5rem] flex-col gap-2 rounded-2xl border-2 p-4 shadow-sm transition select-none touch-manipulation ${
        soon
          ? "border-dashed border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
          : "border-transparent bg-white hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      <div className="flex items-start justify-between">
        <span aria-hidden className="text-3xl leading-none">
          {module.icon}
        </span>
        {soon && (
          <span className="rounded-md bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600">
            準備中
          </span>
        )}
      </div>
      <span className="text-base font-bold text-neutral-900">
        {module.label}
      </span>
      <span className="line-clamp-2 text-xs text-neutral-500">
        {module.description}
      </span>
    </Link>
  );
}
