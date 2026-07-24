/**
 * 改善リクエスト。利用者が機能改善・不具合を報告し、対応状況を管理する。
 * 経営 AI OS の「改善リクエスト」タブに相当する。
 */

import { z } from "zod";
import type {
  EmployeeId,
  ImprovementRequestId,
  IsoDateTime,
} from "./common.js";

/** 改善リクエストの対応ステータス。 */
export type ImprovementRequestStatus =
  | "open" // 受付
  | "planned" // 対応予定
  | "in_progress" // 対応中
  | "done" // 完了
  | "rejected"; // 見送り

export const IMPROVEMENT_REQUEST_STATUSES: readonly ImprovementRequestStatus[] =
  ["open", "planned", "in_progress", "done", "rejected"] as const;

/** 改善リクエストの種別。 */
export type ImprovementRequestCategory =
  | "feature" // 機能要望
  | "bug" // 不具合
  | "other";

export const IMPROVEMENT_REQUEST_CATEGORIES: readonly ImprovementRequestCategory[] =
  ["feature", "bug", "other"] as const;

/** 改善リクエスト。 */
export interface ImprovementRequest {
  readonly id: ImprovementRequestId;
  /** 起票者（ログイン中の従業員）。 */
  readonly createdByEmployeeId: EmployeeId;
  readonly category: ImprovementRequestCategory;
  readonly title: string;
  readonly body: string;
  readonly status: ImprovementRequestStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/** 改善リクエストの起票入力（ID・日時・ステータス確定前）。 */
export interface ImprovementRequestInput {
  readonly createdByEmployeeId: EmployeeId;
  readonly category: ImprovementRequestCategory;
  readonly title: string;
  readonly body: string;
}

/** 起票入力の zod スキーマ。 */
export const improvementRequestInputSchema = z.object({
  createdByEmployeeId: z.string().min(1),
  category: z.enum(
    IMPROVEMENT_REQUEST_CATEGORIES as [string, ...string[]],
  ),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export type ImprovementRequestInputParsed = z.infer<
  typeof improvementRequestInputSchema
>;
