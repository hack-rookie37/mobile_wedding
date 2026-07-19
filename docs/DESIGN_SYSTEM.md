# DESIGN_SYSTEM — 모바일 청첩장 빌더

- 문서 버전: 2.0 (2026-07-16, Phase 3 테마 시스템 반영)
- 구현 매체: Tailwind CSS 4 + CSS 변수 토큰. 테마 정의의 단일 소스는 `src/invitation/schema/themes.ts`이며, 이 문서는 그 정의의 설명서다. 값이 갈리면 코드가 진실이다.

## 1. 디자인 원칙

1. **두 세계의 분리** — `--tool-*`(편집기, 고정 중립)과 `--canvas-*`(청첩장, 테마 주입) 네임스페이스를 분리한다. 렌더러는 `--canvas-*`만 참조한다.
2. **테마 = 토큰 + variant** — 테마는 CSS 변수 토큰과 섹션 표현(variant) 선택만 바꾼다. 문구·사진·섹션 순서·표시 여부에는 절대 관여하지 않는다 (ADR-014).
3. **한글 타이포그래피가 곧 장식** — 과한 그래픽 대신 서체·행간·자간·여백으로 표현한다. 꽃 장식·장식 아이콘 남용 금지.
4. **모바일 실측 우선** — 모든 치수는 360px 최소 폭에서 검증한다 (테마 × 360/390/430 스크린샷 게이트).
5. **절제된 모션** — 스크롤 진입 시 1회. `prefers-reduced-motion`은 JS `matchMedia`로 감지해 항상 존중한다 (렌더러 내 미디어 쿼리 금지 규칙과 병립).

## 2. 테마 시스템 (Phase 3 확정, ADR-014)

### 2.1 라인업과 추천

| 역할 | 테마 | 성격 |
|------|------|------|
| **기본 추천** | `warm-editorial` 웜 에디토리얼 | 따뜻한 ivory + 절제된 세리프 + 넉넉한 수직 리듬. 가장 넓은 취향을 커버하는 안전한 기본값 |
| **감성적인 대안** | `film-diary` 필름 다이어리 | 폴라로이드 프레임·손글씨 캡션·스탬프형 날짜. 개인 앨범을 넘기는 감각 |
| **현대적인 대안** | `modern-monochrome` 모던 모노크롬 | 백·회·흑, 번호 라벨과 hairline, 스펙시트형 정보 행. 구조적이고 도시적 |

### 2.2 테마 토큰 표

| 토큰 | warm-editorial | modern-monochrome | film-diary |
|------|----------------|-------------------|------------|
| `--canvas-paper` | `#FAF7F1` | `#FFFFFF` | `#F8F4EA` |
| `--canvas-ink` | `#221D16` | `#141414` | `#3A352C` |
| `--canvas-ink-soft` | `#6E6659` | `#6E6E6E` | `#7C7466` |
| `--canvas-accent` | `#A6795B` | `#141414` | `#8C7A5B` |
| `--canvas-line` | `#E7E0D4` | `#E4E4E4` | `#E4DCCB` |
| `--canvas-font-heading` | Noto Serif KR | 시스템 산스(Pretendard 스택) | Noto Serif KR |
| `--canvas-font-hand` | (미사용) | (미사용) | Nanum Pen Script |
| `--canvas-radius-photo` | `10px` | `0px` | `2px` (폴라로이드 내부) |
| `--canvas-pad-sm/md/lg` | `56/88/120px` | `44/68/92px` | `52/80/108px` |
| `--canvas-motion-duration` | `700ms` | `0ms` (모션 없음) | `800ms` |
| `--canvas-rise-distance` | `12px` | — | `16px` |

대비 규칙: `ink`/`paper` ≥ 12:1, `ink-soft`/`paper` ≥ 4.5:1. accent는 라벨·장식·큰 글자 전용.

### 2.3 테마 variant 표

