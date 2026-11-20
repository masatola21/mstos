export type ManualTaskCommandId =
  | 'all'
  | 'generate_diagnosis_report'
  | 'reply_consultation'
  | 'confirm_meeting'
  | 'material_and_contract'
  | 'billing_or_warning'
  | 'general_manual';

export type SpecificManualTaskCommandId = Exclude<ManualTaskCommandId, 'all'>;

export interface ManualCommandOption {
  id: SpecificManualTaskCommandId;
  label: string;
  shortLabel: string;
  description: string;
}

export const MANUAL_COMMAND_OPTIONS: ManualCommandOption[] = [
  {
    id: 'generate_diagnosis_report',
    label: 'AI診断レポート作成',
    shortLabel: 'AI診断レポート',
    description: '無料診断の回答からAI診断レポートを作成・書類確認する手動タスク',
  },
  {
    id: 'reply_consultation',
    label: '相談・メール返信',
    shortLabel: '相談・返信',
    description: 'Web相談・お問い合わせへの個別返信や確認が必要なタスク',
  },
  {
    id: 'confirm_meeting',
    label: '面談対応・完了確認',
    shortLabel: '面談・確認',
    description: 'TimeRex予約・日程変更・キャンセル・面談完了確認のタスク',
  },
  {
    id: 'material_and_contract',
    label: '資料・成約対応',
    shortLabel: '資料・成約',
    description: '資料請求・開業パッケージ申込・即時成約後の手配タスク',
  },
  {
    id: 'billing_or_warning',
    label: '支払督促・設定警告',
    shortLabel: '督促・警告',
    description: '未入金督促や資料URL未設定など優先対応が必要なタスク',
  },
  {
    id: 'general_manual',
    label: 'その他手動タスク',
    shortLabel: 'その他手動',
    description: '担当者が手動で進める一般的なタスクや承認待ちタスク',
  },
];

export interface SystemTaskLike {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  company_id?: string | null;
  created_at?: string | null;
}

export interface WorkspaceTaskLike {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assignee: {
    type: string;
    name?: string;
  };
  sourceAutomationId?: string;
  sourceAutomationRecordId?: string;
  relatedRecord?: {
    type?: string;
    id?: string;
    label?: string;
  };
  createdAt?: number;
  updatedAt?: number;
}

export interface DiagnosisSubmissionSummary {
  id: string;
  form_id: string;
  company_id: string | null;
  lead_id: string | null;
  diagnosis_id?: string | null;
  status?: string | null;
  respondent_name?: string | null;
  respondent_company_name?: string | null;
  respondent_email?: string | null;
  submitted_at?: string | null;
}

function classifyTextToCommand(
  title: string,
  description: string,
  sourceAutomationId?: string
): SpecificManualTaskCommandId | null {
  const combined = `${title}\n${description}`;

  if (
    sourceAutomationId === 'workflow-invoice-overdue' ||
    title.includes('【支払督促') ||
    title.includes('【未設定警告】') ||
    combined.includes('資料URLが未登録') ||
    combined.includes('請求書未払い') ||
    combined.includes('請求期限超過')
  ) {
    return 'billing_or_warning';
  }

  if (
    sourceAutomationId === 'workflow-diagnosis-submitted' ||
    title.includes('レポート承認') ||
    title.includes('診断レポート') ||
    title.includes('診断回答を確認') ||
    combined.includes('AI診断レポート') ||
    combined.includes('無料診断回答')
  ) {
    return 'generate_diagnosis_report';
  }

  if (
    title.includes('Web相談') ||
    title.includes('メール返信') ||
    combined.includes('Web相談・お問い合わせ') ||
    combined.includes('個別メール返信')
  ) {
    return 'reply_consultation';
  }

  if (
    title.includes('【TimeRex') ||
    title.includes('【面談完了確認】') ||
    combined.includes('面談日程') ||
    combined.includes('面談完了') ||
    combined.includes('商談完了')
  ) {
    return 'confirm_meeting';
  }

  if (
    sourceAutomationId === 'workflow-contract-signed' ||
    title.includes('資料請求') ||
    title.includes('開業パッケージ') ||
    title.includes('即時成約') ||
    title.includes('契約締結後') ||
    combined.includes('Web申込・発注')
  ) {
    return 'material_and_contract';
  }

  return null;
}

