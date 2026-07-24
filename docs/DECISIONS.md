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

## ADR-027. 벤치마크 리뉴얼 3차: 수치 입력 UX·별빛 반짝임·지도 앱 아이콘·바탕색 일치

**Status**: 확정 (2026-07-20)

**Context**: 2차 이후 실사용 피드백. ① 슬라이더와 숫자 칸이 한 줄을 나눠 써서 슬라이더가 잡기 어렵고, pt에 "12"를 치려고 "1"을 누르는 순간 최솟값 7로 잘려 뒤 글자가 붙어 "72"→20이 된다 ② 반짝임이 별빛이 아니라 빛줄기가 지나가는 효과다 ③ 지도 버튼이 브랜드색 점이라 어느 앱인지 알기 어렵다 ④ 같은 모니터에서 편집화면의 청첩장이 미리보기보다 탁해 보인다. 스키마 변경 없음 — 전부 표현·입력 계층.

**Decision**:

1. **입력 중에는 자르지 않는다**: `NumberField`가 타이핑 중 값을 로컬 draft로 들고, 범위 안일 때만 문서에 즉시 반영한다. 범위 밖 값은 확정(blur·Enter) 시점에 한 번만 clamp한다. 최종 상태는 여전히 항상 유효하다 — 잘리는 시점만 "글자마다"에서 "확정할 때"로 옮겼다.
2. **슬라이더에 한 줄을 준다**: 숫자 칸을 라벨 줄 오른쪽으로 올리고 슬라이더가 전체 폭을 쓴다. 320px 인스펙터에서 둘을 나눠 담으면 슬라이더가 잡기 어려울 만큼 짧아진다 — 기존 `RangeField`(라벨 좌·값 우·슬라이더 아래)와 같은 배치라 화면 언어도 통일된다.
3. **반짝임 = 별빛**: 지나가는 빛줄기 대신 4각 별 8개가 서로 다른 주기·지연으로 깜빡인다. 위치·타이밍은 고정 배열이다 — 난수를 쓰면 SSR과 클라이언트 렌더가 어긋난다. `prefers-reduced-motion`에서는 멈춘 채 은은하게 남는다.
4. **지도 앱 아이콘은 인라인 SVG로 그린다**: 브랜드색 타일 + 흰 글리프(네이버 N·카카오 핀·티맵 T)를 `MapAppIcon` 한 파일에 둔다. 외부 이미지 파일이 없어 요청·용량 부담이 없고 밝기 같은 캔버스 효과와 섞이지 않는다. 공식 배포 아이콘으로 바꿔야 하면 이 파일만 고치면 된다. 라벨은 "네이버 지도"→"네이버". `brandColor`는 아이콘이 대신하므로 MapLink에서 제거.
5. **바탕색은 한 곳에서 온다**: `--color-canvas-backdrop`(#eceae5)를 편집기 미리보기와 게스트 화면이 공유한다. 종이색(`--canvas-paper`)은 원래 양쪽이 같았고, 다르게 보인 것은 주변 대비였다 — 편집기는 tool 회색(#f6f6f7) 바탕에 회색 테두리까지 둘러 같은 종이가 더 탁해 보였다. 테두리를 없애고 그림자도 게스트 화면과 같은 값으로 맞췄다.

**Consequences**: 청첩장이 놓이는 바탕은 이제 편집기·소유자 미리보기·공개 페이지 세 곳이 같은 토큰을 쓴다 — 한쪽만 바뀌어 어긋날 수 없다. 지도 아이콘은 공식 배포 파일이 아닌 자체 작도이므로, 정확한 아이콘이 필요하면 각 사의 브랜드 리소스를 `public/`에 두고 `MapAppIcon`만 교체한다.

**Alternatives**: pt 최솟값을 낮춰 잘림을 피하기 — 7pt 미만은 실제로 읽을 수 없어 기각(원인은 범위가 아니라 자르는 시점). 숫자 칸을 없애고 슬라이더만 — 정확한 pt 입력이 요구사항이라 기각. 별빛을 canvas·GIF로 — DOM 8개로 충분하고 테마 색과 섞이지 않아 기각. 편집기 바탕만 흰색으로 — 게스트 화면과 또 갈라져 기각(어느 쪽이 진짜인지 알 수 없게 된다).

## ADR-028. 스키마 v8: 제목·본문 글자 크기 분리, 테마 색 커스터마이즈, 맺음말 전면 사진

**Status**: 확정 (2026-07-20)

**Context**: 3차 이후 피드백. ① 글자 크기가 하나뿐이라 제목과 본문을 따로 맞출 수 없다 ② 테마를 고른 뒤에는 색을 손댈 수 없다 — 배경색·글자색을 전역/섹션별로 직접 고르고 싶다 ③ 맺음말도 메인처럼 사진이 캔버스 끝에 붙고, 제목이 사진 위에 흰 글씨로 얹혔으면 한다 ④ 지도 버튼에 실제 앱 아이콘을 쓰고 모바일에서 누르기 쉬운 크기로 키운다.

**Decision**:

1. **크기 기준선을 둘로 나눈다**: `typography.basePt` → `headingPt`(20px 기준)·`bodyPt`(15px 기준), 섹션 override도 `style.headingPt`/`bodyPt`. 기준선을 따로 두는 이유는 각 pt가 실제 렌더 크기와 맞아떨어지게 하기 위해서다 — "제목 15pt"가 화면의 20px 제목을 뜻한다. 렌더러는 `--canvas-fs`(본문)와 `--canvas-fs-heading`(제목) 두 변수를 쓰고, **제목 글꼴(`--canvas-font-heading`)을 쓰는 텍스트와 SectionHeader 전체**가 제목 배율을 따른다 — 이미 있던 폰트 경계를 그대로 재사용해 규칙이 하나로 유지된다. 상한은 20→28pt.
2. **테마 색 override**: `theme.palette {paper?, ink?, accent?}` + `updatePalette` action(값 undefined = 테마 기본값으로 되돌리기). **ink-soft·line은 고르게 하지 않는다** — ink와 paper를 `color-mix`로 섞어 자동으로 만든다. 다섯 색을 각각 맞추게 하면 서로 안 어울리는 조합이 나오기 쉽고, 배경을 어둡게 바꿨을 때 흐린 글자색이 그대로 남아 안 보이는 사고가 난다. 테마 기본 상태(override 없음)에서는 파생을 하지 않아 기존 세 테마의 색이 픽셀 단위로 그대로다.
3. **섹션 글자색**: `style.color` 추가. 섹션 배경색(`background`)과 짝을 이룬다. 여기서도 ink-soft·line은 색에서 파생한다.
4. **맺음말 전면 사진**: `SectionShell`에 `flushBottom`(메인의 `flushTop`과 대칭). 사진이 있는 맺음말은 여백 설정과 무관하게 하단 여백이 0이고, 제목·본문·공유 버튼이 사진 위에 흰 글씨로 얹힌다. 흰색은 오버레이 컨테이너에서 `--canvas-ink` 계열 변수를 다시 정의해 만든다 — 하위 컴포넌트를 하나도 고치지 않고 전부 따라온다. 사진과 글자는 **같은 grid 칸에 겹친다**(absolute 아님): 글이 길어지면 칸이 늘어나 사진 밖으로 넘치지 않는다. 오버레이에는 `relative`가 필수다 — 둘 다 static이면 `<img>`가 inline 단계에서 뒤 형제보다 나중에 그려져 글자와 버튼을 덮고 클릭까지 가로챈다(e2e가 잡았다).
5. **지도 앱 아이콘**: 자체 작도 SVG를 실제 앱 아이콘 PNG로 교체하고(`public/map-apps/`, 136px로 축소해 175KB→40KB), 버튼을 3등분 그리드 · 최소 높이 70px · 아이콘 34px 세로 배치로 키웠다(벤치마크와 동일한 치수).
6. **마이그레이션 v7→v8**: `basePt` → `bodyPt` 그대로, `headingPt`는 `bodyPt × 4/3`을 0.5pt 단위로 반올림 — 기존 화면 크기를 지키는 값이다(basePt 11 → 제목 14.5pt = 19.3px ≈ 기존 19.6px). 새 문서의 기본값은 깔끔한 15pt(=20px)라 마이그레이션 결과와 다르다(의도적).

7. **마지막 장면 정리**: 맺음말의 눈썹 라벨(THANK YOU)을 없애고 제목만 남긴다 — `SectionHeader`의 `label`을 optional로 바꿔 세 테마 variant 모두 라벨 없이 제목만 그릴 수 있게 했다. 사진이 있는 맺음말은 `flushTop`도 함께 걸어 위아래 여백이 0이다: 마지막 화면이 사진 한 장으로 끝난다. 사진이 없는 맺음말(단순 레이아웃)은 여백을 유지한다 — 흘려보낼 사진이 없으면 글자가 캔버스 끝에 붙어 깨져 보인다.
8. **'마음 전하실 곳' 눈썹 라벨을 GIFT → REGISTRY로.** 섹션 타입 id(`giftAccount`)는 그대로 둔다 — 화면에 안 보이는 이름이라 바꿔 봐야 마이그레이션 비용만 든다.

**Consequences**: 색 override는 문서에 저장되므로 테마를 바꿔도 살아남는다 — 테마를 갈아탄 뒤 색이 이상하면 ‘테마 기본값’으로 되돌려야 한다(각 색마다 버튼이 있다). `updatePalette`는 AI allowlist에서 제외했다(setMusic·updateTypography와 같은 기준 — 표현은 사용자가 고른다). 지도 아이콘은 제3자 상표 파일을 저장소에 담고 있다.

**Alternatives**: 제목·본문에 같은 기준선(15px)을 쓰고 제목 pt를 배율로만 해석 — "제목 15pt"가 19.6px을 뜻하게 되어 숫자가 거짓말을 하므로 기각. 색을 5개 다 노출 — 조합 사고가 나기 쉬워 기각(ink-soft·line 자동 파생). 맺음말 글자를 `absolute`로 얹기 — 긴 글이 사진 밖으로 넘쳐 기각(grid 겹침). 아이콘을 공식 브랜드 CDN에서 링크 — 렌더러가 외부 요청을 하게 되고 오프라인·CSP에서 깨져 기각.

## ADR-029. 도메인 루트를 청첩장으로, 공개 주소는 선택값으로

**Status**: Accepted (2026-07-20). 같은 날 한 차례 개정 — 최초 안은 루트에 걸 발행본을
`NEXT_PUBLIC_INVITATION_SLUG`로 지정했으나, 그러면 "기본이 slug, 도메인은 설정"이 되어
의도와 반대였다. 환경변수를 없애고 slug 자체를 선택값으로 바꿨다.

**Context**: 커스텀 도메인(junghoon-eunjin.com)을 붙이면서 하객이 받는 주소가
`도메인/i/<slug>`가 되었다. 하객에게 건네는 주소에 슬러그가 붙어 있을 이유가 없고,
도메인 루트에 편집 도구의 대시보드가 있는 것도 앞뒤가 맞지 않는다.

**Decision**:

1. **`/` = 발행된 청첩장** (공개), **`/edit` = 대시보드** (세션 필수). 편집기·소유자
   미리보기·토큰 미리보기 경로는 그대로 둔다.
2. **공개 주소(slug)는 선택값이다.** `publish_records.slug`를 nullable로 바꾸고
   **NULL = 도메인 루트**로 읽는다. 발행 패널의 주소 칸을 비워 두면 도메인 그대로 열리고,
   적어 넣으면 그 발행본만 `/i/<slug>`로 열린다. 기본 slug를 만들어 주지 않는다
   (`suggestSlug` 삭제) — 기본값이 있으면 "비워 둔다"는 선택지가 사라진다.
3. **루트는 동시에 하나뿐**: 부분 unique 인덱스 `publish_records_single_live_root`
   (`where slug is null and status = 'live'`). `status='live'`를 조건에 넣는 게 핵심이다 —
   발행 중단한 청첩장이 도메인을 계속 붙들고 있으면 다른 청첩장을 루트로 올릴 수 없다.
   선점 시 `publish_project`가 `root_taken`을 돌려주고 패널이 안내한다.
   (slug 쪽 unique 제약은 기존대로 status를 보지 않는다 — 건드리지 않았다.)
4. **RSVP 대상 식별을 두 가지 null로 겹쳐 두지 않는다.** 렌더러의 `rsvpSlug: string | null`은
   null을 "제출 불가"로 썼는데, 루트 청첩장은 slug가 없으므로 뜻이 충돌한다.
   `rsvpTarget: RsvpTarget | null`로 나눴다 — 대상이 없으면(편집기·비공개 미리보기) 제출 불가,
   대상의 `slug`가 null이면 루트다. DB의 `submit_rsvp`는 `slug = p_slug` 대신
   `slug is not distinct from p_slug`로 찾는다 (NULL 비교는 NULL이라 등호로는 못 찾는다).
5. 조회 RPC는 둘이다: `get_published_root()`와 기존 `get_published_by_slug(text)`.
   숨긴 섹션 제거는 `published_payload(publish_records)` 하나로 모아 두 RPC가 공유한다 (ADR-023).

**Consequences**: 도메인에 올릴 청첩장을 바꾸려면 지금 올라가 있는 것의 발행을 먼저 중단해야
한다 — 조용한 인계보다 명시적인 편이 낫다고 봤다. 루트가 동시에 하나뿐이라 e2e도 루트를
쓰는 테스트는 하나(`e2e/root.spec.ts`)뿐이고, 끝나면서 발행을 중단해 다음 실행에 넘겨준다
(`finally` 블록). `/i/<slug>`는 그대로 살아 있고 루트와 로더(`app/_shared/published.ts`)를
공유한다. 배포에 새 환경변수는 없다.

**Alternatives**: 루트 slug를 환경변수로 지정 — 발행 slug와 어긋나면 도메인에 옛 발행본이
계속 보이고, 값을 바꿀 때마다 재배포가 필요하며, 무엇보다 slug가 기본이고 도메인이 옵션인
모양이 되어 기각(최초 안, 하루 만에 철회). `is_root` 불리언 + slug 자동 생성 — RSVP·렌더러를
안 건드려도 되지만 "항상 slug가 있는데 숨긴다"는 거짓말이 남아 기각. 루트를 `/i/<slug>`로
rewrite — 파일시스템 라우트가 이겨 `beforeFiles`가 필요하고 동작이 설정에 숨어 기각.

## ADR-030. 저장·전송 이미지를 1600px로 줄인다

**Status**: Accepted (2026-07-20) — 같은 날 개정: 상한 20MB 인상은 철회, 10MB 유지

**Context**: 폰 원본(4032px·5MB)이 그대로 저장되고, 하객 화면의 큰 사진은 그 원본을
그대로 내려받는다. Supabase Storage 공개 URL을 쓰므로 서버측 이미지 변환이 없다.
무료 플랜(월 egress 5GB)에 하객 500명을 상정하면 전송량이 먼저 무너지고, 그 전에
모바일에서 로딩이 체감된다. 반대로 업로드 상한 10MB는 요즘 폰 사진에는 빠듯하다.

**측정한 사실** (실측, 로컬 e2e): 기본 갤러리 레이아웃 `grid3`(표시 폭 144px)에서는
하객이 원본을 한 장도 받지 않고 640px 썸네일만 받는다. `srcSet`이 표시 폭 × 화소밀도로
고르기 때문이다. 원본을 받는 자리는 따로 있다 — 전면 사진(430px), 대형 스트립(380px),
약도(380px), 사진 확대(520px)는 화소밀도 2~3배에서 640px로 모자라 원본을 집는다.
즉 "하객 한 명이 사진 전부를 원본으로 받는다"는 최악 가정은 레이아웃에 따라 참이 아니다.

**Decision**:

1. **받는 크기와 내보내는 크기를 분리한다.** 저장할 때 긴 변을 **1600px**로 줄인다.
   근거: 캔버스 최대 폭이 430px이고 화소밀도 3배 화면이 1290px를 요구하므로 1600px이면
   넘친다. 세로는 전면 사진이 길어질 수 있어 2400px.

   ~~업로드 상한을 20MB(앱 + 버킷)로 올린다~~ — **철회했다(2026-07-20).** 저장할 때
   어차피 줄이므로 더 큰 원본을 받을 이유가 얇았고, 버킷 마이그레이션이 운영에 올라가기
   전이라 되돌리는 비용도 없었다. 상한은 10MB 그대로다 — 허용 형식이 jpeg/png/webp뿐이라
   (HEIC 없음) 폰 사진은 이 안에 들어온다.
2. **이미 한도 안이면 다시 인코딩하지 않는다.** 재인코딩은 화질만 깎는다. 줄인 결과가
   원본보다 커지는 경우(이미 잘 압축된 파일)도 원본을 쓴다.
3. PNG는 PNG로 남긴다(투명도 보존). 나머지는 JPEG q0.82.
4. **`createImageBitmap`에 `imageOrientation: "from-image"`를 명시한다.** 캔버스로 다시
   그리면 EXIF가 통째로 사라진다 — GPS가 지워지는 건 이득이지만 회전 정보도 같이 지워져,
   브라우저가 EXIF 회전을 적용하지 않고 픽셀을 읽으면 폰 세로 사진이 누운 채 저장된다.
   기본값이 브라우저·버전마다 달라 명시한다(썸네일도 같은 경로라 기존 잠재 결함이 함께 닫힌다).

**Consequences**: **이미 올린 사진은 그대로 크다** — 축소는 업로드 시점에만 일어나므로
줄이려면 다시 올려야 한다. EXIF가 사라져 촬영 위치·기기 정보가 하객에게 넘어가지 않는다
(의도한 부수 효과). 상한이 앱(`MAX_UPLOAD_BYTES`)과 버킷(`file_size_limit`) 두 곳에 있어
같이 바꿔야 한다 — 어긋나면 한쪽이 먼저 거부한다(그래서 20MB 철회 때 앱 상수도 함께
10MB로 되돌렸다). UI 문구와 e2e가 하드코딩하던 "10MB"는 상수 참조로 바꿔 다음 변경에
따라오게 했다 — 이번 되돌리기가 상수 한 줄로 끝난 것이 그 덕이다.

**Alternatives**: Pro 플랜($25/월)으로 egress를 늘리기 — 상시 비용이고 로딩 문제는 그대로라
기각. Storage 변환 URL(`?width=`) — Supabase 유료 기능. WebP 변환 — 30%쯤 더 줄지만
1600px 축소(약 90% 감소)에 비하면 한계 이득이라 지금은 보류. 업로드 상한만 올리기 —
전송량·로딩이 그만큼 나빠질 뿐 문제를 옮기기만 한다.

## ADR-031. 스키마 v9: 갤러리 사진의 모서리·간격을 테마에서 문서로 옮긴다

**Status**: Accepted (2026-07-20)

**Context**: 갤러리 사진의 모서리와 간격을 사용자가 손댈 수 없었다. 둘 다 테마의 결
(`editorial`·`mono`·`film`)과 레이아웃 variant가 함께 정하는 값이라, 기본 테마에서는
대형 스트립만 각지고 나머지는 전부 둥근 모서리로 고정이었다. 간격도 마찬가지로
`grid3`는 6px, `film`은 16px처럼 코드가 정한 값이었다.

**Decision**:

1. `galleryContent`에 **`photoCorner: "sharp"|"rounded"`**와 **`photoGapPx: 0~24`**를
   추가하고, 렌더러의 테마 분기(`flavor === "mono" ? ... : ...`)를 걷어낸다.
   두 값은 레이아웃과 무관하게 **모든 variant에 똑같이** 적용된다 — 대형 스트립도 포함이다.
2. **'둥글게'의 반경은 테마의 `radiusPhoto`가 아니라 갤러리 자신의 값(10px)이다.**
   모노크롬 테마의 `radiusPhoto`가 0px이라 그대로 쓰면 골라도 아무 일이 없다 —
   고른 대로 보이지 않는 옵션은 옵션이 아니다. 테마 `radiusPhoto`는 약도·소개 사진 등
   나머지 자리에서 계속 쓰인다.
3. 전달 방식은 **`--canvas-radius-photo`를 갤러리 컨테이너에서만 덮어쓰기**다.
   `PhotoFrame`에 반경 prop을 새로 뚫으면 "모양(shape)"과 "반경"이라는 두 갈래로
   같은 것을 말하게 된다 — 이미 있는 변수를 스코프로 좁히면 통로가 하나로 남는다.
4. 마이그레이션(v8 → v9)은 **그때까지 화면에 보이던 값을 그대로 심는다** —
   `strip`은 각진 모서리·2px, `grid3` 6px, `grid2`·`collage` 8px, `slider` 12px.
   기준은 기본 테마(웜 에디토리얼)다.

**Consequences**: **필름·모노크롬 테마를 쓰던 문서는 갤러리 간격이 에디토리얼 기준으로
바뀐다** (film 16px → 레이아웃별 6~12px). 값이 문서에 들어왔으니 편집기에서 되돌릴 수 있다.
모노크롬의 **격자 실선 효과가 사라진다** — 1px 간격 뒤에 선 색 배경을 깔아 만들던 것이라
간격이 사용자 값이 되는 순간 6px짜리 색 띠가 되어버린다. 간격을 0으로 두면 사진이 맞붙는다.
겸사겸사 '내용' 탭에 남아 있던 '사진 세로 길이'(대형 스트립일 때만 뜨던 중복 컨트롤)를
지웠다 — 같은 값을 두 탭에서 만지고 있었고, '레이아웃' 탭이 사진 생김새의 단일 창구다.

**Alternatives**: 모서리를 반경 슬라이더(0~20px)로 두기 — 사각형/둥근 사각형 두 선택지를
요청받았고, 0px도 슬라이더로 표현되긴 하나 "둥글게"를 고르는 것보다 손이 더 간다.
테마 override로 두기(`"theme"|"sharp"|"rounded"` 3상태) — 폰트가 쓰는 방식이지만,
모서리는 테마마다의 기본값을 기억할 만한 값이 아니라 상태만 하나 늘어난다.


## ADR-032. 스키마 v10: 섹션 눈썹 라벨과 좌우 여백을 편집 가능한 값으로

**Status**: Accepted (2026-07-21)

**Context**: 제목 위의 눈썹 라벨("GALLERY"·"INVITATION" 등)을 렌더러가 섹션 타입마다
문자열로 박아 두고 있었다. 그래서 섹션 이름과 라벨이 어긋난 자리를 고칠 방법이 없었다 —
'인사말' 섹션의 라벨이 INVITATION인 것이 대표적이다. 좌우 여백도 마찬가지로 24px 고정이거나
전면 사진·대형 스트립만 `bleed` prop으로 0이었다.

**Decision**:

1. **눈썹 라벨은 `content.label`이다.** 제목과 같은 성격의 텍스트(하객이 읽는 글자)이므로
   `style`이 아니라 `content`에 둔다. 12개 섹션이 `title`을 공유하고 있었으므로
   **`titledContentSchema`(title + label)를 뽑아** 각 스키마가 확장하게 했다 — 같은 지식을
   열두 번 적지 않는다. 빈 문자열이면 눈썹 없이 제목만 나온다(맺음말의 기본값).
2. **기본 라벨 표는 `DEFAULT_SECTION_LABELS` 한 곳에 둔다.** 새 섹션 생성과 마이그레이션이
   같은 표를 읽는다 — 두 곳에 적으면 갈라진다.
3. **좌우 여백은 `style.paddingX`(0~48px) 숫자 하나다.** `bleed` prop을 없앴다:
   "패딩 있음/없음" 두 갈래로 말하던 것을 값 하나로 합치면 통로가 하나가 된다.
   값은 `--canvas-pad-x`로 내려보내 섹션 구분선과 갤러리 헤더가 같은 값을 따라간다.
4. **편집 자리는 성격을 따른다** — 라벨은 '내용' 탭 맨 위(캔버스에서도 제목 위다),
   여백은 '레이아웃' 탭. 라벨은 모든 섹션이 같은 모양이라 타입별 폼마다 두지 않고
   InspectorPanel에서 한 번만 그린다.

**Consequences**: 마이그레이션(v9 → v10)이 그때까지 화면에 보이던 값을 그대로 심으므로
**기존 문서의 모습은 그대로다** — 라벨은 렌더러가 박아 두었던 문자열, 여백은 전면 사진
(메인·맺음말 photo)과 대형 스트립이 0, 나머지가 24px. 전면 사진의 풀블리드가 이제
구조가 아니라 값이라 사용자가 여백을 줄 수 있다 — 의도한 자유도이자, 전면 사진을 인셋으로
만들 수도 있다는 뜻이다. 갤러리 대형 스트립은 여백이 0일 때 헤더에만 기본 인셋을 돌려준다
(제목이 화면 가장자리에 붙으면 읽기 어렵다).

`title`을 공유 베이스로 뽑으면서 rsvp content의 키 목록을 못박던 가드 테스트 3개가
`label`을 포함하도록 갱신됐다 — RSVP 응답이 문서에 못 들어가게 지키는 검증이라 목록만 늘렸다.

**Alternatives**: 라벨을 `sectionBase`에 두기(모든 섹션 공통이므로) — `content`에 있어야
할 텍스트를 구조 필드로 올리는 셈이고, `updateSectionContent`가 이미 하는 일을 위해
새 action이 필요해진다. 좌우 여백을 `paddingY`처럼 `sm|md|lg` enum으로 두기 — 세로 여백은
테마 토큰(padSm·padMd·padLg)에서 오지만 좌우는 테마와 무관한 고정값이었고, "꽉 채우기"를
표현하려면 0이 필요해 숫자가 더 곧다.

## ADR-033. 미들웨어 정적 파일 예외를 폴더 열거에서 확장자로

**Status**: Accepted (2026-07-21)

**Context**: 하객이 공개 청첩장을 열면 지도 앱 아이콘(네이버·카카오맵·티맵)이 깨진 이미지로
보였다. 편집기 미리보기에서는 멀쩡했다. 원인은 인증 미들웨어였다 — matcher가
`_next/static|_next/image|favicon.ico|samples/`만 예외로 두었고, ADR-028에서 추가한
`public/map-apps/`는 목록에 없었다. 세션이 없는 하객의 `/map-apps/naver.png` 요청이
`/login`으로 307 리다이렉트되어 `<img>`가 PNG 대신 HTML을 받았다. 편집기에서는 로그인
상태라 리다이렉트가 걸리지 않아 끝까지 드러나지 않았다.

**Decision**: 예외를 **폴더 이름이 아니라 확장자**로 건다 —
`png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf`. 폴더를 열거하는 방식은 `public/` 아래에
새 폴더가 생길 때마다 조용히 깨지고, 깨진 결과가 하객 화면에만 나타나서 늦게 발견된다.
`.ics`는 일부러 넣지 않았다 — `/preview/<id>/wedding.ics`는 소유자 전용이라 검사를 거쳐야 한다.

**Consequences**: `public/`에 새 폴더를 추가할 때 미들웨어를 함께 고칠 필요가 없다.
대신 **보호가 필요한 라우트 경로가 이 확장자로 끝나면 안 된다**는 조건이 생겼고,
matcher 옆에 그렇게 적어 두었다. 하객 컨텍스트에서 세 아이콘이 200과 `image/*`로 오는지
확인하는 e2e를 phase6의 공개 접근 테스트에 붙였다 — 로그인 상태에서만 확인하면 이 결함은
다시 지나간다.

**Alternatives**: `/map-apps/`를 PUBLIC_PATTERNS에 추가 — 미들웨어를 계속 태우므로
이미지 요청마다 Supabase `getUser()` 왕복이 생긴다. 폴더 목록에 `map-apps/`만 추가 —
이번 증상은 고치지만 다음 폴더에서 같은 일이 반복된다.

## ADR-034. 스키마 v11: 메인 사진 위 문구 · 배경음악 재생 설정 · 교통 안내 확장 · 공유 영역 색

**Status**: Accepted (2026-07-21)

**Context**: 네 가지 요청이 한 번에 들어왔다. (1) 메인 사진 가운데에 "we're getting married"
같은 문구를 넣고 위치·크기·글꼴·색을 고르고 싶다. (2) 배경음악의 음량·재생 속도를 조절하고,
가능하면 자동으로 시작하고 싶다. (3) 교통 안내의 이모지를 바꾸고 레이아웃을 늘리고 싶다
(격자·펼침). (4) 공유 영역을 맺음말처럼 어둡게 하고, 카카오톡 버튼 색을 브랜드 노랑 대신
테마 강조색으로 쓰고 싶다.

**Decision**:

1. **메인 사진 위 문구** — `hero.content.overlay {text, position, font, sizePt, color}`.
   사진과 같은 칸에 겹쳐 얹되 **사진의 밝기·투명도 필터 밖**에 둔다: 사진을 어둡게 깔고
   글자는 또렷하게 두는 것이 이 문구를 쓰는 이유다. 위치는 세로 3단(위·가운데·아래)만
   둔다 — 전면 사진 위에서 의미 있게 달라지는 축은 세로뿐이고, 가로는 늘 가운데다.
   크기는 `pt`를 CSS에 그대로 쓴다: 캔버스의 pt 환산이 96/72이라 결과가 같고, 사진 위
   균형은 전역 글자 크기를 따라 흔들리면 안 된다.

2. **배경음악** — `music {volume, speed, autoplay}`, action은 `updateMusic`
   (파일 지정은 `setMusic`이 그대로 맡는다: 어떤 곡이냐와 어떻게 트느냐는 다른 결정이다).
   자동재생은 **보장이 아니라 시도**다: 브라우저 대부분이 소리 있는 자동재생을 막으므로,
   막히면 게스트의 첫 동작(scroll·pointerdown·touchstart·keydown·wheel)에 한 번 더 시도한다.
   편집 중에 저절로 울리지 않도록 `mode === "published"`에서만 동작한다 —
   편집기의 '미리보기'는 게스트 화면이므로 여기 포함된다.

3. **교통 안내** — 항목에 `emoji`(빈 문자열 = 수단의 기본 그림), content에 `columns`(1~3),
   variant에 `accordion` 추가. **`grid`라는 새 variant를 만들지 않았다**: 기존 `cards`가
   이미 2열 격자라 거의 같은 것이 둘이 된다. 대신 `cards`의 열 수를 고를 수 있게 해서
   "격자를 원한다"는 요구를 덮고, 라벨을 '카드 격자'로 고쳐 그렇게 읽히게 했다.

4. **공유 영역** — `layout.variant`에 `dark` 추가, `content.kakaoButtonColor`(미지정 =
   테마 강조색). 어두운 판은 `SectionShell`의 `tone` prop이다 (`flushTop`·`flushBottom`과
   같은 성격): 색이 섹션 좌우 여백 **밖까지** 차야 하므로 shell이 칠해야 한다. 테마 색을
   뒤집지 않고 고정값을 쓴다 — 모던 모노크롬의 강조색은 `#141414`라 어두운 판에서 사라지고,
   같은 요소에서 `var(--canvas-ink)`를 참조하면 CSS 커스텀 속성 순환이 된다.
   버튼 위 글자·심볼 색은 고른 색의 **sRGB 상대 휘도(WCAG)**로 자동으로 정한다 —
   색을 고르게 하고 그 위 글자를 방치하면 읽을 수 없는 조합이 나온다.

**Consequences**: 마이그레이션(v10 → v11)은 문구를 빈 문자열, 음량·속도를 1, 자동재생을 꺼짐,
이모지를 빈 문자열, 열 수를 2로 심으므로 **기존 문서는 보이고 들리던 그대로다**. 예외가
하나 있다: 공유 영역의 카카오 버튼이 카카오 노랑에서 테마 강조색으로 바뀐다 — 청첩장 한 장에서
혼자 튀던 색을 고치는 '요청된 표시 개선'이고, 브랜드 색을 원하면 `#FEE500`을 직접 고른다.
(카카오 공유 버튼의 브랜드 가이드를 따르지 않는 선택이므로, 심사를 받는 서비스라면 재검토 대상이다.)

`SectionHeader`가 빈 문자열 라벨을 '없음'으로 취급하도록 함께 고쳤다 — v10에서 라벨을 지우면
빈 줄과 그 간격만 남았다.

**Alternatives**: 오버레이 위치를 9칸 격자로 — 전면 사진 위에서 가로 정렬을 바꿀 일이 없고
선택지만 세 배가 된다. 어둡게를 `sectionStyle.tone`으로 모든 섹션에 열기 — 요청은 공유
영역 하나였고, 이미 있는 `style.background`·`style.color`와 표현이 겹친다. 자동재생을
`<audio autoplay>` 속성으로 — 차단됐을 때 되살릴 방법이 없어 "켜지는 기기에서만 켜진다"가 된다.

## ADR-035. 스키마 v12: 글자를 네 역할로 나누고 역할마다 글꼴 편집기를 준다

**Status**: Accepted (2026-07-21)

**Context**: "모든 섹션의 글자를 따로 조절하고 싶다 — 메인은 태그라인·이름·본문, 다른 섹션은
눈썹 라벨·제목·본문. 각각 크기·폰트·볼드·이탤릭·색상을 고르고, 자간·행간도 추가해 달라."
v11까지는 전역 `headingFont/bodyFont/headingPt/bodyPt`와 섹션의 같은 이름 override뿐이라
조절 단위가 **제목/본문 둘**이었고, 굵기·기울임·자간·행간은 어디에도 없었다.

렌더러를 실측해 보니 글자를 담은 요소가 **95곳**이었고, 크기 클래스 없이 부모에서 물려받는
곳이 여섯 군데 더 있었다(연락처의 이름 등 — `text-[length:` grep으로는 안 잡힌다).
95곳을 전부 손으로 고치는 것은 되돌리기 어려운 규모의 회귀 위험이다.

**Decision**:

1. **네 역할** — `label`(눈썹·메인 태그라인) · `heading`(제목·메인 이름) ·
   `itemTitle`(반복 항목의 제목: 교통 안내의 '지하철', 연락처의 이름, 계좌 그룹) · `body`(나머지).
   사용자가 스스로 셋으로 나눠 말했고, 거기에 '항목 제목'을 더해 넷으로 굳혔다.

2. **크기는 절대값이 아니라 배율** — 한 역할 안에서도 요소마다 기준 px이 다르다
   (제목 h2 20px vs 메인 이름 26px). 절대값으로 덮으면 역할 안의 크기 위계가 무너진다.
   역할마다 기준선(11 / 20 / 13.5 / 15px)을 두고 pt를 그 기준에 대한 배율로 환산한다 —
   v11의 `bodyPt`가 이미 그렇게 동작하고 있었고, 그 방식을 넷으로 늘린 것이다.

3. **전달은 CSS 변수 하나뿐** — 전역(캔버스 루트)과 섹션이 같은 이름을 쓰고, 섹션이 더
   안쪽이라 자연히 덮는다. 두 층을 JS에서 합치지 않는다. **정해지지 않은 값은 변수를
   내보내지 않는다** — 그래야 요소가 원래 갖고 있던 값이 fallback으로 살아남는다.
   그래서 `bold: false`(굵기를 400으로 못박음)와 `bold: undefined`(요소 기본 유지)가 다르다.

4. **95곳을 다 고치지 않는다** — 역할을 '분명하게 정의하는' 요소 스무 곳만 `roleStyle()`로
   바꾸고(SectionHeader 6 · 메인 2 · BodyText · 항목 제목 10), 나머지 본문 글자는
   `SectionShell`이 깐 **상속되는 속성**으로 따라오게 한다. 글꼴·색·굵기·기울임·자간은
   상속되고, 크기는 이미 `--canvas-fs`를 곱해 쓰고 있어 배율 하나로 함께 움직인다.

5. **전역 + 섹션별, 같은 화면** — `TextRoleEditor` 하나를 테마 패널과 섹션 '스타일' 탭이
   함께 쓴다. 다른 점은 하나뿐이다: 전역은 글꼴·크기를 반드시 갖고, 섹션은 비우면 전역을 따른다.

**Consequences**: 마이그레이션(v11 → v12)이 옛 관계를 pt로 환산해 심는다 — 눈썹은 제목
배율의 11/20, 항목 제목은 본문 배율의 13.5/15(제목 15pt → 눈썹 8.5pt, 본문 11pt → 항목 10pt).
섹션의 `fontFamily`는 네 역할 모두에, `color`는 본문 역할에 들어간다(본문 색은 그 자리의
기본 글자색이라 흐린 글자색·구분선까지 함께 옮긴다 — v11의 `style.color`가 하던 일 그대로).

**남는 차이 두 가지**(둘 다 2% 안쪽): 메인 태그라인은 본문 배율을 쓰다가 눈썹 배율로,
제목 글꼴을 쓰던 항목 제목(예식장 이름·신랑신부 이름·달력 월)은 제목 배율에서 항목 배율로 옮겼다.

**아직 역할을 따르지 않는 것**: 스스로 `leading`/`tracking`을 적어 둔 잔글씨(연락처 숫자,
카운트다운 자릿수, 캡션 등)는 자간·행간 조절을 따르지 않는다. 자간·행간이 실제로 문제가 되는
문단(본문·제목·눈썹·항목 제목)은 전부 역할을 따르므로 이번 요구는 충족되지만, 완전하지는 않다 —
남은 요소를 역할로 옮기는 것은 별도 작업이다.

`updateTypography`·`updateSectionSettings`는 역할 한 벌을 통째로 실어 보낸다(부분 병합이
아니라 교체) — 그래야 '값을 지움'이 전달된다.

**Alternatives**: 95곳을 전부 `roleStyle()`로 — 가장 완전하지만 요소마다 판단이 필요하고
(잔글씨가 '본문'인지 'chrome'인지) 한 번에 되돌리기 어렵다. 역할을 셋으로 — 사용자가 항목
제목을 따로 조절하고 싶다고 명시했다. 크기를 절대 pt로 — 메인 이름과 섹션 제목이 같은 크기가 된다.

## ADR-036. 오시는 길에서 예식 일시를 뺀다

**Status**: Accepted (2026-07-21)

**Context**: 오시는 길 섹션이 세 variant 모두에서 `wedding.datetime`을 함께 그리고 있었다.
같은 날짜가 메인(예식 일시 표시)과 예식 캘린더에도 있어 한 청첩장에 세 번 나왔다.

**Decision**: 오시는 길에서 날짜 줄을 없앤다. 토글을 두지 않는다 — 되살릴 이유가 생기면
그때 만든다(YAGNI). 스키마 변경 없음.

**Consequences**: 오시는 길은 이제 장소·주소·연락처·안내 문구만 보여 준다. 날짜를 보여 주는
자리는 메인과 예식 캘린더 둘이며, 둘 다 끌 수 있다.

## ADR-037. 스키마 v13: 메인 사진 위 문구의 그림자 색·세기를 고르게 한다

**Status**: Accepted (2026-07-21)

**Context**: v11에서 사진 위 문구에 그림자 on/off를 붙였지만 값은 `0 1px 10px rgba(0,0,0,0.4)`로
렌더러에 못박혀 있었다. 검정 그림자가 늘 답은 아니다 — 어두운 글자를 밝은 사진 위에 얹으면
흰 그림자가 테두리처럼 받쳐 주는 편이 읽히고, 사진에 따라 진하기도 다르게 가고 싶어진다.

**Decision**: `heroOverlay`에 `shadowColor`(hex)와 `shadowStrength`(5~100)를 추가한다.

세기는 **한 숫자가 진하기(알파)와 번짐(blur)을 함께 움직인다** — `alpha = 세기/100`,
`blur = 세기/4 px`. 둘을 따로 고르게 하면 어울리는 조합을 사용자가 직접 찾아야 한다.
기본값 40은 v12까지 못박혀 있던 값과 정확히 같다(알파 0.4 · 번짐 10px) — 열었을 때
그림자 모습이 달라지지 않는다.

세기 0을 허용하지 않는다: 그건 '그림자 끄기'와 같은 말이고 그 스위치는 이미 있다. 같은 이유로
그림자를 끄면 편집기에서 색·세기 입력이 사라진다 — 아무 일도 하지 않는 손잡이를 남기지 않는다.

색은 8자리 hex(`#rrggbbaa`)로 CSS에 넘긴다. rgb로 풀어 쓰는 변환기가 필요 없고
사용자가 고른 색이 문자열에 그대로 남아 디버깅할 때 읽힌다.

**Consequences**: 마이그레이션 v12 → v13은 hero overlay의 빠진 칸만 `DEFAULT_HERO_OVERLAY`로
채운다(있는 값이 이긴다 — 두 번 태워도 결과가 같다). `openability.test.ts`에 v12 케이스를 넣어
*그림자 색·세기가 없던 문서*가 열리고 검정 40%를 그대로 유지하는지 검증한다 — 이 가드는
마이그레이션을 빼면 실제로 실패하는 것을 확인했다(`invalid_type` on shadowColor·shadowStrength).

**Alternatives**: 진하기·번짐을 따로 두 손잡이로 — 조합을 사용자가 맞춰야 하고, 잘못 고르면
글자가 뭉개진다. 세기 0 = 끄기로 토글 제거 — 기존 토글·테스트를 갈아엎을 만큼 얻는 것이 없다.
그림자를 역할(ADR-035) 체계에 넣기 — 사진 위 문구는 애초에 역할 밖에서 자기 글꼴·크기를
따로 갖는 자리다(ADR-034).

## ADR-038. 스키마 v14: 사진 위 문구의 등장 효과·파노라마 · 버튼 색 통일

**Status**: Accepted (2026-07-21)

**Context**: 요청 여섯 가지가 한 묶음이었다 — 사진 위 문구를 더 크게·여러 줄로, 글자가 나타나는
효과(특히 "펜으로 쓰듯"), 폰 첫 화면을 사진만으로 채우기, 참석 여부·캘린더 저장 버튼도 카카오
버튼처럼 강조색 따르기, 공유 영역의 어두운 판을 조절 가능하게, 캘린더 이모지 제거.

**Decision**

**글자 크기**: 사진 위 문구만 별도 상한 72pt(`overlayFontSizePtSchema`). 역할 글자의 28pt는
그대로 둔다 — 역할 pt는 배율로 환산되지만 이 값은 절대 크기라 따로 열어도 위계가 흔들리지 않는다.

**등장 효과** `overlay.animation`: none / fade / rise / typing / letterFade / writing.
전부 **CSS 애니메이션의 지연만으로** 그린다 — JS 타이머가 없으므로 서버 렌더 결과에 글자가
전부 들어 있고, 스크립트가 죽어도 문구는 읽힌다. `fill-mode: backwards`라야 지연 중에 시작
상태가 유지된다.

*"펜으로 쓰듯"의 한계*: 획을 따라 그리는 진짜 필기는 글리프마다 SVG 경로가 있어야 한다.
폰트는 획이 아니라 **채워진 윤곽**이라 임의의 글자(특히 한글)에서는 만들 수 없다. 대신
**줄마다 clip-path를 왼쪽에서 오른쪽으로** 연다. 줄을 직접 나눠 inline-block으로 감싸는
이유는 clip-path가 요소 상자를 기준으로 자르기 때문이다 — 가운데 정렬된 문단은 상자가 캔버스
폭 전체라 왼쪽 빈 여백부터 쓸고 지나간다. 음수 inset(-40px)으로 상자 밖까지 열어 둬야 글자
그림자가 네 변에서 잘리지 않는다.

**파노라마**: `photoAspect`에 9/20·9/24 추가(enum 확장 = widening이라 기존 문서 그대로 유효).
430px 캔버스에서 9/20이면 956px라 세로 844px 화면을 넘긴다. 여기에 `contentOffsetPx`(0~320)로
사진 아래 글을 더 내린다 — 사용자가 제안한 두 방법을 **둘 다** 넣었다. 하나만으로는 사진 비율과
글 위치를 따로 못 맞춘다.

**버튼 색**: `buttonColorSchema`(optional hex) 하나를 카카오 공유·캘린더 저장·참석 여부 전달이
공유한다. 비우면 테마 강조색. 버튼 위 글자색은 `readableInk`(WCAG sRGB 상대 휘도)가 정한다.
RSVP는 시트 안 제출 버튼도 같은 색을 쓴다 — 같은 행동이 두 색이면 고장으로 보인다.

**어두운 판**: `SectionShell.tone`이 `"default"|"dark"`에서 **배경색(hex)** 으로 바뀌었다.
고정값 여섯 개(`DARK_TONE_VARS`) 대신 `toneVars(background)`가 `color-mix`로 만든다.
비율(72·88·28%)은 옛 `rgba(255,255,255,0.x)`를 그대로 옮긴 값이라 **검정 판 위 흰 글자에서는
결과가 그때와 정확히 같다**. 밝은 색을 골라도 글자가 묻히지 않는다.

**캘린더 이모지**: 📅를 뺐다. 버튼이 강조색으로 채워지면서 이모지가 색과 부딪혔다.

**Consequences**: 마이그레이션 v13 → v14가 반드시 채워야 하는 것은 hero의 `overlay.animation`
("none")과 `contentOffsetPx`(0) 둘뿐이고, 둘 다 '지금과 같은 모습'인 값이다. 색은 전부
optional이라 채울 것이 없다. `openability.test.ts`에 v13 케이스를 넣었고, 마이그레이션을 빼면
다섯 케이스가 전부 실패하는 것을 확인했다.

`readableInk`는 ShareSection에서 `renderer/colors.ts`로 옮겼다 — 색을 고르는 자리마다 다른
계산을 두면 같은 색인데 글자 색이 달라진다.

**강조색 확인 결과(요청 사항)**: 캘린더 '오늘' 동그라미는 `var(--canvas-accent)`를 **그대로**
칠하고 있었다. 강조색을 쓰는 자리(눈썹 라벨·D-day·연락처·구분선) 어디에도 투명도나 혼합이
없다. 진하기가 달라 보이는 것은 **꽉 찬 원 vs 가는 글자**의 차이지 색 차이가 아니다.
회귀를 막기 위해 "동그라미 배경색 == --canvas-accent" 단언을 e2e에 넣었다.

**Alternatives**: 효과를 JS 타이머로 — 스크립트가 없으면 글자가 안 보이고 SSR 결과와 어긋난다.
글자마다 SVG 경로 — 한글·업로드 글꼴에서 불가능. `vh`로 첫 화면 채우기 — 렌더러 금지
(편집기 미리보기와 게스트 화면이 달라진다, ADR-004). 어두운 판을 배경색 override로 대체 —
그 값은 글자색을 뒤집지 않아 흰 글자가 밝은 판에서 사라진다.

## ADR-039. 스키마 v15: 한 버전 안에서 필드 모양을 바꿔 문서가 굳던 결함 복구

**Status**: Accepted (2026-07-21)

**Context**: v14 작업 도중 메인 사진 위 문구의 등장 효과 필드가 **한 커밋 안에서**
`typewriter`(boolean) → `animation`(enum)으로 바뀌었다. 제작자는 이 저장소 디렉터리 위에서
`npm run dev`를 돌리고 있었으므로, 이름을 바꾸기 **전** 중간 상태(`typewriter`만 있고
`animation` 없음)에서 편집기가 문서를 저장했다. 그 순간 `CURRENT_SCHEMA_VERSION`은 이미 14라
문서에 `schemaVersion: 14`가 찍혔다.

이후 최종 스키마(`animation` enum 필수)로 그 문서를 열자 검증이 `invalid_value`로 실패했다.
**forward-only 마이그레이션 루프가 손대지 못했다** — `for (v = version; v < CURRENT)`는
저장 버전이 이미 최신이면 통째로 건너뛴다(ADR-002). 그래서 전이 상태 overlay가 그대로
검증에 도달했다. `positionPct`·`shadow`가 스키마에만 있고 마이그레이션에 없던 v12 사고와
달리, 이번엔 **필드가 존재하는데 값이 스키마 밖**이라 `invalid_type`이 아니라
`invalid_value`였다.

**Decision**: v15로 올리고 v14 → v15 마이그레이션이 hero overlay의 `animation`을 정규화한다.
스키마 밖 값(없음·옛 이름·오타)은 전부 `"none"`으로 되돌리되, 옛 `typewriter`가 켜져 있었다면
그 의도를 살려 `"typing"`으로 옮긴다. 판단은 **병합 전 저장값**으로 한다 — `DEFAULT`를 먼저
펼치면 `animation: "none"`이 채워져 '빠졌다'와 '없음으로 골랐다'를 구별할 수 없다.

버전을 올리는 것이 유일한 복구 경로다: 저장 버전이 이미 최신이면 마이그레이션이 돌지 않으므로,
굳은 문서를 고치려면 그보다 높은 버전이 있어야 한다.

**Consequences**: 굳어 있던 문서가 다시 열리고, 효과는 `"none"`(또는 옛 타자 효과를 켰다면
`"typing"`)으로 들어온다. 데이터 손실 없음 — 저장된 다른 값은 그대로다.

**교훈(반복 방지)**: **필드 이름·타입을 한 버전 안에서 바꾸지 않는다.** 모양을 바꾸는 것은 그
자체로 마이그레이션 사건이다. dev 서버가 이 디렉터리 위에서 돌기 때문에, 중간 모양은 언제든
현재 버전 번호로 디스크에 저장될 수 있고 forward-only 마이그레이션이 닿지 못한다. 새 필드는
**추가만** 하거나, 바꿔야 하면 한 번에 최종 모양으로 짓는다. `openability.test.ts`에 전이 상태
케이스를 넣었고, 마이그레이션을 빼면 네 케이스가 실패하는 것을 확인했다.

**Alternatives**: overlay 스키마를 관대하게(`.catch("none")`) — 검증 경계가 조용히 값을
갈아 끼우면 다른 필드의 진짜 오류도 삼킨다(fail fast 위반). 로더에서 현재 버전 문서도 다시
정규화 — forward-only 원칙(ADR-002)을 깨고, 모든 로드에 검사를 얹는다. 버전 안 올리고 방치 —
제작자의 문서가 열리지 않는다.

## ADR-040. 하객 asset을 Vercel CDN 뒤로 숨기는 프록시 + 발행 스냅샷 ISR 캐시

**Status**: Accepted (2026-07-21)

**Context**: Supabase 무료 플랜 egress(비캐시 5GB + 캐시 5GB)가 배포의 유일한 병목이었다.
코드를 보니 렌더러가 전부 순수 `<img>`/`<audio>`/`@font-face`로 **Supabase 공개 URL을 직접**
가리켰다(`next/image` 미사용 — `next.config`에 `images` 설정 자체가 없다). 즉 사진·폰트·음악이
하객마다 Supabase에서 직접 내려가 **egress가 하객 수에 비례**했다. 500명 기준 음악 2GB +
사진 ~0.7GB + 폰트 0.2GB로 5GB를 금방 먹는다. 압축은 바이트를 줄일 뿐 곱하기 500은 그대로다.

**Decision**: 반복 전달을 Supabase에서 Vercel CDN(Hobby 100GB)으로 옮긴다 — 세 단계.

**0. 업로드 immutable 캐시**: `assetStore`가 `cacheControl: '31536000'`으로 올린다(전엔 미설정
→ Supabase 기본 1시간). 경로가 content-hash라 immutable이 안전하다.

**1. Asset 프록시 `/a/[...path]`** (핵심): 라우트가 Supabase에서 한 번 받아
`Cache-Control: public, max-age=31536000, immutable` + `CDN-Cache-Control`로 되서빙한다.
첫 요청만 Supabase에 닿고 나머지는 Vercel 엣지가 감당한다 → **egress가 하객 수와 무관**해진다.
`buildPublicPayload` 뒤 게스트 payload의 URL을 `proxyManifest`로 `/a/…`로 바꾸고, 미들웨어의
public 경로에 `/^\/a\//`를 넣었다(확장자 exempt가 이미지·폰트만 덮어 `.mp3`가 로그인
리다이렉트로 깨지던 것 방지). Range는 전달하지 않고 전체(200)를 준다 — CDN 캐시 정합성이
단순해지고 대상 파일이 작다. 편집기·소유자 미리보기는 프록시하지 않는다(소유자 1명, egress 무시).

**2. 발행 스냅샷 ISR**: 하객 페이지(`/`, `/i/[slug]`)를 세션 없는 클라이언트로 읽어 ISR로
캐시한다(`revalidate = 300`) — 하객마다 문서 RPC를 때리지 않는다. 발행은 편집기(클라이언트)에서
일어나 서버 훅이 없으므로, 성공 후 주입된 server action이 `revalidatePath`로 그 경로를
새로고침한다(editor는 app을 import 못 해 `onPublishChange` 콜백으로 주입). ISR은
stale-while-revalidate라 재발행이 새로고침 한 번 안에 반영된다.

**Consequences**: Supabase egress가 GB 단위(하객 비례)에서 **거의 상수**(지역별 최초 채움 +
가끔 재채움)로 떨어진다. 커스텀 폰트가 필수인데도 사실상 공짜가 된다. 배포 후
`x-vercel-cache: HIT`만 확인하면 된다.

**Next 16 캐시 API 함정(기록)**: 처음엔 `unstable_cache` + `revalidateTag`로 문서를 캐시하려
했다. 그런데 ① `revalidateTag(tag, "max")`는 '앞으로 오래 살려라'라 지금 무효화하지 않고,
② `updateTag`(즉시 만료)는 새 `"use cache"` 모델을 겨냥해 legacy `unstable_cache` 태그에 닿지
않았다. 재발행이 하객에게 안 보였다. **ISR + `revalidatePath`**(라우트 캐시 무효화의 정석)로
바꾸니 확실히 동작했다. e2e는 처음에 재발행 직후 딱 한 번만 확인해 SWR의 stale 응답을 잡고
실패했다 — `expect.poll`로 고쳤다(현실의 새로고침 한 번과 같다).

**Alternatives**: 음악 서버 압축 — Vercel에 ffmpeg가 없어 무겁고, 프록시 뒤엔 egress용이
아니라 로딩속도용이라 미뤘다. next/image로 사진 — 자동 WebP·리사이즈는 좋지만 Hobby 이미지
최적화 쿼터를 먹고, 이미 업로드 때 1600px로 줄여서 범용 프록시로 통일했다. `"use cache"`
디렉티브 — `cacheComponents` 설정이 필요해 영향 범위가 커서 ISR을 택했다.

## ADR-041. 설계 리뷰 후속: 공개 노출·게스트 번들·발행 캐시 정밀화

**Context**: 지금까지의 설계·개발 방향을 Codex로 한 번 리뷰했다(적용 없이 검토만 → 이후 이
변경으로 반영). 큰 재설계·데이터 삭제성 작업은 제외하고, 실제로 근거를 대조해 확인된 것만
수술적으로 고쳤다. 네 가지가 남았다.

**Decision**:

1. **공개 projection·발행 스냅샷을 '보이는 섹션이 참조하는 asset'으로 좁힌다 (정보노출).**
   `buildPublicPayload`가 섹션은 `visible`로 걸렀지만 asset 배열은 프로젝트의 *모든* 업로드를
   그대로 실어, 올렸다 뺀 사진·숨긴 섹션 전용 사진까지 공개 URL을 얻고 있었다. 이제
   `referencedAssetIds`(asset을 가진 모든 섹션 타입 + 전역 음악·폰트를 덮는다 — video는 외부
   URL이라 asset 없음)와 교집합만 내보낸다. **두 겹**이다: 읽을 때 `buildPublicPayload`가
   좁히고(옛 스냅샷까지 보호), 발행 시점에 `persistence.publish`가 스냅샷도 좁힌다(직접 anon
   RPC로도 미참조 URL이 안 샌다). **양쪽 모두 `visible` 섹션 기준으로 참조를 뽑는다** — 숨긴
   섹션만 참조하는 asset도 스냅샷에서 빠진다(코드 리뷰가 처음엔 발행측이 full doc을 쓰던 것을
   잡았다). manifest는 호출부가 로드한 doc(rev) 기준으로 거르는데, RPC는 '현재 draft'를 잠그고
   스냅샷하므로 그 사이 draft가 바뀌면(멀티탭) manifest와 스냅샷 doc이 어긋날 수 있다. TS 재시도만으로는
   이미 커밋된 뒤라 '어긋난 스냅샷이 잠깐 live'가 되는 창을 못 막는다(직접 RPC·cold ISR이 읽을 수
   있다) — 그래서 **`publish_project`에 `p_expected_rev` 낙관적 동시성 가드**를 뒀다(마이그레이션
   `20260722030000`): 행을 잠근 뒤 rev가 다르면 아무것도 쓰지 않고 `rev_changed`로 되돌리고, 호출부가
   최신 doc으로 다시 필터해 재시도한다. **어긋난 스냅샷은 커밋된 적조차 없다.** 참조 집합이 보이는
   섹션에서 나오므로 렌더가 필요로 하는 asset을 떨어뜨리지 않는다.

   **남는 것(의도적 보류)**: ① '보이지만 비활성 variant'의 사진(예: closing이 `simple` variant인데
   photoAssetId가 남아 있는 경우)은 렌더되지 않아도 참조로 잡혀 발행된다 — 제외하려면 렌더 활성
   여부까지 아는 별도 수집기가 필요한데, 부부 자신의 사진이라 위험 대비 이득이 낮아 미룬다
   (`referencedAssetIds`는 편집기 삭제 보호도 쓰므로 그 의미를 바꾸지 않는다). ② 이 변경 이전에
   이미 발행된 스냅샷(publish_records)은 전체 asset manifest를 갖고 있다 — 하객 페이지는 읽기측
   필터가 보호하지만 직접 RPC로는 넓게 남는다. **배포 후 기존 live 청첩장을 재발행하면 정리된다**
   (운영 단계).

2. **`photos` 버킷의 anon 열거를 막는다 (보안).** init의 정책이 anon에게 버킷 전체 SELECT를 줘,
   공개 anon 키만으로 storage list API로 *모든* 프로젝트의 업로드 경로(미발행 draft 포함)를
   열거할 수 있었다("uuid라 열거 불가"는 틀린 전제 — 경로를 몰라도 목록이 나온다). 공개 버킷의
   공개 URL 다운로드는 RLS를 거치지 않으므로, SELECT 정책은 사실상 목록·관리 API에만 관여한다.
   anon SELECT를 제거하고(다운로드는 그대로) authenticated는 자기 경로만 목록 가능하게 좁혔다
   (마이그레이션 `20260722020000`). **로컬 Supabase가 꺼져 있어 이 DB 변경만 로컬 검증을 못 했다
   — `db push` 전에 확인 필요.** 통합 테스트에 'anon은 열거 불가' 케이스를 넣었다.

3. **게스트 번들에서 zod·마이그레이션 체인을 뗀다 (성능).** 게스트 화면의 유일한 클라이언트
   컴포넌트 `PublicInvitationView`가 `publicPayload.ts`에서 순수 헬퍼(폰트/음악 URL·manifest
   해석)를 가져왔는데, 그 파일 top-level이 `zod`와 전체 마이그레이션 체인을 import해 하객 번들로
   딸려 왔다("use client"라 트리셰이킹이 못 걷어낸다). 순수 헬퍼만 `publicManifest.ts`(런타임
   import 0, 타입만)로 떼고 클라이언트는 거기서 직접 가져온다. 결과: 게스트 번들에서 **마이그레이션
   체인 제거**(측정상 route 클라이언트 JS ~102KB gz, 목표 130KB 이하). 잔여 zod는 어떤 게스트
   *소스*도 import하지 않는 공유 벤더 청크에 남아 있어(청킹 레벨) 위험 대비 이득이 낮아 미룬다.

4. **발행 캐시 무효화를 보강한다 (정합성).** ① 공개 주소를 바꿔 재발행하면 옛 slug(`/i/<old>`)의
   ISR 캐시도 무효화한다(안 하면 지난 주소가 옛 스냅샷을 계속 보여준다). ② 게스트 로더가 RPC
   오류를 `null`로 뭉개 '없는 청첩장'으로 캐시하던 것을 **fail-fast**로 바꿨다 — 런타임엔 던져
   ISR이 마지막 정상 스냅샷을 유지하고, 빌드 프리렌더(루트는 빌드 시 프리렌더된다)만 관대하게
   넘겨 백엔드 blip이 배포를 막지 않게 한다(`NEXT_PHASE`로 구분).

**Scope 판단**: Codex는 더 큰 재설계(발행을 필수 server-side capability로, publish-time CDN-native
아티팩트, 소스/공개 버킷 분리, e2e hermetic화·WebKit·CI 워크플로·Supabase 타입 생성)도 제안했다.
"설계를 크게 바꾸지 않는다"는 제약에 따라 **의도적으로 보류**했다 — 위 넷은 전부 국소 변경이다.

**코드 리뷰 반복**: 위 변경을 Codex로 재리뷰하며 두 번 더 고쳤다 — (a) 발행측 필터가 처음엔
full doc을 써 숨긴 섹션 asset이 스냅샷에 남던 것을 visible 기준으로 바로잡고, (b) TS 재시도만으로는
못 막던 발행 TOCTOU를 `p_expected_rev` 가드(커밋 전 거부)로 닫았다.

**검증**: typecheck·lint(0 error)·단위 278·renderer-units·build(green) 통과. **두 DB 마이그레이션
(`20260722020000` storage anon 열거 차단, `20260722030000` publish_project expected_rev)과 통합/e2e는
로컬 Supabase가 필요해 미실행**(사용자가 리소스 문제로 꺼 둠) — 의도는 테스트로 인코딩했고, **`db push`
전에 로컬에서 켜서 통합 테스트로 확인**해야 한다. 스키마 문서 버전은 불변(공개 projection·Storage·
발행 RPC 변경이라 문서 마이그레이션과 무관).

## ADR-042. 피드백 반영: 사진 위 문구 연출 확장 + 떠 있는 공유 버튼 일원화 (스키마 v16)

**Context**: 실사용 피드백 6건 — ① 메인 사진 위 문구(필기체 제목)에 은은한 발광과 자간·행간
조절 ② 메인 사진에 꽃잎 같은 잔잔한 연출 ③ 교통 안내에서 '예식장 전화' 그림만 크기가 어긋남
④ 문구 등장 효과의 속도 조절 ⑤ 마지막 섹션(공유하기)을 숨기면 맨 아래에 배경이 아닌 띠가
보이는 버그 ⑥ 발행 후에만 나타나는 떠 있는 공유 버튼 — 편집기·미리보기에는 없어 발행 전에는
존재조차 모른다.

**Decision**:

1. **스키마 v16** — `heroOverlay`에 `glow`·`glowStrength`(5~100)·`letterSpacing`·`lineHeight`
   (역할 글자와 같은 단위·범위)·`animationSpeed`(0.5~2), `photoEffects`(메인·맺음말 공용)에
   `petals`를 더했다. 마이그레이션 v15→16은 전부 '지금 모습 그대로'인 기본값을 심는다
   (발광·꽃잎 꺼짐, 자간 0·행간 1.45 = 그때까지 렌더러 고정값, 속도 1배). openability에
   v15 케이스를 추가했다(새 필드를 지운 옛 모양 문서가 열리고 기본값이 이 값들인지).
2. **발광은 같은 글자를 블러로 한 층 더 그려서 만든다** — text-shadow가 아니라 복제 층이라
   글꼴·자간·등장 효과를 그대로 물려받아 본문과 겹쳐 움직이고, 바깥 상자의 opacity 애니메이션
   (`canvas-glow-breathe`, 4s)이 숨쉬듯 밝기를 올렸다 내린다. 세기 하나가 번짐(blur)과
   진하기(불투명도)를 함께 움직인다(그림자 세기와 같은 규칙). 빛 색은 글자색을 따른다 —
   다른 색 후광은 번진 인쇄처럼 보인다. reduced-motion에서는 기존 `[data-hero-overlay] *`
   규칙이 숨쉬기를 멈춰 일정한 밝기로 남는다.
3. **꽃잎은 사진 높이만큼의 보이지 않는 기둥(inset-y-0)을 `translateY(-100%→100%)`로 내린다**
   — top을 직접 움직이면 매 프레임 레이아웃이 돌지만 이 방식은 합성기만 쓰고, 사진 비율이
   달라도 %가 높이를 따라간다. 자리·박자는 고정값(난수는 SSR 불일치), 지연은 음수로 두어
   처음부터 하늘에 흩어져 있다. reduced-motion에서는 아예 그리지 않는다 — 공중에 멈춘
   꽃잎은 별(반짝임)과 달리 얼룩으로 읽힌다.
4. **등장 속도는 배율 하나로** — 재생 시간·글자 간 지연을 전부 `animationSpeed`로 나눈다.
   효과가 '없음'이면 손잡이를 숨긴다(그림자 색과 같은 규칙).
5. **그림 크기 어긋남은 이모지 표시 지정자 정규화로 고친다** — ☎·✈ 같은 옛 기호는 기본
   표시가 '글자'라 U+FE0F 없이 저장되면 작은 흑백 활자로 그려진다. `withEmojiPresentation`이
   그릴 때 지정자를 붙인다(이미 있으면·글자 표시 U+FE0E를 일부러 골랐으면·ASCII면 그대로 —
   숫자에 붙이면 키캡 이모지가 되어버린다). 문서는 손대지 않는다(표시 계층의 문제다).
6. **떠 있는 공유 버튼을 렌더러 안(`FloatingShare`)으로 옮겼다** — 편집기 미리보기와 게스트
   화면이 같은 모습이어야 한다는 ADR-004의 원칙을 이 버튼도 따른다(발행 후에야 처음 만나는
   UI 금지). 누르면 위로 판이 열려 **링크 복사·카카오톡 공유**를 고른다(Web Share API 단일
   동작 대체) — 동작·비활성 규칙은 공유하기 섹션과 한 구현(`useShareActions`)을 쓴다.
   `sticky bottom + 음수 마진`이라 문서 높이에 0을 더한다: 예전 구현(공개 페이지 전용,
   흐름 안 sticky 바)이 마지막 섹션 아래에 만들던 52px 바탕색 띠(⑤의 버그)가 사라진다.
   MusicToggle이 위에서 쓰던 것과 같은 기법이다.

**Alternatives rejected**:
- 발광을 text-shadow 겹치기로: 밝기를 숨쉬게 하려면 text-shadow 전체를 애니메이션해야 하는데
  등록된 커스텀 속성(@property) 없이는 계단식으로 뛰고, Safari 구형에서 지원이 갈린다.
- 꽃잎 `top` 애니메이션: 프레임마다 레이아웃 — 요소가 9개뿐이라 감내할 수는 있지만, 하객
  기기 스펙을 모르는 화면에서 굳이 레이아웃을 돌릴 이유가 없다.
- 떠 있는 버튼을 문서 옵션(스키마)으로: 켜고 끄자는 요청이 없다(YAGNI). 발행 화면의 기존
  동작(항상 표시)을 그대로 편집기에도 보여주는 것이 이번 요구의 전부다.
- ⑤를 '마지막 섹션 하단 여백 0 옵션'으로: 띠의 원인은 여백 설정이 아니라 흐름 안 sticky
  바였다 — 증상(여백처럼 보임)이 아니라 원인(레이아웃 점유)을 제거했다.

**Residual**: 교통 안내 ③은 사용자의 실제 문서를 열람할 수 없어(발행 slug 비공개) ☎ 지정자
누락 가설로 고쳤다 — 배포 후 실물 확인 필요, 여전히 어긋나면 그 그림만 📞로 바꾸는 대안이 있다.
발행된 청첩장은 재발행해야 v16 렌더(발광 등)를 쓸 수 있다(스냅샷은 읽을 때 마이그레이션되므로
열림은 보장, 새 기능만 기본값).

**검증**: typecheck·renderer-units·단위 285·통합 34·e2e 94·build 전부 green. e2e phase7 공유
흐름을 새 UI(판 열기 → 링크 복사)로 갱신. 이번 실행에서 ADR-040 때 미실행으로 남았던 e2e가
처음 돌며 music.spec의 낡은 단언 하나가 드러나 고쳤다 — 게스트 오디오 URL이 `/storage/`(프록시
전 모양)라고 검사하고 있었는데, ADR-040 이후 하객에게는 `/a/` 프록시로 나가는 것이 맞는 모습이다.

## ADR-043. 피드백 반영 2차: 발광·꽃잎 연출 강화 + 아이콘 테마 통일 (스키마 v17)

**Context**: ADR-042 직후 이어진 실사용 피드백 — ① 발광이 너무 약하다, 더 뚜렷하게 ② 글자
외곽을 흐릿하게 하는 효과도 (조절 가능하게) ③ 꽃잎이 위에서 아래로만 떨어진다: 흩날리듯
불규칙하게, 색·양·투명도 조절, 모양도 장마다 다르게 ④ 네이버·카카오맵·티맵 아이콘의 브랜드
원색이 테마에서 혼자 튄다 — 테마 강조색으로 ⑤ '예식장 전화'만 아이콘 크기가 여전히 다르다
(ADR-042의 U+FE0F 정규화로 부족 — ☎️는 지정자가 있어도 플랫폼 그림 자체가 잘다).

**Decision**:

1. **발광을 두 층으로 재설계** — 한 층을 크게 흐리면 빛이 퍼지며 묽어져 세기를 올려도
   뚜렷해지지 않았다. 글자 가장자리에 붙는 촘촘한 심(blur 2~10.5px, 세기 55부터 불투명)과
   넓게 퍼지는 무리(blur 5~30px)를 겹친다. 스키마 불변 — 같은 `glowStrength`가 더 환해진다.
2. **`edgeBlurPx`(0~6px)** — 글자 자체의 외곽을 부드럽게 번지게 하는 별개 효과. 0 = 또렷이라
   스위치를 따로 두지 않는다. 보이는 글자 층에만 걸고 발광 층은 제 블러를 유지한다.
3. **꽃잎 전면 재작업** — 낙하(기둥 translateY)·표류(좌우 큰 진폭, 낙하와 어긋난 주기 →
   대각선으로 흘러내림)·펄럭임(rotate + scaleX로 잎이 뒤집히는 착시) 세 겹을 포갠다.
   세 주기가 약수 관계가 아니라 같은 궤적이 되풀이되지 않는다("불규칙하게 흩날리듯").
   모양 3종(벚꽃잎·둥근 잎·갸름한 잎), `petalColor`(색 하나에 흰색을 장마다 섞어 세 톤 파생,
   color-mix)·`petalCount`(1~20, 자리 순서를 가로로 흩뿌려 양을 줄여도 안 몰림)·
   `petalOpacity`(20~100%). 여전히 전부 고정값·합성기 전용·reduced-motion 미표시.
4. **지도 앱 아이콘을 강조색 SVG 배지로** — 브랜드 PNG(제3자 상표)를 지우고, 강조색 배지 위에
   단색 심볼(네이버 N·카카오 말풍선·티맵 T)을 그린다. 심볼 색은 `readableInk`로 자동.
   ADR-034에서 "자체 SVG → 공식 PNG"로 갔던 것을 되돌리는 셈인데 이유가 다르다: 그때는
   식별이 문제였고(라벨이 없던 시절 모양), 지금은 배지 심볼 + 바로 아래 글자 라벨이 함께
   식별을 맡으므로 테마 톤 요구가 이긴다. 상표 이미지 동봉 부담도 함께 사라진다.
5. **교통 수단에 '전화' 추가**(enum 확장, 기본 그림 📞) — ☎️의 크기 문제는 글리프 자체의
   문제라 렌더 쪽에서 맞출 수 없다. 📞는 다른 교통 이모지와 같은 크기 계열이다. 사용자는
   항목의 수단을 '전화'로 바꾸고 그림 칸을 비우면 된다.

**스키마 v17**: overlay `edgeBlurPx`, effects `petalColor`·`petalCount`·`petalOpacity`,
transportIcon `phone`. 마이그레이션 v16→17은 외곽 흐림 0, 꽃잎은 v16 렌더러에 굳어 있던
값(#ffd6e0·9장·90%)을 심는다 — 켜 두었던 꽃잎의 모습이 유지된다. openability에 v16 케이스와
'전화' 수단 케이스 추가.

**검증**: typecheck·renderer-units·단위 287·통합 34·e2e 94·build green. e2e는 지도 아이콘
검사를 img 로드에서 SVG 존재로, 미들웨어 정적 자원 검사를 samples/로 옮겼다.

## ADR-044. 피드백 반영 3차: 문구 기울기·겹침 자간·200pt + 모바일 쓰기 효과 (스키마 v18)

**Context**: 이어진 피드백 — ① 사진 위 문구를 기울이고 싶다 ② 자간·행간을 "글자가 겹쳐도
좋으니" 마이너스로 더 내리고 싶다 ③ 글자 크기 상한 72pt를 200pt로 ④ 꽃잎 모양이 좀 뾰족하다
⑤ '펜으로 쓰듯' 효과가 PC에서는 부드러운데 모바일에서 뚝뚝 끊긴다.

**Decision**:

1. **`rotateDeg`(±90°)** — 문구 전체의 기울기. 위치를 잡는 <p>의 transform에 합성한다
   (`translateY` 뒤 rotate): 등장 효과(rise)가 transform을 애니메이션하는 안쪽 상자에 걸면
   재생이 끝나는 순간 기울기가 풀린다.
2. **사진 위 문구 전용 자간·행간 하한** — `OVERLAY_LETTER_SPACING_MIN`(-0.5em)·
   `OVERLAY_LINE_HEIGHT_MIN`(0.3). 역할 글자의 공용 하한(-0.05em·1.0)은 그대로 둔다:
   본문에 겹침 하한을 열면 청첩장 본문이 읽을 수 없게 되는 사고 손잡이가 된다.
   `OVERLAY_PT_MAX`도 72→200. 셋 다 '범위가 넓어지는' 변경이라 기존 값은 전부 유효하다 —
   v18로 올리는 이유는 경계다(새 범위의 문서를 옛 코드가 스키마 오류로 오해하지 않고
   "지원하지 않는 버전"으로 거부, ADR-002 v4→v5와 같은 규칙).
3. **문구는 사진에서 잘린다** — 200pt·기울기로 사진을 벗어나는 부분은 overflow로 자른다.
   '사진 위 문구'의 존재 이유가 사진 위이고, 안 자르면 아래 섹션을 덮거나(absolute도 조상
   스크롤 넘침을 늘린다) 하객 화면에 가로 스크롤이 생긴다.
4. **꽃잎 끝 둥글게** — 세 모양 모두 뾰족한 꼭짓점을 곡선 마감으로 완화(색종이 조각 인상 제거).
5. **'펜으로 쓰듯'을 clip-path에서 transform 두 겹으로 재구현** — 모바일 WebKit은 clip-path
   애니메이션을 합성기로 돌리지 못해 매 프레임 메인 스레드에서 다시 그린다. 로딩 직후처럼
   바쁜 순간 프레임이 떨어져 끊겼다(PC는 여유가 있어 매끈했던 것). 창(overflow hidden 상자,
   왼쪽에서 진입)과 잉크(글자, 오른쪽에서 진입)가 같은 %만큼 반대로 움직여 상쇄 — 글자는
   제자리에 있고 보이는 창만 왼쪽부터 넓어진다. 두 상자에 같은 패딩 40px·음수 마진을 주어
   %(상자 폭 기준) 이동이 정확히 상쇄되고 그림자·발광도 잘리지 않는다(옛 -40px inset과 같은
   몫). overflow 있는 inline-block은 기준선이 상자 아래 모서리가 되므로 vertical-align:
   top으로 줄 들림을 막는다.

**검증**: typecheck·renderer-units·단위 289·통합 34·e2e 94·build green. e2e의 쓰기 효과
단언을 새 구조(줄당 창·잉크 2상자, canvas-write-window)로 갱신. 발행 수명주기 spec이 전체
병렬 실행에서 1회 5초 타임아웃(부하 플레이크) — 단독 3연속 통과로 회귀 아님 확인.

## ADR-045. 모바일 끊김 근본 수정: 블러 필터 안의 애니메이션 제거 (렌더러만, 스키마 불변)

**Context**: ADR-044(clip-path → transform)로도 모바일에서 '펜으로 쓰듯'이 여전히 끊겼다.
쓰기 동작 자체는 합성기로 옮겼지만, **발광이 켜져 있으면** 블러 사본 2겹 '안에서' 같은 등장
애니메이션이 함께 돌았다. blur 필터는 내용 픽셀이 바뀔 때마다 처음부터 다시 계산된다 —
10.5px+30px 가우시안 블러를 매 프레임, 모바일 GPU에는 치명적이고 PC는 여유가 있어 티가
안 났다. 외곽 흐림(edgeBlurPx)도 같은 구조 문제를 안고 있었다.

**Decision**: "블러 아래의 픽셀은 정지, 움직임은 블러 위(또는 블러가 걸린 요소 자체)의
transform/opacity로"를 원칙으로 재배치했다.
1. **발광 층은 정지 글자를 그린다**(등장 효과·외곽 흐림 제거) — 블러는 딱 1회 계산.
   대신 층 전체가 등장 총 시간(totalEntranceMs)에 맞춰 **불투명도로 차오른다** — 글자가
   써지는 동안 후광이 함께 은은히 번져 오는 모습이라 연출로도 자연스럽다. 숨쉬기(무한)와
   차오르기(1회)를 같은 요소에 겹치고, 겹치는 동안은 뒤에 적힌 차오르기가 이긴다.
2. **외곽 흐림은 '움직이는 요소 자체'로 내려보낸다** — 타자·글자 스르륵은 글자 span(정지
   픽셀·불투명도 등장), 쓰기는 잉크 span(정지 픽셀·transform 이동)에 건다. 정지 모드
   (없음·서서히·올라오기)만 기존처럼 조상에 건다(그 모드는 픽셀이 안 바뀐다).
3. 쓰기 창·잉크에 `will-change: transform` — 줄이 시작되는 순간의 레이어 승격 래스터를
   미리 치러 스태거 시작 히치를 없앤다.

**Residual**: 이걸로도 남는 끊김이 있다면 다음 용의자는 커스텀 폰트 로딩 스왑(폰트 도착
순간 줄 폭 재계산)이다 — 재현되면 폰트 준비 후 등장을 시작하는 게이트를 검토한다.

**검증**: typecheck·renderer-units·단위 289·build green + e2e 전체 재실행.

## ADR-046. 폰트 FOUT 제거: display block + 폰트 게이트 (렌더러·레이아웃, 스키마 불변)

**Context**: "처음 로딩할 때 폰트가 깨졌다가(기본 폰트) 로딩되는 느낌" — 내장 한글 폰트
5종이 `display: "swap"`이라 첫 페인트가 fallback 글꼴로 그려진 뒤 교체됐다(FOUT). 한글
폰트는 유니코드 슬라이스가 100개가 넘어 preload로는 첫 페인트를 못 맞춘다(latin만 실린다).
ADR-045의 잔여 용의자(폰트 스왑이 등장 효과를 어긋나게 함)가 실사용으로 확인된 것이기도 하다.

**Decision**:
1. **내장 5종·업로드 폰트 모두 `font-display: block`** — 청첩장은 속도보다 모습이다.
   잘못된 글꼴을 보여줬다 바꾸는 대신 짧게(대개 수백 ms) 비웠다가 고른 글꼴로 바로 그린다.
   블록 한계(~3s)를 넘기면 브라우저가 알아서 fallback으로 전환하므로 글이 영영 안 보이는
   일은 없다. `optional`은 기각 — 하객은 한 번 방문하는데 그 한 번을 fallback으로 볼 수 있다.
2. **폰트 게이트** — 글꼴이 도착하기 전에는 사진 위 문구의 등장 효과를 통째로 일시정지
   (`[data-fonts-loading] [data-hero-overlay] * { animation-play-state: paused }`).
   fallback 폭으로 쓰기 창·잉크가 재생을 시작했다가 진짜 글꼴로 바뀌면 줄 폭이 틀어진다.
   속성은 렌더러 루트의 인라인 스크립트가 `document.fonts.ready`에 제거하고 3초 안전장치를
   둔다. 스크립트는 SSR HTML에서만 실행된다 — 클라이언트 렌더로 주입된 script는 브라우저가
   실행하지 않으므로 편집기 미리보기는 게이트 없이 즉시 재생하고, JS가 죽은 환경에서는
   속성이 아예 붙지 않아 효과가 그냥 재생된다(글자가 숨은 채 남지 않는다 — ADR-038 원칙 유지).

**검증**: typecheck·renderer-units·단위 289·build green + e2e 전체.

## ADR-047. 피드백 4차: 음량 지각 곡선 + 떠 있는 공유 버튼 강조색 (렌더러만, 스키마 불변)

**Context**: ① "음량을 1로 하나 70으로 하나 크게 변화가 없다" ② 떠 있는 '청첩장 공유하기'
버튼도 테마 강조색을 입혀 달라.

**Decision**:
1. **음량을 세제곱 곡선으로 적용** — `audio.volume`은 선형 진폭인데 사람 귀는 로그라,
   선형 매핑에서는 슬라이더 상단 절반(50~100%)이 거의 같게 들린다(70%≈-3dB). 렌더러가
   `volume³`을 얹어 70%≈-9dB·50%≈-18dB·30%는 희미 — 눈금마다 차이가 실제로 들린다.
   문서에는 슬라이더 값이 그대로 저장되므로 스키마 불변, 기존 문서도 열리는 즉시 새 곡선.
2. **알약 버튼을 강조색으로** — 고정 검정(bg-black/75)을 버리고 테마 강조색 + 자동
   글자색(readableInk). "한 청첩장에서 버튼은 한 색"(buttonColorSchema) 규칙에 합류한다 —
   팔레트에서 강조색을 바꾸면 함께 따라간다. 별도 색 설정은 두지 않았다(요청도 규칙도 아님).

**검증**: typecheck·renderer-units·단위 289·build·e2e 전체 green.

## ADR-048. 갤러리 선로딩: 사진을 넘기기 전에 받아 둔다 (렌더러만, 스키마 불변)

**Context**: "사진 넘길 때 로딩이 좀 걸리는데 어쩔 수 없나? 차라리 첫 로딩을 좀 길게 잡고
모든 페이지가 다 로딩된 상태로 가고 싶다. db 비용은 아끼면서." — 갤러리(및 모든 비첫화면
사진)가 `loading="lazy"`라 스와이프·스크롤로 화면에 들어올 때 그제서야 받아왔다.

**Decision**: PhotoFrame의 모든 사진을 `loading="eager"`로 처음부터 받되 **fetchPriority로
차등**을 둔다 — 첫 화면(메인 사진)만 high, 나머지는 low. 첫 페인트(사진·글·폰트)를 방해하지
않으면서 하객이 갤러리에 닿을 때는 대부분 도착해 있다. 사용자가 명시적으로 고른 트레이드다
("첫 로딩을 길게 잡더라도").
- **Supabase 비용은 늘지 않는다**: 하객 사진은 전부 `/a/` 프록시 → Vercel CDN(immutable)이
  받는다(ADR-040). 첫 하객이 CDN을 데우면 그 뒤는 Supabase에 닿지 않는다.
- 전송량도 통제돼 있다: srcSet이 표시 폭(430px 캔버스) 변형을 고르므로 원본이 아니라
  리사이즈 webp가 내려간다. 30장 갤러리라도 수 MB 수준.
- 게스트 데이터 사용량이 느는 것은 사실 — 결혼식 청첩장은 한 번 보는 페이지라 수용한다.

**검증**: typecheck·renderer-units·단위 289·build·e2e 전체 green (음량 e2e는 ADR-047의
세제곱 곡선으로 단언 갱신).

## ADR-049. 준비 게이트: 폰트·이미지가 다 온 뒤에 모든 효과를 함께 시작한다 (렌더러만, 스키마 불변)

**Context**: ADR-044(합성기 전용 transform)·045(블러 아래 정지)·046(폰트 게이트) 뒤에도
"글자 써지는 효과가 아직 모바일에서는 끊긴다". 사용자 지시: "청첩장 전체가 로딩이 좀
느리게 되더라도 화면이 떴을 때에는 모든 것이 빠르고 부드럽게 적용되도록 바꿔라."

**원인**: 애니메이션 자체는 이미 합성기 전용이지만 **시작 시점**이 문제였다. 등장 효과가
재생되는 첫 1~3초는 하필 하이드레이션·이미지 디코드(ADR-048로 전 사진 eager)·레이어
승격이 몰리는 가장 바쁜 구간이다. 합성기 애니메이션도 시작 전 단계(스타일 반영·레이어
승격·최초 래스터)는 메인 스레드를 타므로, 그 구간에 겹치면 첫 프레임들이 밀린다.
PC는 이 작업이 수백 ms에 끝나 안 겹치고, 모바일만 겹쳤다.

**Decision**: ADR-046의 폰트 게이트를 **전체 준비 게이트로 확장**한다.
1. 속성 `data-fonts-loading` → `data-entrance-hold`로 대체. SSR 인라인 스크립트가 즉시
   붙이고, `document.fonts.ready` **와** window `load`(readyState complete면 즉시)가 모두
   끝난 뒤 rAF 두 번 지나 제거한다. 10초 안전장치(자원이 영영 안 오면 그대로 시작),
   rAF 두 번은 load 직후의 정리 작업이 지나간 다음 프레임에서 시작하기 위해서다.
2. 일시정지 범위를 히어로 문구에서 **캔버스 전체 CSS 애니메이션**으로 확장
   (`[data-invitation-root][data-entrance-hold] * { animation-play-state: paused }`) —
   쓰기 효과·발광 숨쉬기·꽃잎·반짝임이 로딩과 다투지 않고, 준비된 뒤 함께 시작한다.
   섹션 등장(SectionShell)은 transition 기반이라 영향 없다. 게이트가 잡혀 있는 동안은
   사진·글이 정지 화면으로 보인다(문구는 0% 프레임 = 숨김) — "로딩을 길게 잡더라도"의
   그 로딩이다. 대기 중 꽃잎은 음수 delay로 미리 흩어진 자리에 멈춰 장식처럼 보인다.
3. 편집기 미리보기는 그대로 즉시 재생(스크립트가 SSR HTML에서만 실행), JS 죽은 환경도
   그대로 재생(속성이 안 붙는다), 백그라운드 탭은 rAF가 멈춰 있어 **처음 화면에 보이는
   순간** 시작한다 — 전부 의도된 동작이다.

**검증**: e2e에 게이트 해제 단언 추가(발행 페이지의 `data-entrance-hold`가 반드시 떨어진다
— 안 떨어지면 효과가 영영 멈춘 채라 치명적) + 전체 매트릭스 green.

## ADR-050. 모바일 음량: 소리 경로를 WebAudio GainNode로 (렌더러만, 스키마 불변)

**Context**: "음량 조절이 PC에서는 되는데 발행 페이지를 모바일에서 보면 차이가 없다."

**원인**: iOS Safari는 `HTMLMediaElement.volume` 대입을 무시한다 — 페이지 음량은 하드웨어
버튼 전용이라는 플랫폼 정책이고, 세제곱 곡선(ADR-047)이 문제가 아니라 값 자체가 안 먹었다.

**Decision**: MusicToggle이 첫 재생 시도 때 `AudioContext + MediaElementSource + GainNode`
그래프를 만들어 소리를 그 경로로 보낸다. gain은 iOS에서도 적용되므로 세제곱 감쇠를
gain에 얹고 element volume은 1로 둔다(두 군데 다 걸면 volume⁶).
- **그래프는 지연 생성** — 게스트 대부분은 음악을 안 켠다. WebAudio 미지원이면 기존
  element volume으로 동작(데스크톱은 그걸로 충분하다).
- **suspended 처리**: 컨텍스트는 사용자 동작 없이는 잠긴 채 태어날 수 있다 — 재생 경로마다
  resume하고, "media 재생은 허용됐는데 컨텍스트만 잠김"(무음 재생)이면 실패로 쳐서 기존
  첫-동작 재시도 리스너가 다시 연다. 클릭 재생은 동작 안에서 resume하므로 항상 열린다.
- **오염(taint) 없음**: MediaElementSource는 교차 출처 오디오면 무음이 되는데, 소스가 전부
  같은 출처다 — 게스트는 `/a/` 프록시(ADR-040), 편집기·미리보기는 blob URL.
- 적용된 감쇠값은 `data-applied-volume`으로 비춘다 — gain은 DOM 밖이라 이 속성이 없으면
  배선을 확인(디버깅·e2e)할 길이 없다. 음량 e2e는 이 속성으로 단언을 옮겼다.

**검증**: typecheck·renderer-units·단위·build·e2e 전체 green.

## ADR-051. 음악 원상복구: WebAudio 우회 폐기 — 재생 신뢰성 > iOS 음량 (ADR-050 철회)

**Context**: ADR-050(GainNode) 배포 후 실기기 확인 결과 "이제는 아예 폰에서 소리조차
재생이 잘 안 된다" — 음량을 고치려다 소리 자체를 깨뜨렸다.

**원인**: iOS에서 WebAudio 출력은 **무음 스위치(진동 모드)에 묶인다** — `<audio>` 직접
재생은 무음 모드에서도 들리지만(미디어 재생 카테고리), WebAudio 경로는 스위치가 켜진
폰에서 무음이 된다. 하객 대부분이 진동 모드다. 그 외에도 suspended 컨텍스트 해제 타이밍,
MediaElementSource의 iOS 신뢰성 문제 등 실패 지점이 여럿이었다.

**Decision**: `<audio>` 직접 재생으로 되돌린다(세제곱 곡선은 element volume에 유지).
iOS에서 페이지가 음량을 지정할 수 없는 것은 플랫폼 정책이고(유튜브 웹 등 대형 서비스도
iOS 웹에는 음량 슬라이더가 없다), BGM은 예식일에 반드시 나와야 하는 기능이라 **재생
신뢰성이 iOS 음량 조절보다 우선**한다. 편집기 음량 슬라이더 아래에 "아이폰은 기기 음량
버튼을 따릅니다" 안내문을 넣어 기대를 관리한다. PC·안드로이드는 음량 조절이 그대로 된다.

**함께 고친 기존 버그 — 자동재생 재시도**: ① 재시도 이벤트에 브라우저가 '사용자 동작'으로
인정하는 계열(touchend·click·pointerup)이 빠져 있었다 — iOS는 특히 '뗌'에서 허가를 준다.
② 재시도가 1회용이라, 허가를 못 받는 스크롤에서 한 번 실패하면 정작 탭이 와도 다시 켜지
못했다 — 성공할 때까지 재장전으로 변경. 폰에서 자동재생이 유독 안 되던 별개 원인이다.

**검증**: 음량 e2e를 element volume 단언으로 원복 + 전체 매트릭스 green.

## ADR-052. iOS filter는 매 프레임 다시 돈다 — 발광은 text-shadow로, filter는 정지 요소에만

**Context**: 준비 게이트(ADR-049) 후에도 "글자 써지는 효과가 글자 끝 부분이 끊기면서
뒤늦게 그려진다" — 시작 시점 문제를 제거했는데도 재생 중 프레임이 떨어졌다.

**원인**: 합성 레이어에 걸린 CSS `filter`를 iOS는 **화면을 그릴 때마다 다시 계산**한다
(CoreAnimation 실시간 필터 — 정지 내용이라도 굽지 않는다). 발광이 blur 반경 최대
10.5px+30px 두 층을 3배 해상도로 매 프레임 돌리고, 외곽 흐림은 움직이는 잉크 레이어에,
반짝임 별들은 무한 깜빡임 요소에 filter가 직접 걸려 있었다. 글자가 써지는 동안 이
비용이 겹쳐 프레임이 떨어지고, 쓸기 모서리가 건너뛰며 글자 끝이 뒤늦게 나타났다.
PC GPU는 이걸 다 흡수해서 모바일에서만 보였다.

**Decision**: 원칙 — **filter는 애니메이션되는(=합성 레이어로 승격되는) 요소에 직접 걸지
않는다.** 매 프레임 비용을 래스터 1회 비용으로 바꾼다.
1. **발광**: blur 사본 → **글자색 투명 + text-shadow** 두 층. 같은 가우시안 모양(그림자
   반지름 = blur px × 2 — filter blur(l)은 표준편차 l, 그림자 반지름 r은 r/2)이지만
   text-shadow는 래스터 때 한 번 구워지는 정지 픽셀이다. 층 구조·세기 매핑·숨쉬기
   애니메이션(불투명도)은 그대로.
2. **외곽 흐림**: 애니메이션되는 글자 상자가 아니라 그 '안'의 정지 요소(EdgeBlurred)에 —
   부모 레이어를 굽는 시점에 1회 적용된다. (blur 조상 '안'에서 내용이 움직이는 것은
   여전히 금물 — ADR-045의 재블러.)
3. **반짝임**: 깜빡임 애니메이션은 바깥 상자, drop-shadow는 안쪽 정지 svg로 분리 —
   별은 무한히 깜빡여 이 비용이 영원히 돌고 있었다.
4. **음악 버튼 backdrop-blur 제거**: iOS의 backdrop-filter도 매 프레임 재계산이다 —
   아래에서 꽃잎·글자가 움직이는 내내 추가 패스를 유발했다. 배경을 약간 더 진하게
   (black/40→45) 바꿔 가독을 유지한다.

ADR-044(합성기 전용 transform)·045(블러 아래 정지)·049(준비 게이트)에 이은 마지막 조각:
"움직임은 transform/opacity로, **번짐은 래스터에 굽고**, 시작은 한가할 때."

**검증**: typecheck·renderer-units·단위·build·e2e 전체 green (반짝임 DOM 구조 변경은
data-star 단언과 호환 — 개수·가시성 그대로).

## ADR-053. 리뷰 후속: 이모지 발광 회귀 · 음악 재생 경쟁 3건 수정 (ADR-051/052 보강, 스키마 불변)

**Context**: ADR-051/052를 codex로 교차 리뷰(rescue 종합 + 4각도 병렬 후 실제 코드 대조)한
결과, 구조는 건전하나 실질 지적 3건이 확인됐다. 사용자 지시로 사용자가 지적한 기능 영역
(사진 위 문구 효과 · 음악)에 관련된 것만 수정한다. codex의 major "detached &lt;audio&gt;가
영원히 loop"는 거짓 양성으로 반박(모던 브라우저는 미디어 요소가 DOM에서 제거되면 자동
pause — HTML 표준 removing steps). 문서 표기·안내문 대비 지적은 지적 범위 밖이라 미수정.

