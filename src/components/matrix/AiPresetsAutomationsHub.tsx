import React from 'react';
import { Bot, Zap } from 'lucide-react';
import { PresetsView } from '../ai-president/PresetsView';
import { AutomationView } from './AutomationView';
import { CharacterConfig, ActivityLog } from '../../types/ai-president';
import { AutomationRule } from '../../types/matrix';
import { AIWorkModeId, RoleAIOverrides } from '../../data/aiWorkModes';
import { AIModelSetting } from '../../data/aiModels';

interface AiPresetsAutomationsHubProps {
  activeTab: 'ai_presets' | 'automations';
  onTabChange: (tab: 'ai_presets' | 'automations') => void;
  // PresetsView props
  characters: CharacterConfig[];
  activeCharacterId: string;
  activeWorkModeId: AIWorkModeId;
  onSelectCharacter: (id: string) => void;
  onSelectWorkMode: (id: AIWorkModeId) => void;
  onCreateCharacter: () => void;
  onEditCharacter: (id: string) => void;
  roleOverrides: RoleAIOverrides;
  defaultModelSetting: AIModelSetting;
  onEditRole: (roleId: any) => void;
  onOpenModelSettings: () => void;
  onDeleteCharacter: (id: string) => void;
  // AutomationView props
  automations: AutomationRule[];
  activityLogs: ActivityLog[];
  onUpdateAutomation: (id: string, updates: Partial<AutomationRule>) => void;
  onAddAutomation?: (rule: Omit<AutomationRule, 'id' | 'updatedAt'>) => void;
  onDeleteAutomation?: (id: string) => void;
}

export const AiPresetsAutomationsHub: React.FC<AiPresetsAutomationsHubProps> = ({
  activeTab,
  onTabChange,
  characters,
  activeCharacterId,
  activeWorkModeId,
  onSelectCharacter,
  onSelectWorkMode,
  onCreateCharacter,
  onEditCharacter,
  roleOverrides,
  defaultModelSetting,
  onEditRole,
  onOpenModelSettings,
  onDeleteCharacter,
  automations,
  activityLogs,
  onUpdateAutomation,
  onAddAutomation,
  onDeleteAutomation,
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
              onClick={() => onTabChange('ai_presets')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ai_presets'
                  ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Bot className={`h-4 w-4 ${activeTab === 'ai_presets' ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>専門AI・役割一覧</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'ai_presets'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                役割・プロンプト
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('automations')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'automations'
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Zap className={`h-4 w-4 ${activeTab === 'automations' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>AI自動化・自律ルール</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'automations'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-200/80 text-slate-600'
              }`}>
                トリガー設定
              </span>
            </button>
          </div>

          {/* 右側：説明 */}
          <div className="flex items-center gap-2 text-xs text-slate-500 hidden md:flex">
            <span className="text-[11px] text-slate-400">
              {activeTab === 'ai_presets'
                ? '専門AIのキャラクター設定・モデル・プロンプトを管理'
                : 'CRMイベントや診断受診時のAI自動実行トリガールールを管理'}
            </span>
          </div>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div>
        {activeTab === 'ai_presets' ? (
          <PresetsView
            characters={characters}
            activeCharacterId={activeCharacterId}
            activeWorkModeId={activeWorkModeId}
            onSelectCharacter={onSelectCharacter}
            onSelectWorkMode={onSelectWorkMode}
            onCreateCharacter={onCreateCharacter}
            onEditCharacter={onEditCharacter}
            roleOverrides={roleOverrides}
            defaultModelSetting={defaultModelSetting}
            onEditRole={onEditRole}
            onOpenModelSettings={onOpenModelSettings}
            onDeleteCharacter={onDeleteCharacter}
          />
        ) : (
          <AutomationView
            automations={automations}
            activityLogs={activityLogs}
            onUpdateAutomation={onUpdateAutomation}
            onAddAutomation={onAddAutomation}
            onDeleteAutomation={onDeleteAutomation}
          />
        )}
      </div>
    </div>
  );
};
