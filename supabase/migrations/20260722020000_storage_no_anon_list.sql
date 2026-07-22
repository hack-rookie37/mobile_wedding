-- photos 버킷의 anon 열거(list)를 막는다.
--
-- 배경: 하객 사진은 '공개 버킷'의 공개 URL로 서빙된다(/a/ 프록시 포함). 공개 버킷의 공개
-- 엔드포인트 다운로드는 RLS를 거치지 않으므로, storage.objects의 SELECT 정책은 사실상
-- '목록(list)·관리 API'에만 관여한다. 그런데 기존 정책은 anon에게 버킷 전체 SELECT를 줬다:
--
--   create policy "photos: 공개 읽기" on storage.objects for select to anon, authenticated
--     using (bucket_id = 'photos');
--
-- 이 때문에 공개 anon 키만으로 storage list API를 호출해 '모든 프로젝트'의 업로드 경로
-- (projects/<uuid>/... — 한 번도 발행하지 않은 draft 포함)를 열거할 수 있었다.
-- init.sql의 "uuid 경로로 열거 불가"라는 주석은 틀린 전제였다(경로를 몰라도 목록이 나온다).
--
-- 조치: 공개 URL 다운로드는 그대로 두고(공개 버킷이라 이 정책과 무관하게 동작한다) '열거'만 막는다.
--   anon         : SELECT 제거 — 하객은 발행 payload가 준 공개 URL로만 받는다.
--   authenticated: 자기 프로젝트 경로만 SELECT — 소유자 관리 흐름은 살리되 교차 열람은 막는다.
--
-- 가역적이다(옛 정책을 다시 만들면 원복). 데이터는 건드리지 않는다(정책 DDL만).

drop policy "photos: 공개 읽기" on storage.objects;

create policy "photos: 소유자 목록" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.storage_path_owned(name));
