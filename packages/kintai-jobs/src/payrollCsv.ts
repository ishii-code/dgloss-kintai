/**
 * 給与ソフト連携用 CSV エクスポート。
 *
 * 月次締め（MonthlyClosing・賃金規程第6条）を給与計算ソフトへ取り込むための
 * CSV に写像する純粋実装。外部 CSV ライブラリは使わず、RFC4180 準拠のエスケープ・
 * ヘッダ行・CRLF/LF・UTF-8 BOM（Excel 対策）を自前で扱う。
 *
 * 金額は整数円（Yen）をそのまま出力し、時間は「分」または `h:mm` 表現を選べる。
 * 列順は PAYROLL_CSV_COLUMNS で固定し、給与ソフト側の取込レイアウトと一致させる。
 */

import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  YearMonth,
} from "@dgloss-kintai/contracts";

/** CSV1行分の給与連携データ。締めと従業員マスタから導出する。 */
export interface PayrollCsvRow {
  /** 社員番号（jinjer 連携キー・給与ソフト取込キー）。 */
  readonly employeeCode: string;
  /** 氏名（カンマ・クオート・改行を含みうる＝要エスケープ）。 */
  readonly employeeName: string;
  /** 対象年月（`YYYY-MM`）。 */
  readonly period: string;
  /** 総労働時間（分・非負整数）。 */
  readonly totalWorkedMinutes: number;
  /** 時間外勤務手当（円・整数）。 */
  readonly overtimeAllowanceYen: number;
  /** 時間外60h超勤務手当（円・整数）。 */
  readonly overtimeOver60AllowanceYen: number;
  /** 休日勤務手当（円・整数）。 */
  readonly holidayAllowanceYen: number;
  /** 深夜勤務手当（円・整数）。 */
  readonly nightAllowanceYen: number;
  /** 割増合計（円・整数）。 */
  readonly premiumTotalYen: number;
  /** 固定時間外勤務手当との差額支給（円・整数・第20条4項）。 */
  readonly fixedOvertimeAdditionalPaymentYen: number;
  /** 遅刻早退等の控除額（円・整数・第21条）。 */
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

/**
 * 出力列の定義（順序固定）。この配列の並びがそのまま CSV の列順・ヘッダ順になる。
 * 給与ソフト側の取込レイアウトと一致させるため、順序を変更してはならない。
 */
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
  /** 改行コード（既定 `crlf`）。 */
  readonly newline?: CsvNewline;
  /** UTF-8 BOM を先頭に付与するか（Excel 対策・既定 false）。 */
  readonly bom?: boolean;
  /** 時間列の表現（既定 `hmm`）。 */
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
 * カンマ・ダブルクオート・CR・LF のいずれかを含む場合、値を `"` で囲み、
 * 内部の `"` を `""` に二重化する。それ以外はそのまま返す。
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
 * エスケープは RFC4180 準拠、改行・BOM・時間表現は options で制御する。
 */
export function serializePayrollCsv(
  rows: readonly PayrollCsvRow[],
  options: PayrollCsvOptions = {},
): string {
  const newline = (options.newline ?? "crlf") === "crlf" ? "\r\n" : "\n";
  const timeFormat = options.timeFormat ?? "hmm";
  const withBom = options.bom ?? false;

  const lines: string[] = [];

  // ヘッダ行（列定義の順序どおり）。見出しもエスケープ対象。
  lines.push(
    PAYROLL_CSV_COLUMNS.map((c) => escapeField(c.header)).join(","),
  );

  // データ行。
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
