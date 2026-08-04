/**
 * jinjer から従業員＋給与＋所属を取得し、本システムの取込用CSV（16列）に書き出す（完全版）。
 *
 * 取得元:
 *   GET /v1/employees            … 社員番号(id)・氏名・メール・入社日・退職日・雇用区分
 *   GET /v1/employees/salaries   … 基本給(月給/時給/日給)・固定時間外勤務手当（salary_units の label/value）
 *   GET /v1/employees/affiliations … 部署・役職（所属・管理監督者判定の材料）
 *
 * マッピング方針:
 *   - 基本給・固定残業・氏名・入社日・退職日・雇用区分 … jinjer の実データ
 *   - 管理監督者 … jinjer の役職（affiliations の employee_post）から自動判定。MGR（マネージャー/課長）
 *     ライン以上を「はい」にする。判定は実行時に一覧表示するので目視確認でき、環境変数
 *     JINJER_MANAGER_MIN_RANK / JINJER_MANAGER_ROLES で補正して再実行できる
 *   - 勤務体系・所属 … API に明確な項目が無く既定（固定時間制／本社）。必要に応じ編集
 *
 * 環境変数: JINJER_BASE_URL/API_KEY/SECRET_KEY(またはAPI_SECRET)/COMPANY_CODE
 * 実行: node packages/kintai-connector-jinjer/scripts/export-jinjer-full-csv.mjs
 * 出力: jinjer-employees.csv（UTF-8 BOM・給与額を含むため取り扱い注意）
 */

import { writeFileSync } from "node:fs";

const BASE = (process.env.JINJER_BASE_URL || "https://api.jinjer.biz").replace(/\/+$/, "");
const API_KEY = process.env.JINJER_API_KEY || "";
const SECRET_KEY = process.env.JINJER_SECRET_KEY || process.env.JINJER_API_SECRET || "";
const COMPANY = process.env.JINJER_COMPANY_CODE || "";
const OUT = process.env.JINJER_CSV_OUT || "jinjer-employees.csv";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!API_KEY || !SECRET_KEY) {
  console.error("JINJER_API_KEY / JINJER_SECRET_KEY(またはJINJER_API_SECRET) が未設定です。");
  process.exit(2);
}

const HEADERS = [
  "社員番号", "氏名", "メール", "入社日", "退職日", "雇用区分", "勤務体系", "所属",
  "管理監督者", "基本給", "年間所定労働時間", "固定残業手当",
  "充当_時間外", "充当_60時間超", "充当_休日", "充当_深夜",
];

