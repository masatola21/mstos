import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { Activity, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, GitBranch, Image as ImageIcon, Mail, MessageCircle, MousePointerClick, Plus, Radio, Save, Tags, Trash2, Users, Webhook, Zap } from 'lucide-react';
import { MarketingChannel, MarketingLineMessageType, MarketingScenario, MarketingTrigger } from '../../types/marketing';

interface Props {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
}

const triggerOptions: Array<{ value: MarketingTrigger; label: string }> = [
  { value: 'prospect_selected', label: '営業対象に選ばれた時' },
  { value: 'lead_created', label: '見込み客が登録された時' },
  { value: 'line_registered', label: 'LINE登録された時' },
  { value: 'diagnosis_invited', label: '診断案内を送った時' },
  { value: 'diagnosis_completed', label: '診断が完了した時' },
  { value: 'report_approved', label: '診断レポートが承認された時' },
  { value: 'meeting_completed', label: '面談が完了した時' },
  { value: 'tag_added', label: '指定タグが付いた時' },
  { value: 'booking_created', label: '予約が登録された時' },
  { value: 'deal_stage_changed', label: '商談ステージが変わった時' },
  { value: 'deal_won', label: '商談が成約した時' },
  { value: 'proposal_approved', label: '提案書が承認された時' },
  { value: 'contract_sent', label: '契約書を送付した時' },
  { value: 'contract_signed', label: '契約が締結された時' },
  { value: 'invoice_due', label: '請求予定日になった時' },
  { value: 'invoice_overdue', label: '請求期日を超過した時' },
  { value: 'retainer_period', label: '顧問サポート時期になった時' },
  { value: 'project_milestone', label: '構築工程の節目に到達した時' },
  { value: 'manual', label: '手動で開始' },
];
const channelLabels: Record<MarketingChannel, string> = { line: 'LINE', email: 'メール', both: 'LINE + メール' };
const lineMessageLabels: Record<MarketingLineMessageType, string> = { text: 'テキスト', image: '画像', flex: 'Flex' };

const workflowStages = [
  {
    title: '見込み企業の調査・営業',
    trigger: '企業を調査し、営業対象を選ぶ',
    automation: '企業・担当者の登録、対象リスト作成、選択した宛先への一括配信、配信履歴と停止対象の管理',
    ai: '企業情報の要約、優先度や適合理由の整理、個社別メール文案の作成',
    approval: '送信先と初回文案を人が確認してから配信',
    data: '会社・見込み企業・配信同意・営業履歴',
    status: '接続・実行処理が必要',
  },
  {
    title: '登録・診断案内',
    trigger: 'LINE登録、手動リード登録、相談申込',
    automation: 'リード化、登録シナリオ開始、診断URL発行、メール/LINE案内、回答の保存と重複防止',
    ai: '顧客に合わせた案内文の調整（必要な場合のみ）',
    approval: '案内テンプレートは事前承認し、個別送信時は必要に応じて確認',
    data: 'リード・LINE連携・診断フォーム・配信履歴',
    status: '診断管理あり / 公開フォーム・配信未接続',
  },
  {
    title: '診断・レポート',
    trigger: '顧客がURLから診断を回答',
    automation: '必須回答チェック、点数計算、回答の保存、診断と会社/リードの紐付け',
    ai: '回答の解釈、根拠付き所見、改善提案、商品マスタに基づく推奨案とレポート草案',
    approval: '人がレポートを確認・承認してから顧客へ送付',
    data: '設問マスタ・診断回答・商品マスタ・レポート',
    status: '社内診断・AIレポート基盤あり / 公開回答URL未実装',
  },
  {
    title: '面談・商談',
    trigger: '相談希望、診断結果、顧客の予約',
    automation: 'カレンダー候補提示、予約登録、確認/リマインド、商談レコード作成、次回タスク発行',
    ai: '面談前の顧客・診断要約、議事録の整理、次の提案候補',
    approval: '日時確定と商談ステージ判断は人が行う',
    data: 'リード・予約・商談・面談記録',
    status: '顧客/商談台帳あり / カレンダー接続未実装',
  },
  {
    title: '提案・契約',
    trigger: '商談ステージ更新、提案作成依頼',
    automation: '商品マスタと提案テンプレートから金額・項目を反映、書類生成、送付状態/返信状態の記録',
    ai: '顧客課題に沿った提案説明・FAQ・メール文案の作成',
    approval: '提案内容・金額・契約条件を人が承認してから送付',
    data: '商談・商品・提案テンプレート・契約・送付履歴',
    status: '台帳・テンプレート画面あり / 送付・返信連携未実装',
  },
  {
    title: '請求・顧問・構築支援',
    trigger: '契約締結、請求日、顧問日、工程の節目',
    automation: '契約条件から請求書/月額請求を生成、期日通知、顧問/構築面談の案内とタスク発行',
    ai: '顧問面談の論点整理、進捗報告やサポート案内の草案（必要な場合のみ）',
    approval: '請求額・送信内容・契約変更など重要事項を人が承認',
    data: '契約・請求・商品/料金・顧問予定・プロジェクト工程',
    status: '契約/請求台帳あり / 定期実行・送信連携未実装',
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
  flexAltText: '',
  flexTitle: '',
  flexBody: '',
  flexButtonLabel: '',
  flexButtonUrl: '',
  status: 'draft',
});

