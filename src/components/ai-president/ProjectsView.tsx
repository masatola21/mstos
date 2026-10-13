import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Check,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Project, TaskItem, ProjectStatus, Priority } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  tasks: TaskItem[];
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onNavigateToTasksWithFilter: (projectId: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  tasks,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onNavigateToTasksWithFilter,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [priority, setPriority] = useState<Priority>('high');
  const [dueDate, setDueDate] = useState('');

  const openCreateModal = () => {
    setEditingProject(null);
    setName('');
    setObjective('');
    setStatus('in_progress');
    setPriority('high');
    setDueDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setName(p.name);
    setObjective(p.objective);
    setStatus(p.status);
    setPriority(p.priority);
    setDueDate(p.dueDate || '');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('プロジェクト名を入力してください。');
      return;
    }

    if (editingProject) {
      onUpdateProject({
        ...editingProject,
        name: name.trim(),
        objective: objective.trim(),
        status,
        priority,
        dueDate,
        updatedAt: Date.now(),
      });
    } else {
      onCreateProject({
        name: name.trim(),
        objective: objective.trim(),
        status,
        priority,
        dueDate,
      });
    }
    setIsModalOpen(false);
  };

  const filteredProjects = projects.filter((p) => {
    if (filterStatus === 'all') return true;
    return p.status === filterStatus;
  });

  const getStatusBadge = (s: ProjectStatus) => {
    switch (s) {
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">進行中</span>;
      case 'planning':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">計画中</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">完了</span>;
      case 'on_hold':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600">保留</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">プロジェクト管理</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              各プロジェクトの目的・状態・期限と、紐づくタスクの進捗を管理
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新規プロジェクトを作成</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {[
            { id: 'all', label: `すべて (${projects.length})` },
            { id: 'in_progress', label: `進行中 (${projects.filter((p) => p.status === 'in_progress').length})` },
            { id: 'planning', label: `計画中 (${projects.filter((p) => p.status === 'planning').length})` },
            { id: 'completed', label: `完了 (${projects.filter((p) => p.status === 'completed').length})` },
            { id: 'on_hold', label: `保留 (${projects.filter((p) => p.status === 'on_hold').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <Briefcase className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">表示できるプロジェクトがありません</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            右上の「新規プロジェクトを作成」ボタンから作成するか、AI社長チャットで事業目標を相談してタスク分解計画を作成してください。
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新しいプロジェクトを作成する</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((p) => {
            const relatedTasks = tasks.filter((t) => t.projectId === p.id);
            const doneTasks = relatedTasks.filter((t) => t.status === 'completed');
            const percent =
              relatedTasks.length > 0
                ? Math.round((doneTasks.length / relatedTasks.length) * 100)
                : 0;

            return (
              <div
                key={p.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-sm group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(p.status)}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.priority === 'high'
                            ? 'bg-rose-500/20 text-rose-300'
                            : p.priority === 'medium'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        優先度: {p.priority === 'high' ? '高' : p.priority === 'medium' ? '中' : '低'}
                      </span>
                      {p.isSample && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                          サンプル
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        title="編集"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `プロジェクト「${p.name}」を削除しますか？（関連タスクも確認してください）`
                            )
                          ) {
                            onDeleteProject(p.id);
                          }
                        }}
                        title="削除"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                      {p.objective || '目的・目標未設定'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                    {p.dueDate && (
                      <span className="flex items-center gap-1 text-indigo-300">
                        <Calendar className="w-3.5 h-3.5" /> 期限: {p.dueDate}
                      </span>
                    )}
                    <span>
                      作成日: {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>

                {/* Progress & Task Navigation Button */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>進捗状況 ({doneTasks.length}/{relatedTasks.length} 完了)</span>
                    <span className="font-bold text-slate-200">{percent}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateToTasksWithFilter(p.id)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 text-xs font-semibold text-indigo-300 hover:text-white border border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
                  >
                    <span>このプロジェクトのタスク一覧を見る ({relatedTasks.length}件)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <span>{editingProject ? 'プロジェクトを編集' : '新規プロジェクト作成'}</span>
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
                  プロジェクト名 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 新規WebサービスのMVP開発"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  目的・達成目標
                </label>
                <textarea
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="このプロジェクトで達成すべき成果や完了条件を記載"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    状態
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="in_progress">進行中</option>
                    <option value="planning">計画中</option>
                    <option value="completed">完了</option>
                    <option value="on_hold">保留</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    優先順位
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  目標期日 (任意)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
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
                {editingProject ? '変更を保存' : 'プロジェクトを作成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
