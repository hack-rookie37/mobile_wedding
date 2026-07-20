"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { formatWeddingDate } from "@/invitation/lib/format";
import { RSVP_MEAL_LABELS, RSVP_SIDE_LABELS } from "@/invitation/rsvp/responses";
import { RSVP_LIMITS, type RsvpMeal } from "@/invitation/rsvp/submission";
import type { ContactSide, RsvpSection as RsvpSectionData } from "@/invitation/schema/document";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { rsvpTargetKey, useRenderer, type RsvpTarget } from "../RendererContext";

// 참석 의사 전달 (RSVP) — 게스트 폼 (PRODUCT_SPEC §8).
// 제출은 published 모드 + 제출 대상이 있을 때만 가능하다. 응답은 /api/rsvp를 거쳐
// invitation 문서와 분리된 저장소로 가며, 이 컴포넌트는 응답 데이터를 절대 알지 못한다.

const emptySubscribe = () => () => {};

type SubmitPhase =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "done"; result: "created" | "updated" }
  | { kind: "error"; message: string };

const lineInputClass =
  "h-11 w-full rounded-lg bg-transparent px-3.5 text-[length:calc(14px*var(--canvas-fs))] text-(--canvas-ink) " +
  "placeholder:text-(--canvas-ink-soft)/50 border border-(--canvas-line) " +
  "focus:border-(--canvas-ink) focus:outline-none";

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[length:calc(12px*var(--canvas-fs))] font-medium text-(--canvas-ink-soft)">
        {label}
      </p>
      {children}
    </div>
  );
}

// 라디오 그룹을 칩 형태로 — input은 시각적으로 숨기되 키보드·스크린리더 동작은 유지한다
function ChoiceChips<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  name: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <FieldBlock label={label}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={
                "flex h-10 min-w-[72px] items-center justify-center rounded-full px-4 " +
                "text-[length:calc(13px*var(--canvas-fs))] transition-colors has-[:focus-visible]:outline-2 " +
                "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--canvas-ink) " +
                (disabled ? "" : "cursor-pointer ") +
                (checked
                  ? "border border-(--canvas-ink) bg-(--canvas-ink) font-medium text-(--canvas-paper)"
                  : "border border-(--canvas-line) text-(--canvas-ink)")
              }
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                required={required}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </FieldBlock>
  );
}

