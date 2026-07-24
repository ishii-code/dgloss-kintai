/**
 * 従業員 CSV の列定義・区分ラベル変換・RFC4180 シリアライズ／パース（純粋実装）。
 *
 * - 画面・CSV は日本語ラベル、内部は enum。ここで双方向の変換表を持つ。
 * - import と export は同じ列定義（{@link EMPLOYEE_CSV_HEADERS}）を共有し、往復可能に保つ。
 *   キーは社員番号（employeeCode）で、id 列は持たない（採番は取込側で解決する）。
 * - RFC4180: カンマ・ダブルクオート・改行を含む値は `"` で囲み内部の `"` を二重化する。
 */

import type { Employee } from "@dgloss-kintai/contracts";
import type {
  EmploymentType,
  OfficeDivision,
  WorkSystem,
} from "@dgloss-kintai/contracts";

/** CSV の列見出し（順序固定・この並びが列順になる）。 */
export const EMPLOYEE_CSV_HEADERS = [
  "社員番号",
  "氏名",
  "メール",
  "入社日",
  "退職日",
  "雇用区分",
  "勤務体系",
  "所属",
  "管理監督者",
  "基本給",
  "年間所定労働時間",
  "固定残業手当",
  "充当_時間外",
  "充当_60時間超",
  "充当_休日",
  "充当_深夜",
] as const;

/** 雇用区分 enum → 日本語ラベル。 */
export const EMPLOYMENT_TYPE_LABEL: Readonly<Record<EmploymentType, string>> = {
  regular: "正社員",
  non_regular: "非正規",
};

/** 勤務体系 enum → 日本語ラベル。 */
export const WORK_SYSTEM_LABEL: Readonly<Record<WorkSystem, string>> = {
  fixed: "固定時間制",
  flex: "フレックスタイム制",
  shift: "シフト制",
  discretionary: "裁量労働制",
};

/** 所属区分 enum → 日本語ラベル。 */
export const OFFICE_LABEL: Readonly<Record<OfficeDivision, string>> = {
  headquarters: "本社",
  corporate_sales: "法人営業",
  personal_sales: "個人営業",
};

/** 真偽 → 日本語ラベル。 */
export const BOOL_LABEL: Readonly<Record<"true" | "false", string>> = {
  true: "はい",
  false: "いいえ",
};

/** 日本語ラベル → enum の逆引き表を作る。 */
function reverse<K extends string>(
  map: Readonly<Record<K, string>>,
): Readonly<Record<string, K>> {
  const acc: Record<string, K> = {};
  for (const key of Object.keys(map) as K[]) {
    acc[map[key]] = key;
  }
  return acc;
}

/** 日本語ラベル → 雇用区分 enum。 */
export const EMPLOYMENT_TYPE_BY_LABEL = reverse(EMPLOYMENT_TYPE_LABEL);
/** 日本語ラベル → 勤務体系 enum。 */
export const WORK_SYSTEM_BY_LABEL = reverse(WORK_SYSTEM_LABEL);
/** 日本語ラベル → 所属区分 enum。 */
export const OFFICE_BY_LABEL = reverse(OFFICE_LABEL);
/** 日本語ラベル → 真偽（「はい」以外は false）。 */
export const BOOL_BY_LABEL: Readonly<Record<string, boolean>> = {
  はい: true,
  いいえ: false,
};

// ---- シリアライズ（export） ----------------------------------------------

