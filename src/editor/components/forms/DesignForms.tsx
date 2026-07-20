"use client";

import {
  GALLERY_GAP_MAX,
  GALLERY_GAP_MIN,
  SECTION_PAD_X_MAX,
  SECTION_PAD_X_MIN,
  type ClosingSection,
  type FontId,
  type GallerySection,
  type HeroSection,
  type PhotoEffects,
  type Section,
} from "@/invitation/schema/document";
import { PT_MAX, PT_MIN } from "@/invitation/schema/themes";
import {
  ColorOverrideField,
  FieldLabel,
  NumberField,
  SegmentedField,
  ToggleField,
} from "@/ui/fields";
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

// 갤러리 사진의 생김새 — 세로 비율·모서리·간격.
// 세로 비율은 사진 한 장을 크게 보여주는 strip·slider에서만 고를 수 있다 (격자형은 타일이
// 맞아야 해서 고정). 모서리와 간격은 모든 레이아웃에 적용된다.
function GalleryPhotoFields({ section }: { section: GallerySection }) {
  const patch = usePatchContent(section.id);
  const { variant } = section.layout;
  const freeAspect = variant === "strip" || variant === "slider";

  return (
    <>
      {freeAspect ? (
        <SegmentedField
          label="사진 세로 길이"
          value={section.content.photoAspect}
          options={[...PHOTO_ASPECT_OPTIONS]}
          onChange={(photoAspect) => patch({ photoAspect })}
        />
      ) : (
        <InfoNote>사진 세로 길이는 대형 스트립·슬라이더에서만 고를 수 있습니다.</InfoNote>
      )}
      <SegmentedField
        label="사진 모서리"
        value={section.content.photoCorner}
        options={[
          { value: "sharp", label: "각지게" },
          { value: "rounded", label: "둥글게" },
        ]}
        onChange={(photoCorner) => patch({ photoCorner })}
      />
      <NumberField
        label="사진 간격"
        value={section.content.photoGapPx}
        min={GALLERY_GAP_MIN}
        max={GALLERY_GAP_MAX}
        step={1}
        unit="px"
        onChange={(photoGapPx) => patch({ photoGapPx })}
      />
    </>
  );
}

// 좌우 여백 — 0이면 콘텐츠가 캔버스 가로를 꽉 채운다.
// v10 전까지 전면 사진과 대형 스트립만 0이었고 나머지는 24px 고정이었다 (ADR-032).
function PaddingXField({ section }: { section: Section }) {
  const dispatch = useEditor((s) => s.dispatch);
  return (
    <div>
      <NumberField
        label="좌우 여백"
        value={section.style.paddingX}
        min={SECTION_PAD_X_MIN}
        max={SECTION_PAD_X_MAX}
        step={1}
        unit="px"
        onChange={(paddingX) =>
          dispatch({ type: "updateSectionSettings", sectionId: section.id, patch: { paddingX } })
        }
      />
      <p className="mt-1.5 text-[11px] leading-[1.5] text-tool-ink-faint">
        0으로 두면 화면 가로를 꽉 채웁니다.
      </p>
    </div>
  );
}

// '레이아웃' 탭 — setSectionVariant (content·asset은 엔진이 보존을 보장)
export function LayoutForm({ section }: { section: Section }) {
  const dispatch = useEditor((s) => s.dispatch);
  const options = SECTION_VARIANT_OPTIONS[section.type];

  // 메인은 레이아웃이 하나뿐이다 — 이 탭에서는 전면 사진 연출을 고른다
  if (section.type === "hero") {
    return (
      <div className="space-y-4">
        <PhotoEffectsFields section={section} />
        <PaddingXField section={section} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {options.length > 0 ? (
        <SegmentedField
          label="레이아웃"
          value={section.layout.variant}
          options={options}
          onChange={(variant) =>
            dispatch({ type: "setSectionVariant", sectionId: section.id, variant })
          }
        />
      ) : (
        <InfoNote>이 섹션은 단일 레이아웃을 사용합니다.</InfoNote>
      )}
      {section.type === "gallery" && <GalleryPhotoFields section={section} />}
      {section.type === "closing" && section.layout.variant === "photo" && (
        <PhotoEffectsFields section={section} />
      )}
      <PaddingXField section={section} />
      {options.length > 0 && (
        <InfoNote>레이아웃을 바꿔도 입력한 내용과 사진은 그대로 유지됩니다.</InfoNote>
      )}
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
      <ColorOverrideField
        label="글자색 (이 섹션만)"
        value={section.style.color}
        fallback="#222222"
        resetLabel="전체 설정 따르기"
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
      <ColorOverrideField
        label="배경색 (테마 배경 대신 사용)"
        value={background}
        fallback="#ffffff"
        resetLabel="테마 기본값으로"
        onChange={(value) =>
          dispatch({
            type: "updateSectionSettings",
            sectionId: section.id,
            patch: { background: value },
          })
        }
      />

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
