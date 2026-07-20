# ARCHITECTURE — 모바일 청첩장 빌더

- 문서 버전: 1.0 (2026-07-16)
- 결정의 배경·대안은 [DECISIONS.md](./DECISIONS.md)의 ADR 참조. 제품 동작은 [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) 참조.

## 1. 시스템 개요

```
                         ┌──────────────────────────────┐
  제작자 (데스크톱)        │  Next.js 16 App (Vercel)      │        하객 (모바일)
  ───────────────►       │                              │       ◄───────────────
  /edit → /editor/[id]   │  editor UI ──┐               │    / (도메인 루트)
                         │              ▼               │
                         │        ┌──────────┐          │
                         │        │ renderer │ ◄────────│──── 동일 모듈 (원칙 5)
                         │        └──────────┘          │
                         │  server actions / routes     │
                         └───────────┬──────────────────┘
                                     ▼
                         ┌──────────────────────────────┐
                         │  Supabase                    │
                         │  Auth · Postgres(RLS) · Storage │
                         │  projects / publications /    │
                         │  rsvp_responses / assets      │
                         └──────────────────────────────┘
```

단일 Next.js 앱. 모노레포·별도 백엔드 없음 (ADR-001). 경계는 저장소 내부 모듈과 lint 규칙으로 지킨다.

## 2. 모듈 구조와 의존성 규칙

```
src/
├─ invitation/          # 도메인 코어 (React·Next 미의존)
│  ├─ schema/           #   문서 타입 + Zod 스키마 + 마이그레이션
│  ├─ actions/          #   typed action 정의 + apply/invert + redact
│  ├─ ai/               #   AI 경계: projection·allowlist 스키마·검증·port·mock provider (Phase 10)
│  └─ fixtures/         #   테스트·개발용 예시 문서
├─ renderer/            # 청첩장 렌더 컴포넌트 (미리보기=공개 페이지 공용)
│  ├─ sections/         #   섹션 12종 컴포넌트
│  └─ primitives/       #   SectionShell, PhotoFrame 등
├─ editor/              # 편집기 UI (store, 패널, 프리뷰 프레임, dnd 어댑터)
├─ server/              # backend 접근 계층: Supabase 클라이언트(browser·server)·persistence·asset store·프로젝트 API·AI provider adapter
├─ ui/                  # 편집기 공용 위젯 (버튼, 필드 — renderer와 무관)
└─ app/                 # Next 라우트 (조립 계층)
```

### 의존성 매트릭스 (행 → 열 import 허용 여부)

| from \ to | invitation | renderer | editor | server | ui | app |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **invitation** | — | ✗ | ✗ | ✗ | ✗ | ✗ |
| **renderer** | ✓ | — | ✗ | ✗ | ✗ | ✗ |
| **editor** | ✓ | ✓ | — | ✗ | ✓ | ✗ |
| **server** | ✓ | ✗ | ✗ | — | ✗ | ✗ |
| **ui** | ✗ | ✗ | ✗ | ✗ | — | ✗ |
| **app** | ✓ | ✓ | ✓ | ✓ | ✓ | — |

- `invitation`은 zod와 표준 라이브러리만 의존하는 순수 코어. React를 모른다.
- `renderer`가 `editor`를 모르는 것이 **단일 renderer 원칙의 기술적 보증**이다. 선택 하이라이트 등 편집기 전용 장식은 editor 쪽 래퍼가 덧씌운다.
- `server`는 렌더링을 모른다. `app`이 유일한 조립 지점 (DI 역할) — 편집기는 `invitation/persistence/port.ts`의 `ProjectPersistence`와 `invitation/assets`의 `AssetStore` 인터페이스만 알고, app 라우트가 Supabase 구현체를 주입한다 (ADR-018). **UI 모듈(editor·renderer)은 Supabase SDK를 직접 import하지 않는다.**
- 강제 수단: `eslint-plugin-boundaries` 7.x + CI lint 게이트. 위반은 빌드 실패로 fail fast.

## 3. 문서 모델 (ADR-002)

