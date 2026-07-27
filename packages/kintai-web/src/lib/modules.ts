/**
 * モジュールカタログ（管理コンソールの単一情報源）。
 *
 * ランチャー（ホーム）・上部ナビ・「準備中」プレースホルダは、すべてこのカタログから
 * 生成する。これにより「全体像（jinjer 風のメニュー全体構成）」を 1 箇所で定義し、
 * 追加・並び替え・ロール制御を宣言的に行える。
 *
 * - `status: "active"` … 実画面が稼働しているモジュール（対応ルートを持つ）。
 * - `status: "soon"`   … 未実装。共通の「準備中」プレースホルダへ遷移する（`phase` で予定を表示）。
 *
 * このモジュールはクライアント・サーバ双方から import されるため、"server-only" に依存しない
 * 純粋なデータ・純粋関数のみを持つ（役割の解決は {@link file://../server/role.ts} が担う）。
 */

/**
 * 利用者の役割。`resolveRole`（server-only）で解決する。
 * ここでは型のみを公開し、クライアント側のフィルタリングでも参照できるようにする。
 */
export type Role = "admin" | "general";

/** モジュールの稼働状態。 */
export type ModuleStatus = "active" | "soon";

/** モジュールのカテゴリ（jinjer のメニュー大分類に対応）。 */
export type ModuleCategory =
  | "attendance"
  | "hr"
  | "payroll"
  | "settings"
  | "support";

/** カテゴリの表示ラベル（描画順はこの定義順）。 */
export const CATEGORY_LABELS: Readonly<Record<ModuleCategory, string>> = {
  attendance: "勤怠",
  hr: "人事・労務",
  payroll: "給与",
  settings: "各種設定",
  support: "サポート",
};

/** カテゴリの描画順。 */
export const CATEGORY_ORDER: readonly ModuleCategory[] = [
  "attendance",
  "hr",
  "payroll",
  "settings",
  "support",
];

/** 管理コンソールを構成する 1 モジュールの定義。 */
export interface KintaiModule {
  /** 一意な識別子（英小文字・ハイフン）。 */
  readonly id: string;
  /** タイル・ナビに出す表示名。 */
  readonly label: string;
  /** 準備中プレースホルダやタイルの補足に出す 1 行概要。 */
  readonly description: string;
  /** 軽量アイコン（絵文字）。iPad で視認しやすいものを選ぶ。 */
  readonly icon: string;
  /** 遷移先パス（`(app)` ルートグループ配下・URL に現れる実パス）。 */
  readonly path: string;
  /** 稼働状態。 */
  readonly status: ModuleStatus;
  /** カテゴリ（大分類）。 */
  readonly category: ModuleCategory;
  /**
   * 必要な役割。`"admin"` は管理者のみ、`"general"` は全員（一般・管理者）。
   * ランチャー／ナビ／プレースホルダのフィルタに使う。
   */
  readonly requiredRole: Role;
  /** 準備中モジュールの実装予定フェーズ（`status: "soon"` のとき表示）。 */
  readonly phase?: number;
  /** 上部ナビ（主要タブ）に出すか。既定は false（ランチャーからのみ辿る）。 */
  readonly showInNav?: boolean;
  /** 上部ナビのタブ下段に出す短い補足（例「日別」「総支給」）。dgloss ダッシュボード調。 */
  readonly navSubLabel?: string;
}

/**
 * 管理コンソールの全モジュール（jinjer のメニュー全体構成を反映）。
 *
 * 稼働中（active）は既存の実画面へ、未実装（soon）は共通プレースホルダへ遷移する。
 * 一般ユーザーが日常的に使う打刻・勤怠一覧・改善リクエスト等は `requiredRole: "general"`、
 * 人事・給与・各種設定など管理系は `requiredRole: "admin"`。
 */
