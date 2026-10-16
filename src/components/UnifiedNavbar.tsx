import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  LogOut, 
  ShieldCheck, 
  SlidersHorizontal, 
  FileCode2, 
  Sparkles,
  ClipboardList,
  Package,
  Layers,
  Zap,
  Bot,
  DollarSign,
  Download,
  User,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  FileCheck2
} from 'lucide-react';
import { TableKey, TABLE_CONFIGS } from '../types/database';
import { CharacterConfig } from '../types/ai-president';

export type UnifiedNavTab = 
  // 営業・顧客管理
  | 'mst_dashboard'
  | 'mst_diagnoses'
  | 'deal_invitations'
  | 'customer_meeting_invitations'
  | 'marketing_automation'
  | 'custom_lists'
  | 'customer_operations'
  | 'document_templates'
  | TableKey
  // AIプロダクト設計
  | 'product_hub'
  | 'category_hub'
  // 経営・AI社長
  | 'automations'
  // AI President
  | 'ai_dashboard'
  | 'ai_chat'
  | 'ai_projects'
  | 'ai_tasks'
  | 'ai_approvals'
  | 'ai_presets'
  | 'ai_knowledge';

export type NavSection = 'mst' | 'matrix' | 'ai_president';

interface UnifiedNavbarProps {
  currentTab: UnifiedNavTab;
  onTabChange: (tab: UnifiedNavTab) => void;
  onOpenConfig: () => void;
  onOpenRls: () => void;
  onOpenPricing: () => void;
  onOpenBackup: () => void;
  onOpenProfile: () => void;
  onOpenQuickDrawer: () => void;
  activeCharacter: CharacterConfig;
  pendingApprovalsCount: number;
}

