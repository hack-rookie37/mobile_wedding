"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { slugError, suggestSlug } from "@/invitation/lib/slug";
import type { PreviewLink, ProjectPersistence, PublishState } from "@/invitation/persistence/port";

// 공유·발행 패널 (ADR-019)
// 상태 모델: draft(발행 전) → private preview(토큰 링크) → published ↔ unpublished
// 발행은 그 시점의 draft 스냅샷 — 이후 변경은 '재발행'을 눌러야 공개본에 반영된다.

type ExpiryChoice = "none" | "24h" | "7d";

const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: "none", label: "만료 없음" },
  { value: "24h", label: "24시간" },
  { value: "7d", label: "7일" },
];

function expiresAtOf(choice: ExpiryChoice): string | null {
  if (choice === "none") return null;
  const hours = choice === "24h" ? 24 : 24 * 7;
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="h-7 shrink-0 rounded-md border border-tool-border px-2 text-[12px] text-tool-ink hover:border-tool-border-strong"
    >
      {copied ? "복사됨" : label}
    </button>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-[12px] font-semibold text-tool-ink">{children}</h3>;
}

export function PublishPanel({
  persistence,
  projectId,
  currentRev,
  onClose,
}: {
  persistence: ProjectPersistence;
  projectId: string;
  currentRev: number; // 현재 draft의 rev — 발행본과 다르면 '재발행 필요' 안내
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [previewLink, setPreviewLink] = useState<PreviewLink | null>(null);
  const [publishState, setPublishState] = useState<PublishState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryChoice>("none");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const refresh = useCallback(async () => {
    const [link, state] = await Promise.all([
      persistence.getPreviewLink(projectId),
      persistence.getPublishState(projectId),
    ]);
    setPreviewLink(link);
    setPublishState(state);
    setSlug((current) => (current !== "" ? current : (state?.slug ?? suggestSlug())));
    setLoaded(true);
  }, [persistence, projectId]);

  useEffect(() => {
    void Promise.resolve()
      .then(refresh)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [refresh]);

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    work()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = previewLink !== null ? `${origin}/p/${previewLink.token}` : null;
  const publicUrl = publishState !== null ? `${origin}/i/${publishState.slug}` : null;
  const slugMessage = slug === "" ? null : slugError(slug);
  const isLive = publishState?.status === "live";
  const needsRepublish = isLive && publishState !== null && currentRev > publishState.publishedRev;

  const createOrRegenerate = () =>
    run(async () => {
      await persistence.createPreviewLink(projectId, { expiresAt: expiresAtOf(expiry) });
      await refresh();
    });

  return (
    <dialog
      ref={dialogRef}
      aria-label="공유·발행"
      onClose={onClose}
      className="m-auto w-[520px] rounded-lg bg-white p-0 shadow-[0_12px_48px_rgba(0,0,0,0.18)] backdrop:bg-black/40"
    >
      <div className="flex h-11 items-center border-b border-tool-border px-4">
        <h2 className="text-[13px] font-semibold text-tool-ink">공유·발행</h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="ml-auto rounded px-2 py-1 text-[12px] text-tool-ink-soft hover:bg-tool-bg hover:text-tool-ink"
        >
          닫기
        </button>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="border-b border-tool-border bg-[#fdf1f0] px-4 py-2 text-[12px] text-tool-danger"
        >
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="px-4 py-10 text-center text-[12px] text-tool-ink-soft">불러오는 중…</p>
      ) : (
        <div className="space-y-5 px-4 py-4">
          {/* ── 비공개 미리보기 ─────────────────────────────── */}
          <section className="space-y-2.5">
            <SectionHeading>비공개 미리보기</SectionHeading>
            <p className="text-[12px] leading-[1.6] text-tool-ink-soft">
              링크가 있는 사람만 현재 초안을 볼 수 있습니다. 검색 엔진에 노출되지 않습니다.
            </p>
            {previewLink !== null && previewUrl !== null ? (
              <>
                <div className="flex items-center gap-2">
                  <code
                    data-preview-url
                    className="min-w-0 flex-1 truncate rounded-md bg-tool-bg-deep px-2.5 py-1.5 text-[11px] text-tool-ink"
                  >
                    {previewUrl}
                  </code>
                  <CopyButton value={previewUrl} label="복사" />
                </div>
                <p className="text-[11px] text-tool-ink-faint">
                  {previewLink.expiresAt !== null
                    ? `${formatAt(previewLink.expiresAt)}까지 유효`
                    : "만료 없음"}
                  {" · "}
                  {formatAt(previewLink.createdAt)} 생성
                </p>
                <div className="flex items-center gap-2">
                  <ExpirySelect value={expiry} onChange={setExpiry} />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={createOrRegenerate}
                    className="h-7 rounded-md border border-tool-border px-2.5 text-[12px] text-tool-ink hover:border-tool-border-strong disabled:opacity-40"
                  >
                    링크 재생성
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await persistence.revokePreviewLink(projectId);
                        await refresh();
                      })
                    }
                    className="h-7 rounded-md px-2.5 text-[12px] text-tool-danger hover:bg-tool-danger/8 disabled:opacity-40"
                  >
                    링크 폐기
                  </button>
                </div>
                <p className="text-[11px] text-tool-ink-faint">
                  재생성하면 이전 링크는 즉시 무효가 됩니다.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <ExpirySelect value={expiry} onChange={setExpiry} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={createOrRegenerate}
                  className="h-8 rounded-md bg-tool-ink px-3 text-[12px] font-medium text-white hover:bg-black disabled:opacity-40"
                >
                  미리보기 링크 만들기
                </button>
              </div>
            )}
          </section>

          <div aria-hidden className="h-px bg-tool-border" />

          {/* ── 공개 발행 ──────────────────────────────────── */}
          <section className="space-y-2.5">
            <SectionHeading>공개 발행</SectionHeading>
            <p className="text-[12px] leading-[1.6] text-tool-ink-soft">
              발행하면 그 순간의 내용이 공개됩니다. 이후 수정은{" "}
              <strong className="font-semibold">재발행해야</strong> 반영됩니다.
            </p>

            <div>
              <label htmlFor="publish-slug" className="mb-1.5 block text-[12px] text-tool-ink-soft">
                공개 주소
              </label>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[12px] text-tool-ink-faint">{origin}/i/</span>
                <input
                  id="publish-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.trim())}
                  className="h-8 min-w-0 flex-1 rounded-md border border-tool-border px-2.5 text-[13px] text-tool-ink focus:border-tool-accent focus:outline-none"
                />
              </div>
              {slugMessage !== null && (
                <p className="mt-1 text-[11px] text-tool-danger">{slugMessage}</p>
              )}
            </div>

            {publishState !== null && (
              <p className="text-[12px] text-tool-ink-soft" data-publish-status>
                {isLive ? (
                  <>
                    <span className="font-medium text-[#1c7d3c]">발행됨</span> ·{" "}
                    {formatAt(publishState.publishedAt)} · 발행 revision {publishState.publishedRev}
                    {needsRepublish && (
                      <span className="block text-[#9a6b1f]">
                        발행 이후 초안이 수정되었습니다 (rev {publishState.publishedRev} →{" "}
                        {currentRev}) — 재발행해야 공개본에 반영됩니다.
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-medium text-tool-danger">발행 중단됨</span>
                )}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || slugMessage !== null || slug === ""}
                onClick={() =>
                  run(async () => {
                    const outcome = await persistence.publish(projectId, slug);
                    if (outcome.status === "slug_taken") {
                      setError("이미 사용 중인 주소입니다 — 다른 주소를 입력해 주세요.");
                      return;
                    }
                    await refresh();
                  })
                }
                className="h-8 rounded-md bg-tool-accent px-3.5 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLive ? "재발행하기" : "발행하기"}
              </button>
              {isLive && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await persistence.unpublish(projectId);
                      await refresh();
                    })
                  }
                  className="h-8 rounded-md border border-tool-border px-3 text-[13px] text-tool-danger hover:border-tool-danger/50 disabled:opacity-40"
                >
                  발행 중단
                </button>
              )}
              {isLive && publicUrl !== null && (
                <span className="ml-auto flex items-center gap-1.5">
                  <CopyButton value={publicUrl} label="링크 복사" />
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-tool-accent underline underline-offset-2"
                  >
                    발행된 페이지 열기
                  </a>
                </span>
              )}
            </div>
          </section>
        </div>
      )}
    </dialog>
  );
}

function ExpirySelect({
  value,
  onChange,
}: {
  value: ExpiryChoice;
  onChange: (value: ExpiryChoice) => void;
}) {
  return (
    <select
      value={value}
      aria-label="미리보기 링크 만료"
      onChange={(e) => onChange(e.target.value as ExpiryChoice)}
      className="h-7 rounded-md border border-tool-border bg-white px-1.5 text-[12px] text-tool-ink focus:border-tool-accent focus:outline-none"
    >
      {EXPIRY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
