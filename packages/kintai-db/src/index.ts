/**
 * @dgloss-kintai/db
 *
 * Prisma 永続化層。@dgloss-kintai/api と @dgloss-kintai/jobs で定義された
 * repository / port の interface を、PrismaClient を DI した実装クラスで満たす。
 * Prisma 行とドメイン型（@dgloss-kintai/contracts）の変換は純粋なマッパーに切り出す。
 * raw SQL は用いず、Prisma のクエリ API のみを使う。
 */

// PrismaClient 生成ヘルパー
export { createPrismaClient, resolveDatabaseUrl } from "./client.js";
export type { CreatePrismaClientOptions } from "./client.js";

// リポジトリ実装（port 実装）
export { PrismaStampRepository } from "./stampRepository.js";
export { PrismaWorkDayRepository } from "./workDayRepository.js";
export { PrismaMonthlyClosingRepository } from "./monthlyClosingRepository.js";
export { PrismaEmployeeRepository } from "./employeeRepository.js";

// マッパー（純粋関数）
export {
  isoDateToDate,
  dateToIsoDate,
  isoDateTimeToDate,
  dateToIsoDateTime,
  stampRowToDomain,
  stampToRow,
  workDayRowToDomain,
  workDayToRow,
  monthlyClosingRowToDomain,
  monthlyClosingToRow,
  contractRowToDomain,
  contractToRow,
  employeeRowToDomain,
  employeeToRow,
} from "./mappers.js";
export type { EmployeeWithContractRow } from "./mappers.js";
