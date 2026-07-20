-- 커스텀 폰트 업로드 지원 — asset 종류에 'font' 추가
--
-- 오디오와 같은 규칙이다: 파일은 photos 버킷, 메타는 project_assets, 치수는 없음.
-- 문서는 "custom:<assetId>" 참조만 갖고, 렌더러가 @font-face를 선언한다 (ADR-016).

alter table public.project_assets
  drop constraint project_assets_kind_check,
  drop constraint project_assets_dims_check,
  add constraint project_assets_kind_check check (kind in ('image', 'audio', 'font')),
  -- 이미지만 치수를 갖는다 — 어중간한 행 금지 (fail fast).
  -- 주의: CHECK는 NULL 결과를 통과로 처리하므로 is not null을 명시해야 한다 (null-safe)
  add constraint project_assets_dims_check check (
    (kind = 'image' and width is not null and height is not null and width >= 1 and height >= 1)
    or (kind in ('audio', 'font') and width is null and height is null)
  );

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/mp4',
  'font/woff2', 'font/woff', 'font/ttf', 'font/otf'
]
where id = 'photos';
