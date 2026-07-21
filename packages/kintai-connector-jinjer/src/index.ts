/**
 * @dgloss-kintai/connector-jinjer
 *
 * jinjer 連携。従業員マスタ・過去勤怠の移行 pull（Ph0）と、締め結果の Shadow Mode 突合（Ph2）専用。
 * jinjer API は計算ロジックを持たない「データ入出力口」であり、割増計算は @dgloss-kintai/core が担う。
 *
 * 認証情報・エンドポイントは設定注入（{@link JinjerConfig}）。HTTP は transport 抽象
 * （{@link JinjerTransport}）に隔離し、テストはスタブ注入で実ネットワークを呼ばない。
 * 実 jinjer 仕様が判明したら DTO スキーマ（dto.ts）・コード変換表（mappers.ts）・
 * ヘッダ組み立て（transport.ts）を差し替えれば足りる構造。
 */

export type { JinjerConfig } from "./config.js";
export { resolveApiVersion, resolveTimeoutMs } from "./config.js";

export type {
  JinjerTransport,
  JinjerRequest,
  JinjerHttpMethod,
  MinimalFetch,
  MinimalFetchResponse,
} from "./transport.js";
export { FetchJinjerTransport, JinjerTransportError } from "./transport.js";

export {
  jinjerEnvelopeSchema,
  jinjerEmployeeDtoSchema,
  jinjerStampDtoSchema,
  jinjerClassifiedMinutesDtoSchema,
  jinjerDailyAttendanceDtoSchema,
  jinjerAllowancesDtoSchema,
  jinjerMonthlyClosingDtoSchema,
  jinjerFixedOvertimeCoverageSchema,
  jinjerEmployeeListSchema,
  jinjerStampListSchema,
  jinjerDailyAttendanceListSchema,
  jinjerMonthlyClosingListSchema,
} from "./dto.js";
export type {
  JinjerEmployeeDto,
  JinjerStampDto,
  JinjerClassifiedMinutesDto,
  JinjerDailyAttendanceDto,
  JinjerAllowancesDto,
  JinjerMonthlyClosingDto,
} from "./dto.js";

export {
  mapEmployee,
  mapStamp,
  mapWorkDay,
  mapClassifiedMinutes,
  mapAllowances,
  mapMonthlyClosing,
  JinjerMappingError,
} from "./mappers.js";
export type { JinjerClosingValue } from "./mappers.js";

export { JinjerConnector } from "./pull.js";

export {
  compareShadow,
  toShadowMismatchEvent,
  describeShadowRisk,
  ShadowComparisonMismatchError,
} from "./shadow.js";

export { runShadowVerification } from "./verify.js";
export type {
  ShadowAttendanceSource,
  ShadowVerificationDeps,
  ShadowVerificationResult,
  ShadowMissingEntry,
} from "./verify.js";
