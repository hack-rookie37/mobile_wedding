import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { slugError } from "@/invitation/lib/slug";
import type {
  LoadedProjectData,
  PreviewLink,
  ProjectPersistence,
  PublishOutcome,
  PublishState,
  RestoreOutcome,
  RevisionSummary,
  SaveOutcome,
} from "@/invitation/persistence/port";
import { referencedAssetIds } from "@/invitation/lib/assetRefs";
import { documentSchema, type InvitationDocument } from "@/invitation/schema/document";
import { CURRENT_SCHEMA_VERSION, migrateDocument } from "@/invitation/schema/migrate";
import { publicAssetManifest } from "./assetManifest";

const PREVIEW_TOKEN_LENGTH = 32; // nanoid 32자 ≈ 190bit — 추측 불가

export class PersistenceError extends Error {}

function must<T>(data: T | null, error: { message: string } | null, what: string): T {
  if (error) throw new PersistenceError(`${what} 실패: ${error.message}`);
  if (data === null) throw new PersistenceError(`${what} 실패: 응답이 없습니다`);
  return data;
}

// ProjectPersistence의 Supabase 구현 — 전부 사용자 세션(RLS invoker).
// 원자성이 필요한 저장·checkpoint·복원은 DB 함수(RPC)가 수행한다 (ADR-018).
export class SupabasePersistence implements ProjectPersistence {
  constructor(private readonly client: SupabaseClient) {}

