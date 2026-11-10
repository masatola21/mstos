-- OSの「商品・ツール掲載管理」で登録した商品・ツール（record_type = 'product'）も、
-- 公式HPが公開済みのものだけ読めるようにする。
-- 20261110100000 で作成した記事用ポリシーを、記事＋商品の両方が対象になるよう作り直す。
--
-- 公開対象は record_type が 'article' または 'product' で、公開ステータスの行だけ。
-- 下書き・非公開・SEO・リライト・成果記録・メディア設定(Deploy Hook等)は anon から見えない。
BEGIN;

DROP POLICY IF EXISTS "Public can read published media articles" ON public.mst_ai_acquisition_records;
DROP POLICY IF EXISTS "Public can read published hp content" ON public.mst_ai_acquisition_records;
CREATE POLICY "Public can read published hp content"
  ON public.mst_ai_acquisition_records FOR SELECT TO anon
  USING (
    record_type IN ('article', 'product')
    AND (
      status IN ('公開', 'published', '公開済み')
      OR payload->>'publishStatus' IN ('公開', 'published', '公開済み')
    )
  );

COMMIT;
