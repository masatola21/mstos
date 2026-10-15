import React, { useMemo, useState } from 'react';
import { Activity, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, GitBranch, Image as ImageIcon, Mail, MessageCircle, MousePointerClick, Plus, Radio, Save, Tags, Trash2, Users, Webhook, Zap } from 'lucide-react';
import { MarketingChannel, MarketingLineMessageType, MarketingScenario, MarketingTrigger } from '../../types/marketing';

interface Props {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
}

const triggerOptions: Array<{ value: MarketingTrigger; label: string }> = [
  { value: 'lead_created', label: '見込み客が登録された時' },
  { value: 'diagnosis_completed', label: '診断が完了した時' },
  { value: 'tag_added', label: '指定タグが付いた時' },
  { value: 'booking_created', label: '予約が登録された時' },
  { value: 'deal_won', label: '商談が成約した時' },
  { value: 'manual', label: '手動で開始' },
];
const channelLabels: Record<MarketingChannel, string> = { line: 'LINE', email: 'メール', both: 'LINE + メール' };
const lineMessageLabels: Record<MarketingLineMessageType, string> = { text: 'テキスト', image: '画像', flex: 'Flex' };

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const emptyScenario = (): Omit<MarketingScenario, 'id' | 'updatedAt'> => ({
  name: '',
  trigger: 'lead_created',
  channel: 'line',
  audience: 'すべての見込み客',
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
});

