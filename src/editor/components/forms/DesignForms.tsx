"use client";

import type {
  ClosingSection,
  FontId,
  GallerySection,
  HeroSection,
  PhotoEffects,
  Section,
} from "@/invitation/schema/document";
import { PT_MAX, PT_MIN } from "@/invitation/schema/themes";
import { FieldLabel, NumberField, SegmentedField, ToggleField } from "@/ui/fields";
import { useEditor } from "../../EditorStoreContext";
import { SECTION_VARIANT_OPTIONS } from "../../sectionMeta";
import { useFontOptions } from "./FontFields";
import { FontPicker } from "./FontPicker";

function InfoNote({ children }: { children: string }) {
  return (
    <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
      {children}
    </p>
  );
}

const PHOTO_ASPECT_OPTIONS = [
  { value: "1/1", label: "1:1" },
  { value: "4/5", label: "4:5" },
  { value: "3/4", label: "3:4" },
  { value: "9/16", label: "9:16" },
] as const;

function usePatchContent(sectionId: string) {
  const dispatch = useEditor((s) => s.dispatch);
  return (patch: Record<string, unknown>) =>
    dispatch({ type: "updateSectionContent", sectionId, patch });
}

// 전면 사진(메인·맺음말)의 연출 — 세로 길이 + 효과. 레이아웃 선택지가 없는 자리를 대신한다.
function PhotoEffectsFields({ section }: { section: HeroSection | ClosingSection }) {
  const patch = usePatchContent(section.id);
  const { effects } = section.content;
  const patchEffects = (p: Partial<PhotoEffects>) => patch({ effects: { ...effects, ...p } });

  return (
    <div className="space-y-4">
      <SegmentedField
        label="사진 세로 길이"
        value={section.content.photoAspect}
        options={[...PHOTO_ASPECT_OPTIONS]}
        onChange={(photoAspect) => patch({ photoAspect })}
      />
      <div>
        <FieldLabel>효과</FieldLabel>
        <div className="space-y-1">
          <ToggleField
            label="하단 페이드아웃"
            checked={effects.fadeBottom}
            onChange={(fadeBottom) => patchEffects({ fadeBottom })}
          />
          <ToggleField
            label="반짝임"
            checked={effects.sparkle}
            onChange={(sparkle) => patchEffects({ sparkle })}
          />
        </div>
      </div>
      <NumberField
        label="밝기"
        value={Math.round(effects.brightness * 100)}
        min={30}
        max={150}
        step={5}
        unit="%"
        onChange={(percent) => patchEffects({ brightness: percent / 100 })}
      />
      <NumberField
        label="투명도"
        value={Math.round(effects.opacity * 100)}
        min={20}
        max={100}
        step={5}
        unit="%"
        onChange={(percent) => patchEffects({ opacity: percent / 100 })}
      />
    </div>
  );
}

// strip·slider는 사진 한 장을 크게 보여주므로 세로 비율을 고를 수 있다 (격자형은 고정)
function GalleryAspectField({ section }: { section: GallerySection }) {
  const patch = usePatchContent(section.id);
  const freeAspect = section.layout.variant === "strip" || section.layout.variant === "slider";

  if (!freeAspect) {
    return <InfoNote>사진 세로 길이는 대형 스트립·슬라이더에서만 고를 수 있습니다.</InfoNote>;
  }
  return (
    <SegmentedField
      label="사진 세로 길이"
      value={section.content.photoAspect}
      options={[...PHOTO_ASPECT_OPTIONS]}
      onChange={(photoAspect) => patch({ photoAspect })}
    />
  );
}

// '레이아웃' 탭 — setSectionVariant (content·asset은 엔진이 보존을 보장)
export function LayoutForm({ section }: { section: Section }) {
  const dispatch = useEditor((s) => s.dispatch);
  const options = SECTION_VARIANT_OPTIONS[section.type];

  // 메인은 레이아웃이 하나뿐이다 — 이 탭에서는 전면 사진 연출을 고른다
  if (section.type === "hero") {
    return <PhotoEffectsFields section={section} />;
  }
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
      {section.type === "gallery" && <GalleryAspectField section={section} />}
      {section.type === "closing" && section.layout.variant === "photo" && (
        <PhotoEffectsFields section={section} />
      )}
      <InfoNote>레이아웃을 바꿔도 입력한 내용과 사진은 그대로 유지됩니다.</InfoNote>
    </div>
  );
}

// 섹션 override 한 줄 — 값이 없으면 전체 설정값을 보여주고, 있으면 되돌리기 버튼이 붙는다
function SectionOverride({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div>
      <NumberField
        label={label}
        value={value ?? fallback}
        min={PT_MIN}
        max={PT_MAX}
        step={0.5}
        unit="pt"
        onChange={onChange}
      />
      {value !== undefined && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="mt-1.5 text-[12px] text-tool-ink-soft underline underline-offset-2"
        >
          전체 설정 따르기
        </button>
      )}
    </div>
  );
}

function ColorOverride({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value ?? "#222222"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-tool-border bg-white p-0.5"
        />
        <button
          type="button"
          disabled={value === undefined}
          onClick={() => onChange(undefined)}
          className="text-[12px] text-tool-ink-soft underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
        >
          전체 설정 따르기
        </button>
      </div>
    </div>
  );
}

// '스타일' 탭 — updateSectionSettings (여백·진입 애니메이션·섹션별 글꼴·색)
export function StyleForm({ section }: { section: Section }) {
  const dispatch = useEditor((s) => s.dispatch);
  const typography = useEditor((s) => s.doc.typography);
  const fontOptions = useFontOptions("전체 설정 따름", "inherit");
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
      <div>
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
        <p className="mt-1.5 text-[11px] leading-[1.5] text-tool-ink-faint">
          고르면 미리보기에서 그 자리에서 한 번 재생됩니다.
        </p>
      </div>
      <FontPicker
        label="글꼴 (이 섹션만)"
        value={section.style.fontFamily ?? "inherit"}
        options={fontOptions}
        onChange={(value) =>
          patch({ fontFamily: value === "inherit" ? undefined : (value as FontId) })
        }
      />
      <SectionOverride
        label="제목 크기 (이 섹션만)"
        value={section.style.headingPt}
        fallback={typography.headingPt}
        onChange={(headingPt) => patch({ headingPt })}
      />
      <SectionOverride
        label="본문 크기 (이 섹션만)"
        value={section.style.bodyPt}
        fallback={typography.bodyPt}
        onChange={(bodyPt) => patch({ bodyPt })}
      />
      <ColorOverride
        label="글자색 (이 섹션만)"
        value={section.style.color}
        onChange={(color) => patch({ color })}
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
