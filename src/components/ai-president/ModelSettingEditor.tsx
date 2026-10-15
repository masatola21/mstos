import React, { useEffect, useId, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  AIModelSetting,
  AIModelTarget,
  AIProviderId,
  MAX_FALLBACKS,
  sanitizeTarget,
} from '../../data/aiModels';

export interface ProviderStatus {
  id: AIProviderId;
  label: string;
  envKey: string;
  configured: boolean;
}

/** サーバーのAPIキー設定状況を取得する（キー自体は返ってこない）。 */
export function useProviderStatus() {
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai-providers')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => !cancelled && setProviders(data.providers))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { providers, failed };
}

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500';

interface TargetRowProps {
  label: string;
  target: AIModelTarget;
  statuses: ProviderStatus[] | null;
  onChange: (target: AIModelTarget) => void;
  onRemove?: () => void;
}

const TargetRow: React.FC<TargetRowProps> = ({ label, target, statuses, onChange, onRemove }) => {
  const listId = useId();
  const configured = statuses?.find((s) => s.id === target.provider)?.configured;
  const invalid = sanitizeTarget(target) === null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
        <span>{label}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`${label}を削除`} className="text-slate-500 hover:text-rose-300">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_1fr]">
        <select
          value={target.provider}
          onChange={(e) => {
            const provider = e.target.value as AIProviderId;
            onChange({ provider, model: AI_PROVIDERS[provider].suggestedModels[0] });
          }}
          className={inputClass}
        >
          {AI_PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>{AI_PROVIDERS[id].label}</option>
          ))}
        </select>
        <div>
          <input
            list={listId}
            value={target.model}
            onChange={(e) => onChange({ ...target, model: e.target.value })}
            placeholder="モデル名"
            aria-invalid={invalid}
            className={`${inputClass} ${invalid ? 'border-rose-500' : ''}`}
          />
          <datalist id={listId}>
            {AI_PROVIDERS[target.provider].suggestedModels.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </div>
      </div>
      {invalid && <p className="text-[11px] text-rose-300">モデル名は半角の英数字と . _ : / - のみ使えます。</p>}
      {configured === false && (
        <p className="text-[11px] text-amber-300">
          サーバーに {AI_PROVIDERS[target.provider].envKey} が設定されていないため、このモデルは使えません。
        </p>
      )}
    </div>
  );
};

interface ModelSettingEditorProps {
  value: AIModelSetting;
  onChange: (value: AIModelSetting) => void;
  statuses: ProviderStatus[] | null;
}

export const ModelSettingEditor: React.FC<ModelSettingEditorProps> = ({ value, onChange, statuses }) => (
  <div className="space-y-3">
    <TargetRow
      label="使用するモデル"
      target={value.primary}
      statuses={statuses}
      onChange={(primary) => onChange({ ...value, primary })}
    />
    {value.fallbacks.map((fallback, index) => (
      <TargetRow
        key={index}
        label={`切り替え先 ${index + 1}（上のモデルが失敗したとき）`}
        target={fallback}
        statuses={statuses}
        onChange={(next) => onChange({ ...value, fallbacks: value.fallbacks.map((f, i) => (i === index ? next : f)) })}
        onRemove={() => onChange({ ...value, fallbacks: value.fallbacks.filter((_, i) => i !== index) })}
      />
    ))}
    {value.fallbacks.length < MAX_FALLBACKS && (
      <button
        type="button"
        onClick={() => onChange({ ...value, fallbacks: [...value.fallbacks, { provider: 'groq', model: AI_PROVIDERS.groq.suggestedModels[0] }] })}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
      >
        <Plus className="h-3.5 w-3.5" /> 切り替え先を追加
      </button>
    )}
    <p className="text-[11px] leading-5 text-slate-500">
      上限到達・エラー・タイムアウトなどで応答が始まらなかったときだけ、上から順に次のモデルへ切り替えます。会話履歴と指示文はそのまま引き継がれます。
    </p>
  </div>
);
