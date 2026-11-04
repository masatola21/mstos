import React, { useState } from 'react';
import {
  LayoutDashboard,
  Megaphone,
  Zap,
  ClipboardList,
  Building2,
  Users,
  Briefcase,
  FileText,
  Inbox,
  Send,
  Calendar,
  Package,
  Receipt,
  Layers,
  Sparkles,
  CheckSquare,
  FolderGit2,
  BookOpen,
  Bot,
  Settings,
  ChevronDown,
  ChevronRight,
  User,
  DollarSign,
  Download,
  Sliders,
  ShieldCheck,
  X,
  ExternalLink
} from 'lucide-react';
import { UnifiedNavTab } from '../UnifiedNavbar';

export interface NavItemConfig {
  id: UnifiedNavTab | string;
  label: string;
  badge?: number | string;
  badgeColor?: string;
}

export interface NavGroupConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  items: NavItemConfig[];
}

interface AppSidebarProps {
  currentTab: UnifiedNavTab;
  onSelectTab: (tab: UnifiedNavTab) => void;
  pendingApprovalsCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenConfig: () => void;
  onOpenRls: () => void;
  onOpenPricing: () => void;
  onOpenBackup: () => void;
  onOpenProfile: () => void;
  onOpenModelSettings: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingApprovalsCount,
  isOpenMobile,
  onCloseMobile,
  onOpenConfig,
  onOpenRls,
  onOpenPricing,
  onOpenBackup,
  onOpenProfile,
  onOpenModelSettings,
}) => {
  // Navigation groups definition reflecting the confirmed business workflow
  const navGroups: NavGroupConfig[] = [
    {
      id: 'marketing',
      label: '集客・営業開拓',
      icon: Megaphone,
      defaultOpen: true,
      items: [
        { id: 'ai_acquisition', label: '集客戦略・SNS・メディア' },
        { id: 'contacts', label: '見込み企業・友だちリスト（AI調査 & LINE）' },
        { id: 'marketing_automation', label: 'LINE・メール自動配信（営業メール5段階 & シナリオ）' },
        { id: 'mst_diagnoses', label: '受付フォーム・診断設計（反響獲得・フック）' },
      ],
    },
    {
      id: 'sales',
      label: '営業・顧客管理',
      icon: Briefcase,
      defaultOpen: true,
      items: [
        { id: 'deals', label: '商談パイプライン（リード・商談・顧客）' },
        { id: 'document_templates', label: '重要書類・見積・契約（見積書・契約書作成）' },
        { id: 'customer_operations', label: '契約・請求・顧問支援（月次請求・支援進捗）' },
        { id: 'companies', label: '会社台帳（法人マスタ）' },
        { id: 'products', label: '販売商品・料金台帳（見積・請求用）' },
      ],
    },
    {
      id: 'ai_president',
      label: 'AI経営室',
      icon: Sparkles,
      defaultOpen: true,
      items: [
        { id: 'ai_chat', label: 'AI社長室・対話' },
        { id: 'product_hub', label: '新規商品企画・プロジェクト開発（AI共創）' },
        { id: 'ai_knowledge', label: 'ナレッジ・成果物保管庫' },
        { id: 'ai_presets', label: '専門AI・自動化ルール設定' },
      ],
    },
  ];

  // Collapsible groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isTabActive = (tabId: string): boolean => {
    if (currentTab === tabId) return true;
    if (tabId === 'contacts' && currentTab === 'prospects') return true;
    if (tabId === 'deals' && (currentTab === 'leads' || currentTab === 'customers')) return true;
    if (tabId === 'product_hub' && currentTab === 'ai_projects') return true;
    if (tabId === 'ai_presets' && currentTab === 'automations') return true;
    if (tabId === 'mst_dashboard' && currentTab === 'inflow_dashboard') return true;
    if (tabId === 'communication_send' && (currentTab === 'deal_invitations' || currentTab === 'customer_meeting_invitations')) return true;
    return false;
  };

  const handleItemClick = (tabId: string) => {
    onSelectTab(tabId as UnifiedNavTab);
    onCloseMobile();
  };

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 bg-white">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => handleItemClick('mst_dashboard')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm group-hover:scale-105 transition-transform">
              MST
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-800">
                  MST AI経営OS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">経営支援・自動化基盤</p>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="メニューを閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar text-sm">
          {/* Top Quick Navigation: Daily Business Routine (経営・連絡・タスク) */}
          <div className="space-y-1">
            <div className="px-3 pb-1 pt-0.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              経営・デイリー業務
            </div>
            <button
              type="button"
              onClick={() => handleItemClick('mst_dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                isTabActive('mst_dashboard')
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${isTabActive('mst_dashboard') ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>📊 経営ダッシュボード</span>
            </button>

            <button
              type="button"
              onClick={() => handleItemClick('unified_calendar')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                isTabActive('unified_calendar')
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Calendar className={`w-4 h-4 ${isTabActive('unified_calendar') ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>📅 予定カレンダー</span>
            </button>

            <button
              type="button"
              onClick={() => handleItemClick('inbox_hub')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                isTabActive('inbox_hub')
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Inbox className={`w-4 h-4 ${isTabActive('inbox_hub') ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>📥 統合受信トレイ</span>
            </button>

            <button
              type="button"
              onClick={() => handleItemClick('communication_send')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                isTabActive('communication_send')
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Send className={`w-4 h-4 ${isTabActive('communication_send') ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>📤 送信センター</span>
            </button>

            <button
              type="button"
              onClick={() => handleItemClick('ai_tasks')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                isTabActive('ai_tasks')
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckSquare className={`w-4 h-4 ${isTabActive('ai_tasks') ? 'text-purple-600' : 'text-slate-400'}`} />
                <span>全社タスク・承認</span>
              </div>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          </div>

          {/* Main Groups */}
          {navGroups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.id];
            const hasActiveChild = group.items.some((item) => isTabActive(item.id));
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <GroupIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{group.label}</span>
                  </div>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 pt-0.5">
                    {group.items.map((item) => {
                      const active = isTabActive(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleItemClick(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            active
                              ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/70 shadow-xs'
                              : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.badge !== undefined && (
                            <span
                              className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${
                                item.badgeColor || 'bg-purple-100 text-purple-700 border-purple-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        </div>

        {/* Footer Settings Accordion */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 text-xs">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-slate-700 hover:bg-slate-200/60 transition-colors font-medium cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              <span>設定・システム管理</span>
            </div>
            {settingsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {settingsOpen && (
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-purple-300 ml-2 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={onOpenProfile}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <User className="w-3.5 h-3.5 text-purple-500" />
                <span>オーナー企業情報</span>
              </button>
              <button
                type="button"
                onClick={onOpenModelSettings}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <Bot className="w-3.5 h-3.5 text-indigo-500" />
                <span>AIモデル・役割設定</span>
              </button>
              <button
                type="button"
                onClick={onOpenPricing}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span>APIトークン・料金</span>
              </button>
              <button
                type="button"
                onClick={onOpenBackup}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-cyan-500" />
                <span>データバックアップ</span>
              </button>
              <button
                type="button"
                onClick={onOpenConfig}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Supabase接続設定</span>
              </button>
              <button
                type="button"
                onClick={onOpenRls}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>RLSセキュリティ</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
