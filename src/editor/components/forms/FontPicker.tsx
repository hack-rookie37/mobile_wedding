"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldLabel } from "@/ui/fields";
import type { FontOption } from "./FontFields";

// 폰트 고르기 — 각 줄을 그 폰트로 그려서 눈으로 고르게 한다.
//
// 네이티브 <select>를 쓰지 않는 이유: <option>에 font-family를 줘도 macOS는 OS 팝업
// 메뉴로 그려서 무시한다. 목록을 직접 그리는 대신 listbox 키보드 조작을 손으로 구현한다
// (포커스는 버튼에 두고 aria-activedescendant로 활성 항목을 가리키는 표준 패턴).

const SAMPLE = "가나다 Aa";

export function FontPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FontOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  // 열 때 활성 항목을 현재 선택에 맞춘다. 효과로 동기화하면 렌더가 한 번 더 돈다 —
  // 여는 동작에서 함께 정한다.
  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  // 활성 항목이 목록 밖으로 나가면 보이도록 스크롤한다
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const commit = (index: number) => {
    const option = options[index];
    if (option !== undefined) onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openList();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((current) => Math.min(options.length - 1, current + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((current) => Math.max(0, current - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        // 포커스가 이 묶음 밖으로 나가면 닫는다 (바깥 클릭 포함)
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        data-font-picker
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="flex h-8 w-full items-center gap-2 rounded-md border border-tool-border bg-white px-2.5 text-left text-[13px] text-tool-ink focus:border-tool-accent focus:outline-none"
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        {selected?.css !== null && selected !== undefined && (
          <span
            aria-hidden
            className="shrink-0 text-tool-ink-soft"
            style={{ fontFamily: selected.css }}
          >
            {SAMPLE}
          </span>
        )}
        <span aria-hidden className="shrink-0 text-[10px] text-tool-ink-faint">
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border border-tool-border bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-font-option={option.value}
              // click은 blur 뒤에 와서 목록이 먼저 닫힌다 — mousedown에서 고른다
              onMouseDown={(event) => {
                event.preventDefault();
                commit(index);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={
                "flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] " +
                (index === activeIndex ? "bg-tool-bg-deep" : "")
              }
            >
              <span className="min-w-0 flex-1 truncate text-tool-ink">{option.label}</span>
              {option.css !== null && (
                <span
                  aria-hidden
                  className="shrink-0 text-[14px] text-tool-ink-soft"
                  style={{ fontFamily: option.css }}
                >
                  {SAMPLE}
                </span>
              )}
              {option.value === value && (
                <span aria-hidden className="shrink-0 text-[11px] text-tool-accent">
                  ✓
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
