import type { RsvpResponse } from "./responses";

// 소유자 전용 RSVP 응답 관리 port — 조회·삭제만 있다.
// 생성·수정 경로는 의도적으로 없다: 제출은 게스트의 submit_rsvp RPC가 유일하고,
// 소유자는 응답을 위조·수정할 수 없다 (ADR-021).
export interface RsvpAdminPort {
  // 소유한 프로젝트면 제목, 아니면(없음/남의 것 구분 없이) null
  loadProjectTitle(projectId: string): Promise<string | null>;
  list(projectId: string): Promise<RsvpResponse[]>;
  remove(projectId: string, responseId: string): Promise<void>;
  removeAll(projectId: string): Promise<void>; // retention 대응 — 예식 후 일괄 삭제
}
