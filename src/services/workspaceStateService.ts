import {
  ActivityLog,
  ApprovalItem,
  ModelPricingRate,
  Project,
  TaskItem,
  TokenUsageRecord,
  ChatMessage,
  KnowledgeItem,
} from '../types';
import {
  loadActivityLogs,
  loadAllChatHistories,
  saveChatHistory,
  loadKnowledgeItems,
  loadApprovals,
  loadPricingRates,
  loadProjects,
  loadTasks,
  loadTokenUsageRecords,
  loadTopGoal,
  saveActivityLogs,
  saveKnowledgeItems,
  saveApprovals,
  savePricingRates,
  saveProjects,
  saveTasks,
  saveTokenUsageRecords,
  saveTopGoal,
} from '../utils/storage';
import { getSupabase } from '../lib/supabaseClient';
import { MarketingScenario } from '../types/marketing';
import { loadMarketingScenarios, saveMarketingScenarios } from '../utils/marketingStorage';
import { matrixService } from './matrixService';
import {
  AutomationRule,
  CustomListDefinition,
  ManagedContract,
  ManagedInvoice,
  ManagedProduct,
  ManagedToolAsset,
} from '../types/matrix';

type RelationalSalesOperations = { contracts: ManagedContract[]; invoices: ManagedInvoice[] };

function toTimestamp(value: string | null | undefined): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

async function loadRelationalSalesOperations(): Promise<RelationalSalesOperations | null> {
  const supabase = getSupabaseClient();
  const [contractResult, invoiceResult] = await Promise.all([
    supabase.from('customer_contracts').select('*').order('created_at',{ascending:false}),
    supabase.from('customer_invoices').select('*').order('created_at',{ascending:false}),
  ]);
  // Older deployments continue using the compatible workspace snapshot until the migration is applied.
  if (contractResult.error || invoiceResult.error) return null;
  return {
    contracts: (contractResult.data || []).map((row: any) => ({
      id: row.legacy_id || row.id,
      title: row.title,
      type: row.contract_type,
      productId: row.product_id || undefined,
      companyId: row.company_id || undefined,
      counterpartyName: row.counterparty_name || '',
      status: row.status,
      startDate: row.start_date || undefined,
      endDate: row.end_date || undefined,
      amount: Number(row.amount || 0),
      documentUrl: undefined,
      notes: row.notes || undefined,
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    })) as ManagedContract[],
    invoices: (invoiceResult.data || []).map((row: any) => ({
      id: row.legacy_id || row.id,
      invoiceNumber: row.invoice_number,
      title: row.title,
      productId: row.product_id || undefined,
      companyId: row.company_id || undefined,
      recipientName: row.recipient_name || '',
      amount: Number(row.amount || 0),
      taxAmount: row.tax_amount == null ? undefined : Number(row.tax_amount),
      status: row.status,
      issueDate: row.issue_date || '',
      dueDate: row.due_date || '',
      paidDate: row.paid_at || undefined,
      notes: row.notes || undefined,
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    })) as ManagedInvoice[],
  };
}

export interface WorkspaceData {
  topGoal: string;
  projects: Project[];
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  pricingRates: ModelPricingRate[];
  tokenUsage: TokenUsageRecord[];
  products: ManagedProduct[];
  contracts: ManagedContract[];
  invoices: ManagedInvoice[];
  tools: ManagedToolAsset[];
  customLists: CustomListDefinition[];
  automations: AutomationRule[];
  workModeHistories: Record<string, ChatMessage[]>;
  knowledgeItems: KnowledgeItem[];
  marketingScenarios: MarketingScenario[];
}

const WORKSPACE_STATE_TABLE = 'mst_workspace_state';
const AI_OPERATIONS_SYNC_STATE_TABLE = 'mst_ai_operations_sync_state';
const LAST_SYNC_PREFIX = 'mst_workspace_last_synced_v1:';

type RelationalAIOperations = Pick<WorkspaceData, 'projects' | 'tasks' | 'approvals' | 'automations' | 'activityLogs'>;

async function loadRelationalAIOperations(userId: string): Promise<RelationalAIOperations | null> {
  const supabase = getSupabaseClient();
  const { data: syncState, error: syncStateError } = await supabase
    .from(AI_OPERATIONS_SYNC_STATE_TABLE)
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (syncStateError) throw syncStateError;
  if (!syncState) return null;

  const [projects, tasks, approvals, automations, activityLogs] = await Promise.all([
    supabase.from('mst_ai_projects').select('payload').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('mst_ai_tasks').select('payload').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('mst_ai_approvals').select('payload').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('mst_ai_automation_rules').select('payload').eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('mst_ai_activity_logs').select('payload').eq('user_id', userId).order('occurred_at', { ascending: false }),
  ]);
  const queryError = [projects, tasks, approvals, automations, activityLogs].find((result) => result.error)?.error;
  if (queryError) throw queryError;

  const records = (rows: Array<{ payload: unknown }> | null | undefined) => (rows || []).map((row) => row.payload);
  return {
    projects: records(projects.data) as Project[],
    tasks: records(tasks.data) as TaskItem[],
    approvals: records(approvals.data) as ApprovalItem[],
    automations: records(automations.data) as AutomationRule[],
    activityLogs: records(activityLogs.data) as ActivityLog[],
  };
}

