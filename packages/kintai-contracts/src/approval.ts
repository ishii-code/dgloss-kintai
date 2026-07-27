/**
 * 承認ワークフロー（申請・承認）。
 *
 * 従業員が残業・休暇・打刻修正などを申請し、管理者が承認／却下する。
 * jinjer の「ワークフロー（各種申請・承認）」に相当する（賃金規程・就業規則の運用を電子化する）。
 *
 * 状態遷移: pending →(承認) approved / (却下) rejected / (申請者取消) cancelled。
 * approved/rejected/cancelled は終端で、再決裁はできない（ユースケース側で conflict とする）。
 */

import { z } from "zod";
import { isoDateSchema } from "./schema.js";
import type {
  ApprovalRequestId,
  EmployeeId,
  IsoDate,
  IsoDateTime,
} from "./common.js";

/** 申請種別。 */
export type ApprovalRequestType =
  | "overtime" // 残業申請
  | "leave" // 休暇申請
  | "stamp_correction"; // 打刻修正申請

export const APPROVAL_REQUEST_TYPES: readonly ApprovalRequestType[] = [
  "overtime",
  "leave",
  "stamp_correction",
] as const;

/** 申請ステータス。 */
export type ApprovalRequestStatus =
  | "pending" // 申請中（未決裁）
  | "approved" // 承認
  | "rejected" // 却下
  | "cancelled"; // 申請者による取消

export const APPROVAL_REQUEST_STATUSES: readonly ApprovalRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

/** 決裁区分（承認 or 却下）。 */
export type ApprovalDecision = "approve" | "reject";

export const APPROVAL_DECISIONS: readonly ApprovalDecision[] = [
  "approve",
  "reject",
] as const;

/** 承認申請（1件）。決裁前は decidedBy/decidedAt/decisionComment が null。 */
export interface ApprovalRequest {
  readonly id: ApprovalRequestId;
  readonly type: ApprovalRequestType;
  /** 申請者（ログイン中の従業員）。 */
  readonly applicantEmployeeId: EmployeeId;
  /** 対象日（残業日・休暇日・打刻修正日など）。任意。 */
  readonly targetDate: IsoDate | null;
  /** 申請の要旨（1行）。 */
  readonly subject: string;
  /** 申請の詳細（理由・時間数など）。 */
  readonly detail: string;
  readonly status: ApprovalRequestStatus;
  /** 承認／却下した管理者（未決裁は null）。 */
  readonly decidedByEmployeeId: EmployeeId | null;
  /** 決裁時刻（未決裁は null）。 */
  readonly decidedAt: IsoDateTime | null;
  /** 決裁コメント（任意・未設定は null）。 */
  readonly decisionComment: string | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** 申請の起票入力（ID・日時・ステータス確定前）。 */
export interface ApprovalRequestInput {
  readonly applicantEmployeeId: EmployeeId;
  readonly type: ApprovalRequestType;
  readonly targetDate?: IsoDate;
  readonly subject: string;
  readonly detail: string;
}

/** 起票入力の zod スキーマ。 */
export const approvalRequestInputSchema = z.object({
  applicantEmployeeId: z.string().min(1),
  type: z.enum(APPROVAL_REQUEST_TYPES as [string, ...string[]]),
  targetDate: isoDateSchema.optional(),
  subject: z.string().min(1).max(200),
  detail: z.string().min(1).max(4000),
});

export type ApprovalRequestInputParsed = z.infer<
  typeof approvalRequestInputSchema
>;

/** 決裁入力の zod スキーマ（承認／却下）。 */
export const approvalDecisionInputSchema = z.object({
  requestId: z.string().min(1),
  deciderEmployeeId: z.string().min(1),
  decision: z.enum(APPROVAL_DECISIONS as [string, ...string[]]),
  comment: z.string().max(2000).optional(),
});

export type ApprovalDecisionInputParsed = z.infer<
  typeof approvalDecisionInputSchema
>;

/** 取消入力の zod スキーマ（申請者本人による pending の取消）。 */
export const approvalCancelInputSchema = z.object({
  requestId: z.string().min(1),
  applicantEmployeeId: z.string().min(1),
});

export type ApprovalCancelInputParsed = z.infer<
  typeof approvalCancelInputSchema
>;
