# DECISIONS — Architecture Decision Records

- 형식: 각 ADR은 Status / Context / Decision / Consequences / Alternatives.
- Status: `Accepted`(적용) / `Proposed`(검토 중) / `Superseded by ADR-xxx`.
- 새 결정은 번호를 증가시켜 추가하고, 뒤집을 때는 기존 ADR을 지우지 말고 Superseded 처리한다.

---

## ADR-001. 단일 Next.js 앱 + 내부 모듈 경계 (모노레포 미도입)

**Status**: Accepted (2026-07-16)

**Context**: renderer를 편집기와 공개 페이지가 공유해야 한다. 패키지로 분리(모노레포)할지, 한 앱 안의 모듈로 둘지.

**Decision**: 단일 Next.js 앱. `src/invitation·renderer·editor·server·ui·app` 모듈 분리와 eslint-plugin-boundaries로 경계를 강제한다 (ARCHITECTURE §2).

**Consequences**: 빌드·배포·의존성 관리가 단순(KISS). 경계는 도구 없이 무너질 수 있으므로 lint 게이트가 CI 필수. 훗날 renderer를 별도 패키지로 뽑을 때 경계가 이미 그어져 있어 이동 비용이 낮다.

**Alternatives**: pnpm workspace 모노레포 — 앱이 하나뿐인 현재는 오버헤드만 추가 (YAGNI).

---

## ADR-002. 청첩장 = versioned JSON document (Zod 4 단일 스키마)

**Status**: Accepted (2026-07-16)

**Context**: 요구사항 6 — 청첩장 하나는 versioned JSON document. 스키마 검증·타입·AI tool 정의가 모두 필요하다.

**Decision**: `schemaVersion` 정수를 가진 단일 JSON 문서. Zod 4 스키마가 타입(z.infer)·런타임 검증·sensitive 메타(`.meta()`)·AI tool JSON Schema(`z.toJSONSchema`)의 **단일 소스**. 마이그레이션은 forward-only 순차 적용, 로드·저장·발행·공개 렌더 4개 경계에서 full parse (fail fast).

**Consequences**: 지식 중복 없음(타입≠검증≠AI 스키마 불일치 원천 차단). 문서가 커지면 parse 비용이 있으나 청첩장 규모(수십 KB)에서는 무시 가능. 프로젝트 제목 등 문서 밖 메타데이터는 DB 컬럼이 단일 소스 — 문서에 넣지 않는다.

**Alternatives**: DB 정규화 테이블(섹션별 행) — 순서 변경·undo·스냅샷이 전부 복잡해짐. JSON Schema 수기 관리 — Zod와 이중 관리.

---

## ADR-003. typed action + Immer patch 기반 undo/redo

**Status**: Accepted (2026-07-16)

**Context**: 요구사항 7·8 — 직접 편집과 AI 편집이 같은 시스템, 모든 중요한 편집은 undo 가능.

**Decision**: 문서를 바꾸는 유일한 경로는 typed action → zod 검증 → `applyAction`(순수 함수). Immer `produceWithPatches`로 정·역 패치를 얻어 히스토리에 저장. 타이핑은 `coalesceKey`(action+section+field, 1s 창)로 병합. 히스토리는 세션 인메모리 100스텝 (A-11).

**Consequences**: AI든 GUI든 같은 검증·히스토리를 지나므로 "AI 편집도 undo 가능"이 구조적으로 성립. action 카탈로그가 곧 AI tool 목록. 문서 외 데이터(프로젝트명, 발행)는 action이 아니며 undo 비대상 — 범위가 명확해짐.

**Alternatives**: 전체 스냅샷 스택 — 사진 많은 문서에서 메모리 낭비, diff 정보 없음. CRDT/OT — 실시간 협업이 non-goal이므로 과잉.

---

## ADR-004. renderer 단일화: 인라인 프리뷰 + 뷰포트 단위 금지

**Status**: Accepted (2026-07-16)

**Context**: 요구사항 5 — 편집기 미리보기와 공개 청첩장이 동일 renderer. 프리뷰를 iframe에 띄우면 뷰포트가 실제와 같아 정확하지만 스타일·상태 전달이 번거롭고, 인라인이면 간단하지만 `vw/@media`가 편집기 뷰포트에 반응해 실물과 달라진다.

**Decision**: **인라인 마운트**를 택하고, 대신 renderer에 `vw/vh/@media` 사용을 금지한다 — 컨테이너 쿼리와 상대 단위만 허용. CI grep 검사 + 리뷰로 강제. renderer는 `editor`를 import할 수 없고(경계 매트릭스) mode prop으로만 편집기 요구(선택 오버레이, 인터랙션 차단)를 수용한다. `next/image` 등 Next 의존은 허용한다(두 화면 모두 Next 앱 내부).

**Consequences**: 프리뷰 구현이 단순하고 상태 공유가 직접적. 단위 규칙이라는 지속 비용이 생기며, 반복 위반 시 iframe 프리뷰로 전환한다(예비안, 리스크 R-2).

**Alternatives**: iframe + postMessage — 정확도는 높지만 첫 슬라이스 복잡도가 크게 증가. 스크린샷 방식 — "실제 스크롤·인터랙션 확인" 요구와 충돌.

---

## ADR-005. Next.js 16 App Router, 공개 페이지는 RSC + 태그 캐시

**Status**: Accepted (2026-07-16)

**Context**: 편집기(고인터랙션 SPA성)와 공개 페이지(정적에 가까운 고성능 모바일 페이지)를 한 코드베이스에서.

**Decision**: Next.js 16.2 App Router 단일 앱. 공개 페이지 `/i/[slug]`는 RSC로 스냅샷을 서버 렌더하고 `inv:${slug}` 태그 캐시, 발행 시 `revalidateTag`. 편집기는 클라이언트 컴포넌트 중심. 인증 mutation은 server action, 게스트 RSVP는 route handler.

**Consequences**: 공개 페이지 JS를 인터랙티브 프리미티브로 최소화 가능(성능 예산의 전제). Vercel 배포와 자연 결합 (A-20). Next 메이저 업그레이드는 ADR 갱신 대상.

**Alternatives**: 편집기 SPA(Vite)+공개 Astro 2앱 — renderer 공유가 패키지화 강제로 복잡해짐. Remix — 태그 캐시·image·og 등 통합 기능에서 이점 없음.

---

## ADR-006. Supabase (Auth·Postgres RLS·Storage), 데이터 3분리

**Status**: Accepted (2026-07-16)

**Context**: 요구사항 9 — RSVP 응답과 공개 청첩장 데이터는 별도 저장. 인증·저장소도 필요.

**Decision**: Supabase 단일 백엔드. `projects(draft)` / `publications(발행 스냅샷)` / `rsvp_responses(게스트 개인정보)`를 물리적으로 분리하고 RLS로 접근 경계를 선언한다 (ARCHITECTURE §7). 서버 코드도 사용자 세션 클라이언트로 RLS를 통과하며, service role 키는 MVP에서 사용하지 않는 것을 목표로 한다.

**Consequences**: draft 유출·RSVP 혼입이 스키마 수준에서 차단. RLS 정책이 테스트 대상(리스크 R-3). Supabase 종속은 `server/` 모듈에 격리되어 있어 교체 시 영향 범위가 명확.

**Alternatives**: Neon+Auth.js+S3 조립 — 유연하나 MVP 속도 저하. Firebase — JSONB 질의·SQL RLS 표현력 부족.

---

## ADR-007. 편집기 상태: Zustand 5 + Immer 11

**Status**: Accepted (2026-07-16)

**Context**: undo 히스토리·선택 상태·저장 상태를 다루는 클라이언트 스토어가 필요. ADR-003이 Immer patch를 전제.

**Decision**: Zustand 5 단일 스토어(doc/ui/save 3슬라이스) + Immer 11. React Context+useReducer 대비 셀렉터 구독으로 대형 문서 리렌더를 제어.

**Consequences**: 의존 2개 추가로 히스토리 요구를 정면 해결. renderer는 스토어를 모르므로(경계) 스토어 교체가 편집기 내부 문제로 한정.

**Alternatives**: Redux Toolkit — 보일러플레이트 대비 이점 없음. Jotai — patch 축적 모델과 결이 안 맞음.

---

## ADR-008. DnD: Atlassian pragmatic-drag-and-drop (dnd-kit 탈락)

**Status**: Accepted (2026-07-16)

