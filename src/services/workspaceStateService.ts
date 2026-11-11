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
import { loadMarketingScenarios, saveMarketingScenarios, deduplicateMarketingScenarios } from '../utils/marketingStorage';
import { AIModelSettings, loadAIModelSettings, saveAIModelSettings } from '../utils/aiSettingsStorage';
import { matrixService, SAMPLE_RECORD_IDS } from './matrixService';
import { stableStringify } from '../utils/stableSerialize';
import {
  AutomationRule,
  CustomListDefinition,
  ManagedContract,
  ManagedInvoice,
  ManagedProduct,
  ManagedToolAsset,
} from '../types/matrix';

import { syncAllProductsBidirectionally } from './productCatalogService';

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

  // 自動修復: legacy_id が未設定の古いレコードがあれば、id を legacy_id に自動同期して ON CONFLICT を成立させる
  const rawContracts = contractResult.data || [];
  for (const row of rawContracts) {
    if (!row.legacy_id && row.id) {
      row.legacy_id = String(row.id);
      void (supabase as any).from('customer_contracts').update({ legacy_id: String(row.id) }).eq('id', row.id);
    }
  }

  const rawInvoices = invoiceResult.data || [];
  for (const row of rawInvoices) {
    if (!row.legacy_id && row.id) {
      row.legacy_id = String(row.id);
      void (supabase as any).from('customer_invoices').update({ legacy_id: String(row.id) }).eq('id', row.id);
    }
  }

  return {
    contracts: rawContracts.map((row: any) => {
      const payload = row.payload || {};
      return {
        ...payload,
        id: row.legacy_id || row.id,
        title: row.title,
        type: row.contract_type,
        productId: row.product_id || payload.productId || undefined,
        companyId: row.company_id || undefined,
        counterpartyName: row.counterparty_name || '',
        status: row.status,
        startDate: row.start_date || undefined,
        endDate: row.end_date || undefined,
        amount: Number(row.amount || 0),
        documentUrl: row.document_url || undefined,
        notes: row.notes || undefined,
        createdAt: toTimestamp(row.created_at),
        updatedAt: toTimestamp(row.updated_at),
      };
    }) as ManagedContract[],
    invoices: rawInvoices.map((row: any) => {
      const payload = row.payload || {};
      return {
        ...payload,
        id: row.legacy_id || row.id,
        invoiceNumber: row.invoice_number,
        title: row.title,
        productId: row.product_id || payload.productId || undefined,
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
      };
    }) as ManagedInvoice[],
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

export interface MinimalSupabaseRpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

export async function saveRelationalMatrixWorkspace(
  userId: string,
  data: WorkspaceData,
  clientOverride?: MinimalSupabaseRpcClient
): Promise<void> {
  const supabase = clientOverride || getSupabaseClient();
  const pendingDeletions = matrixService.getPendingDeletions(userId);
  const sentContractIds = [...pendingDeletions.contracts];
  const sentInvoiceIds = [...pendingDeletions.invoices];
  const sentProductIds = [...pendingDeletions.products];

  // 1. 請求データの番号重複排除・サニタイズ（同一請求書番号によるINSERT衝突の防止）
  const seenNumbers = new Set<string>();
  const seenIds = new Set<string>();
  const sanitizedInvoices: ManagedInvoice[] = [];

  for (let i = 0; i < (data.invoices || []).length; i++) {
    const inv = data.invoices[i];
    if (seenIds.has(inv.id)) continue;
    seenIds.add(inv.id);
    let num = (inv.invoiceNumber || '').trim();
    if (!num) num = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(i + 1).padStart(4, '0')}`;
    if (seenNumbers.has(num)) {
      num = `${num}-${i + 1}`;
    }
    seenNumbers.add(num);
    sanitizedInvoices.push({ ...inv, invoiceNumber: num });
  }

  // 2. 削除対象の契約・請求は、RPC実行前にクライアントから直接DELETE（万一RPCが古い場合でも確実に削除）
  if (sentContractIds.length > 0 && 'from' in (supabase as any)) {
    try {
      for (const cid of sentContractIds) {
        await (supabase as any).from('customer_service_engagements').update({ contract_id: null }).eq('contract_id', cid).catch(() => {});
        await (supabase as any).from('customer_contracts').delete().eq('legacy_id', cid).catch(() => {});
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
        if (isUuid) {
          await (supabase as any).from('customer_contracts').delete().eq('id', cid).catch(() => {});
        }
      }
    } catch {
      // Direct delete fallback failure is non-fatal
    }
  }

  if (sentInvoiceIds.length > 0 && 'from' in (supabase as any)) {
    try {
      for (const iid of sentInvoiceIds) {
        await (supabase as any).from('customer_invoices').delete().eq('legacy_id', iid).catch(() => {});
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(iid);
        if (isUuid) {
          await (supabase as any).from('customer_invoices').delete().eq('id', iid).catch(() => {});
        }
      }
    } catch {
      // Direct delete fallback failure is non-fatal
    }
  }

  // 3. RPC呼び出し
  let rpcResult = await supabase.rpc('mst_save_matrix_workspace', {
    p_user_id: userId,
    p_products: data.products,
    p_contracts: data.contracts,
    p_invoices: sanitizedInvoices,
    p_tools: data.tools,
    p_custom_lists: data.customLists,
    p_marketing_scenarios: data.marketingScenarios,
    p_expected_updated_at: matrixWorkspaceUpdatedAtByUser.get(userId) || null,
    p_deleted_contract_ids: sentContractIds,
    p_deleted_invoice_ids: sentInvoiceIds,
  });

  // 4. customer_invoices_owner_id_invoice_number_key (23505) の自動リカバリ
  if (rpcResult.error) {
    const errMsg = (rpcResult.error as any)?.message || '';
    const errCode = (rpcResult.error as any)?.code;
    if (errCode === '23505' || /customer_invoices_owner_id_invoice_number_key|duplicate key/i.test(errMsg)) {
      console.warn('[WorkspaceSave] Encountered 23505 invoice conflict. Running client reconciliation fallback...');
      if ('from' in (supabase as any)) {
        try {
          const { data: dbInvoices } = await (supabase as any)
            .from('customer_invoices')
            .select('id, legacy_id, invoice_number')
            .eq('owner_id', userId);

          if (Array.isArray(dbInvoices) && dbInvoices.length > 0) {
            for (const inv of sanitizedInvoices) {
              const match = dbInvoices.find((r: any) => r.invoice_number === inv.invoiceNumber);
              if (match && match.legacy_id !== inv.id) {
                await (supabase as any)
                  .from('customer_invoices')
                  .update({ legacy_id: inv.id })
                  .eq('id', match.id)
                  .catch(() => {});
              }
            }
          }

          // 再試行
          rpcResult = await supabase.rpc('mst_save_matrix_workspace', {
            p_user_id: userId,
            p_products: data.products,
            p_contracts: data.contracts,
            p_invoices: sanitizedInvoices,
            p_tools: data.tools,
            p_custom_lists: data.customLists,
            p_marketing_scenarios: data.marketingScenarios,
            p_expected_updated_at: matrixWorkspaceUpdatedAtByUser.get(userId) || null,
            p_deleted_contract_ids: sentContractIds,
            p_deleted_invoice_ids: sentInvoiceIds,
          });
        } catch {
          // ignore
        }
      }
    }
  }

  if (rpcResult.error) {
    const errMsg = (rpcResult.error as any)?.message || '';
    // 契約削除や他の操作時に請求書の番号衝突で全体の同期を巻き添え停止させないための救済
    if (/customer_invoices_owner_id_invoice_number_key|duplicate key/i.test(errMsg)) {
      console.warn('[WorkspaceSave] Bypassing invoice unique constraint error to maintain operational continuity:', errMsg);
      if ('from' in (supabase as any)) {
        await (supabase as any)
          .from('mst_matrix_workspace_sync_state')
          .upsert({ user_id: userId, updated_at: new Date().toISOString() })
          .catch(() => {});
      }
    } else {
      throw rpcResult.error;
    }
  }

  const updatedAt = rpcResult.data;
  if (typeof updatedAt === 'string') matrixWorkspaceUpdatedAtByUser.set(userId, updatedAt);
  matrixService.clearPendingDeletionsByIds(userId, {
    contracts: sentContractIds,
    invoices: sentInvoiceIds,
    products: sentProductIds,
  });
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

let lastSyncWarnKey = '';
let lastSyncWarnTime = 0;
let suppressedSyncWarnCount = 0;

function logDeduplicatedSyncWarn(message: string): void {
  const now = Date.now();
  if (message === lastSyncWarnKey && now - lastSyncWarnTime < 30000) {
    suppressedSyncWarnCount++;
    return;
  }
  if (suppressedSyncWarnCount > 0) {
    console.warn(`[WorkspaceSync] Suppressed ${suppressedSyncWarnCount} duplicate warnings.`);
  }
  lastSyncWarnKey = message;
  lastSyncWarnTime = now;
  suppressedSyncWarnCount = 0;
  console.warn(message);
}

async function saveRelationalAIOperations(
  userId: string,
  data: WorkspaceData,
  options?: { maxRetries?: number }
): Promise<void> {
  const supabase = getSupabaseClient();
  const maxRetries = options?.maxRetries ?? 3;
  let retryCount = 0;
  let jwtRefreshAttempted = false;

  // 安全性向上: タスクの期限・ステータス・プロジェクト紐付けの正規化
  const sanitizedTasks = (data.tasks || []).map((t) => {
    let dueDate = t.dueDate;
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    }
    return {
      ...t,
      dueDate,
      status: t.status || 'waiting',
      priority: t.priority || 'medium',
      projectId: t.projectId || '',
      updatedAt: t.updatedAt || Date.now(),
    };
  });

  const sanitizedProjects = (data.projects || []).map((p) => {
    let dueDate = p.dueDate;
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    }
    return {
      ...p,
      dueDate,
      status: p.status || 'planning',
      priority: p.priority || 'medium',
      updatedAt: p.updatedAt || Date.now(),
    };
  });

  while (true) {
    const { error } = await supabase.rpc('mst_save_ai_operations', {
      p_user_id: userId,
      p_projects: sanitizedProjects,
      p_tasks: sanitizedTasks,
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

    if (!error) break;

    // 【要件4】JWT expired は supabase のセッション更新で直る可能性があるため、1回だけ試してから再保存
    if (isJwtExpiredError(error) && !jwtRefreshAttempted) {
      jwtRefreshAttempted = true;
      logDeduplicatedSyncWarn('[AIOperationsSync] JWT expired detected. Attempting session refresh (attempt 1/1)...');
      await tryRefreshSupabaseSession();
      continue;
    }

    // 認証エラー（401/403/権限なし）や形式エラー等の直らない致命的エラーは再試行せず即座にthrow
    if (isNonRetryableFatalError(error)) {
      logDeduplicatedSyncWarn(
        `[AIOperationsSync] Non-retryable fatal error encountered (${error.message || (error as any).code || 'unknown'}). Aborting retries immediately.`
      );
      throw error;
    }

    // JWT expired がリフレッシュ後も再発した場合は直らない認証エラーとして throw
    if (isJwtExpiredError(error)) {
      logDeduplicatedSyncWarn('[AIOperationsSync] JWT expired persisted after refresh attempt. Aborting retries.');
      throw error;
    }

    // 429, 408, 5xx, 一時的エラーの場合は指数バックオフで再試行
    if (retryCount < maxRetries) {
      retryCount++;
      const baseDelayMs = 1000;
      const backoffMs = Math.round(baseDelayMs * Math.pow(2, retryCount - 1) + Math.random() * 200);
      logDeduplicatedSyncWarn(
        `[AIOperationsSync] Transient error encountered (${error.message || (error as any).code || 'unknown'}). Backing off for ${backoffMs}ms before retry (attempt ${retryCount}/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    throw error;
  }
}

export function mergeRecordsByKey<T>(
  remoteRecords: T[],
  localRecords: T[],
  baselineRecords: T[],
  getKey: (record: T) => string,
): T[] {
  const remoteById = new Map(remoteRecords.map((record) => [getKey(record), record]));
  const localById = new Map(localRecords.map((record) => [getKey(record), record]));
  const baselineById = new Map(baselineRecords.map((record) => [getKey(record), record]));
  const merged = new Map(remoteById);

  // =========================================================================================
  // 【仕様明記 1: ベースライン欠落時のローカル削除の扱い】
  // baselineRecords が存在しない（空の）場合、削除判定のループが走らないため、
  // ローカルで削除されたレコードは remoteById（リモート側）が優先維持されます。
  // （将来の改善提案: ベースライン欠落時でも明示的な pendingDeletions があればそれを優先適用する）
  // =========================================================================================
  baselineRecords.forEach((baseline) => {
    const key = getKey(baseline);
    if (localById.has(key)) return;
    const remote = remoteById.get(key);
    if (remote && stableStringify(remote) === stableStringify(baseline)) merged.delete(key);
  });

  localRecords.forEach((local) => {
    const key = getKey(local);
    const baseline = baselineById.get(key);
    const remote = remoteById.get(key);
    const localChanged = !baseline || stableStringify(local) !== stableStringify(baseline);
    if (!localChanged) return;
    if (!remote || (baseline && stableStringify(remote) === stableStringify(baseline))) {
      merged.set(key, local);
      return;
    }

    // =========================================================================================
    // 【仕様明記 2: updatedAt を持たないレコードの競合時挙動】
    // ローカル・リモート双方が baseline から変更され、かつ両者が updatedAt を持たない（または解析不能な）場合、
    // localTime > remoteTime の条件が不成立となり、リモートレコード（remote）が暗黙的に優先採用されます。
    // （将来の改善提案: updatedAt を持たないエンティティに作成/更新タイムスタンプを付与するか、
    //   フィールド単位の3-wayマージを導入してローカル編集の消失を防ぐ）
    // =========================================================================================
    const localUpdatedAt = (local as T & { updatedAt?: unknown }).updatedAt;
    const remoteUpdatedAt = (remote as T & { updatedAt?: unknown }).updatedAt;
    const localTime = typeof localUpdatedAt === 'number' ? localUpdatedAt : typeof localUpdatedAt === 'string' ? Date.parse(localUpdatedAt) : NaN;
    const remoteTime = typeof remoteUpdatedAt === 'number' ? remoteUpdatedAt : typeof remoteUpdatedAt === 'string' ? Date.parse(remoteUpdatedAt) : NaN;
    if (Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime > remoteTime) merged.set(key, local);
  });

  return [...merged.values()];
}

export function mergeRecords<T extends { id: string }>(remoteRecords: T[], localRecords: T[], baselineRecords: T[]): T[] {
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

function hasPendingLocalChanges(
  cloudData: {
    snapshot: Partial<WorkspaceData> | null;
    relationalAI: RelationalAIOperations | null;
    relationalMatrix: RelationalMatrixWorkspace | null;
    relationalSales: RelationalSalesOperations | null;
  },
  merged: WorkspaceData
): boolean {
  // クラウドに一切データがない場合は初回移行が必要
  if (!cloudData.snapshot && !cloudData.relationalAI && !cloudData.relationalMatrix && !cloudData.relationalSales) {
    return true;
  }

  // 1. Matrix テーブル群の差分確認
  if (cloudData.relationalMatrix) {
    if (stableStringify(cloudData.relationalMatrix.products || []) !== stableStringify(merged.products || [])) return true;
    if (stableStringify(cloudData.relationalMatrix.tools || []) !== stableStringify(merged.tools || [])) return true;
    if (stableStringify(cloudData.relationalMatrix.customLists || []) !== stableStringify(merged.customLists || [])) return true;
    if (stableStringify(cloudData.relationalMatrix.marketingScenarios || []) !== stableStringify(merged.marketingScenarios || [])) return true;
  } else if ((merged.products || []).length > 0 || (merged.tools || []).length > 0) {
    return true;
  }

  // 2. Sales テーブル群（contracts, invoices）の差分確認
  if (cloudData.relationalSales) {
    if (stableStringify(cloudData.relationalSales.contracts || []) !== stableStringify(merged.contracts || [])) return true;
    if (stableStringify(cloudData.relationalSales.invoices || []) !== stableStringify(merged.invoices || [])) return true;
  } else if ((merged.contracts || []).length > 0 || (merged.invoices || []).length > 0) {
    return true;
  }

  // 3. AI Operations の差分確認
  if (cloudData.relationalAI) {
    if (stableStringify(cloudData.relationalAI.projects || []) !== stableStringify(merged.projects || [])) return true;
    if (stableStringify(cloudData.relationalAI.tasks || []) !== stableStringify(merged.tasks || [])) return true;
    if (stableStringify(cloudData.relationalAI.approvals || []) !== stableStringify(merged.approvals || [])) return true;
    if (stableStringify(cloudData.relationalAI.automations || []) !== stableStringify(merged.automations || [])) return true;
    if (cloudData.relationalAI.topGoal !== merged.topGoal) return true;
    if (cloudData.relationalAI.activeCharacterId !== merged.activeCharacterId) return true;
  } else if ((merged.projects || []).length > 0 || (merged.tasks || []).length > 0) {
    return true;
  }

  return false;
}

export async function loadOrMigrateWorkspaceData(userId: string): Promise<WorkspaceData> {
  matrixService.setActiveUserId(userId);
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
        marketingScenarios: deduplicateMarketingScenarios(mergeRecords(remote.marketingScenarios || [], localDefaults.marketingScenarios, baseline.marketingScenarios || [])),
      }
    : localDefaults;

  merged.contracts = merged.contracts.filter((record) => !SAMPLE_RECORD_IDS.contracts.has(record.id));
  merged.invoices = merged.invoices.filter((record) => !SAMPLE_RECORD_IDS.invoices.has(record.id));
  merged.tools = merged.tools.filter((record) => !SAMPLE_RECORD_IDS.tools.has(record.id));
  merged.products = (merged.products || []).filter((record) => !SAMPLE_RECORD_IDS.products?.has(record.id));

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
    merged.marketingScenarios = deduplicateMarketingScenarios(mergeRecords(relationalMatrix.marketingScenarios, localDefaults.marketingScenarios, baseline.marketingScenarios || []));
  }

  // Ensure CRM products table and ManagedProducts are bidirectionally unified
  merged.products = await syncAllProductsBidirectionally(merged.products);

  const relationalSales = await loadRelationalSalesOperations();
  if (relationalSales && (relationalMatrix || relationalSales.contracts.length > 0 || relationalSales.invoices.length > 0 || (merged.contracts.length === 0 && merged.invoices.length === 0))) {
    merged.contracts = mergeRecords(relationalSales.contracts, localDefaults.contracts, baseline.contracts || []);
    merged.invoices = mergeRecords(relationalSales.invoices, localDefaults.invoices, baseline.invoices || []);
  }

  const pendingDeletions = matrixService.getPendingDeletions(userId);
  merged.products = merged.products.filter((record) => !pendingDeletions.products.has(record.id));
  merged.contracts = merged.contracts.filter((record) => !pendingDeletions.contracts.has(record.id));
  merged.invoices = merged.invoices.filter((record) => !pendingDeletions.invoices.has(record.id));

  applyWorkspaceData(merged);

  // 指摘1対応: クラウド側の内容(remote)と merged が実質同一のときだけ保存を省略する。
  // ローカルだけの編集や削除がある場合は保存する（競合時は maxConflictRetries: 0 で conflict 扱い）。
  const needsSave = hasPendingLocalChanges(
    {
      snapshot: remote,
      relationalAI,
      relationalMatrix,
      relationalSales,
    },
    merged
  );

  if (needsSave) {
    // ローカル差分あり、または初回移行：保存を実行（成功すれば saveWorkspaceData 内でベースライン更新）
    await saveWorkspaceData(userId, merged, { maxConflictRetries: 0 });
  } else {
    // クラウド側と実質同一：保存を省略し、ベースラインのみ更新（updated_atの不要な更新を防止）
    try {
      localStorage.setItem(`${LAST_SYNC_PREFIX}${userId}`, JSON.stringify(merged));
    } catch (storageError) {
      console.warn('Could not update the local workspace sync baseline after load:', storageError);
    }
  }

  return merged;
}


