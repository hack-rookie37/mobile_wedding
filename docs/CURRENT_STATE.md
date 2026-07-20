# CURRENT_STATE — 프로젝트 현재 상태

- 최종 갱신: 2026-07-21 (섹션 눈썹 라벨·좌우 여백 편집 — ADR-032, 스키마 v10 / 지도 아이콘 깨짐 수정 — ADR-033)
- 갱신 규칙: **각 vertical slice 완료 시, 그리고 중요한 결정·환경 변화 시 이 파일을 갱신한다.** 이 파일은 "지금 어디까지 왔고 다음이 무엇인지"의 단일 소스다.

## 1. 한 줄 요약

**Phase 11(production readiness audit + 배포 준비) 완료 — 최종 판정: Conditionally ready.**
7개 영역(architecture·security·data integrity·accessibility·responsive·performance·e2e)을 감사해 실제 결함 **14건을 수정**했고(핵심: anon이 `publish_records` 직접 조회로 public projection을 우회해 숨긴 계좌·연락처 열람 + 발행 목록 열거가 가능했던 취약점 — RPC 단일 경로로 봉쇄, ADR-023), 배포 문서(README·DEPLOYMENT·.env.example)를 완성했다. 전 검사 green: format·lint·typecheck·renderer-units / 단위 216 / 통합 29 / build / e2e 59. 남은 조건은 §3.

**Phase 11 이후 변경**: 아직 서비스로 열지 않으므로 **공개 가입을 닫았다**(ADR-024) — 로그인 화면에서 회원가입 모드 제거, 계정은 Supabase 대시보드에서 직접 생성, 운영 `enable_signup = false`가 실제 경계(§3-2). admin role은 도입하지 않았다(소유권 모델로 충분, YAGNI). e2e 헬퍼는 가입 UI 대신 anon API로 계정을 만들고 로그인만 UI로 수행한다 — 전 검사 재실행 green(§4).

**지도 앱 아이콘이 하객 화면에서만 깨지던 결함 (ADR-033)**: 인증 미들웨어의 정적 파일 예외가 `public/` **폴더 이름을 열거**하는 방식이라, 나중에 추가된 `map-apps/`가 빠져 있었다. 세션 없는 하객의 `/map-apps/naver.png` 요청이 `/login`으로 307 리다이렉트돼 `<img>`가 PNG 대신 HTML을 받았다. **편집기에서는 로그인 상태라 멀쩡해 보여서 늦게 발견됐다.** 예외를 확장자(`png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf`) 기준으로 바꿔 폴더가 늘어도 다시 깨지지 않게 했다 — `.ics`는 소유자 전용 라우트가 있어 일부러 제외. 하객 컨텍스트에서 아이콘이 200/`image/*`로 오는지 보는 e2e를 붙였다.

**섹션 눈썹 라벨·좌우 여백 (ADR-032, 스키마 v10)**: ① 제목 위 눈썹 라벨("GALLERY"·"INVITATION")을 렌더러가 타입별로 박아 두던 것을 `content.label`로 옮겨 **전부 수정 가능**하게 했다 — 섹션 이름과 라벨이 어긋나던 자리(인사말=INVITATION)를 이제 직접 고친다. 비우면 눈썹 없이 제목만 나온다. 12개 섹션이 `title`을 공유하고 있어 `titledContentSchema`(title+label)를 뽑아 확장하게 했다. ② 좌우 여백을 `style.paddingX`(0~48px) 숫자 하나로 만들고 `bleed` prop을 없앴다 — 24px 고정/풀블리드 이분법이 값 하나가 됐다. **마이그레이션이 그때까지 보이던 값을 그대로 심으므로 기존 문서의 모습은 그대로다**(전면 사진·대형 스트립 0, 나머지 24px). 라벨은 '내용' 탭 맨 위, 여백은 '레이아웃' 탭. 전 검사 green: 단위 262 / e2e 80 / build.

**갤러리 사진 모서리·간격 (ADR-031, 스키마 v9)**: 테마와 레이아웃이 정하던 두 값을 갤러리 섹션의 선택지로 뺐다 — '레이아웃' 탭에서 **각지게/둥글게**와 **간격 0~24px**를 고르고, 대형 스트립을 포함한 모든 레이아웃에 똑같이 적용된다. '둥글게'의 반경은 테마 `radiusPhoto`가 아니라 갤러리 자신의 10px이다(모노크롬은 테마 값이 0px이라 골라도 아무 일이 없었을 것). 마이그레이션은 그때까지 보이던 값을 그대로 심는다(strip 각짐·2px / grid3 6px / grid2·collage 8px / slider 12px, 웜 에디토리얼 기준). **필름·모노크롬 테마 문서는 간격이 바뀌고, 모노크롬의 격자 실선 효과는 사라진다.** '내용' 탭에 중복으로 있던 '사진 세로 길이'도 지웠다(레이아웃 탭이 단일 창구). 전 검사 green: 단위 261 / e2e 79 / build.