export const MODULES: readonly KintaiModule[] = [
  // --- 勤怠 -------------------------------------------------------------
  {
    id: "stamp",
    label: "打刻",
    description: "出勤・退勤・休憩の打刻を行います。",
    icon: "🕒",
    path: "/stamp",
    status: "active",
    category: "attendance",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "出退勤",
  },
  {
    id: "attendance",
    label: "勤怠一覧",
    description: "月次の日別勤怠（実労働・時間外・深夜）を確認します。",
    icon: "📋",
    path: "/attendance",
    status: "active",
    category: "attendance",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "日別",
  },
  {
    id: "closing",
    label: "月次締め",
    description: "対象月の締め状況・割増賃金・区分別労働時間を確認します。",
    icon: "🧮",
    path: "/closing",
    status: "active",
    category: "attendance",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "割増/締め",
  },
  {
    id: "leave",
    label: "有給休暇",
    description: "年次有給休暇の残日数・付与履歴・年5日取得義務を確認します。",
    icon: "🏖️",
    path: "/leave",
    status: "active",
    category: "attendance",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "残日数",
  },
  {
    id: "closing-run",
    label: "締め処理",
    description: "打刻を日次勤怠へ変換し、対象月の月次締め（割増・控除）を確定します。給与明細・36協定へ反映されます。",
    icon: "▶️",
    path: "/closing-run",
    status: "active",
    category: "attendance",
    requiredRole: "admin",
  },
  // --- 人事・労務 -------------------------------------------------------
  {
    id: "employees",
    label: "従業員管理",
    description: "従業員の基本情報・雇用契約・在籍状況を管理します。",
    icon: "👥",
    path: "/employees",
    status: "active",
    category: "hr",
    requiredRole: "admin",
  },
  {
    id: "import",
    label: "インポート",
    description: "従業員・勤怠・給与データを CSV で一括取り込みします。",
    icon: "📥",
    path: "/import",
    status: "active",
    category: "hr",
    requiredRole: "admin",
  },
  {
    id: "summary",
    label: "データベースサマリ",
    description: "組織全体の在籍・勤怠・労務の集計サマリを俯瞰します。",
    icon: "📊",
    path: "/summary",
    status: "active",
    category: "hr",
    requiredRole: "admin",
  },
  {
    id: "compliance",
    label: "36協定監視",
    description: "時間外労働の上限規制（労基法第36条）を年度・従業員ごとに監視します。",
    icon: "🚦",
    path: "/compliance",
    status: "active",
    category: "hr",
    requiredRole: "admin",
  },
  {
    id: "groups",
    label: "所属グループ",
    description: "部署・拠点・チームなどの所属グループを編成します。",
    icon: "🏢",
    path: "/groups",
    status: "soon",
    category: "hr",
    requiredRole: "admin",
    phase: 2,
  },
  {
    id: "onboarding",
    label: "入社処理",
    description: "入社・異動・退職に伴う手続きと必要情報を管理します。",
    icon: "📝",
    path: "/onboarding",
    status: "soon",
    category: "hr",
    requiredRole: "admin",
    phase: 3,
  },
  {
    id: "workflow",
    label: "ワークフロー",
    description: "各種申請・承認フロー（残業・休暇・打刻修正）を申請・承認します。",
    icon: "🔁",
    path: "/workflow",
    status: "active",
    category: "hr",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "申請/承認",
  },
  // --- 給与 -------------------------------------------------------------
  {
    id: "payroll-csv",
    label: "給与CSV",
    description: "月次締めから給与ソフト連携用の CSV を出力します。",
    icon: "💾",
    path: "/payroll",
    status: "active",
    category: "payroll",
    requiredRole: "admin",
    showInNav: true,
    navSubLabel: "連携出力",
  },
  {
    id: "payroll-calc",
    label: "給与計算",
    description: "勤怠・手当・控除をもとに月次の給与を計算します。",
    icon: "🧾",
    path: "/payroll-calc",
    status: "soon",
    category: "payroll",
    requiredRole: "admin",
    phase: 4,
  },
  {
    id: "payslips",
    label: "給与明細",
    description: "対象月の給与明細（総支給・自社控除・差引支給）を確認します。",
    icon: "📄",
    path: "/payslips",
    status: "active",
    category: "payroll",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "総支給",
  },
  {
    id: "bonus",
    label: "賞与計算",
    description: "基本給・支給月数・評価係数から賞与（総支給まで）を試算します。",
    icon: "🎁",
    path: "/bonus",
    status: "active",
    category: "payroll",
    requiredRole: "admin",
  },
  // --- 各種設定 ---------------------------------------------------------
  {
    id: "settings-company",
    label: "企業設定",
    description: "会社情報・年度開始月などの基本設定を行います。",
    icon: "⚙️",
    path: "/settings/company",
    status: "active",
    category: "settings",
    requiredRole: "admin",
  },
  {
    id: "settings-calendar",
    label: "勤務カレンダー",
    description: "法定休日・所定休日・会社休日を設定します（休日勤務の判定に反映）。",
    icon: "📅",
    path: "/settings/calendar",
    status: "active",
    category: "settings",
    requiredRole: "admin",
  },
  {
    id: "settings-hr",
    label: "人事設定",
    description: "雇用区分・勤務体系・休暇区分などの人事マスタを設定します。",
    icon: "🗂️",
    path: "/settings/hr",
    status: "soon",
    category: "settings",
    requiredRole: "admin",
    phase: 3,
  },
  {
    id: "settings-payroll",
    label: "給与設定",
    description: "手当・控除・割増率などの給与計算ルールを設定します。",
    icon: "💴",
    path: "/settings/payroll",
    status: "soon",
    category: "settings",
    requiredRole: "admin",
    phase: 4,
  },
  {
    id: "settings-roles",
    label: "ロール設定",
    description: "管理者権限を持つ従業員を指定します（環境変数に依存せず画面から管理）。",
    icon: "🔑",
    path: "/settings/roles",
    status: "active",
    category: "settings",
    requiredRole: "admin",
  },
  {
    id: "settings-custom-fields",
    label: "カスタム項目",
    description: "従業員・勤怠に付加する独自項目を定義します。",
    icon: "🧩",
    path: "/settings/custom-fields",
    status: "soon",
    category: "settings",
    requiredRole: "admin",
    phase: 3,
  },
  // --- サポート ---------------------------------------------------------
  {
    id: "improvements",
    label: "改善リクエスト",
    description: "機能要望・不具合報告を起票し、対応状況を確認します。",
    icon: "💡",
    path: "/improvements",
    status: "active",
    category: "support",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "要望/不具合",
  },
  {
    id: "release-notes",
    label: "リリースノート",
    description: "バージョン履歴と変更点を確認します。",
    icon: "🗞️",
    path: "/release-notes",
    status: "active",
    category: "support",
    requiredRole: "general",
    showInNav: true,
    navSubLabel: "更新履歴",
  },
];

