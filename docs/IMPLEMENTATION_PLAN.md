# IMPLEMENTATION_PLAN — 모바일 청첩장 빌더

- 문서 버전: 1.0 (2026-07-16)
- 전략: **vertical slice** — 각 슬라이스는 UI→도메인→저장소를 관통하고, 끝나면 실제로 시연 가능한 상태로 배포·데모한다. 수평 레이어(예: "DB 전부 먼저")로 자르지 않는다.

## 1. 진행 규칙

- 한 슬라이스 안에서도 "Make it work → Make it right" 순서로 진행하고, 다음 슬라이스 시작 전에 필요한 정돈(Tidy First)을 별도 커밋으로 처리한다.
- 슬라이스 완료 시: 공통 DoD(§5) 통과 → 데모 → [CURRENT_STATE.md](./CURRENT_STATE.md) 갱신 → 다음 슬라이스 범위 확정.
- 스키마·action 등 도메인 코어는 VS1에서 골격을 세우고 각 슬라이스에서 섹션 타입만 증분 추가한다 (schemaVersion은 MVP 동안 1 유지 목표 — 필드 추가는 optional로).

## 2. 슬라이스 맵

| VS | 이름 | 사용자 가치 (데모 문장) | 의존 |
|----|------|--------------------------|------|
| **VS1** | 걸어다니는 뼈대 | "가입해서 청첩장을 만들고, 문구를 고치고, 되돌리고, 발행해서 폰으로 열어본다" | — |
| VS2 | 섹션 오케스트레이션 | "섹션을 추가·정렬·숨김·복제·삭제하고 예식 정보/지도를 채운다" | VS1 |
| VS3 | 사진 파이프라인 | "사진을 올려 Hero와 갤러리를 꾸민다" | VS2 |
| VS4 | 연락처·마음 전하실 곳 | "전화·계좌·영상 섹션을 채운다 (sensitive 체계 가동)" | VS2 |
| VS5 | RSVP | "하객이 참석 여부를 남기고, 나는 집계를 본다" | VS2 |
| VS6 | 테마·스타일·모션 | "테마·폰트·여백·애니메이션으로 분위기를 바꾼다" | VS2 (일부 VS3) |
| VS7 | 공유·발행 완성도 | "카톡에서 예쁘게 미리보기되고 공유 버튼이 동작한다" | VS3 |
| VS8 | AI 편집 v1 | "채팅으로 '인사말을 따뜻하게 고쳐줘'가 undo 가능한 편집으로 동작한다" | VS2, VS4 |

의존이 없는 조합(예: VS4와 VS5)은 순서 조정 가능. 기본 순서는 위 표기 순.

## 3. VS1 — 걸어다니는 뼈대 (첫 번째 vertical slice)

### 목표
아키텍처의 위험한 결정 전부(문서 모델, typed action, undo/redo, 단일 renderer, 자동저장, 발행 스냅샷)를 **가장 얇은 두께로 관통**해 검증한다. 섹션은 Hero(텍스트 variant)와 Greeting 2종, 편집은 텍스트 필드만.

### 포함 범위
- 프로젝트 스캐폴드: Next 16 + TS 5.9 strict + Tailwind 4 + ESLint(boundaries) + Vitest + Playwright, `env.ts` fail-fast 검증, git 저장소 초기화
- Supabase: 프로젝트 생성, `projects`·`publications` 테이블 + RLS, Auth 이메일+비밀번호
- 라우트: `/login` `/signup` `/projects`(목록+생성) `/editor/[id]` `/i/[slug]`
- 문서 스키마 v1 골격 + hero/greeting content 스키마 + fixtures
- action: `updateSectionContent`, `updateWedding` + dispatcher + Immer patch 히스토리 (coalescing 포함)
- 편집기 셸: 상단바(프로젝트명·저장상태·undo/redo·발행), 좌측(고정 항목 "기본 정보" + 섹션 2개 목록 — 조작 기능 없음), 중앙(renderer + 폭 토글), 우측(hero/greeting/기본 정보 폼)
- 자동저장(1.5s 디바운스, rev CAS) + 발행 server action + `/i/[slug]` 태그 캐시 렌더 + 기본 OG 태그(텍스트만)

