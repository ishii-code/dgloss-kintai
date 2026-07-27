/**
 * jinjer 人事APIから従業員名簿を取得し、本システムの取込用CSV（16列）に書き出す。
 *
 * jinjer API（/v1/employees）で取れるのは名簿（社員番号=id・氏名・メール・入社日・退職日・
 * 雇用区分）のみ。給与・勤務体系・所属・管理監督者等はjinjer APIに無いため、CSVでは
 * 既定値を入れておき、あとでExcelで埋めて /import（ブラウザ）で取り込む運用にする。
 *
 * 実行（jinjerの4つの環境変数をセット済みで）:
 *   node packages/kintai-connector-jinjer/scripts/export-jinjer-employees-csv.mjs
 *   → カレントに jinjer-employees.csv を出力（UTF-8 BOM付き・Excelでそのまま開ける）
 */

import { writeFileSync } from "node:fs";

const BASE = (process.env.JINJER_BASE_URL || "https://api.jinjer.biz").replace(/\/+$/, "");
const API_KEY = process.env.JINJER_API_KEY || "";
const SECRET_KEY = process.env.JINJER_SECRET_KEY || "";
const COMPANY = process.env.JINJER_COMPANY_CODE || "";
const OUT = process.env.JINJER_CSV_OUT || "jinjer-employees.csv";

if (!API_KEY || !SECRET_KEY) {
  console.error("JINJER_API_KEY / JINJER_SECRET_KEY が未設定です。");
  process.exit(2);
}

const HEADERS = [
  "社員番号", "氏名", "メール", "入社日", "退職日", "雇用区分", "勤務体系", "所属",
  "管理監督者", "基本給", "年間所定労働時間", "固定残業手当",
  "充当_時間外", "充当_60時間超", "充当_休日", "充当_深夜",
];

/** RFC4180 エスケープ。 */
function esc(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 日付文字列を YYYY-MM-DD に整える（空はそのまま空）。 */
function ymd(v) {
  const s = String(v ?? "").trim();
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** jinjer の雇用区分名 → 本システムの「正社員/非正規」。 */
function empType(name) {
  const s = String(name ?? "");
  return s.includes("正社員") ? "正社員" : "非正規";
}

async function getToken() {
  const res = await fetch(`${BASE}/v2/token`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": API_KEY,
      "X-SECRET-KEY": SECRET_KEY,
    },
  });
  if (!res.ok) throw new Error(`トークン取得 ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const t = j?.data?.access_token ?? j?.access_token;
  if (!t) throw new Error("access_token が取得できませんでした");
  return t;
}

async function fetchEmployees(token) {
  const res = await fetch(`${BASE}/v1/employees`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-API-KEY": API_KEY,
      ...(COMPANY ? { "Company-Code": COMPANY } : {}),
    },
  });
  if (!res.ok) throw new Error(`従業員取得 ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return Array.isArray(j?.data) ? j.data : [];
}

/** 従業員1件 → CSV行（16列）。名簿はjinjer由来、賃金・勤務条件は既定値。 */
function toRow(e) {
  const c = e.company ?? {};
  const p = e.personal ?? {};
  const last = c.last_name || p.last_name || "";
  const first = c.first_name || p.first_name || "";
  const name = `${last} ${first}`.trim();
  return [
    e.id ?? "",                                   // 社員番号
    name,                                          // 氏名
    c.email || p.email || "",                      // メール
    ymd(c.joined_on),                              // 入社日
    ymd(c.retirement_date),                        // 退職日
    empType(c.employment_classification?.name),    // 雇用区分（jinjer由来）
    "固定時間制",                                   // 勤務体系（既定・要確認）
    "本社",                                         // 所属（既定・要確認）
    "いいえ",                                       // 管理監督者（既定）
    "0",                                            // 基本給（要入力）
    "1900",                                         // 年間所定労働時間（既定）
    "0",                                            // 固定残業手当（要入力）
    "いいえ", "いいえ", "いいえ", "いいえ",          // 充当_*
  ];
}

async function main() {
  console.log("jinjer から従業員名簿を取得します…");
  const token = await getToken();
  const employees = await fetchEmployees(token);
  console.log(`取得: ${employees.length} 名`);
  if (employees.length === 100) {
    console.log("⚠ ちょうど100件です。従業員が100名超の場合、ページ制限で全件でない可能性があります（その場合はお知らせください・ページ対応します）。");
  }

  const lines = [HEADERS.map(esc).join(",")];
  for (const e of employees) lines.push(toRow(e).map(esc).join(","));
  const bom = "﻿";
  writeFileSync(OUT, bom + lines.join("\r\n"), "utf8");

  console.log(`\n✅ ${OUT} に ${employees.length} 名を書き出しました。`);
  console.log("次の手順:");
  console.log("  1) Excel等で " + OUT + " を開く");
  console.log("  2) 『基本給』『勤務体系』『所属』『管理監督者』『固定残業手当』などを実際の値に埋める");
  console.log("  3) アプリの『インポート』画面にアップロードして取込（社員番号キーで冪等）");
}

main().catch((e) => {
  console.error("書き出しに失敗しました:", e?.message ?? e);
  process.exit(1);
});
