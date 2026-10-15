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
  Users,
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
  | 'marketing_automation'
  | 'line_friends'
  | 'custom_lists'
  | 'document_templates'
  | TableKey
  // 商品・サービス
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
      currentTab === 'ai_projects' ||
      currentTab === 'ai_tasks' ||
      currentTab === 'ai_approvals' ||
      currentTab === 'ai_presets' ||
      currentTab === 'ai_knowledge' ||
      currentTab === 'automations'
    ) {
      return 'ai_president';
    }
    if (
      currentTab === 'product_hub' ||
      currentTab === 'category_hub'
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
                <span>商品・サービス</span>
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
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/70 text-xs font-medium">
          {/* 営業・顧客管理: 顧客獲得から契約後までを一元管理 */}
          {activeSection === 'mst' && (
            <>
              <button onClick={() => onTabChange('mst_dashboard')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${currentTab === 'mst_dashboard' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>📊 営業ダッシュボード</button>
              <button onClick={() => onTabChange('mst_diagnoses')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'mst_diagnoses' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><ClipboardList className="w-3.5 h-3.5 text-blue-400" /><span>診断管理</span></button>
              <button onClick={() => onTabChange('marketing_automation')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'marketing_automation' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><Zap className="w-3.5 h-3.5 text-amber-400" /><span>マーケティングオートメーション</span></button>
              <button onClick={() => onTabChange('line_friends')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'line_friends' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><Users className="w-3.5 h-3.5 text-emerald-400" /><span>LINE友だち・タグ</span></button>
              {(Object.keys(TABLE_CONFIGS) as TableKey[]).map((key) => {
                const cfg = TABLE_CONFIGS[key];
                const isActive = currentTab === key;
                return <button key={key} onClick={() => onTabChange(key)} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><span>{cfg.label}</span></button>;
              })}
              <button onClick={() => onTabChange('custom_lists')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${currentTab === 'custom_lists' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>リスト・顧客区分</button>
              <button onClick={() => onTabChange('document_templates')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${currentTab === 'document_templates' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>顧客書類作成</button>
            </>
          )}

          {/* 商品・サービス: 商品定義と開発情報 */}
          {activeSection === 'matrix' && (
            <>
              <button onClick={() => onTabChange('product_hub')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'product_hub' ? 'bg-cyan-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}><Package className="w-3.5 h-3.5 text-cyan-400" /><span>商品・サービス一覧</span></button>
            </>
          )}

          {/* 3. AI President Section Subtabs */}
          {activeSection === 'ai_president' && (
            <>
              <button
                onClick={() => onTabChange('automations')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'automations' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>自動化ルール</span>
              </button>

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
                onClick={() => onTabChange('ai_projects')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentTab === 'ai_projects'
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                📁 プロジェクト管理
              </button>

              <button
                onClick={() => onTabChange('ai_tasks')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentTab === 'ai_tasks' || currentTab === 'ai_approvals'
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>タスク</span>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px]">
                    {pendingApprovalsCount}
                  </span>
                )}
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
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
