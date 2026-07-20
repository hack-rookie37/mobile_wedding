"use client";

import { kakaoJsKeyFromEnv } from "@/invitation/lib/kakaoShare";
import { parseVideoUrl } from "@/invitation/lib/videoEmbed";
import {
  SECTION_LABEL_MAX,
  type CalendarSection,
  type ClosingSection,
  type FontId,
  type HeroOverlay,
  type ShareSection,
  type GreetingSection,
  type HeroSection,
  type RsvpCollect,
  type RsvpSection,
  type VenueSection,
  type TitledSection,
  type VideoSection,
} from "@/invitation/schema/document";
import { PT_MAX, PT_MIN, resolvePalette, THEMES } from "@/invitation/schema/themes";
import { PHOTO_ASPECT_CSS } from "@/renderer/primitives/PhotoFrame";
import {
  ColorField,
  ColorOverrideField,
  FieldLabel,
  NumberField,
  SegmentedField,
  TextAreaField,
  TextField,
  ToggleField,
} from "@/ui/fields";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";
import { FrameEditor } from "../media/FrameEditor";
import { useFontOptions } from "./FontFields";
import { FontPicker } from "./FontPicker";
import { PhotoPickField } from "./PhotoPickField";

function usePatchContent(sectionId: string) {
  const dispatch = useEditor((s) => s.dispatch);
  return (patch: Record<string, unknown>) =>
    dispatch({ type: "updateSectionContent", sectionId, patch });
}

// 눈썹 라벨 — 제목 위에 작게 붙는 글자("INVITATION" 등). 모든 섹션이 공유하므로
// 타입별 폼마다 두지 않고 '내용' 탭 맨 위에서 한 번만 그린다 (캔버스 순서와도 같다).
export function SectionLabelField({ section }: { section: TitledSection }) {
  const patch = usePatchContent(section.id);
  return (
    <div>
      <TextField
        label="눈썹 라벨"
        value={section.content.label}
        placeholder="비우면 표시하지 않습니다"
        onChange={(label) => patch({ label })}
      />
      <p className="mt-1.5 text-[11px] leading-[1.5] text-tool-ink-faint">
        제목 위에 붙는 작은 글자입니다. 테마에 따라 대문자·소문자로 그려집니다. 최대{" "}
        {SECTION_LABEL_MAX}자.
      </p>
    </div>
  );
}

// 사진 위에 얹는 문구 — 글자·위치·크기·글꼴·색을 한자리에서 고른다.
// 다른 섹션은 전역 typography를 따르지만 여기는 사진 위라 균형이 사진마다 달라진다.
function HeroOverlayFields({ section }: { section: HeroSection }) {
  const patch = usePatchContent(section.id);
  const { overlay } = section.content;
  const fontOptions = useFontOptions("제목 글꼴 따름", "theme");
  const patchOverlay = (p: Partial<HeroOverlay>) => patch({ overlay: { ...overlay, ...p } });

  return (
    <div className="space-y-4 rounded-md border border-tool-border p-3">
      <TextField
        label="사진 위 문구"
        value={overlay.text}
        onChange={(text) => patchOverlay({ text })}
        placeholder="we're getting married"
      />
      {overlay.text !== "" && (
        <>
          <SegmentedField
            label="위치"
            value={overlay.position}
            options={[
              { value: "top", label: "위" },
              { value: "center", label: "가운데" },
              { value: "bottom", label: "아래" },
            ]}
            onChange={(position) => patchOverlay({ position })}
          />
          <NumberField
            label="글자 크기"
            value={overlay.sizePt}
            min={PT_MIN}
            max={PT_MAX}
            step={0.5}
            unit="pt"
            onChange={(sizePt) => patchOverlay({ sizePt })}
          />
          <FontPicker
            label="글꼴"
            value={overlay.font}
            options={fontOptions}
            onChange={(font) => patchOverlay({ font: font as FontId })}
          />
          <ColorField
            label="글자색"
            value={overlay.color}
            onChange={(color) => patchOverlay({ color })}
          />
          <p className="text-[11px] leading-[1.5] text-tool-ink-faint">
            사진 위에서 읽히도록 옅은 그림자가 함께 깔립니다. 사진의 밝기·투명도를 낮춰도 이 문구는
            또렷하게 남습니다.
          </p>
        </>
      )}
    </div>
  );
}

