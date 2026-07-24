/**
 * 給与ソフト連携用 CSV エクスポート（web ローカル実装）。
 *
 * 月次締め（MonthlyClosing・賃金規程第6条）を給与計算ソフトへ取り込むための CSV へ写像する
 * 純粋実装。RFC4180 準拠のエスケープ・ヘッダ行・改行・UTF-8 BOM（Excel 対策）を自前で扱う。
 *
 * 本来は @dgloss-kintai/jobs の `buildPayrollCsv` と同一ロジックだが、web パッケージへ jobs を
 * 依存追加（＝インストール）せずにビルドを成立させるため、contracts のみに依存する形で移設した。
 * 列順・整形は jobs 側と一致させ、給与ソフトの取込レイアウトを崩さない。
 */

import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  YearMonth,
} from "@dgloss-kintai/contracts";

/** CSV1行分の給与連携データ。締めと従業員マスタから導出する。 */
export interface PayrollCsvRow {
  readonly employeeCode: string;
  readonly employeeName: string;
  readonly period: string;
  readonly totalWorkedMinutes: number;
  readonly overtimeAllowanceYen: number;
  readonly overtimeOver60AllowanceYen: number;
  readonly holidayAllowanceYen: number;
  readonly nightAllowanceYen: number;
  readonly premiumTotalYen: number;
  readonly fixedOvertimeAdditionalPaymentYen: number;
  readonly latenessDeductionYen: number;
}

/** 列の値種別。シリアライズ時の整形方法を決める。 */
export type PayrollColumnKind = "text" | "time" | "money";

/** 列定義。key（行フィールド）・header（給与ソフト向け見出し）・kind（整形種別）。 */
export interface PayrollCsvColumn {
  readonly key: keyof PayrollCsvRow;
  readonly header: string;
  readonly kind: PayrollColumnKind;
}

/** 出力列の定義（順序固定）。この並びがそのまま CSV の列順・ヘッダ順になる。 */
export const PAYROLL_CSV_COLUMNS: readonly PayrollCsvColumn[] = [
  { key: "employeeCode", header: "社員番号", kind: "text" },
  { key: "employeeName", header: "氏名", kind: "text" },
  { key: "period", header: "対象年月", kind: "text" },
  { key: "totalWorkedMinutes", header: "総労働時間", kind: "time" },
  { key: "overtimeAllowanceYen", header: "時間外勤務手当", kind: "money" },
  {
    key: "overtimeOver60AllowanceYen",
    header: "時間外60h超勤務手当",
    kind: "money",
  },
  { key: "holidayAllowanceYen", header: "休日勤務手当", kind: "money" },
  { key: "nightAllowanceYen", header: "深夜勤務手当", kind: "money" },
  { key: "premiumTotalYen", header: "割増合計", kind: "money" },
  {
    key: "fixedOvertimeAdditionalPaymentYen",
    header: "固定残業差額支給",
    kind: "money",
  },
  { key: "latenessDeductionYen", header: "遅刻早退控除", kind: "money" },
] as const;

/** 改行コード。CRLF（RFC4180 既定）または LF。 */
export type CsvNewline = "crlf" | "lf";

/** 時間列の表現。`hmm`（例 `16:20`）または `minutes`（例 `980`）。 */
export type TimeFormat = "hmm" | "minutes";

/** CSV シリアライズのオプション。 */
export interface PayrollCsvOptions {
  readonly newline?: CsvNewline;
  readonly bom?: boolean;
  readonly timeFormat?: TimeFormat;
}

/** UTF-8 BOM（U+FEFF）。 */
const BOM = "﻿";

/** period（年月）を `YYYY-MM` 文字列に整形する。 */
function formatPeriod(period: YearMonth): string {
  const mm = String(period.month).padStart(2, "0");
  return `${period.year}-${mm}`;
}

/** 分を `h:mm` 表現に整形する（負値は先頭に `-`）。 */
function formatHmm(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

/**
 * MonthlyClosing（＋任意の従業員マスタ）を CSV 1行分に写像する。
 * 従業員が渡されない場合、社員番号は closing.employeeId を、氏名は空文字を用いる。
 */
export function toPayrollCsvRow(
  closing: MonthlyClosing,
  employee?: Employee,
): PayrollCsvRow {
  return {
    employeeCode: employee?.employeeCode ?? String(closing.employeeId),
    employeeName: employee?.name ?? "",
    period: formatPeriod(closing.period),
    totalWorkedMinutes: closing.totalWorkedMinutes,
    overtimeAllowanceYen: closing.premium.overtimeAllowance,
    overtimeOver60AllowanceYen: closing.premium.overtimeOver60Allowance,
    holidayAllowanceYen: closing.premium.holidayAllowance,
    nightAllowanceYen: closing.premium.nightAllowance,
    premiumTotalYen: closing.premium.total,
    fixedOvertimeAdditionalPaymentYen: closing.fixedOvertimeAdditionalPayment,
    latenessDeductionYen: closing.latenessDeduction,
  };
}

/**
 * RFC4180 に従いフィールドをエスケープする。
 * カンマ・ダブルクオート・CR・LF を含む場合、値を `"` で囲み内部の `"` を `""` に二重化する。
 */
function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 1セルを種別に応じて文字列化する（エスケープ前）。 */
function renderCell(
  row: PayrollCsvRow,
  column: PayrollCsvColumn,
  timeFormat: TimeFormat,
): string {
  const value = row[column.key];
  switch (column.kind) {
    case "time": {
      const minutes = value as number;
      return timeFormat === "hmm" ? formatHmm(minutes) : String(minutes);
    }
    case "money":
      return String(value as number);
    case "text":
      return String(value);
  }
}

/**
 * 行データ配列を CSV 文字列に整形する。先頭にヘッダ行を付ける（行が空でもヘッダのみ出力）。
 */
export function serializePayrollCsv(
  rows: readonly PayrollCsvRow[],
  options: PayrollCsvOptions = {},
): string {
  const newline = (options.newline ?? "crlf") === "crlf" ? "\r\n" : "\n";
  const timeFormat = options.timeFormat ?? "hmm";
  const withBom = options.bom ?? false;

  const lines: string[] = [];
  lines.push(PAYROLL_CSV_COLUMNS.map((c) => escapeField(c.header)).join(","));
  for (const row of rows) {
    lines.push(
      PAYROLL_CSV_COLUMNS.map((c) =>
        escapeField(renderCell(row, c, timeFormat)),
      ).join(","),
    );
  }

  const body = lines.join(newline);
  return withBom ? BOM + body : body;
}

/**
 * 締め配列と従業員マスタから一括で CSV を生成する。
 * 従業員は id で突合し、対応する Employee があれば社員番号・氏名を反映する。
 */
export function buildPayrollCsv(
  closings: readonly MonthlyClosing[],
  employees: readonly Employee[],
  options: PayrollCsvOptions = {},
): string {
  const byId = new Map<EmployeeId, Employee>();
  for (const e of employees) {
    byId.set(e.id, e);
  }
  const rows = closings.map((c) => toPayrollCsvRow(c, byId.get(c.employeeId)));
  return serializePayrollCsv(rows, options);
}