### 제외 (이후 슬라이스)
사진 업로드, 섹션 추가/정렬/숨김/복제/삭제, 테마·디자인 탭, 프리뷰 모드 토글(인터랙션 요소가 아직 없음 — VS3에서 도입), RSVP, 지도, `/preview/[id]`(발행으로 대체 가능하므로 VS2로)

### Acceptance Criteria

**AC1 — 온보딩과 프로젝트 생성**
- Given 미가입 사용자가 `/signup`에서 이메일+비밀번호로 가입하면, When `/projects`에서 "새 청첩장"을 만들면, Then 기본 문서(Hero+Greeting, fixture 기본값)가 생성되고 `/editor/[id]`로 이동한다.
- 타인의 `projectId`로 `/editor/[id]` 접근 시 데이터가 조회되지 않는다(RLS) — E2E로 검증.

**AC2 — 실물 미리보기**
- 중앙에 Hero(textOnly variant)와 Greeting이 기본 테마(ivory)로 렌더된다.
- 360/390/430px 폭 전환이 동작하고, 세 폭 모두에서 레이아웃이 깨지지 않으며 실제 스크롤이 동작한다.

**AC3 — 직접 편집 → 즉시 반영**
- Hero 또는 좌측 "기본 정보" 선택 → 우측 폼에서 신랑·신부 이름, 예식 일시, 예식장 이름을 수정하면 미리보기에 다음 프레임 내(체감 즉시, 300ms 이내) 반영된다.
- Greeting 본문의 개행이 미리보기에 그대로 보존된다.
- 모든 수정은 typed action으로 dispatch된다 — dev 모드 action 로그(콘솔 또는 디버그 패널)로 확인 가능.

**AC4 — undo/redo**
- `⌘Z`/`⇧⌘Z`(Windows Ctrl)와 상단바 버튼이 동작한다.
- 한 필드의 연속 타이핑은 1개의 undo 스텝으로 병합된다(coalescing). 서로 다른 필드 편집은 별도 스텝.
- 최소 50스텝 이상 되돌릴 수 있다(구현 한도 100). redo 후 새 편집 시 redo 스택이 비워진다.
- 단위 테스트: 임의 action 시퀀스에 대해 undo 전량 적용 시 초기 문서와 동일(property test).

**AC5 — 자동저장과 복원**
- 마지막 입력 1.5초 후 자동 저장되고 상단바가 `저장 중…`→`모든 변경사항 저장됨`으로 전환된다.
- 새로고침 시 마지막 저장 상태가 복원된다.
- 같은 프로젝트를 두 탭에서 열고 양쪽에서 수정하면, 늦은 쪽 저장이 거부되고 "다른 탭에서 수정됨" 경고가 표시된다(rev CAS). 데이터가 조용히 덮어써지지 않는다.
- 저장 실패(네트워크 차단) 시 `저장 실패 — 재시도`가 표시되고 재시도로 복구된다.

**AC6 — 발행과 공개 페이지**
- "발행하기" → 검증(신랑·신부 이름/일시/장소 필수) 통과 시 slug URL이 표시되고 복사할 수 있다. 필수값 누락 시 무엇이 빠졌는지 명시한 오류를 보여주고 발행되지 않는다(fail fast).
- 로그아웃 상태의 모바일 뷰포트에서 `/i/[slug]` 접속 시 발행 시점 문서가 렌더된다.
- 발행 후 draft를 수정해도 공개 페이지는 변하지 않고, 재발행하면 같은 URL에서 갱신된다.
- 존재하지 않는 slug는 404. 페이지에 `noindex` 메타와 OG 태그(제목·일시)가 포함된다.

