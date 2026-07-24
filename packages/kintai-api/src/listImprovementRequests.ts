/**
 * ユースケース: 改善リクエスト一覧。新しい順で全件を返す。
 */

import type { ImprovementRequest } from "@dgloss-kintai/contracts";
import type { ImprovementRequestRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** listImprovementRequests の依存。 */
export interface ListImprovementRequestsDeps {
  readonly improvements: ImprovementRequestRepository;
}

/** 改善リクエストを新しい順で取得する。 */
export async function listImprovementRequests(
  deps: ListImprovementRequestsDeps,
): Promise<Result<readonly ImprovementRequest[]>> {
  const list = await deps.improvements.list();
  return ok(list);
}
