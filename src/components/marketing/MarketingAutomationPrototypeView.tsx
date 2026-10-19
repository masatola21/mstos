import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { Activity, ArrowRight, CheckCircle2, Copy, GitBranch, Image as ImageIcon, Mail, MessageCircle, MousePointerClick, Plus, Radio, Save, Tags, Trash2, Zap } from 'lucide-react';
import { MarketingChannel, MarketingLineMessageType, MarketingScenario, MarketingTrigger } from '../../types/marketing';
import { MarketingBroadcastView } from './MarketingBroadcastView';
import { MarketingLineInboxView } from './MarketingLineInboxView';

interface Props {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
  onNavigateTab?: (tab: 'communication_send' | 'custom_lists' | 'contacts') => void;
}

const triggerOptions: Array<{ value: MarketingTrigger; label: string }> = [
  { value: 'prospect_selected', label: '営業対象に選ばれた時' },
  { value: 'lead_created', label: '見込み客が登録された時' },
  { value: 'line_registered', label: 'LINE登録された時' },
  { value: 'diagnosis_invited', label: '診断案内を送った時' },
  { value: 'diagnosis_completed', label: '診断が完了した時' },
  { value: 'report_approved', label: '診断レポートが承認された時' },
  { value: 'report_sent', label: '診断レポートを送付した時' },
  { value: 'meeting_completed', label: '面談が完了した時' },
  { value: 'tag_added', label: '指定タグが付いた時' },
  { value: 'booking_created', label: '予約が登録された時' },
  { value: 'deal_stage_changed', label: '商談ステージが変わった時' },
  { value: 'deal_won', label: '商談が成約した時' },
  { value: 'proposal_approved', label: '提案書が承認された時' },
  { value: 'proposal_sent', label: '提案書を送付した時' },
  { value: 'contract_sent', label: '契約書を送付した時' },
  { value: 'contract_signed', label: '契約が締結された時' },
  { value: 'invoice_due', label: '請求予定日になった時' },
  { value: 'invoice_overdue', label: '請求期日を超過した時' },
  { value: 'retainer_period', label: '顧問サポート時期になった時' },
  { value: 'project_milestone', label: '構築工程の節目に到達した時' },
  { value: 'manual', label: '手動で開始' },
];
const channelLabels: Record<MarketingChannel, string> = { line: 'LINE', email: 'メール', both: 'LINE + メール' };
const lineMessageLabels: Record<MarketingLineMessageType, string> = { text: 'テキスト', image: '画像', video: '動画', flex: 'Flex' };

const workflowStages = [
  {
    title: '配信対象と開始条件を設定',
    trigger: 'CRMセグメント、または登録した開始条件を選ぶ',
    automation: 'CRMセグメントの選択と、シナリオ条件の保存ができます。イベントを受けた自動起動は未接続です。',
    ai: '対象者の条件を整理し、必要なら外部AIで施策案を作成できます。顧客データを外部AIへ貼り付けないでください。',
    approval: '配信対象と開始条件を人が確認します。',
    data: 'CRMセグメント・シナリオ設定',
    status: '条件保存まで / 自動起動未接続',
  },
  {
    title: 'LINE・メールの文案を準備',
    trigger: 'シナリオを新規作成、または編集する',
    automation: 'LINE・メールの本文やカードを入力し、下書きとして保存できます。',
    ai: '定型外の施策は外部AIで草案を作り、JSONを取り込んで内容を編集できます。アプリ内AI APIは呼び出しません。',
    approval: '宛先に合わせた文面・リンク・添付内容を人が確認します。',
    data: 'シナリオ・配信文案',
    status: '文案保存まで / 実配信未接続',
  },
  {
    title: '確認して配信へ進む',
    trigger: '文案を確認し、シナリオを準備済みにする',
    automation: '準備状態を記録できます。現在は配信実行や送信履歴の記録は行いません。',
    ai: 'AIは送信を実行しません。必要な文章作成を補助する場合も、送信前に人が確認します。',
    approval: '配信同意・停止対象・宛先・本文を確認してから実配信できる設計にします。',
    data: '準備状態・配信同意・送信履歴（送信機能は未接続）',
    status: '準備状態のみ / 承認・送信連携未接続',
  },
];

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
  lineVideoUrl: '',
  lineVideoPreviewUrl: '',
  flexAltText: '',
  flexTitle: '',
  flexBody: '',
  flexButtonLabel: '',
  flexButtonUrl: '',
  status: 'draft',
});

