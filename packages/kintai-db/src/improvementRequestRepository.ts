/**
 * 改善リクエストの Prisma 永続化。
 * ドメイン型（contracts.ImprovementRequest）と Prisma 行を相互変換する。raw SQL は使わない。
 */

import type {
  EmployeeId,
  ImprovementRequest,
  ImprovementRequestId,
  ImprovementRequestStatus,
  IsoDateTime,
} from "@dgloss-kintai/contracts";
import type { PrismaClient } from "@prisma/client";
import { dateToIsoDateTime, isoDateTimeToDate } from "./mappers.js";

/** Prisma 行 → ドメイン型。 */
interface ImprovementRequestRow {
  id: string;
  createdByEmployeeId: string;
  category: ImprovementRequest["category"];
  title: string;
  body: string;
  status: ImprovementRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Prisma 行 → 改善リクエストドメイン型。 */
export function improvementRequestRowToDomain(
  row: ImprovementRequestRow,
): ImprovementRequest {
  return {
    id: row.id as ImprovementRequestId,
    createdByEmployeeId: row.createdByEmployeeId as EmployeeId,
    category: row.category,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: dateToIsoDateTime(row.createdAt) as IsoDateTime,
    updatedAt: dateToIsoDateTime(row.updatedAt) as IsoDateTime,
  };
}

/**
 * 改善リクエストの Prisma 実装。
 * `@dgloss-kintai/api` の ImprovementRequestRepository port を満たす。
 */
export class PrismaImprovementRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 改善リクエストを保存する。 */
  async save(request: ImprovementRequest): Promise<void> {
    const data = {
      id: request.id,
      createdByEmployeeId: request.createdByEmployeeId,
      category: request.category,
      title: request.title,
      body: request.body,
      status: request.status,
      createdAt: isoDateTimeToDate(request.createdAt),
      updatedAt: isoDateTimeToDate(request.updatedAt),
    };
    await this.prisma.improvementRequest.upsert({
      where: { id: request.id },
      create: data,
      update: data,
    });
  }

  /** 全改善リクエストを新しい順で返す。 */
  async list(): Promise<readonly ImprovementRequest[]> {
    const rows = await this.prisma.improvementRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(improvementRequestRowToDomain);
  }
}