**Decision**:
1. **컬러 이모지 발광 조기 노출 (회귀, ADR-052발)** — `color: transparent`는 컬러 이모지의
   내장 색을 못 지운다(CSS Color 명세). 발광 사본은 문구 전체를 `animation:"none"`으로 그려
   서, 이모지가 섞이면 그 이모지만 후광 없이 선명하게 조기 노출됐다(쓰기 효과가 도달하기 전).
   예전 `filter:blur()`는 이모지도 흐렸지만 text-shadow는 못 한다. → 발광 전용 `GlowText`가
   컬러 이모지 코드포인트(`\p{Emoji_Presentation}` 또는 뒤 U+FE0F)만 `opacity:0`으로 감춘다.
   advance 폭은 남아 후광 텍스트가 본문과 정렬을 유지하고, 이모지 없는 문구는 기존과 동일
   DOM(회귀 없음). 본문(발광 아닌 실제 글자)은 이모지를 그대로 보여 준다.
2. **재생 대기 중 취소 시 소리·버튼 불일치 (minor)** — 자동재생 `play()`가 pending인 동안
   effect가 정리(cancelled)되면 `cancelled`가 `setPlaying`만 막고 재생은 못 막아, 소리는
   나는데 버튼은 '음악 켜기'로 남을 수 있었다(에디터 미리보기에서 재생 대기 중 자동재생
   토글 끌 때). → `start()`가 play 성공 후 `cancelled`면 즉시 `audio.pause()`로 되돌린다.
   게스트 페이지는 autoStart가 마운트 중 안 바뀌고 언마운트 시 브라우저가 알아서 멈춘다.
