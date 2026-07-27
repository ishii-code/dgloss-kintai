/**
 * ユースケース: 承認申請の取消（申請者本人・pending のみ）。
 *
 * - 申請が存在しなければ not_found
 * - 申請者本人以外による取消は不可（conflict）
 * - pending 以外（決裁済み・取消済み）は conflict
 */

import { approvalCancelInputSchema } from "@dgloss-kintai/contracts";
import type {
  ApprovalRequest,
  ApprovalRequestId,
  EmployeeId,
} from "@dgloss-kintai/contracts";
import type { ApprovalRequestRepository, Clock } from "./ports.js";
import {
  conflictError,
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** cancelApprovalRequest の依存。 */
export interface CancelApprovalRequestDeps {
  readonly approvals: ApprovalRequestRepository;
  readonly clock: Clock;
}

/**
 * 承認申請を取り消す（申請者本人・pending のみ）。
 *
 * @param input 取消入力（未検証の unknown。requestId・applicantEmployeeId）
 * @param deps  リポジトリ・時刻 port
 */
export async function cancelApprovalRequest(
  input: unknown,
  deps: CancelApprovalRequestDeps,
): Promise<Result<ApprovalRequest>> {
  const parsed = approvalCancelInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "取消の入力が不正です"));
  }

  const requestId = parsed.data.requestId as ApprovalRequestId;
  const applicantEmployeeId = parsed.data.applicantEmployeeId as EmployeeId;

  const request = await deps.approvals.findById(requestId);
  if (request === null) {
    return err(notFoundError(`承認申請が見つかりません: ${parsed.data.requestId}`));
  }

  if (request.applicantEmployeeId !== applicantEmployeeId) {
    return err(conflictError("自分の申請のみ取り消せます"));
  }

  if (request.status !== "pending") {
    return err(
      conflictError(`取消できません（現在: ${request.status}）`),
    );
  }

  const now = deps.clock.now();
  const cancelled: ApprovalRequest = {
    ...request,
    status: "cancelled",
    updatedAt: now,
  };

  await deps.approvals.save(cancelled);
  return ok(cancelled);
}
