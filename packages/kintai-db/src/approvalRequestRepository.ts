/**
 * 承認申請（ワークフロー）の Prisma 永続化。
 * ドメイン型（contracts.ApprovalRequest）と Prisma 行を相互変換する。raw SQL は使わない。
 */

import type {
  ApprovalRequest,
  ApprovalRequestId,
  ApprovalRequestStatus,
  ApprovalRequestType,
  EmployeeId,
  IsoDate,
  IsoDateTime,
} from "@dgloss-kintai/contracts";
import type { PrismaClient } from "@prisma/client";
import {
  dateToIsoDate,
  dateToIsoDateTime,
  isoDateToDate,
  isoDateTimeToDate,
} from "./mappers.js";

/** Prisma 行の形（@db.Date は Date、時刻も Date）。 */
interface ApprovalRequestRow {
  id: string;
  type: ApprovalRequestType;
  applicantEmployeeId: string;
  targetDate: Date | null;
  subject: string;
  detail: string;
  status: ApprovalRequestStatus;
  decidedByEmployeeId: string | null;
  decidedAt: Date | null;
  decisionComment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Prisma 行 → 承認申請ドメイン型。 */
export function approvalRequestRowToDomain(
  row: ApprovalRequestRow,
): ApprovalRequest {
  return {
    id: row.id as ApprovalRequestId,
    type: row.type,
    applicantEmployeeId: row.applicantEmployeeId as EmployeeId,
    targetDate: row.targetDate === null ? null : (dateToIsoDate(row.targetDate) as IsoDate),
    subject: row.subject,
    detail: row.detail,
    status: row.status,
    decidedByEmployeeId:
      row.decidedByEmployeeId === null
        ? null
        : (row.decidedByEmployeeId as EmployeeId),
    decidedAt:
      row.decidedAt === null ? null : (dateToIsoDateTime(row.decidedAt) as IsoDateTime),
    decisionComment: row.decisionComment,
    createdAt: dateToIsoDateTime(row.createdAt) as IsoDateTime,
    updatedAt: dateToIsoDateTime(row.updatedAt) as IsoDateTime,
  };
}

/**
 * 承認申請の Prisma 実装。
 * `@dgloss-kintai/api` の ApprovalRequestRepository port を満たす。
 */
export class PrismaApprovalRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 承認申請を保存する（作成・決裁・取消いずれも upsert）。 */
  async save(request: ApprovalRequest): Promise<void> {
    const data = {
      id: request.id,
      type: request.type,
      applicantEmployeeId: request.applicantEmployeeId,
      targetDate:
        request.targetDate === null ? null : isoDateToDate(request.targetDate),
      subject: request.subject,
      detail: request.detail,
      status: request.status,
      decidedByEmployeeId: request.decidedByEmployeeId,
      decidedAt:
        request.decidedAt === null ? null : isoDateTimeToDate(request.decidedAt),
      decisionComment: request.decisionComment,
      createdAt: isoDateTimeToDate(request.createdAt),
      updatedAt: isoDateTimeToDate(request.updatedAt),
    };
    await this.prisma.approvalRequest.upsert({
      where: { id: request.id },
      create: data,
      update: data,
    });
  }

  /** ID で承認申請を取得する。なければ null。 */
  async findById(id: ApprovalRequestId): Promise<ApprovalRequest | null> {
    const row = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    return row === null ? null : approvalRequestRowToDomain(row);
  }

  /** 全承認申請を新しい順で返す。 */
  async list(): Promise<readonly ApprovalRequest[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(approvalRequestRowToDomain);
  }
}