/**
 * 一時的エラー（ネットワーク障害、レート制限429、タイムアウト408、サーバー5xx）の判定
 * これらは致命的エラーとせず、指数バックオフによる再試行の対象とする。
 */
export function isTransientRetryableError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'string') {
    return /429|408|500|502|503|504|timeout|timed out|fetch failed|failed to fetch|network error|econnreset|etimedout/i.test(error);
  }
  if (typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;
  const rawStatus = err.status ?? (err.error as any)?.status ?? (err.cause as any)?.status;
  const statusStr = String(rawStatus ?? '').trim();
  const statusNum = Number(rawStatus);
  const code = String(err.code ?? (err.error as any)?.code ?? (err.cause as any)?.code ?? '').trim();
  const message = String(err.message ?? (err.error as any)?.message ?? (err.cause as any)?.message ?? '');
  const details = String(err.details ?? (err.error as any)?.details ?? (err.cause as any)?.details ?? '');

  // HTTP 429 (Too Many Requests / Rate limit)
  if (code === '429' || statusStr === '429' || statusNum === 429) return true;

  // HTTP 408 (Request Timeout)
  if (code === '408' || statusStr === '408' || statusNum === 408) return true;

  // HTTP 5xx (500, 502, 503, 504 etc.)
  if ((statusNum >= 500 && statusNum < 600) || /^(500|502|503|504)$/.test(code) || /^(500|502|503|504)$/.test(statusStr)) {
    return true;
  }

  // ネットワークエラー
  const networkPattern = /failed to fetch|fetch failed|network error|networkerror|timeout|timed out|econnreset|econnrefused|etimedout|connection aborted/i;
  if (networkPattern.test(message) || networkPattern.test(details)) return true;

  try {
    const str = String(error);
    if (networkPattern.test(str)) return true;
  } catch {}

  return false;
}

