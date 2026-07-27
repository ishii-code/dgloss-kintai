/**
 * 承認ワークフロー（申請・承認・却下・取消）のユースケーステスト。
 * in-memory リポジトリで一連の状態遷移と認可・競合の分岐を検証する。
 */

import { describe, expect, it } from "vitest";
import type { Employee, EmployeeId, Yen } from "@dgloss-kintai/contracts";
import { createApprovalRequest } from "./createApprovalRequest.js";
import { listApprovalRequests } from "./listApprovalRequests.js";
import { decideApprovalRequest } from "./decideApprovalRequest.js";
import { cancelApprovalRequest } from "./cancelApprovalRequest.js";
import {
  FixedClock,
  InMemoryApprovalRequestRepository,
  InMemoryEmployeeRepository,
  SequentialIdGenerator,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

function employee(id: string, code: string): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: code,
    name: `従業員 ${code}`,
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: asYen(300_000),
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: asYen(0),
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
}

function deps() {
  return {
    approvals: new InMemoryApprovalRequestRepository(),
    employees: new InMemoryEmployeeRepository([
      employee("emp_applicant", "0002"),
      employee("emp_admin", "0001"),
    ]),
    ids: new SequentialIdGenerator("wf"),
    clock: new FixedClock("2026-07-27T10:00:00+09:00" as never),
  };
}

const validInput = {
  applicantEmployeeId: "emp_applicant",
  type: "overtime" as const,
  targetDate: "2026-07-28",
  subject: "月末対応の残業",
  detail: "締め処理のため 2 時間の残業を申請します。",
};

describe("createApprovalRequest", () => {
  it("申請を pending で起票する", async () => {
    const d = deps();
    const result = await createApprovalRequest(validInput, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("pending");
    expect(result.value.type).toBe("overtime");
    expect(result.value.targetDate).toBe("2026-07-28");
    expect(result.value.decidedByEmployeeId).toBeNull();
  });

  it("targetDate 未指定は null になる", async () => {
    const d = deps();
    const { targetDate: _omit, ...noDate } = validInput;
    const result = await createApprovalRequest(noDate, d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targetDate).toBeNull();
  });

  it("申請者が存在しなければ not_found", async () => {
    const d = deps();
    const result = await createApprovalRequest(
      { ...validInput, applicantEmployeeId: "emp_missing" },
      d,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("不正入力は validation エラー", async () => {
    const d = deps();
    const result = await createApprovalRequest({ type: "overtime" }, d);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});

describe("decideApprovalRequest", () => {
  it("管理者が承認すると approved になり決裁情報が入る", async () => {
    const d = deps();
    const created = await createApprovalRequest(validInput, d);
    if (!created.ok) throw new Error("setup failed");

    const result = await decideApprovalRequest(
      {
        requestId: created.value.id,
        deciderEmployeeId: "emp_admin",
        decision: "approve",
        comment: "承認します",
      },
      d,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("approved");
    expect(result.value.decidedByEmployeeId).toBe("emp_admin");
    expect(result.value.decidedAt).not.toBeNull();
    expect(result.value.decisionComment).toBe("承認します");
  });

  it("却下すると rejected になる", async () => {
    const d = deps();
    const created = await createApprovalRequest(validInput, d);
    if (!created.ok) throw new Error("setup failed");

    const result = await decideApprovalRequest(
      {
        requestId: created.value.id,
        deciderEmployeeId: "emp_admin",
        decision: "reject",
      },
      d,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("rejected");
    expect(result.value.decisionComment).toBeNull();
  });

  it("自分の申請は決裁できない（conflict）", async () => {
    const d = deps();
    const created = await createApprovalRequest(validInput, d);
    if (!created.ok) throw new Error("setup failed");

    const result = await decideApprovalRequest(
      {
        requestId: created.value.id,
        deciderEmployeeId: "emp_applicant",
        decision: "approve",
      },
      d,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("conflict");
  });

  it("決裁済みは再決裁できない（conflict）", async () => {
    const d = deps();
    const created = await createApprovalRequest(validInput, d);
    if (!created.ok) throw new Error("setup failed");
    const decideInput = {
      requestId: created.value.id,
      deciderEmployeeId: "emp_admin",
      decision: "approve" as const,
    };
    await decideApprovalRequest(decideInput, d);
    const again = await decideApprovalRequest(decideInput, d);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe("conflict");
  });

  it("存在しない申請は not_found", async () => {
    const d = deps();
    const result = await decideApprovalRequest(
      {
        requestId: "wf-missing",
        deciderEmployeeId: "emp_admin",
        decision: "approve",
      },
      d,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });
});

describe("cancelApprovalRequest", () => {
  it("申請者本人が pending を取り消せる", async () => {
    const d = deps();
    const created = await createApprovalRequest(validInput, d);
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelApprovalRequest(
      { requestId: created.value.id, applicantEmployeeId: "emp_applicant" },
      d,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("cancelled");
  });

  it("本人以外は取り消せない（conflict）", async () => {
    const d = deps();
    const created = await createApprovalRequest(validInput, d);
    if (!created.ok) throw new Error("setup failed");

    const result = await cancelApprovalRequest(
      { requestId: created.value.id, applicantEmployeeId: "emp_admin" },
      d,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("conflict");
  });

  it("決裁済みは取り消せない（conflict）", async () => {
    const d = deps();
    const created = await createApprovalRequest(validInput, d);
    if (!created.ok) throw new Error("setup failed");
    await decideApprovalRequest(
      {
        requestId: created.value.id,
        deciderEmployeeId: "emp_admin",
        decision: "approve",
      },
      d,
    );
    const result = await cancelApprovalRequest(
      { requestId: created.value.id, applicantEmployeeId: "emp_applicant" },
      d,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("conflict");
  });
});

describe("listApprovalRequests", () => {
  it("新しい順で全件返す", async () => {
    const d = deps();
    await createApprovalRequest(validInput, d);
    await createApprovalRequest(
      { ...validInput, type: "leave", subject: "有給申請" },
      d,
    );
    const result = await listApprovalRequests(d);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });
});
