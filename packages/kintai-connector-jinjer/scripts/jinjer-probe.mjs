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

  // 全項目名を深く展開（値は出さない）。給与・勤務条件が深い階層に無いか確認する。
  const rec = arr?.[0];
  if (rec) {
    console.log("\n[3] 一覧APIの全項目名（深く展開・値は非表示）:");
    console.log(JSON.stringify(shape(rec, 8), null, 2));

    // 給与・勤務条件に関係しそうな項目名を全階層から拾う。
    const keys = [];
    const walk = (o, path) => {
      if (Array.isArray(o)) return o.length ? walk(o[0], `${path}[]`) : undefined;
      if (o && typeof o === "object")
        for (const k of Object.keys(o)) {
          keys.push(`${path}${k}`);
          walk(o[k], `${path}${k}.`);
        }
    };
    walk(rec, "");
    const hitKeys = keys.filter((k) =>
      /salary|wage|pay|給与|基本給|allowance|overtime|残業|work_system|勤務|office|department|所属|group|position|役職|manager|監督|scheduled|所定|employ|社員|staff|code|number/i.test(
        k,
      ),
    );
    console.log("\n    給与・勤務・所属・社員番号 に関係しそうな項目名:");
    console.log(hitKeys.length ? hitKeys.join("\n") : "  （見当たらず）");

    // 詳細（個別取得）エンドポイントも確認する（一覧に無い情報が入る場合がある）。
    const id = rec.id;
    if (id !== undefined) {
      const dUrl = `${BASE}/v1/employees/${encodeURIComponent(String(id))}`;
      console.log(`\n[4] 従業員詳細: GET ${dUrl}`);
      const dRes = await fetch(dUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-API-KEY": API_KEY,
          ...(COMPANY ? { "Company-Code": COMPANY } : {}),
        },
      });
      console.log(`    status: ${dRes.status}`);
      const dText = await dRes.text();
      let dJson;
      try {
        dJson = JSON.parse(dText);
      } catch {
        dJson = null;
      }
      if (dRes.status === 200 && dJson) {
        const drec = Array.isArray(dJson.data) ? dJson.data[0] : dJson.data ?? dJson;
        console.log("    詳細の全項目名（深く展開・値は非表示）:");
        console.log(JSON.stringify(shape(drec, 8), null, 2));
      } else if (dJson?.errors?.[0]) {
        console.log("    詳細エラー:", JSON.stringify(dJson.errors[0]));
      }
    }
  }

  // --- 5) 勤怠・給与・所属などの別エンドポイントを探索（statusと形だけ） ---
  console.log("\n[5] 賃金・勤務条件・所属 の別エンドポイントを探索:");
  // JINJER_PROBE_PATHS="v1/xxx,v1/yyy" を渡すと、それを最優先で試す（docで判明したパス用）。
  const extra = (process.env.JINJER_PROBE_PATHS || "")
    .split(",")
    .map((s) => s.trim().replace(/^\/+/, ""))
    .filter(Boolean);
  // 403（存在するが権限なし）を洗い出すため v2 中心に探索する。
  const discover = [
    ...extra,
    // v2: 既に 403 を確認済み（＝存在する）
    "v2/employees", "v2/salaries",
    // v2: 給与・手当
    "v2/salary", "v2/payrolls", "v2/payroll", "v2/wages", "v2/allowances",
    "v2/base_salaries", "v2/employee_salaries", "v2/compensations",
    // v2: 雇用情報・勤務条件
    "v2/employments", "v2/employment", "v2/employee_employments",
    "v2/work_systems", "v2/work_types", "v2/working_styles",
    "v2/scheduled_working_hours", "v2/fixed_overtimes", "v2/overtime",
    // v2: 勤怠（日次・月次）
    "v2/attendances", "v2/daily_attendances", "v2/monthly_attendances",
    "v2/work_records", "v2/attendance_records", "v2/monthly_closings",
    "v2/timecards",
    // v2: 所属・役職
    "v2/departments", "v2/groups", "v2/positions", "v2/job_titles",
    // 比較用（v1 は存在しないはず）
    "v1/salaries",
  ];
  const ok200 = [];
  for (const p of discover) {
    try {
      const res = await fetch(`${BASE}/${p}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-API-KEY": API_KEY,
          ...(COMPANY ? { "Company-Code": COMPANY } : {}),
        },
      });
      const t = await res.text();
      let j;
      try {
        j = JSON.parse(t);
      } catch {
        j = null;
      }
      const m = j?.errors?.[0]?.message ?? j?.errors?.[0]?.reason ?? "";
      console.log(`    ${res.status}  /${p}${m ? "  … " + m : ""}`);
      if (res.status === 200) ok200.push({ p, j });
    } catch (e) {
      console.log(`    ERR  /${p}  ${e?.message ?? e}`);
    }
  }
  for (const { p, j } of ok200) {
    console.log(`\n    ✅ 200 のエンドポイント /${p} の項目名（値は非表示）:`);
    const rec = Array.isArray(j?.data) ? j.data[0] : Array.isArray(j?.result) ? j.result[0] : j?.data ?? j;
    console.log(JSON.stringify(shape(rec, 6), null, 2));
  }

  // --- 6) v2 の 403 の「理由」を丸ごと表示（権限で何を有効化すべきか判断するため） ---
  console.log("\n[6] v2 が 403 になる理由（応答本文・ヘッダ）:");
  const dbgUrl = `${BASE}/v2/employees`;
  const dbg = await fetch(dbgUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-API-KEY": API_KEY,
      ...(COMPANY ? { "Company-Code": COMPANY } : {}),
    },
  });
  console.log(`    GET ${dbgUrl} → status ${dbg.status}`);
  const hdrs = {};
  for (const [k, v] of dbg.headers.entries()) {
    if (/error|message|reason|auth|permission|rate|allow|www-/i.test(k)) hdrs[k] = v;
  }
  console.log("    関連ヘッダ:", JSON.stringify(hdrs));
  const body = await dbg.text();
  console.log("    応答本文:", body.slice(0, 800));
}

main().catch((e) => {
  console.error("プローブ失敗:", e?.message ?? e);
  process.exit(1);
});
