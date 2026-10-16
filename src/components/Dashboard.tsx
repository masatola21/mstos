import React, { useEffect, useState } from 'react';
import { TableKey, TABLE_CONFIGS, DiagnosisStatus } from '../types/database';
import { fetchTableCounts, fetchTableData, fetchDiagnosisCounts, DataFetchError } from '../services/dataService';
import { 
  Building2, 
  Target, 
  UserCheck, 
  Package, 
  TrendingUp, 
  ShieldCheck, 
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
  Users
} from 'lucide-react';

interface DashboardProps {
  onNavigateTab: (tab: any) => void;
  onOpenCreate: (tab: TableKey) => void;
  onOpenRls: () => void;
}

const TABLE_ICONS: Partial<Record<TableKey, React.ReactNode>> = {
  companies: <Building2 className="w-5 h-5 text-blue-400" />,
  contacts: <Users className="w-5 h-5 text-teal-400" />,
  prospects: <Target className="w-5 h-5 text-amber-400" />,
  leads: <Layers className="w-5 h-5 text-cyan-400" />,
  products: <Package className="w-5 h-5 text-purple-400" />,
  deals: <TrendingUp className="w-5 h-5 text-emerald-400" />,
  customers: <UserCheck className="w-5 h-5 text-pink-400" />,
};

