# CURRENT_STATE — 프로젝트 현재 상태

- 최종 갱신: 2026-07-20 (Phase 11 — production readiness audit 완료)
- 갱신 규칙: **각 vertical slice 완료 시, 그리고 중요한 결정·환경 변화 시 이 파일을 갱신한다.** 이 파일은 "지금 어디까지 왔고 다음이 무엇인지"의 단일 소스다.

## 1. 한 줄 요약

**Phase 11(production readiness audit + 배포 준비) 완료 — 최종 판정: Conditionally ready.**
7개 영역(architecture·security·data integrity·accessibility·responsive·performance·e2e)을 감사해 실제 결함 **14건을 수정**했고(핵심: anon이 `publish_records` 직접 조회로 public projection을 우회해 숨긴 계좌·연락처 열람 + 발행 목록 열거가 가능했던 취약점 — RPC 단일 경로로 봉쇄, ADR-023), 배포 문서(README·DEPLOYMENT·.env.example)를 완성했다. 전 검사 green: format·lint·typecheck·renderer-units / 단위 216 / 통합 29 / build / e2e 59. 남은 조건은 §3.

## 2. Phase 11에서 수정한 것 (감사 → 수정, ADR-023)

### 보안 (2건)
| 문제 | 수정 |
|------|------|
| **anon이 `publish_records`를 PostgREST로 직접 SELECT 가능** — 숨긴 섹션(visible=false)의 내용(숨겨 둔 계좌번호·연락처)까지 doc 전문 노출, slug 필터 없는 조회로 발행된 모든 청첩장 열거, 내부 메타(published_rev) 노출 | anon grant·정책 제거. 게스트 읽기는 **slug 단건 definer RPC `get_published_by_slug`뿐** — 숨긴 섹션 제거를 DB에서 1차 수행(앱 projection은 2차 방어). authenticated select도 소유자 한정으로 축소. 부수 효과로 `publish_project`의 slug 중복 검사를 unique 제약 기반으로 교체(사전 검사의 경쟁 상태도 함께 제거) — migration `20260720010000` |
| AI 요청 rate limit 없음 (provider 비용) | `/api/ai/propose`에 사용자별 10회/분 슬라이딩 윈도우(429 + 재시도 안내, `server/lib/rateLimit`로 RSVP와 공유) |

### 데이터 무결성 (4건)
| 문제 | 수정 |
|------|------|
| **복원이 체크포인트 없는 현재 초안을 영구 유실** (autosave는 revision을 안 만들고, 복원이 덮어쓰면 undo도 초기화) | `restore_revision`이 복원 직전 rev에 revision이 없으면 '복원 전 자동 저장' checkpoint를 먼저 생성 — 복원은 항상 되돌릴 수 있다 (통합 테스트로 회수까지 검증) |
| **첫 RSVP 제출이 재시도에 비멱등** — 실패 후 재클릭마다 새 client token → 중복 행 | 토큰을 form mount당 1개로 고정 — 재시도 = 같은 토큰 = 서버 upsert가 갱신 처리 |
| **발행 중 사진 삭제 시 공개 페이지가 조용히 깨짐** (스냅샷 문서는 불변인데 파일만 404) | live 발행본이 참조하는 사진은 어댑터가 삭제 거부(발행 중단·재발행 후 삭제 안내). 참조 수집은 `invitation/lib/assetRefs`로 추출해 편집기 경고와 공유(중복 제거) |
| 업로드 중간 실패 후 재시도가 storage 고아 파일 생성 | 경로를 내용 주소(`{contentHash}.{ext}`) + upsert로 — 재시도가 같은 경로에 덮어쓴다 |

### 접근성 (7건)
RSVP 대시보드 행 펼침을 키보드 조작 가능하게(게스트명 = aria-expanded 버튼 — 펼쳐야 삭제 접근 가능했음) · 혼주 이름 입력에 accessible name(`신랑 아버지 이름` 식) · **reduced-motion에서 섹션 진입 transition 완전 제거**(기존엔 즉시 표시해도 fade가 재생됨) · 편집기 smooth scroll을 reduced-motion에서 auto로 · RSVP 제출 성공/AI 적용 완료를 `role="status"`로 announce · RevisionPanel 오류에 `role="alert"` · 24px 미만 터치 타깃(갤러리 행·보관함 삭제 버튼) min-h-6으로 확대.