```ts
// invitation/schema — 개념 스케치, 현재 v7 (실제는 Zod 스키마가 단일 진실)
interface InvitationDocument {
  schemaVersion: 7;
  wedding: {
    groom: Person;               // { name, familyRole?("아들"…), father?, mother? }
    bride: Person;               //   Parent = { name, deceased: boolean }
    datetime: string;            // ISO 8601, +09:00 고정
    venue: { name; hall?; address; phone? };
  };
  theme: { id: ThemeId };        // 토큰·variant는 THEMES 레지스트리에서 해석 (ADR-014)
  music: { assetId: string | null };  // 배경음악 — 참조만 (ADR-025)
  typography: {                  // 전역 폰트·크기 (ADR-028: headingPt·bodyPt), 섹션별 override는 style
    headingFont: FontId;         // "theme" | 내장 id | "custom:<assetId>"
    bodyFont: FontId;
    basePt: number;              // 본문 기준 pt — 렌더러가 --canvas-fs 배율로 환산
  };
  sections: Section[];           // 순서 = 배열 순서
}

interface Section {
  id: string;                    // nanoid — action 타깃 식별자
  type: SectionType;             // 12종 (MVP 카탈로그 완성): hero | greeting | coupleProfile | calendar |
                                 //   gallery | venue | video | transportation | contacts | giftAccount | rsvp | closing
                                 //   hero·rsvp는 최대 1개 (A-06) — 문서 불변식 + action 거부
  visible: boolean;              // 숨기면 공개 projection에서 내용째 제거된다 (§8)
  content: SectionContent;       // 타입별 zod discriminated union
  layout: { variant: string };   // 타입별 enum — Phase 8 섹션은 모두 2개 이상 (예: contacts: inline|accordion)
  style: { paddingY: "sm"|"md"|"lg"; background?: string; animation: "none"|"fade"|"rise" };
}

// Phase 8 content 요약 (전역 wedding 참조 원칙 유지 — 이름·일시·장소는 섹션에 중복 저장하지 않는다)
//  coupleProfile: { title, groom/bride: {photoAssetId, photoFrame?, intro}, showParents }
//  calendar:      { title, showDday }                          — 날짜는 wedding.datetime 참조
//  transportation:{ title, items[]: {icon(subway|bus|car|parking|shuttle|etc), title, body} }
//  contacts:      { title, entries[]: {side(groom|bride), label, name, phone(sensitive)} }
//  giftAccount:   { title, groomLabel, brideLabel, accounts[]: {side, bank, holder, number(sensitive)} }
//  closing:       { title, body, photoAssetId, photoFrame?, showShare }
//  rsvp (Phase 9): { title, body, deadline(nullable), collect: {side, companions, meal, phone, message} }
//                 — 폼 구성만 저장. 게스트 응답은 문서가 아니라 rsvp_responses 테이블에 있다 (§9, ADR-021)
//  venue 추가:    showMapButtons — 네이버·카카오·티맵 열기 (URL·딥링크만, 지도 API 없음 — invitation/lib/mapLinks.ts)

// 사진 참조 (ADR-016) — 문서에는 assetId + 표시 metadata만. 원본·base64 금지.
type GalleryPhoto = { assetId: string; alt?: string; caption?: string; frame?: PhotoFrame };
type PhotoFrame = { zoom: number /*1~3*/; focalX: number /*0~1*/; focalY: number /*0~1*/ };
// hero도 photoAssetId + photoFrame? 로 동일 모델. video는 외부 URL만 저장 (ADR-017).
```

### 규칙
- **프로젝트 제목·타임스탬프는 문서에 없다.** DB 컬럼(`projects.title` 등)이 단일 소스 — 같은 지식을 두 곳에 두지 않는다 (DRY).
- **검증 경계 (fail fast)**: 문서는 로드·저장·발행·공개 렌더 직전 4개 경계에서 zod full parse. 실패 시 즉시 구조화 에러 — silent fallback 금지.
- **마이그레이션**: `schemaVersion` 정수 증가. `migrations: Record<number, (doc) => doc>`를 로드 시 순차 적용(forward-only), 저장은 항상 최신 버전. publication에도 `schema_version` 저장 — 공개 렌더도 같은 마이그레이터를 통과시켜 오래된 스냅샷을 계속 렌더할 수 있게 한다.
- **sensitive 마킹 (Phase 8 구현)**: 민감 필드(contacts.phone·giftAccount.number)는 zod `.meta({ sensitive: true })`로 스키마에 선언한다 — §10 redaction의 데이터 원천. projection 구현은 `invitation/sensitive.ts`의 `redactForAi`이며, 선언·구현의 일치는 단위 테스트가 고정한다.

## 4. typed action 시스템 (ADR-003 · ADR-015 · ADR-020)

직접 편집(우측 패널·드래그)과 AI 편집이 **같은 action을 같은 dispatcher로** 흘려보낸다.
모든 action은 직렬화 가능한 JSON이며 zod discriminated union이 단일 진실이다.

### action 카탈로그 (구현됨)

**document action** — 문서를 변경하며 undo 가능:

