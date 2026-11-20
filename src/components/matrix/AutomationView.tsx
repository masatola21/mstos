import React, { useState } from 'react';
import { Bot, Check, Clock3, GitBranch, ShieldCheck, Sparkles, Zap, Plus, Trash2, X, Server, CheckCircle2 } from 'lucide-react';
import { AutomationRule, AutomationTriggerEvent, AutomationAiMode, AutomationApprovalPolicy } from '../../types/matrix';
import { ActivityLog } from '../../types';
import { AI_WORK_MODES } from '../../data/aiWorkModes';

interface BuiltInAutomationEntry {
  id: string;
  category: string;
  title: string;
  trigger: string;
  action: string;
  stopOrSafety: string;
  manageWhere: string;
}

const BUILT_IN_PROGRAM_AUTOMATIONS: BuiltInAutomationEntry[] = [
  {
    id: 'builtin-public-forms',
    category: '集客・Webフォーム',
    title: 'HPフォーム即時受付・CRM登録・お礼返信',
    trigger: '相談・診断・資料請求・介護開業フォーム送信時',
    action: '企業/連絡先/リードを自動登録・更新し、お礼メール（＋LINE未連携時はメール／連携時はLINE）と管理者通知を即時送信',
    stopOrSafety: '重複送信を冪等キーで防止。資料請求は選択資料URLのみ自動添付',
    manageWhere: 'フォーム作成・配布資料 / 配信ジョブ',
  },
  {
    id: 'builtin-step-delivery',
    category: 'ステップ追客・配信',
    title: 'LINE・メール自動ステップ配信エンジン',
    trigger: 'LINE友だち追加・診断完了・資料請求（経営改善/介護開業）・面談完了・提案送付・営業1通目',
    action: '待機ジョブを時刻指定で自動予約し、LINE連携済みはLINE優先・未連携時はメールで1本配信（二重配信なし）',
    stopOrSafety: '返信・面談予約・成約・オプトアウト・不達で待機中ジョブを自動停止',
    manageWhere: 'LINE・メール自動配信（導線管理 / 配信ジョブ）',
  },
  {
    id: 'builtin-timerex',
    category: '面談・日程調整',
    title: 'TimeRex予約同期 ＆ 確定案内・前日リマインド',
    trigger: 'TimeRex予約確定 / キャンセル受信、または定期同期',
    action: '商談予定・Googleカレンダーを自動同期し、予約確定メール・前日/当日リマインドを送信、待機中ナーチャリングを自動停止',
    stopOrSafety: '顧客の過去商談有無に応じ案内文面を自動切替',
    manageWhere: '予定カレンダー / 商談パイプライン',
  },
  {
    id: 'builtin-line-welcome',
    category: 'LINE公式アカウント',
    title: '友だち追加ウェルカム ＆ タグ分岐ヒアリング',
    trigger: 'LINE友だち追加・メニュー選択・postback受信時',
    action: 'あいさつFlex送信、選択に応じた自動タグ付け、介護開業2問ヒアリング応答、診断リンク（cid/luid付き）発行',
    stopOrSafety: 'ブロック/配信停止ユーザーは自動除外',
    manageWhere: 'LINE・メール自動配信（LINE設定 / あいさつ）',
  },
  {
    id: 'builtin-crm-tasks',
    category: '社内タスク連携',
    title: 'CRM段階移行 ＆ 送信後ステータス連動',
    trigger: '見込み→リード→商談→顧客への移行／提案書・見積書送信時',
    action: '次工程の準備タスクを自動起票し、人の確認後フォローや教育ステップ合流（4日後〜）を制御',
    stopOrSafety: '顧客への対外送信・請求確定はAIが自動実行せず必ず人が送信',
    manageWhere: '全社タスク・承認 / 商談パイプライン',
  },
];

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showSystemAutomations, setShowSystemAutomations] = useState(true);

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
            システム側で常時稼働している自動化の把握と、業務イベント検知時のAIタスク生成・独自ルールの管理を行います。
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

      {/* プログラム実装済みの常時稼働自動化一覧 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Server className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">現在プログラムで稼働中の自動化一覧</h2>
                <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  常時稼働中 {BUILT_IN_PROGRAM_AUTOMATIONS.length}系統
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                下段の「AIタスク・承認ルール」が停止中でも、以下のシステム自動化はすでにプログラム上で稼働しています。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSystemAutomations((prev) => !prev)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
          >
            {showSystemAutomations ? '折りたたむ' : '一覧を開く'}
          </button>
        </div>

        {showSystemAutomations && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 pt-1">
            {BUILT_IN_PROGRAM_AUTOMATIONS.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                      {item.category}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 truncate">{item.title}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> 稼働中
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-600">きっかけ：</span>{item.trigger}
                </p>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-600">自動処理：</span>{item.action}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-[10px] text-slate-500">
                  <span>🛡 {item.stopOrSafety}</span>
                  <span className="font-semibold text-slate-600">管理場所: {item.manageWhere}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            <span>イベント連動 AIタスク・承認ルール（標準＋独自追加）</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            有効にしたルール（独自追加を含む）は、対象イベント発生時に自動で社内タスク起票・担当AI草案作成まで連動します。
          </p>
        </div>
      </div>

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
                    confirmDeleteId === rule.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteAutomation(rule.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                        >
                          削除実行
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 text-[10px] hover:bg-slate-50 cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="このルールを削除"
                        onClick={() => setConfirmDeleteId(rule.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )
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
