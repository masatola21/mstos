
import { getSalesEmailTemplate, getNurturingStepTemplate } from '../../utils/salesOutreachTemplates';

export const MST_OUTREACH_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [1, 2, 3, 4, 5].map((step) => {
  const tpl = getSalesEmailTemplate(step);
  const waitMinutes = step === 1 ? 0 : (step - 1) * 3 * 24 * 60; // 0, 3日後, 6日後, 9日後, 12日後
  // 第1通は手動で送る（宛先・文面を目で確認してから送信）。第2〜5通は、第1通を送った時に
  // 送信センターの「2通目以降も自動で送る」を入れた相手にだけ、日数をあけて自動送信する。
  const isFirst = step === 1;
  return {
    name: tpl.name,
    trigger: (isFirst ? 'manual' : 'outreach_first_sent') as MarketingTrigger,
    channel: 'email' as MarketingChannel,
    audience: isFirst ? '見込み企業（手動で送信）' : '第1通を送った見込み企業',
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
    // 第2〜5通は「第1通を送った時」にしか動かないため、有効にしておいても勝手に送られることはない
    status: (isFirst ? 'draft' : 'prepared') as MarketingScenario['status'],
    automationEnabled: !isFirst,
    sendTimeWindow: '09:00-18:00',
    preferredSendTime: !isFirst ? '10:00' : '',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '特定電子メール法に基づく業務改善情報の提供（オプトアウト明記）',
  };
});

export const MST_LINE_NURTURING_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [1, 2, 3, 4, 5, 6, 7].map((step) => {
  const tpl = getNurturingStepTemplate(step);
  // 友だち追加直後はウェルカム3択Flexを送るため、ストーリー教育は2日後から3日おきに配信（面談予約・返信で自動停止）
  const waitMinutes = ((step - 1) * 3 + 2) * 24 * 60;
  return {
    name: tpl.name,
    trigger: 'line_registered' as MarketingTrigger,
    channel: 'both' as MarketingChannel,
    audience: 'すべての見込み客（相談予約・返信で停止）',
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
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '配信同意に基づく（LINEおよびメルマガ配信対応）',
  };
});

// 分岐 B: 経営改善 個別相談（パターンA：親身な相談ルート → 商談案内）
export const MST_CONSULT_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【B1・親身フォロー】1日後：一言メモでもOK！よくある経営相談3選',
    trigger: 'tag_added',
    targetTag: '選択:個別相談',
    channel: 'line',
    audience: '「選択:個別相談」タグ（LINE返信・予約未完了）',
    waitMinutes: 1440,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n昨日は「個別相談」をお選びいただきありがとうございました！\n「どう文章で相談を書けばいいか迷う…」というお声もよくいただきますので、箇条書きや一言だけでも構いません。\n\nたとえば最近は以下のようなご相談が多いです：\n・売上はあるが手元に利益が残らない\n・現場の手作業・二重入力を減らしたい\n・新規の問い合わせ導線を整えたい\n\n気になる項目がございましたら、番号だけでもお気軽にご返信ください！',
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
    consentBasis: 'LINE個別相談ボタン選択時の同意に基づく',
  },
  {
    name: '【B2・商談案内】3日後：仕組み化事例（教育）＋ 30分無料オンライン相談',
    trigger: 'tag_added',
    targetTag: '選択:個別相談',
    channel: 'both',
    audience: '「選択:個別相談」タグ（予約未完了）',
    waitMinutes: 4320,
    emailSubject: '【MST】30分無料オンライン個別相談のご案内（日程調整）',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n文章で状況をまとめるのが大変な場合は、30分のオンライン相談にて画面を見ながら一緒に整理することも可能です。\n\n他社様では、最初の30分の壁打ちだけで「毎月25時間の手作業削減ポイント」が見つかった事例も多数ございます。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n{booking_url}\n\nもちろんLINEトーク上でのやり取りのままでも大歓迎です。ご都合の良い方法をお選びください！',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n文字で打つのが大変な場合は、30分のオンライン相談でそのままお話を伺いながら「利益が残る仕組み化の一手」を一緒に整理いたします。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【ご案内】30分無料オンライン個別相談（大橋真人）',
    flexTitle: '🗓️ 30分無料オンライン相談のご案内',
    flexBody:
      '{recipient_name} 様\n文字でまとめるのが大変な場合は、30分のオンラインで一緒にお悩みを整理しませんか？他社事例を踏まえ、最初の改善ステップをご提案します。',
    flexButtonLabel: '無料相談の日程を選ぶ',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: 'LINE個別相談ボタン選択時の同意に基づく',
  },
];

