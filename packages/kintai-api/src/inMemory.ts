/**
 * port の in-memory 参照実装。
 *
 * テストで注入するための実装であり、raw SQL や外部 I/O を持たない。
 * 本番の DB 実装は別レイヤーで同じ interface を満たす形で用意する。
 */

import type {
  ApprovalRequest,
  ApprovalRequestId,
  CompanySettings,
  Employee,
  EmployeeId,
  ImprovementRequest,
  ImprovementRequestId,
  IsoDate,
  IsoDateTime,
  MonthlyClosing,
  RoleSettings,
  ShadowComparison,
  Stamp,
  StampId,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";
import type {
  ApprovalRequestRepository,
  Clock,
  CompanySettingsRepository,
  EmployeeRepository,
  IdGenerator,
  ImprovementRequestRepository,
  MonthlyClosingRepository,
  RoleSettingsRepository,
  ShadowComparisonRepository,
  StampRepository,
  WorkDayRepository,
} from "./ports.js";

/** 年月キー（`YYYY-MM`）を作る。 */
function periodKey(period: YearMonth): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

/** 打刻の in-memory リポジトリ。 */
export class InMemoryStampRepository implements StampRepository {
  private readonly items: Stamp[] = [];

  constructor(seed: readonly Stamp[] = []) {
    this.items.push(...seed);
  }

  async save(stamp: Stamp): Promise<void> {
    this.items.push(stamp);
  }

  async listByEmployeeAndRange(
    employeeId: EmployeeId,
    from: IsoDateTime,
    to: IsoDateTime,
  ): Promise<readonly Stamp[]> {
    return this.items
      .filter(
        (s) =>
          s.employeeId === employeeId &&
          s.stampedAt >= from &&
          s.stampedAt <= to,
      )
      .sort((a, b) => (a.stampedAt < b.stampedAt ? -1 : 1));
  }

  /** テスト用: 現在保持している全打刻。 */
  all(): readonly Stamp[] {
    return [...this.items];
  }
}

/** 日次勤怠の in-memory リポジトリ。 */
export class InMemoryWorkDayRepository implements WorkDayRepository {
  private readonly items: WorkDay[] = [];

  constructor(seed: readonly WorkDay[] = []) {
    this.items.push(...seed);
  }

  async listByEmployeeAndDateRange(
    employeeId: EmployeeId,
    from: IsoDate,
    to: IsoDate,
  ): Promise<readonly WorkDay[]> {
    return this.items
      .filter(
        (w) => w.employeeId === employeeId && w.date >= from && w.date <= to,
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
}

/** 月次締めの in-memory リポジトリ。 */
export class InMemoryMonthlyClosingRepository
  implements MonthlyClosingRepository
{
  private readonly items = new Map<string, MonthlyClosing>();

  constructor(seed: readonly MonthlyClosing[] = []) {
    for (const c of seed) {
      this.items.set(`${c.employeeId}|${periodKey(c.period)}`, c);
    }
  }

  async findByEmployeeAndPeriod(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<MonthlyClosing | null> {
    return this.items.get(`${employeeId}|${periodKey(period)}`) ?? null;
  }
}

/** 従業員マスタの in-memory リポジトリ。 */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly items = new Map<EmployeeId, Employee>();

  constructor(seed: readonly Employee[] = []) {
    for (const e of seed) {
      this.items.set(e.id, e);
    }
  }

  async findById(employeeId: EmployeeId): Promise<Employee | null> {
    return this.items.get(employeeId) ?? null;
  }

  async list(): Promise<readonly Employee[]> {
    return [...this.items.values()].sort((a, b) =>
      a.employeeCode < b.employeeCode ? -1 : a.employeeCode > b.employeeCode ? 1 : 0,
    );
  }

  async upsert(employee: Employee): Promise<void> {
    this.items.set(employee.id, employee);
  }
}

/** Shadow 突合結果の in-memory リポジトリ。 */
export class InMemoryShadowComparisonRepository
  implements ShadowComparisonRepository
{
  private readonly items = new Map<string, ShadowComparison>();

  constructor(seed: readonly ShadowComparison[] = []) {
    for (const c of seed) {
      this.items.set(`${c.employeeId}|${periodKey(c.period)}`, c);
    }
  }

  async findByEmployeeAndPeriod(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<ShadowComparison | null> {
    return this.items.get(`${employeeId}|${periodKey(period)}`) ?? null;
  }
}

/** 決定的な連番 ID 採番。テスト用。 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = "stamp") {}

  stampId(): StampId {
    this.counter += 1;
    return `${this.prefix}-${this.counter}` as StampId;
  }

  improvementRequestId(): ImprovementRequestId {
    this.counter += 1;
    return `${this.prefix}-req-${this.counter}` as ImprovementRequestId;
  }

  employeeId(): EmployeeId {
    this.counter += 1;
    return `${this.prefix}-emp-${this.counter}` as EmployeeId;
  }

  approvalRequestId(): ApprovalRequestId {
    this.counter += 1;
    return `${this.prefix}-apr-${this.counter}` as ApprovalRequestId;
  }
}

/** 改善リクエストの in-memory リポジトリ。 */
export class InMemoryImprovementRequestRepository
  implements ImprovementRequestRepository
{
  private readonly items: ImprovementRequest[] = [];

  constructor(seed: readonly ImprovementRequest[] = []) {
    this.items.push(...seed);
  }

  async save(request: ImprovementRequest): Promise<void> {
    const idx = this.items.findIndex((r) => r.id === request.id);
    if (idx >= 0) {
      this.items[idx] = request;
    } else {
      this.items.push(request);
    }
  }

  async list(): Promise<readonly ImprovementRequest[]> {
    return [...this.items].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );
  }
}

/** 承認申請（ワークフロー）の in-memory リポジトリ。 */
export class InMemoryApprovalRequestRepository
  implements ApprovalRequestRepository
{
  private readonly items: ApprovalRequest[] = [];

  constructor(seed: readonly ApprovalRequest[] = []) {
    this.items.push(...seed);
  }

  async save(request: ApprovalRequest): Promise<void> {
    const idx = this.items.findIndex((r) => r.id === request.id);
    if (idx >= 0) {
      this.items[idx] = request;
    } else {
      this.items.push(request);
    }
  }

  async findById(id: ApprovalRequestId): Promise<ApprovalRequest | null> {
    return this.items.find((r) => r.id === id) ?? null;
  }

  async list(): Promise<readonly ApprovalRequest[]> {
    return [...this.items].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );
  }
}

/** 企業設定（シングルトン）の in-memory リポジトリ。 */
export class InMemoryCompanySettingsRepository
  implements CompanySettingsRepository
{
  private current: CompanySettings | null;

  constructor(seed: CompanySettings | null = null) {
    this.current = seed;
  }

  async get(): Promise<CompanySettings | null> {
    return this.current;
  }

  async save(settings: CompanySettings): Promise<void> {
    this.current = settings;
  }
}

/** ロール設定（シングルトン）の in-memory リポジトリ。 */
export class InMemoryRoleSettingsRepository
  implements RoleSettingsRepository
{
  private current: RoleSettings | null;

  constructor(seed: RoleSettings | null = null) {
    this.current = seed;
  }

  async get(): Promise<RoleSettings | null> {
    return this.current;
  }

  async save(settings: RoleSettings): Promise<void> {
    this.current = settings;
  }
}

/** 固定時刻を返す Clock。テスト用。 */
export class FixedClock implements Clock {
  constructor(private readonly fixed: IsoDateTime) {}

  now(): IsoDateTime {
    return this.fixed;
  }
}
