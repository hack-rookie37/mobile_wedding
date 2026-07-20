# DEPLOYMENT — 배포·롤백·백업

대상 구성: **클라우드 Supabase**(DB·Auth·Storage) + **Vercel**(Next.js 앱).
다른 호스팅도 가능하지만 아래 체크리스트는 이 조합 기준이다.

## 1. 배포 전 체크리스트

### 1.1 검사 (전부 green이어야 배포)

```bash
npm run format:check && npm run lint && npm run typecheck && npm run check:renderer-units
npm test
supabase start && npm run test:integration
npm run build
npm run test:e2e
```

### 1.2 Supabase 프로젝트 준비

- [ ] 프로젝트 생성, 리전 선택 (한국 사용자 → `ap-northeast-2`)
- [ ] `supabase link --project-ref <ref>`
- [ ] **마이그레이션 적용**: `supabase db push`
      (`supabase/migrations/*.sql` 전체가 순서대로 적용된다. 적용 결과 확인:
      `supabase migration list --linked`)
- [ ] Auth 설정: 이메일/비밀번호 로그인 활성, Site URL = 배포 도메인,
      이메일 확인 정책 결정(로컬 기본은 확인 없음 — 운영에서는 확인 활성 권장)
- [ ] **공개 가입 차단**: Authentication → Sign In / Providers → *Allow new users to sign up* **끄기**
      (ADR-024). 제품 UI에 가입 화면이 없어도 anon 키는 공개되므로, 이 설정을 끄지 않으면
      누구나 `auth.signUp()`을 직접 호출해 계정을 만들 수 있다. 로컬 `config.toml`은
      테스트 때문에 켜져 있으니 **운영에서 반드시 별도로 확인한다.**
- [ ] **운영 계정 생성**: Authentication → Users → *Add user* → *Create new user*로
      직접 만든다(이메일 확인을 켰다면 *Auto Confirm User* 체크). 가입 화면이 없으므로
      계정 추가 경로는 이곳뿐이다.
- [ ] Storage: `photos` 버킷은 마이그레이션이 생성한다(공개 읽기·10MB·jpeg/png/webp).
      대시보드에서 존재·설정만 확인
- [ ] **service role 키는 어떤 환경 변수에도 넣지 않는다** (ADR-006)

### 1.3 Vercel(앱) 설정

- [ ] 환경 변수 (`.env.example` 참고):
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon(publishable) 키
  - (선택) `NEXT_PUBLIC_KAKAO_JS_KEY` — 카카오톡 공유 버튼. 없으면 '링크 복사'만 나온다
  - (선택) `ANTHROPIC_API_KEY` + `AI_MODEL` — AI 도우미. 서버 전용, `NEXT_PUBLIC_` 금지
  - `AI_PROVIDER`는 운영에 설정하지 않는다(mock은 데모·테스트용)
- [ ] 빌드 커맨드 `npm run build` / Node 20+
- [ ] 커스텀 도메인 연결 → Supabase Auth Site URL·Redirect URL에 반영
- [ ] 도메인 루트에 청첩장을 띄우려면 편집기에서 **공개 주소를 비운 채 발행**한다 (ADR-029)
- [ ] 카카오 개발자 콘솔: JavaScript SDK 도메인 + 제품 링크 관리 > 웹 도메인에 운영 도메인 등록

### 1.4 배포 직후 스모크 테스트 (수동)

- [ ] 대시보드에서 만든 계정으로 로그인 → 샘플 생성 → 편집 → 자동 저장 표시 확인
- [ ] 가입이 실제로 막혔는지 확인: 브라우저 콘솔에서
      `await (await import('@supabase/supabase-js')).createClient(URL, ANON).auth.signUp(...)`
      또는 Auth REST `POST /auth/v1/signup`이 `signup_disabled`로 거부되는지 본다
- [ ] 사진 업로드 → 갤러리 배치
- [ ] 비공개 미리보기 링크 발급 → 시크릿 창에서 열림 확인 → 폐기 → 접근 거부 확인
- [ ] 발행 → `/i/<slug>` 하객 화면 확인 → RSVP 제출 → 결과 페이지에서 확인
- [ ] 발행 중단 → `/i/<slug>`가 '찾을 수 없습니다'로 바뀌는지 확인
- [ ] (AI 키 설정 시) AI 제안 → 검토 → 적용 → undo

