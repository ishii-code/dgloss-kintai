/**
 * 金額計算の端数処理ヘルパー。
 *
 * 賃金計算は「未払い賃金＝労基法違反」に直結するため、浮動小数点の丸め誤差を
 * 一切持ち込まない。分子・分母をすべて整数（bigint）に落とし込み、最後に
 * 整数除算で切り上げ／切り捨てを行うことで 1 円単位の厳密性を保証する。
 */

/**
 * 非負の分子を分母で割り、切り上げ（天井）した整数商を返す。
 * 賃金規程第20条3項5号「割増の計算額に1円未満の端数が生じたときは、これを切り上げる」。
 */
export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError("denominator must be a positive bigint");
  }
  if (numerator < 0n) {
    throw new RangeError("numerator must be a non-negative bigint");
  }
  if (numerator === 0n) {
    return 0n;
  }
  return (numerator + denominator - 1n) / denominator;
}

/**
 * 非負の分子を分母で割り、切り捨て（床）した整数商を返す。
 * 賃金規程第21条2項「遅刻・早退等の控除額に1円未満の端数が生じたときは、これを切り捨てる」。
 */
export function floorDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError("denominator must be a positive bigint");
  }
  if (numerator < 0n) {
    throw new RangeError("numerator must be a non-negative bigint");
  }
  return numerator / denominator;
}
