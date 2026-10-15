import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UnifiedNavbar, UnifiedNavTab } from './components/UnifiedNavbar';
import { Dashboard } from './components/Dashboard';
import { TableManager } from './components/TableManager';
import { DiagnosisManager } from './components/DiagnosisManager';
import { AuthScreen } from './components/AuthScreen';
import { ConfigGuideModal } from './components/ConfigGuideModal';
import { RlsGuideModal } from './components/RlsGuideModal';
import { RecordFormModal } from './components/RecordFormModal';
import { TableKey } from './types/database';
import { Loader2 } from 'lucide-react';

// AI President Views and Modals
import { DashboardView } from './components/ai-president/DashboardView';
import { ChatView } from './components/ai-president/ChatView';
import { ProjectsView } from './components/ai-president/ProjectsView';
import { TasksView } from './components/ai-president/TasksView';
import { ApprovalsView } from './components/ai-president/ApprovalsView';
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
import { AutomationView } from './components/matrix/AutomationView';
import { DocumentTemplateView } from './components/matrix/DocumentTemplateView';
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
  ModelPricingRate,
  TokenUsageRecord,
  ApiUsageData,
} from './types';
import {
  loadCharacters,
  saveCharacters,
  loadActiveCharacterId,
  saveActiveCharacterId,
  loadUserProfile,
  saveUserProfile,
  loadChatHistory,
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
import { PRESET_CHARACTERS } from './data/presets';
import { getAIWorkMode, AIWorkModeId } from './data/aiWorkModes';
import { matrixService } from './services/matrixService';
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

const MAX_CHAT_CONTEXT_MESSAGES = 12;
const MAX_CHAT_CONTEXT_CHARACTERS = 16000;

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

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<UnifiedNavTab>('mst_dashboard');
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

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory(activeCharacterId));
  const [isStreaming, setIsStreaming] = useState(false);
  const activeAbortController = useRef<AbortController | null>(null);

  // AI President Modals
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCharacterEditorOpen, setIsCharacterEditorOpen] = useState(false);
  const [isQuickDrawerOpen, setIsQuickDrawerOpen] = useState(false);
  const [activePlanForModal, setActivePlanForModal] = useState<ProposedPlan | null>(null);
  const [selectedProjectIdForTasks, setSelectedProjectIdForTasks] = useState<string | null>(null);

  // Matrix & Product States
  const [products, setProducts] = useState<ManagedProduct[]>(() => matrixService.loadProducts());
  const [contracts, setContracts] = useState<ManagedContract[]>(() => matrixService.loadContracts());
  const [invoices, setInvoices] = useState<ManagedInvoice[]>(() => matrixService.loadInvoices());
  const [tools, setTools] = useState<ManagedToolAsset[]>(() => matrixService.loadTools());
  const [customLists, setCustomLists] = useState<CustomListDefinition[]>(() => matrixService.loadCustomLists());
  const [automations, setAutomations] = useState<AutomationRule[]>(() => matrixService.loadAutomations());

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
        setAutomations(data.automations);
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
  ]);

  // Active character
  const activeCharacter =
    characters.find((c) => c.id === activeCharacterId) || characters[0] || PRESET_CHARACTERS[0];

  // Quick Create Handler for MST
  const handleOpenCreate = (table: TableKey) => {
    setQuickCreateTable(table);
    setQuickCreateOpen(true);
  };

  // --- Character Switching & Saving ---
  const handleSelectCharacter = (id: string) => {
    setActiveCharacterId(id);
    saveActiveCharacterId(id);
    setMessages(loadChatHistory(id));
  };

  const handleUpdateCharacters = (newChars: CharacterConfig[]) => {
    setCharacters(newChars);
    saveCharacters(newChars);
  };

  const handleSaveCharacter = (updated: CharacterConfig) => {
    const exists = characters.some((c) => c.id === updated.id);
    const updatedList = exists
      ? characters.map((c) => (c.id === updated.id ? updated : c))
      : [updated, ...characters];
    handleUpdateCharacters(updatedList);
    setIsCharacterEditorOpen(false);
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
    setMessages([]);
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
    setIsCharacterEditorOpen(true);
  };

  const handleDeleteCharacter = (id: string) => {
    if (characters.length <= 1) {
      alert('最低1体のAIキャラクターが必要です。');
      return;
    }
    const filtered = characters.filter((c) => c.id !== id);
    handleUpdateCharacters(filtered);
    if (activeCharacterId === id) {
      const nextId = filtered[0].id;
      setActiveCharacterId(nextId);
      saveActiveCharacterId(nextId);
      setMessages(loadChatHistory(nextId));
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
    usage: ApiUsageData;
  }) => {
    recordTokenUsage(params);
    setTokenUsageRecords(loadTokenUsageRecords());
  };

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

  const handleDeleteTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
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

    const updatedApprovals = approvals.map((a) =>
      a.id === id
        ? {
            ...a,
            status,
            resolutionNote: note,
            resolvedAt: Date.now(),
          }
        : a
    );
    setApprovals(updatedApprovals);
    saveApprovals(updatedApprovals);

    if (targetApproval.taskId) {
      const updatedTasks = tasks.map((t) => {
        if (t.id === targetApproval.taskId) {
          return {
            ...t,
            status: status === 'approved' ? ('completed' as const) : ('in_progress' as const),
            updatedAt: Date.now(),
          };
        }
        return t;
      });
      setTasks(updatedTasks);
      saveTasks(updatedTasks);
    }

    recordActivityLog(
      'approval_resolved',
      `申請「${targetApproval.actionTitle}」が【${status === 'approved' ? '承認' : '却下'}】されました`,
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

    const newTasks: TaskItem[] = plan.tasks.map((pt, idx) => ({
      id: `task-${Date.now()}-${idx}`,
      projectId: newProject.id,
      title: pt.title,
      description: pt.objective,
      status: 'waiting',
      priority: pt.priority,
      assignee: {
        type: 'ai_ceo',
        name: pt.suggestedAssignee || 'AI社長',
      },
      completionCriteria: pt.completionCriteria,
      createdAt: Date.now() + idx,
      updatedAt: Date.now() + idx,
    }));
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

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    saveChatHistory(activeCharacter.id, newHistory);
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
    let responseModel = 'gemini-3.8-flash';

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
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
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
        usage: streamUsage,
      });

      const updatedHistory = [
        ...newHistory,
        {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: accumulatedContent,
          timestamp: Date.now(),
        },
      ];
      saveChatHistory(activeCharacter.id, updatedHistory);
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
                    '申し訳ございません。通信に問題が発生しました。時間をおいてお試しください。',
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
    saveChatHistory(activeCharacter.id, []);
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

  const handleAddContract = (c: Omit<ManagedContract, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = matrixService.addContract(c);
    setContracts(matrixService.loadContracts());
    recordActivityLog('task_created', `契約書「${created.title}」を登録しました`, '人間');
    setActivityLogs(loadActivityLogs());
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
    matrixService.updateInvoice(id, { status, paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined });
    setInvoices(matrixService.loadInvoices());
    recordActivityLog('task_status_changed', `請求書ステータスが更新されました`, '人間');
    setActivityLogs(loadActivityLogs());
  };

  const handleToggleAutomation = (id: string) => {
    matrixService.toggleAutomation(id);
    setAutomations(matrixService.loadAutomations());
  };

  const handleTriggerAutomation = (id: string): string => {
    const rule = automations.find((candidate) => candidate.id === id);
    if (!rule || !rule.isActive) throw new Error('有効な自動化ルールが見つかりません。');

    const now = Date.now();
    let resultSummary = '';

    if (rule.actionType === 'create_task') {
      let project = projects[0];
      let nextProjects = projects;
      if (!project) {
        project = {
          id: `proj-automation-${now}`,
          name: '自動化タスク',
          objective: '業務自動化によって作成されたタスクを管理する',
          status: 'in_progress',
          priority: 'medium',
          dueDate: '',
          createdAt: now,
          updatedAt: now,
        };
        nextProjects = [project, ...projects];
        setProjects(nextProjects);
        saveProjects(nextProjects);
      }

      const task: TaskItem = {
        id: `task-auto-${now}`,
        projectId: project.id,
        title: rule.actionConfig.taskTitle || rule.name,
        description: `${rule.description}\n\n自動化ルール: ${rule.name}`,
        priority: rule.actionConfig.priority || 'medium',
        assignee: { type: 'human', name: rule.actionConfig.assignee === 'human' ? '人間 (あなた)' : 'AI社長' },
        status: 'waiting',
        completionCriteria: '担当者が内容を確認し、完了結果を記録すること',
        sourceAutomationId: rule.id,
        createdAt: now,
        updatedAt: now,
      };
      const nextTasks = [task, ...tasks];
      setTasks(nextTasks);
      saveTasks(nextTasks);
      resultSummary = `タスク「${task.title}」を作成しました`;
    } else if (rule.actionType === 'create_invoice_draft') {
      const signedContract = contracts.find((contract) => contract.status === 'signed');
      const issueDate = new Date(now);
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 30);
      const invoice: ManagedInvoice = {
        id: `inv-auto-${now}`,
        invoiceNumber: `AUTO-${issueDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now).slice(-4)}`,
        title: rule.actionConfig.taskTitle || `【自動作成】${signedContract?.title || '請求書ドラフト'}`,
        productId: signedContract?.productId,
        companyId: signedContract?.companyId,
        recipientName: signedContract?.counterpartyName || '要入力',
        amount: signedContract?.amount || 0,
        status: 'draft',
        issueDate: issueDate.toISOString().slice(0, 10),
        dueDate: dueDate.toISOString().slice(0, 10),
        notes: signedContract ? `締結済み契約「${signedContract.title}」をもとに自動作成。発行前に金額・宛先を確認してください。` : '自動作成ドラフトです。宛先と金額を入力してから発行してください。',
        sourceAutomationId: rule.id,
        createdAt: now,
        updatedAt: now,
      };
      matrixService.addInvoice(invoice);
      setInvoices(matrixService.loadInvoices());
      resultSummary = `請求書ドラフト「${invoice.invoiceNumber}」を作成しました（宛先・金額の確認が必要です）`;
    } else if (rule.actionType === 'notify_president') {
      const existingApproval = approvals.find((approval) => approval.sourceAutomationId === rule.id && approval.status === 'pending');
      if (existingApproval) throw new Error('このルールの承認依頼はすでに未処理です。');
      const approval: ApprovalItem = {
        id: `appr-auto-${now}`,
        taskTitle: rule.actionConfig.taskTitle || rule.name,
        actionTitle: `自動化ルール「${rule.name}」の確認`,
        reason: rule.actionConfig.messageTemplate || rule.description,
        status: 'pending',
        requestedBy: 'システム（自動化エンジン）',
        sourceAutomationId: rule.id,
        createdAt: now,
      };
      const nextApprovals = [approval, ...approvals];
      setApprovals(nextApprovals);
      saveApprovals(nextApprovals);
      resultSummary = `AI社長の承認待ちに「${approval.taskTitle}」を追加しました`;
    } else {
      resultSummary = rule.actionConfig.messageTemplate || rule.description;
    }

    matrixService.triggerAutomation(id);
    setAutomations(matrixService.loadAutomations());
    recordActivityLog('task_created', `自動化ルール「${rule.name}」を実行: ${resultSummary}`, 'システム（自動化エンジン）');
    setActivityLogs(loadActivityLogs());
    return resultSummary;
  };

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
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenRls={() => setIsRlsOpen(true)}
        onOpenPricing={() => setIsPricingModalOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenQuickDrawer={() => setIsQuickDrawerOpen(true)}
        characters={characters}
        activeCharacter={activeCharacter}
        onSelectCharacter={handleSelectCharacter}
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
          />
        )}

        {currentTab === 'mst_diagnoses' && (
          <DiagnosisManager onOpenRls={() => setIsRlsOpen(true)} />
        )}

        {['companies', 'prospects', 'leads', 'products', 'deals', 'customers'].includes(currentTab) && (
          <TableManager
            currentTable={currentTab as TableKey}
            onTableChange={(tab) => setCurrentTab(tab as UnifiedNavTab)}
            onOpenRls={() => setIsRlsOpen(true)}
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

        {currentTab === 'custom_lists' && (
          <CustomListManager
            customLists={customLists}
            contracts={contracts}
            invoices={invoices}
            tools={tools}
            tasks={tasks}
            products={products}
            onAddContract={handleAddContract}
            onAddInvoice={handleAddInvoice}
            onAddTool={handleAddTool}
            onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
          />
        )}

        {currentTab === 'automations' && (
          <AutomationView
            automations={automations}
            onToggleAutomation={handleToggleAutomation}
            onTriggerAutomation={handleTriggerAutomation}
          />
        )}

        {currentTab === 'document_templates' && (
          <DocumentTemplateView />
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
              else if (tab === 'tasks') setCurrentTab('ai_tasks');
              else if (tab === 'approvals') setCurrentTab('ai_approvals');
              else if (tab === 'presets') setCurrentTab('ai_presets');
              else setCurrentTab(tab as any);
            }}
            onOpenPricingSettings={() => setIsPricingModalOpen(true)}
            onResolveApproval={handleResolveApproval}
          />
        )}

        {currentTab === 'ai_chat' && (
          <ChatView
            character={activeCharacter}
            userProfile={userProfile}
            messages={messages}
            onSendMessage={handleSendMessage}
            onClearMessages={handleClearMessages}
            onEditCharacter={() => setIsCharacterEditorOpen(true)}
            onUpdateUserProfile={handleUpdateUserProfile}
            isStreaming={isStreaming}
            onStopStreaming={handleStopStreaming}
            onOpenPlanProposal={(plan) => setActivePlanForModal(plan)}
            onRecordUsage={handleRecordUsage}
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
              setCurrentTab('ai_tasks');
            }}
          />
        )}

        {currentTab === 'ai_tasks' && (
          <TasksView
            tasks={tasks}
            projects={projects}
            characters={characters}
            selectedProjectId={selectedProjectIdForTasks}
            onClearProjectFilter={() => setSelectedProjectIdForTasks(null)}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onRequestApproval={handleRequestApproval}
          />
        )}

        {currentTab === 'ai_approvals' && (
          <ApprovalsView
            approvals={approvals}
            activityLogs={activityLogs}
            onResolveApproval={handleResolveApproval}
          />
        )}

        {currentTab === 'ai_presets' && (
          <PresetsView
            onSelectAndChat={(preset) => {
              handleSelectCharacter(preset.id);
              setCurrentTab('ai_chat');
            }}
            onDuplicateAndEdit={(preset) => {
              handleDuplicateCharacter(preset);
            }}
            activeCharacterId={activeCharacterId}
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
      {isCharacterEditorOpen && (
        <CharacterEditor
          character={activeCharacter}
          userProfile={userProfile}
          onSaveCharacter={handleSaveCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onDuplicateCharacter={handleDuplicateCharacter}
          onStartChat={(char) => {
            handleSelectCharacter(char.id);
            setIsCharacterEditorOpen(false);
            setCurrentTab('ai_chat');
          }}
          onRecordUsage={handleRecordUsage}
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
            setIsBackupModalOpen(false);
          }}
        />
      )}

      {/* Slide-out Quick President Drawer */}
      <QuickPresidentDrawer
        isOpen={isQuickDrawerOpen}
        onClose={() => setIsQuickDrawerOpen(false)}
        character={activeCharacter}
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
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

