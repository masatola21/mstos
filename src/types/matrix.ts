import type { AIWorkModeId } from '../data/aiWorkModes';

export type BusinessCategory = 
  | 'management'        // 経営管理（財務・KPI・意思決定）
  | 'product_dev'       // 商品開発（要件・仕様・ツール作成）
  | 'marketing'         // マーケティング（施策・スケジュール・集客ツール）
  | 'customer_service'; // 顧客サービス（契約書・請求書・サポート）

export interface BusinessCategoryInfo {
  id: BusinessCategory;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export const BUSINESS_CATEGORIES: Record<BusinessCategory, BusinessCategoryInfo> = {
  management: {
    id: 'management',
    name: '経営管理',
    icon: 'Briefcase',
    description: '経営目標、財務サマリー、KPI、AI社長承認・決裁',
    color: 'emerald',
  },
  product_dev: {
    id: 'product_dev',
    name: '商品開発',
    icon: 'Layers',
    description: '要件定義、開発タスク、WBS、社内ツール作成',
    color: 'blue',
  },
  marketing: {
    id: 'marketing',
    name: 'マーケティング',
    icon: 'Megaphone',
    description: 'プロモーション施策、スケジュール管理、集客ツール、LP',
    color: 'purple',
  },
  customer_service: {
    id: 'customer_service',
    name: '顧客サービス管理',
    icon: 'FileText',
    description: '契約書管理、請求書発行・入金管理、納品・サポート',
    color: 'amber',
  },
};

// --- 商品タイプ (Product Archetypes) ---
export type ProductArchetype = 
  | 'service_project'   // システム構築・受託開発・制作
  | 'retainer'          // 顧問サービス・月額コンサル・保守
  | 'digital_asset'     // デジタル商材・教材・テンプレ
  | 'media_content'     // オウンドメディア・アフィリエイト・SNS
  | 'custom';           // 汎用カスタム商品

export interface ProductArchetypeInfo {
  id: ProductArchetype;
  label: string;
  icon: string;
  description: string;
  typicalItems: string[];
  customFieldTemplates: Array<{ key: string; label: string; type: string }>;
}

export const PRODUCT_ARCHETYPES: Record<ProductArchetype, ProductArchetypeInfo> = {
  service_project: {
    id: 'service_project',
    label: 'システム構築・受託開発',
    icon: 'Code2',
    description: '要件定義、マイルストーン、納期、受託契約、着手金・検収請求',
    typicalItems: ['WBSタスク', '基本設計書', '業務委託契約書', '検収書', '分割請求書'],
    customFieldTemplates: [
      { key: 'delivery_date', label: '納品予定日', type: 'date' },
      { key: 'repo_url', label: 'リポジトリURL', type: 'url' },
      { key: 'spec_doc_url', label: '仕様書リンク', type: 'url' },
    ],
  },
  retainer: {
    id: 'retainer',
    label: '顧問・コンサルティング',
    icon: 'Award',
    description: '月次ミーティング、診断フォロー、定期顧問契約、サブスク請求',
    typicalItems: ['定期面談アジェンダ', '月次アドバイザリーレポート', '顧問契約書', '毎月自動請求'],
    customFieldTemplates: [
      { key: 'meeting_cycle', label: '面談頻度 (月n回)', type: 'text' },
      { key: 'contract_duration', label: '契約期間 (ヶ月)', type: 'number' },
      { key: 'monthly_fee', label: '月額報酬 (円)', type: 'number' },
    ],
  },
  digital_asset: {
    id: 'digital_asset',
    label: 'デジタル商材・教材・テンプレ',
    icon: 'Package',
    description: 'コンテンツアセット、販売LP、配布URL、決済連携、マニュアル',
    typicalItems: ['教材コンテンツ', 'セールスコピー・LP', '配布先URL', '購入者サポートFAQ'],
    customFieldTemplates: [
      { key: 'sales_page_url', label: '販売LP URL', type: 'url' },
      { key: 'download_url', label: '受取・配布リンク', type: 'url' },
      { key: 'current_version', label: '現行バージョン', type: 'text' },
    ],
  },
  media_content: {
    id: 'media_content',
    label: 'メディア運営・アフィリエイト',
    icon: 'TrendingUp',
    description: '提携ASP、執筆スケジュール、キーワード選定、報酬管理',
    typicalItems: ['記事制作カレンダー', '提携ASP案件リスト', 'ライター外注契約', 'ASP確定報酬'],
    customFieldTemplates: [
      { key: 'asp_name', label: '提携ASP名 (A8, afb等)', type: 'text' },
      { key: 'affiliate_link', label: 'アフィリエイトリンク', type: 'url' },
      { key: 'target_keyword', label: '対象SEOキーワード', type: 'text' },
      { key: 'expected_pv', label: '目標月間PV', type: 'number' },
    ],
  },
  custom: {
    id: 'custom',
    label: '汎用カスタム商品',
    icon: 'Sparkles',
    description: '独自の業務フローや複数要素を組み合わせたオリジナル商品',
    typicalItems: ['カスタムタスク', '関連ドキュメント', '契約・請求'],
    customFieldTemplates: [
      { key: 'custom_note', label: '特記事項', type: 'text' },
    ],
  },
};

// --- 商品エンティティ（MST既存商品＋拡張情報） ---
export interface ManagedProduct {
  id: string; // PRD-... or id
  name: string;
  code?: string;
  category?: string; // 既存分類
  price?: number;
  /** 営業商品マスタへ公開する初期費用。未設定時は0円。 */
  salesInitialFee?: number;
  /** 営業商品マスタへ公開する月額費用。未設定時は0円。 */
  salesMonthlyFee?: number;
  /** 営業商品マスタに最後に反映した日時 */
  salesCatalogPublishedAt?: number;
  description?: string;
  archetype: ProductArchetype;
  status: 'planning' | 'developing' | 'active' | 'archived';
  customFields?: Record<string, any>;
  kpis?: {
    targetRevenue?: number;
    currentRevenue?: number;
    activeClients?: number;
  };
  createdAt: number;
  updatedAt: number;
}

// --- 契約書エンティティ ---
export type ContractStatus = 'draft' | 'under_review' | 'signed' | 'expired' | 'canceled';
export type ContractType = 'nda' | 'service_agreement' | 'retainer' | 'subcontractor' | 'other';

export interface ManagedContract {
  id: string;
  title: string;
  type: ContractType;
  productId?: string;
  companyId?: string;
  counterpartyName: string; // 契約相手 (社名/氏名)
  status: ContractStatus;
  startDate?: string;
  endDate?: string;
  amount?: number;
  documentUrl?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// --- 請求書エンティティ ---
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'canceled';

export interface ManagedInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  productId?: string;
  companyId?: string;
  recipientName: string;
  amount: number;
  taxAmount?: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  sourceAutomationId?: string;
  createdAt: number;
  updatedAt: number;
}

// --- ツール・プロモーションアセット ---
export interface ManagedToolAsset {
  id: string;
  name: string;
  category: BusinessCategory;
  productId?: string;
  toolType: 'lp' | 'script' | 'sheet' | 'creative' | 'prompt' | 'document';
  url?: string;
  description?: string;
  status: 'active' | 'in_development' | 'deprecated';
  createdAt: number;
}

// --- リスト・カテゴリー管理用カスタムリスト定義 ---
export interface CustomListCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface CustomListDefinition {
  id: string;
  name: string;
  description: string;
  category: BusinessCategory;
  categories: CustomListCategory[];
  itemsCount?: number;
  createdAt: number;
}

// --- AI自動化・承認ルール ---
export type AutomationTriggerEvent = 'diagnosis_submitted' | 'deal_won' | 'contract_signed' | 'invoice_overdue' | 'project_milestone';
export type AutomationAiMode = 'suggest' | 'prepare' | 'execute';
export type AutomationApprovalPolicy = 'always' | 'external_actions' | 'none';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerEvent: AutomationTriggerEvent;
  aiMode: AutomationAiMode;
  approvalPolicy: AutomationApprovalPolicy;
  isEnabled: boolean;
  taskDueInDays: number; // トリガー発生からタスク期限までの日数
  workModeId?: AIWorkModeId; // タスク実行時に使う役割AI
  updatedAt?: number;
}

