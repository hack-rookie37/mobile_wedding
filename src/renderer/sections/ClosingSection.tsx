"use client";

import type { CSSProperties } from "react";
import type { ClosingSection as ClosingSectionData } from "@/invitation/schema/document";
import { BodyText } from "../primitives/BodyText";
import { FullBleedPhoto } from "../primitives/FullBleedPhoto";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

// 사진 위 글자는 흰색으로 — 캔버스 색 변수를 이 자리에서만 다시 정의하면
// SectionHeader·BodyText·공유 버튼이 손대지 않고도 전부 따라온다.
const OVERLAY_VARS = {
  "--canvas-ink": "#ffffff",
  "--canvas-ink-soft": "rgba(255,255,255,0.82)",
  "--canvas-accent": "#ffffff",
  "--canvas-line": "rgba(255,255,255,0.55)",
  textShadow: "0 1px 8px rgba(0,0,0,0.35)", // 밝은 사진 위에서도 읽히도록
} as CSSProperties;

// 사진 레이아웃은 마지막 한 장면이다 — 캔버스 가로를 꽉 채우고 상하 여백 없이
// 위아래 끝까지 닿는다(여백 설정과 무관). 글자는 사진 위에 흰색으로 얹으며,
// 눈썹 라벨(THANK YOU) 없이 제목만 둔다.
export function ClosingSection({ section, index }: { section: ClosingSectionData; index: number }) {
  const { resolveAsset } = useRenderer();
  const { content, layout } = section;
  const withPhoto = layout.variant === "photo" && content.photoAssetId !== null;

  const text = (
    <>
      <SectionHeader label={content.label} title={content.title} index={index} />
      {content.body !== "" && (
        <div className="mt-8 w-full">
          <BodyText text={content.body} />
        </div>
      )}
    </>
  );

  if (withPhoto && content.photoAssetId !== null) {
    return (
      <SectionShell section={section} index={index} flushTop flushBottom>
        {/* 사진과 글자를 같은 grid 칸에 겹친다 — 글이 길어지면 칸이 늘어나므로 사진 밖으로 넘치지 않는다 */}
        <div className="grid">
          <div className="col-start-1 row-start-1">
            <FullBleedPhoto
              asset={resolveAsset(content.photoAssetId)}
              alt="마무리 사진"
              aspect={content.photoAspect}
              effects={content.effects}
              frame={content.photoFrame}
              fadeColor={section.style.background ?? "var(--canvas-paper)"}
            />
          </div>
          {/* relative가 필요하다 — 둘 다 static이면 <img>(inline 단계)가 뒤 형제의 내용보다
              나중에 그려져 글자·버튼을 덮고 클릭까지 가로챈다 */}
          <div
            className="relative col-start-1 row-start-1 flex flex-col items-center justify-center px-8 py-12 text-center"
            style={OVERLAY_VARS}
          >
            {text}
          </div>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} index={index}>
      <div className="flex flex-col items-center text-center">{text}</div>
    </SectionShell>
  );
}
