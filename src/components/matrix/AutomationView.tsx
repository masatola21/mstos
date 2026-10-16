import React from 'react';
import { Bot, Check, Clock3, GitBranch, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { AutomationRule } from '../../types/matrix';

interface AutomationViewProps {
  automations: AutomationRule[];
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
  prepare: 'AIに初稿作成を依頼する（実行はタスクから）',
  execute: '担当AIタスクを作成する（実行はタスクから）',
};

const approvalLabels: Record<AutomationRule['approvalPolicy'], string> = {
  always: '毎回、人が確認してから進める',
  external_actions: '顧客への連絡・外部処理の前に確認する',
  none: '人の承認なしで進める',
};

export const AutomationView: React.FC<AutomationViewProps> = ({ automations, onUpdateAutomation }) => {
  const enabledCount = automations.filter((rule) => rule.isEnabled).length;

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
            <span>現在はルール設定の保存までです。業務イベントによる自動起動と実行履歴は未接続のため、ここで有効にしても業務処理は実行されません。</span>
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

            <div className="grid gap-3 sm:grid-cols-2">
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
              {rule.isEnabled ? '設定を有効にしました（業務連携後に適用）' : '停止中'}
              {rule.aiMode === 'execute' && rule.approvalPolicy === 'none' && <span className="ml-auto inline-flex items-center gap-1 text-amber-300"><Sparkles className="h-3 w-3" />承認なしで自動実行する設定</span>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