function errorMessageOf(status: string): string {
  switch (status) {
    case "closed":
      return "참석 여부 접수가 마감되었습니다.";
    case "rate_limited":
      return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
    case "not_found":
      return "지금은 접수할 수 없습니다. 청첩장이 비공개 상태일 수 있습니다.";
    default:
      return "제출하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

function RsvpForm({
  section,
  target,
  storedToken,
  onDone,
}: {
  section: RsvpSectionData;
  target: RsvpTarget | null;
  storedToken: string | null;
  onDone: (result: "created" | "updated") => void;
}) {
  const { mode } = useRenderer();
  const submittable = mode === "published" && target !== null;
  const { collect } = section.content;

  const [phase, setPhase] = useState<SubmitPhase>({ kind: "form" });
  // 토큰은 mount당 1개로 고정 — 전송 실패 후 재시도가 같은 토큰을 재사용해
  // 서버 upsert가 중복 행 대신 갱신으로 처리된다 (제출마다 새로 만들면 재시도 = 중복)
  const [clientToken] = useState(() => storedToken ?? crypto.randomUUID());
  const [guestName, setGuestName] = useState("");
  const [attending, setAttending] = useState<"yes" | "no" | null>(null);
  const [side, setSide] = useState<ContactSide | null>(null);
  const [companions, setCompanions] = useState("0");
  const [meal, setMeal] = useState<RsvpMeal | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submittable || target === null || attending === null) return;
    const website = new FormData(event.currentTarget).get("website");
    const token = clientToken;
    setPhase({ kind: "submitting" });
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: target.slug,
          clientToken: token,
          guestName,
          side: collect.side ? side : null,
          attending: attending === "yes",
          companions: collect.companions ? (companions === "" ? 0 : Number(companions)) : null,
          meal: collect.meal ? meal : null,
          phone: collect.phone ? phone : null,
          message: collect.message ? message : null,
          consent,
          website,
        }),
      });
      const body = (await response.json()) as {
        status: string;
        result?: "created" | "updated";
      };
      if (response.ok && body.status === "ok") {
        window.localStorage.setItem(`rsvp-token:${rsvpTargetKey(target)}`, token);
        onDone(body.result ?? "created");
        return;
      }
      setPhase({ kind: "error", message: errorMessageOf(body.status) });
    } catch {
      setPhase({ kind: "error", message: "전송에 실패했습니다. 네트워크 상태를 확인해 주세요." });
    }
  };

  return (
    <form data-rsvp-form className="mt-8 space-y-5" onSubmit={(e) => void submit(e)}>
      {/* 허니팟 — 사람에게 보이지 않는 필드. 봇이 채우면 서버가 조용히 버린다 (A-17) */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          웹사이트 (비워 두세요)
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <FieldBlock label="성함 (필수)">
        <input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          required
          maxLength={RSVP_LIMITS.guestName}
          disabled={!submittable}
          placeholder="참석하시는 분의 성함"
          aria-label="성함"
          className={lineInputClass}
        />
      </FieldBlock>

      <ChoiceChips
        label="참석 여부 (필수)"
        name="rsvp-attending"
        value={attending}
        required
        disabled={!submittable}
        options={[
          { value: "yes", label: "참석" },
          { value: "no", label: "불참" },
        ]}
        onChange={setAttending}
      />

      {collect.side && (
        <ChoiceChips
          label="어느 쪽 하객이신가요?"
          name="rsvp-side"
          value={side}
          disabled={!submittable}
          options={[
            { value: "groom", label: RSVP_SIDE_LABELS.groom },
            { value: "bride", label: RSVP_SIDE_LABELS.bride },
          ]}
          onChange={setSide}
        />
      )}

      {collect.companions && (
        <FieldBlock label="동반 인원 (본인 제외)">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={RSVP_LIMITS.companionsMax}
            value={companions}
            onChange={(e) => setCompanions(e.target.value)}
            disabled={!submittable}
            aria-label="동반 인원"
            className={lineInputClass}
          />
        </FieldBlock>
      )}

      {collect.meal && (
        <ChoiceChips
          label="식사 여부"
          name="rsvp-meal"
          value={meal}
          disabled={!submittable}
          options={(["yes", "no", "undecided"] as const).map((value) => ({
            value,
            label: RSVP_MEAL_LABELS[value],
          }))}
          onChange={setMeal}
        />
      )}

      {collect.phone && (
        <FieldBlock label="연락처">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={RSVP_LIMITS.phone}
            disabled={!submittable}
            placeholder="010-0000-0000"
            aria-label="연락처"
            className={lineInputClass}
          />
        </FieldBlock>
      )}

      {collect.message && (
        <FieldBlock label="전하고 싶은 말">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={RSVP_LIMITS.message}
            rows={3}
            disabled={!submittable}
            placeholder="신랑·신부에게만 보입니다"
            aria-label="전하고 싶은 말"
            className={
              "w-full rounded-lg bg-transparent px-3.5 py-3 text-[length:calc(14px*var(--canvas-fs))] leading-[1.6] " +
              "text-(--canvas-ink) placeholder:text-(--canvas-ink-soft)/50 " +
              "border border-(--canvas-line) focus:border-(--canvas-ink) focus:outline-none"
            }
          />
        </FieldBlock>
      )}

      <label
        data-rsvp-consent
        className="flex cursor-pointer items-start gap-2.5 rounded-lg p-3.5"
        style={{ border: "1px solid var(--canvas-line)" }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          disabled={!submittable}
          className="mt-0.5 size-4 shrink-0 accent-(--canvas-ink)"
        />
        <span className="text-[length:calc(12px*var(--canvas-fs))] leading-[1.65] text-(--canvas-ink-soft)">
          <span className="font-medium text-(--canvas-ink)">개인정보 수집·이용 동의 (필수)</span>
          <br />
          입력하신 내용은 참석 확인 목적으로만 수집되며 신랑·신부만 볼 수 있습니다. 응답은
          신랑·신부가 삭제할 때까지 보관되고, 예식 후 삭제됩니다.
        </span>
      </label>

      {phase.kind === "error" && (
        <p role="alert" className="text-[length:calc(13px*var(--canvas-fs))] text-[#b3403a]">
          {phase.message}
        </p>
      )}

      <button
        type="submit"
        data-rsvp-submit
        disabled={!submittable || phase.kind === "submitting"}
        className="h-12 w-full rounded-full text-[length:calc(14px*var(--canvas-fs))] font-medium transition-opacity disabled:opacity-45"
        style={{ backgroundColor: "var(--canvas-ink)", color: "var(--canvas-paper)" }}
      >
        {phase.kind === "submitting" ? "전달 중…" : "참석 의사 전달하기"}
      </button>

      {!submittable && (
        <p className="text-center text-[length:calc(12px*var(--canvas-fs))] text-(--canvas-ink-soft)">
          게스트는 발행된 청첩장에서 제출할 수 있습니다.
        </p>
      )}
    </form>
  );
}

// 아래에서 올라오는 작성 시트 — 네이티브 <dialog>.showModal (GalleryLightbox와 같은 근거:
// top layer·포커스 트랩·Esc·포커스 복귀를 브라우저가 보장). dialog는 DOM상 renderer root의
// 자식이므로 --canvas-* 변수를 그대로 상속한다. 높이 상한은 뷰포트 기준(top layer 예외 — dvh).
function RsvpSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      data-rsvp-sheet
      aria-label="참석 여부 전달"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current.close(); // 배경 클릭 닫기
      }}
      className="m-auto mb-0 w-full max-w-[430px] rounded-t-2xl bg-(--canvas-paper) p-0 outline-none backdrop:bg-black/50"
    >
      <div className="max-h-[85dvh] overflow-y-auto px-6 pt-3 pb-9">
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-(--canvas-line)" />
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[length:calc(15px*var(--canvas-fs))] font-semibold text-(--canvas-ink)">
            참석 여부 전달
          </p>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => dialogRef.current?.close()}
            className="flex size-8 items-center justify-center rounded-full text-[length:calc(15px*var(--canvas-fs))] text-(--canvas-ink-soft) hover:text-(--canvas-ink)"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function NoticePanel({
  dataAttr,
  title,
  detail,
  action,
}: {
  dataAttr: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div
      {...{ [dataAttr]: true }}
      // 제출 성공/마감 안내가 form을 대체하며 나타난다 — screen reader에도 알린다
      role="status"
      className="mt-8 flex flex-col items-center gap-2 rounded-xl px-6 py-9 text-center"
      style={{ border: "1px solid var(--canvas-line)" }}
    >
      <p className="text-[length:calc(15px*var(--canvas-fs))] font-medium text-(--canvas-ink)">
        {title}
      </p>
      {detail !== undefined && (
        <p className="text-[length:calc(13px*var(--canvas-fs))] leading-[1.6] text-(--canvas-ink-soft)">
          {detail}
        </p>
      )}
      {action}
    </div>
  );
}