### 반응형 (1건)
전역 `word-break: keep-all`만 있어 공백 없는 긴 토큰(URL·계좌번호·이메일)이 컨테이너를 넘침 → `overflow-wrap: anywhere` 추가.

### 도구·문서
`format`/`format:check` 스크립트 신설(prettier, 전 코드 적용) · README.md · docs/DEPLOYMENT.md(체크리스트·롤백·백업/복구) · .env.example(AI 변수 포함) · ADR-023 · ARCHITECTURE §7/§8/§10/§14/§15 갱신 · git 저장소 초기화(원격: `hack-rookie37/mobile_wedding`).

## 3. 최종 판정: **Conditionally ready**

코드·테스트·문서는 배포 준비 상태다. 근거는 §4의 실측 결과와 §2의 수정 내역. "Ready"가 아닌 이유 — 아래 조건이 남아 있다:

1. **프로덕션 인프라 미검증**: 지금까지의 모든 검증은 로컬 Supabase 스택 기준이다. 클라우드 Supabase 프로비저닝 → `supabase db push` → Vercel 배포 → DEPLOYMENT.md §1.4 스모크 테스트를 통과해야 Ready.
2. **운영 Auth 정책 미설정**: 로컬 기본은 이메일 확인 없음 — 운영에서 확인 활성·Site URL 설정 필요 (DEPLOYMENT §1.2).
3. **rate limiter는 in-memory**: 서버리스 다중 인스턴스에서는 인스턴스별로 적용된다(우회가 아니라 상한이 N배로 느슨해지는 것 — RSVP는 DB 일일 상한 200이 내구적 2차 방어라 수용, AI는 비용 상한이 느슨해질 수 있음). 트래픽이 실제로 생기면 재검토.
4. **git push 미완료**: 원격 `hack-rookie37/mobile_wedding`에 현재 인증(계정 junghoon26, SSH 키 거부)으로는 push 권한이 없다 — 로컬 커밋까지 완료. 저장소 소유자 권한(collaborator 추가 또는 해당 계정 인증) 필요.

## 4. 검증 결과 (2026-07-20 실측 — `supabase db reset`으로 마이그레이션 4개 전체 체인 재적용 후)

| 검사 | 결과 |
|------|------|
| `format:check` / `lint` / `typecheck` / `check:renderer-units` | ✅ (개별 실행, 종료 코드 확인) |
| `npm test` | ✅ **216 passed** (26 파일) |
| `npm run test:integration` | ✅ **29 passed** — 신규 4: anon 직접 SELECT 거부·발행본 열거 차단, 숨긴 섹션 DB측 제거(계좌 섹션 숨김 발행 → 응답에 부재), 복원 자동 백업(잃었을 초안 회수까지), 발행 중 asset 삭제 거부 → 발행 중단 후 허용 |
| `npm run build` | ✅ Compiled successfully |
| `npm run test:e2e` | ✅ **59 passed (44.2s)** — 생성·편집·undo/redo·업로드·비공개 미리보기·발행·재발행·발행 중단·RSVP 제출·CSV·AI 제안/적용/undo 전 흐름 포함 |
| `npm audit` | moderate 2건 — next 16.2.10 내부 번들 postcss(빌드 타임 한정, 외부 입력 없음). 안정판 패치 부재로 수용, next 업그레이드 시 재확인 (DEPLOYMENT §5) |

## 5. 감사에서 확인한 PASS (수정 불요 — 근거는 ADR·ARCHITECTURE)

- **Architecture**: 편집·공개 단일 renderer(컨테이너 기반, vw/vh/@media 0건 — grep 강제) / action 파이프라인 우회 없음(문서 변경은 전부 dispatch) / 스키마 v5 + 마이그레이션 체인(v1→v5) / 테마 3종 토큰 격리 / RSVP 물리 분리(응답을 담을 스키마 자리 자체가 없음)
- **Security**: service role 키 0곳 · 세션은 middleware getUser 검증 · RLS+GRANT 최소 권한(통합 테스트 검증) · preview 토큰 32자+폐기/만료 · 업로드는 DB mime/크기 제한+경로 소유권 정책 · CSV 수식 주입 방어 · dangerouslySetInnerHTML 0건 · 로그 무기록 정책(RSVP·AI)
- **Data**: 낙관적 동시성(doc_rev) — 두 탭 충돌은 conflict + 배너(덮어쓰기 없음) · 발행 = 불변 스냅샷 · 프로젝트 삭제 = storage 먼저 → DB cascade(RSVP 포함)
- **Performance**: 공개 페이지 RSC + DB 1회(React cache 공유) · CLS 방지(aspect-ratio 자리 예약, 누락 이미지도 동일 크기 placeholder) · hero eager + 이하 lazy · srcSet(썸네일 640w) · next/font self-host swap · 편집기 전용 무거운 의존성(dnd·immer·zustand)은 공개 번들에 없음
- **Responsive**: 공개 360~1440(430px 중앙 컬럼) 고정폭 overflow 없음 · 편집기 min-w 1280 3패널 · 미리보기 360/390/430 전환

