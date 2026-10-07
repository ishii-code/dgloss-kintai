/**
 * リポジトリ port（インターフェース）とインフラ port。
 *
 * サービス層は具体的な DB 実装や SQL に依存せず、ここで定義した interface を通じて
 * データを読み書きする（依存性逆転）。実 DB 実装は別レイヤーで用意し、テストは
 * in-memory 実装（inMemory.ts）を注入する。raw SQL はここには一切現れない。
 */

import type {
  ApprovalRequest,
  ApprovalRequestId,
  CompanySettings,
  Employee,
  EmployeeId,
  ImprovementRequest,
  ImprovementRequestId,
  IsoDate,
  IsoDateTime,
  MonthlyClosing,
  RoleSettings,
  ShadowComparison,
  Stamp,
  StampId,
  WorkCalendar,
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

/** 日次勤怠の照会・保存。 */
export interface WorkDayRepository {
  /** 従業員の日次勤怠を暦日範囲（両端含む）で取得する。日付昇順を期待する。 */
  listByEmployeeAndDateRange(
    employeeId: EmployeeId,
    from: IsoDate,
    to: IsoDate,
  ): Promise<readonly WorkDay[]>;
  /** 日次勤怠を保存する（従業員×暦日で upsert・冪等）。打刻の日次化で用いる。 */
  save(workDay: WorkDay): Promise<void>;
}

/** 月次締めの照会・保存。 */
export interface MonthlyClosingRepository {
  /** 従業員・年月で月次締めを取得する。なければ null。 */
  findByEmployeeAndPeriod(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<MonthlyClosing | null>;
  /** 月次締めを保存する（従業員×年月で upsert・冪等）。締め実行で用いる。 */
  save(closing: MonthlyClosing): Promise<void>;
}

/** 従業員マスタの照会・書き込み。 */
export interface EmployeeRepository {
  /** ID で従業員を取得する。存在しなければ null。 */
  findById(employeeId: EmployeeId): Promise<Employee | null>;
  /**
   * 全従業員を取得する。ログイン画面（従業員選択）の選択肢・管理画面の一覧に用いる。
   * 表示順を安定させるため社員番号昇順などの安定ソートを期待する。
   */
  list(): Promise<readonly Employee[]>;
  /**
   * 従業員（雇用契約含む）を id で upsert する（冪等）。
   * 既存があれば更新、無ければ作成する。管理画面の作成・更新・CSV 取込で用いる。
   */
  upsert(employee: Employee): Promise<void>;
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
  /** 新しい従業員 ID を採番する。 */
  employeeId(): EmployeeId;
  /** 新しい承認申請 ID を採番する。 */
  approvalRequestId(): ApprovalRequestId;
}

/** 改善リクエストの永続化。 */
export interface ImprovementRequestRepository {
  /** 改善リクエストを保存する。 */
  save(request: ImprovementRequest): Promise<void>;
  /** 全改善リクエストを新しい順で返す。 */
  list(): Promise<readonly ImprovementRequest[]>;
}

/** 承認申請（ワークフロー）の永続化。 */
export interface ApprovalRequestRepository {
  /** 承認申請を保存する（作成・決裁・取消いずれも upsert）。 */
  save(request: ApprovalRequest): Promise<void>;
  /** ID で承認申請を取得する。なければ null。 */
  findById(id: ApprovalRequestId): Promise<ApprovalRequest | null>;
  /** 全承認申請を新しい順で返す。 */
  list(): Promise<readonly ApprovalRequest[]>;
}

/** 企業設定（シングルトン）の永続化。 */
export interface CompanySettingsRepository {
  /** 保存済みの企業設定を返す。未保存なら null（呼び出し側が既定へフォールバック）。 */
  get(): Promise<CompanySettings | null>;
  /** 企業設定を保存する（シングルトンの upsert）。 */
  save(settings: CompanySettings): Promise<void>;
}

/** ロール設定（シングルトン）の永続化。 */
export interface RoleSettingsRepository {
  /** 保存済みのロール設定を返す。未保存なら null（呼び出し側が env/既定へフォールバック）。 */
  get(): Promise<RoleSettings | null>;
  /** ロール設定を保存する（シングルトンの upsert）。 */
  save(settings: RoleSettings): Promise<void>;
}

/** 勤務カレンダー（シングルトン）の永続化。 */
export interface WorkCalendarRepository {
  /** 保存済みの勤務カレンダーを返す。未保存なら null（呼び出し側が既定へフォールバック）。 */
  get(): Promise<WorkCalendar | null>;
  /** 勤務カレンダーを保存する（シングルトンの upsert）。 */
  save(calendar: WorkCalendar): Promise<void>;
}

/** 時刻 port。テストでは固定時刻を注入できる。 */
export interface Clock {
  /** 現在時刻（JST・RFC3339）を返す。 */
  now(): IsoDateTime;
}

/**
 * 固定残業超過アラートの通知済み状態（従業員×年月で1回だけ通知するための冪等キー）。
 * 月内で一度「超過」を通知したら、同月の以降の実行では再通知しない。
 */
export interface OvertimeAlertStateRepository {
  /** 当該従業員・年月について既に超過通知済みかを返す。 */
  wasNotified(employeeId: EmployeeId, period: YearMonth): Promise<boolean>;
  /** 当該従業員・年月を通知済みとして記録する（冪等）。 */
  markNotified(record: OvertimeAlertRecord): Promise<void>;
}

/** 通知済みとして記録する固定残業超過アラート（最小限）。 */
export interface OvertimeAlertRecord {
  readonly employeeId: EmployeeId;
  readonly period: YearMonth;
  /** 通知時点の超過額（差額支給・円）。 */
  readonly additionalPayment: number;
  /** 通知時刻（RFC3339）。 */
  readonly notifiedAt: IsoDateTime;
}

/**
 * 固定残業超過アラートの送信先（Google チャット等）。
 * 送信失敗は呼び出し側で握りつぶさず例外伝播してよい（通知済み記録の前に送るため）。
 */
export interface OvertimeAlertNotifier {
  /** 1件以上の超過アラートをまとめて通知する。 */
  notify(alerts: readonly FixedOvertimeAlert[]): Promise<void>;
}

/** 固定残業を超過した従業員1名分の通知内容（当月見込み・確定共通）。 */
export interface FixedOvertimeAlert {
  readonly employeeId: EmployeeId;
  readonly employeeCode: string;
  readonly name: string;
  /** 事業部（未設定なら null）。 */
  readonly department: string | null;
  /** 対象年月。 */
  readonly period: YearMonth;
  /** 集計の基準日（当月1日〜この日までの見込み）。 */
  readonly asOf: IsoDate;
  /** 固定時間外勤務手当の月額（円）。 */
  readonly fixedOvertimeAllowance: number;
  /** 当月の時間外相当の労働時間（分・法定内外の時間外合計）。 */
  readonly overtimeMinutes: number;
  /** 固定残業を超えて発生した差額支給（円・> 0）。 */
  readonly additionalPayment: number;
}
