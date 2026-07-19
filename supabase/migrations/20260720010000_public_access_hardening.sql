-- Phase 11 — 공개 접근 경화: publish_records 직접 조회 차단 (ADR-023)
--
-- 문제: anon 키는 공개돼 있으므로 PostgREST로 publish_records를 직접 SELECT하면
-- 앱의 public projection(buildPublicPayload)을 우회할 수 있었다.
--  * 숨긴 섹션(visible=false)의 내용(숨겨 둔 계좌번호·연락처 등)까지 doc 전문이 노출된다
--  * slug 필터 없이 조회하면 발행된 모든 청첩장을 열거할 수 있다
--  * published_rev·revision_id 같은 내부 메타데이터가 노출된다
-- 해결: 게스트 읽기를 slug 단건 definer RPC로만 허용하고, 숨긴 섹션 제거를 DB에서 수행한다.

revoke select on public.publish_records from anon;
drop policy "publish: 공개 select" on public.publish_records;

-- 소유자 select에서 'or status = live' 제거 — authenticated도 남의 발행본을 직접 읽을 수 없다
drop policy "publish: 소유자 select" on public.publish_records;
create policy "publish: 소유자 select" on public.publish_records for select to authenticated
  using (public.owns_project(project_id));

-- ── RPC: slug로 발행본 조회 (anon 호출용 — 유일한 게스트 읽기 경로) ──────────
-- security definer이므로 live 상태 확인과 숨긴 섹션 제거를 반드시 여기서 한다.

create function public.get_published_by_slug(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_record public.publish_records%rowtype;
  v_sections jsonb;
begin
  select * into v_record
  from public.publish_records
  where slug = p_slug and status = 'live';
  if v_record.project_id is null then
    return null; -- 미발행·발행 중단·없는 slug 구분 없이 거부 (존재 여부 비노출)
  end if;

  -- 숨긴 섹션은 내용째 제거 — 앱의 buildPublicPayload와 같은 규칙의 DB측 1차 방어
  select coalesce(jsonb_agg(section order by idx), '[]'::jsonb)
  into v_sections
  from jsonb_array_elements(v_record.doc -> 'sections') with ordinality as t(section, idx)
  where (section ->> 'visible')::boolean;

  return jsonb_build_object(
    'doc', jsonb_set(v_record.doc, '{sections}', v_sections),
    'schemaVersion', v_record.schema_version,
    'assets', v_record.assets
  );
end;
$$;

grant execute on function public.get_published_by_slug(text) to anon, authenticated;

-- ── publish_project: slug 중복 검사를 제약 기반으로 교체 ─────────────────────
-- 기존의 `if exists (select … where slug = …)` 사전 검사는 invoker 가시성에 의존했는데,
-- 위 정책 변경으로 남의 발행 행이 보이지 않아 동작하지 않는다(게다가 경쟁 상태도 있었다).
-- unique 제약(publish_records_slug_key) 위반을 잡아 slug_taken으로 돌려준다 —
-- 예외 블록은 서브트랜잭션이므로 발행 revision 부산물도 함께 롤백된다.

create or replace function public.publish_project(p_project_id uuid, p_slug text, p_assets jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_doc public.invitation_documents%rowtype;
  v_revision_id uuid;
  v_constraint text;
begin
  select * into v_doc from public.invitation_documents
  where project_id = p_project_id
  for update;
  if v_doc.project_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  begin
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
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'publish_records_slug_key' then
      return jsonb_build_object('status', 'slug_taken');
    end if;
    raise;
  end;

  return jsonb_build_object(
    'status', 'published',
    'slug', p_slug,
    'publishedRev', v_doc.doc_rev,
    'revisionId', v_revision_id
  );
end;
$$;

-- ── restore_revision: 복원 직전 상태 자동 백업 ───────────────────────────────
-- autosave는 revision을 만들지 않으므로, 마지막 checkpoint 이후 진행된 현재 초안은
-- 복원이 덮어쓰면 어디에도 남지 않았다(undo 스택도 초기화된다). 복원 전에 현재
-- rev의 revision이 없으면 checkpoint로 만들어 두어 복원을 항상 되돌릴 수 있게 한다.

create or replace function public.restore_revision(p_project_id uuid, p_revision_id uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_revision public.revisions%rowtype;
  v_doc public.invitation_documents%rowtype;
  v_new_rev integer;
begin
  select * into v_revision from public.revisions
  where id = p_revision_id and project_id = p_project_id;
  if v_revision.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_doc from public.invitation_documents
  where project_id = p_project_id
  for update;
  if v_doc.project_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not exists (
    select 1 from public.revisions
    where project_id = p_project_id and rev = v_doc.doc_rev
  ) then
    insert into public.revisions (project_id, rev, kind, label, doc, schema_version)
    values (p_project_id, v_doc.doc_rev, 'checkpoint', '복원 전 자동 저장',
            v_doc.doc, v_doc.schema_version);
  end if;

  v_new_rev := v_doc.doc_rev + 1;

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
