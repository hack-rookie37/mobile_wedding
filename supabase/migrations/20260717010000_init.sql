-- Phase 6 — 인증·영속화·revision·발행 스냅샷 (ARCHITECTURE §7, ADR-006 · ADR-012 · ADR-018)
--
-- 원칙:
--  * 모든 접근은 사용자 세션(RLS invoker)으로 — service role 키는 어디에도 쓰지 않는다.
--  * draft(invitation_documents) / 발행 스냅샷(publish_records) / asset 메타(project_assets)를
--    물리적으로 분리한다. RSVP는 이번 phase 범위 밖(테이블 없음).
--  * 문서 저장은 낙관적 동시성(doc_rev) — 두 탭 동시 편집은 save_document가 conflict로 감지한다.
--  * revision 복원은 파괴적이지 않다 — 복원 자체가 새 revision을 만든다.

-- ── users: auth.users의 public 표현 ─────────────────────────────────────────

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: 본인 조회"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- auth.users 생성 시 profiles 자동 생성 (Supabase 표준 패턴 — definer는 이 트리거 한정)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── projects ────────────────────────────────────────────────────────────────

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  status     text not null default 'draft' check (status in ('draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

create policy "projects: 소유자 select" on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "projects: 소유자 insert" on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "projects: 소유자 update" on public.projects for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "projects: 소유자 delete" on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

-- 소유권 검사 단일 소스 (하위 테이블 RLS가 공유)
create function public.owns_project(p_project_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = (select auth.uid())
  );
$$;

-- ── invitation_documents: 프로젝트당 현재 draft 문서 1개 ────────────────────

create table public.invitation_documents (
  project_id     uuid primary key references public.projects (id) on delete cascade,
  doc            jsonb not null,
  schema_version integer not null,
  doc_rev        integer not null default 1,  -- 낙관적 동시성 토큰
  updated_at     timestamptz not null default now()
);

alter table public.invitation_documents enable row level security;

create policy "documents: 소유자 select" on public.invitation_documents for select to authenticated
  using (public.owns_project(project_id));
create policy "documents: 소유자 insert" on public.invitation_documents for insert to authenticated
  with check (public.owns_project(project_id));
create policy "documents: 소유자 update" on public.invitation_documents for update to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "documents: 소유자 delete" on public.invitation_documents for delete to authenticated
  using (public.owns_project(project_id));

-- ── revisions: 의미 있는 checkpoint (autosave마다 만들지 않는다) ─────────────

create table public.revisions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  rev            integer not null,             -- 스냅샷 시점의 doc_rev
  kind           text not null check (kind in ('checkpoint', 'restore', 'origin')),
  label          text not null check (char_length(label) between 1 and 120),
  doc            jsonb not null,
  schema_version integer not null,
  created_at     timestamptz not null default now(),
  unique (project_id, rev)
);

create index revisions_project_idx on public.revisions (project_id, created_at desc);

alter table public.revisions enable row level security;

create policy "revisions: 소유자 select" on public.revisions for select to authenticated
  using (public.owns_project(project_id));
create policy "revisions: 소유자 insert" on public.revisions for insert to authenticated
  with check (public.owns_project(project_id));
create policy "revisions: 소유자 delete" on public.revisions for delete to authenticated
  using (public.owns_project(project_id));
-- update 정책 없음 — revision은 불변이다.

-- ── project_assets: 업로드 이미지 메타 (파일은 Storage) ─────────────────────

create table public.project_assets (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  filename     text not null,
  mime_type    text not null,
  bytes        integer not null check (bytes >= 0),
  width        integer not null check (width >= 1),
  height       integer not null check (height >= 1),
  content_hash text not null,
  storage_path text not null,
  thumb_path   text,
  created_at   timestamptz not null default now(),
  unique (project_id, content_hash)            -- 중복 업로드 감지 (ADR-016)
);

create index project_assets_project_idx on public.project_assets (project_id, created_at desc);

alter table public.project_assets enable row level security;

create policy "assets: 소유자 select" on public.project_assets for select to authenticated
  using (public.owns_project(project_id));
create policy "assets: 소유자 insert" on public.project_assets for insert to authenticated
  with check (public.owns_project(project_id));
create policy "assets: 소유자 delete" on public.project_assets for delete to authenticated
  using (public.owns_project(project_id));

-- ── publish_records: 발행 스냅샷 (ADR-012) — 유일한 공개 데이터 ─────────────

create table public.publish_records (
  project_id     uuid primary key references public.projects (id) on delete cascade,
  slug           text not null unique,
  doc            jsonb not null,               -- 발행 시점 스냅샷 (draft와 분리)
  schema_version integer not null,
  assets         jsonb not null default '[]',  -- 공개 렌더용 asset manifest (id·url·치수)
  status         text not null check (status in ('live', 'off')),
  published_at   timestamptz not null default now()
);

alter table public.publish_records enable row level security;

-- 게스트(anon)는 live 스냅샷만 — private draft는 어떤 경로로도 노출되지 않는다
create policy "publish: 공개 select" on public.publish_records for select to anon
  using (status = 'live');
create policy "publish: 소유자 select" on public.publish_records for select to authenticated
  using (public.owns_project(project_id) or status = 'live');
create policy "publish: 소유자 insert" on public.publish_records for insert to authenticated
  with check (public.owns_project(project_id));
create policy "publish: 소유자 update" on public.publish_records for update to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "publish: 소유자 delete" on public.publish_records for delete to authenticated
  using (public.owns_project(project_id));

-- ── RPC: 원자적 작업 (전부 security invoker — RLS가 그대로 적용된다) ────────

-- 프로젝트 + 문서 + 최초 revision을 원자적으로 생성
create function public.create_project_with_document(
  p_title text,
  p_doc jsonb,
  p_schema_version integer
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  insert into public.projects (owner_id, title)
  values ((select auth.uid()), p_title)
  returning id into v_project_id;

  insert into public.invitation_documents (project_id, doc, schema_version)
  values (v_project_id, p_doc, p_schema_version);

  insert into public.revisions (project_id, rev, kind, label, doc, schema_version)
  values (v_project_id, 1, 'origin', '처음 만든 상태', p_doc, p_schema_version);

  return v_project_id;
end;
$$;

-- 낙관적 동시성 저장: expected_rev 불일치 = 다른 탭이 먼저 저장 → conflict 반환
create function public.save_document(
  p_project_id uuid,
  p_expected_rev integer,
  p_doc jsonb,
  p_schema_version integer
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_current integer;
begin
  select doc_rev into v_current
  from public.invitation_documents
  where project_id = p_project_id
  for update;

  if v_current is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_current <> p_expected_rev then
    return jsonb_build_object('status', 'conflict', 'currentRev', v_current);
  end if;

  update public.invitation_documents
  set doc = p_doc, schema_version = p_schema_version,
      doc_rev = v_current + 1, updated_at = now()
  where project_id = p_project_id;

  update public.projects set updated_at = now() where id = p_project_id;

  return jsonb_build_object('status', 'saved', 'rev', v_current + 1);
end;
$$;

-- 현재 문서를 checkpoint로 저장 (같은 rev의 revision이 이미 있으면 그것을 반환)
create function public.create_checkpoint(p_project_id uuid, p_label text)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_doc public.invitation_documents%rowtype;
  v_existing public.revisions%rowtype;
begin
  select * into v_doc from public.invitation_documents where project_id = p_project_id;
  if v_doc.project_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_existing from public.revisions
  where project_id = p_project_id and rev = v_doc.doc_rev;
  if v_existing.id is not null then
    return jsonb_build_object('status', 'exists', 'revisionId', v_existing.id, 'rev', v_existing.rev);
  end if;

  insert into public.revisions (project_id, rev, kind, label, doc, schema_version)
  values (p_project_id, v_doc.doc_rev, 'checkpoint', p_label, v_doc.doc, v_doc.schema_version)
  returning * into v_existing;

  return jsonb_build_object('status', 'created', 'revisionId', v_existing.id, 'rev', v_existing.rev);
end;
$$;

-- revision 복원: 과거를 파괴하지 않는다 — 복원 결과가 새 doc_rev + 새 revision이 된다
create function public.restore_revision(p_project_id uuid, p_revision_id uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_revision public.revisions%rowtype;
  v_current integer;
  v_new_rev integer;
begin
  select * into v_revision from public.revisions
  where id = p_revision_id and project_id = p_project_id;
  if v_revision.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select doc_rev into v_current from public.invitation_documents
  where project_id = p_project_id
  for update;
  if v_current is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_new_rev := v_current + 1;

  update public.invitation_documents
  set doc = v_revision.doc, schema_version = v_revision.schema_version,
      doc_rev = v_new_rev, updated_at = now()
  where project_id = p_project_id;

  update public.projects set updated_at = now() where id = p_project_id;

  insert into public.revisions (project_id, rev, kind, label, doc, schema_version)
  values (p_project_id, v_new_rev, 'restore',
          '‘' || v_revision.label || '’ 복원', v_revision.doc, v_revision.schema_version);

  return jsonb_build_object('status', 'restored', 'rev', v_new_rev, 'doc', v_revision.doc,
                            'schemaVersion', v_revision.schema_version);
end;
$$;

-- ── Storage: photos 버킷 (공개 읽기 — uuid 경로로 열거 불가) ─────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp']);

-- 경로 규약: projects/{projectId}/{assetId}[.thumb].{ext} — 두 번째 세그먼트로 소유권 판정
create function public.storage_path_owned(p_name text)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select (storage.foldername(p_name))[1] = 'projects'
     and public.owns_project(((storage.foldername(p_name))[2])::uuid);
$$;

create policy "photos: 공개 읽기" on storage.objects for select to anon, authenticated
  using (bucket_id = 'photos');
create policy "photos: 소유자 업로드" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.storage_path_owned(name));
create policy "photos: 소유자 수정" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.storage_path_owned(name))
  with check (bucket_id = 'photos' and public.storage_path_owned(name));
create policy "photos: 소유자 삭제" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.storage_path_owned(name));

-- ── GRANT: 명시적 최소 권한 (RLS는 행 필터, GRANT는 동사 허용 — 둘 다 필요) ──
-- profiles는 트리거(definer)가 쓰므로 select만. revisions는 불변이라 update 없음.

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.invitation_documents to authenticated;
grant select, insert, delete on public.revisions to authenticated;
grant select, insert, delete on public.project_assets to authenticated;
grant select on public.publish_records to anon;
grant select, insert, update, delete on public.publish_records to authenticated;

grant execute on function public.owns_project(uuid) to authenticated;
grant execute on function public.storage_path_owned(text) to authenticated;
grant execute on function public.create_project_with_document(text, jsonb, integer) to authenticated;
grant execute on function public.save_document(uuid, integer, jsonb, integer) to authenticated;
grant execute on function public.create_checkpoint(uuid, text) to authenticated;
grant execute on function public.restore_revision(uuid, uuid) to authenticated;
