import {
  ActivityLog,
  ApprovalItem,
  CharacterConfig,
  UserProfile,
  ModelPricingRate,
  Project,
  TaskItem,
  TokenUsageRecord,
  ChatMessage,
  KnowledgeItem,
} from '../types';
import {
  loadActivityLogs,
  loadActiveCharacterId,
  loadAllChatHistories,
  loadCharacters,
  loadUserProfile,
  saveChatHistory,
  loadKnowledgeItems,
  loadApprovals,
  loadPricingRates,
  loadProjects,
  loadTasks,
  loadTokenUsageRecords,
  loadTopGoal,
  saveActivityLogs,
  saveActiveCharacterId,
  saveCharacters,
  saveUserProfile,
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
import { AIModelSettings, loadAIModelSettings, saveAIModelSettings } from '../utils/aiSettingsStorage';
import { matrixService, SAMPLE_RECORD_IDS } from './matrixService';
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
    contracts: (contractResult.data || []).map((row: any) => row.payload || ({
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
    invoices: (invoiceResult.data || []).map((row: any) => row.payload || ({
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
  characters: CharacterConfig[];
  activeCharacterId: string;
  userProfile: UserProfile;
  aiModelSettings: AIModelSettings;
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

type RelationalAIOperations = Pick<WorkspaceData,
  | 'topGoal'
  | 'characters'
  | 'activeCharacterId'
  | 'userProfile'
  | 'aiModelSettings'
  | 'projects'
  | 'tasks'
  | 'approvals'
  | 'activityLogs'
  | 'pricingRates'
  | 'tokenUsage'
  | 'automations'
  | 'workModeHistories'
  | 'knowledgeItems'
>;

type RelationalMatrixWorkspace = Pick<WorkspaceData, 'products' | 'tools' | 'customLists' | 'marketingScenarios'>;

async function loadRelationalMatrixWorkspace(userId: string): Promise<RelationalMatrixWorkspace | null> {
  const supabase = getSupabaseClient();
  const { data: syncState, error: syncStateError } = await supabase
    .from('mst_matrix_workspace_sync_state')
    .select('user_id, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (syncStateError) throw syncStateError;
  if (!syncState) {
    matrixWorkspaceUpdatedAtByUser.delete(userId);
    return null;
  }
  matrixWorkspaceUpdatedAtByUser.set(userId, syncState.updated_at);

  const [products, tools, customLists, marketingScenarios] = await Promise.all([
    supabase.from('mst_managed_products').select('payload').eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('mst_managed_tools').select('payload').eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('mst_custom_list_definitions').select('payload').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('mst_marketing_scenarios').select('payload').eq('user_id', userId).order('updated_at', { ascending: false }),
  ]);
  const queryError = [products, tools, customLists, marketingScenarios].find((result) => result.error)?.error;
  if (queryError) throw queryError;
  const records = (rows: Array<{ payload: unknown }> | null | undefined) => (rows || []).map((row) => row.payload);
  return {
    products: records(products.data) as ManagedProduct[],
    tools: records(tools.data) as ManagedToolAsset[],
    customLists: records(customLists.data) as CustomListDefinition[],
    marketingScenarios: records(marketingScenarios.data) as MarketingScenario[],
  };
}

async function saveRelationalMatrixWorkspace(userId: string, data: WorkspaceData): Promise<void> {
  const supabase = getSupabaseClient();
  const pendingDeletions = matrixService.getPendingDeletions(userId);
  const { data: updatedAt, error } = await supabase.rpc('mst_save_matrix_workspace', {
    p_user_id: userId,
    p_products: data.products,
    p_contracts: data.contracts,
    p_invoices: data.invoices,
    p_tools: data.tools,
    p_custom_lists: data.customLists,
    p_marketing_scenarios: data.marketingScenarios,
    p_expected_updated_at: matrixWorkspaceUpdatedAtByUser.get(userId) || null,
    p_deleted_contract_ids: [...pendingDeletions.contracts],
    p_deleted_invoice_ids: [...pendingDeletions.invoices],
  });
  if (error) throw error;
  if (typeof updatedAt === 'string') matrixWorkspaceUpdatedAtByUser.set(userId, updatedAt);
  matrixService.clearPendingDeletions(userId);
}

const WORKSPACE_STATE_TABLE = 'mst_workspace_state';
const AI_OPERATIONS_SYNC_STATE_TABLE = 'mst_ai_operations_sync_state';
const LAST_SYNC_PREFIX = 'mst_workspace_last_synced_v1:';
const matrixWorkspaceUpdatedAtByUser = new Map<string, string>();

async function loadRelationalAIOperations(userId: string): Promise<RelationalAIOperations | null> {
  const supabase = getSupabaseClient();
  const { data: syncState, error: syncStateError } = await supabase
    .from(AI_OPERATIONS_SYNC_STATE_TABLE)
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (syncStateError) throw syncStateError;
  if (!syncState) return null;

  const [preferences, projects, tasks, approvals, automations, activityLogs, pricingRates, tokenUsage, chats, knowledge] = await Promise.all([
    supabase.from('mst_ai_user_preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('mst_ai_projects').select('payload').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('mst_ai_tasks').select('payload').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('mst_ai_approvals').select('payload').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('mst_ai_automation_rules').select('payload').eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('mst_ai_activity_logs').select('payload').eq('user_id', userId).order('occurred_at', { ascending: false }),
    supabase.from('mst_ai_model_pricing').select('payload').eq('user_id', userId).order('model'),
    supabase.from('mst_ai_token_usage_records').select('payload').eq('user_id', userId).order('occurred_at', { ascending: false }),
    supabase.from('mst_ai_chat_conversations').select('conversation_key, messages').eq('user_id', userId),
    supabase.from('mst_ai_knowledge_items').select('payload').eq('user_id', userId).order('updated_at', { ascending: false }),
  ]);
  const queryError = [preferences, projects, tasks, approvals, automations, activityLogs, pricingRates, tokenUsage, chats, knowledge]
    .find((result) => result.error)?.error;
  if (queryError) throw queryError;

  const records = (rows: Array<{ payload: unknown }> | null | undefined) => (rows || []).map((row) => row.payload);
  const characters = (preferences.data?.characters || loadCharacters()) as CharacterConfig[];
  const histories = Object.fromEntries((chats.data || []).map((row) => [row.conversation_key, row.messages as ChatMessage[]]));
  const savedModelSettings = preferences.data?.ai_model_settings as AIModelSettings | null;
  const aiModelSettings = savedModelSettings?.defaultSetting && savedModelSettings?.roleOverrides
    ? savedModelSettings
    : loadAIModelSettings();
  return {
    topGoal: preferences.data?.top_goal ?? loadTopGoal(),
    characters,
    activeCharacterId: preferences.data?.active_character_id || characters[0]?.id || loadActiveCharacterId(characters),
    userProfile: (preferences.data?.user_profile || loadUserProfile()) as UserProfile,
    aiModelSettings,
    projects: records(projects.data) as Project[],
    tasks: records(tasks.data) as TaskItem[],
    approvals: records(approvals.data) as ApprovalItem[],
    automations: records(automations.data) as AutomationRule[],
    activityLogs: records(activityLogs.data) as ActivityLog[],
    pricingRates: records(pricingRates.data) as ModelPricingRate[],
    tokenUsage: records(tokenUsage.data) as TokenUsageRecord[],
    workModeHistories: histories,
    knowledgeItems: records(knowledge.data) as KnowledgeItem[],
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
    p_user_profile: data.userProfile,
    p_characters: data.characters,
    p_active_character_id: data.activeCharacterId,
    p_ai_model_settings: data.aiModelSettings,
    p_top_goal: data.topGoal,
    p_token_usage_records: data.tokenUsage,
    p_model_pricing: data.pricingRates,
    p_chat_histories: data.workModeHistories,
    p_knowledge_items: data.knowledgeItems,
  });
  if (error) throw error;
}

function mergeRecordsByKey<T>(
  remoteRecords: T[],
  localRecords: T[],
  baselineRecords: T[],
  getKey: (record: T) => string,
): T[] {
  const remoteById = new Map(remoteRecords.map((record) => [getKey(record), record]));
  const localById = new Map(localRecords.map((record) => [getKey(record), record]));
  const baselineById = new Map(baselineRecords.map((record) => [getKey(record), record]));
  const merged = new Map(remoteById);

  // Apply local deletions only when the cloud record is still unchanged from the last synchronized snapshot.
  baselineRecords.forEach((baseline) => {
    const key = getKey(baseline);
    if (localById.has(key)) return;
    const remote = remoteById.get(key);
    if (remote && JSON.stringify(remote) === JSON.stringify(baseline)) merged.delete(key);
  });

  localRecords.forEach((local) => {
    const key = getKey(local);
    const baseline = baselineById.get(key);
    const remote = remoteById.get(key);
    const localChanged = !baseline || JSON.stringify(local) !== JSON.stringify(baseline);
    if (!localChanged) return;
    if (!remote || (baseline && JSON.stringify(remote) === JSON.stringify(baseline))) {
      merged.set(key, local);
      return;
    }

    // Both copies changed since the baseline. Keep the newer edit when both records expose updatedAt.
    const localUpdatedAt = (local as T & { updatedAt?: unknown }).updatedAt;
    const remoteUpdatedAt = (remote as T & { updatedAt?: unknown }).updatedAt;
    const localTime = typeof localUpdatedAt === 'number' ? localUpdatedAt : typeof localUpdatedAt === 'string' ? Date.parse(localUpdatedAt) : NaN;
    const remoteTime = typeof remoteUpdatedAt === 'number' ? remoteUpdatedAt : typeof remoteUpdatedAt === 'string' ? Date.parse(remoteUpdatedAt) : NaN;
    if (Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime > remoteTime) merged.set(key, local);
  });

  return [...merged.values()];
}

function mergeRecords<T extends { id: string }>(remoteRecords: T[], localRecords: T[], baselineRecords: T[]): T[] {
  return mergeRecordsByKey(remoteRecords, localRecords, baselineRecords, (record) => record.id);
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
function mergePreference<T>(remoteValue: T | undefined, localValue: T, baselineValue: T | undefined): T {
  if (baselineValue !== undefined && JSON.stringify(localValue) !== JSON.stringify(baselineValue)
    && JSON.stringify(remoteValue) === JSON.stringify(baselineValue)) return localValue;
  return remoteValue ?? localValue;
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
  const characters = loadCharacters();
  return {
    topGoal: loadTopGoal(),
    characters,
    activeCharacterId: loadActiveCharacterId(characters),
    userProfile: loadUserProfile(),
    aiModelSettings: loadAIModelSettings(),
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
  saveCharacters(data.characters);
  saveActiveCharacterId(data.activeCharacterId);
  saveUserProfile(data.userProfile);
  saveAIModelSettings(data.aiModelSettings);
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

  merged.contracts = merged.contracts.filter((record) => !SAMPLE_RECORD_IDS.contracts.has(record.id));
  merged.invoices = merged.invoices.filter((record) => !SAMPLE_RECORD_IDS.invoices.has(record.id));
  merged.tools = merged.tools.filter((record) => !SAMPLE_RECORD_IDS.tools.has(record.id));

  // The sync-state row marks the normalized tables as authoritative, including when a user intentionally has zero records.
  const relationalAI = await loadRelationalAIOperations(userId);
  if (relationalAI) {
    merged.topGoal = mergePreference(relationalAI.topGoal, localDefaults.topGoal, baseline.topGoal);
    merged.characters = mergeRecords(relationalAI.characters, localDefaults.characters, baseline.characters || []);
    merged.activeCharacterId = mergePreference(relationalAI.activeCharacterId, localDefaults.activeCharacterId, baseline.activeCharacterId);
    merged.userProfile = mergePreference(relationalAI.userProfile, localDefaults.userProfile, baseline.userProfile);
    merged.aiModelSettings = mergePreference(relationalAI.aiModelSettings, localDefaults.aiModelSettings, baseline.aiModelSettings);
    merged.pricingRates = mergeRecordsByKey(relationalAI.pricingRates, localDefaults.pricingRates, baseline.pricingRates || [], (rate) => rate.model);
    merged.tokenUsage = mergeRecords(relationalAI.tokenUsage, localDefaults.tokenUsage, baseline.tokenUsage || []).slice(0, 300);
    merged.workModeHistories = mergeChatHistories(relationalAI.workModeHistories, localDefaults.workModeHistories, baseline.workModeHistories || {});
    merged.knowledgeItems = mergeRecords(relationalAI.knowledgeItems, localDefaults.knowledgeItems, baseline.knowledgeItems || []);
    merged.projects = mergeRecords(relationalAI.projects, localDefaults.projects, baseline.projects || []);
    merged.tasks = mergeRecords(relationalAI.tasks, localDefaults.tasks, baseline.tasks || []);
    merged.approvals = mergeRecords(relationalAI.approvals, localDefaults.approvals, baseline.approvals || []);
    merged.automations = mergeRecords(relationalAI.automations, localDefaults.automations, baseline.automations || []);
    merged.activityLogs = mergeRecords(relationalAI.activityLogs, localDefaults.activityLogs, baseline.activityLogs || []).slice(0, 100);
  }

  const relationalMatrix = await loadRelationalMatrixWorkspace(userId);
  if (relationalMatrix) {
    merged.products = mergeRecords(relationalMatrix.products, localDefaults.products, baseline.products || []);
    merged.tools = mergeRecords(relationalMatrix.tools, localDefaults.tools, baseline.tools || []);
    merged.customLists = mergeRecords(relationalMatrix.customLists, localDefaults.customLists, baseline.customLists || []);
    merged.marketingScenarios = mergeRecords(relationalMatrix.marketingScenarios, localDefaults.marketingScenarios, baseline.marketingScenarios || []);
  }

  const relationalSales = await loadRelationalSalesOperations();
  if (relationalSales && (relationalMatrix || relationalSales.contracts.length > 0 || relationalSales.invoices.length > 0 || (merged.contracts.length === 0 && merged.invoices.length === 0))) {
    merged.contracts = mergeRecords(relationalSales.contracts, localDefaults.contracts, baseline.contracts || []);
    merged.invoices = mergeRecords(relationalSales.invoices, localDefaults.invoices, baseline.invoices || []);
  }

  const pendingDeletions = matrixService.getPendingDeletions(userId);
  merged.contracts = merged.contracts.filter((record) => !pendingDeletions.contracts.has(record.id));
  merged.invoices = merged.invoices.filter((record) => !pendingDeletions.invoices.has(record.id));

  applyWorkspaceData(merged);
  await saveWorkspaceData(userId, merged);
  return merged;
}

export async function saveWorkspaceData(userId: string, data: WorkspaceData): Promise<void> {
  const supabase = getSupabaseClient();
  await saveRelationalAIOperations(userId, data);
  await saveRelationalMatrixWorkspace(userId, data);

  // AI and Matrix business records are stored in user-scoped relational tables.
  // The compatibility snapshot retains only auxiliary workspace state.
  const snapshotData = { ...data } as Partial<WorkspaceData>;
  delete snapshotData.topGoal;
  delete snapshotData.characters;
  delete snapshotData.activeCharacterId;
  delete snapshotData.userProfile;
  delete snapshotData.aiModelSettings;
  delete snapshotData.projects;
  delete snapshotData.tasks;
  delete snapshotData.approvals;
  delete snapshotData.automations;
  delete snapshotData.activityLogs;
  delete snapshotData.pricingRates;
  delete snapshotData.tokenUsage;
  delete snapshotData.workModeHistories;
  delete snapshotData.knowledgeItems;
  delete snapshotData.products;
  delete snapshotData.contracts;
  delete snapshotData.invoices;
  delete snapshotData.tools;
  delete snapshotData.customLists;
  delete snapshotData.marketingScenarios;

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

