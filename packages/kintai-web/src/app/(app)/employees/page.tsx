"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  Employee,
  EmploymentType,
  OfficeDivision,
  WorkSystem,
} from "@dgloss-kintai/contracts";

import { AdminGuard } from "@/components/AdminGuard";
import {
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYMENT_TYPES,
  OFFICE_LABEL,
  OFFICE_OPTIONS,
  WORK_SYSTEM_LABEL,
  WORK_SYSTEM_OPTIONS,
} from "@/lib/employeeLabels";

/** 円整形（表示用）。 */
const YEN_FMT = new Intl.NumberFormat("ja-JP");

/** 編集フォームの入力値（すべて文字列/真偽で保持し、送信時に数値へ変換）。 */
interface FormState {
  readonly id: string | null;
  employeeCode: string;
  name: string;
  email: string;
  hiredOn: string;
  retiredOn: string;
  employmentType: EmploymentType;
  workSystem: WorkSystem;
  office: OfficeDivision;
  isManagerialEmployee: boolean;
  basicSalary: string;
  annualScheduledWorkingHours: string;
  fixedOvertimeAllowance: string;
  covOvertime: boolean;
  covOvertimeOver60: boolean;
  covHoliday: boolean;
  covNight: boolean;
}

/** 空のフォーム初期値（新規登録用）。 */
function emptyForm(): FormState {
  return {
    id: null,
    employeeCode: "",
    name: "",
    email: "",
    hiredOn: "",
    retiredOn: "",
    employmentType: "regular",
    workSystem: "fixed",
    office: "headquarters",
    isManagerialEmployee: false,
    basicSalary: "",
    annualScheduledWorkingHours: "",
    fixedOvertimeAllowance: "0",
    covOvertime: false,
    covOvertimeOver60: false,
    covHoliday: false,
    covNight: false,
  };
}

/** 既存従業員をフォーム値へ写す（編集開始）。 */
function formFromEmployee(e: Employee): FormState {
  const c = e.contract;
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    name: e.name,
    email: e.email ?? "",
    hiredOn: e.hiredOn,
    retiredOn: e.retiredOn ?? "",
    employmentType: c.employmentType,
    workSystem: c.workSystem,
    office: c.office,
    isManagerialEmployee: c.isManagerialEmployee,
    basicSalary: String(c.basicSalary),
    annualScheduledWorkingHours: String(c.annualScheduledWorkingHours),
    fixedOvertimeAllowance: String(c.fixedOvertimeAllowance),
    covOvertime: c.fixedOvertimeCoverage.overtime,
    covOvertimeOver60: c.fixedOvertimeCoverage.overtimeOver60,
    covHoliday: c.fixedOvertimeCoverage.holiday,
    covNight: c.fixedOvertimeCoverage.night,
  };
}

/** フォーム値を API へ送る payload（数値へ変換）へ写す。 */
function payloadFromForm(f: FormState): unknown {
  return {
    employeeCode: f.employeeCode.trim(),
    name: f.name.trim(),
    email: f.email.trim() === "" ? null : f.email.trim(),
    hiredOn: f.hiredOn,
    retiredOn: f.retiredOn === "" ? null : f.retiredOn,
    contract: {
      employmentType: f.employmentType,
      workSystem: f.workSystem,
      office: f.office,
      isManagerialEmployee: f.isManagerialEmployee,
      basicSalary: Number(f.basicSalary),
      annualScheduledWorkingHours: Number(f.annualScheduledWorkingHours),
      fixedOvertimeAllowance: Number(f.fixedOvertimeAllowance),
      fixedOvertimeCoverage: {
        overtime: f.covOvertime,
        overtimeOver60: f.covOvertimeOver60,
        holiday: f.covHoliday,
        night: f.covNight,
      },
    },
  };
}

