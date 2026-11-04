import React, { useState } from 'react';
import { Download, Upload, Copy, Check, RotateCcw, X, FileText, Database } from 'lucide-react';
import {
  CharacterConfig,
  UserProfile,
  Project,
  TaskItem,
  ApprovalItem,
  ActivityLog,
  ModelPricingRate,
  TokenUsageRecord,
  ChatMessage,
  KnowledgeItem,
} from '../types';
import { PRESET_CHARACTERS } from '../../data/presets';
import { MarketingScenario } from '../../types/marketing';
import {
  DEFAULT_USER_PROFILE,
  DEFAULT_TOP_GOAL,
  DEFAULT_PRICING_RATES,
} from '../../utils/storage';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterConfig[];
  userProfile: UserProfile;
  projects: Project[];
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  topGoal: string;
  pricingRates: ModelPricingRate[];
  tokenUsageRecords: TokenUsageRecord[];
  knowledgeItems: KnowledgeItem[];
  workModeHistories: Record<string, ChatMessage[]>;
  marketingScenarios: MarketingScenario[];
  onRestoreData: (data: {
    characters: CharacterConfig[];
    userProfile: UserProfile;
    projects: Project[];
    tasks: TaskItem[];
    approvals: ApprovalItem[];
    activityLogs: ActivityLog[];
    topGoal: string;
    pricingRates: ModelPricingRate[];
    tokenUsageRecords: TokenUsageRecord[];
    knowledgeItems: KnowledgeItem[];
    workModeHistories: Record<string, ChatMessage[]>;
    marketingScenarios: MarketingScenario[];
  }) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  characters,
  userProfile,
  projects,
  tasks,
  approvals,
  activityLogs,
  topGoal,
  pricingRates,
  tokenUsageRecords,
  knowledgeItems,
  workModeHistories,
  marketingScenarios,
  onRestoreData,
}) => {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentExportJson = JSON.stringify(
    {
      version: '2.2',
      exportedAt: new Date().toISOString(),
      topGoal,
      projects,
      tasks,
      approvals,
      activityLogs,
      pricingRates,
      tokenUsage: tokenUsageRecords,
      knowledgeItems,
      workModeHistories,
      marketingScenarios,
      characters,
      userProfile,
    },
    null,
    2
  );

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentExportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([currentExportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-president-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);

      // Backward compatible restoration
      const restoredChars =
        Array.isArray(parsed.characters) && parsed.characters.length > 0
          ? parsed.characters
          : characters;
      const restoredProfile = parsed.userProfile || DEFAULT_USER_PROFILE;
      const restoredProjects = Array.isArray(parsed.projects) ? parsed.projects : projects;
      const restoredTasks = Array.isArray(parsed.tasks) ? parsed.tasks : tasks;
      const restoredApprovals = Array.isArray(parsed.approvals) ? parsed.approvals : approvals;
      const restoredLogs = Array.isArray(parsed.activityLogs) ? parsed.activityLogs : activityLogs;
      const restoredGoal = parsed.topGoal || topGoal || DEFAULT_TOP_GOAL;
      const restoredPricing = Array.isArray(parsed.pricingRates) ? parsed.pricingRates : pricingRates;
      const restoredKnowledge = Array.isArray(parsed.knowledgeItems) ? parsed.knowledgeItems : knowledgeItems;
      const restoredHistories = parsed.workModeHistories && typeof parsed.workModeHistories === 'object' ? parsed.workModeHistories : workModeHistories;
      const restoredMarketingScenarios = Array.isArray(parsed.marketingScenarios) ? parsed.marketingScenarios : marketingScenarios;
      const restoredUsage = Array.isArray(parsed.tokenUsage)
        ? parsed.tokenUsage
        : Array.isArray(parsed.tokenUsageRecords)
        ? parsed.tokenUsageRecords
        : tokenUsageRecords;

      onRestoreData({
        characters: restoredChars,
        userProfile: restoredProfile,
        projects: restoredProjects,
        tasks: restoredTasks,
        approvals: restoredApprovals,
        activityLogs: restoredLogs,
        topGoal: restoredGoal,
        pricingRates: restoredPricing,
        tokenUsageRecords: restoredUsage,
        knowledgeItems: restoredKnowledge,
        workModeHistories: restoredHistories,
        marketingScenarios: restoredMarketingScenarios,
      });

      setImportStatus('✅ データのインポートと復元に成功しました！');
      setTimeout(() => {
        setImportStatus(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setImportStatus(`❌ エラー: ${err.message || '無効なJSONフォーマットです'}`);
    }
  };

  const handleResetToDefaults = () => {
    if (
      window.confirm(
        '初期状態にリセットしますか？作成したプロジェクトやタスク、カスタマイズ内容は失われます。'
      )
    ) {
      onRestoreData({
        characters: PRESET_CHARACTERS,
        userProfile: DEFAULT_USER_PROFILE,
        projects: [],
        tasks: [],
        approvals: [],
        activityLogs: [],
        topGoal: DEFAULT_TOP_GOAL,
        pricingRates: DEFAULT_PRICING_RATES,
        tokenUsageRecords: [],
        knowledgeItems: [],
        workModeHistories: {},
        marketingScenarios: [],
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Database className="w-5 h-5 text-purple-600" />
            <span>全データ管理・バックアップ & インポート</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Section */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-purple-700 uppercase tracking-wider">
            1. 全データ（目標・PJ・タスク・承認履歴・単価・利用量・AI設定）のエクスポート
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadFile}
              className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSONファイル保存</span>
            </button>
            <button
              type="button"
              onClick={handleCopyJson}
              className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'コピー完了' : 'JSON文字列をコピー'}</span>
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="block text-xs font-bold text-purple-700 uppercase tracking-wider">
            2. JSONから復元・インポート (旧形式互換対応)
          </label>
          <textarea
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="ここにエクスポートしたJSONを貼り付けてください..."
            className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
          />
          {importStatus && (
            <div className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              {importStatus}
            </div>
          )}
          <button
            type="button"
            onClick={handleImport}
            disabled={!importText.trim()}
            className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>インポートを実行</span>
          </button>
        </div>

        {/* Reset */}
        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>初期状態に戻したい場合:</span>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>初期状態にリセット</span>
          </button>
        </div>
      </div>
    </div>
  );
};
