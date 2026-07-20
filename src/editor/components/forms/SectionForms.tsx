"use client";

import { parseVideoUrl } from "@/invitation/lib/videoEmbed";
import type {
  CalendarSection,
  ClosingSection,
  GreetingSection,
  HeroSection,
  RsvpCollect,
  RsvpSection,
  VenueSection,
  VideoSection,
} from "@/invitation/schema/document";
import { PHOTO_ASPECT_CSS } from "@/renderer/primitives/PhotoFrame";
import { FieldLabel, SegmentedField, TextAreaField, TextField, ToggleField } from "@/ui/fields";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";
import { FrameEditor } from "../media/FrameEditor";
import { PhotoPickField } from "./PhotoPickField";

function usePatchContent(sectionId: string) {
  const dispatch = useEditor((s) => s.dispatch);
  return (patch: Record<string, unknown>) =>
    dispatch({ type: "updateSectionContent", sectionId, patch });
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
        label="외부 지도 열기 버튼 (네이버 지도·카카오맵·티맵)"
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
      <ToggleField
        label="링크 공유 버튼 표시"
        checked={content.showShare}
        onChange={(showShare) => patch({ showShare })}
      />
    </div>
  );
}