export function PhaseNote({ children }: { children: string }) {
  return (
    <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
      {children}
    </p>
  );
}

export function HeroForm({ section }: { section: HeroSection }) {
  const patch = usePatchContent(section.id);
  const dispatch = useEditor((s) => s.dispatch);
  const { resolveAsset } = useAssetLibrary();
  const { content } = section;
  const asset = content.photoAssetId !== null ? resolveAsset(content.photoAssetId) : null;

  return (
    <div className="space-y-4">
      <TextField
        label="태그라인"
        value={content.tagline}
        onChange={(tagline) => patch({ tagline })}
        placeholder="THE MARRIAGE OF"
      />

      <HeroOverlayFields section={section} />

      <PhotoPickField
        label="대표 사진"
        assetId={content.photoAssetId}
        pickMode={{ kind: "hero", sectionId: section.id }}
        onRemove={() =>
          dispatch({
            type: "removeAssetReference",
            sectionId: section.id,
            slot: { kind: "heroPhoto" },
          })
        }
      />

      {content.photoAssetId !== null && (
        <FrameEditor
          asset={asset}
          frame={content.photoFrame}
          aspectRatio={PHOTO_ASPECT_CSS[content.photoAspect]}
          onChange={(photoFrame) => patch({ photoFrame })}
        />
      )}

      <div className="space-y-1">
        <ToggleField
          label="예식 일시 표시"
          checked={content.showDate}
          onChange={(showDate) => patch({ showDate })}
        />
        <ToggleField
          label="예식장 표시"
          checked={content.showVenue}
          onChange={(showVenue) => patch({ showVenue })}
        />
      </div>
      <PhaseNote>
        이름과 예식 정보는 왼쪽 ‘기본 정보’에서 수정합니다. 사진 세로 길이와 페이드아웃·반짝임 같은
        연출은 ‘레이아웃’ 탭에 있습니다.
      </PhaseNote>
    </div>
  );
}

export function GreetingForm({ section }: { section: GreetingSection }) {
  const patch = usePatchContent(section.id);
  const { content } = section;
  return (
    <div className="space-y-4">
      <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
      <TextAreaField
        label="본문"
        value={content.body}
        onChange={(body) => patch({ body })}
        rows={9}
      />
      <SegmentedField
        label="정렬"
        value={content.align}
        options={[
          { value: "center", label: "가운데" },
          { value: "left", label: "왼쪽" },
        ]}
        onChange={(align) => patch({ align })}
      />
      <ToggleField
        label="혼주 표기"
        checked={content.showParents}
        onChange={(showParents) => patch({ showParents })}
      />
    </div>
  );
}

export function CalendarForm({ section }: { section: CalendarSection }) {
  const patch = usePatchContent(section.id);
  const { content } = section;
  return (
    <div className="space-y-4">
      <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
      <ToggleField
        label="D-day 표시"
        checked={content.showDday}
        onChange={(showDday) => patch({ showDday })}
      />
      {content.showDday && (
        <SegmentedField
          label="D-day 표시 방식"
          value={content.ddayStyle}
          options={[
            { value: "countdown", label: "실시간 카운트다운" },
            { value: "badge", label: "D-N 배지" },
          ]}
          onChange={(ddayStyle) => patch({ ddayStyle })}
        />
      )}
      <PhaseNote>
        날짜와 시간은 왼쪽 ‘기본 정보’의 예식 일시를 따릅니다. 게스트는 ‘캘린더에 일정 저장’
        버튼으로 자신의 캘린더에 일정을 추가할 수 있습니다.
      </PhaseNote>
    </div>
  );
}