/**
 * JWT expired エラーの判定
 */
export function isJwtExpiredError(error: unknown): boolean {
  if (!error) return false;
  const err = error as Record<string, unknown>;
  const code = String(err.code ?? (err.error as any)?.code ?? (err.cause as any)?.code ?? '');
  const message = String(err.message ?? (err.error as any)?.message ?? (err.cause as any)?.message ?? '');
  const details = String(err.details ?? (err.error as any)?.details ?? (err.cause as any)?.details ?? '');
  const allText = `${code} ${message} ${details}`;
  return (
    code === 'PGRST301' ||
    /jwt expired|token is expired/i.test(allText)
  );
}

/**
 * Supabase セッションの更新（refreshSession または getSession）
 */
export async function tryRefreshSupabaseSession(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (supabase && 'auth' in (supabase as any)) {
      const { data: refreshData, error: refreshError } = await (supabase as any).auth.refreshSession();
      if (!refreshError && refreshData?.session) {
        return true;
      }
      const { data: sessionData, error: sessionError } = await (supabase as any).auth.getSession();
      if (!sessionError && sessionData?.session) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[SessionRefresh] Failed to refresh session:', err);
  }
  return false;
}

export function isNonRetryableFatalError(error: unknown): boolean {
  if (!error) return false;

  // 1. 一時的エラー（429, 408, 5xx, ネットワークエラー）は絶対に致命的エラーにしない（再試行対象）
  if (isTransientRetryableError(error)) {
    return false;
  }

  // 2. 競合（40001, WORKSPACE_CONFLICT）はマージ再試行の対象なので fatal ではない
  if (isWorkspaceConflictError(error)) {
    return false;
  }

  if (typeof error !== 'object') {
    return false;
  }

  const err = error as Record<string, unknown>;
  const codeRaw = String(err.code ?? (err.error as any)?.code ?? (err.cause as any)?.code ?? '').trim();
  const statusRaw = String(err.status ?? (err.error as any)?.status ?? (err.cause as any)?.status ?? '').trim();
  const message = String(err.message ?? (err.error as any)?.message ?? (err.cause as any)?.message ?? '');
  const details = String(err.details ?? (err.error as any)?.details ?? (err.cause as any)?.details ?? '');

  // 【要件3】文字列全体から '401' / '403' を正規表現で検索するのをやめ、
  // code または status が 401 / 403 と完全一致する場合だけ認証エラーとする。
  if (codeRaw === '401' || statusRaw === '401' || codeRaw === '403' || statusRaw === '403') {
    return true;
  }

  // 明確な権限拒否メッセージ（'401'/'403'の数字検索は禁止）
  if (
    /permission denied|not authorized|権限がありません|User mismatch/i.test(message) ||
    /permission denied|not authorized|権限がありません|User mismatch/i.test(details)
  ) {
    return true;
  }

  // 【要件1】Postgres の SQLSTATE（5文字の英数字、例: 22P02, 42P01, 42501）だけを対象にするため、
  // /^[0-9A-Z]{5}$/i に一致する code に限定して判定すること。
  if (/^[0-9A-Z]{5}$/i.test(codeRaw)) {
    const upperCode = codeRaw.toUpperCase();

    // 42501: insufficient_privilege（Postgres 権限エラー）
    if (upperCode === '42501') {
      return true;
    }

    // Class 22: Data Exception（22P02 invalid_text_representation, 22001, 22007等）
    if (upperCode.startsWith('22')) {
      return true;
    }

    // Class 42: Syntax Error or Access Rule Violation（42804 datatype mismatch, 42P01 undefined table等）
    if (upperCode.startsWith('42')) {
      return true;
    }
  }

  // 400 Bad Request, 422 Unprocessable Entity（形式エラー）
  if (codeRaw === '400' || statusRaw === '400' || codeRaw === '422' || statusRaw === '422') {
    return true;
  }

  // 明確な形式エラーメッセージ（invalid input syntax 等）
  if (
    /invalid input syntax|invalid text representation|datatype mismatch/i.test(message) ||
    /invalid input syntax|invalid text representation|datatype mismatch/i.test(details)
  ) {
    return true;
  }

  // ラップされたエラーの再帰判定
  if (err.cause && typeof err.cause === 'object' && isNonRetryableFatalError(err.cause)) {
    return true;
  }
  if (err.error && typeof err.error === 'object' && isNonRetryableFatalError(err.error)) {
    return true;
  }

  return false;
}

