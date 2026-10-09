export interface Company {
  id: string; // CID-... 形式のtext (Primary Key)
  company_name: string;
  industry?: string;
  contact_name?: string;
  website?: string;
  email?: string;
  phone?: string;
  social_account?: string;
  postal_code?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Prospect {
  id: string; // uuid (自動生成)
  company_id: string; // references companies.id
  source?: string;
  approach_method?: string;
  status?: string;
  reply_flag?: boolean | string;
  last_reply_at?: string;
  registered_at?: string;
  email_step?: string | number;
  email_step_started_at?: string;
  last_contacted_at?: string;
  memo?: string;
  ai_score?: number;
  ai_reason?: string;
  target_flag?: boolean | string;
  created_at?: string;
  updated_at?: string;
  // Enriched
  company?: Company;
  [key: string]: unknown;
}

export interface Lead {
  id: string; // uuid (自動生成)
  company_id: string; // references companies.id
  line_user_id?: string;
  source?: string;
  service_type?: string;
  status?: string;
  priority_channel?: string;
  first_registered_at?: string;
  last_contacted_at?: string;
  next_action_at?: string;
  meeting_date?: string;
  meeting_start_time?: string;
  report_url?: string;
  email_step?: string | number;
  email_step_started_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Enriched
  company?: Company;
  [key: string]: unknown;
}

export interface Product {
  id: string; // text (Primary Key)
  product_name: string;
  product_type?: string;
  initial_fee?: number;
  monthly_fee?: number;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Deal {
  id: string; // text (Primary Key)
  company_id: string; // references companies.id
  lead_id?: string; // references leads.id (uuid)
  meeting_date?: string;
  next_followup_at?: string;
  product_id?: string; // references products.id (text)
  proposal_plan_name: string;
  proposal_type?: string;
  initial_fee?: number;
  monthly_fee?: number;
  discount_amount?: number;
  total_amount?: number;
  proposal_created?: boolean | string;
  proposal_url?: string;
  proposal_date?: string;
  proposal_status?: string;
  memo?: string;
  created_at?: string;
  updated_at?: string;
  // Enriched
  company?: Company;
  lead?: Lead;
  product?: Product;
  [key: string]: unknown;
}

export interface Customer {
  id: string; // uuid (自動生成)
  company_id: string; // references companies.id (1社1件 unique)
  contract_status?: string;
  contract_start_date?: string;
  last_updated_at?: string;
  memo?: string;
  created_at?: string;
  // Enriched
  company?: Company;
  [key: string]: unknown;
}

export type DiagnosisStatus = 'draft' | 'in_progress' | 'completed' | 'generating' | 'reported';
export type AiReportStatus = 'pending' | 'generating' | 'generated' | 'superseded' | 'failed' | 'reviewed';

export interface Diagnosis {
  id: string; // uuid
  company_id: string; // references companies.id
  lead_id?: string; // references leads.id
  diagnosis_type: string; // 'standard' | 'comprehensive' | 'quick'
  status: DiagnosisStatus;
  questionnaire_version: string; // 'v1.0'
  answers: Record<string, unknown>; // jsonb
  score?: number | null;
  category_scores?: Record<string, number> | null;
  memo?: string | null;
  conducted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched
  company?: Company;
  lead?: Lead;
  latest_report?: AiReport | null;
  [key: string]: unknown;
}

export interface AiReport {
  id: string; // uuid
  diagnosis_id: string; // references diagnoses.id
  version: number;
  is_latest: boolean;
  status: AiReportStatus;
  title: string;
  model_name: string;
  prompt_version: string;
  summary?: string | null;
  strengths?: unknown;
  challenges?: unknown;
  recommendations?: unknown;
  recommended_product_id?: string | null;
  full_report_text?: string | null;
  storage_path?: string | null;
  error_message?: string | null;
  generated_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched
  recommended_product?: Product;
  [key: string]: unknown;
}

// ============================================================================
// Phase 1-D: 回答者向け公開受付 & 専用URL招待（Intake & Invitations）
// ============================================================================

export type InvitationStatus = 'active' | 'submitted' | 'revoked' | 'expired';

export interface DiagnosisInvitation {
  id: string; // uuid
  diagnosis_id: string; // references diagnoses.id
  token_hash: string; // SHA-256 hash
  expires_at: string;
  status: InvitationStatus;
  created_by?: string | null;
  created_at: string;
  used_at?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
  metadata?: Record<string, unknown>;
  // Enriched
  diagnosis?: Diagnosis;
}

export type IntakeStatus = 'pending_review' | 'approved' | 'rejected' | 'merged';
export type IntakeSource = 'line_rich_menu' | 'line_flex' | 'email' | 'lp' | 'other';

export interface TrafficSourceInfo {
  source: IntakeSource;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  landing_path?: string | null;
}

export interface DiagnosisIntake {
  id: string; // uuid
  status: IntakeStatus;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  answers: Record<string, unknown>;
  score?: number | null;
  category_scores?: Record<string, number> | null;
  questionnaire_version: string;
  privacy_agreed_at: string;
  source: IntakeSource;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  landing_path?: string | null;
  reviewer_memo?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  linked_company_id?: string | null;
  linked_diagnosis_id?: string | null;
  created_at: string;
  updated_at: string;
  // Enriched
  linked_company?: Company;
  linked_diagnosis?: Diagnosis;
}

export interface VerifyInvitationResult {
  valid: boolean;
  message?: string;
  expires_at?: string;
  questionnaire_version?: string;
  company_name_masked?: string;
}


export type TableKey = 'companies' | 'prospects' | 'leads' | 'products' | 'deals' | 'customers';

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'url' | 'tel' | 'textarea' | 'date' | 'select' | 'fk_company' | 'fk_lead' | 'fk_product';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  description?: string;
  autoGenerated?: boolean; // 新規作成時は入力不要 (uuid等)
}

export interface TableConfig {
  key: TableKey;
  name: string;
  label: string;
  description: string;
  primaryKey: string;
  pkIsAutoGenerated: boolean;
  fields: FieldDefinition[];
  columnsToShow: string[];
}

export const TABLE_CONFIGS: Record<TableKey, TableConfig> = {
  companies: {
    key: 'companies',
    name: 'companies',
    label: '会社マスタ',
    description: '取引先および対象企業情報の基本台帳 (主キーは CID-xxx 形式のtext)',
    primaryKey: 'id',
    pkIsAutoGenerated: false,
    columnsToShow: ['id', 'company_name', 'industry', 'contact_name', 'phone', 'email'],
    fields: [
      { key: 'id', label: '会社ID (CID-xxx)', type: 'text', required: true, placeholder: '例: CID-001' },
      { key: 'company_name', label: '会社名', type: 'text', required: true, placeholder: '例: 株式会社エムエスティ' },
      { key: 'industry', label: '業種', type: 'text', placeholder: '例: IT・通信, 製造業, 小売' },
      { key: 'contact_name', label: '担当者名', type: 'text', placeholder: '例: 山田 太郎' },
      { key: 'email', label: 'メールアドレス', type: 'email', placeholder: 'example@company.co.jp' },
      { key: 'phone', label: '電話番号', type: 'tel', placeholder: '03-1234-5678' },
      { key: 'social_account', label: 'SNSアカウント', type: 'text', placeholder: '例: @mst_official, LinkedIn' },
      { key: 'website', label: 'Webサイト', type: 'url', placeholder: 'https://example.com' },
      { key: 'postal_code', label: '郵便番号', type: 'text', placeholder: '100-0001' },
      { key: 'address', label: '所在地', type: 'textarea', placeholder: '東京都千代田区...' },
    ]
  },
  prospects: {
    key: 'prospects',
    name: 'prospects',
    label: '見込み企業',
    description: '営業アプローチ対象の見込み企業リスト (実スキーマに100%準拠)',
    primaryKey: 'id',
    pkIsAutoGenerated: true,
    columnsToShow: ['id', 'company_id', 'status', 'source', 'approach_method', 'ai_score', 'last_contacted_at'],
    fields: [
      { key: 'company_id', label: '対象会社', type: 'fk_company', required: true },
      {
        key: 'status',
        label: 'ステータス',
        type: 'select',
        options: [
          { value: '未接触', label: '未接触' },
          { value: 'アプローチ中', label: 'アプローチ中' },
          { value: '検討中', label: '検討中' },
          { value: '商談化', label: '商談化' },
          { value: '保留', label: '保留' }
        ]
      },
      { key: 'source', label: '獲得経路 (ソース)', type: 'text', placeholder: '展示会, Web問合せ, 紹介, テレアポ' },
      { key: 'approach_method', label: 'アプローチ方法', type: 'text', placeholder: 'メール, 電話, 手紙, SNS' },
      {
        key: 'target_flag',
        label: 'アプローチ対象フラグ',
        type: 'select',
        options: [
          { value: 'true', label: '対象 (有効)' },
          { value: 'false', label: '対象外' }
        ]
      },
      {
        key: 'reply_flag',
        label: '返信有無',
        type: 'select',
        options: [
          { value: 'false', label: '未返信' },
          { value: 'true', label: '返信あり' }
        ]
      },
      { key: 'last_contacted_at', label: '最終接触日時', type: 'date', description: '最終接触日時 (last_contacted_at)' },
      { key: 'last_reply_at', label: '最終返信日時', type: 'date', description: '最終返信日時 (last_reply_at)' },
      { key: 'registered_at', label: '登録日時', type: 'date', description: '登録日時 (registered_at)' },
      { key: 'email_step', label: '配信ステップ', type: 'text', placeholder: '例: ステップ1' },
      { key: 'email_step_started_at', label: 'ステップ開始日時', type: 'date' },
      { key: 'ai_score', label: 'AI確度スコア (ai_score)', type: 'number', placeholder: '例: 85' },
      { key: 'ai_reason', label: 'AI評価理由 (ai_reason)', type: 'textarea', placeholder: 'AI分析による評価スコアの根拠' },
      { key: 'memo', label: 'メモ・備考 (memo)', type: 'textarea', placeholder: 'アプローチ履歴や備考' },
    ]
  },
  leads: {
    key: 'leads',
    name: 'leads',
    label: 'リード',
    description: '個別問い合わせ・反響リード管理 (実スキーマに100%準拠)',
    primaryKey: 'id',
    pkIsAutoGenerated: true,
    columnsToShow: ['id', 'company_id', 'status', 'source', 'service_type', 'priority_channel', 'meeting_date'],
    fields: [
      { key: 'company_id', label: '対象会社', type: 'fk_company', required: true },
      {
        key: 'status',
        label: 'リードステータス',
        type: 'select',
        options: [
          { value: '新規', label: '新規' },
          { value: 'ヒアリング済', label: 'ヒアリング済' },
          { value: '商談化', label: '商談化' },
          { value: '失注・対象外', label: '失注・対象外' }
        ]
      },
      { key: 'source', label: 'リード獲得元 (source)', type: 'text', placeholder: 'Web問合せ, セミナー, 紹介' },
      { key: 'service_type', label: '検討サービス種別', type: 'text', placeholder: '例: AI経営OS, DXコンサル' },
      { key: 'priority_channel', label: '優先連絡チャネル', type: 'text', placeholder: '例: メール, 電話, LINE, Slack' },
      { key: 'line_user_id', label: 'LINEユーザーID', type: 'text', placeholder: 'LINE連携ID' },
      { key: 'meeting_date', label: '面談予定日', type: 'date' },
      { key: 'meeting_start_time', label: '面談開始時間', type: 'text', placeholder: '例: 14:00' },
      { key: 'next_action_at', label: '次回アクション日時', type: 'date' },
      { key: 'last_contacted_at', label: '最終接触日時', type: 'date' },
      { key: 'first_registered_at', label: '初回登録日時', type: 'date' },
      { key: 'report_url', label: '診断・レポートURL', type: 'url', placeholder: 'https://...' },
      { key: 'email_step', label: '配信ステップ', type: 'text', placeholder: '例: ステップ1' },
      { key: 'email_step_started_at', label: 'ステップ開始日時', type: 'date' },
      { key: 'notes', label: '相談メモ・詳細 (notes)', type: 'textarea', placeholder: '問い合わせ内容や相談メモ' },
    ]
  },
  products: {
    key: 'products',
    name: 'products',
    label: '商品マスタ',
    description: '提供するサービスおよびプロダクトの料金・仕様マスタ',
    primaryKey: 'id',
    pkIsAutoGenerated: false,
    columnsToShow: ['id', 'product_name', 'product_type', 'monthly_fee', 'initial_fee', 'status'],
    fields: [
      { key: 'id', label: '商品コード (ID)', type: 'text', required: true, placeholder: '例: PRD-001 または AI-ENTERPRISE' },
      { key: 'product_name', label: '商品・サービス名', type: 'text', required: true, placeholder: '例: MST AI経営OS Standard' },
      { key: 'product_type', label: '商品種別', type: 'text', placeholder: '例: SaaS, コンサルティング, 保守サポート' },
      { key: 'initial_fee', label: '初期費用 (円)', type: 'number', placeholder: '300000' },
      { key: 'monthly_fee', label: '月額費用 (円)', type: 'number', placeholder: '100000' },
      {
        key: 'status',
        label: 'ステータス',
        type: 'select',
        options: [
          { value: 'active', label: 'active (販売中)' },
          { value: 'inactive', label: 'inactive (販売停止)' },
          { value: 'draft', label: 'draft (準備中)' }
        ]
      },
      { key: 'description', label: '商品概要・説明', type: 'textarea', placeholder: '商品の特徴や提供内容' },
    ]
  },
  deals: {
    key: 'deals',
    name: 'deals',
    label: '商談',
    description: '個別商談のステータス、商品、金額、提案管理 (実スキーマに100%準拠)',
    primaryKey: 'id',
    pkIsAutoGenerated: false, // text primary key
    columnsToShow: ['id', 'proposal_plan_name', 'company_id', 'product_id', 'proposal_status', 'total_amount', 'proposal_date'],
    fields: [
      { key: 'id', label: '商談ID (text PK)', type: 'text', required: true, placeholder: '例: DEAL-001' },
      { key: 'company_id', label: '取引先会社', type: 'fk_company', required: true },
      { key: 'proposal_plan_name', label: '提案プラン名・商談名', type: 'text', required: true, placeholder: '例: 2026年度 AI業務刷新導入' },
      {
        key: 'proposal_status',
        label: '提案ステータス',
        type: 'select',
        options: [
          { value: '初回面談', label: '初回面談' },
          { value: '要件提案', label: '要件提案' },
          { value: '見積提示', label: '見積提示' },
          { value: '最終交渉', label: '最終交渉' },
          { value: '受注', label: '受注' },
          { value: '失注', label: '失注' }
        ]
      },
      { key: 'product_id', label: '提案商品', type: 'fk_product' },
      { key: 'lead_id', label: '紐づくリード', type: 'fk_lead' },
      { key: 'proposal_type', label: '提案種別', type: 'text', placeholder: '例: 新規導入, アップセル' },
      { key: 'total_amount', label: '想定総額 (円)', type: 'number', placeholder: '例: 3500000' },
      { key: 'monthly_fee', label: '提案月額 (円)', type: 'number', placeholder: '例: 100000' },
      { key: 'initial_fee', label: '提案初期費用 (円)', type: 'number', placeholder: '例: 300000' },
      { key: 'discount_amount', label: '値引き額 (円)', type: 'number', placeholder: '例: 50000' },
      { key: 'meeting_date', label: '面談日', type: 'date' },
      { key: 'proposal_date', label: '提案日', type: 'date' },
      { key: 'next_followup_at', label: '次回フォロー日時', type: 'date' },
      { key: 'proposal_url', label: '提案書URL', type: 'url', placeholder: 'https://...' },
      {
        key: 'proposal_created',
        label: '提案書作成フラグ',
        type: 'select',
        options: [
          { value: 'true', label: '作成済' },
          { value: 'false', label: '未作成' }
        ]
      },
      { key: 'memo', label: '商談メモ・進捗詳細 (memo)', type: 'textarea', placeholder: '商談の経緯や進捗' },
    ]
  },
  customers: {
    key: 'customers',
    name: 'customers',
    label: '顧客',
    description: '契約済み顧客情報 (1会社につき1件の顧客レコード, 実スキーマ準拠)',
    primaryKey: 'id',
    pkIsAutoGenerated: true, // uuid
    columnsToShow: ['id', 'company_id', 'contract_status', 'contract_start_date', 'last_updated_at'],
    fields: [
      { key: 'company_id', label: '契約会社 (1社1件)', type: 'fk_company', required: true },
      {
        key: 'contract_status',
        label: '契約ステータス',
        type: 'select',
        options: [
          { value: '契約中', label: '契約中' },
          { value: 'トライアル', label: 'トライアル' },
          { value: '更新交渉中', label: '更新交渉中' },
          { value: '解約', label: '解約' }
        ]
      },
      { key: 'contract_start_date', label: '契約開始日', type: 'date' },
      { key: 'memo', label: 'カスタマーメモ・契約備考 (memo)', type: 'textarea', placeholder: '契約内容や留意点' },
    ]
  }
};
