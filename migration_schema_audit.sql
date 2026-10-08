-- ==============================================================================
-- MST AI経営OS: データベーススキーマ監査・移行リファレンスSQL
-- ファイル名: migration_schema_audit.sql
-- ==============================================================================
-- 【監査概要】
-- 全6テーブル（companies, prospects, leads, products, deals, customers）について、
-- アプリケーションコードとSupabaseの実スキーマを完全照合しました。
--
-- 【方針1: 同じ意味の既存列へ対応させた項目】
-- 1. prospects.contact_date -> 既存の `last_contacted_at` (最終接触日時) に統一
-- 2. deals.deal_name        -> 既存の `proposal_plan_name` (提案プラン名・商談名) に統一
-- 3. deals.stage            -> 既存の `proposal_status` (提案・商談ステータス) に統一
-- 4. deals.amount           -> 既存の `total_amount` (商談総額) に統一
-- 5. deals.notes            -> 既存の `memo` (商談メモ) に統一
-- 6. leads.lead_source      -> 既存の `source` (獲得元) に統一
-- 7. customers.notes        -> 既存の `memo` (顧客メモ) に統一
-- 8. customers.updated_at   -> 既存の `last_updated_at` に統一
-- 9. companies実列サポート  -> `social_account` (SNSアカウント), `postal_code` (郵便番号) をアプリ画面に追加
-- 10. prospects実列サポート -> `approach_method`, `reply_flag`, `last_reply_at`, `email_step`, `memo`, `ai_score`, `ai_reason`, `target_flag` をアプリ画面に追加
-- 11. leads実列サポート     -> `service_type`, `priority_channel`, `line_user_id`, `meeting_date`, `meeting_start_time`, `report_url`, `next_action_at`, `email_step`, `notes` をアプリ画面に追加
-- 12. deals実列サポート     -> `proposal_type`, `initial_fee`, `monthly_fee`, `discount_amount`, `proposal_url`, `proposal_date`, `proposal_created`, `meeting_date`, `next_followup_at` をアプリ画面に追加
--
-- 【方針3: AIが推測で加えたためアプリから除外した項目】
-- 1. leads.score:
--    -> 初期開発時に汎用テンプレートから推測追加された項目。実テーブルには存在せず、
--       leadsには `service_type` や `priority_channel`、`meeting_date` などの業務列が
--       揃っているため、DBへ列を新設せずアプリから完全に削除しました（prospects.ai_scoreの流用も禁止）。
-- 2. prospects.estimated_budget, prospects.next_action:
--    -> 実テーブルには存在せず、商談金額はdeals.total_amountで管理され、次回接触は
--       leads.next_action_at / deals.next_followup_atで管理されるためアプリから削除。
-- 3. leads.contact_person, leads.inquiry_content:
--    -> 担当者情報はcompanies.contact_nameで管理され、相談詳細はleads.notesで管理されるため、
--       推測項目を削除して実スキーマ（notes等）に一本化。
-- 4. deals.probability:
--    -> 実テーブルには存在せず、deals.proposal_statusで進捗ステージを管理するため削除。
-- 5. customers.contract_end_date, customers.mrr, customers.account_manager, customers.health_score:
--    -> 初期開発時に推測追加された項目。実テーブルの契約管理は `contract_status`,
--       `contract_start_date`, `memo`, `last_updated_at` で完結しているためアプリから削除。
--
-- 【結論】
-- アプリケーション側を100%既存DBスキーマに合わせて完全置換したため、
-- DBスキーマへの列追加を行わなくても全画面（一覧・詳細・新規登録・編集・検索）が
-- 完全にエラーなく動作します。既存データや既存スキーマへの破壊的変更は一切ありません。
--
-- ※以下は、検索・参照パフォーマンスを最適化するための非破壊的な安全な推奨インデックスです。
--  （テーブルの変更やデータの削除は一切行われません。Supabase SQL Editorで手動実行可能です）
-- ==============================================================================

-- 外部キー検索の高速化インデックス（安全な追加のみ）
CREATE INDEX IF NOT EXISTS idx_prospects_company_id ON public.prospects(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_product_id ON public.deals(product_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON public.deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);

-- コメント付与（スキーマの意図をDB側に明示）
COMMENT ON COLUMN public.prospects.last_contacted_at IS '最終接触日時';
COMMENT ON COLUMN public.deals.proposal_plan_name IS '提案プラン名・商談名';
COMMENT ON COLUMN public.deals.total_amount IS '想定商談総額 (円)';
COMMENT ON COLUMN public.customers.last_updated_at IS '顧客レコード最終更新日時';
