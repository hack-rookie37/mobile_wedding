-- 로컬 개발 계정. `supabase db reset`은 auth.users를 통째로 비우므로, 마이그레이션을
-- 추가할 때마다 로그인 계정이 사라진다. 이 파일이 매 reset 뒤에 계정을 다시 만들어 준다.
--
-- **로컬 전용이다.** seed는 `supabase start` / `db reset`에서만 실행되고 `db push`로는
-- 운영 DB에 가지 않는다. 운영 계정은 대시보드에서 직접 만든다 (ADR-024, DEPLOYMENT §1.2).
-- 그래서 여기 적힌 비밀번호는 공개돼도 무방한 로컬 값이다.
--
-- profiles 행은 auth.users에 걸린 on_auth_user_created 트리거가 함께 만든다 — 직접 넣지 않는다.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000000d1',
  'authenticated',
  'authenticated',
  'dev@local.test',
  crypt('000000', gen_salt('bf')),
  now(), -- 이메일 확인됨으로 둔다: 로컬은 메일이 도착할 곳이 없다
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  '', '', '', ''
)
on conflict (id) do nothing;

-- 비밀번호 로그인은 identities 행까지 있어야 성립한다 (GoTrue가 provider로 조회한다)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-0000000000e1',
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email = 'dev@local.test'
on conflict (id) do nothing;
