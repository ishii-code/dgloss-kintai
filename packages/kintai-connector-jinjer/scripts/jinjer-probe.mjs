/**
 * jinjer API 診断プローブ（実仕様の確認用）。
 *
 * 目的:
 *   1) 正しい認証（GET /v2/token・X-API-KEY/X-SECRET-KEY・data.access_token）でトークンが取れるか確認
 *   2) 従業員エンドポイントの「応答の形（項目名だけ）」を表示する（個人情報の値は出さない）
 *
 * 実行（環境変数は前回と同じものをセット済みの前提。JINJER_BASE_URL/API_KEY/SECRET_KEY/COMPANY_CODE）:
 *   node packages/kintai-connector-jinjer/scripts/jinjer-probe.mjs
 *
 * 従業員パスを変えて試す場合:
 *   JINJER_EMPLOYEES_PATH="v1/employee_data" node packages/.../jinjer-probe.mjs
 */

const BASE = (process.env.JINJER_BASE_URL || "https://api.jinjer.biz").replace(/\/+$/, "");
const API_KEY = process.env.JINJER_API_KEY || "";
const SECRET_KEY = process.env.JINJER_SECRET_KEY || "";
const COMPANY = process.env.JINJER_COMPANY_CODE || "";
const TOKEN_PATH = (process.env.JINJER_TOKEN_PATH || "v2/token").replace(/^\/+/, "");
const EMP_PATH = (process.env.JINJER_EMPLOYEES_PATH || "v1/employee_data").replace(/^\/+/, "");

if (!API_KEY || !SECRET_KEY) {
  console.error("JINJER_API_KEY / JINJER_SECRET_KEY が未設定です。exportし直してください。");
  process.exit(2);
}

/** 応答の「形（キーと型）」だけを返す。値（個人情報）は出さない。 */
function shape(obj, depth = 2) {
  if (Array.isArray(obj)) {
    return obj.length ? [shape(obj[0], depth)] : "[]（空配列）";
  }
  if (obj && typeof obj === "object") {
    const o = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      o[k] =
        v && typeof v === "object" && depth > 0 ? shape(v, depth - 1) : typeof v;
    }
    return o;
  }
  return typeof obj;
}

async function main() {
  // --- 1) トークン取得 ---
  const tokenUrl = `${BASE}/${TOKEN_PATH}`;
  console.log(`[1] トークン取得: GET ${tokenUrl}`);
  const tokenRes = await fetch(tokenUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": API_KEY,
      "X-SECRET-KEY": SECRET_KEY,
    },
  });
  const tokenText = await tokenRes.text();
  console.log(`    status: ${tokenRes.status}`);
  let tokenJson;
  try {
    tokenJson = JSON.parse(tokenText);
  } catch {
    console.log("    応答(JSONでない):", tokenText.slice(0, 300));
    process.exit(1);
  }
  console.log("    応答の形:", JSON.stringify(shape(tokenJson), null, 2));

  const token =
    tokenJson?.data?.access_token ??
    tokenJson?.access_token ??
    tokenJson?.result?.access_token ??
    tokenJson?.token;
  if (!token) {
    console.log("    ⚠ access_token が見つかりません。上の『応答の形』を貼ってください。");
    process.exit(1);
  }
  console.log("    ✅ トークン取得OK");

  // --- 2) 従業員エンドポイントの候補を順に試す ---
  // 環境変数 JINJER_EMPLOYEES_PATH があれば最優先で試す。
  const candidates = [
    ...(process.env.JINJER_EMPLOYEES_PATH ? [EMP_PATH] : []),
    "v1/employees",
    "v1/employee",
    "v1/employee_data",
    "v1/staff",
    "v1/staffs",
    "v1/staff_data",
    "v2/employees",
    "v1/employees/index",
  ];

  async function tryEmp(path, withCompanyQuery) {
    const qs = withCompanyQuery && COMPANY ? `?company_code=${encodeURIComponent(COMPANY)}` : "";
    const url = `${BASE}/${path}${qs}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-API-KEY": API_KEY,
        ...(COMPANY ? { "Company-Code": COMPANY } : {}),
      },
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const msg = json?.errors?.[0]?.message ?? json?.errors?.[0]?.reason ?? "";
    return { url, status: res.status, json, msg, text };
  }

  console.log(`\n[2] 従業員エンドポイントの候補を順に試します`);
  let hit = null;
  for (const path of candidates) {
    const r = await tryEmp(path, false);
    console.log(`    ${r.status}  GET /${path}${r.msg ? "  … " + r.msg : ""}`);
    if (r.status === 200) {
      hit = r;
      break;
    }
    // 404以外（例: 400 会社コード必須）なら company_code 付きも試す
    if (r.status !== 404 && COMPANY) {
      const r2 = await tryEmp(path, true);
      console.log(`    ${r2.status}  GET /${path}?company_code=…${r2.msg ? "  … " + r2.msg : ""}`);
      if (r2.status === 200) {
        hit = r2;
        break;
      }
    }
  }

  if (hit === null) {
    console.log("\n    どの候補も 200 になりませんでした。上のstatusとメッセージを貼ってください。");
    console.log("    正しいパスが分かっている場合: JINJER_EMPLOYEES_PATH=\"v1/xxx\" を付けて再実行できます。");
    return;
  }

  console.log(`\n    ✅ 見つかりました: ${hit.url}`);
  const arr = Array.isArray(hit.json?.data)
    ? hit.json.data
    : Array.isArray(hit.json?.result)
      ? hit.json.result
      : null;
  if (arr) console.log(`    件数: ${arr.length}`);

  // マッパー確定用に、非個人情報のコード項目だけ値を表示する（氏名・住所・生年月日等は出さない）。
  const rec = arr?.[0];
  if (rec) {
    const c = rec.company ?? {};
    console.log("\n    参考（コード項目の値のみ・氏名等は非表示）:");
    console.log("      id:", JSON.stringify(rec.id));
    console.log("      company.employment_classification:", JSON.stringify(c.employment_classification));
    console.log("      company.enrollment_classification:", JSON.stringify(c.enrollment_classification));
    console.log("      company.joined_on(型/例):", typeof c.joined_on, JSON.stringify(String(c.joined_on ?? "").slice(0, 10)));
    console.log("      staff系の項目があるか:", Object.keys(rec).concat(Object.keys(c)).filter((k) => /staff|code|number|employee|社員/i.test(k)));
  }
}

main().catch((e) => {
  console.error("プローブ失敗:", e?.message ?? e);
  process.exit(1);
});
