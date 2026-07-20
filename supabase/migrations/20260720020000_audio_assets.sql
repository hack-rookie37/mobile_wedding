-- 배경음악(BGM) 지원 — asset 종류(kind) 도입
--
-- 지금까지 project_assets는 이미지 전용이었다(width/height NOT NULL, 이미지 mime만).
-- 오디오 asset을 같은 저장 경계(ADR-016) 안에서 다루기 위해:
--  1) kind 컬럼('image'|'audio') 추가 — 기존 행은 전부 image
--  2) width/height를 kind 조건부로 완화 — 이미지는 여전히 필수, 오디오는 null
--  3) photos 버킷 mime 허용에 오디오(mp3·m4a) 추가
--  4) get_preview_by_token 반환에 kind 포함 (앱 manifest가 kind로 이미지/오디오를 구분)

alter table public.project_assets
  add column kind text not null default 'image',
  alter column width drop not null,
  alter column height drop not null;

alter table public.project_assets
  drop constraint project_assets_width_check,
  drop constraint project_assets_height_check,
  add constraint project_assets_kind_check check (kind in ('image', 'audio')),
  -- 이미지는 치수 필수, 오디오는 치수 없음 (둘 다 아닌 어중간한 행 금지 — fail fast).
  -- 주의: CHECK는 NULL 결과를 통과로 처리하므로 is not null을 명시해야 한다 (null-safe)
  add constraint project_assets_dims_check check (
    (kind = 'image' and width is not null and height is not null and width >= 1 and height >= 1)
    or (kind = 'audio' and width is null and height is null)
  );

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/mp4'
]
where id = 'photos';

-- 비공개 미리보기 asset에 kind 포함 (기존 함수 교체 — 시그니처 동일)
create or replace function public.get_preview_by_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_project_id uuid;
  v_doc public.invitation_documents%rowtype;
  v_assets jsonb;
begin
  select project_id into v_project_id
  from public.preview_links
  where token = p_token and (expires_at is null or expires_at > now());
  if v_project_id is null then
    return null; -- 무효·폐기·만료 토큰은 구분 없이 거부 (존재 여부 비노출)
  end if;

  select * into v_doc from public.invitation_documents where project_id = v_project_id;
  if v_doc.project_id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', a.id, 'kind', a.kind, 'storagePath', a.storage_path, 'thumbPath', a.thumb_path,
      'width', a.width, 'height', a.height
    )), '[]'::jsonb)
  into v_assets
  from public.project_assets a
  where a.project_id = v_project_id;

  return jsonb_build_object(
    'doc', v_doc.doc,
    'schemaVersion', v_doc.schema_version,
    'assets', v_assets
  );
end;
$$;
