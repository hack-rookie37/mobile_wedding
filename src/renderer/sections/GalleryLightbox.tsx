"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { GalleryPhoto } from "@/invitation/schema/document";
import { useRenderer } from "../RendererContext";

function LightboxButton({
  label,
  onClick,
  children,
  buttonRef,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white/15 px-3.5 text-[length:calc(13px*var(--canvas-fs))] text-white transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

// 게시 모드 전용 사진 확대 보기.
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
  }, []);

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
        if (e.target === dialogRef.current) dialogRef.current.close(); // 배경 클릭 닫기
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
      className="m-auto w-full max-w-[520px] bg-transparent p-4 outline-none backdrop:bg-black/85"
    >
      <figure className="flex flex-col items-center gap-3">
        {asset !== null ? (
          <img
            src={asset.src}
            srcSet={asset.srcSet}
            sizes={asset.srcSet !== undefined ? "520px" : undefined}
            alt={photo.alt ?? `${index + 1}번째 사진`}
            className="max-h-[78dvh] w-auto max-w-full object-contain"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-[#2b2b2b]">
            <span className="text-[length:calc(12px*var(--canvas-fs))] tracking-[0.08em] text-white/60">
              이미지 없음
            </span>
          </div>
        )}
        <figcaption className="text-center text-[length:calc(13px*var(--canvas-fs))] leading-[1.5] text-white/85">
          {photo.caption || photo.alt || ""}
          <span
            aria-live="polite"
            className="mt-0.5 block text-[length:calc(11px*var(--canvas-fs))] tracking-[0.08em] text-white/50 tabular-nums"
          >
            {index + 1} / {photos.length}
          </span>
        </figcaption>
      </figure>
      <div className="mt-4 flex items-center justify-center gap-2">
        {many && (
          <LightboxButton label="이전 사진" onClick={goPrev}>
            ←
          </LightboxButton>
        )}
        <LightboxButton
          label="닫기"
          buttonRef={closeRef}
          onClick={() => dialogRef.current?.close()}
        >
          닫기
        </LightboxButton>
        {many && (
          <LightboxButton label="다음 사진" onClick={goNext}>
            →
          </LightboxButton>
        )}
      </div>
    </dialog>
  );
}
