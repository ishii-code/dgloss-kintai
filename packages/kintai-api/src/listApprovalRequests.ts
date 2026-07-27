/**
 * ユースケース: 承認申請一覧（ワークフロー）。新しい順で全件を返す。
 */

import type { ApprovalRequest } from "@dgloss-kintai/contracts";
import type { ApprovalRequestRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** listApprovalRequests の依存。 */
export interface ListApprovalRequestsDeps {
  readonly approvals: ApprovalRequestRepository;
}

/** 承認申請を新しい順で取得する。 */
export async function listApprovalRequests(
  deps: ListApprovalRequestsDeps,
): Promise<Result<readonly ApprovalRequest[]>> {
  const list = await deps.approvals.list();
  return ok(list);
}
