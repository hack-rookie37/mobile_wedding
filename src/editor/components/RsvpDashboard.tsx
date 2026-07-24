"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { buildRsvpCsv } from "@/invitation/rsvp/csv";
import type { RsvpAdminPort } from "@/invitation/rsvp/port";
import {
  RSVP_MEAL_LABELS,
  RSVP_SIDE_LABELS,
  summarizeRsvp,
  type RsvpResponse,
} from "@/invitation/rsvp/responses";
import { Button } from "@/ui/buttons";
import { Segmented } from "@/ui/fields";
import { useDeferredLoad } from "@/ui/useDeferredLoad";

// 제작자 RSVP 결과 뷰 (PRODUCT_SPEC §8, A-22) — 편집기 밖 별도 페이지.
// 응답은 RLS로 소유자에게만 보이며, 여기서는 조회·삭제·CSV export만 가능하다 (ADR-021).

type AttendanceFilter = "all" | "attending" | "declined";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatSubmittedAt(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-tool-border bg-white px-4 py-3.5">
      <p className="text-[12px] text-tool-ink-soft">{title}</p>
      <p className="mt-1 text-[20px] leading-none font-semibold text-tool-ink">{value}</p>
      {detail !== undefined && <p className="mt-1.5 text-[11px] text-tool-ink-faint">{detail}</p>}
    </div>
  );
}

// 두 단계 확인 삭제 버튼 — 브라우저 confirm 다이얼로그를 쓰지 않는다
function ConfirmDeleteButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-7 rounded-md border border-tool-border px-2.5 text-[12px] text-tool-danger transition-colors hover:border-tool-danger/50"
      >
        {label}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onConfirm}
        className="h-7 rounded-md bg-tool-danger px-2.5 text-[12px] font-medium text-white hover:opacity-90"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-7 rounded-md border border-tool-border px-2.5 text-[12px] text-tool-ink"
      >
        취소
      </button>
    </span>
  );
}

