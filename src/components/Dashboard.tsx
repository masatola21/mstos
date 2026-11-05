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
  MessageSquare,
  ShieldAlert,
  Power,
  Play,
  Pause,
  X
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

  // ─── 緊急停止（キルスイッチ）状態管理 ───
  const [automationControls, setAutomationControls] = useState<Array<{
    target: 'all' | 'ai' | 'send' | 'billing';
    paused: boolean;
    reason: string;
    updated_by?: string;
    updated_at?: string;
  }>>([
    { target: 'all', paused: false, reason: '' },
    { target: 'ai', paused: false, reason: '' },
    { target: 'send', paused: false, reason: '' },
    { target: 'billing', paused: false, reason: '' },
  ]);
  const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
  const [selectedKillSwitchTarget, setSelectedKillSwitchTarget] = useState<'all' | 'ai' | 'send' | 'billing'>('all');
  const [killSwitchReasonInput, setKillSwitchReasonInput] = useState('');
  const [killSwitchUpdating, setKillSwitchUpdating] = useState(false);
  const [killSwitchMessage, setKillSwitchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAutomationControls = async () => {
    try {
      const res = await fetch('/api/admin/automation-controls');
      if (res.ok) {
        const data = await res.json();
        if (data.controls && Array.isArray(data.controls)) {
          const map = new Map<string, any>();
          ['all', 'ai', 'send', 'billing'].forEach((t) => {
            map.set(t, { target: t, paused: false, reason: '' });
          });
          data.controls.forEach((c: any) => {
            if (map.has(c.target)) map.set(c.target, c);
          });
          setAutomationControls(Array.from(map.values()));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch automation controls:', err);
    }
  };

  const handleToggleKillSwitch = async (
    target: 'all' | 'ai' | 'send' | 'billing',
    nextPaused: boolean,
    customReason?: string
  ) => {
    setKillSwitchUpdating(true);
    setKillSwitchMessage(null);
    try {
      const supabase = getSupabase();
      let token = '';
      if (supabase) {
        const session = (await supabase.auth.getSession()).data.session;
        token = session?.access_token || '';
      }

      const reason = customReason !== undefined ? customReason : killSwitchReasonInput.trim();
      const res = await fetch('/api/admin/automation-controls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          target,
          paused: nextPaused,
          reason: reason || (nextPaused ? '管理者による緊急停止' : '通常稼働に復旧'),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'キルスイッチの更新に失敗しました');
      }

      await loadAutomationControls();
      const targetLabel = target === 'all' ? '全体' : target === 'ai' ? 'AI機能' : target === 'send' ? '自動配信' : '請求自動化';
      setKillSwitchMessage({
        type: 'success',
        text: nextPaused ? `【緊急停止】${targetLabel}の自動処理を停止しました。` : `【稼働再開】${targetLabel}の自動処理を再開しました。`,
      });
      setKillSwitchReasonInput('');
    } catch (err: any) {
      setKillSwitchMessage({
        type: 'error',
        text: err.message || '更新中にエラーが発生しました。',
      });
    } finally {
      setKillSwitchUpdating(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    loadAutomationControls();
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

          {/* Claudeレビュー指摘: 緊急停止（キルスイッチ）ボタン */}
          {(() => {
            const pausedItems = automationControls.filter((c) => c.paused);
            const isAnyPaused = pausedItems.length > 0;
            const targetMap: Record<string, string> = { all: '全体', ai: 'AI', send: '配信', billing: '請求' };
            return (
              <button
                type="button"
                onClick={() => {
                  setIsKillSwitchModalOpen(true);
                  setKillSwitchMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAnyPaused
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-400/50 animate-pulse'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
                title="AI・配信・請求自動化の緊急停止（キルスイッチ）を設定"
              >
                <ShieldAlert className={`w-3.5 h-3.5 ${isAnyPaused ? 'text-white' : 'text-rose-500'}`} />
                <span>{isAnyPaused ? `🚨 緊急停止中 (${pausedItems.map((p) => targetMap[p.target] || p.target).join('/')})` : '緊急停止'}</span>
              </button>
            );
          })()}

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

      {/* ─── 緊急停止（キルスイッチ）管理モーダル ─── */}
      {isKillSwitchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">自動化緊急停止（キルスイッチ）</h3>
                  <p className="text-xs text-slate-500">
                    暴走防止・メンテナンス時の即時停止用スイッチ（DB連動・サーバーリアルタイム反映）
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKillSwitchModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification message */}
            {killSwitchMessage && (
              <div
                className={`mx-6 mt-4 p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
                  killSwitchMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span>{killSwitchMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setKillSwitchMessage(null)}
                  className="text-slate-400 hover:text-slate-600 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Targets List */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  停止対象を選択
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      target: 'all' as const,
                      title: '🚨 全体一括停止',
                      desc: 'AI、メール/LINE自動配信、請求連携すべての自動処理を即座に停止します。',
                      tagColor: 'border-slate-300',
                    },
                    {
                      target: 'ai' as const,
                      title: '🤖 AI機能停止',
                      desc: 'チャット、キャラクター自動生成、記憶抽出などのLLM呼び出しを停止（503返却）。',
                      tagColor: 'border-purple-200',
                    },
                    {
                      target: 'send' as const,
                      title: '✉️ 自動配信停止',
                      desc: 'マーケティングシナリオのメール・LINE送信キュー処理を一時中断します。',
                      tagColor: 'border-blue-200',
                    },
                    {
                      target: 'billing' as const,
                      title: '📑 請求自動化停止',
                      desc: '期限超過請求書の督促タスク起票・当月定期請求書の下書き自動生成を停止します。',
                      tagColor: 'border-emerald-200',
                    },
                  ].map((item) => {
                    const control = automationControls.find((c) => c.target === item.target);
                    const isPaused = Boolean(control?.paused);
                    const isSelected = selectedKillSwitchTarget === item.target;

                    return (
                      <div
                        key={item.target}
                        onClick={() => setSelectedKillSwitchTarget(item.target)}
                        className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer text-left relative ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="font-bold text-sm text-slate-800">{item.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPaused
                                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            }`}
                          >
                            {isPaused ? '🔴 停止中' : '🟢 稼働中'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.desc}</p>
                        {isPaused && control?.reason && (
                          <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-100">
                            理由: {control.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Target Action Panel */}
              {(() => {
                const currentControl = automationControls.find((c) => c.target === selectedKillSwitchTarget);
                const isPaused = Boolean(currentControl?.paused);
                const targetLabels: Record<string, string> = {
                  all: '全体一括',
                  ai: 'AI機能',
                  send: '自動配信（メール/LINE）',
                  billing: '請求自動化',
                };

                return (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">
                          選択中: {targetLabels[selectedKillSwitchTarget]}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isPaused
                              ? 'bg-rose-100 text-rose-700 border border-rose-300'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          }`}
                        >
                          現在: {isPaused ? '緊急停止中' : '正常稼働中'}
                        </span>
                      </div>
                      {currentControl?.updated_at && (
                        <span className="text-[11px] text-slate-400">
                          最終更新: {new Date(currentControl.updated_at).toLocaleString('ja-JP')}
                          {currentControl.updated_by ? ` (${currentControl.updated_by})` : ''}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">
                        停止・再開の理由 / メモ（任意）
                      </label>
                      <input
                        type="text"
                        value={killSwitchReasonInput}
                        onChange={(e) => setKillSwitchReasonInput(e.target.value)}
                        placeholder={
                          isPaused
                            ? '例: メンテナンス完了のため再開'
                            : '例: API制限到達による一時停止 / 誤配信防止'
                        }
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-end gap-2">
                      {isPaused ? (
                        <button
                          type="button"
                          disabled={killSwitchUpdating}
                          onClick={() => handleToggleKillSwitch(selectedKillSwitchTarget, false)}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{killSwitchUpdating ? '更新中...' : '稼働を再開する'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={killSwitchUpdating}
                          onClick={() => handleToggleKillSwitch(selectedKillSwitchTarget, true)}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>{killSwitchUpdating ? '更新中...' : '緊急停止を実行する'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                ※ 停止すると該当機能へのAPIリクエストは直ちに拒否またはスキップされます。
              </span>
              <button
                type="button"
                onClick={() => setIsKillSwitchModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
