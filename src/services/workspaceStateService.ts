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
import { matrixService } from './matrixService';
import {
  AutomationRule,
  CustomListDefinition,
  ManagedContract,
  ManagedInvoice,
  ManagedProduct,
  ManagedToolAsset,
} from '../types/matrix';

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
}

const WORKSPACE_STATE_TABLE = 'mst_workspace_state';
const LAST_SYNC_PREFIX = 'mst_workspace_last_synced_v1:';

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

  if (row?.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    const localDefaults = loadLocalWorkspaceData();
    const remote = row.data as Partial<WorkspaceData>;
    const baseline = loadLastSyncedData(userId);
    const merged: WorkspaceData = {
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
    };
    applyWorkspaceData(merged);
    // 別ブラウザーに残っている未同期レコードも既存クラウドデータと統合して保存する。
    await saveWorkspaceData(userId, merged);
    return merged;
  }

  // 初回サインインでは既存ブラウザのデータをクラウドへ移行する。
  const localData = loadLocalWorkspaceData();
  await saveWorkspaceData(userId, localData);
  return localData;
}

export async function saveWorkspaceData(userId: string, data: WorkspaceData): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(WORKSPACE_STATE_TABLE)
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  try {
    localStorage.setItem(`${LAST_SYNC_PREFIX}${userId}`, JSON.stringify(data));
  } catch (storageError) {
    console.warn('Could not update the local workspace sync baseline:', storageError);
  }
}