export function classifySystemTaskCommand(
  task: Pick<SystemTaskLike, 'title' | 'description'>
): SpecificManualTaskCommandId {
  return classifyTextToCommand(task.title || '', task.description || '') || 'general_manual';
}

export function classifyWorkspaceTaskCommand(
  task: Pick<WorkspaceTaskLike, 'title' | 'description' | 'sourceAutomationId' | 'assignee' | 'status'>
): SpecificManualTaskCommandId | null {
  const specific = classifyTextToCommand(
    task.title || '',
    task.description || '',
    task.sourceAutomationId
  );
  if (specific) return specific;

  if (
    task.assignee?.type === 'human' ||
    task.assignee?.type === 'external_ai' ||
    task.status === 'pending_approval' ||
    task.status === 'blocked'
  ) {
    return 'general_manual';
  }

  return null;
}

export function isImportantManualSystemTask(
  task: Pick<SystemTaskLike, 'title' | 'description' | 'status' | 'priority'>
): boolean {
  if (task.status === 'done' || task.status === 'completed') return false;
  const cmd = classifySystemTaskCommand(task);
  if (cmd !== 'general_manual') return true;
  return task.priority === 'urgent' || task.priority === 'high';
}

export function isImportantManualWorkspaceTask(
  task: Pick<
    WorkspaceTaskLike,
    'title' | 'description' | 'status' | 'priority' | 'assignee' | 'sourceAutomationId'
  >
): boolean {
  if (task.status === 'completed') return false;
  const cmd = classifyWorkspaceTaskCommand(task);
  if (cmd === 'generate_diagnosis_report' || cmd === 'billing_or_warning') return true;
  if (task.status === 'pending_approval' || task.status === 'blocked') return true;
  if (task.assignee?.type === 'human' || task.assignee?.type === 'external_ai') return true;
  if (task.priority === 'high' && cmd !== null) return true;
  return false;
}

export function getManualCommandOption(
  cmd: SpecificManualTaskCommandId | null | undefined
): ManualCommandOption | null {
  if (!cmd) return null;
  return MANUAL_COMMAND_OPTIONS.find((item) => item.id === cmd) || null;
}

export interface ExtractedTaskRefs {
  submissionId?: string;
  companyId?: string;
  leadId?: string;
  email?: string;
}

const UUID_REGEX_STR = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function extractTaskContextRefs(text: string): ExtractedTaskRefs {
  const src = String(text || '');
  const subMatch =
    src.match(new RegExp(`(?:回答ID|submission_id)\\s*[:：]\\s*(${UUID_REGEX_STR})`, 'i')) ||
    src.match(new RegExp(`\\[submission:(${UUID_REGEX_STR})\\]`, 'i'));
  const compMatch =
    src.match(new RegExp(`(?:企業ID|会社ID|company_id)\\s*[:：]\\s*(${UUID_REGEX_STR})`, 'i')) ||
    src.match(new RegExp(`\\[company:(${UUID_REGEX_STR})\\]`, 'i'));
  const leadMatch =
    src.match(new RegExp(`(?:リードID|lead_id)\\s*[:：]\\s*(${UUID_REGEX_STR})`, 'i')) ||
    src.match(new RegExp(`\\[lead:(${UUID_REGEX_STR})\\]`, 'i'));
  const emailMatch = src.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);

  return {
    submissionId: subMatch?.[1],
    companyId: compMatch?.[1],
    leadId: leadMatch?.[1],
    email: emailMatch?.[0]?.toLowerCase(),
  };
}

export function extractNameAndCompanyFromTaskTitle(title: string): {
  personName?: string;
  companyName?: string;
} {
  const raw = String(title || '').trim();
  const stripped = raw.replace(/^【[^】]+】\s*/, '').trim();
  // Pattern: "<Name> 様（<Company>）..."
  const matchWithCompany = stripped.match(/^(.+?)\s*様\s*[（(]([^）)]+)[）)]/);
  if (matchWithCompany) {
    const personName = matchWithCompany[1].trim();
    const rawCompany = matchWithCompany[2].trim();
    const companyName = rawCompany === '個人' ? undefined : rawCompany;
    return {
      personName: personName || undefined,
      companyName,
    };
  }
  const matchNameOnly = stripped.match(/^(.+?)\s*様/);
  if (matchNameOnly) {
    return {
      personName: matchNameOnly[1].trim() || undefined,
    };
  }
  return {};
}

