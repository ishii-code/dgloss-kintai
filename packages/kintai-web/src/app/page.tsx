import type { ReactNode } from "react";

// 打刻画面は並行開発で実装する。暫定のプレースホルダ。
export default function HomePage(): ReactNode {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">ディグロス勤怠</h1>
      <p className="text-neutral-600">打刻画面は実装中です。</p>
    </main>
  );
}
