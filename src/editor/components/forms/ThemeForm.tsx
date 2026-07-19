"use client";

import clsx from "clsx";
import { THEME_ORDER, THEMES } from "@/invitation/schema/themes";
import { useEditor } from "../../EditorStoreContext";

export function ThemeForm() {
  const current = useEditor((s) => s.doc.theme.id);
  const dispatch = useEditor((s) => s.dispatch);

  return (
    <div className="space-y-2">
      {THEME_ORDER.map((id) => {
        const theme = THEMES[id];
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => dispatch({ type: "setTheme", themeId: id })}
            className={clsx(
              "w-full rounded-md border p-3 text-left transition-colors",
              active
                ? "border-tool-accent ring-[3px] ring-tool-accent/15"
                : "border-tool-border hover:border-tool-border-strong",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-tool-ink">{theme.label}</span>
              <span className="flex gap-1">
                {[theme.tokens.paper, theme.tokens.accent, theme.tokens.ink].map((color, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="size-3 rounded-full border border-black/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            </span>
            <span className="mt-1 block text-[12px] leading-[1.5] text-tool-ink-soft">
              {theme.description}
            </span>
          </button>
        );
      })}
      <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
        테마는 디자인 토큰과 섹션 표현만 바꿉니다. 문구·사진·섹션 순서는 그대로 유지됩니다.
      </p>
    </div>
  );
}
