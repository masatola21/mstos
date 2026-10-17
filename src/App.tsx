import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UnifiedNavbar, UnifiedNavTab } from './components/UnifiedNavbar';
import { Dashboard } from './components/Dashboard';
import { TableManager } from './components/TableManager';
import { DiagnosisManager } from './components/DiagnosisManager';
import { PublicIntakeForm } from './components/PublicIntakeForm';
import { AuthScreen } from './components/AuthScreen';
import { ConfigGuideModal } from './components/ConfigGuideModal';
import { RlsGuideModal } from './components/RlsGuideModal';
import { RecordFormModal } from './components/RecordFormModal';
import { TableKey } from './types/database';
import { getSupabase } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';

// AI President Views and Modals
import { DashboardView } from './components/ai-president/DashboardView';
import { ChatView } from './components/ai-president/ChatView';
import { KnowledgeHubView } from './components/ai-president/KnowledgeHubView';
import { ProjectsView } from './components/ai-president/ProjectsView';
import { TasksView } from './components/ai-president/TasksView';
import { PresetsView } from './components/ai-president/PresetsView';
import { CharacterEditor } from './components/ai-president/CharacterEditor';
import { UserProfileEditor } from './components/ai-president/UserProfileEditor';
import { PlanRegistrationModal } from './components/ai-president/PlanRegistrationModal';
import { BackupModal } from './components/ai-president/BackupModal';
import { PricingSettingsModal } from './components/ai-president/PricingSettingsModal';

// Matrix & Universal Product Views
import { ProductHubView } from './components/matrix/ProductHubView';
import { CategoryHubView } from './components/matrix/CategoryHubView';
import { CustomListManager } from './components/matrix/CustomListManager';
import { SalesOperationsWorkspace } from './components/SalesOperationsWorkspace';
import { AutomationView } from './components/matrix/AutomationView';
import { DocumentTemplateView } from './components/matrix/DocumentTemplateView';
import { MarketingAutomationPrototypeView } from './components/marketing/MarketingAutomationPrototypeView';
import { ContactsLineHub } from './components/ContactsLineHub';
import { QuickPresidentDrawer } from './components/matrix/QuickPresidentDrawer';

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
import { RoleAIEditor } from './components/ai-president/RoleAIEditor';
import { ModelSettingsModal } from './components/ai-president/ModelSettingsModal';
import { useProviderStatus } from './components/ai-president/ModelSettingEditor';
import { matrixService } from './services/matrixService';
import { deleteWorkspaceAttachment, downloadWorkspaceAttachment, uploadWorkspaceAttachment } from './services/knowledgeAttachmentService';
import {
  loadOrMigrateWorkspaceData,
  saveWorkspaceData,
  WorkspaceData,
} from './services/workspaceStateService';
import { 
  ManagedProduct, 
  ManagedContract, 
  ManagedInvoice, 
  ManagedToolAsset, 
  CustomListDefinition, 
  AutomationRule 
} from './types/matrix';

type DiagnosisSubmissionAutomationEvent = { id: string; form_id: string; lead_id: string | null; company_id: string | null; diagnosis_id?: string | null };

const MAX_CHAT_CONTEXT_MESSAGES = 12;
const MAX_CHAT_CONTEXT_CHARACTERS = 16000;

