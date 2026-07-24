/**
 * jinjer からの移行オーケストレーション（Ph0）。
 *
 * jinjer API から従業員マスタ・過去勤怠を pull し、新システムの永続化先へ 1 件ずつ投入する。
 * 取得元（source）・書き込み先（sink）はいずれも port（interface）として注入し、
 * 実 DB 実装・実ネットワークは本パッケージには持たない（batch.ts と同じ方針）。
 *
 * オーケストレーションは「1 件の失敗で全体を止めない」。各要素の書き込みを try/catch で包み、
 * 成功件数・失敗件数・失敗明細を {@link MigrationResult} に集計して返す（移行の可観測性を担保）。
 * pull（一括取得）自体の失敗は要素単位ではないため、例外を呼び出し側へ伝播させる。
 */

import type {
  Employee,
  Stamp,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";

// --- 書き込み port（sink） ---

/**
 * 従業員マスタの書き込み先。
 *
 * 注: `@dgloss-kintai/db` の `PrismaEmployeeRepository.upsert(employee: Employee): Promise<void>`
 * がこの interface を**構造的に満たす**想定（実配線はアプリ層で行い、本パッケージには実 DB を持たない）。
 */
export interface EmployeeSink {
  /** 従業員（契約含む）を 1 件 upsert する（冪等）。 */
  upsert(employee: Employee): Promise<void>;
}

/**
 * 打刻の書き込み先。
 *
 * 注: `@dgloss-kintai/db` の `PrismaStampRepository.save(stamp: Stamp): Promise<void>`
 * がこの interface を構造的に満たす想定。
 */
export interface StampSink {
  /** 打刻を 1 件保存する（id で upsert・冪等）。 */
  save(stamp: Stamp): Promise<void>;
}

/**
 * 日次勤怠の書き込み先。
 *
 * 注: 実 DB の日次勤怠リポジトリ（`save(workDay: WorkDay): Promise<void>`）を配線する想定。
 */
export interface WorkDaySink {
  /** 日次勤怠を 1 件保存する（id で upsert・冪等）。 */
  save(workDay: WorkDay): Promise<void>;
}

// --- 移行元 port（source） ---

/**
 * 従業員マスタの取得元。
 *
 * 注: `JinjerConnector.pullEmployees()` がこの interface を構造的に満たすため、
 * connector をそのまま渡せる（`EmployeeSource` として抽象化して他ソースにも差し替え可能）。
 */
export interface EmployeeSource {
  /** 従業員マスタを一括 pull する。 */
  pullEmployees(): Promise<readonly Employee[]>;
}

/**
 * 打刻の取得元。
 *
 * 注: `JinjerConnector.pullStamps(period)` がこの interface を構造的に満たす。
 */
export interface StampSource {
  /** 指定月の打刻を一括 pull する。 */
  pullStamps(period: YearMonth): Promise<readonly Stamp[]>;
}

/**
 * 日次勤怠の取得元。
 *
 * 注: `JinjerConnector.pullAttendance(period)` がこの interface を構造的に満たす。
 */
export interface AttendanceSource {
  /** 指定月の日次勤怠を一括 pull する。 */
  pullAttendance(period: YearMonth): Promise<readonly WorkDay[]>;
}

// --- 集計結果 ---

/** 移行に失敗した 1 件の明細。 */
export interface MigrationFailure {
  /** 対象の識別子（従業員番号・打刻 ID・日次勤怠 ID など）。 */
  readonly id: string;
  /** 失敗理由（例外メッセージ）。 */
  readonly error: string;
}

/**
 * 移行の集計結果。
 *
 * `total === succeeded + failed` が常に成り立つ。`failures` には失敗した要素のみを列挙する。
 */
export interface MigrationResult {
  /** pull できた総件数（＝書き込みを試みた件数）。 */
  readonly total: number;
  /** 書き込みに成功した件数。 */
  readonly succeeded: number;
  /** 書き込みに失敗した件数。 */
  readonly failed: number;
  /** 失敗した要素の明細（成功順に対して失敗のみ）。 */
  readonly failures: readonly MigrationFailure[];
}

/** 例外から人間可読なメッセージを取り出す。 */
function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 取得済み要素を 1 件ずつ書き込み、成功/失敗を集計する（共通の核）。
 *
 * 1 件の書き込み失敗で全体を止めず、失敗は {@link MigrationFailure} として記録して続行する。
 *
 * @param items    書き込み対象（pull 済み）
 * @param identify 要素から失敗明細用の識別子を取り出す関数
 * @param write    要素を 1 件書き込む副作用（sink 呼び出し）
 * @returns 集計済みの {@link MigrationResult}
 */
async function migrateItems<T>(
  items: readonly T[],
  identify: (item: T) => string,
  write: (item: T) => Promise<void>,
): Promise<MigrationResult> {
  const failures: MigrationFailure[] = [];
  let succeeded = 0;
  for (const item of items) {
    try {
      await write(item);
      succeeded += 1;
    } catch (err) {
      failures.push({ id: identify(item), error: toErrorMessage(err) });
    }
  }
  return {
    total: items.length,
    succeeded,
    failed: failures.length,
    failures,
  };
}

/** {@link migrateEmployees} の依存注入。 */
export interface MigrateEmployeesDeps {
  /** 従業員マスタの取得元（jinjer connector 等）。 */
  readonly source: EmployeeSource;
  /** 従業員マスタの書き込み先（実 DB リポジトリ等）。 */
  readonly sink: EmployeeSink;
}

/**
 * 従業員マスタを移行する（Ph0）。
 *
 * source から従業員を一括 pull し、1 件ずつ sink.upsert へ投入する。
 * 1 件の失敗で全体を止めず、成功/失敗件数・失敗明細を集計して返す。
 *
 * @param deps 取得元・書き込み先
 * @returns 集計済みの {@link MigrationResult}
 */
export async function migrateEmployees(
  deps: MigrateEmployeesDeps,
): Promise<MigrationResult> {
  const employees = await deps.source.pullEmployees();
  return migrateItems(
    employees,
    (e) => e.employeeCode,
    (e) => deps.sink.upsert(e),
  );
}

/** {@link migrateStamps} の依存注入。 */
export interface MigrateStampsDeps {
  /** 打刻の取得元（jinjer connector 等）。 */
  readonly source: StampSource;
  /** 打刻の書き込み先。 */
  readonly sink: StampSink;
}

/**
 * 指定月の打刻を移行する（Ph0）。
 *
 * @param period 移行対象の年月
 * @param deps   取得元・書き込み先
 * @returns 集計済みの {@link MigrationResult}
 */
export async function migrateStamps(
  period: YearMonth,
  deps: MigrateStampsDeps,
): Promise<MigrationResult> {
  const stamps = await deps.source.pullStamps(period);
  return migrateItems(
    stamps,
    (s) => s.id,
    (s) => deps.sink.save(s),
  );
}

/** {@link migrateAttendance} の依存注入。 */
export interface MigrateAttendanceDeps {
  /** 日次勤怠の取得元（jinjer connector 等）。 */
  readonly source: AttendanceSource;
  /** 日次勤怠の書き込み先。 */
  readonly sink: WorkDaySink;
}

/**
 * 指定月の日次勤怠を移行する（Ph0）。
 *
 * @param period 移行対象の年月
 * @param deps   取得元・書き込み先
 * @returns 集計済みの {@link MigrationResult}
 */
export async function migrateAttendance(
  period: YearMonth,
  deps: MigrateAttendanceDeps,
): Promise<MigrationResult> {
  const workDays = await deps.source.pullAttendance(period);
  return migrateItems(
    workDays,
    (w) => w.id,
    (w) => deps.sink.save(w),
  );
}
