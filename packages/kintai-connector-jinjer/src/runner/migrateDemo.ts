/**
 * jinjer 移行デモの一気通貫オーケストレーションと結果整形（Ph0）。
 *
 * スタブ jinjer transport（従業員マスタの raw DTO を返す）＋インメモリ従業員 sink を組み立て、
 * {@link migrateEmployees}（@dgloss-kintai/jobs）を実際に走らせる。pull は本物同様に zod 検証・
 * {@link mapEmployee} を通過するため、DTO 形が崩れれば検証で落ちる。乱数・現在時刻・ネットワークに
 * 依存しないため出力は決定的（毎回同じ）。
 *
 * 実 jinjer 仕様が判明したら、`transport` を {@link FetchJinjerTransport}（実 HTTP・実 config）へ、
 * `sink` を実 DB リポジトリ（`PrismaEmployeeRepository`）へ差し替えるだけで本番移行に転用できる
 * （この関数の骨格＝seam はそのまま）。
 */

import type { Employee } from "@dgloss-kintai/contracts";
import { migrateEmployees } from "@dgloss-kintai/jobs";
import type { EmployeeSink, MigrationResult } from "@dgloss-kintai/jobs";

import { JinjerConnector } from "../pull.js";
import type { JinjerRequest, JinjerTransport } from "../transport.js";

/**
 * 従業員マスタ（`employees`）に固定レスポンスを返すスタブ transport。
 *
 * 本物のエンベロープ形（`{ code, result }`）で snake_case の raw DTO 配列を包んで返すため、
 * pull 側の zod 検証・マッパーを本番同様に通過する。`employees` 以外のパスは誤配線検出のため拒否する。
 */
export class StubEmployeeTransport implements JinjerTransport {
  readonly #employees: readonly unknown[];

  /**
   * @param employees employees に対して返す jinjer 従業員 DTO（raw・snake_case）の配列
   */
  constructor(employees: readonly unknown[]) {
    this.#employees = employees;
  }

