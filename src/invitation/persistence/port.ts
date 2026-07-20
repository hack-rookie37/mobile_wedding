import type { InvitationDocument } from "../schema/document";

// Phase 6 (ADR-018) — 편집기가 아는 영속화의 전부.
// editor 모듈은 이 인터페이스에만 결합되고, 구현(server/supabase)은 app이 주입한다.
// 저장은 낙관적 동시성: expectedRev가 서버와 다르면 conflict — 두 탭 동시 편집 감지.

export interface LoadedProjectData {
  title: string;
  doc: InvitationDocument;
  rev: number;
}

export type SaveOutcome =
  { status: "saved"; rev: number } | { status: "conflict"; currentRev: number };
// 네트워크·권한 오류는 throw — 호출부가 'error(재시도)' 상태로 처리한다.

export type RevisionKind = "origin" | "checkpoint" | "restore";

export interface RevisionSummary {
  id: string;
  rev: number;
  kind: RevisionKind;
  label: string;
  createdAt: string; // ISO
}

export interface RestoreOutcome {
  doc: InvitationDocument;
  rev: number;
}

// ── 발행 수명주기 (ADR-019): draft → (private preview) → published ↔ unpublished

// slug는 선택값이다 (ADR-029): null이면 도메인 루트(/), 값이 있으면 /i/<slug>.
export interface PublishState {
  slug: string | null;
  status: "live" | "off"; // off = unpublished (스냅샷은 보존)
  publishedAt: string; // 마지막 발행 시간 (ISO)
  publishedRev: number; // 발행된 revision 번호 (doc_rev 기준)
}

export type PublishOutcome =
  | { status: "published"; slug: string | null; publishedRev: number }
  | { status: "slug_taken" } // slug 중복 — 사용자에게 다른 주소를 요청
  | { status: "root_taken" }; // 다른 청첩장이 이미 도메인 루트에 올라가 있다

export interface PreviewLink {
  token: string; // 추측하기 어려운 토큰 (재생성 시 이전 토큰은 즉시 무효)
  expiresAt: string | null; // null = 만료 없음
  createdAt: string;
}

export interface ProjectPersistence {
  load(projectId: string): Promise<LoadedProjectData | null>;
  save(projectId: string, doc: InvitationDocument, expectedRev: number): Promise<SaveOutcome>;
  listRevisions(projectId: string): Promise<RevisionSummary[]>;
  createCheckpoint(projectId: string, label: string): Promise<void>;
  restoreRevision(projectId: string, revisionId: string): Promise<RestoreOutcome>;
  // 발행: 그 시점의 draft를 스냅샷 — 이후 draft 수정은 republish 전까지 공개본에 반영되지 않는다
  getPublishState(projectId: string): Promise<PublishState | null>;
  publish(projectId: string, slug: string | null): Promise<PublishOutcome>;
  unpublish(projectId: string): Promise<void>;
  // 비공개 미리보기 링크 (프로젝트당 1개 — create가 곧 재생성)
  getPreviewLink(projectId: string): Promise<PreviewLink | null>;
  createPreviewLink(projectId: string, opts: { expiresAt: string | null }): Promise<PreviewLink>;
  revokePreviewLink(projectId: string): Promise<void>;
}
