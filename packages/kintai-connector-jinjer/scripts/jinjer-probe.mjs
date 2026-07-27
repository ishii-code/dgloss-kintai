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

  // --- 2) 従業員エンドポイント ---
  const empUrl = `${BASE}/${EMP_PATH}`;
  console.log(`\n[2] 従業員取得: GET ${empUrl}`);
  const empRes = await fetch(empUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-API-KEY": API_KEY,
      ...(COMPANY ? { "Company-Code": COMPANY } : {}),
    },
  });
  const empText = await empRes.text();
  console.log(`    status: ${empRes.status}`);
  let empJson;
  try {
    empJson = JSON.parse(empText);
  } catch {
    console.log("    応答(JSONでない):", empText.slice(0, 500));
    return;
  }
  console.log("    応答の形（項目名だけ・値は非表示）:");
  console.log(JSON.stringify(shape(empJson), null, 2));
  if (Array.isArray(empJson?.data)) console.log(`    件数(data): ${empJson.data.length}`);
  if (Array.isArray(empJson?.result)) console.log(`    件数(result): ${empJson.result.length}`);
}

main().catch((e) => {
  console.error("プローブ失敗:", e?.message ?? e);
  process.exit(1);
});