| action | payload | 비고 |
|--------|---------|------|
| `addSection` | `{ sectionType, index, sectionId? }` | hero는 스키마 수준에서 추가 불가. rsvp는 이미 있으면 거부(최대 1개, A-06). id 미지정 시 엔진 생성 |
| `removeSection` | `{ sectionId }` | hero 거부 |
| `duplicateSection` | `{ sourceSectionId, newSectionId? }` | 원본 바로 뒤 삽입, 깊은 복사, id 충돌 방지(재시도), hero·rsvp 거부 |
| `reorderSections` | `{ order: string[] }` | 전체 순서의 **순열** — index 산술 없음. hero 최상단 검증 |
| `toggleSectionVisibility` | `{ sectionId, visible? }` | 미지정 시 반전. hero 숨김 거부 |
| `updateSectionContent` | `{ sectionId, patch }` | 타입별 content 스키마로 merge 후 검증 |
| `updateSectionSettings` | `{ sectionId, patch }` | style(여백·배경·애니메이션) — zod partial |
| `setSectionVariant` | `{ sectionId, variant }` | 타입별 layout 스키마로 검증. **content·asset 참조 보존** |
| `setTheme` | `{ themeId }` | |
| `updateWedding` | `{ patch }` | 전역 wedding 데이터 |
| `assignAsset` | `{ sectionId, assetId, slot }` | slot: `heroPhoto` / `galleryItem{index?}` (index=교체·alt·caption 보존·**frame 초기화**, 미지정=append·30장 제한) / `profilePhoto{side}` / `closingPhoto` (Phase 8) |
| `removeAssetReference` | `{ sectionId, slot }` | heroPhoto·profilePhoto·closingPhoto→null(+photoFrame 제거), galleryItem{index}→제거 |
| `moveGalleryPhoto` | `{ sectionId, from, to }` | 갤러리 사진 1장 이동 — 드래그·키보드가 같은 action. coalescing 비대상(이동 1회 = undo 1스텝). Phase 5 추가 |
| `updateGalleryPhoto` | `{ sectionId, index, patch }` | patch: `{alt?, caption?, frame?}` — `frame: null`은 crop 제거(직렬화 가능한 제거 표현). Phase 5 추가 |
| `updateListItem` | `{ sectionId, field, index, patch }` | 반복 그룹(items·entries·accounts) 한 항목의 필드 수정 — 같은 항목·필드 타이핑만 undo 병합. 항목 추가·삭제는 updateSectionContent 배열 patch(병합 안 함 — coalesceKeyOf가 배열 값 patch를 제외). Phase 8 추가 |
| `batch` | `{ label?, actions: DocumentAction[] }` | 순차 적용, **원자성**(하나라도 실패 시 전체 거부), 히스토리 1스텝. 중첩 batch 불가 |

**session action** — 문서를 바꾸지 않고 히스토리에 남지 않음:

| action | payload | 비고 |
|--------|---------|------|
| `selectSection` | `{ sectionId }` | 편집기 선택 이동. 존재하지 않는 섹션이면 거부. (기본 정보/테마 패널 선택은 문서 밖 순수 UI 상태라 action 범위 밖) |

### 적용 엔진

```ts
// invitation/actions/apply.ts — 순수 함수, React 무관
applyAction(doc, action, deps?: { generateId? }): ApplyResult
// ApplyResult = { outcome:"applied", doc, patches, inversePatches } | { outcome:"noop", doc }
// invalid → InvalidActionError throw (문서 불변)
```

- **검증 3단**: ① action zod parse → ② 핸들러별 의미 검증(존재하는 섹션인지, hero 불변식, 타입-slot 일치, 갤러리 30장 등) → ③ 적용 결과 문서 전체 `documentSchema` 재검증. 어떤 경로(GUI/AI)로 와도 동일.
- **버전 경계**: `doc.schemaVersion !== CURRENT_SCHEMA_VERSION`이면 즉시 거부 — 구버전 문서는 로드 시 `migrateDocument`로 승격한 뒤에만 action을 받는다.
- **no-op 감지**: 패치가 없거나 결과가 원본과 구조적으로 동일(deepEquals)하면 `noop` — store가 히스토리에 추가하지 않는다.
- **stable id**: `deps.generateId` 주입점(기본 nanoid). 생성된 id는 patches에 고정되므로 undo→redo 후에도 id가 동일하다.
- **batch**: 하위 action을 순차 적용하며 patches를 연결(inverse는 역순). 중간 실패 시 예외로 전체 거부 — 원본 문서는 그대로.

### 히스토리 (invitation/actions/history.ts — 순수 코어)

- entry = `{ patches, inversePatches, coalesceKey?, at }`. `recordEntry` / `undoOnce` / `redoOnce`가 zustand와 무관한 순수 함수로 분리되어 있어 AI 세션도 재사용 가능.
- **coalescing**: `coalesceKey = action종류 + 대상 + patch 필드`가 같고 1,000ms 이내면 직전 entry에 병합 → 연속 타이핑 = undo 1스텝. (content·settings·wedding·galleryPhoto만 키 발급 — `updateGalleryPhoto`는 `섹션+index+필드` 단위라 캡션 타이핑·crop 슬라이더는 병합되고 reorder는 병합되지 않는다)
- 용량 정책: 최대 100스텝, 초과 시 가장 오래된 것부터 폐기. 세션 인메모리 (A-11).
- **기록 시점에 redo 브랜치는 항상 폐기**된다.
- undo 비대상: 프로젝트명 변경, 발행, 사진 파일 업로드(문서에는 assetId 참조만 — 참조 변경은 undo 대상), selectSection.

### 데이터 흐름

```
입력(폼/드래그/AI) → action(JSON) → store.dispatch
  → applyAction: zod 검증 → 버전 경계 → Immer 적용 → 문서 재검증 → applied|noop
  → applied면 recordEntry(coalesce·limit·redo 폐기) + 선택 정규화(삭제된 섹션 → hero)
  → renderer 리렌더 (미리보기 즉시 반영) → 1.5s 디바운스 → 자동저장
```

## 5. 상태 관리 (ADR-007)

Zustand 5 단일 스토어, 슬라이스 3개:

- `docSlice`: `doc`, `dispatch(action)`, `undo()`, `redo()`, history
- `uiSlice`: `selectedTarget`(sectionId | "wedding" | "theme"), `previewWidth`(360|390|430), `previewMode`(edit|interact)
- `saveSlice`: `status`(saving|saved|error), `rev`, 디바운스 타이머