**Context**: 좌측 섹션 목록·갤러리 사진 정렬에 드래그가 필요. 기본 후보는 dnd-kit이었다. 2026-07-16 npm 실측: `@dnd-kit/core` 6.3.1 — **마지막 배포 2024-12-05 (19개월 정체)**. `@atlaskit/pragmatic-drag-and-drop` 2.0.1 — 마지막 배포 2026-06-17, Jira·Trello에서 프로덕션 검증.

**Decision**: pragmatic-drag-and-drop 채택. 단, headless라 구현량이 있으므로 `editor/dnd` 어댑터 모듈로 격리하고 사용처는 "수직 리스트 정렬"과 "사진 그리드 정렬" 2종으로 한정한다.

**Consequences**: 유지보수 리스크 제거, 번들 소형(코어 ~5KB). 드롭 인디케이터 등 UI를 직접 그려야 함(리스크 R-1) — 어댑터 뒤에 있으므로 문제 시 dnd-kit(설치는 여전히 가능, React 19 peer 충족)으로 교체 가능.

**Alternatives**: dnd-kit — API는 편하지만 정체 상태의 라이브러리를 신규 채택하는 것은 부채 선매입. HTML5 native DnD — 모바일·접근성·프리뷰 스크롤 간섭 처리 비용이 더 큼.

---

## ADR-009. Tailwind CSS 4 — CSS-first 토큰, canvas/tool 이중 네임스페이스

**Status**: Accepted (2026-07-16)

**Context**: 청첩장(테마 가변)과 편집기(고정 UI)의 스타일 체계가 다르다.

**Decision**: Tailwind 4.3 `@theme`로 토큰 정의. `--tool-*`(편집기 고정)과 `--canvas-*`(렌더러 루트에서 테마가 런타임 주입) 네임스페이스 분리 (DESIGN_SYSTEM §2). 렌더러는 `--canvas-*`만 참조.

**Consequences**: 테마 전환 = CSS 변수 재주입으로 끝. 편집기 리디자인이 청첩장에 영향 불가. Tailwind 4는 CSS-first라 별도 config 파일 관리 부담이 없음.

**Alternatives**: CSS Modules+수기 변수 — 토큰·유틸리티 일관성 관리 비용. styled-components류 — RSC 결합 나쁨.

---

## ADR-010. TypeScript ~5.9.3 고정 (TS 7 보류)

**Status**: Accepted (2026-07-16) — 재평가 조건부

**Context**: 2026-07-16 기준 `typescript@latest`는 7.0.2 (Go 네이티브 컴파일러, 2026-07-08 GA). 그러나 (1) 7.0은 안정 프로그래매틱 API 없이 출시되어 typescript-eslint 등 API 의존 도구가 미지원(7.1의 신규 API 대기), (2) Next.js가 패키지 감지에 실패하는 이슈가 공개 논의 중, (3) 6.0.3은 브리지 릴리스로 생태계 지원이 아직 얕다.

**Decision**: `typescript@~5.9.3`으로 고정(strict). **재평가 조건**: Next.js 공식 TS 7 지원 + typescript-eslint의 TS 7(신규 API) 지원이 모두 릴리스되면 업그레이드 ADR을 추가한다.

**Consequences**: 8–12배 빌드 속도 향상을 당장 포기하지만 도구 체인이 예측 가능. 5.9는 보수적 선택이라 라이브러리 호환 문제 없음.