  async load(projectId: string): Promise<LoadedProjectData | null> {
    // uuid가 아닌 경로 파라미터는 DB 에러가 아니라 '없음'이다
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      return null;
    }
    const { data, error } = await this.client
      .from("invitation_documents")
      .select("doc, doc_rev, projects ( title )")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw new PersistenceError(`문서 로드 실패: ${error.message}`);
    if (data === null) return null; // 없는 프로젝트 또는 권한 없음 — RLS는 둘을 구분해주지 않는다
    const project = data.projects as unknown as { title: string };
    return {
      title: project.title,
      doc: migrateDocument(data.doc),
      rev: data.doc_rev,
    };
  }

  async save(
    projectId: string,
    doc: InvitationDocument,
    expectedRev: number,
  ): Promise<SaveOutcome> {
    documentSchema.parse(doc); // 잘못된 문서는 네트워크 밖으로 내보내지 않는다 (fail fast)
    const { data, error } = await this.client.rpc("save_document", {
      p_project_id: projectId,
      p_expected_rev: expectedRev,
      p_doc: doc,
      p_schema_version: CURRENT_SCHEMA_VERSION,
    });
    const result = must(data, error, "저장") as
      | { status: "saved"; rev: number }
      | { status: "conflict"; currentRev: number }
      | { status: "not_found" };
    if (result.status === "not_found") {
      throw new PersistenceError("저장 실패: 프로젝트를 찾을 수 없습니다");
    }
    return result;
  }

  async listRevisions(projectId: string): Promise<RevisionSummary[]> {
    const { data, error } = await this.client
      .from("revisions")
      .select("id, rev, kind, label, created_at")
      .eq("project_id", projectId)
      .order("rev", { ascending: false });
    const rows = must(data, error, "기록 조회");
    return rows.map((row) => ({
      id: row.id,
      rev: row.rev,
      kind: row.kind,
      label: row.label,
      createdAt: row.created_at,
    }));
  }

  async createCheckpoint(projectId: string, label: string): Promise<void> {
    const { data, error } = await this.client.rpc("create_checkpoint", {
      p_project_id: projectId,
      p_label: label,
    });
    const result = must(data, error, "체크포인트 생성") as { status: string };
    if (result.status === "not_found") {
      throw new PersistenceError("체크포인트 생성 실패: 프로젝트를 찾을 수 없습니다");
    }
    // status 'exists'는 성공으로 간주 — 같은 상태(rev)의 기록이 이미 있다
  }

  async restoreRevision(projectId: string, revisionId: string): Promise<RestoreOutcome> {
    const { data, error } = await this.client.rpc("restore_revision", {
      p_project_id: projectId,
      p_revision_id: revisionId,
    });
    const result = must(data, error, "복원") as
      | { status: "restored"; rev: number; doc: unknown }
      | { status: "not_found" };
    if (result.status !== "restored") {
      throw new PersistenceError("복원 실패: 기록을 찾을 수 없습니다");
    }
    return { doc: migrateDocument(result.doc), rev: result.rev };
  }

  // ── 발행 수명주기 (ADR-019) ─────────────────────────────────────────────

  async getPublishState(projectId: string): Promise<PublishState | null> {
    const { data, error } = await this.client
      .from("publish_records")
      .select("slug, status, published_at, published_rev")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw new PersistenceError(`발행 상태 조회 실패: ${error.message}`);
    if (data === null) return null;
    return {
      slug: data.slug,
      status: data.status,
      publishedAt: data.published_at,
      publishedRev: data.published_rev,
    };
  }

  // 발행/재발행: RPC가 draft 스냅샷 + 발행 revision 참조 + 주소 중복 검사를 원자적으로 수행.
  // slug가 null이면 도메인 루트에 올린다 (ADR-029).
  async publish(projectId: string, slug: string | null): Promise<PublishOutcome> {
    const formatError = slug === null ? null : slugError(slug);
    if (formatError !== null) {
      throw new PersistenceError(`발행 실패: ${formatError}`); // 형식 오류는 네트워크 전에 거부
    }
    // 발행 스냅샷에는 '보이는 섹션이 실제로 참조하는' asset만 담는다 (ADR-041) — 읽기 시
    // buildPublicPayload와 같은 규칙이라, 올렸다 뺀 사진·숨긴 섹션 전용 사진이 스냅샷에 실려
    // 직접 RPC로 URL이 새는 것을 막는다(게스트 payload도 읽을 때 한 번 더 좁힌다 — 옛 스냅샷 보호).
    //
    // manifest는 우리가 로드한 doc(rev) 기준으로 필터한다. RPC는 현재 draft를 잠그고 스냅샷하므로,
    // 그 사이 draft가 바뀌면(멀티탭 등) manifest와 스냅샷 doc이 어긋난다. 그래서 p_expected_rev를
    // 넘겨 RPC가 '잠근 뒤 rev가 다르면 아무것도 쓰지 않고 rev_changed로 되돌리게' 한다 → 어긋난
    // 스냅샷은 커밋된 적조차 없다(직접 RPC·cold ISR도 못 본다). 최신 doc으로 다시 필터해 재시도한다.
    for (let attempt = 0; attempt < 3; attempt++) {
      const loaded = await this.load(projectId);
      if (loaded === null) {
        throw new PersistenceError("발행 실패: 프로젝트를 찾을 수 없습니다");
      }
      const visibleSections = loaded.doc.sections.filter((section) => section.visible);
      const referenced = referencedAssetIds({ ...loaded.doc, sections: visibleSections });
      const assets = (await publicAssetManifest(this.client, projectId)).filter((entry) =>
        referenced.has(entry.id),
      );
      const { data, error } = await this.client.rpc("publish_project", {
        p_project_id: projectId,
        p_slug: slug,
        p_assets: assets,
        p_expected_rev: loaded.rev,
      });
      const result = must(data, error, "발행") as
        | { status: "published"; slug: string | null; publishedRev: number }
        | { status: "slug_taken" }
        | { status: "root_taken" }
        | { status: "rev_changed"; currentRev: number }
        | { status: "not_found" };
      if (result.status === "not_found") {
        throw new PersistenceError("발행 실패: 프로젝트를 찾을 수 없습니다");
      }
      // rev_changed: 잠근 사이 draft가 바뀌어 RPC가 아무것도 쓰지 않고 되돌렸다(이전 발행 상태 보존)
      // — 최신 doc으로 다시 필터해 재시도한다. 그 외(발행 성공·slug/root 중복)는 그대로 반환.
      if (result.status !== "rev_changed") {
        return result;
      }
    }
    throw new PersistenceError("발행 실패: 편집이 계속 겹쳐 스냅샷을 확정하지 못했습니다");
  }

  async unpublish(projectId: string): Promise<void> {
    const { data, error } = await this.client
      .from("publish_records")
      .update({ status: "off" })
      .eq("project_id", projectId)
      .select("project_id");
    if (error) throw new PersistenceError(`발행 중단 실패: ${error.message}`);
    if ((data ?? []).length === 0) {
      throw new PersistenceError("발행 중단 실패: 발행된 적이 없는 프로젝트입니다");
    }
  }

  // ── 비공개 미리보기 링크 ─────────────────────────────────────────────────

  async getPreviewLink(projectId: string): Promise<PreviewLink | null> {
    const { data, error } = await this.client
      .from("preview_links")
      .select("token, expires_at, created_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw new PersistenceError(`미리보기 링크 조회 실패: ${error.message}`);
    if (data === null) return null;
    return { token: data.token, expiresAt: data.expires_at, createdAt: data.created_at };
  }

  // upsert = 최초 생성이자 재생성 — 이전 토큰은 즉시 무효가 된다
  async createPreviewLink(
    projectId: string,
    { expiresAt }: { expiresAt: string | null },
  ): Promise<PreviewLink> {
    const token = nanoid(PREVIEW_TOKEN_LENGTH);
    const { data, error } = await this.client
      .from("preview_links")
      .upsert({
        project_id: projectId,
        token,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      })
      .select("token, expires_at, created_at")
      .single();
    if (error) throw new PersistenceError(`미리보기 링크 생성 실패: ${error.message}`);
    return { token: data.token, expiresAt: data.expires_at, createdAt: data.created_at };
  }

  async revokePreviewLink(projectId: string): Promise<void> {
    const { error } = await this.client.from("preview_links").delete().eq("project_id", projectId);
    if (error) throw new PersistenceError(`미리보기 링크 폐기 실패: ${error.message}`);
  }
}
