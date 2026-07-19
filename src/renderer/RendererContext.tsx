"use client";

import { createContext, useContext } from "react";
import type { ResolveAsset } from "@/invitation/assets/assetTypes";
import type { ThemeDefinition } from "@/invitation/schema/themes";

export type RendererMode = "published" | "editor-edit";

export interface RendererContextValue {
  mode: RendererMode;
  resolveAsset: ResolveAsset; // 알 수 없는 assetId는 null — PhotoFrame이 placeholder 처리
  selectedSectionId: string | null;
  onSectionSelect: ((sectionId: string) => void) | null;
  theme: ThemeDefinition; // 해석된 테마 정의 (토큰 + variant) — ADR-014
  // 발행된 공개 페이지의 slug — RSVP 제출 대상 식별자.
  // null이면(편집기·비공개 미리보기) RSVP 폼은 제출 불가 상태로 렌더된다.
  rsvpSlug: string | null;
}

const RendererContext = createContext<RendererContextValue | null>(null);

export const RendererProvider = RendererContext.Provider;

export function useRenderer(): RendererContextValue {
  const value = useContext(RendererContext);
  if (!value) {
    throw new Error("useRenderer는 InvitationRenderer 내부에서만 사용할 수 있습니다");
  }
  return value;
}
