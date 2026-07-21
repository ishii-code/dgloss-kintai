"use client";

import type { ReactNode } from "react";
import type { StampType } from "@dgloss-kintai/contracts";

/** 打刻ボタンの見た目バリアント。 */
export type StampButtonVariant = "primary" | "secondary" | "outline";

interface StampButtonProps {
  readonly type: StampType;
  readonly label: string;
  readonly variant: StampButtonVariant;
  readonly disabled: boolean;
  readonly onStamp: (type: StampType) => void;
}

const VARIANT_CLASS: Readonly<Record<StampButtonVariant, string>> = {
  primary:
    "bg-primary text-primary-foreground hover:brightness-95 active:brightness-90",
  secondary:
    "bg-secondary text-secondary-foreground hover:brightness-95 active:brightness-90",
  outline:
    "border-2 border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100",
};

/**
 * iPad 優先の大型打刻ボタン。タップ領域を広く取り、無効時は明確に区別する。
 */
export function StampButton({
  type,
  label,
  variant,
  disabled,
  onStamp,
}: StampButtonProps): ReactNode {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onStamp(type)}
      className={`flex min-h-[7rem] w-full items-center justify-center rounded-2xl text-3xl font-bold shadow-sm transition select-none touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${VARIANT_CLASS[variant]}`}
    >
      {label}
    </button>
  );
}
