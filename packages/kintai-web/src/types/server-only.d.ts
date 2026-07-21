/**
 * "server-only" のアンビエント宣言。
 *
 * Next.js はビルド時に "server-only" をコンパイル済みモジュールへ解決するが、
 * tsc からは bare specifier を解決できないため型宣言だけ与える（副作用 import 専用）。
 */
declare module "server-only";