export const MarketingAutomationPrototypeView: React.FC<Props> = ({ scenarios, onScenariosChange }) => {
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
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'workflow' | 'scenarios' | 'connections'>('overview');
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
    { id: 'overview' as const, label: '全体像', icon: GitBranch },
    { id: 'channels' as const, label: 'チャネルと役割', icon: Radio },
    { id: 'workflow' as const, label: '業務とAIの役割', icon: Users },
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

      {activeTab === 'channels' && <div className="space-y-4">
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/25 p-5">
          <h2 className="text-lg font-bold text-white">目的で分け、配信チャネルは共通化</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">マーケティング機能は「誰に何を届けるか」で整理します。集客は新しい接点を作り、育成・営業配信はCRMに登録された相手との関係を進めます。顧客情報や営業段階はCRMを正本にします。</p>
        </section>
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-cyan-500/25 bg-slate-900 p-5">
            <div className="flex items-center gap-2"><MousePointerClick className="h-5 w-5 text-cyan-300" /><h3 className="text-lg font-bold text-white">集客・認知</h3></div>
            <p className="mt-2 text-sm text-slate-300">まだ接点のない人に情報を届け、LP・フォーム・LINE登録へつなげます。</p>
            <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-white">Instagram</span><span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-white">Facebook</span><span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-white">広告・LP</span></div>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-400">
              <li>管理するもの：投稿案、広告施策、リンク、流入・反応指標</li>
              <li>CRMとの接点：フォームやLINE登録が起きた時点で連絡先・リードへつなぐ</li>
              <li className="text-amber-300">現状：SNS投稿・広告のAPI連携と実行機能は未実装</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-purple-500/25 bg-slate-900 p-5">
            <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-purple-300" /><h3 className="text-lg font-bold text-white">育成・営業配信</h3></div>
            <p className="mt-2 text-sm text-slate-300">CRMの状態や同意に応じて、診断案内・情報提供・商談フォローを届けます。</p>
            <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-white">LINE</span><span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-white">メール</span></div>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-400">
              <li>管理するもの：個別・一斉配信、シナリオ、予約配信、停止・送信履歴</li>
              <li>CRMとの接点：配信対象は会社・連絡先・リード・商談の条件から選ぶ</li>
              <li className="text-amber-300">現状：LINE・メール文案とシナリオの保存まで。実送信は未接続</li>
            </ul>
            <button onClick={() => setActiveTab('scenarios')} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500">シナリオ設定を見る <ArrowRight className="h-3.5 w-3.5" /></button>
          </article>
        </div>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-bold text-white">契約後の案内も送信経路は共通</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">契約・請求・顧問・構築支援の状態は「契約・請求・支援」で管理します。そこから送る案内や書類の送信も共通のLINE・メール送信基盤と履歴を使い、業務の状態そのものはマーケティング側に複製しません。</p>
        </section>
      </div>}

      {activeTab === 'workflow' && <div className="space-y-4">
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/25 p-5">
          <h2 className="text-lg font-bold text-white">営業・顧客対応を一つの流れで管理</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">条件判定・計算・保存・定型通知はOSが処理し、調査・解釈・文章案が必要な時だけ専門AIを呼び出します。顧客への送信、金額や契約条件の確定は承認を通します。</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-cyan-200">自動処理：ルールで実行、AI費用なし</span>
            <span className="rounded-full bg-purple-500/10 px-3 py-1.5 text-purple-200">AI：必要な場面だけ呼び出し</span>
            <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-200">承認：顧客送信・金額・契約</span>
          </div>
        </section>
        <div className="space-y-3">
          {workflowStages.map((stage, index) => <article key={stage.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-sm font-black text-indigo-200">{index + 1}</span><div><h3 className="font-bold text-white">{stage.title}</h3><p className="mt-1 text-xs text-slate-400">開始条件：{stage.trigger}</p></div></div>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] text-slate-300">{stage.status}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-950/20 p-3"><div className="text-[11px] font-bold text-cyan-200">OSの自動処理</div><p className="mt-2 text-xs leading-5 text-slate-300">{stage.automation}</p></div>
              <div className="rounded-xl border border-purple-500/15 bg-purple-950/20 p-3"><div className="text-[11px] font-bold text-purple-200">必要な時だけAI</div><p className="mt-2 text-xs leading-5 text-slate-300">{stage.ai}</p></div>
              <div className="rounded-xl border border-amber-500/15 bg-amber-950/20 p-3"><div className="text-[11px] font-bold text-amber-200">人の確認・保存データ</div><p className="mt-2 text-xs leading-5 text-slate-300">{stage.approval}</p><p className="mt-2 border-t border-slate-800 pt-2 text-[10px] leading-4 text-slate-500">記録：{stage.data}</p></div>
            </div>
          </article>)}
        </div>
        <p className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100/80">この画面は業務分担と接続状況を示します。現在、シナリオの保存はできますが、LINE/メールの実配信、公開診断フォーム、カレンダー、契約返信確認、定期請求の自動実行は接続・実装が必要です。</p>
      </div>}

      {activeTab === 'scenarios' && <div className="space-y-4">
        {isFormOpen ? (
          <form onSubmit={saveScenario} className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-white">{editing ? 'シナリオを編集' : '新しいシナリオ'}</h2><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false); setNotice(''); }} className="text-xs text-slate-400 hover:text-white">閉じる</button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-slate-300">シナリオ名<input required maxLength={100} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="例：診断完了後のフォロー" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">開始条件<select value={form.trigger} onChange={(e) => update('trigger', e.target.value as MarketingTrigger)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{triggerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <div className="text-xs text-slate-300">配信対象の保存区分<select value={form.audience.startsWith('segment:') && segments.some((segment)=>segment.id===form.audience.slice(8)) ? form.audience : 'manual'} onChange={(e)=>update('audience',e.target.value==='manual'?'':e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="manual">条件をメモとして入力（旧形式）</option>{segments.map((segment)=><option key={segment.id} value={`segment:${segment.id}`}>{segment.name}（{segment.entity_type}）</option>)}</select>{(!form.audience.startsWith('segment:') || !segments.some((segment)=>segment.id===form.audience.slice(8))) && <input maxLength={160} value={form.audience} onChange={(e)=>update('audience',e.target.value)} placeholder="配信対象の説明" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />}</div>
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
        {scenarios.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center"><GitBranch className="mx-auto h-8 w-8 text-slate-500" /><h2 className="mt-3 font-bold text-white">シナリオはまだありません</h2><p className="mt-1 text-sm text-slate-400">「シナリオ作成」から、開始条件とLINE・メールの配信文案を登録できます。</p><button onClick={startNew} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">最初のシナリオを作成</button></div> : <div className="space-y-3">{scenarios.map((scenario) => <article key={scenario.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"><div><div className="font-bold text-white">{scenario.name}</div><div className="mt-1 text-xs text-slate-400">{triggerLabel[scenario.trigger]} ・ {audienceLabel(scenario.audience)}</div></div><div className="text-xs text-slate-300">{channelLabels[scenario.channel]}{scenario.channel !== 'email' ? ` ・ LINE${lineMessageLabels[scenario.lineMessageType || 'text']}` : ''}{scenario.waitMinutes > 0 ? ` ・ ${scenario.waitMinutes}分後` : ''}</div><div className="text-xs"><span className={scenario.status === 'prepared' ? 'text-emerald-300' : 'text-amber-300'}>{scenario.status === 'prepared' ? '準備済み（未配信）' : '下書き'}</span><div className="mt-1 text-[10px] text-slate-500">{new Date(scenario.updatedAt).toLocaleString()}</div></div><div className="flex gap-2"><button onClick={() => { markPrepared(scenario); }} className={`rounded-lg border px-3 py-2 text-xs ${scenario.status === 'prepared' ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{scenario.status === 'prepared' ? '準備済み' : '準備状態にする'}</button><button onClick={() => { startEdit(scenario); setNotice(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">編集</button><button onClick={() => deleteScenario(scenario)} aria-label="シナリオを削除" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div></article>)}</div>}
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

