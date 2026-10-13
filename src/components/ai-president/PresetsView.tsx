import React from 'react';
import { Library, MessageSquare, Copy, Check, ArrowRight } from 'lucide-react';
import { PRESET_CHARACTERS } from '../data/presets';
import { CharacterConfig } from '../types';
import { getColorScheme } from '../utils/theme';

interface PresetsViewProps {
  onSelectAndChat: (preset: CharacterConfig) => void;
  onDuplicateAndEdit: (preset: CharacterConfig) => void;
  activeCharacterId: string;
}

export const PresetsView: React.FC<PresetsViewProps> = ({
  onSelectAndChat,
  onDuplicateAndEdit,
  activeCharacterId,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">AIキャラクター・テンプレート集</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              厳選された個性豊かなAIたち。そのまま会話を始めることも、複製してあなた好みにカスタムすることも可能です。
            </p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRESET_CHARACTERS.map((preset) => {
          const scheme = getColorScheme(preset.avatarColor);
          const isActive = preset.id === activeCharacterId;

          return (
            <div
              key={preset.id}
              className={`p-5 rounded-3xl bg-slate-900 border transition-all flex flex-col justify-between group ${
                isActive ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-2xl shadow-md ${scheme.glow} border border-white/20`}
                  >
                    {preset.avatarEmoji}
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${scheme.badgeBg} ${scheme.badgeText}`}
                  >
                    {preset.role}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{preset.name}</span>
                    {isActive && (
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                        選択中
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-indigo-300/80 font-medium mt-0.5">{preset.tagline}</p>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {preset.personality}
                </p>

                {/* Trait badges */}
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
                    口調: {preset.speechStyle?.split('、')[0] || preset.tone}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-950 text-slate-300 border border-slate-800">
                    一人称: {preset.firstPerson}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onDuplicateAndEdit(preset)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700/60"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>カスタム複製</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectAndChat(preset)}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  <span>対話する</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
