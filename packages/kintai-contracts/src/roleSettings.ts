/**
 * ロール設定（管理者の指定）。
 *
 * 会社全体で 1 レコードのシングルトン。管理者とみなす社員番号の一覧を持つ。
 * これまで管理者は環境変数（KINTAI_ADMIN_EMPLOYEE_CODES）でのみ指定していたが、
 * 本設定を保存すると DB の指定が優先される（画面から管理者を追加・変更できる）。
 *
 * 安全策: 少なくとも 1 名の管理者を必須とし（スキーマで min 1）、全員を管理者から
 * 外して誰も設定を変更できなくなる事態を防ぐ。DB 未設定時は環境変数・既定へフォールバックする。
 */

import { z } from "zod";
import type { IsoDateTime } from "./common.js";

/** ロール設定（シングルトン）。 */
export interface RoleSettings {
  /** 管理者とみなす社員番号の一覧（最低1名）。 */
  readonly adminEmployeeCodes: readonly string[];
  /** 最終更新時刻。 */
  readonly updatedAt: IsoDateTime;
}

/** ロール設定の更新入力（updatedAt 確定前）。 */
export interface RoleSettingsInput {
  readonly adminEmployeeCodes: readonly string[];
}

/**
 * 更新入力の zod スキーマ。
 * - 最低1名の管理者を必須とする（全員解除で締め出しになるのを防ぐ）。
 * - 重複は許容（呼び出し側／リポジトリで一意化してよい）。
 */
export const roleSettingsInputSchema = z.object({
  adminEmployeeCodes: z
    .array(z.string().min(1).max(50))
    .min(1, "管理者は少なくとも1名必要です")
    .max(500),
});

export type RoleSettingsInputParsed = z.infer<typeof roleSettingsInputSchema>;