자동저장: `UPDATE projects SET doc=$1, doc_rev=doc_rev+1 WHERE id=$2 AND doc_rev=$3` (compare-and-set). 영향 행 0 → 409 → "다른 탭에서 수정됨" 경고, 덮어쓰기 차단 (A-12). 실시간 협업은 non-goal이므로 이 정도로 충분하다.

## 6. renderer 계약 (ADR-004)

```tsx
<InvitationRenderer
  doc={document}
  mode="published" | "editor-edit" | "editor-interact"
  resolveAsset={(assetId, opts) => url}   // 이미지 URL 해석 주입
  onSectionSelect?={(id) => void}          // editor-edit 모드에서만
/>
```

- 시각적 출력은 mode와 무관하게 동일. mode는 (a) 선택 오버레이 활성화, (b) 내부 인터랙션 차단 여부만 결정.
- **미리보기는 iframe이 아니라 인라인 마운트** + 폭 고정 컨테이너. 대신 renderer에 다음 규칙을 강제해 정확도를 보장한다:
  - `vw/vh/@media` 사용 금지 — 뷰포트가 아닌 **컨테이너 쿼리(`@container`)와 상대 단위**만 사용. 미리보기 컨테이너와 실제 뷰포트에서 동일하게 동작하는 근거.
  - CI에 `vw|vh|@media` grep 검사 스크립트 (renderer/ 한정).
- 인터랙티브 프리미티브(캐러셀·아코디언·D-day)는 `"use client"` + 로컬 상태만. 전역 store 접근 금지 (의존성 매트릭스로 강제).
- 공개 페이지는 RSC에서 renderer를 서버 렌더 → 정적 HTML 우선, 클라이언트 JS는 인터랙티브 프리미티브만.

## 7. 영속성 — Supabase (ADR-006 · ADR-018, Phase 6 구현 완료)

로컬 개발은 `supabase start`(Docker) + `supabase/migrations/`가 단일 진실이다.
접속 정보는 `.env.local`(`NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`, fail fast) —
**service role 키는 코드 어디에도 없다.** 모든 접근은 사용자 세션(RLS invoker)으로 이뤄진다.

### 테이블 (마이그레이션 supabase/migrations/ — init·publishing·rsvp)

| 테이블 | 핵심 컬럼 | 역할 |
|--------|-----------|------|
| `profiles` | id(auth.users FK), email | users의 public 표현 — auth 트리거로 자동 생성 |
| `projects` | owner_id, title, status(`draft`/`archived`), updated_at | 프로젝트 메타 (제목·상태·마지막 수정) |
| `invitation_documents` | project_id(PK), doc(jsonb), schema_version, **doc_rev** | 프로젝트당 현재 draft 1개. doc_rev = 낙관적 동시성 토큰 |
| `revisions` | project_id, rev, kind(`origin`/`checkpoint`/`restore`), label, doc | 의미 있는 checkpoint — autosave마다 만들지 않는다. **불변**(update 정책·grant 없음) |
| `project_assets` | project_id, filename, 치수, content_hash, storage_path, thumb_path | 업로드 이미지 메타. unique(project_id, content_hash) = 중복 감지 |
| `publish_records` | project_id(PK), slug(unique), doc, **assets(manifest)**, status(`live`/`off`) | 발행 스냅샷 — 유일한 공개 데이터 (ADR-012) |
| `rsvp_responses` | project_id, client_token(프로젝트 내 unique), guest_name, attending, side?, companions?, meal?, phone?, message?, consented_at | RSVP 응답 — 문서 밖 별도 저장 (Phase 9, ADR-021). 프로젝트 삭제 시 cascade |

- **원자적 RPC (security invoker)**: `create_project_with_document`(프로젝트+문서+origin revision),
  `save_document`(rev 검사 → saved/conflict/not_found), `create_checkpoint`,
  `restore_revision`(복원 = 새 doc_rev + 새 restore revision — 과거 비파괴.
  **복원 직전 상태에 revision이 없으면 '복원 전 자동 저장' checkpoint를 먼저 만든다**
  (ADR-023) — autosave가 revision을 만들지 않아도 복원은 항상 되돌릴 수 있다).
- **definer RPC (RLS 우회 — 검증을 함수 안에서 강제)**: `get_preview_by_token`(§8),
  `get_published_by_slug`(§8 — 게스트 발행본 읽기의 유일한 경로, 숨긴 섹션 제거 포함),
  `submit_rsvp`(§9 — RSVP의 유일한 쓰기 경로: live 발행 + 보이는 rsvp 섹션 + 마감 전 +
  동의 + 입력 제약 + 일일 상한 + client_token upsert를 전부 DB에서 판정).
- **동시 편집 감지**: 저장은 항상 `expectedRev`를 동반 — 다른 탭이 먼저 저장했으면 `conflict`가
  반환되고 편집기는 자동 저장을 멈춘 채 '최신 상태 불러오기'를 제안한다 (덮어쓰기 없음).

### RLS 정책 매트릭스 (구현·통합 테스트로 검증)

