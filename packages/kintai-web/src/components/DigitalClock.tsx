"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const DATE_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const TIME_FMT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** 現在の JST 日時を大きく表示するライブ時計。 */
export function DigitalClock(): ReactNode {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="text-lg font-medium text-neutral-500 sm:text-xl">
        {now ? DATE_FMT.format(now) : " "}
      </div>
      <div className="font-mono text-6xl font-bold tabular-nums tracking-tight text-neutral-900 sm:text-7xl">
        {now ? TIME_FMT.format(now) : "--:--:--"}
      </div>
    </div>
  );
}
