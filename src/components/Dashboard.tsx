import React, { useEffect, useState } from 'react';
import { TableKey, TABLE_CONFIGS, DiagnosisStatus } from '../types/database';
import { fetchTableCounts, fetchTableData, fetchDiagnosisCounts, DataFetchError } from '../services/dataService';
import { getSupabase } from '../lib/supabaseClient';
import { getStatusBadgeClass } from '../utils/statusBadges';
import { 
  Building2, 
  Target, 
  UserCheck, 
  Package, 
  TrendingUp, 
  ArrowUpRight, 
  Plus, 
  RefreshCw, 
  AlertCircle,
  FileCode2,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  ClipboardList,
  Users,
  Calendar,
  Megaphone,
  Globe,
  Share2,
  CheckCircle2,
  BarChart3,
  Filter,
  Sparkles
} from 'lucide-react';

interface DashboardProps {
  onNavigateTab: (tab: any) => void;
  onOpenCreate: (tab: TableKey) => void;
  onOpenRls: () => void;
  onStageTransitionTask?: (event: {
    transitionType: 'prospect_to_lead' | 'lead_to_deal' | 'deal_to_customer';
    sourceRecord: any;
    targetTable: 'leads' | 'deals' | 'customers';
    targetRecordId?: string | number;
  }) => void;
}

const TABLE_ICONS: Partial<Record<TableKey, React.ReactNode>> = {
  companies: <Building2 className="w-5 h-5 text-blue-600" />,
  contacts: <Users className="w-5 h-5 text-teal-600" />,
  prospects: <Target className="w-5 h-5 text-amber-600" />,
  leads: <Layers className="w-5 h-5 text-purple-600" />,
  products: <Package className="w-5 h-5 text-indigo-600" />,
  deals: <TrendingUp className="w-5 h-5 text-emerald-600" />,
  customers: <UserCheck className="w-5 h-5 text-rose-600" />,
};

const TABLE_THEMES: Partial<Record<TableKey, { bg: string; border: string; text: string }>> = {
  companies: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  contacts: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  prospects: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  leads: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  products: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  deals: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  customers: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
};

