/**
 * port の in-memory 参照実装。
 *
 * テストで注入するための実装であり、raw SQL や外部 I/O を持たない。
 * 本番の DB 実装は別レイヤーで同じ interface を満たす形で用意する。
 */

import type {
  Employee,
  EmployeeId,
  IsoDate,
  IsoDateTime,
  MonthlyClosing,
  ShadowComparison,
  Stamp,
  StampId,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";
import type {
  Clock,
  EmployeeRepository,
  IdGenerator,
  MonthlyClosingRepository,
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
}

/** 固定時刻を返す Clock。テスト用。 */
export class FixedClock implements Clock {
  constructor(private readonly fixed: IsoDateTime) {}

  now(): IsoDateTime {
    return this.fixed;
  }
}