## 2. 마이그레이션 운용

- 마이그레이션은 **append-only**다. 적용된 파일은 수정하지 않고 새 파일을 추가한다.
- 순서: **DB 먼저, 앱 나중** — 단, 앱이 의존하는 RPC를 제거하는 마이그레이션은
  앱 배포 후에 적용한다(하위 호환 유지).
- 로컬 검증 없이 `db push` 금지: 새 마이그레이션은 로컬에서
  `supabase db reset` → 통합 테스트 → e2e까지 통과한 뒤 push한다.

## 3. 롤백 절차

### 3.1 앱 롤백 (1순위 — 대부분의 문제)

Vercel 대시보드 → Deployments → 이전 배포 **Promote to Production**.
DB 스키마가 하위 호환(추가만)인 한 이전 앱은 그대로 동작한다.

### 3.2 DB 롤백 (신중히)

Postgres 마이그레이션은 자동 역적용되지 않는다. 원칙:

1. **롤백 대신 전진 수정(fix-forward)** — 문제를 고치는 새 마이그레이션을 추가한다.
2. 함수(RPC)·정책(RLS) 결함은 이전 정의를 담은 새 마이그레이션으로 즉시 되돌릴 수
   있다 (`create or replace function` / `drop policy` + `create policy`).
3. 테이블·컬럼 삭제를 되돌려야 하면 백업 복원뿐이다 → §4.

### 3.3 장애 시 임시 차단

- 발행물 문제: 소유자가 해당 프로젝트 **발행 중단**(status='off') — 즉시 비공개
- RSVP 폭주·어뷰징: `submit_rsvp`의 일일 상한(기본 200)이 1차 방어.
  긴급 시 `rsvp_daily_limit()`을 낮추는 마이그레이션 적용(함수 교체만으로 반영)

## 4. 백업·복구

- **DB**: Supabase 자동 백업(플랜에 따라 daily/PITR). 배포 전 수동 스냅샷을 원하면
  `supabase db dump --linked -f backup.sql` (스키마+데이터).
  복구는 새 프로젝트에 restore 후 앱 환경 변수 전환을 기본 경로로 한다.
- **Storage(photos)**: DB 백업에 포함되지 않는다. 파일 경로 규약이
  `projects/{projectId}/{contentHash}.{ext}`이므로 `project_assets` 테이블과 함께
  버킷을 주기적으로 미러링(rclone 등)하면 복구 가능. 사진 원본은 사용자 기기에도
  있으므로 최악의 경우 재업로드로 복구 가능하다는 것이 MVP 가정.
- **복구 리허설**: 운영 전환 전에 dump → 빈 프로젝트 restore → 앱 연결 → 스모크
  테스트를 1회 수행할 것.
- 계정 삭제(auth.users 삭제)는 DB row를 cascade로 지우지만 **storage 파일은 남는다**
  (알려진 한계 — CURRENT_STATE §7). 계정 삭제 기능을 만들기 전에 정리 경로 필요.

## 5. 운영 시 알아둘 것

- 공개 페이지(`/i/[slug]`)는 요청마다 SSR + DB 1회 조회다(캐시 없음) — 항상 최신이
  보장되는 대신 트래픽이 크면 ISR/태그 캐시 도입을 검토 (백로그).
- 하객 읽기 경로는 definer RPC 2개(`get_published_root`·`get_published_by_slug`)뿐이다 —
  `publish_records` 테이블 직접 SELECT는 anon에게 없다 (ADR-023). 새 공개 필드가 필요하면
  두 RPC가 공유하는 `published_payload`에 추가한다.
- 로그에는 RSVP·AI 요청의 내용이 남지 않는다(이벤트·코드만). 로그 수집기를 붙일 때
  이 정책을 유지할 것 (ADR-021·022).
- `npm audit`의 postcss moderate 경고는 next 16.2.10이 내부 번들한 개발 의존성으로,
  빌드 타임 한정이며 외부 입력이 닿지 않는다. next 패치 릴리스에서 해소 예정 —
  업그레이드 시 재확인.
