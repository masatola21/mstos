import {
  ManagedProduct,
  ManagedContract,
  ManagedInvoice,
  ManagedToolAsset,
  CustomListDefinition,
  AutomationRule,
  BusinessCategory,
} from '../types/matrix';

const MATRIX_STORAGE_KEYS = {
  PRODUCTS: 'mst_matrix_products_v1',
  CONTRACTS: 'mst_matrix_contracts_v1',
  INVOICES: 'mst_matrix_invoices_v1',
  TOOLS: 'mst_matrix_tools_v1',
  CUSTOM_LISTS: 'mst_matrix_custom_lists_v1',
  AUTOMATIONS: 'mst_matrix_automations_v1',
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

// --- Initial Seed Contracts ---
const INITIAL_CONTRACTS: ManagedContract[] = [
  {
    id: 'cnt-001',
    title: 'AI基幹システム開発 基本契約書',
    type: 'service_agreement',
    productId: 'prd-sys-01',
    counterpartyName: 'テックイノベーション株式会社',
    status: 'signed',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    amount: 3500000,
    documentUrl: 'https://cloudsign.example.com/docs/cnt-001',
    notes: '着手金50%、検収後50%分割払い',
    createdAt: Date.now() - 25 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'cnt-002',
    title: '年間AI経営顧問契約',
    type: 'retainer',
    productId: 'prd-ret-02',
    counterpartyName: 'フューチャーロジック合同会社',
    status: 'signed',
    startDate: '2026-08-01',
    endDate: '2027-07-31',
    amount: 250000,
    documentUrl: 'https://cloudsign.example.com/docs/cnt-002',
    notes: '月額自動更新（解約は3ヶ月前通知）',
    createdAt: Date.now() - 40 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'cnt-003',
    title: '秘密保持契約書 (NDA)',
    type: 'nda',
    productId: 'prd-sys-01',
    counterpartyName: 'グローバルネクスト株式会社',
    status: 'under_review',
    startDate: '2026-10-10',
    notes: '商談進行中、先方法務確認中',
    createdAt: Date.now() - 5 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'cnt-004',
    title: 'メディアライティング業務委託契約',
    type: 'subcontractor',
    productId: 'prd-med-04',
    counterpartyName: '合同会社コンテンツラボ（外注先）',
    status: 'signed',
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    amount: 80000,
    notes: '月4本納品、記事単価20,000円',
    createdAt: Date.now() - 60 * 86400000,
    updatedAt: Date.now(),
  },
];

// --- Initial Seed Invoices ---
const INITIAL_INVOICES: ManagedInvoice[] = [
  {
    id: 'inv-202610-01',
    invoiceNumber: 'INV-202610-001',
    title: 'AI基幹システム開発 着手金（50%）',
    productId: 'prd-sys-01',
    recipientName: 'テックイノベーション株式会社',
    amount: 1750000,
    taxAmount: 175000,
    status: 'paid',
    issueDate: '2026-09-05',
    dueDate: '2026-09-30',
    paidDate: '2026-09-28',
    notes: '入金確認済み（三井住友銀行口座）',
    createdAt: Date.now() - 35 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'inv-202610-02',
    invoiceNumber: 'INV-202610-002',
    title: '10月度 AI経営顧問報酬',
    productId: 'prd-ret-02',
    recipientName: 'フューチャーロジック合同会社',
    amount: 250000,
    taxAmount: 25000,
    status: 'issued',
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    notes: '月末自動振替予定',
    createdAt: Date.now() - 12 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'inv-202610-03',
    invoiceNumber: 'INV-202610-003',
    title: 'デジタル教材・テンプレ一括購入',
    productId: 'prd-dig-03',
    recipientName: '株式会社サクセスパートナーズ',
    amount: 149400,
    taxAmount: 14940,
    status: 'issued',
    issueDate: '2026-10-08',
    dueDate: '2026-10-25',
    notes: '3ライセンス一括購入',
    createdAt: Date.now() - 5 * 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'inv-202609-04',
    invoiceNumber: 'INV-202609-012',
    title: 'ASP成果報酬受領（9月確定分）',
    productId: 'prd-med-04',
    recipientName: '株式会社ファンコミュニケーションズ (A8.net)',
    amount: 128000,
    status: 'paid',
    issueDate: '2026-09-15',
    dueDate: '2026-10-15',
    paidDate: '2026-10-15',
    notes: 'ASP管理画面より振込確認',
    createdAt: Date.now() - 28 * 86400000,
    updatedAt: Date.now(),
  },
];

// --- Initial Seed Tools ---
const INITIAL_TOOLS: ManagedToolAsset[] = [
  {
    id: 'tool-01',
    name: 'AI診断受付Webフォーム (公開LP用)',
    category: 'marketing',
    productId: 'prd-ret-02',
    toolType: 'lp',
    url: 'https://form.example.com/diagnosis',
    description: 'LINEやLPから見込み客が直接簡易診断を受けられるスマホ最適化フォーム',
    status: 'active',
    createdAt: Date.now() - 20 * 86400000,
  },
  {
    id: 'tool-02',
    name: '請求書ステータス自動集計スプレッドシート',
    category: 'customer_service',
    toolType: 'sheet',
    url: 'https://docs.google.com/spreadsheets/d/invoice-summary',
    description: '毎月の入金・未入金をリアルタイム集計するGAS連携シート',
    status: 'active',
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: 'tool-03',
    name: '開発要件定義AIプロンプトジェネレーター',
    category: 'product_dev',
    productId: 'prd-sys-01',
    toolType: 'prompt',
    description: 'クライアントの要望ヒアリングメモから要件定義書初稿を生成する専用プロンプト',
    status: 'active',
    createdAt: Date.now() - 15 * 86400000,
  },
];

// --- 標準AI自動化・承認ルール（未接続の設定テンプレート） ---
const INITIAL_AUTOMATIONS: AutomationRule[] = [
  { id: 'workflow-diagnosis-submitted', name: '診断回答の確認・分析', description: '診断フォームの回答を整理し、課題・追加確認事項・改善案をまとめる。', triggerEvent: 'diagnosis_submitted', aiMode: 'prepare', approvalPolicy: 'always', isEnabled: false },
  { id: 'workflow-deal-won', name: '商談成約後の準備', description: '成約した商談から契約・キックオフの準備項目を作成する。顧客への連絡前に担当者が確認する。', triggerEvent: 'deal_won', aiMode: 'prepare', approvalPolicy: 'external_actions', isEnabled: false },
  { id: 'workflow-contract-signed', name: '契約締結後の請求準備', description: '締結済み契約をもとに請求内容の初稿を準備し、発行前に担当者が確認する。', triggerEvent: 'contract_signed', aiMode: 'prepare', approvalPolicy: 'always', isEnabled: false },
  { id: 'workflow-invoice-overdue', name: '請求期限超過の対応案', description: '期限を過ぎた請求を検出し、社内通知や顧客への連絡案を作成する。', triggerEvent: 'invoice_overdue', aiMode: 'suggest', approvalPolicy: 'always', isEnabled: false },
  { id: 'workflow-project-milestone', name: '支援マイルストーンの振り返り', description: '支援の節目に進捗・課題を要約し、次の対応案を提示する。', triggerEvent: 'project_milestone', aiMode: 'suggest', approvalPolicy: 'external_actions', isEnabled: false },
];

export function normalizeAutomationRules(value: unknown): AutomationRule[] {
  const saved = Array.isArray(value) ? value as Partial<AutomationRule>[] : [];
  return INITIAL_AUTOMATIONS.map((preset) => {
    const existing = saved.find((item) => item && item.id === preset.id);
    if (!existing || !('aiMode' in existing) || !('approvalPolicy' in existing) || !('isEnabled' in existing)) return { ...preset };
    const aiMode = existing.aiMode === 'suggest' || existing.aiMode === 'prepare' || existing.aiMode === 'execute' ? existing.aiMode : preset.aiMode;
    const approvalPolicy = existing.approvalPolicy === 'always' || existing.approvalPolicy === 'external_actions' || existing.approvalPolicy === 'none' ? existing.approvalPolicy : preset.approvalPolicy;
    return { ...preset, aiMode, approvalPolicy, isEnabled: Boolean(existing.isEnabled), updatedAt: existing.updatedAt };
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
  // Products
  loadProducts(): ManagedProduct[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.PRODUCTS);
      return data ? JSON.parse(data) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
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

  // Contracts
  loadContracts(): ManagedContract[] {
    try {
      const data = localStorage.getItem(MATRIX_STORAGE_KEYS.CONTRACTS);
      return data ? JSON.parse(data) : INITIAL_CONTRACTS;
    } catch {
      return INITIAL_CONTRACTS;
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
      return data ? JSON.parse(data) : INITIAL_INVOICES;
    } catch {
      return INITIAL_INVOICES;
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
      return data ? JSON.parse(data) : INITIAL_TOOLS;
    } catch {
      return INITIAL_TOOLS;
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
