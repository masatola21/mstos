import React, { useEffect, useState } from 'react';
import { X, Cpu, Save, Info } from 'lucide-react';
import { AI_WORK_MODES, AIWorkModeId } from '../../data/aiWorkModes';

export type AIModelProvider = 'gemini' | 'groq' | 'openrouter';
export type AIModelSelection = { provider: AIModelProvider; model: string };
export type AIModelSelections = Partial<Record<AIWorkModeId, AIModelSelection>>;

const defaults: Record<AIModelProvider, string> = {
  gemini: 'gemini-3.8-flash',
  groq: 'qwen/qwen3.8-27b',
  openrouter: 'openrouter/free',
};

interface Props {
  isOpen: boolean;
  selections: AIModelSelections;
  onClose: () => void;
  onSave: (next: AIModelSelections) => void;
}

export const ModelProviderSettingsModal: React.FC<Props> = ({ isOpen, selections, onClose, onSave }) => {
  const [draft, setDraft] = useState<AIModelSelections>(selections);
  useEffect(() => { if (isOpen) setDraft(selections); }, [isOpen, selections]);
  if (!isOpen) return null;

  const update = (id: AIWorkModeId, patch: Partial<AIModelSelection>) => {
    const current = draft[id] || { provider: 'gemini' as const, model: defaults.gemini };
    const provider = patch.provider || current.provider;
    setDraft({ ...draft, [id]: { ...current, ...patch, model: patch.provider && patch.provider !== current.provider ? defaults[provider] : (patch.model ?? current.model) } });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <div><h2 className="font-bold text-white">AIモデルの役割別設定</h2><p className="text-xs text-slate-400">役割ごとに接続先とモデルIDを指定できます</p></div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white" aria-label="閉じる"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-5 overflow-y-auto space-y-3">
          {AI_WORK_MODES.map((mode) => {
            const config = draft[mode.id] || { provider: 'gemini' as const, model: defaults.gemini };
            return <section key={mode.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="font-semibold text-sm text-white mb-3">{mode.name} <span className="text-slate-400 font-normal">— {mode.label}</span></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">API提供元
                  <select value={config.provider} onChange={(e) => update(mode.id, { provider: e.target.value as AIModelProvider })} className="mt-1 block w-full rounded-xl bg-slate-900 border border-slate-700 text-white p-2.5">
                    <option value="gemini">Google Gemini (無料枠あり)</option><option value="groq">Groq (無料枠あり)</option><option value="openrouter">OpenRouter (無料モデルあり)</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">モデルID
                  <input value={config.model} onChange={(e) => update(mode.id, { model: e.target.value })} maxLength={160} className="mt-1 block w-full rounded-xl bg-slate-900 border border-slate-700 text-white p-2.5" />
                </label>
              </div>
            </section>;
          })}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-300 flex gap-2"><Info className="w-4 h-4 text-amber-300 shrink-0" /><span>無料枠は提供元の制限・モデル提供状況により変わります。利用する提供元のAPIキーをサーバー環境変数に登録してください（GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY）。キーはこの画面やブラウザには保存されません。</span></div>
        </div>
        <footer className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800">キャンセル</button>
          <button onClick={() => { onSave(draft); onClose(); }} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold flex items-center gap-2"><Save className="w-4 h-4" />保存</button>
        </footer>
      </div>
    </div>
  );
};