  request(req: JinjerRequest): Promise<unknown> {
    if (req.path !== "employees") {
      return Promise.reject(
        new Error(`スタブ transport は employees のみ対応: ${req.path}`),
      );
    }
    return Promise.resolve({ code: 200, result: this.#employees });
  }
}

/**
 * upsert を記録するインメモリ従業員 sink（デモ用）。
 *
 * 実 DB アダプタ（`PrismaEmployeeRepository`）の代わりに投入結果をメモリに貯める。
 * `failCodes` に含む社員番号（employeeCode）は書き込みを拒否し、「1 件の失敗で止まらない」ことを実証する。
 */
export class InMemoryEmployeeSink implements EmployeeSink {
  readonly upserted: Employee[] = [];
  readonly #failCodes: ReadonlySet<string>;

  /**
   * @param failCodes upsert を失敗させる社員番号の集合（既定は空＝全件成功）
   */
  constructor(failCodes: readonly string[] = []) {
    this.#failCodes = new Set(failCodes);
  }

  upsert(employee: Employee): Promise<void> {
    if (this.#failCodes.has(employee.employeeCode)) {
      return Promise.reject(
        new Error(`DB 制約違反により投入不可: ${employee.employeeCode}`),
      );
    }
    this.upserted.push(employee);
    return Promise.resolve();
  }
}

/**
 * デモ用の jinjer 従業員 raw DTO 配列を決定的に組み立てる（純粋関数）。
 *
 * 賃金計算に効くバリエーション（非管理監督者/管理監督者・固定残業あり/なし・退職者）を備える。
 * `jinjerEmployeeDtoSchema` に適合する snake_case 形。実仕様が判明したら本フィクスチャは差し替え可能。
 */
export function buildMigrationEmployeeDtos(): readonly unknown[] {
  return [
    {
      staff_code: "E001",
      last_name: "山田",
      first_name: "太郎",
      email: "taro.yamada@example.com",
      hire_date: "2020-04-01",
      resignation_date: null,
      employment_type: "1",
      work_system: "1",
      office_division: "1",
      is_managerial: false,
      basic_salary: 300000,
      annual_scheduled_working_hours: 2000,
      fixed_overtime_allowance: 0,
      fixed_overtime_coverage: {
        overtime: false,
        overtime_over60: false,
        holiday: false,
        night: false,
      },
    },
    {
      staff_code: "E002",
      last_name: "佐藤",
      first_name: "花子",
      email: "hanako.sato@example.com",
      hire_date: "2021-10-01",
      resignation_date: null,
      employment_type: "1",
      work_system: "2",
      office_division: "2",
      is_managerial: false,
      basic_salary: 320000,
      annual_scheduled_working_hours: 2000,
      fixed_overtime_allowance: 30000,
      fixed_overtime_coverage: {
        overtime: true,
        overtime_over60: false,
        holiday: false,
        night: false,
      },
    },
    {
      staff_code: "E003",
      last_name: "鈴木",
      first_name: "一郎",
      email: null,
      hire_date: "2018-04-01",
      resignation_date: null,
      employment_type: "1",
      work_system: "4",
      office_division: "1",
      is_managerial: true,
      basic_salary: 500000,
      annual_scheduled_working_hours: 2000,
      fixed_overtime_allowance: 0,
      fixed_overtime_coverage: {
        overtime: false,
        overtime_over60: false,
        holiday: false,
        night: false,
      },
    },
    {
      staff_code: "E404",
      last_name: "高橋",
      first_name: "健",
      email: "ken.takahashi@example.com",
      hire_date: "2019-07-01",
      resignation_date: "2025-03-31",
      employment_type: "2",
      work_system: "3",
      office_division: "3",
      is_managerial: false,
      basic_salary: 280000,
      annual_scheduled_working_hours: 2000,
      fixed_overtime_allowance: 0,
      fixed_overtime_coverage: {
        overtime: false,
        overtime_over60: false,
        holiday: false,
        night: false,
      },
    },
  ];
}

/**
 * 移行デモが sink 失敗を実証するために意図的に投入を拒否する社員番号。
 * `E404` は「DB 制約違反で投入不可」の 1 件失敗ケースを表す。
 */
export const DEMO_FAILING_STAFF_CODES: readonly string[] = ["E404"];

/** {@link runMigrationDemo} の結果（集計＋投入済み従業員の可視化）。 */
export interface MigrationDemoResult {
  /** migrateEmployees の集計結果。 */
  readonly result: MigrationResult;
  /** 実際に sink へ投入（upsert）された従業員（デモの可観測性のため）。 */
  readonly upserted: readonly Employee[];
}

/**
 * 移行デモを一気通貫で実行する。
 *
 * 手順:
 *  1. 従業員 raw DTO フィクスチャ＋スタブ transport で {@link JinjerConnector} を組む。
 *  2. インメモリ sink（`E404` は投入拒否）を注入して {@link migrateEmployees} を実行。
 *
 * @returns 集計結果と投入済み従業員
 */
export async function runMigrationDemo(): Promise<MigrationDemoResult> {
  const connector = new JinjerConnector(
    new StubEmployeeTransport(buildMigrationEmployeeDtos()),
  );
  const sink = new InMemoryEmployeeSink(DEMO_FAILING_STAFF_CODES);

  const result = await migrateEmployees({ source: connector, sink });

  return { result, upserted: sink.upserted };
}

/**
 * 移行結果を人間可読なレポート文字列に整形する（副作用なし）。
 *
 * 総件数・成功/失敗件数・失敗明細（社員番号＋理由）・投入済み従業員一覧を含める。
 *
 * @param demo 移行デモの結果
 * @returns 改行区切りのレポート文字列
 */
export function formatMigrationReport(demo: MigrationDemoResult): string {
  const { result, upserted } = demo;
  const lines: string[] = [];
  lines.push("==== jinjer 従業員マスタ移行レポート（Ph0）====");
  lines.push(`総件数            : ${result.total}`);
  lines.push(`成功              : ${result.succeeded}`);
  lines.push(`失敗              : ${result.failed}`);
  lines.push(
    `総合判定          : ${result.failed > 0 ? "一部失敗あり（要確認）" : "全件成功"}`,
  );

  lines.push("");
  lines.push("---- 投入済み従業員 ----");
  for (const e of upserted) {
    lines.push(`- ${e.employeeCode}（${e.name}）: ${e.contract.workSystem}`);
  }

  if (result.failures.length > 0) {
    lines.push("");
    lines.push("---- 失敗明細 ----");
    for (const f of result.failures) {
      lines.push(`- ${f.id}: ${f.error}`);
    }
  }

  return lines.join("\n");
}