export function RsvpSection({ section, index }: { section: RsvpSectionData; index: number }) {
  const { mode, rsvpTarget } = useRenderer();
  const { content } = section;
  const sheetVariant = section.layout.variant === "sheet";

  // '오늘'에 의존하는 값은 client-only로 계산한다 (SSR hydration 안전 — Phase 8 D-day와 동일 패턴)
  const deadlinePassed = useSyncExternalStore(
    emptySubscribe,
    () => content.deadline !== null && Date.now() > new Date(content.deadline).getTime(),
    () => false,
  );

  // 같은 브라우저의 이전 제출 여부 (localStorage 소프트 가드) — 토큰은 재제출 시 재사용된다
  const storedToken = useSyncExternalStore(
    emptySubscribe,
    () =>
      rsvpTarget !== null
        ? window.localStorage.getItem(`rsvp-token:${rsvpTargetKey(rsvpTarget)}`)
        : null,
    () => null,
  );

  const [done, setDone] = useState<"created" | "updated" | null>(null);
  const [reopened, setReopened] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const editAgainButton = (
    <button
      type="button"
      data-rsvp-edit-again
      onClick={() => {
        setDone(null);
        setReopened(true);
        if (sheetVariant) setSheetOpen(true);
      }}
      className="mt-2 flex h-10 items-center rounded-full px-5 text-[length:calc(13px*var(--canvas-fs))] font-medium text-(--canvas-ink)"
      style={{ border: "1px solid var(--canvas-line)" }}
    >
      응답 수정하기
    </button>
  );

  const form = (
    <RsvpForm
      section={section}
      target={rsvpTarget}
      storedToken={storedToken}
      onDone={(result) => {
        setDone(result);
        setSheetOpen(false);
      }}
    />
  );

  let body: ReactNode;
  if (deadlinePassed) {
    body = (
      <NoticePanel
        dataAttr="data-rsvp-closed"
        title="참석 여부 접수가 마감되었습니다"
        detail="마음을 전하고 싶으시다면 신랑·신부에게 직접 연락해 주세요."
      />
    );
  } else if (done !== null) {
    body = (
      <NoticePanel
        dataAttr="data-rsvp-done"
        title={done === "created" ? "참석 의사가 전달되었습니다" : "응답이 수정되었습니다"}
        detail="소중한 시간을 내어 알려주셔서 감사합니다."
        action={editAgainButton}
      />
    );
  } else if (storedToken !== null && !reopened) {
    body = (
      <NoticePanel
        dataAttr="data-rsvp-already"
        title="이미 참석 의사를 전달하셨습니다"
        detail="다시 제출하면 이전 응답이 새 내용으로 바뀝니다."
        action={editAgainButton}
      />
    );
  } else if (!sheetVariant) {
    body = form;
  } else {
    // sheet variant: 섹션에는 열기 버튼만 — 폼은 아래에서 올라오는 시트에서 작성한다.
    // 편집 모드에서는 시트를 열 수 없으므로(캔버스 클릭 = 섹션 선택) 내용 미리보기를 함께 그린다.
    body = (
      <>
        <button
          type="button"
          data-rsvp-open
          disabled={mode !== "published"}
          onClick={() => setSheetOpen(true)}
          className="mt-8 h-12 w-full rounded-full text-[length:calc(14px*var(--canvas-fs))] font-medium transition-opacity disabled:opacity-45"
          style={{ backgroundColor: "var(--canvas-ink)", color: "var(--canvas-paper)" }}
        >
          참석 여부 전달하기
        </button>
        {mode === "editor-edit" && (
          <div
            className="mt-4 rounded-xl border border-dashed px-4 pb-4"
            style={{ borderColor: "var(--canvas-line)" }}
          >
            <p className="pt-3 text-center text-[length:calc(11px*var(--canvas-fs))] tracking-[0.06em] text-(--canvas-ink-soft) opacity-70">
              게스트가 버튼을 누르면 아래 내용이 시트로 올라옵니다
            </p>
            {form}
          </div>
        )}
        {sheetOpen && <RsvpSheet onClose={() => setSheetOpen(false)}>{form}</RsvpSheet>}
      </>
    );
  }

  return (
    <SectionShell section={section} index={index}>
      <SectionHeader label="RSVP" title={content.title} index={index} />
      {content.body !== "" && (
        <p className="mt-5 text-center text-[length:calc(14px*var(--canvas-fs))] leading-[1.85] whitespace-pre-line text-(--canvas-ink-soft)">
          {content.body}
        </p>
      )}
      {content.deadline !== null && !deadlinePassed && (
        <p
          data-rsvp-deadline
          className="mt-3 text-center text-[length:calc(12px*var(--canvas-fs))] text-(--canvas-accent)"
        >
          {formatWeddingDate(content.deadline)}까지 전해 주세요
        </p>
      )}
      {mode === "editor-edit" && (
        <p className="mt-3 text-center text-[length:calc(11px*var(--canvas-fs))] text-(--canvas-ink-soft) opacity-70">
          응답은 상단 ‘RSVP 응답’에서 확인합니다 — 청첩장 문서와 분리되어 저장됩니다.
        </p>
      )}
      {body}
    </SectionShell>
  );
}
