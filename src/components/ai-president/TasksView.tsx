import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
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
  onRunTask: (task: TaskItem) => Promise<void>;
  onUploadAttachment: (taskId: string, file: File) => Promise<WorkspaceAttachment>;
  onDownloadAttachment: (attachment: WorkspaceAttachment) => Promise<Blob>;
  onDeleteAttachment: (attachment: WorkspaceAttachment) => Promise<void>;
  onOpenKnowledgeItem: (id: string) => void;
  onRequestApproval: (task: TaskItem, reason: string) => void;
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  onResolveApproval: (id: string, status: 'approved' | 'rejected', note?: string) => void;
  onDeleteApproval?: (id: string) => void;
  onClearApprovals?: (statusFilter?: 'pending' | 'approved' | 'rejected' | 'all') => void;
  onDeleteActivityLog?: (id: string) => void;
  onClearActivityLogs?: () => void;
  initialSection?: 'tasks' | 'approvals' | 'logs';
  onSectionChange?: (section: 'tasks' | 'approvals' | 'logs') => void;
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
  onClearApprovals,
  onDeleteActivityLog,
  onClearActivityLogs,
  initialSection = 'tasks',
  onSectionChange,
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Batch delete tasks state
  const [batchDeleteState, setBatchDeleteState] = useState<{
    target: 'completed' | 'pending_approval' | 'filtered' | 'all';
    label: string;
    taskIds: string[];
  } | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState('');

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
  const [expandedDraftTaskIds, setExpandedDraftTaskIds] = useState<Set<string>>(() => new Set());
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');

  // Approval Request Modal State
  const [approvalModalTask, setApprovalModalTask] = useState<TaskItem | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [deleteTaskError, setDeleteTaskError] = useState('');

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
    setStatus(task.status);
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
      let nextStatus = status;
      if (status === 'completed' && assignee.type !== 'human' && assignee.type !== 'external_ai') {
        nextStatus = editingTask.status === 'completed' ? 'in_progress' : editingTask.status;
      }
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
    if (newStatus === 'completed' && task.assignee.type !== 'human' && task.assignee.type !== 'external_ai') return;
    if (newStatus === 'completed' && task.assignee.type === 'external_ai' && !task.resultNotes?.trim() && !task.artifactUrl && !task.attachments?.length) {
      alert('外部AIの回答を成果メモに貼り付けるか、成果物を添付してから完了にしてください。');
      return;
    }
    if (newStatus === 'pending_approval') {
      setApprovalModalTask(task);
      setApprovalReason(`タスク「${task.title}」の完了条件を満たしたため、結果の承認を求めます。`);
      return;
    }
    onUpdateTask({
      ...task,
      status: newStatus,
      updatedAt: Date.now(),
    });
  };

  const submitApprovalRequest = () => {
    if (!approvalModalTask) return;
    onRequestApproval(approvalModalTask, approvalReason.trim() || '結果の確認と承認');
    setApprovalModalTask(null);
  };

  const runTask = async (task: TaskItem) => {
    setRunningTaskIds((current) => new Set(current).add(task.id));
    try {
      await onRunTask(task);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'AIの実行に失敗しました。');
    } finally {
      setRunningTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterProject === 'none' && t.projectId && projects.some((project) => project.id === t.projectId)) return false;
    if (filterProject !== 'all' && filterProject !== 'none' && t.projectId !== filterProject) return false;
    if (filterWorkArea !== 'all' && (t.workArea || 'project') !== filterWorkArea) return false;
    if (filterTaskKind !== 'all' && (t.taskKind || 'response') !== filterTaskKind) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
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

  const getStatusBadge = (st: TaskStatus) => {
    switch (st) {
      case 'waiting':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" /> 待機中
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> 進行中
          </span>
        );
      case 'pending_approval':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <ShieldCheck className="w-3 h-3 text-amber-600" /> 承認待ち
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 完了
          </span>
        );
      case 'blocked':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> 問題あり
          </span>
        );
    }
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
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
            {/* Search input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="タスク名、メモ、担当者で検索..."
                className="w-full rounded-xl bg-white border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-semibold">状態:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
              >
                <option value="all">すべて ({tasks.length})</option>
                <option value="waiting">待機中 ({tasks.filter(t => t.status === 'waiting').length})</option>
                <option value="in_progress">進行中 ({tasks.filter(t => t.status === 'in_progress').length})</option>
                <option value="pending_approval">承認待ち ({tasks.filter(t => t.status === 'pending_approval').length})</option>
                <option value="completed">完了 ({tasks.filter(t => t.status === 'completed').length})</option>
                <option value="blocked">問題あり ({tasks.filter(t => t.status === 'blocked').length})</option>
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

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
              <CheckSquare className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">該当するタスクがありません</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                条件を変更するか、右上の「新規タスクを作成」ボタンからタスクを登録してください。
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新しいタスクを登録する</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);

                return (
                  <div
                    key={task.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 transition-all space-y-3 shadow-xs group"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(task.status)}
                        {getAssigneeBadge(task.assignee)}
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200 font-medium">
                          {TASK_WORK_AREAS.find((item) => item.value === (task.workArea || 'project'))?.label || 'プロジェクト'}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200 font-medium">
                          {TASK_KINDS.find((item) => item.value === (task.taskKind || 'response'))?.label || '対応'}
                        </span>
                        {task.dueDate && (
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            task.dueDate < todayJst() && task.status !== 'completed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            期限: {task.dueDate}
                          </span>
                        )}
                        {task.relatedRecord?.label && (
                          <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[10px] font-medium">
                            関連: {task.relatedRecord.label}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            task.priority === 'high'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : task.priority === 'medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          優先度: {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                        </span>
                        {project && (
                          <span className="text-[11px] text-slate-600 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-medium">
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTaskToDelete(task)}
                          title="削除"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                          <div className="px-3 py-2 border-b border-purple-200 text-xs font-bold text-purple-900">
                            レビュー用成果物（承認前）
                          </div>
                          <div className="max-h-[520px] overflow-y-auto p-4 text-sm text-slate-800 bg-white font-mono whitespace-pre-wrap break-words">
                            {task.draftArtifact.content}
                          </div>
                          <p className="px-3 py-2 border-t border-purple-100 text-[11px] text-slate-500">
                            承認画面で確認・承認するとナレッジに登録されます。
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

                    {/* Bottom Quick Status Transition Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-400">
                        更新: {new Date(task.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-slate-400 mr-1">状態変更:</span>
                        {task.status !== 'pending_approval' && (task.assignee.type === 'role_ai' || task.assignee.type === 'ai_ceo' || task.assignee.type === 'custom_ai') && (
                          <button
                            type="button"
                            disabled={runningTaskIds.has(task.id)}
                            onClick={() => void runTask(task)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer shadow-2xs transition-colors"
                          >
                            {runningTaskIds.has(task.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                            {runningTaskIds.has(task.id) ? '実行中…' : '担当AIに依頼'}
                          </button>
                        )}
                        {task.status !== 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(task, 'in_progress')}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            着手 (進行中へ)
                          </button>
                        )}

                        {task.status !== 'pending_approval' && task.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(task, 'pending_approval')}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            承認を申請
                          </button>
                        )}

                        {task.status !== 'completed' && (task.assignee.type === 'human' || task.assignee.type === 'external_ai') && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(task, 'completed')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            完了にする
                          </button>
                        )}

                        {task.status !== 'blocked' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(task, 'blocked')}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            問題あり
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
                        value={status}
                        onChange={(e) => setStatus(e.target.value as TaskStatus)}
                        className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
                      >
                        <option value="waiting">待機中</option>
                        <option value="in_progress">進行中</option>
                        <option value="pending_approval">承認待ち</option>
                        <option value="completed">完了</option>
                        <option value="blocked">問題あり</option>
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
        </>
      )}

      {(activeSection === 'approvals' || activeSection === 'logs') && (
        <ApprovalsView
          tasks={tasks}
          approvals={approvals}
          activityLogs={activityLogs}
          onResolveApproval={onResolveApproval}
          onDeleteApproval={onDeleteApproval}
          onClearApprovals={onClearApprovals}
          onDeleteActivityLog={onDeleteActivityLog}
          onClearActivityLogs={onClearActivityLogs}
          initialTab={activeSection === 'logs' ? 'logs' : 'approvals'}
          embedded
        />
      )}
    </div>
  );
};
