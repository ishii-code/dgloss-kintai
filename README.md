# dgloss-kintai

株式会社ディグロスの自作勤怠システム。jinjer（ジンジャー勤怠）を置き換える。
就業規則・賃金規程を仕様の元とし、打刻＋労働時間集計＋割増計算を初期スコープとする。

全勤務体系対応（固定時間制・フレックス・シフト・裁量労働）。

## 構成（pnpm workspace monorepo）

| パッケージ | 役割 | 状態 |
| --- | --- | --- |
| `kintai-contracts` | 打刻/勤怠/締めの型・zodスキーマ・ドメインイベント | ✅ |
| `kintai-core` | 割増計算（第20条）・遅刻早退控除（第21条）・区分判定（深夜/休日/8h/40h）・フレックス清算・事業場外みなし | ✅ |
| `kintai-leave` | 年次有給休暇の付与・消化・繰越（第61条） | ✅ |
| `kintai-compliance` | 36協定・労働時間上限アラート | ✅ |
| `kintai-jobs` | 締めバッチ（月次締め・給与連携CSV） | ✅ |
| `kintai-api` | API サービス層（型安全ユースケース・zod検証） | ✅ |
| `kintai-db` | Prisma 永続化層（api/jobs の port 実装） | ✅ |
| `kintai-connector-jinjer` | jinjer 移行 pull ＆ Shadow Mode 突合・検証実行 | ✅ |
| `kintai-web` | UI（Next.js・peco-ui 準拠・iPad優先） | ✅ 打刻画面 |

全パッケージ TypeScript strict / `any` 禁止。テスト計 305 件（`pnpm -r test`）。

> リポ構成メモ: 引き継ぎ計画では polyrepo（`dgloss-kintai-*` 別リポ）だが、
> 現状は単一リポ `dgloss-kintai` に monorepo として構築している。各パッケージは
> 独立した TS パッケージなので、polyrepo に切り出す判断が確定したら抽出可能。

## jinjer API の位置づけ

jinjer API からは計算ロジックは取れない（データ入出力口のみ）。用途は 2 つ:

1. **移行** — 従業員マスタ＋過去勤怠を pull して新システムへ投入
2. **Shadow Mode 検証（本命）** — 同じ打刻を自作エンジンと jinjer 両方で締め、
   割増・総労働時間・控除を 1 円単位で自動突合。jinjer を「正解データ」に回帰テスト。

## 段階プラン

- **Ph0** jinjer API で従業員マスタ＋過去勤怠を吸い出し
- **Ph1** 打刻＋日次/月次集計エンジン（← `kintai-core` から着手中）
- **Ph2** Shadow 稼働で突合検証
- **Ph3** 承認/有給/36協定アラート/給与連携 CSV
- **Ph4** jinjer 解約・完全移行

## 開発

```sh
pnpm install
pnpm -r test        # 全パッケージのテスト
pnpm -r typecheck
```

技術規約: Next.js + TypeScript + Tailwind + Prisma。`any` 禁止 / 型必須 /
raw SQL 禁止 / 入力バリデーション必須。UI は peco-ui（Primary #FCB900 / Secondary #FF6900）、iPad 優先。
