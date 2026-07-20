"use client";

import clsx from "clsx";
import type { GreetingSection as GreetingSectionData, Wedding } from "@/invitation/schema/document";
import { parentsLineOf } from "../format";
import { BodyText } from "../primitives/BodyText";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

function ParentsLine({ person, className }: { person: Wedding["groom"]; className?: string }) {
  const line = parentsLineOf(person);
  if (!line) return null;
  return (
    <p
      className={clsx(
        "text-[length:calc(15px*var(--canvas-fs))] leading-[1.9] text-(--canvas-ink)",
        className,
      )}
    >
      {line.parents}
      <span className="mr-1.5 text-[length:calc(14px*var(--canvas-fs))] text-(--canvas-ink-soft)">
        의
      </span>
      {line.relation !== "" && (
        <span className="mr-1.5 text-[length:calc(13px*var(--canvas-fs))] text-(--canvas-ink-soft)">
          {line.relation}
        </span>
      )}
      <span className="font-medium">{line.name}</span>
    </p>
  );
}

export function GreetingSection({
  section,
  wedding,
  index,
}: {
  section: GreetingSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { theme } = useRenderer();
  const { content } = section;
  const variant = theme.variants.greeting;

  if (variant === "mono") {
    return (
      <SectionShell section={section} index={index}>
        <SectionHeader label="INVITATION" title={content.title} index={index} />
        <div className="mt-7">
          <BodyText text={content.body} align={content.align} />
        </div>
        {content.showParents && (
          <div className="mt-9" style={{ borderBottom: "1px solid var(--canvas-line)" }}>
            {(
              [
                ["신랑측", wedding.groom],
                ["신부측", wedding.bride],
              ] as const
            ).map(([label, person]) => (
              <div
                key={label}
                className="flex items-baseline gap-5 py-3"
                style={{ borderTop: "1px solid var(--canvas-line)" }}
              >
                <span className="w-12 shrink-0 text-[length:calc(10px*var(--canvas-fs))] font-medium tracking-[0.14em] text-(--canvas-ink-soft)">
                  {label}
                </span>
                <ParentsLine
                  person={person}
                  className="text-[length:calc(14px*var(--canvas-fs))]"
                />
              </div>
            ))}
          </div>
        )}
      </SectionShell>
    );
  }

  if (variant === "film") {
    return (
      <SectionShell section={section} index={index}>
        <SectionHeader label="INVITATION" title={content.title} index={index} />
        <div className="mt-6">
          <BodyText text={content.body} align={content.align} />
        </div>
        {content.showParents && (
          <>
            <div
              aria-hidden
              className="mt-9 border-t border-dashed"
              style={{ borderColor: "var(--canvas-line)" }}
            />
            <div className="mt-7 space-y-1 text-center">
              <ParentsLine person={wedding.groom} />
              <ParentsLine person={wedding.bride} />
            </div>
          </>
        )}
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} index={index}>
      <div className="flex flex-col items-center">
        <SectionHeader label="INVITATION" title={content.title} index={index} />
        <div className="mt-8 w-full">
          <BodyText text={content.body} align={content.align} />
        </div>
        {content.showParents && (
          <>
            <div aria-hidden className="mt-10 h-px w-6 bg-(--canvas-line)" />
            <div className="mt-8 text-center">
              <ParentsLine person={wedding.groom} />
              <ParentsLine person={wedding.bride} />
            </div>
          </>
        )}
      </div>
    </SectionShell>
  );
}