/** 従業員一覧を取得する。 */
async function fetchEmployees(): Promise<readonly Employee[]> {
  const res = await fetch("/api/admin/employees", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`一覧の取得に失敗しました (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { employees: readonly Employee[] };
  return json.employees;
}

/** 従業員を作成／更新する。 */
async function saveEmployee(f: FormState): Promise<void> {
  const isEdit = f.id !== null;
  const url = isEdit ? `/api/admin/employees/${f.id}` : "/api/admin/employees";
  const res = await fetch(url, {
    method: isEdit ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payloadFromForm(f)),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      json?.error?.message ?? `保存に失敗しました (HTTP ${res.status})`,
    );
  }
}

/** 入力欄の共通クラス。 */
const INPUT_CLASS = "rounded-xl border border-neutral-300 px-4 py-3 text-base";

function EmployeesBody(): ReactNode {
  const [employees, setEmployees] = useState<readonly Employee[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setEmployees(await fetchEmployees());
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      if (form === null) {
        return;
      }
      if (form.employeeCode.trim() === "" || form.name.trim() === "") {
        setError("社員番号と氏名を入力してください");
        return;
      }
      setPending(true);
      void (async () => {
        try {
          await saveEmployee(form);
          setForm(null);
          setError(null);
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "保存に失敗しました");
        } finally {
          setPending(false);
        }
      })();
    },
    [form, reload],
  );

  /** フォームの1フィールドを更新するヘルパー。 */
  function patch(patchValue: Partial<FormState>): void {
    setForm((prev) => (prev === null ? prev : { ...prev, ...patchValue }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">従業員管理</h1>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm());
            setError(null);
          }}
          className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-base font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          ＋ 新規登録
        </button>
      </div>

      {listError !== null && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
        >
          {listError}
        </p>
      )}

      {form !== null && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-neutral-900">
            {form.id === null ? "新規登録" : `編集：${form.name}`}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">社員番号</span>
              <input
                value={form.employeeCode}
                onChange={(e) => patch({ employeeCode: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">氏名</span>
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">メール（任意）</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <div className="hidden sm:block" />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">入社日</span>
              <input
                type="date"
                value={form.hiredOn}
                onChange={(e) => patch({ hiredOn: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">退職日（在籍中は空）</span>
              <input
                type="date"
                value={form.retiredOn}
                onChange={(e) => patch({ retiredOn: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">雇用区分</span>
              <select
                value={form.employmentType}
                onChange={(e) =>
                  patch({ employmentType: e.target.value as EmploymentType })
                }
                className={INPUT_CLASS}
              >
                {EMPLOYMENT_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {EMPLOYMENT_TYPE_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">勤務体系</span>
              <select
                value={form.workSystem}
                onChange={(e) =>
                  patch({ workSystem: e.target.value as WorkSystem })
                }
                className={INPUT_CLASS}
              >
                {WORK_SYSTEM_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {WORK_SYSTEM_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">所属</span>
              <select
                value={form.office}
                onChange={(e) =>
                  patch({ office: e.target.value as OfficeDivision })
                }
                className={INPUT_CLASS}
              >
                {OFFICE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {OFFICE_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 sm:mt-7">
              <input
                type="checkbox"
                checked={form.isManagerialEmployee}
                onChange={(e) => patch({ isManagerialEmployee: e.target.checked })}
                className="h-5 w-5"
              />
              <span className="text-sm font-medium text-neutral-700">
                管理監督者（労基法41条2号）
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">基本給（月額・円）</span>
              <input
                type="number"
                value={form.basicSalary}
                onChange={(e) => patch({ basicSalary: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">年間所定労働時間</span>
              <input
                type="number"
                value={form.annualScheduledWorkingHours}
                onChange={(e) =>
                  patch({ annualScheduledWorkingHours: e.target.value })
                }
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600">固定残業手当（月額・円）</span>
              <input
                type="number"
                value={form.fixedOvertimeAllowance}
                onChange={(e) => patch({ fixedOvertimeAllowance: e.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <div className="hidden sm:block" />

            <fieldset className="sm:col-span-2 flex flex-wrap gap-4 rounded-xl border border-neutral-200 p-4">
              <legend className="px-1 text-sm font-medium text-neutral-600">
                固定残業の充当区分
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.covOvertime}
                  onChange={(e) => patch({ covOvertime: e.target.checked })}
                  className="h-5 w-5"
                />
                <span className="text-sm text-neutral-700">時間外</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.covOvertimeOver60}
                  onChange={(e) => patch({ covOvertimeOver60: e.target.checked })}
                  className="h-5 w-5"
                />
                <span className="text-sm text-neutral-700">60時間超</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.covHoliday}
                  onChange={(e) => patch({ covHoliday: e.target.checked })}
                  className="h-5 w-5"
                />
                <span className="text-sm text-neutral-700">休日</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.covNight}
                  onChange={(e) => patch({ covNight: e.target.checked })}
                  className="h-5 w-5"
                />
                <span className="text-sm text-neutral-700">深夜</span>
              </label>
            </fieldset>

            {error !== null && (
              <p
                role="alert"
                className="sm:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-700"
              >
                {error}
              </p>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-primary px-6 py-3 text-lg font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "保存中…" : "保存する"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(null);
                  setError(null);
                }}
                className="rounded-xl border border-neutral-300 px-6 py-3 text-lg font-bold text-neutral-700 hover:bg-neutral-50"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-neutral-900">
          従業員一覧（{employees.length}名）
        </h2>
        {employees.length === 0 ? (
          <p className="rounded-2xl bg-white py-10 text-center text-neutral-400 shadow-sm">
            従業員が登録されていません
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">社員番号</th>
                  <th className="px-4 py-3 font-medium">氏名</th>
                  <th className="px-4 py-3 font-medium">雇用区分</th>
                  <th className="px-4 py-3 font-medium">勤務体系</th>
                  <th className="px-4 py-3 font-medium">所属</th>
                  <th className="px-4 py-3 text-right font-medium">基本給</th>
                  <th className="px-4 py-3 font-medium">在籍</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-neutral-100">
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {e.employeeCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {e.name}
                      {e.contract.isManagerialEmployee && (
                        <span className="ml-2 rounded bg-secondary/20 px-1.5 py-0.5 text-xs font-bold text-neutral-700">
                          管理監督者
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {EMPLOYMENT_TYPE_LABEL[e.contract.employmentType]}
                    </td>
                    <td className="px-4 py-3">
                      {WORK_SYSTEM_LABEL[e.contract.workSystem]}
                    </td>
                    <td className="px-4 py-3">{OFFICE_LABEL[e.contract.office]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      ¥{YEN_FMT.format(e.contract.basicSalary)}
                    </td>
                    <td className="px-4 py-3">
                      {e.retiredOn === null ? (
                        <span className="text-neutral-700">在籍</span>
                      ) : (
                        <span className="text-neutral-400">退職</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setForm(formFromEmployee(e));
                          setError(null);
                        }}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * 従業員管理ページ（管理者専用）。一覧・新規登録・編集を提供する。
 * サーバ側で管理者を強制（403）し、クライアントは AdminGuard で URL 直打ちを弾く。
 */
export default function EmployeesPage(): ReactNode {
  return (
    <AdminGuard>
      <EmployeesBody />
    </AdminGuard>
  );
}