**근거 자료**: [TypeScript 7.0 발표(Microsoft)](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [Next.js TS 7 지원 논의 #95633](https://github.com/vercel/next.js/discussions/95633)

---

## ADR-011. AI 프라이버시 경계: 스키마 sensitive 메타 + redacted projection

**Status**: Accepted (2026-07-16) — provider 선정은 Proposed

**Context**: 요구사항 10 — 사진 원본·계좌·연락처·RSVP는 기본적으로 AI에 미전송. 그러나 AI가 해당 섹션을 편집할 수는 있어야 한다 (모순 #4).

**Decision**:
1. 민감 필드는 Zod 스키마에 `.meta({ sensitive: true })`로 선언 — 목록의 단일 소스.
2. AI 호출 전 `redactForAI(doc)`가 sensitive 값을 구조 보존 placeholder로 치환, 사진은 개수·배치 메타만, RSVP 응답은 컨텍스트에서 원천 배제.
3. AI 출력은 자연어가 아닌 **typed action** (ADR-003과 동일 파이프라인) — 검증·undo 자동 성립.
4. 사용자가 채팅에 직접 쓴 민감 값은 사용자 제공 데이터로 간주해 action 반영 허용.
5. AI provider·모델 선정은 VS8 착수 시 최신 조사 후 별도 ADR (A-21).

**Consequences**: "무엇을 가리는가"가 스키마와 함께 진화(누락 위험 최소화). redaction은 순수 함수라 속성 테스트 가능 (VS4 AC).

**Alternatives**: AI에 전체 문서 제공 + 정책 프롬프트 — 유출을 확률에 맡기게 되므로 기각. 민감 섹션 편집 전면 금지 — 구조 편집(순서·표시)까지 막아 과잉.

---

## ADR-012. 발행 모델: 프로젝트당 라이브 스냅샷 1개 + 랜덤 slug

**Status**: Accepted (2026-07-16)

**Context**: 발행 후 편집이 공개 페이지에 즉시 반영되면 하객이 편집 중간 상태를 보게 된다 (모순 #5).

**Decision**: 발행 = draft를 검증 후 `publications`에 스냅샷 복사(프로젝트당 1행, 재발행 시 덮어씀). slug는 nanoid 10자, 재발행에도 URL 불변. 발행 중단은 `status='off'`. 발행 이력·롤백은 post-MVP.

**Consequences**: 하객은 항상 완결 상태만 본다. 태그 캐시와 결합해 읽기 부하가 DB에 도달하지 않음. 이력 미보관은 의식적 절충 — 필요해지면 append-only로 전환.

**Alternatives**: draft 직접 공개 — 중간 상태 노출. 발행마다 새 URL — 이미 전송한 링크가 죽어 치명적.

---

## ADR-013. 외부 미디어: 지도는 Kakao Maps SDK, 영상은 YouTube 임베드 전용

**Status**: Accepted (2026-07-16) — 영상 부분은 ADR-017에서 Vimeo 포함으로 확장

**Context**: 하객 대부분이 카카오 생태계 사용자. 영상 트랜스코딩은 non-goal (모순 #3).

**Decision**: Venue 지도는 Kakao Maps JS SDK(`NEXT_PUBLIC_KAKAO_MAPS_JS_KEY` 필수 env, 없으면 기동 실패 — fail fast, 폴백 렌더 없음). 길찾기는 카카오내비·네이버지도·티맵 딥링크. Video 섹션은 YouTube URL 임베드만 지원, 업로드·자동재생 없음.

**Consequences**: 외부 키 발급이 VS2의 선행 조건(리스크 R-4). 영상 저장·대역폭 비용 0. 네이버 지도 선호 사용자는 길찾기 딥링크로 커버.

**Alternatives**: 지도 정적 이미지 — 확대·이동 불가로 UX 저하. 영상 파일 업로드+외부 트랜스코딩 SaaS — 비용·복잡도 대비 MVP 가치 낮음.

---

## ADR-014. 테마 시스템: 테마 = 토큰 + 섹션 variant 레지스트리 (스키마 v2)

**Status**: Accepted (2026-07-16, Phase 3)

**Context**: 서로 다른 디자인 방향 3개(Warm Editorial / Modern Monochrome / Film Diary)를 같은 문서·같은 renderer 위에서 제공해야 한다. 테마가 시각적으로 명확히 달라야 하지만, 테마별로 renderer나 비즈니스 로직이 복제되면 유지보수가 무너진다. 기존 v1 스키마의 `theme { preset, fontPair }`(색+폰트만)로는 spacing·image treatment·section pacing 차이를 표현할 수 없었다.

**Decision**:
1. 문서 스키마 v2: `theme: { id: "warm-editorial" | "modern-monochrome" | "film-diary" }`. v1 → v2 forward 마이그레이션(preset `snow`→monochrome, 나머지→warm-editorial)으로 기존 localStorage 문서 자동 승격 — 마이그레이션 체계 첫 실전 가동.
2. 테마 정의(`invitation/schema/themes.ts`)는 두 가지만 담는다:
   - **토큰**: 팔레트·서체·radius·섹션 pad(sm/md/lg)·모션(duration/ease/distance) → renderer 루트에서 `--canvas-*` CSS 변수로 주입.
   - **variant 선택**: 섹션 타입별 표현 이름(`editorial`/`mono`/`film`) + sectionDivider + photoTreatment.
3. 렌더러 섹션 컴포넌트는 variant 이름으로 **마크업만** 분기한다. 데이터 준비·포맷(`format.ts`)·불변식은 단일 경로 — 비즈니스 로직 테마별 복제 금지.
4. `layout.variant`(photoArch, grid3 등)는 사용자 콘텐츠 선택으로 문서에 남고 테마가 덮어쓰지 않는다. 테마 전환은 `updateTheme` action(undo 가능)이며 텍스트·사진·순서·visibility를 보존한다 — e2e로 검증.
5. 기본 추천 **warm-editorial**, 감성 대안 **film-diary**, 현대 대안 **modern-monochrome** (토큰·variant 상세: DESIGN_SYSTEM §2).

**Consequences**: 새 테마 추가 = themes.ts에 정의 1개 추가(+필요시 variant 구현). 테마 수가 늘어도 문서·action·저장 경로는 불변. variant 분기가 섹션 컴포넌트에 존재하므로 섹션당 마크업 3벌은 감수 — 대신 grep 가능한 한 파일 안에 있다. 색 오버라이드·커스텀 토큰은 v2 스키마의 후속 확장(VS6)으로 열려 있다.

**Alternatives**: 테마별 렌더러 분리 — 단일 renderer 원칙(ADR-004) 위반, 3배 유지보수. CSS 토큰만으로 차별화 — 폴라로이드·메타 행 같은 구조 차이를 표현 불가, "세 테마가 거의 같아 보이는" 실패 조건에 걸림. 문서에 토큰 값 직접 저장 — 테마 개선이 기존 문서에 전파되지 않아 기각.

---

## ADR-015. action 엔진 v2: 카탈로그 확정 + no-op·batch·버전 경계 + 순수 히스토리 코어

**Status**: Accepted (2026-07-16, Phase 4A) — ADR-003을 구체화·확장

**Context**: Phase 1의 action 4종은 편집기 최소 동작용이었다. 섹션 구조 편집(추가/삭제/복제/정렬/숨김), asset 참조, variant 변경까지 커버하고 AI assistant가 나중에 같은 파이프라인을 쓸 수 있으려면 카탈로그와 엔진 계약을 확정해야 한다. 또한 no-op이 히스토리를 오염시키는 문제, 여러 변경을 한 undo 스텝으로 묶을 수단, 구버전 문서에 action이 적용되는 사고의 방지가 필요했다.

**Decision**:
1. **카탈로그 확정**: document action 12종(`addSection`/`removeSection`/`duplicateSection`/`reorderSections`/`toggleSectionVisibility`/`updateSectionContent`/`updateSectionSettings`/`setSectionVariant`/`setTheme`/`updateWedding`/`assignAsset`/`removeAssetReference`) + `batch` + 세션 action `selectSection`. 기존 `moveSection`은 **순열 방식 `reorderSections`로 대체**(index 산술 제거 — 드래그·AI 양쪽에서 stale index 사고 차단), `updateTheme`은 `setTheme {themeId}`로 정리.
2. **결과 계약**: `applyAction → {outcome:"applied", doc, patches, inversePatches} | {outcome:"noop"}`. invalid는 `InvalidActionError` throw — 문서 불변이 계약상 자명하다.
3. **no-op 감지**: 패치 0개 또는 적용 결과가 원본과 구조적으로 동일(deepEquals)하면 noop → 히스토리 미기록. 문서 크기가 수 KB라 전수 비교 비용은 무시 가능.
4. **batch**: 하위 action 순차 적용 + patches 연결(inverse 역순) + 원자성(중간 실패 시 전체 거부) + 히스토리 1스텝. 중첩 batch·세션 action 포함은 스키마가 거부.
5. **버전 경계**: 엔진은 `CURRENT_SCHEMA_VERSION` 문서만 받는다. 구버전은 로드 경계에서 `migrateDocument`로 승격 — action과 마이그레이션의 책임 분리.
6. **stable id**: id는 `deps.generateId` 주입점(기본 nanoid)으로 생성하고 patches에 고정 → redo가 같은 id를 재현. duplicate는 원본 스냅샷의 깊은 복사 + 충돌 시 재시도로 모든 id 유일성을 보장.
7. **히스토리 순수 코어 분리**: `recordEntry`/`undoOnce`/`redoOnce`/coalescing/용량(100)을 `invitation/actions/history.ts`로 이동 — zustand store는 위임만 하고, AI 세션이 동일 코어를 재사용할 수 있다.

**Consequences**: 필수 시나리오 13종을 포함한 단위 테스트 73개가 엔진 계약을 고정한다. UI가 아직 없는 action(add/remove/duplicate/visibility/asset)도 엔진·테스트가 먼저 존재하므로 VS2·VS3 UI는 dispatch만 연결하면 된다. patches 기반이라 undo/redo가 action 종류와 무관하게 균일하다. deepEquals 전수 비교는 문서가 커지면(사진 수백 장) 재평가 대상.

**Alternatives**: command별 수동 inverse 구현 — action마다 역연산을 손으로 유지해야 하고 batch 조합이 어긋나기 쉬워 기각(Immer patches가 자동 도출). `moveSection(index)` 유지 — 동시 편집·드래그 중 재정렬에서 stale index 버그 표면이 커서 순열로 대체. 스냅샷 스택 undo — 메모리 낭비와 diff 부재로 기각(ADR-003 유지).

---

## ADR-016. 미디어 파이프라인: AssetStore adapter 경계 + 문서에는 assetId·표시 metadata만 (스키마 v3)

**Status**: Accepted (2026-07-17, Phase 5)

**Context**: media library·gallery editor를 구현해야 하는데 backend storage(Supabase)는 아직 없다. 업로드 UI가 로컬 저장 구현에 직접 결합되면 VS3 전환 때 UI를 다시 짜야 한다. 또한 crop(확대·초점)·caption·alt 같은 표시 정보를 어디에 둘지, 원본 이미지와의 관계를 어떻게 정의할지 확정이 필요했다.

**Decision**:
1. **adapter 경계 우선**: UI는 `AssetStore` 인터페이스(`invitation/assets/assetTypes.ts` — `list`/`upload{onProgress}`/`remove`)와 동기 해석기 `resolveAsset(assetId) → {src, srcSet?, width, height} | null`에만 결합한다. Phase 5 구현체는 `editor/assets/localAssetStore.ts`(IndexedDB) — VS3에서 이 파일만 Supabase Storage 어댑터로 교체된다.
2. **문서 스키마 v3**: 갤러리 사진은 `{assetId, alt?, caption?, frame?}`, hero는 `photoAssetId + photoFrame?`. **원본 파일·base64는 문서에 저장 금지.** `frame = {zoom 1~3, focalX/Y 0~1}`은 순수 표시 metadata — 원본 asset은 불변이고 렌더러가 object-position + transform으로 적용한다(비파괴 crop, 초기화 = frame 제거).
3. **업로드 정책 단일 소스**(`uploadPolicy.ts`): JPG·PNG·WebP, ≤10MB(형식·크기는 파일을 읽기 전 즉시 거부 — fail fast), 가로 800px 미만은 경고만. 중복은 SHA-256 content hash로 감지해 기존 asset을 반환(저장 안 함). 640px 썸네일을 파생 저장해 srcset(반응형 이미지)을 로컬에서도 실제로 제공한다.
4. **누락 asset 안전 fallback**: `resolveAsset`이 null을 반환하면 PhotoFrame이 aspect-ratio 자리를 유지한 채 '이미지 없음' placeholder를 그린다(로드 실패 onError와 동일 처리). 사용 중인 asset 삭제는 경고 후 허용 — 참조는 남고 fallback으로 표시.
5. **action 카탈로그 확장**: `moveGalleryPhoto {from, to}`(coalescing 비대상 — 이동 1회 = undo 1스텝), `updateGalleryPhoto {index, patch{alt?, caption?, frame?}}`(섹션+index+필드 단위 coalescing — 캡션 타이핑·crop 슬라이더는 병합). `frame: null`이 crop 제거의 직렬화 가능한 표현. `assignAsset` 교체는 alt·caption을 보존하고 frame을 초기화한다(crop은 특정 이미지에 종속).
6. **갤러리 layout variant 확장**: `grid2 | grid3 | slider | filmstrip | collage` (v2→v3 마이그레이션: carousel→slider 개명). variant 전환은 이미지·순서·metadata를 보존한다.

**Consequences**: 업로드·삭제·선택 UI와 renderer는 저장 구현을 모른다 — Supabase 전환 시 `localAssetStore.ts`(+`builtinAssets.ts` 병합 정책)만 교체. 문서 JSON은 사진 수백 장이어도 KB 단위 유지. 처음 시도한 "photos 배열 통째 patch(updateSectionContent)" 방식은 reorder와 캡션 타이핑이 같은 coalescing 키를 공유해 undo granularity가 무너지는 결함이 e2e에서 드러나 전용 action 2종으로 교체했다(카탈로그 12→14종). hero의 crop 제거는 `updateSectionContent {photoFrame: undefined}` 경유라 JSON 직렬화 표현이 없다 — AI 경로에서 hero crop 초기화가 필요해지면 후속 정리 대상.

**Alternatives**: localStorage에 base64 저장 — 5MB 한도·문서 오염으로 기각. 문서에 crop된 파생 이미지 저장 — 원본 손실·재편집 불가로 기각(비파괴 metadata 채택). 사진 항목에 고유 id 부여 후 id 기반 action — 스키마 churn 대비 이득이 작아 index 기반 유지(동시 편집 도입 시 재평가).

---

## ADR-017. MVP 동영상: YouTube·Vimeo 외부 URL 임베드 전용 (ADR-013 개정)

**Status**: Accepted (2026-07-17, Phase 5) — ADR-013의 영상 부분을 Vimeo 포함으로 확장

**Context**: 동영상 파일 업로드·트랜스코딩은 non-goal. ADR-013은 YouTube만 명시했으나 Phase 5 요구로 Vimeo 계열도 지원.

**Decision**: `video` 섹션(스키마 v3 신설)은 사용자가 붙여넣은 **원본 URL 문자열만** 문서에 저장한다. 임베드 주소는 렌더 시점에 `invitation/lib/videoEmbed.ts`가 파생 — YouTube(watch/youtu.be/shorts/embed → `youtube-nocookie.com/embed`), Vimeo(`player.vimeo.com/video`). 호스트는 정확히 일치해야 하며(서브스트링 스푸핑 차단) 그 외 주소는 렌더러가 안내 placeholder를 그린다. iframe은 16:9 자리를 항상 예약(CLS 방지)하고 `loading="lazy"`.

**Consequences**: 저장·대역폭 비용 0, 트랜스코딩 없음. youtube-nocookie로 하객 추적 최소화. 지원 플랫폼 추가는 파서 함수 확장만으로 가능.

**Alternatives**: URL을 저장 시점에 임베드 주소로 변환 — 원본 입력을 잃어 수정 UX가 나빠지고, 임베드 정책 변경 시 기존 문서를 일괄 수정해야 해서 기각.

---

## ADR-018. 영속화 v1: persistence port 주입 + doc_rev 낙관적 동시성 + 비파괴 revision

**Status**: Accepted (2026-07-17, Phase 6)

**Context**: localStorage 영속화를 Supabase로 교체하면서 ① 편집기 UI가 backend SDK에 결합되지 않아야 하고(모듈 매트릭스: editor→server 금지), ② 두 탭 동시 편집이 서로를 덮어쓰지 않아야 하며, ③ revision 복원이 과거 기록을 파괴하지 않아야 했다. 데이터 영역은 users/projects/invitation_documents/project_assets/revisions/publish_records 6개(RSVP 제외).

**Decision**:
1. **Port 주입**: 편집기는 `invitation/persistence/port.ts`의 `ProjectPersistence`(load/save/listRevisions/createCheckpoint/restoreRevision/publish)와 기존 `AssetStore` 인터페이스만 안다. Supabase 구현(`server/supabase/*`)은 app 라우트가 조립해 prop으로 주입 — UI 모듈에서 Supabase SDK 직접 호출 금지를 구조로 보장.
2. **낙관적 동시성**: `invitation_documents.doc_rev` + RPC `save_document(expectedRev)` — 불일치 시 `conflict` 반환(덮어쓰기 없음). 편집기의 자동 저장 컨트롤러(`editor/autosave.ts`, 순수 로직·타이머 주입)가 디바운스(1.5s)·실패 재시도·충돌 차단 상태 기계를 소유하고, 충돌 시 '최신 상태 불러오기'로 복구한다. 저장 안 된 변경이 있으면 beforeunload 경고.
3. **비파괴 revision**: `revisions`는 불변 테이블(update 정책·grant 없음). kind = origin(생성 시 자동)/checkpoint(사용자 라벨)/restore. `restore_revision`은 대상 revision의 문서를 새 doc_rev로 쓰고 그 결과를 다시 restore revision으로 남긴다 — 어떤 복원도 과거를 지우지 않는다. autosave는 revision을 만들지 않는다(도큐먼트당 checkpoint는 rev당 1개).
4. **분리 저장**: projects(메타) / invitation_documents(draft 1개) / publish_records(발행 스냅샷 + 공개 asset manifest). 공개 페이지는 manifest만으로 렌더 — anon은 project_assets grant 자체가 없다.
5. **보안 기준선**: 전 테이블 RLS + 명시적 최소 GRANT(로컬 스택이 기본 DML grant를 주지 않음을 통합 테스트로 확인), RPC 전부 security invoker, service role 키 미사용(ADR-006 유지), storage 정책은 경로의 projectId 소유권 검사. middleware는 리다이렉트 편의일 뿐 방어선은 RLS.
6. **원자성 경계**: 다중 테이블 쓰기(생성·저장·checkpoint·복원)는 SQL 함수로 원자화. 프로젝트 복제는 클라이언트 오케스트레이션(rows+파일 복사+`remapAssetIds`로 문서 참조 재매핑) — 부분 실패 시 잔여물은 삭제 가능하며 원자화는 후속 과제.

**Consequences**: Supabase 교체 지점이 `server/supabase/` 한 겹으로 수렴 — 편집기·렌더러는 무변경으로 백엔드를 갈아탈 수 있다. 통합 테스트(vitest, 실제 로컬 스택)가 소유권·충돌·복원·복제·삭제·공개 경계를 고정한다. StrictMode 이중 마운트에서 autosave 컨트롤러가 dispose된 채 남는 버그를 겪은 뒤 컨트롤러 생성·폐기를 effect 안에서 짝짓는 규칙을 확립했다. doc_rev는 탭 간 충돌만 다루며 실시간 협업(merge)은 범위 밖.

**Alternatives**: last-write-wins — 두 탭 요구사항 위반으로 기각. 문서를 projects.doc에 내장(기존 스케치) — revision·발행과의 조인 명확성을 위해 별도 테이블로 분리. CRDT/실시간 동기화 — MVP 범위 밖(YAGNI). 서버 전용 server actions 경유 — 브라우저 세션 클라이언트 + RLS로 충분하고 왕복이 적다.

---

## ADR-019. 발행 수명주기 v1: preview 토큰(definer RPC) + revision 참조 발행 + public projection

**Status**: Accepted (2026-07-17, Phase 7)

**Context**: draft → 비공개 검토(계정 없는 가족·배우자) → 공개 발행 → 중단의 수명주기가 필요하다. 발행 후 draft 수정이 하객에게 새어 나가면 안 되고(ADR-012), 공개 응답에 편집기 상태·revision 이력·내부 storage 경로가 실리면 안 된다.

**Decision**:
1. **상태 모델**: draft(기본) / private preview(`preview_links` 행 존재) / published(`publish_records.status='live'`) / unpublished(`'off'` — 스냅샷 보존). unpublish 후 재발행으로 복구.
2. **preview 토큰**: 프로젝트당 1개, nanoid 32자(≈190bit). 재생성=upsert(이전 토큰 즉시 무효), 폐기=행 삭제, 만료=`expires_at`(없음/24h/7d). 접근은 anon이 호출하는 **security definer RPC** `get_preview_by_token` — RLS를 우회하는 유일한 경로이므로 토큰·만료 검증을 함수 안에서 수행하고, 무효·폐기·만료를 구분 없이 거부한다(존재 여부 비노출). 미리보기는 스냅샷이 아니라 **현재 draft**를 렌더한다(검토 목적).
3. **발행 = revision 참조 스냅샷**: `publish_project` RPC(invoker)가 ① slug 중복 검사(타 프로젝트) ② 현재 doc_rev의 revision 보장(없으면 kind `publish`로 생성) ③ `publish_records` upsert(`published_rev`·`revision_id`·`published_at`)를 원자적으로 수행. draft 수정은 republish 전까지 공개본 불변. slug는 사용자 설정(`^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`, 연속 하이픈 금지) — 규칙은 TS(`invitation/lib/slug.ts`)와 DB check 제약 양쪽에 선언(진입점 fail fast + 최종 방어).
4. **명시적 public projection** (`invitation/publicPayload.ts`): 공개·미리보기 응답은 `buildPublicPayload`를 통과한 것만 클라이언트로 나간다 — 문서는 zod 화이트리스트 full parse(스키마 밖 키 제거), asset은 `.strict()` 스키마(공개 URL·치수만 — storage 경로가 섞이면 통과가 아니라 실패). social metadata(`publicPageMeta`)도 여기서 파생.
5. **공개 페이지**: RSC 서버 렌더(+`generateMetadata`: og/twitter, 대표 이미지=hero asset, **robots noindex** — 하객 전용), 모바일 우선 최대 430px 중앙 정렬, Web Share API + 클립보드 복사 fallback. `/p/[token]`과 `/i/[slug]`는 동일한 `PublicInvitationView` → 동일 `InvitationRenderer`(ADR-004 유지).

**Consequences**: "공개되는 것"의 정의가 projection 한 곳에 수렴 — 단위 테스트가 여분 키 제거를, 통합 테스트가 anon 경계·토큰 수명·republish 의미론을, e2e가 UI 수명주기 전체를 고정한다. definer 함수가 하나 생겼다(감사 대상 — 토큰 검증 로직 변경 시 주의). 이 과정에서 SectionShell의 revealed 초기값이 SSR/클라이언트 간 달라지는 hydration 결함을 발견해 수정했다(초기값은 항상 동일, reduced motion은 effect에서 처리). e2e는 dev 서버(3000) 재사용의 비결정성을 피하기 위해 전용 프로덕션 포트(3100)를 쓴다.

**Alternatives**: 미리보기를 발행처럼 스냅샷 — 검토 목적(최신 초안 확인)과 어긋나 기각. 토큰을 URL 서명(JWT)으로 — 폐기(서버 상태 필요)가 어차피 요구라 테이블 방식이 단순. slug를 자동 생성만 허용 — 청첩장은 이름 있는 주소(minjun-seoyeon)가 제품 가치라 사용자 설정 채택. per-request projection 없이 발행 시 1회만 — 레거시 스냅샷 방어(read 시 재검증)를 위해 양쪽 다 수행.

## ADR-020. 공개 섹션 완성 (스키마 v4): 반복 그룹 action + sensitive 스키마 선언 + 지도 딥링크

- **상태**: 승인 (2026-07-17, Phase 8 구현 완료)
- **배경**: 한국 모바일 청첩장의 필수 공개 섹션 7종(신랑신부 소개·캘린더·동영상 개선·교통·연락처·마음 전하실 곳·맺음말)과 venue 외부 지도 연결. 계좌번호·전화번호라는 민감 데이터가 문서에 처음 들어온다.

**Decision**:

1. **스키마 v4** (forward-only 마이그레이션 v3→v4): 신규 6개 섹션 타입은 추가만. 변환이 필요한 것은 둘 — video variant `default`→`embed`(기존 즉시 임베드 동작 보존; 신규 기본은 `facade`=썸네일 탭하여 재생, 자동재생 금지), venue content에 `showMapButtons: true` 추가. 모든 Phase 8 섹션은 layout variant 2개 이상이며 `setSectionVariant`의 content 보존 불변식을 그대로 따른다.
2. **반복 그룹 편집은 `updateListItem`** `{sectionId, field, index, patch}` 하나로 통일 (교통 items·연락처 entries·계좌 accounts). coalesce 키 `uli:섹션:목록:항목:필드` — 같은 항목·같은 필드의 타이핑만 undo 1스텝으로 병합. 항목 추가·삭제는 `updateSectionContent`의 배열 patch로 하되, **coalesceKeyOf가 배열 값 patch를 병합 대상에서 제외**한다(연속 '항목 추가'가 1 undo로 뭉치는 것을 방지 — Phase 5 갤러리 reorder의 교훈을 규칙화). 신랑측/신부측 grouping은 항목의 `side` 필드로 파생 — 중첩 배열을 피해 목록 필드를 항상 content 최상위에 둔다.
3. **sensitive는 스키마에 선언**: `contacts.phone`·`giftAccount.number`에 zod `.meta({ sensitive: true })`. AI projection 구현은 `invitation/sensitive.ts`의 `redactForAi`(구조 보존 `<redacted>` 치환 — AI의 구조 편집은 가능, 값 읽기는 불가). 선언과 구현의 일치는 단위 테스트가 고정한다. 추가로 **public projection이 숨긴 섹션을 내용째 제거**한다 — 꺼둔 계좌·연락처는 게스트 HTML 어디에도 실리지 않는다(e2e HTML 전수 검사). 서버·클라이언트 어디에서도 민감 값을 로그에 남기지 않는다(현재 src/server·src/app에 console 로깅 없음).
4. **지도는 API 없이 URL·딥링크만** (MVP): `invitation/lib/mapLinks.ts` — 네이버(map.naver.com/p/search)·카카오(map.kakao.com/link/search)·티맵(tmap:// 딥링크). 검색어는 주소 우선(없으면 장소명). Kakao Maps JS SDK(ADR-013)는 지도 표시가 필요해질 때 재검토.
5. **일정 저장은 .ics 클라이언트 생성** (`invitation/lib/ics.ts`): 서울 시간을 UTC로 변환해 기록, uid는 결정적(재저장 시 중복 일정 방지), RFC 5545 텍스트 이스케이프. 캘린더 그리드·D-day는 순수 계산(`calendarGrid.ts`) — D-day는 '오늘' 의존이므로 `useSyncExternalStore`(server snapshot null)로 클라이언트에서만 렌더해 SSR hydration 불일치를 원천 차단(ADR-019의 SectionShell 교훈).
6. **게스트 인터랙션은 published 모드에서만 활성** (갤러리 lightbox와 동일 규칙): 계좌 복사·전화/문자·지도 링크·일정 저장·공유·아코디언은 편집 모드에서 비활성(아코디언은 항상 펼침 — 제작자가 내용을 봐야 한다). 접기/펼치기는 공용 `Collapsible`(native button + aria-expanded — 키보드 무료).

**Consequences**: 섹션 카탈로그가 MVP 12종 중 RSVP만 남기고 완성됐다(11종). action은 15종 + batch. 문서에 민감 값이 들어왔지만 세 겹(스키마 선언 → AI projection → 숨김 섹션 제거)의 경계가 테스트로 고정됐다. Vimeo는 인증 없는 썸네일 URL이 없어 facade에서 재생 버튼만 표시된다(재생은 정상).

**Alternatives**: 목록마다 전용 action(moveTransportItem…) — 3개 목록 × 4개 action의 조합 폭발이라 기각(YAGNI). 연락처·계좌를 신랑/신부 중첩 객체로 — updateListItem이 경로 표현을 요구하게 되어 평탄한 배열 + side 파생 채택. Vimeo oEmbed API로 썸네일 — 외부 API 의존·키 관리가 MVP 범위 밖. ICS 대신 Google Calendar URL — iOS 기본 캘린더를 못 다뤄 .ics 채택.

## ADR-021. RSVP와 private-data boundary: 별도 저장소 + definer RPC 단일 쓰기 경로

- **상태**: 승인 (2026-07-17, Phase 9 구현 완료)
- **배경**: RSVP는 이 제품이 처음으로 **게스트(비인증 사용자)의 개인정보**를 저장하는 기능이다. 응답(이름·측·참석·동반·식사·연락처·메시지)은 invitation 문서와 완전히 다른 신뢰 경계에 있다: 문서는 발행되면 공개되고 AI projection에도 실리지만, 응답은 소유자 외 누구에게도(게스트 본인 포함) 보여서는 안 된다.

**Decision**:

1. **응답은 별도 테이블** `rsvp_responses` — invitation 문서(jsonb)에 절대 저장하지 않는다. 문서의 `rsvp` 섹션 content는 폼 구성(제목·안내·마감일·수집 항목 토글)뿐이라 **응답을 담을 자리가 스키마에 없다**. 따라서 공개 스냅샷(publish_records)·미리보기 projection·AI projection(redactForAi)에 응답이 실리는 것은 구조적으로 불가능하며, 단위·통합 테스트가 이를 고정한다. rsvp 섹션은 hero처럼 **최대 1개**(A-06) — 문서 불변식 + addSection/duplicateSection 거부 + 편집기 메뉴 비활성 3겹.
2. **쓰기는 `submit_rsvp`(security definer) 단일 경로**: anon 키는 브라우저에 내장되는 공개 값이므로, `/api/rsvp`를 우회한 직접 RPC 호출도 같은 경계에 막히도록 접수 조건을 전부 DB에서 강제한다 — live 발행 + 공개 스냅샷에 **보이는** rsvp 섹션 존재(섹션을 끄면 접수도 닫힘) + 마감일 전 + 동의 true + 입력 제약(길이·enum·범위). RLS는 소유자 select/delete만 허용하고 insert/update 정책이 없다 — **소유자도 응답을 위조·수정할 수 없고**, anon에게는 select grant 자체가 없다.
3. **중복 제출 = 수정**: 클라이언트 토큰(uuid, localStorage 보관)을 `unique (project_id, client_token)`으로 upsert — 더블 클릭·재제출이 새 행을 만들지 않고 이전 응답을 갱신한다(`created`/`updated` 구분 반환). localStorage 소프트 가드는 UX용(이미 제출 안내 + 수정하기), 서버 dedup이 진실이다. 토큰을 지운 브라우저·다른 기기는 새 응답이 된다 — 게스트 인증이 없는 MVP에서 의도된 한계.
4. **스팸 방어 2층** (A-17): ① route `/api/rsvp`의 IP+slug 슬라이딩 윈도우(20/분, 프로세스 메모리 — 다중 인스턴스 배포 시 인스턴스별 적용이라는 한계를 명시하고, 내구적 상한은 DB에 둔다) ② DB의 **프로젝트별 일일 상한 200건**(`rsvp_daily_limit` — 국내 하객 규모(수백 명)가 몇 주에 걸쳐 응답하는 패턴 기준, 정상 사용을 막지 않으면서 폭주를 차단하는 값; 기존 토큰의 수정은 상한 무관). ③ 허니팟 필드(`website`) — 채워져 있으면 성공처럼 응답하고 저장하지 않는다(봇에게 탐지 신호를 주지 않는 의도된 기만 — Fail Fast 예외로 명시). 캡차는 post-MVP.
5. **CSRF 검토**: `/api/rsvp`는 쿠키 권한을 쓰지 않아(비인증 endpoint) 위조할 세션이 없고, JSON content-type을 강제해 cross-origin HTML form 벡터를 차단한다(415). 소유자 관리 작업은 supabase-js의 Authorization 헤더(비-ambient 자격증명)라 CSRF 비해당. 남는 위험은 스팸뿐 — 4번이 담당.
6. **입력 위생**: 서버 검증의 단일 소스는 zod `rsvpSubmissionSchema`(+`parseRsvpSubmission` 정규화 — NFC·제어 문자 제거·공백 축약·빈 선택값 null 통일). DB check 제약은 최후 방어선. SQL injection은 parameterized RPC + plpgsql(동적 SQL 없음)로 원천 차단, XSS는 저장 시 이스케이프하지 않고 **렌더 시 React 이스케이프**(대시보드는 텍스트 노드만), CSV injection은 export 시 `csvField`(수식 트리거 `'` prefix + RFC 4180 인용)로 방어 — 각각 통합·e2e·단위 테스트로 고정.
7. **로그 경계**: `/api/rsvp`는 `rsvpLogLine`(화이트리스트: 이벤트 이름 + SQLSTATE 코드만)으로만 로그를 남긴다. Postgres 제약 위반의 message/details/hint에는 게스트 입력값(행 내용)이 포함될 수 있어 통째로 버린다. 검증 실패 상세도 로그 금지.
8. **retention 구조**: created_at/updated_at/consented_at + `(project_id, created_at)` index + 소유자 개별/전체 삭제 + 프로젝트 삭제 시 FK cascade 물리 삭제. 동의 문구에 수집 항목·목적·보관 기준을 고지하고, 결과 페이지에 예식 후 삭제 안내를 상시 노출. 자동 파기(예식 후 N일)는 post-MVP — index와 타임스탬프가 그 작업의 기반이다.
9. **제작자 결과 뷰**는 `/editor/[projectId]/rsvp` (스펙의 `/projects/...` 경로는 기존 라우팅 관례에 맞춰 조정): 집계 카드(참석·동반 합계·예상 인원·측별·식사별)·검색·참석 필터·상세·삭제·CSV. 게스트 폼은 renderer 섹션(단일 renderer 원칙)이며 `published 모드 + 공개 slug`일 때만 제출 가능 — 편집기·비공개 미리보기에서는 비활성.

**Consequences**: 문서 스키마 v5(v4→v5는 변환 없는 버전 경계 승격 — 구버전 코드가 rsvp 문서를 명확히 거부하게). MVP 섹션 카탈로그 12종 완성. 게스트 개인정보가 처음 저장되지만 읽기(소유자 RLS)·쓰기(definer RPC)·투영(스키마에 자리 없음)·로그(화이트리스트) 네 경계가 전부 테스트로 고정됐다. in-memory rate limiter는 serverless 다중 인스턴스에서 약해진다 — 그 경우에도 DB 일일 상한이 유지되며, 필요 시 durable store로 교체한다.

**Alternatives**: 응답을 문서 jsonb 안에 저장 — 공개 스냅샷·AI projection에 새는 구조라 즉시 기각(원칙 9). anon insert RLS 정책 — 발행 상태·마감일·상한 검증을 정책식으로 표현할 수 없어 definer RPC 채택. 이름 기반 dedup — 동명이인 하객이 서로의 응답을 덮어쓰므로 클라이언트 토큰 채택. 캡차 — MVP 과잉(A-17), 허니팟+상한으로 시작. service role 키로 서버에서 쓰기 — "service role은 어디에도 없다"(ADR-006) 원칙 유지, definer RPC가 같은 효과를 좁은 표면으로 제공.

## ADR-022. AI assistant: validated action 파이프라인 위의 제안-검토-적용 모델

- **상태**: 승인 (2026-07-17, Phase 10 구현 완료)
- **배경**: AI 편집 도우미(VS8). 위험은 두 방향이다 — ① AI가 문서 밖의 것(HTML·CSS·코드·전체 JSON·남의 프로젝트)을 만지는 것, ② 사용자의 민감 데이터가 AI provider로 새는 것. 설계 원칙(ADR-003·011)은 이미 "AI는 typed action만 반환한다"였다.

**Decision**:

1. **표현력 자체를 action으로 제한한다**: AI의 출력은 `aiActionSchema`(기존 action 스키마 12종의 allowlist discriminated union — AI 전용 action 없음)뿐이다. HTML·CSS·React·JS·SQL·전체 persisted JSON을 표현할 action이 존재하지 않으므로 "생성 금지"가 검사 항목이 아니라 **타입 시스템의 귀결**이 된다. 사양의 arrangeGallery=`moveGalleryPhoto`, setImageFocalPoint=`updateGalleryPhoto(frame)`로 대응. 제외: `updateWedding`(실명·예식 정보), `updateListItem`(연락처·계좌 반복 그룹), `removeAssetReference`, `batch`(중첩으로 개수 제한 우회 방지).
2. **4겹 runtime 검증** (`validateAiProposal`, provider를 신뢰하지 않는다): allowlist zod parse(알 수 없는 action·형식 위반·개수 20 초과 거부) → 값 가드(HTML/마크업 패턴·`<redacted>` echo 거부 — AI가 가려진 자리표시자를 실값처럼 되쓰면 데이터가 파괴되므로) → content patch 키 검증(스키마 밖 임의 경로를 zod가 조용히 버리는 대신 명시적으로 거부) → **dry-run**(applyAction 순차 실행 — 없는 섹션 id·variant·hero/rsvp 불변식이 수동 편집과 같은 규칙으로 거부되고, 부산물로 미리보기 문서를 얻는다).
3. **sanitized projection만 provider에 나간다** (`buildAiProjection`): redactForAi(연락처·계좌 → `<redacted>`) + asset은 `{assetId, width, height, orientation}`만(bytes·storage 경로·파일명은 스키마에 필드 자체가 없다). RSVP 응답·인증 정보·revision 메타는 문서 밖 데이터라 이 계층에 도달하지 않는다(ADR-021). 저해상도 미리보기 전달은 사용자 승인 UI와 함께 필요해질 때 추가(YAGNI).
4. **provider는 서버 전용 adapter + port**: `AiProvider` port(invitation/ai) ← `AnthropicAiProvider`(server/ai — fetch·sleep 주입식, 30s 타임아웃, 429/5xx/타임아웃/형식 불량에 1회 재시도, tool 정의는 `z.toJSONSchema(aiProposalSchema)`로 생성해 스키마 이중 관리 제거) + `MockAiProvider`(결정적 — 단위·e2e·로컬 데모, `AI_PROVIDER=mock`). 키(`ANTHROPIC_API_KEY`)·모델(`AI_MODEL`)은 서버 env — 미설정이면 503으로 안내만 하고 **편집기는 AI 없이 완전히 동작한다**. HTTP 오류·로그에 사용자 콘텐츠와 응답 본문을 싣지 않는다.
5. **project scope**: `/api/ai/propose`는 세션 필수 + RLS로 projectId 소유 확인(남의 것은 존재 여부 구분 없이 404). action에는 프로젝트 개념이 없다 — 편집기가 자기 문서에만 dispatch하므로 교차 적용 경로 자체가 없다.
6. **제안-검토-적용 UX**: 제안은 절대 즉시 적용되지 않는다. 검토 다이얼로그가 변경 목록(사람 읽는 설명 + 전후 비교)·미리보기(동일 renderer로 변경 전/후 렌더)·체크박스 선택을 제공하고, 적용은 선택분을 `batch` 하나로 dispatch — **수동 편집과 동일한 파이프라인이라 undo 1스텝**이 자동으로 성립한다. 부분 선택이 의존성 때문에 적용 불가하면 dry-run이 미리 알려 적용 버튼을 잠근다.
7. **초기 기능 범위는 프롬프트 수준**으로 제한(초안 제안·인사말 다듬기·분위기 변경·갤러리 레이아웃·접근성 검토) — 코드 경로 분기가 아니라 system prompt가 선언한다. 카탈로그(섹션 타입·variant enum·테마 id)는 스키마에서 파생해 프롬프트에 주입.

**Consequences**: AI가 할 수 있는 모든 일 = 사용자가 손으로 할 수 있는 일의 부분집합이며, 같은 검증·히스토리·자동 저장을 지난다. 사용자가 채팅에 직접 쓴 민감 값의 반영(PRODUCT_SPEC §9)은 updateSectionContent 경로로 여전히 가능하다. mock provider가 프롬프트 품질을 검증하지는 못한다 — 실제 모델 프롬프트 튜닝은 키 설정 후 별도 반복.

**Alternatives**: 자연어 → 문서 직접 생성(전체 JSON 교체) — 검증 불가·undo 불명확·주입 표면 극대화라 기각. AI 전용 action 세트 — 수동 편집과 파이프라인이 갈라져 기각(DRY). SDK(@anthropic-ai/sdk) 의존 — REST 1개 endpoint에 fetch로 충분, 의존성 최소화. 클라이언트에서 직접 provider 호출 — 키 노출이라 즉시 기각.

## ADR-023. 공개 읽기 경로 축소: publish_records 직접 조회 제거 + 복원 자동 백업

**Status**: 확정 (2026-07-20, Phase 11 production readiness audit)

**Context**: anon 키는 공개 값이므로 게스트는 PostgREST로 테이블을 직접 조회할 수 있다. Phase 7의 `publish_records` anon select 정책(`status='live'`)은 앱의 public projection(buildPublicPayload)을 우회하는 구멍이었다: ① 숨긴 섹션(visible=false)의 내용 — 숨겨 둔 계좌번호·연락처 — 이 doc 전문으로 노출되고, ② slug 필터 없는 조회로 발행된 모든 청첩장을 열거할 수 있으며, ③ published_rev 등 내부 메타가 노출됐다. 감사에서 함께 발견된 복원 결함: autosave는 revision을 만들지 않으므로 마지막 checkpoint 이후의 현재 초안은 복원이 덮어쓰면 어디에도 남지 않았다.

**Decision**:

1. **게스트 읽기는 slug 단건 definer RPC(`get_published_by_slug`)뿐이다.** anon의 `publish_records` select grant·정책을 제거하고, authenticated select도 소유자 한정으로 좁혔다. RPC가 live 확인과 **숨긴 섹션 제거를 DB에서** 수행한다(앱의 buildPublicPayload는 같은 규칙의 2차 방어로 유지). 열거는 slug를 알아야만 하는 구조로 바뀐다.
2. **publish_project의 slug 중복 검사를 제약 기반으로 교체.** 기존 `if exists` 사전 검사는 invoker 가시성(이제 소유 행뿐)에 의존해 동작하지 않게 됐고 경쟁 상태도 있었다. unique 제약(`publish_records_slug_key`) 위반을 잡아 `slug_taken`으로 반환한다 — 예외 블록은 서브트랜잭션이라 발행 revision 부산물도 롤백된다. 다른 제약 위반은 그대로 raise(fail fast).
3. **restore_revision은 복원 직전 상태를 자동 백업한다.** 현재 doc_rev의 revision이 없으면 '복원 전 자동 저장' checkpoint를 만든 뒤 덮어쓴다 — 복원은 이제 항상 되돌릴 수 있다.
4. 같은 감사에서: 발행 중(live) 문서가 참조하는 사진의 삭제를 어댑터에서 거부(스냅샷은 불변인데 파일만 사라지면 공개 페이지가 깨진다), 업로드 storage 경로를 내용 주소(`{contentHash}.{ext}`) + upsert로 바꿔 재시도 멱등화, RSVP client token을 mount당 1개로 고정해 첫 제출 재시도의 중복 행을 제거, `/api/ai/propose`에 사용자별 rate limit(10/분)을 추가했다.

**Consequences**: 공개 표면이 "RPC 1개 + storage 공개 URL"로 줄었다. 새 공개 필드가 필요하면 RPC에 명시적으로 추가해야 한다(기본이 비공개). slug 존재 여부는 공개 URL 특성상 여전히 관찰 가능하다(의도된 범위). unpublish가 slug를 계속 점유하는 것은 유지 — 소유자의 주소를 타인이 가로채지 못하게 하는 의도된 동작.

**Alternatives**: 컬럼 단위 grant로 doc만 가리기 — doc 자체가 공개에 필요해 성립 불가. 발행 시점에 projection된 doc을 저장 — 소유자용 스냅샷 조회와 공개용이 갈라지고 projection 로직이 발행 시점에 고정돼 기각. RLS 정책에 jsonb 필터 — select 정책은 행 단위라 표현 불가.

## ADR-024. 공개 가입 차단: 계정은 운영자가 직접 만든다

**Status**: 확정 (2026-07-20)

**Context**: 아직 서비스로 열 계획이 없다. 사용자는 운영자 본인 1명이고, 청첩장 프로젝트는 로그인 후 대시보드에서 만든다. 로그인 화면에는 회원가입 모드가 있어 누구나 계정을 만들 수 있었다.

**Decision**:

1. **로그인 화면에서 회원가입 모드를 제거한다.** 로그인 폼만 남는다 — mode 상태·토글 버튼·분기 문구가 사라져 화면이 단순해진다.
2. **실제 차단은 Supabase Auth의 `enable_signup = false`가 한다.** anon 키는 JS 번들에 공개되므로 UI에서 버튼을 없애는 것은 차단이 아니다. 운영 프로젝트에서 이 설정을 끄는 것이 유일한 경계이며, 배포 체크리스트 항목이다(DEPLOYMENT §1.2).
3. **로컬은 `enable_signup = true`를 유지한다.** e2e·integration 테스트가 케이스마다 새 계정을 만들어 사용자 격리와 RLS 교차 접근(userA가 userB의 것을 못 읽는지)을 검증한다. 이를 service role 키의 `auth.admin.createUser`로 바꾸는 대안은 ADR-006 위반이라 기각. 대신 e2e 헬퍼는 가입 UI 대신 **anon 클라이언트로 계정을 만든 뒤 로그인만 UI로** 수행한다 — 운영에서 운영자가 대시보드로 계정을 만들고 로그인하는 흐름과 같은 모양이다.
4. **admin role은 도입하지 않는다.** 권한 모델은 지금도 소유권 기반(`owns_project`)이고 사용자가 1명이라, role 컬럼·allowlist는 동작 차이 없이 코드만 늘린다 (YAGNI). 다중 사용자를 받게 되면 그때 필요한 구분을 도입한다.

**Consequences**: 계정 추가 경로는 Supabase 대시보드뿐이다 — 운영자가 자기 계정을 잃으면 대시보드로 복구해야 한다. 로컬과 운영의 Auth 설정이 의도적으로 다르므로(로컬 가입 허용), 운영 설정은 코드로 보장되지 않고 체크리스트·`config.toml` 주석으로만 강제된다 — 배포 후 실제 거부를 확인하는 스모크 테스트를 체크리스트에 넣어 보완했다.

**Alternatives**: 로컬도 `enable_signup = false` — 테스트가 계정을 만들 수 없고, 유일한 우회가 service role 키라 ADR-006과 충돌해 기각. 전 e2e를 고정 계정 1개로 공유 — 사용자 격리가 사라져 RLS 교차 접근 테스트가 무의미해지므로 기각. 가입은 열어 두고 이메일 allowlist로 서버 검증 — 지금 없는 문제를 위한 코드라 기각(YAGNI).

## ADR-025. 벤치마크 리뉴얼 1차: 스키마 v6 (전면 히어로·카운트다운·대형 갤러리·약도·바텀시트 RSVP·BGM·폰트)

**Status**: 확정 (2026-07-20)

**Context**: 벤치마크 청첩장(sunghyunyeeun.com)을 기준으로 표현력을 확장했다. 사진이 크게 보이는 것(가로 꽉, 세로 조절), 실시간 D-day, 약도·지도 앱 버튼, 아래에서 올라오는 RSVP, 배경음악, 폰트 선택이 요구사항.

**Decision** (전부 스키마 v5→v6 한 번에 — v6는 미배포 상태에서 확장):

1. **풀블리드 기반**: SectionShell에 bleed(좌우 패딩 해제)·flushTop 옵션. hero photoFull(전면+하단 페이드)·gallery strip(88% 가로 스냅)·달력 가로 확장이 공유. photoAspect(1:1~9:16)는 hero·gallery 공용 enum.
2. **실시간 카운트다운**: calendar.ddayStyle(badge|countdown). 초 단위 타이머는 useSyncExternalStore + 서버 스냅샷 null (hydration 안전 패턴 유지).
3. **오시는 길**: venue.mapImageAssetId(약도, 원본 비율·crop 없음, venueMap asset slot) + 지도 검색어를 주소→예식장 이름 우선으로 + 브랜드색 점 버튼(로고 이미지 미포함 — 상표 리소스).
4. **RSVP 바텀시트**: variant default→sheet|inline 개명. sheet는 네이티브 dialog(085dvh), 제출·소프트 가드 로직 불변. 편집 모드는 점선 미리보기 병행.
5. **asset kind 도입(BGM)**: project_assets.kind(image|audio), 치수는 kind 조건부(null-safe CHECK — CHECK의 NULL 통과 함정 주의), 버킷 mime에 mp3·m4a. 문서 최상위 music.assetId + setMusic action. 구버전 manifest/로컬 행은 이미지로 보정. 자동재생 없음 — 게스트가 켠다. 이 일반화가 커스텀 폰트 업로드의 기반.
6. **폰트**: 문서 최상위 typography(headingFont·bodyFont·scale) + 섹션 style.fontFamily/fontScale override. 구현은 CSS 변수 cascade(--canvas-font-*, --canvas-fs) — 렌더러 텍스트 108곳을 calc(Npx*var(--canvas-fs))로 변환. updateTypography action.
7. **AI 경계**: setMusic·updateTypography는 allowlist 제외(기본 폐쇄). content 신규 필드는 기존 규칙대로 자동 허용.

**Consequences**: 기존 문서·발행 스냅샷은 마이그레이션으로 무손실 승격(카운트다운·바텀시트는 의도적 표시 개선 — 편집기에서 되돌릴 수 있다). 커스텀 폰트 업로드는 asset kind에 font만 추가하면 된다(후속).

**Alternatives**: BGM을 별도 저장 경로로 우회 — 발행 보호·복제 리맵·manifest가 갈라져 기각. 글자 크기를 zoom/transform으로 — 레이아웃 전체가 확대돼 기각. 버전을 슬라이스마다 v7·v8로 — v6 미배포 상태라 불필요한 버전 파편화로 기각.

## ADR-026. 벤치마크 리뉴얼 2차: 스키마 v7 (전면 사진 단일화·pt 직접 입력·커스텀 폰트·모션 미리보기)

**Status**: 확정 (2026-07-22)

**Context**: 1차 이후 실사용 피드백. ① 진입 애니메이션은 이름만 봐서는 결과를 알 수 없다 ② 글자 크기 3단계(작게/보통/크게)로는 원하는 크기를 못 맞추고, 쓰고 싶은 폰트를 직접 올릴 수 없다 ③ 메인은 전면 사진만 쓰므로 레이아웃 선택지가 무의미하고, 상하 여백을 바꾸면 사진 위에 빈 공간이 생기는 버그가 있다 ④ 갤러리 세로 길이가 '내용' 탭에 있어 레이아웃과 따로 논다 ⑤ 약도가 섹션 맨 아래라 늦게 보인다 ⑥ 맺음말 사진도 메인처럼 크게, 밝기를 낮출 수 있어야 한다.

**Decision** (전부 스키마 v6→v7 한 번에):

1. **메인 레이아웃 단일화**: hero layout.variant는 `photoFull` 하나. 테마별 hero 표현(editorial·mono·film 3종)과 `ThemeVariants.hero`를 삭제 — 테마 차이는 토큰(폰트·색·여백)으로만 남는다. 비어 있던 '레이아웃' 탭은 전면 사진 연출(세로 길이 + 효과) 편집기로 대체.
2. **photoEffects 공용화**: `{fadeBottom, sparkle, brightness, opacity}`를 hero·closing content가 공유하고, 렌더러는 `FullBleedPhoto` 하나로 그린다. 효과는 전부 오버레이/CSS 필터라 레이아웃 자리에 영향이 없다. closing의 `photo` variant도 같은 풀블리드 연출.
3. **여백 버그의 근본 원인**: `paddingBlock`(축약형)과 `paddingTop: 0`(개별형)을 한 style 객체에 섞어 쓴 것. React는 변경된 속성만 다시 적용하므로 갱신 시 축약형이 나중에 적용돼 flushTop이 풀렸다. 축약형을 쓰지 않고 `paddingTop`/`paddingBottom`만 지정한다.
4. **글자 크기 = pt 직접 입력**: `typography.scale` enum → `typography.basePt`(7~20pt), 섹션 override도 `style.fontSizePt`. 렌더러는 그대로 `--canvas-fs` 배율을 쓰고, `fontScaleFromPt(pt) = pt*(96/72)/15px`로 환산한다(15px = 렌더러 본문 기준선). 마이그레이션은 sm·md·lg → 10·11·12pt.
5. **커스텀 폰트**: asset kind에 `font` 추가(ADR-025의 일반화를 그대로 재사용). 문서는 `"custom:<assetId>"` 참조만 갖고 이름은 asset 파일명에서 읽는다(중복 저장 금지). 렌더러가 문서에서 참조된 id를 모아 `@font-face`를 직접 선언하며, family 이름은 `cf-<assetId>` — assetId 형태를 정규식으로 좁히고 URL은 `JSON.stringify`로 이스케이프한다. 브라우저마다 폰트 mime이 제각각이라 확장자까지 보고 표준 mime으로 정규화한다. 사용 중인 폰트는 삭제 불가.
6. **모션 미리보기**: 편집기 store의 세션 상태 `motionReplay {sectionId, token}` → 렌더러 prop → `SectionShell`이 토큰 변화에 맞춰 자기 자신을 다시 숨겼다 보인다. 이미 선택된 값을 다시 눌러도(문서상 no-op) 재생되도록 토큰은 apply 전에 올린다. 상태 재설정은 effect가 아니라 렌더 중 처리(React 권장 패턴, 계단식 렌더 방지).
7. **정리**: gallery `filmstrip` 제거(→ slider), `photoAspect`를 strip·slider 양쪽에 적용하고 '레이아웃' 탭으로 이동. venue 약도를 제목 바로 아래로. 5개 이상 선택지의 Segmented는 3열로 접어 320px 패널에서 라벨이 잘리지 않게 한다.

**Consequences**: 아치·텍스트만 히어로를 쓰던 문서는 전면 사진으로 승격된다(사진이 없으면 '이미지 없음' 자리표시자 — 편집기에서 바로 인지된다). 테마별 hero 스크린샷 3종의 기준 이미지가 바뀐다. 커스텀 폰트는 파일을 검증 없이 저장하므로(파싱하지 않는다) 깨진 폰트는 fallback 스택으로 그려질 뿐 렌더가 실패하지 않는다.

**Alternatives**: pt를 CSS `calc()`로 직접 나눠 배율 계산 — 단위 있는 값끼리의 나눗셈이 불가해 기각. 폰트 이름을 문서에 함께 저장 — asset 파일명과 갈라질 수 있어 기각. 애니메이션 미리보기를 별도 재생 버튼으로 — 옵션을 고르는 동작 자체가 미리보기여야 한다는 요구라 기각. `@font-face`를 전역 layout에 주입 — 렌더러가 문서를 단일 소스로 갖는 구조가 깨져 기각.
