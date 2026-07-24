/**
 * バージョン API ルート（App Router・サーバ専用）。
 *
 * - `GET /api/version` 現在のデプロイのビルド識別子を返す。
 *
 * クライアントはこの識別子を初回ロード時に保持し、一定間隔でポーリングする。値が変われば
 * 別デプロイ（新バージョン）とみなし「再読み込み」バナーを表示する（Ver 自動アップデート）。
 * 認可は不要（機密を含まない）。
 */

import { OK_STATUS } from "@/server/httpStatus";
import { APP_VERSION, resolveBuildId } from "@/lib/version";

/** デプロイごとの識別子を返すため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/**
 * ビルド識別子と表示用バージョンを返す。
 * `buildId` は `VERCEL_GIT_COMMIT_SHA` があればそれ、無ければ `APP_VERSION`。
 */
export function GET(): Response {
  return Response.json(
    { buildId: resolveBuildId(), version: APP_VERSION },
    { status: OK_STATUS },
  );
}