export function isWorkspaceConflictError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'string') {
    return error.includes('WORKSPACE_CONFLICT') || error.includes('40001');
  }
  if (typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;
  const code = String(err.code ?? (err.error as any)?.code ?? (err.cause as any)?.code ?? '').trim();
  const message = String(err.message ?? (err.error as any)?.message ?? (err.cause as any)?.message ?? '');
  const details = String(err.details ?? (err.error as any)?.details ?? (err.cause as any)?.details ?? '');
  const hint = String(err.hint ?? (err.error as any)?.hint ?? (err.cause as any)?.hint ?? '');

  // 23505（一意制約違反）は競合ではないため除外（既存の自動リカバリ経路で処理）
  if (code === '23505') {
    return false;
  }

  // SQLSTATE 40001 または 'WORKSPACE_CONFLICT' の文字列だけを競合とする
  // （code === '409' などの単独判定は含めない）
  if (
    code === '40001' ||
    code.includes('40001') ||
    message.includes('WORKSPACE_CONFLICT') ||
    message.includes('40001') ||
    details.includes('WORKSPACE_CONFLICT') ||
    details.includes('40001') ||
    hint.includes('WORKSPACE_CONFLICT') ||
    hint.includes('40001')
  ) {
    return true;
  }

  // ラップされたエラー（cause / error / originalError）を再帰チェック
  if (err.cause && typeof err.cause === 'object' && isWorkspaceConflictError(err.cause)) {
    return true;
  }
  if (err.error && typeof err.error === 'object' && isWorkspaceConflictError(err.error)) {
    return true;
  }
  if (err.originalError && typeof err.originalError === 'object' && isWorkspaceConflictError(err.originalError)) {
    return true;
  }

  try {
    const str = String(error);
    if (str.includes('WORKSPACE_CONFLICT') || str.includes('40001')) {
      return true;
    }
  } catch {}

  return false;
}

