-- RSVP 동의 체크박스 제거 (ADR-055)
--
-- 필수 동의 체크가 제출 문턱이 되어 응답을 막았다 — 이 서비스의 목적은 많이 남기는 것이다.
-- 개인 청첩장의 소규모 수집이고, 수집 항목 안내는 폼 문안이 맡는다.
--
--  * consented_at은 과거 행의 기록으로만 남는다. null = 동의 단계가 없어진 뒤의 응답.
--  * p_consent 파라미터는 시그니처만 남기고 무시한다 — DB를 먼저 밀어도(권장 순서)
--    아직 배포 전인 구버전 폼(p_consent를 보낸다)이 계속 접수된다.
--    다음 마이그레이션에서 파라미터째 제거한다.

alter table public.rsvp_responses alter column consented_at drop not null;
comment on column public.rsvp_responses.consented_at is
  '동의 체크박스가 있던 시기의 동의 시각 — ADR-055 이후의 행은 null';

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
  p_consent boolean default null -- 무시된다 (구버전 클라이언트 호환용)
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
    (project_id, client_token, guest_name, side, attending, companions, meal, phone, message)
  values
    (v_project_id, p_client_token, btrim(p_guest_name), p_side, p_attending, p_companions,
     p_meal, nullif(btrim(coalesce(p_phone, '')), ''), nullif(coalesce(p_message, ''), ''))
  on conflict (project_id, client_token) do update set
    guest_name = excluded.guest_name,
    side = excluded.side,
    attending = excluded.attending,
    companions = excluded.companions,
    meal = excluded.meal,
    phone = excluded.phone,
    message = excluded.message,
    updated_at = now();

  return jsonb_build_object(
    'status', 'ok',
    'result', case when v_existing is null then 'created' else 'updated' end
  );
end;
$$;