export function VenueForm({
  section,
  onOpenWedding,
}: {
  section: VenueSection;
  onOpenWedding: () => void;
}) {
  const patch = usePatchContent(section.id);
  const dispatch = useEditor((s) => s.dispatch);
  const { content } = section;
  return (
    <div className="space-y-4">
      <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
      <TextAreaField
        label="안내 문구"
        value={content.note}
        onChange={(note) => patch({ note })}
        rows={5}
      />
      <PhotoPickField
        label="약도 이미지"
        assetId={content.mapImageAssetId}
        pickMode={{ kind: "venueMap", sectionId: section.id }}
        onRemove={() =>
          dispatch({
            type: "removeAssetReference",
            sectionId: section.id,
            slot: { kind: "venueMap" },
          })
        }
      >
        <p className="mt-2 text-[11px] leading-[1.5] text-tool-ink-faint">
          예식장 안내도나 직접 그린 약도를 올리면 원본 비율 그대로 표시됩니다.
        </p>
      </PhotoPickField>
      <ToggleField
        label="외부 지도 열기 버튼 (네이버·카카오맵·티맵)"
        checked={content.showMapButtons}
        onChange={(showMapButtons) => patch({ showMapButtons })}
      />
      <button
        type="button"
        onClick={onOpenWedding}
        className="text-[12px] text-tool-accent underline underline-offset-2"
      >
        예식장 이름·주소는 기본 정보에서 수정 →
      </button>
    </div>
  );
}

export function VideoForm({ section }: { section: VideoSection }) {
  const patch = usePatchContent(section.id);
  const { content } = section;
  const embed = content.url === "" ? null : parseVideoUrl(content.url);

  return (
    <div className="space-y-4">
      <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
      <TextField
        label="동영상 URL"
        value={content.url}
        onChange={(url) => patch({ url })}
        placeholder="https://youtu.be/…"
      />
      {content.url === "" ? (
        <PhaseNote>
          YouTube 또는 Vimeo 동영상 주소를 붙여넣으세요. 동영상 파일 직접 업로드는 지원하지
          않습니다.
        </PhaseNote>
      ) : embed !== null ? (
        <p className="text-[12px] text-tool-ink-soft">
          {embed.provider === "youtube" ? "YouTube" : "Vimeo"} 동영상으로 인식했습니다.
        </p>
      ) : (
        <p className="text-[12px] text-tool-danger">
          인식할 수 없는 주소입니다 — YouTube·Vimeo 링크만 지원합니다.
        </p>
      )}
    </div>
  );
}

const RSVP_COLLECT_LABELS: Record<keyof RsvpCollect, string> = {
  side: "신랑측/신부측 구분",
  companions: "동반 인원",
  meal: "식사 여부",
  phone: "연락처",
  message: "전하고 싶은 말",
};