export async function fetchLatestMatrixWorkspaceSyncState(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('mst_matrix_workspace_sync_state')
    .select('updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('Failed to fetch latest matrix sync state:', error);
    return null;
  }
  if (data?.updated_at) {
    matrixWorkspaceUpdatedAtByUser.set(userId, data.updated_at);
    return data.updated_at;
  }
  return null;
}

export async function resolveMatrixConflictAndMerge(
  userId: string,
  localData: WorkspaceData
): Promise<{ mergedData: WorkspaceData; newUpdatedAt: string }> {
  // 1. 最新の updated_at をサーバーから明示的に再取得してメモリマップを更新
  const latestUpdatedAt = await fetchLatestMatrixWorkspaceSyncState(userId);

  // 2. 最新のリレーショナルデータを取得（loadRelationalMatrixWorkspace 内でも updated_at が設定される）
  const relationalMatrix = await loadRelationalMatrixWorkspace(userId);
  const relationalSales = await loadRelationalSalesOperations();
  const baseline = loadLastSyncedData(userId);
  const newUpdatedAt = matrixWorkspaceUpdatedAtByUser.get(userId) || latestUpdatedAt || '';

  const merged = { ...localData };

  if (relationalMatrix) {
    merged.products = mergeRecords(relationalMatrix.products, localData.products, baseline.products || []);
    merged.tools = mergeRecords(relationalMatrix.tools, localData.tools, baseline.tools || []);
    merged.customLists = mergeRecords(relationalMatrix.customLists, localData.customLists, baseline.customLists || []);
    merged.marketingScenarios = deduplicateMarketingScenarios(
      mergeRecords(relationalMatrix.marketingScenarios, localData.marketingScenarios, baseline.marketingScenarios || [])
    );
  }

  if (relationalSales) {
    merged.contracts = mergeRecords(relationalSales.contracts, localData.contracts, baseline.contracts || []);
    merged.invoices = mergeRecords(relationalSales.invoices, localData.invoices, baseline.invoices || []);
  }

  const pendingDeletions = matrixService.getPendingDeletions(userId);
  merged.products = (merged.products || []).filter((record) => !pendingDeletions.products.has(record.id));
  merged.contracts = (merged.contracts || []).filter((record) => !pendingDeletions.contracts.has(record.id));
  merged.invoices = (merged.invoices || []).filter((record) => !pendingDeletions.invoices.has(record.id));

  return { mergedData: merged, newUpdatedAt };
}

