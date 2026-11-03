
import { getSalesEmailTemplate, getNurturingStepTemplate } from '../../utils/salesOutreachTemplates';

export const MST_OUTREACH_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [1, 2, 3, 4, 5].map((step) => {
  const tpl = getSalesEmailTemplate(step);
  const waitMinutes = step === 1 ? 0 : (step - 1) * 3 * 24 * 60; // 0, 3日後, 6日後, 9日後, 12日後
  return {
    name: tpl.name,
    trigger: 'lead_created' as MarketingTrigger,
    channel: 'email' as MarketingChannel,
    audience: '未接触の見込み企業',
    waitMinutes,
    emailSubject: tpl.subject.replace('貴社 様の', '{company_name} 様の').replace('貴社 様', '{company_name} 様'),
    emailBody: tpl.body.replace(/\{\{diagnostic_url\}\}/g, '{link_url}').replace(/貴社/g, '{company_name}'),
    messageBody: '',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '特定電子メール法に基づく業務改善情報の提供（オプトアウト明記）',
  };
});

export const MST_LINE_NURTURING_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [1, 2, 3, 4, 5, 6, 7].map((step) => {
  const tpl = getNurturingStepTemplate(step);
  const waitMinutes = step === 1 ? 0 : (step - 1) * 3 * 24 * 60;
  return {
    name: tpl.name,
    trigger: 'line_registered' as MarketingTrigger,
    channel: 'both' as MarketingChannel,
    audience: 'すべての見込み客',
    waitMinutes,
    emailSubject: tpl.emailSubject,
    emailBody: tpl.emailBody.replace(/\{\{diagnostic_url\}\}/g, '{link_url}').replace(/\{recipient_name\}/g, '{recipient_name}').replace(/\{company_name\}/g, '{company_name}'),
    messageBody: tpl.lineBody.replace(/\{\{diagnostic_url\}\}/g, '{link_url}').replace(/様 様/g, '{recipient_name} 様'),
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '配信同意に基づく（LINEおよびメルマガ配信対応）',
  };
});

export const MST_DIRECT_CONSULT_STARTER_SCENARIO: Omit<MarketingScenario, 'id' | 'updatedAt'> = {
  name: '【直相談】介護保険外サービス開業・個別経営相談 受付案内',
  trigger: 'lead_created',
  channel: 'both',
  audience: 'すべての見込み客',
  waitMinutes: 0,
  emailSubject: '【MST】介護保険外サービス開業・個別相談を承りました（日程調整のご案内）',
  emailBody: '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\nこの度は介護保険外サービス開業・個別相談のお申し込みをいただき、誠にありがとうございます。\n\n貴社の事業構想や地域ニーズを踏まえ、失敗しない開業ステップと収益モデルについて、30分のオンライン相談にて直接アドバイスさせていただきます。\n\n▼ 面談日程の選択はこちら\n{booking_url}\n\n当日お話しできますことを楽しみにしております。\n\n有限会社MST\n大橋真人',
  messageBody: '{recipient_name} 様\n介護保険外サービス開業・個別相談のお申し込みありがとうございます！有限会社MST代表の大橋真人です。\n\n貴社の構想や開業課題を伺い、最初の実行ステップを具体化する【30分無料オンライン相談】枠をご用意いたしました。\n\n▼ 日程調整はこちら\n{booking_url}',
  lineMessageType: 'flex',
  lineImageUrl: '',
  linePreviewImageUrl: '',
  flexAltText: '【受付完了】介護保険外サービス開業・個別相談のご案内',
  flexTitle: '🌿 介護保険外サービス開業・個別相談',
  flexBody: '{recipient_name} 様\nご相談ありがとうございます！有限会社MST代表の大橋真人です。\n貴社の構想や開業課題を伺い、最初の実行ステップを具体化する【30分無料オンライン相談】枠を確保いたしました。下記よりご都合の良い枠をお選びください。',
  flexButtonLabel: '無料相談の日程を選ぶ',
  flexButtonUrl: '{booking_url}',
  status: 'draft',
  automationEnabled: false,
  stopOnBooking: true,
  stopOnDeal: true,
  consentBasis: '個別相談フォーム・LINE相談受付時の同意に基づく',
};

