"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";
import {
  daysUntilWedding,
  WEEKDAY_HEADINGS,
  weddingCalendarMonth,
} from "@/invitation/lib/calendarGrid";
import { buildIcs } from "@/invitation/lib/ics";
import type { CalendarSection as CalendarSectionData, Wedding } from "@/invitation/schema/document";
import { formatDateStamp, formatWeddingDate } from "../format";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

const WEDDING_EVENT_MINUTES = 120;

const emptySubscribe = () => () => {};

// D-day는 '오늘'에 의존하므로 서버 렌더 결과에 넣지 않고 클라이언트에서만 계산한다
// (server snapshot null → hydration 불일치 없음, 값은 하루 동안 동일한 primitive)
function DdayBadge({ datetime }: { datetime: string }) {
  const days = useSyncExternalStore(
    emptySubscribe,
    () => daysUntilWedding(datetime, new Date()),
    () => null,
  );

  if (days === null) return null;
  const label = days > 0 ? `D-${days}` : days === 0 ? "D-DAY" : `D+${-days}`;
  return (
    <p
      data-dday
      className="mt-5 text-center text-[13px] font-semibold tracking-[0.12em] text-(--canvas-accent) tabular-nums"
    >
      {label}
    </p>
  );
}

function downloadIcs(wedding: Wedding) {
  const { groom, bride, venue } = wedding;
  const ics = buildIcs({
    uid: `${wedding.datetime}-${groom.name}-${bride.name}@marriage-invitation`,
    title: `${groom.name} ♥ ${bride.name} 결혼식`,
    startIso: wedding.datetime,
    durationMinutes: WEDDING_EVENT_MINUTES,
    location: [venue.name, venue.hall, venue.address].filter(Boolean).join(" "),
    description: formatWeddingDate(wedding.datetime),
  });
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wedding.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}

function CalendarGrid({ datetime }: { datetime: string }) {
  const { year, month, day, weeks } = weddingCalendarMonth(datetime);

  return (
    <div className="mx-auto max-w-[300px]">
      <p className="text-center font-(family-name:--canvas-font-heading) text-[15px] font-semibold tracking-[0.06em] text-(--canvas-ink) tabular-nums">
        {year}. {String(month).padStart(2, "0")}
      </p>
      <table className="mt-4 w-full border-collapse" aria-label={`${year}년 ${month}월 달력`}>
        <thead>
          <tr>
            {WEEKDAY_HEADINGS.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                className="pb-2 text-center text-[10px] font-medium tracking-[0.1em] text-(--canvas-ink-soft)"
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((date, dayIndex) => (
                <td key={dayIndex} className="p-0.5 text-center">
                  {date !== null && (
                    <span
                      className={clsx(
                        "mx-auto flex size-8 items-center justify-center rounded-full text-[12.5px] tabular-nums",
                        date === day
                          ? "font-semibold text-(--canvas-paper)"
                          : "text-(--canvas-ink)",
                      )}
                      style={date === day ? { backgroundColor: "var(--canvas-accent)" } : undefined}
                    >
                      {date}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalendarSection({
  section,
  wedding,
  index,
}: {
  section: CalendarSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { mode } = useRenderer();
  const interactive = mode === "published";
  const { content, layout } = section;

  return (
    <SectionShell section={section} index={index}>
      <SectionHeader label="CALENDAR" title={content.title} index={index} />
      <div className="mt-8">
        {layout.variant === "grid" ? (
          <>
            <CalendarGrid datetime={wedding.datetime} />
            <p className="mt-5 text-center text-[13.5px] leading-[1.7] text-(--canvas-ink-soft)">
              {formatWeddingDate(wedding.datetime)}
            </p>
          </>
        ) : (
          <div className="text-center">
            <p className="font-(family-name:--canvas-font-heading) text-[26px] leading-[1.4] font-semibold tracking-[0.04em] text-(--canvas-ink) tabular-nums">
              {formatDateStamp(wedding.datetime)}
            </p>
            <p className="mt-2 text-[13.5px] leading-[1.7] text-(--canvas-ink-soft)">
              {formatWeddingDate(wedding.datetime)}
            </p>
          </div>
        )}
        {content.showDday && <DdayBadge datetime={wedding.datetime} />}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={!interactive}
            onClick={() => downloadIcs(wedding)}
            className="h-10 rounded-full px-5 text-[13px] font-medium text-(--canvas-ink)"
            style={{ border: "1px solid var(--canvas-line)" }}
          >
            📅 캘린더에 일정 저장
          </button>
        </div>
      </div>
    </SectionShell>
  );
}