| 테이블 | anon (게스트) | authenticated (소유자) |
|--------|---------------|------------------------|
| profiles | 없음 | select, 본인 행 한정 |
| projects | 없음 | CRUD, `owner_id = auth.uid()` |
| invitation_documents / revisions / project_assets | 없음 (grant조차 없음) | CRUD(revisions는 불변 — update 없음), `owns_project()` 한정 |
| publish_records | **없음 (grant조차 없음)** — 읽기는 `get_published_by_slug` RPC만 (ADR-023) | 전체, 소유 프로젝트 한정 |
| rsvp_responses | 없음 (grant조차 없음 — 쓰기는 definer RPC만) | select·delete만, `owns_project()` 한정 — **소유자도 insert/update 불가** |
| storage.objects(photos) | select(공개 읽기) | insert/update/delete — 경로 `projects/{projectId}/…`의 프로젝트를 소유할 때만 |

- RLS(행 필터)와 별개로 **GRANT는 명시적 최소 권한**으로 선언한다 — 최신 로컬 스택은 기본 DML grant를 주지 않는다.
- 공개 페이지(/i/[slug])는 발행 시점에 고정된 `publish_records.assets` manifest로만 이미지를 해석한다 —
  anon에게 project_assets 접근 권한이 아예 없어도 렌더 가능, private 메타 비노출.

### 사진 파이프라인 (A-13 · ADR-016, Phase 5에서 adapter 경계 구현 완료)

UI는 `AssetStore` 인터페이스(`invitation/assets/assetTypes.ts`)에만 결합된다:

```ts
interface AssetStore {
  list(): Promise<StoredAsset[]>;                       // record + fullUrl + thumbUrl
  upload(file, { onProgress? }): Promise<UploadOutcome>; // { asset, duplicate, warnings }
  remove(assetId): Promise<void>;
}
// renderer는 동기 resolveAsset(assetId) → { src, srcSet?, width, height } | null 만 안다.
// null = 누락 asset → PhotoFrame이 '이미지 없음' placeholder (aspect-ratio 자리는 유지)
```

- **현재 구현 (Phase 6)**: `server/supabase/assetStore.ts` — Storage(photos 버킷, `projects/{projectId}/{assetId}.{ext}` + 640px 썸네일) 업로드 + `project_assets` 행 기록, content_hash 중복 감지. app이 편집기·미리보기에 주입한다. Phase 5의 IndexedDB 어댑터(`editor/assets/localAssetStore.ts`)는 오프라인 개발 대안으로 유지.
- **업로드 검증 정책**(`invitation/assets/uploadPolicy.ts` 단일 소스): JPG·PNG·WebP만, ≤10MB, 가로 800px 미만은 경고(거부 아님). 형식·크기는 읽기 전에 즉시 거부(fail fast), 디코딩 실패는 재시도 가능한 에러. 디코딩·썸네일·해시는 `invitation/assets/imageProcessing.ts`를 두 어댑터가 공유.
- 후속 개선: 캔버스 재인코딩(최대 변 2560px, WebP — **EXIF/GPS 제거는 재인코딩의 부수 효과**)과 Storage 변환 URL(`?width=`) srcset은 아직 미적용 — 현재는 원본+썸네일 2단 srcset.
- 문서에는 `assetId` + 표시 metadata(alt·caption·frame)만 저장 — 원본·base64 금지. 미리보기·공개 페이지 동일 경로.

## 8. 발행 파이프라인과 캐싱 (ADR-012 · ADR-019, Phase 7 구현)

```
[공유·발행 패널]
  비공개 미리보기: preview_links upsert(토큰 32자, 만료 옵션) → /p/[token]
    · anon이 definer RPC(get_preview_by_token)로 현재 draft 조회 — 폐기·만료·무효는 구분 없이 거부
  발행/재발행: publish_project RPC (원자적)
    1. 현재 doc_rev의 revision 보장 (없으면 kind 'publish' 생성) — published_rev·revision_id 참조
    2. publish_records upsert (status 'live', published_at 갱신)
       · slug 중복은 unique 제약 위반을 잡아 slug_taken 반환 (ADR-023 — 사전 검사는
         invoker 가시성 축소로 폐기, 예외 블록이 revision 부산물까지 롤백)
  발행 중단: status='off' — 스냅샷 보존, /i/[slug]는 즉시 접근 불가
```

- **발행 규칙**: 공개되는 것은 발행 시점 스냅샷뿐 — draft 수정은 republish 전까지 공개본 불변.
- **게스트 읽기 경로는 definer RPC 2개뿐** (Phase 11, ADR-023 / ADR-029): 루트는 `get_published_root`, `/i/[slug]`는 definer RPC
  `get_published_by_slug`로 조회한다. anon은 `publish_records`를 직접 SELECT할 수 없다
  (grant 없음) — 발행 목록 열거·projection 우회·내부 메타(published_rev) 노출이 불가능하다.
  **숨긴 섹션 제거는 RPC(DB)가 1차로 수행**하고, 앱의 `buildPublicPayload`(문서 화이트리스트
  재파싱 + asset manifest strict 검증)가 같은 규칙을 한 번 더 적용한다(2차 방어).
- **public projection**: `/i/[slug]`·`/p/[token]` 응답은 `invitation/publicPayload.ts`의
  `buildPublicPayload`를 통과한 것만 클라이언트로 나간다 — 편집기 상태·revision 이력·
  내부 storage 경로는 존재하지 않는다.