function selectKnowledgeContext(items: KnowledgeItem[], request: string): string {
  if (!items.length) return '';
  const normalize = (value: string) => value.toLowerCase().replace(/[\s、。,.!?！？・「」『』（）【】]/g, '');
  const bigrams = (value: string) => {
    const chars = Array.from(normalize(value));
    const pairs = new Set<string>();
    for (let i = 0; i < chars.length - 1; i += 1) pairs.add(chars[i] + chars[i + 1]);
    return pairs;
  };
  const queryPairs = bigrams(request);
  const ranked = items.map((item) => {
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
    const score = titleHits * 4 + tagHits * 3 + contentHits + (item.category === 'business' ? 1 : 0);
    return { item, score };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
    .slice(0, 3);
  return ranked.map(({ item }) =>
    '【' + item.title + ' / ' + item.category + '】\n' + item.content.slice(0, 2400)
  ).join('\n\n');
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
    return [`関連先: ${related.label || related.type} (ID: ${related.id})`, ...fields].join('\n').slice(0, 1800);
  } catch {
    return '関連レコードは設定されていますが、現在の情報を取得できませんでした。';
  }
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<UnifiedNavTab>('mst_dashboard');
  const [customerWorkspaceContext, setCustomerWorkspaceContext] = useState<{ companyId: string; leadId?: string; dealId?: string; section?: 'forms' | 'diagnoses' } | undefined>();
  const customerWorkspaceCompanyId = customerWorkspaceContext?.companyId;
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const lastSavedWorkspaceRef = useRef('');
  const workspaceSaveRevisionRef = useRef(0);
  const workspaceSyncEnabledRef = useRef(false);

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
    workspaceSyncEnabledRef.current = false;
    workspaceSaveRevisionRef.current += 1;
    setWorkspaceReady(false);
    setWorkspaceSyncStatus('loading');

    if (!user) return () => { cancelled = true; };

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
        lastSavedWorkspaceRef.current = JSON.stringify(data);
        workspaceSyncEnabledRef.current = true;
        setWorkspaceSyncStatus('saved');
        setWorkspaceReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Workspace cloud load failed:', error);
        workspaceSyncEnabledRef.current = false;
        setWorkspaceSyncStatus('error');
        setWorkspaceReady(true);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !workspaceReady || !workspaceSyncEnabledRef.current) return;

    const workspaceData: WorkspaceData = {
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
    };
    const snapshot = JSON.stringify(workspaceData);
    if (snapshot === lastSavedWorkspaceRef.current) return;

    const revision = ++workspaceSaveRevisionRef.current;
    setWorkspaceSyncStatus('saving');
    const timer = window.setTimeout(() => {
      saveWorkspaceData(user.id, workspaceData)
        .then(() => {
          if (revision !== workspaceSaveRevisionRef.current) return;
          lastSavedWorkspaceRef.current = snapshot;
          setWorkspaceSyncStatus('saved');
        })
        .catch((error) => {
          if (revision !== workspaceSaveRevisionRef.current) return;
          console.error('Workspace cloud save failed:', error);
          setWorkspaceSyncStatus('error');
        });
    }, 700);

    return () => window.clearTimeout(timer);
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
    setQuickCreateOpen(true);
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

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        character: { ...agentCharacter, userProfile },
        workModeId,
        roleOverride: runtime.roleOverride,
        modelSetting: runtime.modelSetting,
        knowledgeContext: selectKnowledgeContext(knowledgeItems, `${task.title}\n${task.description}\n${task.completionCriteria}`),
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

  const handleDeleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    saveProjects(updated);
    if (target) {
      recordActivityLog('project_updated', `プロジェクト「${target.name}」を削除しました`, '人間');
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
    const assigneeMode = AI_WORK_MODES.find((mode) => mode.id === preset.assigneeMode)!;
    const resolvedAssignee = resolveWorkMode(assigneeMode, aiModelSettings.roleOverrides);
    const task: TaskItem = {
      id: `task-crm-${now}-${Math.random().toString(36).slice(2, 7)}`,
      title: preset.title,
      description: `${sourceLabel}の業務段階が進みました。関連情報を確認して草案・次の対応を準備してください。顧客への送信や外部公開は行わないでください。`,
      projectId: '',
      workArea: preset.workArea,
      sourceCategory: 'sales_customer',
      taskKind: preset.taskKind,
      relatedRecord: { type: preset.relatedType, id: event.targetRecordId ? String(event.targetRecordId) : undefined, label: sourceLabel },
      priority: 'medium',
      assignee: { type: 'role_ai', workModeId: preset.assigneeMode, name: `${resolvedAssignee.name}（${assigneeMode.label}）` },
      status: 'waiting',
      completionCriteria: preset.criteria,
      createdAt: now,
      updatedAt: now,
    };
    const automationRule = event.transitionType === 'deal_to_customer'
      ? automations.find((rule) => rule.id === 'workflow-deal-won' && rule.isEnabled)
      : undefined;
    const targetRecordId = event.targetRecordId ? String(event.targetRecordId) : undefined;
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
    if (target) {
      recordActivityLog('task_updated', `タスク「${target.title}」を削除しました`, '人間');
      setActivityLogs(loadActivityLogs());
    }
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          knowledgeContext: selectKnowledgeContext(knowledgeItems, text),
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
    setProducts(matrixService.loadProducts());
    recordActivityLog('project_created', `新商品「${created.name}」を登録しました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleUpdateProduct = (id: string, updates: Partial<ManagedProduct>) => {
    matrixService.updateProduct(id, updates);
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
    matrixService.updateInvoice(id, { status, paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined });
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

  const handleUpdateAutomation = (id: string, updates: Partial<AutomationRule>) => {
    const updated = matrixService.normalizeAutomationRules(
      automations.map((rule) => rule.id === id ? { ...rule, ...updates } : rule)
    );
    setAutomations(updated);
    matrixService.saveAutomations(updated);
  };

  useEffect(() => {
    if (!user || !workspaceReady) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let catchUpStarted = false;

    const processSubmission = (event: DiagnosisSubmissionAutomationEvent) => {
      if (!event?.id || processedDiagnosisSubmissionIdsRef.current.has(event.id)) return;
      const created = automationSubmissionHandlerRef.current(event);
      if (created) processedDiagnosisSubmissionIdsRef.current.add(event.id);
    };

    const catchUpMissedSubmissions = async () => {
      const { data: diagnosisForms, error: formsError } = await supabase
        .from('diagnosis_forms')
        .select('id')
        .eq('form_type', 'diagnosis');
      if (formsError) {
        console.warn('Could not load diagnosis forms for automation catch-up:', formsError.message);
        return;
      }
      const formIds = (diagnosisForms || []).map((form) => form.id);
      if (formIds.length === 0) return;

      const pageSize = 500;
      let offset = 0;
      while (true) {
        const { data: submissions, error } = await supabase
          .from('diagnosis_submissions')
          .select('id, form_id, lead_id, company_id, diagnosis_id')
          .in('form_id', formIds)
          .order('submitted_at', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) {
          console.warn('Could not catch up diagnosis submissions:', error.message);
          return;
        }
        const batch = submissions || [];
        batch.forEach((submission) => processSubmission(submission as DiagnosisSubmissionAutomationEvent));
        if (batch.length < pageSize) return;
        offset += pageSize;
      }
    };

    const channel = supabase
      .channel(`automation-diagnosis-submissions-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diagnosis_submissions' }, (payload) => {
        const event = payload.new as DiagnosisSubmissionAutomationEvent;
        if (!event?.id || !event.form_id) return;
        void supabase.from('diagnosis_forms').select('form_type').eq('id', event.form_id).maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.warn('Could not identify diagnosis submission type:', error.message);
              return;
            }
            if (data?.form_type === 'diagnosis') processSubmission(event);
          });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !catchUpStarted) {
          catchUpStarted = true;
          void catchUpMissedSubmissions();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Diagnosis submission automation realtime channel is unavailable.');
        }
      });
    return () => { void supabase.removeChannel(channel); };
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
          onOpenConfig={() => setIsConfigOpen(true)} 
          onOpenRls={() => setIsRlsOpen(true)} 
        />
        <ConfigGuideModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
        />
        <RlsGuideModal
          isOpen={isRlsOpen}
          onClose={() => setIsRlsOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Unified Navigation Bar */}
      <UnifiedNavbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'ai_tasks') setSelectedTaskWorkspaceSection('tasks');
          setCurrentTab(tab);
        }}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenRls={() => setIsRlsOpen(true)}
        onOpenPricing={() => setIsPricingModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenQuickDrawer={() => setIsQuickDrawerOpen(true)}
        activeCharacter={presidentCharacter}
        pendingApprovalsCount={approvals.filter((a) => a.status === 'pending').length}
      />

      {/* Main App Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ================= SECTION 1: MST AI経営OS ================= */}
        {currentTab === 'mst_dashboard' && (
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

        {currentTab === 'mst_diagnoses' && (
          <DiagnosisManager onOpenRls={() => setIsRlsOpen(true)} initialLeadId={customerWorkspaceContext?.leadId} initialCompanyId={customerWorkspaceContext?.companyId} initialSection={customerWorkspaceContext?.section} />
        )}

        {currentTab === 'deal_invitations' && <SalesOperationsWorkspace tab="invitations" />}
        {currentTab === 'customer_meeting_invitations' && <SalesOperationsWorkspace tab="customer_invitations" />}

        {['companies', 'prospects', 'leads', 'products', 'deals', 'customers'].includes(currentTab) && (
          <TableManager
            currentTable={currentTab as TableKey}
            onTableChange={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            onOpenRls={() => setIsRlsOpen(true)}
            onOpenCustomerWorkspace={(companyId, destination, recordContext) => {
              setCustomerWorkspaceContext({
                companyId,
                leadId: recordContext?.tableKey === 'leads' ? recordContext.recordId : recordContext?.leadId,
                dealId: recordContext?.tableKey === 'deals' ? recordContext.recordId : undefined,
                section: destination === 'forms' ? 'forms' : destination === 'diagnoses' ? 'diagnoses' : undefined,
              });
              setCurrentTab(destination === 'documents' ? 'document_templates' : destination === 'diagnoses' || destination === 'forms' ? 'mst_diagnoses' : 'customer_operations');
            }}
          />
        )}

        {/* ================= SECTION 2: MATRIX & UNIVERSAL PRODUCTS ================= */}
        {currentTab === 'product_hub' && (
          <ProductHubView
            products={products}
            contracts={contracts}
            invoices={invoices}
            tools={tools}
            tasks={tasks}
            projects={projects}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onRecordUsage={handleRecordUsage}
            onAddProjectWithTasks={(newProject, newTasks) => {
              setProjects([newProject, ...projects]);
              saveProjects([newProject, ...projects]);
              setTasks([...tasks, ...newTasks]);
              saveTasks([...tasks, ...newTasks]);
              recordActivityLog('project_created', `新商品プロジェクト「${newProject.name}」を作成`, 'AI社長');
              setActivityLogs(loadActivityLogs());
            }}
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
            onClearCompanyFilter={() => setCustomerWorkspaceContext(undefined)}
            onOperationalRecordsChange={(nextContracts, nextInvoices) => {
              setContracts(nextContracts);
              setInvoices(nextInvoices);
            }}
            onMilestoneReached={handleServiceMilestoneReached}
            onContractSigned={handleOperationalContractSigned}
            onInvoiceOverdue={handleOperationalInvoiceOverdue}
          />
        )}

        {currentTab === 'automations' && (
          <AutomationView
            automations={automations}
            activityLogs={activityLogs}
            onUpdateAutomation={handleUpdateAutomation}
          />
        )}

        {currentTab === 'document_templates' && (
          <>
            <DocumentTemplateView key={`${customerWorkspaceCompanyId || 'all'}:${customerWorkspaceContext?.leadId || ''}:${customerWorkspaceContext?.dealId || ''}`} initialCompanyId={customerWorkspaceCompanyId} initialLeadId={customerWorkspaceContext?.leadId} initialDealId={customerWorkspaceContext?.dealId} />
            <SalesOperationsWorkspace tab="documents" companyId={customerWorkspaceCompanyId} leadId={customerWorkspaceContext?.leadId} dealId={customerWorkspaceContext?.dealId} onClearCompanyFilter={() => setCustomerWorkspaceContext(undefined)} />
          </>
        )}

        {currentTab === 'contacts' && <ContactsLineHub />}

        {currentTab === 'marketing_automation' && (
          <MarketingAutomationPrototypeView scenarios={marketingScenarios} onScenariosChange={setMarketingScenarios} />
        )}

        {/* ================= SECTION 3: AI PRESIDENT & STRATEGY ================= */}
        {currentTab === 'ai_dashboard' && (
          <DashboardView
            topGoal={topGoal}
            onUpdateTopGoal={handleUpdateTopGoal}
            projects={projects}
            tasks={tasks}
            approvals={approvals}
            activityLogs={activityLogs}
            tokenUsageRecords={tokenUsageRecords}
            pricingRates={pricingRates}
            onNavigateTab={(tab) => {
              if (tab === 'chat') setCurrentTab('ai_chat');
              else if (tab === 'projects') setCurrentTab('ai_projects');
              else if (tab === 'tasks') {
                setSelectedTaskWorkspaceSection('tasks');
                setCurrentTab('ai_tasks');
              } else if (tab === 'approvals') {
                setSelectedTaskWorkspaceSection('approvals');
                setCurrentTab('ai_tasks');
              }
              else if (tab === 'presets') setCurrentTab('ai_presets');
              else setCurrentTab(tab as any);
            }}
            onOpenPricingSettings={() => setIsPricingModalOpen(true)}
            onResolveApproval={handleResolveApproval}
          />
        )}

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

        {currentTab === 'ai_projects' && (
          <ProjectsView
            projects={projects}
            tasks={tasks}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onNavigateToTasksWithFilter={(projId) => {
              setSelectedProjectIdForTasks(projId);
              setSelectedTaskWorkspaceSection('tasks');
              setCurrentTab('ai_tasks');
            }}
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
            initialSection={selectedTaskWorkspaceSection}
            onSectionChange={setSelectedTaskWorkspaceSection}
          />
        )}

        {currentTab === 'ai_presets' && (
          <PresetsView
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
          />
        )}
      </main>

      {/* Global Modals */}
      <ConfigGuideModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <RlsGuideModal
        isOpen={isRlsOpen}
        onClose={() => setIsRlsOpen(false)}
      />

      {quickCreateOpen && (
        <RecordFormModal
          isOpen={quickCreateOpen}
          tableKey={quickCreateTable}
          editRecord={null}
          onClose={() => setQuickCreateOpen(false)}
          onSuccess={() => {
            if (currentTab !== quickCreateTable) {
              setCurrentTab(quickCreateTable as UnifiedNavTab);
            }
          }}
        />
      )}

      {/* AI President Modals */}
      {isCharacterEditorOpen && editingCharacter && (
        <ModalShell title="専門AIの編集" onClose={closeCharacterEditor}>
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
              closeCharacterEditor();
              setCurrentTab('ai_chat');
            }}
            onClose={closeCharacterEditor}
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
          onClose={() => setEditingRoleId(null)}
        />
      )}

      {isModelSettingsOpen && (
        <ModelSettingsModal
          defaultSetting={aiModelSettings.defaultSetting}
          onSave={(defaultSetting) => {
            updateAiModelSettings({ ...aiModelSettings, defaultSetting });
            setIsModelSettingsOpen(false);
          }}
          onClose={() => setIsModelSettingsOpen(false)}
        />
      )}

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            <UserProfileEditor
              userProfile={userProfile}
              onSaveProfile={(prof) => {
                handleUpdateUserProfile(prof);
                setIsProfileModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {activePlanForModal && (
        <PlanRegistrationModal
          plan={activePlanForModal}
          isOpen={true}
          onClose={() => setActivePlanForModal(null)}
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
            setActivePlanForModal(null);
            setCurrentTab('ai_tasks');
          }}
        />
      )}

      {isPricingModalOpen && (
        <PricingSettingsModal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
          pricingRates={pricingRates}
          tokenUsageRecords={tokenUsageRecords}
          onSavePricingRates={handleSavePricingRates}
          onClearUsageRecords={handleClearUsageRecords}
        />
      )}

      {isBackupModalOpen && (
        <BackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
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
            setIsBackupModalOpen(false);
          }}
        />
      )}

      {/* Slide-out Quick President Drawer */}
      <QuickPresidentDrawer
        isOpen={isQuickDrawerOpen}
        onClose={() => setIsQuickDrawerOpen(false)}
        character={presidentCharacter}
        userProfile={userProfile}
        onOpenFullChat={() => setCurrentTab('ai_chat')}
        onOpenPlanProposal={(plan) => setActivePlanForModal(plan)}
        onRecordUsage={handleRecordUsage}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MST AI経営OS × MyAI Studio 統合基盤</span>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs ${workspaceSyncStatus === 'error' ? 'text-rose-400' : workspaceSyncStatus === 'saving' ? 'text-amber-300' : 'text-emerald-400'}`}
              title={workspaceSyncStatus === 'error' ? 'Supabaseへの同期に失敗しました。接続設定と mst_workspace_state テーブルのマイグレーションを確認してください。' : undefined}
            >
              {workspaceSyncStatus === 'saving' ? 'クラウド保存中' : workspaceSyncStatus === 'saved' ? 'クラウド保存済み' : 'クラウド同期エラー'}
            </span>
            <span>•</span>
            <button
              onClick={() => setIsPricingModalOpen(true)}
              className="hover:text-slate-300 transition-colors"
            >
              APIトークン利用量
            </button>
            <span>•</span>
            <button
              onClick={() => setIsRlsOpen(true)}
              className="hover:text-slate-300 transition-colors"
            >
              RLS設定
            </button>
            <span>•</span>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="hover:text-slate-300 transition-colors"
            >
              Supabase接続設定
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const publicFormMatch = window.location.pathname.match(/^\/f\/([^/]+)\/?$/);
  if (publicFormMatch) {
    let slug = publicFormMatch[1];
    try { slug = decodeURIComponent(slug); } catch { /* Keep the raw path segment for the server's validation. */ }
    return <PublicIntakeForm slug={slug} />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


