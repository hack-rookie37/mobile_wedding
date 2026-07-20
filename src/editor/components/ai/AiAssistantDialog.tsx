"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyAction } from "@/invitation/actions/apply";
import { AiRequestError, type AiAssistantPort, type AiProposal } from "@/invitation/ai/port";
import type { AiAction } from "@/invitation/ai/schema";
import type { InvitationDocument } from "@/invitation/schema/document";
import { InvitationRenderer } from "@/renderer/InvitationRenderer";
import { Segmented } from "@/ui/fields";
import { describeAiAction } from "../../ai/describeAction";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";

// AI 도우미 (ADR-022) — 제안은 즉시 적용되지 않는다: 검토 화면(변경 목록·전후 비교·
// 미리보기)에서 전체/일부를 선택해 적용하며, 적용은 수동 편집과 같은 dispatch(batch)라
// undo 1스텝으로 되돌릴 수 있다. AI가 없어도(미설정) 편집기의 다른 기능은 그대로다.

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "review"; proposal: AiProposal }
  | { kind: "applied"; count: number }
  | { kind: "error"; message: string };

const EXAMPLE_PLACEHOLDER =
  "예: 첫 화면을 더 미니멀하게 하고 갤러리를 따뜻한 필름 느낌으로 바꿔줘.";

