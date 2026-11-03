import React from 'react';
import {
  findUnknownPlaceholders,
  PLACEHOLDER_DEFS,
  PLACEHOLDER_SAMPLE_VALUES,
  renderPlaceholders,
} from '../../utils/placeholders';

export const PlaceholderAssist: React.FC<{
  text: string;
  onInsert: (token: string) => void;
  showPreview?: boolean;
}> = ({ text, onInsert, showPreview = true }) => {
  const unknown = findUnknownPlaceholders(text);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-slate-400">差し込み変数:</span>
        {PLACEHOLDER_DEFS.map(({ key, enKey, description }) => (
          <button
            key={key}
            type="button"
            title={`${description}${enKey ? ` (互換: {${enKey}})` : ''}`}
            onClick={() => onInsert(`{${key}}`)}
            className="group inline-flex items-center gap-1 rounded border border-indigo-700/60 bg-indigo-950/40 px-2 py-0.5 font-sans text-[11px] text-indigo-200 hover:border-indigo-400 hover:bg-indigo-900/60 hover:text-white transition shadow-xs cursor-pointer"
          >
            <span className="text-indigo-400 font-bold group-hover:text-indigo-300">+</span>
            <span>{`{${key}}`}</span>
          </button>
        ))}
        <span className="text-[10px] text-slate-500 ml-1">※英語キー（{`{recipient_name}`}等）も有効</span>
      </div>

      {showPreview && (
        <div className="rounded border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>サンプル値プレビュー</span>
            <span className="text-[10px] text-slate-400">実際の送信時には宛先情報に置き換わります</span>
          </div>
          <p className="whitespace-pre-wrap text-xs text-slate-300 leading-relaxed">
            {renderPlaceholders(text, PLACEHOLDER_SAMPLE_VALUES) || '（文面は空です）'}
          </p>
        </div>
      )}

      {unknown.length > 0 && (
        <p className="text-[11px] text-amber-300">
          未定義の差し込みキー: {unknown.map((k) => `{${k}}`).join(', ')}（※入力通りの文字がそのまま送信されます）
        </p>
      )}
    </div>
  );
};
