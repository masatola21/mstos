-- 公式HP（Astro）のお役立ち情報が、公開済みの記事だけを読めるようにする。
--
-- これまで mst_ai_acquisition_records のRLSポリシーは「ログイン中の本人(authenticated)のみ」で、
-- HPが使う anon キーでは行が1件も見えず、記事一覧が0件になる恐れがあった。
-- (20261105160000 で anon に SELECT 権限は付与済み。RLSポリシーが無いと行は見えない)
--
-- 公開対象は record_type = 'article' かつ 公開ステータスの行だけ。
-- 下書き・SEO・リライト・成果記録・メディア設定(Deploy Hook等)は anon から見えない。
BEGIN;

DROP POLICY IF EXISTS "Public can read published media articles" ON public.mst_ai_acquisition_records;
CREATE POLICY "Public can read published media articles"
  ON public.mst_ai_acquisition_records FOR SELECT TO anon
  USING (
    record_type = 'article'
    AND (
      status IN ('公開', 'published', '公開済み')
      OR payload->>'publishStatus' IN ('公開', 'published', '公開済み')
    )
  );

COMMIT;