export const UnifiedNavbar: React.FC<UnifiedNavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenConfig,
  onOpenRls,
  onOpenPricing,
  onOpenBackup,
  onOpenProfile,
  onOpenQuickDrawer,
  activeCharacter,
  pendingApprovalsCount,
}) => {
  const { user, signOut, config } = useAuth();

  // Determine current active section
  const getCurrentSection = (): NavSection => {
    if (
      currentTab === 'ai_dashboard' ||
      currentTab === 'ai_chat' ||
      currentTab === 'ai_presets' ||
      currentTab === 'ai_knowledge' ||
      currentTab === 'automations'
    ) {
      return 'ai_president';
    }
    if (currentTab === 'customer_operations') return 'mst';
    if (
      currentTab === 'product_hub' ||
      currentTab === 'category_hub' ||
      currentTab === 'ai_projects' ||
      currentTab === 'ai_tasks' ||
      currentTab === 'ai_approvals'
    ) {
      return 'matrix';
    }
    return 'mst';
  };

  const activeSection = getCurrentSection();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Section Mode Selector */}
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-3 cursor-pointer" 
              onClick={() => onTabChange('mst_dashboard')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black tracking-wider">
                MST
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-white">MST AI経営OS</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium hidden sm:inline-block">
                    統合経営基盤
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden md:block">
                  営業パイプライン × AI社長シドウ × 多次元商品管理
                </p>
              </div>
            </div>

            {/* Section Switcher Tabs */}
            <div className="hidden lg:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs ml-2">
              <button
                onClick={() => onTabChange('mst_dashboard')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'mst'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>営業・顧客管理</span>
              </button>

              <button
                onClick={() => onTabChange('product_hub')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'matrix'
                    ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>事業運営</span>
              </button>

              <button
                onClick={() => onTabChange('ai_dashboard')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSection === 'ai_president'
                    ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>経営・AI社長</span>
                {pendingApprovalsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick AI President Drawer Button */}
            <button
              onClick={onOpenQuickDrawer}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/90 to-indigo-600/90 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 border border-purple-400/30 cursor-pointer"
            >
              <span className="text-sm">{activeCharacter.avatarEmoji || '👔'}</span>
              <span className="hidden sm:inline">AI社長に相談</span>
            </button>

            {/* Token Pricing & Usage Modal */}
            <button
              onClick={onOpenPricing}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
              title="APIトークン利用量・料金単価設定"
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Backup & Export Modal */}
            <button
              onClick={onOpenBackup}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors hidden sm:block"
              title="データバックアップ・復元"
            >
              <Download className="w-4 h-4 text-cyan-400" />
            </button>

            {/* User Profile */}
            <button
              onClick={onOpenProfile}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors hidden sm:block"
              title="オーナー情報設定"
            >
              <User className="w-4 h-4 text-purple-400" />
            </button>

            {/* Supabase Status / RLS */}
            <button
              onClick={onOpenRls}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors hidden md:block"
              title="RLSセキュリティ設定"
            >
              <FileCode2 className="w-4 h-4 text-indigo-400" />
            </button>

            {/* Settings Trigger */}
            <button
              onClick={onOpenConfig}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
              title="Supabase環境変数・接続設定"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* User Session & Logout */}
            {user && (
              <button
                onClick={signOut}
                className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors ml-1"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sub Navigation Bar - dynamically shows based on activeSection */}
        <nav className="border-t border-slate-800/70 py-2 text-xs font-medium">
          {activeSection === 'mst' && (() => {
            const groups = [
              { id: 'marketing', label: 'マーケティング', items: (['marketing_automation','custom_lists'] as UnifiedNavTab[]) },
              { id: 'crm', label: '顧客・営業', items: (['mst_dashboard','companies','contacts','prospects','leads','deals','customers','products'] as UnifiedNavTab[]) },
              { id: 'intake', label: 'フォーム・案内', items: (['mst_diagnoses','deal_invitations','customer_meeting_invitations'] as UnifiedNavTab[]) },
              { id: 'delivery', label: '書類・契約後', items: (['document_templates','customer_operations'] as UnifiedNavTab[]) },
            ];
            const activeGroup = groups.find((group) => group.items.includes(currentTab)) || groups[0];
            const labelFor = (tab: UnifiedNavTab) => {
              if (tab === 'mst_dashboard') return '営業ダッシュボード';
              if (tab === 'mst_diagnoses') return 'フォーム・診断';
              if (tab === 'deal_invitations') return '商談案内';
              if (tab === 'customer_meeting_invitations') return '顧客面談案内';
              if (tab === 'custom_lists') return '配信対象';
              if (tab === 'marketing_automation') return '配信・自動化';
              if (tab === 'document_templates') return '顧客書類';
              if (tab === 'customer_operations') return '契約・請求・支援';
              return TABLE_CONFIGS[tab as TableKey]?.label || String(tab);
            };
            return <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="営業・顧客管理の機能グループ">
                {groups.map((group) => <button key={group.id} onClick={() => onTabChange(group.items[0])} aria-current={activeGroup.id === group.id ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 transition-colors ${activeGroup.id === group.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{group.label}</button>)}
              </div>
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1" aria-label={activeGroup.label}>
                {activeGroup.items.map((tab) => <button key={tab} onClick={() => onTabChange(tab)} aria-current={currentTab === tab ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 transition-colors ${currentTab === tab ? 'bg-blue-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{labelFor(tab)}</button>)}
              </div>
            </div>;
          })()}

          {/* AIプロダクト設計: AIとの共創を中心に、設計済みプロダクトも管理 */}
          {activeSection === 'matrix' && (
            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => onTabChange('product_hub')} aria-current={currentTab === 'product_hub' ? 'page' : undefined} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'product_hub' ? 'bg-cyan-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><Package className="w-3.5 h-3.5 text-cyan-400" /><span>AIプロダクト設計</span></button>
              <button onClick={() => onTabChange('ai_projects')} aria-current={currentTab === 'ai_projects' ? 'page' : undefined} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${currentTab === 'ai_projects' ? 'bg-cyan-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>プロジェクト</button>
              <button onClick={() => onTabChange('ai_tasks')} aria-current={currentTab === 'ai_tasks' || currentTab === 'ai_approvals' ? 'page' : undefined} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${currentTab === 'ai_tasks' || currentTab === 'ai_approvals' ? 'bg-cyan-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                <ListTodo className="w-3.5 h-3.5" /><span>共通タスク</span>
                {pendingApprovalsCount > 0 && <span className="rounded bg-amber-500 px-1 text-[10px] font-bold text-slate-950">{pendingApprovalsCount}</span>}
              </button>
            </div>
          )}

          {/* 3. AI President Section Subtabs */}
          {activeSection === 'ai_president' && (
            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => onTabChange('ai_dashboard')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentTab === 'ai_dashboard'
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                📊 AI社長ダッシュボード
              </button>

              <button
                onClick={() => onTabChange('ai_chat')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentTab === 'ai_chat'
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                💬 指示・チャット対話
              </button>





              <button
                onClick={() => onTabChange('ai_knowledge')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentTab === 'ai_knowledge'
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                📚 ナレッジ・成果物
              </button>

              <button
                onClick={() => onTabChange('ai_presets')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentTab === 'ai_presets'
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>専門AI一覧</span>
              </button>
              <button
                onClick={() => onTabChange('automations')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'automations' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>AI自動化・承認ルール</span>
              </button>

            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
