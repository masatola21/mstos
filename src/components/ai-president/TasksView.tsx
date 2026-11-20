import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ClipboardCopy,
  Plus,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Bot,
  Briefcase,
  X,
  Filter,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Paperclip,
  Download,
  ChevronDown,
  Search,
  RefreshCw,
  Sparkles,
  Mail,
  Calendar,
  FileText,
  Square,
  ExternalLink,
} from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import {
  TaskItem,
  Project,
  CharacterConfig,
  TaskStatus,
  Priority,
  ApprovalItem,
  ActivityLog,
  WorkspaceAttachment,
  TaskWorkArea,
  TaskSourceCategory,
  TaskKind,
  TaskRelatedRecordType,
} from '../types';
import { ApprovalsView } from './ApprovalsView';
import { AI_WORK_MODES, RoleAIOverrides, resolveWorkMode } from '../../data/aiWorkModes';
import { todayJst } from '../../utils/date';
import {
  MANUAL_COMMAND_OPTIONS,
  ManualTaskCommandId,
  SpecificManualTaskCommandId,
  DiagnosisSubmissionSummary,
  classifySystemTaskCommand,
  classifyWorkspaceTaskCommand,
  isImportantManualSystemTask,
  isImportantManualWorkspaceTask,
  getManualCommandOption,
  extractTaskContextRefs,
  findMatchingSubmissionForTask,
} from '../../utils/taskManualCommands';

const TASK_WORK_AREAS: { value: TaskWorkArea; label: string }[] = [
  { value: 'sales_customer', label: '営業・顧客' },
  { value: 'product_development', label: '商品開発' },
  { value: 'project', label: 'プロジェクト' },
  { value: 'post_contract_support', label: '契約後支援' },
];
const TASK_SOURCE_CATEGORIES: { value: TaskSourceCategory; label: string }[] = [
  { value: 'sales_customer', label: '営業・顧客' },
  { value: 'business_operations', label: '事業運営' },
  { value: 'ai_president', label: '経営・AI社長' },
];
const TASK_KINDS: { value: TaskKind; label: string }[] = [
  { value: 'response', label: '対応' },
  { value: 'review', label: '判断・確認' },
  { value: 'creation_analysis', label: '作成・分析' },
  { value: 'recurring', label: '定期業務' },
];
const RELATED_RECORD_TYPES: { value: TaskRelatedRecordType | 'none'; label: string }[] = [
  { value: 'none', label: '関連先なし' }, { value: 'company', label: '会社' },
  { value: 'contact', label: '連絡先' }, { value: 'prospect', label: '見込み企業' },
  { value: 'lead', label: 'リード' }, { value: 'deal', label: '商談' },
  { value: 'customer', label: '顧客' }, { value: 'product', label: '商品・サービス' },
];

export interface SystemTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  company_id?: string | null;
  created_at?: string | null;
}

