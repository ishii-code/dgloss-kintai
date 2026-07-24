/**
 * アプリのバージョン定数とビルド識別子の解決。
 *
 * `APP_VERSION` は {@link file://./releaseNotes.ts リリースノート} の先頭（現行版）と一致させる。
 * ビルド識別子はデプロイの一意性判定に用い、Vercel のコミット SHA があればそれを優先する
 * （同一バージョンでも再デプロイを検知できる）。クライアントはこの識別子をポーリングし、
 * 変化したら「新しいバージョンがあります」バナーを表示する（Ver 自動アップデート）。
 */

/** 現行アプリバージョン（例 `1.0.0`）。リリースノート先頭と連動させる。 */
export const APP_VERSION = "1.0.0" as const;

/**
 * デプロイを一意に識別するビルド識別子を返す。
 *
 * `VERCEL_GIT_COMMIT_SHA`（本番デプロイ時に付与）があればそれを、無ければ
 * {@link APP_VERSION} を返す。`/api/version` がこの値を返し、クライアントの
 * 自動アップデート検知の基準になる。
 *
 * @returns ビルド識別子（コミット SHA、または `APP_VERSION`）
 */
export function resolveBuildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha !== undefined && sha !== "" ? sha : APP_VERSION;
}

/**
 * 初回ロード時のビルド識別子に対し、最新の識別子が別デプロイかを判定する（純粋関数）。
 *
 * 単純な不一致判定だが、空文字は「未取得」とみなし更新扱いしない（誤検知防止）。
 *
 * @param current 初回ロード時に保持した識別子
 * @param latest  ポーリングで取得した最新の識別子
 * @returns 別デプロイ（再読み込み推奨）なら true
 */
export function isNewerBuild(current: string, latest: string): boolean {
  if (current === "" || latest === "") {
    return false;
  }
  return current !== latest;
}
