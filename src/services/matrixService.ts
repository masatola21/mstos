import { AI_WORK_MODES } from '../data/aiWorkModes';
import {
  ManagedProduct,
  ManagedContract,
  ManagedInvoice,
  ManagedToolAsset,
  CustomListDefinition,
  AutomationRule,
  BusinessCategory,
} from '../types/matrix';

const pendingDeletionMemory = new Map<string, { contracts: Set<string>; invoices: Set<string> }>();

const MATRIX_STORAGE_KEYS = {
  PRODUCTS: 'mst_matrix_products_v1',
  PRODUCTS_SEED_VERSION: 'mst_matrix_products_seed_version',
  CONTRACTS: 'mst_matrix_contracts_v1',
  INVOICES: 'mst_matrix_invoices_v1',
  TOOLS: 'mst_matrix_tools_v1',
  CUSTOM_LISTS: 'mst_matrix_custom_lists_v1',
  AUTOMATIONS: 'mst_matrix_automations_v1',
  PENDING_DELETIONS: 'mst_pending_deletions_v1:',
};

// --- Initial Seed Products (covering all archetypes) ---
const INITIAL_PRODUCTS: ManagedProduct[] = [
  {
    id: 'prd-sys-01',
    name: 'AI統合基幹システム受託開発',
    code: 'SYS-AI-01',
    category: 'システム構築',
    archetype: 'service_project',
    price: 3500000,
    description: '顧客専用の独自業務自動化・AIエージェント組込Webシステム構築',
    status: 'active',
    customFields: {
      delivery_date: '2026-12-15',
      repo_url: 'https://github.com/client-org/ai-core-system',
      spec_doc_url: 'https://docs.google.com/document/d/spec-sys-01',
    },
    kpis: {
      targetRevenue: 5000000,
      currentRevenue: 3500000,
      activeClients: 2,
    },
    createdAt: Date.now() - 30 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'prd-ret-02',
    name: '月額AI経営顧問・伴走支援',
    code: 'ADV-RET-01',
    category: '顧問サービス',
    archetype: 'retainer',
    price: 250000,
    description: '月2回の戦略MTG、AI社長フレームワーク導入、継続的な業務改善伴走',
    status: 'active',
    customFields: {
      meeting_cycle: '月2回 (第2・第4水曜)',
      contract_duration: 12,
      monthly_fee: 250000,
    },
    kpis: {
      targetRevenue: 3000000,
      currentRevenue: 1500000,
      activeClients: 6,
    },
    createdAt: Date.now() - 60 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'prd-dig-03',
    name: 'AI業務効率化プロンプト＆テンプレート集',
    code: 'DIG-TMP-01',
    category: 'デジタル商材',
    archetype: 'digital_asset',
    price: 49800,
    description: '即戦力プロンプト100選＋経営ダッシュボード設定テンプレート',
    status: 'active',
    customFields: {
      sales_page_url: 'https://mst-ai.example.com/lp/prompt-templates',
      download_url: 'https://storage.example.com/assets/prompt-v2.zip',
      current_version: 'v2.1',
    },
    kpis: {
      targetRevenue: 1000000,
      currentRevenue: 747000,
      activeClients: 15,
    },
    createdAt: Date.now() - 45 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'prd-med-04',
    name: 'AI経営トランスフォーメーション情報メディア',
    code: 'MED-AFF-01',
    category: 'メディア・アフィリ',
    archetype: 'media_content',
    price: 0,
    description: 'SaaS比較・AIツール解説記事メディア。ASP提携及びリード獲得導線',
    status: 'active',
    customFields: {
      asp_name: 'A8.net / afb / ValueCommerce',
      affiliate_link: 'https://px.a8.net/svt/example',
      target_keyword: '中小企業 AI 導入事例 費用',
      expected_pv: 50000,
    },
    kpis: {
      targetRevenue: 500000,
      currentRevenue: 320000,
      activeClients: 4,
    },
    createdAt: Date.now() - 90 * 86400000,
    updatedAt: Date.now(),
  },
];

