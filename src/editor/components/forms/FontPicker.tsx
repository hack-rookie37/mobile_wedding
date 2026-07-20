"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldLabel } from "@/ui/fields";
import { readRecentFonts, rememberFont } from "../../lib/recentFonts";
import type { FontOption } from "./FontFields";

// 폰트 고르기 — 각 줄을 그 폰트로 그려서 눈으로 고르게 한다.
//
// 네이티브 <select>를 쓰지 않는 이유: <option>에 font-family를 줘도 macOS는 OS 팝업
// 메뉴로 그려서 무시한다. 목록을 직접 그리는 대신 listbox 키보드 조작을 손으로 구현한다
// (포커스는 버튼에 두고 aria-activedescendant로 활성 항목을 가리키는 표준 패턴).

const SAMPLE = "가나다 Aa";

// 목록에 실제로 보여 줄 순서를 만든다: 최근 고른 글꼴이 위, 그 아래 전체 목록.
// 같은 글꼴이 위아래 두 번 나오는 편이 "어디 갔지"보다 낫다 — 전체 목록은 순서를 지킨다.
// 키보드 이동·활성 항목 표시가 전부 index 기반이라, 화면에 그리는 순서와 정확히 같은
// 배열 하나를 만들어 그것만 쓴다.
interface PickerRow {
  option: FontOption;
  index: number; // options 안에서의 원래 자리 — 선택 비교에 쓴다
  recent: boolean;
}

function buildRows(options: FontOption[], recentIds: string[]): PickerRow[] {
  const byValue = new Map(options.map((option, index) => [option.value, { option, index }]));
  const recent = recentIds
    .map((id) => byValue.get(id))
    .filter((found): found is { option: FontOption; index: number } => found !== undefined)
    .map(({ option, index }) => ({ option, index, recent: true }));
  const all = options.map((option, index) => ({ option, index, recent: false }));
  return [...recent, ...all];
}

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
  // 서버 렌더에는 localStorage가 없다. 목록은 열 때만 필요하므로 여는 순간 읽는다 —
  // effect로 동기화하면 마운트마다 렌더가 한 번 더 돈다.
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = buildRows(options, recentIds);
  const selected = options.find((option) => option.value === value);

  // 열 때 활성 항목을 현재 선택에 맞춘다. 효과로 동기화하면 렌더가 한 번 더 돈다 —
  // 여는 동작에서 함께 정한다.
  const openList = () => {
    const fresh = readRecentFonts();
    setRecentIds(fresh);
    // 활성 항목은 방금 읽은 목록 기준으로 정해야 한다 — 이번 렌더의 rows는 아직 옛 목록이다
    const freshRows = buildRows(options, fresh);
    setActiveIndex(
      Math.max(
        0,
        freshRows.findIndex((row) => !row.recent && row.option.value === value),
      ),
    );
    setOpen(true);
  };

  // 활성 항목이 목록 밖으로 나가면 보이도록 스크롤한다
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const commit = (index: number) => {
    const option = rows[index]?.option;
    if (option !== undefined) {
      onChange(option.value);
      setRecentIds(rememberFont(option.value));
    }
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
        setActiveIndex((current) => Math.min(rows.length - 1, current + 1));
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
        setActiveIndex(rows.length - 1);
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
          {rows.map((row, index) => (
            <li
              key={`${row.recent ? "recent" : "all"}-${row.option.value}`}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={row.option.value === value}
              data-font-option={row.option.value}
              data-font-recent={row.recent ? "" : undefined}
              // 최근 목록의 마지막 줄 아래에 경계선을 둔다 — 같은 글꼴이 두 번 보이는 이유가 된다
              style={
                row.recent && rows[index + 1]?.recent === false
                  ? { borderBottom: "1px solid var(--color-tool-border)", paddingBottom: "7px" }
                  : undefined
              }
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
              <span className="min-w-0 flex-1 truncate text-tool-ink">{row.option.label}</span>
              {row.option.css !== null && (
                <span
                  aria-hidden
                  className="shrink-0 text-[14px] text-tool-ink-soft"
                  style={{ fontFamily: row.option.css }}
                >
                  {SAMPLE}
                </span>
              )}
              {row.option.value === value && (
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
