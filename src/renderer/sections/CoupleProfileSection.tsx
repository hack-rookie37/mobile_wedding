"use client";

import clsx from "clsx";
import type {
  CoupleProfileSection as CoupleProfileSectionData,
  Person,
  ProfileEntry,
  Wedding,
} from "@/invitation/schema/document";
import { parentsLineOf } from "../format";
import { PhotoFrame } from "../primitives/PhotoFrame";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

function ProfileCard({
  roleLabel,
  person,
  entry,
  showParents,
  stacked,
}: {
  roleLabel: string;
  person: Person;
  entry: ProfileEntry;
  showParents: boolean;
  stacked: boolean;
}) {
  const { resolveAsset, theme } = useRenderer();
  const asset = entry.photoAssetId !== null ? resolveAsset(entry.photoAssetId) : null;
  const parents = parentsLineOf(person);

  return (
    <div className={clsx("min-w-0", stacked ? "flex items-start gap-5" : "flex-1")}>
      <PhotoFrame
        asset={asset}
        alt={`${roleLabel} ${person.name} 사진`}
        shape="soft"
        aspectRatio="4 / 5"
        sizes={stacked ? "128px" : "192px"}
        frame={entry.photoFrame}
        treatment={theme.variants.photoTreatment}
        className={stacked ? "w-32 shrink-0" : undefined}
      />
      <div className={clsx("min-w-0", stacked ? "pt-1" : "mt-4")}>
        <p className="text-[11px] font-medium tracking-[0.16em] text-(--canvas-accent)">
          {roleLabel}
        </p>
        <p className="mt-1 font-(family-name:--canvas-font-heading) text-[17px] leading-[1.5] font-semibold text-(--canvas-ink)">
          {person.name}
        </p>
        {showParents && parents !== null && (
          <p className="mt-0.5 text-[12px] leading-[1.7] text-(--canvas-ink-soft)">
            {parents.parents}의{parents.relation !== "" ? ` ${parents.relation}` : ""}
          </p>
        )}
        {entry.intro !== "" && (
          <p className="mt-2.5 text-[13px] leading-[1.8] whitespace-pre-line text-(--canvas-ink-soft)">
            {entry.intro}
          </p>
        )}
      </div>
    </div>
  );
}

export function CoupleProfileSection({
  section,
  wedding,
  index,
}: {
  section: CoupleProfileSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { content, layout } = section;
  const stacked = layout.variant === "stacked";

  return (
    <SectionShell section={section} index={index}>
      <SectionHeader label="COUPLE" title={content.title} index={index} />
      <div className={clsx("mt-8", stacked ? "space-y-8" : "flex gap-5")}>
        <ProfileCard
          roleLabel="신랑"
          person={wedding.groom}
          entry={content.groom}
          showParents={content.showParents}
          stacked={stacked}
        />
        <ProfileCard
          roleLabel="신부"
          person={wedding.bride}
          entry={content.bride}
          showParents={content.showParents}
          stacked={stacked}
        />
      </div>
    </SectionShell>
  );
}
