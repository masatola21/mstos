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
  compact?: boolean;
}> = ({ text, onInsert, showPreview = true, compact = false }) => {
  const unknown = findUnknownPlaceholders(text);

  return (
    <div className={compact ? 'mt-1.5 space-y-1.5' : 'mt-2 space-y-2'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[11px] font-medium text-slate-500">差し込み:</span>
        {PLACEHOLDER_DEFS.map(({ key, enKey, description }) => (
          <button
            key={key}
            type="button"
            title={`${description}${enKey ? ` (互換: {${enKey}})` : ''}`}
            onClick={() => onInsert(`{${key}}`)}
            className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-sans text-[11px] font-medium text-slate-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800 transition cursor-pointer whitespace-nowrap"
          >
            <span className="text-purple-600 font-bold">+</span>
            <span>{`{${key}}`}</span>
          </button>
        ))}
      </div>

      {showPreview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span className="font-semibold text-slate-600">サンプル値プレビュー</span>
            <span>実際の送信時には宛先情報に置き換わります</span>
          </div>
          <p className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed">
            {renderPlaceholders(text, PLACEHOLDER_SAMPLE_VALUES) || '（文面は空です）'}
          </p>
        </div>
      )}

      {unknown.length > 0 && (
        <p className="text-[11px] text-amber-700 font-medium">
          未定義の差し込みキー: {unknown.map((k) => `{${k}}`).join(', ')}（※入力通りの文字がそのまま送信されます）
        </p>
      )}
    </div>
  );
};
