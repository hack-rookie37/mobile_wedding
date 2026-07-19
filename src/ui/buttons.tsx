"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex size-8 items-center justify-center rounded-md text-tool-ink-soft transition-colors",
        disabled ? "opacity-35" : "hover:bg-tool-bg hover:text-tool-ink",
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = "secondary",
  onClick,
  disabled = false,
  title,
  children,
}: {
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "h-8 rounded-md px-3.5 text-[13px] font-medium transition-colors",
        variant === "primary" && "bg-tool-ink text-white hover:bg-black disabled:hover:bg-tool-ink",
        variant === "secondary" &&
          "border border-tool-border bg-white text-tool-ink hover:border-tool-border-strong",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}
