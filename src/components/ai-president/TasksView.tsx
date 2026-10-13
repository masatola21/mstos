import React, { useState } from 'react';
import {
  CheckSquare,
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
} from 'lucide-react';
import {
  TaskItem,
  Project,
  CharacterConfig,
  TaskStatus,
  Priority,
  TaskAssignee,
} from '../types';

interface TasksViewProps {
  tasks: TaskItem[];
  projects: Project[];
  characters: CharacterConfig[];
  selectedProjectId?: string | null;
  onClearProjectFilter?: () => void;
  onCreateTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (task: TaskItem) => void;
  onDeleteTask: (id: string) => void;
  onRequestApproval: (task: TaskItem, reason: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  characters,
  selectedProjectId,
  onClearProjectFilter,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onRequestApproval,
}) => {
  const [filterProject, setFilterProject] = useState<string>(selectedProjectId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('waiting');
  const [assigneeType, setAssigneeType] = useState<string>('human');
  const [completionCriteria, setCompletionCriteria] = useState('');
  const [resultNotes, setResultNotes] = useState('');

  // Approval Request Modal State
  const [approvalModalTask, setApprovalModalTask] = useState<TaskItem | null>(null);
  const [approvalReason, setApprovalReason] = useState('');

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setProjectId(filterProject !== 'all' ? filterProject : projects[0]?.id || '');
    setPriority('medium');
    setStatus('waiting');
    setAssigneeType('human');
    setCompletionCriteria('');
    setResultNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (t: TaskItem) => {
    setEditingTask(t);
    setTitle(t.title);
    setDescription(t.description);
    setProjectId(t.projectId);
    setPriority(t.priority);
    setStatus(t.status);
    setAssigneeType(t.assignee.type === 'custom_ai' ? t.assignee.id || 'custom_ai' : t.assignee.type);
    setCompletionCriteria(t.completionCriteria || '');
    setResultNotes(t.resultNotes || '');
    setIsModalOpen(true);
  };

  const resolveAssignee = (rawVal: string): TaskAssignee => {
    if (rawVal === 'human') return { type: 'human', name: '人間 (あなた)' };
    if (rawVal === 'ai_ceo') return { type: 'ai_ceo', name: 'AI社長' };
    if (rawVal === 'dev_agent') return { type: 'dev_agent', name: '開発エージェント' };
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
    if (!projectId) {
      alert('所属プロジェクトを選択してください。');
      return;
    }

    const assignee = resolveAssignee(assigneeType);

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: title.trim(),
        description: description.trim(),
        projectId,
        priority,
        status,
        assignee,
        completionCriteria: completionCriteria.trim(),
        resultNotes: resultNotes.trim(),
        updatedAt: Date.now(),
      });
    } else {
      onCreateTask({
        title: title.trim(),
        description: description.trim(),
        projectId,
        priority,
        status,
        assignee,
        completionCriteria: completionCriteria.trim(),
        resultNotes: resultNotes.trim(),
      });
    }
    setIsModalOpen(false);
  };

  const handleQuickStatusChange = (task: TaskItem, newStatus: TaskStatus) => {
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

  const filteredTasks = tasks.filter((t) => {
    if (filterProject !== 'all' && t.projectId !== filterProject) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'human' && t.assignee.type !== 'human') return false;
      if (filterAssignee === 'ai_ceo' && t.assignee.type !== 'ai_ceo') return false;
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
            <h1 className="text-lg font-extrabold text-white">タスク管理</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              各タスクの担当（人間 / AI社長 / 登録AI / 開発エージェント）と進捗状態を管理
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新規タスクを作成</span>
        </button>
      </div>

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
            <option value="all">すべてのプロジェクト ({tasks.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
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
            <option value="completed">完了</option>
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
            <option value="ai_ceo">👔 AI社長</option>
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
                        if (window.confirm(`タスク「${task.title}」を削除しますか？`)) {
                          onDeleteTask(task.id);
                        }
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
                  <h3 className="text-sm sm:text-base font-bold text-white">{task.title}</h3>
                  {task.description && (
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Completion Criteria & Result Notes */}
                {(task.completionCriteria || task.resultNotes) && (
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
                  </div>
                )}

                {/* Bottom Quick Status Transition Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[11px] text-slate-500">
                    更新: {new Date(task.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 mr-1">状態変更:</span>
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

                    {task.status !== 'completed' && (
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
                  所属プロジェクト <span className="text-rose-400">*</span>
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  説明・実施目的
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="タスクの具体的な背景や目的を記載"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
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
                    <option value="ai_ceo">👔 AI社長 (シドウ)</option>
                    <option value="dev_agent">⚙️ 開発エージェント</option>
                    {characters
                      .filter((c) => c.id !== 'preset-ceo')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.avatarEmoji || '🤖'} {c.name} ({c.role})
                        </option>
                      ))}
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
    </div>
  );
};
