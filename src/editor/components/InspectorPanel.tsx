"use client";

import { useState } from "react";
import { Segmented } from "@/ui/fields";
import { useEditor } from "../EditorStoreContext";
import { SECTION_LABELS } from "../sectionMeta";
import { CoupleProfileForm } from "./forms/CoupleProfileForm";
import { AdvancedForm, LayoutForm, StyleForm } from "./forms/DesignForms";
import { GalleryForm } from "./forms/GalleryForm";
import { ContactsForm, GiftAccountForm, TransportationForm } from "./forms/ListSectionForms";
import {
  CalendarForm,
  ClosingForm,
  ShareForm,
  GreetingForm,
  HeroForm,
  RsvpForm,
  SectionLabelField,
  VenueForm,
  VideoForm,
} from "./forms/SectionForms";
import { ThemeForm } from "./forms/ThemeForm";
import { WeddingForm } from "./forms/WeddingForm";

type InspectorTab = "content" | "layout" | "style" | "advanced";

const TAB_OPTIONS: { value: InspectorTab; label: string }[] = [
  { value: "content", label: "내용" },
  { value: "layout", label: "레이아웃" },
  { value: "style", label: "스타일" },
  { value: "advanced", label: "고급" },
];

export function InspectorPanel() {
  const selected = useEditor((s) => s.selected);
  const select = useEditor((s) => s.select);
  const section = useEditor((s) =>
    selected.kind === "section"
      ? s.doc.sections.find((sec) => sec.id === selected.sectionId)
      : undefined,
  );
  const [tab, setTab] = useState<InspectorTab>("content");

  const heading =
    selected.kind === "wedding"
      ? "기본 정보"
      : selected.kind === "theme"
        ? "테마"
        : section
          ? SECTION_LABELS[section.type]
          : "섹션 없음";

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-tool-border bg-tool-surface">
      <div className="flex h-11 shrink-0 items-center border-b border-tool-border px-4">
        <h2 className="text-[13px] font-semibold text-tool-ink">{heading}</h2>
        {section && (
          <span className="ml-auto text-[11px] tracking-wider text-tool-ink-faint uppercase">
            {section.type}
          </span>
        )}
      </div>

      {selected.kind === "section" && section && (
        <div className="shrink-0 border-b border-tool-border px-4 py-2.5">
          <Segmented value={tab} options={TAB_OPTIONS} onChange={setTab} grow />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {selected.kind === "wedding" && <WeddingForm />}
        {selected.kind === "theme" && <ThemeForm />}

        {selected.kind === "section" && !section && (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-[13px] font-medium text-tool-ink">선택된 섹션이 없습니다</p>
            <p className="text-[12px] text-tool-ink-soft">
              왼쪽 목록이나 미리보기에서 섹션을 선택하세요.
            </p>
          </div>
        )}

        {section && tab === "content" && (
          <div className="space-y-4">
            {/* 눈썹 라벨은 모든 섹션이 같은 모양으로 갖는다 — 타입별 폼 위에서 한 번만 그린다 */}
            {section.type !== "hero" && <SectionLabelField section={section} />}
            {section.type === "hero" && <HeroForm section={section} />}
            {section.type === "greeting" && <GreetingForm section={section} />}
            {section.type === "coupleProfile" && <CoupleProfileForm section={section} />}
            {section.type === "calendar" && <CalendarForm section={section} />}
            {section.type === "gallery" && <GalleryForm section={section} />}
            {section.type === "venue" && (
              <VenueForm section={section} onOpenWedding={() => select({ kind: "wedding" })} />
            )}
            {section.type === "video" && <VideoForm section={section} />}
            {section.type === "transportation" && <TransportationForm section={section} />}
            {section.type === "contacts" && <ContactsForm section={section} />}
            {section.type === "giftAccount" && <GiftAccountForm section={section} />}
            {section.type === "rsvp" && <RsvpForm section={section} />}
            {section.type === "closing" && <ClosingForm section={section} />}
            {section.type === "share" && <ShareForm section={section} />}
          </div>
        )}
        {section && tab === "layout" && <LayoutForm section={section} />}
        {section && tab === "style" && <StyleForm section={section} />}
        {section && tab === "advanced" && <AdvancedForm section={section} />}
      </div>
    </aside>
  );
}
