# 모바일 청첩장 (marriage)

모바일 청첩장 제작 웹앱. 제작자는 편집기에서 청첩장을 만들고 발행하며, 하객은 발행된
주소로 청첩장을 보고 RSVP를 제출한다.

- **단일 renderer**: 편집기 미리보기와 공개 페이지가 같은 renderer를 쓴다 (ADR-004)
- **문서 = 버전 있는 JSON**: 모든 편집은 typed action으로만 이뤄지고 undo/redo 가능
- **AI 도우미**: 자연어 요청 → 기존 action allowlist로 검증된 제안 → 검토 후 적용 (ADR-022)
- **RSVP private 경계**: 하객 응답은 청첩장 문서와 물리적으로 분리 저장 (ADR-021)
- **service role 키 미사용**: 모든 DB 접근은 사용자 세션 + RLS (ADR-006)

## 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Zod · Zustand+Immer ·
Supabase (Postgres/RLS/Storage/Auth) · Vitest · Playwright

## 로컬 개발 환경

요구: Node 20+, npm, [Supabase CLI](https://supabase.com/docs/guides/cli),
Docker 호환 런타임(Rancher Desktop 등).

```bash
npm install

# 1) 로컬 Supabase 기동 (마이그레이션 자동 적용)
supabase start

# 2) 환경 변수 — supabase start 출력의 API URL / anon key
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 채우기
#   (값 확인: supabase status -o env)

# 3) 개발 서버
npm run dev   # http://localhost:3000
```

AI 도우미를 로컬에서 써 보려면 `.env.local`에 `AI_PROVIDER=mock`(결정적 mock) 또는
`ANTHROPIC_API_KEY` + `AI_MODEL`(실제 모델)을 설정한다. 없으면 AI 버튼만 '미설정'
안내를 띄우고 편집기는 완전히 동작한다.

## 마이그레이션

- 마이그레이션 파일: `supabase/migrations/*.sql` (타임스탬프 순서로 적용)
- 새 마이그레이션 적용(로컬): `supabase migration up`
- 처음부터 재적용(로컬 데이터 초기화): `supabase db reset`
- 적용 상태 확인: `supabase migration list --local`
- 클라우드 적용: `supabase link --project-ref <ref>` 후 `supabase db push`
  (자세한 절차·롤백은 `docs/DEPLOYMENT.md`)

## 검사와 테스트

```bash
npm run format:check     # prettier
npm run lint             # eslint (모듈 경계 규칙 포함)
npm run typecheck        # tsc
npm run check:renderer-units  # renderer에 vw/vh/@media 금지 검사
npm test                 # 단위 테스트 (vitest)
npm run test:integration # RLS·RPC 통합 테스트 — supabase start 필요
npm run test:e2e         # Playwright — supabase start 필요, 포트 3100에 프로덕션 서버 자체 기동
```

e2e는 `AI_PROVIDER=mock`을 주입한 프로덕션 빌드 서버(포트 3100)를 스스로 띄운다.
빌드가 바뀌었으면 실행 전 `npm run build`를 먼저 하고, 3100 포트의 오래된 서버는
종료할 것 (`reuseExistingServer: true`라 이전 빌드를 재사용할 수 있다).

## 프로젝트 구조

```
src/
├── invitation/   # 도메인: 문서 스키마(zod)·action 엔진·마이그레이션·AI 검증·RSVP 규칙
├── renderer/     # 단일 renderer — 컨테이너 기반(vw/vh/@media 금지), 편집·공개 공용
├── editor/       # 편집기 UI (store·autosave·패널·AI 다이얼로그)
├── server/       # 서버/어댑터: Supabase 구현체·AI provider·rate limit (app이 주입)
├── ui/           # 편집기 공용 UI 부품
└── app/          # Next.js 라우트 — 어댑터를 조립해 주입하는 유일한 계층
supabase/migrations/  # DB 스키마·RLS·RPC (전체 이력)
docs/                 # ARCHITECTURE · DECISIONS(ADR) · PRODUCT_SPEC · DEPLOYMENT · CURRENT_STATE
e2e/                  # Playwright 시나리오
tests/integration/    # 실제 로컬 Supabase 대상 RLS·RPC 검증
```

모듈 의존 방향은 eslint(boundaries)로 강제된다:
`invitation ← renderer ← editor`, `server → invitation`, `app → 전부`.

## 문서

- `docs/ARCHITECTURE.md` — 시스템 구조·경계·데이터 흐름
- `docs/DECISIONS.md` — ADR 전체 (보안 가정 포함)
- `docs/PRODUCT_SPEC.md` — 제품 사양·projection 표
- `docs/DEPLOYMENT.md` — 배포 체크리스트·롤백·백업/복구
- `docs/CURRENT_STATE.md` — 현재 상태·알려진 한계·백로그
