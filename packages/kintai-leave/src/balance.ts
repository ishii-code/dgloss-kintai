/**
 * 年次有給休暇の残高計算（就業規則第61条・労基法第39条）。
 *
 * 取引履歴（付与・取得）から、指定基準日時点の残高を算出する純粋関数を提供する。
 * 繰越（翌年度のみ・2年で時効消滅）と時効消滅は、各付与を「バケット」として
 * 個別に時効消滅日まで追跡することで表現する。
 *
 * ## 消化順（重要）
 * 一般的な繰越優先（古い付与＝繰越分から消化）とは**逆**に、就業規則第61条に従い
 * **当年度発生分（新しい付与）から先に消化**し、不足分を繰越分（古い付与）から充当する。
 * この順序は時効直前でも変えない（当年度優先）。
 */

import { z } from "zod";
import type { IsoDate } from "@dgloss-kintai/contracts";
import {
  DEFAULT_LEAVE_CONFIG,
  resolveLeaveConfig,
  type LeaveConfig,
} from "./config.js";
import { addYears, compareIso, isoDateSchema, toIsoDate } from "./dates.js";

// ---------------------------------------------------------------------------
// ドメイン型
// ---------------------------------------------------------------------------

/**
 * 取引（付与 / 取得）。外部入力は {@link leaveTransactionSchema} で検証する。
 * - `grant`: 付与。`days` は付与日数（前倒し付与など config 由来でもよい）。
 * - `take` : 取得。`half=true` で半日（4時間＝0.5日）、`false` で全日（1日）。
 */
export const leaveTransactionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("grant"),
    date: isoDateSchema,
    days: z.number().nonnegative(),
  }),
  z.object({
    kind: z.literal("take"),
    date: isoDateSchema,
    half: z.boolean(),
  }),
]);

/** 取引履歴の配列スキーマ。 */
export const leaveTransactionsSchema = z.array(leaveTransactionSchema);

/** 取引（付与 / 取得）。 */
export type LeaveTransaction = z.infer<typeof leaveTransactionSchema>;

/** 1回の付与（時効消滅日つき）。 */
export interface LeaveGrant {
  /** 付与日。 */
  readonly grantDate: IsoDate;
  /** 付与日数。 */
  readonly grantedDays: number;
  /** 時効消滅日（この日以降は消化不可・労基法第115条）。 */
  readonly expiryDate: IsoDate;
}

/** 付与1件（バケット）の状態。 */
export interface LeaveBucketState {
  /** 付与そのもの。 */
  readonly grant: LeaveGrant;
  /** この付与から取得済みの日数。 */
  readonly takenDays: number;
  /** 有効残日数（時効消滅済みなら0）。 */
  readonly remainingDays: number;
  /** 基準日時点で時効消滅済みか。 */
  readonly expired: boolean;
  /** 時効消滅した日数（未消化のまま失効した分）。 */
  readonly expiredDays: number;
}

/**
 * 当年度（最新付与）の要約。5日の時季指定義務判定に用いる。
 * 義務期間 `[grantDate, periodEnd)` に取得した全日数を集計する
 * （付与元がどのバケットかを問わない＝法定の年5日は取得実績で判定）。
 */
export interface CurrentYearSummary {
  readonly grantDate: IsoDate;
  readonly grantedDays: number;
  /** 義務履行期間の終期（付与日+1年）。 */
  readonly periodEnd: IsoDate;
  /** 義務期間に取得した日数。 */
  readonly takenInPeriodDays: number;
}

/** 基準日時点の残高。 */
export interface LeaveBalance {
  /** 基準日。 */
  readonly asOf: IsoDate;
  /** 有効残日数（時効未消滅バケットの残の合計）。 */
  readonly remainingDays: number;
  /** 累計付与日数。 */
  readonly grantedDays: number;
  /** 累計取得日数。 */
  readonly takenDays: number;
  /** 累計時効消滅日数。 */
  readonly expiredDays: number;
  /** 付与不足で消化しきれなかった日数（通常0）。 */
  readonly shortfallDays: number;
  /** 付与ごとの状態（付与日昇順）。 */
  readonly buckets: readonly LeaveBucketState[];
  /** 当年度（最新付与）の要約。付与が無ければ null。 */
  readonly currentYear: CurrentYearSummary | null;
}