async function saveRelationalAIOperations(userId: string, data: WorkspaceData): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('mst_save_ai_operations', {
    p_user_id: userId,
    p_projects: data.projects,
    p_tasks: data.tasks,
    p_approvals: data.approvals,
    p_automation_rules: data.automations,
    p_activity_logs: data.activityLogs,
  });
  if (error) throw error;
}

function mergeRecords<T extends { id: string }>(remoteRecords: T[], localRecords: T[], baselineRecords: T[]): T[] {
  const remoteIds = new Set(remoteRecords.map((record) => record.id));
  const baselineById = new Map(baselineRecords.map((record) => [record.id, record]));
  const localOnlyRecords = localRecords.filter((record) => {
    if (remoteIds.has(record.id)) return false;
    const baseline = baselineById.get(record.id);
    // A record unchanged locally but deleted in the cloud stays deleted; genuinely new or locally edited records are retained.
    return !baseline || JSON.stringify(record) !== JSON.stringify(baseline);
  });
  return [...localOnlyRecords, ...remoteRecords];
}

function mergeChatHistories(
  remoteHistories: Record<string, ChatMessage[]>,
  localHistories: Record<string, ChatMessage[]>,
  baselineHistories: Record<string, ChatMessage[]>
): Record<string, ChatMessage[]> {
  const keys = new Set([...Object.keys(remoteHistories), ...Object.keys(localHistories)]);
  const merged: Record<string, ChatMessage[]> = {};
  keys.forEach((key) => {
    const remote = remoteHistories[key] || [];
    const local = localHistories[key] || [];
    const baseline = baselineHistories[key] || [];
    const remoteById = new Map<string, ChatMessage>(remote.map((message): [string, ChatMessage] => [message.id, message]));
    const localById = new Map<string, ChatMessage>(local.map((message): [string, ChatMessage] => [message.id, message]));
    const baselineById = new Map<string, ChatMessage>(baseline.map((message): [string, ChatMessage] => [message.id, message]));
    const combined = new Map(remoteById);

    // Honor local deletions only for messages unchanged in the last synchronized snapshot.
    baseline.forEach((message) => {
      if (localById.has(message.id)) return;
      const remoteMessage = remoteById.get(message.id);
      if (remoteMessage && JSON.stringify(remoteMessage) === JSON.stringify(message)) combined.delete(message.id);
    });
    // Preserve messages newly added or edited locally while retaining independent remote additions.
    local.forEach((message) => {
      const previous = baselineById.get(message.id);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(message)) combined.set(message.id, message);
    });

    merged[key] = [...combined.values()]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-100);
  });
  return merged;
}
function loadLastSyncedData(userId: string): Partial<WorkspaceData> {
  try {
    const raw = localStorage.getItem(`${LAST_SYNC_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as Partial<WorkspaceData>) : {};
  } catch {
    return {};
  }
}

export function loadLocalWorkspaceData(): WorkspaceData {
  return {
    topGoal: loadTopGoal(),
    projects: loadProjects(),
    tasks: loadTasks(),
    approvals: loadApprovals(),
    activityLogs: loadActivityLogs(),
    pricingRates: loadPricingRates(),
    tokenUsage: loadTokenUsageRecords(),
    products: matrixService.loadProducts(),
    contracts: matrixService.loadContracts(),
    invoices: matrixService.loadInvoices(),
    tools: matrixService.loadTools(),
    customLists: matrixService.loadCustomLists(),
    automations: matrixService.loadAutomations(),
    workModeHistories: loadAllChatHistories(),
    knowledgeItems: loadKnowledgeItems(),
    marketingScenarios: loadMarketingScenarios(),
  };
}

export function applyWorkspaceData(data: WorkspaceData): void {
  saveTopGoal(data.topGoal);
  saveProjects(data.projects);
  saveTasks(data.tasks);
  saveApprovals(data.approvals);
  saveActivityLogs(data.activityLogs);
  savePricingRates(data.pricingRates);
  saveTokenUsageRecords(data.tokenUsage);
  matrixService.saveProducts(data.products);
  matrixService.saveContracts(data.contracts);
  matrixService.saveInvoices(data.invoices);
  matrixService.saveTools(data.tools);
  matrixService.saveCustomLists(data.customLists);
  matrixService.saveAutomations(data.automations);
  saveKnowledgeItems(data.knowledgeItems || []);
  saveMarketingScenarios(data.marketingScenarios || []);
  Object.entries(data.workModeHistories || {}).forEach(([key, messages]) => saveChatHistory(key, messages));
}

function getSupabaseClient() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabaseに接続できません。接続設定とログイン状態を確認してください。');
  }
  return supabase;
}

export async function loadOrMigrateWorkspaceData(userId: string): Promise<WorkspaceData> {
  const supabase = getSupabaseClient();
  const { data: row, error } = await supabase
    .from(WORKSPACE_STATE_TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  const localDefaults = loadLocalWorkspaceData();
  const baseline = loadLastSyncedData(userId);
  const remote = row?.data && typeof row.data === 'object' && !Array.isArray(row.data)
    ? row.data as Partial<WorkspaceData>
    : null;

  const merged: WorkspaceData = remote
    ? {
        ...localDefaults,
        ...remote,
        projects: mergeRecords(remote.projects || [], localDefaults.projects, baseline.projects || []),
        tasks: mergeRecords(remote.tasks || [], localDefaults.tasks, baseline.tasks || []),
        approvals: mergeRecords(remote.approvals || [], localDefaults.approvals, baseline.approvals || []),
        activityLogs: mergeRecords(remote.activityLogs || [], localDefaults.activityLogs, baseline.activityLogs || []).slice(0, 100),
        tokenUsage: mergeRecords(remote.tokenUsage || [], localDefaults.tokenUsage, baseline.tokenUsage || []).slice(0, 300),
        products: mergeRecords(remote.products || [], localDefaults.products, baseline.products || []),
        contracts: mergeRecords(remote.contracts || [], localDefaults.contracts, baseline.contracts || []),
        invoices: mergeRecords(remote.invoices || [], localDefaults.invoices, baseline.invoices || []),
        tools: mergeRecords(remote.tools || [], localDefaults.tools, baseline.tools || []),
        customLists: mergeRecords(remote.customLists || [], localDefaults.customLists, baseline.customLists || []),
        automations: mergeRecords(remote.automations || [], localDefaults.automations, baseline.automations || []),
        workModeHistories: mergeChatHistories(
          remote.workModeHistories || {},
          localDefaults.workModeHistories,
          baseline.workModeHistories || {}
        ),
        knowledgeItems: mergeRecords(remote.knowledgeItems || [], localDefaults.knowledgeItems, baseline.knowledgeItems || []),
        marketingScenarios: mergeRecords(remote.marketingScenarios || [], localDefaults.marketingScenarios, baseline.marketingScenarios || []),
      }
    : localDefaults;

  // The sync-state row marks the normalized tables as authoritative, including when a user intentionally has zero records.
  const relationalAI = await loadRelationalAIOperations(userId);
  if (relationalAI) {
    merged.projects = mergeRecords(relationalAI.projects, localDefaults.projects, baseline.projects || []);
    merged.tasks = mergeRecords(relationalAI.tasks, localDefaults.tasks, baseline.tasks || []);
    merged.approvals = mergeRecords(relationalAI.approvals, localDefaults.approvals, baseline.approvals || []);
    merged.automations = mergeRecords(relationalAI.automations, localDefaults.automations, baseline.automations || []);
    merged.activityLogs = mergeRecords(relationalAI.activityLogs, localDefaults.activityLogs, baseline.activityLogs || []).slice(0, 100);
  }

  const relationalSales = await loadRelationalSalesOperations();
  if (relationalSales && (relationalSales.contracts.length > 0 || relationalSales.invoices.length > 0 || (merged.contracts.length === 0 && merged.invoices.length === 0))) {
    merged.contracts = relationalSales.contracts;
    merged.invoices = relationalSales.invoices;
  }

  applyWorkspaceData(merged);
  await saveWorkspaceData(userId, merged);
  return merged;
}

export async function saveWorkspaceData(userId: string, data: WorkspaceData): Promise<void> {
  const supabase = getSupabaseClient();
  await saveRelationalAIOperations(userId, data);

  // Keep non-operational preferences and supporting workspace data in the compatibility snapshot.
  // AI work records above are stored only in user-scoped relational tables.
  const snapshotData = { ...data } as Partial<WorkspaceData>;
  delete snapshotData.projects;
  delete snapshotData.tasks;
  delete snapshotData.approvals;
  delete snapshotData.automations;
  delete snapshotData.activityLogs;
  const { error } = await supabase
    .from(WORKSPACE_STATE_TABLE)
    .upsert({ user_id: userId, data: snapshotData, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  try {
    localStorage.setItem(`${LAST_SYNC_PREFIX}${userId}`, JSON.stringify(data));
  } catch (storageError) {
    console.warn('Could not update the local workspace sync baseline:', storageError);
  }
}

