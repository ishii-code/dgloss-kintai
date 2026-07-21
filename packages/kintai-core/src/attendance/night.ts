/**
 * 深夜労働時間（22:00-5:00）の算定。
 *
 * 就業規則・労働基準法第37条4項に基づき、深夜時間帯は 22:00 から翌 5:00 までとする
 * （賃金規程第20条3項2号(3)a に対応）。深夜割増 0.25 は他区分（時間外・休日・所定内）と
 * 重複して加算されるため、ここでは「労働区間のうち深夜帯に重なる分」だけを純粋に切り出す。
 *
 * 日跨ぎシフトに対応するため、労働区間は「その日の 00:00 からの絶対分」で表現する
 * （例: 翌 6:00 = 30:00 = 1800 分）。深夜帯は 1 日 (1440 分) 周期で
 *   - 早朝帯 [00:00, 05:00) = [0, 300)
 *   - 深夜帯 [22:00, 24:00) = [1320, 1440)
 * の 2 バンドとして扱い、両者は日を跨いで 22:00→翌5:00 の連続した深夜帯を構成する。
 *
 * すべて半開区間 [start, end) で計算するため、境界（例: ちょうど 5:00 / 22:00）は
 * 深夜に含めない／含める向きが一意に定まり、端数の二重計上が起きない。
 */

/** 1 日の分数。 */
export const MINUTES_PER_DAY = 1440;

/** 深夜帯の開始（22:00 = 1320 分）。 */
export const NIGHT_LATE_START_MINUTE = 22 * 60;

/** 深夜帯の終了（翌 5:00 = 早朝帯の終端 300 分）。 */
export const NIGHT_EARLY_END_MINUTE = 5 * 60;

/** 半開区間 [a1,a2) と [b1,b2) の重なり分（負なら 0）。 */
function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/**
 * 労働区間 [startMinute, endMinute)（その日の 00:00 からの絶対分）のうち、
 * 深夜帯 22:00-5:00 に重なる分を返す。日跨ぎ・複数日跨ぎに対応。
 */
export function nightOverlapMinutes(
  startMinute: number,
  endMinute: number,
): number {
  if (endMinute <= startMinute) {
    return 0;
  }
  // 区間が触れうる暦日インデックスの範囲を求め、前後 1 日ずつ余裕を持たせて走査する。
  const firstDay = Math.floor(startMinute / MINUTES_PER_DAY);
  const lastDay = Math.floor((endMinute - 1) / MINUTES_PER_DAY);

  let total = 0;
  for (let day = firstDay - 1; day <= lastDay + 1; day += 1) {
    const base = day * MINUTES_PER_DAY;
    // 早朝帯 [00:00, 05:00)
    total += overlap(
      startMinute,
      endMinute,
      base,
      base + NIGHT_EARLY_END_MINUTE,
    );
    // 深夜帯 [22:00, 24:00)
    total += overlap(
      startMinute,
      endMinute,
      base + NIGHT_LATE_START_MINUTE,
      base + MINUTES_PER_DAY,
    );
  }
  return total;
}