/** 5日の時季指定義務の状況。 */
export interface FiveDayObligationStatus {
  /** 義務対象か（当年度に10日以上付与された）。 */
  readonly obligated: boolean;
  /** 取得させるべき日数（義務対象なら5、非対象なら0）。 */
  readonly requiredDays: number;
  /** 義務期間に取得済みの日数。 */
  readonly takenDays: number;
  /** 残りの義務日数（`max(0, required - taken)`）。 */
  readonly remainingObligationDays: number;
  /** 未達か（残義務日数 > 0）。 */
  readonly unmet: boolean;
  /** 義務履行期限（付与日+1年）。付与が無ければ null。 */
  readonly deadline: IsoDate | null;
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

interface WorkBucket {
  grantDate: string;
  expiryDate: string;
  granted: number;
  remaining: number;
}

const EPS = 1e-9;

/** 0.5日単位の丸め誤差を抑えるため小数2桁に丸める。 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function takeFraction(half: boolean, config: LeaveConfig): number {
  return half ? config.halfDayFraction : 1;
}

// ---------------------------------------------------------------------------
// 残高計算
// ---------------------------------------------------------------------------

/**
 * 取引履歴から基準日時点の {@link LeaveBalance} を算出する純粋関数。
 *
 * 反映する要素:
 * - 付与（全日数）
 * - 取得（全日=1 / 半日=0.5）
 * - 繰越（翌年度のみ／2年で時効消滅）… 各付与を時効消滅日まで個別追跡して表現。
 * - 時効消滅（基準日時点で時効消滅日を過ぎた付与の未消化分）
 *
 * 消化順は **当年度発生分（新しい付与）優先**（module JSDoc 参照）。
 * `bas準日` より後の取引は集計対象外（「その時点のスナップショット」）。
 *
 * 繰越上限（前年度付与分）は、各付与の残が付与日数を超えないこと＋2年の
 * 時効消滅により自動的に担保される（前年度分だけが繰り越り、それ以前は失効）。
 *
 * @param transactions 取引履歴（順不同可・内部でソート）。
 * @param asOf 基準日（`YYYY-MM-DD`）。
 * @param configOverride 設定の部分上書き（会社独自ルール等）。
 */
export function computeBalance(
  transactions: readonly LeaveTransaction[],
  asOf: string,
  configOverride?: Partial<LeaveConfig>,
): LeaveBalance {
  const parsedTx = leaveTransactionsSchema.parse(transactions);
  const parsedAsOf = isoDateSchema.parse(asOf);
  const config = resolveLeaveConfig(configOverride);
  const expiryOffsetYears = config.carryoverYears + 1;

  // 基準日までの取引だけを対象にする。
  const grantTxs: Array<{ date: string; days: number }> = [];
  const takeTxs: Array<{ date: string; half: boolean }> = [];
  for (const tx of parsedTx) {
    if (compareIso(tx.date, parsedAsOf) > 0) continue;
    if (tx.kind === "grant") grantTxs.push({ date: tx.date, days: tx.days });
    else takeTxs.push({ date: tx.date, half: tx.half });
  }

  // 付与→バケット（付与日昇順）。
  const buckets: WorkBucket[] = grantTxs
    .map((g) => ({
      grantDate: g.date,
      expiryDate: addYears(g.date, expiryOffsetYears),
      granted: g.days,
      remaining: g.days,
    }))
    .sort((a, b) => compareIso(a.grantDate, b.grantDate));

  // 取得を時系列で処理。取得日に有効なバケットのうち「当年度（新しい付与）」から消化。
  const sortedTakes = [...takeTxs].sort((a, b) => compareIso(a.date, b.date));
  let shortfall = 0;
  for (const take of sortedTakes) {
    let need = takeFraction(take.half, config);
    const active = buckets
      .filter(
        (b) =>
          compareIso(b.grantDate, take.date) <= 0 &&
          compareIso(take.date, b.expiryDate) < 0 &&
          b.remaining > EPS,
      )
      // 当年度優先＝付与日の新しい順に消化（繰越優先の逆・就業規則第61条）。
      .sort((a, b) => compareIso(b.grantDate, a.grantDate));
    for (const bucket of active) {
      if (need <= EPS) break;
      const use = Math.min(bucket.remaining, need);
      bucket.remaining = round2(bucket.remaining - use);
      need = round2(need - use);
    }
    if (need > EPS) shortfall = round2(shortfall + need);
  }

  // バケット状態へ変換。
  const bucketStates: LeaveBucketState[] = buckets.map((b) => {
    const expired = compareIso(b.expiryDate, parsedAsOf) <= 0;
    const taken = round2(b.granted - b.remaining);
    return {
      grant: {
        grantDate: toIsoDate(b.grantDate),
        grantedDays: b.granted,
        expiryDate: toIsoDate(b.expiryDate),
      },
      takenDays: taken,
      remainingDays: expired ? 0 : b.remaining,
      expired,
      expiredDays: expired ? b.remaining : 0,
    };
  });

  const grantedDays = round2(
    bucketStates.reduce((s, b) => s + b.grant.grantedDays, 0),
  );
  const takenDays = round2(bucketStates.reduce((s, b) => s + b.takenDays, 0));
  const expiredDays = round2(
    bucketStates.reduce((s, b) => s + b.expiredDays, 0),
  );
  const remainingDays = round2(
    bucketStates.reduce((s, b) => s + b.remainingDays, 0),
  );

  // 当年度＝最新付与。
  let currentYear: CurrentYearSummary | null = null;
  if (buckets.length > 0) {
    const latest = buckets.reduce((acc, b) =>
      compareIso(b.grantDate, acc.grantDate) > 0 ? b : acc,
    );
    const periodEnd = addYears(latest.grantDate, 1);
    const takenInPeriodDays = round2(
      takeTxs
        .filter(
          (t) =>
            compareIso(latest.grantDate, t.date) <= 0 &&
            compareIso(t.date, periodEnd) < 0,
        )
        .reduce((s, t) => s + takeFraction(t.half, config), 0),
    );
    currentYear = {
      grantDate: toIsoDate(latest.grantDate),
      grantedDays: latest.granted,
      periodEnd,
      takenInPeriodDays,
    };
  }

  return {
    asOf: toIsoDate(parsedAsOf),
    remainingDays,
    grantedDays,
    takenDays,
    expiredDays,
    shortfallDays: shortfall,
    buckets: bucketStates,
    currentYear,
  };
}

/**
 * 5日の時季指定義務（労基法第39条第7項）の状況を返す。
 * 年10日以上（{@link LeaveConfig.fiveDayObligationThreshold}）付与された者は、
 * 付与日から1年以内に5日以上取得させなければならない。
 *
 * @param balance {@link computeBalance} の結果。
 * @param config しきい値・義務日数の設定（既定は法定＝10日/5日）。
 */
export function fiveDayObligationStatus(
  balance: LeaveBalance,
  config: LeaveConfig = DEFAULT_LEAVE_CONFIG,
): FiveDayObligationStatus {
  const cy = balance.currentYear;
  if (cy === null || cy.grantedDays < config.fiveDayObligationThreshold) {
    return {
      obligated: false,
      requiredDays: 0,
      takenDays: cy?.takenInPeriodDays ?? 0,
      remainingObligationDays: 0,
      unmet: false,
      deadline: cy?.periodEnd ?? null,
    };
  }
  const requiredDays = config.fiveDayObligationDays;
  const takenDays = cy.takenInPeriodDays;
  const remainingObligationDays = Math.max(0, round2(requiredDays - takenDays));
  return {
    obligated: true,
    requiredDays,
    takenDays,
    remainingObligationDays,
    unmet: remainingObligationDays > 0,
    deadline: cy.periodEnd,
  };
}
