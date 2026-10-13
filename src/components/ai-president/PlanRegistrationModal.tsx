import React, { useState } from 'react';
import { X, Check, ClipboardList, Plus, Trash2, AlertCircle, ArrowRight } from 'lucide-react';
import { ProposedPlan, Priority, TaskAssignee, CharacterConfig } from '../types';

interface PlanRegistrationModalProps {
  plan: ProposedPlan;
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterConfig[];
  onConfirmRegistration: (
    projectName: string,
    projectObjective: string,
    priority: Priority,
    dueDate: string,
    tasks: {
      title: string;
      description: string;
      priority: Priority;
      completionCriteria: string;
      assignee: TaskAssignee;
    }[]
  ) => void;
}

export const PlanRegistrationModal: React.FC<PlanRegistrationModalProps> = ({
  plan,
  isOpen,
  onClose,
  characters,
  onConfirmRegistration,
}) => {
  const [projectName, setProjectName] = useState(plan.projectName || '新規プロジェクト');
  const [projectObjective, setProjectObjective] = useState(plan.projectObjective || '');
  const [projectPriority, setProjectPriority] = useState<Priority>(plan.priority || 'high');
  const [dueDate, setDueDate] = useState(plan.dueDate || '');

  const [tasks, setTasks] = useState(
    plan.tasks.map((t) => {
      let assignee: TaskAssignee = { type: 'ai_ceo', name: 'AI社長' };
      if (t.suggestedAssignee?.includes('人間') || t.suggestedAssignee?.includes('あなた')) {
        assignee = { type: 'human', name: '人間 (あなた)' };
      } else if (t.suggestedAssignee?.includes('開発エージェント')) {
        assignee = { type: 'dev_agent', name: '開発エージェント' };
      } else {
        const found = characters.find((c) => t.suggestedAssignee?.includes(c.name));
        if (found) {
          assignee = { type: 'custom_ai', id: found.id, name: found.name };
        }
      }

      return {
        title: t.title,
        description: t.objective || '',
        priority: t.priority || 'medium',
        completionCriteria: t.completionCriteria || '',
        assignee,
      };
    })
  );

  if (!isOpen) return null;

  const handleTaskChange = (index: number, field: string, value: any) => {
    setTasks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAssigneeChange = (index: number, rawVal: string) => {
    let assignee: TaskAssignee;
    if (rawVal === 'human') {
      assignee = { type: 'human', name: '人間 (あなた)' };
    } else if (rawVal === 'ai_ceo') {
      assignee = { type: 'ai_ceo', name: 'AI社長' };
    } else if (rawVal === 'dev_agent') {
      assignee = { type: 'dev_agent', name: '開発エージェント' };
    } else {
      const char = characters.find((c) => c.id === rawVal);
      assignee = {
        type: 'custom_ai',
        id: char?.id,
        name: char ? `${char.name} (${char.role})` : '専門AI',
      };
    }
    handleTaskChange(index, 'assignee', assignee);
  };

  const addTaskRow = () => {
    setTasks((prev) => [
      ...prev,
      {
        title: '新規タスク',
        description: '',
        priority: 'medium',
        completionCriteria: '',
        assignee: { type: 'human', name: '人間 (あなた)' },
      },
    ]);
  };

  const removeTaskRow = (index: number) => {
    setTasks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRegister = () => {
    if (!projectName.trim()) {
      alert('プロジェクト名を入力してください。');
      return;
    }
    if (tasks.length === 0) {
      alert('最低1つのタスクが必要です。');
      return;
    }
    onConfirmRegistration(
      projectName.trim(),
      projectObjective.trim(),
      projectPriority,
      dueDate,
      tasks
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>AI社長の提案計画をプロジェクトとして登録</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  確認・未承認
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                内容を確認・編集し、承認した場合のみプロジェクトとタスクへ登録されます。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="px-5 py-2.5 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center gap-2 text-xs text-indigo-200">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            AI社長は自動実行を行いません。各タスクの内容・担当・完了条件を確認して登録してください。
          </span>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Project Details */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              プロジェクト基本情報
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  プロジェクト名
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  優先順位
                </label>
                <select
                  value={projectPriority}
                  onChange={(e) => setProjectPriority(e.target.value as Priority)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="high">高 (High)</option>
                  <option value="medium">中 (Medium)</option>
                  <option value="low">低 (Low)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                目的・達成目標
              </label>
              <textarea
                rows={2}
                value={projectObjective}
                onChange={(e) => setProjectObjective(e.target.value)}
                placeholder="プロジェクトの目的や達成基準を記載"
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                目標期限 (任意)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                分解されたタスク一覧 ({tasks.length}件)
              </h3>
              <button
                type="button"
                onClick={addTaskRow}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> タスク追加
              </button>
            </div>

            <div className="space-y-3">
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-indigo-400">タスク #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTaskRow(idx)}
                      title="このタスクを削除"
                      className="text-slate-500 hover:text-rose-400 text-xs p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        タスク名
                      </label>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        優先度
                      </label>
                      <select
                        value={task.priority}
                        onChange={(e) => handleTaskChange(idx, 'priority', e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="high">高 (High)</option>
                        <option value="medium">中 (Medium)</option>
                        <option value="low">低 (Low)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        担当の割り当て
                      </label>
                      <select
                        value={
                          task.assignee.type === 'custom_ai'
                            ? task.assignee.id || 'custom'
                            : task.assignee.type
                        }
                        onChange={(e) => handleAssigneeChange(idx, e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
                      <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                        完了条件 (チェック基準)
                      </label>
                      <input
                        type="text"
                        value={task.completionCriteria}
                        onChange={(e) =>
                          handleTaskChange(idx, 'completionCriteria', e.target.value)
                        }
                        placeholder="例: レビュー完了、成果物提出など"
                        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      説明・実施目的
                    </label>
                    <input
                      type="text"
                      value={task.description}
                      onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                      placeholder="タスクの詳細や背景"
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={handleRegister}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>確認済み：プロジェクト＆タスクとして登録</span>
          </button>
        </div>
      </div>
    </div>
  );
};
