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
export {
  resolveApiVersion,
  resolveTokenPath,
  resolveAccessTokenTtlMs,
  resolveTimeoutMs,
  DEFAULT_ACCESS_TOKEN_TTL_MS,
  DEFAULT_TOKEN_PATH,
} from "./config.js";

export type {
  JinjerTransport,
  JinjerRequest,
  JinjerHttpMethod,
  MinimalFetch,
  MinimalFetchResponse,
  Clock,
} from "./transport.js";
export {
  FetchJinjerTransport,
  JinjerTransportError,
  JinjerAuthError,
} from "./transport.js";

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

// Shadow 検証を実際に走らせるデモランナー（フィクスチャ＋スタブ transport・ネットワーク非依存）。
// 実 jinjer 仕様が判明したら transport を FetchJinjerTransport に、勤怠ソースを実 DB 実装に
// 差し替えるだけで本番の Shadow 検証へ転用できる「型付きの座（seam）」。
export {
  runShadowDemo,
  formatShadowReport,
  demoEmployeeNames,
  DEMO_CLOSED_AT,
  DEMO_OCCURRED_AT,
} from "./runner/demo.js";
export type { ShadowDemoOptions, ShadowReportOptions } from "./runner/demo.js";
export { buildDemoScenarios, DEMO_PERIOD } from "./runner/fixtures.js";
export type { DemoScenario } from "./runner/fixtures.js";
export { InMemoryAttendanceSource } from "./runner/attendanceSource.js";
export {
  StubJinjerTransport,
  buildJinjerClosingDto,
} from "./runner/stubTransport.js";