export const MST_DIAGNOSIS_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【1. 初回登録】LINE友だち追加・ボトルネック診断ご案内',
    trigger: 'line_registered',
    channel: 'line',
    audience: 'すべての見込み客',
    waitMinutes: 0,
    emailSubject: '',
    emailBody: '',
    messageBody: '{recipient_name} 様\n友だち追加ありがとうございます！有限会社MSTです。\n\n貴社の業務・経営における「本当のボトルネック（手作業・売上利益・属人化）」を特定し、改善処方箋を作成する【無料ボトルネック診断】を実施中です。\n\n回答後すぐに速報分析をご確認いただけます。',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【MST経営OS】無料ボトルネック診断（約3分）のご案内',
    flexTitle: '【無料】業務ボトルネック診断（約3分）',
    flexBody: '{recipient_name} 様\n友だち追加ありがとうございます！\n貴社の業務における「本当の急所（属人化・人手不足・売上低迷）」を特定し、改善ロードマップを作成します。回答後すぐに速報分析をご確認いただけます。',
    flexButtonLabel: '3分診断を始める',
    flexButtonUrl: '{link_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: 'LINE友だち追加時の配信同意に基づく',
  },
  {
    name: '【2. 診断直後】回答完了のお礼＆分析レポート作成開始',
    trigger: 'diagnosis_completed',
    channel: 'line',
    audience: 'すべての見込み客',
    waitMinutes: 0,
    emailSubject: '',
    emailBody: '',
    messageBody: '{recipient_name} 様\n【経営課題・業務ボトルネック診断】へのご回答ありがとうございました！\n\n現在、回答内容をもとに詳細な改善ロードマップ（診断レポート）を作成しております。\n\n※お急ぎで急所改善のご相談を希望される場合は、先行して無料の個別相談（30分）をご予約いただけます。\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【診断受付完了】急所分析レポート作成中',
    flexTitle: '📊 診断受付完了・レポート作成中',
    flexBody: '{recipient_name} 様、診断へのご回答ありがとうございました！\n現在AIと専門アナリストが詳細な改善レポートを作成中です。お急ぎの方は先行して30分の無料個別相談をご予約いただけます。',
    flexButtonLabel: '無料相談の日程を選ぶ',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
  {
    name: '【3. レポート送付】診断レポート完成＆個別面談のご提案',
    trigger: 'report_approved',
    channel: 'line',
    audience: 'すべての見込み客',
    waitMinutes: 0,
    emailSubject: '',
    emailBody: '',
    messageBody: '{recipient_name} 様\n大変お待たせいたしました！貴社の【経営改善・ボトルネック診断レポート】が完成いたしました。\n\n▼診断レポートの閲覧はこちら\n{document_url}\n\nこのレポートをもとに、最優先で着手すべき「最初の1手」を具体化する無料個別相談（30分）も承っております。\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【診断レポート完成】貴社の急所分析・改善処方箋',
    flexTitle: '📑 業務ボトルネック診断レポート完成',
    flexBody: '{recipient_name} 様\n大変お待たせいたしました！貴社の【改善ロードマップ付き診断レポート】が完成しました。最優先で着手すべき「最初の1手」をご確認ください。',
    flexButtonLabel: 'レポートを閲覧する',
    flexButtonUrl: '{document_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断レポート完成通知への同意に基づく',
  },
  {
    name: '【4. 3日後フォロー】診断レポートのご確認状況と個別相談の打診',
    trigger: 'report_sent',
    channel: 'line',
    audience: 'すべての見込み客',
    waitMinutes: 4320,
    emailSubject: '',
    emailBody: '',
    messageBody: '{recipient_name} 様\n先日お送りいたしました診断レポートはご確認いただけましたでしょうか？\n\n「どこから手をつければいいか分からない」「自社だけで実行するのが難しそう」といったお声に対して、他社事例を踏まえた30分の無料オンライン作戦会議を実施しております。\n\n▼面談の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【個別作戦会議】診断レポート解消の具体策（30分・無料）',
    flexTitle: '🎯 個別作戦会議のご案内（無料）',
    flexBody: '{recipient_name} 様\n診断レポートの急所を最短で解消する具体的な手順について、他社実績を踏まえて30分で直接アドバイスいたします。ご都合の良い枠をお選びください。',
    flexButtonLabel: '無料作戦会議を予約する',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォロー配信への同意に基づく',
  },
  {
    name: '【5. 7日後フォロー】他社改善事例のご紹介＆個別相談の最終枠',
    trigger: 'report_sent',
    channel: 'line',
    audience: 'すべての見込み客',
    waitMinutes: 10080,
    emailSubject: '',
    emailBody: '',
    messageBody: '{recipient_name} 様\n診断レポートのご案内から1週間が経ちました。\n\n同様の課題（現場業務の属人化・請求や見積の手作業）を抱えていた企業様が、仕組み化により月20時間の経営時間を創出した事例をご紹介しております。\n\n今月の無料個別相談の枠も残り少なくなっておりますので、現状を打破したいとお考えの方はぜひお早めにご予約ください。\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【改善事例】月20時間の経営時間を創出した仕組み化手法',
    flexTitle: '💡 仕組み化による業務改善事例',
    flexBody: '{recipient_name} 様\n同様の急所（属人化・請求手作業）を仕組み化で解消した事例を公開中。今月の無料作戦会議の枠も残り少なくなっております。',
    flexButtonLabel: '今すぐ面談枠を確保する',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォロー配信への同意に基づく',
  },
];
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { InlineDeleteButton } from '../InlineDeleteButton';
import { Activity, AlertCircle, ArrowRight, Check, CheckCircle2, Clock, Copy, ExternalLink, GitBranch, Inbox, Library, Mail, MessageCircle, MousePointerClick, Plus, Radio, RefreshCw, Save, Send, Settings, ShieldCheck, Sparkles, Tags, Trash2, Users, Zap } from 'lucide-react';
import { MarketingChannel, MarketingLineMessageType, MarketingScenario, MarketingTrigger } from '../../types/marketing';
import { MarketingBroadcastView } from './MarketingBroadcastView';
import { LineMessagePreview } from '../LineMessagePreview';
import { renderPlaceholders, PLACEHOLDER_SAMPLE_VALUES } from '../../utils/placeholders';
import { PlaceholderAssist } from '../common/PlaceholderAssist';