3. **자동재생 retry ↔ 버튼 click 경쟁 (minor)** — 자동재생 차단 상태에서 버튼 탭이 재생을
   시작하면, retry가 먼저 켜고 곧이어 오는 click이 `toggle→pause`로 꺼 버릴 수 있었다
   (`click`을 허가 이벤트로 넣으며 생긴 결). → retry가 이벤트 대상이 음악 버튼 안이면 물러
   난다(버튼 `onClick`이 직접 처리). 물러날 때도 리스너를 정리해 사용자가 버튼으로 제어를
   잡은 뒤에는 자동 재시도가 끝난다(일시정지 후 스크롤이 재시작하는 부작용도 차단). 이를
   위해 `{once:true}`를 버리고 `removeListeners`로 8종을 일괄 관리한다.

**검증**: typecheck·renderer-units·단위 289·통합 34·build·e2e 94 전부 green. 이모지 발광은
DOM 회귀가 없어 기존 e2e로 안전, 육안 확인은 이모지+발광 문구로 별도 필요.

## ADR-054. 쓰기 효과 재구현 — 움직이는 창·잉크를 버리고 글자별 opacity 페이드 (렌더러만)

**Context**: ADR-044(합성기 전용)·045(블러 정지)·049(준비 게이트)·052(filter 격리)를 다
거쳤는데도 모바일에서만 "글자 테두리 쪽이 로딩이 안 됐다가 다 써졌을 때쯤 버벅대며
완성"이 남았다. PC는 멀쩡했다.

