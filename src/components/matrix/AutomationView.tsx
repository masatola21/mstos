import React from 'react';
import { Bot, Check, Clock3, GitBranch, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { AutomationRule } from '../../types/matrix';
import { ActivityLog } from '../../types';
import { AI_WORK_MODES } from '../../data/aiWorkModes';

interface AutomationViewProps {
  automations: AutomationRule[];
  activityLogs: ActivityLog[];
  onUpdateAutomation: (id: string, updates: Partial<AutomationRule>) => void;
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

const connectedTriggerEvents = new Set<AutomationRule['triggerEvent']>(['diagnosis_submitted', 'deal_won', 'contract_signed', 'invoice_overdue', 'project_milestone']);

const approvalLabels: Record<AutomationRule['approvalPolicy'], string> = {
  always: 'AIの草案ごとに人が確認する',
  external_actions: '顧客への連絡・外部処理だけ人が確認する',
  none: 'AI草案に人の承認を求めない',
};

export const AutomationView: React.FC<AutomationViewProps> = ({ automations, activityLogs, onUpdateAutomation }) => {
  const enabledCount = automations.filter((rule) => rule.isEnabled).length;
  const automationHistory = activityLogs
    .filter((log) => log.summary.includes('自動化ルール「') || log.summary.includes('自動化実行:'))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-2 text-xl font-black tracking-tight text-white">
            <Zap className="h-6 w-6 text-amber-400" />
            AI自動化・承認ルール
          </h2>
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">
            標準テンプレート
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          業務の開始条件ごとに、AIへ任せる範囲と人が確認する箇所を設定します。
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-700/40 bg-amber-950/30 p-3">
          <div className="flex items-start gap-2 text-xs leading-5 text-amber-100">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>診断フォーム回答（Realtime）、商談の成約、契約締結、請求期限超過、支援マイルストーンの到達を検知して期限付きタスクを作成します。「提案」は担当者用タスクを作成、「担当AIを設定」はタスクから手動実行、「自動実行」はイベント発生時にAIが草案を作成します。「AIの草案ごとに人が確認する」を選ぶと成果物が承認待ちになり、承認後にナレッジへ登録されます。アプリ停止中の診断回答受信は起動時に回復します。支援マイルストーンは顧問・構築支援で到達を記録するとタスクを作成します。顧客への送信や外部処理は自動実行しません。</span>
          </div>
          <span className="whitespace-nowrap text-xs text-slate-400">有効設定 {enabledCount} / {automations.length}</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {automations.map((rule) => (
          <article key={rule.id} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-indigo-500/15 p-2 text-indigo-300"><GitBranch className="h-4 w-4" /></span>
                <div>
                  <h3 className="font-bold text-white">{rule.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{rule.description}</p>
                </div>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={rule.isEnabled}
                  onChange={(event) => onUpdateAutomation(rule.id, { isEnabled: event.target.checked, updatedAt: Date.now() })}
                  className="h-4 w-4 accent-blue-500"
                  aria-label={rule.name + 'の有効設定'}
                />
                設定を有効化
              </label>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Zap className="h-3.5 w-3.5" />開始条件
              </div>
              <p className="mt-1 text-sm text-slate-200">{triggerLabels[rule.triggerEvent]}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="block text-xs font-medium text-slate-300">
                <span className="mb-1.5 flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-amber-300" />タスク期限（発生後の日数）</span>
                <input type="number" min={1} max={90} value={rule.taskDueInDays} onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) onUpdateAutomation(rule.id, { taskDueInDays: Math.min(90, Math.max(1, Math.floor(value))), updatedAt: Date.now() });
                }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              </label>
              <label className="block text-xs font-medium text-slate-300">
                <span className="mb-1.5 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-indigo-300" />AIに任せる範囲</span>
                <select
                  value={rule.aiMode}
                  onChange={(event) => onUpdateAutomation(rule.id, { aiMode: event.target.value as AutomationRule['aiMode'], updatedAt: Date.now() })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {Object.entries(aiModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-300">
                <span className="mb-1.5 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-indigo-300" />担当役割AI（提案モードは人が担当）</span>
                <select value={rule.workModeId || 'president'} onChange={(event) => onUpdateAutomation(rule.id, { workModeId: event.target.value as AutomationRule['workModeId'], updatedAt: Date.now() })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                  {AI_WORK_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}（{mode.name}）</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-300">
                <span className="mb-1.5 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />人の承認</span>
                <select
                  value={rule.approvalPolicy}
                  onChange={(event) => onUpdateAutomation(rule.id, { approvalPolicy: event.target.value as AutomationRule['approvalPolicy'], updatedAt: Date.now() })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {Object.entries(approvalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
              {rule.isEnabled ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Clock3 className="h-3.5 w-3.5" />}
              {rule.isEnabled ? (connectedTriggerEvents.has(rule.triggerEvent) ? '有効（期限付きタスクを作成し、設定に応じてAI処理）' : '設定を有効にしました（業務連携後に適用）') : '停止中'}
              {rule.aiMode === 'execute' && <span className="ml-auto inline-flex items-center gap-1 text-amber-300"><Sparkles className="h-3 w-3" />草案を自動作成・外部送信はしません</span>}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-white">自動化イベント・AI実行・承認履歴</h3>
            <p className="mt-1 text-xs text-slate-400">ルールからのタスク作成、担当AIの実行結果、成果物の承認・却下を記録します。</p>
          </div>
          <span className="text-xs text-slate-500">直近 {automationHistory.length} 件</span>
        </div>
        {automationHistory.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-500">まだ自動化イベント・AI実行の履歴はありません。</p>
        ) : (
          <ol className="mt-4 divide-y divide-slate-800">
            {automationHistory.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-xs leading-5 text-slate-200">{log.summary}</p>
                <time className="shrink-0 text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleString('ja-JP')}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
