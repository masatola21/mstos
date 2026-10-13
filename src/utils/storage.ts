import {
  CharacterConfig,
  UserProfile,
  ChatMessage,
  Project,
  TaskItem,
  ApprovalItem,
  ActivityLog,
  ActivityActionType,
  ModelPricingRate,
  TokenUsageRecord,
  ApiUsageData,
} from '../types';
import { PRESET_CHARACTERS } from '../data/presets';

const STORAGE_KEYS = {
  CHARACTERS: 'myai_characters_v1',
  ACTIVE_CHAR_ID: 'myai_active_char_id_v1',
  USER_PROFILE: 'myai_user_profile_v1',
  CHAT_MESSAGES: 'myai_chat_messages_v1',
  PROJECTS: 'myai_projects_v1',
  TASKS: 'myai_tasks_v1',
  APPROVALS: 'myai_approvals_v1',
  ACTIVITY_LOGS: 'myai_activity_logs_v1',
  TOP_GOAL: 'myai_top_goal_v1',
  PRICING_RATES: 'myai_pricing_rates_v1',
  TOKEN_USAGE: 'myai_token_usage_v1',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  userName: '',
  userOccupation: '',
  userGoals: '',
  userHobbies: '',
  userValues: '',
  userNotes: '',
};

export const DEFAULT_TOP_GOAL =
  'AI社長と連携し、事業目標を確実なタスクへ分解してチームの実行力を最大化する';

// 公式公表価格目安（100万トークンあたり: 入力 ¥75, 出力 ¥300 ※$1=150円換算ベース目安）
export const DEFAULT_PRICING_RATES: ModelPricingRate[] = [
  {
    model: 'gemini-3.8-flash',
    currency: 'JPY',
    inputPricePerMillion: 75,
    outputPricePerMillion: 300,
    updatedAt: 1775000000000,
  },
];

// --- Sample Initial Data ---
const INITIAL_SAMPLE_PROJECTS: Project[] = [
  {
    id: 'sample-proj-1',
    name: '【サンプル】新規Webサービスの初期MVPローンチ',
    objective: 'AI社長と連携して課題をタスク分解し、3週間でプロトタイプを検証する',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-11-15',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000,
    isSample: true,
  },
];

const INITIAL_SAMPLE_TASKS: TaskItem[] = [
  {
    id: 'sample-task-1',
    projectId: 'sample-proj-1',
    title: '【サンプル】ターゲット顧客の課題ヒアリングシート作成',
    description: '想定ユーザーへのインタビュー項目と主要な検証仮説をまとめる',
    priority: 'high',
    assignee: { type: 'human', name: '人間 (あなた)' },
    status: 'completed',
    completionCriteria: '質問事項10点と検証仮説がドキュメント化されていること',
    resultNotes: 'ヒアリング項目10点を完了。主要なペインポイントを特定済み。',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'sample-task-2',
    projectId: 'sample-proj-1',
    title: '【サンプル】コア機能の要件定義と画面遷移の策定',
    description: 'MVPに含まれる必須機能3点を選定し、仕様書を起票する',
    priority: 'high',
    assignee: { type: 'ai_ceo', name: 'AI社長' },
    status: 'in_progress',
    completionCriteria: '画面遷移図とデータ項目の要件定義が完成していること',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'sample-task-3',
    projectId: 'sample-proj-1',
    title: '【サンプル】フロントエンド初期モックの実装準備',
    description: 'UIコンポーネントの基本設計とスタイルガイドの整備',
    priority: 'medium',
    assignee: { type: 'dev_agent', name: '開発エージェント (割り当て中)' },
    status: 'waiting',
    completionCriteria: 'コンポーネントツリーの骨組みが動作確認できること',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'sample-task-4',
    projectId: 'sample-proj-1',
    title: '【サンプル】外部API連携仕様の承認確認',
    description: '外部サービスとの通信仕様および利用コスト制限の承認確認',
    priority: 'high',
    assignee: { type: 'ai_ceo', name: 'AI社長' },
    status: 'pending_approval',
    completionCriteria: '人間の経営責任者による利用ポリシーの確認・承認',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
];

const INITIAL_SAMPLE_APPROVALS: ApprovalItem[] = [
  {
    id: 'sample-appr-1',
    taskId: 'sample-task-4',
    taskTitle: '【サンプル】外部API連携仕様の承認確認',
    actionTitle: '外部API通信仕様と利用ポリシーの確定承認',
    reason: '本番環境での安全な運用のための人間による最終確認',
    status: 'pending',
    requestedBy: 'AI社長',
    createdAt: Date.now() - 86400000,
  },
];

const INITIAL_SAMPLE_LOGS: ActivityLog[] = [
  {
    id: 'sample-log-1',
    timestamp: Date.now() - 86400000 * 3,
    actionType: 'project_created',
    summary: 'サンプルプロジェクト「新規Webサービスの初期MVPローンチ」が作成されました',
    actor: 'AI社長',
  },
  {
    id: 'sample-log-2',
    timestamp: Date.now() - 86400000 * 2,
    actionType: 'task_status_changed',
    summary: 'タスク「ターゲット顧客の課題ヒアリングシート作成」が完了になりました',
    actor: '人間',
  },
  {
    id: 'sample-log-3',
    timestamp: Date.now() - 86400000,
    actionType: 'approval_requested',
    summary: '「外部API連携仕様の承認確認」についての承認が申請されました',
    actor: 'AI社長',
  },
];

// --- Characters Storage ---

export function loadCharacters(): CharacterConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!parsed.some((c: CharacterConfig) => c.id === 'preset-ceo')) {
          const ceo = PRESET_CHARACTERS.find((c) => c.id === 'preset-ceo');
          if (ceo) {
            return [ceo, ...parsed];
          }
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load characters from localStorage', e);
  }
  return PRESET_CHARACTERS;
}