**원인**: 쓰기 효과가 창(overflow hidden, translateX -100%→0)·잉크(+100%→0) 두 상자의
상쇄로 글자를 드러내는 구조 자체. 모바일 브라우저는 **잘려서 안 보이는 픽셀을 미리
칠하지 않는다**(백킹 스토어 분리/타일 래스터) — 잉크는 시작 시점에 100% 클립 밖이라
칠해진 적이 없고, 창이 열리며 드러나는 순간에야 메인 스레드가 비동기로 칠하기 시작한다.
로딩 직후처럼 바쁘면 칠이 합성기 애니메이션을 뒤늦게 쫓아가 — 드러난 자리가 빈 채로
있다가 늦게 채워진다. 데스크톱은 래스터가 충분히 빨라 티가 안 났다.

**Decision**: 움직이는 상자·클리핑을 전부 버리고 **글자(자소)별 opacity 페이드**로 재구현
(줄 안에서 60ms 간격, 150ms ease-out 페이드 — 두어 글자가 겹쳐 잉크가 배어나오는 결,
줄은 앞 줄을 다 쓴 뒤 시작: 총 시간·리듬은 기존과 동일). 픽셀은 한 번 그려진 뒤 움직이지
않고, **혹시 첫 칠이 늦어도 그 프레임은 페이드 초입(투명)이라 구조적으로 보이지 않는다**.
따라온 정리:
1. **발광이 펜을 따라온다**: 발광 사본도 같은 등장 시차로 그린다(OverlayText glowCopy —
   같은 컴포넌트를 지나 시차가 어긋날 수 없다). ADR-045의 "정지 사본 + 층 전체 차오르기"
   타협은 blur 시절의 제약이었다 — text-shadow(정지 픽셀, ADR-052)가 되면서 글자별 등장이
   공짜가 됐다. totalEntranceMs·창·잉크 keyframe·WRITE_CLIP_ROOM(40px 클립 여유) 전부 삭제
   — 고강도 발광이 클립에 잘리던 한계도 함께 사라졌다.