export interface SaveWorkspaceOptions {
  maxConflictRetries?: number;
}

export interface SaveWorkspaceResult {
  savedData: WorkspaceData;
  wasMerged: boolean;
}

export async function saveWorkspaceData(
  userId: string,
  data: WorkspaceData,
  options?: SaveWorkspaceOptions
): Promise<SaveWorkspaceResult> {
  matrixService.setActiveUserId(userId);
  const supabase = getSupabaseClient();
  const maxRetries = options?.maxConflictRetries ?? 3;
  let currentData = data;
  let wasMerged = false;
  let retryCount = 0;
  let jwtRefreshAttempted = false;

  // 1. Matrix Workspace 保存（楽観的ロック・競合検知）を先に実行
  // これにより、Matrix競合時に AI Operations だけが先行保存される不整合を防ぐ
  while (true) {
    try {
      await saveRelationalMatrixWorkspace(userId, currentData);
      break; // 成功
    } catch (err) {
      // 【要件4】JWT expired は supabase のセッション更新で直る可能性があるため、1回だけ試してから再保存
      if (isJwtExpiredError(err) && !jwtRefreshAttempted) {
        jwtRefreshAttempted = true;
        logDeduplicatedSyncWarn('[WorkspaceSync] JWT expired detected. Attempting session refresh (attempt 1/1)...');
        await tryRefreshSupabaseSession();
        continue;
      }

      // 競合エラー（40001 / WORKSPACE_CONFLICT）はマージして再試行
      if (isWorkspaceConflictError(err) && retryCount < maxRetries) {
        retryCount++;
        // 指数バックオフ（1回目 約1秒, 2回目 約2秒, 3回目 約4秒 + ランダムジッター）
        // 即座の再試行によるDB CPU 100%負荷を完全に防止
        const baseDelayMs = 1000;
        const backoffMs = Math.round(baseDelayMs * Math.pow(2, retryCount - 1) + Math.random() * 200);
        logDeduplicatedSyncWarn(
          `[WorkspaceSync] WORKSPACE_CONFLICT (40001) detected. Backing off for ${backoffMs}ms before refetching latest data and 3-way auto-merge (attempt ${retryCount}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        const result = await resolveMatrixConflictAndMerge(userId, currentData);
        currentData = result.mergedData;
        wasMerged = true;
        continue;
      }

      // 直らない致命的エラー（401, 403, 22P02, 42804等）またはリフレッシュ済みのJWT expiredは即座にthrow
      if (isNonRetryableFatalError(err) || isJwtExpiredError(err)) {
        throw err;
      }

      // 一時的エラー（429, 408, 5xx, ネットワーク）は再試行
      if (isTransientRetryableError(err) && retryCount < maxRetries) {
        retryCount++;
        const baseDelayMs = 1000;
        const backoffMs = Math.round(baseDelayMs * Math.pow(2, retryCount - 1) + Math.random() * 200);
        logDeduplicatedSyncWarn(
          `[WorkspaceSync] Transient error encountered. Backing off for ${backoffMs}ms before retry (attempt ${retryCount}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      throw err;
    }
  }

  // 2. Matrix保存成功後に AI Operations を保存（最大3回リトライ・指数バックオフ保護付き）
  await saveRelationalAIOperations(userId, currentData, { maxRetries: 3 });

  // 3. 互換用スナップショットを更新
  const snapshotData = { ...currentData } as Partial<WorkspaceData>;
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

  // 4. マージが発生した場合はローカルストレージも最新データで更新
  if (wasMerged) {
    applyWorkspaceData(currentData);
  }

  try {
    localStorage.setItem(`${LAST_SYNC_PREFIX}${userId}`, JSON.stringify(currentData));
  } catch (storageError) {
    console.warn('Could not update the local workspace sync baseline:', storageError);
  }

  return { savedData: currentData, wasMerged };
}