export const MarketingAutomationPrototypeView: React.FC<Props> = ({ scenarios, onScenariosChange, onNavigateTab }) => {
  const [segments, setSegments] = useState<Array<{id:string;name:string;entity_type:string}>>([]);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.from('crm_segments').select('id,name,entity_type').order('name')
      .then(({data,error}) => { if (!error) setSegments(data || []); });
  }, []);
  const audienceLabel = (value: string) => {
    const id = value.startsWith('segment:') ? value.slice('segment:'.length) : '';
    return segments.find((segment) => segment.id === id)?.name || value || '配信対象未設定';
  };
  const [activeTab, setActiveTab] = useState<'home' | 'email' | 'line' | 'scenarios'>('home');
  const [lineView, setLineView] = useState<'broadcast' | 'inbox'>('broadcast');
  const [editing, setEditing] = useState<MarketingScenario | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyScenario());
  const [notice, setNotice] = useState('');
  const [externalGoal, setExternalGoal] = useState('');
  const [externalResult, setExternalResult] = useState('');
  const preparedCount = scenarios.filter((scenario) => scenario.status === 'prepared').length;
  const lineCount = scenarios.filter((scenario) => scenario.channel !== 'email').length;
  const emailCount = scenarios.filter((scenario) => scenario.channel !== 'line').length;
  const triggerLabel = useMemo(() => Object.fromEntries(triggerOptions.map((option) => [option.value, option.label])) as Record<MarketingTrigger, string>, []);

  const startNew = () => {
    setEditing(null);
    setIsFormOpen(true);
    setForm(emptyScenario());
    setExternalGoal('');
    setExternalResult('');
    setActiveTab('scenarios');
    setNotice('');
  };
  const startEdit = (scenario: MarketingScenario) => {
    setEditing(scenario);
    setIsFormOpen(true);
    setExternalGoal('');
    setExternalResult('');
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
      lineVideoUrl: scenario.lineVideoUrl || '',
      lineVideoPreviewUrl: scenario.lineVideoPreviewUrl || '',
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
    if (form.channel !== 'email' && form.lineMessageType === 'video' && (!isHttpsUrl(form.lineVideoUrl) || !isHttpsUrl(form.lineVideoPreviewUrl))) {
      setNotice('動画とプレビュー画像は公開HTTPS URLを指定してください。LINE動画はMP4、プレビュー画像はJPEGまたはPNGが必要です。');
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

  const copyExternalPrompt = async () => {
    const prompt = [
      'あなたはマーケティング施策の設計者です。以下の目的と条件に沿って、配信シナリオの草案を日本語で作成してください。',
      '個人情報や実在顧客の情報は使わず、汎用的な案にしてください。指定したJSONだけを返し、コードフェンスや説明文は付けないでください。',
      'JSON項目: name（シナリオ名）, trigger（開始条件の値）, channel（line/email/both）, audience（配信対象）, waitMinutes（待機分）, emailSubject, emailBody, messageBody（LINE本文）, lineMessageType（text/image/flex）, flexAltText, flexTitle, flexBody, flexButtonLabel, flexButtonUrl, lineVideoUrl, lineVideoPreviewUrl',
      '開始条件は次の値から選択: ' + triggerOptions.map((option) => option.value).join(', '),
      '画像URLやボタンURLは、具体的な公開URLが指定されていない場合は空欄にしてください。',
      '目的・依頼内容: ' + (externalGoal || '（未入力。現在の設定をもとに改善案を作成）'),
      '現在の設定: ' + JSON.stringify({ trigger: form.trigger, channel: form.channel, waitMinutes: form.waitMinutes, lineMessageType: form.lineMessageType }),
      'JSON例: {"name":"診断後フォロー","trigger":"diagnosis_completed","channel":"email","audience":"診断完了者","waitMinutes":0,"emailSubject":"診断結果のご案内","emailBody":"本文","messageBody":"","lineMessageType":"text","flexAltText":"","flexTitle":"","flexBody":"","flexButtonLabel":"","flexButtonUrl":""}',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice('外部AIへの依頼文をコピーしました。外部AIの回答を下の欄に貼り付けてください。');
    } catch {
      setNotice('コピーできませんでした。ブラウザーのクリップボード権限を確認してください。');
    }
  };
  const applyExternalResult = () => {
    try {
      const jsonText = externalResult.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
      const next = { ...form };
      if (typeof parsed.name === 'string') next.name = parsed.name.slice(0, 100);
      if (typeof parsed.trigger === 'string' && triggerOptions.some((option) => option.value === parsed.trigger)) next.trigger = parsed.trigger;
      if (parsed.channel === 'line' || parsed.channel === 'email' || parsed.channel === 'both') next.channel = parsed.channel;
      if (typeof parsed.audience === 'string' && !form.audience.startsWith('segment:')) next.audience = parsed.audience.slice(0, 160);
      if (typeof parsed.waitMinutes === 'number' && Number.isFinite(parsed.waitMinutes)) next.waitMinutes = Math.min(525600, Math.max(0, Math.round(parsed.waitMinutes)));
      if (typeof parsed.emailSubject === 'string') next.emailSubject = parsed.emailSubject.slice(0, 200);
      if (typeof parsed.emailBody === 'string') next.emailBody = parsed.emailBody.slice(0, 10000);
      if (typeof parsed.messageBody === 'string') next.messageBody = parsed.messageBody.slice(0, 5000);
      if (parsed.lineMessageType === 'text' || parsed.lineMessageType === 'image' || parsed.lineMessageType === 'flex') next.lineMessageType = parsed.lineMessageType;
      if (typeof parsed.lineImageUrl === 'string') next.lineImageUrl = parsed.lineImageUrl;
      if (typeof parsed.linePreviewImageUrl === 'string') next.linePreviewImageUrl = parsed.linePreviewImageUrl;
      if (typeof parsed.flexAltText === 'string') next.flexAltText = parsed.flexAltText.slice(0, 400);
      if (typeof parsed.flexTitle === 'string') next.flexTitle = parsed.flexTitle.slice(0, 120);
      if (typeof parsed.flexBody === 'string') next.flexBody = parsed.flexBody.slice(0, 800);
      if (typeof parsed.flexButtonLabel === 'string') next.flexButtonLabel = parsed.flexButtonLabel.slice(0, 20);
      if (typeof parsed.flexButtonUrl === 'string') next.flexButtonUrl = parsed.flexButtonUrl;
      setForm(next);
      setNotice('草案をシナリオ設定に反映しました。内容を確認・編集してから保存してください。');
    } catch {
      setNotice('JSONを読み取れませんでした。外部AIの回答をJSON形式で貼り付けてください。');
    }
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
    { id: 'home' as const, label: '全体', icon: GitBranch },
    { id: 'line' as const, label: 'LINE', icon: MessageCircle },
    { id: 'email' as const, label: 'メール', icon: Mail },
    { id: 'scenarios' as const, label: '自動化', icon: Zap }, 
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-white">顧客コミュニケーション</h1>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">自動実行は未接続</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">LINE・メールの案内と自動化をまとめて管理します。顧客・リード情報は既存のCRMを正本として利用します。</p>
          </div>
          <button onClick={startNew} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"><Plus className="h-4 w-4" />シナリオ作成</button>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto border-t border-slate-800 pt-4">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setActiveTab(id); setNotice(''); }} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </section>

      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {activeTab === 'email' && <MarketingBroadcastView initialChannel="email" />}
      {activeTab === 'line' && <div className="space-y-4"><div className="flex gap-2 border-b border-slate-800 pb-3"><button onClick={()=>setLineView('broadcast')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${lineView==='broadcast'?'bg-green-700 text-white':'text-slate-400 hover:bg-slate-800'}`}>配信</button><button onClick={()=>setLineView('inbox')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${lineView==='inbox'?'bg-green-700 text-white':'text-slate-400 hover:bg-slate-800'}`}>受信箱・自動返信</button></div>{lineView==='broadcast'?<MarketingBroadcastView initialChannel="line"/>:<MarketingLineInboxView/>}</div>}
      {activeTab === 'home' && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '登録シナリオ', value: String(scenarios.length), note: '手動確認・配信の準備', icon: GitBranch, color: 'text-cyan-300' },
            { label: '準備済み', value: String(preparedCount), note: '自動配信は未接続', icon: CheckCircle2, color: 'text-emerald-300' },
            { label: 'LINEシナリオ', value: String(lineCount), note: 'LINE配信設定へ', icon: MessageCircle, color: 'text-green-300' },
            { label: 'メールシナリオ', value: String(emailCount), note: 'メール送信設定へ', icon: Mail, color: 'text-purple-300' },
          ].map(({ label, value, note, icon: Icon, color }) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><Icon className={`h-4 w-4 ${color}`} /></div><div className="mt-2 text-2xl font-black text-white">{value}</div><div className="mt-1 text-[11px] text-slate-500">{note}</div></div>)}
        </div>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4"><h2 className="font-bold text-white">チャネルから開く</h2><p className="mt-1 text-xs text-slate-400">顧客・リード情報は既存CRMを正本として使い、フォームは既存機能を利用します。</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-green-500/20 bg-slate-950/70 p-5">
              <div className="flex items-center gap-3"><MessageCircle className="h-6 w-6 text-green-300" /><div><h3 className="font-bold text-white">LINE</h3><p className="text-xs text-slate-400">一斉配信・友だち情報・受信対応</p></div></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setActiveTab('line')} className="rounded-lg bg-green-700/70 px-3 py-2 text-xs font-semibold text-white hover:bg-green-600">LINE配信</button>
                <button onClick={() => {setActiveTab('line');setLineView('inbox')}} className="rounded-lg border border-green-700/50 px-3 py-2 text-xs text-green-200 hover:bg-slate-800">受信箱・自動返信</button>
                <button onClick={() => onNavigateTab?.('contacts')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">友だち・タグ管理</button>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">自動化シナリオは共通タブで設定します。</p>
            </article>
            <article className="rounded-xl border border-purple-500/20 bg-slate-950/70 p-5">
              <div className="flex items-center gap-3"><Mail className="h-6 w-6 text-purple-300" /><div><h3 className="font-bold text-white">メール</h3><p className="text-xs text-slate-400">見込み企業への営業・一斉メール</p></div></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setActiveTab('email')} className="rounded-lg bg-purple-700/70 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-600">メール送信・営業</button>
                <button onClick={() => setActiveTab('scenarios')} className="rounded-lg border border-purple-700/50 px-3 py-2 text-xs text-purple-200 hover:bg-slate-800">メール自動化</button>
                <button onClick={() => onNavigateTab?.('communication_send')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">送信センター</button>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">次の段階でメール受信箱を追加できる構成です。</p>
            </article>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4"><h2 className="font-bold text-white">共通の自動化</h2><p className="mt-1 text-xs text-slate-400">シナリオ内で開始条件と対象を設定し、配信前に確認します。</p></div>
          <div className="grid gap-3">
            <button onClick={() => setActiveTab('scenarios')} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-left hover:border-indigo-500/40"><span><span className="block text-sm font-bold text-white">シナリオ設定</span><span className="mt-1 block text-xs text-slate-400">開始条件・配信対象・チャネル・文案を設定</span></span><ArrowRight className="h-4 w-4 text-indigo-300" /></button>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-slate-500">集客チャネルや外部アプリ連携は、必要になった時にチャネルとして追加できます。</p>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-bold text-white">配信サービスの接続</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">APIキーなどの秘密情報はブラウザーに保存せず、サーバーの環境変数で管理します。ここから設定画面へ移動する必要はありません。</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><div className="text-sm font-semibold text-green-200">LINE公式アカウント</div><p className="mt-1 text-xs text-slate-400">サーバー側に LINE_CHANNEL_ACCESS_TOKEN と LINE_CHANNEL_SECRET を設定します。</p></div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><div className="text-sm font-semibold text-purple-200">メール送信</div><p className="mt-1 text-xs text-slate-400">サーバー側に RESEND_API_KEY と RESEND_FROM_EMAIL を設定します。</p></div>
          </div>
        </section>
      </>}

      {activeTab === 'scenarios' && <div className="space-y-4">
        {isFormOpen ? (
          <form onSubmit={saveScenario} className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-white">{editing ? 'シナリオを編集' : '新しいシナリオ'}</h2><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false); setNotice(''); }} className="text-xs text-slate-400 hover:text-white">閉じる</button></div>
            <section className="mb-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4">
              <h3 className="text-sm font-bold text-indigo-100">外部AIでシナリオ草案を作る</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">ここではAI APIを呼び出しません。依頼文をコピーして外部AIに貼り、回答を取り込んで確認・編集できます。顧客個人情報は入力しないでください。</p>
              <label className="mt-3 block text-xs text-slate-300">施策の目的・依頼内容<textarea rows={3} maxLength={3000} value={externalGoal} onChange={(e) => setExternalGoal(e.target.value)} placeholder="例：診断完了後、面談予約につながる案内を3日後にメールで送る" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <button type="button" onClick={() => void copyExternalPrompt()} className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-400/30 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/10"><Copy className="h-4 w-4" />外部AIへの依頼文をコピー</button>
              <label className="mt-4 block text-xs text-slate-300">外部AIの回答（JSON）<textarea rows={5} value={externalResult} onChange={(e) => setExternalResult(e.target.value)} placeholder='{"name":"診断後フォロー","trigger":"diagnosis_completed","channel":"email"}' className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white" /></label>
              <button type="button" disabled={!externalResult.trim()} onClick={applyExternalResult} className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">草案をフォームに反映</button>
            </section>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-300">シナリオ名<input required maxLength={100} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="例：診断完了後のフォロー" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">開始条件<select value={form.trigger} onChange={(e) => update('trigger', e.target.value as MarketingTrigger)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{triggerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <div className="text-xs text-slate-300">配信対象の保存区分<select value={form.audience.startsWith('segment:') && segments.some((segment)=>segment.id===form.audience.slice(8)) ? form.audience : 'manual'} onChange={(e)=>update('audience',e.target.value==='manual'?'':e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="manual">条件をメモとして入力（旧形式）</option>{segments.map((segment)=><option key={segment.id} value={`segment:${segment.id}`}>{segment.name}（{segment.entity_type}）</option>)}</select>{(!form.audience.startsWith('segment:') || !segments.some((segment)=>segment.id===form.audience.slice(8))) && <input maxLength={160} value={form.audience} onChange={(e)=>update('audience',e.target.value)} placeholder="配信対象の説明" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />}</div>
              <label className="text-xs text-slate-300">配信チャネル<select value={form.channel} onChange={(e) => update('channel', e.target.value as MarketingChannel)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="line">LINE</option><option value="email">メール</option><option value="both">LINE + メール</option></select></label>
              <label className="text-xs text-slate-300">待機時間（分）<input type="number" min={0} max={525600} value={form.waitMinutes} onChange={(e) => update('waitMinutes', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              {form.channel !== 'email' && <fieldset className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4 md:col-span-2"><legend className="px-2 text-xs font-bold text-green-300">LINEメッセージ形式</legend>
                <label className="block text-xs text-slate-300">形式<select value={form.lineMessageType} onChange={(e) => update('lineMessageType', e.target.value as MarketingLineMessageType)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="text">テキスト</option><option value="image">画像</option><option value="video">動画</option><option value="flex">Flex Message（カード）</option></select></label>
                {form.lineMessageType === 'text' && <label className="block text-xs text-slate-300">LINE本文<textarea required maxLength={5000} rows={5} value={form.messageBody} onChange={(e) => update('messageBody', e.target.value)} placeholder="配信内容。{name} などの差し込みは配信接続時に設定します。" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>}
                {form.lineMessageType === 'image' && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">画像URL（HTTPS）<input type="url" required value={form.lineImageUrl} onChange={(e) => update('lineImageUrl', e.target.value)} placeholder="https://example.com/image.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">プレビュー画像URL（HTTPS）<input type="url" required value={form.linePreviewImageUrl} onChange={(e) => update('linePreviewImageUrl', e.target.value)} placeholder="https://example.com/preview.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px] leading-5 text-slate-400 md:col-span-2">LINEが取得できる公開HTTPS画像を指定します。<div className="mt-3 flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-950">{form.linePreviewImageUrl || form.lineImageUrl ? <img src={form.linePreviewImageUrl || form.lineImageUrl} alt="LINE画像プレビュー" className="max-h-64 max-w-full object-contain" /> : <span>画像プレビュー</span>}</div></div></div>}
                {form.lineMessageType === 'video' && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">動画URL（公開HTTPS・MP4）<input type="url" required value={form.lineVideoUrl} onChange={(e) => update('lineVideoUrl', e.target.value)} placeholder="https://example.com/video.mp4" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">プレビュー画像URL（JPEG/PNG）<input type="url" required value={form.lineVideoPreviewUrl} onChange={(e) => update('lineVideoPreviewUrl', e.target.value)} placeholder="https://example.com/preview.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px] leading-5 text-slate-400 md:col-span-2">動画は公開HTTPSのMP4（200MB以下）、プレビュー画像は公開HTTPSのJPEG/PNG（1MB以下）を指定してください。LINEから取得できるURLが必要です。<div className="mt-3 flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-950">{form.lineVideoPreviewUrl ? <img src={form.lineVideoPreviewUrl} alt="動画プレビュー" className="max-h-64 max-w-full object-contain" /> : <span>動画プレビュー画像</span>}</div></div></div>}
                {form.lineMessageType === 'flex' && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">通知・代替テキスト<input required maxLength={400} value={form.flexAltText} onChange={(e) => update('flexAltText', e.target.value)} placeholder="例：新商品のご案内" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">カードタイトル<input required maxLength={120} value={form.flexTitle} onChange={(e) => update('flexTitle', e.target.value)} placeholder="カードの見出し" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300 md:col-span-2">カード本文<textarea required maxLength={800} rows={4} value={form.flexBody} onChange={(e) => update('flexBody', e.target.value)} placeholder="Flexカードに表示する内容" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">ボタン名（任意）<input maxLength={20} value={form.flexButtonLabel} onChange={(e) => update('flexButtonLabel', e.target.value)} placeholder="詳しく見る" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">ボタンURL（任意）<input type="url" value={form.flexButtonUrl} onChange={(e) => update('flexButtonUrl', e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 md:col-span-2"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-indigo-200"><ImageIcon className="h-4 w-4" />Flexカードプレビュー</div><div className="mx-auto max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl"><div className="text-lg font-bold">{form.flexTitle || 'カードタイトル'}</div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{form.flexBody || 'カード本文のプレビュー'}</p>{form.flexButtonLabel && <div className="mt-5 rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white">{form.flexButtonLabel}</div>}</div><details className="mt-4"><summary className="cursor-pointer text-xs text-slate-400">生成されるFlex JSONを確認</summary><pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300">{JSON.stringify({ type: 'flex', altText: form.flexAltText || 'Flexメッセージ', contents: flexPayload }, null, 2)}</pre></details></div>
                </div>}
              </fieldset>}
              {(form.channel === 'email' || form.channel === 'both') && <div className="grid gap-4 md:col-span-2 md:grid-cols-2"><label className="text-xs text-slate-300">メール件名<input required maxLength={200} value={form.emailSubject} onChange={(e) => update('emailSubject', e.target.value)} placeholder="件名" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300 md:col-span-2">メール本文<textarea required maxLength={10000} rows={5} value={form.emailBody} onChange={(e) => update('emailBody', e.target.value)} placeholder="メール本文。{name} などの差し込みは配信接続時に設定します。" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label></div>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-slate-500">画像は公開HTTPS URLを指定します。Flexはカード設定からJSONを生成します。今の段階では下書き保存のみで送信されません。</p><div className="flex gap-2"><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false); setNotice(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">キャンセル</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><Save className="h-4 w-4" />保存</button></div></div>
          </form>
        ) : null}
        {scenarios.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center"><GitBranch className="mx-auto h-8 w-8 text-slate-500" /><h2 className="mt-3 font-bold text-white">シナリオはまだありません</h2><p className="mt-1 text-sm text-slate-400">「シナリオ作成」から、開始条件とLINE・メールの配信文案を登録できます。</p><button onClick={startNew} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">最初のシナリオを作成</button></div> : <div className="space-y-3">{scenarios.map((scenario) => <article key={scenario.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"><div><div className="font-bold text-white">{scenario.name}</div><div className="mt-1 text-xs text-slate-400">{triggerLabel[scenario.trigger]} ・ {audienceLabel(scenario.audience)}</div></div><div className="text-xs text-slate-300">{channelLabels[scenario.channel]}{scenario.channel !== 'email' ? ` ・ LINE${lineMessageLabels[scenario.lineMessageType || 'text']}` : ''}{scenario.waitMinutes > 0 ? ` ・ ${scenario.waitMinutes}分後` : ''}</div><div className="text-xs"><span className={scenario.status === 'prepared' ? 'text-emerald-300' : 'text-amber-300'}>{scenario.status === 'prepared' ? '準備済み（未配信）' : '下書き'}</span><div className="mt-1 text-[10px] text-slate-500">{new Date(scenario.updatedAt).toLocaleString()}</div></div><div className="flex gap-2"><button onClick={() => { markPrepared(scenario); }} className={`rounded-lg border px-3 py-2 text-xs ${scenario.status === 'prepared' ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{scenario.status === 'prepared' ? '準備済み' : '準備状態にする'}</button><button onClick={() => { startEdit(scenario); setNotice(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">編集</button><button onClick={() => deleteScenario(scenario)} aria-label="シナリオを削除" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div></article>)}</div>}
        {!editing && scenarios.length > 0 && <p className="text-[11px] text-slate-500">「準備状態」はシナリオの設定整理を示します。配信接続と実行処理が未実装のため、自動送信はしません。</p>}
      </div>}


    </div>
  );
};