| variant 축 | warm-editorial | modern-monochrome | film-diary |
|-----------|----------------|-------------------|------------|
| header | `editorial` 중앙 라벨+세리프 | `mono` 번호(01)+라벨+hairline, 좌측 | `film` 손글씨 소문자 라벨 |
| hero | `editorial` 아치 사진, 중앙 세리프 이름 | `mono` 스택형 볼드 이름(&), 풀폭 사각 사진, 메타 행 | `film` 기울인 폴라로이드, 손글씨 태그라인, 스탬프 날짜 |
| greeting | `editorial` 중앙, hairline 구분 혼주 | `mono` 신랑측/신부측 테이블 행 | `film` 점선 구분 + 중앙 혼주 |
| gallery | `editorial` 균일 그리드, soft radius | `mono` 1px 거터 그리드, radius 0 | `film` 폴라로이드 + ±1.6° 순환 틸트 + 손글씨 캡션(grid2·carousel·1장) |
| venue | `editorial` 중앙 세리프 | `mono` 장소/주소/일시/연락처 정의 행 | `film` 좌측 일기형 + 점선 구분 |
| sectionDivider | 없음 | 섹션 상단 hairline | 없음 |
| photoTreatment | `plain` | `plain` | `polaroid` (백색 프레임+그림자) |

### 2.4 두 개의 variant 축 (혼동 금지)

- **`section.layout.variant`** — 문서에 저장되는 **콘텐츠 레이아웃**. 사용자가 편집기에서 선택하고 테마와 무관하게 보존된다.
  - hero: `photoFull` / `photoArch` / `textOnly`
  - greeting: `default` · venue: `default`
  - gallery: `grid2` / `grid3` / `carousel`
- **테마 variant** — 테마 정의가 선택하는 **표현 방식**(`editorial`/`mono`/`film`). 렌더러 섹션 컴포넌트가 이 이름으로 마크업만 분기하며, 데이터 준비·포맷 로직은 공유한다.
- 갤러리 사진 1장인 경우는 테마와 무관하게 단일 대형(4:5)으로 렌더 (공유 로직).

## 3. 타이포그래피

### 서체 (모두 무료/OFL — 상용 가능)

| 서체 | 용도 | 로딩 |
|------|------|------|
| Pretendard 계열 시스템 스택 | 본문(전 테마), mono 헤딩 | `--font-sans` (globals.css) |
| Noto Serif KR 400/600 | editorial·film 헤딩 | next/font/google, preload off |
| Nanum Pen Script 400 | film 손글씨 — **작은 라벨·캡션에만**, 본문 사용 금지 | next/font/google, preload off |

TODO(VS6): Pretendard 서브셋 self-host 전환, 폰트 용량 실측.

### 캔버스 타입 스케일 (360px 기준, 주요 값)

| 역할 | editorial | mono | film |
|------|-----------|------|------|
| Hero 이름 | 26px serif semibold 중앙 | 34px sans bold 스택 | 23px serif + 16px 조사 |
| 섹션 제목 | 20px serif 중앙 | 17px sans bold 좌측 | 19px serif 좌측 |
| 섹션 라벨 | 11px tracking 0.18em accent | 10px tracking 0.22em + 번호 | 손글씨 22px lowercase |
| 본문 | 15px / 1.8 (공통 BodyText) | ← | ← |
| 메타/캡션 | 13–15px | 13.5px 정의 행 | 13px 스탬프(tabular-nums), 캡션 손글씨 16px |

한글 본문 행간 1.7 미만 금지, 최소 15px. `word-break: keep-all` 전역 적용.

## 4. 스페이싱과 리듬

- 4px 배수 스케일, 캔버스 가로 인셋 24px 고정.
- 섹션 상하 여백(`style.paddingY` sm/md/lg)은 **테마 토큰**(`--canvas-pad-*`)으로 해석 → 같은 문서라도 테마마다 pacing이 다르다 (§2.2 표).
- mono는 hairline sectionDivider로 섹션 경계를 명시하고, editorial·film은 여백만으로 호흡을 만든다.

