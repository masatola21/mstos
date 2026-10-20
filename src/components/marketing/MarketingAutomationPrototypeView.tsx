import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';
import { Activity, ArrowRight, CheckCircle2, Copy, GitBranch, Library, Mail, MessageCircle, MousePointerClick, Plus, Radio, Save, Tags, Trash2, Zap } from 'lucide-react';
import { MarketingChannel, MarketingLineMessageType, MarketingScenario, MarketingTrigger } from '../../types/marketing';
import { MarketingBroadcastView } from './MarketingBroadcastView';
import { LineMessagePreview } from '../LineMessagePreview';
import { findUnknownPlaceholders, PLACEHOLDER_DEFS, PLACEHOLDER_SAMPLE_VALUES, renderPlaceholders } from '../../utils/placeholders';
const PlaceholderAssist: React.FC<{ text: string; onInsert: (token: string) => void }> = ({ text, onInsert }) => {
  const unknown = findUnknownPlaceholders(text);
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] text-slate-500">差し込み:</span>{PLACEHOLDER_DEFS.map(({ key, description }) => <button key={key} type="button" title={description} onClick={() => onInsert(`{${key}}`)} className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-indigo-200 hover:border-indigo-400">{`{${key}}`}</button>)}</div>
    <div className="rounded border border-slate-800 bg-slate-950/70 p-2"><span className="text-[10px] text-slate-500">サンプル値プレビュー</span><p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">{renderPlaceholders(text, PLACEHOLDER_SAMPLE_VALUES) || '（文面は空です）'}</p></div>
    {unknown.length > 0 && <p className="text-[11px] text-amber-300">未定義の差し込みキー: {unknown.map((key) => `{${key}}`).join(', ')}（保存はできます）</p>}
  </div>;
};


import { MarketingLineInboxView } from './MarketingLineInboxView';
import { MarketingLineSettingsView } from './MarketingLineSettingsView';
import { MarketingEmailInboxView } from './MarketingEmailInboxView';
import { SalesOperationsWorkspace } from '../SalesOperationsWorkspace';
import { CommunicationTemplateLibraryView } from './CommunicationTemplateLibraryView';
import { fetchMarketingAutomationHealth, MarketingAutomationHealth, MarketingAutomationJobsPanel } from './MarketingAutomationJobsPanel';

interface Props {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
  onNavigateTab?: (tab: 'communication_send' | 'custom_lists' | 'contacts') => void;
  lineInboxContact?: { contactId: string; lineUserId: string };
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
    trigger: '配信対象リスト、または登録した開始条件を選ぶ',
    automation: '対応するCRM状態変化で、準備済みシナリオを起動して配信待ちに登録します。',
    ai: '対象者の条件を整理し、必要なら外部AIで施策案を作成できます。顧客データを外部AIへ貼り付けないでください。',
    approval: '配信対象と開始条件を人が確認します。',
    data: '配信対象リスト・シナリオ設定',
    status: '条件保存・対応イベントの自動起動',
  },
  {
    title: 'LINE・メールの文案を準備',
    trigger: 'シナリオを新規作成、または編集する',
    automation: 'LINE・メールの本文やカードを入力し、下書きとして保存できます。',
    ai: '定型外の施策は外部AIで草案を作り、JSONを取り込んで内容を編集できます。アプリ内AI APIは呼び出しません。',
    approval: '宛先に合わせた文面・リンク・添付内容を人が確認します。',
    data: 'シナリオ・配信文案',
    status: '文案保存・配信サービスへ接続',
  },
  {
    title: '確認して配信へ進む',
    trigger: '文案を確認し、シナリオを準備済みにする',
    automation: '準備済みで同意根拠があるシナリオは、対応するCRMイベントで自動配信ジョブを作成し、LINE・メールの送信結果を通信履歴に記録します。',
    ai: 'AIは送信を実行しません。必要な文章作成を補助する場合も、送信前に人が確認します。',
    approval: '配信同意・停止対象・配信対象・本文を確認し、準備済みへの変更と自動実行の有効化を人が行います。',
    data: '準備状態・配信同意・送信履歴',
    status: '準備状態・同意根拠・自動配信',
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
  automationEnabled: false,
  consentBasis: '',
});

