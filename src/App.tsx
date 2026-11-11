import React, { useState, useEffect, useRef, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UnifiedNavbar, UnifiedNavTab } from './components/UnifiedNavbar';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './components/Dashboard';
const TableManager = React.lazy(() => import('./components/TableManager').then((m) => ({ default: m.TableManager })));
const DiagnosisManager = React.lazy(() => import('./components/DiagnosisManager').then((m) => ({ default: m.DiagnosisManager })));
const PublicIntakeForm = React.lazy(() => import('./components/PublicIntakeForm').then((m) => ({ default: m.PublicIntakeForm })));
const PublicDocumentApplyView = React.lazy(() => import('./components/PublicDocumentApplyView').then((m) => ({ default: m.PublicDocumentApplyView })));
import { AuthScreen } from './components/AuthScreen';
const ConfigGuideModal = React.lazy(() => import('./components/ConfigGuideModal').then((m) => ({ default: m.ConfigGuideModal })));
const RlsGuideModal = React.lazy(() => import('./components/RlsGuideModal').then((m) => ({ default: m.RlsGuideModal })));
const RecordFormModal = React.lazy(() => import('./components/RecordFormModal').then((m) => ({ default: m.RecordFormModal })));
import { TableKey } from './types/database';
import { getSupabase, getAuthHeaders } from './lib/supabaseClient';
import { deleteTableRecord } from './services/dataService';
import { Loader2 } from 'lucide-react';

// AI President Views and Modals
const ChatView = React.lazy(() => import('./components/ai-president/ChatView').then((m) => ({ default: m.ChatView })));
const KnowledgeHubView = React.lazy(() => import('./components/ai-president/KnowledgeHubView').then((m) => ({ default: m.KnowledgeHubView })));
const ProjectsView = React.lazy(() => import('./components/ai-president/ProjectsView').then((m) => ({ default: m.ProjectsView })));
const TasksView = React.lazy(() => import('./components/ai-president/TasksView').then((m) => ({ default: m.TasksView })));
const PresetsView = React.lazy(() => import('./components/ai-president/PresetsView').then((m) => ({ default: m.PresetsView })));
const CharacterEditor = React.lazy(() => import('./components/ai-president/CharacterEditor').then((m) => ({ default: m.CharacterEditor })));
const UserProfileEditor = React.lazy(() => import('./components/ai-president/UserProfileEditor').then((m) => ({ default: m.UserProfileEditor })));
const PlanRegistrationModal = React.lazy(() => import('./components/ai-president/PlanRegistrationModal').then((m) => ({ default: m.PlanRegistrationModal })));
const BackupModal = React.lazy(() => import('./components/ai-president/BackupModal').then((m) => ({ default: m.BackupModal })));
const PricingSettingsModal = React.lazy(() => import('./components/ai-president/PricingSettingsModal').then((m) => ({ default: m.PricingSettingsModal })));

// Matrix & Universal Product Views
const ProductHubView = React.lazy(() => import('./components/matrix/ProductHubView').then((m) => ({ default: m.ProductHubView })));
const CategoryHubView = React.lazy(() => import('./components/matrix/CategoryHubView').then((m) => ({ default: m.CategoryHubView })));
const CustomListManager = React.lazy(() => import('./components/matrix/CustomListManager').then((m) => ({ default: m.CustomListManager })));
const SalesOperationsWorkspace = React.lazy(() => import('./components/SalesOperationsWorkspace').then((m) => ({ default: m.SalesOperationsWorkspace })));
const CommunicationSendCenter = React.lazy(() => import('./components/CommunicationSendCenter').then((m) => ({ default: m.CommunicationSendCenter })));
const AutomationView = React.lazy(() => import('./components/matrix/AutomationView').then((m) => ({ default: m.AutomationView })));
const DocumentTemplateView = React.lazy(() => import('./components/matrix/DocumentTemplateView').then((m) => ({ default: m.DocumentTemplateView })));
const MarketingAutomationPrototypeView = React.lazy(() => import('./components/marketing/MarketingAutomationPrototypeView').then((m) => ({ default: m.MarketingAutomationPrototypeView })));
const AIAcquisitionOperationsView = React.lazy(() => import('./components/marketing/AIAcquisitionOperationsView').then((m) => ({ default: m.AIAcquisitionOperationsView })));
const MarketingLeadListHub = React.lazy(() => import('./components/marketing/MarketingLeadListHub').then((m) => ({ default: m.MarketingLeadListHub })));
const SalesPipelineHub = React.lazy(() => import('./components/sales/SalesPipelineHub').then((m) => ({ default: m.SalesPipelineHub })));
const ProductProjectHub = React.lazy(() => import('./components/matrix/ProductProjectHub').then((m) => ({ default: m.ProductProjectHub })));
const AiPresetsAutomationsHub = React.lazy(() => import('./components/matrix/AiPresetsAutomationsHub').then((m) => ({ default: m.AiPresetsAutomationsHub })));
const ContactsLineHub = React.lazy(() => import('./components/ContactsLineHub').then((m) => ({ default: m.ContactsLineHub })));
const IntegratedCalendarWorkspace = React.lazy(() => import('./components/calendar/IntegratedCalendarWorkspace').then((m) => ({ default: m.IntegratedCalendarWorkspace })));
const UnifiedInboxView = React.lazy(() => import('./components/inbox/UnifiedInboxView').then((m) => ({ default: m.UnifiedInboxView })));
import { SendDrawerProvider, useSendDrawer } from './context/SendDrawerContext';
import { QuickPresidentDrawer, getPageAssistantProfile } from './components/matrix/QuickPresidentDrawer';

// Storage and Types
import {
  CharacterConfig,
  UserProfile,
  ChatMessage,
  Project,
  TaskItem,
  ApprovalItem,
  ActivityLog,
  ProposedPlan,
  Priority,
  TaskAssignee,
  TaskDraftArtifact,
  ModelPricingRate,
  TokenUsageRecord,
  ApiUsageData,
  KnowledgeItem,
  KnowledgeAttachment,
  WorkspaceAttachment,
  TaskWorkArea,
  TaskSourceCategory,
  TaskKind,
  TaskRelatedRecordType,
} from './types';
import { MarketingScenario } from './types/marketing';
import {
  loadCharacters,
  saveCharacters,
  loadActiveCharacterId,
  saveActiveCharacterId,
  loadUserProfile,
  saveUserProfile,
  loadChatHistory,
  loadKnowledgeItems,
  saveKnowledgeItems,
  saveChatHistory,
  loadProjects,
  saveProjects,
  loadTasks,
  saveTasks,
  loadApprovals,
  saveApprovals,
  loadActivityLogs,
  saveActivityLogs,
  recordActivityLog,
  loadTopGoal,
  saveTopGoal,
  loadPricingRates,
  savePricingRates,
  loadTokenUsageRecords,
  saveTokenUsageRecords,
  recordTokenUsage,
} from './utils/storage';
import { loadMarketingScenarios, saveMarketingScenarios } from './utils/marketingStorage';
import { PRESET_CHARACTERS } from './data/presets';
import { AI_WORK_MODES, getAIWorkMode, resolveWorkMode, AIWorkModeId, RoleAIOverride } from './data/aiWorkModes';
import { AIModelSetting, AIProviderId, AI_PROVIDERS, isProviderId } from './data/aiModels';
import { loadAIModelSettings, saveAIModelSettings, AIModelSettings } from './utils/aiSettingsStorage';
import { ModalShell } from './components/ModalShell';
const RoleAIEditor = React.lazy(() => import('./components/ai-president/RoleAIEditor').then((m) => ({ default: m.RoleAIEditor })));
const ModelSettingsModal = React.lazy(() => import('./components/ai-president/ModelSettingsModal').then((m) => ({ default: m.ModelSettingsModal })));
import { useProviderStatus } from './components/ai-president/ModelSettingEditor';
import { matrixService } from './services/matrixService';
import { todayJst } from './utils/date';
import { publishManagedProductToSalesCatalog, syncManagedProductToSalesCatalog } from './services/productCatalogService';
import { deleteWorkspaceAttachment, downloadWorkspaceAttachment, uploadWorkspaceAttachment } from './services/knowledgeAttachmentService';
import {
  loadOrMigrateWorkspaceData,
  saveWorkspaceData,
  WorkspaceData,
  isWorkspaceConflictError,
} from './services/workspaceStateService';
import { mergeCollectionPreservingUserEdits } from './utils/workspaceMergeUtils';
import {
  workspaceSaveCoordinator,
} from './services/workspaceSaveCoordinator';
import { 
  ManagedProduct, 
  ManagedContract, 
  ManagedInvoice, 
  ManagedToolAsset, 
  CustomListDefinition, 
  AutomationRule 
} from './types/matrix';

import { generateBusinessSummaryContext } from './services/businessSummaryService';


const ViewLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 px-4 space-y-3 min-h-[400px]">
    <div className="relative flex items-center justify-center">
      <div className="w-9 h-9 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
    </div>
    <span className="text-xs font-medium text-slate-500">画面を読み込んでいます…</span>
  </div>
);

type DiagnosisSubmissionAutomationEvent = { id: string; form_id: string; lead_id: string | null; company_id: string | null; diagnosis_id?: string | null };

const MAX_CHAT_CONTEXT_MESSAGES = 12;
const MAX_CHAT_CONTEXT_CHARACTERS = 16000;

function selectKnowledgeContext(
  items: KnowledgeItem[],
  request: string,
  workModeId: AIWorkModeId,
  audience: 'president' | 'role' | 'custom' = workModeId === 'president' ? 'president' : 'role',
): string {
  const visibleItems = items.filter((item) => {
    const access = item.knowledgeAccess;
    if (!access) return audience === 'president';
    if (access.scope === 'all') return true;
    if (access.scope === 'president') return audience === 'president';
    return audience === 'president' || (audience === 'role' && workModeId !== 'president' && (access.roleIds || []).includes(workModeId));
  });
  if (!visibleItems.length) return '';
  const normalize = (value: string) => value.toLowerCase().replace(/[\s、。,.!?！？・「」『』（）【】]/g, '');
  const bigrams = (value: string) => {
    const chars = Array.from(normalize(value));
    const pairs = new Set<string>();
    for (let i = 0; i < chars.length - 1; i += 1) pairs.add(chars[i] + chars[i + 1]);
    return pairs;
  };
  const queryPairs = bigrams(request);
  const preferredCategoriesByRole: Record<string, string[]> = {
    marketing_strategy: ['business', 'product', 'research'],
    marketing_execution: ['product', 'business', 'deliverable'],
    sales_operations: ['customer', 'product'],
    billing_operations: ['business', 'decision'],
    operations_management: ['business', 'decision', 'deliverable'],
    new_product: ['product', 'customer', 'research'],
    customer_product: ['product', 'customer'],
    diagnosis: ['customer', 'research'],
    research: ['research', 'business'],
  };
  const preferredCategories = preferredCategoriesByRole[workModeId] || [];
  const ranked = visibleItems.map((item) => {
    const title = normalize(item.title);
    const tags = normalize(item.tags.join(' '));
    const content = normalize(item.content);
    let titleHits = 0;
    let tagHits = 0;
    let contentHits = 0;
    queryPairs.forEach((pair) => {
      if (title.includes(pair)) titleHits += 1;
      else if (tags.includes(pair)) tagHits += 1;
      else if (content.includes(pair)) contentHits += 1;
    });
    const categoryBoost = preferredCategories.includes(item.category) ? 3 : 0;
    const score = titleHits * 4 + tagHits * 3 + contentHits + categoryBoost + (item.category === 'business' ? 1 : 0);
    return { item, score };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
    .slice(0, 3);
  return ranked.map(({ item }) =>
    '【' + item.title + ' / ' + item.category + '】\n' + item.content.slice(0, 2400)
  ).join('\n\n');
}

/**
 * アドネスAI方式・最先端セマンティックRAG（ベクトル検索 + レキシカルフォールバックのハイブリッド検索）
 */
async function retrieveKnowledgeContext(
  items: KnowledgeItem[],
  request: string,
  workModeId: AIWorkModeId,
  audience: 'president' | 'role' | 'custom' = workModeId === 'president' ? 'president' : 'role',
): Promise<string> {
  const visibleItems = items.filter((item) => {
    const access = item.knowledgeAccess;
    if (!access) return audience === 'president';
    if (access.scope === 'all') return true;
    if (access.scope === 'president') return audience === 'president';
    return audience === 'president' || (audience === 'role' && workModeId !== 'president' && (access.roleIds || []).includes(workModeId));
  });
  if (!visibleItems.length) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/knowledge/semantic-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      signal: controller.signal,
      body: JSON.stringify({
        query: request,
        items: visibleItems.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          tags: item.tags,
          content: item.content.slice(0, 1000),
          embedding: item.embedding,
        })),
        limit: 3,
      }),
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        return data.matches.map((m: any) => {
          const matchItem = visibleItems.find((vi) => vi.id === m.item.id) || m.item;
          const scorePercent = Math.round((m.similarity || 0) * 100);
          return `【${matchItem.title} / ${matchItem.category}（意味関連度: ${scorePercent}%）】\n${matchItem.content.slice(0, 2400)}`;
        }).join('\n\n');
      }
    }
  } catch {
    // タイムアウトや失敗時はレキシカル検索へ自動フォールバック
  }

  return selectKnowledgeContext(items, request, workModeId, audience);
}
function buildBoundedChatContext(messages: ChatMessage[]) {
  const context = messages.slice(-MAX_CHAT_CONTEXT_MESSAGES).map(({ role, content }) => ({ role, content }));
  let totalCharacters = context.reduce((total, message) => total + message.content.length, 0);

  while (context.length > 1 && totalCharacters > MAX_CHAT_CONTEXT_CHARACTERS) {
    totalCharacters -= context.shift()!.content.length;
  }

  if (context.length === 1 && context[0].content.length > MAX_CHAT_CONTEXT_CHARACTERS) {
    context[0].content = context[0].content.slice(-MAX_CHAT_CONTEXT_CHARACTERS);
  }

  return context;
}


async function loadTaskRelatedContext(task: TaskItem): Promise<string> {
  const related = task.relatedRecord;
  if (!related?.id) return '';
  const tableByType: Record<TaskRelatedRecordType, TableKey> = {
    company: 'companies', contact: 'contacts', prospect: 'prospects', lead: 'leads',
    deal: 'deals', customer: 'customers', product: 'products',
  };
  const supabase = getSupabase();
  if (!supabase) return '関連レコードは設定されていますが、データベースに接続できませんでした。';
  try {
    const { data, error } = await supabase.from(tableByType[related.type]).select('*').eq('id', related.id).maybeSingle();
    if (error || !data) return '関連レコードは設定されていますが、現在の情報を取得できませんでした。';
    const fieldsByType: Record<TaskRelatedRecordType, string[]> = {
      company: ['company_name', 'industry', 'status', 'source'],
      prospect: ['company_name', 'industry', 'status', 'source', 'approach_method', 'ai_reason'],
      contact: ['contact_name', 'position', 'department', 'status'],
      lead: ['status', 'source', 'service_type', 'priority_channel'],
      deal: ['proposal_plan_name', 'proposal_status', 'proposal_type', 'total_amount', 'meeting_date'],
      customer: ['contract_status', 'contract_start_date'],
      product: ['product_name', 'product_type', 'target_customer', 'description'],
    };
    const fields = fieldsByType[related.type]
      .filter((key) => data[key] !== null && data[key] !== undefined && String(data[key]).trim())
      .map((key) => `${key}: ${String(data[key]).slice(0, 300)}`);
    let supportContext = '';
    if (task.supportEngagementId) {
      const { data: support, error: supportError } = await supabase.from('customer_service_engagements')
        .select('title,status,next_meeting_at,support_details').eq('id', task.supportEngagementId).maybeSingle();
      if (!supportError && support) {
        const details = support.support_details && typeof support.support_details === 'object' ? support.support_details : {};
        supportContext = [
          '支援: ' + String(support.title || ''),
          'フェーズ: ' + String(details.phase || '未設定'),
          '現在のテーマ: ' + String(details.currentTheme || '未設定'),
          '次回テーマ: ' + String(details.nextTheme || '未設定'),
          '次回日時: ' + String(support.next_meeting_at || '未設定'),
          '重要課題: ' + String(details.keyIssue || '未設定'),
        ].join('\n');
      }
    }
    return [`関連先: ${related.label || related.type} (ID: ${related.id})`, ...fields, supportContext].filter(Boolean).join('\n').slice(0, 2200);
  } catch {
    return '関連レコードは設定されていますが、現在の情報を取得できませんでした。';
  }
}