## 6. 슬라이스 진행 현황

| 슬라이스 | 상태 |
|----------|------|
| 설계·문서화 / Phase 1 / 3 / 4A / 4B / 5 / 6 / 7 / 8 / 9 / 10 | ✅ |
| **Phase 11 — production readiness audit + 배포 준비** | ✅ 2026-07-20 |
| 다음 후보 | ① 클라우드 Supabase + Vercel 배포(§3 조건 해소 → Ready 승격) ② 실제 provider 키 + 프롬프트 품질 반복(A-21) ③ 발행 전 검증 규칙 + `/i/[slug]` 태그 캐시 |

## 7. 알려진 한계 (post-MVP backlog)

**감사에서 확인, 의도적으로 수정하지 않은 것** (근거 포함):
- 공개 페이지는 매 요청 SSR(캐시 없음) — 항상 최신이 보장되는 대신 트래픽 비용. 태그 캐시는 후속 (ARCHITECTURE §8)
- renderer 전체가 클라이언트 컴포넌트 — 단일 renderer 원칙(ADR-004)의 수용된 비용
- 계정 삭제(auth.users cascade) 시 storage 파일 미정리 — 계정 삭제 기능 자체가 없어 현재 노출 경로 없음. 기능 도입 전에 정리 경로 필수 (DEPLOYMENT §4)
- unpublish 후에도 slug 점유 유지 — 주소 가로채기 방지의 의도된 동작 (ADR-023)
- `duplicateProject`는 다단계 비원자(부분 생성물은 대시보드에서 삭제 가능 — 코드 주석 명시)
- 세션 만료(401)가 일반 '저장 실패'로 표시 — 재로그인 유도 구분은 후속
- 두 탭 충돌 시 지는 탭의 미저장 편집은 병합 없이 폐기(배너 경고) — 안전한 선택
- `/fixture/*`·`/themes` dev 검증 라우트가 운영에서도 공개 — 정적 fixture만 렌더, 사용자 데이터 접근 없음 (e2e가 프로덕션 빌드로 검증하는 데 필요)
- 편집기 커스텀 메뉴의 Escape 닫기 불완전(오버레이 클릭·포커스 이동으로 닫힘) · 32px 아이콘 버튼(WCAG 최소 24px는 충족)
- 헤딩 폰트 한글 서브셋 프리로드 최적화 여지 (본문은 시스템 스택이라 영향 작음)

**기존 이월**: 발행 전 검증 규칙 · slug 리다이렉트 · 이미지 재인코딩(EXIF 제거) · 비밀번호 재설정 · RSVP 자동 파기(retention 구조는 준비됨) · AI 대화 이력 · AI 사진 저해상도 미리보기(승인 UI 필요) · Kakao Maps.

## 8. 로컬 환경

- Node v23.10.0 · npm 10.9.2 · Supabase CLI 2.109.1 + Rancher Desktop
- 셋업·스크립트·마이그레이션: **README.md** / 배포·롤백·백업: **docs/DEPLOYMENT.md**
- e2e는 포트 3100 프로덕션 서버 자체 기동(`AI_PROVIDER=mock`) — 실행 전 오래된 3100 서버 종료
- git: main 브랜치, 원격 origin = `git@github.com:hack-rookie37/mobile_wedding.git` (push 권한 대기 — §3)

## 9. 외부 준비 대기 항목

클라우드 Supabase + Vercel(발행 URL 도메인 확정) / **git push 권한(hack-rookie37/mobile_wedding)** / Anthropic API 키 + 모델 선정(A-21 — adapter·env 준비 완료) / Kakao Maps 키(지도 표시 시) / 제품명·도메인.