/**
 * 役割で参照可能なモジュールだけに絞り込む（純粋関数）。
 * 管理者は全モジュール、一般は `requiredRole: "general"` のみ。
 *
 * @param modules 対象モジュール一覧
 * @param role    利用者の役割（未ログイン＝null は一般とみなす）
 */
export function modulesForRole(
  modules: readonly KintaiModule[],
  role: Role | null,
): readonly KintaiModule[] {
  if (role === "admin") {
    return modules;
  }
  return modules.filter((m) => m.requiredRole === "general");
}

/**
 * 指定カテゴリのモジュールを抽出する（純粋関数）。
 *
 * @param modules 対象モジュール一覧
 * @param category カテゴリ
 */
export function modulesInCategory(
  modules: readonly KintaiModule[],
  category: ModuleCategory,
): readonly KintaiModule[] {
  return modules.filter((m) => m.category === category);
}

/**
 * 上部ナビ（主要タブ）に出すモジュールを抽出する（純粋関数）。
 * `showInNav: true` かつ役割条件を満たすもののみ。
 *
 * @param modules 対象モジュール一覧
 * @param role    利用者の役割
 */
export function navModulesForRole(
  modules: readonly KintaiModule[],
  role: Role | null,
): readonly KintaiModule[] {
  return modulesForRole(modules, role).filter((m) => m.showInNav === true);
}

/** 上部ナビの 1 リンク（表示名・補足・遷移先）。 */
export interface NavLink {
  readonly href: string;
  readonly label: string;
  /** タブ下段の短い補足（dgloss ダッシュボード調の2段表示）。 */
  readonly sublabel?: string;
}

/**
 * 上部ナビのリンク一覧を生成する（純粋関数）。
 * 先頭に常設の「ホーム」（ランチャーへ戻る導線）、続けて役割条件を満たす主要タブを並べる。
 *
 * @param modules 対象モジュール一覧
 * @param role    利用者の役割
 */
export function navLinksForRole(
  modules: readonly KintaiModule[],
  role: Role | null,
): readonly NavLink[] {
  return [
    { href: "/", label: "ホーム", sublabel: "総合" },
    ...navModulesForRole(modules, role).map((m) => ({
      href: m.path,
      label: m.label,
      ...(m.navSubLabel !== undefined ? { sublabel: m.navSubLabel } : {}),
    })),
  ];
}

/**
 * パスに対応するモジュールを探す（純粋関数）。準備中ページが自分の定義を引くのに使う。
 *
 * @param path 実パス（例 `/settings/company`）
 * @returns 一致するモジュール、または undefined
 */
export function findModuleByPath(path: string): KintaiModule | undefined {
  return MODULES.find((m) => m.path === path);
}
