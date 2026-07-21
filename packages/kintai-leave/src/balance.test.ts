import { describe, expect, it } from "vitest";
import {
  computeBalance,
  fiveDayObligationStatus,
  type LeaveTransaction,
} from "./balance.js";

const grant = (date: string, days: number): LeaveTransaction => ({
  kind: "grant",
  date,
  days,
});
const takeFull = (date: string): LeaveTransaction => ({
  kind: "take",
  date,
  half: false,
});
const takeHalf = (date: string): LeaveTransaction => ({
  kind: "take",
  date,
  half: true,
});

describe("computeBalance: 半日取得の残数", () => {
  it("半日=0.5日として残数管理する", () => {
    // 付与10。半日1回(0.5)+全日1回(1)=1.5消化 → 残8.5。
    const balance = computeBalance(
      [grant("2025-04-01", 10), takeHalf("2025-05-01"), takeFull("2025-05-02")],
      "2025-06-01",
    );
    expect(balance.grantedDays).toBe(10);
    expect(balance.takenDays).toBe(1.5);
    expect(balance.remainingDays).toBe(8.5);
    expect(balance.expiredDays).toBe(0);
  });
});

describe("computeBalance: 消化順（当年度優先・就業規則第61条）", () => {
  it("当年度発生分から先に消化し、繰越分（前年度）は温存する", () => {
    // A(前年度)2024-04-01:11、B(当年度)2025-04-01:12。全日2消化。
    // 一般の繰越優先とは逆に、当年度Bから消化 → B=10, A=11。
    const balance = computeBalance(
      [grant("2024-04-01", 11), grant("2025-04-01", 12), takeFull("2025-05-01")],
      "2025-06-01",
    );
    const takeSecond = computeBalance(
      [
        grant("2024-04-01", 11),
        grant("2025-04-01", 12),
        takeFull("2025-05-01"),
        takeFull("2025-05-02"),
      ],
      "2025-06-01",
    );
    const a = takeSecond.buckets.find((b) => b.grant.grantDate === "2024-04-01");
    const b = takeSecond.buckets.find((b) => b.grant.grantDate === "2025-04-01");
    expect(a?.remainingDays).toBe(11);
    expect(a?.takenDays).toBe(0);
    expect(b?.remainingDays).toBe(10);
    expect(b?.takenDays).toBe(2);
    expect(takeSecond.remainingDays).toBe(21);
    // 1回だけ消化しても当年度から。
    expect(
      balance.buckets.find((x) => x.grant.grantDate === "2025-04-01")
        ?.remainingDays,
    ).toBe(11);
  });

  it("当年度分を使い切ると繰越分（前年度）から充当する", () => {
    // A2024-04-01:11、B2025-04-01:12。全日13消化 → B=12全消化, A=1消化。
    const takes = Array.from({ length: 13 }, (_, i) =>
      takeFull(`2025-05-${String(i + 1).padStart(2, "0")}`),
    );
    const balance = computeBalance(
      [grant("2024-04-01", 11), grant("2025-04-01", 12), ...takes],
      "2025-06-01",
    );
    const a = balance.buckets.find((b) => b.grant.grantDate === "2024-04-01");
    const b = balance.buckets.find((b) => b.grant.grantDate === "2025-04-01");
    expect(b?.remainingDays).toBe(0);
    expect(b?.takenDays).toBe(12);
    expect(a?.remainingDays).toBe(10);
    expect(a?.takenDays).toBe(1);
    expect(balance.remainingDays).toBe(10);
    expect(balance.shortfallDays).toBe(0);
  });
});

describe("computeBalance: 繰越（翌年度のみ）と時効消滅", () => {
  it("2年経過した付与の未消化分は時効消滅する", () => {
    // A2023-04-01:10、3消化 → 残7。時効2025-04-01。
    // B2024-04-01:11。基準日2025-05-01（A時効後）。
    // A: 未消化7が時効消滅、有効残0。B: 残11。有効残合計=11。
    const balance = computeBalance(
      [
        grant("2023-04-01", 10),
        takeFull("2023-06-01"),
        takeFull("2023-06-02"),
        takeFull("2023-06-03"),
        grant("2024-04-01", 11),
      ],
      "2025-05-01",
    );
    const a = balance.buckets.find((b) => b.grant.grantDate === "2023-04-01");
    const b = balance.buckets.find((b) => b.grant.grantDate === "2024-04-01");
    expect(a?.expired).toBe(true);
    expect(a?.expiredDays).toBe(7);
    expect(a?.remainingDays).toBe(0);
    expect(a?.takenDays).toBe(3);
    expect(b?.expired).toBe(false);
    expect(b?.remainingDays).toBe(11);
    expect(balance.remainingDays).toBe(11);
    expect(balance.expiredDays).toBe(7);
    expect(balance.takenDays).toBe(3);
    expect(balance.grantedDays).toBe(21);
  });

  it("時効前（基準日が時効消滅日より前）は繰越として有効", () => {
    // A2023-04-01:10、3消化。基準日2025-03-31（時効2025-04-01の前日）。
    const balance = computeBalance(
      [
        grant("2023-04-01", 10),
        takeFull("2023-06-01"),
        takeFull("2023-06-02"),
        takeFull("2023-06-03"),
      ],
      "2025-03-31",
    );
    const a = balance.buckets.find((b) => b.grant.grantDate === "2023-04-01");
    expect(a?.expired).toBe(false);
    expect(a?.remainingDays).toBe(7);
    expect(balance.remainingDays).toBe(7);
    expect(balance.expiredDays).toBe(0);
  });
});

