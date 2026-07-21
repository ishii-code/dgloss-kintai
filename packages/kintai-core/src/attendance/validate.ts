/**
 * 勤怠判定レイヤーの入力バリデーション。
 *
 * 労働時間の取りこぼし・水増しは「未払い賃金／過払い＝労基法・賃金規程違反」に直結するため、
 * 外部入力は必ず整数・非負であることを検証してからドメイン計算に入れる。
 *
 * NOTE: 規約では「外部入力は zod で検証」とあるが、`@dgloss-kintai/core` は zod を依存に
 * 持たない（zod は `@dgloss-kintai/contracts` の依存で、core からは解決できない）。
 * package.json は変更禁止の境界であるため、既存の core 実装（premium.ts / config.ts /
 * money.ts）と同じく明示的な RangeError ガードで検証する。zod スキーマでの検証は API 境界
 * （contracts の schema.ts）で行う二段構えとする。
 */

/** 値が非負整数であることを保証する。違反時は RangeError。 */
export function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}
