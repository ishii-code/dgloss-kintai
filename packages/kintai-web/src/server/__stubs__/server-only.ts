/**
 * テスト用の "server-only" スタブ。
 *
 * 本物の "server-only" はクライアントバンドルで throw させるためのモジュールで、
 * ランタイム値を持たない。vitest（node 環境）では副作用 import を no-op にするため
 * このスタブへ alias する（vitest.config.ts 参照）。
 */
export {};