- **공개 페이지**: RSC 서버 렌더 + generateMetadata(og/twitter·대표 이미지·robots noindex),
  최대 430px 중앙 정렬(360/390/430 검증), Web Share API + 클립보드 복사 fallback.
  요청마다 SSR + DB 1회(React cache로 metadata와 본문이 조회 공유) — 항상 최신.
- **발행 중 asset 보호** (Phase 11): live 발행본이 참조하는 사진은 보관함에서 삭제할 수
  없다(어댑터가 거부) — 스냅샷 문서는 불변인데 파일만 사라져 공개 페이지가 깨지는 것을 막는다.
- 남은 것(후속 설계 메모): 발행 전 검증 규칙(PRODUCT_SPEC §7), `/i/[slug]` 태그 캐시
  (`inv:${slug}` — 재발행·발행 중단 시 revalidate; Next 16.2의 권장 캐시 API 확인 후 통일).

## 9. RSVP 데이터 경로 (Phase 9 구현 완료 — ADR-021)

```
게스트 폼(renderer RsvpSection — published 모드 + 공개 slug일 때만 제출 가능)
  → POST /api/rsvp (route handler, 인증·쿠키 없음)
      1. JSON content-type 강제 (cross-origin form 벡터 차단 — CSRF 검토는 ADR-021)
      2. 허니팟(website) — 채워져 있으면 성공처럼 응답하고 저장하지 않는다 (A-17)
      3. zod 검증 + 정규화 (invitation/rsvp/submission.ts — 단일 소스)
      4. IP+slug 슬라이딩 윈도우 rate limit (20/분, in-memory 1차 방어)
  → submit_rsvp RPC (security definer — 유일한 쓰기 경로)
      5. live 발행 + 공개 스냅샷의 보이는 rsvp 섹션 + 마감 전 + 동의 + 입력 제약 재검증
      6. 프로젝트별 일일 상한 200건 (내구적 2차 방어 — anon 키 직접 호출도 여기 막힘)
      7. (project_id, client_token) upsert — 중복 제출 = 수정 (created/updated 구분)
```

- 응답은 `rsvp_responses` 테이블에만 존재한다 — 문서의 rsvp content에는 응답을 담을
  자리가 없어(§3) 공개 스냅샷·미리보기·AI projection에 실리는 것이 구조적으로 불가능하다.
- 소유자 조회·삭제는 `/editor/[projectId]/rsvp`(집계·검색·필터·상세·삭제·CSV)에서
  사용자 세션 select/delete (RLS). CSV export는 `invitation/rsvp/csv.ts`가 수식 주입을 방어한다.
- 로그: `/api/rsvp`는 `rsvpLogLine`(이벤트 이름 + SQLSTATE 코드 화이트리스트)만 사용 —
  게스트 입력값은 검증 실패·DB 에러 어느 경로로도 로그에 남지 않는다.

## 10. AI 편집 경계 (Phase 10 구현 완료 — ADR-011 · ADR-022)

```
편집기 'AI 도우미' — 자연어 요청
  → POST /api/ai/propose (소유자 세션 필수 — 남의 projectId는 404)
      1. 문서 zod full parse → buildAiProjection(invitation/ai/projection.ts)
         · sensitive 필드 → "<redacted>" (redactForAi)
         · 사진 → { assetId, width, height, orientation }만 — bytes·경로·파일명은 스키마에 자리 없음
         · RSVP 응답·인증·revision — 문서 밖 데이터라 이 계층에 도달 자체가 안 됨
      2. AiProvider.propose (server 전용 adapter — 키는 브라우저에 없다)
         · Anthropic: 30s 타임아웃 + 재시도 1회(429·5xx·타임아웃·형식 불량), tool 정의는
           z.toJSONSchema(aiProposalSchema) — action 스키마 이중 관리 없음
         · AI_PROVIDER=mock: 결정적 mock (e2e·로컬 데모 — 네트워크 없음)
      3. validateAiProposal(invitation/ai/validate.ts) — 4겹 runtime 검증
         · allowlist zod parse: 12종 action만 (updateWedding·updateListItem·batch 제외).
           HTML·CSS·React·JS·SQL·전체 JSON을 표현할 action 자체가 없다
         · 값 가드: HTML/마크업 문자열·"<redacted>" echo 거부
         · content patch 키 검증: 스키마 밖 임의 경로는 조용히 버리지 않고 거부
         · dry-run: applyAction 순차 실행 — 없는 섹션 id·개수 초과(20)·불변식 위반 거부
  → 검토 화면 (즉시 적용 금지): 변경 목록 + 전후 비교 + 미리보기(같은 renderer)
  → 전체/일부 적용 = dispatch(batch) — 수동 편집과 동일 파이프라인, undo 1스텝
```

- **AI 없이도 편집기는 완전하다** — 키 미설정이면 503(unconfigured) 안내만 하고 다른 기능은 그대로.
- **rate limit** (Phase 11): 사용자별 10회/분 슬라이딩 윈도우(`server/lib/rateLimit` — RSVP와
  공유) — 소유자 전용 endpoint지만 provider 호출 비용을 보호한다. 초과 시 429 + 재시도 안내.