// 선택된 action만 순서대로 dry-run — 부분 적용 미리보기와 적용 가능 여부를 함께 얻는다
function previewOf(
  doc: InvitationDocument,
  actions: AiAction[],
  checked: boolean[],
): { doc: InvitationDocument; error: null } | { doc: null; error: string } {
  let current = doc;
  for (let i = 0; i < actions.length; i++) {
    if (!checked[i]) continue;
    try {
      const result = applyAction(current, actions[i]);
      if (result.outcome === "applied") current = result.doc;
    } catch (error) {
      return {
        doc: null,
        error: `선택한 조합은 적용할 수 없습니다 — ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
  return { doc: current, error: null };
}

export function AiAssistantDialog({
  projectId,
  ai,
  onClose,
}: {
  projectId: string;
  ai: AiAssistantPort;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const doc = useEditor((s) => s.doc);
  const dispatch = useEditor((s) => s.dispatch);
  const { assets, resolveAsset } = useAssetLibrary();

  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [checked, setChecked] = useState<boolean[]>([]);
  const [previewSide, setPreviewSide] = useState<"before" | "after">("after");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const review = phase.kind === "review" ? phase.proposal : null;
  const preview = useMemo(
    () => (review !== null ? previewOf(doc, review.actions, checked) : null),
    [doc, review, checked],
  );
  const selectedCount = checked.filter(Boolean).length;

  const requestProposal = () => {
    const trimmed = instruction.trim();
    if (trimmed === "") return;
    setPhase({ kind: "loading" });
    ai.propose({
      projectId,
      instruction: trimmed,
      doc,
      // 사진 배치 제안용 메타 — 오디오(BGM)는 AI 제안 대상이 아니다
      assets: assets.flatMap(({ record }) =>
        record.kind === "image"
          ? [{ id: record.id, width: record.width, height: record.height }]
          : [],
      ),
    })
      .then((proposal) => {
        setChecked(proposal.actions.map(() => true));
        setPreviewSide("after");
        setPreviewOpen(false);
        setPhase({ kind: "review", proposal });
      })
      .catch((error: unknown) => {
        setPhase({
          kind: "error",
          message:
            error instanceof AiRequestError
              ? error.message
              : "요청에 실패했습니다 — 잠시 후 다시 시도해 주세요.",
        });
      });
  };

  const applySelected = () => {
    if (review === null || selectedCount === 0) return;
    const selected = review.actions.filter((_, index) => checked[index]);
    try {
      // 수동 편집과 동일한 파이프라인 — batch 1건 = undo 1스텝
      dispatch({ type: "batch", label: "AI 제안 적용", actions: selected });
      setPhase({ kind: "applied", count: selected.length });
    } catch (error) {
      setPhase({
        kind: "error",
        message: `적용에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  const reset = () => {
    setPhase({ kind: "idle" });
    setChecked([]);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="AI 도우미"
      onClose={onClose}
      className="m-auto w-[560px] rounded-lg bg-white p-0 shadow-[0_12px_48px_rgba(0,0,0,0.18)] backdrop:bg-black/40"
    >
      <div className="flex h-11 items-center border-b border-tool-border px-4">
        <h2 className="text-[13px] font-semibold text-tool-ink">AI 도우미</h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="ml-auto rounded px-2 py-1 text-[12px] text-tool-ink-soft hover:bg-tool-bg hover:text-tool-ink"
        >
          닫기
        </button>
      </div>

      <div className="max-h-[76vh] space-y-4 overflow-y-auto px-4 py-4">
        {(phase.kind === "idle" || phase.kind === "loading" || phase.kind === "error") && (
          <>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={EXAMPLE_PLACEHOLDER}
              aria-label="AI 요청"
              disabled={phase.kind === "loading"}
              className="w-full resize-y rounded-md border border-tool-border bg-white px-2.5 py-2 text-[13px] leading-[1.6] text-tool-ink placeholder:text-tool-ink-faint focus:border-tool-accent focus:ring-[3px] focus:ring-tool-accent/15 focus:outline-none"
            />
            <p className="text-[11px] leading-[1.6] text-tool-ink-faint">
              할 수 있는 일: 초안 제안 · 인사말 다듬기 · 전체 분위기 변경 · 갤러리 레이아웃 제안 ·
              접근성 검토. 제안은 바로 적용되지 않고 검토 후 선택 적용합니다.
            </p>

            {phase.kind === "error" && (
              <p
                role="alert"
                className="rounded-md bg-[#fdf1f0] px-3 py-2 text-[12px] text-tool-danger"
              >
                {phase.message}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestProposal}
                disabled={phase.kind === "loading" || instruction.trim() === ""}
                data-ai-request
                className="h-8 rounded-md bg-tool-accent px-3.5 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {phase.kind === "loading" ? "제안을 만드는 중…" : "제안 받기"}
              </button>
              {phase.kind === "loading" && (
                <span className="text-[12px] text-tool-ink-soft" data-ai-loading>
                  문서를 분석하고 있습니다…
                </span>
              )}
            </div>
          </>
        )}

        {review !== null && (
          <>
            <p
              data-ai-summary
              className="rounded-md bg-tool-bg px-3 py-2.5 text-[12.5px] leading-[1.6] text-tool-ink"
            >
              {review.summary}
            </p>

            {review.actions.length === 0 ? (
              <p className="py-4 text-center text-[12.5px] text-tool-ink-soft">
                적용할 변경이 없습니다. 문구를 바꿔 다시 시도해 보세요.
              </p>
            ) : (
              <ul className="divide-y divide-tool-border rounded-md border border-tool-border">
                {review.actions.map((action, index) => {
                  const description = describeAiAction(doc, action);
                  return (
                    <li key={index} data-ai-change className="flex items-start gap-2.5 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked[index]}
                        aria-label={`${description.title} 적용`}
                        onChange={(e) =>
                          setChecked((current) =>
                            current.map((value, i) => (i === index ? e.target.checked : value)),
                          )
                        }
                        className="mt-0.5 size-3.5 accent-(--color-tool-accent)"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-tool-ink">{description.title}</p>
                        {description.before !== undefined && description.after !== undefined && (
                          <p className="mt-0.5 text-[12px] text-tool-ink-soft">
                            <span className="line-through opacity-70">{description.before}</span>
                            <span aria-hidden className="mx-1.5">
                              →
                            </span>
                            <span className="font-medium text-tool-ink">{description.after}</span>
                          </p>
                        )}
                        {description.detail !== undefined && (
                          <p className="mt-0.5 text-[12px] text-tool-ink-faint">
                            {description.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {preview !== null && preview.error !== null && (
              <p
                role="alert"
                className="rounded-md bg-[#fdf1f0] px-3 py-2 text-[12px] text-tool-danger"
              >
                {preview.error}
              </p>
            )}

            {review.actions.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen((open) => !open)}
                  data-ai-preview-toggle
                  className="text-[12px] text-tool-accent underline underline-offset-2"
                >
                  {previewOpen ? "미리보기 접기" : "변경 전후 미리보기"}
                </button>
                {previewOpen && (
                  <div className="mt-2.5 space-y-2">
                    <Segmented
                      value={previewSide}
                      options={[
                        { value: "before", label: "변경 전" },
                        { value: "after", label: "변경 후" },
                      ]}
                      onChange={setPreviewSide}
                    />
                    <div
                      data-ai-preview
                      className="h-[380px] overflow-y-auto rounded-md border border-tool-border bg-tool-bg-deep"
                    >
                      <div className="mx-auto w-[360px] bg-white">
                        <InvitationRenderer
                          doc={
                            previewSide === "after" && preview !== null && preview.doc !== null
                              ? preview.doc
                              : doc
                          }
                          mode="editor-edit"
                          resolveAsset={resolveAsset}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-tool-border pt-3">
              <button
                type="button"
                onClick={applySelected}
                disabled={selectedCount === 0 || preview?.error !== null}
                data-ai-apply
                className="h-8 rounded-md bg-tool-accent px-3.5 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {selectedCount === review.actions.length
                  ? `전체 적용 (${selectedCount}개)`
                  : `선택한 ${selectedCount}개 적용`}
              </button>
              <button
                type="button"
                onClick={reset}
                data-ai-cancel
                className="h-8 rounded-md border border-tool-border px-3 text-[13px] text-tool-ink hover:border-tool-border-strong"
              >
                취소
              </button>
              <span className="ml-auto text-[11px] text-tool-ink-faint">
                적용 후에도 실행 취소(⌘Z)로 되돌릴 수 있습니다
              </span>
            </div>
          </>
        )}

        {phase.kind === "applied" && (
          <div data-ai-applied role="status" className="space-y-3 py-2 text-center">
            <p className="text-[13.5px] font-medium text-tool-ink">
              {phase.count}개 변경을 적용했습니다
            </p>
            <p className="text-[12px] text-tool-ink-soft">
              마음에 들지 않으면 실행 취소(⌘Z) 한 번으로 전체를 되돌릴 수 있습니다.
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setInstruction("");
                  reset();
                }}
                className="h-8 rounded-md border border-tool-border px-3 text-[13px] text-tool-ink hover:border-tool-border-strong"
              >
                새 요청
              </button>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="h-8 rounded-md bg-tool-accent px-3.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