**사진 전송량 (ADR-030)**: 폰 원본을 그대로 저장·전송하던 것을 **저장 시 긴 변 1600px로 축소**하도록 바꿨다. (같은 날 개정: 함께 올리려던 업로드 상한 20MB는 **철회하고 10MB를 유지**한다 — 저장할 때 어차피 줄이므로 더 큰 원본을 받을 이유가 얇았다. 버킷 마이그레이션이 운영에 올라가기 전이라 파일째 지웠다.) 무료 플랜 egress 5GB에 하객 500명을 상정한 판단이며, Pro 승급($25/월) 대신 택했다. 실측으로 확인한 것: 기본 갤러리(`grid3`, 144px)에서는 하객이 원본을 받지 않고 640px 썸네일만 받는다 — 원본을 받는 자리는 전면 사진·대형 스트립·약도·사진 확대다. 재인코딩 부수 효과로 EXIF(GPS 포함)가 사라지며, 회전이 풀리지 않도록 `imageOrientation`을 명시했다. **이미 올린 사진은 다시 올려야 줄어든다.** 폰트 업로드도 사진처럼 여러 개를 한 번에 받도록 바꿨다(하나가 실패해도 나머지는 계속 올라간다). 전 검사 green: 단위 260 / 통합 32 / e2e 77 / build.

**커스텀 도메인 라우팅 (ADR-029, DB 마이그레이션 7개째)**: 도메인을 junghoon-eunjin.com으로 붙이면서 **`/` = 하객이 받는 청첩장**, **`/edit` = 대시보드**로 바꿨다. 발행의 기본은 도메인 그 자체다 — `publish_records.slug`를 nullable로 바꿔 **NULL = 루트**로 읽고, 공개 주소를 적어 넣은 발행본만 `/i/<slug>`로 열린다. 루트는 부분 unique 인덱스로 동시에 하나만 살아 있게 막는다(`status='live'` 조건 포함 — 발행 중단하면 놓아준다). RSVP는 `rsvpSlug: string|null`의 null이 '제출 불가'와 '루트'로 겹쳐서 `rsvpTarget`으로 분리했고, `submit_rsvp`는 `is not distinct from`으로 루트를 찾는다. 새 환경변수는 없다. 루트 청첩장의 일정 파일은 `/wedding.ics`. 전 검사 green: 단위 256 / 통합 32 / e2e 75 / build.

**벤치마크 리뉴얼 4차 (ADR-028, 스키마 v8)**: ① 글자 크기를 제목(20px 기준)·본문(15px 기준)으로 분리 — 전역·섹션별 각각, 제목 글꼴을 쓰는 텍스트가 제목 배율을 따른다 ② 테마 색 override(theme.palette: 배경·글자·강조) + 섹션별 글자색 — 흐린 글자색·구분선은 color-mix로 자동 파생, updatePalette action은 AI allowlist 제외 ③ 맺음말을 메인과 대칭으로(SectionShell.flushBottom): 사진이 캔버스 맨 아래에 붙고 제목·본문·공유 버튼이 사진 위에 흰 글씨로 ④ 지도 버튼에 실제 앱 아이콘(public/map-apps) + 3등분 그리드·70px 높이 ⑤ 맺음말 눈썹 라벨(THANK YOU) 제거·상하 여백 0(사진이 위아래 끝까지) ⑥ 마음 전하실 곳 눈썹 라벨 GIFT→REGISTRY. 전 검사 green: 단위 246 / 통합 32 / e2e 73 / build.

**벤치마크 리뉴얼 3차 (ADR-027, 스키마 변경 없음)**: ① 수치 입력(pt·밝기·투명도)에서 슬라이더를 전용 줄로 내리고 숫자 칸을 라벨 줄로 올려 조작 충돌 제거 — 타이핑 중 범위로 자르던 동작을 확정(blur) 시점으로 옮겨 "12"가 "72"→20이 되던 버그 수정 ② 반짝임을 지나가는 빛줄기에서 별빛 8개가 깜빡이는 효과로 교체 ③ 지도 버튼에 앱 아이콘(인라인 SVG) 부착·"네이버 지도"→"네이버" ④ 편집기 미리보기 바탕을 게스트 화면과 같은 토큰(`--color-canvas-backdrop`)으로 통일 — 종이색은 원래 같았고 tool 회색 바탕·테두리 때문에 탁해 보이던 것. 샘플의 가족 관계 표기를 "장남/차녀"→"아들/딸"로. 전 검사 green: 단위 245 / e2e 71 / build.

