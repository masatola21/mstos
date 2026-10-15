import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink, Save } from 'lucide-react';
import { ModalShell } from '../ModalShell';
import { ModelSettingEditor, useProviderStatus } from './ModelSettingEditor';
import { AI_PROVIDERS, AIModelSetting, sanitizeModelSetting } from '../../data/aiModels';

interface ModelSettingsModalProps {
  defaultSetting: AIModelSetting;
  onSave: (setting: AIModelSetting) => void;
  onClose: () => void;
}

export const ModelSettingsModal: React.FC<ModelSettingsModalProps> = ({ defaultSetting, onSave, onClose }) => {
  const { providers, failed } = useProviderStatus();
  const [setting, setSetting] = useState<AIModelSetting>(defaultSetting);
  const [error, setError] = useState('');

  const handleSave = () => {
    const cleaned = sanitizeModelSetting(setting);
    if (!cleaned) {
      setError('モデル名が正しくありません。半角の英数字と . _ : / - のみ使えます。');
      return;
    }
    onSave(cleaned);
  };

  return (
    <ModalShell title="AIモデル設定" onClose={onClose} maxWidthClass="max-w-2xl">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="pr-10">
          <h2 className="text-lg font-extrabold text-white">AIモデル設定</h2>
          <p className="mt-1 text-xs text-slate-400">
            個別に設定していない役割・登録済みAIは、ここで選んだモデルを使います。役割ごとの指定は「役割AI」の詳細設定から行えます。
          </p>
        </div>

        <section className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-bold text-white">APIキーの設定状況（サーバー側）</h3>
          {failed && <p className="text-xs text-amber-300">サーバーから設定状況を取得できませんでした。</p>}
          {!providers && !failed && <p className="text-xs text-slate-500">確認中…</p>}
          {providers?.map((provider) => (
            <div key={provider.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-slate-200">
                {provider.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                )}
                {provider.label}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{provider.envKey}</code>
              </span>
              <span className="flex items-center gap-3">
                <span className={provider.configured ? 'text-emerald-300' : 'text-amber-300'}>
                  {provider.configured ? '設定済み' : '未設定'}
                </span>
                <a href={AI_PROVIDERS[provider.id].pricingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200">
                  料金・上限 <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </div>
          ))}
          <p className="text-[11px] leading-5 text-slate-500">
            キーはブラウザには保存されず、サーバーの環境変数（.env）で管理します。追加・変更後はサーバーを再起動してください。
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-bold text-white">デフォルトのモデル</h3>
          <ModelSettingEditor value={setting} onChange={setSetting} statuses={providers} />
        </section>

        <p className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-200/90">
          各社の無料枠には、回数・速度・利用できるモデルの制限があり、条件や提供モデルは予告なく変わります。常に無料で安定して使えるとは限らないため、各社の最新の条件を上のリンクで確認してください。モデル名は一覧にないものも入力できます。
        </p>

        {error && <p className="rounded-lg bg-rose-950/60 p-3 text-xs text-rose-200">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700">
            キャンセル
          </button>
          <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500">
            <Save className="h-3.5 w-3.5" /> 保存
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