import { MarketingLineInboxView } from './MarketingLineInboxView';
import { MarketingLineSettingsView } from './MarketingLineSettingsView';
import { MarketingEmailInboxView } from './MarketingEmailInboxView';
import { SalesOperationsWorkspace } from '../SalesOperationsWorkspace';
import { CommunicationTemplateLibraryView } from './CommunicationTemplateLibraryView';
import { fetchMarketingAutomationHealth, MarketingAutomationHealth, MarketingAutomationJobsPanel } from './MarketingAutomationJobsPanel';
import { deduplicateMarketingScenarios } from '../../utils/marketingStorage';
import { MarketingFlowStudio } from './MarketingFlowStudio';
import { FlowStepInspectorModal } from './FlowStepInspectorModal';

interface Props {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
  onNavigateTab?: (tab: 'communication_send' | 'custom_lists' | 'contacts' | 'inbox_hub') => void;
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
  stopOnBooking: true,
  stopOnDeal: true,
  sendTimeWindow: '09:00-20:00',
  consentBasis: '',
});


export function getScenarioSortKey(scenario: MarketingScenario): { categoryOrder: number; stepNumber: number; waitMinutes: number; name: string } {
  const name = scenario.name || '';
  
  // カテゴリ優先度: 1. 診断・面談フォロー, 2. 見込み営業メール, 3. ストーリーナーチャリング, 99. その他
  let categoryOrder = 99;
  if (name.includes('診断') || name.includes('【1. 初回') || name.includes('【2. 診断') || name.includes('【3. レポート') || name.includes('【4. 3日') || name.includes('【5. 7日') || scenario.trigger.startsWith('diagnosis_') || scenario.trigger.startsWith('report_')) {
    categoryOrder = 1;
  } else if (name.includes('営業メール') || name.includes('【営業') || (scenario.channel === 'email' && scenario.trigger === 'lead_created')) {
    categoryOrder = 2;
  } else if (name.includes('ストーリー') || name.includes('大橋') || name.includes('ナーチャリング') || name.includes('話】') || name.includes('第')) {
    categoryOrder = 3;
  }

  // ステップ番号の抽出（例: 【1. や 第1話、ステップ1、営業メール1 など）
  let stepNumber = 999;
  const numMatch = name.match(/[【［\[第ステップ]?\s*(\d+)\s*[.話ステップ\]］】]/) || name.match(/(\d+)/);
  if (numMatch) {
    stepNumber = parseInt(numMatch[1], 10);
  }

  return {
    categoryOrder,
    stepNumber,
    waitMinutes: scenario.waitMinutes ?? 0,
    name,
  };
}