// 分岐 C: 介護保険外サービス開業（パターンB：2問ヒアリング × 専門教育 → 商談案内）
export const MST_CARE_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【C1・専門教育】1日後：直営「アシスタ大垣」の実務モデル＆収益設計のコツ',
    trigger: 'tag_added',
    targetTag: '介護保険外開業',
    channel: 'line',
    audience: '「介護保険外開業」タグ（LINE返信・予約未完了）',
    waitMinutes: 1440,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n介護保険外サービスの開業では、制度に縛られない分「どの単価帯・メニューから始めるか」で初年度の黒字化スピードが大きく変わります。\n\n弊社の直営事業「アシスタ大垣」の現場では、最初の立ち上げで\n① 地域の困りごとに特化した基本プラン\n② 継続利用につながる回数・月額設計\nの2点をシンプルに絞ることで安定収益化を実現してきました。\n\n今お考えの事業形態やご不安な点があれば、このままLINEで一言お送りください！',
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
    consentBasis: 'LINE介護保険外開業相談選択時の同意に基づく',
  },
  {
    name: '【C2・商談案内】3日後：30分無料・介護保険外開業 個別作戦会議のご案内',
    trigger: 'tag_added',
    targetTag: '介護保険外開業',
    channel: 'both',
    audience: '「介護保険外開業」タグ（予約未完了）',
    waitMinutes: 4320,
    emailSubject: '【MST】介護保険外サービス開業・30分無料個別作戦会議のご案内',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n貴社の事業状況や地域のニーズを踏まえ、失敗しない開業ステップと収益モデル設計について、30分のオンライン相談にて直接アドバイスさせていただきます。\n\n▼ 無料開業相談の日程を選ぶ\n{booking_url}\n\n当日お話しできますことを楽しみにしております。',
    messageBody:
      '{recipient_name} 様\n介護保険外サービスの立ち上げについて、貴社の地域・強みに合わせた収益モデルや必要書類を整理する【30分無料・開業作戦会議】をご案内しております。\n\n▼ 日程調整はこちら\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【ご案内】30分無料・介護保険外開業 個別作戦会議',
    flexTitle: '🌿 介護保険外開業・30分無料作戦会議',
    flexBody:
      '{recipient_name} 様\n直営「アシスタ大垣」の実務データをもとに、貴社に合わせたメニュー設計・集客導線を30分で一緒に具体化しませんか？',
    flexButtonLabel: '無料開業相談を予約する',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: 'LINE介護保険外開業相談選択時の同意に基づく',
  },
];

export const MST_DIRECT_CONSULT_STARTER_SCENARIO: Omit<MarketingScenario, 'id' | 'updatedAt'> =
  MST_CONSULT_STARTER_SCENARIOS[1];

