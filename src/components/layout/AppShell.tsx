import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { UnifiedNavTab } from '../UnifiedNavbar';

interface AppShellProps {
  currentTab: UnifiedNavTab;
  onSelectTab: (tab: UnifiedNavTab) => void;
  pendingApprovalsCount: number;
  workspaceSyncStatus: 'loading' | 'saving' | 'saved' | 'error' | 'conflict';
  workspaceSaveError?: string;
  pageAssistantEmoji: string;
  onOpenQuickAiDrawer: () => void;
  onOpenConfig: () => void;
  onOpenRls: () => void;
  onOpenPricing: () => void;
  onOpenBackup: () => void;
  onOpenProfile: () => void;
  onOpenModelSettings: () => void;
  onRetrySync?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  pendingApprovalsCount,
  workspaceSyncStatus,
  workspaceSaveError,
  pageAssistantEmoji,
  onOpenQuickAiDrawer,
  onOpenConfig,
  onOpenRls,
  onOpenPricing,
  onOpenBackup,
  onOpenProfile,
  onOpenModelSettings,
  onRetrySync,
  children,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Left Sidebar */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        pendingApprovalsCount={pendingApprovalsCount}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        onOpenConfig={onOpenConfig}
        onOpenRls={onOpenRls}
        onOpenPricing={onOpenPricing}
        onOpenBackup={onOpenBackup}
        onOpenProfile={onOpenProfile}
        onOpenModelSettings={onOpenModelSettings}
      />

      {/* Main Body Area shifted by sidebar width on desktop */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <AppHeader
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          onOpenMobileSidebar={() => setIsOpenMobile(true)}
          pendingApprovalsCount={pendingApprovalsCount}
          workspaceSyncStatus={workspaceSyncStatus}
          workspaceSaveError={workspaceSaveError}
          onOpenQuickAiDrawer={onOpenQuickAiDrawer}
          pageAssistantEmoji={pageAssistantEmoji}
          onOpenProfile={onOpenProfile}
          onRetrySync={onRetrySync}
        />

        {/* 指摘4対応: 競合停止通知バナー（未保存警告 ＆ 再同期・再読み込み導線） */}
        {workspaceSyncStatus === 'conflict' && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 text-xs text-rose-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <div>
                <span className="font-bold">同期停止中（未保存）:</span>{' '}
                他の端末でデータが更新されたため自動保存を停止しています。現在の画面の入力・編集内容はまだクラウドに保存されていません。
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold text-xs transition cursor-pointer shadow-sm"
              >
                最新データを再読み込み
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Workspace Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>MST AI経営OS × 統合経営基盤</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenModelSettings}
                className="hover:text-purple-600 transition-colors cursor-pointer"
              >
                AIモデル設定
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={onOpenPricing}
                className="hover:text-purple-600 transition-colors cursor-pointer"
              >
                トークン料金
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={onOpenConfig}
                className="hover:text-purple-600 transition-colors cursor-pointer"
              >
                接続設定
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={onOpenRls}
                className="hover:text-purple-600 transition-colors cursor-pointer"
              >
                セキュリティ
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
