/**
 * @dgloss-kintai/api
 *
 * 勤怠 API のサービス層。HTTP フレームワークに依存しない「ユースケース関数」として
 * 打刻登録・勤怠照会・締め取得を型安全に提供する。各関数は入力を zod で検証し、
 * リポジトリ port 経由でデータを操作し、例外ではなく Result<T> でエラーを返す。
 * 後段（Next.js API ルート等）はこれをマウントし、ApiError.code を HTTP ステータスに
 * マッピングするだけでよい。
 */

// Result / エラー
export type {
  ApiError,
  ApiErrorCode,
  ApiErrorDetail,
  Result,
} from "./result.js";
export {
  ok,
  err,
  validationError,
  notFoundError,
  conflictError,
} from "./result.js";

// リポジトリ / インフラ port
export type {
  StampRepository,
  WorkDayRepository,
  MonthlyClosingRepository,
  EmployeeRepository,
  ShadowComparisonRepository,
  ImprovementRequestRepository,
  IdGenerator,
  Clock,
} from "./ports.js";

// 照会クエリスキーマ
export {
  stampQuerySchema,
  workDayQuerySchema,
  monthlyClosingQuerySchema,
  shadowComparisonQuerySchema,
} from "./schema.js";
export type {
  StampQueryParsed,
  WorkDayQueryParsed,
  MonthlyClosingQueryParsed,
  ShadowComparisonQueryParsed,
} from "./schema.js";

// ユースケース
export { registerStamp } from "./registerStamp.js";
export type { RegisterStampDeps } from "./registerStamp.js";
export { listStamps } from "./listStamps.js";
export type { ListStampsDeps } from "./listStamps.js";
export { createImprovementRequest } from "./createImprovementRequest.js";
export type { CreateImprovementRequestDeps } from "./createImprovementRequest.js";
export { listImprovementRequests } from "./listImprovementRequests.js";
export type { ListImprovementRequestsDeps } from "./listImprovementRequests.js";
export { listEmployees } from "./listEmployees.js";
export type { ListEmployeesDeps } from "./listEmployees.js";
export { getEmployee, employeeQuerySchema } from "./getEmployee.js";
export type { GetEmployeeDeps } from "./getEmployee.js";
export { listWorkDays } from "./listWorkDays.js";
export type { ListWorkDaysDeps } from "./listWorkDays.js";
export { getMonthlyClosing } from "./getMonthlyClosing.js";
export type { GetMonthlyClosingDeps } from "./getMonthlyClosing.js";
export { getShadowComparison } from "./getShadowComparison.js";
export type { GetShadowComparisonDeps } from "./getShadowComparison.js";

// 従業員管理ユースケース（Phase 2・管理者専用）
export { createEmployee } from "./createEmployee.js";
export type { CreateEmployeeDeps } from "./createEmployee.js";
export { updateEmployee } from "./updateEmployee.js";
export type { UpdateEmployeeDeps } from "./updateEmployee.js";
export { getEmployeeDetail, employeeDetailQuerySchema } from "./getEmployeeDetail.js";
export type { GetEmployeeDetailDeps } from "./getEmployeeDetail.js";
export { listEmployeesDetailed } from "./listEmployeesDetailed.js";
export type { ListEmployeesDetailedDeps } from "./listEmployeesDetailed.js";
export { employeeSummary, summarizeEmployees } from "./employeeSummary.js";
export type {
  EmployeeSummaryDeps,
  EmployeeDatabaseSummary,
} from "./employeeSummary.js";
export { importEmployeesCsv } from "./importEmployeesCsv.js";
export type {
  ImportEmployeesCsvDeps,
  ImportResult,
  ImportRowError,
} from "./importEmployeesCsv.js";
export { exportEmployeesCsv } from "./exportEmployeesCsv.js";
export type { ExportEmployeesCsvDeps } from "./exportEmployeesCsv.js";

// 従業員入力スキーマ・CSV 変換（列定義・区分ラベル）
export {
  employeeInputSchema,
  employeeUpdateInputSchema,
  contractFromParsed,
} from "./employeeInput.js";
export type {
  EmployeeInputParsed,
  EmployeeUpdateInputParsed,
} from "./employeeInput.js";
export {
  EMPLOYEE_CSV_HEADERS,
  EMPLOYMENT_TYPE_LABEL,
  WORK_SYSTEM_LABEL,
  OFFICE_LABEL,
  BOOL_LABEL,
  serializeEmployeesCsv,
  parseCsv,
} from "./employeeCsv.js";

// port の in-memory 参照実装（テスト・ローカル用）
export {
  InMemoryStampRepository,
  InMemoryWorkDayRepository,
  InMemoryMonthlyClosingRepository,
  InMemoryEmployeeRepository,
  InMemoryShadowComparisonRepository,
  InMemoryImprovementRequestRepository,
  SequentialIdGenerator,
  FixedClock,
} from "./inMemory.js";
