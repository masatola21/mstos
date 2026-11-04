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
  RefreshCw, 
  AlertCircle,
  FileCode2,
  DollarSign,
  Layers,
  ChevronRight,
  ClipboardList,
  Users,
  Calendar,
  Megaphone,
  Globe,
  CheckCircle2,
  Sparkles,
  MessageSquare
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

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateTab,
  onOpenCreate,
  onOpenRls,
}) => {
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
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto">
      {/* ─── 1. Header: 統一経営ダッシュボード ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">
          経営ダッシュボード
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* AI社長室チャットへ直結 */}
          <button
            type="button"
            onClick={() => onNavigateTab('ai_chat')}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="AI社長と経営戦略・課題・施策をチャットで相談"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI社長室に相談</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('unified_calendar')}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>予定カレンダー</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            title="最新データを再集計"
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

      {/* ─── 2. Top Level: 最重要4大経営KPIカード ─── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: 受注・確定売上総額 */}
        <div 
          onClick={() => onNavigateTab('customers')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-600" />
              受注・確定売上総額
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              確定業績
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `¥${pipelineSummary.wonAmount.toLocaleString('ja-JP')}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>成約 / 契約社数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.wonCount} 件 / {counts.customers} 社</span>
          </div>
        </div>

        {/* KPI 2: 進行中 商談金額 */}
        <div 
          onClick={() => onNavigateTab('deals')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group"
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
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `¥${pipelineSummary.amount.toLocaleString('ja-JP')}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>商談中 案件数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.count} 件</span>
          </div>
        </div>

        {/* KPI 3: 反響・総リード数 */}
        <div 
          onClick={() => onNavigateTab('leads')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600" />
              反響・総リード獲得
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
              集客成果
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : totalLeads.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">件</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>商談化率</span>
            <span className="font-bold text-purple-700">{leadToDealRate}%</span>
          </div>
        </div>

        {/* KPI 4: 商談成約率 */}
        <div 
          onClick={() => onNavigateTab('deals')}
          className="cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              商談成約率 (受注率)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
              営業効率
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {loading ? '...' : `${dealToWonRate}%`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
            <span>成約件数</span>
            <span className="font-bold text-slate-800">{pipelineSummary.wonCount} 件</span>
          </div>
        </div>
      </section>

      {/* ─── 3. AI社長室 クイック経営アクションバナー ─── */}
      <div className="bg-gradient-to-r from-purple-50 via-white to-slate-50 border border-purple-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">AI社長室 × 経営参謀</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-semibold">リアルタイム支援</span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              進行中商談 ¥{pipelineSummary.amount.toLocaleString()} と反響リード {totalLeads}件 のデータに基づき、次のアクション・優先施策をAIと即時壁打ちできます。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => onNavigateTab('ai_chat')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI社長に相談する</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('ai_tasks')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>全社タスク・承認</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* ─── 4. 2カラム構成: 左(反響・流入経路) × 右(進行中商談ハイライト) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側: 流入経路・反響分析 (5カラム) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                <h2 className="font-bold text-sm text-slate-900">反響・流入チャネル内訳</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('leads')}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>リード台帳</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {inflowBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">データ集計中...</p>
              ) : (
                inflowBreakdown.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[180px]">{item.source}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">{item.percentage}%</span>
                        <span className="text-slate-900 font-bold">{item.count}件</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 診断・フォーム反響ミニサマリー */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-[11px] text-slate-500 block">診断フォーム総回答</span>
                <span className="text-base font-bold text-slate-900 font-mono">{diagnosisStats.total} 件</span>
              </div>
              <div>
                <span className="text-[11px] text-amber-700 block">未確認回答</span>
                <span className="text-base font-bold text-amber-700 font-mono">{diagnosisStats.byStatus.received} 件</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('mst_diagnoses')}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                診断設計へ
              </button>
            </div>
          </div>
        </div>

        {/* 右側: 進行中 商談ハイライト (7カラム) */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-sm text-slate-900">直近の商談パイプライン</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('deals')}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>全商談を見る</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                商談データを読み込み中...
              </div>
            ) : recentDeals.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">現在進行中の商談はありません。</p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('deals')}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <span>商談パイプラインを開く</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">提案プラン・商談名</th>
                      <th className="py-2.5 px-3">取引先会社</th>
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
        </div>
      </div>

      {/* ─── 5. 全社台帳クイックサマリー（コンパクトな数値バー） ─── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>主要台帳レコード概況</span>
          </h2>
          <span className="text-[11px] text-slate-400">クリックで各一覧へ直接ジャンプ</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'companies', label: '会社台帳', count: counts.companies, tab: 'companies', color: 'text-blue-700' },
            { key: 'contacts', label: '連絡先・友だち', count: counts.contacts, tab: 'contacts', color: 'text-teal-700' },
            { key: 'prospects', label: '見込み企業', count: counts.prospects, tab: 'contacts', color: 'text-amber-700' },
            { key: 'leads', label: '反響リード', count: counts.leads, tab: 'leads', color: 'text-purple-700' },
            { key: 'deals', label: '商談案件', count: counts.deals, tab: 'deals', color: 'text-emerald-700' },
            { key: 'customers', label: '契約顧客', count: counts.customers, tab: 'customers', color: 'text-rose-700' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigateTab(item.tab)}
              className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 transition-all text-left cursor-pointer group"
            >
              <span className="text-[11px] font-medium text-slate-500 block">{item.label}</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-lg font-black font-mono ${item.color}`}>
                  {loading ? '...' : item.count.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">件</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