- 허용 action 12종: addSection · removeSection · duplicateSection · reorderSections ·
  updateSectionContent · updateSectionSettings · setSectionVariant · setTheme · assignAsset ·
  moveGalleryPhoto(=arrangeGallery) · updateGalleryPhoto(=setImageFocalPoint·대체 텍스트) ·
  toggleSectionVisibility.
- 초기 기능 범위(프롬프트 수준): 초안 제안 · 인사말 다듬기 · 전체 분위기 변경 · 갤러리 레이아웃 제안 · 접근성 검토.
- 사용자가 채팅에 직접 쓴 민감 값은 action으로 반영 가능하되(PRODUCT_SPEC §9), redact 자리표시자의 echo는 차단된다.
- 로그: 요청 문구·문서·AI 응답 내용은 로그에 남기지 않는다 — 이벤트 이름·사유 코드만.

## 11. 라우트 맵

| 경로 | 접근 | 역할 | 상태 |
|------|------|------|------|
| `/` | 공개 | 도메인 루트 청첩장 — 공개 주소(slug) 없이 발행한 것 (ADR-029) | ✅ |
| `/wedding.ics` | 공개 | 루트 청첩장의 예식 일정 | ✅ |
| `/edit` | 소유자 | 대시보드: 프로젝트 목록·생성·개명·복제·보관·삭제 | ✅ Phase 6 |
| `/login` | 공개 | Supabase Auth 이메일+비밀번호 로그인 (A-01). 공개 가입 없음 — 계정은 Supabase 대시보드에서 생성 (ADR-024) | ✅ Phase 6 |
| `/editor/[projectId]` | 소유자 | 편집기 (자동 저장·기록·발행) | ✅ |
| `/preview/[projectId]` | 소유자 | draft 모바일 뷰 (A-19) | ✅ |
| `/i/[slug]` | 공개 | 공개 주소를 따로 적어 발행한 live 스냅샷 (인증 불필요, noindex) | ✅ Phase 7 |
| `/p/[token]` | 공개(토큰) | 비공개 미리보기 — 현재 draft, noindex | ✅ Phase 7 |
| `/editor/[projectId]/rsvp` | 소유자 | RSVP 결과: 집계·검색·필터·상세·삭제·CSV (A-22) | ✅ Phase 9 |
| `POST /api/rsvp` | 공개 | RSVP 제출 (검증·허니팟·rate limit → definer RPC) | ✅ Phase 9 |
| `POST /api/ai/propose` | 소유자 | AI 편집 제안 (sanitized projection → provider → 4겹 검증) | ✅ Phase 10 |

인증 가드: `src/middleware.ts`가 세션을 검증(getUser)·갱신하고 미로그인 시 `/login` 리다이렉트. 공개 경로는 `/`·`/wedding.ics`·`/login`·`/i/*`·`/p/*`·`POST /api/rsvp`·dev 검증 라우트(`/fixture/*`·`/themes`)뿐. 루트 패턴은 반드시 `/^\/$/`로 고정한다 — `/^\//`로 쓰면 모든 경로가 공개가 된다. 데이터 접근의 실질 방어는 RLS.

## 12. 기술 스택 확정 (버전은 2026-07-16 npm latest 실측)

| 영역 | 선택 | 버전 | 근거 / 검토한 대안 |
|------|------|------|--------------------|
| 프레임워크 | Next.js (App Router) | 16.2.10 | RSC로 공개 페이지 성능·태그 캐시·`next/image`·`next/font` 모두 활용. 대안 Remix/Astro는 렌더러 공유(단일 React 트리) 요구에 이점 없음 (ADR-005) |
| UI | React | 19.2.7 | Next 16 동반 버전 |
| 언어 | TypeScript strict | **~5.9.3 고정** | 최신 7.0.2(Go 네이티브)는 GA 8일차 — Next.js가 패키지 감지 실패, typescript-eslint 미지원(7.1의 신규 API 대기). 6.0.3은 브리지 릴리스로 도구 지원 미성숙. 재평가 조건은 ADR-010 |
| 스타일 | Tailwind CSS | 4.3.3 | CSS-first `@theme`가 디자인 토큰 체계와 일치 (ADR-009) |
| 스키마 | Zod | 4.4.3 | 문서 검증 + `.meta()` sensitive 마킹 + `z.toJSONSchema`로 AI tool 스키마 생성 (ADR-002) |
| 백엔드 | Supabase (`supabase-js` / `ssr`) | 2.110.6 / 0.12.3 | Auth+Postgres(RLS)+Storage 단일 스택. 대안(Neon+Auth.js+S3)은 조립 비용↑ (ADR-006) |
| DnD | **pragmatic-drag-and-drop** | 2.0.1 | 후보였던 dnd-kit은 **2024-12-05 이후 배포 중단(19개월)**. pragmatic은 2026-06-17까지 활발, Jira/Trello 검증. `editor/dnd` 어댑터로 격리해 교체 가능 (ADR-008) |
| 상태 | Zustand + Immer | 5.0.14 / 11.1.11 | patch 기반 undo/redo에 Immer 필수, 스토어는 최소 API (ADR-007) |
| 단위/컴포넌트 테스트 | Vitest (+ Testing Library) | 4.1.10 | |
| E2E | Playwright | 1.61.1 | 모바일 뷰포트 프로젝트로 공개 페이지 검증 |
| 경계 강제 | eslint-plugin-boundaries | 7.0.2 | §2 매트릭스를 CI에서 강제 |
| 유틸 | nanoid / date-fns | 6.0.0 / 4.4.0 | id 생성 / 달력 그리드·D-day 계산 |
| 런타임 | Node.js | **24 LTS 권장** | 로컬 v23.10.0은 2026-06-01 EOL 경과 — 교체 필요 ([CURRENT_STATE.md](./CURRENT_STATE.md)) |
| 패키지 매니저 | npm | 10.9.2 | 로컬 존재, 단일 앱이라 충분 (A-23) |