export function saveCharacters(characters: CharacterConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
  } catch (e) {
    console.error('Failed to save characters to localStorage', e);
  }
}

export function loadActiveCharacterId(characters: CharacterConfig[]): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAR_ID);
    if (saved && characters.some((c) => c.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.error(e);
  }
  if (characters.some((c) => c.id === 'preset-ceo')) {
    return 'preset-ceo';
  }
  return characters[0]?.id || 'preset-ceo';
}

export function saveActiveCharacterId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAR_ID, id);
  } catch (e) {
    console.error(e);
  }
}

// --- User Profile Storage ---

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (raw) {
      return { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load user profile', e);
  }
  return DEFAULT_USER_PROFILE;
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save user profile', e);
  }
}

// --- Chat History Storage ---

export function loadChatHistory(charId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    if (raw) {
      const allHistories = JSON.parse(raw);
      if (allHistories && allHistories[charId]) {
        return allHistories[charId];
      }
    }
  } catch (e) {
    console.error('Failed to load chat history', e);
  }
  return [];
}

export function saveChatHistory(charId: string, messages: ChatMessage[]): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    const allHistories = raw ? JSON.parse(raw) : {};
    allHistories[charId] = messages;
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(allHistories));
  } catch (e) {
    console.error('Failed to save chat history', e);
  }
}

// --- Top Priority Goal Storage ---

export function loadTopGoal(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.TOP_GOAL);
    if (saved) return saved;
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_TOP_GOAL;
}

export function saveTopGoal(goal: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TOP_GOAL, goal);
  } catch (e) {
    console.error(e);
  }
}

// --- Projects Storage ---

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load projects from localStorage', e);
  }
  return INITIAL_SAMPLE_PROJECTS;
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to localStorage', e);
  }
}

// --- Tasks Storage ---

export function loadTasks(): TaskItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load tasks from localStorage', e);
  }
  return INITIAL_SAMPLE_TASKS;
}

export function saveTasks(tasks: TaskItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage', e);
  }
}

// --- Approvals Storage ---

export function loadApprovals(): ApprovalItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPROVALS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load approvals from localStorage', e);
  }
  return INITIAL_SAMPLE_APPROVALS;
}

export function saveApprovals(approvals: ApprovalItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
  } catch (e) {
    console.error('Failed to save approvals to localStorage', e);
  }
}

// --- Activity Logs Storage ---

export function loadActivityLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load activity logs from localStorage', e);
  }
  return INITIAL_SAMPLE_LOGS;
}

export function saveActivityLogs(logs: ActivityLog[]): void {
  try {
    const trimmed = logs.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save activity logs to localStorage', e);
  }
}

export function recordActivityLog(
  actionType: ActivityActionType,
  summary: string,
  actor: string = '人間',
  details?: string
): ActivityLog {
  const newLog: ActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    actionType,
    summary,
    details,
    actor,
  };
  const currentLogs = loadActivityLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveActivityLogs(updatedLogs);
  return newLog;
}

// --- Model Pricing Rates Storage ---

export function loadPricingRates(): ModelPricingRate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRICING_RATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load pricing rates from localStorage', e);
  }
  return DEFAULT_PRICING_RATES;
}

export function savePricingRates(rates: ModelPricingRate[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRICING_RATES, JSON.stringify(rates));
  } catch (e) {
    console.error('Failed to save pricing rates to localStorage', e);
  }
}

// --- Token Usage Records Storage ---

export function loadTokenUsageRecords(): TokenUsageRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TOKEN_USAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load token usage records from localStorage', e);
  }
  return [];
}

