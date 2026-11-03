import React, { useState, useEffect } from 'react';
import {
  Target,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Coins,
  ArrowRight,
  TrendingUp,
  Activity,
  Edit2,
  Check,
  X,
  MessageSquare,
  PlusCircle,
  Settings,
  Sparkles,
  Square,
  RefreshCw,
  Package,
  Layers,
  ExternalLink,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  Project,
  TaskItem,
  ApprovalItem,
  ActivityLog,
  TokenUsageRecord,
  ModelPricingRate,
} from '../types';
import { ManagedProduct, ManagedContract, ManagedInvoice, PRODUCT_ARCHETYPES } from '../../types/matrix';
import { calculateProductKPIs } from '../../services/businessSummaryService';
import { loadLiveProductsFromMaster, formatProductPrice } from '../../services/productCatalogService';
import { matrixService } from '../../services/matrixService';
import { getMonthlyTokenSummary } from '../../utils/storage';

interface DashboardViewProps {
  topGoal: string;
  onUpdateTopGoal: (newGoal: string) => void;
  projects: Project[];
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  tokenUsageRecords: TokenUsageRecord[];
  pricingRates: ModelPricingRate[];
  products?: ManagedProduct[];
  contracts?: ManagedContract[];
  invoices?: ManagedInvoice[];
  onOpenPricingSettings: () => void;
  onNavigateTab: (tab: 'chat' | 'projects' | 'tasks' | 'approvals') => void;
  onNavigateToTab?: (tab: string) => void;
  onResolveApproval: (id: string, status: 'approved' | 'rejected') => void;
  onDeleteApproval?: (id: string) => void;
  onUpdateTask?: (task: TaskItem) => void;
  onStartGoalBreakdown?: (goal: string) => void;
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
  products = [],
  contracts = [],
  invoices = [],
  onOpenPricingSettings,
  onNavigateTab,
  onNavigateToTab,
  onResolveApproval,
  onDeleteApproval,
  onUpdateTask,
  onStartGoalBreakdown,
}) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(topGoal);
  const [liveMasterProducts, setLiveMasterProducts] = useState<ManagedProduct[] | null>(null);
  const [isSyncingMaster, setIsSyncingMaster] = useState(false);
  const [masterSyncTime, setMasterSyncTime] = useState<Date | null>(null);
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');

  const refreshMasterProducts = async () => {
    setIsSyncingMaster(true);
    try {
      const masterItems = await loadLiveProductsFromMaster();
      if (masterItems && masterItems.length > 0) {
        setLiveMasterProducts(masterItems);
        setMasterSyncTime(new Date());
      }
    } catch (err) {
      console.warn('Dashboard master product fetch failed:', err);
    } finally {
      setIsSyncingMaster(false);
    }
  };

  useEffect(() => {
    void refreshMasterProducts();
  }, []);

  const handleSaveGoal = () => {
    if (goalInput.trim()) {
      onUpdateTopGoal(goalInput.trim());
    }
    setIsEditingGoal(false);
  };

  // Business & Revenue Metrics
  let totalPaidRevenue = 0;
  let totalPendingRevenue = 0;
  invoices.forEach((inv) => {
    const amount = Number(inv.amount) || 0;
    const tax = inv.taxAmount !== undefined && inv.taxAmount !== null ? Number(inv.taxAmount) : Math.floor(amount * 0.1);
    const total = amount + tax;
    if (inv.status === 'paid') totalPaidRevenue += total;
    else if (inv.status === 'issued' || inv.status === 'overdue') totalPendingRevenue += total;
  });

  const activeSignedClients = new Set<string>();
  contracts.filter((c) => c.status === 'signed').forEach((c) => {
    const key = (c.companyId || c.counterpartyName || c.id).trim();
    if (key) activeSignedClients.add(key);
  });

  // 商品マスタ正（Single Source of Truth: products table / liveMasterProducts）
  const sampleIds = matrixService.SAMPLE_RECORD_IDS?.products || new Set(['prd-sys-01', 'prd-ret-02', 'prd-med-04', 'prd-dig-03']);
  const effectiveProductSource = (liveMasterProducts && liveMasterProducts.length > 0 ? liveMasterProducts : products)
    .filter((p) => !sampleIds.has(p.id) && p.status !== 'archived');

  const productStatsList = effectiveProductSource.map((p) => calculateProductKPIs(p, contracts, invoices));

  // カテゴリ一覧
  const availableCategories = Array.from(
    new Set(effectiveProductSource.map((p) => (p.category || '').trim()).filter(Boolean))
  );

  const displayedProductStatsList = productStatsList.filter((stat) => {
    if (productCategoryFilter === 'all') return true;
    const product = effectiveProductSource.find((p) => p.id === stat.productId);
    return (product?.category || '').trim() === productCategoryFilter;
  });

  const totalTargetRevenue = productStatsList.reduce((sum, s) => sum + s.targetRevenue, 0);
  const overallAchievementRate = totalTargetRevenue > 0
    ? Math.round((totalPaidRevenue / totalTargetRevenue) * 100)
    : 0;

  // Task & Project breakdowns
  const inProgressProjects = projects.filter((p) => p.status === 'in_progress');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const waitingTasks = tasks.filter((t) => t.status === 'waiting');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const blockedTasks = tasks.filter((t) => t.status === 'blocked');
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  const monthlySummary = getMonthlyTokenSummary(tokenUsageRecords, new Date());

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Top Header Banner: AI President & Top Priority Goal */}
      <div className="bg-gradient-to-r from-purple-50/80 via-white to-slate-50 border border-purple-200/80 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI経営室・統合コックピット</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              経営ダッシュボード
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              全社最優先目標の進捗、確定業績、プロダクト進捗、直近タスクを一覧で集中把握
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateTab('chat')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI社長に指示・相談</span>
            </button>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('mst_dashboard')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <span>営業・反響ダッシュボード</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Top Priority Goal Box */}
        <div className="p-4 rounded-xl bg-white border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-purple-600" />
              全社最優先目標 (Top Priority Goal)
            </span>
            {!isEditingGoal ? (
              <button
                type="button"
                onClick={() => {
                  setGoalInput(topGoal);
                  setIsEditingGoal(true);
                }}
                className="text-[11px] text-slate-500 hover:text-purple-700 flex items-center gap-1 cursor-pointer font-medium"
              >
                <Edit2 className="w-3 h-3" />
                目標を編集
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                >
                  <Check className="w-3 h-3" /> 保存
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                >
                  <X className="w-3 h-3" /> 取消
                </button>
              </div>
            )}
          </div>

          {!isEditingGoal ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
              <p className="text-sm font-bold text-slate-800 leading-relaxed">
                {topGoal || '最優先目標が未設定です。クリックして設定してください。'}
              </p>
              {topGoal && (
                <button
                  type="button"
                  onClick={() => {
                    if (onStartGoalBreakdown) {
                      onStartGoalBreakdown(topGoal);
                    } else {
                      onNavigateTab('chat');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>AI社長にタスク分解を依頼</span>
                </button>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
              className="w-full rounded-xl bg-white border border-purple-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="例: 今期売上3,000万円達成と新規契約20件獲得"
              autoFocus
            />
          )}
        </div>
      </div>

      {/* 2. Top Alert Banner: Pending Approvals (Prominent when needed) */}
      {pendingApprovals.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>人間の判断・承認待ちアラート ({pendingApprovals.length}件)</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('approvals')}
              className="text-xs text-amber-800 hover:text-amber-900 font-bold underline cursor-pointer"
            >
              承認管理で全て確認 →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingApprovals.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-white border border-amber-200/80 flex flex-col justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{item.actionTitle}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                      要承認
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    対象タスク: {item.taskTitle} <span className="text-slate-400">({item.requestedBy})</span>
                  </div>
                  <div className="text-[11px] text-amber-800 mt-1 font-medium bg-amber-50/60 p-1.5 rounded border border-amber-100">
                    理由: {item.reason}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onResolveApproval(item.id, 'approved')}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveApproval(item.id, 'rejected')}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-all cursor-pointer border border-rose-200"
                  >
                    却下
                  </button>
                  {onDeleteApproval && (
                    <button
                      type="button"
                      onClick={() => onDeleteApproval(item.id)}
                      title="この承認待ちを削除"
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-all cursor-pointer border border-slate-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 4大財務・事業KPI (統一されたKPIカードデザイン) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-semibold">確定売上（税込・入金済）</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
              実績
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono tracking-tight">
            ¥{totalPaidRevenue.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>入金完了済みの請求書合算</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-semibold">請求中・未収金（税込）</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
              入金待ち
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-2 font-mono tracking-tight">
            ¥{totalPendingRevenue.toLocaleString()}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>発行済・期日待ち請求合算</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-semibold">稼働クライアント数</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
              顧客数
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 tracking-tight">
            {activeSignedClients.size} <span className="text-sm font-semibold text-slate-500">社</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>有効契約締結済みの顧客企業</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 font-semibold">全社目標達成率</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold">
              進捗
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700 mt-2 font-mono tracking-tight">
            {overallAchievementRate} <span className="text-sm font-semibold text-slate-500">%</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>目標計: ¥{totalTargetRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 4. リアルタイム業績 & プロダクト進捗（商品マスタ正） */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-900">全社業績・プロダクト別進捗（実データ確定値）</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                商品マスタ正 (Single Source of Truth)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                契約書・請求書自動集計
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Supabaseの商品マスタ（<code className="text-purple-700 bg-purple-50 px-1 py-0.5 rounded text-[11px] font-mono">products</code>テーブル）を正本として、締結済み契約書・発行済み請求書から実数値をリアルタイム集計
              {masterSyncTime && (
                <span className="text-slate-400 ml-1.5 text-[11px]">
                  (最終マスタ同期: {masterSyncTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <button
              type="button"
              onClick={() => void refreshMasterProducts()}
              disabled={isSyncingMaster}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 font-semibold cursor-pointer transition-colors disabled:opacity-50 shadow-2xs"
              title="Supabaseの商品マスタから最新の商品データを再取得します"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${isSyncingMaster ? 'animate-spin' : ''}`} />
              <span>{isSyncingMaster ? 'マスタ同期中...' : '最新マスタ同期'}</span>
            </button>
            {onNavigateToTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('products')}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 font-semibold cursor-pointer transition-colors"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>商品マスタ管理</span>
                  <ExternalLink className="w-3 h-3 text-purple-500" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('customer_operations')}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1 font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  <span>契約・請求管理</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* カテゴリフィルター */}
        {availableCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 text-xs shrink-0 flex items-center gap-1 font-semibold">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              カテゴリ:
            </span>
            <button
              type="button"
              onClick={() => setProductCategoryFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                productCategoryFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              すべて ({effectiveProductSource.length})
            </button>
            {availableCategories.map((category) => {
              const count = effectiveProductSource.filter((p) => (p.category || '').trim() === category).length;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setProductCategoryFilter(category)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                    productCategoryFilter === category
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {category} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* 商品別進捗リスト */}
        {displayedProductStatsList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {displayedProductStatsList.map((stat) => {
              const productObj = effectiveProductSource.find((p) => p.id === stat.productId);
              const priceInfo = productObj ? formatProductPrice(productObj) : null;
              const isOverTarget = stat.targetRevenue > 0 && stat.currentRevenue >= stat.targetRevenue;

              return (
                <div key={stat.productId} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-purple-300 transition-all space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {productObj?.code && (
                            <span className="text-purple-700 font-mono mr-1.5 font-bold">[{productObj.code}]</span>
                          )}
                          {stat.productName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shrink-0 font-medium">
                          {productObj?.category || PRODUCT_ARCHETYPES[stat.archetype as keyof typeof PRODUCT_ARCHETYPES]?.label || stat.archetype}
                        </span>
                        {priceInfo && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                              priceInfo.model === 'custom_quote'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : priceInfo.isFlexible
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {priceInfo.badge}
                          </span>
                        )}
                      </div>

                      {priceInfo && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          料金: <span className="text-slate-700 font-semibold">{priceInfo.label}</span>
                          {priceInfo.subLabel && (
                            <span className="text-slate-400 ml-1">({priceInfo.subLabel})</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        ¥{stat.currentRevenue.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block">入金済</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOverTarget
                            ? 'bg-emerald-500'
                            : 'bg-purple-600'
                        }`}
                        style={{ width: `${Math.min(100, stat.achievementRate)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        有効契約: <strong className="text-slate-700">{stat.activeClients}社</strong>
                      </span>
                      <span>
                        目標: ¥{stat.targetRevenue.toLocaleString()} (
                        <span className={stat.achievementRate >= 100 ? 'text-emerald-700 font-bold' : 'text-purple-700 font-bold'}>
                          {stat.achievementRate}%
                        </span>
                        )
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <Package className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-700 font-semibold">表示対象のプロダクトがありません</p>
            <p className="text-xs text-slate-500">
              {productCategoryFilter !== 'all'
                ? `カテゴリ「${productCategoryFilter}」には現在有効なプロダクトがありません。`
                : '商品マスタ（productsテーブル）にプロダクトを登録するか、「最新マスタ同期」をクリックしてください。'}
            </p>
          </div>
        )}
      </div>

      {/* 5. 今日やること・優先ToDo（AI Action OS） */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-slate-900">今日やること・優先ToDo（AI Action OS）</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
              直近・重要アクション
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('tasks')}
            className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 font-semibold cursor-pointer self-start sm:self-center"
          >
            <span>全タスク一覧を見る ({tasks.filter((t) => t.status !== 'completed').length}件)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const priorityTasks = tasks
            .filter((t) => t.status !== 'completed')
            .sort((a, b) => {
              const aDue = a.dueDate || '9999-99-99';
              const bDue = b.dueDate || '9999-99-99';
              if (aDue <= todayStr && bDue > todayStr) return -1;
              if (bDue <= todayStr && aDue > todayStr) return 1;
              const priorityOrder = { high: 0, medium: 1, low: 2 };
              const aP = priorityOrder[a.priority] ?? 1;
              const bP = priorityOrder[b.priority] ?? 1;
              if (aP !== bP) return aP - bP;
              return aDue.localeCompare(bDue);
            })
            .slice(0, 6);

          if (priorityTasks.length === 0) {
            return (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-700 font-semibold">現在、急ぎの未完了ToDoはありません！</p>
                <p className="text-[11px] text-slate-500">
                  AI社長に新しい目標のタスク分解を依頼するか、共通タスクで新規タスクを作成してください。
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {priorityTasks.map((t) => {
                const isOverdue = t.dueDate && t.dueDate < todayStr;
                const isToday = t.dueDate && t.dueDate === todayStr;
                const proj = projects.find((p) => p.id === t.projectId);

                return (
                  <div
                    key={t.id}
                    onClick={() => onNavigateTab('tasks')}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-purple-300 transition-all cursor-pointer flex items-start justify-between gap-3 group shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        title="完了にする"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onUpdateTask) {
                            onUpdateTask({
                              ...t,
                              status: 'completed',
                              completedAt: Date.now(),
                              updatedAt: Date.now(),
                            });
                          }
                        }}
                        className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0 cursor-pointer"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                      <div className="min-w-0 space-y-1">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors truncate">
                          {t.title}
                        </div>
                        {proj && (
                          <div className="text-[10px] text-purple-700 truncate font-medium">
                            📁 {proj.name}
                          </div>
                        )}
                        {t.completionCriteria && (
                          <div className="text-[10px] text-slate-500 line-clamp-1">
                            完了条件: {t.completionCriteria}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isOverdue
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isToday
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isOverdue ? '期限超過' : isToday ? '本日締切' : t.dueDate ? `期日: ${t.dueDate}` : '期限未定'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        担当: <strong className="text-slate-700 font-medium">{t.assignee?.name || '未定'}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 6. タスク状況グリッド（6分割カード） */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => onNavigateTab('projects')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>進行中PJ</span>
            <Briefcase className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900">{inProgressProjects.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">全 {projects.length} 件</div>
        </div>

        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>進行中タスク</span>
            <Activity className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-blue-700">{inProgressTasks.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">作業実行中</div>
        </div>

        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>待機中タスク</span>
            <Clock className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-600">{waitingTasks.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">着手待ち</div>
        </div>

        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>完了タスク</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{completedTasks.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">達成済み</div>
        </div>

        <div
          onClick={() => onNavigateTab('tasks')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>問題あり</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-rose-600">{blockedTasks.length}</div>
          <div className="text-[10px] text-slate-400 mt-1">要対応</div>
        </div>

        <div
          onClick={() => onNavigateTab('approvals')}
          className={`p-4 rounded-xl border transition-all cursor-pointer group shadow-2xs ${
            pendingApprovals.length > 0
              ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
              : 'bg-white border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>人間の承認待ち</span>
            <ShieldAlert className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div
            className={`text-2xl font-black ${
              pendingApprovals.length > 0 ? 'text-amber-700 animate-pulse' : 'text-slate-700'
            }`}
          >
            {pendingApprovals.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">要判断</div>
        </div>
      </div>

      {/* 7. AI API利用量・今月の料金目安 (規約順守・注意書き表記) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">AI API利用量・今月の料金目安</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                  {monthlySummary.year}年{monthlySummary.month}月
                </span>
                {monthlySummary.unacquiredCallCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    未取得: {monthlySummary.unacquiredCallCount}件
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Gemini APIの応答usage metadataに基づく実測トークン数と設定単価による参考目安
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPricingSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-purple-600" />
              <span>単価設定・履歴詳細</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200">
            <div className="text-[11px] text-slate-500 font-semibold mb-1">今月の総トークン数</div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {monthlySummary.totalTokens.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-500">tokens</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              入力: {monthlySummary.totalPromptTokens.toLocaleString()} / 出力:{' '}
              {monthlySummary.totalCandidatesTokens.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200">
            <div className="text-[11px] text-slate-500 font-semibold mb-1">料金目安</div>
            <div className="text-xl font-black text-emerald-700 font-mono">
              {monthlySummary.totalEstimatedCost !== null ? (
                <>
                  {monthlySummary.currency === 'USD' ? '$' : '¥'}
                  {monthlySummary.totalEstimatedCost < 0.01 && monthlySummary.totalEstimatedCost > 0
                    ? monthlySummary.totalEstimatedCost.toFixed(4)
                    : monthlySummary.totalEstimatedCost.toFixed(2)}
                </>
              ) : (
                <span className="text-amber-600 text-base font-bold">料金未設定</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {monthlySummary.totalEstimatedCost !== null ? 'API使用量からの料金目安' : '単価を設定すると計算されます'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200">
            <div className="text-[11px] text-slate-500 font-semibold mb-1">API呼出回数</div>
            <div className="text-xl font-black text-slate-900 font-mono">
              {monthlySummary.totalCalls.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-500">回</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              取得済: {monthlySummary.acquiredCallCount}件 / 未取得: {monthlySummary.unacquiredCallCount}件
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
            <div className="text-[11px] text-slate-500 font-semibold mb-1">適用中の基準単価 (1M)</div>
            {pricingRates[0]?.inputPricePerMillion !== null ? (
              <div className="text-xs font-bold text-slate-800 leading-snug">
                入: {pricingRates[0]?.currency === 'USD' ? '$' : '¥'}
                {pricingRates[0]?.inputPricePerMillion} / 出: {pricingRates[0]?.currency === 'USD' ? '$' : '¥'}
                {pricingRates[0]?.outputPricePerMillion}
              </div>
            ) : (
              <div className="text-xs font-bold text-amber-600">単価未設定</div>
            )}
            <div className="text-[10px] text-slate-400 mt-1">
              更新日: {new Date(pricingRates[0]?.updatedAt || Date.now()).toLocaleDateString('ja-JP')}
            </div>
          </div>
        </div>

        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
          <span className="text-amber-700 font-semibold">【表記に関するご案内】</span>{' '}
          本画面に表示される金額は、API応答に含まれるトークン数と登録単価から算出した【API使用量からの料金目安】であり、Google Cloud / Google AI Studioの請求確定額とは区別されます。プロジェクトの無料枠やプロモーション適用有無は外部APIから判定できないため、実際の請求額を示すものではありません。
        </div>
      </div>

      {/* 8. 進行中プロジェクト & 直近の活動履歴 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-purple-600" />
              <span>進行中プロジェクト ({inProgressProjects.length}件)</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('projects')}
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
            >
              プロジェクト管理 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {inProgressProjects.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-500">現在進行中のプロジェクトはありません。</p>
              <button
                type="button"
                onClick={() => onNavigateTab('projects')}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline cursor-pointer font-semibold"
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
                    className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-purple-300 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                            {p.name}
                          </h3>
                          {p.isSample && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                              サンプル
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {p.objective}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          p.priority === 'high'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : p.priority === 'medium'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        優先度: {p.priority === 'high' ? '高' : p.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                        <span>タスク進捗 ({pDone.length}/{pTasks.length})</span>
                        <span className="font-bold text-purple-700">{percent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 transition-all duration-300"
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

        {/* Right 1 Column: Issues & Recent Activity */}
        <div className="space-y-6">
          {/* Section: Issues / Needs Attention */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>要対応・課題項目 ({blockedTasks.length}件)</span>
            </h2>

            {blockedTasks.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-xs text-slate-700 font-semibold">現在、問題のあるタスクはありません</p>
                <p className="text-[11px] text-slate-400 mt-0.5">業務は順調に進行しています</p>
              </div>
            ) : (
              <div className="space-y-2">
                {blockedTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onNavigateTab('tasks')}
                    className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 hover:border-rose-300 cursor-pointer transition-all"
                  >
                    <div className="text-xs font-bold text-slate-900">{t.title}</div>
                    <div className="text-[11px] text-rose-700 mt-0.5 font-medium">
                      担当: {t.assignee.name}
                    </div>
                    {t.resultNotes && (
                      <div className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                        課題メモ: {t.resultNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Recent Activity Logs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-600" />
                <span>最近の活動・実行ログ</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('approvals')}
                className="text-[11px] text-purple-600 hover:underline cursor-pointer font-semibold"
              >
                履歴一覧 →
              </button>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">活動履歴はありません</p>
            ) : (
              <div className="space-y-2">
                {activityLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-bold text-purple-700">{log.actor}</span>
                      <span>{new Date(log.timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed">{log.summary}</p>
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
