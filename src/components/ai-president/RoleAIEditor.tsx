import React, { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { ModalShell } from '../ModalShell';
import { ModelSettingEditor, ProviderStatus } from './ModelSettingEditor';
import { AIModelSetting, sanitizeModelSetting } from '../../data/aiModels';
import { AIWorkMode, RoleAIOverride, RoleResponseLength, sanitizeRoleOverride } from '../../data/aiWorkModes';

interface RoleAIEditorProps {
  mode: AIWorkMode;
  override: RoleAIOverride;
  defaultSetting: AIModelSetting;
  statuses: ProviderStatus[] | null;
  onSave: (override: RoleAIOverride) => void;
  onReset: () => void;
  onClose: () => void;
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500';
const labelClass = 'block text-xs font-semibold text-slate-300';

export const RoleAIEditor: React.FC<RoleAIEditorProps> = ({
  mode,
  override,
  defaultSetting,
  statuses,
  onSave,
  onReset,
  onClose,
}) => {
  const [name, setName] = useState(override.name ?? '');
  const [emoji, setEmoji] = useState(override.avatarEmoji ?? '');
  const [description, setDescription] = useState(override.description ?? '');
  const [tone, setTone] = useState(override.tone ?? '');
  const [responseLength, setResponseLength] = useState<RoleResponseLength | ''>(override.responseLength ?? '');
  const [rules, setRules] = useState((override.behaviorRules ?? []).join('\n'));
  const [extra, setExtra] = useState(override.extraInstruction ?? '');
  const [useCustomModel, setUseCustomModel] = useState(Boolean(override.modelSetting));
  const [modelSetting, setModelSetting] = useState<AIModelSetting>(override.modelSetting ?? defaultSetting);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (useCustomModel && !sanitizeModelSetting(modelSetting)) {
      setError('モデル名が正しくありません。半角の英数字と . _ : / - のみ使えます。');
      return;
    }
    const cleaned = sanitizeRoleOverride({
      name,
      avatarEmoji: emoji,
      description,
      tone,
      responseLength: responseLength || undefined,
      behaviorRules: rules.split('\n'),
      extraInstruction: extra,
      modelSetting: useCustomModel ? modelSetting : undefined,
    });
    onSave(cleaned);
  };

  return (
    <ModalShell title={`${mode.label}の詳細設定`} onClose={onClose} maxWidthClass="max-w-3xl">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="pr-10">
          <h2 className="text-lg font-extrabold text-white">
            {(emoji || mode.avatarEmoji)} {(name || mode.name)}｜{mode.label}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            名前・口調・追加指示・使うモデルを変更できます。空欄の項目は標準設定のままです。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
          <label className={labelClass}>
            名前（標準: {mode.name}）
            <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </label>
          <label className={labelClass}>
            絵文字（標準: {mode.avatarEmoji}）
            <input value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} className={fieldClass} />
          </label>
        </div>

        <label className={labelClass}>
          担当の説明
          <input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder={mode.description} className={fieldClass} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            口調
            <input value={tone} maxLength={200} onChange={(e) => setTone(e.target.value)} placeholder="例: 簡潔で結論から話す" className={fieldClass} />
          </label>
          <label className={labelClass}>
            回答の長さ
            <select value={responseLength} onChange={(e) => setResponseLength(e.target.value as RoleResponseLength | '')} className={fieldClass}>
              <option value="">標準</option>
              <option value="short">短め</option>
              <option value="medium">ふつう</option>
              <option value="detailed">詳しく</option>
            </select>
          </label>
        </div>

        <label className={labelClass}>
          行動ルール（1行に1つ、最大10個）
          <textarea value={rules} rows={4} onChange={(e) => setRules(e.target.value)} placeholder={'例:\n結論を最初に書く\n不明点は推測せず質問する'} className={fieldClass} />
        </label>

        <label className={labelClass}>
          追加指示（標準の役割指示に加えて適用されます）
          <textarea value={extra} rows={5} maxLength={4000} onChange={(e) => setExtra(e.target.value)} placeholder="例: 当社は中小企業向けの経営支援サービスです。提案は必ず3案に絞ってください。" className={fieldClass} />
        </label>

        <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
          <summary className="cursor-pointer font-semibold text-slate-300">標準の役割指示を確認する（変更不可）</summary>
          <p className="mt-2 leading-5">{mode.systemInstruction}</p>
        </details>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-bold text-white">この役割が使うAIモデル</h3>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={!useCustomModel} onChange={(e) => setUseCustomModel(!e.target.checked)} />
            全体のデフォルト設定を使う（現在: {defaultSetting.primary.model}）
          </label>
          {useCustomModel && <ModelSettingEditor value={modelSetting} onChange={setModelSetting} statuses={statuses} />}
        </section>

        {error && <p className="rounded-lg bg-rose-950/60 p-3 text-xs text-rose-200">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('この役割の設定をすべて標準に戻しますか？')) onReset();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 標準に戻す
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700">
              キャンセル
            </button>
            <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500">
              <Save className="h-3.5 w-3.5" /> 保存
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
