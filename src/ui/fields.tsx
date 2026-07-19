"use client";

import clsx from "clsx";
import { useId, type ReactNode } from "react";

// 편집기 도구 UI 공용 컨트롤 (DESIGN_SYSTEM.md §9)

const inputClass =
  "w-full rounded-md border border-tool-border bg-white px-2.5 text-[13px] text-tool-ink " +
  "placeholder:text-tool-ink-faint focus:border-tool-accent focus:outline-none " +
  "focus:ring-[3px] focus:ring-tool-accent/15";

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] leading-none text-tool-ink-soft">
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "datetime-local" | "tel";
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(inputClass, "h-8")}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(inputClass, "resize-y py-2 leading-[1.6]")}
      />
    </div>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-7 cursor-pointer items-center gap-2 text-[13px] text-tool-ink select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-(--color-tool-accent)"
      />
      {label}
    </label>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12px] leading-none text-tool-ink-soft">
          {label}
        </label>
        <span className="text-[11px] text-tool-ink-faint tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-(--color-tool-accent)"
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={clsx(inputClass, "h-8")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  grow = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  grow?: boolean; // true면 컨테이너 폭을 균등 분할 (폼용), false면 내용 크기 (툴바용)
}) {
  return (
    <div className={clsx("rounded-md bg-tool-bg-deep p-0.5", grow ? "flex" : "inline-flex")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "h-6.5 rounded-[5px] text-[12px] transition-colors",
            grow ? "flex-1" : "px-2.5",
            option.value === value
              ? "bg-white font-semibold text-tool-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
              : "text-tool-ink-soft hover:text-tool-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Segmented value={value} options={options} onChange={onChange} grow />
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-tool-border pt-4 first:border-t-0 first:pt-0">
      <legend className="float-left mb-3 w-full text-[12px] font-semibold text-tool-ink">
        {title}
      </legend>
      <div className="clear-both space-y-3">{children}</div>
    </fieldset>
  );
}
