import React, { useState } from 'react';
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
  const [characterToDelete, setCharacterToDelete] = useState<CharacterConfig | null>(null);
  const roleModes = AI_WORK_MODES.map((mode) => resolveWorkMode(mode, roleOverrides));
  const registeredCharacters = (Array.isArray(characters) ? characters : []).filter((character) => character && character.id !== 'preset-ceo');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">専門AI一覧</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              役割AIと登録済みAIをここでまとめて管理します。AI社長が全体を統括します。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenModelSettings}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
          >
            <Cpu className="w-4 h-4 text-purple-600" />
            AIモデル設定
          </button>
          <button
            type="button"
            onClick={onCreateCharacter}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            専門AIを作成
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-slate-900">役割AI</h2>
          <span className="text-[11px] text-slate-500">選ぶとチャットの担当が切り替わります</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleModes.map((mode) => {
            const selected = activeWorkModeId === mode.id;
            return (
              <article key={mode.id} className={`p-5 rounded-2xl bg-white border ${selected ? 'border-purple-500 ring-1 ring-purple-500/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'} flex flex-col shadow-2xs transition`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-2xl">{mode.avatarEmoji}</span>
                  {selected && <span className="text-[10px] rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-2 py-0.5">チャットで選択中</span>}
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">{mode.name}</h3>
                <p className="text-xs text-purple-700 font-medium mt-0.5">{mode.label}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-2.5 flex-1">{mode.description}</p>
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Cpu className="w-3 h-3 text-slate-400" />
                  {(mode.override.modelSetting ?? defaultModelSetting).primary.model}
                  {!mode.override.modelSetting && '（デフォルト）'}
                  {Object.keys(mode.override).some((key) => key !== 'modelSetting') && <span className="ml-1 rounded bg-purple-50 px-1.5 py-0.5 text-purple-700 border border-purple-100 font-medium">カスタマイズ済み</span>}
                </p>
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onSelectWorkMode(mode.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    この役割でチャット
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditRole(mode.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition cursor-pointer"
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
          <Bot className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-slate-900">登録済みAI</h2>
          <span className="text-[11px] text-slate-500">不要なAIはここから削除できます</span>
        </div>
        {registeredCharacters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 bg-white">
            登録済みAIはまだありません。「専門AIを作成」から追加できます。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registeredCharacters.map((character) => {
              const selected = activeWorkModeId === 'president' && activeCharacterId === character.id;
              return (
                <article key={character.id} className={`p-5 rounded-2xl bg-white border ${selected ? 'border-purple-500 ring-1 ring-purple-500/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'} flex flex-col shadow-2xs transition`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-11 h-11 rounded-xl bg-purple-600 flex items-center justify-center text-xl text-white shadow-sm">
                      {character.avatarEmoji || '🤖'}
                    </div>
                    {selected && <span className="text-[10px] rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-2 py-0.5">チャットで選択中</span>}
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">{character.name}</h3>
                  <p className="text-xs text-purple-700 font-medium mt-0.5">{character.role}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2.5 flex-1 line-clamp-3">{character.tagline || character.personality}</p>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectCharacter(character.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-700 px-2 py-2 text-[11px] font-semibold text-white shadow-sm cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" /> 呼び出す
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCharacter(character.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 py-2 text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> 編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setCharacterToDelete(character)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-2 text-[11px] font-semibold text-rose-700 cursor-pointer"
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

      {characterToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-character-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="delete-character-title" className="text-base font-bold text-slate-900">専門AIを削除しますか？</h2>
            <p className="mt-3 text-sm text-slate-600">「{characterToDelete.name}」を一覧から削除します。会話履歴は残ります。</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setCharacterToDelete(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer">キャンセル</button>
              <button type="button" onClick={() => { onDeleteCharacter(characterToDelete.id); setCharacterToDelete(null); }} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm transition cursor-pointer">削除する</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

