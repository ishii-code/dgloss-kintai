/**
 * リポジトリ port（インターフェース）とインフラ port。
 *
 * サービス層は具体的な DB 実装や SQL に依存せず、ここで定義した interface を通じて
 * データを読み書きする（依存性逆転）。実 DB 実装は別レイヤーで用意し、テストは
 * in-memory 実装（inMemory.ts）を注入する。raw SQL はここには一切現れない。
 */

import type {
  Employee,
  EmployeeId,
  ImprovementRequest,
  ImprovementRequestId,
  IsoDate,
  IsoDateTime,
  MonthlyClosing,
  ShadowComparison,
  Stamp,
  StampId,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";

/** 打刻の永続化。 */
export interface StampRepository {
  /** 打刻を保存する。 */
  save(stamp: Stamp): Promise<void>;
  /** 従業員の打刻を時刻範囲で取得する（両端含む・任意）。 */
  listByEmployeeAndRange(
    employeeId: EmployeeId,
    from: IsoDateTime,
    to: IsoDateTime,
  ): Promise<readonly Stamp[]>;
}

/** 日次勤怠の照会。 */
export interface WorkDayRepository {
  /** 従業員の日次勤怠を暦日範囲（両端含む）で取得する。日付昇順を期待する。 */
  listByEmployeeAndDateRange(
    employeeId: EmployeeId,
    from: IsoDate,
    to: IsoDate,
  ): Promise<readonly WorkDay[]>;
}

/** 月次締めの照会。 */
export interface MonthlyClosingRepository {
  /** 従業員・年月で月次締めを取得する。なければ null。 */
  findByEmployeeAndPeriod(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<MonthlyClosing | null>;
}

/** 従業員マスタの照会。 */
export interface EmployeeRepository {
  /** ID で従業員を取得する。存在しなければ null。 */
  findById(employeeId: EmployeeId): Promise<Employee | null>;
  /**
   * 全従業員を取得する。ログイン画面（従業員選択）の選択肢に用いる。
   * 表示順を安定させるため社員番号昇順などの安定ソートを期待する。
   */
  list(): Promise<readonly Employee[]>;
}

/** Shadow Mode 突合結果の照会（Ph2）。 */
export interface ShadowComparisonRepository {
  /** 従業員・年月で自作／jinjer の突合結果を取得する。なければ null。 */
  findByEmployeeAndPeriod(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<ShadowComparison | null>;
}

/** ID 採番 port。テストでは決定的な実装を注入できる。 */
export interface IdGenerator {
  /** 新しい打刻 ID を採番する。 */
  stampId(): StampId;
  /** 新しい改善リクエスト ID を採番する。 */
  improvementRequestId(): ImprovementRequestId;
}

/** 改善リクエストの永続化。 */
export interface ImprovementRequestRepository {
  /** 改善リクエストを保存する。 */
  save(request: ImprovementRequest): Promise<void>;
  /** 全改善リクエストを新しい順で返す。 */
  list(): Promise<readonly ImprovementRequest[]>;
}

/** 時刻 port。テストでは固定時刻を注入できる。 */
export interface Clock {
  /** 現在時刻（JST・RFC3339）を返す。 */
  now(): IsoDateTime;
}
