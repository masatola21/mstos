import React, { useState } from 'react';
import { 
  Briefcase, 
  Layers, 
  Megaphone, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpRight, 
  ShieldCheck, 
  TrendingUp, 
  Calendar,
  Receipt,
  FileCheck2,
  Users
} from 'lucide-react';
import { BusinessCategory, BUSINESS_CATEGORIES, ManagedContract, ManagedInvoice, ManagedToolAsset, ManagedProduct } from '../../types/matrix';
import { Project, TaskItem, ApprovalItem } from '../../types/ai-president';
import { monthJst, todayJst } from '../../utils/date';

interface CategoryHubViewProps {
  products: ManagedProduct[];
  contracts: ManagedContract[];
  invoices: ManagedInvoice[];
  tools: ManagedToolAsset[];
  tasks: TaskItem[];
  projects: Project[];
  approvals: ApprovalItem[];
  topGoal: string;
  onNavigateTab?: (tab: string) => void;
}

export const CategoryHubView: React.FC<CategoryHubViewProps> = ({
  products,
  contracts,
  invoices,
  tools,
  tasks,
  projects,
  approvals,
  topGoal,
  onNavigateTab,
}) => {
  const [activeCategory, setActiveCategory] = useState<BusinessCategory>('management');

  // Invoice amounts are stored net of tax; missing tax is treated as zero.
  const grossAmount = (invoice: ManagedInvoice) => invoice.amount + (invoice.taxAmount ?? 0);
  const currentMonth = monthJst();
  const today = todayJst();
  const monthlyPaidTotal = invoices.filter((invoice) => invoice.status === 'paid' && invoice.paidDate?.slice(0, 7) === currentMonth)
    .reduce((sum, invoice) => sum + grossAmount(invoice), 0);
  const totalRevenue = invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + grossAmount(invoice), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'issued');
  const pendingInvoicesTotal = pendingInvoices.reduce((sum, invoice) => sum + grossAmount(invoice), 0);
  const overdueInvoices = pendingInvoices.filter((invoice) => Boolean(invoice.dueDate) && invoice.dueDate < today);
  const overdueInvoicesTotal = overdueInvoices.reduce((sum, invoice) => sum + grossAmount(invoice), 0);
  const activeContracts = contracts.filter(c => c.status === 'signed');
  const pendingApprovals = approvals.filter(a => a.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-emerald-400" />
              業務機能カテゴリー管理
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              マトリクス横軸ビュー
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            経営・開発・マーケティング・顧客サービス（契約・請求）の職能別ステータスを一括統括
          </p>
        </div>

        {/* Global Mini Stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[10px] text-slate-400 block">今月の入金（税込）</span>
            <span className="text-xs font-bold text-emerald-400">¥{monthlyPaidTotal.toLocaleString()}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[10px] text-slate-400 block">未入金（税込）</span>
            <span className="text-xs font-bold text-amber-400">¥{pendingInvoicesTotal.toLocaleString()}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[10px] text-slate-400 block">うち期限超過（税込）</span>
            <span className="text-xs font-bold text-rose-400">¥{overdueInvoicesTotal.toLocaleString()}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[10px] text-slate-400 block">入金累計（税込）</span>
            <span className="text-xs font-bold text-cyan-400">¥{totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(BUSINESS_CATEGORIES) as BusinessCategory[]).map((catKey) => {
          const cat = BUSINESS_CATEGORIES[catKey];
          const isSelected = activeCategory === catKey;
          return (
            <button
              key={catKey}
              onClick={() => setActiveCategory(catKey)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/60 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  {cat.name}
                </span>
                {catKey === 'management' && <Briefcase className="w-4 h-4 text-emerald-400" />}
                {catKey === 'product_dev' && <Layers className="w-4 h-4 text-blue-400" />}
                {catKey === 'marketing' && <Megaphone className="w-4 h-4 text-purple-400" />}
                {catKey === 'customer_service' && <FileText className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {cat.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Detail Panels by Category */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* 1. 経営管理 */}
        {activeCategory === 'management' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  経営管理・全体方針・承認決裁
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  経営目標の進捗、未処理の意思決定、全社KPIを管理します。
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                承認待ち: {pendingApprovals.length}件
              </span>
            </div>

            {/* Top Goal Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30">
              <span className="text-[10px] font-semibold text-emerald-400 tracking-wider uppercase block mb-1">
                現在推進中の最重要経営目標 (Top Goal)
              </span>
              <p className="text-sm font-bold text-white">
                {topGoal || '目標未設定'}
              </p>
            </div>

            {/* Approval List */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                AI社長・現場からの承認申請一覧
              </h4>
              <div className="space-y-2">
                {approvals.slice(0, 4).map((app) => (
                  <div
                    key={app.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{app.actionTitle}</span>
                      <p className="text-[10px] text-slate-400">{app.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">申請: {app.requestedBy}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        app.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {app.status === 'pending' ? '承認待ち' : '承認済'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. 商品開発 */}
        {activeCategory === 'product_dev' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  商品開発・プロジェクト・要件定義
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  全商品の開発ロードマップ、タスク、および社内自動化ツールの進捗を管理します。
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                商品数: {products.length}品目
              </span>
            </div>

            {/* Products & Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300">開発中・運用中商品</h4>
                <div className="space-y-2">
                  {products.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{p.name}</span>
                        <span className="text-[10px] text-slate-400 block">{p.category}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-300">
                        ¥{(p.price || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300">推進中プロジェクト</h4>
                <div className="space-y-2">
                  {projects.map((proj) => (
                    <div key={proj.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{proj.name}</span>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{proj.objective}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        {proj.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. マーケティング */}
        {activeCategory === 'marketing' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-purple-400" />
                  マーケティング・スケジュール・プロモーションツール
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  集客施策、LP、自動化スクリプト、リード獲得状況を一括管理します。
                </p>
              </div>
            </div>

            {/* Marketing Tools List */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 mb-3">活用中の集客・販促ツール</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tools.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{t.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        {t.toolType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{t.description}</p>
                    {t.url && (
                      <span className="text-[10px] text-blue-400 truncate block">URL: {t.url}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. 顧客サービス管理 */}
        {activeCategory === 'customer_service' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  顧客サービス管理（契約書・請求書・納品）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  法務契約のステータス、入金期日管理、請求書発行状況を一括統制します。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  有効契約: {activeContracts.length}件
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  未入金: {pendingInvoices.length}件
                </span>
              </div>
            </div>

            {/* Split Contracts & Invoices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contracts */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  契約書一覧
                </h4>
                <div className="space-y-2">
                  {contracts.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{c.title}</span>
                        <span className="text-[10px] text-slate-400 block">{c.counterpartyName}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        c.status === 'signed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {c.status === 'signed' ? '締結済' : '確認中'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoices */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-cyan-400" />
                  請求書・入金一覧
                </h4>
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{inv.title}</span>
                        <span className="text-[10px] text-slate-400 block">{inv.recipientName} - 期日: {inv.dueDate}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-cyan-400 block">税込 ¥{grossAmount(inv).toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 block">税抜 ¥{inv.amount.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 block">{inv.taxAmount == null ? '税額未設定' : `消費税 ¥${inv.taxAmount.toLocaleString()}`}</span>
                        {inv.status === 'paid' && inv.paidDate && <span className="text-[9px] text-slate-500 block">入金日: {inv.paidDate}</span>}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded ${
                          inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {inv.status === 'paid' ? '入金済' : '請求済'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