type AppModalKey =
  | 'config'
  | 'rls'
  | 'quick_create'
  | 'character_editor'
  | 'role_editor'
  | 'model_settings'
  | 'profile'
  | 'plan'
  | 'pricing'
  | 'backup'
  | 'quick_drawer'
  | 'send_drawer';

interface AppHistoryState {
  mst: true;
  tab: UnifiedNavTab;
  acquisitionTargetTab?: string;
  inboxTargetChannel?: 'line' | 'email' | 'forms';
  customerWorkspaceContext?: any;
  modal?: AppModalKey | null;
}

/**
 * 指摘1対応: 競合マージ時に保存中のユーザー編集を消失させないマージヘルパー
 * 保存開始時(saving)から現在(current)までに変更されたローカル編集を最優先し、
 * 保存中に変更されていない項目のみマージ結果(merged)を取り込む。
 */
function AppContent() {
  const { user, isLoading } = useAuth();
  const { openSendDrawer, showToast } = useSendDrawer();
  const [currentTab, setCurrentTab] = useState<UnifiedNavTab>('mst_dashboard');
  const [sendOriginContext, setSendOriginContext] = useState<{
    tab: UnifiedNavTab;
    tabLabel: string;
    scrollY?: number;
    customerWorkspaceContext?: any;
  } | null>(null);

  const getTabFriendlyLabel = (tab: UnifiedNavTab): string => {
    switch (tab) {
      case 'mst_dashboard': return '経営ダッシュボード';
      case 'unified_calendar': return '予定カレンダー';
      case 'inbox_hub': return '統合受信トレイ';
      case 'leads': return '反響リード';
      case 'deals': return '商談一覧';
      case 'customers': return '顧客台帳';
      case 'document_templates': return '重要書類・見積・契約';
      case 'customer_operations': return '支援案件・契約・請求';
      case 'mst_diagnoses': return 'フォーム作成・配布資料';
      case 'contacts': return '連絡先・LINE友だち';
      case 'prospects': return '見込み企業';
      case 'ai_acquisition': return '集客戦略・SNS';
      case 'marketing_automation': return '自動配信・シナリオ';
      case 'companies': return '会社台帳';
      case 'products': return '商品マスタ';
      default: return String(tab);
    }
  };

  const [customerWorkspaceContext, setCustomerWorkspaceContext] = useState<{ companyId: string; leadId?: string; dealId?: string; section?: 'forms' | 'diagnoses' | 'answers' | 'materials'; documentType?: 'invoice' | 'proposal' | 'estimate' | 'contract' | 'monthly_report'; documentId?: string; sendKind?: 'document'|'form'|'diagnosis'|'deal'|'customer_meeting'|'announcement'; formId?: string; contactId?: string } | undefined>();
  const [lineInboxContact, setLineInboxContact] = useState<{ contactId: string; lineUserId: string } | undefined>();
  const [inboxTargetChannel, setInboxTargetChannel] = useState<'line' | 'email' | 'forms' | undefined>(undefined);
  const [acquisitionTargetTab, setAcquisitionTargetTab] = useState<string | undefined>(undefined);

  const isPopStateRef = useRef(false);

  const handleNavigateWorkspaceTab = (
    tab: UnifiedNavTab | string,
    options?: {
      inboxChannel?: 'line' | 'email' | 'forms';
      acquisitionTab?: string;
      studioMode?: 'broadcast' | 'dm_sales';
      context?: any;
    }
  ) => {
    const targetTab = tab as UnifiedNavTab;
    if (targetTab === 'communication_send' && currentTab !== 'communication_send') {
      setSendOriginContext({
        tab: currentTab,
        tabLabel: getTabFriendlyLabel(currentTab),
        scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
        customerWorkspaceContext,
      });
    }
    if (options?.inboxChannel) {
      setInboxTargetChannel(options.inboxChannel);
      try {
        localStorage.setItem('unified_inbox_active_channel', options.inboxChannel);
      } catch {}
    }
    if (options?.acquisitionTab) {
      setAcquisitionTargetTab(options.acquisitionTab);
      try {
        localStorage.setItem('ai_acquisition_active_tab', options.acquisitionTab);
      } catch {}
    }
    if (options?.studioMode) {
      try {
        localStorage.setItem('social_studio_mode', options.studioMode);
      } catch {}
    }
    if (options?.context !== undefined) {
      setCustomerWorkspaceContext(options.context);
    }
    if (targetTab === 'ai_tasks') setSelectedTaskWorkspaceSection('tasks');
    if (targetTab === 'marketing_automation') setLineInboxContact(undefined);

    setCurrentTab(targetTab);

    if (!isPopStateRef.current && typeof window !== 'undefined') {
      const cur = window.history.state as AppHistoryState | null;
      if (
        cur?.mst &&
        cur.tab === targetTab &&
        cur.acquisitionTargetTab === (options?.acquisitionTab ?? acquisitionTargetTab) &&
        cur.inboxTargetChannel === (options?.inboxChannel ?? inboxTargetChannel) &&
        !cur.modal
      ) {
        return;
      }
      const nextState: AppHistoryState = {
        mst: true,
        tab: targetTab,
        acquisitionTargetTab: options?.acquisitionTab ?? acquisitionTargetTab,
        inboxTargetChannel: options?.inboxChannel ?? inboxTargetChannel,
        customerWorkspaceContext: options?.context ?? customerWorkspaceContext,
        modal: null,
      };
      window.history.pushState(nextState, '', window.location.href);
    }
  };

  const customerWorkspaceCompanyId = customerWorkspaceContext?.companyId;
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState<'loading' | 'saving' | 'saved' | 'error' | 'conflict'>('loading');
  const [workspaceSaveError, setWorkspaceSaveError] = useState('');

  const workspaceSyncEnabledRef = useRef(false);

  // 保存コーディネーターのステータス変化とマージイベントを監視
  useEffect(() => {
    const unsubscribe = workspaceSaveCoordinator.addListener({
      onStatusChange: (status, errorMessage) => {
        setWorkspaceSyncStatus(status);
        if (errorMessage !== undefined) {
          setWorkspaceSaveError(errorMessage);
        }
        // 指摘2: 競合発生時は自動同期フラグを停止
        if (status === 'conflict') {
          workspaceSyncEnabledRef.current = false;
        }
      },
      onMergedData: (mergedData, savingData) => {
        // 指摘1: 保存中のローカル編集を優先維持しながら最新マージ結果を反映
        console.info('[App] Synchronizing React states with 3-way merged workspace data (preserving active edits)');
        setProducts((current) => mergeCollectionPreservingUserEdits(current, savingData.products || [], mergedData.products || []));
        setContracts((current) => mergeCollectionPreservingUserEdits(current, savingData.contracts || [], mergedData.contracts || []));
        setInvoices((current) => mergeCollectionPreservingUserEdits(current, savingData.invoices || [], mergedData.invoices || []));
        setTools((current) => mergeCollectionPreservingUserEdits(current, savingData.tools || [], mergedData.tools || []));
        setCustomLists((current) => mergeCollectionPreservingUserEdits(current, savingData.customLists || [], mergedData.customLists || []));
        setMarketingScenarios((current) => mergeCollectionPreservingUserEdits(current, savingData.marketingScenarios || [], mergedData.marketingScenarios || []));
      },
    });
    return unsubscribe;
  }, []);

  // MST Modals
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isRlsOpen, setIsRlsOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateTable, setQuickCreateTable] = useState<TableKey>('deals');

  // AI President States
  const [characters, setCharacters] = useState<CharacterConfig[]>(() => loadCharacters());
  const [activeCharacterId, setActiveCharacterId] = useState<string>(() =>
    loadActiveCharacterId(characters)
  );
  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadUserProfile());
  const [topGoal, setTopGoal] = useState<string>(() => loadTopGoal());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadTasks());
  const [approvals, setApprovals] = useState<ApprovalItem[]>(() => loadApprovals());
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => loadActivityLogs());
  const [pricingRates, setPricingRates] = useState<ModelPricingRate[]>(() => loadPricingRates());
  const [tokenUsageRecords, setTokenUsageRecords] = useState<TokenUsageRecord[]>(() =>
    loadTokenUsageRecords()
  );
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(() => loadKnowledgeItems());
  const [selectedKnowledgeItemId, setSelectedKnowledgeItemId] = useState<string | null>(null);
  const [workModeHistories, setWorkModeHistories] = useState<Record<string, ChatMessage[]>>({});
  const [activeWorkModeId, setActiveWorkModeId] = useState<AIWorkModeId>('president');

  // Chat States: role and character each have an independent history.
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const current = loadChatHistory(`${activeCharacterId}:president`);
    return current.length ? current : loadChatHistory(activeCharacterId);
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const activeAbortController = useRef<AbortController | null>(null);
  const taskExecutionInProgress = useRef(false);
  const autoRunTaskIdsRef = useRef<Set<string>>(new Set());
  const [autoRunQueueRevision, setAutoRunQueueRevision] = useState(0);

  // AI President Modals
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCharacterEditorOpen, setIsCharacterEditorOpen] = useState(false);
  // 編集対象は「チャットで選択中のAI」とは独立させる（編集ボタンでチャットが切り替わらないようにする）
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [aiModelSettings, setAiModelSettings] = useState<AIModelSettings>(() => loadAIModelSettings());
  const [editingRoleId, setEditingRoleId] = useState<AIWorkModeId | null>(null);
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const { providers: providerStatuses } = useProviderStatus();
  const [isQuickDrawerOpen, setIsQuickDrawerOpen] = useState(false);
  const [activePlanForModal, setActivePlanForModal] = useState<ProposedPlan | null>(null);
  const [selectedProjectIdForTasks, setSelectedProjectIdForTasks] = useState<string | null>(null);
  const [selectedTaskWorkspaceSection, setSelectedTaskWorkspaceSection] = useState<'tasks' | 'approvals' | 'logs'>('tasks');

  const openModalWithHistory = (modalKey: AppModalKey) => {
    if (modalKey === 'config') setIsConfigOpen(true);
    else if (modalKey === 'rls') setIsRlsOpen(true);
    else if (modalKey === 'quick_create') setQuickCreateOpen(true);
    else if (modalKey === 'character_editor') setIsCharacterEditorOpen(true);
    else if (modalKey === 'model_settings') setIsModelSettingsOpen(true);
    else if (modalKey === 'profile') setIsProfileModalOpen(true);
    else if (modalKey === 'pricing') setIsPricingModalOpen(true);
    else if (modalKey === 'backup') setIsBackupModalOpen(true);
    else if (modalKey === 'quick_drawer') setIsQuickDrawerOpen(true);

    if (!isPopStateRef.current && typeof window !== 'undefined') {
      const nextState: AppHistoryState = {
        mst: true,
        tab: currentTab,
        acquisitionTargetTab,
        inboxTargetChannel,
        customerWorkspaceContext,
        modal: modalKey,
      };
      window.history.pushState(nextState, '', window.location.href);
    }
  };

  const closeModalWithHistory = (modalKey: AppModalKey) => {
    if (typeof window !== 'undefined') {
      const cur = window.history.state as AppHistoryState | null;
      if (cur?.mst && cur.modal === modalKey) {
        window.history.back();
        return;
      }
    }
    if (modalKey === 'config') setIsConfigOpen(false);
    else if (modalKey === 'rls') setIsRlsOpen(false);
    else if (modalKey === 'quick_create') setQuickCreateOpen(false);
    else if (modalKey === 'character_editor') {
      setIsCharacterEditorOpen(false);
      setEditingCharacterId(null);
    }
    else if (modalKey === 'model_settings') setIsModelSettingsOpen(false);
    else if (modalKey === 'profile') setIsProfileModalOpen(false);
    else if (modalKey === 'pricing') setIsPricingModalOpen(false);
    else if (modalKey === 'backup') setIsBackupModalOpen(false);
    else if (modalKey === 'quick_drawer') setIsQuickDrawerOpen(false);
    else if (modalKey === 'plan') setActivePlanForModal(null);
    else if (modalKey === 'role_editor') setEditingRoleId(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialState: AppHistoryState = {
      mst: true,
      tab: currentTab,
      acquisitionTargetTab,
      inboxTargetChannel,
      customerWorkspaceContext,
      modal: null,
    };
    if (!window.history.state?.mst) {
      window.history.replaceState(initialState, '', window.location.href);
    } else {
      const s = window.history.state as AppHistoryState;
      if (s.tab && s.tab !== 'ai_dashboard') {
        setCurrentTab(s.tab);
      } else {
        setCurrentTab('mst_dashboard');
      }
      if (s.acquisitionTargetTab) setAcquisitionTargetTab(s.acquisitionTargetTab);
      if (s.inboxTargetChannel) setInboxTargetChannel(s.inboxTargetChannel);
      if (s.customerWorkspaceContext) setCustomerWorkspaceContext(s.customerWorkspaceContext);
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as AppHistoryState | undefined;
      if (!state || !state.mst) {
        return;
      }
      isPopStateRef.current = true;

      if (state.tab) {
        setCurrentTab(state.tab === 'ai_dashboard' ? 'mst_dashboard' : state.tab);
      }
      if (state.acquisitionTargetTab !== undefined) {
        setAcquisitionTargetTab(state.acquisitionTargetTab);
        try {
          if (state.acquisitionTargetTab) {
            localStorage.setItem('ai_acquisition_active_tab', state.acquisitionTargetTab);
          }
        } catch {}
      }
      if (state.inboxTargetChannel !== undefined) {
        setInboxTargetChannel(state.inboxTargetChannel);
        try {
          if (state.inboxTargetChannel) {
            localStorage.setItem('unified_inbox_active_channel', state.inboxTargetChannel);
          }
        } catch {}
      }
      setCustomerWorkspaceContext(state.customerWorkspaceContext);

      setIsConfigOpen(state.modal === 'config');
      setIsRlsOpen(state.modal === 'rls');
      setQuickCreateOpen(state.modal === 'quick_create');
      setIsCharacterEditorOpen(state.modal === 'character_editor');
      setIsModelSettingsOpen(state.modal === 'model_settings');
      setIsProfileModalOpen(state.modal === 'profile');
      setIsPricingModalOpen(state.modal === 'pricing');
      setIsBackupModalOpen(state.modal === 'backup');
      setIsQuickDrawerOpen(state.modal === 'quick_drawer');
      if (state.modal !== 'plan') {
        setActivePlanForModal(null);
      }
      if (state.modal !== 'role_editor') {
        setEditingRoleId(null);
      }

      setTimeout(() => {
        isPopStateRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Matrix & Product States
  const [products, setProducts] = useState<ManagedProduct[]>(() => matrixService.loadProducts());
  const [contracts, setContracts] = useState<ManagedContract[]>(() => matrixService.loadContracts());
  const [invoices, setInvoices] = useState<ManagedInvoice[]>(() => matrixService.loadInvoices());
  const [tools, setTools] = useState<ManagedToolAsset[]>(() => matrixService.loadTools());
  const [customLists, setCustomLists] = useState<CustomListDefinition[]>(() => matrixService.loadCustomLists());
  const [automations, setAutomations] = useState<AutomationRule[]>(() => matrixService.loadAutomations());
  const automationSubmissionHandlerRef = useRef<(event: DiagnosisSubmissionAutomationEvent) => boolean>(() => false);
  const processedDiagnosisSubmissionIdsRef = useRef<Set<string>>(new Set());
  const [marketingScenarios, setMarketingScenarios] = useState<MarketingScenario[]>(() => loadMarketingScenarios());

  // AI社長とMatrixのデータをユーザー単位でSupabaseに同期し、初回は既存LocalStorageを移行する。
  useEffect(() => {
    let cancelled = false;
    // 指摘4対応: ユーザー切替・ログアウト時にコーディネーターを完全リセット
    workspaceSaveCoordinator.reset();
    workspaceSyncEnabledRef.current = false;
    setWorkspaceReady(false);
    setWorkspaceSyncStatus('loading');
    setWorkspaceSaveError('');

    if (!user) {
      return () => {
        cancelled = true;
        workspaceSaveCoordinator.reset();
      };
    }

    loadOrMigrateWorkspaceData(user.id)
      .then((data) => {
        if (cancelled) return;
        setTopGoal(data.topGoal);
        setCharacters(data.characters);
        const nextActiveCharacterId = data.characters.some((character) => character.id === data.activeCharacterId)
          ? data.activeCharacterId
          : data.characters[0]?.id || activeCharacterId;
        setActiveCharacterId(nextActiveCharacterId);
        setUserProfile(data.userProfile);
        setAiModelSettings(data.aiModelSettings);
        setProjects(data.projects);
        setTasks(data.tasks);
        setApprovals(data.approvals);
        setActivityLogs(data.activityLogs);
        setPricingRates(data.pricingRates);
        setTokenUsageRecords(data.tokenUsage);
        setProducts(data.products);
        setContracts(data.contracts);
        setInvoices(data.invoices);
        setTools(data.tools);
        setCustomLists(data.customLists);
        setAutomations(matrixService.normalizeAutomationRules(data.automations));
        setMarketingScenarios(data.marketingScenarios || []);
        setKnowledgeItems(data.knowledgeItems || []);
        setWorkModeHistories(data.workModeHistories || {});
        const initialChatKey = `${nextActiveCharacterId}:${activeWorkModeId}`;
        const savedChat = data.workModeHistories?.[initialChatKey] || loadChatHistory(initialChatKey);
        setMessages(savedChat.length ? savedChat : activeWorkModeId === 'president' ? loadChatHistory(nextActiveCharacterId) : []);
        workspaceSaveCoordinator.setInitialSavedSnapshot(data);
        workspaceSyncEnabledRef.current = true;
        setWorkspaceSyncStatus('saved');
        setWorkspaceReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Workspace cloud load failed:', error);
        workspaceSyncEnabledRef.current = false;
        if (isWorkspaceConflictError(error)) {
          workspaceSaveCoordinator.haltOnConflict('他の端末で更新されています。最新データを再読み込みしてください');
          setWorkspaceSyncStatus('conflict');
          setWorkspaceSaveError('他の端末で更新されています。最新データを再読み込みしてください');
        } else {
          const errorMessage = (error as { message?: string })?.message || '';
          setWorkspaceSyncStatus('error');
          setWorkspaceSaveError(errorMessage
            ? `クラウド同期に失敗しました: ${errorMessage}`
            : 'クラウド同期に失敗しました。接続設定と mst_workspace_state テーブルのマイグレーションを確認してください。');
        }
        setWorkspaceReady(true);
      });

    return () => {
      cancelled = true;
      workspaceSaveCoordinator.reset();
    };
  }, [user?.id]);

  const handleRetrySync = () => {
    if (!user) return;
    setWorkspaceSyncStatus('loading');
    setWorkspaceSaveError('');
    loadOrMigrateWorkspaceData(user.id)
      .then((data) => {
        setTopGoal(data.topGoal);
        setCharacters(data.characters);
        const nextActiveCharacterId = data.characters.some((character) => character.id === data.activeCharacterId)
          ? data.activeCharacterId
          : data.characters[0]?.id || activeCharacterId;
        setActiveCharacterId(nextActiveCharacterId);
        setUserProfile(data.userProfile);
        setAiModelSettings(data.aiModelSettings);
        setProjects(data.projects);
        setTasks(data.tasks);
        setApprovals(data.approvals);
        setActivityLogs(data.activityLogs);
        setPricingRates(data.pricingRates);
        setTokenUsageRecords(data.tokenUsage);
        setProducts(data.products);
        setContracts(data.contracts);
        setInvoices(data.invoices);
        setTools(data.tools);
        setCustomLists(data.customLists);
        setAutomations(matrixService.normalizeAutomationRules(data.automations));
        setMarketingScenarios(data.marketingScenarios || []);
        setKnowledgeItems(data.knowledgeItems || []);
        setWorkModeHistories(data.workModeHistories || {});
        workspaceSaveCoordinator.setInitialSavedSnapshot(data);
        workspaceSyncEnabledRef.current = true;
        setWorkspaceSyncStatus('saved');
        setWorkspaceReady(true);
      })
      .catch((error) => {
        console.error('Retry workspace cloud load failed:', error);
        workspaceSyncEnabledRef.current = false;
        if (isWorkspaceConflictError(error)) {
          workspaceSaveCoordinator.haltOnConflict('他の端末で更新されています。最新データを再読み込みしてください');
          setWorkspaceSyncStatus('conflict');
          setWorkspaceSaveError('他の端末で更新されています。最新データを再読み込みしてください');
        } else {
          const errorMessage = (error as { message?: string })?.message || '';
          setWorkspaceSyncStatus('error');
          setWorkspaceSaveError(errorMessage
            ? `クラウド同期に失敗しました: ${errorMessage}`
            : 'クラウド同期に失敗しました。接続設定と mst_workspace_state テーブルのマイグレーションを確認してください。');
        }
        setWorkspaceReady(true);
      });
  };

  // 保存最適化：タイマーが発火するまで巨大オブジェクト構築・JSON.stringifyを行わない
  useEffect(() => {
    if (!user || !workspaceReady || !workspaceSyncEnabledRef.current) return;

    workspaceSaveCoordinator.requestDebouncedSave(
      user.id,
      () => ({
        topGoal,
        characters,
        activeCharacterId,
        userProfile,
        aiModelSettings,
        projects,
        tasks,
        approvals,
        activityLogs,
        pricingRates,
        tokenUsage: tokenUsageRecords,
        products,
        contracts,
        invoices,
        tools,
        customLists,
        automations,
        marketingScenarios,
        workModeHistories,
        knowledgeItems,
      }),
      700
    );

    // 指摘4: アンマウント時・依存変更時にタイマークリーンアップ
    return () => {
      workspaceSaveCoordinator.cancelDebounce();
    };
  }, [
    user?.id,
    workspaceReady,
    topGoal,
    characters,
    activeCharacterId,
    userProfile,
    aiModelSettings,
    projects,
    tasks,
    approvals,
    activityLogs,
    pricingRates,
    tokenUsageRecords,
    products,
    contracts,
    invoices,
    tools,
    customLists,
    automations,
    marketingScenarios,
    workModeHistories,
    knowledgeItems,
  ]);

  // Active character
  const activeCharacter =
    characters.find((c) => c.id === activeCharacterId) || characters[0] || PRESET_CHARACTERS[0];
  const presidentCharacter =
    characters.find((c) => c.id === 'preset-ceo') || PRESET_CHARACTERS[0];
  const pageAssistantMode = resolveWorkMode(
    AI_WORK_MODES.find((mode) => mode.id === getPageAssistantProfile(currentTab).mode) || AI_WORK_MODES[0],
    aiModelSettings.roleOverrides,
  );
  // 標準のAI社長を選んでいるときは、役割設定で変更した名前・絵文字を画面表示に反映する
  const presidentOverride = aiModelSettings.roleOverrides.president;
  const chatCharacter =
    activeWorkModeId === 'president' && activeCharacter.id === 'preset-ceo' && presidentOverride
      ? {
          ...activeCharacter,
          name: presidentOverride.name ?? activeCharacter.name,
          avatarEmoji: presidentOverride.avatarEmoji ?? activeCharacter.avatarEmoji,
        }
      : activeCharacter;
  const editingCharacter = editingCharacterId ? characters.find((c) => c.id === editingCharacterId) : undefined;

  const updateAiModelSettings = (next: AIModelSettings) => {
    setAiModelSettings(next);
    saveAIModelSettings(next);
  };

  const handleSaveRoleOverride = (roleId: AIWorkModeId, override: RoleAIOverride | null) => {
    const roleOverrides = { ...aiModelSettings.roleOverrides };
    if (override && Object.keys(override).length > 0) roleOverrides[roleId] = override;
    else delete roleOverrides[roleId];
    updateAiModelSettings({ ...aiModelSettings, roleOverrides });
    setEditingRoleId(null);
  };

  /** 今のチャットで使う「役割の上書き設定」と「モデル設定」を決める */
  const resolveChatRuntime = (workModeId: AIWorkModeId, character: CharacterConfig = activeCharacter): { roleOverride?: RoleAIOverride; modelSetting: AIModelSetting } => {
    const { roleOverrides, defaultSetting } = aiModelSettings;
    // AI社長モードは、標準のAI社長(preset-ceo)のときだけ役割設定を適用し、登録済みAIには適用しない
    const usesRoleSettings = workModeId !== 'president' || character.id === 'preset-ceo';
    if (usesRoleSettings) {
      const roleOverride = roleOverrides[workModeId];
      return { roleOverride, modelSetting: roleOverride?.modelSetting ?? defaultSetting };
    }
    return { modelSetting: character.modelSetting ?? defaultSetting };
  };

  useEffect(() => {
    const key = `${activeCharacter.id}:${activeWorkModeId}`;
    saveChatHistory(key, messages);
    if (isStreaming) return;
    setWorkModeHistories((current) =>
      current[key] === messages ? current : { ...current, [key]: messages.slice(-100) }
    );
  }, [activeCharacter.id, activeWorkModeId, messages, isStreaming]);

  const handleSelectWorkMode = (id: AIWorkModeId) => {
    setActiveWorkModeId(id);
    const key = `${activeCharacter.id}:${id}`;
    setMessages(workModeHistories[key] || loadChatHistory(key));
  };

  const handleSaveKnowledgeItem = (item: KnowledgeItem) => {
    const exists = knowledgeItems.some((current) => current.id === item.id);
    const next = exists
      ? knowledgeItems.map((current) => current.id === item.id ? item : current)
      : [item, ...knowledgeItems];
    setKnowledgeItems(next);
    saveKnowledgeItems(next);

    // アドネスAI方式: バックグラウンドでセマンティックRAG用ベクトル埋め込み（text-embedding-004）を生成
    if (!item.embedding && item.content) {
      void (async () => {
        try {
          const sample = `${item.title}\n${(item.tags || []).join(' ')}\n${item.content.slice(0, 1000)}`;
          const authHeaders = await getAuthHeaders();
          const res = await fetch('/api/knowledge/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ text: sample }),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.embedding)) {
              setKnowledgeItems((curr) => {
                const updated = curr.map((k) => k.id === item.id ? { ...k, embedding: data.embedding } : k);
                saveKnowledgeItems(updated);
                return updated;
              });
            }
          }
        } catch {
          // ignore embedding precomputation errors
        }
      })();
    }
  };

  const handleDeleteKnowledgeItem = (id: string) => {
    void (async () => {
      const target = knowledgeItems.find((item) => item.id === id);
      try {
        await Promise.all((target?.attachments || []).map((attachment) => deleteWorkspaceAttachment(attachment)));
      } catch (error) {
        console.error('Knowledge attachment cleanup failed:', error);
        window.alert(error instanceof Error ? error.message : '添付ファイルを削除できませんでした。');
        return;
      }
      const next = knowledgeItems.filter((item) => item.id !== id);
      setKnowledgeItems(next);
      saveKnowledgeItems(next);
    })();
  };

  const handleUploadKnowledgeAttachment = (itemId: string, file: File): Promise<KnowledgeAttachment> => {
    if (!user?.id) return Promise.reject(new Error('ログイン状態を確認してください。'));
    return uploadWorkspaceAttachment(user.id, itemId, file);
  };

  const handleDownloadKnowledgeAttachment = (attachment: KnowledgeAttachment): Promise<Blob> =>
    downloadWorkspaceAttachment(attachment);

  const handleRemoveKnowledgeAttachment = (attachment: KnowledgeAttachment): Promise<void> =>
    deleteWorkspaceAttachment(attachment);

  const handleUploadTaskAttachment = (taskId: string, file: File): Promise<WorkspaceAttachment> => {
    if (!user?.id) return Promise.reject(new Error('ログイン状態を確認してください。'));
    return uploadWorkspaceAttachment(user.id, taskId, file);
  };

  const handleDownloadTaskAttachment = (attachment: WorkspaceAttachment): Promise<Blob> =>
    downloadWorkspaceAttachment(attachment);

  const handleRemoveTaskAttachment = (attachment: WorkspaceAttachment): Promise<void> =>
    deleteWorkspaceAttachment(attachment);

  // Quick Create Handler for MST
  const handleOpenCreate = (table: TableKey) => {
    setQuickCreateTable(table);
    openModalWithHistory('quick_create');
  };

  // --- Character Switching & Saving ---
  const handleSelectCharacter = (id: string) => {
    setActiveCharacterId(id);
    saveActiveCharacterId(id);
    const history = loadChatHistory(`${id}:${activeWorkModeId}`);
    setMessages(history.length ? history : activeWorkModeId === 'president' ? loadChatHistory(id) : []);
  };

  const handleSelectChatCharacter = (id: string) => {
    setActiveCharacterId(id);
    saveActiveCharacterId(id);
    setActiveWorkModeId('president');
    const history = loadChatHistory(`${id}:president`);
    setMessages(history.length ? history : loadChatHistory(id));
  };

  const handleUpdateCharacters = (newChars: CharacterConfig[]) => {
    setCharacters(newChars);
    saveCharacters(newChars);
  };

  const closeCharacterEditor = () => {
    setIsCharacterEditorOpen(false);
    setEditingCharacterId(null);
  };

  const handleSaveCharacter = (updated: CharacterConfig) => {
    const exists = characters.some((c) => c.id === updated.id);
    const updatedList = exists
      ? characters.map((c) => (c.id === updated.id ? updated : c))
      : [updated, ...characters];
    handleUpdateCharacters(updatedList);
    closeCharacterEditor();
  };

  const handleCreateNewCharacter = () => {
    const newChar: CharacterConfig = {
      id: `custom-${Date.now()}`,
      name: '新しい専門AI',
      role: '専属スペシャリスト',
      tagline: '特定の業務や相談に特化したカスタムAIパートナー',
      avatarEmoji: '🤖',
      avatarColor: 'indigo',
      personality: '誠実で専門性が高く、担当タスクを着実にアシストします。',
      tone: '丁寧で親しみやすい口調。',
      firstPerson: '私',
      secondPerson: 'あなた',
      speechStyle: '〜ですね、〜でしょうか？',
      behaviorRules: ['常にユーザー目線で考える', '建設的で具体的な提案を行う'],
      responseLength: 'medium',
      customInstructions: '',
      greetingMessage: 'こんにちは！お任せいただくタスクについて何でもご相談ください。',
      suggestedTopics: ['このタスクの進め方について相談したい', '成果物のレビューをお願いしたい'],
      createdAt: Date.now(),
    };
    handleUpdateCharacters([newChar, ...characters]);
    setActiveCharacterId(newChar.id);
    saveActiveCharacterId(newChar.id);
    setActiveWorkModeId('president');
    setMessages([]);
    setEditingCharacterId(newChar.id);
    setIsCharacterEditorOpen(true);
  };

  const handleDuplicateCharacter = (char: CharacterConfig) => {
    const copy: CharacterConfig = {
      ...char,
      id: `custom-copy-${Date.now()}`,
      name: `${char.name} (カスタム)`,
      createdAt: Date.now(),
    };
    handleUpdateCharacters([copy, ...characters]);
    setActiveCharacterId(copy.id);
    saveActiveCharacterId(copy.id);
    setMessages([]);
    setEditingCharacterId(copy.id);
    setIsCharacterEditorOpen(true);
  };

  const handleDeleteCharacter = (id: string) => {
    if (id === 'preset-ceo') {
      alert('標準のAI社長は削除できません。');
      return;
    }
    if (!characters.some((character) => character.id === id)) return;
    const remaining = characters.filter((c) => c.id !== id);
    const filtered = remaining.length > 0
      ? remaining
      : [PRESET_CHARACTERS.find((character) => character.id === 'preset-ceo') || PRESET_CHARACTERS[0]];
    handleUpdateCharacters(filtered);
    if (editingCharacterId === id) closeCharacterEditor();
    if (activeCharacterId === id) {
      const nextId = filtered[0].id;
      setActiveCharacterId(nextId);
      saveActiveCharacterId(nextId);
      setMessages(loadChatHistory(`${nextId}:${activeWorkModeId}`));
    }
  };

  // --- Top Goal ---
  const handleUpdateTopGoal = (newGoal: string) => {
    setTopGoal(newGoal);
    saveTopGoal(newGoal);
    recordActivityLog('task_updated', `最優先目標が更新されました: 「${newGoal}」`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  // --- User Profile ---
  const handleUpdateUserProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    saveUserProfile(newProfile);
  };

  // --- Token Usage Recording ---
  const handleRecordUsage = (params: {
    endpoint: 'chat' | 'generate-character' | 'extract-memory' | 'refine-prompt';
    endpointName: string;
    model?: string;
    provider?: AIProviderId;
    fallbackFrom?: string;
    usage: ApiUsageData;
  }) => {
    recordTokenUsage(params);
    setTokenUsageRecords(loadTokenUsageRecords());
  };

  const handleRunAssignedTask = async (task: TaskItem) => {
    if (task.status === 'pending_approval') throw new Error('このタスクは承認待ちです。承認または却下後に再実行できます。');
    if (taskExecutionInProgress.current) throw new Error('別の担当AIタスクを実行中です。完了後にもう一度お試しください。');
    taskExecutionInProgress.current = true;
    try {
    const requestedModeId = task.assignee.type === 'role_ai'
      ? (task.assignee.workModeId as AIWorkModeId) || 'president'
      : 'president';
    const workModeId: AIWorkModeId = AI_WORK_MODES.some((mode) => mode.id === requestedModeId) ? requestedModeId : 'president';
    const mode = getAIWorkMode(workModeId);
    const agentCharacter = task.assignee.type === 'custom_ai'
      ? characters.find((character) => character.id === task.assignee.id)
      : presidentCharacter;
    if (!agentCharacter) throw new Error('このタスクに割り当てられた登録済みAIが見つかりません。担当を選び直してください。');
    const runtime = resolveChatRuntime(workModeId, agentCharacter);
    const resolvedMode = resolveWorkMode(mode, aiModelSettings.roleOverrides);
    const latestRejection = approvals
      .filter((approval) => approval.taskId === task.id && approval.status === 'rejected')
      .sort((a, b) => (b.resolvedAt || b.createdAt) - (a.resolvedAt || a.createdAt))[0];
    const relatedRecordContext = await loadTaskRelatedContext(task);
    const prompt = [
      `担当タスク: ${task.title}`,
      relatedRecordContext ? `関連する業務情報:\n${relatedRecordContext}` : '',
      latestRejection?.resolutionNote ? `前回のレビュー指摘（今回反映してください）: ${latestRejection.resolutionNote}` : '',
      task.description ? `目的・背景: ${task.description}` : '',
      task.completionCriteria ? `完了条件: ${task.completionCriteria}` : '',
      'このタスクの成果物を作成してください。まず与えられた情報だけで進め、不足する前提は明記してください。外部への送信・公開や本番変更は行わず、レビュー可能な草案・成果として提示してください。',
    ].filter(Boolean).join('\n');

    const businessSummaryContext = generateBusinessSummaryContext({
      products,
      contracts,
      invoices,
      tasks,
      approvals,
      topGoal,
      userProfile,
    });
    const knowledgeContext = await retrieveKnowledgeContext(
      knowledgeItems,
      `${task.title}\n${task.description}\n${task.completionCriteria}`,
      workModeId,
      task.assignee.type === 'custom_ai' ? 'custom' : workModeId === 'president' ? 'president' : 'role'
    );

    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        character: { ...agentCharacter, userProfile },
        workModeId,
        roleOverride: runtime.roleOverride,
        modelSetting: runtime.modelSetting,
        knowledgeContext,
        businessSummaryContext,
        stream: false,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `担当AIの実行に失敗しました (HTTP ${response.status})`);
    const result = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!result) throw new Error('担当AIから成果物を受け取れませんでした。');

    const usage = data?.usage && typeof data.usage === 'object'
      ? data.usage as ApiUsageData
      : { promptTokens: null, candidatesTokens: null, totalTokens: null, status: 'unacquired' as const };
    handleRecordUsage({
      endpoint: 'chat',
      endpointName: `タスク実行：${resolvedMode.label}`,
      model: data?.model,
      provider: data?.provider,
      fallbackFrom: data?.fallbackFrom ? `${data.fallbackFrom.provider || ''}/${data.fallbackFrom.model || ''}` : undefined,
      usage,
    });

    const now = Date.now();
    const category: KnowledgeItem['category'] = workModeId === 'research' || workModeId === 'diagnosis'
      ? 'research'
      : workModeId === 'customer_product'
        ? 'customer'
        : workModeId === 'new_product' || workModeId === 'marketing_strategy'
          ? 'product'
          : 'deliverable';
    const draftArtifact: TaskDraftArtifact = {
      title: `成果物：${task.title}`,
      category,
      content: result,
      tags: ['AI作成', resolvedMode.label],
      createdAt: now,
      sourceRoleId: task.assignee.type === 'custom_ai' ? task.assignee.id : workModeId,
    };
    const sourceAutomationRule = task.sourceAutomationId
      ? automations.find((rule) => rule.id === task.sourceAutomationId)
      : undefined;
    const requiresArtifactApproval = !task.sourceAutomationId || !sourceAutomationRule || sourceAutomationRule.approvalPolicy === 'always';
    const updatedTask: TaskItem = {
      ...task,
      status: requiresArtifactApproval ? 'pending_approval' : 'completed',
      automationAutoRun: false,
      resultNotes: requiresArtifactApproval
        ? `${resolvedMode.name}の成果物を確認してください。承認後にナレッジへ登録されます。`
        : 'AI草案をタスクに保存しました。顧客への連絡・外部処理は実行していません。',
      draftArtifact,
      updatedAt: now,
    };
    const nextTasks = tasks.map((item) => item.id === task.id ? updatedTask : item);
    setTasks(nextTasks);
    saveTasks(nextTasks);

    if (requiresArtifactApproval) {
      const approval: ApprovalItem = {
        id: `appr-${now}`,
        taskId: task.id,
        taskTitle: task.title,
        actionTitle: `担当AIの成果物レビュー：${task.title}`,
        reason: `${resolvedMode.name}が成果物を作成しました。内容を確認し、承認後にナレッジへ登録します。`,
        status: 'pending',
        requestedBy: resolvedMode.name,
        reviewArtifact: draftArtifact,
        sourceAutomationId: task.sourceAutomationId,
        createdAt: now,
      };
      const nextApprovals = [approval, ...approvals];
      setApprovals(nextApprovals);
      saveApprovals(nextApprovals);
      recordActivityLog('approval_requested', sourceAutomationRule
        ? `自動化実行:「${sourceAutomationRule.name}」の成果物レビューが承認待ちです（タスク「${task.title}」）`
        : `タスク「${task.title}」のAI成果物レビューが承認待ちです`, resolvedMode.name);
    }
    recordActivityLog('task_updated', sourceAutomationRule
      ? `自動化実行:「${sourceAutomationRule.name}」が${resolvedMode.name}でタスク「${task.title}」の草案を作成しました`
      : `${resolvedMode.name}がタスク「${task.title}」を実行し、レビュー用成果物を保存しました`, resolvedMode.name);
    setActivityLogs(loadActivityLogs());
    } finally {
      taskExecutionInProgress.current = false;
    }
  };

  useEffect(() => {
    if (!user || !workspaceReady) return;
    const candidate = tasks.find((task) => {
      if (!task.sourceAutomationId || !task.automationAutoRun || !['waiting', 'in_progress'].includes(task.status)) return false;
      const rule = automations.find((item) => item.id === task.sourceAutomationId);
      if (!rule || rule.aiMode !== 'execute') return false;
      return task.status === 'in_progress' || rule.isEnabled;
    });
    if (!candidate || taskExecutionInProgress.current || autoRunTaskIdsRef.current.has(candidate.id)) return;

    const rule = automations.find((item) => item.id === candidate.sourceAutomationId);
    if (!rule) return;
    autoRunTaskIdsRef.current.add(candidate.id);
    const now = Date.now();
    const runningTask: TaskItem = {
      ...candidate,
      status: 'in_progress',
      resultNotes: '自動化ルールにより担当AIが処理中です。',
      updatedAt: now,
    };
    const nextTasks = tasks.map((task) => task.id === candidate.id ? runningTask : task);
    setTasks(nextTasks);
    saveTasks(nextTasks);
    recordActivityLog('task_updated', `自動化実行:「${rule.name}」がタスク「${candidate.title}」のAI処理を開始しました`, 'システム');
    setActivityLogs(loadActivityLogs());

    void handleRunAssignedTask(runningTask)
      .catch((error) => {
        const message = error instanceof Error ? error.message : '担当AIの実行に失敗しました。';
        const failedTask: TaskItem = {
          ...runningTask,
          status: 'blocked',
          automationAutoRun: false,
          resultNotes: `自動実行に失敗しました: ${message}`,
          updatedAt: Date.now(),
        };
        const failedTasks = nextTasks.map((task) => task.id === failedTask.id ? failedTask : task);
        setTasks(failedTasks);
        saveTasks(failedTasks);
        recordActivityLog('task_updated', `自動化実行:「${rule.name}」のタスク「${candidate.title}」が失敗しました（${message}）`, 'システム');
        setActivityLogs(loadActivityLogs());
      })
      .finally(() => {
        autoRunTaskIdsRef.current.delete(candidate.id);
        setAutoRunQueueRevision((revision) => revision + 1);
      });
  }, [tasks, automations, workspaceReady, user?.id, handleRunAssignedTask, autoRunQueueRevision]);

  // --- Pricing Settings ---
  const handleSavePricingRates = (newRates: ModelPricingRate[]) => {
    setPricingRates(newRates);
    savePricingRates(newRates);
    const activeRate = newRates[0];
    recordActivityLog(
      'pricing_updated',
      `AIモデル単価設定が更新されました (${activeRate.currency}: 入力 ${activeRate.inputPricePerMillion ?? '未設定'} / 出力 ${activeRate.outputPricePerMillion ?? '未設定'})`,
      '人間'
    );
    setActivityLogs(loadActivityLogs());
  };

  const handleClearUsageRecords = () => {
    saveTokenUsageRecords([]);
    setTokenUsageRecords([]);
  };

  // --- Projects Operations ---
  const handleCreateProject = (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProject: Project = {
      ...projectData,
      id: `proj-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    saveProjects(updated);
    recordActivityLog('project_created', `新規プロジェクト「${newProject.name}」を作成しました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleUpdateProject = (updatedProj: Project) => {
    const updated = projects.map((p) => (p.id === updatedProj.id ? updatedProj : p));
    setProjects(updated);
    saveProjects(updated);
    recordActivityLog('project_updated', `プロジェクト「${updatedProj.name}」の情報を更新しました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleDeleteProject = async (id: string): Promise<void> => {
    const target = projects.find((p) => p.id === id);
    const updated = projects.filter((p) => p.id !== id);
    const relatedTasks = tasks.filter((task) => task.projectId === id);
    if (relatedTasks.length > 0) {
      const attachments = relatedTasks.flatMap((task) => task.attachments || []);
      await Promise.all(attachments.map((attachment) => deleteWorkspaceAttachment(attachment)));
      const updatedTasks = tasks.filter((task) => task.projectId !== id);
      setTasks(updatedTasks);
      saveTasks(updatedTasks);
      recordActivityLog('task_updated', `プロジェクト削除に伴い、関連タスク${relatedTasks.length}件を添付ファイルと一緒に削除しました`, '人間');
    }
    setProjects(updated);
    saveProjects(updated);
    if (target) {
      recordActivityLog('project_updated', `プロジェクト「${target.name}」を削除しました（関連タスク${relatedTasks.length}件も削除）`, '人間');
      setActivityLogs(loadActivityLogs());
    }
  };

  // --- Tasks Operations ---

  const handleCrmStageTransition = (event: {
    transitionType: 'prospect_to_lead' | 'lead_to_deal' | 'deal_to_customer';
    sourceRecord: any;
    targetTable: 'leads' | 'deals' | 'customers';
    targetRecordId?: string | number;
  }) => {
    const now = Date.now();
    const presets = {
      prospect_to_lead: {
        title: 'リードの初回対応・診断案内を準備する', workArea: 'sales_customer' as TaskWorkArea,
        taskKind: 'response' as TaskKind, relatedType: 'lead' as TaskRelatedRecordType,
        assigneeMode: 'marketing_execution', criteria: 'リード情報を確認し、必要な案内文の草案と確認事項を作成する。送信は人間の確認後に行う。',
      },
      lead_to_deal: {
        title: '商談の提案内容と確認事項を整理する', workArea: 'sales_customer' as TaskWorkArea,
        taskKind: 'creation_analysis' as TaskKind, relatedType: 'deal' as TaskRelatedRecordType,
        assigneeMode: 'customer_product', criteria: '商談情報に基づく提案草案と不足情報を整理する。顧客への送付は人間の確認後に行う。',
      },
      deal_to_customer: {
        title: '契約後の初回案内・支援開始を準備する', workArea: 'post_contract_support' as TaskWorkArea,
        taskKind: 'response' as TaskKind, relatedType: 'customer' as TaskRelatedRecordType,
        assigneeMode: 'president', criteria: '契約・顧客情報を確認し、初回案内と支援開始に必要な確認事項を整理する。送信は人間の確認後に行う。',
      },
    };
    const preset = presets[event.transitionType];
    const sourceLabel = event.sourceRecord?.company?.company_name || event.sourceRecord?.company_name || event.sourceRecord?.proposal_plan_name || event.sourceRecord?.id || '関連レコード';
    const targetRecordId = event.targetRecordId ? String(event.targetRecordId) : undefined;
    const duplicateCrmTask = targetRecordId
      ? tasks.some((item) => item.id.startsWith('task-crm-')
        && item.title === preset.title
        && item.relatedRecord?.type === preset.relatedType
        && item.relatedRecord.id === targetRecordId)
      : false;
    if (duplicateCrmTask) return;
    const assigneeMode = AI_WORK_MODES.find((mode) => mode.id === preset.assigneeMode)!;
    const resolvedAssignee = resolveWorkMode(assigneeMode, aiModelSettings.roleOverrides);
    const task: TaskItem = {
      id: targetRecordId ? `task-crm-${event.transitionType}-${targetRecordId}` : `task-crm-${now}-${Math.random().toString(36).slice(2, 7)}`,
      title: preset.title,
      description: `${sourceLabel}の業務段階が進みました。関連情報を確認して草案・次の対応を準備してください。顧客への送信や外部公開は行わないでください。`,
      projectId: '',
      workArea: preset.workArea,
      sourceCategory: 'sales_customer',
      taskKind: preset.taskKind,
      relatedRecord: { type: preset.relatedType, id: event.targetRecordId ? String(event.targetRecordId) : undefined, label: sourceLabel },
      priority: 'medium',
      dueDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().slice(0, 10);
      })(),
      assignee: { type: 'role_ai', workModeId: preset.assigneeMode, name: `${resolvedAssignee.name}（${assigneeMode.label}）` },
      status: 'waiting',
      completionCriteria: preset.criteria,
      createdAt: now,
      updatedAt: now,
    };
    const automationRule = event.transitionType === 'deal_to_customer'
      ? automations.find((rule) => rule.id === 'workflow-deal-won' && rule.isEnabled)
      : undefined;
    const duplicateAutomationTask = automationRule && targetRecordId
      ? tasks.some((item) => item.sourceAutomationId === automationRule.id && item.relatedRecord?.id === targetRecordId)
      : false;
    if (duplicateAutomationTask) return;
    const taskWithRule: TaskItem = automationRule
      ? {
          ...task,
          description: `${task.description} 自動化ルール「${automationRule.name}」: ${automationRule.description}`,
          assignee: automationRule.aiMode === 'suggest'
            ? { type: 'human', name: '人間 (あなた)' }
            : task.assignee,
          sourceAutomationId: automationRule.id,
          dueDate: (() => {
            const due = new Date();
            due.setDate(due.getDate() + automationRule.taskDueInDays);
            return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
          })(),
        }
      : task;
    const nextTasks = [taskWithRule, ...tasks];
    setTasks(nextTasks);
    saveTasks(nextTasks);
    recordActivityLog('task_created', `CRMの段階移行からタスク「${taskWithRule.title}」を作成しました（関連: ${sourceLabel}）`, 'システム');
    if (automationRule) {
      recordActivityLog('task_created', `自動化ルール「${automationRule.name}」を適用し、期限付きタスクを作成しました（期限: ${taskWithRule.dueDate}）`, 'システム');
    }
    setActivityLogs(loadActivityLogs());
  };

  const handleCreateTask = (taskData: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: TaskItem = {
      ...taskData,
      dueDate: taskData.dueDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().slice(0, 10);
      })(),
      id: `task-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveTasks(updated);
    recordActivityLog(
      'task_created',
      `新規タスク「${newTask.title}」を作成しました (担当: ${newTask.assignee?.name || '未定'})`,
      '人間'
    );
    setActivityLogs(loadActivityLogs());
  };

  const handleUpdateTask = (updatedTask: TaskItem) => {
    const oldTask = tasks.find((t) => t.id === updatedTask.id);
    const updated = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    setTasks(updated);
    saveTasks(updated);
    if (oldTask && oldTask.status !== updatedTask.status) {
      recordActivityLog(
        'task_status_changed',
        `タスク「${updatedTask.title}」の状態が【${updatedTask.status}】に変更されました`,
        '人間'
      );
    } else {
      recordActivityLog('task_updated', `タスク「${updatedTask.title}」が更新されました`, '人間');
    }
    setActivityLogs(loadActivityLogs());
  };

  const handleDeleteTask = async (id: string): Promise<void> => {
    const target = tasks.find((t) => t.id === id);
    if (target?.attachments?.length) {
      await Promise.all(target.attachments.map((attachment) => deleteWorkspaceAttachment(attachment)));
    }
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    saveTasks(updated);

    const updatedApprovals = approvals.filter((a) => a.taskId !== id);
    if (updatedApprovals.length !== approvals.length) {
      setApprovals(updatedApprovals);
      saveApprovals(updatedApprovals);
    }

    if (target) {
      recordActivityLog('task_updated', `タスク「${target.title}」を削除しました`, '人間');
      setActivityLogs(loadActivityLogs());
    }
  };

  const handleBatchDeleteTasks = async (taskIds: string[], reason: string): Promise<void> => {
    if (taskIds.length === 0) return;
    const idSet = new Set(taskIds);
    const targetTasks = tasks.filter((t) => idSet.has(t.id));
    for (const t of targetTasks) {
      if (t.attachments?.length) {
        await Promise.all(t.attachments.map((att) => deleteWorkspaceAttachment(att).catch(() => {})));
      }
    }
    const remainingTasks = tasks.filter((t) => !idSet.has(t.id));
    setTasks(remainingTasks);
    saveTasks(remainingTasks);

    const updatedApprovals = approvals.filter((a) => !a.taskId || !idSet.has(a.taskId));
    if (updatedApprovals.length !== approvals.length) {
      setApprovals(updatedApprovals);
      saveApprovals(updatedApprovals);
    }

    recordActivityLog('task_updated', `${reason}（${targetTasks.length}件）を一括削除しました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleRequestApproval = (task: TaskItem, reason: string) => {
    const updatedTask: TaskItem = {
      ...task,
      status: 'pending_approval',
      updatedAt: Date.now(),
    };
    const updatedTasks = tasks.map((t) => (t.id === task.id ? updatedTask : t));
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    const newApproval: ApprovalItem = {
      id: `appr-${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      actionTitle: `タスク「${task.title}」の完了承認`,
      reason,
      status: 'pending',
      requestedBy: task.assignee?.name || '担当者',
      createdAt: Date.now(),
    };
    const updatedApprovals = [newApproval, ...approvals];
    setApprovals(updatedApprovals);
    saveApprovals(updatedApprovals);

    recordActivityLog(
      'approval_requested',
      `タスク「${task.title}」の承認が申請されました: ${reason}`,
      '人間'
    );
    setActivityLogs(loadActivityLogs());
  };

  const handleResolveApproval = (id: string, status: 'approved' | 'rejected', note?: string) => {
    const targetApproval = approvals.find((a) => a.id === id);
    if (!targetApproval) return;

    const now = Date.now();
    const taskForApproval = targetApproval.taskId
      ? tasks.find((task) => task.id === targetApproval.taskId)
      : undefined;
    let approvedKnowledge: KnowledgeItem | undefined;
    let nextKnowledge = knowledgeItems;

    const reviewArtifact = targetApproval.reviewArtifact || taskForApproval?.draftArtifact;
    if (status === 'approved' && taskForApproval && reviewArtifact) {
      const draft = reviewArtifact;
      const existing = taskForApproval.knowledgeItemId
        ? knowledgeItems.find((item) => item.id === taskForApproval.knowledgeItemId)
        : knowledgeItems.find((item) => item.sourceTaskId === taskForApproval.id);
      approvedKnowledge = {
        id: existing?.id || `knowledge-task-${taskForApproval.id}`,
        title: draft.title,
        category: draft.category,
        content: draft.content,
        tags: [...new Set([...(existing?.tags || []), ...draft.tags])],
        createdAt: existing?.createdAt || draft.createdAt,
        updatedAt: now,
        sourceTaskId: taskForApproval.id,
        sourceRoleId: draft.sourceRoleId,
      };
      nextKnowledge = existing
        ? knowledgeItems.map((item) => item.id === approvedKnowledge!.id ? approvedKnowledge! : item)
        : [approvedKnowledge, ...knowledgeItems];
      setKnowledgeItems(nextKnowledge);
      saveKnowledgeItems(nextKnowledge);
    }

    const updatedApprovals = approvals.map((a) =>
      a.id === id
        ? {
            ...a,
            status,
            resolutionNote: note,
            resolvedAt: now,
          }
        : a
    );
    setApprovals(updatedApprovals);
    saveApprovals(updatedApprovals);

    if (targetApproval.taskId) {
      const updatedTasks = tasks.map((task) => {
        if (task.id !== targetApproval.taskId) return task;
        const isApprovedDraft = status === 'approved' && Boolean(reviewArtifact);
        return {
          ...task,
          status: status === 'approved' ? ('completed' as const) : ('in_progress' as const),
          resultNotes: isApprovedDraft && approvedKnowledge
            ? `承認済み。成果物をナレッジ「${approvedKnowledge.title}」に登録しました。`
            : task.resultNotes,
          knowledgeItemId: approvedKnowledge?.id || task.knowledgeItemId,
          draftArtifact: isApprovedDraft && task.draftArtifact?.content === reviewArtifact?.content ? undefined : task.draftArtifact,
          updatedAt: now,
        };
      });
      setTasks(updatedTasks);
      saveTasks(updatedTasks);
    }

    const approvalRuleName = targetApproval.sourceAutomationId
      ? automations.find((rule) => rule.id === targetApproval.sourceAutomationId)?.name
      : undefined;
    recordActivityLog(
      'approval_resolved',
      approvalRuleName
        ? `自動化実行:「${approvalRuleName}」の成果物が【${status === 'approved' ? '承認' : '却下'}】されました${approvedKnowledge ? `。ナレッジ「${approvedKnowledge.title}」に登録しました` : ''}`
        : approvedKnowledge
          ? `成果物「${approvedKnowledge.title}」が承認され、ナレッジに登録されました`
          : `申請「${targetApproval.actionTitle}」が【${status === 'approved' ? '承認' : '却下'}】されました`,
      '人間'
    );
    setActivityLogs(loadActivityLogs());
  };

  const handleDeleteApproval = (id: string) => {
    const targetApproval = approvals.find((a) => a.id === id);
    if (!targetApproval) return;

    if (targetApproval.taskId) {
      const task = tasks.find((t) => t.id === targetApproval.taskId);
      if (task && task.status === 'pending_approval') {
        const updatedTasks = tasks.map((t) =>
          t.id === task.id ? { ...t, status: 'in_progress' as const, updatedAt: Date.now() } : t
        );
        setTasks(updatedTasks);
        saveTasks(updatedTasks);
      }
    }

    const updatedApprovals = approvals.filter((a) => a.id !== id);
    setApprovals(updatedApprovals);
    saveApprovals(updatedApprovals);

    recordActivityLog(
      'task_updated',
      `承認項目「${targetApproval.actionTitle || targetApproval.taskTitle}」を削除しました`,
      '人間'
    );
    setActivityLogs(loadActivityLogs());
  };

  const handleClearApprovals = (statusFilter?: 'pending' | 'approved' | 'rejected' | 'all') => {
    const filter = statusFilter || 'all';
    const itemsToRemove = filter === 'all'
      ? approvals
      : approvals.filter((a) => a.status === filter);

    if (itemsToRemove.length === 0) return;

    const pendingTaskIds = new Set(
      itemsToRemove
        .filter((a) => a.status === 'pending' && a.taskId)
        .map((a) => a.taskId as string)
    );

    if (pendingTaskIds.size > 0) {
      const updatedTasks = tasks.map((t) =>
        pendingTaskIds.has(t.id) && t.status === 'pending_approval'
          ? { ...t, status: 'in_progress' as const, updatedAt: Date.now() }
          : t
      );
      setTasks(updatedTasks);
      saveTasks(updatedTasks);
    }

    const removeIds = new Set(itemsToRemove.map((a) => a.id));
    const updatedApprovals = approvals.filter((a) => !removeIds.has(a.id));
    setApprovals(updatedApprovals);
    saveApprovals(updatedApprovals);

    const labelMap: Record<string, string> = {
      all: 'すべて',
      pending: '確認待ち',
      approved: '承認済み',
      rejected: '却下',
    };
    recordActivityLog(
      'task_updated',
      `承認項目（${labelMap[filter] || filter}・${itemsToRemove.length}件）を一括削除しました`,
      '人間'
    );
    setActivityLogs(loadActivityLogs());
  };

  const handleDeleteActivityLog = (id: string) => {
    const updated = activityLogs.filter((log) => log.id !== id);
    setActivityLogs(updated);
    saveActivityLogs(updated);
  };

  const handleClearActivityLogs = () => {
    setActivityLogs([]);
    saveActivityLogs([]);
  };

  const handleDeleteCompletedTasks = async (): Promise<void> => {
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    if (completedTasks.length === 0) return;

    for (const t of completedTasks) {
      if (t.attachments?.length) {
        await Promise.all(t.attachments.map((att) => deleteWorkspaceAttachment(att).catch(() => {})));
      }
    }

    const remainingTasks = tasks.filter((t) => t.status !== 'completed');
    setTasks(remainingTasks);
    saveTasks(remainingTasks);

    recordActivityLog(
      'task_updated',
      `完了タスク（${completedTasks.length}件）を一括削除しました`,
      '人間'
    );
    setActivityLogs(loadActivityLogs());
  };

  // --- Plan Import from Chat ---
  const handleImportPlan = (plan: ProposedPlan) => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: plan.projectName,
      objective: plan.projectObjective,
      status: 'in_progress',
      priority: plan.priority,
      dueDate: plan.dueDate || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedProjects = [newProject, ...projects];
    setProjects(updatedProjects);
    saveProjects(updatedProjects);

    const newTasks: TaskItem[] = plan.tasks.map((pt, idx) => {
      const suggested = (pt.suggestedAssignee || '').trim();
      const suggestedMode = AI_WORK_MODES.find((mode) => {
        const resolved = resolveWorkMode(mode, aiModelSettings.roleOverrides);
        return mode.id === suggested || mode.label === suggested || mode.name === suggested || resolved.name === suggested || (mode.id === 'president' && /AI社長|社長/.test(suggested));
      });
      const suggestedCharacter = characters.find((character) => character.name === suggested);
      const assignee: TaskAssignee = suggestedMode
        ? { type: 'role_ai', workModeId: suggestedMode.id, name: `${resolveWorkMode(suggestedMode, aiModelSettings.roleOverrides).name}（${suggestedMode.label}）` }
        : suggestedCharacter
          ? { type: 'custom_ai', id: suggestedCharacter.id, name: suggestedCharacter.name }
          : { type: 'ai_ceo', name: suggested || 'AI社長' };
      return ({
      id: `task-${Date.now()}-${idx}`,
      projectId: newProject.id,
      sourceCategory: 'ai_president',
      title: pt.title,
      description: pt.objective,
      status: 'waiting',
      priority: pt.priority,
      dueDate: plan.dueDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + (idx + 1) * 7);
        return d.toISOString().slice(0, 10);
      })(),
      assignee,
      completionCriteria: pt.completionCriteria,
      createdAt: Date.now() + idx,
      updatedAt: Date.now() + idx,
    });
    });
    const updatedTasks = [...tasks, ...newTasks];
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    recordActivityLog(
      'plan_imported',
      `AI社長提案の計画「${plan.projectName}」からプロジェクトと${plan.tasks.length}件のタスクを登録しました`,
      'AI社長'
    );
    setActivityLogs(loadActivityLogs());
    setActivePlanForModal(null);
    setCurrentTab('ai_tasks');
  };

  // --- Chat Messaging & Streaming ---
  const handleSendMessage = async (text: string, workModeId: AIWorkModeId = 'president') => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const chatKey = `${activeCharacter.id}:${workModeId}`;
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    saveChatHistory(chatKey, newHistory);
    setIsStreaming(true);

    const abortController = new AbortController();
    activeAbortController.current = abortController;

    const assistantMsgId = `assistant-${Date.now()}`;
    let accumulatedContent = '';
    let streamUsage: ApiUsageData = {
      promptTokens: null,
      candidatesTokens: null,
      totalTokens: null,
      status: 'unacquired',
    };
    let responseModel: string = aiModelSettings.defaultSetting.primary.model;
    let responseProvider: AIProviderId | undefined;
    let fallbackFromLabel: string | undefined;
    const runtime = resolveChatRuntime(workModeId);

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      },
    ]);

    try {
      const businessSummaryContext = generateBusinessSummaryContext({
        products,
        contracts,
        invoices,
        tasks,
        approvals,
        topGoal,
        userProfile,
      });
      const knowledgeContext = await retrieveKnowledgeContext(knowledgeItems, text, workModeId);

      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: buildBoundedChatContext(newHistory),
          character: {
            ...activeCharacter,
            userProfile,
          },
          workModeId,
          roleOverride: runtime.roleOverride,
          modelSetting: runtime.modelSetting,
          knowledgeContext,
          businessSummaryContext,
          stream: true,
        }),
      });

      if (!response.ok) {
        // サーバーが理由（APIキー未設定・上限到達など）を返していれば、そのまま画面に出す
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) {
        throw new Error('No stream response body');
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'usage' && parsed.usage) {
                streamUsage = parsed.usage;
                if (parsed.model) responseModel = parsed.model;
                if (isProviderId(parsed.provider)) responseProvider = parsed.provider;
                if (parsed.fallbackFrom?.model) {
                  fallbackFromLabel = `${AI_PROVIDERS[parsed.fallbackFrom.provider as AIProviderId]?.label ?? parsed.fallbackFrom.provider} / ${parsed.fallbackFrom.model}`;
                }
              } else if (parsed.text) {
                accumulatedContent += parsed.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
                  )
                );
              } else if (parsed.error) {
                accumulatedContent += `\n⚠️ [エラー]: ${parsed.error}`;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m
                  )
                );
              }
            } catch {
              // ignore partial json
            }
          }
        }
      }

      handleRecordUsage({
        endpoint: 'chat',
        endpointName: `AI業務モデル：${getAIWorkMode(workModeId).label}`,
        model: responseModel,
        provider: responseProvider,
        fallbackFrom: fallbackFromLabel,
        usage: streamUsage,
      });

      const modelLabel = responseProvider
        ? `${AI_PROVIDERS[responseProvider].label} / ${responseModel}${fallbackFromLabel ? `（${fallbackFromLabel} が使えないため切り替え）` : ''}`
        : undefined;
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, modelLabel } : m)));

      const updatedHistory = [
        ...newHistory,
        {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: accumulatedContent,
          timestamp: Date.now(),
          modelLabel,
        },
      ];
      saveChatHistory(chatKey, updatedHistory);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Aborted by user
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    accumulatedContent ||
                    `申し訳ございません。AIから応答を取得できませんでした。\n⚠️ ${err?.message || '通信に問題が発生しました。'}\n設定画面で使用モデルや切り替え先を確認してください。`,
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      activeAbortController.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (activeAbortController.current) {
      activeAbortController.current.abort();
      setIsStreaming(false);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    saveChatHistory(`${activeCharacter.id}:${activeWorkModeId}`, []);
  };

  // Matrix handlers
  const handleAddProduct = (p: Omit<ManagedProduct, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = matrixService.addProduct(p);
    const updated = matrixService.loadProducts();
    setProducts(updated);
    void syncManagedProductToSalesCatalog(created);
    recordActivityLog('project_created', `新商品「${created.name}」を登録し、営業商品マスタに同期しました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleUpdateProduct = (id: string, updates: Partial<ManagedProduct>) => {
    matrixService.updateProduct(id, updates);
    const updated = matrixService.loadProducts();
    setProducts(updated);
    const target = updated.find((p) => p.id === id);
    if (target) {
      void syncManagedProductToSalesCatalog(target);
    }
  };

  const handleReorderProducts = (reordered: ManagedProduct[]) => {
    matrixService.saveProducts(reordered);
    setProducts(reordered);
  };

  const handleDeleteProduct = async (id: string, archive: boolean, force = false): Promise<{ success: boolean; message?: string }> => {
    const product = matrixService.loadProducts().find((item) => item.id === id);
    if (!product) return { success: false, message: '商品が見つかりません。画面を再読み込みしてください。' };
    const syncArchivedProduct = async () => {
      await syncManagedProductToSalesCatalog({ ...product, status: 'archived' });
      matrixService.updateProduct(id, { status: 'archived' });
    };
    try {
      if (archive) {
        await syncArchivedProduct();
        setProducts(matrixService.loadProducts());
        recordActivityLog('project_updated', `商品「${product.name}」を取扱停止にしました（関連記録は保持）`, '人間');
      } else {
        const result = await deleteTableRecord('products', { id: product.id }, { force });
        if (result.blockedBy && !force) {
          return { success: false, message: `関連する「${result.blockedBy}」データがあるため通常削除が保留されました。「完全削除」を実行すると関連付けを解除して完全に削除できます。` };
        }
        if (result.error && !result.error.message.includes('削除対象が見つからない')) {
          return { success: false, message: result.error.message };
        }
        matrixService.deleteProduct(id);
        setProducts(matrixService.loadProducts());
        recordActivityLog('project_updated', `商品「${product.name}」を完全削除しました`, '人間');
      }
      setActivityLogs(loadActivityLogs());
      return { success: true, message: archive ? '取扱停止にしました。停止商品一覧から再開できます。' : '商品を完全削除しました。' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '商品を削除・取扱停止にできませんでした。' };
    }
  };

  const handleRestoreProduct = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const product = matrixService.loadProducts().find((item) => item.id === id);
    if (!product) return { success: false, message: '商品が見つかりません。画面を再読み込みしてください。' };
    try {
      await syncManagedProductToSalesCatalog({ ...product, status: 'active' });
      matrixService.updateProduct(id, { status: 'active' });
      setProducts(matrixService.loadProducts());
      recordActivityLog('project_updated', `商品「${product.name}」の取扱を再開しました`, '人間');
      setActivityLogs(loadActivityLogs());
      return { success: true, message: '商品の取扱を再開しました。' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '商品の取扱を再開できませんでした。' };
    }
  };

  const handlePublishProduct = async (product: ManagedProduct, fees: { initialFee: number; monthlyFee: number }) => {
    await publishManagedProductToSalesCatalog(product, fees);
    matrixService.updateProduct(product.id, {
      salesInitialFee: fees.initialFee,
      salesMonthlyFee: fees.monthlyFee,
      salesCatalogPublishedAt: Date.now(),
    });
    setProducts(matrixService.loadProducts());
  };

  const createAutomationTask = (input: {
    ruleId: string;
    recordId: string;
    title: string;
    description: string;
    workArea: TaskWorkArea;
    sourceCategory: TaskSourceCategory;
    taskKind: TaskKind;
    priority: Priority;
    completionCriteria: string;
    workModeId: string;
    relatedRecord?: TaskItem['relatedRecord'];
  }) => {
    const rule = automations.find((item) => item.id === input.ruleId && item.isEnabled);
    if (!rule || tasks.some((item) => item.sourceAutomationId === rule.id && item.sourceAutomationRecordId === input.recordId)) return false;
    const assignedWorkModeId = rule.workModeId || input.workModeId;
    const mode = AI_WORK_MODES.find((item) => item.id === assignedWorkModeId) || AI_WORK_MODES[0];
    const resolved = resolveWorkMode(mode, aiModelSettings.roleOverrides);
    const due = new Date();
    due.setDate(due.getDate() + rule.taskDueInDays);
    const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    const task: TaskItem = {
      id: `task-automation-${rule.id}-${input.recordId}`,
      title: input.title,
      description: `${input.description} 自動化ルール「${rule.name}」に基づくタスクです。顧客への連絡・外部処理は実行せず、担当者が内容を確認してください。`,
      projectId: '',
      workArea: input.workArea,
      sourceCategory: input.sourceCategory,
      taskKind: input.taskKind,
      relatedRecord: input.relatedRecord,
      priority: input.priority,
      assignee: rule.aiMode === 'suggest'
        ? { type: 'human', name: '人間 (あなた)' }
        : { type: 'role_ai', workModeId: mode.id, name: `${resolved.name}（${mode.label}）` },
      status: 'waiting',
      completionCriteria: input.completionCriteria,
      sourceAutomationId: rule.id,
      sourceAutomationRecordId: input.recordId,
      automationAutoRun: rule.aiMode === 'execute',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dueDate,
    };
    const nextTasks = [task, ...tasks];
    setTasks(nextTasks);
    saveTasks(nextTasks);
    recordActivityLog('task_created', `自動化ルール「${rule.name}」から期限付きタスク「${task.title}」を作成しました（期限: ${dueDate}）`, 'システム');
    setActivityLogs(loadActivityLogs());
    return true;
  };

  const handleDiagnosisSubmissionAutomation = (event: DiagnosisSubmissionAutomationEvent): boolean => {
    return createAutomationTask({
      ruleId: 'workflow-diagnosis-submitted',
      recordId: event.id,
      title: '診断回答を確認・分析する',
      description: `公開診断フォームに新しい回答が届きました。診断レコード（${event.diagnosis_id || '未作成'}）とリード情報を開き、回答を確認して追加確認事項を整理してください。`,
      workArea: 'sales_customer',
      sourceCategory: 'sales_customer',
      taskKind: 'creation_analysis',
      priority: 'medium',
      completionCriteria: 'フォーム回答と診断レコードを確認し、根拠のある所見・追加質問・次の対応を整理する。診断レポートの生成・顧客送信は担当者の確認後に行う。',
      workModeId: 'diagnosis',
      relatedRecord: event.lead_id
        ? { type: 'lead', id: event.lead_id, label: '診断回答のリード' }
        : event.company_id
          ? { type: 'company', id: event.company_id, label: '診断回答の会社' }
          : undefined,
    });
  };
  automationSubmissionHandlerRef.current = handleDiagnosisSubmissionAutomation;

  const handleAddContract = (c: Omit<ManagedContract, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = matrixService.addContract(c);
    setContracts(matrixService.loadContracts());
    recordActivityLog('task_created', `契約書「${created.title}」を登録しました`, '人間');
    setActivityLogs(loadActivityLogs());
    if (created.status === 'signed') {
      createAutomationTask({
        ruleId: 'workflow-contract-signed',
        recordId: created.id,
        title: `契約締結後の請求・提供準備：${created.counterpartyName}`,
        description: `契約「${created.title}」が締結済みとして登録されました。契約内容と開始日・金額を確認し、請求やサービス開始に必要な準備を整理してください。`,
        workArea: 'post_contract_support',
        sourceCategory: 'sales_customer',
        taskKind: 'creation_analysis',
        priority: 'medium',
        completionCriteria: '契約条件を確認し、請求・サービス提供開始に必要な準備項目を整理する。顧客への送付や請求発行は人の確認後に行う。',
        workModeId: 'customer_product',
        relatedRecord: created.companyId ? { type: 'company', id: String(created.companyId), label: created.counterpartyName } : undefined,
      });
    }
  };

  const handleServiceMilestoneReached = (event: { engagementId: string; milestoneId: string; milestoneTitle: string; companyId?: string; companyName?: string }) => {
    createAutomationTask({
      ruleId: 'workflow-project-milestone',
      recordId: `${event.engagementId}:${event.milestoneId}`,
      title: `支援マイルストーンの振り返り：${event.milestoneTitle}`,
      description: `顧問・構築支援「${event.milestoneTitle}」が到達済みになりました。${event.companyName ? `会社：${event.companyName}。` : ''}進捗・成果・残課題を支援記録と照らして整理し、次の対応案を作成してください。顧客への連絡や契約・請求の確定は行わず、人が確認してください。`,
      workArea: 'post_contract_support',
      sourceCategory: 'business_operations',
      taskKind: 'creation_analysis',
      priority: 'medium',
      completionCriteria: '支援の進捗・成果・残課題と次の対応案を根拠付きで整理し、結果を記録する。顧客への連絡や外部処理は人の承認後に行う。',
      workModeId: 'customer_product',
      relatedRecord: event.companyId ? { type: 'customer', id: event.companyId, label: event.companyName || '支援先顧客' } : undefined,
    });
  };

  const handleOperationalContractSigned = (event: { id: string; title: string; companyId?: string; companyName?: string; amount?: number }) => {
    createAutomationTask({
      ruleId: 'workflow-contract-signed',
      recordId: event.id,
      title: `契約締結後の請求・提供準備：${event.companyName || event.title}`,
      description: `契約「${event.title}」が締結済みになりました。${event.companyName ? `会社：${event.companyName}。` : ''}${event.amount == null ? '' : `契約金額：${event.amount.toLocaleString()}円。`}契約条件と開始日を確認し、請求とサービス開始に必要な準備を整理してください。`,
      workArea: 'post_contract_support',
      sourceCategory: 'sales_customer',
      taskKind: 'creation_analysis',
      priority: 'medium',
      completionCriteria: '契約条件を確認し、請求・サービス提供開始に必要な準備項目を整理する。顧客への送付や請求発行は人の確認後に行う。',
      workModeId: 'customer_product',
      relatedRecord: event.companyId ? { type: 'company', id: event.companyId, label: event.companyName || '契約先' } : undefined,
    });
  };

  const handleOperationalInvoiceOverdue = (event: { id: string; title: string; invoiceNumber?: string; companyId?: string; companyName?: string; amount?: number; dueDate?: string }) => {
    createAutomationTask({
      ruleId: 'workflow-invoice-overdue',
      recordId: event.id,
      title: `請求期限超過の対応案：${event.companyName || '請求先'}`,
      description: `請求書「${event.title}」（請求番号: ${event.invoiceNumber || '未設定'}${event.amount == null ? '' : `、金額: ${event.amount.toLocaleString()}円`}${event.dueDate ? `、期限: ${event.dueDate}` : ''}）が期限超過になりました。入金状況と社内対応を確認し、必要なら連絡文案を作成してください。`,
      workArea: 'sales_customer',
      sourceCategory: 'business_operations',
      taskKind: 'response',
      priority: 'high',
      completionCriteria: '入金状況を確認し、社内対応と必要な顧客連絡の草案を整理する。顧客への連絡・請求処理は人が確認してから行う。',
      workModeId: 'president',
      relatedRecord: event.companyId ? { type: 'customer', id: event.companyId, label: event.companyName || '請求先' } : undefined,
    });
  };

  const handleAddInvoice = (i: Omit<ManagedInvoice, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = matrixService.addInvoice(i);
    setInvoices(matrixService.loadInvoices());
    recordActivityLog('task_created', `請求書「${created.title}」を発行・登録しました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleAddTool = (t: Omit<ManagedToolAsset, 'id' | 'createdAt'>) => {
    const created = matrixService.addTool(t);
    setTools(matrixService.loadTools());
    recordActivityLog('task_created', `ツール「${created.name}」を登録しました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleUpdateInvoiceStatus = (id: string, status: any) => {
    const current = invoices.find((invoice) => invoice.id === id);
    matrixService.updateInvoice(id, { status, paidDate: status === 'paid' ? todayJst() : undefined });
    setInvoices(matrixService.loadInvoices());
    recordActivityLog('task_status_changed', `請求書ステータスが更新されました`, '人間');
    setActivityLogs(loadActivityLogs());
    if (current && status === 'overdue' && current.status !== 'overdue') {
      createAutomationTask({
        ruleId: 'workflow-invoice-overdue',
        recordId: current.id,
        title: `請求期限超過の対応案：${current.recipientName}`,
        description: `請求書「${current.title}」（請求番号: ${current.invoiceNumber}、金額: ${current.amount.toLocaleString()}円、期限: ${current.dueDate}）が期限超過として登録されました。入金状況と社内対応を確認し、必要なら連絡文案を作成してください。`,
        workArea: 'sales_customer',
        sourceCategory: 'business_operations',
        taskKind: 'response',
        priority: 'high',
        completionCriteria: '入金状況を確認し、社内対応と必要な顧客連絡の草案を整理する。顧客への連絡・請求処理は人が確認してから行う。',
        workModeId: 'president',
        relatedRecord: current.companyId ? { type: 'customer', id: String(current.companyId), label: current.recipientName } : undefined,
      });
    }
  };

  const saveWorkspaceAfterRecordDeletion = async (
    nextContracts: ManagedContract[],
    nextInvoices: ManagedInvoice[],
    nextActivityLogs: ActivityLog[],
  ) => {
    if (!user) throw new Error('ログイン状態を確認してから、もう一度削除してください。');
    const workspaceData: WorkspaceData = {
      topGoal,
      characters,
      activeCharacterId,
      userProfile,
      aiModelSettings,
      projects,
      tasks,
      approvals,
      activityLogs: nextActivityLogs,
      pricingRates,
      tokenUsage: tokenUsageRecords,
      products,
      contracts: nextContracts,
      invoices: nextInvoices,
      tools,
      customLists,
      automations,
      marketingScenarios,
      workModeHistories,
      knowledgeItems,
    };

    try {
      await workspaceSaveCoordinator.requestImmediateSave(user.id, workspaceData);
    } catch (error) {
      if (isWorkspaceConflictError(error)) {
        throw new Error('他の端末で更新されています。再読み込みしてください');
      }
      const message = (error as { message?: string })?.message || '';
      if (/customer_invoices_owner_id_invoice_number_key/i.test(message) || (error as any)?.code === '23505') {
        console.warn('Ignored harmless invoice constraint race during contract/invoice deletion');
        return;
      }
      throw new Error(message || '削除の保存に失敗しました。');
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!user) throw new Error('ログイン状態を確認してから、もう一度削除してください。');
    const current = contracts.find((contract) => contract.id === id);
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('customer_service_engagements').update({ contract_id: null }).eq('contract_id', id);
        await supabase.from('customer_contracts').delete().eq('legacy_id', id);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUuid) {
          await supabase.from('customer_contracts').delete().eq('id', id);
        }
      } catch {
        // ignore direct delete error
      }
    }
    matrixService.deleteContract(id);
    const nextContracts = matrixService.loadContracts();
    setContracts(nextContracts);
    recordActivityLog(
      'task_updated',
      `契約「${current?.title || id}」（契約相手: ${current?.counterpartyName || '未設定'}、状態: ${current?.status || '未設定'}）を削除しました`,
      '人間',
    );
    const nextLogs = loadActivityLogs();
    setActivityLogs(nextLogs);
    await saveWorkspaceAfterRecordDeletion(nextContracts, invoices, nextLogs);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!user) throw new Error('ログイン状態を確認してから、もう一度削除してください。');
    const current = invoices.find((invoice) => invoice.id === id);
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('customer_invoices').delete().eq('legacy_id', id);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUuid) {
          await supabase.from('customer_invoices').delete().eq('id', id);
        }
      } catch {
        // ignore direct delete error
      }
    }
    matrixService.deleteInvoice(id);
    const nextInvoices = matrixService.loadInvoices();
    setInvoices(nextInvoices);
    recordActivityLog(
      'task_updated',
      `請求「${current?.invoiceNumber || id}」件名「${current?.title || '請求書'}」、金額: ${current?.amount == null ? '未設定' : current.amount.toLocaleString() + '円'}、状態: ${current?.status || '未設定'}を削除しました`,
      '人間',
    );
    const nextLogs = loadActivityLogs();
    setActivityLogs(nextLogs);
    await saveWorkspaceAfterRecordDeletion(contracts, nextInvoices, nextLogs);
  };

  const handleUpdateAutomation = (id: string, updates: Partial<AutomationRule>) => {
    const updated = matrixService.normalizeAutomationRules(
      automations.map((rule) => rule.id === id ? { ...rule, ...updates } : rule)
    );
    setAutomations(updated);
    matrixService.saveAutomations(updated);
  };
  const handleAddAutomation = (rule: Omit<AutomationRule, 'id' | 'updatedAt'>) => {
    const newRule = matrixService.addAutomation(rule);
    setAutomations(matrixService.loadAutomations());
    recordActivityLog('task_created', '新しい自動化ルール「' + newRule.name + '」を登録しました', '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleDeleteAutomation = (id: string) => {
    const target = automations.find((a) => a.id === id);
    matrixService.deleteAutomation(id);
    setAutomations(matrixService.loadAutomations());
    if (target) {
      recordActivityLog('task_updated', '自動化ルール「' + target.name + '」を削除しました', '人間');
      setActivityLogs(loadActivityLogs());
    }
  };

  useEffect(() => {
    if (!user || !workspaceReady) return;
    const supabase = getSupabase();
    if (!supabase) return;

    let isMounted = true;
    let pollingTimer: number | null = null;
    let isCatchingUp = false;

    const processSubmission = (event: DiagnosisSubmissionAutomationEvent) => {
      if (!isMounted || !event?.id || processedDiagnosisSubmissionIdsRef.current.has(event.id)) return;
      const created = automationSubmissionHandlerRef.current(event);
      if (created) processedDiagnosisSubmissionIdsRef.current.add(event.id);
    };

    const catchUpMissedSubmissions = async () => {
      if (isCatchingUp) return;
      isCatchingUp = true;
      try {
        const { data: diagnosisForms, error: formsError } = await supabase
          .from('diagnosis_forms')
          .select('id')
          .eq('form_type', 'diagnosis');
        if (formsError || !isMounted) {
          if (formsError) console.warn('Could not load diagnosis forms for automation catch-up:', formsError.message);
          return;
        }
        const formIds = (diagnosisForms || []).map((form) => form.id);
        if (formIds.length === 0) return;

        const pageSize = 100;
        let offset = 0;
        while (isMounted) {
          const { data: submissions, error } = await supabase
            .from('diagnosis_submissions')
            .select('id, form_id, lead_id, company_id, diagnosis_id')
            .in('form_id', formIds)
            .order('submitted_at', { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (error || !isMounted) {
            if (error) console.warn('Could not catch up diagnosis submissions:', error.message);
            return;
          }
          const batch = submissions || [];
          batch.forEach((submission) => processSubmission(submission as DiagnosisSubmissionAutomationEvent));
          if (batch.length < pageSize) return;
          offset += pageSize;
        }
      } finally {
        isCatchingUp = false;
      }
    };

    // 初回マウント時に確実に未処理分を同期
    void catchUpMissedSubmissions();

    // 【Realtime廃止】WebSocket接続（/realtime/v1/websocket）による403 Forbiddenや再接続ループを解消するため、
    // Realtime購読（supabase.channel / subscribe）を完全廃止し、安全な3分ポーリング（REST API）のみで同期運用。
    pollingTimer = window.setInterval(() => {
      if (isMounted) void catchUpMissedSubmissions();
    }, 180000);

    return () => {
      isMounted = false;
      if (pollingTimer) {
        window.clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };
  }, [user?.id, workspaceReady]);

  if (isLoading || (user && !workspaceReady)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-semibold tracking-wide">MST AI経営OS 読み込み中...</p>
      </div>
    );
  }

  // 認証前は業務データを一切表示せず、ログイン画面のみを表示
  if (!user) {
    return (
      <>
        <AuthScreen 
          onOpenConfig={() => openModalWithHistory('config')} 
          onOpenRls={() => openModalWithHistory('rls')} 
        />
        <Suspense fallback={null}>
        <ConfigGuideModal
          isOpen={isConfigOpen}
          onClose={() => closeModalWithHistory('config')}
        />
        <RlsGuideModal
          isOpen={isRlsOpen}
          onClose={() => closeModalWithHistory('rls')}
        />
      </Suspense>
      </>
    );
  }

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={(tab) => {
        handleNavigateWorkspaceTab(tab);
      }}
      pendingApprovalsCount={approvals.filter((a) => a.status === 'pending').length}
      workspaceSyncStatus={workspaceSyncStatus}
      workspaceSaveError={workspaceSaveError}
      pageAssistantEmoji={pageAssistantMode.avatarEmoji}
      onOpenQuickAiDrawer={() => openModalWithHistory('quick_drawer')}
      onOpenConfig={() => openModalWithHistory('config')}
      onOpenRls={() => openModalWithHistory('rls')}
      onOpenPricing={() => openModalWithHistory('pricing')}
      onOpenBackup={() => openModalWithHistory('backup')}
      onOpenProfile={() => openModalWithHistory('profile')}
      onOpenModelSettings={() => openModalWithHistory('model_settings')}
      onRetrySync={handleRetrySync}
    >
      <Suspense fallback={<ViewLoadingFallback />}>
        {/* ================= SECTION 1: MST AI経営OS ================= */}
        {(currentTab === 'mst_dashboard' || currentTab === 'inflow_dashboard') && (
          <Dashboard
            onNavigateTab={(tab) => {
              if (tab === 'diagnoses') setCurrentTab('mst_diagnoses');
              else setCurrentTab(tab as UnifiedNavTab);
            }}
            onOpenCreate={handleOpenCreate}
            onOpenRls={() => setIsRlsOpen(true)}
            onStageTransitionTask={handleCrmStageTransition}
          />
        )}

        {currentTab === 'inbox_hub' && (
          <UnifiedInboxView
            initialChannel={
              inboxTargetChannel ||
              (lineInboxContact ? 'line' : (localStorage.getItem('unified_inbox_active_channel') as any) || 'forms')
            }
            initialLineUserId={lineInboxContact?.lineUserId}
            initialCompanyId={customerWorkspaceCompanyId}
            initialLeadId={customerWorkspaceContext?.leadId}
            onClearCompanyFilter={() => setCustomerWorkspaceContext(undefined)}
            onNavigateTab={(tab, options) => handleNavigateWorkspaceTab(tab, options)}
            onOpenSendCenter={(params) => {
              openSendDrawer({
                kind: params.sendKind || 'form',
                companyId: params.companyId || customerWorkspaceCompanyId || '',
                contactId: params.contactId,
                formId: params.formId,
              });
            }}
            onOpenCustomerWorkspace={(companyId, destination) => {
              setCustomerWorkspaceContext({ companyId });
              setCurrentTab(destination === 'deals' ? 'deals' : 'customer_operations');
            }}
          />
        )}

        {currentTab === 'unified_calendar' && (
          <IntegratedCalendarWorkspace
            invoices={invoices}
            contracts={contracts}
            tasks={tasks}
            onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            onOpenCustomerWorkspace={(companyId, destination, recordContext) => {
              if (destination === 'send') {
                openSendDrawer({
                  kind: 'deal',
                  companyId,
                  dealId: recordContext?.dealId,
                });
                return;
              }
              setCustomerWorkspaceContext({
                companyId,
                leadId: recordContext?.leadId,
                dealId: recordContext?.dealId,
              });
              setCurrentTab(
                destination === 'deals'
                  ? 'deals'
                  : destination === 'customer_operations'
                  ? 'customer_operations'
                  : destination === 'documents'
                  ? 'document_templates'
                  : 'customer_operations'
              );
            }}
          />
        )}

        {currentTab === 'mst_diagnoses' && (
          <DiagnosisManager
            key={`${customerWorkspaceCompanyId || 'all'}:${customerWorkspaceContext?.leadId || ''}:${customerWorkspaceContext?.section || ''}`}
            onOpenRls={() => setIsRlsOpen(true)}
            initialLeadId={customerWorkspaceContext?.leadId}
            initialCompanyId={customerWorkspaceContext?.companyId}
            initialSection={customerWorkspaceContext?.section}
            onOpenSendCenter={(formId, _url, kind) => {
              openSendDrawer({
                kind,
                companyId: customerWorkspaceCompanyId || '',
                formId,
              });
            }}
            onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
          />
        )}

        {currentTab === 'deal_invitations' && <CommunicationSendCenter variant="page" initialKind="deal" initialMode="send" onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)} />}
        {currentTab === 'customer_meeting_invitations' && <CommunicationSendCenter variant="page" initialKind="customer_meeting" initialMode="send" onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)} />}
        {currentTab === 'communication_send' && (
          <CommunicationSendCenter
            variant="page"
            initialMode="history"
            initialKind={customerWorkspaceContext?.documentId ? "document" : customerWorkspaceContext?.sendKind || "form"}
            initialCompanyId={customerWorkspaceContext?.companyId}
            initialDocumentId={customerWorkspaceContext?.documentId}
            initialFormId={customerWorkspaceContext?.formId}
            initialDealId={customerWorkspaceContext?.dealId}
            initialContactId={customerWorkspaceContext?.contactId}
            originTab={sendOriginContext?.tab}
            originTabLabel={sendOriginContext?.tabLabel}
            onReturnToOrigin={() => {
              if (sendOriginContext) {
                setCurrentTab(sendOriginContext.tab);
                if (sendOriginContext.customerWorkspaceContext) {
                  setCustomerWorkspaceContext(sendOriginContext.customerWorkspaceContext);
                }
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: sendOriginContext.scrollY || 0, behavior: 'smooth' });
                }
                setSendOriginContext(null);
              }
            }}
            onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
          />
        )}

        {['companies', 'products'].includes(currentTab) && (
          <TableManager
            currentTable={currentTab as TableKey}
            onTableChange={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            onOpenRls={() => setIsRlsOpen(true)}
            onOpenCustomerWorkspace={(companyId, destination, recordContext) => {
              if (destination === 'send') {
                openSendDrawer({
                  kind: recordContext?.tableKey === 'deals' ? 'deal' : recordContext?.tableKey === 'customers' ? 'customer_meeting' : recordContext?.tableKey === 'prospects' || recordContext?.tableKey === 'leads' ? 'announcement' : 'form',
                  companyId,
                  dealId: recordContext?.tableKey === 'deals' ? recordContext.recordId : undefined,
                  contactId: recordContext?.contactId,
                });
                return;
              }
              const resolvedLeadId = recordContext?.tableKey === 'leads' ? recordContext.recordId : recordContext?.leadId;
              const resolvedDealId = recordContext?.tableKey === 'deals' ? recordContext.recordId : undefined;
              const docType: 'invoice' | 'proposal' | 'estimate' | 'contract' | 'monthly_report' | undefined =
                destination === 'diagnoses'
                  ? 'proposal'
                  : destination === 'documents' && recordContext?.tableKey === 'deals'
                  ? 'estimate'
                  : destination === 'documents' && recordContext?.tableKey === 'customers'
                  ? 'invoice'
                  : undefined;

              setCustomerWorkspaceContext({
                companyId,
                leadId: resolvedLeadId,
                dealId: resolvedDealId,
                documentType: docType,
                section: undefined,
                formId: undefined,
                contactId: recordContext?.contactId,
              });
              if (destination === 'forms') {
                setInboxTargetChannel('forms');
                setCurrentTab('inbox_hub');
              } else {
                setCurrentTab(
                  destination === 'documents' || destination === 'diagnoses'
                    ? 'document_templates'
                    : 'customer_operations'
                );
              }
            }}
          />
        )}

        {(currentTab === 'leads' || currentTab === 'deals' || currentTab === 'customers') && (
          <SalesPipelineHub
            activeTab={currentTab}
            onTabChange={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            onOpenRls={() => setIsRlsOpen(true)}
            onOpenCustomerWorkspace={(companyId, destination, recordContext) => {
              if (destination === 'send') {
                openSendDrawer({
                  kind: recordContext?.tableKey === 'deals' ? 'deal' : recordContext?.tableKey === 'customers' ? 'customer_meeting' : recordContext?.tableKey === 'prospects' || recordContext?.tableKey === 'leads' ? 'announcement' : 'form',
                  companyId,
                  dealId: recordContext?.tableKey === 'deals' ? recordContext.recordId : undefined,
                  contactId: recordContext?.contactId,
                });
                return;
              }
              const resolvedLeadId = recordContext?.tableKey === 'leads' ? recordContext.recordId : recordContext?.leadId;
              const resolvedDealId = recordContext?.tableKey === 'deals' ? recordContext.recordId : undefined;
              const docType: 'invoice' | 'proposal' | 'estimate' | 'contract' | 'monthly_report' | undefined =
                destination === 'diagnoses'
                  ? 'proposal'
                  : destination === 'documents' && recordContext?.tableKey === 'deals'
                  ? 'estimate'
                  : destination === 'documents' && recordContext?.tableKey === 'customers'
                  ? 'invoice'
                  : undefined;

              setCustomerWorkspaceContext({
                companyId,
                leadId: resolvedLeadId,
                dealId: resolvedDealId,
                documentType: docType,
                section: undefined,
                formId: undefined,
                contactId: recordContext?.contactId,
              });
              if (destination === 'forms') {
                setInboxTargetChannel('forms');
                setCurrentTab('inbox_hub');
              } else {
                setCurrentTab(
                  destination === 'documents' || destination === 'diagnoses'
                    ? 'document_templates'
                    : 'customer_operations'
                );
              }
            }}
            onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
          />
        )}

        {/* ================= SECTION 2: PRODUCT DEVELOPMENT & PROJECTS ================= */}
        {(currentTab === 'product_hub' || currentTab === 'ai_projects') && (
          <ProductProjectHub
            activeTab={currentTab === 'ai_projects' ? 'ai_projects' : 'product_hub'}
            onTabChange={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            products={products}
            contracts={contracts}
            invoices={invoices}
            tools={tools}
            tasks={tasks}
            projects={projects}
            character={chatCharacter}
            userProfile={userProfile}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onReorderProducts={handleReorderProducts}
            onDeleteProduct={handleDeleteProduct}
            onRestoreProduct={handleRestoreProduct}
            onPublishProduct={handlePublishProduct}
            onRecordUsage={handleRecordUsage}
            onAddProjectWithTasks={(newProject, newTasks) => {
              setProjects([newProject, ...projects]);
              saveProjects([newProject, ...projects]);
              setTasks([...tasks, ...newTasks]);
              saveTasks([...tasks, ...newTasks]);
              recordActivityLog('project_created', `新商品プロジェクト「${newProject.name}」を作成`, 'AI社長');
              setActivityLogs(loadActivityLogs());
            }}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onNavigateToTasksWithFilter={(projId) => {
              setSelectedProjectIdForTasks(projId);
              setSelectedTaskWorkspaceSection('tasks');
              setCurrentTab('ai_tasks');
            }}
            onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
          />
        )}

        {currentTab === 'category_hub' && (
          <CategoryHubView
            products={products}
            contracts={contracts}
            invoices={invoices}
            tools={tools}
            tasks={tasks}
            projects={projects}
            approvals={approvals}
            topGoal={topGoal}
            onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
          />
        )}

        {currentTab === 'custom_lists' && <SalesOperationsWorkspace tab="segments" />}

        {currentTab === 'customer_operations' && (
          <SalesOperationsWorkspace
            tab="operations"
            companyId={customerWorkspaceCompanyId}
            invoices={invoices}
            tasks={tasks}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onClearCompanyFilter={() => setCustomerWorkspaceContext(undefined)}
            onOperationalRecordsChange={(nextContracts, nextInvoices) => {
              setContracts(nextContracts);
              setInvoices(nextInvoices);
            }}
            onDeleteContract={handleDeleteContract}
            onDeleteInvoice={handleDeleteInvoice}
            onMilestoneReached={handleServiceMilestoneReached}
            onContractSigned={handleOperationalContractSigned}
            onInvoiceOverdue={handleOperationalInvoiceOverdue}
            onOpenInvoiceDocuments={(companyId, documentId) => {
              openSendDrawer({
                kind: 'document',
                companyId,
                documentId,
              });
            }}
          />
        )}


        {currentTab === 'document_templates' && (
          <>
            <DocumentTemplateView 
              key={`${customerWorkspaceCompanyId || 'all'}:${customerWorkspaceContext?.leadId || ''}:${customerWorkspaceContext?.dealId || ''}:${customerWorkspaceContext?.documentType || ''}`} 
              initialCompanyId={customerWorkspaceCompanyId} 
              initialLeadId={customerWorkspaceContext?.leadId} 
              initialDealId={customerWorkspaceContext?.dealId} 
              initialDocumentType={customerWorkspaceContext?.documentType} 
              onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
              onOpenSendCenter={(params) => {
                openSendDrawer({
                  kind: 'document',
                  companyId: params.companyId || customerWorkspaceCompanyId || '',
                  documentId: params.documentId,
                  dealId: params.dealId || customerWorkspaceContext?.dealId,
                  contactId: params.contactId || customerWorkspaceContext?.contactId,
                });
              }}
            />
            <SalesOperationsWorkspace tab="documents" companyId={customerWorkspaceCompanyId} leadId={customerWorkspaceContext?.leadId} dealId={customerWorkspaceContext?.dealId} onClearCompanyFilter={() => setCustomerWorkspaceContext(undefined)} onOpenInvoiceDocuments={(companyId, documentId) => { openSendDrawer({ kind: 'document', companyId, documentId }); }} onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)} />
          </>
        )}

        {(currentTab === 'contacts' || currentTab === 'prospects') && (
          <MarketingLeadListHub
            activeTab={currentTab === 'prospects' ? 'prospects' : 'contacts'}
            onTabChange={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            onOpenLineInbox={(contactId, lineUserId) => {
              setLineInboxContact({ contactId, lineUserId });
              setCurrentTab('inbox_hub');
            }}
            onOpenEmailSend={(contactId, companyId) => {
              openSendDrawer({
                kind: 'announcement',
                companyId: companyId || '',
                contactId,
                channel: 'email',
              });
            }}
            onOpenCustomerWorkspace={(companyId, destination, recordContext) => {
              if (destination === 'send') {
                openSendDrawer({
                  kind: recordContext?.tableKey === 'deals' ? 'deal' : recordContext?.tableKey === 'customers' ? 'customer_meeting' : recordContext?.tableKey === 'prospects' || recordContext?.tableKey === 'leads' ? 'announcement' : 'form',
                  companyId,
                  dealId: recordContext?.tableKey === 'deals' ? recordContext.recordId : undefined,
                  contactId: recordContext?.contactId,
                });
                return;
              }
              const resolvedLeadId = recordContext?.tableKey === 'leads' ? recordContext.recordId : recordContext?.leadId;
              const resolvedDealId = recordContext?.tableKey === 'deals' ? recordContext.recordId : undefined;
              const docType: 'invoice' | 'proposal' | 'estimate' | 'contract' | 'monthly_report' | undefined =
                destination === 'diagnoses'
                  ? 'proposal'
                  : destination === 'documents' && recordContext?.tableKey === 'deals'
                  ? 'estimate'
                  : destination === 'documents' && recordContext?.tableKey === 'customers'
                  ? 'invoice'
                  : undefined;

              setCustomerWorkspaceContext({
                companyId,
                leadId: resolvedLeadId,
                dealId: resolvedDealId,
                documentType: docType,
                section: undefined,
                formId: undefined,
                contactId: recordContext?.contactId,
              });
              if (destination === 'forms') {
                setInboxTargetChannel('forms');
                setCurrentTab('inbox_hub');
              } else {
                setCurrentTab(
                  destination === 'documents' || destination === 'diagnoses'
                    ? 'document_templates'
                    : 'customer_operations'
                );
              }
            }}
            onOpenRls={() => setIsRlsOpen(true)}
            onNavigateTab={(tab) => setCurrentTab(tab as UnifiedNavTab)}
          />
        )}


        {currentTab === 'ai_acquisition' && (
          <AIAcquisitionOperationsView
            initialTab={
              acquisitionTargetTab ||
              localStorage.getItem('ai_acquisition_active_tab') ||
              'strategy'
            }
            onSendPresidentSummary={(summary) => {
              setCurrentTab('ai_chat');
              void handleSendMessage(summary, 'president');
            }}
            onCreateTask={handleCreateTask}
            onNavigateTab={(tab, options) => handleNavigateWorkspaceTab(tab, options)}
          />
        )}

        {currentTab === 'marketing_automation' && (
          <MarketingAutomationPrototypeView scenarios={marketingScenarios} onScenariosChange={setMarketingScenarios} onNavigateTab={(tab) => setCurrentTab(tab)} lineInboxContact={lineInboxContact} />
        )}

        {/* ================= SECTION 3: AI PRESIDENT & STRATEGY ================= */}
        

        {currentTab === 'ai_chat' && (
          <ChatView
            character={chatCharacter}
            roleOverrides={aiModelSettings.roleOverrides}
            characters={characters}
            onSelectCharacter={handleSelectChatCharacter}
            userProfile={userProfile}
            messages={messages}
            onSendMessage={handleSendMessage}
            selectedWorkModeId={activeWorkModeId}
            onSelectWorkMode={handleSelectWorkMode}
            onClearMessages={handleClearMessages}
            onUpdateUserProfile={handleUpdateUserProfile}
            isStreaming={isStreaming}
            onStopStreaming={handleStopStreaming}
            onOpenPlanProposal={(plan) => setActivePlanForModal(plan)}
            onRecordUsage={handleRecordUsage}
          />
        )}

        {currentTab === 'ai_knowledge' && (
          <KnowledgeHubView
            items={knowledgeItems}
            onSave={handleSaveKnowledgeItem}
            onDelete={handleDeleteKnowledgeItem}
            selectedItemId={selectedKnowledgeItemId}
            onUploadAttachment={handleUploadKnowledgeAttachment}
            onDownloadAttachment={handleDownloadKnowledgeAttachment}
            onDeleteAttachment={handleRemoveKnowledgeAttachment}
          />
        )}

        {currentTab === 'ai_tasks' && (
          <TasksView
            tasks={tasks}
            projects={projects}
            characters={characters}
            roleOverrides={aiModelSettings.roleOverrides}
            selectedProjectId={selectedProjectIdForTasks}
            onClearProjectFilter={() => setSelectedProjectIdForTasks(null)}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onDeleteCompletedTasks={handleDeleteCompletedTasks}
            onBatchDeleteTasks={handleBatchDeleteTasks}
            onRunTask={handleRunAssignedTask}
            onUploadAttachment={handleUploadTaskAttachment}
            onDownloadAttachment={handleDownloadTaskAttachment}
            onDeleteAttachment={handleRemoveTaskAttachment}
            onOpenKnowledgeItem={(id) => {
              setSelectedKnowledgeItemId(id);
              setCurrentTab('ai_knowledge');
            }}
            onRequestApproval={handleRequestApproval}
            approvals={approvals}
            activityLogs={activityLogs}
            onResolveApproval={handleResolveApproval}
            onDeleteApproval={handleDeleteApproval}
            onClearApprovals={handleClearApprovals}
            onDeleteActivityLog={handleDeleteActivityLog}
            onClearActivityLogs={handleClearActivityLogs}
            initialSection={selectedTaskWorkspaceSection}
            onSectionChange={setSelectedTaskWorkspaceSection}
          />
        )}

        {(currentTab === 'ai_presets' || currentTab === 'automations') && (
          <AiPresetsAutomationsHub
            activeTab={currentTab === 'automations' ? 'automations' : 'ai_presets'}
            onTabChange={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            characters={characters}
            activeCharacterId={activeCharacterId}
            activeWorkModeId={activeWorkModeId}
            onSelectCharacter={(id) => {
              handleSelectChatCharacter(id);
              setCurrentTab('ai_chat');
            }}
            onSelectWorkMode={(id) => {
              if (id === 'president') handleSelectChatCharacter('preset-ceo');
              else handleSelectWorkMode(id);
              setCurrentTab('ai_chat');
            }}
            onCreateCharacter={handleCreateNewCharacter}
            onEditCharacter={(id) => {
              setEditingCharacterId(id);
              setIsCharacterEditorOpen(true);
            }}
            roleOverrides={aiModelSettings.roleOverrides}
            defaultModelSetting={aiModelSettings.defaultSetting}
            onEditRole={setEditingRoleId}
            onOpenModelSettings={() => setIsModelSettingsOpen(true)}
            onDeleteCharacter={handleDeleteCharacter}
            automations={automations}
            activityLogs={activityLogs}
            onUpdateAutomation={handleUpdateAutomation}
            onAddAutomation={handleAddAutomation}
            onDeleteAutomation={handleDeleteAutomation}
          />
        )}


      {/* Global Modals */}
      <ConfigGuideModal
        isOpen={isConfigOpen}
        onClose={() => closeModalWithHistory('config')}
      />

      <RlsGuideModal
        isOpen={isRlsOpen}
        onClose={() => closeModalWithHistory('rls')}
      />

      {quickCreateOpen && (
        <RecordFormModal
          isOpen={quickCreateOpen}
          tableKey={quickCreateTable}
          editRecord={null}
          onClose={() => closeModalWithHistory('quick_create')}
          onSuccess={() => {
            if (currentTab !== quickCreateTable) {
              handleNavigateWorkspaceTab(quickCreateTable as UnifiedNavTab);
            }
          }}
        />
      )}

      {/* AI President Modals */}
      {isCharacterEditorOpen && editingCharacter && (
        <ModalShell title="専門AIの編集" onClose={() => closeModalWithHistory('character_editor')}>
          <CharacterEditor
            key={editingCharacter.id}
            character={editingCharacter}
            userProfile={userProfile}
            defaultModelSetting={aiModelSettings.defaultSetting}
            onSaveCharacter={handleSaveCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onDuplicateCharacter={handleDuplicateCharacter}
            onStartChat={(char) => {
              handleSelectCharacter(char.id);
              closeModalWithHistory('character_editor');
              handleNavigateWorkspaceTab('ai_chat');
            }}
            onClose={() => closeModalWithHistory('character_editor')}
            onRecordUsage={handleRecordUsage}
          />
        </ModalShell>
      )}

      {editingRoleId && (
        <RoleAIEditor
          key={editingRoleId}
          mode={getAIWorkMode(editingRoleId)}
          override={aiModelSettings.roleOverrides[editingRoleId] ?? {}}
          defaultSetting={aiModelSettings.defaultSetting}
          statuses={providerStatuses}
          onSave={(override) => handleSaveRoleOverride(editingRoleId, override)}
          onReset={() => handleSaveRoleOverride(editingRoleId, null)}
          onClose={() => closeModalWithHistory('role_editor')}
        />
      )}

      {isModelSettingsOpen && (
        <ModelSettingsModal
          defaultSetting={aiModelSettings.defaultSetting}
          onSave={(defaultSetting) => {
            updateAiModelSettings({ ...aiModelSettings, defaultSetting });
            closeModalWithHistory('model_settings');
          }}
          onClose={() => closeModalWithHistory('model_settings')}
        />
      )}

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => closeModalWithHistory('profile')}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            <UserProfileEditor
              userProfile={userProfile}
              onSaveProfile={(prof) => {
                handleUpdateUserProfile(prof);
                closeModalWithHistory('profile');
              }}
            />
          </div>
        </div>
      )}

      {activePlanForModal && (
        <PlanRegistrationModal
          plan={activePlanForModal}
          isOpen={true}
          onClose={() => closeModalWithHistory('plan')}
          characters={characters}
          roleOverrides={aiModelSettings.roleOverrides}
          onConfirmRegistration={(pName, pObj, pPri, pDue, pTasks) => {
            const newProject: Project = {
              id: `proj-${Date.now()}`,
              name: pName,
              objective: pObj,
              status: 'in_progress',
              priority: pPri,
              dueDate: pDue,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            setProjects([newProject, ...projects]);
            saveProjects([newProject, ...projects]);

            const generatedTasks: TaskItem[] = pTasks.map((t, idx) => ({
              id: `task-${Date.now()}-${idx}`,
              projectId: newProject.id,
              sourceCategory: 'ai_president',
              title: t.title,
              description: t.description,
              status: 'waiting',
              priority: t.priority,
              assignee: t.assignee,
              completionCriteria: t.completionCriteria,
              createdAt: Date.now() + idx,
              updatedAt: Date.now() + idx,
            }));
            setTasks([...tasks, ...generatedTasks]);
            saveTasks([...tasks, ...generatedTasks]);

            recordActivityLog(
              'plan_imported',
              `AI社長提案の計画「${pName}」からプロジェクトと${pTasks.length}件のタスクを登録しました`,
              'AI社長'
            );
            setActivityLogs(loadActivityLogs());
            closeModalWithHistory('plan');
            handleNavigateWorkspaceTab('ai_tasks');
          }}
        />
      )}

      {isPricingModalOpen && (
        <PricingSettingsModal
          isOpen={isPricingModalOpen}
          onClose={() => closeModalWithHistory('pricing')}
          pricingRates={pricingRates}
          tokenUsageRecords={tokenUsageRecords}
          onSavePricingRates={handleSavePricingRates}
          onClearUsageRecords={handleClearUsageRecords}
        />
      )}

      {isBackupModalOpen && (
        <BackupModal
          isOpen={isBackupModalOpen}
          onClose={() => closeModalWithHistory('backup')}
          characters={characters}
          userProfile={userProfile}
          projects={projects}
          tasks={tasks}
          approvals={approvals}
          activityLogs={activityLogs}
          topGoal={topGoal}
          pricingRates={pricingRates}
          tokenUsageRecords={tokenUsageRecords}
          knowledgeItems={knowledgeItems}
          workModeHistories={workModeHistories}
          marketingScenarios={marketingScenarios}
          onRestoreData={(restored) => {
            if (restored.characters) setCharacters(restored.characters);
            if (restored.userProfile) setUserProfile(restored.userProfile);
            if (restored.projects) setProjects(restored.projects);
            if (restored.tasks) setTasks(restored.tasks);
            if (restored.approvals) setApprovals(restored.approvals);
            if (restored.activityLogs) setActivityLogs(restored.activityLogs);
            if (restored.topGoal) setTopGoal(restored.topGoal);
            if (restored.pricingRates) setPricingRates(restored.pricingRates);
            if (restored.tokenUsageRecords) setTokenUsageRecords(restored.tokenUsageRecords);
            if (restored.knowledgeItems) {
              setKnowledgeItems(restored.knowledgeItems);
              saveKnowledgeItems(restored.knowledgeItems);
            }
            if (restored.marketingScenarios) setMarketingScenarios(restored.marketingScenarios);
            if (restored.workModeHistories) {
              setWorkModeHistories(restored.workModeHistories);
              Object.entries(restored.workModeHistories).forEach(([key, history]) => saveChatHistory(key, history));
              setMessages(restored.workModeHistories[`${activeCharacter.id}:${activeWorkModeId}`] || []);
            }
            closeModalWithHistory('backup');
          }}
        />
      )}

      {/* Page-aware AI helper drawer */}
      <QuickPresidentDrawer
        isOpen={isQuickDrawerOpen}
        pageId={currentTab}
        onClose={() => closeModalWithHistory('quick_drawer')}
        character={presidentCharacter}
        userProfile={userProfile}
        onOpenPlanProposal={(plan: ProposedPlan) => {
          setActivePlanForModal(plan);
          openModalWithHistory('plan');
        }}
        onRecordUsage={handleRecordUsage}
      />

          </Suspense>
    </AppShell>
  );
}

export default function App() {
  const publicDocMatch = window.location.pathname.match(/^\/(?:apply|docs)\/([^/]+)\/?$/i);
  if (publicDocMatch) {
    return <Suspense fallback={<ViewLoadingFallback />}><PublicDocumentApplyView documentId={publicDocMatch[1]} /></Suspense>;
  }

  const publicFormMatch = window.location.pathname.match(/^\/f\/([^/]+)\/?$/);
  if (publicFormMatch) {
    let slug = publicFormMatch[1];
    try { slug = decodeURIComponent(slug); } catch { /* Keep the raw path segment for the server's validation. */ }
    const search = window.location.search || '';
    if (slug === 'contact-inquiry') {
      window.location.replace('https://corp.mstcorp.info/contact' + search);
      return null;
    }
    if (slug === 'business-diagnosis') {
      window.location.replace('https://corp.mstcorp.info/diagnosis' + search);
      return null;
    }
    if (slug === 'material-download') {
      window.location.replace('https://corp.mstcorp.info/materials' + search);
      return null;
    }
    if (slug === 'care-package-inquiry') {
      window.location.replace('https://business.mstcorp.info/' + search);
      return null;
    }
    return <Suspense fallback={<ViewLoadingFallback />}><PublicIntakeForm slug={slug} /></Suspense>;
  }

  return (
    <AuthProvider>
      <SendDrawerProvider>
        <AppContent />
      </SendDrawerProvider>
    </AuthProvider>
  );
}