**AC7 — 단일 renderer 보증**
- `/editor`의 미리보기와 `/i/[slug]`가 동일한 `renderer` 모듈을 import한다.
- `renderer/`는 `editor/`·`server/`를 import하지 않는다 — eslint-plugin-boundaries가 CI에서 강제하고, 위반 시 lint 실패.
- `renderer/` 내 `vw|vh|@media` 사용이 없다(grep 검사 스크립트).

**AC8 — 품질 게이트**
- `npm run typecheck` / `lint` / `test` / `test:e2e` 모두 green.
- Vitest: 스키마 검증, applyAction/undo 왕복, coalescing, 발행 검증 규칙 커버.
- Playwright: "가입→생성→이름 수정→undo→redo→발행→로그아웃 모바일로 공개 페이지 확인" 1개 여정 green.
- 유효하지 않은 문서(zod 실패)를 저장·발행하려 하면 명시적 에러가 발생한다 — silent failure 없음.

**AC9 — 성능 스모크 (soft target)**
- 프로덕션 빌드의 `/i/[slug]`를 모바일 4G 스로틀로 Lighthouse 측정, LCP ≤ 2.5s. 미달 시 차단하지 않되 원인과 수치를 CURRENT_STATE에 기록하고 VS7에서 해소.

## 4. VS2–VS8 요약 범위와 AC 스케치

각 슬라이스 착수 시 이 절을 VS1 수준으로 상세화한다.

### VS2 — 섹션 오케스트레이션
- 범위: 좌측 패널 완성(추가 카탈로그·pragmatic-dnd 정렬·숨김·복제·삭제 + undo), 나머지 action 8종, Calendar·Venue(Kakao 지도)·Transportation·Closing 렌더러+폼, `/preview/[id]`, 프리뷰 선택 동기화(편집 모드 클릭 선택)
- AC 스케치: 드래그 정렬이 undo되는가 / hero 이동·삭제가 거부되는가 / 숨긴 섹션이 공개 페이지에서 빠지는가 / 지도 키 누락 시 기동 실패(fail fast)하는가

### VS3 — 사진 파이프라인
- 범위: PhotoPicker 업로드(클라 재인코딩·EXIF 제거·진행률), `assets`+Storage RLS, resolveAsset 변환 URL, Hero photo variant, Gallery(grid2/grid3/carousel·라이트박스·30장 제한·드래그 정렬), Couple Profile, 프리뷰 편집/인터랙션 모드 토글
- AC 스케치: 업로드 사진에서 EXIF/GPS가 제거되는가(테스트 fixture로 검증) / 31번째 사진이 명시적으로 거부되는가 / 캐러셀이 인터랙션 모드와 공개 페이지에서 동일 동작하는가 / CLS ≤ 0.1

### VS4 — 연락처·마음 전하실 곳·영상
- 범위: Contacts·GiftAccount(ListEditor·아코디언·복사 토스트)·Video(YouTube embed), zod `sensitive` 메타 + `redactForAI` 구현·단위 테스트(AI 연결 전이지만 체계 가동)
- AC 스케치: 계좌 복사 버튼이 모바일에서 동작하는가 / redactForAI 결과에 전화·계좌·카카오페이 링크·사진 URL이 등장하지 않는가(속성 테스트)

### VS5 — RSVP
- 범위: RSVP 섹션 폼(동의 포함), `POST /api/rsvp` + RLS(`rsvp_open`), 허니팟·일일 상한, `/projects/[id]/rsvp` 집계·목록·CSV·삭제
- AC 스케치: 발행 중단·마감 후 제출이 거부되는가 / 동의 없이 제출 불가한가 / 응답이 문서·AI 컨텍스트 어디에도 섞이지 않는가 / 소유자만 열람 가능한가(RLS E2E)