describe("computeBalance: 基準日スナップショット", () => {
  it("基準日より後の付与・取得は集計しない", () => {
    const balance = computeBalance(
      [
        grant("2025-04-01", 10),
        takeFull("2025-05-01"),
        grant("2026-04-01", 11), // 基準日より後
        takeFull("2026-05-01"), // 基準日より後
      ],
      "2025-12-31",
    );
    expect(balance.grantedDays).toBe(10);
    expect(balance.takenDays).toBe(1);
    expect(balance.remainingDays).toBe(9);
    expect(balance.buckets).toHaveLength(1);
  });

  it("付与超過の取得は shortfall として記録し残数は0で下げ止まる", () => {
    const balance = computeBalance(
      [
        grant("2025-04-01", 2),
        takeFull("2025-05-01"),
        takeFull("2025-05-02"),
        takeFull("2025-05-03"),
      ],
      "2025-06-01",
    );
    expect(balance.remainingDays).toBe(0);
    expect(balance.shortfallDays).toBe(1);
  });
});

describe("fiveDayObligationStatus: 5日の時季指定義務（労基法第39条第7項）", () => {
  it("10日以上付与かつ取得3日 → 未達（残義務2日）", () => {
    const balance = computeBalance(
      [
        grant("2025-04-01", 11),
        takeFull("2025-05-01"),
        takeFull("2025-06-01"),
        takeFull("2025-07-01"),
      ],
      "2025-12-01",
    );
    const status = fiveDayObligationStatus(balance);
    expect(status.obligated).toBe(true);
    expect(status.requiredDays).toBe(5);
    expect(status.takenDays).toBe(3);
    expect(status.remainingObligationDays).toBe(2);
    expect(status.unmet).toBe(true);
    expect(status.deadline).toBe("2026-04-01");
  });

  it("10日以上付与かつ取得5日 → 達成（未達なし）", () => {
    const takes = Array.from({ length: 5 }, (_, i) =>
      takeFull(`2025-05-0${i + 1}`),
    );
    const balance = computeBalance([grant("2025-04-01", 11), ...takes], "2025-12-01");
    const status = fiveDayObligationStatus(balance);
    expect(status.obligated).toBe(true);
    expect(status.takenDays).toBe(5);
    expect(status.remainingObligationDays).toBe(0);
    expect(status.unmet).toBe(false);
  });

  it("付与ちょうど10日で義務対象になる（境界）", () => {
    const balance = computeBalance([grant("2025-04-01", 10)], "2025-12-01");
    const status = fiveDayObligationStatus(balance);
    expect(status.obligated).toBe(true);
    expect(status.remainingObligationDays).toBe(5);
    expect(status.unmet).toBe(true);
  });

  it("付与10日未満（比例付与等）は義務対象外", () => {
    const balance = computeBalance(
      [grant("2025-04-01", 5), takeFull("2025-05-01")],
      "2025-12-01",
    );
    const status = fiveDayObligationStatus(balance);
    expect(status.obligated).toBe(false);
    expect(status.requiredDays).toBe(0);
    expect(status.unmet).toBe(false);
  });

  it("義務日数は付与元を問わず義務期間の取得実績で判定する", () => {
    // 半日取得も0.5日として算入。半日×2+全日×4=5日で達成。
    const balance = computeBalance(
      [
        grant("2025-04-01", 12),
        takeHalf("2025-05-01"),
        takeHalf("2025-05-02"),
        takeFull("2025-05-03"),
        takeFull("2025-05-04"),
        takeFull("2025-05-05"),
        takeFull("2025-05-06"),
      ],
      "2025-12-01",
    );
    const status = fiveDayObligationStatus(balance);
    expect(status.takenDays).toBe(5);
    expect(status.unmet).toBe(false);
  });

  it("付与が無ければ義務対象外（deadline は null）", () => {
    const balance = computeBalance([], "2025-12-01");
    const status = fiveDayObligationStatus(balance);
    expect(balance.currentYear).toBeNull();
    expect(status.obligated).toBe(false);
    expect(status.deadline).toBeNull();
  });
});

describe("computeBalance: 入力検証（zod）", () => {
  it("不正な日付形式は例外", () => {
    expect(() =>
      computeBalance([grant("2025/04/01", 10)], "2025-06-01"),
    ).toThrow();
  });

  it("不正な基準日は例外", () => {
    expect(() => computeBalance([], "not-a-date")).toThrow();
  });
});
