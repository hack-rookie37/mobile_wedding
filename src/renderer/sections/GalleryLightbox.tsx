"use client";

import clsx from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import type { GalleryPhoto } from "@/invitation/schema/document";
import { useRenderer } from "../RendererContext";

// 스와이프 판정 — 이동이 이보다 짧거나 세로 성분이 지배적이면 탭/스크롤로 본다
const SWIPE_MIN_PX = 48;

function LightboxButton({
  label,
  onClick,
  children,
  className,
  buttonRef,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

// 게시 모드 전용 사진 확대 보기 — 우상단 ✕, 좌우 가장자리 화살표, 스와이프,
// 하단 썸네일 스트립으로 이동한다.
// 네이티브 <dialog>.showModal — top layer·포커스 트랩·Esc 닫기·닫힌 뒤 트리거로의
// 포커스 복귀를 브라우저가 보장한다. top layer는 뷰포트 오버레이이므로
// 컨테이너 상대 규칙의 예외로 동적 뷰포트 높이(dvh)를 사용한다.
export function GalleryLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const { resolveAsset } = useRenderer();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
  }, []);

  // 현재 사진의 썸네일이 스트립 밖에 있으면 가운데로 데려온다.
  // block: "nearest" — 스트립은 이미 화면 안이라 가로(inline)만 움직인다.
  useEffect(() => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? ("auto" as const)
      : ("smooth" as const);
    thumbRefs.current[index]?.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  }, [index]);

  const photo = photos[index];
  const asset = resolveAsset(photo.assetId);
  const many = photos.length > 1;
  const goPrev = () => onIndexChange((index - 1 + photos.length) % photos.length);
  const goNext = () => onIndexChange((index + 1) % photos.length);

  return (
    <dialog
      ref={dialogRef}
      aria-label="사진 크게 보기"
      onClose={onClose}
      onClick={(e) => {
        // 520px 밖 배경(::backdrop) 클릭 — backdrop의 클릭은 dialog 자신을 target으로 온다
        if (e.target === dialogRef.current) dialogRef.current.close();
      }}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goPrev();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goNext();
        }
      }}
      className="m-auto h-dvh max-h-none w-full max-w-[520px] bg-transparent p-0 outline-none backdrop:bg-black/85"
    >
      <figure className="flex h-full flex-col">
        <LightboxButton
          label="닫기"
          buttonRef={closeRef}
          onClick={() => dialogRef.current?.close()}
          className="absolute top-3 right-3 z-10"
        >
          ✕
        </LightboxButton>

        {/* 본 사진 — 빈 곳 탭은 닫기, 좌우 스와이프는 이동 (탭은 이동 거리로 구분된다) */}
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-3 pt-14"
          onClick={(e) => {
            if (e.target === e.currentTarget) dialogRef.current?.close();
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (start === null || !many) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
            if (dx < 0) goNext();
            else goPrev();
          }}
        >
          {asset !== null ? (
            <img
              src={asset.src}
              srcSet={asset.srcSet}
              sizes={asset.srcSet !== undefined ? "520px" : undefined}
              alt={photo.alt ?? `${index + 1}번째 사진`}
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-[#2b2b2b]">
              <span className="text-[length:calc(12px*var(--canvas-fs))] tracking-[0.08em] text-white/60">
                이미지 없음
              </span>
            </div>
          )}
          {many && (
            <>
              <LightboxButton
                label="이전 사진"
                onClick={goPrev}
                className="absolute top-1/2 left-2 -translate-y-1/2"
              >
                ‹
              </LightboxButton>
              <LightboxButton
                label="다음 사진"
                onClick={goNext}
                className="absolute top-1/2 right-2 -translate-y-1/2"
              >
                ›
              </LightboxButton>
            </>
          )}
        </div>

        <figcaption className="mt-3 px-6 text-center text-[length:calc(13px*var(--canvas-fs))] leading-[1.5] text-white/85">
          {photo.caption || photo.alt || ""}
          <span
            aria-live="polite"
            className="mt-0.5 block text-[length:calc(11px*var(--canvas-fs))] tracking-[0.08em] text-white/50 tabular-nums"
          >
            {index + 1} / {photos.length}
          </span>
        </figcaption>

        {/* 하단 썸네일 스트립 — 적으면 가운데, 넘치면 가로 스크롤 (현재 사진은 흰 테두리) */}
        {many && (
          <div className="mt-3 flex shrink-0 justify-center pb-4">
            <div data-lightbox-thumbs className="flex max-w-full gap-1.5 overflow-x-auto px-4 pb-1">
              {photos.map((p, i) => {
                const thumbAsset = resolveAsset(p.assetId);
                const active = i === index;
                return (
                  <button
                    key={`${p.assetId}-${i}`}
                    ref={(el) => {
                      thumbRefs.current[i] = el;
                    }}
                    type="button"
                    aria-label={`${i + 1}번째 사진 보기`}
                    aria-current={active}
                    onClick={() => onIndexChange(i)}
                    // 테두리는 양쪽 상태에 같은 두께로 — 활성 전환 때 칸이 움찔거리지 않는다
                    className={clsx(
                      "size-12 shrink-0 overflow-hidden rounded-[4px] border-2 transition-opacity",
                      active ? "border-white opacity-100" : "border-transparent opacity-45",
                    )}
                  >
                    {thumbAsset !== null ? (
                      <img
                        src={thumbAsset.src}
                        srcSet={thumbAsset.srcSet}
                        sizes={thumbAsset.srcSet !== undefined ? "44px" : undefined}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="block h-full w-full bg-[#2b2b2b]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </figure>
    </dialog>
  );
}