export const MarketingAutomationPrototypeView: React.FC<Props> = ({ scenarios, onScenariosChange }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'scenarios' | 'connections'>('overview');
  const [editing, setEditing] = useState<MarketingScenario | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyScenario());
  const [notice, setNotice] = useState('');
  const preparedCount = scenarios.filter((scenario) => scenario.status === 'prepared').length;
  const lineCount = scenarios.filter((scenario) => scenario.channel !== 'email').length;
  const emailCount = scenarios.filter((scenario) => scenario.channel !== 'line').length;
  const triggerLabel = useMemo(() => Object.fromEntries(triggerOptions.map((option) => [option.value, option.label])) as Record<MarketingTrigger, string>, []);

  const startNew = () => {
    setEditing(null);
    setIsFormOpen(true);
    setForm(emptyScenario());
    setActiveTab('scenarios');
    setNotice('');
  };
  const startEdit = (scenario: MarketingScenario) => {
    setEditing(scenario);
    setIsFormOpen(true);
    setForm({
      name: scenario.name,
      trigger: scenario.trigger,
      channel: scenario.channel,
      audience: scenario.audience,
      waitMinutes: scenario.waitMinutes,
      emailSubject: scenario.emailSubject,
      messageBody: scenario.messageBody || '',
      emailBody: scenario.emailBody || '',
      lineMessageType: scenario.lineMessageType || 'text',
      lineImageUrl: scenario.lineImageUrl || '',
      linePreviewImageUrl: scenario.linePreviewImageUrl || scenario.lineImageUrl || '',
      flexAltText: scenario.flexAltText || '',
      flexTitle: scenario.flexTitle || '',
      flexBody: scenario.flexBody || '',
      flexButtonLabel: scenario.flexButtonLabel || '',
      flexButtonUrl: scenario.flexButtonUrl || '',
      status: scenario.status,
    });
  };
  const saveScenario = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.channel !== 'email' && form.lineMessageType === 'image' && (!isHttpsUrl(form.lineImageUrl) || !isHttpsUrl(form.linePreviewImageUrl))) {
      setNotice('画像URLはHTTPSで公開されているURLを指定してください。');
      return;
    }
    if (form.channel !== 'email' && form.lineMessageType === 'flex' && Boolean(form.flexButtonLabel) !== Boolean(form.flexButtonUrl)) {
      setNotice('Flexのボタン名とURLは両方入力するか、両方空欄にしてください。');
      return;
    }
    if (form.channel !== 'email' && form.lineMessageType === 'flex' && form.flexButtonUrl && !isHttpsUrl(form.flexButtonUrl)) {
      setNotice('FlexのボタンURLはHTTPSのURLを指定してください。');
      return;
    }
    const now = Date.now();
    const saved: MarketingScenario = {
      ...form,
      id: editing?.id || `marketing-${now}`,
      updatedAt: now,
      status: 'draft',
    };
    onScenariosChange(editing
      ? scenarios.map((scenario) => scenario.id === editing.id ? saved : scenario)
      : [saved, ...scenarios]);
    setEditing(null);
    setIsFormOpen(false);
    setNotice('シナリオを保存しました。配信接続が完了するまでは実行されません。');
  };
  const deleteScenario = (scenario: MarketingScenario) => {
    if (!window.confirm(`「${scenario.name}」を削除しますか？`)) return;
    onScenariosChange(scenarios.filter((item) => item.id !== scenario.id));
    setNotice('シナリオを削除しました。');
  };
  const markPrepared = (scenario: MarketingScenario) => {
    // Prepared means configured for later activation. No message is sent by this UI.
    onScenariosChange(scenarios.map((item) => item.id === scenario.id ? { ...item, status: item.status === 'prepared' ? 'draft' : 'prepared', updatedAt: Date.now() } : item));
    setNotice('設定状態を保存しました。実配信はまだ行われません。');
  };
  const update = <K extends keyof ReturnType<typeof emptyScenario>>(key: K, value: ReturnType<typeof emptyScenario>[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const flexPayload = {
    type: 'bubble',
    body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
      { type: 'text', text: form.flexTitle || 'タイトル', weight: 'bold', size: 'xl', wrap: true },
      { type: 'text', text: form.flexBody || '本文がここに表示されます。', size: 'sm', wrap: true, margin: 'md' },
    ] },
    ...(form.flexButtonLabel && form.flexButtonUrl ? { footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', action: { type: 'uri', label: form.flexButtonLabel, uri: form.flexButtonUrl } }] } } : {}),
  };

  const tabs = [
    { id: 'overview' as const, label: '顧客導線', icon: GitBranch },
    { id: 'scenarios' as const, label: 'シナリオ設定', icon: Zap },
    { id: 'connections' as const, label: 'LINE・メール接続', icon: Webhook },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-white">マーケティングオートメーション</h1>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">段階導入</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">MSTの顧客情報を起点に、診断・案内・予約・商談・契約後フォローをシナリオ化します。定型条件はルールで動かし、文案や判断が必要な時だけAIを使います。</p>
          </div>
          <button onClick={startNew} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"><Plus className="h-4 w-4" />シナリオ作成</button>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto border-t border-slate-800 pt-4">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setActiveTab(id); setNotice(''); }} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </section>

      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {activeTab === 'overview' && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '登録シナリオ', value: String(scenarios.length), note: 'Supabaseに保存', icon: GitBranch, color: 'text-cyan-300' },
            { label: '準備済み', value: String(preparedCount), note: '配信接続後に有効化', icon: CheckCircle2, color: 'text-emerald-300' },
            { label: 'LINEを使うシナリオ', value: String(lineCount), note: '接続設定が必要', icon: MessageCircle, color: 'text-green-300' },
            { label: 'メールを使うシナリオ', value: String(emailCount), note: '送信サービス設定が必要', icon: Mail, color: 'text-purple-300' },
          ].map(({ label, value, note, icon: Icon, color }) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><Icon className={`h-4 w-4 ${color}`} /></div><div className="mt-2 text-2xl font-black text-white">{value}</div><div className="mt-1 text-[11px] text-slate-500">{note}</div></div>)}
        </div>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-white">顧客導線</h2><p className="mt-1 text-xs text-slate-400">一つの顧客情報を中心に、連絡と営業業務をつなぎます。</p></div><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">定型処理はAI不要</span></div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { title: '集客・登録', detail: '広告 / SNS / 紹介', icon: MousePointerClick },
              { title: 'フォーム・診断', detail: '回答・所見保存', icon: CheckCircle2 },
              { title: 'タグ・区分', detail: '条件で自動分類', icon: Tags },
              { title: 'LINE・メール', detail: 'シナリオ配信', icon: MessageCircle },
              { title: '予約・商談', detail: '案内・担当タスク', icon: CalendarDays },
              { title: '契約後フォロー', detail: '契約・請求・支援', icon: BadgeCheck },
            ].map(({ title, detail, icon: Icon }, index) => <div key={title} className="relative rounded-xl border border-slate-800 bg-slate-950/70 p-4"><Icon className="mb-3 h-5 w-5 text-indigo-300" /><div className="text-sm font-bold text-white">{title}</div><div className="mt-1 text-[11px] text-slate-400">{detail}</div>{index < 5 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-slate-600 xl:block" />}</div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-300" /><h2 className="font-bold text-white">保存先と接続状態</h2></div><p className="mt-2 text-sm text-slate-300">シナリオはユーザー別のSupabaseワークスペースに保存します。LINE・メールの認証情報はブラウザーには保存せず、サーバー側の接続設定後に実配信を追加します。</p><button onClick={() => setActiveTab('connections')} className="mt-3 text-xs font-semibold text-indigo-300 hover:text-indigo-200">接続状況を確認 →</button></section>
      </>}

      {activeTab === 'scenarios' && <div className="space-y-4">
        {isFormOpen ? (
          <form onSubmit={saveScenario} className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-white">{editing ? 'シナリオを編集' : '新しいシナリオ'}</h2><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false); setNotice(''); }} className="text-xs text-slate-400 hover:text-white">閉じる</button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-300">シナリオ名<input required maxLength={100} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="例：診断完了後のフォロー" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">開始条件<select value={form.trigger} onChange={(e) => update('trigger', e.target.value as MarketingTrigger)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{triggerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="text-xs text-slate-300">配信先の区分<input maxLength={160} value={form.audience} onChange={(e) => update('audience', e.target.value)} placeholder="例：診断完了タグが付いた見込み客" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">配信チャネル<select value={form.channel} onChange={(e) => update('channel', e.target.value as MarketingChannel)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="line">LINE</option><option value="email">メール</option><option value="both">LINE + メール</option></select></label>
              <label className="text-xs text-slate-300">待機時間（分）<input type="number" min={0} max={525600} value={form.waitMinutes} onChange={(e) => update('waitMinutes', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              {form.channel !== 'email' && <fieldset className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4 md:col-span-2"><legend className="px-2 text-xs font-bold text-green-300">LINEメッセージ形式</legend>
                <label className="block text-xs text-slate-300">形式<select value={form.lineMessageType} onChange={(e) => update('lineMessageType', e.target.value as MarketingLineMessageType)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="text">テキスト</option><option value="image">画像</option><option value="flex">Flex Message（カード）</option></select></label>
                {form.lineMessageType === 'text' && <label className="block text-xs text-slate-300">LINE本文<textarea required maxLength={5000} rows={5} value={form.messageBody} onChange={(e) => update('messageBody', e.target.value)} placeholder="配信内容。{name} などの差し込みは配信接続時に設定します。" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>}
                {form.lineMessageType === 'image' && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">画像URL（HTTPS）<input type="url" required value={form.lineImageUrl} onChange={(e) => update('lineImageUrl', e.target.value)} placeholder="https://example.com/image.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">プレビュー画像URL（HTTPS）<input type="url" required value={form.linePreviewImageUrl} onChange={(e) => update('linePreviewImageUrl', e.target.value)} placeholder="https://example.com/preview.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px] leading-5 text-slate-400 md:col-span-2">LINEが取得できる公開HTTPS画像を指定します。<div className="mt-3 flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-950">{form.linePreviewImageUrl || form.lineImageUrl ? <img src={form.linePreviewImageUrl || form.lineImageUrl} alt="LINE画像プレビュー" className="max-h-64 max-w-full object-contain" /> : <span>画像プレビュー</span>}</div></div></div>}
                {form.lineMessageType === 'flex' && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">通知・代替テキスト<input required maxLength={400} value={form.flexAltText} onChange={(e) => update('flexAltText', e.target.value)} placeholder="例：新商品のご案内" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">カードタイトル<input required maxLength={120} value={form.flexTitle} onChange={(e) => update('flexTitle', e.target.value)} placeholder="カードの見出し" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300 md:col-span-2">カード本文<textarea required maxLength={800} rows={4} value={form.flexBody} onChange={(e) => update('flexBody', e.target.value)} placeholder="Flexカードに表示する内容" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">ボタン名（任意）<input maxLength={20} value={form.flexButtonLabel} onChange={(e) => update('flexButtonLabel', e.target.value)} placeholder="詳しく見る" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">ボタンURL（任意）<input type="url" value={form.flexButtonUrl} onChange={(e) => update('flexButtonUrl', e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 md:col-span-2"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-indigo-200"><ImageIcon className="h-4 w-4" />Flexカードプレビュー</div><div className="mx-auto max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl"><div className="text-lg font-bold">{form.flexTitle || 'カードタイトル'}</div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{form.flexBody || 'カード本文のプレビュー'}</p>{form.flexButtonLabel && <div className="mt-5 rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white">{form.flexButtonLabel}</div>}</div><details className="mt-4"><summary className="cursor-pointer text-xs text-slate-400">生成されるFlex JSONを確認</summary><pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300">{JSON.stringify({ type: 'flex', altText: form.flexAltText || 'Flexメッセージ', contents: flexPayload }, null, 2)}</pre></details></div>
                </div>}
              </fieldset>}
              {(form.channel === 'email' || form.channel === 'both') && <div className="grid gap-4 md:col-span-2 md:grid-cols-2"><label className="text-xs text-slate-300">メール件名<input required maxLength={200} value={form.emailSubject} onChange={(e) => update('emailSubject', e.target.value)} placeholder="件名" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300 md:col-span-2">メール本文<textarea required maxLength={10000} rows={5} value={form.emailBody} onChange={(e) => update('emailBody', e.target.value)} placeholder="メール本文。{name} などの差し込みは配信接続時に設定します。" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label></div>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-slate-500">画像は公開HTTPS URLを指定します。Flexはカード設定からJSONを生成します。今の段階では下書き保存のみで送信されません。</p><div className="flex gap-2"><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false); setNotice(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">キャンセル</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><Save className="h-4 w-4" />保存</button></div></div>
          </form>
        ) : null}
        {scenarios.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center"><GitBranch className="mx-auto h-8 w-8 text-slate-500" /><h2 className="mt-3 font-bold text-white">シナリオはまだありません</h2><p className="mt-1 text-sm text-slate-400">「シナリオ作成」から、開始条件とLINE・メールの配信文案を登録できます。</p><button onClick={startNew} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">最初のシナリオを作成</button></div> : <div className="space-y-3">{scenarios.map((scenario) => <article key={scenario.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"><div><div className="font-bold text-white">{scenario.name}</div><div className="mt-1 text-xs text-slate-400">{triggerLabel[scenario.trigger]} ・ {scenario.audience}</div></div><div className="text-xs text-slate-300">{channelLabels[scenario.channel]}{scenario.channel !== 'email' ? ` ・ LINE${lineMessageLabels[scenario.lineMessageType || 'text']}` : ''}{scenario.waitMinutes > 0 ? ` ・ ${scenario.waitMinutes}分後` : ''}</div><div className="text-xs"><span className={scenario.status === 'prepared' ? 'text-emerald-300' : 'text-amber-300'}>{scenario.status === 'prepared' ? '準備済み（未配信）' : '下書き'}</span><div className="mt-1 text-[10px] text-slate-500">{new Date(scenario.updatedAt).toLocaleString()}</div></div><div className="flex gap-2"><button onClick={() => { markPrepared(scenario); }} className={`rounded-lg border px-3 py-2 text-xs ${scenario.status === 'prepared' ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{scenario.status === 'prepared' ? '準備済み' : '準備状態にする'}</button><button onClick={() => { startEdit(scenario); setNotice(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">編集</button><button onClick={() => deleteScenario(scenario)} aria-label="シナリオを削除" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div></article>)}</div>}
        {!editing && scenarios.length > 0 && <p className="text-[11px] text-slate-500">「準備状態」はシナリオの設定整理を示します。配信接続と実行処理が未実装のため、自動送信はしません。</p>}
      </div>}

      {activeTab === 'connections' && <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-300" /><div><h2 className="text-lg font-bold text-white">LINE公式アカウント</h2><p className="text-xs text-slate-400">Messaging APIを利用</p></div></div><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-amber-300">未接続</span></div><p className="mt-4 text-sm leading-6 text-slate-300">チャネルアクセストークンなどの秘密情報は、フロントエンドやブラウザー保存に置かず、Supabase Edge Functionのサーバー側シークレットとして設定します。</p></section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Mail className="h-5 w-5 text-purple-300" /><div><h2 className="text-lg font-bold text-white">メール送信サービス</h2><p className="text-xs text-slate-400">Resendなど差し替え可能な送信アダプター</p></div></div><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-amber-300">未接続</span></div><p className="mt-4 text-sm leading-6 text-slate-300">送信元ドメインとAPIキーをサーバー側に設定します。特定のメールサービスに固定しないアダプター構成を想定しています。</p></section>
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-5 lg:col-span-2"><h2 className="font-bold text-white">実配信を有効にする前の確認</h2><p className="mt-2 text-sm leading-6 text-slate-300">次の段階で、LINE / メールのサーバー側送信処理、配信同意・停止、重複送信防止、送信履歴、承認設定を追加します。接続先を交換できるようにし、MSTの顧客台帳をデータの正本に保ちます。</p></section>
      </div>}
    </div>
  );
};
