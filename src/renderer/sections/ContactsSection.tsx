"use client";

import type {
  ContactEntry,
  ContactSide,
  ContactsSection as ContactsSectionData,
} from "@/invitation/schema/document";
import { Collapsible } from "../primitives/Collapsible";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

export const CONTACT_SIDE_LABELS: Record<ContactSide, string> = {
  groom: "신랑측",
  bride: "신부측",
};

// tel:/sms: href용 — 표기(하이픈·공백)는 유지하되 링크에는 숫자와 +만 남긴다
function phoneHref(scheme: "tel" | "sms", phone: string): string {
  return `${scheme}:${phone.replace(/[^+\d]/g, "")}`;
}

function ContactRow({ entry }: { entry: ContactEntry }) {
  const { mode } = useRenderer();
  const interactive = mode === "published";

  const actionClass =
    "flex h-8 items-center rounded-full px-3.5 text-[length:calc(12px*var(--canvas-fs))] font-medium text-(--canvas-ink)";
  const actionStyle = { border: "1px solid var(--canvas-line)" } as const;

  return (
    <li data-contact-entry className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[length:calc(13.5px*var(--canvas-fs))] leading-[1.5] text-(--canvas-ink)">
          <span className="mr-1.5 text-[length:calc(12px*var(--canvas-fs))] text-(--canvas-ink-soft)">
            {entry.label}
          </span>
          <span className="font-medium">{entry.name}</span>
        </p>
      </div>
      {interactive ? (
        <>
          <a href={phoneHref("tel", entry.phone)} className={actionClass} style={actionStyle}>
            전화
          </a>
          <a href={phoneHref("sms", entry.phone)} className={actionClass} style={actionStyle}>
            문자
          </a>
        </>
      ) : (
        <>
          <span className={actionClass} style={actionStyle}>
            전화
          </span>
          <span className={actionClass} style={actionStyle}>
            문자
          </span>
        </>
      )}
    </li>
  );
}

function SideGroup({
  side,
  entries,
  accordion,
}: {
  side: ContactSide;
  entries: ContactEntry[];
  accordion: boolean;
}) {
  if (entries.length === 0) return null;
  const list = (
    <ul
      className={accordion ? "divide-y px-4" : "divide-y"}
      style={{ borderColor: "var(--canvas-line)" }}
    >
      {entries.map((entry, entryIndex) => (
        <ContactRow key={entryIndex} entry={entry} />
      ))}
    </ul>
  );

  if (accordion) {
    return <Collapsible summary={CONTACT_SIDE_LABELS[side]}>{list}</Collapsible>;
  }
  return (
    <div>
      <p className="mb-1 text-[length:calc(11px*var(--canvas-fs))] font-medium tracking-[0.14em] text-(--canvas-accent)">
        {CONTACT_SIDE_LABELS[side]}
      </p>
      {list}
    </div>
  );
}

export function ContactsSection({
  section,
  index,
}: {
  section: ContactsSectionData;
  index: number;
}) {
  const { mode } = useRenderer();
  const { content, layout } = section;
  const accordion = layout.variant === "accordion";
  const groom = content.entries.filter((entry) => entry.side === "groom");
  const bride = content.entries.filter((entry) => entry.side === "bride");

  return (
    <SectionShell section={section} index={index}>
      <SectionHeader label={content.label} title={content.title} index={index} />
      {content.entries.length === 0 && mode === "editor-edit" && (
        <p className="mt-6 text-center text-[length:calc(12px*var(--canvas-fs))] text-(--canvas-ink-soft)">
          오른쪽 패널에서 연락처를 추가하세요.
        </p>
      )}
      <div className="mt-8 space-y-5">
        <SideGroup side="groom" entries={groom} accordion={accordion} />
        <SideGroup side="bride" entries={bride} accordion={accordion} />
      </div>
    </SectionShell>
  );
}
