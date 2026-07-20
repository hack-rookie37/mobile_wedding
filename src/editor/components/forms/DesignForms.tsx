"use client";

import type { FontId, Section } from "@/invitation/schema/document";
import { FONT_CHOICES } from "@/invitation/schema/themes";
import { FieldLabel, SegmentedField, SelectField, ToggleField } from "@/ui/fields";
import { useEditor } from "../../EditorStoreContext";
import { SECTION_VARIANT_OPTIONS } from "../../sectionMeta";

function InfoNote({ children }: { children: string }) {
  return (
    <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
      {children}
    </p>
  );
}

// '레이아웃' 탭 — setSectionVariant (content·asset은 엔진이 보존을 보장)
export function LayoutForm({ section }: { section: Section }) {
  const dispatch = useEditor((s) => s.dispatch);
  const options = SECTION_VARIANT_OPTIONS[section.type];

  if (options.length === 0) {
    return <InfoNote>이 섹션은 단일 레이아웃을 사용합니다.</InfoNote>;
  }
  return (
    <div className="space-y-4">
      <SegmentedField
        label="레이아웃"
        value={section.layout.variant}
        options={options}
        onChange={(variant) =>
          dispatch({ type: "setSectionVariant", sectionId: section.id, variant })
        }
      />
      <InfoNote>레이아웃을 바꿔도 입력한 내용과 사진은 그대로 유지됩니다.</InfoNote>
    </div>
  );
}

// '스타일' 탭 — updateSectionSettings (여백·진입 애니메이션)
export function StyleForm({ section }: { section: Section }) {
  const dispatch = useEditor((s) => s.dispatch);
  const patch = (p: Record<string, unknown>) =>
    dispatch({ type: "updateSectionSettings", sectionId: section.id, patch: p });

  return (
    <div className="space-y-4">
      <SegmentedField
        label="상하 여백"
        value={section.style.paddingY}
        options={[
          { value: "sm", label: "좁게" },
          { value: "md", label: "보통" },
          { value: "lg", label: "넓게" },
        ]}
        onChange={(paddingY) => patch({ paddingY })}
      />
      <SegmentedField
        label="진입 애니메이션"
        value={section.style.animation}
        options={[
          { value: "none", label: "없음" },
          { value: "fade", label: "페이드" },
          { value: "rise", label: "라이즈" },
        ]}
        onChange={(animation) => patch({ animation })}
      />
      <SelectField
        label="글꼴 (이 섹션만)"
        value={section.style.fontFamily ?? "inherit"}
        options={[
          { value: "inherit", label: "전체 설정 따름" },
          ...Object.entries(FONT_CHOICES).map(([value, font]) => ({ value, label: font.label })),
        ]}
        onChange={(value) =>
          patch({ fontFamily: value === "inherit" ? undefined : (value as FontId) })
        }
      />
      <SegmentedField
        label="글자 크기 (이 섹션만)"
        value={section.style.fontScale ?? "inherit"}
        options={[
          { value: "inherit", label: "전체" },
          { value: "sm", label: "작게" },
          { value: "md", label: "보통" },
          { value: "lg", label: "크게" },
        ]}
        onChange={(value) => patch({ fontScale: value === "inherit" ? undefined : value })}
      />
      <InfoNote>모던 모노크롬 테마는 모션을 사용하지 않아 애니메이션이 적용되지 않습니다.</InfoNote>
    </div>
  );
}

// '고급' 탭 — 배경색 override · 표시 여부 · 섹션 ID
export function AdvancedForm({ section }: { section: Section }) {
  const dispatch = useEditor((s) => s.dispatch);
  const background = section.style.background;
  const isHero = section.type === "hero";

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>배경색 (테마 배경 대신 사용)</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="배경색 선택"
            value={background ?? "#ffffff"}
            onChange={(e) =>
              dispatch({
                type: "updateSectionSettings",
                sectionId: section.id,
                patch: { background: e.target.value },
              })
            }
            className="h-8 w-10 cursor-pointer rounded-md border border-tool-border bg-white p-0.5"
          />
          <button
            type="button"
            disabled={background === undefined}
            onClick={() =>
              dispatch({
                type: "updateSectionSettings",
                sectionId: section.id,
                patch: { background: undefined },
              })
            }
            className="text-[12px] text-tool-ink-soft underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
          >
            테마 기본값으로
          </button>
        </div>
      </div>

      {isHero ? (
        <InfoNote>메인 섹션은 항상 표시됩니다.</InfoNote>
      ) : (
        <ToggleField
          label="게스트에게 표시"
          checked={section.visible}
          onChange={(visible) =>
            dispatch({ type: "toggleSectionVisibility", sectionId: section.id, visible })
          }
        />
      )}

      <p className="text-[11px] text-tool-ink-faint">섹션 ID: {section.id}</p>
    </div>
  );
}
