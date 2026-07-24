import type { ReactNode } from "react";

import { ComingSoon } from "@/components/ComingSoon";

/**
 * 準備中モジュールのルート。表示内容・役割・実装予定フェーズは
 * モジュールカタログ（src/lib/modules.ts）を単一情報源として解決する。
 */
export default function Page(): ReactNode {
  return <ComingSoon />;
}