export const MarketingAutomationPrototypeView: React.FC<Props> = ({ scenarios, onScenariosChange, onNavigateTab, lineInboxContact }) => {
  const [segments, setSegments] = useState<Array<{id:string;name:string;entity_type:string;conditions:Record<string,unknown>|null}>>([]);
  const [emailTemplates,setEmailTemplates]=useState<any[]>([]);
  const [lineTemplates,setLineTemplates]=useState<Array<{id:string;name:string;reply_type:'text'|'image'|'flex'|'video';payload:Record<string,any>}>>([]);
  const [selectedEmailTemplateId,setSelectedEmailTemplateId]=useState('');
  const [selectedLineTemplateId,setSelectedLineTemplateId]=useState('');
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.from('crm_segments').select('id,name,entity_type,conditions').order('name')
      .then(({data,error}) => { if (!error) setSegments((data || []).filter((segment:any)=>typeof segment.conditions?.field==='string'&&Boolean(segment.conditions.field.trim()))); });
  }, []);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active=true;
    void Promise.all([
      supabase.from('communication_templates').select('*').eq('channel','email').order('updated_at',{ascending:false}),
      supabase.from('line_auto_reply_templates').select('*').order('created_at',{ascending:false}),
    ]).then(([emailResult,lineResult])=>{if(!active)return;if(!emailResult.error)setEmailTemplates((emailResult.data||[]) as any[]);if(!lineResult.error)setLineTemplates((lineResult.data||[]) as Array<{id:string;name:string;reply_type:'text'|'image'|'flex'|'video';payload:Record<string,any>}>)});
    return()=>{active=false};
  }, []);
  const chooseEmailTemplate=(id:string)=>{setSelectedEmailTemplateId(id);const item=emailTemplates.find(x=>x.id===id);if(item){update('emailSubject',item.subject||'');update('emailBody',item.body_text||'')}};
  const chooseLineTemplate=(id:string)=>{setSelectedLineTemplateId(id);const item=lineTemplates.find(x=>x.id===id);if(!item)return;const payload={...(item.payload||{})};delete payload.storagePaths;update('lineMessageType',item.reply_type);update('lineMessagePayload',item.reply_type==='text'?undefined:{type:item.reply_type,...payload});update('messageBody',item.reply_type==='text'?String(payload.text||''):'');update('lineImageUrl',item.reply_type==='image'?String(payload.originalContentUrl||''):'');update('linePreviewImageUrl',item.reply_type==='image'?String(payload.previewImageUrl||''):'');update('lineVideoUrl',item.reply_type==='video'?String(payload.originalContentUrl||''):'');update('lineVideoPreviewUrl',item.reply_type==='video'?String(payload.previewImageUrl||''):'');update('flexAltText',item.reply_type==='flex'?String(payload.altText||''):'');update('flexTitle','');update('flexBody','');update('flexButtonLabel','');update('flexButtonUrl','')};
  const audienceLabel = (value: string) => {
    const id = value.startsWith('segment:') ? value.slice('segment:'.length) : '';
    return segments.find((segment) => segment.id === id)?.name || value || '配信対象未設定';
  };
  const [activeTab, setActiveTab] = useState<'home' | 'email' | 'line' | 'scenarios' | 'jobs' | 'segments' | 'templates'>('home');
  const [lineView, setLineView] = useState<'broadcast' | 'inbox' | 'settings'>('broadcast');
  useEffect(() => {
    if (!lineInboxContact) return;
    setActiveTab('line');
    setLineView('inbox');
  }, [lineInboxContact]);
  const [emailView, setEmailView] = useState<'broadcast' | 'inbox'>('broadcast');
  const [editing, setEditing] = useState<MarketingScenario | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyScenario());
  const [notice, setNotice] = useState('');
  const scenarioSyncRevision = useRef(0);
  const [externalGoal, setExternalGoal] = useState('');
  const [externalResult, setExternalResult] = useState('');
  const [automationHealth, setAutomationHealth] = useState<MarketingAutomationHealth | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const result = await fetchMarketingAutomationHealth(); if (active) setAutomationHealth(result); }
      catch { if (active) setAutomationHealth(null); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const revision = ++scenarioSyncRevision.current;
    let cancelled = false;
    const sync = async () => {
      const db = getSupabase();
      if (!db) return;
      const { data: auth } = await db.auth.getUser();
      const ownerId = auth.user?.id;
      if (!ownerId || cancelled || revision !== scenarioSyncRevision.current) return;
      const rows = scenarios.map((scenario) => ({ owner_id: ownerId, scenario_id: scenario.id, config: scenario, updated_at: new Date().toISOString() }));
      if (rows.length) {
        const { error } = await db.from('marketing_automation_scenarios').upsert(rows, { onConflict: 'owner_id,scenario_id' });
        if (error) { setNotice('自動化設定をサーバーに同期できません。DBマイグレーションを確認してください。'); return; }
      }
      const { data: saved, error: loadError } = await db.from('marketing_automation_scenarios').select('scenario_id').eq('owner_id', ownerId);
      if (loadError || cancelled || revision !== scenarioSyncRevision.current) return;
      const keep = new Set(scenarios.map((scenario) => scenario.id));
      const stale = (saved || []).map((row: any) => row.scenario_id).filter((id: string) => !keep.has(id));
      if (stale.length) await db.from('marketing_automation_scenarios').delete().eq('owner_id', ownerId).in('scenario_id', stale);
    };
    void sync();
    return () => { cancelled = true; };
  }, [scenarios]);
  const preparedCount = scenarios.filter((scenario) => scenario.status === 'prepared').length;
  const lineCount = scenarios.filter((scenario) => scenario.channel !== 'email').length;
  const emailCount = scenarios.filter((scenario) => scenario.channel !== 'line').length;
  const triggerLabel = useMemo(() => Object.fromEntries(triggerOptions.map((option) => [option.value, option.label])) as Record<MarketingTrigger, string>, []);
  const supportedAutomationTriggers = new Set<MarketingTrigger>(['prospect_selected','lead_created','line_registered','diagnosis_invited','diagnosis_completed','meeting_completed','tag_added','booking_created','retainer_period','deal_stage_changed','deal_won','report_approved','report_sent','proposal_approved','proposal_sent','contract_sent','contract_signed','invoice_due','invoice_overdue','project_milestone']);

  const startNew = () => {
    setSelectedEmailTemplateId('');setSelectedLineTemplateId('');
    setEditing(null);
    setIsFormOpen(true);
    setForm(emptyScenario());
    setExternalGoal('');
    setExternalResult('');
    setActiveTab('scenarios');
    setNotice('');
  };
  const startEdit = (scenario: MarketingScenario) => {
    setSelectedEmailTemplateId('');setSelectedLineTemplateId('');
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
      lineMessagePayload: scenario.lineMessagePayload,
      flexAltText: scenario.flexAltText || '',
      flexTitle: scenario.flexTitle || '',
      flexBody: scenario.flexBody || '',
      flexButtonLabel: scenario.flexButtonLabel || '',
      flexButtonUrl: scenario.flexButtonUrl || '',
      status: scenario.status,
      automationEnabled: scenario.automationEnabled || false,
      consentBasis: scenario.consentBasis || '',
    });
  };
  const saveScenario = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.channel !== 'email' && form.lineMessageType === 'image' && (!isHttpsUrl(form.lineImageUrl) || !isHttpsUrl(form.linePreviewImageUrl))) {
      setNotice('画像URLはHTTPSで公開されているURLを指定してください。');
      return;
    }
    if (form.channel !== 'email' && form.lineMessageType === 'video' && (!form.lineVideoUrl || !isHttpsUrl(form.lineVideoUrl) || !form.lineVideoPreviewUrl || !isHttpsUrl(form.lineVideoPreviewUrl))) {
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
      automationEnabled: false,
    };
    onScenariosChange(editing
      ? scenarios.map((scenario) => scenario.id === editing.id ? saved : scenario)
      : [saved, ...scenarios]);
    setEditing(null);
    setIsFormOpen(false);
    setNotice('シナリオを保存しました。自動実行する場合は準備状態にして、同意根拠を記録した上で有効化してください。');
  };
  const deleteScenario = (scenario: MarketingScenario) => {
    onScenariosChange(scenarios.filter((item) => item.id !== scenario.id));
    setNotice('シナリオを削除しました。');
  };
  const markPrepared = (scenario: MarketingScenario) => {
    // Preparation is separate from activation; content edits reset activation.
    onScenariosChange(scenarios.map((item) => item.id === scenario.id ? { ...item, status: item.status === 'prepared' ? 'draft' : 'prepared', automationEnabled: item.status === 'prepared' ? false : item.automationEnabled, updatedAt: Date.now() } : item));
    setNotice('準備状態を保存しました。この操作自体では配信されません。自動実行中は、対応するCRMイベントで配信待ちジョブを作成します。');
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
      if (parsed.lineMessageType === 'text' || parsed.lineMessageType === 'image' || parsed.lineMessageType === 'flex') next.lineMessageType = parsed.lineMessageType; next.lineMessagePayload = undefined;
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
    { id: 'home' as const, label: 'ホーム', icon: GitBranch },
    { id: 'email' as const, label: 'メール', icon: Mail },
    { id: 'line' as const, label: 'LINE', icon: MessageCircle },
    { id: 'scenarios' as const, label: 'シナリオ', icon: Zap },
    { id: 'jobs' as const, label: '配信ジョブ', icon: Activity },
    { id: 'segments' as const, label: '配信対象リスト', icon: Tags },
    { id: 'templates' as const, label: 'テンプレート保管庫', icon: Library },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-white">教育・フォロー</h1>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">CRM条件に応じて実行</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">LINE・メールで見込み客や顧客をフォローし、次の行動につなげます。顧客・リード情報は既存のCRMを正本として利用します。集客チャネルは必要になった段階でマーケティング内に追加できます。</p>
          </div>
          <button onClick={startNew} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"><Plus className="h-4 w-4" />シナリオ作成</button>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto border-t border-slate-800 pt-4">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setActiveTab(id); setNotice(''); }} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </section>

      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {activeTab === 'email' && <div className="space-y-4"><div className="flex gap-2 border-b border-slate-800 pb-3"><button onClick={()=>setEmailView('broadcast')} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs text-white">配信</button><button onClick={()=>setEmailView('inbox')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">受信箱</button></div>{emailView==='broadcast'?<MarketingBroadcastView initialChannel="email"/>:<MarketingEmailInboxView/>}</div>}
      {activeTab === 'line' && <div className="space-y-4"><div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3"><button onClick={()=>setLineView('broadcast')} className="rounded-lg bg-green-700 px-3 py-2 text-xs text-white">配信</button><button onClick={()=>setLineView('inbox')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">受信箱・自動返信</button><button onClick={()=>setLineView('settings')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">リッチメニュー</button></div>{lineView==='broadcast'?<MarketingBroadcastView initialChannel="line"/>:lineView==='inbox'?<MarketingLineInboxView initialLineUserId={lineInboxContact?.lineUserId}/>:<MarketingLineSettingsView/>}</div>}
      {activeTab === 'home' && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '登録シナリオ', value: String(scenarios.length), note: '手動確認・配信の準備', icon: GitBranch, color: 'text-cyan-300' },
            { label: '準備済み', value: String(preparedCount), note: '有効化した条件で自動配信', icon: CheckCircle2, color: 'text-emerald-300' },
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
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><div className="text-sm font-semibold text-purple-200">メール送信</div><p className="mt-1 text-xs text-slate-400">送信には RESEND_API_KEY と RESEND_FROM_EMAIL、受信には RESEND_WEBHOOK_SECRET が必要です。</p></div>
          </div>
        </section>
      </>}

      {activeTab === 'jobs' && <MarketingAutomationJobsPanel health={automationHealth} onHealthChange={setAutomationHealth} />}
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
              <div className="text-xs text-slate-300">配信対象リスト<select value={form.audience.startsWith('segment:') && segments.some((segment)=>segment.id===form.audience.slice(8)) ? form.audience : 'manual'} onChange={(e)=>update('audience',e.target.value==='manual'?'':e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="manual">条件をメモとして入力（旧形式）</option>{segments.map((segment)=><option key={segment.id} value={`segment:${segment.id}`}>{segment.name}（{segment.entity_type}）</option>)}</select>{(!form.audience.startsWith('segment:') || !segments.some((segment)=>segment.id===form.audience.slice(8))) && <input maxLength={160} value={form.audience} onChange={(e)=>update('audience',e.target.value)} placeholder="配信対象の説明" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />}</div>
              <label className="text-xs text-slate-300">配信同意・送信根拠<input required maxLength={500} value={form.consentBasis} onChange={(e) => update('consentBasis', e.target.value)} placeholder="例：顧客がLINE登録時に案内へ同意" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">配信チャネル<select value={form.channel} onChange={(e) => update('channel', e.target.value as MarketingChannel)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="line">LINE</option><option value="email">メール</option><option value="both">LINE + メール</option></select></label>
              <label className="text-xs text-slate-300">待機時間（分）<input type="number" min={0} max={525600} value={form.waitMinutes} onChange={(e) => update('waitMinutes', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              {form.channel !== 'email' && <fieldset className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4 md:col-span-2"><legend className="px-2 text-xs font-bold text-green-300">LINEメッセージ形式</legend>
                <label className="block text-xs text-slate-300 md:col-span-2">保存済みLINEテンプレート<select value={selectedLineTemplateId} onChange={(e)=>chooseLineTemplate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">テンプレートを選択</option>{lineTemplates.map((item)=><option key={item.id} value={item.id}>{item.name}（{item.reply_type==='text'?'テキスト':item.reply_type==='image'?'画像':item.reply_type==='video'?'動画':'Flex'}）</option>)}</select></label>
                <label className="block text-xs text-slate-300">形式<select value={form.lineMessageType} onChange={(e) => {update('lineMessageType', e.target.value as MarketingLineMessageType);update('lineMessagePayload',undefined);setSelectedLineTemplateId('')}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="text">テキスト</option><option value="image">画像</option><option value="video">動画</option><option value="flex">Flex Message（カード）</option></select></label>
                {form.lineMessageType === 'text' && <div className="space-y-3 md:col-span-2"><label className="block text-xs text-slate-300">LINE本文<textarea required maxLength={5000} rows={5} value={form.messageBody} onChange={(e) => update('messageBody', e.target.value)} placeholder="配信内容。{name} などの差し込みに対応しています。" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /><PlaceholderAssist text={form.messageBody} onInsert={(token)=>update('messageBody', form.messageBody+token)} /></label><LineMessagePreview type="text" text={renderPlaceholders(form.messageBody, PLACEHOLDER_SAMPLE_VALUES)} title="シナリオLINEプレビュー" /></div>}
                {form.lineMessageType === 'image' && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">画像URL（HTTPS）<input type="url" required value={form.lineImageUrl} onChange={(e) => update('lineImageUrl', e.target.value)} placeholder="https://example.com/image.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">プレビュー画像URL（HTTPS）<input type="url" required value={form.linePreviewImageUrl} onChange={(e) => update('linePreviewImageUrl', e.target.value)} placeholder="https://example.com/preview.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px] leading-5 text-slate-400 md:col-span-2">LINEが取得できる公開HTTPS画像を指定します。<div className="mt-3"><LineMessagePreview type="image" payload={{originalContentUrl:form.lineImageUrl,previewImageUrl:form.linePreviewImageUrl}} title="シナリオ画像プレビュー" /></div></div></div>}
                {form.lineMessageType === 'video' && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">動画URL（公開HTTPS・MP4）<input type="url" required value={form.lineVideoUrl} onChange={(e) => update('lineVideoUrl', e.target.value)} placeholder="https://example.com/video.mp4" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">プレビュー画像URL（JPEG/PNG）<input type="url" required value={form.lineVideoPreviewUrl} onChange={(e) => update('lineVideoPreviewUrl', e.target.value)} placeholder="https://example.com/preview.jpg" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px] leading-5 text-slate-400 md:col-span-2">動画は公開HTTPSのMP4（200MB以下）、プレビュー画像は公開HTTPSのJPEG/PNG（1MB以下）を指定してください。LINEから取得できるURLが必要です。<div className="mt-3"><LineMessagePreview type="video" payload={{originalContentUrl:form.lineVideoUrl,previewImageUrl:form.lineVideoPreviewUrl,altText:form.flexAltText}} title="シナリオ動画プレビュー" /></div></div></div>}
                {form.lineMessageType === 'flex' && form.lineMessagePayload && <div className="md:col-span-2"><LineMessagePreview type="flex" title="選択中のLINEテンプレートプレビュー" payload={form.lineMessagePayload} /></div>}{form.lineMessageType === 'flex' && !form.lineMessagePayload && <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">通知・代替テキスト<input required maxLength={400} value={form.flexAltText} onChange={(e) => update('flexAltText', e.target.value)} placeholder="例：新商品のご案内" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">カードタイトル<input required maxLength={120} value={form.flexTitle} onChange={(e) => update('flexTitle', e.target.value)} placeholder="カードの見出し" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300 md:col-span-2">カード本文<textarea required maxLength={800} rows={4} value={form.flexBody} onChange={(e) => update('flexBody', e.target.value)} placeholder="Flexカードに表示する内容" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /><PlaceholderAssist text={form.flexBody} onInsert={(token)=>update('flexBody', form.flexBody+token)} /></label><label className="text-xs text-slate-300">ボタン名（任意）<input maxLength={20} value={form.flexButtonLabel} onChange={(e) => update('flexButtonLabel', e.target.value)} placeholder="詳しく見る" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-slate-300">ボタンURL（任意）<input type="url" value={form.flexButtonUrl} onChange={(e) => update('flexButtonUrl', e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
                  <div className="space-y-3 md:col-span-2"><LineMessagePreview type="flex" title="シナリオFlexプレビュー" payload={form.lineMessagePayload || {altText:form.flexAltText || 'Flexメッセージ',contents:flexPayload}} /><details><summary className="cursor-pointer text-xs text-slate-400">Flex JSONを確認</summary><pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300">{JSON.stringify({ type: 'flex', altText: form.flexAltText || 'Flexメッセージ', contents: flexPayload }, null, 2)}</pre></details></div>
                </div>}
              </fieldset>}
              {(form.channel === 'email' || form.channel === 'both') && <div className="grid gap-4 md:col-span-2 md:grid-cols-2"><label className="text-xs text-slate-300 md:col-span-2">保存済みメールテンプレート<select value={selectedEmailTemplateId} onChange={(e)=>chooseEmailTemplate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">テンプレートを選択</option>{emailTemplates.map((item)=><option key={item.id} value={item.id}>{item.name?.trim() || `${item.category} · ${item.template_key}`}</option>)}</select></label><label className="text-xs text-slate-300">メール件名<input required maxLength={200} value={form.emailSubject} onChange={(e) => update('emailSubject', e.target.value)} placeholder="件名" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><PlaceholderAssist text={form.emailSubject} onInsert={(token)=>update('emailSubject', form.emailSubject+token)} /></label><label className="text-xs text-slate-300 md:col-span-2">メール本文<textarea required maxLength={10000} rows={5} value={form.emailBody} onChange={(e) => update('emailBody', e.target.value)} placeholder="メール本文。{name} などの差し込みに対応しています。" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><PlaceholderAssist text={form.emailBody} onInsert={(token)=>update('emailBody', form.emailBody+token)} /></label></div>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-slate-500">画像は公開HTTPS URLを指定します。Flexはカード設定からJSONを生成します。今の段階では下書き保存のみで送信されません。</p><div className="flex gap-2"><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false); setNotice(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">キャンセル</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><Save className="h-4 w-4" />保存</button></div></div>
          </form>
        ) : null}
        {scenarios.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center"><GitBranch className="mx-auto h-8 w-8 text-slate-500" /><h2 className="mt-3 font-bold text-white">シナリオはまだありません</h2><p className="mt-1 text-sm text-slate-400">「シナリオ作成」から、開始条件とLINE・メールの配信文案を登録できます。</p><button onClick={startNew} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">最初のシナリオを作成</button></div> : <div className="space-y-3">{scenarios.map((scenario) => <article key={scenario.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"><div><div className="font-bold text-white">{scenario.name}</div><div className="mt-1 text-xs text-slate-400">{triggerLabel[scenario.trigger]} ・ {audienceLabel(scenario.audience)}</div></div><div className="text-xs text-slate-300">{channelLabels[scenario.channel]}{scenario.channel !== 'email' ? ` ・ LINE${lineMessageLabels[scenario.lineMessageType || 'text']}` : ''}{scenario.waitMinutes > 0 ? ` ・ ${scenario.waitMinutes}分後` : ''}</div><div className="text-xs"><span className={scenario.status === 'prepared' ? 'text-emerald-300' : 'text-amber-300'}>{scenario.status === 'prepared' ? '準備済み（未配信）' : '下書き'}</span><div className="mt-1 text-[10px] text-slate-500">{new Date(scenario.updatedAt).toLocaleString()}</div></div><div className="flex gap-2"><button onClick={() => { markPrepared(scenario); }} className={`rounded-lg border px-3 py-2 text-xs ${scenario.status === 'prepared' ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{scenario.status === 'prepared' ? '準備済み' : '準備状態にする'}</button><button disabled={scenario.status!=='prepared'||!scenario.consentBasis?.trim()||!supportedAutomationTriggers.has(scenario.trigger)||(scenario.channel!=='email'&&!['text','image','video','flex'].includes(scenario.lineMessageType||'text'))} onClick={() => { onScenariosChange(scenarios.map((item) => item.id===scenario.id?{...item,automationEnabled:!item.automationEnabled,updatedAt:Date.now()}:item)); setNotice(scenario.automationEnabled?'自動実行を停止しました。':'自動実行を有効にしました。'); }} className={`rounded-lg border px-3 py-2 text-xs ${scenario.automationEnabled?'border-emerald-500/30 text-emerald-300':'border-slate-700 text-slate-300'} disabled:cursor-not-allowed disabled:opacity-40`}>{scenario.automationEnabled?'自動実行中':!supportedAutomationTriggers.has(scenario.trigger)?'開始条件は未対応':scenario.channel!=='email'&&!['text','image','video','flex'].includes(scenario.lineMessageType||'text')?'LINE形式は未対応':'自動実行を有効化'}</button>{scenario.automationEnabled && automationHealth && ((scenario.channel === 'email' && !automationHealth.emailConfigured) || (scenario.channel === 'line' && !automationHealth.lineConfigured) || (scenario.channel === 'both' && (!automationHealth.emailConfigured || !automationHealth.lineConfigured))) && <span className="self-center text-[10px] text-amber-300">実際には送信されません</span>}<button onClick={() => { startEdit(scenario); setNotice(''); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">編集</button><InlineDeleteButton onConfirm={()=>deleteScenario(scenario)} warning={`「${scenario.name}」を削除しますか？`} ariaLabel="シナリオを削除" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"><Trash2 className="h-4 w-4" /></InlineDeleteButton></div></article>)}</div>}
        {!editing && scenarios.length > 0 && <p className="text-[11px] text-slate-500">自動実行は有効化したシナリオのみです。CRMイベントの対象連絡先が配信同意済みの場合に送信し、既存の送信履歴へ記録します。</p>}
      </div>}
      {activeTab === 'segments' && <SalesOperationsWorkspace tab="segments" />}
      {activeTab === 'templates' && <CommunicationTemplateLibraryView />}

    </div>
  );
};

