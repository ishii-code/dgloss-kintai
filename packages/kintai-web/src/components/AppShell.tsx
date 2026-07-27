"use client";

/**
 * ログイン後の全画面で共通のアプリシェル。
 *
 * 上部タブナビ（打刻 / 勤怠一覧 / 月次締め / 給与CSV / リリースノート / 改善リクエスト）と、
 * ヘッダ（サインイン中の従業員名・バージョン・データ更新時刻・従業員切替）を提供する。
 * さらに `/api/version` を一定間隔でポーリングし、ビルド識別子が変われば「新しいバージョンが
 * あります」バナーを表示する（Ver 自動アップデート）。
 *
 * 経営 AI OS ダッシュボードに寄せた淡い背景・角丸カード・数値強調のトーンで、iPad でタップ
 * しやすい大きめの要素にする。
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { EmployeeSummary } from "@/lib/employeeSummary";
import { MODULES, navLinksForRole } from "@/lib/modules";
import type { Role } from "@/lib/modules";
import { fetchSession } from "@/lib/session";
import { APP_VERSION, isNewerBuild } from "@/lib/version";

/** ポーリング間隔（ミリ秒）。 */
const VERSION_POLL_INTERVAL_MS = 60_000;

/** 日時を JST の `M/D HH:mm` で表示する。 */
const UPDATED_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 現在のビルド識別子を取得する。 */
async function fetchBuildId(): Promise<string> {
  const res = await fetch("/api/version", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`バージョン取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { buildId: string };
  return json.buildId;
}

/** ログアウト（別の従業員に切替）する。 */
async function logout(): Promise<void> {
  await fetch("/api/session", { method: "DELETE" });
}

/** タブが現在のパスに対応するか判定する（`/` は完全一致）。 */
function isActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** アプリシェル本体。 */
export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [initialBuildId, setInitialBuildId] = useState<string>("");
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // マウント後にログイン中の従業員と役割を取得する。未ログインなら /login へ誘導する。
  useEffect(() => {
    void (async () => {
      try {
        const session = await fetchSession();
        if (session.employee === null) {
          router.replace("/login");
          return;
        }
        setEmployee(session.employee);
        setRole(session.role);
        setUpdatedAt(new Date());
      } catch {
        // 取得失敗時は保険としてログインへ。
        router.replace("/login");
      }
    })();
  }, [router]);

  // 初回のビルド識別子を保持する。
  useEffect(() => {
    void (async () => {
      try {
        setInitialBuildId(await fetchBuildId());
      } catch {
        // 取得失敗は無視（次回ポーリングで再取得）。
      }
    })();
  }, []);

  // 一定間隔でビルド識別子をポーリングし、変化したら更新バナーを出す。
  useEffect(() => {
    if (initialBuildId === "") {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const latest = await fetchBuildId();
          if (isNewerBuild(initialBuildId, latest)) {
            setUpdateAvailable(true);
          }
        } catch {
          // ポーリング失敗は無視。
        }
      })();
    }, VERSION_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [initialBuildId]);

  // 画面遷移のたびに「データ更新時刻」を現在時刻へ更新する。
  useEffect(() => {
    setUpdatedAt(new Date());
  }, [pathname]);

  const handleSwitch = useCallback((): void => {
    void (async () => {
      await logout();
      router.replace("/login");
      router.refresh();
    })();
  }, [router]);

  // 役割で主要タブ（ホーム＋稼働中モジュール）を組み立てる。
  const navLinks = useMemo(() => navLinksForRole(MODULES, role), [role]);

  return (
    <div className="min-h-full bg-neutral-100">
      {updateAvailable && (
        <div className="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-primary-foreground">
          <span className="text-base font-bold">
            新しいバージョンがあります。再読み込みしてください。
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-white/90 px-3 py-1 text-sm font-bold text-neutral-900 hover:bg-white"
          >
            再読み込み
          </button>
        </div>
      )}

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary">dgloss</span>
              <span className="text-lg font-bold text-neutral-800">勤怠</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-xs tabular-nums text-neutral-500">
                v{APP_VERSION}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-base font-bold text-neutral-900">
                    {employee?.name ?? "—"}
                  </span>
                  {employee !== null && (
                    <span className="font-mono text-xs tabular-nums text-neutral-400">
                      {employee.employeeCode}
                    </span>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    role === "admin"
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {role === "admin" ? "管理者" : "一般"}
                </span>
              </div>
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-xs text-neutral-400">データ更新</span>
                <span className="font-mono text-sm tabular-nums text-neutral-600">
                  {updatedAt === null ? "—" : UPDATED_FMT.format(updatedAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSwitch}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                従業員切替
              </button>
            </div>
          </div>

          <nav className="flex flex-nowrap gap-1 overflow-x-auto">
            {navLinks.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 flex-col items-center gap-0.5 border-b-2 px-4 py-2 text-center transition-colors ${
                    active
                      ? "border-primary text-neutral-900"
                      : "border-transparent text-neutral-400 hover:border-neutral-200 hover:text-neutral-700"
                  }`}
                >
                  <span className="text-sm font-bold">{item.label}</span>
                  <span className="text-[11px] leading-none text-neutral-400">
                    {item.sublabel ?? " "}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
