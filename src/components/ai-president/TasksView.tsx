import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  ClipboardCopy,
  Plus,
  Edit2,
  Trash2,
  Clock,
  PlayCircle,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  User,
  Bot,
  Briefcase,
  X,
  Filter,
  ArrowRight,
  ShieldCheck,
  FileEdit,
  Loader2,
  Paperclip,
  Download,
  ChevronDown,
} from 'lucide-react';
import {
  TaskItem,
  Project,
  CharacterConfig,
  TaskStatus,
  Priority,
  TaskAssignee,
  ApprovalItem,
  ActivityLog,
  WorkspaceAttachment,
  TaskWorkArea,
  TaskSourceCategory,
  TaskKind,
  TaskRelatedRecordType,
} from '../types';
import { ApprovalsView } from './ApprovalsView';
import { AI_WORK_MODES, AIWorkModeId, RoleAIOverrides, resolveWorkMode } from '../../data/aiWorkModes';

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
  onRunTask: (task: TaskItem) => Promise<void>;
  onUploadAttachment: (taskId: string, file: File) => Promise<WorkspaceAttachment>;
  onDownloadAttachment: (attachment: WorkspaceAttachment) => Promise<Blob>;
  onDeleteAttachment: (attachment: WorkspaceAttachment) => Promise<void>;
  onOpenKnowledgeItem: (id: string) => void;
  onRequestApproval: (task: TaskItem, reason: string) => void;
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  onResolveApproval: (id: string, status: 'approved' | 'rejected', note?: string) => void;
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
  onRunTask,
  onUploadAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
  onOpenKnowledgeItem,
  onRequestApproval,
  approvals,
  activityLogs,
  onResolveApproval,
  initialSection = 'tasks',
  onSectionChange,
}) => {
  const [activeSection, setActiveSection] = useState<'tasks' | 'approvals' | 'logs'>(initialSection);
  useEffect(() => setActiveSection(initialSection), [initialSection]);
  const selectSection = (section: 'tasks' | 'approvals' | 'logs') => {
    setActiveSection(section);
    onSectionChange?.(section);
  };
  const [filterProject, setFilterProject] = useState<string>(selectedProjectId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterWorkArea, setFilterWorkArea] = useState<string>('all');
  const [filterTaskKind, setFilterTaskKind] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

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

  const openEditModal = (t: TaskItem) => {
    setEditingTask(t);
    setTitle(t.title);
    setDescription(t.description);
    setProjectId(t.projectId || '');
    setWorkArea(t.workArea || 'project');
    setSourceCategory(t.sourceCategory || 'ai_president');
    setDueDate(t.dueDate || '');
    setTaskKind(t.taskKind || 'response');
    setRelatedRecordType(t.relatedRecord?.type || 'none');
    setRelatedRecordId(t.relatedRecord?.id || '');
    setRelatedRecordLabel(t.relatedRecord?.label || '');
    setPriority(t.priority);
    setStatus(t.status);
    setAssigneeType(t.assignee.type === 'custom_ai' ? t.assignee.id || 'human' : t.assignee.type === 'role_ai' || t.assignee.type === 'ai_ceo' ? `role:${t.assignee.workModeId || 'president'}` : t.assignee.type);
    setCompletionCriteria(t.completionCriteria || '');
    setResultNotes(t.resultNotes || '');
    setArtifactUrl(t.artifactUrl || '');
    setAttachmentError('');
    setIsModalOpen(true);
  };

  const uploadTaskFiles = async (fileList: FileList | null) => {
    if (!editingTask || !fileList?.length) return;
    setAttachmentError('');
    setIsUploadingAttachment(true);
    try {
      let updatedTask = editingTask;
      for (const file of Array.from(fileList)) {
        const attachment = await onUploadAttachment(editingTask.id, file);
        updatedTask = {
          ...updatedTask,
          attachments: [...(updatedTask.attachments || []), attachment],
          updatedAt: Date.now(),
        };
        setEditingTask(updatedTask);
        onUpdateTask(updatedTask);
      }
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'ファイルを添付できませんでした。');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const downloadTaskFile = async (attachment: WorkspaceAttachment) => {
    try {
      const blob = await onDownloadAttachment(attachment);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'ファイルをダウンロードできませんでした。');
    }
  };

  const removeTaskFile = async (attachment: WorkspaceAttachment) => {
    if (!editingTask) return;
    setAttachmentError('');
    try {
      await onDeleteAttachment(attachment);
      const updatedTask = {
        ...editingTask,
        attachments: (editingTask.attachments || []).filter((item) => item.id !== attachment.id),
        updatedAt: Date.now(),
      };
      setEditingTask(updatedTask);
      onUpdateTask(updatedTask);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'ファイルを削除できませんでした。');
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    setDeleteTaskError('');
    try {
      await onDeleteTask(taskToDelete.id);
      setTaskToDelete(null);
    } catch (error) {
      setDeleteTaskError(error instanceof Error ? error.message : 'タスクを削除できませんでした。');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const resolveAssignee = (rawVal: string): TaskAssignee => {
    if (rawVal === 'external_ai') return { type: 'external_ai', name: '外部AI（手動依頼）' };
    if (rawVal === 'human') return { type: 'human', name: '人間 (あなた)' };
    if (rawVal === 'ai_ceo') return { type: 'ai_ceo', name: 'AI社長' };
    if (rawVal === 'dev_agent') return { type: 'dev_agent', name: '開発エージェント' };
    if (rawVal.startsWith('role:')) {
      const workModeId = rawVal.slice('role:'.length) as AIWorkModeId;
      const mode = AI_WORK_MODES.find((item) => item.id === workModeId);
      if (mode) {
        const resolved = resolveWorkMode(mode, roleOverrides);
        return { type: 'role_ai', workModeId, name: `${resolved.name}（${resolved.label}）` };
      }
    }
    const foundChar = characters.find((c) => c.id === rawVal);
    if (foundChar) {
      return { type: 'custom_ai', id: foundChar.id, name: foundChar.name };
    }
    return { type: 'human', name: '人間 (あなた)' };
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('タスク名を入力してください。');
      return;
    }
    const assignee = resolveAssignee(assigneeType);
    const nextStatus: TaskStatus = assignee.type !== 'human'
      && status === 'completed'
      && editingTask?.assignee.type === 'human'
      ? 'in_progress'
      : status;

    if (editingTask) {
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
    if (filterProject === 'none' && Boolean(t.projectId)) return false;
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
    return true;
  });

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'waiting':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> 待機中
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <PlayCircle className="w-3 h-3" /> 進行中
          </span>
        );
      case 'pending_approval':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> 承認待ち
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> 完了
          </span>
        );
      case 'blocked':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" /> 問題あり
          </span>
        );
    }
  };

  const getAssigneeBadge = (assignee: TaskAssignee) => {
    switch (assignee.type) {
      case 'external_ai':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-amber-950/70 text-amber-200 border border-amber-500/40">
            🌐 {assignee.name}
          </span>
        );
      case 'human':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-200 border border-slate-700">
            <User className="w-3 h-3 text-indigo-400" /> {assignee.name}
          </span>
        );
      case 'ai_ceo':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-indigo-950/70 text-indigo-300 border border-indigo-500/40">
            👔 {assignee.name}
          </span>
        );
      case 'dev_agent':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-cyan-950/70 text-cyan-300 border border-cyan-500/40">
            ⚙️ {assignee.name}
          </span>
        );
      case 'custom_ai':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-950/70 text-purple-300 border border-purple-500/40">
            <Bot className="w-3 h-3 text-purple-400" /> {assignee.name}
          </span>
        );
      case 'role_ai':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-violet-950/70 text-violet-300 border border-violet-500/40">
            <Bot className="w-3 h-3 text-violet-400" /> {assignee.name}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">共通タスク</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              営業・顧客、商品開発、プロジェクト、契約後支援の仕事を同じ一覧で管理
            </p>
          </div>
        </div>

        {activeSection === 'tasks' && <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新規タスクを作成</span>
        </button>}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {([
          { id: 'tasks', label: `タスク (${tasks.length})` },
          { id: 'approvals', label: `承認待ち・判断 (${approvals.filter((item) => item.status === 'pending').length})` },
          { id: 'logs', label: `活動履歴 (${activityLogs.length})` },
        ] as const).map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => selectSection(section.id)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${activeSection === section.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'}`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'tasks' && <>
      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
        {/* Project selector */}
        <div className="flex items-center gap-1.5 min-w-[180px]">
          <span className="text-slate-400 text-[11px] font-semibold">プロジェクト:</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">すべて ({tasks.length})</option>
            <option value="none">プロジェクト未設定</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-semibold">領域:</span>
          <select value={filterWorkArea} onChange={(e) => setFilterWorkArea(e.target.value)} className="rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer">
            <option value="all">すべての領域</option>
            {TASK_WORK_AREAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-semibold">種類:</span>
          <select value={filterTaskKind} onChange={(e) => setFilterTaskKind(e.target.value)} className="rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer">
            <option value="all">すべての種類</option>
            {TASK_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-semibold">状態:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">すべて</option>
            <option value="waiting">待機中</option>
            <option value="in_progress">進行中</option>
            <option value="pending_approval">承認待ち</option>
            {(assigneeType === 'human' || status === 'completed') && (
                      <option value="completed" disabled={assigneeType !== 'human'}>完了</option>
                    )}
            <option value="blocked">問題あり</option>
          </select>
        </div>

        {/* Assignee Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-semibold">担当:</span>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
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

        {selectedProjectId && (
          <button
            type="button"
            onClick={() => {
              setFilterProject('all');
              if (onClearProjectFilter) onClearProjectFilter();
            }}
            className="ml-auto text-indigo-400 hover:text-indigo-300 text-[11px] flex items-center gap-1 cursor-pointer"
          >
            プロジェクト絞り込みを解除
          </button>
        )}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <CheckSquare className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">該当するタスクがありません</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            条件を変更するか、右上の「新規タスクを作成」ボタンからタスクを登録してください。
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
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
                className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-sm group"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(task.status)}
                    {getAssigneeBadge(task.assignee)}
                    <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200">{TASK_WORK_AREAS.find((item) => item.value === (task.workArea || 'project'))?.label || 'プロジェクト'}</span>
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">{TASK_KINDS.find((item) => item.value === (task.taskKind || 'response'))?.label || '対応'}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{TASK_SOURCE_CATEGORIES.find((item) => item.value === task.sourceCategory)?.label || '経営・AI社長'}</span>
                    {task.dueDate && <span className={`rounded px-2 py-0.5 text-[10px] ${task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'completed' ? 'bg-rose-500/15 text-rose-300' : 'bg-slate-800 text-slate-300'}`}>期限: {task.dueDate}</span>}
                    {task.relatedRecord?.label && <span className="rounded bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">関連: {task.relatedRecord.label}</span>}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        task.priority === 'high'
                          ? 'bg-rose-500/20 text-rose-300'
                          : task.priority === 'medium'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      優先度: {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                    </span>
                    {project && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        <Briefcase className="w-3 h-3 text-slate-500" />
                        {project.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => openEditModal(task)}
                      title="編集"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskToDelete(task);
                      }}
                      title="削除"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
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
                        className="flex items-center gap-1.5 text-left text-sm sm:text-base font-bold text-white hover:text-indigo-200 cursor-pointer"
                      >
                        <span>{task.title}</span>
                        <span className="text-[10px] font-semibold text-indigo-300">
                          {task.draftArtifact
                            ? expandedDraftTaskIds.has(task.id) ? '成果物を閉じる' : '成果物を確認'
                            : '保存済み成果物を開く'}
                        </span>
                        {task.draftArtifact ? (
                          <ChevronDown className={`w-4 h-4 text-indigo-300 transition-transform ${expandedDraftTaskIds.has(task.id) ? 'rotate-180' : ''}`} />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-indigo-300" />
                        )}
                      </button>
                    ) : (
                      <h3 className="text-sm sm:text-base font-bold text-white">{task.title}</h3>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                  {task.assignee.type === 'external_ai' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void handleCopyExternalTaskRequest(task)} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/60"><ClipboardCopy className="h-3 w-3" />外部AIへの依頼文をコピー</button>
                      <span className="text-[10px] text-slate-500">回答は成果・メモへ貼り付けるか、タスクを編集してファイル添付</span>
                    </div>
                  )}
                  {task.draftArtifact && expandedDraftTaskIds.has(task.id) && (
                    <section className="mt-3 rounded-xl border border-indigo-500/30 bg-slate-950 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-800 text-xs font-bold text-indigo-300">
                        レビュー用成果物（承認前）
                      </div>
                      <div className="max-h-[520px] overflow-y-auto p-4 text-sm text-slate-200 whitespace-pre-wrap break-words">
                        {task.draftArtifact.content}
                      </div>
                      <p className="px-3 py-2 border-t border-slate-800 text-[11px] text-slate-400">
                        承認画面で確認・承認するとナレッジに登録されます。
                      </p>
                    </section>
                  )}
                </div>

                {/* Completion Criteria & Result Notes */}
                {(task.completionCriteria || task.resultNotes || task.artifactUrl || task.knowledgeItemId || task.attachments?.length) && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5">
                    {task.completionCriteria && (
                      <div className="flex items-start gap-1.5 text-slate-300">
                        <span className="font-semibold text-indigo-400 shrink-0">完了条件:</span>
                        <span>{task.completionCriteria}</span>
                      </div>
                    )}
                    {task.resultNotes && (
                      <div className="flex items-start gap-1.5 text-slate-300">
                        <span className="font-semibold text-emerald-400 shrink-0">成果・メモ:</span>
                        <span>{task.resultNotes}</span>
                      </div>
                    )}
                    {task.knowledgeItemId && (
                      <button type="button" onClick={() => onOpenKnowledgeItem(task.knowledgeItemId!)} className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200">
                        保存した成果物をナレッジで開く →
                      </button>
                    )}
                    {task.artifactUrl && (
                      <a href={task.artifactUrl} target="_blank" rel="noreferrer" className="block text-[11px] font-semibold text-cyan-300 hover:text-cyan-200">
                        外部成果物を開く →
                      </a>
                    )}
                    {!!task.attachments?.length && (
                      <div className="border-t border-slate-800 pt-2 mt-2 space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">タスク添付ファイル</p>
                        {task.attachments.map((attachment) => (
                          <button key={attachment.id} type="button" onClick={() => void downloadTaskFile(attachment)} className="flex max-w-full items-center gap-1.5 text-left text-[11px] font-semibold text-cyan-300 hover:text-cyan-200">
                            <Download className="h-3 w-3 shrink-0" />
                            <span className="truncate">{attachment.fileName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Quick Status Transition Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[11px] text-slate-500">
                    更新: {new Date(task.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 mr-1">状態変更:</span>
                    {task.status !== 'pending_approval' && (task.assignee.type === 'role_ai' || task.assignee.type === 'ai_ceo' || task.assignee.type === 'custom_ai') && (
                      <button
                        type="button"
                        disabled={runningTaskIds.has(task.id)}
                        onClick={() => void runTask(task)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/70 disabled:opacity-50 text-indigo-200 border border-indigo-500/30 text-[11px] font-semibold cursor-pointer"
                      >
                        {runningTaskIds.has(task.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                        {runningTaskIds.has(task.id) ? '実行中…' : '担当AIに依頼'}
                      </button>
                    )}
                    {task.status !== 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(task, 'in_progress')}
                        className="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 text-[11px] font-semibold cursor-pointer"
                      >
                        着手 (進行中へ)
                      </button>
                    )}

                    {task.status !== 'pending_approval' && task.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(task, 'pending_approval')}
                        className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30 text-[11px] font-semibold cursor-pointer"
                      >
                        承認を申請
                      </button>
                    )}

                    {task.status !== 'completed' && (task.assignee.type === 'human' || task.assignee.type === 'external_ai') && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(task, 'completed')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold cursor-pointer"
                      >
                        完了にする
                      </button>
                    )}

                    {task.status !== 'blocked' && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(task, 'blocked')}
                        className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-[11px] font-semibold cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span>{editingTask ? 'タスクを編集' : '新規タスク作成'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  タスク名 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: コア機能の要件定義書を作成"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  関連プロジェクト <span className="text-slate-500">任意</span>
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">プロジェクトに紐付けない</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-300">発生カテゴリー
                  <select value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as TaskSourceCategory)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100">
                    {TASK_SOURCE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-300">期限
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-300">仕事の領域
                  <select value={workArea} onChange={(e) => setWorkArea(e.target.value as TaskWorkArea)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100">
                    {TASK_WORK_AREAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-300">作業の種類
                  <select value={taskKind} onChange={(e) => setTaskKind(e.target.value as TaskKind)} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100">
                    {TASK_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="rounded-xl border border-slate-800 p-3 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">関連するCRMレコード／商品
                  <select value={relatedRecordType} onChange={(e) => setRelatedRecordType(e.target.value as TaskRelatedRecordType | 'none')} className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100">
                    {RELATED_RECORD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                {relatedRecordType !== 'none' && <div className="grid grid-cols-2 gap-2">
                  <input value={relatedRecordLabel} onChange={(e) => setRelatedRecordLabel(e.target.value)} placeholder="関連先の名前" className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100" />
                  <input value={relatedRecordId} onChange={(e) => setRelatedRecordId(e.target.value)} placeholder="レコードID（自動連携用）" className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100" />
                </div>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  説明・実施目的
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={assigneeType === 'external_ai' ? '外部AIへ依頼する内容を記載（機密情報は含めない）' : 'タスクの具体的な背景や目的を記載'}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                {assigneeType === 'external_ai' && <p className="mt-1 text-[10px] text-amber-300">外部サービスへ貼り付ける文面です。顧客の個人情報・機密情報は入れず、共有可能な内容だけを記載してください。</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    担当の割り当て
                  </label>
                  <select
                    value={assigneeType}
                    onChange={(e) => setAssigneeType(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    状態
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    優先度
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="high">高 (High)</option>
                    <option value="medium">中 (Medium)</option>
                    <option value="low">低 (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    完了条件
                  </label>
                  <input
                    type="text"
                    value={completionCriteria}
                    onChange={(e) => setCompletionCriteria(e.target.value)}
                    placeholder="何ができたら完了か"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  成果・メモ
                </label>
                <textarea
                  rows={2}
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="実行結果、成果物へのリンク、留意点など"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">外部成果物URL（Drive等）</label>
                <input
                  type="url"
                  value={artifactUrl}
                  onChange={(e) => setArtifactUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300">タスク添付ファイル</label>
                    <p className="mt-1 text-[11px] text-slate-500">Supabaseに非公開保存。1ファイル20MBまで。</p>
                  </div>
                  {editingTask ? (
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 ${isUploadingAttachment ? 'pointer-events-none opacity-50' : ''}`}>
                      {isUploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      {isUploadingAttachment ? 'アップロード中…' : 'ファイルを添付'}
                      <input type="file" multiple className="hidden" disabled={isUploadingAttachment} onChange={(event) => { void uploadTaskFiles(event.target.files); event.currentTarget.value = ''; }} />
                    </label>
                  ) : (
                    <span className="text-[11px] text-slate-500">タスク作成後、編集画面から添付できます。</span>
                  )}
                </div>
                {(editingTask?.attachments || []).map((attachment) => (
                  <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2">
                    <span className="min-w-0 truncate text-xs text-slate-300">{attachment.fileName} <span className="text-slate-500">({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span></span>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => void downloadTaskFile(attachment)} className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"><Download className="h-3.5 w-3.5" />保存</button>
                      <button type="button" onClick={() => void removeTaskFile(attachment)} className="text-xs text-rose-300 hover:text-rose-200">削除</button>
                    </div>
                  </div>
                ))}
                {attachmentError && <p role="alert" className="text-xs text-rose-300">{attachmentError}</p>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                {editingTask ? '変更を保存' : 'タスクを作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Request Dialog */}
      {approvalModalTask && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>承認申請を作成</span>
              </h2>
              <button
                type="button"
                onClick={() => setApprovalModalTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-400">対象タスク:</div>
                <div className="text-sm font-bold text-white">{approvalModalTask.title}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  申請理由・承認を求める内容
                </label>
                <textarea
                  rows={3}
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setApprovalModalTask(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submitApprovalRequest}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer"
              >
                承認申請を提出
              </button>
            </div>
          </div>
        </div>
      )}

      {taskToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-task-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 id="delete-task-title" className="text-base font-bold text-white">タスクを削除しますか？</h2>
            <p className="mt-3 text-sm text-slate-300">「{taskToDelete.title}」とタスクに添付したファイルを削除します。</p>
            {deleteTaskError && <p role="alert" className="mt-3 text-xs text-rose-300">{deleteTaskError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={isDeletingTask} onClick={() => setTaskToDelete(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">キャンセル</button>
              <button type="button" disabled={isDeletingTask} onClick={() => void confirmDeleteTask()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">{isDeletingTask ? '削除中…' : '削除する'}</button>
            </div>
          </section>
        </div>
      )}
      </>}

      {(activeSection === 'approvals' || activeSection === 'logs') && (
        <ApprovalsView
          tasks={tasks}
          approvals={approvals}
          activityLogs={activityLogs}
          onResolveApproval={onResolveApproval}
          initialTab={activeSection === 'logs' ? 'logs' : 'approvals'}
          embedded
        />
      )}
    </div>
  );
};

