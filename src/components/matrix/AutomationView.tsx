import React, { useState } from 'react';
import { Bot, Check, Clock3, GitBranch, ShieldCheck, Sparkles, Zap, Plus, Trash2, X } from 'lucide-react';
import { AutomationRule, AutomationTriggerEvent, AutomationAiMode, AutomationApprovalPolicy } from '../../types/matrix';
import { ActivityLog } from '../../types';
import { AI_WORK_MODES } from '../../data/aiWorkModes';

interface AutomationViewProps {
  automations: AutomationRule[];
  activityLogs: ActivityLog[];
  onUpdateAutomation: (id: string, updates: Partial<AutomationRule>) => void;
  onAddAutomation?: (rule: Omit<AutomationRule, 'id' | 'updatedAt'>) => void;
  onDeleteAutomation?: (id: string) => void;
}

const triggerLabels: Record<AutomationRule['triggerEvent'], string> = {
  diagnosis_submitted: '診断フォームの回答を受信したとき',
  deal_won: '商談が成約したとき',
  contract_signed: '契約が締結されたとき',
  invoice_overdue: '請求期限を過ぎたとき',
  project_milestone: '支援の節目に到達したとき',
};

const aiModeLabels: Record<AutomationRule['aiMode'], string> = {
  suggest: '提案する',
  prepare: '担当AIを設定する（実行はタスクから）',
  execute: '自動実行（イベント発生時に担当AIが草案を作成）',
};

const connectedTriggerEvents = new Set<AutomationRule['triggerEvent']>([
  'diagnosis_submitted',
  'deal_won',
  'contract_signed',
  'invoice_overdue',
  'project_milestone',
]);

const approvalLabels: Record<AutomationRule['approvalPolicy'], string> = {
  always: 'AIの草案ごとに人が確認する',
  external_actions: '顧客への連絡・外部処理だけ人が確認する',
  none: 'AI草案に人の承認を求めない',
};

