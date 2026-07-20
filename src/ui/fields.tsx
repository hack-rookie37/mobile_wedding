"use client";

import clsx from "clsx";
import { useId, useState, type ReactNode } from "react";

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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(inputClass, "resize-y py-2 leading-[1.6]")}
      />
    </div>
  );
}

const swatchClass =
  "h-8 w-10 shrink-0 cursor-pointer rounded-md border border-tool-border bg-white p-0.5";

// 색 고르기 — 반드시 값이 있는 자리 (비우는 뜻이 없는 색)
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={swatchClass}
      />
    </div>
  );
}

// 색 덮어쓰기 — 비우면 상위 설정(테마·전체)을 따른다.
// fallback은 '따르는 중'일 때 스와치에 보여 줄 색이고, resetLabel은 무엇을 따르게 되는지 말한다.
export function ColorOverrideField({
  label,
  value,
  fallback,
  resetLabel,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  resetLabel: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value)}
          className={swatchClass}
        />
        <button
          type="button"
          disabled={value === undefined}
          onClick={() => onChange(undefined)}
          className="text-[12px] text-tool-ink-soft underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
        >
          {resetLabel}
        </button>
      </div>
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
  // 5개 이상을 한 줄에 균등 분할하면 320px 인스펙터에서 한글 라벨이 잘린다 — 3열로 접는다
  const wrapped = grow && options.length > 4;
  return (
    <div
      className={clsx(
        "rounded-md bg-tool-bg-deep p-0.5",
        wrapped ? "grid grid-cols-3 gap-0.5" : grow ? "flex" : "inline-flex",
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "h-6.5 rounded-[5px] text-[12px] whitespace-nowrap transition-colors",
            wrapped ? "px-1" : grow ? "flex-1" : "px-2.5",
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

// pt 같은 수치 직접 입력 — 슬라이더와 숫자 입력을 같은 값에 묶는다.
// 숫자 칸은 라벨 줄 오른쪽에, 슬라이더는 그 아래 한 줄을 통째로 쓴다 —
// 좁은 인스펙터에서 둘을 한 줄에 나눠 담으면 슬라이더가 잡기 어려울 만큼 짧아진다.
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  // 타이핑 중에는 범위로 자르지 않는다. "12"를 치려고 "1"을 누른 순간 min(7)으로 튀면
  // 다음 글자가 그 뒤에 붙어 "72" → max(20)이 되어버린다 — 확정할 때만 한 번 자른다.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    // 빈 칸·숫자가 아닌 입력은 확정하지 않는다 — 직전 값으로 되돌아간다
    if (draft.trim() === "" || Number.isNaN(parsed)) return;
    onChange(Math.min(max, Math.max(min, parsed)));
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[12px] leading-none text-tool-ink-soft">
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-1">
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft ?? value}
            onChange={(e) => {
              const raw = e.target.value;
              setDraft(raw);
              // 범위 안이면 곧바로 미리보기에 반영하고, 벗어난 값은 확정할 때까지 들고만 있는다
              const parsed = Number(raw);
              if (raw !== "" && !Number.isNaN(parsed) && parsed >= min && parsed <= max) {
                onChange(parsed);
              }
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={clsx(inputClass, "h-7 w-15 px-1.5 text-center tabular-nums")}
          />
          <span className="text-[12px] text-tool-ink-faint">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        aria-label={`${label} 슬라이더`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          setDraft(null);
          onChange(Number(e.target.value));
        }}
        className="block w-full accent-(--color-tool-accent)"
      />
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