export function RsvpForm({ section }: { section: RsvpSection }) {
  const patch = usePatchContent(section.id);
  const { content } = section;
  return (
    <div className="space-y-4">
      <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
      <TextAreaField
        label="안내 문구"
        value={content.body}
        onChange={(body) => patch({ body })}
        rows={4}
      />
      <div>
        <FieldLabel>마감일 (선택)</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            aria-label="마감일"
            value={content.deadline === null ? "" : content.deadline.slice(0, 16)}
            onChange={(e) =>
              patch({ deadline: e.target.value === "" ? null : `${e.target.value}:00+09:00` })
            }
            className="h-8 min-w-0 flex-1 rounded-md border border-tool-border bg-white px-2.5 text-[13px] text-tool-ink focus:border-tool-accent focus:ring-[3px] focus:ring-tool-accent/15 focus:outline-none"
          />
          {content.deadline !== null && (
            <button
              type="button"
              onClick={() => patch({ deadline: null })}
              className="shrink-0 text-[12px] text-tool-ink-soft underline underline-offset-2"
            >
              없애기
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-[1.5] text-tool-ink-faint">
          마감 후에는 게스트가 제출할 수 없습니다. 비워 두면 마감 없이 받습니다.
        </p>
      </div>
      <div>
        <FieldLabel>게스트에게 물어볼 항목</FieldLabel>
        <div className="space-y-1">
          {(Object.keys(RSVP_COLLECT_LABELS) as (keyof RsvpCollect)[]).map((key) => (
            <ToggleField
              key={key}
              label={RSVP_COLLECT_LABELS[key]}
              checked={content.collect[key]}
              onChange={(checked) => patch({ collect: { ...content.collect, [key]: checked } })}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-[1.5] text-tool-ink-faint">
          성함·참석 여부·개인정보 동의는 항상 수집합니다.
        </p>
      </div>
      <PhaseNote>
        응답은 청첩장 문서와 분리된 저장소에 보관되며, 상단 ‘RSVP 응답’에서 확인·삭제할 수 있습니다.
        AI 도우미를 포함해 문서를 읽는 어떤 기능도 응답을 볼 수 없습니다.
      </PhaseNote>
    </div>
  );
}

// 공유하기 — 링크 복사는 어디서나 되지만, 카카오톡 공유는 카카오 JS 앱 키가 있어야 한다.
// 키가 없으면 공개 페이지에 카카오 버튼이 아예 나오지 않으므로 그 사실을 여기서 알린다.
export function ShareForm({ section }: { section: ShareSection }) {
  const patch = usePatchContent(section.id);
  const theme = useEditor((s) => s.doc.theme);
  const { content } = section;
  const kakaoReady = kakaoJsKeyFromEnv() !== null;
  // 색을 고르지 않았을 때 스와치가 보여 줄 색 — 캔버스가 실제로 칠하는 강조색과 같아야 한다
  const accentColor = resolvePalette(THEMES[theme.id].tokens, theme.palette).accent;

  return (
    <div className="space-y-4">
      <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
      <TextAreaField
        label="안내 문구"
        value={content.body}
        onChange={(body) => patch({ body })}
        rows={3}
      />
      <div>
        <ColorOverrideField
          label="카카오톡 버튼 색"
          value={content.kakaoButtonColor}
          fallback={accentColor}
          resetLabel="테마 강조색 따르기"
          onChange={(kakaoButtonColor) => patch({ kakaoButtonColor })}
        />
        <p className="mt-1.5 text-[11px] leading-[1.5] text-tool-ink-faint">
          버튼 위 글자·심볼 색은 고른 색의 밝기에 맞춰 자동으로 정해집니다. 카카오 브랜드 노랑을
          쓰려면 #FEE500을 고르세요.
        </p>
      </div>
      <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
        {kakaoReady
          ? "링크 복사와 카카오톡 공유 버튼이 게스트 화면에 표시됩니다. 두 버튼은 발행된 페이지에서만 눌립니다."
          : "카카오 JS 앱 키(NEXT_PUBLIC_KAKAO_JS_KEY)가 설정되지 않아 게스트 화면에는 ‘링크 복사’만 표시됩니다. 카카오 개발자 사이트에서 앱을 만들고 JavaScript 키를 환경변수에 넣으면 카카오톡 공유 버튼이 함께 나옵니다."}
      </p>
    </div>
  );
}

export function ClosingForm({ section }: { section: ClosingSection }) {
  const patch = usePatchContent(section.id);
  const dispatch = useEditor((s) => s.dispatch);
  const { resolveAsset } = useAssetLibrary();
  const { content } = section;
  const asset = content.photoAssetId !== null ? resolveAsset(content.photoAssetId) : null;

  return (
    <div className="space-y-4">
      <TextField label="제목" value={content.title} onChange={(title) => patch({ title })} />
      <TextAreaField
        label="마무리 문구"
        value={content.body}
        onChange={(body) => patch({ body })}
        rows={6}
      />
      <PhotoPickField
        label="마무리 사진"
        assetId={content.photoAssetId}
        pickMode={{ kind: "closing", sectionId: section.id }}
        onRemove={() =>
          dispatch({
            type: "removeAssetReference",
            sectionId: section.id,
            slot: { kind: "closingPhoto" },
          })
        }
      >
        {section.layout.variant === "simple" && content.photoAssetId !== null && (
          <p className="mt-2 text-[11px] leading-[1.5] text-tool-ink-faint">
            ‘텍스트’ 레이아웃에서는 사진이 표시되지 않습니다.
          </p>
        )}
      </PhotoPickField>
      {content.photoAssetId !== null && (
        <FrameEditor
          asset={asset}
          frame={content.photoFrame}
          aspectRatio={PHOTO_ASPECT_CSS[content.photoAspect]}
          onChange={(photoFrame) => patch({ photoFrame })}
        />
      )}
    </div>
  );
}