export function sortScenarios(scenarios: MarketingScenario[]): MarketingScenario[] {
  return [...scenarios].sort((a, b) => {
    const keyA = getScenarioSortKey(a);
    const keyB = getScenarioSortKey(b);

    if (keyA.categoryOrder !== keyB.categoryOrder) {
      return keyA.categoryOrder - keyB.categoryOrder;
    }
    if (keyA.stepNumber !== keyB.stepNumber) {
      return keyA.stepNumber - keyB.stepNumber;
    }
    if (keyA.waitMinutes !== keyB.waitMinutes) {
      return keyA.waitMinutes - keyB.waitMinutes;
    }
    return keyA.name.localeCompare(keyB.name, 'ja');
  });
}

export const MarketingAutomationPrototypeView: React.FC<Props> = ({ scenarios, onScenariosChange, onNavigateTab, lineInboxContact }) => {
  const sortedScenarios = useMemo(() => sortScenarios(scenarios), [scenarios]);
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
  const [activeTab, setActiveTab] = useState<'flows' | 'jobs' | 'line_settings'>('flows');
  const [lineView, setLineView] = useState<'broadcast' | 'inbox' | 'settings'>('broadcast');
  const consumedLineInboxRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lineInboxContact?.lineUserId) return;
    const key = `${lineInboxContact.contactId}:${lineInboxContact.lineUserId}`;
    if (consumedLineInboxRef.current === key) return;
    consumedLineInboxRef.current = key;
    setActiveTab('line_settings');
  }, [lineInboxContact]);

  // 自動重複排除：シナリオ一覧に同名や重複がある場合、最新版の1本ずつに自動整理
  const autoDedupRef = useRef(false);
  useEffect(() => {
    if (scenarios.length === 0) return;
    const deduped = deduplicateMarketingScenarios(scenarios);
    if (deduped.length !== scenarios.length && !autoDedupRef.current) {
      autoDedupRef.current = true;
      onScenariosChange(sortScenarios(deduped));
    }
  }, [scenarios, onScenariosChange]);
  const [emailView, setEmailView] = useState<'broadcast' | 'inbox'>('broadcast');
  const [editing, setEditing] = useState<MarketingScenario | null>(null);
  const [inspectorScenario, setInspectorScenario] = useState<MarketingScenario | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
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
  const activeAutomatedCount = scenarios.filter((scenario) => scenario.automationEnabled).length;
  const lineCount = scenarios.filter((scenario) => scenario.channel !== 'email').length;
  const emailCount = scenarios.filter((scenario) => scenario.channel !== 'line').length;

  const diagnosisScenarios = useMemo(
    () => scenarios.filter((s) => s.name.includes('診断') || s.name.includes('【1. 初回') || s.name.includes('【2. 診断') || s.name.includes('【3. レポート') || s.name.includes('【4. 3日') || s.name.includes('【5. 7日') || s.trigger.startsWith('diagnosis_') || s.trigger.startsWith('report_')),
    [scenarios]
  );
  const outreachScenarios = useMemo(
    () => scenarios.filter((s) => s.name.includes('営業メール') || s.name.includes('【営業') || (s.channel === 'email' && s.trigger === 'lead_created')),
    [scenarios]
  );
  const storyScenarios = useMemo(
    () => scenarios.filter((s) => s.name.includes('ストーリー') || s.name.includes('大橋') || s.name.includes('ナーチャリング') || s.name.includes('話】') || s.name.includes('第')),
    [scenarios]
  );
  const directConsultScenarios = useMemo(
    () => scenarios.filter((s) => s.name.includes('直相談') || s.name.includes('介護保険外')),
    [scenarios]
  );
  const triggerLabel = useMemo(() => Object.fromEntries(triggerOptions.map((option) => [option.value, option.label])) as Record<MarketingTrigger, string>, []);
  const supportedAutomationTriggers = new Set<MarketingTrigger>(['prospect_selected','lead_created','line_registered','diagnosis_invited','diagnosis_completed','meeting_completed','tag_added','booking_created','retainer_period','deal_stage_changed','deal_won','report_approved','report_sent','proposal_approved','proposal_sent','contract_sent','contract_signed','invoice_due','invoice_overdue','project_milestone']);

  const duplicateCount = useMemo(() => {
    const names = new Set<string>();
    let dupes = 0;
    scenarios.forEach((s) => {
      if (names.has(s.name)) dupes++;
      else names.add(s.name);
    });
    return dupes;
  }, [scenarios]);

  const mergeStarterScenarios = (presets: Omit<MarketingScenario, 'id' | 'updatedAt'>[]): { merged: MarketingScenario[]; addedCount: number; updatedCount: number } => {
    const now = Date.now();
    const existingByName = new Map<string, MarketingScenario>();
    scenarios.forEach((s) => existingByName.set(s.name.trim(), s));

    let addedCount = 0;
    let updatedCount = 0;
    const updatedList = [...scenarios];

    presets.forEach((preset, index) => {
      const pName = preset.name.trim();
      const existing = existingByName.get(pName);
      if (existing) {
        const targetIndex = updatedList.findIndex((s) => s.id === existing.id || s.name.trim() === pName);
        if (targetIndex !== -1) {
          updatedList[targetIndex] = {
            ...existing,
            ...preset,
            updatedAt: now,
          };
          updatedCount++;
        }
      } else {
        let hash = 0;
        for (let i = 0; i < pName.length; i++) hash = ((hash << 5) - hash) + pName.charCodeAt(i);
        const stableId = `starter-${preset.channel}-${Math.abs(hash).toString(36)}-${index}`;

        const newScenario: MarketingScenario = {
          ...preset,
          id: stableId,
          updatedAt: now + index * 10,
        };
        updatedList.unshift(newScenario);
        existingByName.set(pName, newScenario);
        addedCount++;
      }
    });

    return { merged: sortScenarios(deduplicateMarketingScenarios(updatedList)), addedCount, updatedCount };
  };

  const deduplicateScenarios = () => {
    const seenNames = new Set<string>();
    const deduplicated: MarketingScenario[] = [];
    let removedCount = 0;

    scenarios.forEach((scenario) => {
      if (seenNames.has(scenario.name)) {
        removedCount++;
      } else {
        seenNames.add(scenario.name);
        deduplicated.push(scenario);
      }
    });

    if (removedCount === 0) {
      setNotice('重複しているシナリオはありません（すべて1本ずつ整理されています）。');
      return;
    }

    onScenariosChange(sortScenarios(deduplicated));
    setNotice(`重複していたシナリオ ${removedCount} 件を整理し、最新の1本ずつにまとめました！`);
  };

  const applyDiagnosisStarterSet = () => {
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(MST_DIAGNOSIS_STARTER_SCENARIOS);
    onScenariosChange(merged);
    setNotice(`診断フォロー（5本・Flex対応）を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。何回押しても重複しません。`);
  };

  const applyOutreachStarterSet = () => {
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(MST_OUTREACH_STARTER_SCENARIOS);
    onScenariosChange(merged);
    setNotice(`見込み企業向け営業メール（5ステップ）を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。何回押しても重複しません。`);
  };

  const applyLineNurturingStarterSet = () => {
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(MST_LINE_NURTURING_STARTER_SCENARIOS);
    onScenariosChange(merged);
    setNotice(`大橋ストーリー型ナーチャリング（7話・テキスト共感重視）を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。何回押しても重複しません。`);
  };

  const applyDirectConsultStarterSet = () => {
    const { merged, addedCount, updatedCount } = mergeStarterScenarios([MST_DIRECT_CONSULT_STARTER_SCENARIO]);
    onScenariosChange(merged);
    setNotice(`介護開業・個別相談の直相談Flexシナリオを反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。`);
  };

  const applyAllStarterSets = () => {
    const allPresets = [
      ...MST_DIAGNOSIS_STARTER_SCENARIOS,
      MST_DIRECT_CONSULT_STARTER_SCENARIO,
      ...MST_OUTREACH_STARTER_SCENARIOS,
      ...MST_LINE_NURTURING_STARTER_SCENARIOS,
    ];
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(allPresets);
    onScenariosChange(merged);
    setNotice(`公式プリセット全18本を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。何回押しても重複しません。`);
  };
  const startNew = () => {
    const newStep: MarketingScenario = {
      id: `scenario-${Date.now()}`,
      name: '新しい配信シナリオ',
      trigger: 'lead_created',
      channel: 'line',
      audience: 'すべての見込み客',
      waitMinutes: 0,
      emailSubject: '',
      emailBody: '',
      messageBody: '',
      lineMessageType: 'flex',
      lineImageUrl: '',
      linePreviewImageUrl: '',
      flexAltText: 'ご案内',
      flexTitle: '新しいご案内',
      flexBody: '{recipient_name} 様\nご案内をお届けいたします。',
      flexButtonLabel: '詳細を見る',
      flexButtonUrl: '{link_url}',
      status: 'draft',
      automationEnabled: false,
      stopOnBooking: true,
      stopOnDeal: true,
      consentBasis: '配信同意に基づく',
      updatedAt: Date.now(),
    };
    setInspectorScenario(newStep);
    setIsInspectorOpen(true);
    setActiveTab('flows');
    setNotice('');
  };
  const startEdit = (scenario: MarketingScenario) => {
    setInspectorScenario(scenario);
    setIsInspectorOpen(true);
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
    onScenariosChange(sortScenarios(editing
      ? scenarios.map((scenario) => scenario.id === editing.id ? saved : scenario)
      : [saved, ...scenarios]));
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
    { id: 'flows' as const, label: '🗺️ 導線フロー ＆ シナリオ配信管理', icon: GitBranch },
    { id: 'jobs' as const, label: '⚡ 配信ジョブ監視', icon: Activity },
    { id: 'line_settings' as const, label: '⚙️ LINE設定＆リッチメニュー', icon: MessageCircle },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900">マーケティング自動配信</h1>
              <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">シナリオ・自動応答・ジョブ監視</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              見込み客や顧客リストに向けた「ステップシナリオ」「キーワード自動応答」「配信ジョブ」を自動運用します。
              ※一斉配信（メール・LINE一括）や定型テンプレート管理は「<strong className="text-slate-900 font-semibold">📤 送信センター</strong>」、受信対応は「<strong className="text-slate-900 font-semibold">📥 統合受信トレイ</strong>」で一元管理されています。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('communication_send')}
                  className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-xs cursor-pointer"
                  title="全社共通の一斉配信を実行します"
                >
                  <Send className="h-3.5 w-3.5 text-purple-600" />
                  <span>📢 一斉配信（送信センター）</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('communication_send')}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-xs cursor-pointer"
                  title="全社共通の定型テンプレート保管庫を開きます"
                >
                  <Library className="h-3.5 w-3.5 text-emerald-600" />
                  <span>📚 テンプレート保管庫（送信センター）</span>
                </button>
              </>
            )}
            <button onClick={startNew} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 cursor-pointer shadow-xs transition-colors"><Plus className="h-4 w-4" />シナリオ作成</button>
          </div>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto border-t border-slate-200 pt-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setNotice(''); }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">{notice}</div>}

      {activeTab === 'flows' && (
        <MarketingFlowStudio
          scenarios={scenarios}
          onScenariosChange={onScenariosChange}
          onEditScenario={startEdit}
          onOpenInbox={() => onNavigateTab?.('inbox_hub')}
          onOpenJobs={() => setActiveTab('jobs')}
          onApplyAllStarterSets={applyAllStarterSets}
          onApplyDiagnosisStarterSet={applyDiagnosisStarterSet}
          onApplyOutreachStarterSet={applyOutreachStarterSet}
          onApplyLineNurturingStarterSet={applyLineNurturingStarterSet}
          onApplyDirectConsultStarterSet={applyDirectConsultStarterSet}
          onDeduplicateScenarios={deduplicateScenarios}
          duplicateCount={duplicateCount}
          onStartNew={startNew}
        />
      )}

      {activeTab === 'line_settings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="text-xs text-emerald-800 leading-relaxed">
              ⚙️ <strong>LINE公式アカウント基本設定:</strong> Webhookやリッチメニューの登録を行います。<br />
              ※LINE友だちへのウェルカム分岐やステップ配信は「<strong className="text-emerald-950">🗺️ 導線フロー＆シナリオ設計</strong>」、有人チャット対話は「<strong className="text-emerald-950">📥 統合受信箱</strong>」で管理されます。
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('inbox_hub')}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold transition shadow-xs cursor-pointer"
              >
                <Inbox className="h-3.5 w-3.5" />
                <span>📥 統合受信箱へ移動</span>
              </button>
            )}
          </div>
          <MarketingLineSettingsView onNavigateToWelcomeFlow={() => setActiveTab('flows')} />
        </div>
      )}
      {activeTab === 'jobs' && <MarketingAutomationJobsPanel health={automationHealth} onHealthChange={setAutomationHealth} />}

      {isInspectorOpen && inspectorScenario && (
        <FlowStepInspectorModal
          isOpen={isInspectorOpen}
          scenario={inspectorScenario}
          onClose={() => setIsInspectorOpen(false)}
          onSave={(saved) => {
            const exists = scenarios.some((s) => s.id === saved.id);
            const updated = exists
              ? scenarios.map((s) => (s.id === saved.id ? saved : s))
              : [saved, ...scenarios];
            onScenariosChange(sortScenarios(updated));
            setIsInspectorOpen(false);
            setNotice(`シナリオ「${saved.name}」を保存しました。`);
          }}
          onDelete={(scenarioId) => {
            onScenariosChange(scenarios.filter((s) => s.id !== scenarioId));
            setIsInspectorOpen(false);
            setNotice('シナリオを削除しました。');
          }}
          allScenarios={scenarios}
        />
      )}
    </div>
  );
};