/** RFC4180 に従いフィールドをエスケープする。 */
function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 従業員1件を CSV の1行分（列順の文字列配列）へ写す。 */
export function employeeToCsvFields(employee: Employee): readonly string[] {
  const c = employee.contract;
  return [
    employee.employeeCode,
    employee.name,
    employee.email ?? "",
    employee.hiredOn,
    employee.retiredOn ?? "",
    EMPLOYMENT_TYPE_LABEL[c.employmentType],
    WORK_SYSTEM_LABEL[c.workSystem],
    OFFICE_LABEL[c.office],
    BOOL_LABEL[c.isManagerialEmployee ? "true" : "false"],
    String(c.basicSalary),
    String(c.annualScheduledWorkingHours),
    String(c.fixedOvertimeAllowance),
    BOOL_LABEL[c.fixedOvertimeCoverage.overtime ? "true" : "false"],
    BOOL_LABEL[c.fixedOvertimeCoverage.overtimeOver60 ? "true" : "false"],
    BOOL_LABEL[c.fixedOvertimeCoverage.holiday ? "true" : "false"],
    BOOL_LABEL[c.fixedOvertimeCoverage.night ? "true" : "false"],
  ];
}

/**
 * 従業員配列を CSV 文字列へ写す（先頭にヘッダ行・改行は CRLF）。
 * 行が空でもヘッダ行のみ出力する。
 */
export function serializeEmployeesCsv(
  employees: readonly Employee[],
): string {
  const lines: string[] = [];
  lines.push(EMPLOYEE_CSV_HEADERS.map(escapeField).join(","));
  for (const e of employees) {
    lines.push(employeeToCsvFields(e).map(escapeField).join(","));
  }
  return lines.join("\r\n");
}

// ---- パース（import） -----------------------------------------------------

/**
 * RFC4180 準拠の CSV パーサ（BOM 除去・CRLF/LF 対応・引用フィールド内の改行/カンマ対応）。
 * 返り値は行（レコード）ごとのフィールド配列。空文字入力は空配列。
 */
export function parseCsv(text: string): readonly (readonly string[])[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (src === "") {
    return [];
  }
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i] ?? "";
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // CRLF / 単独 CR いずれも改行として扱う。
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // 末尾フィールド／行を確定（末尾改行が無い場合）。
  row.push(field);
  rows.push(row);
  // 完全な空行（フィールド1つで空文字のみ）は落とす。
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** ヘッダ行が期待どおりか検証する。不一致なら不足・相違を説明するメッセージを返す。 */
export function validateCsvHeader(header: readonly string[]): string | null {
  const expected = EMPLOYEE_CSV_HEADERS;
  if (header.length !== expected.length) {
    return `列数が一致しません（期待 ${expected.length} 列・実際 ${header.length} 列）`;
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (header[i]?.trim() !== expected[i]) {
      return `${i + 1} 列目の見出しが不正です（期待「${expected[i]}」・実際「${header[i] ?? ""}」）`;
    }
  }
  return null;
}

/** CSV の1データ行（フィールド配列）を employeeInput 相当の生オブジェクトへ写す。 */
export function csvFieldsToRawInput(fields: readonly string[]): unknown {
  const at = (i: number): string => (fields[i] ?? "").trim();
  const emptyToUndef = (v: string): string | undefined =>
    v === "" ? undefined : v;
  return {
    employeeCode: at(0),
    name: at(1),
    email: emptyToUndef(at(2)),
    hiredOn: at(3),
    retiredOn: emptyToUndef(at(4)),
    contract: {
      // 未知ラベルは生値のまま渡し、zod の enum 検証でエラーにする。
      employmentType: EMPLOYMENT_TYPE_BY_LABEL[at(5)] ?? at(5),
      workSystem: WORK_SYSTEM_BY_LABEL[at(6)] ?? at(6),
      office: OFFICE_BY_LABEL[at(7)] ?? at(7),
      isManagerialEmployee: BOOL_BY_LABEL[at(8)] ?? false,
      basicSalary: Number(at(9)),
      annualScheduledWorkingHours: Number(at(10)),
      fixedOvertimeAllowance: Number(at(11)),
      fixedOvertimeCoverage: {
        overtime: BOOL_BY_LABEL[at(12)] ?? false,
        overtimeOver60: BOOL_BY_LABEL[at(13)] ?? false,
        holiday: BOOL_BY_LABEL[at(14)] ?? false,
        night: BOOL_BY_LABEL[at(15)] ?? false,
      },
    },
  };
}
