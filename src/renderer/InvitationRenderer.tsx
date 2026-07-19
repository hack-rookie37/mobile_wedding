"use client";

import type { CSSProperties } from "react";
import type { ResolveAsset } from "@/invitation/assets/assetTypes";
import type { InvitationDocument, Section, Wedding } from "@/invitation/schema/document";
import { THEMES } from "@/invitation/schema/themes";
import { RendererProvider, type RendererMode } from "./RendererContext";
import { CalendarSection } from "./sections/CalendarSection";
import { ClosingSection } from "./sections/ClosingSection";
import { ContactsSection } from "./sections/ContactsSection";
import { CoupleProfileSection } from "./sections/CoupleProfileSection";
import { GallerySection } from "./sections/GallerySection";
import { GiftAccountSection } from "./sections/GiftAccountSection";
import { GreetingSection } from "./sections/GreetingSection";
import { HeroSection } from "./sections/HeroSection";
import { RsvpSection } from "./sections/RsvpSection";
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
  }
}

export interface InvitationRendererProps {
  doc: InvitationDocument;
  mode: RendererMode;
  resolveAsset: ResolveAsset;
  selectedSectionId?: string | null;
  onSectionSelect?: (sectionId: string) => void;
  // 발행된 공개 페이지(/i/[slug])만 전달한다 — 그 외 화면의 RSVP 폼은 제출 불가 상태
  rsvpSlug?: string;
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
  rsvpSlug,
}: InvitationRendererProps) {
  const theme = THEMES[doc.theme.id];
  const t = theme.tokens;

  const canvasVars = {
    "--canvas-paper": t.paper,
    "--canvas-ink": t.ink,
    "--canvas-ink-soft": t.inkSoft,
    "--canvas-accent": t.accent,
    "--canvas-line": t.line,
    "--canvas-font-heading": t.headingFont,
    "--canvas-font-hand": t.handFont,
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
        rsvpSlug: rsvpSlug ?? null,
      }}
    >
      <div
        data-invitation-root
        data-canvas-theme={theme.id}
        className="w-full bg-(--canvas-paper) text-(--canvas-ink) antialiased"
        style={canvasVars}
      >
        {doc.sections
          .filter((section) => section.visible)
          .map((section, index) => (
            <SectionSwitch key={section.id} section={section} wedding={doc.wedding} index={index} />
          ))}
      </div>
    </RendererProvider>
  );
}
