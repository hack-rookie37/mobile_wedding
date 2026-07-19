-- Phase 9 — RSVP 응답 저장소 + 제출 RPC (ADR-021)
--
-- 데이터 경계 (PRODUCT_SPEC §8·§9):
--  * 응답은 invitation 문서(jsonb)가 아니라 이 테이블에만 존재한다.
--  * 읽기·삭제는 프로젝트 소유자만(RLS). anon에게는 select grant 자체가 없다.
--  * 쓰기는 submit_rsvp(security definer)가 유일한 경로다. anon 키는 브라우저에
--    내장되는 공개 값이므로, 발행 상태·마감일·입력 제약·일일 상한·중복 처리는
--    route handler가 아니라 반드시 여기(DB)에서 성립해야 한다.
--  * 프로젝트 삭제 시 응답은 FK cascade로 함께 물리 삭제된다.

create table public.rsvp_responses (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  -- 같은 브라우저의 재제출을 '수정'으로 처리하기 위한 클라이언트 토큰 (localStorage 보관)
  client_token text not null check (client_token ~ '^[0-9a-zA-Z_-]{16,64}$'),
  guest_name   text not null check (char_length(guest_name) between 1 and 40),
  side         text check (side in ('groom', 'bride')),         -- null = 미수집·미선택
  attending    boolean not null,
  companions   integer check (companions between 0 and 20),     -- null = 미수집
  meal         text check (meal in ('yes', 'no', 'undecided')), -- null = 미수집·미응답
  phone        text check (char_length(phone) <= 20),
  message      text check (char_length(message) <= 500),
  consented_at timestamptz not null, -- 개인정보 동의 시각 — 동의 없는 행은 존재할 수 없다
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, client_token)
);

-- 소유자 목록 조회 + retention 작업(작성 시각 기준 일괄 삭제)이 쓰는 index
create index rsvp_responses_project_idx on public.rsvp_responses (project_id, created_at desc);

alter table public.rsvp_responses enable row level security;

create policy "rsvp: 소유자 select" on public.rsvp_responses for select to authenticated
  using (public.owns_project(project_id));
create policy "rsvp: 소유자 delete" on public.rsvp_responses for delete to authenticated
  using (public.owns_project(project_id));
-- insert·update 정책 없음: 게스트 제출은 submit_rsvp(definer)만 가능하고,
-- 소유자도 응답을 만들거나 고칠 수 없다 (조회·삭제만).

grant select, delete on public.rsvp_responses to authenticated;
-- anon에게는 어떤 grant도 없다 — 게스트는 남의(그리고 자신의) 응답 행을 읽을 수 없다.

-- 프로젝트별 일일 제출 상한 (A-17 스팸 방어 — 값의 근거는 ADR-021)
create function public.rsvp_daily_limit()
returns integer
language sql immutable set search_path = ''
as $$ select 200 $$;

-- 게스트 제출 (anon 호출용). security definer: RLS를 우회하는 유일한 쓰기 경로이므로
-- 접수 가능 조건(live 발행 + 보이는 rsvp 섹션 + 마감 전)과 입력 제약을 반드시 여기서 검증한다.
create function public.submit_rsvp(
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
  where slug = p_slug and status = 'live';
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

grant execute on function public.rsvp_daily_limit() to anon, authenticated;
grant execute on function
  public.submit_rsvp(text, text, text, text, boolean, integer, text, text, text, boolean)
  to anon, authenticated;