2. **자소 단위 분해 통일**: `[...str]`은 국기·가족(ZWJ)·FE0F를 조각냈다 — Intl.Segmenter
   기반 `graphemesOf`로 타자·스르륵·쓰기·발광 사본을 통일(미지원 옛 브라우저는 기존과 같은
   코드포인트 분해로 후퇴). GlowText의 수동 FE0F 짝짓기 로직도 이걸로 단순화.

**검증**: format·typecheck·renderer-units·lint·단위·통합·build·e2e 전부 green (쓰기 효과
e2e는 창·잉크 4상자 → 글자 7상자·canvas-fade-in 단언으로 갱신).

## ADR-055. RSVP 동의 체크박스 제거 (스키마 불변, DB 마이그레이션 20260723030000)

**Context**: "개인정보 수집 체크버튼 그냥 없애 — 그거 있어서 오히려 사람들이 안 남길 것
같다. 많이 남기는 게 목적이다." 필수 체크가 제출 문턱이 되어 응답을 막는다는 판단.

**Decision**: 동의 단계를 계약에서 제거한다 — 개인 청첩장의 소규모 수집이고, 수집 항목
안내는 폼 문안(예: "신랑·신부에게만 보입니다")이 맡는다.
- 폼: 체크박스 삭제. zod: `consent` 필드 삭제(구버전 폼이 보내오는 consent는 스키마 밖
  키로 그냥 버려진다). API: `p_consent` 전달 중단.
