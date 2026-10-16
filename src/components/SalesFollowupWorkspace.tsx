import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Mail, MessageCircle, Plus, Save, Trash2 } from 'lucide-react';
import { MarketingChannel, MarketingScenario, MarketingTrigger } from '../../types/marketing';

interface Props {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
}

const stages: Array<{
  trigger: MarketingTrigger;
  title: string;
  description: string;
}> = [
  { trigger: 'lead_created', title: 'フォーム受付後', description: '受付確認と次の案内を送ります。診断・相談の申込内容をCRMのリードに紐付けます。' },
  { trigger: 'diagnosis_completed', title: '診断完了後', description: '診断結果の確認や相談・面談への案内を行います。結果やレポートは人が確認してから送付します。' },
  { trigger: 'report_sent', title: '診断レポート送付後', description: 'レポートの確認を促し、必要に応じて相談・面談につなげます。' },
  { trigger: 'proposal_sent', title: '提案書送付後', description: '提案内容の確認時期に合わせて連絡し、回答待ちの場合は担当者の対応につなげます。' },
  { trigger: 'meeting_completed', title: '商談・面談後', description: 'お礼と合意した次の手順を案内し、提案待ち・回答待ちなどの状態に合わせてフォローします。' },
];

const emptyScenario = (stage: typeof stages[number]): MarketingScenario => ({
  id: '',
  name: `${stage.title}のフォロー`,
  trigger: stage.trigger,
  channel: 'email',
  audience: '',
  waitMinutes: 0,
  emailSubject: '',
  messageBody: '',
  emailBody: '',
  lineMessageType: 'text',
  lineImageUrl: '',
  linePreviewImageUrl: '',
  flexAltText: '',
  flexTitle: '',
  flexBody: '',
  flexButtonLabel: '',
  flexButtonUrl: '',
  status: 'draft',
  updatedAt: Date.now(),
});

export const SalesFollowupWorkspace: React.FC<Props> = ({ scenarios, onScenariosChange }) => {
  const [editing, setEditing] = useState<MarketingScenario | null>(null);
  const [form, setForm] = useState<MarketingScenario | null>(null);
  const [notice, setNotice] = useState('');
  const scenarioCounts = useMemo(
    () => stages.map((stage) => scenarios.filter((scenario) => scenario.trigger === stage.trigger)),
    [scenarios],
  );

  const startCreate = (index: number) => {
    setEditing(null);
    setForm(emptyScenario(stages[index]));
    setNotice('');
  };

  const startEdit = (scenario: MarketingScenario) => {
    setEditing(scenario);
    setForm({ ...scenario });
    setNotice('');
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !form.name.trim()) return;
    const saved = { ...form, id: editing?.id || `followup-${Date.now()}`, status: 'draft' as const, updatedAt: Date.now() };
    onScenariosChange(editing
      ? scenarios.map((scenario) => scenario.id === editing.id ? saved : scenario)
      : [saved, ...scenarios]);
    setForm(null);
    setEditing(null);
    setNotice('フォロー設定を保存しました。実送信や自動実行はまだ行われません。');
  };

  const remove = (scenario: MarketingScenario) => {
    if (!window.confirm(`「${scenario.name}」を削除しますか？`)) return;
    onScenariosChange(scenarios.filter((item) => item.id !== scenario.id));
    setNotice('フォロー設定を削除しました。');
  };

  const update = <K extends keyof MarketingScenario>(key: K, value: MarketingScenario[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 to-indigo-950/40 p-6">
        <h1 className="text-2xl font-black text-white">フォロー営業</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">フォーム受付から商談後まで、顧客の段階に合わせたフォロー文面とタイミングを管理します。顧客・案件の状態はCRMを正本にし、配信設定はここで準備します。</p>
      </header>

      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {form && (
        <form onSubmit={save} className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="font-bold text-white">{editing ? 'フォロー設定を編集' : 'フォロー設定を作成'}</h2><p className="mt-1 text-xs text-slate-400">開始条件：{stages.find((stage) => stage.trigger === form.trigger)?.title || form.trigger}</p></div>
            <button type="button" onClick={() => { setForm(null); setEditing(null); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">閉じる</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-slate-300">設定名<input required maxLength={100} value={form.name} onChange={(e) => update('name', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
            <label className="text-xs text-slate-300">送信チャネル<select value={form.channel} onChange={(e) => update('channel', e.target.value as MarketingChannel)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="email">メール</option><option value="line">LINE</option><option value="both">メール + LINE</option></select></label>
            <label className="text-xs text-slate-300">送信までの待機時間（分）<input type="number" min={0} max={525600} value={form.waitMinutes} onChange={(e) => update('waitMinutes', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
            <label className="text-xs text-slate-300">対象条件のメモ<input maxLength={300} value={form.audience} onChange={(e) => update('audience', e.target.value)} placeholder="例：配信同意があり、未予約のリード" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
            {form.channel !== 'email' && <label className="text-xs text-slate-300 md:col-span-2">LINE本文<textarea maxLength={5000} rows={4} value={form.messageBody} onChange={(e) => update('messageBody', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>}
            {(form.channel === 'email' || form.channel === 'both') && <>
              <label className="text-xs text-slate-300 md:col-span-2">メール件名<input maxLength={200} value={form.emailSubject} onChange={(e) => update('emailSubject', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-300 md:col-span-2">メール本文<textarea maxLength={10000} rows={5} value={form.emailBody} onChange={(e) => update('emailBody', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
            </>}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-amber-300">現在は下書き保存のみです。配信同意の確認、イベント連動、実送信は未接続です。</p>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><Save className="h-4 w-4" />保存</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {stages.map((stage, index) => (
          <section key={stage.trigger} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-indigo-300" /><h2 className="font-bold text-white">{stage.title}</h2></div><p className="mt-2 max-w-3xl text-sm leading-5 text-slate-400">{stage.description}</p></div>
              <button onClick={() => startCreate(index)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><Plus className="h-4 w-4" />設定を追加</button>
            </div>
            <div className="mt-4 space-y-2">
              {scenarioCounts[index].length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">フォロー設定はまだありません</p> : scenarioCounts[index].map((scenario) => <div key={scenario.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                <div><div className="font-semibold text-white">{scenario.name}</div><div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400"><span className="inline-flex items-center gap-1">{scenario.channel !== 'email' ? <MessageCircle className="h-3 w-3" /> : <Mail className="h-3 w-3" />}{scenario.channel === 'both' ? 'メール + LINE' : scenario.channel === 'email' ? 'メール' : 'LINE'}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{scenario.waitMinutes}分後</span><span>{scenario.status === 'prepared' ? '準備済み' : '下書き'}</span></div></div>
                <div className="flex gap-2"><button onClick={() => startEdit(scenario)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">編集</button><button onClick={() => remove(scenario)} aria-label="設定を削除" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>
              </div>)}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-5">
        <h2 className="font-bold text-amber-100">フォローを止める条件</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">返信があった、予約・商談に進んだ、契約が成立した、または配信停止になった場合にフォローを止める方針です。実際の自動停止は、CRMイベント・返信取得・配信基盤の接続後に有効になります。</p>
      </section>
    </div>
  );
};