**벤치마크 리뉴얼 2차 (ADR-026, 스키마 v7·DB 마이그레이션 6개째)**: ① 메인을 전면 사진 단일 레이아웃으로 통일하고 '레이아웃' 탭을 사진 효과(페이드아웃·반짝임·밝기·투명도) 편집기로 전환 — 상하 여백 설정 시 사진 위에 빈 공간이 생기던 버그(축약형/개별형 padding 혼용) 수정 ② 글자 크기를 3단계 enum에서 pt 직접 입력(7~20pt, 전역·섹션별)으로 ③ 커스텀 폰트 업로드(asset kind에 font 추가, 렌더러가 @font-face 선언) ④ 진입 애니메이션을 고르면 미리보기에서 그 자리에서 재생 ⑤ 갤러리 필름 제거·세로 길이를 레이아웃 탭으로(strip·slider 적용) ⑥ 약도를 제목 바로 아래로 ⑦ 맺음말도 전면 사진 + 밝기·투명도. 샘플 데이터를 실제 예식 정보(이정훈·양은진 / 공군호텔 / 2026-09-19)로 교체. 전 검사 green: 단위 245 / 통합 32 / e2e 69 / build.

**벤치마크 리뉴얼 1차 (ADR-025, 스키마 v6·DB 마이그레이션 5개째)**: ① 전면 히어로(풀블리드+하단 페이드, 세로 비율 조절) ② 달력 가로 확장+실시간 카운트다운(일:시:분:초) ③ 갤러리 대형 스트립(88% 가로 스냅) ④ 오시는 길(약도 이미지·지도 앱 브랜드 버튼·예식장 이름 검색) ⑤ RSVP 바텀시트 ⑥ 배경음악(asset kind 도입, mp3/m4a 업로드, 게스트 토글) ⑦ 폰트(전역/섹션별 선택+크기 3단계, 나눔명조·고운바탕·고운돋움 추가). 전 검사 green: 단위 233 / 통합 32 / e2e 61 / build. 남은 후속: 커스텀 폰트 업로드(asset kind 재사용), 벤치마크 세부 폴리시.

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
2. **운영 Auth 정책 미설정**: 로컬 기본은 이메일 확인 없음 — 운영에서 확인 활성·Site URL 설정 필요. 특히 **공개 가입 차단(`enable_signup = false`)은 운영 대시보드에서만 적용된다** — 로그인 화면에서 회원가입 UI는 제거했지만(ADR-024) anon 키가 공개라 UI 제거만으로는 차단되지 않는다. 로컬 `config.toml`은 테스트 때문에 가입이 켜져 있으므로 코드로 보장되지 않는 항목이다 (DEPLOYMENT §1.2 체크리스트 + 배포 후 거부 확인 스모크 테스트).
3. **rate limiter는 in-memory**: 서버리스 다중 인스턴스에서는 인스턴스별로 적용된다(우회가 아니라 상한이 N배로 느슨해지는 것 — RSVP는 DB 일일 상한 200이 내구적 2차 방어라 수용, AI는 비용 상한이 느슨해질 수 있음). 트래픽이 실제로 생기면 재검토.

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
- git: main 브랜치, 원격 origin = `https://github.com/hack-rookie37/mobile_wedding.git` (push 완료)
  - 이 저장소만 hack-rookie37 계정을 쓴다(전역 설정은 회사 계정 유지): 로컬 `user.name`/`user.email`을
    GitHub noreply로 지정하고, credential helper를 `gh auth git-credential`로 고정했다.
    `gh auth switch`로 활성 계정을 바꾸면 이 저장소 push가 막힌다.
- 로그인 계정은 Supabase Studio → Authentication → Users에서 직접 만든다 (가입 화면 없음 — ADR-024)

## 9. 외부 준비 대기 항목

클라우드 Supabase + Vercel(발행 URL 도메인 확정) / Anthropic API 키 + 모델 선정(A-21 — adapter·env 준비 완료) / Kakao Maps 키(지도 표시 시) / 제품명·도메인.
