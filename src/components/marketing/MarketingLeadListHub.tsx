import React from 'react';
import { Users, Building2, Sparkles, ArrowRight, BookOpen, Send, Zap } from 'lucide-react';
import { ContactsLineHub } from '../ContactsLineHub';
import { TableManager } from '../TableManager';
import { TableKey } from '../../types/database';

interface MarketingLeadListHubProps {
  activeTab: 'contacts' | 'prospects';
  onTabChange: (tab: 'contacts' | 'prospects') => void;
  onOpenLineInbox?: (contactId: string, lineUserId: string) => void;
  onOpenEmailSend?: (contactId: string, companyId?: string) => void;
  onOpenCustomerWorkspace?: (
    companyId: string,
    destination: 'documents' | 'operations' | 'diagnoses' | 'forms' | 'send',
    recordContext?: { tableKey: TableKey; recordId: string; leadId?: string; contactId?: string }
  ) => void;
  onOpenRls: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const MarketingLeadListHub: React.FC<MarketingLeadListHubProps> = ({
  activeTab,
  onTabChange,
  onOpenLineInbox,
  onOpenEmailSend,
  onOpenCustomerWorkspace,
  onOpenRls,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-4">
      {/* 統合ナビゲーションタブ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* タブ切り替えボタン */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onTabChange('contacts')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className={`h-4 w-4 ${activeTab === 'contacts' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>LINE友だち・連絡先名簿</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'contacts'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                インバウンド
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('prospects')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'prospects'
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Building2 className={`h-4 w-4 ${activeTab === 'prospects' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>見込み企業アプローチ</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'prospects'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                アウトバウンド
              </span>
            </button>
          </div>

          {/* ガイドバッジ / フロー誘導 */}
          <div className="flex items-center gap-2 text-xs text-slate-500 hidden md:flex">
            <span className="text-[11px] text-slate-400">
              {activeTab === 'contacts'
                ? '友だち・担当者へのタグ付け & シナリオ配信で反響を育成'
                : 'AI検索・営業メール5段階配信で反響（リード化）を獲得'}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('leads')}
              className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>反響リード管理へ</span>
            </button>
          </div>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div>
        {activeTab === 'contacts' ? (
          <ContactsLineHub
            onOpenLineInbox={onOpenLineInbox}
            onOpenEmailSend={onOpenEmailSend}
          />
        ) : (
          <TableManager
            currentTable="prospects"
            onTableChange={(table) => {
              if (table === 'contacts') onTabChange('contacts');
              else if (onNavigateTab) onNavigateTab(table);
            }}
            onOpenRls={onOpenRls}
            onOpenCustomerWorkspace={onOpenCustomerWorkspace}
          />
        )}
      </div>
    </div>
  );
};
