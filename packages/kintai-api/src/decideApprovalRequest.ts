/**
 * ユースケース: 承認申請の決裁（承認／却下）。
 *
 * 決裁者・申請 ID・区分を検証し、pending の申請のみ承認／却下する。
 * - 申請が存在しなければ not_found
 * - 決裁者が存在しなければ not_found
 * - 申請者本人による決裁は不可（conflict・自己承認の防止）
 * - すでに決裁済み（pending でない）は conflict
 *
 * 認可（管理者のみ決裁可）は呼び出し側（API ルートの checkAdmin）で担保する。
 */

import { approvalDecisionInputSchema } from "@dgloss-kintai/contracts";
import type {
  ApprovalRequest,
  ApprovalRequestId,
  EmployeeId,
} from "@dgloss-kintai/contracts";
import type {
  ApprovalRequestRepository,
  Clock,
  EmployeeRepository,
} from "./ports.js";
import {
  conflictError,
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** decideApprovalRequest の依存。 */
export interface DecideApprovalRequestDeps {
  readonly approvals: ApprovalRequestRepository;
  readonly employees: EmployeeRepository;
  readonly clock: Clock;
}

/**
 * 承認申請を決裁する（承認 or 却下）。
 *
 * @param input 決裁入力（未検証の unknown。requestId・deciderEmployeeId・decision・comment?）
 * @param deps  リポジトリ・時刻 port
 */
export async function decideApprovalRequest(
  input: unknown,
  deps: DecideApprovalRequestDeps,
): Promise<Result<ApprovalRequest>> {
  const parsed = approvalDecisionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "決裁の入力が不正です"));
  }

  const requestId = parsed.data.requestId as ApprovalRequestId;
  const deciderEmployeeId = parsed.data.deciderEmployeeId as EmployeeId;

  const request = await deps.approvals.findById(requestId);
  if (request === null) {
    return err(notFoundError(`承認申請が見つかりません: ${parsed.data.requestId}`));
  }

  const decider = await deps.employees.findById(deciderEmployeeId);
  if (decider === null) {
    return err(
      notFoundError(`従業員が見つかりません: ${parsed.data.deciderEmployeeId}`),
    );
  }

  if (request.applicantEmployeeId === deciderEmployeeId) {
    return err(conflictError("自分の申請は決裁できません"));
  }

  if (request.status !== "pending") {
    return err(
      conflictError(
        `すでに決裁済みです（現在: ${request.status}）。再決裁はできません`,
      ),
    );
  }

  const now = deps.clock.now();
  const decided: ApprovalRequest = {
    ...request,
    status: parsed.data.decision === "approve" ? "approved" : "rejected",
    decidedByEmployeeId: deciderEmployeeId,
    decidedAt: now,
    decisionComment:
      parsed.data.comment !== undefined ? parsed.data.comment : null,
    updatedAt: now,
  };

  await deps.approvals.save(decided);
  return ok(decided);
}