export function saveTokenUsageRecords(records: TokenUsageRecord[]): void {
  try {
    // Keep last 300 records to prevent LocalStorage bloat
    const trimmed = records.slice(0, 300);
    localStorage.setItem(STORAGE_KEYS.TOKEN_USAGE, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save token usage records to localStorage', e);
  }
}

// 呼び出し単位で使用量を記録する
export function recordTokenUsage(params: {
  endpoint: 'chat' | 'generate-character' | 'extract-memory' | 'refine-prompt';
  endpointName: string;
  model?: string;
  usage: ApiUsageData;
}): TokenUsageRecord {
  const modelName = params.model || 'gemini-3.8-flash';
  const pricingRates = loadPricingRates();
  const activeRate = pricingRates.find((r) => r.model === modelName) || pricingRates[0];

  let estimatedCost: number | null = null;
  let rateSnapshot: TokenUsageRecord['rateSnapshot'] = undefined;

  if (activeRate) {
    rateSnapshot = {
      currency: activeRate.currency,
      inputPricePerMillion: activeRate.inputPricePerMillion,
      outputPricePerMillion: activeRate.outputPricePerMillion,
      rateUpdatedAt: activeRate.updatedAt,
    };

    // 単価が設定されており、かつ使用量が取得できている場合のみ料金目安を計算
    if (
      params.usage.status === 'acquired' &&
      activeRate.inputPricePerMillion !== null &&
      activeRate.outputPricePerMillion !== null
    ) {
      const promptTokens = params.usage.promptTokens ?? 0;
      const candidatesTokens = params.usage.candidatesTokens ?? 0;
      const inputCost = (promptTokens / 1_000_000) * activeRate.inputPricePerMillion;
      const outputCost = (candidatesTokens / 1_000_000) * activeRate.outputPricePerMillion;
      estimatedCost = inputCost + outputCost;
    }
  }

  const newRecord: TokenUsageRecord = {
    id: `usage-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    endpoint: params.endpoint,
    endpointName: params.endpointName,
    model: modelName,
    status: params.usage.status,
    promptTokens: params.usage.promptTokens,
    candidatesTokens: params.usage.candidatesTokens,
    totalTokens: params.usage.totalTokens,
    rateSnapshot,
    estimatedCost,
  };

  const currentRecords = loadTokenUsageRecords();
  const updatedRecords = [newRecord, ...currentRecords];
  saveTokenUsageRecords(updatedRecords);

  return newRecord;
}

// 今月のトークン数・料金目安の集計ヘルパー
export function getMonthlyTokenSummary(records: TokenUsageRecord[], targetDate: Date = new Date()) {
  const currentYear = targetDate.getFullYear();
  const currentMonth = targetDate.getMonth();

  const monthlyRecords = records.filter((r) => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  let totalPromptTokens = 0;
  let totalCandidatesTokens = 0;
  let totalTokens = 0;
  let totalEstimatedCost = 0;
  let acquiredCallCount = 0;
  let unacquiredCallCount = 0;
  let hasValidPricing = false;
  let currency: 'JPY' | 'USD' = 'JPY';

  for (const r of monthlyRecords) {
    if (r.status === 'acquired') {
      acquiredCallCount++;
      totalPromptTokens += r.promptTokens ?? 0;
      totalCandidatesTokens += r.candidatesTokens ?? 0;
      totalTokens += r.totalTokens ?? 0;

      if (r.estimatedCost !== null && r.estimatedCost !== undefined) {
        totalEstimatedCost += r.estimatedCost;
        hasValidPricing = true;
        if (r.rateSnapshot?.currency) {
          currency = r.rateSnapshot.currency;
        }
      }
    } else {
      unacquiredCallCount++;
    }
  }

  return {
    year: currentYear,
    month: currentMonth + 1,
    totalPromptTokens,
    totalCandidatesTokens,
    totalTokens,
    totalEstimatedCost: hasValidPricing ? totalEstimatedCost : null,
    currency,
    acquiredCallCount,
    unacquiredCallCount,
    unacquiredCount: unacquiredCallCount,
    totalCalls: monthlyRecords.length,
    monthlyRecords,
  };
}

// --- Export All Data (Full Backup & Backward Compatible) ---

export function exportAllData(): string {
  const data = {
    version: '2.1',
    exportedAt: new Date().toISOString(),
    topGoal: loadTopGoal(),
    projects: loadProjects(),
    tasks: loadTasks(),
    approvals: loadApprovals(),
    activityLogs: loadActivityLogs(),
    pricingRates: loadPricingRates(),
    tokenUsage: loadTokenUsageRecords(),
    characters: loadCharacters(),
    userProfile: loadUserProfile(),
  };
  return JSON.stringify(data, null, 2);
}