설치 시점에 마이너 버전이 올라가 있으면 최신 마이너를 쓰되, 메이저가 바뀌었으면 이 표와 ADR을 갱신한 뒤 진행한다.

## 13. 테스트 전략

| 계층 | 도구 | 대상 |
|------|------|------|
| 단위 | Vitest | zod 스키마·마이그레이션, `applyAction` + undo 왕복(patch→inverse=identity 속성 테스트), redactForAI, 발행 검증 규칙 |
| 컴포넌트 | Vitest + Testing Library | 섹션 렌더러 12종 fixture 렌더, 폼 컨트롤 동작 |
| E2E | Playwright | 슬라이스별 핵심 여정 (로그인→편집→발행→게스트 열람, RSVP 제출 등). 게스트 뷰는 모바일 뷰포트로 실행. 계정은 헬퍼가 anon API로 만들고 로그인만 UI로 수행한다 (ADR-024) |
| 경계 | eslint-plugin-boundaries + grep(vw/vh/@media) | §2 매트릭스, §6 renderer 단위 규칙 |

게이트: `typecheck` / `lint` / `test` / `test:e2e` 4개 스크립트가 각 슬라이스의 완료 조건 ([IMPLEMENTATION_PLAN.md §5](./IMPLEMENTATION_PLAN.md)).

## 14. 환경 변수 (fail fast — 기본값·폴백 금지)

| 변수 | 노출 | 상태 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 | ✅ 필수 — 없으면 즉시 에러 (`server/supabase/env.ts`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 (publishable) | ✅ 필수 — 위와 동일 |
| `ANTHROPIC_API_KEY` | **서버 전용** | ✅ 선택 — 없으면 AI만 비활성(편집기는 정상) |
| `AI_MODEL` | 서버 전용 | ✅ 선택 — provider 모델 id (키와 함께 있어야 AI 활성) |
| `AI_PROVIDER` | 서버 전용 | ✅ 선택 — `mock`이면 결정적 mock provider (e2e·로컬 데모) |
| `NEXT_PUBLIC_KAKAO_MAPS_JS_KEY` | 클라이언트 | 예정 — 지도 표시 도입 시 (A-08) |

필수 변수는 접근 시점에 검증하고 누락이면 즉시 에러 — 코드에 `?? "localhost"`류 암묵 기본값 금지.
AI 변수는 선택이 의도된 예외다(§10 — 미설정 = 기능 비활성이지 기본값 대체가 아니다).

## 15. 성능·보안 체크리스트 (Phase 11 감사 실측)

- [x] 공개 페이지는 RSC 서버 렌더 + DB 1회 조회(React cache 공유) — 편집기 번들(dnd·immer·
      zustand)은 공개 경로에 없음. renderer 전체가 클라이언트 컴포넌트인 것은 단일 renderer
      원칙(ADR-004)의 비용으로 수용
- [x] 이미지: PhotoFrame이 aspect-ratio로 자리 예약(CLS 0), hero만 eager·이하 lazy,
      썸네일 640w + 원본 srcSet/sizes, 실패·누락은 동일 크기 '이미지 없음' placeholder
- [x] 폰트: next/font(self-host·swap·size-adjust) + 본문은 시스템 스택
- [x] 긴 무공백 문자열 overflow 방지: `word-break: keep-all` + `overflow-wrap: anywhere`
- [x] RLS 상시 + 서버 zod 검증 이중화 (RPC 입력 제약은 DB에서도 재검증)
- [x] 게스트 읽기 = definer RPC 2개뿐(`get_published_by_slug`·`get_preview_by_token`) —
      anon 테이블 직접 SELECT 없음 (ADR-023)
- [x] 민감 필드는 스키마 `sensitive` 메타 단일 소스 — AI projection redact + 로그 무기록
- [x] RSVP: 동의 필수(zod+DB), 허니팟, IP+slug 20/분, 프로젝트 일일 상한 200, CSV 수식 주입 방어
- [x] AI: 사용자별 10/분 rate limit, 4겹 검증, 서버 전용 키
- [x] 공개 페이지 `noindex`, slug 직접 조회만 가능(열거 경로 없음)
- [x] 접근성: native dialog 포커스 관리, 라벨·alert/status announce, reduced-motion 존중,
      키보드 대체 경로(드래그·행 펼침), 터치 타깃 ≥24px
- [ ] `/i/[slug]` 태그 캐시(재발행 revalidate) — 후속 (현재는 매 요청 SSR = 항상 최신)
- [ ] 한글 서브셋 프리로드 최적화(next/font preload 범위) — 후속
