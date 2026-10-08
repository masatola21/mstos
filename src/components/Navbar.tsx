import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  LogOut, 
  ShieldCheck, 
  SlidersHorizontal, 
  FileCode2, 
  CheckCircle2, 
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { TableKey, TABLE_CONFIGS } from '../types/database';

interface NavbarProps {
  currentTab: 'dashboard' | TableKey;
  onTabChange: (tab: 'dashboard' | TableKey) => void;
  onOpenConfig: () => void;
  onOpenRls: () => void;
  onOpenCreate: (table: TableKey) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenConfig,
  onOpenRls,
}) => {
  const { user, signOut, config } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black tracking-wider">
              MST
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">MST AI経営OS</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                  社内営業管理
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Supabase 連携営業パイプラインOS</p>
            </div>
          </div>

          {/* Quick Info & Right Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Supabase Connection Status Badge */}
            <button
              onClick={onOpenConfig}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                config.isConfigured
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
              }`}
              title="Supabase接続設定を確認"
            >
              {config.isConfigured ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Supabase 接続済</span>
                  <span className="md:hidden">接続済</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>未接続・設定</span>
                </>
              )}
            </button>

            {/* RLS Guide Modal Trigger */}
            <button
              onClick={onOpenRls}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="RLS推奨SQLの確認"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">RLS設定SQL</span>
            </button>

            {/* Settings Trigger */}
            <button
              onClick={onOpenConfig}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="環境変数・接続情報"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* User Session Info & Sign Out */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[150px]">
                    {user.email}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> 認証済み社内メンバー
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors"
                  title="ログアウト"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Global Navigation Tabs */}
        {user && (
          <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/70 text-xs font-medium">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                currentTab === 'dashboard'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              📊 ホーム / 業務概要
            </button>
            {(Object.keys(TABLE_CONFIGS) as TableKey[]).map((key) => {
              const cfg = TABLE_CONFIGS[key];
              const isActive = currentTab === key;
              return (
                <button
                  key={key}
                  onClick={() => onTabChange(key)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{cfg.label}</span>
                  <span className="text-[10px] opacity-75 hidden sm:inline">({key})</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
};
