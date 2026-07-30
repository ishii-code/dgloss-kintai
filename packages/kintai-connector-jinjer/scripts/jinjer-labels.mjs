/**
 * jinjer の給与・所属の「ラベル辞書」を収集する（マッピング確定用）。
 *
 * /v1/employees/salaries と /v1/employees/affiliations から、salary_units 等の label や
 * 各区分の name の「重複を除いた一覧（マスタ辞書）」だけを表示する。
 * 金額の値・個人との紐付けは出さない（labelと区分名は会社マスタであり個人情報ではない）。
 *
 * 実行: node packages/kintai-connector-jinjer/scripts/jinjer-labels.mjs
 */

const BASE = (process.env.JINJER_BASE_URL || "https://api.jinjer.biz").replace(/\/+$/, "");
const API_KEY = process.env.JINJER_API_KEY || "";
const SECRET_KEY = process.env.JINJER_SECRET_KEY || process.env.JINJER_API_SECRET || "";
const COMPANY = process.env.JINJER_COMPANY_CODE || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!API_KEY || !SECRET_KEY) {
  console.error("JINJER_API_KEY / JINJER_SECRET_KEY(またはJINJER_API_SECRET) が未設定です。");
  process.exit(2);
}

async function token() {
  const res = await fetch(`${BASE}/v2/token`, {
    method: "GET",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-KEY": API_KEY, "X-SECRET-KEY": SECRET_KEY },
  });
  const j = await res.json();
  const t = j?.data?.access_token;
  if (!t) throw new Error("token取得失敗: " + JSON.stringify(j).slice(0, 200));
  return t;
}

async function getJson(url, tok, tries = 5) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${tok}`, "X-API-KEY": API_KEY, ...(COMPANY ? { "Company-Code": COMPANY } : {}) },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      return JSON.parse(text);
    } catch (e) {
      last = e;
      await sleep(400 * (i + 1));
    }
  }
  throw last;
}

/** 全ページのdata[]を集める（page のみ・100件/ページ）。 */
async function fetchAll(path, tok) {
  const all = [];
  for (let page = 1; page <= 50; page += 1) {
    const j = await getJson(`${BASE}/${path}?page=${page}`, tok);
    const arr = Array.isArray(j?.data) ? j.data : [];
    all.push(...arr);
    if (arr.length < 100) break;
  }
  return all;
}

const add = (set, v) => { if (v !== undefined && v !== null && v !== "") set.add(String(v)); };

async function main() {
  const tok = await token();

  // --- 給与ラベル ---
  console.log("== /v1/employees/salaries のラベル辞書 ==");
  const sal = await fetchAll("v1/employees/salaries", tok);
  console.log(`従業員数(給与): ${sal.length}`);
  const salaryClass = new Set(), salaryUnitLabels = new Set(), timeUnitLabels = new Set(), deductionLabels = new Set();
  for (const rec of sal) {
    for (const s of rec.salaries ?? []) {
      add(salaryClass, s.salary_classification?.name);
      for (const u of s.salary_units ?? []) add(salaryUnitLabels, u.label);
      for (const u of s.time_units ?? []) add(timeUnitLabels, u.label);
      for (const u of s.deduction_units ?? []) add(deductionLabels, u.label);
    }
  }
  console.log("  給与区分(salary_classification.name):", [...salaryClass]);
  console.log("  支給単価ラベル(salary_units.label):", [...salaryUnitLabels]);
  console.log("  時間単価ラベル(time_units.label):", [...timeUnitLabels]);
  console.log("  控除ラベル(deduction_units.label):", [...deductionLabels]);

  // --- 所属・役職ラベル ---
  console.log("\n== /v1/employees/affiliations のラベル辞書 ==");
  const aff = await fetchAll("v1/employees/affiliations", tok);
  console.log(`従業員数(所属): ${aff.length}`);
  const depts = new Set(), posts = new Set(), jobClass = new Set(), dutyClass = new Set(), attGroups = new Set(), grades = new Set();
  const optValues = new Map(); // label -> Set(values)
  for (const rec of aff) {
    for (const a of rec.affiliations ?? []) {
      add(depts, a.department?.name);
      add(posts, a.employee_post?.name);
      add(jobClass, a.job_classification?.name);
      add(dutyClass, a.duty_classification?.name);
      add(attGroups, a.attendance_group?.name);
      add(grades, a.employee_grade?.name);
      for (const o of a.optional_classifications ?? []) {
        if (!optValues.has(o.label)) optValues.set(o.label, new Set());
        add(optValues.get(o.label), o.value);
      }
    }
  }
  console.log("  部署(department.name):", [...depts]);
  console.log("  役職(employee_post.name):", [...posts]);
  console.log("  職種(job_classification.name):", [...jobClass]);
  console.log("  職務区分(duty_classification.name):", [...dutyClass]);
  console.log("  勤怠グループ(attendance_group.name):", [...attGroups]);
  console.log("  等級(employee_grade.name):", [...grades]);
  console.log("  カスタム項目(optional_classifications label → 取りうる値):");
  for (const [label, vals] of optValues) console.log(`    - ${label}: ${[...vals].join(" / ")}`);
}

main().catch((e) => { console.error("失敗:", e?.message ?? e); process.exit(1); });
