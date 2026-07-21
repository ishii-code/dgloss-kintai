import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ディグロス勤怠",
  description: "株式会社ディグロス 勤怠システム",
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <html lang="ja">
      <body className="min-h-full bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
