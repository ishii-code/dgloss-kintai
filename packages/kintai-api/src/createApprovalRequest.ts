/**
 * ユースケース: 承認申請の起票（ワークフロー）。
 *
 * 入力を approvalRequestInputSchema で検証し、申請者の存在を確認して pending で保存する。
 */

import { approvalRequestInputSchema } from "@dgloss-kintai/contracts";
import type {
  ApprovalRequest,
  ApprovalRequestType,
  EmployeeId,
  IsoDate,
} from "@dgloss-kintai/contracts";
import type {
  ApprovalRequestRepository,
  Clock,
  EmployeeRepository,
  IdGenerator,
} from "./ports.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** createApprovalRequest の依存。 */
export interface CreateApprovalRequestDeps {
  readonly approvals: ApprovalRequestRepository;
  readonly employees: EmployeeRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * 承認申請を起票する（status="pending"）。
 *
 * @param input 起票入力（未検証の unknown）
 * @param deps  リポジトリ・採番・時刻 port
 */
export async function createApprovalRequest(
  input: unknown,
  deps: CreateApprovalRequestDeps,
): Promise<Result<ApprovalRequest>> {
  const parsed = approvalRequestInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "承認申請の入力が不正です"));
  }

  const applicantEmployeeId = parsed.data.applicantEmployeeId as EmployeeId;
  const applicant = await deps.employees.findById(applicantEmployeeId);
  if (applicant === null) {
    return err(
      notFoundError(
        `従業員が見つかりません: ${parsed.data.applicantEmployeeId}`,
      ),
    );
  }

  const now = deps.clock.now();
  const request: ApprovalRequest = {
    id: deps.ids.approvalRequestId(),
    type: parsed.data.type as ApprovalRequestType,
    applicantEmployeeId,
    targetDate:
      parsed.data.targetDate !== undefined
        ? (parsed.data.targetDate as IsoDate)
        : null,
    subject: parsed.data.subject,
    detail: parsed.data.detail,
    status: "pending",
    decidedByEmployeeId: null,
    decidedAt: null,
    decisionComment: null,
    createdAt: now,
    updatedAt: now,
  };

  await deps.approvals.save(request);
  return ok(request);
}
