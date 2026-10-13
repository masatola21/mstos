import React, { useState } from 'react';
import { 
  Zap, 
  Play, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Power, 
  ArrowRight, 
  FileCheck2, 
  Receipt, 
  Target,
  Sliders,
  Check
} from 'lucide-react';
import { AutomationRule } from '../../types/matrix';
import { ActivityLog } from '../../types/ai-president';

interface AutomationViewProps {
  automations: AutomationRule[];
  onToggleAutomation: (id: string) => void;
  onTriggerAutomation: (id: string) => void;
  onAddActivityLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
}

export const AutomationView: React.FC<AutomationViewProps> = ({
  automations,
  onToggleAutomation,
  onTriggerAutomation,
  onAddActivityLog,
}) => {
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleTestRun = (rule: AutomationRule) => {
    onTriggerAutomation(rule.id);
    if (onAddActivityLog) {
      onAddActivityLog({
        actionType: 'task_created',
        summary: `非AI自動化ルール実行: 「${rule.name}」`,
        details: `トリガー: ${rule.triggerEvent} -> アクション: ${rule.actionType} が正常に実行されました。`,
        actor: 'システム（自動化エンジン）',
      });
    }
    setSuccessToast(`ルール「${rule.name}」をテスト実行しました（実行回数 +1）`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-400" />
              非AI業務自動化（ルールベース・トリガーエンジン）
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
              確実・低コスト運用
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            APIトークンを消費せず、ステータス変更や期日に連動してタスク生成・請求起案・通知を自動実行
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            稼働中ルール: {automations.filter((a) => a.isActive).length} / {automations.length} 件
          </span>
        </div>
      </div>

      {/* Rule Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.map((rule) => {
          return (
            <div
              key={rule.id}
              className={`p-5 rounded-2xl border transition-all ${
                rule.isActive
                  ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-lg'
                  : 'bg-slate-950/40 border-slate-800/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-xl ${
                      rule.isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{rule.name}</h3>
                    <span className="text-[10px] text-slate-400">ID: {rule.id}</span>
                  </div>
                </div>

                {/* Toggle Active Button */}
                <button
                  onClick={() => onToggleAutomation(rule.id)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    rule.isActive
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title={rule.isActive ? 'ルール停止' : 'ルール有効化'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {rule.description}
              </p>

              {/* Trigger & Action visualization */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 mb-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                    トリガー:
                  </span>
                  <span className="text-slate-200 font-mono text-[11px]">{rule.triggerEvent}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                    自動実行:
                  </span>
                  <span className="text-slate-200 font-mono text-[11px]">{rule.actionType}</span>
                </div>
                {rule.actionConfig?.taskTitle && (
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                    発行内容: {rule.actionConfig.taskTitle}
                  </div>
                )}
              </div>

              {/* Bottom stats & Test run */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <div className="text-[10px] text-slate-500">
                  実行実績: <span className="text-slate-300 font-bold">{rule.triggerCount} 回</span>
                  {rule.lastTriggeredAt && (
                    <span className="ml-2">
                      (最終: {new Date(rule.lastTriggeredAt).toLocaleDateString()})
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleTestRun(rule)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>テスト実行</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