type DashboardSectionFilter = 'all' | 'inflow' | 'pipeline';

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateTab,
  onOpenCreate,
  onOpenRls,
}) => {
  const [sectionFilter, setSectionFilter] = useState<DashboardSectionFilter>('all');
  const [counts, setCounts] = useState<Record<TableKey, number>>({
    companies: 0,
    contacts: 0,
    prospects: 0,
    leads: 0,
    products: 0,
    deals: 0,
    customers: 0,
  });
  const [recentDeals, setRecentDeals] = useState<any[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState({ 
    amount: 0, 
    count: 0,
    wonAmount: 0,
    wonCount: 0,
    totalDeals: 0
  });
  const [inflowBreakdown, setInflowBreakdown] = useState<Array<{ source: string; count: number; percentage: number }>>([]);
  const [diagnosisStats, setDiagnosisStats] = useState<{ total: number; byStatus: Record<DiagnosisStatus, number> }>({
    total: 0,
    byStatus: { received: 0, completed: 0, generating: 0, reported: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<DataFetchError | null>(null);

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [tableRes, diagRes, dealsRes, pipelineRes, leadsRes] = await Promise.all([
        fetchTableCounts(),
        fetchDiagnosisCounts(),
        fetchTableData('deals'),
        (async () => {
          const supabase = getSupabase();
          if (!supabase) return null;
          const pageSize = 1000;
          let from = 0;
          let amount = 0;
          let count = 0;
          let wonAmount = 0;
          let wonCount = 0;
          let totalDeals = 0;

          while (true) {
            const { data, error } = await supabase
              .from('deals')
              .select('id, proposal_status, total_amount')
              .order('id', { ascending: true })
              .range(from, from + pageSize - 1);
            if (error) throw error;
            const page = data || [];
            totalDeals += page.length;

            for (const deal of page) {
              const val = Number(deal.total_amount ?? 0) || 0;
              if (deal.proposal_status === '受注') {
                wonAmount += val;
                wonCount += 1;
              } else if (deal.proposal_status !== '失注') {
                amount += val;
                count += 1;
              }
            }
            if (page.length < pageSize) break;
            from += pageSize;
          }
          return { amount, count, wonAmount, wonCount, totalDeals };
        })(),
        (async () => {
          const supabase = getSupabase();
          if (!supabase) return null;
          try {
            const { data, error } = await supabase
              .from('leads')
              .select('id, source, status, service_type')
              .limit(1000);
            if (error) return null;
            return data || [];
          } catch {
            return null;
          }
        })(),
      ]);

      if (tableRes.error) {
        setFetchError(tableRes.error);
      } else {
        setCounts(tableRes.counts);
      }

      if (diagRes) {
        setDiagnosisStats({ total: diagRes.total, byStatus: diagRes.byStatus });
      }

      if (dealsRes.data) {
        setRecentDeals([...dealsRes.data].sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0)).slice(0, 5));
      }

      if (pipelineRes) {
        setPipelineSummary(pipelineRes);
      }

      // Process inflow breakdown
      if (leadsRes && leadsRes.length > 0) {
        const sourceMap = new Map<string, number>();
        leadsRes.forEach((lead) => {
          const rawSource = lead.source?.trim() || lead.service_type?.trim() || '自社HP / 直接反響';
          sourceMap.set(rawSource, (sourceMap.get(rawSource) || 0) + 1);
        });
        const total = leadsRes.length;
        const sorted = Array.from(sourceMap.entries())
          .map(([source, count]) => ({
            source,
            count,
            percentage: Math.round((count / total) * 100),
          }))
          .sort((a, b) => b.count - a.count);
        setInflowBreakdown(sorted);
      } else {
        setInflowBreakdown([
          { source: '自社HP・Web検索', count: 0, percentage: 0 },
          { source: '無料診断・フォーム', count: 0, percentage: 0 },
          { source: 'LINE友だち登録', count: 0, percentage: 0 },
          { source: 'SNS・オウンドメディア', count: 0, percentage: 0 },
        ]);
      }
    } catch (err: any) {
      setFetchError({
        type: 'UNKNOWN',
        message: err.message || 'データ読み込み中にエラーが発生しました。'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalLeads = counts.leads || 0;
  const leadToDealRate = totalLeads > 0 && pipelineSummary.totalDeals > 0 
    ? ((pipelineSummary.totalDeals / totalLeads) * 100).toFixed(1)
    : '0';
  const dealToWonRate = pipelineSummary.totalDeals > 0 && pipelineSummary.wonCount > 0 
    ? ((pipelineSummary.wonCount / pipelineSummary.totalDeals) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold mb-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>営業・反響 統合経営基盤</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            営業・反響 統合ダッシュボード
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            流入経路・反響リードの獲得から商談パイプライン、成約・売上までを一気通貫で一望化
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onNavigateTab('ai_acquisition')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Megaphone className="w-3.5 h-3.5 text-purple-600" />
            <span>集客戦略・施策一覧</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={() => onNavigateTab('ai_dashboard')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI社長室</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>更新</span>
          </button>
        </div>
      </div>

      {/* RLS / Permission Notice if detected */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-900">
                {fetchError.type === 'PERMISSION_DENIED' ? 'データベース権限（RLS）の確認が必要です' : 'データ取得エラー'}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">{fetchError.message}</p>
            </div>
          </div>
          {fetchError.type === 'PERMISSION_DENIED' && (
            <button
              onClick={onOpenRls}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>RLS推奨SQLを確認</span>
            </button>
          )}
        </div>
      )}

      {/* Top Level 4 Core KPIs: Inflow, Pipeline, Win Rate, Won Revenue */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Inflow / Leads */}
        <div 
          onClick={() => onNavigateTab('leads')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              反響・総リード数
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
              獲得
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : totalLeads.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">件</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>商談化率</span>
            <span className="font-bold text-purple-700">{leadToDealRate}%</span>
          </div>
        </div>

        {/* KPI 2: Active Pipeline */}
        <div 
          onClick={() => onNavigateTab('deals')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              進行中 商談金額
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              商談中
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `¥${pipelineSummary.amount.toLocaleString('ja-JP')}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>対象案件数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.count} 件</span>
          </div>
        </div>

        {/* KPI 3: Win Rate */}
        <div 
          onClick={() => onNavigateTab('deals')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              商談成約率 (受注率)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
              成約効率
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `${dealToWonRate}%`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>成約件数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.wonCount} 件</span>
          </div>
        </div>

        {/* KPI 4: Won Revenue */}
        <div 
          onClick={() => onNavigateTab('customers')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-600" />
              受注・成約総額
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              実績
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `¥${pipelineSummary.wonAmount.toLocaleString('ja-JP')}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>契約顧客数</span>
            <span className="font-bold text-slate-800">{counts.customers} 社</span>
          </div>
        </div>
      </section>

      {/* Section View Filter Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setSectionFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            sectionFilter === 'all'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>統合全体ビュー</span>
        </button>
        <button
          onClick={() => setSectionFilter('inflow')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            sectionFilter === 'inflow'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>流入・反響＆獲得チャネル</span>
        </button>
        <button
          onClick={() => setSectionFilter('pipeline')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            sectionFilter === 'pipeline'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>営業・商談パイプライン</span>
        </button>
      </div>

      {/* SECTION 1: INFLOW & RESPONSE ANALYSIS (CRM実データ自動集計) */}
      {(sectionFilter === 'all' || sectionFilter === 'inflow') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-600" />
              流入・反響 ＆ 獲得チャネル分析（CRM実データ自動集計）
            </h2>
            <span className="text-xs text-slate-400">DB自動連携</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Conversion Funnel Overview */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">反響から成約へのコンバージョンファネル</h3>
                  <p className="text-xs text-slate-500 mt-0.5">リード獲得 → 商談化 → 受注成約への歩留まり</p>
                </div>
                <span className="text-xs font-mono text-purple-600 font-semibold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">リアルタイム</span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <span className="text-xs text-slate-600 font-semibold block">1. 反響・リード</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">{loading ? '...' : totalLeads}</span>
                  <span className="text-[11px] text-slate-400 block mt-1">基準 100%</span>
                </div>

                <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4 text-center relative">
                  <span className="text-xs text-purple-700 font-semibold block">2. 商談化</span>
                  <span className="text-2xl font-black text-purple-900 mt-1 block">{loading ? '...' : pipelineSummary.totalDeals}</span>
                  <span className="text-[11px] text-purple-600 block mt-1 font-medium">商談化率: {leadToDealRate}%</span>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 text-center">
                  <span className="text-xs text-emerald-800 font-semibold block">3. 受注・成約</span>
                  <span className="text-2xl font-black text-emerald-800 mt-1 block">{loading ? '...' : pipelineSummary.wonCount}</span>
                  <span className="text-[11px] text-emerald-700 block mt-1 font-medium">成約率: {dealToWonRate}%</span>
                </div>
              </div>

              {/* Progress Bar Visualization */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>商談化プロセス進行度</span>
                  <span>全成約 {pipelineSummary.wonCount} 件 / 商談 {pipelineSummary.totalDeals} 件</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, Number(dealToWonRate)))}%` }}
                    title={`成約率: ${dealToWonRate}%`}
                  />
                  <div 
                    className="bg-purple-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, Number(leadToDealRate) - Number(dealToWonRate)))}%` }}
                    title={`商談中`}
                  />
                </div>
              </div>
            </div>

            {/* Inflow Sources Breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-purple-600" />
                  流入チャネル別 反響数
                </h3>
                <button
                  onClick={() => onNavigateTab('leads')}
                  className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
                >
                  リード一覧
                </button>
              </div>

              <div className="space-y-2.5">
                {inflowBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">流入データ集計中...</p>
                ) : (
                  inflowBreakdown.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium truncate max-w-[150px]">{item.source}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono text-[11px]">{item.percentage}%</span>
                          <span className="text-slate-900 font-bold font-mono">{item.count}件</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-500 h-full rounded-full" 
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Diagnoses & AI Reports Summary Banner */}
          <div className="bg-gradient-to-r from-purple-50/60 via-white to-slate-50 border border-purple-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-xs font-semibold">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>フォーム・診断反響</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  フォーム・診断・AIレポート
                </h3>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  フォーム回答の受付・確認から、社内診断、AIレポートの作成・発行までを一元管理。反響内容を確認してから商談・レポート発行へ進めます。
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-200 text-center shadow-xs">
                  <div className="px-3">
                    <span className="text-[10px] text-slate-400 block font-medium">診断総数</span>
                    <span className="text-lg font-black text-slate-900">{loading ? '...' : diagnosisStats.total}</span>
                  </div>
                  <div className="px-3 border-l border-slate-100">
                    <span className="text-[10px] text-amber-700 block font-medium">未確認回答</span>
                    <span className="text-lg font-black text-amber-600">
                      {loading ? '...' : diagnosisStats.byStatus.received}
                    </span>
                  </div>
                  <div className="px-3 border-l border-slate-100">
                    <span className="text-[10px] text-purple-700 block font-medium">レポート発行</span>
                    <span className="text-lg font-black text-purple-700">
                      {loading ? '...' : diagnosisStats.byStatus.reported}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    onClick={() => onNavigateTab('unified_calendar')}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>予定カレンダー</span>
                  </button>
                  <button
                    onClick={() => onNavigateTab('mst_diagnoses')}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <span>診断一覧へ</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: SALES PIPELINE & DEALS HIGHLIGHT */}
      {(sectionFilter === 'all' || sectionFilter === 'pipeline') && (
        <section className="space-y-6">
          {/* Business Funnel Pipeline Overview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              営業プロセス・ファネル概況
            </h2>
            <p className="text-xs text-slate-500">
              企業マスタから顧客成約までのリレーションフロー
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
              <div 
                onClick={() => onNavigateTab('companies')}
                className="cursor-pointer bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl p-4 transition-colors"
              >
                <div className="text-xs font-semibold text-blue-700">STEP 1. 会社マスタ</div>
                <p className="text-[11px] text-slate-500 mt-1">企業・担当者情報</p>
              </div>

              <div 
                onClick={() => onNavigateTab('prospects')}
                className="cursor-pointer bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl p-4 transition-colors"
              >
                <div className="text-xs font-semibold text-amber-700">STEP 2. 見込み企業</div>
                <p className="text-[11px] text-slate-500 mt-1">アプローチ候補</p>
              </div>

              <div 
                onClick={() => onNavigateTab('leads')}
                className="cursor-pointer bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl p-4 transition-colors"
              >
                <div className="text-xs font-semibold text-purple-700">STEP 3. リード</div>
                <p className="text-[11px] text-slate-500 mt-1">問い合わせ・反響情報</p>
              </div>

              <div 
                onClick={() => onNavigateTab('deals')}
                className="cursor-pointer bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl p-4 transition-colors"
              >
                <div className="text-xs font-semibold text-emerald-700">STEP 4. 商談</div>
                <p className="text-[11px] text-slate-500 mt-1">提案から成約まで</p>
              </div>

              <div 
                onClick={() => onNavigateTab('customers')}
                className="cursor-pointer bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-xl p-4 transition-colors col-span-2 sm:col-span-1"
              >
                <div className="text-xs font-semibold text-rose-700">STEP 5. 顧客</div>
                <p className="text-[11px] text-slate-500 mt-1">契約後の支援管理</p>
              </div>
            </div>
          </div>

          {/* Recent Deals Table Highlight */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  進行中商談ハイライト (deals)
                </h2>
                <p className="text-xs text-slate-500">取引先・提案商品が紐づいた主要商談パイプライン</p>
              </div>
              <button
                onClick={() => onNavigateTab('deals')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <span>全商談を見る</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                データを読み込み中...
              </div>
            ) : recentDeals.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">登録されている商談データはありません。</p>
                <button
                  onClick={() => onOpenCreate('deals')}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>商談を新規登録</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">提案プラン・商談名</th>
                      <th className="py-2.5 px-3">取引先会社</th>
                      <th className="py-2.5 px-3">提案商品</th>
                      <th className="py-2.5 px-3">ステータス</th>
                      <th className="py-2.5 px-3 text-right">想定総額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentDeals.map((deal) => (
                      <tr 
                        key={deal.id}
                        onClick={() => onNavigateTab('deals')}
                        className="hover:bg-purple-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {deal.proposal_plan_name || deal.deal_name || `商談 #${deal.id}`}
                        </td>
                        <td className="py-3 px-3">
                          {deal.company?.company_name ? (
                            <span className="font-semibold text-purple-700">{deal.company.company_name}</span>
                          ) : (
                            <span className="font-mono text-slate-400">{deal.company_id || '-'}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {deal.product?.product_name || (deal.product_id ? String(deal.product_id) : '-')}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] border ${getStatusBadgeClass(deal.proposal_status || deal.stage)}`}>
                            {deal.proposal_status || deal.stage || '検討中'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {deal.total_amount !== undefined && deal.total_amount !== null
                            ? `¥${Number(deal.total_amount).toLocaleString()}`
                            : deal.amount
                            ? `¥${Number(deal.amount).toLocaleString()}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 3: 7 TABLES MASTER COUNT CARDS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-purple-600" />
            管理対象テーブル一覧 &amp; レコード件数
          </h2>
          <span className="text-xs text-slate-400">全7テーブル</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(TABLE_CONFIGS) as TableKey[]).map((key) => {
            const cfg = TABLE_CONFIGS[key];
            const count = counts[key] || 0;
            const theme = TABLE_THEMES[key] ?? { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' };

            return (
              <div
                key={key}
                className="group relative bg-white hover:border-purple-300 border border-slate-200 rounded-xl p-5 transition-all shadow-xs hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${theme.bg} ${theme.border} border`}>
                    {TABLE_ICONS[key] ?? <Layers className="w-5 h-5 text-slate-500" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenCreate(key)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-purple-600 text-slate-500 hover:text-white border border-slate-200 transition-colors"
                      title={`${cfg.label}に新規登録`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onNavigateTab(key)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors"
                      title={`${cfg.label}一覧を開く`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-slate-900">{cfg.label}</span>
                    <span className="text-xs font-mono text-slate-400">{key}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 min-h-[32px]">
                    {cfg.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {loading ? '...' : count.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">件</span>
                  </div>
                  <button
                    onClick={() => onNavigateTab(key)}
                    className="text-xs font-semibold text-purple-600 group-hover:text-purple-700 flex items-center gap-1 transition-colors"
                  >
                    <span>データを見る</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
