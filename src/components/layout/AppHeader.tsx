import React from 'react';
import {
  Menu,
  Search,
  Calendar,
  Sparkles,
  Bell,
  LogOut,
  User,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UnifiedNavTab } from '../UnifiedNavbar';

interface AppHeaderProps {
  currentTab: UnifiedNavTab;
  onSelectTab: (tab: UnifiedNavTab) => void;
  onOpenMobileSidebar: () => void;
  pendingApprovalsCount: number;
  workspaceSyncStatus: 'loading' | 'saving' | 'saved' | 'error' | 'conflict';
  workspaceSaveError?: string;
  onOpenQuickAiDrawer: () => void;
  pageAssistantEmoji: string;
  onOpenProfile: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenMobileSidebar,
  pendingApprovalsCount,
  workspaceSyncStatus,
  workspaceSaveError,
  onOpenQuickAiDrawer,
  pageAssistantEmoji,
  onOpenProfile,
}) => {
  const { user, signOut } = useAuth();

  // Breadcrumb mapping
  const getBreadcrumbs = (): { category: string; page: string } => {
    switch (currentTab) {
      case 'mst_dashboard':
      case 'inflow_dashboard':
        return { category: '経営全般', page: 'ダッシュボード' };
      case 'ai_acquisition':
        return { category: 'マーケティング', page: '集客戦略・SNS・メディア' };
      case 'marketing_automation':
        return { category: 'マーケティング', page: 'LINE・メール自動配信' };
      case 'mst_diagnoses':
        return { category: 'マーケティング', page: '受付フォーム・診断設計' };
      case 'prospects':
        return { category: '営業・顧客管理', page: '見込み企業（AI検索）' };
      case 'leads':
        return { category: '営業・顧客管理', page: '反響リード管理' };
      case 'deals':
        return { category: '営業・顧客管理', page: '商談パイプライン' };
      case 'companies':
        return { category: '営業・顧客管理', page: '会社台帳（法人マスタ）' };
      case 'contacts':
        return { category: '営業・顧客管理', page: '連絡先・LINE友だち' };
      case 'customers':
        return { category: '営業・顧客管理', page: '契約顧客台帳' };
      case 'custom_lists':
        return { category: '営業・顧客管理', page: '配信対象セグメント' };
      case 'document_templates':
        return { category: '営業・顧客管理', page: '重要書類・見積・契約' };
      case 'inbox_hub':
        return { category: 'コミュニケーション', page: '統合受信トレイ' };
      case 'communication_send':
      case 'deal_invitations':
      case 'customer_meeting_invitations':
        return { category: 'コミュニケーション', page: '送信センター' };
      case 'unified_calendar':
        return { category: '全社共通', page: '予定カレンダー（Google連携）' };
      case 'product_hub':
        return { category: '事業運営', page: '商品・サービス設計' };
      case 'customer_operations':
        return { category: '事業運営', page: '契約・請求・顧問支援' };
      case 'category_hub':
        return { category: '事業運営', page: '事業マトリクス' };
      case 'ai_chat':
        return { category: 'AI経営室', page: 'AI社長室・対話' };
      case 'ai_tasks':
        return { category: 'AI経営室', page: '共通タスク・承認' };
      case 'ai_projects':
        return { category: 'AI経営室', page: 'プロジェクト管理' };
      case 'ai_knowledge':
        return { category: 'AI経営室', page: 'ナレッジ・成果物保管庫' };
      case 'ai_presets':
        return { category: 'AI経営室', page: '専門AI・役割一覧' };
      case 'automations':
        return { category: 'AI経営室', page: 'AI自動化・承認ルール' };
      default:
        return { category: 'MST AI経営OS', page: String(currentTab) };
    }
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="メニューを開く"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
          <span className="font-semibold text-slate-400 hidden sm:inline">{breadcrumbs.category}</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <h1 className="font-bold text-slate-800 text-sm sm:text-base truncate">{breadcrumbs.page}</h1>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            readOnly
            onClick={() => onSelectTab('mst_dashboard')}
            placeholder="全体検索・移動（顧客、商談、書類、タスク...）"
            className="w-full pl-9 pr-12 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 hover:bg-white focus:bg-white focus:border-purple-500 transition-colors cursor-pointer"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Calendar Jump */}
        <button
          type="button"
          onClick={() => onSelectTab('unified_calendar')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            currentTab === 'unified_calendar'
              ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
          title="商談・面談・タスク・請求期日を全社カレンダーで確認"
        >
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden sm:inline">予定カレンダー</span>
        </button>

        {/* Cloud Sync Status Indicator */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-50 border border-slate-200">
          {workspaceSyncStatus === 'loading' && (
            <span className="flex items-center gap-1 text-slate-500">
              <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
              <span>同期中</span>
            </span>
          )}
          {workspaceSyncStatus === 'saving' && (
            <span className="flex items-center gap-1 text-amber-600">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
              <span>保存中</span>
            </span>
          )}
          {workspaceSyncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>同期済</span>
            </span>
          )}
          {(workspaceSyncStatus === 'error' || workspaceSyncStatus === 'conflict') && (
            <span className="flex items-center gap-1 text-rose-600" title={workspaceSaveError}>
              <AlertCircle className="w-3 h-3 text-rose-500" />
              <span>同期エラー</span>
            </span>
          )}
        </div>

        {/* Approvals / Notifications Alert */}
        {pendingApprovalsCount > 0 && (
          <button
            type="button"
            onClick={() => onSelectTab('ai_tasks')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
            title={`承認待ちタスクが ${pendingApprovalsCount} 件あります`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
            <span>承認待ち {pendingApprovalsCount}</span>
          </button>
        )}

        {/* Page AI Quick Assistant Button */}
        <button
          type="button"
          onClick={onOpenQuickAiDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
          title="この画面についてAIに相談・タスク依頼"
        >
          <span className="text-sm">{pageAssistantEmoji}</span>
          <span className="hidden md:inline">AIに相談</span>
        </button>

        {/* User Profile / Logout */}
        <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
          <button
            type="button"
            onClick={onOpenProfile}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="オーナー企業プロファイル"
          >
            <User className="w-4 h-4 text-purple-600" />
          </button>

          {user && (
            <button
              type="button"
              onClick={signOut}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