- DB: `consented_at` not null 해제(과거 행의 기록으로만 남는다 — null = 동의 단계가 없어진
  뒤의 응답). `submit_rsvp`는 **같은 시그니처에 `p_consent default null`로 교체** — 동의
  검사·consented_at 기록을 뺐고 파라미터는 무시된다. **DB를 먼저 밀어도(권장 순서) 아직
  배포 전인 구버전 폼이 계속 접수되는 무중단 설계**다. 파라미터 제거는 다음 마이그레이션.

**검증**: 단위(스키마)·통합(신·구 호출 형태 모두 로컬 DB 대조)·e2e(체크 없는 제출 → 성공
·수정·마감 흐름) green. **프로덕션 적용 순서: `supabase db push` 먼저, 그 다음 배포.**

## ADR-056. 떠 있는 공유 버튼 — 항상 표시에서 '스크롤 때 잠깐'으로 (렌더러만)

**Context**: 알약 버튼이 항상 떠 있어 첫 화면(메인 사진)을 가렸다. "스크롤할 때 잠깐
생기고 최상단에서는 페이드아웃으로 사라지게."

**Decision**: 최상단(스크롤 ≤8px, iOS 고무줄 떨림 흡수)에서는 숨김, 스크롤 동작 중 +
1.8초까지 표시 후 페이드아웃(0.5s). 판이 열려 있는 동안은 유지. scroll은 버블링하지
않으므로 **document 캡처 리스너 하나**로 창(발행 화면)·미리보기 칸(편집기) 어느 스크롤도
잡되, 버튼을 품지 않은 스크롤(편집기 다른 패널)은 무시한다. 숨김은
`opacity + visibility` 동시 전환 — 사라진 뒤에는 탭·포커스가 닿지 않고, 전환 중에는
페이드가 보인다. 서버 렌더·JS 없음 상태는 숨김으로 시작(공유 동작 자체가 JS 필요).

