/**
 * ユースケース: 改善リクエストの起票。
 *
 * 入力を improvementRequestInputSchema で検証し、起票者の存在を確認して保存する。
 */

import { improvementRequestInputSchema } from "@dgloss-kintai/contracts";
import type {
  EmployeeId,
  ImprovementRequest,
  ImprovementRequestCategory,
} from "@dgloss-kintai/contracts";
import type {
  Clock,
  EmployeeRepository,
  IdGenerator,
  ImprovementRequestRepository,
} from "./ports.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** createImprovementRequest の依存。 */
export interface CreateImprovementRequestDeps {
  readonly improvements: ImprovementRequestRepository;
  readonly employees: EmployeeRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * 改善リクエストを起票する。
 *
 * @param input 起票入力（未検証の unknown）
 * @param deps  リポジトリ・採番・時刻 port
 */
export async function createImprovementRequest(
  input: unknown,
  deps: CreateImprovementRequestDeps,
): Promise<Result<ImprovementRequest>> {
  const parsed = improvementRequestInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "改善リクエストの入力が不正です"));
  }

  const employeeId = parsed.data.createdByEmployeeId as EmployeeId;
  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(
      notFoundError(
        `従業員が見つかりません: ${parsed.data.createdByEmployeeId}`,
      ),
    );
  }

  const now = deps.clock.now();
  const request: ImprovementRequest = {
    id: deps.ids.improvementRequestId(),
    createdByEmployeeId: employeeId,
    category: parsed.data.category as ImprovementRequestCategory,
    title: parsed.data.title,
    body: parsed.data.body,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  await deps.improvements.save(request);
  return ok(request);
}