## 5. 사진 처리 (PhotoFrame)

| 속성 | 값 |
|------|----|
| shape | `rect` / `soft`(radius 토큰) / `arch`(상단 반원) |
| treatment | `plain` / `polaroid`(백색 6px 프레임 + 그림자, film 전용) |
| 자리 예약 | 항상 `aspect-ratio` 지정 — CLS 방지 |
| 로드 실패 | broken 아이콘 대신 `--canvas-line` 톤 placeholder + "이미지 없음" (엣지 케이스 `missing-image`로 검증) |
| film 틸트 | `±0.7–1.6°` 4단계 순환 — 반응형 그리드 규칙 안에서 동작, 과한 스크랩북 장식 금지 |

## 6. 모션

- 진입 모션 = 섹션 `style.animation`(none/fade/rise) × 테마 토큰(duration·ease·distance).
- 트리거: IntersectionObserver 15% 노출 1회. mono는 duration 0으로 모션 자체가 없다(구조적 pacing).
- **reduced motion**: `matchMedia("(prefers-reduced-motion: reduce)")` 감지 시 즉시 표시 — e2e에서 뷰포트 밖 섹션 opacity=1로 검증.
- 편집기 도구 UI 모션은 120–200ms 기능적 전환만.

## 7. 렌더러 프리미티브 인벤토리

| 컴포넌트 | 역할 |
|----------|------|
| `SectionShell` | 테마 pad 토큰·배경·진입 모션·sectionDivider·편집 선택 오버레이 |
| `SectionHeader` | 라벨+제목 — header variant 3종 분기 |
| `BodyText` | 개행 보존 본문 (전 테마 공용) |
| `PhotoFrame` | shape/treatment/자리 예약/로드 실패 폴백 |
| `MetaRow` / `MetaList` | mono 스펙시트형 정보 행 (hero·venue 공용) |
| (예정 VS2+) | InfoRow, AccordionGroup, ActionButton, DdayCounter, CalendarGrid, Carousel, Lightbox, MapFrame |

프리미티브는 `--canvas-*` 토큰만 사용하고 전역 상태를 모른다. 데이터 포맷 헬퍼(`formatWeddingDate`, `formatDateStamp`, `parentsLineOf`)는 `renderer/format.ts`에 하나만 존재한다 — 테마별 복제 금지.

## 8. 편집기 UI 규격 (변경 없음 + 테마 패널)

- 좌측 264px / 우측 320px / 상단바 52px, 최소 뷰포트 1280×800.
- 좌측 전역 설정: **기본 정보 · 테마**. 테마 패널은 3개 카드(이름·설명·팔레트 스와치)로 선택, 전환은 `updateTheme` action → undo 가능.
- 컨트롤 인벤토리: TextField, TextAreaField, ToggleField, SegmentedField, FormSection, PhotoPicker(예정), ListEditor(예정), DragHandle, SaveStatus.

## 9. 접근성 체크리스트

- [x] 본문 대비 4.5:1↑ (테마 팔레트 규칙으로 담보)
- [x] `prefers-reduced-motion` 대응 (e2e 검증)
- [x] 사진 alt (갤러리 alt는 film 테마에서 캡션으로도 활용)
- [x] 헤딩 계층 h1(이름)/h2(섹션 제목)
- [ ] 터치 타깃 44px (전화 링크 등 — 인터랙션 섹션 추가 시 재점검)
- [ ] 아코디언·라이트박스 키보드 조작 (VS3+)

## 10. 네이밍 규칙

- 토큰: `--{world}-{role}` (`--canvas-ink`, `--tool-border`) — 색상값이 아니라 역할로 명명.
- 테마 id: kebab-case (`warm-editorial`). variant id: `editorial`/`mono`/`film`.
- 섹션 컴포넌트 `{Type}Section`, variant 분기는 내부 함수(`HeroMono` 등)로 캡슐화.
