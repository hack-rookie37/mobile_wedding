"use client";

import { useRef } from "react";
import type { ResolvedAsset } from "@/invitation/assets/assetTypes";
import type { PhotoFrame } from "@/invitation/schema/document";
import { FieldLabel, RangeField } from "@/ui/fields";

const DEFAULT_FRAME: PhotoFrame = { zoom: 1, focalX: 0.5, focalY: 0.5 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

// crop 편집기 — 실제 표시 프레임과 같은 계산(초점 + 확대)으로 결과를 그대로 보여준다.
// 드래그(패닝)와 슬라이더 둘 다 지원해 마우스 없이도 초점·확대를 조정할 수 있다.
export function FrameEditor({
  asset,
  frame,
  aspectRatio,
  onChange,
}: {
  asset: ResolvedAsset | null;
  frame: PhotoFrame | undefined;
  aspectRatio: string; // 이 사진이 실제 표시되는 비율
  onChange: (frame: PhotoFrame | undefined) => void;
}) {
  const value = frame ?? DEFAULT_FRAME;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    focalX: number;
    focalY: number;
  } | null>(null);

  const focal = `${value.focalX * 100}% ${value.focalY * 100}%`;

  return (
    <div className="space-y-3">
      <FieldLabel>표시 영역 (crop) — 미리보기를 드래그해 초점 이동</FieldLabel>
      <div
        ref={surfaceRef}
        data-frame-surface
        onPointerDown={(e) => {
          if (asset === null) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            focalX: value.focalX,
            focalY: value.focalY,
          };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          const rect = surfaceRef.current?.getBoundingClientRect();
          if (!drag || !rect || drag.pointerId !== e.pointerId) return;
          const dx = (e.clientX - drag.startX) / rect.width;
          const dy = (e.clientY - drag.startY) / rect.height;
          onChange({
            ...value,
            focalX: round2(clamp01(drag.focalX - dx / value.zoom)),
            focalY: round2(clamp01(drag.focalY - dy / value.zoom)),
          });
        }}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
        className="relative touch-none overflow-hidden rounded-md border border-tool-border bg-tool-bg-deep select-none"
        style={{ aspectRatio, cursor: asset !== null ? "grab" : undefined }}
      >
        {asset !== null ? (
          <img
            src={asset.src}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
            style={{
              objectPosition: focal,
              transform: `scale(${value.zoom})`,
              transformOrigin: focal,
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[12px] text-tool-ink-faint">
            이미지 없음
          </div>
        )}
      </div>
      <RangeField
        label="확대"
        value={value.zoom}
        min={1}
        max={3}
        step={0.05}
        onChange={(zoom) => onChange({ ...value, zoom: round2(zoom) })}
        format={(v) => `${v.toFixed(2)}×`}
      />
      <RangeField
        label="초점 가로"
        value={value.focalX}
        min={0}
        max={1}
        step={0.01}
        onChange={(focalX) => onChange({ ...value, focalX })}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <RangeField
        label="초점 세로"
        value={value.focalY}
        min={0}
        max={1}
        step={0.01}
        onChange={(focalY) => onChange({ ...value, focalY })}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <button
        type="button"
        disabled={frame === undefined}
        onClick={() => onChange(undefined)}
        className="text-[12px] text-tool-ink-soft underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
      >
        Crop 초기화
      </button>
    </div>
  );
}
