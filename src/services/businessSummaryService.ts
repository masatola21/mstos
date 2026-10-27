import { ManagedProduct, ManagedContract, ManagedInvoice } from '../types/matrix';
import { TaskItem, ApprovalItem, UserProfile } from '../types/ai-president';

export interface ProductKPIStats {
  productId: string;
  productName: string;
  archetype: string;
  unitPrice: number;
  activeClients: number;
  currentRevenue: number; // 税込・入金済合計
  billedUnpaidRevenue: number; // 請求中未回収
  targetRevenue: number;
  achievementRate: number; // %
}

/**
 * 契約書 (customer_contracts) と請求書 (customer_invoices) の実データから
 * 対象商品の正確なリアルタイムKPI（稼働顧客数、確定入金売上、請求中未収額）を集計する。
 */
export function calculateProductKPIs(
  product: ManagedProduct,
  contracts: ManagedContract[],
  invoices: ManagedInvoice[],
): ProductKPIStats {
  const prodId = product.id;
  const prodCode = product.code;

  // 1. 契約中顧客数: この商品に紐づく signed (締結済) 契約の相手先（会社IDまたは相手先名）のユニーク数
  const signedContracts = contracts.filter((c) => {
    const matchesProduct = c.productId === prodId || (prodCode && c.productId === prodCode);
    return matchesProduct && c.status === 'signed';
  });
  const clientKeys = new Set<string>();
  signedContracts.forEach((c) => {
    const key = (c.companyId || c.counterpartyName || c.id).trim();
    if (key) clientKeys.add(key);
  });
  const activeClients = clientKeys.size;

  // 2. 確定売上（税込・入金済請求）: status === 'paid' の請求書の合計
  const paidInvoices = invoices.filter((i) => {
    const matchesProduct = i.productId === prodId || (prodCode && i.productId === prodCode);
    return matchesProduct && i.status === 'paid';
  });
  const currentRevenue = paidInvoices.reduce((sum, inv) => {
    const amount = Number(inv.amount) || 0;
    const tax = inv.taxAmount !== undefined && inv.taxAmount !== null ? Number(inv.taxAmount) : Math.floor(amount * 0.1);
    return sum + amount + tax;
  }, 0);

  // 3. 請求中・未回収額: status === 'issued' または 'overdue'
  const pendingInvoices = invoices.filter((i) => {
    const matchesProduct = i.productId === prodId || (prodCode && i.productId === prodCode);
    return matchesProduct && (i.status === 'issued' || i.status === 'overdue');
  });
  const billedUnpaidRevenue = pendingInvoices.reduce((sum, inv) => {
    const amount = Number(inv.amount) || 0;
    const tax = inv.taxAmount !== undefined && inv.taxAmount !== null ? Number(inv.taxAmount) : Math.floor(amount * 0.1);
    return sum + amount + tax;
  }, 0);

  const targetRevenue = Number(product.kpis?.targetRevenue) || 0;
  const achievementRate = targetRevenue > 0 ? Math.min(999, Math.round((currentRevenue / targetRevenue) * 100)) : 0;

  return {
    productId: prodId,
    productName: product.name,
    archetype: product.archetype,
    unitPrice: product.price || 0,
    activeClients,
    currentRevenue,
    billedUnpaidRevenue,
    targetRevenue,
    achievementRate,
  };
}

export interface ExecutiveSummaryInput {
  products: ManagedProduct[];
  contracts: ManagedContract[];
  invoices: ManagedInvoice[];
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  topGoal?: string;
  userProfile?: UserProfile;
}

/**
 * AI社長（および役割AI）がチャットや意思決定で参照する、
 * 個人情報を除外した安全かつ客観的な「リアルタイム事業ファクトサマリー」を生成する。
 */
export function generateBusinessSummaryContext(input: ExecutiveSummaryInput): string {
  const { products, contracts, invoices, tasks, approvals, topGoal, userProfile } = input;

  // 全体売上と未回収
  let totalPaidRevenue = 0;
  let totalBilledUnpaid = 0;
  invoices.forEach((inv) => {
    const amount = Number(inv.amount) || 0;
    const tax = inv.taxAmount !== undefined && inv.taxAmount !== null ? Number(inv.taxAmount) : Math.floor(amount * 0.1);
    const total = amount + tax;
    if (inv.status === 'paid') totalPaidRevenue += total;
    else if (inv.status === 'issued' || inv.status === 'overdue') totalBilledUnpaid += total;
  });

  // 全体契約中社数
  const signedClients = new Set<string>();
  contracts.filter((c) => c.status === 'signed').forEach((c) => {
    const key = (c.companyId || c.counterpartyName || c.id).trim();
    if (key) signedClients.add(key);
  });

  // 商品別集計 (取扱中のみ)
  const activeProducts = products.filter((p) => p.status !== 'archived');
  const productSummaries = activeProducts.map((p) => {
    const kpi = calculateProductKPIs(p, contracts, invoices);
    return `- 【${p.name}】(種別: ${p.archetype}, 単価: ¥${(p.price || 0).toLocaleString()}): 契約中 ${kpi.activeClients}社 | 入金済累計 ¥${kpi.currentRevenue.toLocaleString()} (目標: ¥${kpi.targetRevenue.toLocaleString()} / 達成率 ${kpi.achievementRate}%) | 請求未収 ¥${kpi.billedUnpaidRevenue.toLocaleString()}`;
  });

  // タスク状況
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const waitingTasks = tasks.filter((t) => t.status === 'waiting').length;
  const pendingApprovalTasks = tasks.filter((t) => t.status === 'pending_approval').length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;

  // 期限切れタスク
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== 'completed');

  // 承認待ち状況
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const pendingApprovalLines = pendingApprovals.slice(0, 3).map((a) => `  * ${a.actionTitle} (申請者: ${a.requestedBy || 'AI担当'})`);

  const lines: string[] = [
    '=== リアルタイム事業運営状況・確定KPI ===',
    topGoal ? `【全社最重要目標】: ${topGoal}` : '',
    userProfile?.userGoals ? `【オーナー目標】: ${userProfile.userGoals}` : '',
    '',
    '【財務・顧客サマリー（DB確定値）】',
    `- 入金済み累計売上（税込）: ¥${totalPaidRevenue.toLocaleString()}`,
    `- 請求中・未回収金額（税込）: ¥${totalBilledUnpaid.toLocaleString()}`,
    `- 稼働中（契約締結済）クライアント数: ${signedClients.size} 社`,
    '',
    `【商品別稼働状況（全${activeProducts.length}商品）】`,
    productSummaries.length > 0 ? productSummaries.join('\n') : '- 登録中のAIプロダクトはありません。',
    '',
    '【業務タスク進捗状況】',
    `- 全体: ${totalTasks}件中 ${completedTasks}件完了（進行中: ${inProgressTasks}件, 未着手: ${waitingTasks}件, 承認待ち: ${pendingApprovalTasks}件, 滞留/中断: ${blockedTasks}件）`,
    overdueTasks.length > 0 ? `- ⚠️ 期限超過タスク: ${overdueTasks.length}件 (${overdueTasks.map((t) => t.title).slice(0, 3).join(', ')})` : '- 期限超過タスク: 0件（順調）',
    '',
    '【AI社長 承認待ち決裁案件】',
    `- 承認待ち総数: ${pendingApprovals.length} 件`,
    pendingApprovalLines.length > 0 ? pendingApprovalLines.join('\n') : '  * 現在、保留中の承認案件はありません。',
    '=========================================',
  ];

  return lines.filter((l) => l !== '').join('\n');
}