// 分岐 A: 3分無料経営診断（HP簡易診断結果即時表示 × 教育フォロー → 商談案内 ※詳細レポート・提案書は商談後のみ送付）
export const MST_DIAGNOSIS_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【A1・未回答教育】1日後：まだお済みでない方へ（その場で簡易診断結果が出ます）',
    trigger: 'tag_added',
    targetTag: '選択:診断',
    channel: 'line',
    audience: '「選択:診断」タグ（HP診断未送信者のみ）',
    waitMinutes: 1440,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n昨日は無料経営診断をお選びいただきありがとうございました！\n多くの企業様で課題となる「人手不足・利益が残らない悩み」は、実は人ではなく【業務の配管（仕組み）の詰まり】が原因であることがほとんどです。\n\nホームページの選択式チェック（約3分）にご回答いただくと、送信直後にその場で【簡易診断結果（ボトルネック傾向・最初の一手）】をご確認いただけますので、お時間のある際にぜひお試しください。',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【3分無料診断】回答直後に簡易診断結果をご確認いただけます',
    flexTitle: '📊 3分で「簡易診断結果」を即時表示',
    flexBody:
      '{recipient_name} 様\n業務や利益のボトルネック傾向が約3分で分かり、回答直後にホームページ上で【簡易診断結果】をご確認いただけます（無料）。',
    flexButtonLabel: '3分簡易診断を始める',
    flexButtonUrl: '{link_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: 'LINE診断ルート選択時の配信同意に基づく',
  },
  {
    name: '【A2・簡易結果の解説】1日後：簡易診断結果の見方と最初の急所',
    trigger: 'diagnosis_completed',
    channel: 'line',
    audience: 'HP診断送信済み・商談未予約者',
    waitMinutes: 1440,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n先日は「3分無料経営診断」へのご回答ありがとうございました！ホームページ上に表示された【簡易診断結果】はご覧いただけましたでしょうか？\n\n簡易診断では「いまどこに詰まりが出やすいか」の傾向を整理しています。\nなお、御社の実情に合わせた【詳細な診断レポート・改善提案書】は、直接お話を伺った上で「30分のオンライン商談を実施された方限定」で商談後に作成・お渡ししております。\n\n▼ 無料オンライン商談（30分）の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【簡易診断結果の解説】最初の改善候補と詳細レポートのご案内',
    flexTitle: '🔎 簡易診断結果の活かし方',
    flexBody:
      '{recipient_name} 様\nHP上の簡易診断結果で把握した傾向をもとに、どこから着手すべきかを30分の無料商談で一緒に整理しませんか？（詳細な診断レポート・提案書は商談後に作成・進呈しております）',
    flexButtonLabel: '30分商談の日程を選ぶ',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
  {
    name: '【A3・事例教育×商談案内】3日後：仕組み化事例 ＆ 詳細レポート付き商談',
    trigger: 'diagnosis_completed',
    channel: 'line',
    audience: 'HP診断送信済み・商談未予約者',
    waitMinutes: 4320,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n先日の簡易診断に続き、同規模の企業様が「請求・見積・顧客情報の二重入力の解消」や「集客〜商談の導線接続」から小さく着手し、手元に利益が残る体制を整えた改善事例をご案内しております。\n\n30分のオンライン商談では、簡易診断の結果をベースに「御社が最初に直すべき1点」を絞り込み、商談後に御社専用の【詳細診断レポート・改善提案書】を進呈しております。\n\n▼ 個別商談の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【改善事例】簡易診断から仕組み化に着手した事例＆詳細レポートのご案内',
    flexTitle: '💡 仕組み化の事例 ＆ 個別商談',
    flexBody:
      '{recipient_name} 様\n簡易診断で見えたボトルネックを現場に負担なく解消した他社事例をご紹介。商談を実施された方限定で、商談後に「詳細診断レポート＆改善提案書」をお渡ししています。',
    flexButtonLabel: '詳細レポート付き商談を予約',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
  {
    name: '【A4・最終商談案内】7日後：簡易診断後1週間・30分無料個別相談のご案内',
    trigger: 'diagnosis_completed',
    channel: 'line',
    audience: 'HP診断送信済み・商談未予約者',
    waitMinutes: 10080,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n簡易診断をご回答いただいてから1週間が経ちました。もし「結果を見て気になっているが、日々の対応に追われて進められていない」という場合は、30分の無料オンライン相談をご活用ください。\n\n現状の優先順位を整理した上で、商談後に御社専用の【詳細診断レポート・改善提案書】をお届けいたします。\n\n▼ 相談枠の確認・ご予約はこちら\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【最終案内】簡易診断後の30分無料個別相談（詳細レポート進呈）',
    flexTitle: '🗓️ 30分無料・個別作戦会議のご案内',
    flexBody:
      '{recipient_name} 様\n簡易診断から1週間が経過しました。まずは30分のオンライン商談で改善の優先順位を整理しませんか？（詳細診断レポート・提案書は商談実施後に進呈）',
    flexButtonLabel: '今月の相談枠を確認する',
    flexButtonUrl: '{booking_url}',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
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
  { value: 'outreach_first_sent', label: '営業メール第1通を送った時（2通目以降を自動送信）' },
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
  preferredSendTime: '',
  consentBasis: '',
});


export function getScenarioSortKey(scenario: MarketingScenario): { categoryOrder: number; stepNumber: number; waitMinutes: number; name: string } {
  const name = scenario.name || '';
  
  // カテゴリ優先度: 1. 分岐A(診断), 2. 分岐B(個別相談), 3. 分岐C(介護開業), 4. 共通教育(ストーリー), 5. 営業メール, 99. その他
  let categoryOrder = 99;
  if (name.includes('【A') || name.includes('診断') || name.includes('【1. 初回') || name.includes('【2. 診断') || name.includes('【3. レポート') || name.includes('【4. 3日') || name.includes('【5. 7日') || scenario.trigger.startsWith('diagnosis_') || scenario.trigger.startsWith('report_')) {
    categoryOrder = 1;
  } else if (name.includes('【B') || (name.includes('個別相談') && !name.includes('介護'))) {
    categoryOrder = 2;
  } else if (name.includes('【C') || name.includes('介護') || name.includes('保険外')) {
    categoryOrder = 3;
  } else if (name.includes('ストーリー') || name.includes('大橋') || name.includes('ナーチャリング') || name.includes('話】')) {
    categoryOrder = 4;
  } else if (name.includes('営業メール') || name.includes('【第') || (scenario.channel === 'email' && scenario.trigger === 'lead_created')) {
    categoryOrder = 5;
  }

  // ステップ番号の抽出（例: 【A1 / 【B2 / 第1話 / ステップ1 など）
  let stepNumber = 999;
  const numMatch = name.match(/[【［\[第ABCステップ]*\s*(\d+)/) || name.match(/(\d+)/);
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
    let timer: number | null = null;
    const refresh = async () => {
      try {
        const result = await fetchMarketingAutomationHealth();
        if (active) setAutomationHealth(result);
      } catch (err: any) {
        if (active) {
          setAutomationHealth(null);
          // 401エラー（権限なし）が発生した場合、無限ポーリングを即座に中断
          if (err?.status === 401 || String(err?.message || '').includes('401')) {
            if (timer) {
              window.clearInterval(timer);
              timer = null;
            }
          }
        }
      }
    };
    void refresh();
    timer = window.setInterval(() => { void refresh(); }, 60000);
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
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
  const supportedAutomationTriggers = new Set<MarketingTrigger>(['prospect_selected','lead_created','outreach_first_sent','line_registered','diagnosis_invited','diagnosis_completed','meeting_completed','tag_added','booking_created','retainer_period','deal_stage_changed','deal_won','report_approved','report_sent','proposal_approved','proposal_sent','contract_sent','contract_signed','invoice_due','invoice_overdue','project_milestone']);

  const duplicateCount = useMemo(() => {
    const names = new Set<string>();
    let dupes = 0;
    scenarios.forEach((s) => {
      if (names.has(s.name)) dupes++;
      else names.add(s.name);
    });
    return dupes;
  }, [scenarios]);

  const LEGACY_BRANCH_A_PREFIXES = [
    '【1. 初回',
    '【2. 診断',
    '【3. レポート',
    '【4. 3日',
    '【5. 7日',
    '【A1・教育リマインド】',
    '【A2・診断直後】',
    '【A3・レポート送付】',
    '【A4・3日後教育】',
    '【A5・7日後商談案内】',
  ];

  const mergeStarterScenarios = (
    presets: Omit<MarketingScenario, 'id' | 'updatedAt'>[],
    options?: { replaceLegacyBranchA?: boolean }
  ): { merged: MarketingScenario[]; addedCount: number; updatedCount: number } => {
    const now = Date.now();
    const baseList = options?.replaceLegacyBranchA
      ? scenarios.filter((s) => !LEGACY_BRANCH_A_PREFIXES.some((prefix) => (s.name || '').startsWith(prefix)))
      : [...scenarios];

    const existingByName = new Map<string, MarketingScenario>();
    baseList.forEach((s) => existingByName.set(s.name.trim(), s));

    let addedCount = 0;
    let updatedCount = 0;
    const updatedList = [...baseList];

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
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(MST_DIAGNOSIS_STARTER_SCENARIOS, { replaceLegacyBranchA: true });
    onScenariosChange(merged);
    setNotice(`分岐A「簡易診断結果→教育→商談案内（全4本）」を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。`);
  };

  const applyOutreachStarterSet = () => {
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(MST_OUTREACH_STARTER_SCENARIOS);
    onScenariosChange(merged);
    setNotice(`見込み企業向け営業メール（5ステップ）を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。何回押しても重複しません。`);
  };

  const applyLineNurturingStarterSet = () => {
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(MST_LINE_NURTURING_STARTER_SCENARIOS);
    onScenariosChange(merged);
    setNotice(`共通教育「大橋ストーリー型（7話）」を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。`);
  };

  const applyDirectConsultStarterSet = () => {
    const { merged, addedCount, updatedCount } = mergeStarterScenarios([
      ...MST_CONSULT_STARTER_SCENARIOS,
      ...MST_CARE_STARTER_SCENARIOS,
    ]);
    onScenariosChange(merged);
    setNotice(`分岐B（親身な相談）・分岐C（介護開業）のフォロー＆商談案内シナリオを反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。`);
  };

  const applyAllStarterSets = () => {
    const allPresets = [
      ...MST_DIAGNOSIS_STARTER_SCENARIOS,
      ...MST_CONSULT_STARTER_SCENARIOS,
      ...MST_CARE_STARTER_SCENARIOS,
      ...MST_OUTREACH_STARTER_SCENARIOS,
      ...MST_LINE_NURTURING_STARTER_SCENARIOS,
    ];
    const { merged, addedCount, updatedCount } = mergeStarterScenarios(allPresets, { replaceLegacyBranchA: true });
    onScenariosChange(merged);
    setNotice(`公式プリセット全${allPresets.length}本を反映しました（新規導入: ${addedCount}件、最新更新: ${updatedCount}件）。何回押しても重複しません。`);
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
    { id: 'flows' as const, label: '配信シナリオ・導線管理', icon: GitBranch },
    { id: 'jobs' as const, label: '配信ジョブ監視', icon: Activity },
    { id: 'line_settings' as const, label: 'LINE設定＆リッチメニュー', icon: MessageCircle },
  ];

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">
          LINE・メール自動配信
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('communication_send')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer whitespace-nowrap"
              title="一斉配信・個別送信・文例・LINE素材ストックを開きます"
            >
              <Send className="h-3.5 w-3.5 text-purple-600" />
              <span>一斉配信・文例ストック</span>
            </button>
          )}
          <button
            onClick={startNew}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>新規ステップ作成</span>
          </button>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1" aria-label="自動配信メニュー">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setNotice(''); }}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              activeTab === id
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

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

