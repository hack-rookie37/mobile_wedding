-- 도메인 루트 발행: slug를 선택값으로 (ADR-029)
--
-- 발행의 기본은 도메인 루트다 — 하객에게 건네는 주소에 슬러그가 붙어 있을 이유가 없다.
-- slug를 적어 넣은 발행본만 /i/<slug>로 따로 열린다.
--   slug IS NULL → 도메인 루트 (/)
--   slug = 'xxx' → /i/xxx
--
-- slug 형식 check 제약(publish_records_slug_format)은 그대로 둔다 — NULL이면 검사식이
-- NULL로 평가되어 통과한다(제약은 FALSE일 때만 막는다).

alter table public.publish_records alter column slug drop not null;

-- 루트는 동시에 하나뿐. 'live'만 세는 게 핵심이다 — 발행을 중단한 청첩장이 도메인을
-- 계속 붙들고 있으면 다른 청첩장을 루트로 올릴 수 없게 된다.
-- (부분 unique는 제약으로 만들 수 없어 인덱스로 만든다. unique_violation의
--  constraint_name에는 이 인덱스 이름이 담긴다.)
create unique index publish_records_single_live_root
  on public.publish_records ((slug is null))
  where slug is null and status = 'live';

-- ── 하객용 payload 변환 (조회 RPC 2개가 공유) ────────────────────────────────
-- 숨긴 섹션은 내용째 제거 — 앱의 buildPublicPayload와 같은 규칙의 DB측 1차 방어.
-- definer RPC 안에서만 호출되므로 anon에게 따로 grant하지 않는다.
create function public.published_payload(p_record public.publish_records)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_sections jsonb;
begin
  select coalesce(jsonb_agg(section order by idx), '[]'::jsonb)
  into v_sections
  from jsonb_array_elements(p_record.doc -> 'sections') with ordinality as t(section, idx)
  where (section ->> 'visible')::boolean;

  return jsonb_build_object(
    'doc', jsonb_set(p_record.doc, '{sections}', v_sections),
    'schemaVersion', p_record.schema_version,
    'assets', p_record.assets
  );
end;
$$;

-- ── RPC: 도메인 루트 발행본 조회 (anon 호출용) ───────────────────────────────
create function public.get_published_root()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_record public.publish_records%rowtype;
begin
  select * into v_record
  from public.publish_records
  where slug is null and status = 'live';
  if v_record.project_id is null then
    return null; -- 아직 아무것도 루트로 발행하지 않았다
  end if;
  return public.published_payload(v_record);
end;
$$;

grant execute on function public.get_published_root() to anon, authenticated;

-- ── RPC: slug 조회를 공통 변환으로 교체 (동작 동일) ──────────────────────────
create or replace function public.get_published_by_slug(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_record public.publish_records%rowtype;
begin
  select * into v_record
  from public.publish_records
  where slug = p_slug and status = 'live';
  if v_record.project_id is null then
    return null; -- 미발행·발행 중단·없는 slug 구분 없이 거부 (존재 여부 비노출)
  end if;
  return public.published_payload(v_record);
end;
$$;

-- ── publish_project: p_slug NULL 허용 + 루트 선점 응답 ───────────────────────
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
    if v_constraint = 'publish_records_single_live_root' then
      return jsonb_build_object('status', 'root_taken');
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

-- ── submit_rsvp: 루트 청첩장(slug IS NULL)도 접수 대상이 된다 ────────────────
-- `slug = p_slug`는 p_slug가 NULL이면 어떤 행과도 맞지 않는다(NULL 비교는 NULL이다).
-- IS NOT DISTINCT FROM은 NULL끼리도 같다고 보므로 루트를 정확히 한 행으로 찾는다.
-- 나머지 본문은 20260717030000_rsvp.sql과 동일하다.
create or replace function public.submit_rsvp(
  p_slug text,
  p_client_token text,
  p_guest_name text,
  p_side text,
  p_attending boolean,
  p_companions integer,
  p_meal text,
  p_phone text,
  p_message text,
  p_consent boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_project_id uuid;
  v_doc jsonb;
  v_rsvp jsonb;
  v_deadline text;
  v_existing uuid;
begin
  -- 동의는 저장의 전제 조건 (A-16) — consented_at not null과 이중으로 강제한다
  if p_consent is distinct from true then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- 입력 제약을 먼저 검사해 깨끗한 상태 코드로 거부한다 (check 제약은 최후 방어선)
  if p_client_token is null or p_client_token !~ '^[0-9a-zA-Z_-]{16,64}$'
     or p_guest_name is null or char_length(btrim(p_guest_name)) not between 1 and 40
     or (p_side is not null and p_side not in ('groom', 'bride'))
     or p_attending is null
     or (p_companions is not null and p_companions not between 0 and 20)
     or (p_meal is not null and p_meal not in ('yes', 'no', 'undecided'))
     or char_length(coalesce(p_phone, '')) > 20
     or char_length(coalesce(p_message, '')) > 500 then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- 발행 중(live)인 청첩장만 접수한다 — 발행 중단 시 접수도 닫힌다
  select project_id, doc into v_project_id, v_doc
  from public.publish_records
  where slug is not distinct from p_slug and status = 'live';
  if v_project_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- 공개 스냅샷에 보이는 RSVP 섹션이 있어야 한다 (섹션을 껐으면 접수도 없다)
  select value into v_rsvp
  from jsonb_array_elements(v_doc->'sections')
  where value->>'type' = 'rsvp' and (value->>'visible')::boolean
  limit 1;
  if v_rsvp is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- 마감일 경과 시 접수 종료
  v_deadline := v_rsvp->'content'->>'deadline';
  if v_deadline is not null and now() > v_deadline::timestamptz then
    return jsonb_build_object('status', 'closed');
  end if;

  select id into v_existing
  from public.rsvp_responses
  where project_id = v_project_id and client_token = p_client_token;

  -- 일일 상한은 새 행에만 적용한다 — 기존 응답의 수정은 상한과 무관하게 허용
  if v_existing is null and (
    select count(*) from public.rsvp_responses
    where project_id = v_project_id and created_at > now() - interval '24 hours'
  ) >= public.rsvp_daily_limit() then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- on conflict upsert: 존재 검사와 삽입 사이의 동시 제출 경합에도 안전하다
  insert into public.rsvp_responses
    (project_id, client_token, guest_name, side, attending, companions, meal, phone, message,
     consented_at)
  values
    (v_project_id, p_client_token, btrim(p_guest_name), p_side, p_attending, p_companions,
     p_meal, nullif(btrim(coalesce(p_phone, '')), ''), nullif(coalesce(p_message, ''), ''), now())
  on conflict (project_id, client_token) do update set
    guest_name = excluded.guest_name,
    side = excluded.side,
    attending = excluded.attending,
    companions = excluded.companions,
    meal = excluded.meal,
    phone = excluded.phone,
    message = excluded.message,
    consented_at = excluded.consented_at,
    updated_at = now();

  return jsonb_build_object(
    'status', 'ok',
    'result', case when v_existing is null then 'created' else 'updated' end
  );
end;
$$;
