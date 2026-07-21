# @dgloss-kintai/core

株式会社ディグロスの勤怠計算エンジン。**就業規則・賃金規程（2025.07.01版）を唯一の仕様**とする。
jinjer（ジンジャー勤怠）を置き換える自作勤怠システムの心臓部。

現バージョンの実装範囲（賃金規程より）:

| 機能 | 条文 | 実装 |
| --- | --- | --- |
| 割増賃金（時間外・休日・深夜・60時間超） | 第20条 | `calculateWagePremium` |
| 遅刻・早退・私用外出等の控除 | 第21条 | `calculateLatenessDeduction` |
| 固定時間外勤務手当との差額調整 | 第18条・第20条4項 | `settleWithFixedOvertime` |

## 設計の要点

### 1. 浮動小数点を持ち込まない（1円単位の厳密性）

賃金の誤りは**未払い賃金＝労基法違反**に直結する。丸め誤差を排除するため、
金額計算は最後まで整数（`bigint`）で行う。月間平均所定労働時間を途中で丸めず、
規程の式を等価な整数式に展開する:

```
割増額 = 基本給 ÷ 月間平均所定労働時間 × 支給率 × 労働時間数     （第20条2項）
       = 基本給 × 12 × (Σ 支給率bp × 労働分) ÷ (年間所定分 × 100)   （実装式）
```

- 労働時間は **すべて「分」の整数**で受け渡す（打刻は分単位で確定するため）。
- 支給率は **1/100 単位（bp）** の整数で保持する（0.25 → 25）。
- 端数処理は `bigint` の整数除算（`ceilDiv` / `floorDiv`）で行う。

### 2. 端数処理（丸め方向が区分で逆）

| 区分 | 条文 | 方向 |
| --- | --- | --- |
| 割増賃金 | 第20条3項5号 | **切り上げ**（`ceilDiv`） |
| 遅刻早退控除 | 第21条2項 | **切り捨て**（`floorDiv`） |

切り上げは **手当ライン単位**で行う（賃金規程第4条「賃金の構成」が
時間外・休日・深夜・60時間超を別手当としているため）。区分ごとに丸めてから
合算するのではなく、同一手当ラインの区分を合算してから 1 円に切り上げる。

### 3. 支給率の合成（第20条3項2号）

月給制のため、所定外労働の「時給相当分 1.00」は基本給に含まれない分として加算する。

| 手当ライン | 対象区分 | 合成支給率 |
| --- | --- | --- |
| 時間外勤務手当 | 法定内残業 | 1.00 |
| 時間外勤務手当 | 法定時間外（60hまで） | 1.00 + 0.25 = **1.25** |
| 時間外勤務60時間超手当 | 法定時間外（60h超） | 1.00 + 0.50 = **1.50** |
| 休日勤務手当 | 法定休日 | 1.00 + 0.35 = **1.35** |
| 休日勤務手当 | 所定休日 | 1.00 + 0.25 = **1.25** |
| 深夜勤務手当 | 深夜(22:00-5:00) | **0.25**（加算のみ） |

深夜割増は他区分に**加算されるのみ**（時給相当分を含まない）。深夜帯の労働時間は
時間外・休日の区分と重複して `nightMinutes` に計上してよい。

### 4. 管理監督者の例外（第20条3項4号）

労基法第41条2号該当者には**深夜勤務手当のみ支給**する。時間外・休日・60時間超は 0 円。
固定時間外勤務手当も支給しない（第18条2項）。

## 使い方

```ts
import {
  calculateWagePremium,
  calculateLatenessDeduction,
  settleWithFixedOvertime,
} from "@dgloss-kintai/core";

const config = { annualScheduledWorkingHours: 1900 }; // 月間平均所定 = 1900 / 12

// 割増賃金（区分別・分単位）
const premium = calculateWagePremium(
  { basicSalary: 300_000, isManagerialEmployee: false },
  {
    nonStatutoryOvertimeMinutes: 0,
    statutoryOvertimeMinutes: 70 * 60, // 法定時間外 70h（エンジンが 60h で分割）
    legalHolidayMinutes: 0,
    scheduledHolidayMinutes: 0,
    nightMinutes: 300, // 深夜 5h（他区分と重複可）
  },
  config,
);
// → { overtimeAllowance, overtimeOver60Allowance, holidayAllowance, nightAllowance, total }

// 固定時間外勤務手当との差額調整（第20条4項）
const settled = settleWithFixedOvertime(premium, {
  fixedOvertimeAllowance: 45_000,
  coveredComponents: { overtime: true, overtimeOver60: true, holiday: true, night: false },
});

// 遅刻早退控除（第21条）
const deduction = calculateLatenessDeduction({ basicSalary: 300_000 }, 90, config); // 90分
```

## config に外出しする値

ロジックではなく設定値。会社・年度・雇用契約ごとに変わる:

- `annualScheduledWorkingHours` — 当該年度の年間所定労働時間（月間平均所定の元）
- `overtimeIncreasedRateThresholdHours` — 60時間超割増のしきい値（既定 60）
- 管理監督者区分（`isManagerialEmployee`）— 従業員マスタ側の属性
- `fixedOvertimeAllowance` / `coveredComponents` — 雇用契約ごとの固定残業

## Shadow Mode（jinjer 突合）で検証すべき前提

本エンジンは規程原文から実装したが、規程が明文化していない運用上の解釈がいくつかある。
jinjer の締めデータと 1 円単位で突合し、以下の前提を確定させること:

1. **端数切り上げの粒度** — 手当ライン単位で切り上げると仮定（第4条の手当構成に基づく）。
   jinjer が区分ごと／総額でまとめて丸めている場合は `premium.ts` の集約単位を調整する。
2. **月間平均所定を途中で丸めない** — 年間所定 ÷ 12 を非整数のまま保持すると仮定。
   jinjer が月平均所定を小数第N位で丸めている場合は config に丸め桁を追加する。
3. **法定内残業への時給相当分 1.00** — 所定外・法定内の労働に base 1.00 を支給すると仮定。
4. **深夜割増の加算のみ扱い** — 深夜帯は 0.25 のみ加算し base を二重計上しないと仮定。

これらは jinjer を「正解データ」とする回帰テストで潰す（Ph2）。

## テスト

```sh
pnpm test          # vitest run（50ケース、全期待値は規程から手計算）
pnpm typecheck     # tsc --noEmit（strict / any 禁止）
pnpm build         # dist 生成
```

## スコープ外（今後）

打刻→区分判定（22:00-5:00 判定・法定/所定休日の割当・週40h/日8h 集計・フレックス清算・
事業場外みなし）は上位の勤怠判定レイヤーが担い、その結果（区分別の分）を本エンジンに渡す。
36協定アラート・有給付与・給与連携 CSV も別モジュール。
