"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { WorkCalendar } from "@dgloss-kintai/contracts";

import { AdminGuard } from "@/components/AdminGuard";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

async function fetchCalendar(): Promise<WorkCalendar> {
  const res = await fetch("/api/admin/settings/calendar", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`勤務カレンダーの取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { calendar: WorkCalendar };
  return json.calendar;
}

async function putCalendar(input: {
  legalHolidayWeekday: number;
  scheduledHolidayWeekdays: number[];
  customHolidays: string[];
}): Promise<WorkCalendar> {
  const res = await fetch("/api/admin/settings/calendar", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? `保存に失敗しました (HTTP ${res.status})`,
    );
  }
  const json = (await res.json()) as { calendar: WorkCalendar };
  return json.calendar;
}

function CalendarBody(): ReactNode {
  const [legal, setLegal] = useState(0);
  const [scheduled, setScheduled] = useState<ReadonlySet<number>>(new Set([6]));
  const [holidays, setHolidays] = useState<readonly string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback((c: WorkCalendar): void => {
    setLegal(c.legalHolidayWeekday);
    setScheduled(new Set(c.scheduledHolidayWeekdays));
    setHolidays([...c.customHolidays]);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        apply(await fetchCalendar());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, [apply]);

  const toggleScheduled = useCallback((w: number): void => {
    setNotice(null);
    setScheduled((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  }, []);

  const addHoliday = useCallback((): void => {
    if (newHoliday === "" || holidays.includes(newHoliday)) return;
    setHolidays((prev) => [...prev, newHoliday].sort());
    setNewHoliday("");
    setNotice(null);
  }, [newHoliday, holidays]);

  const removeHoliday = useCallback((d: string): void => {
    setHolidays((prev) => prev.filter((x) => x !== d));
    setNotice(null);
  }, []);

  const handleSave = useCallback((): void => {
    setSaving(true);
    setNotice(null);
    void (async () => {
      try {
        const saved = await putCalendar({
          legalHolidayWeekday: legal,
          scheduledHolidayWeekdays: [...scheduled],
          customHolidays: [...holidays],
        });
        apply(saved);
        setError(null);
        setNotice("保存しました。次回の日次化から反映されます。");
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      } finally {
        setSaving(false);
      }
    })();
  }, [legal, scheduled, holidays, apply]);

  if (loading) {
    return <p className="py-10 text-center text-neutral-400">読み込み中…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">勤務カレンダー</h1>
        <p className="mt-1 text-sm text-neutral-500">
          休日区分（法定休日・所定休日・会社休日）を設定します。打刻の日次化で休日勤務手当の算定に反映されます。
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">
          法定休日の曜日
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          週1日の法定休日（労基法第35条）。所定休日と重複する曜日は法定休日が優先されます。
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((label, w) => (
            <button
              key={w}
              type="button"
              onClick={() => {
                setLegal(w);
                setNotice(null);
              }}
              className={`h-11 w-11 rounded-full text-base font-bold transition-colors ${
                legal === w
                  ? "bg-neutral-800 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">
          所定休日の曜日
        </h2>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((label, w) => {
            const on = scheduled.has(w);
            const isLegal = legal === w;
            return (
              <button
                key={w}
                type="button"
                disabled={isLegal}
                onClick={() => toggleScheduled(w)}
                className={`h-11 w-11 rounded-full text-base font-bold transition-colors disabled:opacity-30 ${
                  on
                    ? "bg-primary text-primary-foreground"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">
          会社休日（祝日・年末年始など）
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          個別に指定した日は所定休日として扱います。
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input
            type="date"
            value={newHoliday}
            onChange={(e) => setNewHoliday(e.target.value)}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-base"
          />
          <button
            type="button"
            onClick={addHoliday}
            className="rounded-xl border border-neutral-300 px-4 py-2.5 text-base font-medium text-neutral-700 hover:bg-neutral-50"
          >
            追加
          </button>
        </div>
        {holidays.length === 0 ? (
          <p className="py-2 text-sm text-neutral-400">会社休日は未登録です</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {holidays.map((d) => (
              <li
                key={d}
                className="flex items-center gap-2 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-sm"
              >
                <span className="font-mono tabular-nums text-neutral-700">
                  {d}
                </span>
                <button
                  type="button"
                  onClick={() => removeHoliday(d)}
                  aria-label={`${d} を削除`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error !== null && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
        >
          {error}
        </p>
      )}
      {notice !== null && (
        <p className="rounded-xl bg-primary/10 px-4 py-3 text-base font-medium text-neutral-800">
          {notice}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
      </div>
    </div>
  );
}

/**
 * 勤務カレンダー設定ページ（管理者専用）。休日区分を設定する。
 */
export default function CalendarSettingsPage(): ReactNode {
  return (
    <AdminGuard>
      <CalendarBody />
    </AdminGuard>
  );
}
