import React, { useState } from 'react';
import {
  Target,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Coins,
  ArrowRight,
  TrendingUp,
  Activity,
  Edit2,
  Check,
  X,
  MessageSquare,
  PlusCircle,
  FileText,
  Settings,
} from 'lucide-react';
import {
  Project,
  TaskItem,
  ApprovalItem,
  ActivityLog,
  Priority,
  TaskStatus,
  TokenUsageRecord,
  ModelPricingRate,
} from '../types';
import { getMonthlyTokenSummary } from '../utils/storage';

interface DashboardViewProps {
  topGoal: string;
  onUpdateTopGoal: (newGoal: string) => void;
  projects: Project[];
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  tokenUsageRecords: TokenUsageRecord[];
  pricingRates: ModelPricingRate[];
  onOpenPricingSettings: () => void;
  onNavigateTab: (tab: 'chat' | 'projects' | 'tasks' | 'approvals') => void;
  onResolveApproval: (id: string, status: 'approved' | 'rejected') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  topGoal,
  onUpdateTopGoal,
  projects,
  tasks,
  approvals,
  activityLogs,
  tokenUsageRecords,
  pricingRates,
  onOpenPricingSettings,
  onNavigateTab,
  onResolveApproval,
}) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(topGoal);

  const handleSaveGoal = () => {
    if (goalInput.trim()) {
      onUpdateTopGoal(goalInput.trim());
    }
    setIsEditingGoal(false);
  };

  // Metrics
  const inProgressProjects = projects.filter((p) => p.status === 'in_progress');
  const waitingTasks = tasks.filter((t) => t.status === 'waiting');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const blockedTasks = tasks.filter((t) => t.status === 'blocked');
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  // Token & Cost Metrics for Current Month
  const monthlySummary = getMonthlyTokenSummary(tokenUsageRecords);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: AI President Status & Top Goal */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 border border-white/10 shrink-0">
              👔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-white">AI社長 統括ダッシュボード</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  稼働中
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                事業目標の進捗、タスク実行状況、および人間の承認待ち項目を一元管理
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('chat')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI社長に指示・相談</span>
            </button>
          </div>
        </div>

        {/* Top Priority Goal Box */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              最優先目標 (Top Priority Goal)
            </span>
            {!isEditingGoal ? (
              <button
                type="button"
                onClick={() => {
                  setGoalInput(topGoal);
                  setIsEditingGoal(true);
                }}
                className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                <Edit2 className="w-3 h-3" />
                目標を変更
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer font-medium"
                >
                  <Check className="w-3 h-3" /> 保存
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" /> 取消
                </button>
              </div>
            )}
          </div>

          {!isEditingGoal ? (
            <p className="text-sm font-semibold text-slate-100 leading-relaxed">
              {topGoal || '最優先目標が未設定です。クリックして設定してください。'}
            </p>
          ) : (
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
              className="w-full rounded-xl bg-slate-900 border border-indigo-500/50 px-3 py-1.5 text-sm text-slate-100 focus:outline-none"
              autoFocus
            />
          )}
        </div>
      </div>

      {/* Task & KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* In-progress projects */}
        <div
          onClick={() => onNavigateTab('projects')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>進行中PJ</span>
            <Briefcase className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-white">{inProgressProjects.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">全 {projects.length} 件</div>
        </div>

        {/* In-progress tasks */}
        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>進行中タスク</span>
            <Activity className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-blue-400">{inProgressTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">作業実行中</div>
        </div>

        {/* Waiting tasks */}
        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>待機中タスク</span>
            <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-400">{waitingTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">着手待ち</div>
        </div>

        {/* Completed tasks */}
        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>完了タスク</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{completedTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">達成済み</div>
        </div>

        {/* Blocked tasks */}
        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>問題あり</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-rose-400">{blockedTasks.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">対応・要確認</div>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => onNavigateTab('approvals')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer group shadow-sm ${
            pendingApprovals.length > 0
              ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>人間の承認待ち</span>
            <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div
            className={`text-2xl font-black ${
              pendingApprovals.length > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'
            }`}
          >
            {pendingApprovals.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">要判断</div>
        </div>
      </div>

      {/* AI Token Usage & Estimated Cost Card (条件厳守: 今月のトークン数と料金目安、請求確定額との区別明記) */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">AI API利用量・今月の料金目安</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                  {monthlySummary.year}年{monthlySummary.month}月
                </span>
                {monthlySummary.unacquiredCallCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                    未取得: {monthlySummary.unacquiredCallCount}件
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Gemini APIの応答usage metadataに基づく実測トークン数と設定単価による参考目安
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPricingSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>単価設定・履歴詳細</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Monthly Total Tokens */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-semibold mb-1">今月の総トークン数</div>
            <div className="text-xl font-black text-white">
              {monthlySummary.totalTokens.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400">tokens</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              入力: {monthlySummary.totalPromptTokens.toLocaleString()} / 出力:{' '}
              {monthlySummary.totalCandidatesTokens.toLocaleString()}
            </div>
          </div>

          {/* Estimated Cost */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-semibold mb-1">料金目安</div>
            <div className="text-xl font-black text-emerald-400">
              {monthlySummary.totalEstimatedCost !== null ? (
                <>
                  {monthlySummary.currency === 'USD' ? '$' : '¥'}
                  {monthlySummary.totalEstimatedCost < 0.01 && monthlySummary.totalEstimatedCost > 0
                    ? monthlySummary.totalEstimatedCost.toFixed(4)
                    : monthlySummary.totalEstimatedCost.toFixed(2)}
                </>
              ) : (
                <span className="text-amber-400 text-base font-bold">料金未設定</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {monthlySummary.totalEstimatedCost !== null ? 'API使用量からの料金目安' : '単価を設定すると計算されます'}
            </div>
          </div>

          {/* Call Count */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-semibold mb-1">API呼出回数</div>
            <div className="text-xl font-black text-slate-200">
              {monthlySummary.totalCalls.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400">回</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              取得済: {monthlySummary.acquiredCallCount}件 / 未取得: {monthlySummary.unacquiredCallCount}件
            </div>
          </div>

          {/* Active Pricing Snapshot */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between">
            <div className="text-[11px] text-slate-400 font-semibold mb-1">適用中の基準単価 (1M)</div>
            {pricingRates[0]?.inputPricePerMillion !== null ? (
              <div className="text-xs font-bold text-slate-200 leading-snug">
                入: {pricingRates[0]?.currency === 'USD' ? '$' : '¥'}
                {pricingRates[0]?.inputPricePerMillion} / 出: {pricingRates[0]?.currency === 'USD' ? '$' : '¥'}
                {pricingRates[0]?.outputPricePerMillion}
              </div>
            ) : (
              <div className="text-xs font-bold text-amber-400">単価未設定</div>
            )}
            <div className="text-[10px] text-slate-500 mt-1">
              更新日: {new Date(pricingRates[0]?.updatedAt || Date.now()).toLocaleDateString('ja-JP')}
            </div>
          </div>
        </div>

        {/* Legal / Policy Disclaimer Notice (条件厳守: 請求確定額と区別、無料枠適用判定不可) */}
        <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
          <span className="text-amber-400 font-semibold">【表記に関するご案内】</span>{' '}
          本画面に表示される金額は、API応答に含まれるトークン数と登録単価から算出した【API使用量からの料金目安】であり、Google Cloud / Google AI Studioの請求確定額とは区別されます。プロジェクトの無料枠やプロモーション適用有無は外部APIから判定できないため、実際の請求額を示すものではありません。
        </div>
      </div>

      {/* Main Split Grid: Left (Projects & Approvals) / Right (Issues & Recent Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section: Pending Approvals (High priority if any) */}
          {pendingApprovals.length > 0 && (
            <div className="p-5 rounded-3xl bg-amber-950/20 border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>人間の判断・承認待ち項目 ({pendingApprovals.length}件)</span>
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateTab('approvals')}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  すべて見る →
                </button>
              </div>

              <div className="space-y-2">
                {pendingApprovals.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{item.actionTitle}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        対象タスク: {item.taskTitle} (申請者: {item.requestedBy})
                      </div>
                      <div className="text-[11px] text-amber-300/80 mt-1">理由: {item.reason}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onResolveApproval(item.id, 'approved')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        承認
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveApproval(item.id, 'rejected')}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold transition-all cursor-pointer border border-slate-700"
                      >
                        却下
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: In-Progress Projects */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <span>進行中プロジェクト ({inProgressProjects.length}件)</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('projects')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                プロジェクト管理 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {inProgressProjects.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">現在進行中のプロジェクトはありません。</p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('projects')}
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> 新規プロジェクトを作成する
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {inProgressProjects.map((p) => {
                  const pTasks = tasks.filter((t) => t.projectId === p.id);
                  const pDone = pTasks.filter((t) => t.status === 'completed');
                  const percent =
                    pTasks.length > 0 ? Math.round((pDone.length / pTasks.length) * 100) : 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => onNavigateTab('projects')}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {p.name}
                            </h3>
                            {p.isSample && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                サンプル
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {p.objective}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            p.priority === 'high'
                              ? 'bg-rose-500/20 text-rose-300'
                              : p.priority === 'medium'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          優先度: {p.priority === 'high' ? '高' : p.priority === 'medium' ? '中' : '低'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                          <span>タスク進捗 ({pDone.length}/{pTasks.length})</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Issues / Needs Attention & Recent Activity */}
        <div className="space-y-6">
          {/* Section: Issues / Needs Attention */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <h2 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>エラー・対応が必要な項目 ({blockedTasks.length}件)</span>
            </h2>

            {blockedTasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-slate-300 font-semibold">問題のあるタスクはありません</p>
                <p className="text-[11px] text-slate-500 mt-0.5">タスクは順調に進行しています</p>
              </div>
            ) : (
              <div className="space-y-2">
                {blockedTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onNavigateTab('tasks')}
                    className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/30 hover:border-rose-500 cursor-pointer transition-all"
                  >
                    <div className="text-xs font-bold text-white">{t.title}</div>
                    <div className="text-[11px] text-rose-300 mt-0.5">
                      担当: {t.assignee.name}
                    </div>
                    {t.resultNotes && (
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        課題メモ: {t.resultNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Recent Activity / Execution Logs */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>最近の活動・実行結果</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('approvals')}
                className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
              >
                履歴一覧 →
              </button>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">履歴はありません</p>
            ) : (
              <div className="space-y-2.5">
                {activityLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-semibold text-indigo-400">{log.actor}</span>
                      <span>{new Date(log.timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-200 text-[11px] leading-relaxed">{log.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