const esc = (v) => { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const ymd = (v) => { const m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(String(v ?? "").trim()); return m ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
const empType = (name) => (String(name ?? "").includes("正社員") ? "正社員" : "非正規");
const intYen = (v) => Math.round(Number(v) || 0);

async function token() {
  const res = await fetch(`${BASE}/v2/token`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-KEY": API_KEY, "X-SECRET-KEY": SECRET_KEY },
  });
  const j = await res.json();
  const t = j?.data?.access_token;
  if (!t) throw new Error("token取得失敗");
  return t;
}
async function getJson(url, tok, tries = 5) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${tok}`, "X-API-KEY": API_KEY, ...(COMPANY ? { "Company-Code": COMPANY } : {}) } });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      return JSON.parse(text);
    } catch (e) { last = e; await sleep(400 * (i + 1)); }
  }
  throw last;
}
async function fetchAll(path, tok, tag) {
  const all = [];
  for (let page = 1; page <= 60; page += 1) {
    const j = await getJson(`${BASE}/${path}?page=${page}`, tok);
    const arr = Array.isArray(j?.data) ? j.data : [];
    all.push(...arr);
    if (arr.length < 100) break;
  }
  console.log(`  ${tag}: ${all.length}件`);
  return all;
}

/** 給与履歴から最新レコードの基本給・固定残業・給与区分を取り出す。 */
function pickSalary(rec) {
  const hist = rec?.salaries ?? [];
  if (!hist.length) return { base: 0, fixedOt: 0, cls: "" };
  const latest = hist.reduce((a, b) => (String(a.revised_on) >= String(b.revised_on) ? a : b));
  const units = latest.salary_units ?? [];
  const val = (pred) => { const u = units.find((x) => pred(String(x.label || ""))); return u ? intYen(u.value) : 0; };
  const month = val((l) => l.includes("基本給(月給)"));
  const day = val((l) => l.includes("基本給(日給)"));
  const hour = val((l) => l.includes("基本給(時給)"));
  const base = month || day || hour || 0;
  const fixedOt = val((l) => l.includes("固定時間外勤務手当") || l.includes("固定残業"));
  return { base, fixedOt, cls: String(latest.salary_classification?.name || "") };
}
/** 所属履歴から最新の部署・役職を取り出す。 */
function pickAff(rec) {
  const hist = rec?.affiliations ?? [];
  if (!hist.length) return { dept: "", post: "" };
  const latest = hist.reduce((a, b) => (String(a.date_of_issue) >= String(b.date_of_issue) ? a : b));
  return { dept: String(latest.department?.name || ""), post: String(latest.employee_post?.name || "") };
}

/**
 * 役職名 → 階層ランク（大きいほど上位）。MGR（マネージャー/課長）ラインを既定の下限として、
 * それ以上の役職者を「管理監督者」に自動設定する。英日・全角半角を緩く判定。
 */
const ROLE_RANKS = [
  { rank: 10, kw: ["取締役", "代表", "会長", "社長", "執行役員", "役員", "CEO", "COO", "CFO", "CTO", "CxO"] },
  { rank: 9, kw: ["本部長", "事業部長", "ディビジョン長"] },
  { rank: 8, kw: ["部長", "ディレクター", "Director"] },
  { rank: 7, kw: ["次長", "副部長"] },
  // ↓ MGR ライン（管理監督者の下限・既定 rank 6）
  { rank: 6, kw: ["課長", "マネージャー", "マネジャー", "ﾏﾈｰｼﾞｬｰ", "MGR", "Manager", "GM", "室長", "所長", "支店長", "店長", "センター長", "拠点長"] },
  { rank: 5, kw: ["係長", "主任", "リーダー", "ﾘｰﾀﾞｰ", "Leader", "LD", "SV", "スーパーバイザー", "チーフ", "Chief", "班長"] },
  { rank: 1, kw: ["一般", "メンバー", "スタッフ", "担当", "アルバイト", "パート"] },
];
const MANAGER_MIN_RANK = Number(process.env.JINJER_MANAGER_MIN_RANK || 6);
// 明示指定があれば、その語を含む役職だけを管理監督者にする（キーワード判定より優先）。
const MANAGER_ROLES = (process.env.JINJER_MANAGER_ROLES || "").split(",").map((s) => s.trim()).filter(Boolean);

/** 役職名を階層ランクに変換（該当なしは 0）。 */
function roleRank(post) {
  const s = String(post || "").toUpperCase();
  if (!s) return 0;
  for (const { rank, kw } of ROLE_RANKS) {
    if (kw.some((k) => s.includes(k.toUpperCase()))) return rank;
  }
  return 0;
}

/** その役職が管理監督者か（MGRライン以上、または明示指定に一致）。 */
function isManagerPost(post) {
  const s = String(post || "");
  if (!s) return false;
  if (MANAGER_ROLES.length) return MANAGER_ROLES.some((k) => s.includes(k));
  return roleRank(s) >= MANAGER_MIN_RANK;
}

async function main() {
  console.log("jinjer から取得します…");
  const tok = await token();
  const employees = await fetchAll("v1/employees", tok, "従業員");
  const salaries = await fetchAll("v1/employees/salaries", tok, "給与");
  const affiliations = await fetchAll("v1/employees/affiliations", tok, "所属");

  const salById = new Map(salaries.map((r) => [String(r.employee_id), r]));
  const affById = new Map(affiliations.map((r) => [String(r.employee_id), r]));

  let withBase = 0;
  let managerCount = 0;
  const postStat = new Map(); // 役職名 → { count, manager }（判定確認用）
  const lines = [HEADERS.map(esc).join(",")];
  for (const e of employees) {
    const c = e.company ?? {};
    const p = e.personal ?? {};
    const name = `${c.last_name || p.last_name || ""} ${c.first_name || p.first_name || ""}`.trim();
    const { base, fixedOt, cls } = pickSalary(salById.get(String(e.id)));
    if (base > 0) withBase += 1;
    const { post } = pickAff(affById.get(String(e.id)));
    const manager = isManagerPost(post);
    if (manager) managerCount += 1;
    const stat = postStat.get(post) || { count: 0, manager };
    stat.count += 1;
    postStat.set(post, stat);
    const workSystem = cls === "時給" ? "シフト制" : "固定時間制"; // 既定・要確認
    const hasFixedOt = fixedOt > 0;
    const row = [
      e.id ?? "",
      name,
      c.email || "",
      ymd(c.joined_on),
      ymd(c.retirement_date),
      empType(c.employment_classification?.name),
      workSystem,
      "本社",                                  // 所属（既定・要確認）
      manager ? "はい" : "いいえ",             // 管理監督者（jinjer役職から自動判定：MGR以上）
      String(base),                            // 基本給（jinjer実データ）
      "1900",                                  // 年間所定労働時間（既定）
      String(fixedOt),                         // 固定残業手当（jinjer実データ）
      hasFixedOt ? "はい" : "いいえ",           // 充当_時間外
      "いいえ", "いいえ", "いいえ",             // 充当_60超/休日/深夜
    ];
    lines.push(row.map(esc).join(","));
  }
  writeFileSync(OUT, "﻿" + lines.join("\r\n"), "utf8");

  // --- 役職→管理監督者の自動判定（確認用）。ズレていたら環境変数で補正して再実行できる。 ---
  console.log(`\n役職→管理監督者の自動判定（MGRライン以上=管理監督者・確認用）:`);
  const sorted = [...postStat.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [post, s] of sorted) {
    console.log(`  ${s.manager ? "○ 管理監督者" : "・ 一般      "}  ${post || "(役職なし)"}  … ${s.count}名`);
  }

  console.log(`\n✅ ${OUT} に ${employees.length} 名を書き出しました（基本給ありは ${withBase} 名 / 管理監督者は ${managerCount} 名）。`);
  console.log("次の手順:");
  console.log("  1) 上の『役職→管理監督者』の一覧を確認（○の役職だけ『はい』になっています）");
  console.log("     - 判定を直したい場合の再実行例:");
  console.log('       ・下限を課長級より上に上げる: JINJER_MANAGER_MIN_RANK=8 node .../export-jinjer-full-csv.mjs');
  console.log('       ・役職名を明示指定する:        JINJER_MANAGER_ROLES="課長,部長,本部長,役員" node .../export-jinjer-full-csv.mjs');
  console.log("  2) " + OUT + " を開いて内容を確認（基本給・固定残業・管理監督者はjinjer由来）");
  console.log("  3) アプリの『インポート』画面にアップロード（社員番号キーで冪等）");
  console.log("  ※ このCSVには給与額が含まれます。取り扱いにご注意ください（私に貼らないでください）。");
}

main().catch((e) => { console.error("失敗:", e?.message ?? e); process.exit(1); });
