import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TableManager } from './components/TableManager';
import { AuthScreen } from './components/AuthScreen';
import { ConfigGuideModal } from './components/ConfigGuideModal';
import { RlsGuideModal } from './components/RlsGuideModal';
import { RecordFormModal } from './components/RecordFormModal';
import { TableKey } from './types/database';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | TableKey>('dashboard');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isRlsOpen, setIsRlsOpen] = useState(false);

  // Quick Create Modal from Header/Dashboard
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateTable, setQuickCreateTable] = useState<TableKey>('deals');

  const handleOpenCreate = (table: TableKey) => {
    setQuickCreateTable(table);
    setQuickCreateOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-semibold tracking-wide">MST AI経営OS 読み込み中...</p>
      </div>
    );
  }

  // 認証前は業務データを一切表示せず、ログイン画面のみを表示
  if (!user) {
    return (
      <>
        <AuthScreen 
          onOpenConfig={() => setIsConfigOpen(true)} 
          onOpenRls={() => setIsRlsOpen(true)} 
        />
        <ConfigGuideModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
        />
        <RlsGuideModal
          isOpen={isRlsOpen}
          onClose={() => setIsRlsOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenRls={() => setIsRlsOpen(true)}
        onOpenCreate={handleOpenCreate}
      />

      {/* Main App Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' ? (
          <Dashboard
            onNavigateTab={(tab) => setCurrentTab(tab)}
            onOpenCreate={handleOpenCreate}
            onOpenRls={() => setIsRlsOpen(true)}
          />
        ) : (
          <TableManager
            currentTable={currentTab}
            onTableChange={(tab) => setCurrentTab(tab)}
            onOpenRls={() => setIsRlsOpen(true)}
          />
        )}
      </main>

      {/* Global Modals */}
      <ConfigGuideModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <RlsGuideModal
        isOpen={isRlsOpen}
        onClose={() => setIsRlsOpen(false)}
      />

      {quickCreateOpen && (
        <RecordFormModal
          isOpen={quickCreateOpen}
          tableKey={quickCreateTable}
          editRecord={null}
          onClose={() => setQuickCreateOpen(false)}
          onSuccess={() => {
            // 自動的に該当タブへ切り替えて反映を確認できるようにする
            if (currentTab !== quickCreateTable) {
              setCurrentTab(quickCreateTable);
            }
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MST AI経営OS - 営業管理・パイプライン</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRlsOpen(true)}
              className="hover:text-slate-300 transition-colors"
            >
              RLSセキュリティ設定
            </button>
            <span>•</span>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="hover:text-slate-300 transition-colors"
            >
              Supabase接続設定
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