const TABLE_THEMES: Partial<Record<TableKey, { bg: string; border: string; text: string }>> = {
  companies: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
  contacts: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400' },
  prospects: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  leads: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400' },
  products: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' },
  deals: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  customers: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400' },
};

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
      const [tableRes, diagRes, dealsRes] = await Promise.all([
        fetchTableCounts(),
        fetchDiagnosisCounts(),
        fetchTableData('deals'),
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
        setRecentDeals(dealsRes.data.slice(0, 5));
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

  const totalPipelineAmount = recentDeals.reduce((sum, d) => sum + (Number(d.total_amount || d.amount) || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
            <span>社内営業パイプラインOS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            経営＆営業ダッシュボード
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Supabase既存7テーブルと連携した統合営業データ管理・モニタリング
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>最新情報に更新</span>
          </button>
        </div>
      </div>

      {/* RLS / Permission Notice if detected */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-300">
                {fetchError.type === 'PERMISSION_DENIED' ? 'データベース権限（RLS）の確認が必要です' : 'データ取得エラー'}
              </p>
              <p className="text-xs text-amber-200/90 mt-0.5">{fetchError.message}</p>
            </div>
          </div>
          {fetchError.type === 'PERMISSION_DENIED' && (
            <button
              onClick={onOpenRls}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>RLS推奨SQLを確認</span>
            </button>
          )}
        </div>
      )}

      {/* Phase 1-C: Diagnoses & AI Reports Summary Banner */}
      <section className="bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Phase 1-C 実装完了</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              診断＆AIレポート機能（diagnoses / ai_reports）
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              取引先企業のヒアリング回答収集、5カテゴリ回答評価、AIレポート発行パイプライン。設問仕様確定までの安全ガードにより、completed への誤完了を確実に防止しながら下書き保存・回答変更を運用できます。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
            {/* Quick Status Stats */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 text-center">
              <div className="px-3">
                <span className="text-[10px] text-slate-400 block">診断総数</span>
                <span className="text-lg font-black text-white">{loading ? '...' : diagnosisStats.total}</span>
              </div>
              <div className="px-3 border-x border-slate-800">
                <span className="text-[10px] text-sky-400 block">未確認の回答</span>
                <span className="text-lg font-black text-sky-300">
                  {loading ? '...' : diagnosisStats.byStatus.received}
                </span>
              </div>
              <div className="px-3">
                <span className="text-[10px] text-indigo-400 block">レポート発行</span>
                <span className="text-lg font-black text-indigo-300">
                  {loading ? '...' : diagnosisStats.byStatus.reported}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('diagnoses')}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <span>診断一覧・回答入力へ</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 7 Tables Count Cards Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-400" />
            管理対象テーブル一覧 &amp; レコード件数
          </h2>
          <span className="text-xs text-slate-400">全7テーブル</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(TABLE_CONFIGS) as TableKey[]).map((key) => {
            const cfg = TABLE_CONFIGS[key];
            const count = counts[key] || 0;
            const theme = TABLE_THEMES[key] ?? { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400' };

            return (
              <div
                key={key}
                className="group relative bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${theme.bg} ${theme.border} border`}>
                    {TABLE_ICONS[key] ?? <Layers className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenCreate(key)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-colors"
                      title={`${cfg.label}に新規登録`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onNavigateTab(key)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title={`${cfg.label}一覧を開く`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-white">{cfg.label}</span>
                    <span className="text-xs font-mono text-slate-400">{key}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 min-h-[32px]">
                    {cfg.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black text-white tracking-tight">
                      {loading ? '...' : count.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">件</span>
                  </div>
                  <button
                    onClick={() => onNavigateTab(key)}
                    className="text-xs font-semibold text-blue-400 group-hover:text-blue-300 flex items-center gap-1 transition-colors"
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

      {/* Business Funnel Pipeline Overview */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          営業プロセス・ファネル概況
        </h2>
        <p className="text-xs text-slate-400">
          企業マスタから顧客成約までのリレーションフロー
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* Step 1: Companies */}
          <div 
            onClick={() => onNavigateTab('companies')}
            className="cursor-pointer bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-2xl p-4 transition-colors"
          >
            <div className="text-[11px] font-semibold text-blue-400">STEP 1. 会社マスタ</div>
            <div className="text-xl font-black text-white mt-1">{counts.companies.toLocaleString()} <span className="text-xs font-normal text-slate-400">社</span></div>
            <p className="text-[11px] text-slate-400 mt-1">主キー CID-xxx</p>
          </div>

          {/* Step 2: Prospects */}
          <div 
            onClick={() => onNavigateTab('prospects')}
            className="cursor-pointer bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-2xl p-4 transition-colors"
          >
            <div className="text-[11px] font-semibold text-amber-400">STEP 2. 見込み企業</div>
            <div className="text-xl font-black text-white mt-1">{counts.prospects.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span></div>
            <p className="text-[11px] text-slate-400 mt-1">アプローチターゲット</p>
          </div>

          {/* Step 3: Leads */}
          <div 
            onClick={() => onNavigateTab('leads')}
            className="cursor-pointer bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-2xl p-4 transition-colors"
          >
            <div className="text-[11px] font-semibold text-cyan-400">STEP 3. リード</div>
            <div className="text-xl font-black text-white mt-1">{counts.leads.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span></div>
            <p className="text-[11px] text-slate-400 mt-1">問合せ・コンタクト</p>
          </div>

          {/* Step 4: Deals */}
          <div 
            onClick={() => onNavigateTab('deals')}
            className="cursor-pointer bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-2xl p-4 transition-colors"
          >
            <div className="text-[11px] font-semibold text-emerald-400">STEP 4. 商談</div>
            <div className="text-xl font-black text-white mt-1">{counts.deals.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span></div>
            <p className="text-[11px] text-slate-400 mt-1">案件・パイプライン</p>
          </div>

          {/* Step 5: Customers */}
          <div 
            onClick={() => onNavigateTab('customers')}
            className="cursor-pointer bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-2xl p-4 transition-colors col-span-2 sm:col-span-1"
          >
            <div className="text-[11px] font-semibold text-pink-400">STEP 5. 顧客</div>
            <div className="text-xl font-black text-white mt-1">{counts.customers.toLocaleString()} <span className="text-xs font-normal text-slate-400">社</span></div>
            <p className="text-[11px] text-slate-400 mt-1">成約・1社1契約</p>
          </div>
        </div>
      </section>

      {/* Recent Deals Table Highlight */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              直近の商談ハイライト (deals)
            </h2>
            <p className="text-xs text-slate-400">取引先・提案商品が紐づいた主要商談</p>
          </div>
          <button
            onClick={() => onNavigateTab('deals')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <span>全商談を見る</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
            データを読み込み中...
          </div>
        ) : recentDeals.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80">
            <p className="text-xs text-slate-400">登録されている商談データはありません。</p>
            <button
              onClick={() => onOpenCreate('deals')}
              className="mt-3 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>商談を新規登録</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">提案プラン・商談名</th>
                  <th className="py-2.5 px-3">取引先会社</th>
                  <th className="py-2.5 px-3">提案商品</th>
                  <th className="py-2.5 px-3">ステータス</th>
                  <th className="py-2.5 px-3 text-right">想定総額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentDeals.map((deal) => (
                  <tr 
                    key={deal.id}
                    onClick={() => onNavigateTab('deals')}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-medium text-white">
                      {deal.proposal_plan_name || deal.deal_name || `商談 #${deal.id}`}
                    </td>
                    <td className="py-3 px-3">
                      {deal.company?.company_name ? (
                        <span className="font-semibold text-blue-300">{deal.company.company_name}</span>
                      ) : (
                        <span className="font-mono text-slate-400">{deal.company_id || '-'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {deal.product?.product_name || (deal.product_id ? String(deal.product_id) : '-')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {deal.proposal_status || deal.stage || '検討中'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
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
      </section>
    </div>
  );
};
