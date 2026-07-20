-- 업로드 파일 크기 상한 10MB → 20MB (ADR-030)
--
-- 앱이 업로드 직전에 긴 변 1600px로 줄여서 저장하므로, 받아들이는 크기를 키워도
-- 저장·전송량은 늘지 않는다. 폰 원본(4000px 이상, 5~15MB)을 거부하지 않으려는 것이다.
-- 앱 쪽 상한은 src/invitation/assets/uploadPolicy.ts의 MAX_UPLOAD_BYTES — 둘은 같아야 한다.

update storage.buckets
set file_size_limit = 20971520
where id = 'photos';