### VS6 — 테마·스타일·모션
- 범위: 테마 프리셋 4종·폰트 페어 2종·색 오버라이드(대비 경고), 디자인 탭(variant·paddingY·배경·애니메이션), IntersectionObserver 진입 모션, reduced-motion
- AC 스케치: 테마 전환이 전 섹션에 즉시 적용되고 undo되는가 / reduced-motion에서 애니메이션이 제거되는가

### VS7 — 공유·발행 완성도
- 범위: OG 이미지 자동 생성(`next/og`: 대표 사진+이름+일시), 카카오 SDK 공유 버튼, 발행 검증 고도화(경고 단계), 발행 중단 UI, 성능 예산 실측·달성(LCP·JS 예산), (여유 시) 카카오 OAuth
- AC 스케치: 카카오톡 실기기 공유 미리보기에 사진·제목이 뜨는가 / Lighthouse 예산 통과

### VS8 — AI 편집 v1
- 범위: provider 선정 재조사 → ADR 갱신 → 편집기 AI 패널(채팅), redactForAI 프로젝션 전달, `z.toJSONSchema` 기반 tool 정의로 action 산출, 실패 시 명시적 거부 응답, 결과 하이라이트
- AC 스케치: "인사말을 격식 있게 3문장으로" → updateSectionContent action → undo 1회로 원복되는가 / sensitive 값이 요청 페이로드에 없는가(네트워크 레벨 테스트) / 사용자가 발화에 포함한 계좌번호는 반영되는가

## 5. 공통 Definition of Done (모든 슬라이스)

- [ ] `typecheck`·`lint`(boundaries 포함)·`test`·`test:e2e` green
- [ ] 새 action·스키마 변경에 단위 테스트 동반, undo 왕복 테스트 갱신
- [ ] 렌더러 변경 시 360/390/430 3폭 수동 확인
- [ ] silent failure·암묵 기본값·하드코딩 설정값 없음 (development.md 원칙)
- [ ] CURRENT_STATE.md 갱신 + 데모 시나리오 1개 기록
- [ ] 사용된 assumption이 뒤집혔으면 PRODUCT_SPEC §13·DECISIONS 갱신

## 6. 리스크 레지스터

| ID | 리스크 | 영향 | 완화 |
|----|--------|------|------|
| R-1 | pragmatic-dnd의 headless 특성으로 정렬 UI 구현량 증가 | VS2 지연 | `editor/dnd` 어댑터로 격리, 리스트 1종에만 사용. 어댑터 뒤 교체 가능 (ADR-008) |
| R-2 | renderer 단위 규칙(vw/@media 금지) 위반 유입 | 미리보기≠실물 | grep CI + 코드리뷰 체크. 반복 위반 시 iframe 프리뷰로 전환 (ADR-004의 예비안) |
| R-3 | RLS 정책 실수로 데이터 노출 | 개인정보 사고 | 정책을 마이그레이션 파일로 버전 관리, E2E에 "타인/anon 접근 거부" 시나리오 상시 포함 |
| R-4 | Kakao 키 발급·도메인 등록 지연 | VS2 지연 | VS1 진행 중 미리 신청 (CURRENT_STATE 대기 항목) |
| R-5 | TS 7 / Next 신버전 유혹으로 도구 체인 불안정 | 전반 | 버전 고정 + ADR-010 재평가 조건 충족 시에만 업그레이드 |
| R-6 | 한글 웹폰트 용량으로 LCP 미달 | 성능 목표 | VS1에서 서브셋 실측(AC9), 필요 시 unicode-range 분할 |
| R-7 | 예식 당일 트래픽 스파이크 | 공개 페이지 다운 | 태그 캐시로 DB 비의존 (ARCHITECTURE §8), VS7에서 부하 스모크 |
| R-8 | RSVP 스팸 | 데이터 오염 | 허니팟+상한 (A-17), 초과 시 캡차 앞당김 |
