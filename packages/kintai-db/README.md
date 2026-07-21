# @dgloss-kintai/db

Prisma 永続化層。`@dgloss-kintai/api` と `@dgloss-kintai/jobs` で定義された
repository / port の interface を、PrismaClient を DI した実装クラスで満たす。
Prisma 行とドメイン型（`@dgloss-kintai/contracts`）の変換は純粋なマッパーに切り出す。
**raw SQL は用いず、Prisma のクエリ API のみを使う。**

## モデル

`prisma/schema.prisma`（provider: `postgresql`）:

- `Employee` ／ `EmploymentContract`（1-1・計算に関わる設定値を保持）
- `Stamp`（打刻） ／ `WorkDay`（日次勤怠） ／ `MonthlyClosing`（月次締め）
- 区分は enum（値は contracts の文字列リテラルと一致）。金額=Int（円）、時間=Int（分）。
- 複合ユニーク: `WorkDay(employeeId, date)` ／ `MonthlyClosing(employeeId, year, month)`。

## 実装している port

| port（定義元） | 実装クラス |
| --- | --- |
| `StampRepository`（api） | `PrismaStampRepository` |
| `WorkDayRepository` / `WorkDaySourcePort`（api/jobs） | `PrismaWorkDayRepository` |
| `MonthlyClosingRepository` / `MonthlyClosingSinkPort`（api/jobs） | `PrismaMonthlyClosingRepository` |
| `EmployeeRepository` / `EmployeeDirectoryPort`（api/jobs） | `PrismaEmployeeRepository` |

## セットアップ（ローカル）

```sh
# 1. Postgres を起動
docker compose up -d           # または各自の Postgres

# 2. 接続文字列を設定
cp .env.example .env           # DATABASE_URL を環境に合わせて編集

# 3. クライアント生成＋マイグレーション適用
pnpm --filter @dgloss-kintai/db prisma:generate
DATABASE_URL="postgresql://kintai:kintai@localhost:5432/kintai?schema=public" \
  npx --workspace @dgloss-kintai/db prisma migrate deploy
```

初期マイグレーションは `prisma/migrations/0001_init/migration.sql`（全テーブル・enum・
index・FK を生成）。実 Postgres 16 に適用し、リポジトリ経由の投入・復元（Employee／Stamp の
マッパー往復）が通ることを確認済み。

## 使い方

```ts
import {
  createPrismaClient,
  PrismaEmployeeRepository,
} from "@dgloss-kintai/db";

const prisma = createPrismaClient(); // DATABASE_URL から接続
const employees = new PrismaEmployeeRepository(prisma);
const emp = await employees.findById(employeeId); // → contracts の Employee 型

// jobs / api のユースケースに port として注入
// runMonthlyClosingJob(period, { employees, workDays, sink })
```

## テスト

```sh
pnpm --filter @dgloss-kintai/db test   # マッパー往復のユニットテスト（DB不要）
```

マッパー（Prisma 行 ↔ ドメイン型）は純粋関数として単体テストする。
実 DB 接続を伴う結合テストは Postgres が必要なため CI では別ステージとする。
