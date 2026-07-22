-- publish_project에 expected_rev 낙관적 동시성 가드를 더한다 (ADR-041).
--
-- 배경: 발행 스냅샷의 asset manifest는 호출부(TS `persistence.publish`)가 '그 시점 draft가
-- 참조하는 것'으로 걸러 넘긴다(올렸다 뺀·숨긴 섹션 전용 사진을 스냅샷에서 빼기 위해). 그런데
-- 이 RPC는 '현재 draft'를 잠그고 스냅샷하므로, 호출부가 필터에 쓴 doc과 여기서 스냅샷하는 doc이
-- 어긋나면(그 사이 save로 doc_rev가 바뀌면) manifest와 doc이 맞지 않는 스냅샷이 커밋될 수 있다.
-- TS쪽 재시도는 이미 커밋된 뒤라 '어긋난 스냅샷이 잠깐 live'가 되는 창을 못 막는다(직접 RPC·
-- cold ISR이 그 사이 읽을 수 있다).
--
-- 해결: p_expected_rev를 받아, 행을 잠근 뒤 doc_rev가 다르면 '아무것도 쓰지 않고' rev_changed로
-- 되돌린다. 호출부가 최신 doc으로 다시 필터해 재시도한다 — 어긋난 스냅샷은 커밋된 적조차 없다.
-- 이전 발행 상태도 그대로 보존된다(rev_changed 경로는 upsert에 닿지 않는다).
--
-- 직접 호출부는 persistence.publish 하나뿐이라 시그니처를 3→4인자로 바꾼다(가역적, 데이터 불변).

drop function public.publish_project(uuid, text, jsonb);

create function public.publish_project(
  p_project_id uuid,
  p_slug text,
  p_assets jsonb,
  p_expected_rev integer
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_doc public.invitation_documents%rowtype;
  v_revision_id uuid;
  v_constraint text;
begin
  select * into v_doc from public.invitation_documents
  where project_id = p_project_id
  for update;
  if v_doc.project_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- 잠근 뒤 rev가 호출부가 필터에 쓴 것과 다르면, 넘어온 manifest가 이 doc과 맞지 않는다 →
  -- 아무것도 쓰지 않고 되돌린다(어긋난 스냅샷을 커밋하지 않는다). 호출부가 최신으로 재시도한다.
  -- IS DISTINCT FROM: p_expected_rev가 NULL이어도 `<>`처럼 unknown이 되어 가드를 통과시키지
  -- 않는다 — NULL은 '다름'으로 보고 거부한다(가드가 조용히 우회되지 않도록 null-safe하게).
  if v_doc.doc_rev is distinct from p_expected_rev then
    return jsonb_build_object('status', 'rev_changed', 'currentRev', v_doc.doc_rev);
  end if;

  begin
    -- 발행 시점의 안정된 revision 보장: 현재 rev의 revision이 없으면 'publish'로 생성
    select id into v_revision_id from public.revisions
    where project_id = p_project_id and rev = v_doc.doc_rev;
    if v_revision_id is null then
      insert into public.revisions (project_id, rev, kind, label, doc, schema_version)
      values (p_project_id, v_doc.doc_rev, 'publish', '발행 스냅샷', v_doc.doc, v_doc.schema_version)
      returning id into v_revision_id;
    end if;

    insert into public.publish_records
      (project_id, slug, doc, schema_version, assets, status, published_at, published_rev, revision_id)
    values
      (p_project_id, p_slug, v_doc.doc, v_doc.schema_version, p_assets, 'live', now(),
       v_doc.doc_rev, v_revision_id)
    on conflict (project_id) do update set
      slug = excluded.slug,
      doc = excluded.doc,
      schema_version = excluded.schema_version,
      assets = excluded.assets,
      status = 'live',
      published_at = excluded.published_at,
      published_rev = excluded.published_rev,
      revision_id = excluded.revision_id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'publish_records_slug_key' then
      return jsonb_build_object('status', 'slug_taken');
    end if;
    if v_constraint = 'publish_records_single_live_root' then
      return jsonb_build_object('status', 'root_taken');
    end if;
    raise;
  end;

  return jsonb_build_object(
    'status', 'published',
    'slug', p_slug,
    'publishedRev', v_doc.doc_rev,
    'revisionId', v_revision_id
  );
end;
$$;

grant execute on function public.publish_project(uuid, text, jsonb, integer) to authenticated;