interface TasksViewProps {
  tasks: TaskItem[];
  projects: Project[];
  characters: CharacterConfig[];
  roleOverrides: RoleAIOverrides;
  selectedProjectId?: string | null;
  onClearProjectFilter?: () => void;
  onCreateTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (task: TaskItem) => void;
  onDeleteTask: (id: string) => Promise<void> | void;
  onDeleteCompletedTasks?: () => Promise<void> | void;
  onBatchDeleteTasks?: (taskIds: string[], reason: string) => Promise<void> | void;
  onRunTask: (task: TaskItem, options?: { signal?: AbortSignal }) => Promise<void>;
  onUploadAttachment: (taskId: string, file: File) => Promise<WorkspaceAttachment>;
  onDownloadAttachment: (attachment: WorkspaceAttachment) => Promise<Blob>;
  onDeleteAttachment: (attachment: WorkspaceAttachment) => Promise<void>;
  onOpenKnowledgeItem: (id: string) => void;
  onRequestApproval: (task: TaskItem, reason: string) => void;
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  onResolveApproval: (id: string, status: 'approved' | 'rejected', note?: string) => void;
  onDeleteApproval?: (id: string) => void;
  onBatchDeleteApprovals?: (ids: string[]) => void;
  onClearApprovals?: (statusFilter?: 'pending' | 'approved' | 'rejected' | 'all') => void;
  onDeleteActivityLog?: (id: string) => void;
  onBatchDeleteActivityLogs?: (ids: string[]) => void;
  onClearActivityLogs?: () => void;
  initialSection?: 'tasks' | 'approvals' | 'logs';
  onSectionChange?: (section: 'tasks' | 'approvals' | 'logs') => void;
  onNavigateTab?: (tab: string, options?: any) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  characters,
  roleOverrides,
  selectedProjectId,
  onClearProjectFilter,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteCompletedTasks,
  onBatchDeleteTasks,
  onRunTask,
  onUploadAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
  onOpenKnowledgeItem,
  onRequestApproval,
  approvals,
  activityLogs,
  onResolveApproval,
  onDeleteApproval,
  onBatchDeleteApprovals,
  onClearApprovals,
  onDeleteActivityLog,
  onBatchDeleteActivityLogs,
  onClearActivityLogs,
  initialSection = 'tasks',
  onSectionChange,
  onNavigateTab,
}) => {
  const [activeSection, setActiveSection] = useState<'tasks' | 'approvals' | 'logs'>(initialSection);
  useEffect(() => setActiveSection(initialSection), [initialSection]);
  const selectSection = (section: 'tasks' | 'approvals' | 'logs') => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const pendingApprovalsCount = approvals.filter((item) => item.status === 'pending').length;
  const [showAllMenus, setShowAllMenus] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mst_show_all_menus') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      try {
        setShowAllMenus(localStorage.getItem('mst_show_all_menus') === 'true');
      } catch {}
    };
    window.addEventListener('mst_menu_visibility_change', handleVisibilityChange);
    return () => window.removeEventListener('mst_menu_visibility_change', handleVisibilityChange);
  }, []);

  const showApprovalsTab = showAllMenus || pendingApprovalsCount > 0;
  const showLogsTab = showAllMenus;

  const visibleSections = [
    { id: 'tasks' as const, label: `タスク (${tasks.length})` },
    ...(showApprovalsTab ? [{ id: 'approvals' as const, label: `承認待ち・判断 (${pendingApprovalsCount})` }] : []),
    ...(showLogsTab ? [{ id: 'logs' as const, label: `活動履歴 (${activityLogs.length})` }] : []),
  ];

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === activeSection)) {
      setActiveSection('tasks');
    }
  }, [showApprovalsTab, showLogsTab, activeSection]);
  const [filterProject, setFilterProject] = useState<string>(selectedProjectId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterWorkArea, setFilterWorkArea] = useState<string>('all');
  const [filterTaskKind, setFilterTaskKind] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFocusMode, setTaskFocusMode] = useState<'all' | 'important_manual'>(() => {
    try {
      const saved = localStorage.getItem('mst_tasks_focus_mode');
      return saved === 'important_manual' ? 'important_manual' : 'all';
    } catch {
      return 'all';
    }
  });
  const [manualCommandFilter, setManualCommandFilter] = useState<ManualTaskCommandId>('all');

  const handleSelectFocusMode = (mode: 'all' | 'important_manual') => {
    setTaskFocusMode(mode);
    try {
      localStorage.setItem('mst_tasks_focus_mode', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Batch delete tasks state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [batchDeleteState, setBatchDeleteState] = useState<{
    target: 'completed' | 'pending_approval' | 'filtered' | 'selected' | 'all';
    label: string;
    taskIds: string[];
  } | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState('');

  useEffect(() => {
    setSelectedTaskIds((prev) => prev.filter((id) => tasks.some((t) => t.id === id)));
  }, [tasks]);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '');
  const [workArea, setWorkArea] = useState<TaskWorkArea>('project');
  const [sourceCategory, setSourceCategory] = useState<TaskSourceCategory>('ai_president');
  const [dueDate, setDueDate] = useState('');
  const [taskKind, setTaskKind] = useState<TaskKind>('response');
  const [relatedRecordType, setRelatedRecordType] = useState<TaskRelatedRecordType | 'none'>('none');
  const [relatedRecordId, setRelatedRecordId] = useState('');
  const [relatedRecordLabel, setRelatedRecordLabel] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('waiting');
  const [assigneeType, setAssigneeType] = useState<string>('human');
  const [completionCriteria, setCompletionCriteria] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [artifactUrl, setArtifactUrl] = useState('');
  const [runningTaskIds, setRunningTaskIds] = useState<Set<string>>(() => new Set());
  const taskRunControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [taskActionNotice, setTaskActionNotice] = useState<string | null>(null);
  const [expandedDraftTaskIds, setExpandedDraftTaskIds] = useState<Set<string>>(() => new Set());
  const [copiedDraftTaskId, setCopiedDraftTaskId] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');

  // Approval Request Modal State
  const [approvalModalTask, setApprovalModalTask] = useState<TaskItem | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [deleteTaskError, setDeleteTaskError] = useState('');

  // System Auto-Created Tasks State
  const [systemTasks, setSystemTasks] = useState<SystemTask[]>([]);
  const [systemTasksLoading, setSystemTasksLoading] = useState(false);
  const [systemTasksError, setSystemTasksError] = useState<string | null>(null);
  const [completingSystemTaskId, setCompletingSystemTaskId] = useState<string | null>(null);
  const [systemTaskActionError, setSystemTaskActionError] = useState<string | null>(null);
  const [expandedSystemTaskIds, setExpandedSystemTaskIds] = useState<Set<string>>(() => new Set());
  const [selectedSystemTaskIds, setSelectedSystemTaskIds] = useState<string[]>([]);
  const [systemDeleteConfirm, setSystemDeleteConfirm] = useState<{
    mode: 'single' | 'selected' | 'all';
    ids: string[];
    title?: string;
  } | null>(null);
  const [isBulkDeletingSystemTasks, setIsBulkDeletingSystemTasks] = useState(false);

  // Diagnosis Submission & AI Report Generation Context
  const [diagnosisSubmissions, setDiagnosisSubmissions] = useState<DiagnosisSubmissionSummary[]>([]);
  const [diagnosisFormIds, setDiagnosisFormIds] = useState<Set<string>>(() => new Set());
  const [reportVersions, setReportVersions] = useState<Record<string, number>>({});
  const [reportingSubmissionIds, setReportingSubmissionIds] = useState<string[]>([]);
  const reportControllersRef = useRef<Map<string, AbortController>>(new Map());
  const [reportNotice, setReportNotice] = useState<{ text: string; companyId?: string | null } | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      reportControllersRef.current.forEach((ctrl) => ctrl.abort());
      reportControllersRef.current.clear();
      taskRunControllersRef.current.forEach((ctrl) => ctrl.abort());
      taskRunControllersRef.current.clear();
    };
  }, []);

  const loadSubmissionReportContext = async (supabase: NonNullable<ReturnType<typeof getSupabase>>) => {
    try {
      const [subRes, formRes] = await Promise.all([
        supabase
          .from('diagnosis_submissions')
          .select('id,form_id,company_id,lead_id,diagnosis_id,status,respondent_name,respondent_company_name,respondent_email,submitted_at')
          .order('submitted_at', { ascending: false })
          .limit(150),
        supabase
          .from('diagnosis_forms')
          .select('id,name,form_type,public_slug'),
      ]);

      if (!formRes.error && Array.isArray(formRes.data)) {
        const diagIds = new Set<string>();
        formRes.data.forEach((f: any) => {
          if (f?.form_type === 'diagnosis' || f?.public_slug === 'business-diagnosis' || String(f?.name || '').includes('診断')) {
            diagIds.add(String(f.id));
          }
        });
        setDiagnosisFormIds(diagIds);
      }

      if (!subRes.error && Array.isArray(subRes.data)) {
        const loaded = subRes.data as DiagnosisSubmissionSummary[];
        setDiagnosisSubmissions(loaded);
        const diagnosisIds = Array.from(new Set(loaded.map((s) => s.diagnosis_id).filter(Boolean))) as string[];
        if (diagnosisIds.length > 0) {
          const reportRes = await supabase
            .from('ai_reports')
            .select('diagnosis_id,version')
            .in('diagnosis_id', diagnosisIds)
            .eq('is_latest', true);
          if (!reportRes.error && Array.isArray(reportRes.data)) {
            const versions: Record<string, number> = {};
            reportRes.data.forEach((row: any) => {
              versions[String(row.diagnosis_id)] = Number(row.version) || 1;
            });
            setReportVersions(versions);
          }
        } else {
          setReportVersions({});
        }
      }
    } catch {
      // ignore auxiliary metadata errors so task list remains available
    }
  };

  const loadSystemTasks = async () => {
    setSystemTasksLoading(true);
    setSystemTasksError(null);
    setSystemTaskActionError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabaseクライアントを初期化できませんでした。');
      }
      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,description,status,priority,due_date,created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }
      setSystemTasks((data || []) as SystemTask[]);
      void loadSubmissionReportContext(supabase);
    } catch (err: any) {
      setSystemTasksError(err?.message || '不明なエラー');
    } finally {
      setSystemTasksLoading(false);
    }
  };

  useEffect(() => {
    void loadSystemTasks();
  }, []);

  const handleGenerateReportFromTask = async (sub: DiagnosisSubmissionSummary, force = false) => {
    setReportingSubmissionIds((prev) => (prev.includes(sub.id) ? prev : [...prev, sub.id]));
    setReportNotice(null);
    setReportError(null);
    const controller = new AbortController();
    reportControllersRef.current.set(sub.id, controller);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/diagnosis-submissions/${encodeURIComponent(sub.id)}/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: controller.signal,
        body: JSON.stringify({ force }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'AI診断レポートを作成できませんでした。');
      }

      const displayName = sub.respondent_company_name || sub.respondent_name || '回答者';
      const targetCompanyId = result.companyId || sub.company_id;

      if (result.alreadyExists) {
        setReportVersions((prev) => ({
          ...prev,
          [String(result.diagnosisId)]: Number(result.reportVersion) || 1,
        }));
        setDiagnosisSubmissions((prev) =>
          prev.map((item) => (item.id === sub.id ? { ...item, diagnosis_id: result.diagnosisId } : item))
        );
        setReportNotice({
          text: `「${displayName}」の診断レポートは既に作成済み（v${result.reportVersion || 1}）です。書類画面で確認できます。`,
          companyId: targetCompanyId,
        });
        return;
      }

      setDiagnosisSubmissions((prev) =>
        prev.map((item) =>
          item.id === sub.id
            ? {
                ...item,
                diagnosis_id: result.diagnosisId,
                status: item.status === 'received' ? 'reviewing' : item.status,
              }
            : item
        )
      );
      setReportVersions((prev) => ({
        ...prev,
        [String(result.diagnosisId)]: Number(result.version) || 1,
      }));
      setReportNotice({
        text: `「${displayName}」のAI診断レポート（v${result.version}）を作成しました。書類画面で内容を確認・承認してください。${result.documentSynced ? '' : '（書類台帳への登録だけ失敗しました）'}`,
        companyId: targetCompanyId,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        const displayName = sub.respondent_company_name || sub.respondent_name || '回答者';
        setReportNotice({ text: `「${displayName}」のAI診断レポート作成を中断しました。` });
        return;
      }
      setReportError(err?.message || 'AI診断レポートを作成できませんでした。');
    } finally {
      reportControllersRef.current.delete(sub.id);
      setReportingSubmissionIds((prev) => prev.filter((id) => id !== sub.id));
    }
  };

  const handleCancelReportFromTask = (subId: string) => {
    const ctrl = reportControllersRef.current.get(subId);
    if (ctrl) {
      ctrl.abort();
      reportControllersRef.current.delete(subId);
    }
    setReportingSubmissionIds((prev) => prev.filter((id) => id !== subId));
  };

  const handleCompleteSystemTask = async (taskId: string) => {
    setCompletingSystemTaskId(taskId);
    setSystemTaskActionError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabaseクライアントを初期化できませんでした。');
      }
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', taskId);

      if (error) {
        throw error;
      }
      setSystemTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'done' } : t))
      );
    } catch (err: any) {
      setSystemTaskActionError(`タスクの完了更新に失敗しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setCompletingSystemTaskId(null);
    }
  };

  const [deletingSystemTaskId, setDeletingSystemTaskId] = useState<string | null>(null);

  const activeSystemTasks = systemTasks.filter((t) => t.status !== 'done' && t.status !== 'completed');

  useEffect(() => {
    setSelectedSystemTaskIds((prev) => prev.filter((id) => activeSystemTasks.some((t) => t.id === id)));
  }, [systemTasks]);

  const confirmDeleteSystemTasks = async () => {
    if (!systemDeleteConfirm || systemDeleteConfirm.ids.length === 0) return;
    const ids = systemDeleteConfirm.ids;
    if (ids.length === 1) setDeletingSystemTaskId(ids[0]);
    setIsBulkDeletingSystemTasks(true);
    setSystemTaskActionError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabaseクライアントを初期化できませんでした。');
      }
      const { error } =
        ids.length === 1
          ? await supabase.from('tasks').delete().eq('id', ids[0])
          : await supabase.from('tasks').delete().in('id', ids);

      if (error) {
        throw error;
      }
      const idSet = new Set(ids);
      setSystemTasks((prev) => prev.filter((t) => !idSet.has(t.id)));
      setSelectedSystemTaskIds((prev) => prev.filter((id) => !idSet.has(id)));
      setSystemDeleteConfirm(null);
    } catch (err: any) {
      setSystemTaskActionError(`自動起票タスクの削除に失敗しました: ${err?.message || '不明なエラー'}`);
    } finally {
      setDeletingSystemTaskId(null);
      setIsBulkDeletingSystemTasks(false);
    }
  };

  const getSystemPriorityBadge = (p?: string | null) => {
    switch (p) {
      case 'urgent':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            至急
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            高
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            中
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            低
          </span>
        );
      default:
        return p ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {p}
          </span>
        ) : null;
    }
  };

  const confirmBatchDelete = async () => {
    if (!batchDeleteState) return;
    setIsBatchDeleting(true);
    setBatchDeleteError('');
    try {
      if (onBatchDeleteTasks) {
        await onBatchDeleteTasks(batchDeleteState.taskIds, batchDeleteState.label);
      } else if (batchDeleteState.target === 'completed' && onDeleteCompletedTasks) {
        await onDeleteCompletedTasks();
      } else {
        for (const id of batchDeleteState.taskIds) {
          await onDeleteTask(id);
        }
      }
      const deletedSet = new Set(batchDeleteState.taskIds);
      setSelectedTaskIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      setBatchDeleteState(null);
    } catch (e: any) {
      setBatchDeleteError(e?.message || '一括削除に失敗しました。');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setProjectId(filterProject !== 'all' && filterProject !== 'none' ? filterProject : projects[0]?.id || '');
    setWorkArea('project');
    setSourceCategory('ai_president');
    setDueDate('');
    setTaskKind('response');
    setRelatedRecordType('none');
    setRelatedRecordId('');
    setRelatedRecordLabel('');
    setPriority('medium');
    setStatus('waiting');
    setAssigneeType('human');
    setCompletionCriteria('');
    setResultNotes('');
    setArtifactUrl('');
    setAttachmentError('');
    setIsModalOpen(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setProjectId(task.projectId || '');
    setWorkArea(task.workArea || 'project');
    setSourceCategory(task.sourceCategory || 'ai_president');
    setDueDate(task.dueDate || '');
    setTaskKind(task.taskKind || 'response');
    setRelatedRecordType(task.relatedRecord?.type || 'none');
    setRelatedRecordId(task.relatedRecord?.id || '');
    setRelatedRecordLabel(task.relatedRecord?.label || '');
    setPriority(task.priority);
    setStatus(task.status === 'completed' ? 'completed' : 'waiting');
    setCompletionCriteria(task.completionCriteria || '');
    setResultNotes(task.resultNotes || '');
    setArtifactUrl(task.artifactUrl || '');
    setAttachmentError('');

    if (task.assignee.type === 'human') setAssigneeType('human');
    else if (task.assignee.type === 'external_ai') setAssigneeType('external_ai');
    else if (task.assignee.type === 'dev_agent') setAssigneeType('dev_agent');
    else if (task.assignee.type === 'role_ai' && (task.assignee.workModeId || (task.assignee as any).roleId)) setAssigneeType(`role:${task.assignee.workModeId || (task.assignee as any).roleId}`);
    else if (task.assignee.type === 'ai_ceo') setAssigneeType('preset-ceo');
    else if (task.assignee.id) setAssigneeType(task.assignee.id);
    else setAssigneeType('human');

    setIsModalOpen(true);
  };

  const uploadTaskFiles = async (files: FileList | null) => {
    if (!editingTask || !files || files.length === 0) return;
    setIsUploadingAttachment(true);
    setAttachmentError('');
    try {
      const uploaded: WorkspaceAttachment[] = [];
      for (const file of Array.from(files)) {
        const item = await onUploadAttachment(editingTask.id, file);
        uploaded.push(item);
      }
      const nextTask: TaskItem = {
        ...editingTask,
        attachments: [...(editingTask.attachments || []), ...uploaded],
        updatedAt: Date.now(),
      };
      setEditingTask(nextTask);
      onUpdateTask(nextTask);
    } catch (e: any) {
      setAttachmentError(e?.message || 'ファイルの添付に失敗しました。');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const downloadTaskFile = async (attachment: WorkspaceAttachment) => {
    try {
      const blob = await onDownloadAttachment(attachment);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || 'ファイルのダウンロードに失敗しました。');
    }
  };

  const removeTaskFile = async (attachment: WorkspaceAttachment) => {
    if (!editingTask) return;
    try {
      await onDeleteAttachment(attachment);
      const nextTask: TaskItem = {
        ...editingTask,
        attachments: (editingTask.attachments || []).filter((item) => item.id !== attachment.id),
        updatedAt: Date.now(),
      };
      setEditingTask(nextTask);
      onUpdateTask(nextTask);
    } catch (e: any) {
      alert(e?.message || '添付ファイルの削除に失敗しました。');
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    setDeleteTaskError('');
    try {
      await onDeleteTask(taskToDelete.id);
      setTaskToDelete(null);
    } catch (e: any) {
      setDeleteTaskError(e?.message || 'タスクの削除に失敗しました。');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;

    let assignee: TaskItem['assignee'] = { type: 'human', name: '人間' };
    if (assigneeType === 'human') {
      assignee = { type: 'human', name: '人間' };
    } else if (assigneeType === 'external_ai') {
      assignee = { type: 'external_ai', name: '外部AI' };
    } else if (assigneeType === 'dev_agent') {
      assignee = { type: 'dev_agent', name: '開発エージェント' };
    } else if (assigneeType.startsWith('role:')) {
      const roleId = assigneeType.replace('role:', '');
      const mode = AI_WORK_MODES.find((m) => m.id === roleId);
      const resolved = mode ? resolveWorkMode(mode, roleOverrides) : null;
      assignee = {
        type: 'role_ai',
        workModeId: roleId,
        name: resolved ? resolved.name : '役割AI',
      };
    } else {
      const char = characters.find((c) => c.id === assigneeType);
      if (char) {
        assignee = {
          type: char.id === 'preset-ceo' ? 'ai_ceo' : 'custom_ai',
          id: char.id,
          name: char.name,
        };
      }
    }

    if (editingTask) {
      const nextStatus: TaskStatus = status === 'completed' ? 'completed' : 'waiting';
      onUpdateTask({
        ...editingTask,
        title: title.trim(),
        description: description.trim(),
        projectId,
        workArea,
        sourceCategory,
        dueDate: dueDate || undefined,
        taskKind,
        relatedRecord: relatedRecordType === 'none' ? undefined : { type: relatedRecordType, id: relatedRecordId.trim() || undefined, label: relatedRecordLabel.trim() || undefined },
        priority,
        status: nextStatus,
        completedAt: nextStatus === 'completed' ? (editingTask.completedAt || Date.now()) : undefined,
        assignee,
        completionCriteria: completionCriteria.trim(),
        resultNotes: resultNotes.trim(),
        artifactUrl: artifactUrl.trim(),
        updatedAt: Date.now(),
      });
    } else {
      onCreateTask({
        title: title.trim(),
        description: description.trim(),
        projectId,
        workArea,
        sourceCategory,
        dueDate: dueDate || undefined,
        taskKind,
        relatedRecord: relatedRecordType === 'none' ? undefined : { type: relatedRecordType, id: relatedRecordId.trim() || undefined, label: relatedRecordLabel.trim() || undefined },
        priority,
        status,
        assignee,
        completionCriteria: completionCriteria.trim(),
        resultNotes: resultNotes.trim(),
        artifactUrl: artifactUrl.trim(),
      });
    }
    setIsModalOpen(false);
  };

  const handleCopyExternalTaskRequest = async (task: TaskItem) => {
    const request = [
      `依頼: ${task.title}`,
      task.description && `依頼内容:\n${task.description}`,
      task.completionCriteria && `完了条件:\n${task.completionCriteria}`,
    ].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(request);
      alert('外部AIへの依頼文をコピーしました。');
    } catch {
      alert('依頼文をコピーできませんでした。タスク内容を手動でコピーしてください。');
    }
  };

  const handleQuickStatusChange = (task: TaskItem, newStatus: TaskStatus) => {
    if (newStatus === 'pending_approval') {
      setApprovalModalTask(task);
      setApprovalReason(`タスク「${task.title}」の完了条件を満たしたため、結果の承認を求めます。`);
      return;
    }
    const now = Date.now();
    onUpdateTask({
      ...task,
      status: newStatus,
      completedAt: newStatus === 'completed' ? (task.completedAt || now) : undefined,
      updatedAt: now,
    });
  };

  const submitApprovalRequest = () => {
    if (!approvalModalTask) return;
    onRequestApproval(approvalModalTask, approvalReason.trim() || '結果の確認と承認');
    setApprovalModalTask(null);
  };

  const runTask = async (task: TaskItem) => {
    const controller = new AbortController();
    taskRunControllersRef.current.set(task.id, controller);
    setTaskActionNotice(null);
    setRunningTaskIds((current) => new Set(current).add(task.id));
    try {
      await onRunTask(task, { signal: controller.signal });
      setExpandedDraftTaskIds((current) => new Set(current).add(task.id));
      setTaskActionNotice(`タスク「${task.title}」のAI成果物を作成しました。内容を確認し、問題なければ「完了にする」を押してください。`);
    } catch (error) {
      if ((error instanceof Error && error.name === 'AbortError') || controller.signal.aborted) {
        setTaskActionNotice(`タスク「${task.title}」のAI実行を停止しました。`);
        return;
      }
      alert(error instanceof Error ? error.message : 'AIの実行に失敗しました。');
    } finally {
      taskRunControllersRef.current.delete(task.id);
      setRunningTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  };

  const cancelRunTask = (task: TaskItem) => {
    const controller = taskRunControllersRef.current.get(task.id);
    if (controller) {
      controller.abort();
      taskRunControllersRef.current.delete(task.id);
    }
    setRunningTaskIds((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
    setTaskActionNotice(`タスク「${task.title}」のAI実行を停止しました。`);
  };

  const commandCounts = useMemo(() => {
    const counts: Record<SpecificManualTaskCommandId, number> = {
      generate_diagnosis_report: 0,
      reply_consultation: 0,
      confirm_meeting: 0,
      material_and_contract: 0,
      billing_or_warning: 0,
      general_manual: 0,
    };
    activeSystemTasks.forEach((st) => {
      const cmd = classifySystemTaskCommand(st);
      counts[cmd] += 1;
    });
    tasks.forEach((t) => {
      if (t.status === 'completed') return;
      const cmd = classifyWorkspaceTaskCommand(t);
      if (cmd) counts[cmd] += 1;
    });
    return counts;
  }, [activeSystemTasks, tasks]);

  const importantManualCount = useMemo(() => {
    const sysCount = activeSystemTasks.filter((st) => isImportantManualSystemTask(st)).length;
    const wsCount = tasks.filter((t) => isImportantManualWorkspaceTask(t)).length;
    return sysCount + wsCount;
  }, [activeSystemTasks, tasks]);

  const filteredSystemTasks = useMemo(() => {
    return activeSystemTasks.filter((st) => {
      if (taskFocusMode === 'important_manual' && !isImportantManualSystemTask(st)) {
        return false;
      }
      if (manualCommandFilter !== 'all' && classifySystemTaskCommand(st) !== manualCommandFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = st.title.toLowerCase().includes(q);
        const matchDesc = (st.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [activeSystemTasks, taskFocusMode, manualCommandFilter, searchQuery]);

  const filteredTasks = tasks.filter((t) => {
    if (taskFocusMode === 'important_manual' && !isImportantManualWorkspaceTask(t)) return false;
    if (manualCommandFilter !== 'all') {
      const cmd = classifyWorkspaceTaskCommand(t);
      if (cmd !== manualCommandFilter) return false;
    }
    if (filterProject === 'none' && t.projectId && projects.some((project) => project.id === t.projectId)) return false;
    if (filterProject !== 'all' && filterProject !== 'none' && t.projectId !== filterProject) return false;
    if (filterWorkArea !== 'all' && (t.workArea || 'project') !== filterWorkArea) return false;
    if (filterTaskKind !== 'all' && (t.taskKind || 'response') !== filterTaskKind) return false;
    if (filterStatus === 'incomplete' && t.status === 'completed') return false;
    if (filterStatus === 'completed' && t.status !== 'completed') return false;
    if (filterStatus !== 'all' && filterStatus !== 'incomplete' && filterStatus !== 'completed' && t.status !== filterStatus) return false;
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'human' && t.assignee.type !== 'human') return false;
      if (filterAssignee === 'external_ai' && t.assignee.type !== 'external_ai') return false;
      if (filterAssignee === 'ai_ceo' && t.assignee.type !== 'ai_ceo') return false;
      if (filterAssignee === 'role_ai' && t.assignee.type !== 'role_ai') return false;
      if (filterAssignee === 'dev_agent' && t.assignee.type !== 'dev_agent') return false;
      if (filterAssignee === 'custom_ai' && t.assignee.type !== 'custom_ai') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchNotes = (t.resultNotes || '').toLowerCase().includes(q);
      const matchAssignee = (t.assignee.name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchNotes && !matchAssignee) return false;
    }
    return true;
  });

  const renderCommandIcon = (cmd: SpecificManualTaskCommandId, className = 'w-3.5 h-3.5') => {
    switch (cmd) {
      case 'generate_diagnosis_report':
        return <Sparkles className={className} />;
      case 'reply_consultation':
        return <Mail className={className} />;
      case 'confirm_meeting':
        return <Calendar className={className} />;
      case 'material_and_contract':
        return <FileText className={className} />;
      case 'billing_or_warning':
        return <AlertTriangle className={className} />;
      case 'general_manual':
      default:
        return <User className={className} />;
    }
  };

  const renderManualActionButtons = (params: {
    command: SpecificManualTaskCommandId | null;
    title: string;
    description?: string | null;
    matchedSub: DiagnosisSubmissionSummary | null;
    companyId?: string | null;
    leadId?: string | null;
  }) => {
    const { command, title, description, matchedSub, companyId, leadId } = params;
    if (!command) return null;

    const refs = extractTaskContextRefs(`${title}\n${description || ''}`);
    const resolvedCompanyId = matchedSub?.company_id || companyId || refs.companyId || undefined;
    const resolvedLeadId = matchedSub?.lead_id || leadId || refs.leadId || undefined;

    if (command === 'generate_diagnosis_report') {
      if (!matchedSub) {
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() =>
                  onNavigateTab('inbox_hub', {
                    inboxChannel: 'forms',
                    context: resolvedCompanyId || resolvedLeadId ? { companyId: resolvedCompanyId, leadId: resolvedLeadId } : undefined,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer transition-colors"
                title="受信トレイの無料診断回答一覧を開いてレポートを作成します"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>診断回答を開く（レポート作成へ）</span>
              </button>
            )}
          </div>
        );
      }

      const busy = reportingSubmissionIds.includes(matchedSub.id);
      const reportVersion = matchedSub.diagnosis_id ? reportVersions[matchedSub.diagnosis_id] : undefined;
      const alreadyCreated = Boolean(reportVersion);
      const needsCompany = !matchedSub.company_id;

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {busy ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                <span>AIが作成中…</span>
              </span>
              <button
                type="button"
                onClick={() => handleCancelReportFromTask(matchedSub.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 border border-rose-200 transition cursor-pointer"
                title="レポート作成を中断します"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>停止</span>
              </button>
            </>
          ) : alreadyCreated ? (
            <>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigateTab('document_templates', {
                      context: resolvedCompanyId ? { companyId: resolvedCompanyId } : undefined,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition cursor-pointer"
                  title="作成済みのAI診断レポートを書類画面で確認・承認します"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
                  <span>作成済み（v{reportVersion}）・書類確認</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleGenerateReportFromTask(matchedSub, true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-600 border border-slate-200 transition cursor-pointer"
                title="AI診断レポートを最新版として再生成します"
              >
                <RefreshCw className="w-3 h-3" />
                <span>再生成</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={needsCompany}
              onClick={() => void handleGenerateReportFromTask(matchedSub)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              title={
                needsCompany
                  ? '会社が紐付いていません。先に「受信トレイで確認」から反響リードに登録してください'
                  : 'この診断回答からAI診断レポートを直接作成します'
              }
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI診断レポート作成</span>
            </button>
          )}
          {onNavigateTab && (
            <button
              type="button"
              onClick={() =>
                onNavigateTab('inbox_hub', {
                  inboxChannel: 'forms',
                  context: resolvedCompanyId || resolvedLeadId ? { companyId: resolvedCompanyId, leadId: resolvedLeadId } : undefined,
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer"
              title="受信トレイでフォーム回答の詳細を確認します"
            >
              <ExternalLink className="w-3 h-3 text-slate-500" />
              <span>{needsCompany ? '受信トレイで紐付け' : '回答詳細'}</span>
            </button>
          )}
        </div>
      );
    }

    if (!onNavigateTab) return null;

    if (command === 'reply_consultation') {
      return (
        <button
          type="button"
          onClick={() =>
            onNavigateTab('inbox_hub', {
              inboxChannel: 'forms',
              context: resolvedCompanyId || resolvedLeadId ? { companyId: resolvedCompanyId, leadId: resolvedLeadId } : undefined,
            })
          }
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 transition cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5 text-purple-600" />
          <span>受信トレイで返信・確認</span>
        </button>
      );
    }

    if (command === 'confirm_meeting') {
      return (
        <button
          type="button"
          onClick={() => onNavigateTab('unified_calendar')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 transition cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-purple-600" />
          <span>カレンダー・面談確認へ</span>
        </button>
      );
    }

    if (command === 'billing_or_warning') {
      const isMaterialUrlWarning = title.includes('未設定警告') || (description || '').includes('資料URL');
      return (
        <button
          type="button"
          onClick={() => onNavigateTab(isMaterialUrlWarning ? 'mst_diagnoses' : 'customer_operations')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-800 border border-rose-200 transition cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>{isMaterialUrlWarning ? '資料URL・フォーム設定へ' : '請求・顧客管理へ'}</span>
        </button>
      );
    }

    if (command === 'material_and_contract') {
      const isContractOrWin = title.includes('即時成約') || title.includes('契約締結');
      return (
        <button
          type="button"
          onClick={() =>
            isContractOrWin
              ? onNavigateTab('document_templates', {
                  context: resolvedCompanyId ? { companyId: resolvedCompanyId } : undefined,
                })
              : onNavigateTab('inbox_hub', {
                  inboxChannel: 'forms',
                  context: resolvedCompanyId || resolvedLeadId ? { companyId: resolvedCompanyId, leadId: resolvedLeadId } : undefined,
                })
          }
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200 transition cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-purple-600" />
          <span>{isContractOrWin ? '書類・契約管理へ' : '受信トレイで確認'}</span>
        </button>
      );
    }

    return null;
  };

  const getStatusBadge = (st: TaskStatus) => {
    if (st === 'completed') {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 完了
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3 h-3 text-slate-500" /> 未完了
      </span>
    );
  };

  const getAssigneeBadge = (assignee: TaskItem['assignee']) => {
    switch (assignee.type) {
      case 'human':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
            <User className="w-3 h-3 text-slate-500" /> {assignee.name}
          </span>
        );
      case 'external_ai':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
            <Bot className="w-3 h-3 text-amber-600" /> {assignee.name}
          </span>
        );
      case 'dev_agent':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Bot className="w-3 h-3 text-indigo-600" /> {assignee.name}
          </span>
        );
      case 'ai_ceo':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
            <Bot className="w-3 h-3 text-purple-600" /> {assignee.name}
          </span>
        );
      case 'role_ai':
      case 'custom_ai':
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-700 border border-purple-200">
            <Bot className="w-3 h-3 text-purple-600" /> {assignee.name}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
        <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">全社タスク・承認管理</h1>

        {activeSection === 'tasks' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void loadSystemTasks()}
              disabled={systemTasksLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium transition-all cursor-pointer"
              title="自動起票タスクを再読み込み"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${systemTasksLoading ? 'animate-spin' : ''}`} />
              <span>更新</span>
            </button>
            {tasks.some((t) => t.status === 'completed') && (
              <button
                type="button"
                onClick={() => setBatchDeleteState({
                  target: 'completed',
                  label: '完了タスク',
                  taskIds: tasks.filter((t) => t.status === 'completed').map((t) => t.id),
                })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium transition-all cursor-pointer"
                title="完了したタスクを一括削除して一覧を整理"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>完了タスク整理 ({tasks.filter((t) => t.status === 'completed').length})</span>
              </button>
            )}
            {tasks.length > 0 && (
              <button
                type="button"
                onClick={() => setBatchDeleteState({
                  target: 'all',
                  label: 'すべての通常タスク',
                  taskIds: tasks.map((t) => t.id),
                })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 text-xs font-semibold transition-all cursor-pointer"
                title="登録されている通常タスクをすべて削除"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>タスク全削除 (全{tasks.length}件)</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新規タスクを作成</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {visibleSections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => selectSection(section.id)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeSection === section.id
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'tasks' && (
        <>
          {/* 重要な手動タスク分離 ＆ 手動操作コマンド絞り込みバー */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleSelectFocusMode('important_manual')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      taskFocusMode === 'important_manual'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    重要な手動タスクのみ ({importantManualCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectFocusMode('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      taskFocusMode === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    すべて表示 ({activeSystemTasks.length + tasks.length})
                  </button>
                </div>
                {taskFocusMode === 'important_manual' && (
                  <span className="text-[11px] text-slate-500">
                    優先度「至急・高」または人手によるレポート作成・返信・確認が必要なタスクのみ表示中
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative min-w-[220px] flex-1 md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="顧客名・メール・タスク名で検索..."
                    className="w-full rounded-lg bg-white border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                {(taskFocusMode !== 'all' || manualCommandFilter !== 'all' || searchQuery.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFocusMode('all');
                      setManualCommandFilter('all');
                      setSearchQuery('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-600 cursor-pointer whitespace-nowrap"
                  >
                    条件リセット
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>手動操作コマンド:</span>
              </span>
              <button
                type="button"
                onClick={() => setManualCommandFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums border ${
                  manualCommandFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                全コマンド
              </button>
              {MANUAL_COMMAND_OPTIONS.map((opt) => {
                const count = commandCounts[opt.id] || 0;
                const active = manualCommandFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setManualCommandFilter(active ? 'all' : opt.id)}
                    title={opt.description}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap tabular-nums border ${
                      active
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {renderCommandIcon(opt.id, `w-3.5 h-3.5 ${active ? 'text-white' : opt.id === 'generate_diagnosis_report' ? 'text-emerald-600' : opt.id === 'billing_or_warning' ? 'text-rose-600' : 'text-slate-500'}`)}
                    <span>{opt.label}</span>
                    <span className={`text-[10px] font-mono ${active ? 'text-purple-100' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* AI診断レポート作成の通知・エラーバナー */}
          {reportNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{reportNotice.text}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateTab('document_templates', {
                        context: reportNotice.companyId ? { companyId: reportNotice.companyId } : undefined,
                      })
                    }
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer transition-colors"
                  >
                    書類を確認する
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setReportNotice(null)}
                  className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {reportError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between gap-2">
              <span className="font-medium">{reportError}</span>
              <button
                type="button"
                onClick={() => setReportError(null)}
                className="p-1 text-rose-600 hover:text-rose-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* システム自動起票枠 */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-600 text-white">
                  <Bot className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 tabular-nums">
                  <span>システム自動起票</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {filteredSystemTasks.length !== activeSystemTasks.length
                      ? `${filteredSystemTasks.length} / ${activeSystemTasks.length}件`
                      : `${activeSystemTasks.length}件`}
                  </span>
                </h2>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  支払督促 · 資料URL警告 · 診断レポート作成 · Web相談返信 · TimeRex面談確認
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedSystemTaskIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSystemDeleteConfirm({
                      mode: 'selected',
                      ids: selectedSystemTaskIds,
                    })}
                    disabled={isBulkDeletingSystemTasks}
                    className="flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white transition cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>選択削除 ({selectedSystemTaskIds.length}件)</span>
                  </button>
                )}
                {activeSystemTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSystemDeleteConfirm({
                      mode: 'all',
                      ids: activeSystemTasks.map((t) => t.id),
                    })}
                    disabled={isBulkDeletingSystemTasks}
                    className="flex items-center gap-1 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                    title="未完了の自動起票タスクをすべて削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>全削除 ({activeSystemTasks.length}件)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void loadSystemTasks()}
                  disabled={systemTasksLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                  title="自動起票タスクを再読み込み"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${systemTasksLoading ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
                  <span>更新</span>
                </button>
              </div>
            </div>

            {/* 読み込み失敗エラー */}
            {systemTasksError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs font-medium flex items-center justify-between">
                <span>自動起票タスクを読み込めませんでした: {systemTasksError}</span>
                <button
                  type="button"
                  onClick={() => void loadSystemTasks()}
                  className="text-xs text-rose-700 underline font-semibold hover:text-rose-900 cursor-pointer ml-2 shrink-0"
                >
                  再読み込み
                </button>
              </div>
            )}

            {/* アクション更新エラー */}
            {systemTaskActionError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs font-medium flex items-center justify-between">
                <span>{systemTaskActionError}</span>
                <button
                  type="button"
                  onClick={() => setSystemTaskActionError(null)}
                  className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 一覧 */}
            {systemTasksLoading && systemTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span>自動起票タスクを確認中…</span>
              </div>
            ) : filteredSystemTasks.length === 0 ? (
              <div className="py-3 px-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 text-center">
                {activeSystemTasks.length === 0
                  ? '現在、対応が必要な未完了のシステム自動起票タスクはありません。'
                  : '現在の絞り込み条件に一致するシステム自動起票タスクはありません。'}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filteredSystemTasks.length > 0 && filteredSystemTasks.every((t) => selectedSystemTaskIds.includes(t.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSystemTaskIds(filteredSystemTasks.map((t) => t.id));
                        } else {
                          setSelectedSystemTaskIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>表示中の自動起票タスク全{filteredSystemTasks.length}件を選択</span>
                  </label>
                  {selectedSystemTaskIds.length > 0 && (
                    <span className="text-purple-700 font-bold">{selectedSystemTaskIds.length}件選択中</span>
                  )}
                </div>
                {filteredSystemTasks.map((st) => {
                  const isSysSelected = selectedSystemTaskIds.includes(st.id);
                  const sysCommand = classifySystemTaskCommand(st);
                  const sysCmdMeta = getManualCommandOption(sysCommand);
                  const matchedSub =
                    sysCommand === 'generate_diagnosis_report' || sysCommand === 'reply_consultation' || sysCommand === 'material_and_contract'
                      ? findMatchingSubmissionForTask({
                          systemTask: st,
                          submissions: diagnosisSubmissions,
                          diagnosisFormIds,
                          preferDiagnosisOnly: sysCommand === 'generate_diagnosis_report',
                        })
                      : null;

                  return (
                  <div
                    key={st.id}
                    className={`p-3 sm:p-4 rounded-xl bg-white border transition-all space-y-2.5 ${
                      isSysSelected ? 'border-purple-400 bg-purple-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 tabular-nums">
                        <input
                          type="checkbox"
                          checked={isSysSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSystemTaskIds((prev) => (prev.includes(st.id) ? prev : [...prev, st.id]));
                            } else {
                              setSelectedSystemTaskIds((prev) => prev.filter((id) => id !== st.id));
                            }
                          }}
                          aria-label={`選択 ${st.title}`}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                        />
                        {getSystemPriorityBadge(st.priority)}
                        {sysCmdMeta && (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            {renderCommandIcon(sysCommand, 'w-3 h-3 text-slate-500')}
                            <span>{sysCmdMeta.shortLabel}</span>
                          </span>
                        )}
                        {st.due_date && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>期限: {st.due_date}</span>
                          </>
                        )}
                        {st.created_at && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              作成: {new Date(st.created_at).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                        <button
                          type="button"
                          onClick={() => void handleCompleteSystemTask(st.id)}
                          disabled={completingSystemTaskId === st.id || deletingSystemTaskId === st.id || isBulkDeletingSystemTasks}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                          title="このタスクを完了状態に更新します"
                        >
                          {completingSystemTaskId === st.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          )}
                          <span>完了にする</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSystemDeleteConfirm({ mode: 'single', ids: [st.id], title: st.title })}
                          disabled={completingSystemTaskId === st.id || deletingSystemTaskId === st.id || isBulkDeletingSystemTasks}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                          title="この自動起票タスクを削除します"
                        >
                          {deletingSystemTaskId === st.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          <span>削除</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        {st.title}
                      </h3>

                      {/* 直接実行できる手動操作コマンド */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {renderManualActionButtons({
                          command: sysCommand,
                          title: st.title,
                          description: st.description,
                          matchedSub,
                          companyId: st.company_id,
                        })}
                      </div>

                      {st.description && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedSystemTaskIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(st.id)) next.delete(st.id);
                                else next.add(st.id);
                                return next;
                              });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 cursor-pointer"
                          >
                            <span>{expandedSystemTaskIds.has(st.id) ? '説明を閉じる' : '説明を表示'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedSystemTaskIds.has(st.id) ? 'rotate-180' : ''}`} />
                          </button>

                          {expandedSystemTaskIds.has(st.id) && (
                            <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                              {st.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
          {/* 通常・業務タスク（詳細絞り込み） */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-xs font-bold text-slate-800 mr-1 tabular-nums">
              業務タスク ({filteredTasks.length} / {tasks.length}件)
            </span>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-semibold">状態:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="all">すべて ({tasks.length})</option>
                <option value="incomplete">未完了 ({tasks.filter(t => t.status !== 'completed').length})</option>
                <option value="completed">完了 ({tasks.filter(t => t.status === 'completed').length})</option>
              </select>
            </div>

            {/* Project selector */}
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <span className="text-slate-500 text-[11px] font-semibold">PJ:</span>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="all">全プロジェクト</option>
                <option value="none">プロジェクト未設定</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Work area */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-semibold">領域:</span>
              <select
                value={filterWorkArea}
                onChange={(e) => setFilterWorkArea(e.target.value)}
                className="rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="all">すべての領域</option>
                {TASK_WORK_AREAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

            {/* Assignee Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-semibold">担当:</span>
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="all">全担当</option>
                <option value="human">👤 人間 (あなた)</option>
                <option value="external_ai">🌐 外部AI（手動依頼）</option>
                <option value="ai_ceo">👔 AI社長</option>
                <option value="role_ai">🧭 役割AI</option>
                <option value="dev_agent">⚙️ 開発エージェント</option>
                <option value="custom_ai">🤖 登録専門AI</option>
              </select>
            </div>

            {filteredTasks.length > 0 && (filterStatus !== 'all' || filterProject !== 'all' || filterWorkArea !== 'all' || filterTaskKind !== 'all' || filterAssignee !== 'all') && (
              <button
                type="button"
                onClick={() => setBatchDeleteState({
                  target: 'filtered',
                  label: '条件絞り込み中のタスク',
                  taskIds: filteredTasks.map((t) => t.id),
                })}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-[11px] font-medium transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3 h-3" />
                <span>絞り込み中の{filteredTasks.length}件を一括削除</span>
              </button>
            )}

            {selectedProjectId && (
              <button
                type="button"
                onClick={() => {
                  setFilterProject('all');
                  if (onClearProjectFilter) onClearProjectFilter();
                }}
                className="ml-auto text-purple-600 hover:text-purple-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                プロジェクト絞り込みを解除
              </button>
            )}
          </div>

          {/* Selection Toolbar for Regular Tasks */}
          {filteredTasks.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-2xs">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedTaskIds.includes(t.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTaskIds(filteredTasks.map((t) => t.id));
                    } else {
                      setSelectedTaskIds([]);
                    }
                  }}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span>表示中の通常タスク全{filteredTasks.length}件を選択</span>
              </label>
              {selectedTaskIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-700">{selectedTaskIds.length}件選択中</span>
                  <button
                    type="button"
                    onClick={() => setBatchDeleteState({
                      target: 'selected',
                      label: '選択したタスク',
                      taskIds: selectedTaskIds,
                    })}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>選択削除 ({selectedTaskIds.length}件)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {taskActionNotice && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs text-purple-900 flex items-center justify-between gap-2">
              <span className="font-medium">{taskActionNotice}</span>
              <button
                type="button"
                onClick={() => setTaskActionNotice(null)}
                className="p-1 text-purple-500 hover:text-purple-800 cursor-pointer"
                aria-label="通知を閉じる"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            filteredSystemTasks.length > 0 && (taskFocusMode !== 'all' || manualCommandFilter !== 'all' || searchQuery.trim() !== '') ? (
              <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                現在の絞り込み条件に一致する通常・業務タスクはありません（上の「システム自動起票」に表示されています）。
              </div>
            ) : (
              <div className="p-10 rounded-xl bg-white border border-slate-200 text-center space-y-3">
                <CheckSquare className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">該当するタスクがありません</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  条件を変更するか、右上の「新規タスクを作成」ボタンからタスクを登録してください。
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新しいタスクを登録する</span>
                </button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const isTaskSelected = selectedTaskIds.includes(task.id);
                const wsCommand = classifyWorkspaceTaskCommand(task);
                const wsCmdMeta = getManualCommandOption(wsCommand);
                const wsMatchedSub =
                  wsCommand === 'generate_diagnosis_report' || wsCommand === 'reply_consultation' || wsCommand === 'material_and_contract'
                    ? findMatchingSubmissionForTask({
                        workspaceTask: task,
                        submissions: diagnosisSubmissions,
                        diagnosisFormIds,
                        preferDiagnosisOnly: wsCommand === 'generate_diagnosis_report',
                      })
                    : null;

                return (
                  <div
                    key={task.id}
                    className={`p-4 sm:p-5 rounded-xl bg-white border transition-all space-y-3 group ${
                      isTaskSelected ? 'border-purple-400 bg-purple-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={isTaskSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaskIds((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]));
                            } else {
                              setSelectedTaskIds((prev) => prev.filter((id) => id !== task.id));
                            }
                          }}
                          aria-label={`選択 ${task.title}`}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                        />
                        {getStatusBadge(task.status)}
                        {getAssigneeBadge(task.assignee)}
                        {wsCmdMeta && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                            {renderCommandIcon(wsCommand!, 'w-3 h-3 text-slate-500')}
                            <span>{wsCmdMeta.shortLabel}</span>
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          {TASK_WORK_AREAS.find((item) => item.value === (task.workArea || 'project'))?.label || 'プロジェクト'}
                          {' · '}
                          {TASK_KINDS.find((item) => item.value === (task.taskKind || 'response'))?.label || '対応'}
                        </span>
                        {task.dueDate && (
                          <span className={`text-[11px] font-semibold tabular-nums ${
                            task.dueDate < todayJst() && task.status !== 'completed'
                              ? 'text-rose-700'
                              : 'text-slate-500'
                          }`}>
                            期限: {task.dueDate}
                          </span>
                        )}
                        {task.relatedRecord?.label && (
                          <span className="text-[11px] font-medium text-purple-700">
                            関連: {task.relatedRecord.label}
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-bold ${
                            task.priority === 'high'
                              ? 'text-rose-700'
                              : task.priority === 'medium'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          優先度: {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                        </span>
                        {project && (
                          <span className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                            <Briefcase className="w-3 h-3 text-purple-600" />
                            {project.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => openEditModal(task)}
                          title="編集"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 cursor-pointer transition-colors text-[11px] font-medium"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>編集</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskToDelete(task)}
                          title="削除"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer transition-colors text-[11px] font-medium"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>削除</span>
                        </button>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <div className="flex items-center gap-2">
                        {task.draftArtifact || task.knowledgeItemId ? (
                          <button
                            type="button"
                            aria-expanded={task.draftArtifact ? expandedDraftTaskIds.has(task.id) : undefined}
                            onClick={() => {
                              if (task.draftArtifact) {
                                setExpandedDraftTaskIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(task.id)) next.delete(task.id);
                                  else next.add(task.id);
                                  return next;
                                });
                              } else if (task.knowledgeItemId) {
                                onOpenKnowledgeItem(task.knowledgeItemId);
                              }
                            }}
                            className="flex items-center gap-1.5 text-left text-sm sm:text-base font-bold text-slate-900 hover:text-purple-700 cursor-pointer transition-colors"
                          >
                            <span>{task.title}</span>
                            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {task.draftArtifact
                                ? expandedDraftTaskIds.has(task.id) ? '成果物を閉じる' : '成果物を確認'
                                : '保存済み成果物を開く'}
                            </span>
                            {task.draftArtifact ? (
                              <ChevronDown className={`w-4 h-4 text-purple-600 transition-transform ${expandedDraftTaskIds.has(task.id) ? 'rotate-180' : ''}`} />
                            ) : (
                              <ArrowRight className="w-4 h-4 text-purple-600" />
                            )}
                          </button>
                        ) : (
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">{task.title}</h3>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                      {wsCommand && wsCommand !== 'general_manual' && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {renderManualActionButtons({
                            command: wsCommand,
                            title: task.title,
                            description: task.description,
                            matchedSub: wsMatchedSub,
                            companyId:
                              task.relatedRecord?.type === 'company' || task.relatedRecord?.type === 'customer'
                                ? task.relatedRecord.id
                                : undefined,
                            leadId: task.relatedRecord?.type === 'lead' ? task.relatedRecord.id : undefined,
                          })}
                        </div>
                      )}
                      {task.assignee.type === 'external_ai' && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopyExternalTaskRequest(task)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                          >
                            <ClipboardCopy className="h-3 w-3" />
                            <span>外部AIへの依頼文をコピー</span>
                          </button>
                          <span className="text-[10px] text-slate-400">回答は成果・メモへ貼り付けるか、タスクを編集してファイル添付</span>
                        </div>
                      )}
                      {task.draftArtifact && expandedDraftTaskIds.has(task.id) && (
                        <section className="mt-3 rounded-xl border border-purple-200 bg-purple-50/30 overflow-hidden">
                          <div className="px-3 py-2 border-b border-purple-200 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-purple-900">AI作成の成果物</span>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(task.draftArtifact?.content || '');
                                setCopiedDraftTaskId(task.id);
                                window.setTimeout(() => setCopiedDraftTaskId((prev) => (prev === task.id ? null : prev)), 2000);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-purple-50 text-[11px] font-semibold text-purple-700 border border-purple-200 cursor-pointer"
                            >
                              <ClipboardCopy className="w-3 h-3" />
                              <span>{copiedDraftTaskId === task.id ? 'コピー済み' : '内容をコピー'}</span>
                            </button>
                          </div>
                          <div className="max-h-[520px] overflow-y-auto p-4 text-sm text-slate-800 bg-white font-mono whitespace-pre-wrap break-words">
                            {task.draftArtifact.content}
                          </div>
                          <p className="px-3 py-2 border-t border-purple-100 text-[11px] text-slate-600">
                            内容を確認し、問題なければ「完了にする」を押してください（完了時にナレッジへ自動保存されます）。
                          </p>
                        </section>
                      )}
                    </div>

                    {/* Completion Criteria & Result Notes */}
                    {(task.completionCriteria || task.resultNotes || task.artifactUrl || task.knowledgeItemId || task.attachments?.length) && (
                      <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs space-y-1.5">
                        {task.completionCriteria && (
                          <div className="flex items-start gap-1.5 text-slate-700">
                            <span className="font-bold text-purple-700 shrink-0">完了条件:</span>
                            <span>{task.completionCriteria}</span>
                          </div>
                        )}
                        {task.resultNotes && (
                          <div className="flex items-start gap-1.5 text-slate-700">
                            <span className="font-bold text-emerald-700 shrink-0">成果・メモ:</span>
                            <span>{task.resultNotes}</span>
                          </div>
                        )}
                        {task.knowledgeItemId && (
                          <button
                            type="button"
                            onClick={() => onOpenKnowledgeItem(task.knowledgeItemId!)}
                            className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:underline block"
                          >
                            保存した成果物をナレッジで開く →
                          </button>
                        )}
                        {task.artifactUrl && (
                          <a
                            href={task.artifactUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            外部成果物を開く →
                          </a>
                        )}
                        {!!task.attachments?.length && (
                          <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                            <p className="text-[10px] font-semibold text-slate-500">タスク添付ファイル</p>
                            {task.attachments.map((attachment) => (
                              <button
                                key={attachment.id}
                                type="button"
                                onClick={() => void downloadTaskFile(attachment)}
                                className="flex max-w-full items-center gap-1.5 text-left text-[11px] font-semibold text-purple-700 hover:text-purple-800"
                              >
                                <Download className="h-3 w-3 shrink-0" />
                                <span className="truncate">{attachment.fileName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Actions: Manual AI Request (+ Immediate Stop) & 1-Click Completion */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        更新: {new Date(task.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.status !== 'completed' ? (
                          <>
                            {(task.assignee.type === 'role_ai' || task.assignee.type === 'ai_ceo' || task.assignee.type === 'custom_ai') && (
                              runningTaskIds.has(task.id) ? (
                                <>
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-semibold">
                                    <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                                    <span>AIが実行中…</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => cancelRunTask(task)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer transition-colors"
                                    title="AIの実行をその場で停止します"
                                  >
                                    <Square className="w-3 h-3 fill-current" />
                                    <span>停止</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void runTask(task)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold cursor-pointer shadow-2xs transition-colors"
                                >
                                  <Bot className="w-3 h-3" />
                                  <span>{task.draftArtifact ? 'AIに再依頼' : '担当AIに依頼'}</span>
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(task, 'completed')}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>完了にする</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(task, 'waiting')}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium cursor-pointer transition-colors"
                          >
                            未完了に戻す
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create / Edit Task Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
              <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-purple-600" />
                    <span>{editingTask ? 'タスクを編集' : '新規タスク作成'}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4 sm:px-6 text-xs text-slate-700">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      タスク名 <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="例: コア機能の要件定義書を作成"
                      className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      関連プロジェクト <span className="text-slate-400">任意</span>
                    </label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
                    >
                      <option value="">プロジェクトに紐付けない</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-800">発生カテゴリー
                      <select value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as TaskSourceCategory)} className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs">
                        {TASK_SOURCE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-800">期限
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-800">仕事の領域
                      <select value={workArea} onChange={(e) => setWorkArea(e.target.value as TaskWorkArea)} className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs">
                        {TASK_WORK_AREAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-800">作業の種類
                      <select value={taskKind} onChange={(e) => setTaskKind(e.target.value as TaskKind)} className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs">
                        {TASK_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                    <label className="block text-xs font-semibold text-slate-800">関連するCRMレコード／商品
                      <select value={relatedRecordType} onChange={(e) => setRelatedRecordType(e.target.value as TaskRelatedRecordType | 'none')} className="mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs">
                        {RELATED_RECORD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                    {relatedRecordType !== 'none' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input value={relatedRecordLabel} onChange={(e) => setRelatedRecordLabel(e.target.value)} placeholder="関連先の名前" className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-2xs" />
                        <input value={relatedRecordId} onChange={(e) => setRelatedRecordId(e.target.value)} placeholder="レコードID（自動連携用）" className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-2xs" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      説明・実施目的
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={assigneeType === 'external_ai' ? '外部AIへ依頼する内容を記載（機密情報は含めない）' : 'タスクの具体的な背景や目的を記載'}
                      className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        担当の割り当て
                      </label>
                      <select
                        value={assigneeType}
                        onChange={(e) => setAssigneeType(e.target.value)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
                      >
                        <option value="human">👤 人間 (あなた)</option>
                        <option value="external_ai">🌐 外部AI（手動依頼）</option>
                        <option value="dev_agent">⚙️ 開発エージェント</option>
                        <optgroup label="役割AI">
                          {AI_WORK_MODES.map((mode) => {
                            const resolved = resolveWorkMode(mode, roleOverrides);
                            return <option key={mode.id} value={`role:${mode.id}`}>{resolved.avatarEmoji} {resolved.name}（{resolved.label}）</option>;
                          })}
                        </optgroup>
                        <optgroup label="登録済みAI">
                          {characters
                            .filter((c) => c.id !== 'preset-ceo')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.avatarEmoji || '🤖'} {c.name} ({c.role})
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        状態
                      </label>
                      <select
                        value={status === 'completed' ? 'completed' : 'waiting'}
                        onChange={(e) => setStatus(e.target.value as TaskStatus)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
                      >
                        <option value="waiting">未完了</option>
                        <option value="completed">完了</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        優先度
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Priority)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
                      >
                        <option value="high">高 (High)</option>
                        <option value="medium">中 (Medium)</option>
                        <option value="low">低 (Low)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        完了条件
                      </label>
                      <input
                        type="text"
                        value={completionCriteria}
                        onChange={(e) => setCompletionCriteria(e.target.value)}
                        placeholder="何ができたら完了か"
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      成果・メモ
                    </label>
                    <textarea
                      rows={2}
                      value={resultNotes}
                      onChange={(e) => setResultNotes(e.target.value)}
                      placeholder="実行結果、成果物へのリンク、留意点など"
                      className="w-full rounded-xl bg-white border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">外部成果物URL（Drive等）</label>
                    <input
                      type="url"
                      value={artifactUrl}
                      onChange={(e) => setArtifactUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800">タスク添付ファイル</label>
                        <p className="mt-1 text-[11px] text-slate-500">Supabaseに非公開保存。1ファイル20MBまで。</p>
                      </div>
                      {editingTask ? (
                        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-2xs ${isUploadingAttachment ? 'pointer-events-none opacity-50' : ''}`}>
                          {isUploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin text-purple-600" /> : <Paperclip className="h-4 w-4 text-purple-600" />}
                          {isUploadingAttachment ? 'アップロード中…' : 'ファイルを添付'}
                          <input type="file" multiple className="hidden" disabled={isUploadingAttachment} onChange={(event) => { void uploadTaskFiles(event.target.files); event.currentTarget.value = ''; }} />
                        </label>
                      ) : (
                        <span className="text-[11px] text-slate-400">タスク作成後、編集画面から添付できます。</span>
                      )}
                    </div>
                    {(editingTask?.attachments || []).map((attachment) => (
                      <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-2xs">
                        <span className="min-w-0 truncate text-xs text-slate-700">{attachment.fileName} <span className="text-slate-400">({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span></span>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => void downloadTaskFile(attachment)} className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"><Download className="h-3.5 w-3.5" />保存</button>
                          <button type="button" onClick={() => void removeTaskFile(attachment)} className="text-xs text-rose-600 hover:text-rose-700 font-medium">削除</button>
                        </div>
                      </div>
                    ))}
                    {attachmentError && <p role="alert" className="text-xs text-rose-600">{attachmentError}</p>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6">
                  {editingTask ? (
                    <button
                      type="button"
                      onClick={() => {
                        const toDelete = editingTask;
                        setIsModalOpen(false);
                        setTaskToDelete(toDelete);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>このタスクを削除</span>
                    </button>
                  ) : <div />}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {editingTask ? '変更を保存' : 'タスクを作成'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Approval Request Dialog */}
          {approvalModalTask && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>承認申請を作成</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setApprovalModalTask(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500">対象タスク:</div>
                    <div className="text-sm font-bold text-slate-900">{approvalModalTask.title}</div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      申請理由・承認を求める内容
                    </label>
                    <textarea
                      rows={3}
                      value={approvalReason}
                      onChange={(e) => setApprovalReason(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setApprovalModalTask(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={submitApprovalRequest}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    承認申請を提出
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation modal */}
          {taskToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <h2 className="text-base font-bold text-slate-900">タスクを削除しますか？</h2>
                <p className="mt-3 text-sm text-slate-600">「{taskToDelete.title}」とタスクに添付したファイルを削除します。紐づく承認待ち記録も合わせて整理されます。</p>
                {deleteTaskError && <p role="alert" className="mt-3 text-xs text-rose-600">{deleteTaskError}</p>}
                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" disabled={isDeletingTask} onClick={() => setTaskToDelete(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">キャンセル</button>
                  <button type="button" disabled={isDeletingTask} onClick={() => void confirmDeleteTask()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs">{isDeletingTask ? '削除中…' : '削除する'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Batch delete confirmation modal */}
          {batchDeleteState && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                  <span>{batchDeleteState.label}の一括削除</span>
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  対象のタスク（全{batchDeleteState.taskIds.length}件）を一括削除します。
                  <br />
                  タスクに添付されたファイルや関連する承認待ち記録も合わせて整理されます。この操作は取り消せません。実行しますか？
                </p>
                {batchDeleteError && <p role="alert" className="text-xs text-rose-600">{batchDeleteError}</p>}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isBatchDeleting}
                    onClick={() => setBatchDeleteState(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    disabled={isBatchDeleting}
                    onClick={() => void confirmBatchDelete()}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isBatchDeleting ? '削除中…' : '一括削除する'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* System tasks delete confirmation modal */}
          {systemDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                  <span>
                    {systemDeleteConfirm.mode === 'single'
                      ? '自動起票タスクの削除'
                      : systemDeleteConfirm.mode === 'selected'
                      ? '選択した自動起票タスクの削除'
                      : '自動起票タスクの全削除'}
                  </span>
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {systemDeleteConfirm.mode === 'single'
                    ? `自動起票タスク「${systemDeleteConfirm.title || ''}」を削除します。`
                    : systemDeleteConfirm.mode === 'selected'
                    ? `選択中の自動起票タスク（${systemDeleteConfirm.ids.length}件）を一括削除します。`
                    : `未完了のシステム自動起票タスク（全${systemDeleteConfirm.ids.length}件）をすべて削除します。`}
                  <br />
                  この操作は取り消せません。実行しますか？
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isBulkDeletingSystemTasks}
                    onClick={() => setSystemDeleteConfirm(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    disabled={isBulkDeletingSystemTasks}
                    onClick={() => void confirmDeleteSystemTasks()}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isBulkDeletingSystemTasks ? '削除中…' : '削除を実行'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(activeSection === 'approvals' || activeSection === 'logs') && (
        <ApprovalsView
          tasks={tasks}
          approvals={approvals}
          activityLogs={activityLogs}
          onResolveApproval={onResolveApproval}
          onDeleteApproval={onDeleteApproval}
          onBatchDeleteApprovals={onBatchDeleteApprovals}
          onClearApprovals={onClearApprovals}
          onDeleteActivityLog={onDeleteActivityLog}
          onBatchDeleteActivityLogs={onBatchDeleteActivityLogs}
          onClearActivityLogs={onClearActivityLogs}
          initialTab={activeSection === 'logs' ? 'logs' : 'approvals'}
          embedded
        />
      )}
    </div>
  );
};