**검증**: e2e — 최상단 hidden → 스크롤 시 visible → 클릭 흐름(느린 러너 대비 재시도
패턴) green. 스크린샷에서 첫 화면에 버튼이 사라진 것 확인.

## ADR-057. 인사말 라벨 위 장식 이미지 (스키마 v19)

**Context**: 인사말 머리(눈썹 라벨 위)에 초대장풍 리본을 얹고 싶다는 요청. 내장 SVG
리본을 시안했으나 "이미지는 내가 직접 넣을게 — 라벨 위에 이미지를 추가하는 기능을 달라"로
확정.

**Decision**: `greeting.content.ornamentAssetId`(nullable) + `ornamentHeightPx`
(16~240px, 기본 56) 추가 — **스키마 v19**.
- 렌더러: 세 variant 모두 눈썹 라벨 위에 그린다. 크기는 높이 한 손잡이 — 폭은 원본
  비율을 따라오고, 캔버스를 넘치면 max-width가 잡되 object-contain으로 비율을 지킨다
  (장식은 crop보다 여백 — venueMap과 같은 결, frame 없음). width/height 속성을 원본
  크기로 적어 로딩 전 레이아웃 밀림 방지. 편집기에 '장식 이미지 높이' 입력(이미지가
  있을 때만 표시).
