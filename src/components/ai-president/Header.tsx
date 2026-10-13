import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Briefcase,
  CheckSquare,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Library,
  Plus,
  ChevronDown,
  Check,
  Download,
} from 'lucide-react';
import { CharacterConfig } from '../types';
import { getColorScheme } from '../utils/theme';

export type AppTab =
  | 'dashboard'
  | 'chat'
  | 'projects'
  | 'tasks'
  | 'approvals'
  | 'editor'
  | 'profile'
  | 'presets';

interface HeaderProps {
  characters: CharacterConfig[];
  activeCharacter: CharacterConfig;
  activeTab: AppTab;
  pendingApprovalsCount: number;
  onSelectCharacter: (id: string) => void;
  onSelectTab: (tab: AppTab) => void;
  onCreateNewCharacter: () => void;
  onOpenBackup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  characters,
  activeCharacter,
  activeTab,
  pendingApprovalsCount,
  onSelectCharacter,
  onSelectTab,
  onCreateNewCharacter,
  onOpenBackup,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scheme = getColorScheme(activeCharacter.avatarColor);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 md:px-5 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 md:gap-3 flex-wrap">
        {/* Brand & Character Switcher */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onSelectTab('dashboard')}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-base">
              👔
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-white text-sm sm:text-base">
                  AI社長
                </span>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v1.0
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 font-medium">
                目標分解・タスク統括パートナー
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800" />

          {/* Individual AI Selector Pill (個別に選んで使う用途) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title="対話する担当AIを選択（個別利用）"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${scheme.border} bg-slate-900/90 hover:bg-slate-800 transition-all text-left cursor-pointer group shadow-sm`}
            >
              <span className="text-base select-none leading-none">
                {activeCharacter.avatarEmoji || '🤖'}
              </span>
              <div className="max-w-[100px] sm:max-w-[140px] truncate">
                <div className="text-[11px] font-bold text-white truncate">
                  {activeCharacter.name}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-transform" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>登録済みAI ({characters.length}体)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onCreateNewCharacter();
                    }}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> 新規AI作成
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {characters.map((char) => {
                    const isSelected = char.id === activeCharacter.id;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          onSelectCharacter(char.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800/70 transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-500/10' : ''
                        }`}
                      >
                        <span className="text-lg select-none">{char.avatarEmoji || '🤖'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white flex items-center justify-between">
                            <span className="truncate">{char.name}</span>
                            {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{char.role}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1.5 mt-1 border-t border-slate-800/80 px-2 flex justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onSelectTab('presets');
                    }}
                    className="flex-1 py-1 px-2 rounded-lg text-[11px] text-slate-300 hover:bg-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Library className="w-3 h-3 text-indigo-400" /> プリセット
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onSelectTab('editor');
                    }}
                    className="flex-1 py-1 px-2 rounded-lg text-[11px] text-slate-300 hover:bg-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400" /> AIカスタマイズ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 shadow-inner">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>ダッシュボード</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('chat')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI社長チャット</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('projects')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'projects'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>プロジェクト</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('tasks')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>タスク</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('approvals')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              activeTab === 'approvals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>承認・履歴</span>
            {pendingApprovalsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center animate-pulse">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('editor')}
            className={`hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'editor'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>AIカスタマイズ</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className={`hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>記憶</span>
          </button>
        </nav>

        {/* Right Tools: Backup / Data */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenBackup}
            title="データ管理・バックアップ & インポート"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors border border-slate-800/60 cursor-pointer text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">バックアップ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