function ResponseRow({
  response,
  expanded,
  onToggle,
  onDelete,
}: {
  response: RsvpResponse;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        data-rsvp-row
        onClick={onToggle}
        className={clsx(
          "cursor-pointer border-t border-tool-border text-[13px] transition-colors",
          expanded ? "bg-tool-accent-soft" : "hover:bg-tool-bg",
        )}
      >
        <td className="px-4 py-2.5">
          {/* 행 클릭은 마우스 편의 — 키보드는 이 버튼으로 상세를 펼친다 (펼쳐야 삭제 버튼 접근 가능) */}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="min-h-6 rounded font-medium text-tool-ink focus-visible:outline-2 focus-visible:outline-tool-accent"
          >
            {response.guestName}
          </button>
        </td>
        <td className="hidden px-3 py-2.5 text-tool-ink-soft sm:table-cell">
          {response.side === null ? "—" : RSVP_SIDE_LABELS[response.side]}
        </td>
        <td className="px-3 py-2.5">
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 text-[12px] font-medium",
              response.attending
                ? "bg-[#e8f3ea] text-[#2c6e3d]"
                : "bg-[#f4f0ee] text-tool-ink-soft",
            )}
          >
            {response.attending ? "참석" : "불참"}
          </span>
        </td>
        <td className="px-3 py-2.5 text-tool-ink-soft tabular-nums">
          {response.companions === null ? "—" : `+${response.companions}`}
        </td>
        <td className="hidden px-3 py-2.5 text-tool-ink-soft sm:table-cell">
          {response.meal === null ? "—" : RSVP_MEAL_LABELS[response.meal]}
        </td>
        <td className="hidden px-3 py-2.5 text-[12px] text-tool-ink-faint tabular-nums sm:table-cell">
          {formatSubmittedAt(response.createdAt)}
        </td>
      </tr>
      {expanded && (
        <tr data-rsvp-detail className="border-t border-tool-border bg-tool-bg/60">
          <td colSpan={6} className="px-4 py-3">
            {/* 상세는 전체 기록을 담는다 — 모바일 표에서 접힌 구분·식사도 여기서 읽는다 */}
            <dl className="space-y-1.5 text-[12.5px] leading-[1.6]">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-tool-ink-faint">구분</dt>
                <dd className="text-tool-ink">
                  {response.side === null ? "—" : RSVP_SIDE_LABELS[response.side]}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-tool-ink-faint">식사</dt>
                <dd className="text-tool-ink">
                  {response.meal === null ? "—" : RSVP_MEAL_LABELS[response.meal]}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-tool-ink-faint">연락처</dt>
                <dd className="text-tool-ink">{response.phone ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-tool-ink-faint">메시지</dt>
                <dd className="whitespace-pre-line text-tool-ink">{response.message ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-tool-ink-faint">제출</dt>
                <dd className="text-tool-ink-soft">
                  {formatSubmittedAt(response.createdAt)}
                  {response.updatedAt !== response.createdAt &&
                    ` (${formatSubmittedAt(response.updatedAt)} 수정)`}
                </dd>
              </div>
            </dl>
            <div className="mt-2.5">
              <ConfirmDeleteButton label="이 응답 삭제" confirmLabel="삭제" onConfirm={onDelete} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DashboardBody({
  projectId,
  title,
  initialResponses,
  admin,
}: {
  projectId: string;
  title: string;
  initialResponses: RsvpResponse[];
  admin: RsvpAdminPort;
}) {
  const [responses, setResponses] = useState(initialResponses);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const summary = useMemo(() => summarizeRsvp(responses), [responses]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return responses.filter((response) => {
      if (filter === "attending" && !response.attending) return false;
      if (filter === "declined" && response.attending) return false;
      if (keyword === "") return true;
      return [response.guestName, response.phone ?? "", response.message ?? ""].some((field) =>
        field.toLowerCase().includes(keyword),
      );
    });
  }, [responses, query, filter]);

  const run = async (work: () => Promise<void>) => {
    setActionError(null);
    try {
      await work();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const removeOne = (responseId: string) =>
    run(async () => {
      await admin.remove(projectId, responseId);
      setResponses((current) => current.filter((r) => r.id !== responseId));
      setExpandedId(null);
    });

  const removeAll = () =>
    run(async () => {
      await admin.removeAll(projectId);
      setResponses([]);
      setExpandedId(null);
    });

  const downloadCsv = () => {
    // export는 필터와 무관하게 전체 응답을 담는다 — 파일 내용은 CSV 계층에서 주입 방어된다
    const blob = new Blob([buildRsvpCsv(responses)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rsvp-응답.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh bg-tool-bg text-tool-ink">
      {/* 모바일 세로에서는 한 줄에 다 안 들어간다 — 제목 줄과 버튼 줄로 접힌다 */}
      <header className="border-b border-tool-border bg-tool-surface px-4 py-2.5">
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={`/editor/${projectId}`}
            className="text-[13px] text-tool-ink-soft transition-colors hover:text-tool-ink"
          >
            ← 편집기로
          </Link>
          <div aria-hidden className="hidden h-4 w-px bg-tool-border sm:block" />
          <h1 className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {title} <span className="text-tool-ink-faint">— RSVP 응답</span>
          </h1>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button onClick={downloadCsv} disabled={responses.length === 0}>
              CSV 다운로드
            </Button>
            {responses.length > 0 && (
              <ConfirmDeleteButton
                label="전체 삭제"
                confirmLabel={`${responses.length}건 모두 삭제`}
                onConfirm={() => void removeAll()}
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-4 py-6 sm:px-6 sm:py-8">
        <section aria-label="집계" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            title="참석"
            value={`${summary.attending}명`}
            detail={`동반 +${summary.companionTotal} → 예상 ${summary.expectedGuests}명`}
          />
          <SummaryCard title="불참" value={`${summary.declined}명`} />
          <SummaryCard
            title="측별 (참석)"
            value={`${summary.attendingBySide.groom} · ${summary.attendingBySide.bride}`}
            detail={`신랑측 · 신부측${
              summary.attendingBySide.unspecified > 0
                ? ` · 미선택 ${summary.attendingBySide.unspecified}`
                : ""
            }`}
          />
          <SummaryCard
            title="식사 (참석)"
            value={`${summary.meals.yes}명`}
            detail={`안 함 ${summary.meals.no} · 미정 ${summary.meals.undecided} · 무응답 ${summary.meals.unanswered}`}
          />
        </section>

        <section aria-label="응답 목록" className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·연락처·메시지 검색"
              aria-label="응답 검색"
              className="h-9 w-full rounded-md border border-tool-border bg-white px-2.5 text-[13px] text-tool-ink placeholder:text-tool-ink-faint focus:border-tool-accent focus:ring-[3px] focus:ring-tool-accent/15 focus:outline-none sm:w-64"
            />
            <Segmented
              value={filter}
              options={[
                { value: "all", label: "전체" },
                { value: "attending", label: "참석" },
                { value: "declined", label: "불참" },
              ]}
              onChange={setFilter}
            />
            <span className="ml-auto text-[12px] text-tool-ink-faint">
              {visible.length} / {responses.length}건
            </span>
          </div>

          {actionError !== null && (
            <p role="alert" className="mt-3 text-[12px] text-tool-danger">
              {actionError}
            </p>
          )}

          {responses.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-tool-border-strong bg-white px-6 py-14 text-center">
              <p className="text-[14px] font-medium text-tool-ink">아직 응답이 없습니다</p>
              <p className="mt-1 text-[12.5px] text-tool-ink-soft">
                청첩장을 발행하고 RSVP 섹션이 보이면 게스트가 참석 의사를 보낼 수 있어요.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-tool-border bg-white">
              <table className="w-full border-collapse text-left">
                <thead>
                  {/* 모바일 세로에서는 이름·참석·동반만 — 나머지는 행을 펼치면 상세에 있다 */}
                  <tr className="text-[11px] tracking-wider text-tool-ink-faint uppercase">
                    <th className="px-4 py-2.5 font-medium">이름</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">구분</th>
                    <th className="px-3 py-2.5 font-medium">참석</th>
                    <th className="px-3 py-2.5 font-medium">동반</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">식사</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">제출</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((response) => (
                    <ResponseRow
                      key={response.id}
                      response={response}
                      expanded={expandedId === response.id}
                      onToggle={() =>
                        setExpandedId((current) => (current === response.id ? null : response.id))
                      }
                      onDelete={() => void removeOne(response.id)}
                    />
                  ))}
                  {visible.length === 0 && (
                    <tr className="border-t border-tool-border">
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[13px] text-tool-ink-soft"
                      >
                        조건에 맞는 응답이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-[12px] leading-[1.6] text-tool-ink-faint">
            게스트 개인정보 보호를 위해 예식이 끝나면 응답을 삭제해 주세요. 응답은 청첩장 문서와
            분리되어 저장되며, 공개 페이지나 AI 기능에 노출되지 않습니다.
          </p>
        </section>
      </main>
    </div>
  );
}

export function RsvpDashboard({ projectId, admin }: { projectId: string; admin: RsvpAdminPort }) {
  const load = useCallback(async () => {
    const title = await admin.loadProjectTitle(projectId);
    if (title === null) return null;
    return { title, responses: await admin.list(projectId) };
  }, [admin, projectId]);
  const state = useDeferredLoad(load);

  switch (state.status) {
    case "loading":
      return <div className="h-dvh bg-tool-bg" aria-busy />;
    case "error":
      return <CenteredNotice title="응답을 불러오지 못했습니다" detail={state.message} />;
    case "ready":
      if (state.value === null) {
        return <CenteredNotice title="청첩장을 찾을 수 없습니다" />;
      }
      return (
        <DashboardBody
          projectId={projectId}
          title={state.value.title}
          initialResponses={state.value.responses}
          admin={admin}
        />
      );
  }
}

function CenteredNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-tool-bg text-tool-ink">
      <p className="text-[15px] font-medium">{title}</p>
      {detail && <p className="max-w-md text-center text-[13px] text-tool-ink-soft">{detail}</p>}
      <Link href="/edit" className="text-[13px] text-tool-accent underline underline-offset-2">
        내 청첩장으로 돌아가기
      </Link>
    </div>
  );
}