- 액션: `greetingOrnament` slot(assign·remove) — 사진 보관함 픽커 재사용, undo 가능.
- 참조 무결성: `referencedAssetIds`에 합류 — 발행 payload 포함·삭제 경고·고아 정리가
  같은 목록을 쓴다(Supabase storage 예산 제약 준수).
- 마이그레이션 v18→19: 기존 문서는 null(없음)·기본 높이 — 열었을 때 모습 불변.
  openability에 v18 문서 케이스 추가(새 필드를 마이그레이션에 안 넣는 v12 사고 재발
  방지). 높이 필드는 v19가 배포 전이라 새 버전 없이 v19에 합쳤다 — 한 번 나간 버전의
  모양은 바꾸지 않는다는 규칙은 '나간 뒤'에만 적용된다.

**검증**: 단위 289(openability v18 포함)·통합 34·build·e2e 95(업로드→라벨 위 표시→제거
e2e 신규) 전부 green.

## ADR-058. 스키마 v20 — 전이 v19 치유 (v14 사고의 재발과 교훈의 확장)

**Context**: v19(장식 이미지)를 배포 전에 확장하며 `ornamentHeightPx`를 "v19는 아직 안
나갔으니까"라는 판단으로 **버전을 안 올리고 v19에 합쳐 넣었다**. 그러나 그 사이 로컬
DB(e2e·dev 서버)에는 이미 높이 없는 v19 문서가 저장돼 있었다 — 버전이 이미 최신(19)이라
마이그레이션이 손대지 못하고, 스키마 검증(`ornamentHeightPx` required)에서 **문서가 열리지
않았다**. v14 전이 사고와 동일 패턴의 재발.

**Decision**: **v20으로 올리고 19→20 마이그레이션이 빠진 칸을 기본값으로 채운다**(있는
값은 spread 보존). 교훈을 넓힌다: *"한 번 나간 버전의 모양은 바꾸지 않는다"의 '나갔다'에는
프로덕션뿐 아니라 로컬 DB·e2e가 저장한 것도 포함된다.* 어떤 저장소든 그 버전으로 문서를
한 번이라도 저장했으면, 필드를 늦게 추가할 때는 무조건 버전을 올린다. 프로덕션은 이 전이
모양을 저장한 적이 없어(배포 시점 코드는 이미 완전한 v19) 영향이 없다 — 프로덕션 문서는
v18 이하였고 18→19가 두 필드를 함께 채운다.

**검증**: openability에 전이 v19 케이스 추가(단위 290)·통합 34·build·e2e 95 green.
실제로 열리지 않던 로컬 DB의 전이 v19 발행 스냅샷을 dev 서버로 서빙해 정상 렌더 확인.

## ADR-059. 글자 페이드의 '덧칠' 제거 — 발광 사본 정지 환원 + 잉크 글자 상시 승격 (렌더러만)

**Context**: ADR-054 후에도 iOS 실기기에서 "글자마다 스르륵(letterFade) + 필기체" 조합이
"테두리 두께가 처음에 불완전하게 그려졌다가 뚝뚝거리며(여러 번 덧칠하며) 완성"됐다.
꽃잎·전체 프레임은 문제없다는 사용자 확인 — 글자 자체의 렌더가 단계적으로 변하는 문제다.

**원인**: 글자 하나가 **세 장의 독립 레이어**(잉크 + 발광 심 + 발광 무리, ADR-054가 발광
사본도 글자별 시차로 움직이게 함)로 각각 페이드되는 구조.
1. 발광 사본 레이어는 그림자 반경만큼 커서(최대 60px 번짐 × 3배 해상도) 래스터가 늦게
   도착한다 — 잉크가 먼저, 심·무리가 프레임 차이를 두고 '한 겹씩' 얹혔다.
2. 글자마다 페이드가 45ms 시차로 끝나고, iOS는 끝난 레이어를 강등하며 부모 레이어에 다시
   그린다 — 이 재래스터가 획 렌더를 미세하게 바꿔 글자를 따라 '탁탁' 완성되는 스냅이 됐다.
얇은 필기체는 부분 투명 상태가 '두께 불완전'으로 읽혀 증상이 가장 도드라졌다.

**Decision**:
1. **발광 사본은 정지 픽셀로 환원** — GlowText 정지 사본 + 층 전체가 등장 총 시간에 맞춰
   불투명도로 차오른다(totalEntranceMs 복원, ADR-045의 원형). 가우시안 번짐은 게이트가
   잡아 둔 한가한 때 한 번 구워지고 이후 픽셀이 변하지 않는다. 글자별 발광 레이어
   2N장과 그 강등 재페인트가 전부 사라진다. 숨쉬기(무한 애니메이션)가 발광 래퍼를 늘
   승격 상태로 유지하므로 발광 쪽 강등 스냅도 구조적으로 없다.
2. **잉크 글자 상자는 will-change: opacity로 상시 승격** — 페이드가 끝나도 강등·재래스터가
   없어 획 두께가 첫 래스터 그대로 유지된다. 래스터는 등장 게이트(ADR-049)가 잡아 둔
   한가한 시점에 한 번. 비용은 글자 수만큼의 소형 상주 레이어 — 사진 위 문구는 수십 자라
   감당 범위. prefers-reduced-motion에서는 will-change도 풀어 상주 레이어를 남기지 않는다.

원칙 갱신: "움직임은 transform/opacity, 번짐은 래스터에 굽고(ADR-052), 시작은 한가할 때
(ADR-049)"에 더해 — **글자처럼 렌더가 민감한 픽셀은 애니메이션 수명 동안 레이어를
오르내리게 하지 않는다(승격 고정), 큰 번짐 사본은 아예 움직이지 않는 한 장으로 둔다.**

**검증**: typecheck·renderer-units·단위 290·build·e2e 95 전부 green (발광 사본이 정지로
돌아가며 DOM 애니메이션 수가 줄었지만 e2e 단언은 잉크 글자 기준이라 불변).

## ADR-060. 글자별 등장을 opacity에서 '잉크색'으로 — 승격 자체가 잘림의 뿌리 (ADR-059 교체, 렌더러만)

**Context**: ADR-059(will-change 상시 승격) 배포 후 "오히려 글자가 잘리는 부분이 생겼다 —
레이어 일부가 표시가 안 되는 것 같다". 이 증상이 원래 문제의 진짜 뿌리를 드러냈다.

**원인**: **글자 하나를 합성 레이어로 만드는 것 자체.** iOS WebKit은 인라인 글자 상자
레이어의 그림 범위를 상자 크기(글꼴 메트릭 기준)로 잡는데, 필기체 글리프의 획은 자기
상자 밖 — 옆 글자 영역, 메트릭 바깥 스와시 — 까지 뻗는다. 승격되는 순간 그 부분이
잘린다. ADR-059 전에는 페이드 동안(임시 승격)만 잘렸다가 끝나고 강등되며 부모 레이어에
온전한 글리프로 다시 그려졌다 — 그 복원이 글자마다 시차를 두고 일어난 것이
"덧칠하며 두께가 완성"의 실체였고, 상시 승격은 잘림을 영구로 만들었을 뿐이다.

**Decision**: 글자별 등장을 **opacity가 아니라 color(잉크색) 애니메이션**으로 바꾼다
(`canvas-ink-in`: `from { color: transparent; text-shadow: none }`, to 없음 — 문서가 고른
색·그림자가 목적지). 색은 합성기 대상이 아니라 **글자 레이어가 아예 생기지 않는다** —
글리프는 부모 레이어에 통째로(잘림 없이) 그려진 채 색만 차오른다. 잘림·늦은 래스터·
강등 스냅·덧칠이 전부 구조적으로 불가능해진다. 메인 스레드 페인트지만 글리프 크기의
칠이고, 등장 게이트(ADR-049)가 한가한 시점을 보장한다 — "합성기 전용"(ADR-044) 원칙의
정련: *움직임(transform)은 합성기로, 글자처럼 상자를 넘치는 픽셀의 '드러남'은 페인트로.*
- 컬러 이모지는 color가 안 먹으므로(내장 색, ADR-053과 같은 이유) opacity 페이드 유지 —
  네모 비트맵이라 상자 밖 획·얇은 획이 없어 레이어로 떠도 부작용이 없다.
- ADR-059의 will-change 상시 승격은 제거(원인 제공자였다). 발광 정지 사본 환원은 유지 —
  글자별 발광 레이어의 덧칠 문제는 그것대로 실재했다.

**검증**: typecheck·renderer-units·단위 290·build·e2e 95 green (쓰기 효과 단언
canvas-fade-in → canvas-ink-in 갱신).

## ADR-061. iOS 음량 조절 — AudioSession "playback" + GainNode (ADR-050의 벽 해소, 렌더러만)

**Context**: "기기 음량이 어떻든 그 대비로 이 곡이 몇 % 크기로 들릴지"를 만든 사람이
정하고 싶다 — 재생 속도처럼 어디서나 일괄로. 확인 결과 volume 무시는 **아이폰만이다**
(애플 공식 정책: "iOS에서 오디오 레벨은 항상 사용자의 물리적 제어 아래 있다" — iOS의
모든 브라우저가 WebKit이라 동일). PC·안드로이드는 element volume을 이미 따른다.
파일 자체를 재인코딩해 굽는 방식은 같은 결과에 비용만 크다: 손실 압축 2회(음질),
슬라이더 변경마다 재처리·재업로드(Supabase 저장소·전송량 제약), 즉시 미리듣기 상실.
재생 시점의 신호 감쇠(GainNode)가 수학적으로 동일한 일을 공짜로 한다.

**결정적 변화**: ADR-050(WebAudio 감쇠)을 폐기시킨 유일한 벽 — iOS에서 WebAudio 출력이
무음 스위치에 묶이는 것 — 을 **AudioSession API가 공식으로 푼다**:
`navigator.audioSession.type = "playback"` (Safari 16.4+, 2023-03, 기본 활성). <audio>가
원래 속하던 '미디어 재생' 범주를 WebAudio에도 열어 무음 스위치와 분리된다.

**Decision**: 두 경로의 점진적 향상.
- 기본: element volume(세제곱 곡선 ADR-047) — PC·안드로이드·구형 iOS(≤16.3, 재생만 되고
  음량 조절 없음 — 기존과 동일).
- `navigator.audioSession` 존재 시(Safari): type="playback" 지정 후 AudioContext+GainNode
  그래프. 감쇠는 gain이 맡고 element volume은 1(이중 감쇠 방지).
- **suspended 그래프 사고 방지** (ADR-050의 교훈): createMediaElementSource는 되돌릴 수
  없으므로 '실행 중' 컨텍스트를 확보한 뒤에만 그래프를 만든다. 제스처 밖(자동재생)에서
  컨텍스트가 안 열리면 그래프 없이 물러난다 — iOS 첫 재생은 어차피 제스처에서 성사되므로
  소리가 나는 첫 순간에는 감쇠가 걸려 있다. 전화·백그라운드 중단은 visibilitychange에서
  resume. 그래프 생성 실패는 조용히 element 경로 유지 — 재생 신뢰성 > 음량 (ADR-051 우선순위).
- 부작용 수용: "playback" 세션은 배타적이라 하객이 듣던 다른 앱 미디어를 멈춘다 —
  현행 <audio> 재생도 iOS에서 이미 오디오 포커스를 가져가므로 실질 변화 아님.

**검증**: typecheck·단위 290·build·e2e 95 green (Chromium은 audioSession이 없어 기존
element volume 단언이 그 경로를 검증). Safari 경로는 실기기 확인 필요: 무음 스위치
ON/OFF × 음량 30↔70% 차이 × 다른 앱 재생 중 시나리오.

## ADR-062. ADR-061 철회 — iOS 소프트웨어 음량은 미지원으로 확정 (렌더러만)

**Context**: ADR-061(AudioSession + GainNode) 배포 직후 실기기(iPhone)에서 **소리가 깨지고
(왜곡), 음량 100%에서는 아예 무음**. 코드의 수학(감쇠 1.0 = 통과)에는 100%를 특별하게
만드는 것이 없다 — 증상은 우리 로직이 아니라 iOS WebKit의
`createMediaElementSource`(미디어 엘리먼트를 WebAudio 그래프로 라우팅) 구현 자체가
신뢰 불가라는 실측 증거다(라우팅된 엘리먼트의 왜곡·무음은 알려진 WebKit 버그 계열).

**Decision**: MusicToggle·안내문·e2e 주석을 ADR-051 상태(313228f)로 정확히 복원한다.
iOS 소프트웨어 음량 조절은 **미지원으로 확정**한다 — 모든 경로를 실측·검토했다:
- element.volume — 애플 정책으로 무시 (ADR-051에서 확인)
- MediaElementSource + GainNode — 무음 스위치 결합(ADR-050, 실기기 무음) →
  AudioSession으로 풀었더니 왜곡·무음(ADR-061, 실기기). 두 번의 실기기 실패.
- AudioBufferSource + GainNode — 재생 속도가 피치를 바꿔 버린다(엘리먼트의
  preservesPitch가 없다) + 전곡 PCM 메모리(수십 MB). 기능 회귀라 제외.
- 파일 재인코딩(음량 굽기) — 유일하게 남은 경로. 손실 압축 2회(음질)·슬라이더마다
  재처리와 재업로드(Supabase 예산)·즉시 미리듣기 상실이라 보류. 필요해지면 이것뿐이다.

원칙 재확인: **예식일에 BGM은 무조건 나와야 한다 — 재생 신뢰성 > iOS 음량**(ADR-051).
아이폰은 기기 음량 버튼을 따른다(안내문 유지). PC·안드로이드는 슬라이더가 계속 작동한다.

**검증**: 복원은 git 원본 대조(313228f)로 정확성 보장. typecheck·단위·build·e2e green.
