"use client";

import type { CSSProperties } from "react";
import type { ResolveAsset } from "@/invitation/assets/assetTypes";
import { customFontAssetIds } from "@/invitation/lib/assetRefs";
import type { InvitationDocument, Section, Wedding } from "@/invitation/schema/document";
import { resolvePalette, THEMES } from "@/invitation/schema/themes";
import { CustomFontFaces, type ResolveFontUrl } from "./CustomFontFaces";
import { INHERITED_BODY_STYLE, textRoleVars } from "./textRoles";
import { MusicToggle } from "./MusicToggle";
import { RendererProvider, type RendererMode, type RsvpTarget } from "./RendererContext";
import { CalendarSection } from "./sections/CalendarSection";
import { ClosingSection } from "./sections/ClosingSection";
import { ContactsSection } from "./sections/ContactsSection";
import { CoupleProfileSection } from "./sections/CoupleProfileSection";
import { GallerySection } from "./sections/GallerySection";
import { GiftAccountSection } from "./sections/GiftAccountSection";
import { GreetingSection } from "./sections/GreetingSection";
import { HeroSection } from "./sections/HeroSection";
import { RsvpSection } from "./sections/RsvpSection";
import { ShareSection } from "./sections/ShareSection";
import { TransportationSection } from "./sections/TransportationSection";
import { VenueSection } from "./sections/VenueSection";
import { VideoSection } from "./sections/VideoSection";

function SectionSwitch({
  section,
  wedding,
  index,
}: {
  section: Section;
  wedding: Wedding;
  index: number; // 보이는 섹션 기준 순번 (mono 테마의 번호 라벨 등에 사용)
}) {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} wedding={wedding} index={index} />;
    case "greeting":
      return <GreetingSection section={section} wedding={wedding} index={index} />;
    case "coupleProfile":
      return <CoupleProfileSection section={section} wedding={wedding} index={index} />;
    case "calendar":
      return <CalendarSection section={section} wedding={wedding} index={index} />;
    case "gallery":
      return <GallerySection section={section} index={index} />;
    case "venue":
      return <VenueSection section={section} wedding={wedding} index={index} />;
    case "video":
      return <VideoSection section={section} index={index} />;
    case "transportation":
      return <TransportationSection section={section} index={index} />;
    case "contacts":
      return <ContactsSection section={section} index={index} />;
    case "giftAccount":
      return <GiftAccountSection section={section} index={index} />;
    case "rsvp":
      return <RsvpSection section={section} index={index} />;
    case "closing":
      return <ClosingSection section={section} index={index} />;
    case "share":
      return <ShareSection section={section} wedding={wedding} index={index} />;
  }
}

export interface InvitationRendererProps {
  doc: InvitationDocument;
  mode: RendererMode;
  resolveAsset: ResolveAsset;
  selectedSectionId?: string | null;
  onSectionSelect?: (sectionId: string) => void;
  // 발행된 공개 페이지(/i/[slug])만 전달한다 — 그 외 화면의 RSVP 폼은 제출 불가 상태
  rsvpTarget?: RsvpTarget;
  // 배경음악 파일 URL — 호스트(공개 페이지·미리보기·편집기)가 doc.music.assetId를 해석해 전달
  musicUrl?: string | null;
  // 업로드 폰트 파일 URL 해석기 — 문서가 참조하는 id는 렌더러가 스스로 찾는다
  resolveFontUrl?: ResolveFontUrl;
  // 편집기 전용: 이 토큰이 바뀌면 해당 섹션의 진입 애니메이션을 그 자리에서 다시 재생한다
  motionReplay?: { sectionId: string; token: number } | null;
  // 카카오 JS 앱 키 — 공개 페이지만 넘긴다. 없으면 공유 영역에 링크 복사만 나온다.
  kakaoJsKey?: string | null;
  // 예식 일정(.ics) 주소 — 게스트 화면만 넘긴다 (편집기는 저장할 대상이 없다)
  calendarIcsUrl?: string | null;
}

// 편집기 미리보기와 공개 페이지가 공유하는 유일한 renderer (ADR-004).
// 규칙: 뷰포트 단위·미디어 쿼리 금지, editor 모듈 import 금지 — 컨테이너 폭에만 반응한다.
// 테마는 토큰(CSS 변수)과 섹션 variant 선택만 바꾼다 — 문서 내용에는 관여하지 않는다 (ADR-014).
export function InvitationRenderer({
  doc,
  mode,
  resolveAsset,
  selectedSectionId = null,
  onSectionSelect,
  rsvpTarget,
  musicUrl = null,
  resolveFontUrl,
  motionReplay = null,
  kakaoJsKey = null,
  calendarIcsUrl = null,
}: InvitationRendererProps) {
  const theme = THEMES[doc.theme.id];
  const t = theme.tokens;
  const fontAssetIds = [...customFontAssetIds(doc)];

  // 공유 카드 대표 사진 — 메인 섹션의 사진을 쓴다 (문서의 얼굴이라 별도 설정을 두지 않는다)
  const heroPhotoId = doc.sections.find((s) => s.type === "hero")?.content.photoAssetId ?? null;
  const shareImageUrl = heroPhotoId === null ? null : (resolveAsset(heroPhotoId)?.src ?? null);

  // 글자 역할(ADR-035)은 CSS 변수로만 전달된다 — 섹션이 같은 이름을 다시 정의해 덮는다.
  // 여기의 --canvas-font-*는 '테마가 주는 기본 글꼴'이고, 문서가 고른 글꼴은 역할 변수로 온다.
  const palette = resolvePalette(t, doc.theme.palette);
  const canvasVars = {
    "--canvas-paper": palette.paper,
    "--canvas-ink": palette.ink,
    "--canvas-ink-soft": palette.inkSoft,
    "--canvas-accent": palette.accent,
    "--canvas-line": palette.line,
    "--canvas-font-heading": t.headingFont,
    "--canvas-font-body": t.bodyFont,
    "--canvas-font-hand": t.handFont,
    ...textRoleVars(doc.typography.roles),
    "--canvas-radius-photo": t.radiusPhoto,
    "--canvas-pad-sm": t.padSm,
    "--canvas-pad-md": t.padMd,
    "--canvas-pad-lg": t.padLg,
    "--canvas-motion-duration": `${t.motionMs}ms`,
    "--canvas-motion-ease": t.motionEase,
    "--canvas-rise-distance": t.riseDistance,
  } as CSSProperties;

  return (
    <RendererProvider
      value={{
        mode,
        resolveAsset,
        selectedSectionId,
        onSectionSelect: onSectionSelect ?? null,
        theme,
        accentColor: palette.accent,
        rsvpTarget: rsvpTarget ?? null,
        motionReplay,
        kakaoJsKey,
        shareImageUrl,
        calendarIcsUrl,
      }}
    >
      <div
        data-invitation-root
        data-canvas-theme={theme.id}
        className="w-full bg-(--canvas-paper) antialiased"
        style={{ ...canvasVars, ...INHERITED_BODY_STYLE }}
      >
        <CustomFontFaces assetIds={fontAssetIds} resolveFontUrl={resolveFontUrl ?? null} />
        {musicUrl !== null && (
          <MusicToggle
            url={musicUrl}
            volume={doc.music.volume}
            speed={doc.music.speed}
            autoplay={doc.music.autoplay}
          />
        )}
        {doc.sections
          .filter((section) => section.visible)
          .map((section, index) => (
            <SectionSwitch key={section.id} section={section} wedding={doc.wedding} index={index} />
          ))}
      </div>
    </RendererProvider>
  );
}