function normalizeLabel(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function pickBestSubmission(
  candidates: DiagnosisSubmissionSummary[],
  taskCreatedMs: number | null,
  diagnosisFormIds?: Set<string>
): DiagnosisSubmissionSummary | null {
  if (candidates.length === 0) return null;

  const diagOnly =
    diagnosisFormIds && diagnosisFormIds.size > 0
      ? candidates.filter((sub) => diagnosisFormIds.has(sub.form_id))
      : [];
  const pool = diagOnly.length > 0 ? diagOnly : candidates;

  if (pool.length === 1) return pool[0];

  return [...pool].sort((a, b) => {
    const aMs = a.submitted_at ? Date.parse(a.submitted_at) : 0;
    const bMs = b.submitted_at ? Date.parse(b.submitted_at) : 0;
    if (taskCreatedMs && aMs && bMs) {
      return Math.abs(aMs - taskCreatedMs) - Math.abs(bMs - taskCreatedMs);
    }
    return bMs - aMs;
  })[0];
}

export function findMatchingSubmissionForTask(params: {
  systemTask?: Pick<SystemTaskLike, 'id' | 'title' | 'description' | 'company_id' | 'created_at'>;
  workspaceTask?: Pick<
    WorkspaceTaskLike,
    'id' | 'title' | 'description' | 'sourceAutomationRecordId' | 'relatedRecord' | 'createdAt'
  >;
  submissions: DiagnosisSubmissionSummary[];
  diagnosisFormIds?: Set<string>;
  preferDiagnosisOnly?: boolean;
}): DiagnosisSubmissionSummary | null {
  const { systemTask, workspaceTask, submissions, diagnosisFormIds, preferDiagnosisOnly } = params;
  if (!submissions || submissions.length === 0) return null;

  const diagPool =
    preferDiagnosisOnly && diagnosisFormIds && diagnosisFormIds.size > 0
      ? submissions.filter((s) => diagnosisFormIds.has(s.form_id))
      : submissions;

  // 1. Direct workspace automation sourceAutomationRecordId === submission.id
  if (workspaceTask?.sourceAutomationRecordId) {
    const direct = submissions.find((s) => s.id === workspaceTask.sourceAutomationRecordId);
    if (direct) return direct;
  }

  const title = systemTask?.title || workspaceTask?.title || '';
  const description = systemTask?.description || workspaceTask?.description || '';
  const refs = extractTaskContextRefs(`${title}\n${description}`);

  // 2. Direct submission ID embedded in description
  if (refs.submissionId) {
    const direct = submissions.find((s) => s.id === refs.submissionId);
    if (direct) return direct;
  }

  const taskCreatedMs = systemTask?.created_at
    ? Date.parse(systemTask.created_at) || null
    : workspaceTask?.createdAt || null;

  // 3. Match by lead_id
  const targetLeadId =
    refs.leadId ||
    (workspaceTask?.relatedRecord?.type === 'lead' ? workspaceTask.relatedRecord.id : undefined);
  if (targetLeadId) {
    const matches = diagPool.filter((s) => s.lead_id === targetLeadId);
    const picked = pickBestSubmission(matches, taskCreatedMs, diagnosisFormIds);
    if (picked) return picked;
  }

  // 4. Match by company_id
  const targetCompanyId =
    refs.companyId ||
    systemTask?.company_id ||
    (workspaceTask?.relatedRecord?.type === 'company' || workspaceTask?.relatedRecord?.type === 'customer'
      ? workspaceTask.relatedRecord.id
      : undefined);
  if (targetCompanyId) {
    const matches = diagPool.filter((s) => s.company_id === targetCompanyId);
    const picked = pickBestSubmission(matches, taskCreatedMs, diagnosisFormIds);
    if (picked) return picked;
  }

  // 5. Match by respondent email
  if (refs.email) {
    const matches = diagPool.filter(
      (s) => s.respondent_email && s.respondent_email.trim().toLowerCase() === refs.email
    );
    const picked = pickBestSubmission(matches, taskCreatedMs, diagnosisFormIds);
    if (picked) return picked;
  }

  // 6. Fallback: Match by personName (+ optional companyName) from title
  const { personName, companyName } = extractNameAndCompanyFromTaskTitle(title);
  if (personName) {
    const normPerson = normalizeLabel(personName);
    const normCompany = normalizeLabel(companyName);
    const exactMatches = diagPool.filter((s) => {
      if (normalizeLabel(s.respondent_name) !== normPerson) return false;
      if (normCompany && s.respondent_company_name) {
        return normalizeLabel(s.respondent_company_name) === normCompany;
      }
      return true;
    });
    const picked = pickBestSubmission(exactMatches, taskCreatedMs, diagnosisFormIds);
    if (picked) return picked;
  }

  return null;
}

export const TOP_PANEL_DEDUPED_PRESET_RULE_IDS = new Set([
  'workflow-diagnosis-submitted',
  'workflow-invoice-overdue',
]);

export function shouldCreateAutomationLowerTask(rule: {
  id: string;
  isEnabled: boolean;
}): boolean {
  if (!rule.isEnabled) return false;
  return !TOP_PANEL_DEDUPED_PRESET_RULE_IDS.has(rule.id);
}

export interface TaskDraftArtifactLike {
  title: string;
  category: string;
  content: string;
  tags: string[];
  createdAt: number;
  sourceRoleId?: string;
}

export interface KnowledgeItemLike {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  sourceTaskId?: string;
  sourceRoleId?: string;
}

export interface ApprovalItemLike {
  id: string;
  taskId?: string;
  status: 'pending' | 'approved' | 'rejected';
  resolutionNote?: string;
  resolvedAt?: number;
}

export function resolveCompletedTaskState<
  TTask extends {
    id: string;
    status: string;
    resultNotes?: string;
    knowledgeItemId?: string;
    draftArtifact?: TaskDraftArtifactLike;
    completedAt?: number;
    updatedAt: number;
  },
  TKnowledge extends KnowledgeItemLike,
  TApproval extends ApprovalItemLike,
>(params: {
  task: TTask;
  existingKnowledge: TKnowledge[];
  existingApprovals: TApproval[];
  now?: number;
}): {
  updatedTask: TTask;
  knowledgeItems: TKnowledge[];
  savedKnowledge?: TKnowledge;
  approvals: TApproval[];
  resolvedApprovalCount: number;
} {
  const now = params.now ?? Date.now();
  const { task, existingKnowledge, existingApprovals } = params;

  let nextKnowledge = existingKnowledge;
  let savedKnowledge: TKnowledge | undefined;
  let nextKnowledgeId = task.knowledgeItemId;
  let nextDraftArtifact = task.draftArtifact;
  let nextResultNotes = task.resultNotes;

  if (task.draftArtifact) {
    const draft = task.draftArtifact;
    const existing = nextKnowledgeId
      ? existingKnowledge.find((item) => item.id === nextKnowledgeId)
      : existingKnowledge.find((item) => item.sourceTaskId === task.id);

    savedKnowledge = {
      ...(existing || {}),
      id: existing?.id || `knowledge-task-${task.id}`,
      title: draft.title,
      category: draft.category,
      content: draft.content,
      tags: Array.from(new Set([...(existing?.tags || []), ...(draft.tags || [])])),
      createdAt: existing?.createdAt || draft.createdAt || now,
      updatedAt: now,
      sourceTaskId: task.id,
      sourceRoleId: draft.sourceRoleId,
    } as TKnowledge;

    nextKnowledge = existing
      ? existingKnowledge.map((item) => (item.id === savedKnowledge!.id ? savedKnowledge! : item))
      : [savedKnowledge, ...existingKnowledge];
    nextKnowledgeId = savedKnowledge.id;
    nextDraftArtifact = undefined;
    nextResultNotes = `完了。成果物をナレッジ「${savedKnowledge.title}」に保存しました。`;
  }

  let resolvedApprovalCount = 0;
  const nextApprovals = existingApprovals.map((approval) => {
    if (approval.taskId === task.id && approval.status === 'pending') {
      resolvedApprovalCount += 1;
      return {
        ...approval,
        status: 'approved' as const,
        resolutionNote: approval.resolutionNote || 'タスク完了により自動承認',
        resolvedAt: now,
      };
    }
    return approval;
  });

  const updatedTask: TTask = {
    ...task,
    status: 'completed',
    completedAt: task.completedAt || now,
    updatedAt: now,
    knowledgeItemId: nextKnowledgeId,
    draftArtifact: nextDraftArtifact,
    resultNotes: nextResultNotes,
  };

  return {
    updatedTask,
    knowledgeItems: nextKnowledge,
    savedKnowledge,
    approvals: nextApprovals,
    resolvedApprovalCount,
  };
}

