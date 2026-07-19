-- Phase 7 — private preview 토큰 + 발행 수명주기 (ADR-019)
--
-- 상태 모델:
--   draft            : publish_records 없음
--   private preview  : preview_links 행 존재 (토큰 = 자격증명, 폐기·재생성·선택 만료)
--   published        : publish_records.status = 'live'
--   unpublished      : publish_records.status = 'off' (스냅샷은 남는다)
--
-- 발행 규칙: publish는 그 시점 draft를 스냅샷하고 해당 doc_rev의 revision을 보장·참조한다.
-- 이후 draft 수정은 republish 전까지 공개본에 반영되지 않는다.

-- ── publish_records: 발행 revision 참조 + slug 형식 제약 ────────────────────

alter table public.publish_records
  add column published_rev integer not null default 1,
  add column revision_id uuid references public.revisions (id) on delete set null;

-- slug: 소문자·숫자·하이픈, 3~40자, 하이픈으로 시작/끝 불가, 연속 하이픈 불가
alter table public.publish_records
  add constraint publish_records_slug_format
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--');

-- 발행 기록도 revision 종류에 포함
alter table public.revisions drop constraint revisions_kind_check;
alter table public.revisions
  add constraint revisions_kind_check
  check (kind in ('origin', 'checkpoint', 'restore', 'publish'));

-- ── preview_links: 비공개 미리보기 토큰 (프로젝트당 1개) ────────────────────

create table public.preview_links (
  project_id uuid primary key references public.projects (id) on delete cascade,
  token      text not null unique check (char_length(token) >= 24), -- 추측 불가 (nanoid 32)
  expires_at timestamptz,                                            -- null = 만료 없음
  created_at timestamptz not null default now()
);

alter table public.preview_links enable row level security;

create policy "preview: 소유자 select" on public.preview_links for select to authenticated
  using (public.owns_project(project_id));
create policy "preview: 소유자 insert" on public.preview_links for insert to authenticated
  with check (public.owns_project(project_id));
create policy "preview: 소유자 update" on public.preview_links for update to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "preview: 소유자 delete" on public.preview_links for delete to authenticated
  using (public.owns_project(project_id));

grant select, insert, update, delete on public.preview_links to authenticated;

-- ── RPC: 토큰으로 draft 미리보기 조회 (anon 호출용 — 토큰이 자격증명) ─────────
-- security definer: RLS를 우회하는 유일한 경로이므로 토큰·만료 검증을 반드시 여기서 한다.
-- 반환은 렌더에 필요한 것만 — 편집기 상태·revision 이력·프로젝트 메타는 포함하지 않는다.

create function public.get_preview_by_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_project_id uuid;
  v_doc public.invitation_documents%rowtype;
  v_assets jsonb;
begin
  select project_id into v_project_id
  from public.preview_links
  where token = p_token and (expires_at is null or expires_at > now());
  if v_project_id is null then
    return null; -- 무효·폐기·만료 토큰은 구분 없이 거부 (존재 여부 비노출)
  end if;

  select * into v_doc from public.invitation_documents where project_id = v_project_id;
  if v_doc.project_id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', a.id, 'storagePath', a.storage_path, 'thumbPath', a.thumb_path,
      'width', a.width, 'height', a.height
    )), '[]'::jsonb)
  into v_assets
  from public.project_assets a
  where a.project_id = v_project_id;

  return jsonb_build_object(
    'doc', v_doc.doc,
    'schemaVersion', v_doc.schema_version,
    'assets', v_assets
  );
end;
$$;

grant execute on function public.get_preview_by_token(text) to anon, authenticated;

-- ── RPC: 발행 (원자적) — 스냅샷 + revision 보장·참조 + slug 중복 검사 ─────────

create function public.publish_project(p_project_id uuid, p_slug text, p_assets jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_doc public.invitation_documents%rowtype;
  v_revision_id uuid;
begin
  select * into v_doc from public.invitation_documents
  where project_id = p_project_id
  for update;
  if v_doc.project_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- slug 중복: 다른 프로젝트가 이미 사용 중이면 거부
  if exists (
    select 1 from public.publish_records
    where slug = p_slug and project_id <> p_project_id
  ) then
    return jsonb_build_object('status', 'slug_taken');
  end if;

  -- 발행 시점의 안정된 revision 보장: 현재 rev의 revision이 없으면 'publish'로 생성
  select id into v_revision_id from public.revisions
  where project_id = p_project_id and rev = v_doc.doc_rev;
  if v_revision_id is null then
    insert into public.revisions (project_id, rev, kind, label, doc, schema_version)
    values (p_project_id, v_doc.doc_rev, 'publish', '발행 스냅샷', v_doc.doc, v_doc.schema_version)
    returning id into v_revision_id;
  end if;

  insert into public.publish_records
    (project_id, slug, doc, schema_version, assets, status, published_at, published_rev, revision_id)
  values
    (p_project_id, p_slug, v_doc.doc, v_doc.schema_version, p_assets, 'live', now(),
     v_doc.doc_rev, v_revision_id)
  on conflict (project_id) do update set
    slug = excluded.slug,
    doc = excluded.doc,
    schema_version = excluded.schema_version,
    assets = excluded.assets,
    status = 'live',
    published_at = excluded.published_at,
    published_rev = excluded.published_rev,
    revision_id = excluded.revision_id;

  return jsonb_build_object(
    'status', 'published',
    'slug', p_slug,
    'publishedRev', v_doc.doc_rev,
    'revisionId', v_revision_id
  );
end;
$$;

grant execute on function public.publish_project(uuid, text, jsonb) to authenticated;