// --- User-provided default business catalog ---
const BUSINESS_DEFAULT_PRODUCTS: ManagedProduct[] = [
  { id: "A001", name: "経営伴走顧問（ライト）", code: "A001", category: "経営顧問", archetype: "retainer", price: 70000, salesInitialFee: 0, salesMonthlyFee: 70000, description: "売上・利益の課題整理と改善優先順位の明確化", status: "active", customFields: {"contractType":"月額","phase":"戦略設計","usageCategory":"顧問","proposalOrder":1,"normalTransitionTarget":"A002","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "A002", name: "経営改善顧問（スタンダード）", code: "A002", category: "経営顧問", archetype: "retainer", price: 120000, salesInitialFee: 0, salesMonthlyFee: 120000, description: "業務構造を再設計し利益改善を実行支援", status: "active", customFields: {"contractType":"月額","phase":"戦略設計","usageCategory":"顧問","proposalOrder":2,"normalTransitionTarget":"A003","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "A003", name: "経営参謀顧問", code: "A003", category: "経営顧問", archetype: "retainer", price: 180000, salesInitialFee: 0, salesMonthlyFee: 180000, description: "経営戦略・意思決定支援・利益最大化支援", status: "active", customFields: {"contractType":"月額","phase":"戦略設計","usageCategory":"顧問","proposalOrder":3,"normalTransitionTarget":"C001","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "B001", name: "単体業務システム構築", code: "B001", category: "業務システム構築", archetype: "service_project", price: 300000, salesInitialFee: 300000, salesMonthlyFee: 0, description: "案件・見積・請求など単一業務の仕組み化", status: "active", customFields: {"contractType":"単発","phase":"業務実装","usageCategory":"単体構築","proposalOrder":4,"normalTransitionTarget":"B001","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "B002", name: "標準業務システム構築", code: "B002", category: "業務システム構築", archetype: "service_project", price: 600000, salesInitialFee: 600000, salesMonthlyFee: 0, description: "2〜3機能連携による業務改善システム構築", status: "active", customFields: {"contractType":"単発","phase":"業務実装","usageCategory":"標準構築","proposalOrder":5,"normalTransitionTarget":"B002","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "B003", name: "統合業務システム構築", code: "B003", category: "業務システム構築", archetype: "service_project", price: 1000000, salesInitialFee: 1000000, salesMonthlyFee: 0, description: "4〜6機能統合＋ダッシュボード設計", status: "active", customFields: {"contractType":"単発","phase":"業務実装","usageCategory":"統合構築","proposalOrder":6,"normalTransitionTarget":"B003","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "C001", name: "経営統合OS構築", code: "C001", category: "経営OS", archetype: "service_project", price: 1000000, salesInitialFee: 1000000, salesMonthlyFee: 0, description: "顧客・案件・請求を統合した経営基盤構築", status: "active", customFields: {"contractType":"単発","phase":"経営統合","usageCategory":"経営基盤","proposalOrder":7,"normalTransitionTarget":"C001","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "D001", name: "AI診断構築", code: "D001", category: "業務・経営自動化", archetype: "service_project", price: 300000, salesInitialFee: 300000, salesMonthlyFee: 0, description: "課題分析・診断・提案を自動化するAI構築", status: "active", customFields: {"contractType":"単発","phase":"AI強化","usageCategory":"AI診断","proposalOrder":8,"normalTransitionTarget":"D001","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "D002", name: "AI業務アシスト構築", code: "D002", category: "業務・経営自動化", archetype: "service_project", price: 500000, salesInitialFee: 500000, salesMonthlyFee: 0, description: "提案書・見積・文章作成など業務支援AI構築", status: "active", customFields: {"contractType":"単発","phase":"AI強化","usageCategory":"AIアシスト","proposalOrder":9,"normalTransitionTarget":"D002","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "D003", name: "AI自動化構築", code: "D003", category: "業務・経営自動化", archetype: "service_project", price: 800000, salesInitialFee: 800000, salesMonthlyFee: 30000, description: "GAS連携・業務フロー自動化構築", status: "active", customFields: {"contractType":"ハイブリッド","phase":"AI強化","usageCategory":"AI自動化","proposalOrder":10,"normalTransitionTarget":"D003","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "D004", name: "AI経営統合OS構築", code: "D004", category: "業務・経営自動化", archetype: "service_project", price: 1500000, salesInitialFee: 1500000, salesMonthlyFee: 30000, description: "AI＋GAS＋CRM統合による経営自動化基盤", status: "active", customFields: {"contractType":"ハイブリッド","phase":"AI強化","usageCategory":"AI経営OS","proposalOrder":11,"normalTransitionTarget":"D004","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "M001", name: "システム保守・改善", code: "M001", category: "保守・運用", archetype: "retainer", price: 30000, salesInitialFee: 0, salesMonthlyFee: 30000, description: "構築後の改善・軽微修正・運用支援", status: "active", customFields: {"contractType":"月額","phase":"運用","usageCategory":"保守","proposalOrder":12,"normalTransitionTarget":"M001","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T001", name: "B001単体業務モニター", code: "T001", category: "モニター", archetype: "service_project", price: 100000, salesInitialFee: 100000, salesMonthlyFee: 0, description: "案件・見積・請求など単一業務の仕組み化検証（B001相当）", status: "developing", customFields: {"contractType":"単発","phase":"業務システム検証","usageCategory":"B001","proposalOrder":1,"normalTransitionTarget":"B001","monitorConditions":"事例掲載・感想提供","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T002", name: "B002標準業務モニター", code: "T002", category: "モニター", archetype: "service_project", price: 250000, salesInitialFee: 250000, salesMonthlyFee: 0, description: "2〜3機能連携による業務改善システム検証（B002相当）", status: "developing", customFields: {"contractType":"単発","phase":"業務システム検証","usageCategory":"B002","proposalOrder":2,"normalTransitionTarget":"B002","monitorConditions":"事例掲載・感想提供","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T003", name: "B001単体業務モニター（案件管理）", code: "T003", category: "モニター", archetype: "service_project", price: 100000, salesInitialFee: 100000, salesMonthlyFee: 0, description: "案件管理システム導入の検証（B001相当）", status: "developing", customFields: {"contractType":"単発","phase":"業務システム検証","usageCategory":"B001","proposalOrder":3,"normalTransitionTarget":"B001","monitorConditions":"事例掲載・感想提供","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T004", name: "B002標準業務モニター（工程管理）", code: "T004", category: "モニター", archetype: "service_project", price: 250000, salesInitialFee: 250000, salesMonthlyFee: 0, description: "工程管理・進捗可視化の仕組み検証（B002相当）", status: "developing", customFields: {"contractType":"単発","phase":"業務システム検証","usageCategory":"B002","proposalOrder":4,"normalTransitionTarget":"B002","monitorConditions":"事例掲載・感想提供","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T005", name: "B001単体業務モニター（見積管理）", code: "T005", category: "モニター", archetype: "service_project", price: 100000, salesInitialFee: 100000, salesMonthlyFee: 0, description: "見積業務の標準化・効率化検証（B001相当）", status: "developing", customFields: {"contractType":"単発","phase":"業務システム検証","usageCategory":"B001","proposalOrder":5,"normalTransitionTarget":"B001","monitorConditions":"事例掲載・感想提供","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T006", name: "B002標準業務モニター（請求・入金）", code: "T006", category: "モニター", archetype: "service_project", price: 250000, salesInitialFee: 250000, salesMonthlyFee: 0, description: "請求・入金管理の一元化検証（B002相当）", status: "developing", customFields: {"contractType":"単発","phase":"業務システム検証","usageCategory":"B002","proposalOrder":6,"normalTransitionTarget":"B002","monitorConditions":"事例掲載・感想提供・月1回ヒアリング協力","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T007", name: "C001経営OSモニター", code: "T007", category: "モニター", archetype: "service_project", price: 500000, salesInitialFee: 500000, salesMonthlyFee: 0, description: "顧客・案件・請求の統合構造検証（C001相当）", status: "developing", customFields: {"contractType":"単発","phase":"経営OS検証","usageCategory":"C001","proposalOrder":7,"normalTransitionTarget":"C001","monitorConditions":"事例掲載・感想提供・月1回ヒアリング協力","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "T008", name: "D004AI経営OSモニター", code: "T008", category: "モニター", archetype: "service_project", price: 700000, salesInitialFee: 700000, salesMonthlyFee: 0, description: "AI診断・提案・自動化・統合経営OSの検証（D004相当）", status: "developing", customFields: {"contractType":"単発","phase":"AI統合検証","usageCategory":"D004","proposalOrder":8,"normalTransitionTarget":"D004","monitorConditions":"事例掲載・感想提供・月1回ヒアリング協力","statusLabel":"テスト中"}, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "E001", name: "介護保険外サービス開業パッケージ", code: "E001", category: "開業支援", archetype: "service_project", price: 1150000, salesInitialFee: 1150000, salesMonthlyFee: 10000, description: "介護保険外サービスの開業に関するトータルサポート。①事業設計支援（市場調査・収支計画・事業計画策定）②集客基盤構築（HP・SNS・チラシ・名刺等の制作）③業務システム導入（顧客管理・請求・給与管理）④開業サポート（全10回の実践サポート）", status: "active", customFields: {"contractType":"ハイブリッド","phase":"開業支援","usageCategory":"開業パッケージ","proposalOrder":13,"normalTransitionTarget":"","monitorConditions":"","statusLabel":"提供中"}, createdAt: Date.now(), updatedAt: Date.now() },
];

// --- Initial Seed Contracts ---
export const SAMPLE_RECORD_IDS = {
  contracts: new Set(['cnt-001', 'cnt-002', 'cnt-003', 'cnt-004']),
  invoices: new Set(['inv-202610-01', 'inv-202610-02', 'inv-202610-03', 'inv-202609-04']),
  tools: new Set(['tool-01', 'tool-02', 'tool-03']),
};

const INITIAL_CONTRACTS: ManagedContract[] = [];

// --- Initial Seed Invoices ---
const INITIAL_INVOICES: ManagedInvoice[] = [];

// --- Initial Seed Tools ---
const INITIAL_TOOLS: ManagedToolAsset[] = [];

// --- 標準AI自動化・承認ルール（未接続の設定テンプレート） ---
const INITIAL_AUTOMATIONS: AutomationRule[] = [
  { id: 'workflow-diagnosis-submitted', name: '診断回答の確認・分析', description: '診断フォームの回答を整理し、課題・追加確認事項・改善案をまとめる。', triggerEvent: 'diagnosis_submitted', aiMode: 'prepare', approvalPolicy: 'always', isEnabled: false, taskDueInDays: 3, workModeId: 'diagnosis' },
  { id: 'workflow-deal-won', name: '商談成約後の準備', description: '成約した商談から契約・キックオフの準備項目を作成する。顧客への連絡前に担当者が確認する。', triggerEvent: 'deal_won', aiMode: 'prepare', approvalPolicy: 'external_actions', isEnabled: false, taskDueInDays: 3, workModeId: 'customer_product' },
  { id: 'workflow-contract-signed', name: '契約締結後の請求準備', description: '締結済み契約をもとに請求内容の初稿を準備し、発行前に担当者が確認する。', triggerEvent: 'contract_signed', aiMode: 'prepare', approvalPolicy: 'always', isEnabled: false, taskDueInDays: 3, workModeId: 'customer_product' },
  { id: 'workflow-invoice-overdue', name: '請求期限超過の対応案', description: '期限を過ぎた請求を検出し、社内通知や顧客への連絡案を作成する。', triggerEvent: 'invoice_overdue', aiMode: 'suggest', approvalPolicy: 'always', isEnabled: false, taskDueInDays: 1, workModeId: 'president' },
  { id: 'workflow-project-milestone', name: '支援マイルストーンの振り返り', description: '支援の節目に進捗・課題を要約し、次の対応案を提示する。', triggerEvent: 'project_milestone', aiMode: 'suggest', approvalPolicy: 'external_actions', isEnabled: false, taskDueInDays: 3, workModeId: 'customer_product' },
];

export function normalizeAutomationRules(value: unknown): AutomationRule[] {
  const saved = Array.isArray(value) ? value as Partial<AutomationRule>[] : [];
  return INITIAL_AUTOMATIONS.map((preset) => {
    const existing = saved.find((item) => item && item.id === preset.id);
    if (!existing || !('aiMode' in existing) || !('approvalPolicy' in existing) || !('isEnabled' in existing)) return { ...preset };
    const aiMode = existing.aiMode === 'suggest' || existing.aiMode === 'prepare' || existing.aiMode === 'execute' ? existing.aiMode : preset.aiMode;
    const approvalPolicy = existing.approvalPolicy === 'always' || existing.approvalPolicy === 'external_actions' || existing.approvalPolicy === 'none' ? existing.approvalPolicy : preset.approvalPolicy;
    const dueDays = Number.isFinite(Number(existing.taskDueInDays)) ? Math.min(90, Math.max(1, Math.floor(Number(existing.taskDueInDays)))) : preset.taskDueInDays;
    const workModeId = AI_WORK_MODES.some((mode) => mode.id === existing.workModeId) ? existing.workModeId : preset.workModeId;
    return { ...preset, aiMode, approvalPolicy, isEnabled: Boolean(existing.isEnabled), taskDueInDays: dueDays, workModeId, updatedAt: existing.updatedAt };
  });
}

// --- Initial Custom Lists ---
const INITIAL_CUSTOM_LISTS: CustomListDefinition[] = [
  {
    id: 'list-contracts',
    name: '契約書・合意書一覧',
    description: 'NDA、業務委託、顧問契約、発注書のステータス管理',
    category: 'customer_service',
    categories: [
      { id: 'cat-nda', name: '秘密保持契約 (NDA)', color: 'blue' },
      { id: 'cat-service', name: '業務委託・開発契約', color: 'indigo' },
      { id: 'cat-retainer', name: '顧問・月額契約', color: 'emerald' },
      { id: 'cat-subcon', name: '外注・発注契約', color: 'amber' },
    ],
    itemsCount: 4,
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: 'list-invoices',
    name: '請求・入金管理一覧',
    description: '当月請求、入金待ち、入金確認済、遅延管理',
    category: 'customer_service',
    categories: [
      { id: 'cat-inv-draft', name: '下書き・未発行', color: 'slate' },
      { id: 'cat-inv-issued', name: '請求済（入金待ち）', color: 'amber' },
      { id: 'cat-inv-paid', name: '入金確認済', color: 'emerald' },
      { id: 'cat-inv-overdue', name: '期日超過・督促', color: 'rose' },
    ],
    itemsCount: 4,
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: 'list-tools',
    name: '販促・自動化ツール一覧',
    description: 'LP、自動化スクリプト、プロンプト、社内シート一覧',
    category: 'marketing',
    categories: [
      { id: 'cat-tool-lp', name: '集客LP・Webフォーム', color: 'purple' },
      { id: 'cat-tool-script', name: '自動化スクリプト/GAS', color: 'cyan' },
      { id: 'cat-tool-prompt', name: '専用AIプロンプト', color: 'blue' },
    ],
    itemsCount: 3,
    createdAt: Date.now() - 30 * 86400000,
  },
];

export const matrixService = {
  normalizeAutomationRules,
  // Products
  loadProducts(): ManagedProduct[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.PRODUCTS);
      const saved = data ? JSON.parse(data) as ManagedProduct[] : INITIAL_PRODUCTS;
      if (localStorage.getItem(MATRIX_STORAGE_KEYS.PRODUCTS_SEED_VERSION) !== '2026-10-catalog-v1') {
        const existingIds = new Set(saved.map((product) => product.id));
        const merged = [...saved, ...BUSINESS_DEFAULT_PRODUCTS.filter((product) => !existingIds.has(product.id))];
        localStorage.setItem(MATRIX_STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
        localStorage.setItem(MATRIX_STORAGE_KEYS.PRODUCTS_SEED_VERSION, '2026-10-catalog-v1');
        return merged;
      }
      return saved;
    } catch {
      return [...INITIAL_PRODUCTS, ...BUSINESS_DEFAULT_PRODUCTS];
    }
  },
  saveProducts(products: ManagedProduct[]) {
    localStorage.setItem(MATRIX_STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },
  addProduct(product: Omit<ManagedProduct, 'id' | 'createdAt' | 'updatedAt'>): ManagedProduct {
    const list = this.loadProducts();
    const newProduct: ManagedProduct = {
      ...product,
      id: `prd-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(newProduct);
    this.saveProducts(list);
    return newProduct;
  },
  updateProduct(id: string, updates: Partial<ManagedProduct>) {
    const list = this.loadProducts();
    const index = list.findIndex((p) => p.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates, updatedAt: Date.now() };
      this.saveProducts(list);
    }
  },
  deleteProduct(id: string) {
    const list = this.loadProducts().filter((p) => p.id !== id);
    this.saveProducts(list);
  },

  // Pending contract and invoice deletions are scoped to the signed-in user.
  getPendingDeletions(userId: string): { contracts: Set<string>; invoices: Set<string> } {
    const cached = pendingDeletionMemory.get(userId);
    if (cached) return { contracts: new Set(cached.contracts), invoices: new Set(cached.invoices) };
    try {
      const raw = localStorage.getItem(`${MATRIX_STORAGE_KEYS.PENDING_DELETIONS}${userId}`);
      const parsed = raw ? JSON.parse(raw) as { contracts?: string[]; invoices?: string[] } : {};
      const value = { contracts: new Set(parsed.contracts || []), invoices: new Set(parsed.invoices || []) };
      pendingDeletionMemory.set(userId, value);
      return { contracts: new Set(value.contracts), invoices: new Set(value.invoices) };
    } catch {
      const value = { contracts: new Set<string>(), invoices: new Set<string>() };
      pendingDeletionMemory.set(userId, value);
      return { contracts: new Set(), invoices: new Set() };
    }
  },
  clearPendingDeletions(userId: string) {
    pendingDeletionMemory.set(userId, { contracts: new Set(), invoices: new Set() });
    try {
      localStorage.removeItem(`${MATRIX_STORAGE_KEYS.PENDING_DELETIONS}${userId}`);
    } catch {
      // The cloud save succeeded; a stale local marker is harmless and will be retried.
    }
  },
  recordPendingDeletion(userId: string, kind: 'contracts' | 'invoices', id: string) {
    const pending = this.getPendingDeletions(userId);
    pending[kind].add(id);
    pendingDeletionMemory.set(userId, pending);
    try {
      localStorage.setItem(`${MATRIX_STORAGE_KEYS.PENDING_DELETIONS}${userId}`, JSON.stringify({
        contracts: [...pending.contracts],
        invoices: [...pending.invoices],
      }));
    } catch {
      // Keep the in-memory marker so this session still cannot restore the deleted row.
    }
  },

  // Contracts
  loadContracts(): ManagedContract[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.CONTRACTS);
      return (data ? JSON.parse(data) as ManagedContract[] : INITIAL_CONTRACTS).filter((record) => !SAMPLE_RECORD_IDS.contracts.has(record.id));
    } catch {
      return INITIAL_CONTRACTS.filter((record) => !SAMPLE_RECORD_IDS.contracts.has(record.id));
    }
  },
  saveContracts(contracts: ManagedContract[]) {
    localStorage.setItem(MATRIX_STORAGE_KEYS.CONTRACTS, JSON.stringify(contracts));
  },
  addContract(contract: Omit<ManagedContract, 'id' | 'createdAt' | 'updatedAt'>): ManagedContract {
    const list = this.loadContracts();
    const newContract: ManagedContract = {
      ...contract,
      id: `cnt-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(newContract);
    this.saveContracts(list);
    return newContract;
  },
  deleteContract(id: string, userId: string) {
    this.recordPendingDeletion(userId, 'contracts', id);
    this.saveContracts(this.loadContracts().filter((contract) => contract.id !== id));
  },
  updateContract(id: string, updates: Partial<ManagedContract>) {
    const list = this.loadContracts();
    const index = list.findIndex((c) => c.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates, updatedAt: Date.now() };
      this.saveContracts(list);
    }
  },

  // Invoices
  loadInvoices(): ManagedInvoice[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.INVOICES);
      return (data ? JSON.parse(data) as ManagedInvoice[] : INITIAL_INVOICES).filter((record) => !SAMPLE_RECORD_IDS.invoices.has(record.id));
    } catch {
      return INITIAL_INVOICES.filter((record) => !SAMPLE_RECORD_IDS.invoices.has(record.id));
    }
  },
  saveInvoices(invoices: ManagedInvoice[]) {
    localStorage.setItem(MATRIX_STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },
  addInvoice(invoice: Omit<ManagedInvoice, 'id' | 'createdAt' | 'updatedAt'>): ManagedInvoice {
    const list = this.loadInvoices();
    const newInvoice: ManagedInvoice = {
      ...invoice,
      id: `inv-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(newInvoice);
    this.saveInvoices(list);
    return newInvoice;
  },
  deleteInvoice(id: string, userId: string) {
    this.recordPendingDeletion(userId, 'invoices', id);
    this.saveInvoices(this.loadInvoices().filter((invoice) => invoice.id !== id));
  },
  updateInvoice(id: string, updates: Partial<ManagedInvoice>) {
    const list = this.loadInvoices();
    const index = list.findIndex((i) => i.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates, updatedAt: Date.now() };
      this.saveInvoices(list);
    }
  },

  // Tools
  loadTools(): ManagedToolAsset[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.TOOLS);
      return (data ? JSON.parse(data) as ManagedToolAsset[] : INITIAL_TOOLS).filter((record) => !SAMPLE_RECORD_IDS.tools.has(record.id));
    } catch {
      return INITIAL_TOOLS.filter((record) => !SAMPLE_RECORD_IDS.tools.has(record.id));
    }
  },
  saveTools(tools: ManagedToolAsset[]) {
    localStorage.setItem(MATRIX_STORAGE_KEYS.TOOLS, JSON.stringify(tools));
  },
  addTool(tool: Omit<ManagedToolAsset, 'id' | 'createdAt'>): ManagedToolAsset {
    const list = this.loadTools();
    const newTool: ManagedToolAsset = {
      ...tool,
      id: `tool-${Date.now()}`,
      createdAt: Date.now(),
    };
    list.unshift(newTool);
    this.saveTools(list);
    return newTool;
  },

  // AI automation and approval settings
  loadAutomations(): AutomationRule[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.AUTOMATIONS);
      return normalizeAutomationRules(data ? JSON.parse(data) : null);
    } catch {
      return normalizeAutomationRules(null);
    }
  },
  saveAutomations(rules: AutomationRule[]) {
    localStorage.setItem(MATRIX_STORAGE_KEYS.AUTOMATIONS, JSON.stringify(normalizeAutomationRules(rules)));
  },

  // Custom Lists
  loadCustomLists(): CustomListDefinition[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.CUSTOM_LISTS);
      return data ? JSON.parse(data) : INITIAL_CUSTOM_LISTS;
    } catch {
      return INITIAL_CUSTOM_LISTS;
    }
  },
  saveCustomLists(lists: CustomListDefinition[]) {
    localStorage.setItem(MATRIX_STORAGE_KEYS.CUSTOM_LISTS, JSON.stringify(lists));
  },
};
