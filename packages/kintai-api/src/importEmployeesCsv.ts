/**
 * ユースケース: 従業員 CSV の一括取込。
 *
 * CSV テキストをパースし、行ごとに zod 検証して upsert する。キーは社員番号（employeeCode）で、
 * 既存があれば id を引き継いで更新、無ければ id を採番して作成する（往復可能・冪等）。
 * 1 行の失敗で全体を止めず、成功／失敗件数と行番号付きのエラー明細を返す。
 * ヘッダ行が期待と異なる場合のみ全体を validation_error にする。
 */

import type { Employee, EmployeeId } from "@dgloss-kintai/contracts";
import {
  csvFieldsToRawInput,
  parseCsv,
  validateCsvHeader,
} from "./employeeCsv.js";
import {
  contractFromParsed,
  employeeInputSchema,
} from "./employeeInput.js";
import type { EmployeeRepository, IdGenerator } from "./ports.js";
import { err, ok, validationError, type Result } from "./result.js";

/** 取込エラー1件（行番号付き）。 */
export interface ImportRowError {
  /** CSV 上の行番号（ヘッダを1行目とし、最初のデータ行は2）。 */
  readonly row: number;
  /** 人間可読なエラーメッセージ。 */
  readonly message: string;
}

/** 取込結果。 */
export interface ImportResult {
  /** 処理したデータ行数。 */
  readonly total: number;
  /** 取込に成功した行数。 */
  readonly succeeded: number;
  /** 取込に失敗した行数。 */
  readonly failed: number;
  /** 行番号付きのエラー明細。 */
  readonly errors: readonly ImportRowError[];
}

/** importEmployeesCsv の依存。 */
export interface ImportEmployeesCsvDeps {
  readonly employees: EmployeeRepository;
  readonly ids: IdGenerator;
}

/**
 * CSV テキストから従業員を一括取込する。
 *
 * @param csvText 取込対象の CSV 文字列（ヘッダ行必須・UTF-8）
 * @param deps    リポジトリ・採番 port
 * @returns 取込結果（ヘッダ不正時のみ ApiError）
 */
export async function importEmployeesCsv(
  csvText: string,
  deps: ImportEmployeesCsvDeps,
): Promise<Result<ImportResult>> {
  const records = parseCsv(csvText);
  if (records.length === 0) {
    return err(validationError2("CSV が空です。ヘッダ行が必要です"));
  }

  const header = records[0] ?? [];
  const headerError = validateCsvHeader(header);
  if (headerError !== null) {
    return err(validationError2(`CSV ヘッダが不正です: ${headerError}`));
  }

  // 既存従業員を社員番号で引けるようにする（id 引き継ぎ用）。
  const existing = await deps.employees.list();
  const idByCode = new Map<string, EmployeeId>();
  for (const e of existing) {
    idByCode.set(e.employeeCode, e.id);
  }

  const dataRows = records.slice(1);
  const errors: ImportRowError[] = [];
  let succeeded = 0;

  for (let i = 0; i < dataRows.length; i += 1) {
    const rowNumber = i + 2; // ヘッダ=1行目、最初のデータ行=2。
    const fields = dataRows[i] ?? [];
    const raw = csvFieldsToRawInput(fields);
    const parsed = employeeInputSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const path = first?.path.join(".") ?? "";
      const message =
        first === undefined
          ? "入力値が不正です"
          : `${path === "" ? "" : `${path}: `}${first.message}`;
      errors.push({ row: rowNumber, message });
      continue;
    }

    const code = parsed.data.employeeCode;
    // 同一 CSV 内での社員番号重複は後勝ち（upsert）で許容しつつ id は初回採番を維持する。
    const id = idByCode.get(code) ?? deps.ids.employeeId();
    idByCode.set(code, id);

    const employee: Employee = {
      id,
      employeeCode: code,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      hiredOn: parsed.data.hiredOn,
      retiredOn: parsed.data.retiredOn ?? null,
      contract: contractFromParsed(parsed.data.contract),
    };
    await deps.employees.upsert(employee);
    succeeded += 1;
  }

  return ok({
    total: dataRows.length,
    succeeded,
    failed: errors.length,
    errors,
  });
}

/** メッセージのみの validation_error を作る（zod 由来でない全体エラー用）。 */
function validationError2(message: string): {
  readonly code: "validation_error";
  readonly message: string;
} {
  return { code: "validation_error", message };
}