export const AutomationView: React.FC<AutomationViewProps> = ({
  automations,
  activityLogs,
  onUpdateAutomation,
  onAddAutomation,
  onDeleteAutomation,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrigger, setNewTrigger] = useState<AutomationTriggerEvent>('deal_won');
  const [newAiMode, setNewAiMode] = useState<AutomationAiMode>('prepare');
  const [newApproval, setNewApproval] = useState<AutomationApprovalPolicy>('always');
  const [newDueDays, setNewDueDays] = useState(3);
  const [newWorkModeId, setNewWorkModeId] = useState<AutomationRule['workModeId']>('customer_product');

  const enabledCount = automations.filter((rule) => rule.isEnabled).length;
  const automationHistory = activityLogs
    .filter((log) => log.summary.includes('自動化ルール「') || log.summary.includes('自動化実行:'))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 20);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !onAddAutomation) return;
    onAddAutomation({
      name: newName.trim(),
      description: newDesc.trim() || `${triggerLabels[newTrigger]}時の自動化タスク`,
      triggerEvent: newTrigger,
      aiMode: newAiMode,
      approvalPolicy: newApproval,
      isEnabled: true,
      taskDueInDays: newDueDays,
      workModeId: newWorkModeId,
    });
    setNewName('');
    setNewDesc('');
    setIsCreating(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">AI自動化・承認ルール</h1>
            <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
              有効 {enabledCount} / {automations.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            診断回答・商談成約・契約締結などの検知時に、AIの自動処理範囲と人の承認ポリシーを定めます。
          </p>
        </div>
        {onAddAutomation && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>ルールを追加</span>
          </button>
        )}
      </header>

      {/* ルール追加モーダル / フォーム */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-2xl border border-purple-200 bg-white p-5 shadow-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" /> 新しい自動化ルールを作成
            </h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ルール名 *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: 成約後のキックオフ自動草案"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">開始条件（トリガー）</label>
              <select
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value as AutomationTriggerEvent)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
              >
                {Object.entries(triggerLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">説明・目的</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="例: 成約した顧客の契約書・キックオフ資料の草案を作成する"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">AIに任せる範囲</label>
              <select
                value={newAiMode}
                onChange={(e) => setNewAiMode(e.target.value as AutomationAiMode)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
              >
                {Object.entries(aiModeLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">担当役割AI</label>
              <select
                value={newWorkModeId}
                onChange={(e) => setNewWorkModeId(e.target.value as AutomationRule['workModeId'])}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
              >
                {AI_WORK_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}（{mode.name}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">人の承認ポリシー</label>
              <select
                value={newApproval}
                onChange={(e) => setNewApproval(e.target.value as AutomationApprovalPolicy)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
              >
                {Object.entries(approvalLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">タスク期限（発生後の日数）</label>
              <input
                type="number"
                min={1}
                max={90}
                value={newDueDays}
                onChange={(e) => setNewDueDays(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition cursor-pointer"
            >
              ルールを登録
            </button>
          </div>
        </form>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {automations.map((rule) => {
          const isCustom = rule.id.startsWith('custom-');
          return (
            <article key={rule.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-100 shrink-0 mt-0.5">
                    <GitBranch className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">{rule.name}</h3>
                      {isCustom && (
                        <span className="rounded bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.2 border border-purple-200 font-medium">
                          カスタム
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 leading-normal">{rule.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.isEnabled}
                      onChange={(event) =>
                        onUpdateAutomation(rule.id, { isEnabled: event.target.checked, updatedAt: Date.now() })
                      }
                      className="h-4 w-4 accent-purple-600 cursor-pointer"
                      aria-label={rule.name + 'の有効設定'}
                    />
                    <span className={rule.isEnabled ? 'text-purple-700 font-semibold' : 'text-slate-400'}>
                      {rule.isEnabled ? '有効' : '停止中'}
                    </span>
                  </label>
                  {onDeleteAutomation && (
                    <button
                      type="button"
                      title="このルールを削除"
                      onClick={() => {
                        if (window.confirm(`自動化ルール「${rule.name}」を削除しますか？`)) {
                          onDeleteAutomation(rule.id);
                        }
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 開始条件 */}
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-150 text-xs">
                <span className="font-semibold text-purple-700 shrink-0 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> トリガー:
                </span>
                <span className="text-slate-800 font-medium truncate">{triggerLabels[rule.triggerEvent] || rule.triggerEvent}</span>
              </div>

              {/* 設定項目グリッド */}
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-slate-500 block mb-1">担当AI</span>
                  <select
                    value={rule.workModeId || 'president'}
                    onChange={(event) =>
                      onUpdateAutomation(rule.id, {
                        workModeId: event.target.value as AutomationRule['workModeId'],
                        updatedAt: Date.now(),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
                  >
                    {AI_WORK_MODES.map((mode) => (
                      <option key={mode.id} value={mode.id}>
                        {mode.label}（{mode.name}）
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">AI範囲</span>
                  <select
                    value={rule.aiMode}
                    onChange={(event) =>
                      onUpdateAutomation(rule.id, {
                        aiMode: event.target.value as AutomationRule['aiMode'],
                        updatedAt: Date.now(),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
                  >
                    {Object.entries(aiModeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">人の承認</span>
                  <select
                    value={rule.approvalPolicy}
                    onChange={(event) =>
                      onUpdateAutomation(rule.id, {
                        approvalPolicy: event.target.value as AutomationRule['approvalPolicy'],
                        updatedAt: Date.now(),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
                  >
                    {Object.entries(approvalLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">タスク期限</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={rule.taskDueInDays}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value))
                          onUpdateAutomation(rule.id, {
                            taskDueInDays: Math.min(90, Math.max(1, Math.floor(value))),
                            updatedAt: Date.now(),
                          });
                      }}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
                    />
                    <span className="text-slate-500 text-xs">日後</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                {rule.isEnabled ? <Check className="h-3 w-3 text-emerald-600" /> : <Clock3 className="h-3 w-3 text-slate-400" />}
                <span>
                  {rule.isEnabled
                    ? connectedTriggerEvents.has(rule.triggerEvent)
                      ? '有効（イベント検知時に自動実行・タスク生成）'
                      : '有効（業務連携時に自動適用）'
                    : '停止中'}
                </span>
                {rule.aiMode === 'execute' && (
                  <span className="ml-auto inline-flex items-center gap-1 text-amber-700 font-medium">
                    <Sparkles className="h-3 w-3" />草案自動作成
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900">自動化イベント・AI実行・承認履歴</h3>
            <p className="mt-1 text-xs text-slate-500">ルールからのタスク作成、担当AIの実行結果、成果物の承認・却下を記録します。</p>
          </div>
          <span className="text-xs text-slate-500">直近 {automationHistory.length} 件</span>
        </div>
        {automationHistory.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            まだ自動化イベント・AI実行の履歴はありません。
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-slate-100">
            {automationHistory.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-xs leading-5 text-slate-800">{log.summary}</p>
                <time className="shrink-0 text-[11px] text-slate-400">{new Date(log.timestamp).toLocaleString('ja-JP')}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
