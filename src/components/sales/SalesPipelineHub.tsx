import React from 'react';
import { Sparkles, Briefcase, UserCheck, Inbox, ArrowRight, FileText, Receipt, CheckCircle2, ChevronRight } from 'lucide-react';
import { TableManager } from '../TableManager';
import { TableKey } from '../../types/database';

interface SalesPipelineHubProps {
  activeTab: 'leads' | 'deals' | 'customers';
  onTabChange: (tab: 'leads' | 'deals' | 'customers') => void;
  onOpenRls: () => void;
  onOpenCustomerWorkspace?: (
    companyId: string,
    destination: 'documents' | 'operations' | 'diagnoses' | 'forms' | 'send',
    recordContext?: { tableKey: TableKey; recordId: string; leadId?: string; contactId?: string }
  ) => void;
  onNavigateTab?: (tab: string) => void;
}

export const SalesPipelineHub: React.FC<SalesPipelineHubProps> = ({
  activeTab,
  onTabChange,
  onOpenRls,
  onOpenCustomerWorkspace,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-4">
      {/* 案件パイプライン統合ナビゲーション */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* タブ切り替えボタン */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 w-full lg:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => onTabChange('leads')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'leads'
                  ? 'bg-white text-amber-700 shadow-xs border border-amber-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Inbox className={`h-4 w-4 ${activeTab === 'leads' ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>1. 反響リード管理</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'leads' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/80 text-slate-600'
              }`}>
                問い合わせ・診断
              </span>
            </button>

            <ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden sm:block shrink-0" />

            <button
              type="button"
              onClick={() => onTabChange('deals')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'deals'
                  ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Briefcase className={`h-4 w-4 ${activeTab === 'deals' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>2. 商談パイプライン</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'deals' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200/80 text-slate-600'
              }`}>
                提案・見積提示
              </span>
            </button>

            <ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden sm:block shrink-0" />

            <button
              type="button"
              onClick={() => onTabChange('customers')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'customers'
                  ? 'bg-white text-emerald-700 shadow-xs border border-emerald-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <UserCheck className={`h-4 w-4 ${activeTab === 'customers' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>3. 契約顧客台帳</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'customers' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-600'
              }`}>
                成約企業
              </span>
            </button>
          </div>

          {/* 右側：次フェーズへのクイックアクション案内 */}
          <div className="flex items-center gap-2 text-xs text-slate-500 hidden xl:flex">
            {activeTab === 'customers' ? (
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('customer_operations')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-purple-700 transition cursor-pointer shadow-2xs"
              >
                <Receipt className="h-3.5 w-3.5 text-purple-600" />
                <span>契約・請求・顧問支援を開く</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('document_templates')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-purple-700 transition cursor-pointer shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                <span>重要書類・見積・契約を開く</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div>
        <TableManager
          key={activeTab}
          currentTable={activeTab}
          onTableChange={(table) => {
            if (table === 'leads' || table === 'deals' || table === 'customers') {
              onTabChange(table);
            } else if (onNavigateTab) {
              onNavigateTab(table);
            }
          }}
          onOpenRls={onOpenRls}
          onOpenCustomerWorkspace={onOpenCustomerWorkspace}
        />
      </div>
    </div>
  );
};
