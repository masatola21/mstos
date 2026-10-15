import React from 'react';
import { Bot, Briefcase, Plus, MessageSquare, Pencil, Trash2, Settings2, Cpu } from 'lucide-react';
import { CharacterConfig } from '../types';
import { AI_WORK_MODES, AIWorkModeId, RoleAIOverrides, resolveWorkMode } from '../../data/aiWorkModes';
import { AIModelSetting } from '../../data/aiModels';
import { getColorScheme } from '../../utils/theme';

interface PresetsViewProps {
  characters: CharacterConfig[];
  activeCharacterId: string;
  activeWorkModeId: AIWorkModeId;
  onSelectCharacter: (id: string) => void;
  onSelectWorkMode: (id: AIWorkModeId) => void;
  onCreateCharacter: () => void;
  onEditCharacter: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
  roleOverrides: RoleAIOverrides;
  defaultModelSetting: AIModelSetting;
  onEditRole: (id: AIWorkModeId) => void;
  onOpenModelSettings: () => void;
}

export const PresetsView: React.FC<PresetsViewProps> = ({
  characters,
  activeCharacterId,
  activeWorkModeId,
  onSelectCharacter,
  onSelectWorkMode,
  onCreateCharacter,
  onEditCharacter,
  onDeleteCharacter,
  roleOverrides,
  defaultModelSetting,
  onEditRole,
  onOpenModelSettings,
}) => {
  const roleModes = AI_WORK_MODES.map((mode) => resolveWorkMode(mode, roleOverrides));
  const registeredCharacters = (Array.isArray(characters) ? characters : []).filter((character) => character && character.id !== 'preset-ceo');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">専門AI一覧</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              役割AIと登録済みAIをここでまとめて管理します。AI社長が全体を統括します。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenModelSettings}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200"
          >
            <Cpu className="w-4 h-4" />
            AIモデル設定
          </button>
          <button
            type="button"
            onClick={onCreateCharacter}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            専門AIを作成
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-indigo-300" />
          <h2 className="text-sm font-bold text-white">役割AI</h2>
          <span className="text-[11px] text-slate-500">選ぶとチャットの担当が切り替わります</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleModes.map((mode) => {
            const selected = activeWorkModeId === mode.id;
            return (
              <article key={mode.id} className={`p-5 rounded-2xl bg-slate-900 border ${selected ? 'border-indigo-500/70' : 'border-slate-800'} flex flex-col`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-2xl">{mode.avatarEmoji}</span>
                  {selected && <span className="text-[10px] rounded-full bg-indigo-500/20 text-indigo-200 px-2 py-1">チャットで選択中</span>}
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">{mode.name}</h3>
                <p className="text-xs text-indigo-300 mt-0.5">{mode.label}</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-3 flex-1">{mode.description}</p>
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Cpu className="w-3 h-3" />
                  {(mode.override.modelSetting ?? defaultModelSetting).primary.model}
                  {!mode.override.modelSetting && '（デフォルト）'}
                  {Object.keys(mode.override).some((key) => key !== 'modelSetting') && <span className="ml-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-indigo-300">カスタマイズ済み</span>}
                </p>
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectWorkMode(mode.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs font-bold text-white"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    この役割でチャット
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditRole(mode.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    詳細設定
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-300" />
          <h2 className="text-sm font-bold text-white">登録済みAI</h2>
          <span className="text-[11px] text-slate-500">不要なAIはここから削除できます</span>
        </div>
        {registeredCharacters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            登録済みAIはまだありません。「専門AIを作成」から追加できます。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registeredCharacters.map((character) => {
              const scheme = getColorScheme(character.avatarColor);
              const selected = activeWorkModeId === 'president' && activeCharacterId === character.id;
              return (
                <article key={character.id} className={`p-5 rounded-2xl bg-slate-900 border ${selected ? 'border-indigo-500/70' : 'border-slate-800'} flex flex-col`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-2xl border border-white/10`}>
                      {character.avatarEmoji || '🤖'}
                    </div>
                    {selected && <span className="text-[10px] rounded-full bg-indigo-500/20 text-indigo-200 px-2 py-1">チャットで選択中</span>}
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white">{character.name}</h3>
                  <p className="text-xs text-indigo-300 mt-0.5">{character.role}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-3 flex-1 line-clamp-3">{character.tagline || character.personality}</p>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => onSelectCharacter(character.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2 py-2 text-[11px] font-bold text-white"
                    >
                      <MessageSquare className="w-3 h-3" /> 呼び出す
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCharacter(character.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2 py-2 text-[11px] font-semibold text-slate-200"
                    >
                      <Pencil className="w-3 h-3" /> 編集
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`「${character.name}」を一覧から削除しますか？会話履歴は残ります。`)) {
                          onDeleteCharacter(character.id);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 px-2 py-2 text-[11px] font-semibold text-rose-300"
                    >
                      <Trash2 className="w-3 h-3" /> 削除
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
