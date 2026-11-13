import React, { useState, useMemo, useEffect } from 'react';
import {
  GitBranch,
  MessageCircle,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Edit3,
  Eye,
  Zap,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Tag,
  Calendar,
  Building,
  UserCheck,
  Send,
  HelpCircle,
  Plus,
  Trash2,
  Save,
  X,
  Table,
  ListFilter,
  Search,
  Check,
  BookOpen,
  Inbox,
  Code,
  LayoutTemplate,
  RotateCcw
} from 'lucide-react';
import { MarketingScenario, MarketingTrigger, MarketingChannel } from '../../types/marketing';
import {
  INDUSTRY_MESSAGES,
  PRIORITY_INDUSTRY_KEYS,
  ONE_SHOT_SCENARIO_ID,
  ONE_SHOT_SCENARIO_NAME,
  getSalesEmailTemplate,
  getOneShotOutreachTemplate,
  resolveOneShotOutreachDraft,
  getIndustryMessage,
  getNurturingStepTemplate
} from '../../utils/salesOutreachTemplates';
import { LineMessagePreview } from '../LineMessagePreview';
import { renderPlaceholders, PLACEHOLDER_SAMPLE_VALUES } from '../../utils/placeholders';
import {
  DEFAULT_WELCOME_CHOICES,
  DEFAULT_WELCOME_PATTERN_DIAGNOSIS,
  DEFAULT_WELCOME_PATTERN_A,
  DEFAULT_WELCOME_PATTERN_B,
  WelcomeChoice,
  WelcomePatternDiagnosisConfig,
  WelcomePatternAConfig,
  WelcomePatternBConfig,
} from './MarketingLineSettingsView';
import { upgradeLegacyMstUrl, OFFICIAL_VERCEL_URLS } from '../../utils/marketingStorage';
import { getSupabase } from '../../lib/supabaseClient';
import { FlowStepInspectorModal } from './FlowStepInspectorModal';
import { UNIFIED_TAG_MASTER, MasterTag } from '../../constants/tagMaster';

export type FlowTrack = 'line_welcome' | 'sales_outreach' | 'story_nurturing' | 'direct_consult' | 'inbound_material';

export interface MarketingFlowStudioProps {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
  onEditScenario?: (scenario: MarketingScenario) => void;
  onOpenInbox?: () => void;
  onOpenJobs?: () => void;
  onApplyAllStarterSets?: () => void;
  onApplyDiagnosisStarterSet?: () => void;
  onApplyOutreachStarterSet?: () => void;
  onApplyLineNurturingStarterSet?: () => void;
  onApplyDirectConsultStarterSet?: () => void;
  onDeduplicateScenarios?: () => void;
  duplicateCount?: number;
  onStartNew?: () => void;
}

interface ScenarioPreviewInfo {
  name: string;
  emailSubject?: string;
  emailBody?: string;
  messageBody?: string;
}

export interface KeywordAutoReply {
  id: string;
  name: string;
  matchText: string;
  matchMode: 'contains' | 'exact';
  replyText: string;
  tag: string;
  targetBranch: 'diagnosis' | 'consult' | 'care' | 'general';
  enabled: boolean;
}

const RICHMENU_LINE_CONSULT_RULE: KeywordAutoReply = {
  id: 'kw-richmenu-line-consult',
  name: '【リッチメニュー】LINE相談タップ時',
  matchText: '【LINEで相談したい】',
  matchMode: 'exact',
  replyText:
    '{recipient_name} 様\nありがとうございます！有限会社MSTの大橋真人です。\n\nご相談内容をそのままこのLINEにお送りください（一言や箇条書きでも大丈夫です）。確認次第、原則24時間以内に担当より直接ご返信いたします。\n\n▼ 迷われたら番号だけでもどうぞ\n① 経営全般・利益を残す仕組みづくり\n② 業務の効率化・手作業の削減\n③ 介護保険外サービスの開業・収益化\n④ その他（いま気になっていること）\n\n※お急ぎで直接お話されたい方は、30分無料オンライン面談もご予約いただけます。\n{booking_url}',
  tag: '選択:個別相談',
  targetBranch: 'consult',
  enabled: true,
};

const DEFAULT_KEYWORD_RULES: KeywordAutoReply[] = [
  RICHMENU_LINE_CONSULT_RULE,
  {
    id: 'kw-diagnosis',
    name: '「診断」「経営診断」送信時',
    matchText: '診断',
    matchMode: 'contains',
    replyText: '無料経営診断のご案内です。\n以下のURLより約3分でご回答いただけます。回答受領後、大橋真人より専任レポートをお届けします。\n\n▼ 3分無料経営診断はこちら\n{link_url}',
    tag: '選択:診断',
    targetBranch: 'diagnosis',
    enabled: true,
  },
  {
    id: 'kw-consult',
    name: '「相談」「面談」「予約」送信時',
    matchText: '相談',
    matchMode: 'contains',
    replyText: '個別相談のご希望ありがとうございます！\n下記の日程調整カレンダーより、ご都合のよい日時をお選びください（30分・オンライン）。\n\n▼ 面談日程の選択はこちら\n{booking_url}',
    tag: '選択:個別相談',
    targetBranch: 'consult',
    enabled: true,
  },
  {
    id: 'kw-care',
    name: '「介護」「保険外」「開業」送信時',
    matchText: '介護',
    matchMode: 'contains',
    replyText: '介護保険外サービスの開業・事業展開についてのご相談ありがとうございます！\n自費リハビリ・自費看護等の立ち上げでは、提供メニューの設計と地域集客が成功の鍵となります。\n\n専任チームより最適な開業パッケージ案内をお届けします。',
    tag: '介護保険外開業',
    targetBranch: 'care',
    enabled: true,
  },
  {
    id: 'kw-pricing',
    name: '「料金」「費用」「価格」送信時',
    matchText: '料金',
    matchMode: 'contains',
    replyText: 'MSTのサービス料金・報酬体系についてのお問い合わせありがとうございます。\n\n企業の規模や改善フェーズに応じた月額プランおよび成果連動設計をご用意しております。\nまずは貴社の現状を【3分無料診断】または【30分無料オンライン相談】にてお聞かせください。\n\n▼ 3分無料診断\n{link_url}',
    tag: '関心:料金',
    targetBranch: 'general',
    enabled: true,
  },
  {
    id: 'kw-material',
    name: '「資料」「パンフレット」送信時',
    matchText: '資料',
    matchMode: 'contains',
    replyText: 'MSTの会社案内・サービス概要資料のご請求ありがとうございます。\n下記リンクより最新の会社概要PDFを閲覧いただけます。\n\n▼ 会社案内・サービス資料\nhttps://corp.mstcorp.info/materials',
    tag: '資料請求',
    targetBranch: 'general',
    enabled: true,
  },
];

export const MarketingFlowStudio: React.FC<MarketingFlowStudioProps> = ({
  scenarios,
  onScenariosChange,
  onEditScenario,
  onOpenInbox,
  onOpenJobs,
  onApplyAllStarterSets,
  onApplyDiagnosisStarterSet,
  onApplyOutreachStarterSet,
  onApplyLineNurturingStarterSet,
  onApplyDirectConsultStarterSet,
  onDeduplicateScenarios,
  duplicateCount = 0,
  onStartNew,
}) => {
  const db = getSupabase();
  const [activeTrack, setActiveTrack] = useState<FlowTrack>('line_welcome');
  const [selectedIndustry, setSelectedIndustry] = useState<string>(PRIORITY_INDUSTRY_KEYS[0]);
  const [expandedBranch, setExpandedBranch] = useState<'diagnosis' | 'consult' | 'care' | 'nurturing' | 'all'>('all');
  const [previewModalScenario, setPreviewModalScenario] = useState<ScenarioPreviewInfo | null>(null);

  // ─── LINEウェルカム・分岐パターンA/B設定用状態（単一の正本 / Single source of truth） ───
  const [welcomeHeading, setWelcomeHeading] = useState('大橋真人です。');
  const [welcomeSubheading, setWelcomeSubheading] = useState('LINE登録ありがとうございます。');
  const [welcomeIntro, setWelcomeIntro] = useState(
    'MSTでは、中小企業の\n「経営の仕組み化×利益改善」と\n介護保険外サービスの開業を支援しています。'
  );
  const [welcomeQuestion, setWelcomeQuestion] = useState('まず、どのようなご相談をご希望ですか？');
  const [welcomeInstruction, setWelcomeInstruction] = useState('ご希望に近いものをお選びください');

  // 選択肢（ボタン文面・アクション・色）
  const [welcomeChoices, setWelcomeChoices] = useState<Array<WelcomeChoice & { actionType?: 'postback' | 'uri'; uri?: string; color?: string }>>([
    { id: 'diagnosis', label: '📊 3分無料経営診断を受ける', tag: '選択:診断', route: 'form', formSlug: 'business-diagnosis', actionType: 'postback', color: '#10B981' },
    { id: 'consult', label: '🗓️ 経営改善について個別相談する', tag: '選択:個別相談', route: 'chat', actionType: 'postback', color: '#1E3A5F' },
    { id: 'care', label: '🌿 介護保険外サービスの開業相談', tag: '介護保険外開業', route: 'care_interactive', actionType: 'postback', color: '#0284C7' },
  ]);
  const [patternDiagnosisConfig, setPatternDiagnosisConfig] = useState<WelcomePatternDiagnosisConfig>(DEFAULT_WELCOME_PATTERN_DIAGNOSIS);
  const [patternAConfig, setPatternAConfig] = useState<WelcomePatternAConfig>(DEFAULT_WELCOME_PATTERN_A);
  const [patternBConfig, setPatternBConfig] = useState<WelcomePatternBConfig>(DEFAULT_WELCOME_PATTERN_B);
  const [isEditingPatternDiagnosis, setIsEditingPatternDiagnosis] = useState(false);
  const [isEditingPatternA, setIsEditingPatternA] = useState(false);
  const [isEditingPatternB, setIsEditingPatternB] = useState(false);
  const [patternBEditTab, setPatternBEditTab] = useState<'q1' | 'q2' | 'completion'>('q1');
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeRuleId, setWelcomeRuleId] = useState<string | null>(null);
  const [welcomeLoadedFromDb, setWelcomeLoadedFromDb] = useState(false);
  const [activeWelcomeSource, setActiveWelcomeSource] = useState<string>('');
  const [lastWelcomeLog, setLastWelcomeLog] = useState<{ body?: string; received_at?: string; status?: string } | null>(null);
  const [conflictingLegacyRules, setConflictingLegacyRules] = useState<Array<{ id?: string; name?: string; match_text?: string; reply_type?: string }>>([]);
  const [disablingLegacy, setDisablingLegacy] = useState(false);
  const [isEditingWelcome, setIsEditingWelcome] = useState(false);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeNotice, setWelcomeNotice] = useState('');
  const [welcomeError, setWelcomeError] = useState('');
  
  // Flex編集モード: 'visual' (各項目＆ボタン設定) | 'json' (Flex Bubble/Carousel JSON直接編集)
  const [flexEditMode, setFlexEditMode] = useState<'visual' | 'json'>('visual');
  const [customFlexJson, setCustomFlexJson] = useState<string>('');
  const [previewType, setPreviewType] = useState<'card' | 'line_official'>('card');

  // ビジュアル設定からLINE Flex Bubble JSONを組み立てる関数
  const buildFlexBubbleFromVisual = (
    heading: string,
    subheading: string,
    intro: string,
    question: string,
    instruction: string,
    choices: Array<WelcomeChoice & { actionType?: 'postback' | 'uri'; uri?: string; color?: string }>
  ) => {
    const defaultColors = ['#10B981', '#1E3A5F', '#0284C7', '#8B5CF6'];
    const buttons = choices.map((c, i) => {
      const isUri = c.actionType === 'uri' || (c.route === 'form' && c.formSlug?.startsWith('http'));
      const action = isUri
        ? {
            type: 'uri',
            label: (c.label || `選択肢 ${i + 1}`).slice(0, 20),
            uri: (c.uri || 'https://corp.mstcorp.info').trim(),
          }
        : {
            type: 'postback',
            label: (c.label || `選択肢 ${i + 1}`).slice(0, 20),
            data: c.tag ? `tag=${encodeURIComponent(c.tag)}&wc=${c.id}` : `wc=${c.id}`,
            displayText: c.label || `選択肢 ${i + 1}`,
          };

      return {
        type: 'button',
        style: 'primary',
        color: c.color || defaultColors[i % defaultColors.length],
        height: 'md',
        margin: i === 0 ? 'lg' : 'sm',
        action,
      };
    });

    const textItems: Record<string, any>[] = [];
    if (heading.trim()) textItems.push({ type: 'text', text: heading, size: 'xl', weight: 'bold', align: 'center', color: '#1E293B', wrap: true });
    if (subheading.trim()) textItems.push({ type: 'text', text: subheading, size: 'md', align: 'center', color: '#334155', margin: 'sm', wrap: true });
    if (intro.trim() || question.trim()) textItems.push({ type: 'separator', margin: 'lg' });
    if (intro.trim()) textItems.push({ type: 'text', text: intro, size: 'sm', align: 'center', color: '#475569', margin: 'lg', wrap: true });
    if (question.trim()) textItems.push({ type: 'text', text: question, size: 'lg', weight: 'bold', align: 'center', color: '#1E293B', margin: 'xl', wrap: true });
    if (instruction.trim()) textItems.push({ type: 'text', text: instruction, size: 'sm', align: 'center', color: '#64748B', margin: 'sm', wrap: true });

    if (textItems.length === 0 && buttons.length === 0) {
      textItems.push({ type: 'text', text: '友だち追加ありがとうございます。', size: 'md', align: 'center', color: '#1E293B', wrap: true });
    }

    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'lg',
        contents: [
          ...textItems,
          ...buttons,
        ],
      },
    };
  };

  // 分岐A（診断案内カード）プレビュー用Flex生成
  const buildPatternDiagnosisFlexBubble = (cfg: WelcomePatternDiagnosisConfig) => {
    const sampleName = PLACEHOLDER_SAMPLE_VALUES.recipient_name || '株式会社サンプル 担当者';
    const bodyText = renderPlaceholders(cfg.body, { ...PLACEHOLDER_SAMPLE_VALUES, recipient_name: sampleName });
    const btnLabel = (cfg.buttonLabel || '診断を始める（約3分）').trim().slice(0, 20);
    const targetUri = upgradeLegacyMstUrl(cfg.diagnosisUrl || OFFICIAL_VERCEL_URLS.diagnosis, 'diagnosis') || OFFICIAL_VERCEL_URLS.diagnosis;
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: cfg.title || '📊 3分無料経営診断', weight: 'bold', size: 'lg', color: '#1E293B', wrap: true },
          { type: 'text', text: bodyText, size: 'sm', color: '#475569', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#10B981',
            action: {
              type: 'uri',
              label: btnLabel,
              uri: targetUri,
            },
          },
        ],
      },
    };
  };

  // パターンAプレビュー用Flex生成
  const buildPatternAFlexBubble = (cfg: WelcomePatternAConfig) => {
    const sampleName = PLACEHOLDER_SAMPLE_VALUES.recipient_name || '株式会社サンプル 担当者';
    const greetingText = renderPlaceholders(cfg.greetingBody, { ...PLACEHOLDER_SAMPLE_VALUES, recipient_name: sampleName });
    const bookingLabel = (cfg.bookingButtonLabel || '').trim().slice(0, 20);
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: cfg.title || '🗓️ 経営改善の個別相談', weight: 'bold', size: 'lg', color: '#1E293B', wrap: true },
          { type: 'text', text: greetingText, size: 'sm', color: '#334155', wrap: true },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#F8FAFC',
            cornerRadius: 'md',
            paddingAll: 'md',
            margin: 'md',
            contents: [
              { type: 'text', text: cfg.promptTitle, size: 'xs', weight: 'bold', color: '#1E3A5F', wrap: true },
              ...(cfg.promptExamples ? [{ type: 'text', text: cfg.promptExamples, size: 'xxs', color: '#64748B', margin: 'xs', wrap: true }] : []),
            ],
          },
          ...(cfg.footerNote ? [{ type: 'text', text: cfg.footerNote, size: 'xs', color: '#475569', wrap: true }] : []),
        ],
      },
      ...(bookingLabel
        ? {
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#1E3A5F',
                  action: {
                    type: 'uri',
                    label: bookingLabel,
                    uri: PLACEHOLDER_SAMPLE_VALUES.booking_url || 'https://corp.mstcorp.info/booking',
                  },
                },
              ],
            },
          }
        : {}),
    };
  };

  // パターンBプレビュー用Flex生成
  const buildPatternBFlexBubble = (cfg: WelcomePatternBConfig, step: 'q1' | 'q2' | 'completion') => {
    const sampleName = PLACEHOLDER_SAMPLE_VALUES.recipient_name || '株式会社サンプル 担当者';
    if (step === 'q1') {
      const greetingText = renderPlaceholders(cfg.q1.greeting, { ...PLACEHOLDER_SAMPLE_VALUES, recipient_name: sampleName });
      return {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: cfg.q1.title, weight: 'bold', size: 'lg', color: '#0284C7', wrap: true },
            { type: 'text', text: greetingText, size: 'sm', color: '#334155', wrap: true },
            { type: 'separator', margin: 'md' },
            { type: 'text', text: cfg.q1.question, size: 'xs', weight: 'bold', color: '#0F172A', wrap: true },
            ...cfg.q1.choices.map((c, idx) => ({
              type: 'button',
              style: 'primary',
              color: c.color || (idx === 0 ? '#0284C7' : idx === 1 ? '#1E3A5F' : '#10B981'),
              height: 'sm',
              margin: idx === 0 ? 'md' : 'sm',
              action: {
                type: 'postback',
                label: (c.label || `選択肢${idx + 1}`).slice(0, 20),
                data: `care_q1=${c.value}`,
                displayText: c.displayText || c.label,
              },
            })),
          ],
        },
      };
    }
    if (step === 'q2') {
      const sampleQ1 = cfg.q1.choices[0]?.label || '既存の介護・福祉事業者';
      const introText = (cfg.q2.introTemplate || '').replace(/\{q1_label\}/g, sampleQ1);
      return {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: cfg.q2.title, weight: 'bold', size: 'lg', color: '#0284C7', wrap: true },
            { type: 'text', text: introText, size: 'sm', color: '#334155', wrap: true },
            { type: 'separator', margin: 'md' },
            ...cfg.q2.choices.map((c, idx) => ({
              type: 'button',
              style: 'secondary',
              height: 'sm',
              margin: idx === 0 ? 'md' : 'sm',
              action: {
                type: 'postback',
                label: (c.label || `テーマ${idx + 1}`).slice(0, 20),
                data: `care_q2=existing:${c.value}`,
                displayText: c.displayText || c.label,
              },
            })),
          ],
        },
      };
    }
    const sampleQ1 = cfg.q1.choices[0]?.label || '既存の介護・福祉事業者';
    const sampleQ2 = cfg.q2.choices[0]?.label || '収益モデル・料金設定';
    const footerButtons: any[] = [];
    if ((cfg.completion.pdfButtonLabel || '').trim()) {
      footerButtons.push({
        type: 'button',
        style: 'secondary',
        height: 'sm',
        action: {
          type: 'uri',
          label: cfg.completion.pdfButtonLabel.trim().slice(0, 20),
          uri: (cfg.completion.pdfButtonUrl || '').trim() || 'https://assist-care.jp',
        },
      });
    }
    if ((cfg.completion.bookingButtonLabel || '').trim()) {
      footerButtons.push({
        type: 'button',
        style: 'primary',
        color: '#0284C7',
        margin: footerButtons.length > 0 ? 'sm' : undefined,
        action: {
          type: 'uri',
          label: cfg.completion.bookingButtonLabel.trim().slice(0, 20),
          uri: PLACEHOLDER_SAMPLE_VALUES.booking_url || 'https://corp.mstcorp.info/booking',
        },
      });
    }
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: cfg.completion.title, weight: 'bold', size: 'lg', color: '#0284C7', wrap: true },
          { type: 'text', text: cfg.completion.greeting, size: 'sm', color: '#334155', wrap: true },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#F0F9FF',
            cornerRadius: 'md',
            paddingAll: 'md',
            margin: 'sm',
            contents: [
              { type: 'text', text: `・現在の状況: ${sampleQ1}`, size: 'xs', color: '#0369A1', weight: 'bold', wrap: true },
              { type: 'text', text: `・関心テーマ: ${sampleQ2}`, size: 'xs', color: '#0369A1', weight: 'bold', margin: 'xs', wrap: true },
            ],
          },
          { type: 'text', text: cfg.completion.body, size: 'xs', color: '#475569', wrap: true, margin: 'sm' },
        ],
      },
      ...(footerButtons.length > 0
        ? {
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: footerButtons,
            },
          }
        : {}),
    };
  };

  // Flex JSON の構文検証
  const isValidFlexJson = useMemo(() => {
    if (!customFlexJson.trim()) return true;
    try {
      const parsed = JSON.parse(customFlexJson);
      return Boolean(parsed && typeof parsed === 'object');
    } catch {
      return false;
    }
  }, [customFlexJson]);

  const parsedCustomFlex = useMemo(() => {
    if (!customFlexJson.trim()) return null;
    try {
      return JSON.parse(customFlexJson);
    } catch {
      return null;
    }
  }, [customFlexJson]);

  // Supabase / API からウェルカム設定をロード（単一正本: __welcome__）
  useEffect(() => {
    if (!db) return;
    const isColMissingErr = (err: any) =>
      err?.code === 'PGRST204' ||
      err?.code === '42703' ||
      /reply_payload|reply_type|schema cache|column .* does not exist/i.test(String(err?.message || ''));

    const applyLoadedWelcomeRule = (data: any) => {
      if (!data) return;
      setWelcomeRuleId(data.id || null);
      setWelcomeLoadedFromDb(true);
      setWelcomeEnabled(data.enabled ?? true);
      let payload = data.reply_payload as any;
      if ((!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) && typeof data.reply_text === 'string' && data.reply_text.trim().startsWith('{')) {
        try {
          payload = JSON.parse(data.reply_text);
        } catch {
          // ignore
        }
      }
      if (payload && typeof payload === 'object') {
        if (payload.editMode === 'json' || payload.editMode === 'visual') {
          setFlexEditMode(payload.editMode);
        }
        if (payload.contents) {
          setCustomFlexJson(JSON.stringify(payload.contents, null, 2));
        } else if (payload.type === 'bubble' || payload.type === 'carousel') {
          setCustomFlexJson(JSON.stringify(payload, null, 2));
        }

        if (payload.visualFields && typeof payload.visualFields === 'object') {
          setWelcomeHeading(String(payload.visualFields.heading ?? ''));
          setWelcomeSubheading(String(payload.visualFields.subheading ?? ''));
          setWelcomeIntro(String(payload.visualFields.intro ?? ''));
          setWelcomeQuestion(String(payload.visualFields.question ?? ''));
          setWelcomeInstruction(String(payload.visualFields.instruction ?? ''));
        } else {
          const bodyContents = payload?.contents?.body?.contents;
          if (Array.isArray(bodyContents)) {
            const sepIndex = bodyContents.findIndex((item: any) => item?.type === 'separator');
            if (sepIndex >= 0) {
              const beforeTexts = bodyContents.slice(0, sepIndex).filter((item: any) => item?.type === 'text');
              const afterTexts = bodyContents.slice(sepIndex + 1).filter((item: any) => item?.type === 'text');
              if (beforeTexts[0]?.text !== undefined) setWelcomeHeading(beforeTexts[0].text);
              setWelcomeSubheading(beforeTexts[1]?.text ?? '');
              if (afterTexts[0]?.text !== undefined) setWelcomeIntro(afterTexts[0].text);
              if (afterTexts[1]?.text !== undefined) setWelcomeQuestion(afterTexts[1].text);
              setWelcomeInstruction(afterTexts[2]?.text ?? '');
            } else {
              const textNodes = bodyContents.filter((item: any) => item?.type === 'text' && typeof item.text === 'string');
              if (textNodes.length > 0) {
                if (textNodes[0]?.text) setWelcomeHeading(textNodes[0].text);
                if (textNodes[1]?.text) setWelcomeSubheading(textNodes[1].text);
                if (textNodes[2]?.text) setWelcomeIntro(textNodes[2].text);
                if (textNodes[3]?.text) setWelcomeQuestion(textNodes[3].text);
                if (textNodes[4]?.text) setWelcomeInstruction(textNodes[4].text);
              }
            }
          }
        }

        if (Array.isArray(payload.choices) && payload.choices.length > 0) {
          const migratedChoices = payload.choices.map((c: any) => {
            if (c?.id === 'diagnosis') {
              return {
                ...c,
                route: c.route || 'form',
                formSlug: 'business-diagnosis',
                ...(c.uri ? { uri: upgradeLegacyMstUrl(c.uri, 'diagnosis') } : {}),
              };
            }
            if (c?.id === 'consult' && c?.route === 'booking') {
              return { ...c, route: 'chat' };
            }
            if (c?.id === 'care') {
              const legacyLabels = ['🌿 介護保険外サービス開業を知る', '🌿 介護保険外サービス開業パッケージについて知る', '介護保険外サービス開業パッケージについて知る'];
              const legacyTags = ['care:開業相談', '選択:開業パッケージ'];
              return {
                ...c,
                label: legacyLabels.includes(c.label) ? '🌿 介護保険外サービスの開業相談' : c.label,
                tag: legacyTags.includes(c.tag) || !c.tag ? '介護保険外開業' : c.tag,
                route: c.route === 'template' ? 'care_interactive' : c.route,
              };
            }
            return c;
          });
          setWelcomeChoices(migratedChoices);
        }
        if (payload.patternDiagnosis && typeof payload.patternDiagnosis === 'object') {
          const rawUrl = String(payload.patternDiagnosis.diagnosisUrl || DEFAULT_WELCOME_PATTERN_DIAGNOSIS.diagnosisUrl);
          setPatternDiagnosisConfig({
            ...DEFAULT_WELCOME_PATTERN_DIAGNOSIS,
            ...payload.patternDiagnosis,
            diagnosisUrl: upgradeLegacyMstUrl(rawUrl, 'diagnosis') || OFFICIAL_VERCEL_URLS.diagnosis,
          });
        }
        if (payload.patternA && typeof payload.patternA === 'object') {
          setPatternAConfig({
            ...DEFAULT_WELCOME_PATTERN_A,
            ...payload.patternA,
          });
        }
        if (payload.patternB && typeof payload.patternB === 'object') {
          setPatternBConfig({
            q1: {
              ...DEFAULT_WELCOME_PATTERN_B.q1,
              ...(payload.patternB.q1 || {}),
              choices: Array.isArray(payload.patternB.q1?.choices) && payload.patternB.q1.choices.length > 0
                ? payload.patternB.q1.choices
                : DEFAULT_WELCOME_PATTERN_B.q1.choices,
            },
            q2: {
              ...DEFAULT_WELCOME_PATTERN_B.q2,
              ...(payload.patternB.q2 || {}),
              choices: Array.isArray(payload.patternB.q2?.choices) && payload.patternB.q2.choices.length > 0
                ? payload.patternB.q2.choices
                : DEFAULT_WELCOME_PATTERN_B.q2.choices,
            },
            completion: {
              ...DEFAULT_WELCOME_PATTERN_B.completion,
              ...(payload.patternB.completion || {}),
            },
          });
        }
      } else if (typeof data.reply_text === 'string' && data.reply_text.trim()) {
        // テキスト形式の旧ウェルカムが直接設定されていた場合もプレビューへ反映
        setWelcomeIntro(data.reply_text.trim());
      }
    };

    const loadWelcome = async () => {
      try {
        const { data: sessionData } = await db.auth.getSession();
        const ownerId = sessionData.session?.user?.id;
        const token = sessionData.session?.access_token;
        if (!ownerId) return;

        if (token) {
          try {
            const resp = await fetch('/api/line/welcome-config', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (resp.ok) {
              const json = await resp.json();
              if (typeof json.activeSource === 'string') {
                setActiveWelcomeSource(json.activeSource);
              }
              if (json.lastWelcomeLog) {
                setLastWelcomeLog(json.lastWelcomeLog);
              }
              if (Array.isArray(json.conflictingLegacyRules)) {
                setConflictingLegacyRules(json.conflictingLegacyRules);
              }
              if (json.rule) {
                applyLoadedWelcomeRule(json.rule);
                return;
              }
            }
          } catch {
            // API未接続時は直接Supabaseクエリにフォールバック
          }
        }

        let { data: rows, error } = await db
          .from('line_auto_reply_rules')
          .select('id, reply_type, reply_payload, reply_text, enabled, updated_at')
          .eq('owner_id', ownerId)
          .eq('match_text', '__welcome__')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error && isColMissingErr(error)) {
          const fb = await db
            .from('line_auto_reply_rules')
            .select('id, reply_text, enabled, updated_at')
            .eq('owner_id', ownerId)
            .eq('match_text', '__welcome__')
            .order('updated_at', { ascending: false })
            .limit(1);
          rows = fb.data as any;
          error = fb.error;
        }

        if (!error && Array.isArray(rows) && rows[0]) {
          setActiveWelcomeSource(rows[0].enabled === false ? 'welcome_disabled' : 'welcome_rule');
          applyLoadedWelcomeRule(rows[0]);
        }

        const { data: legacyRows } = await db
          .from('line_auto_reply_rules')
          .select('id, name, match_text')
          .eq('owner_id', ownerId)
          .eq('enabled', true)
          .in('match_text', ['友だち追加', 'ウェルカム', 'あいさつ', '挨拶']);
        if (Array.isArray(legacyRows)) {
          setConflictingLegacyRules(legacyRows);
        }
      } catch (e) {
        console.warn('Welcome load error in FlowStudio:', e);
      }
    };
    void loadWelcome();
  }, [db]);

  // ウェルカム＆分岐パターンA/B設定の一括保存（単一の正本に統合保存）
  const handleSaveWelcome = async (successMessage?: string, overrideEnabled?: boolean) => {
    if (!db) return;
    setWelcomeSaving(true);
    setWelcomeNotice('');
    setWelcomeError('');
    try {
      const { data: sessionData } = await db.auth.getSession();
      const ownerId = sessionData.session?.user?.id;
      const token = sessionData.session?.access_token;
      if (!ownerId) throw new Error('ログインセッションが見つかりません');

      const effectiveEnabled = overrideEnabled !== undefined ? overrideEnabled : welcomeEnabled;

      let finalContents: any;
      let parsedCustomEnvelopeAltText = '';
      if (flexEditMode === 'json' && customFlexJson.trim()) {
        let parsedJson: any;
        try {
          parsedJson = JSON.parse(customFlexJson);
        } catch (jsonErr: any) {
          throw new Error('Flex JSONの構文エラーです。正しいJSONを入力してください: ' + (jsonErr?.message || ''));
        }
        if (parsedJson?.type === 'flex' && parsedJson?.contents && ['bubble', 'carousel'].includes(parsedJson.contents.type)) {
          parsedCustomEnvelopeAltText = typeof parsedJson.altText === 'string' ? parsedJson.altText.trim() : '';
          finalContents = parsedJson.contents;
        } else if (parsedJson && typeof parsedJson === 'object' && ['bubble', 'carousel'].includes(parsedJson.type)) {
          finalContents = parsedJson;
        } else {
          throw new Error('Flex JSONのルート要素は "type": "bubble" または "carousel"（または "type": "flex" + contents）である必要があります。');
        }
      } else {
        finalContents = buildFlexBubbleFromVisual(
          welcomeHeading,
          welcomeSubheading,
          welcomeIntro,
          welcomeQuestion,
          welcomeInstruction,
          welcomeChoices
        );
        setCustomFlexJson(JSON.stringify(finalContents, null, 2));
      }

      const extractFirstTextFromFlex = (node: any): string => {
        if (!node || typeof node !== 'object') return '';
        if (node.type === 'text' && typeof node.text === 'string' && node.text.trim()) return node.text.trim();
        if (Array.isArray(node.contents)) {
          for (const child of node.contents) {
            const found = extractFirstTextFromFlex(child);
            if (found) return found;
          }
        }
        if (node.body) {
          const found = extractFirstTextFromFlex(node.body);
          if (found) return found;
        }
        if (node.header) {
          const found = extractFirstTextFromFlex(node.header);
          if (found) return found;
        }
        return '';
      };

      const altText = flexEditMode === 'json'
        ? (parsedCustomEnvelopeAltText || extractFirstTextFromFlex(finalContents) || '友だち追加ありがとうございます').slice(0, 400)
        : ([welcomeHeading, welcomeSubheading].filter((s) => s && s.trim()).join(' ') || '友だち追加ありがとうございます').slice(0, 400);

      const normalizedPatternDiagnosis: WelcomePatternDiagnosisConfig = {
        ...patternDiagnosisConfig,
        diagnosisUrl:
          upgradeLegacyMstUrl(patternDiagnosisConfig.diagnosisUrl, 'diagnosis') ||
          OFFICIAL_VERCEL_URLS.diagnosis,
      };
      setPatternDiagnosisConfig(normalizedPatternDiagnosis);

      const normalizedChoices = welcomeChoices.map((c) => {
        if (c.id === 'diagnosis') {
          return {
            ...c,
            formSlug: 'business-diagnosis',
            ...(c.uri ? { uri: upgradeLegacyMstUrl(c.uri, 'diagnosis') } : {}),
          };
        }
        return c;
      });

      const payload = {
        altText,
        contents: finalContents,
        visualFields: {
          heading: welcomeHeading,
          subheading: welcomeSubheading,
          intro: welcomeIntro,
          question: welcomeQuestion,
          instruction: welcomeInstruction,
        },
        choices: normalizedChoices,
        patternDiagnosis: normalizedPatternDiagnosis,
        patternA: patternAConfig,
        patternB: patternBConfig,
        editMode: flexEditMode,
      };

      const replyTextSummary = altText;
      let savedViaApi = false;

      if (token) {
        const apiResp = await fetch('/api/line/welcome-config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            enabled: effectiveEnabled,
            replyText: replyTextSummary,
            payload,
          }),
        });
        if (apiResp.ok) {
          const apiJson = await apiResp.json().catch(() => ({}));
          if (apiJson?.rule?.id) {
            setWelcomeRuleId(apiJson.rule.id);
          }
          savedViaApi = true;
        } else if (apiResp.status !== 404 && apiResp.status !== 503) {
          const errJson = await apiResp.json().catch(() => ({}));
          throw new Error(errJson?.error || `サーバー保存エラー (${apiResp.status})`);
        }
      }

      if (!savedViaApi) {
        const nowIso = new Date().toISOString();
        const rowData = {
          owner_id: ownerId,
          name: '友だち追加ウェルカムFlexメッセージ',
          match_mode: 'exact',
          match_text: '__welcome__',
          reply_type: 'flex',
          reply_text: replyTextSummary,
          reply_payload: payload,
          enabled: effectiveEnabled,
          priority: 0,
          updated_at: nowIso,
        };
        const baseRowData = {
          owner_id: ownerId,
          name: '友だち追加ウェルカムFlexメッセージ',
          match_mode: 'exact',
          match_text: '__welcome__',
          reply_text: JSON.stringify(payload),
          enabled: effectiveEnabled,
          priority: 0,
          updated_at: nowIso,
        };
        const isColMissingErr = (err: any) =>
          err?.code === 'PGRST204' ||
          err?.code === '42703' ||
          /reply_payload|reply_type|schema cache|column .* does not exist/i.test(String(err?.message || ''));

        let targetId = welcomeRuleId;
        if (!targetId) {
          const { data: existingRows, error: findError } = await db
            .from('line_auto_reply_rules')
            .select('id')
            .eq('owner_id', ownerId)
            .eq('match_text', '__welcome__')
            .order('updated_at', { ascending: false })
            .limit(1);
          if (findError) throw findError;
          targetId = existingRows?.[0]?.id || null;
        }

        if (targetId) {
          let { data: updated, error: updateError } = await db
            .from('line_auto_reply_rules')
            .update(rowData as any)
            .eq('id', targetId)
            .select('id')
            .single();
          if (updateError && isColMissingErr(updateError)) {
            const fb = await db
              .from('line_auto_reply_rules')
              .update(baseRowData as any)
              .eq('id', targetId)
              .select('id')
              .single();
            updated = fb.data;
            updateError = fb.error;
          }
          if (updateError) throw updateError;
          if (updated?.id) setWelcomeRuleId(updated.id);
        } else {
          let { data: inserted, error: insertError } = await db
            .from('line_auto_reply_rules')
            .insert(rowData as any)
            .select('id')
            .single();
          if (insertError && isColMissingErr(insertError)) {
            const fb = await db
              .from('line_auto_reply_rules')
              .insert(baseRowData as any)
              .select('id')
              .single();
            inserted = fb.data;
            insertError = fb.error;
          }
          if (insertError) throw insertError;
          if (inserted?.id) setWelcomeRuleId(inserted.id);
        }
      }

      setWelcomeLoadedFromDb(true);
      setActiveWelcomeSource(effectiveEnabled ? 'welcome_rule' : 'welcome_disabled');
      setWelcomeNotice(successMessage || 'LINEウェルカム・分岐返信設定を保存しました！LINE公式アカウントへ即時反映されます。');
      setIsEditingWelcome(false);
      setIsEditingPatternDiagnosis(false);
      setIsEditingPatternA(false);
      setIsEditingPatternB(false);
      setTimeout(() => setWelcomeNotice(''), 5000);
    } catch (err: any) {
      setWelcomeError(`保存エラー: ${err?.message || '不明なエラー'}`);
    } finally {
      setWelcomeSaving(false);
    }
  };

  const handleToggleWelcomeEnabled = async (nextEnabled: boolean) => {
    setWelcomeEnabled(nextEnabled);
    await handleSaveWelcome(
      nextEnabled
        ? '友だち追加ウェルカムメッセージの自動送信を有効にして保存しました。'
        : '友だち追加ウェルカムメッセージの自動送信を停止しました。',
      nextEnabled
    );
  };

  const handleDisableLegacyWelcomeRules = async () => {
    if (!db) return;
    setDisablingLegacy(true);
    setWelcomeError('');
    try {
      const { data: sessionData } = await db.auth.getSession();
      const token = sessionData.session?.access_token;
      const ownerId = sessionData.session?.user?.id;
      let done = false;
      if (token) {
        const resp = await fetch('/api/line/welcome-config/disable-legacy', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          done = true;
        }
      }
      if (!done && ownerId) {
        const { error } = await db
          .from('line_auto_reply_rules')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('owner_id', ownerId)
          .in('match_text', ['友だち追加', 'ウェルカム', 'あいさつ', '挨拶'])
          .eq('enabled', true);
        if (error) throw error;
      }
      setConflictingLegacyRules([]);
      setWelcomeNotice('旧ウェルカム関連ルールを停止しました。今後はLINE・メール自動配信の設定のみが送信されます。');
      setTimeout(() => setWelcomeNotice(''), 5000);
    } catch (err: any) {
      setWelcomeError(`旧ルール停止エラー: ${err?.message || '不明なエラー'}`);
    } finally {
      setDisablingLegacy(false);
    }
  };

  // キーワード自動応答ルール用状態
  const [keywordRules, setKeywordRules] = useState<KeywordAutoReply[]>(DEFAULT_KEYWORD_RULES);
  const [isEditingKeywordModal, setIsEditingKeywordModal] = useState(false);
  const [editingRule, setEditingRule] = useState<KeywordAutoReply | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleMode, setRuleMode] = useState<'contains' | 'exact'>('contains');
  const [ruleReply, setRuleReply] = useState('');
  const [ruleTag, setRuleTag] = useState('');
  const [ruleTargetBranch, setRuleTargetBranch] = useState<'diagnosis' | 'consult' | 'care' | 'general'>('general');
  const [keywordNotice, setKeywordNotice] = useState('');

  // Supabase line_auto_reply_rules の同期
  useEffect(() => {
    if (!db) return;
    const fetchRules = async () => {
      try {
        const { data, error } = await db
          .from('line_auto_reply_rules')
          .select('*')
          .neq('match_text', '__welcome__')
          .order('priority', { ascending: true });

        if (!error && data && data.length > 0) {
          const mapped: KeywordAutoReply[] = data.map((r: any) => ({
            id: r.id,
            name: r.name || `「${r.match_text}」への応答`,
            matchText: r.match_text,
            matchMode: r.match_mode || 'contains',
            replyText: r.reply_text || '',
            tag: r.tag_id || '',
            targetBranch: (r.name?.includes('診断') ? 'diagnosis' : r.name?.includes('相談') ? 'consult' : r.name?.includes('介護') ? 'care' : 'general') as any,
            enabled: r.enabled ?? true,
          }));
          setKeywordRules(mapped);
        }
      } catch (err) {
        console.warn('Failed to fetch line_auto_reply_rules:', err);
      }
    };
    void fetchRules();
  }, [db]);

  // キーワードルールの保存
  const handleSaveKeywordRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleKeyword.trim() || !ruleReply.trim()) return;

    const newRule: KeywordAutoReply = {
      id: editingRule?.id || `kw-${Date.now()}`,
      name: ruleName.trim() || `「${ruleKeyword.trim()}」への応答`,
      matchText: ruleKeyword.trim(),
      matchMode: ruleMode,
      replyText: ruleReply.trim(),
      tag: ruleTag.trim(),
      targetBranch: ruleTargetBranch,
      enabled: editingRule?.enabled ?? true,
    };

    const nextRules = editingRule
      ? keywordRules.map(r => r.id === editingRule.id ? newRule : r)
      : [newRule, ...keywordRules];

    setKeywordRules(nextRules);

    if (db) {
      try {
        const { data: auth } = await db.auth.getUser();
        const ownerId = auth.user?.id;
        if (ownerId) {
          const isExistingDbRow = !newRule.id.startsWith('kw-');
          const rowPayload = {
            owner_id: ownerId,
            name: newRule.name,
            match_mode: newRule.matchMode,
            match_text: newRule.matchText,
            reply_text: newRule.replyText,
            tag_id: newRule.tag || null,
            enabled: newRule.enabled,
            priority: newRule.matchMode === 'exact' ? 10 : 100,
            updated_at: new Date().toISOString(),
          };
          const res = isExistingDbRow
            ? await db.from('line_auto_reply_rules').update(rowPayload).eq('id', newRule.id).select('id').single()
            : await db.from('line_auto_reply_rules').insert(rowPayload).select('id').single();
          if (res.error) {
            setWelcomeError(`キーワードルール保存エラー: ${res.error.message}`);
            return;
          }
          if (res.data?.id && res.data.id !== newRule.id) {
            setKeywordRules((prev) => prev.map((r) => (r.id === newRule.id ? { ...r, id: res.data.id } : r)));
          }
        }
      } catch (err: any) {
        console.warn('Supabase rule save warning:', err);
        setWelcomeError(`キーワードルール保存エラー: ${err?.message || '不明なエラー'}`);
        return;
      }
    }

    setKeywordNotice(`キーワード自動応答「${newRule.matchText}」を保存しました。`);
    setTimeout(() => setKeywordNotice(''), 4000);
    setIsEditingKeywordModal(false);
    setEditingRule(null);
  };

  const handleAddRichMenuConsultRule = async () => {
    const existingSaved = keywordRules.find(
      (r) => r.matchText.trim() === RICHMENU_LINE_CONSULT_RULE.matchText && !r.id.startsWith('kw-')
    );
    if (existingSaved) {
      openEditKeywordModal(existingSaved);
      return;
    }

    let createdRule: KeywordAutoReply = {
      ...RICHMENU_LINE_CONSULT_RULE,
      id: `kw-richmenu-${Date.now()}`,
    };

    if (db) {
      try {
        const { data: auth } = await db.auth.getUser();
        const ownerId = auth.user?.id;
        if (ownerId) {
          const rowPayload = {
            owner_id: ownerId,
            name: createdRule.name,
            match_mode: createdRule.matchMode,
            match_text: createdRule.matchText,
            reply_text: createdRule.replyText,
            tag_id: createdRule.tag || null,
            enabled: createdRule.enabled,
            priority: 10,
            updated_at: new Date().toISOString(),
          };
          const res = await db.from('line_auto_reply_rules').insert(rowPayload).select('id').single();
          if (res.error) {
            setWelcomeError(`リッチメニュー用ルールの登録エラー: ${res.error.message}`);
            return;
          }
          if (res.data?.id) {
            createdRule = { ...createdRule, id: res.data.id };
          }
        }
      } catch (err: any) {
        console.warn('Rich menu consult rule insert warning:', err);
        setWelcomeError(`リッチメニュー用ルールの登録エラー: ${err?.message || '不明なエラー'}`);
        return;
      }
    }

    setKeywordRules((prev) => {
      const filtered = prev.filter((r) => r.matchText.trim() !== RICHMENU_LINE_CONSULT_RULE.matchText);
      return [createdRule, ...filtered];
    });
    setKeywordNotice(`リッチメニュー「LINE相談」用ルール（${RICHMENU_LINE_CONSULT_RULE.matchText}）を登録しました。`);
    setTimeout(() => setKeywordNotice(''), 4000);
  };

  const handleDeleteKeywordRule = async (ruleId: string) => {
    const target = keywordRules.find(r => r.id === ruleId);
    setKeywordRules(keywordRules.filter(r => r.id !== ruleId));

    if (db && !ruleId.startsWith('kw-')) {
      try {
        await db.from('line_auto_reply_rules').delete().eq('id', ruleId);
      } catch (err) {
        console.warn('Rule delete error:', err);
      }
    }
    setKeywordNotice(`キーワード「${target?.matchText || ''}」を削除しました。`);
    setTimeout(() => setKeywordNotice(''), 3000);
  };

  const handleToggleKeywordRule = async (ruleId: string) => {
    const target = keywordRules.find(r => r.id === ruleId);
    if (!target) return;
    const toggled = !target.enabled;

    setKeywordRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: toggled } : r))
    );

    if (!db) return;

    if (!ruleId.startsWith('kw-')) {
      const { error } = await db
        .from('line_auto_reply_rules')
        .update({ enabled: toggled, updated_at: new Date().toISOString() })
        .eq('id', ruleId);
      if (error) {
        setWelcomeError(`ルール切替エラー: ${error.message}`);
      }
      return;
    }

    try {
      const { data: auth } = await db.auth.getUser();
      const ownerId = auth.user?.id;
      if (!ownerId) return;
      const res = await db
        .from('line_auto_reply_rules')
        .insert({
          owner_id: ownerId,
          name: target.name,
          match_mode: target.matchMode,
          match_text: target.matchText,
          reply_text: target.replyText,
          tag_id: target.tag || null,
          enabled: toggled,
          priority: target.matchMode === 'exact' ? 10 : 100,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (res.error) {
        setWelcomeError(`ルール保存エラー: ${res.error.message}`);
        return;
      }
      if (res.data?.id) {
        setKeywordRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, id: res.data.id } : r))
        );
      }
    } catch (err: any) {
      setWelcomeError(`ルール保存エラー: ${err?.message || '不明なエラー'}`);
    }
  };

  const openCreateKeywordModal = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleKeyword('');
    setRuleMode('contains');
    setRuleReply('');
    setRuleTag('');
    setRuleTargetBranch('general');
    setIsEditingKeywordModal(true);
  };

  const openEditKeywordModal = (rule: KeywordAutoReply) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleKeyword(rule.matchText);
    setRuleMode(rule.matchMode);
    setRuleReply(rule.replyText);
    setRuleTag(rule.tag);
    setRuleTargetBranch(rule.targetBranch);
    setIsEditingKeywordModal(true);
  };

  // ビューモード切り替え: 'flow' (ビジュアル導線マップ) または 'table' (全ステップ一覧テーブル)
  const [viewMode, setViewModeState] = useState<'flow' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('marketing_flow_view_mode') as 'flow' | 'table' | null;
      if (saved === 'flow' || saved === 'table') return saved;
    } catch {}
    return 'table';
  });

  const setViewMode = (mode: 'flow' | 'table') => {
    setViewModeState(mode);
    try {
      localStorage.setItem('marketing_flow_view_mode', mode);
    } catch {}
  };

  const [tableSearch, setTableSearch] = useState('');
  const [isStarterOpen, setIsStarterOpen] = useState(false);

  // ステップインスペクター / 編集モーダル状態
  const [inspectorScenario, setInspectorScenario] = useState<MarketingScenario | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // シナリオの分類（重複なく分岐A / B / C / 共通教育 / 営業メールへ振り分け）
  const diagnosisScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('【A') ||
      s.name.includes('診断') ||
      s.trigger.startsWith('diagnosis_') ||
      s.trigger.startsWith('report_') ||
      s.targetTag === '選択:診断' ||
      s.name.includes('【1. 初回') ||
      s.name.includes('【2. 診断') ||
      s.name.includes('【3. レポート') ||
      s.name.includes('【4. 3日') ||
      s.name.includes('【5. 7日')
    );
  }, [scenarios]);

  const consultScenarios = useMemo(() => {
    return scenarios.filter(s =>
      (s.name.includes('【B') ||
        s.name.includes('直相談') ||
        s.name.includes('個別相談') ||
        s.name.includes('面談') ||
        s.targetTag === '選択:個別相談' ||
        s.trigger.includes('booking') ||
        s.trigger.includes('meeting')) &&
      !s.name.includes('診断') &&
      !s.name.includes('介護') &&
      !s.name.includes('【A') &&
      !s.name.includes('【C')
    );
  }, [scenarios]);

  const careScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('【C') ||
      s.name.includes('介護') ||
      s.name.includes('保険外') ||
      s.name.includes('開業') ||
      s.targetTag === '介護保険外開業'
    );
  }, [scenarios]);

  const oneShotScenario = useMemo(() => {
    return scenarios.find(
      (s) => s.id === ONE_SHOT_SCENARIO_ID || s.name.includes('一発直球')
    ) || null;
  }, [scenarios]);

  const outreachScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.id !== ONE_SHOT_SCENARIO_ID &&
      !s.name.includes('一発直球') &&
      (
        s.name.includes('営業メール') ||
        s.name.includes('【営業') ||
        (s.channel === 'email' && s.trigger === 'lead_created') ||
        s.trigger === 'outreach_first_sent'
      )
    );
  }, [scenarios]);

  const nurturingScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('ストーリー') ||
      s.name.includes('ナーチャリング') ||
      s.name.includes('話】') ||
      s.name.includes('大橋')
    );
  }, [scenarios]);

  // インスペクターを開く
  const handleOpenInspector = (scenario: MarketingScenario) => {
    setInspectorScenario(scenario);
    setIsInspectorOpen(true);
  };

  // 新規ステップ作成（現在開いているトラック・分岐に合わせて初期設定）
  const handleCreateNewStep = () => {
    const isOutreach = activeTrack === 'sales_outreach';
    const isNurturing = !isOutreach && expandedBranch === 'nurturing';
    const isConsult = !isOutreach && expandedBranch === 'consult';
    const isCare = !isOutreach && expandedBranch === 'care';
    const isDiagnosis = !isOutreach && expandedBranch === 'diagnosis';

    const defaultChannel: MarketingChannel = isOutreach ? 'email' : isNurturing ? 'both' : 'line';
    const defaultTrigger: MarketingTrigger = isOutreach
      ? 'lead_created'
      : isConsult || isCare || isDiagnosis
      ? 'tag_added'
      : 'line_registered';
    const defaultTargetTag = isConsult
      ? '選択:個別相談'
      : isCare
      ? '介護保険外開業'
      : isDiagnosis
      ? '選択:診断'
      : undefined;
    const defaultName = isOutreach
      ? '【営業メール】業務改善・仕組み化のご案内'
      : isNurturing
      ? '【共通教育・追加話】ストーリーフォロー配信'
      : isConsult
      ? '【B・親身フォロー】個別相談のご案内'
      : isCare
      ? '【C・専門教育】介護保険外開業のご案内'
      : isDiagnosis
      ? '【A・教育】無料経営診断フォロー'
      : '【LINE】フォロー配信ステップ';

    const newStep: MarketingScenario = {
      id: `step-${Date.now()}`,
      name: defaultName,
      trigger: defaultTrigger,
      targetTag: defaultTargetTag,
      channel: defaultChannel,
      audience: isOutreach ? '未接触の見込み企業' : 'LINE友だち見込み客',
      waitMinutes: isOutreach ? 0 : 1440,
      emailSubject: isOutreach || isNurturing ? '【有限会社MST】業務改善・仕組み化のご案内' : '',
      emailBody: isOutreach || isNurturing ? '{recipient_name} 様\n\n有限会社MSTの大橋です。\n本メールでは業務改革と利益改善の最新事例をご案内いたします。' : '',
      messageBody: !isOutreach ? '{recipient_name} 様\nご案内をお届けいたします。\n\n▼30分無料オンライン相談はこちら\n{booking_url}' : '',
      lineMessageType: 'flex',
      lineImageUrl: '',
      linePreviewImageUrl: '',
      flexAltText: '【ご案内】業務改善・個別相談',
      flexTitle: '新しいご案内',
      flexBody: '{recipient_name} 様\nご案内をお届けいたします。',
      flexButtonLabel: '30分相談を予約する',
      flexButtonUrl: '{booking_url}',
      status: 'draft',
      automationEnabled: false,
      stopOnBooking: true,
      stopOnDeal: true,
      consentBasis: isOutreach ? '特定電子メール法に基づく業務改善情報の提供' : 'LINE友だち登録時の同意に基づく',
      updatedAt: Date.now(),
    };
    setInspectorScenario(newStep);
    setIsInspectorOpen(true);
  };

  // インスペクターからの保存
  const handleSaveInspectorScenario = (saved: MarketingScenario) => {
    const exists = scenarios.some(s => s.id === saved.id);
    const updated = exists
      ? scenarios.map(s => s.id === saved.id ? saved : s)
      : [saved, ...scenarios];
    onScenariosChange(updated);
    setKeywordNotice(`ステップ「${saved.name}」の設定を保存しました。`);
    setTimeout(() => setKeywordNotice(''), 4000);
  };

  // インスペクターからの削除
  const handleDeleteInspectorScenario = (scenarioId: string) => {
    const updated = scenarios.filter(s => s.id !== scenarioId);
    onScenariosChange(updated);
    setKeywordNotice('ステップを削除しました。');
    setTimeout(() => setKeywordNotice(''), 3000);
  };

  // トグル自動配信の有効化
  const toggleScenarioAutomation = (scenarioId: string, currentStatus: boolean) => {
    const updated = scenarios.map(s => {
      if (s.id === scenarioId) {
        return {
          ...s,
          automationEnabled: !currentStatus,
          status: !currentStatus ? ('prepared' as const) : s.status,
          updatedAt: Date.now(),
        };
      }
      return s;
    });
    onScenariosChange(updated);
  };

  return (
    <div className="space-y-6">
      {welcomeError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 flex items-center justify-between">
          <span>{welcomeError}</span>
          <button type="button" onClick={() => setWelcomeError('')} className="text-rose-600 font-bold px-1 cursor-pointer">✕</button>
        </div>
      )}

      {welcomeNotice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{welcomeNotice}</span>
          <button type="button" onClick={() => setWelcomeNotice('')} className="text-emerald-600 font-bold px-1 cursor-pointer">✕</button>
        </div>
      )}

      {keywordNotice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{keywordNotice}</span>
          <button type="button" onClick={() => setKeywordNotice('')} className="text-emerald-600 font-bold px-1 cursor-pointer">✕</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 統合: シナリオ別 配信設計 ＆ 公式プリセット連動コントロールセンター   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 統合: シナリオ別 配信設計 ＆ 公式プリセット連動コントロールセンター   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* 上段: タイトル ＆ マスターアクション */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
                <GitBranch className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                シナリオ別 配信設計 ＆ ビジュアル導線マップ
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                安全ストッパー稼働・重複ゼロ
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              LINE友だち導線（親身な相談・教育→商談案内）と営業メールを一元管理。返信・予約が入った瞬間に自動停止し、安全に個別商談へ移行します。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {scenarios.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsStarterOpen(!isStarterOpen)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 shadow-xs transition cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 text-purple-600" />
                  <span>詳細・初期セット</span>
                  {duplicateCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                  {isStarterOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                {isStarterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-white border border-slate-200 shadow-lg p-2.5 z-30 space-y-1.5 animate-in fade-in duration-150">
                    <div className="text-[11px] font-bold text-slate-400 px-2 py-0.5 uppercase tracking-wider">プリセット・補助操作</div>
                    {duplicateCount > 0 && onDeduplicateScenarios && (
                      <button
                        type="button"
                        onClick={() => { onDeduplicateScenarios(); setIsStarterOpen(false); }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>重複シナリオを整理</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">{duplicateCount}件</span>
                      </button>
                    )}
                    {onApplyAllStarterSets && (
                      <button
                        type="button"
                        onClick={() => { onApplyAllStarterSets(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition cursor-pointer text-left"
                      >
                        <Zap className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span>全公式プリセットを最新化</span>
                      </button>
                    )}
                    {onApplyDiagnosisStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyDiagnosisStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer text-left"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>分岐A: 簡易診断×教育4本を適用</span>
                      </button>
                    )}
                    {onApplyDirectConsultStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyDirectConsultStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition cursor-pointer text-left"
                      >
                        <Calendar className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                        <span>分岐B・C: 相談・介護フォロー適用</span>
                      </button>
                    )}
                    {onApplyLineNurturingStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyLineNurturingStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition cursor-pointer text-left"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span>共通教育: ストーリー7話を適用</span>
                      </button>
                    )}
                    {onApplyOutreachStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyOutreachStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer text-left"
                      >
                        <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span>営業メール5段階を適用</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateNewStep}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>＋ 新規ステップ作成</span>
            </button>
          </div>
        </div>

        {/* シナリオ0件時の目立つ初期セット適用バナー（折りたたまず表示） */}
        {scenarios.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-purple-300 bg-gradient-to-r from-purple-50 via-indigo-50 to-emerald-50 p-6 text-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">配信シナリオの初期セットアップ</h3>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  現在シナリオが登録されていません。公式スターターセット（LINE相談・教育フロー、営業メール5段階など）を適用して初期設定を完了するか、新規ステップを作成してください。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onApplyAllStarterSets && (
                  <button
                    type="button"
                    onClick={onApplyAllStarterSets}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                  >
                    <Zap className="h-4 w-4 text-purple-200" />
                    <span>全公式プリセットを一括適用</span>
                  </button>
                )}
                {onApplyDiagnosisStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDiagnosisStarterSet}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-200" />
                    <span>分岐A: 簡易診断×教育4本</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCreateNewStep}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>＋ 新規作成</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 下段: 役割別 3つの統合ビュー切り替えタブ（重複を廃止し、LINE導線・営業メール・全一覧の3つに整理） */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* ① LINE導線（相談・教育 → 商談） */}
          <button
            type="button"
            onClick={() => { setActiveTrack('line_welcome'); setViewMode('flow'); }}
            className={`group flex flex-col justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'line_welcome' && viewMode === 'flow'
                ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-400'
                : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'line_welcome' && viewMode === 'flow' ? 'text-emerald-900' : 'text-slate-800'}`}>
                <MessageCircle className={`w-3.5 h-3.5 ${activeTrack === 'line_welcome' && viewMode === 'flow' ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'}`} />
                ① LINE導線（相談・教育 → 商談）
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTrack === 'line_welcome' && viewMode === 'flow' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                分岐A/B/C＋教育{nurturingScenarios.length}話
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              ウェルカム3択・パターンA/B編集・相談/教育から30分商談へ統合案内
            </div>
          </button>

          {/* ② 営業メール */}
          <button
            type="button"
            onClick={() => { setActiveTrack('sales_outreach'); setViewMode('flow'); }}
            className={`group flex flex-col justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'sales_outreach' && viewMode === 'flow'
                ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-400'
                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'sales_outreach' && viewMode === 'flow' ? 'text-blue-900' : 'text-slate-800'}`}>
                <Mail className={`w-3.5 h-3.5 ${activeTrack === 'sales_outreach' && viewMode === 'flow' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`} />
                ② 営業メール（見込み企業開拓）
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTrack === 'sales_outreach' && viewMode === 'flow' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                {outreachScenarios.length}ステップ
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              見込み企業へのメール5段階（急所提起→仕組み化事例→3分診断）
            </div>
          </button>

          {/* 📋 全ステップ一覧 */}
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`group flex flex-col justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-purple-50 border-purple-500 shadow-xs ring-1 ring-purple-400'
                : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 font-bold text-xs ${viewMode === 'table' ? 'text-purple-900' : 'text-slate-800'}`}>
                <Table className={`w-3.5 h-3.5 ${viewMode === 'table' ? 'text-purple-600' : 'text-slate-400 group-hover:text-purple-600'}`} />
                ③ 全ステップ一覧
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${viewMode === 'table' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}`}>
                {scenarios.length}件
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              全シナリオの横断検索・ON/OFF一括管理
            </div>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* テーブル表示モード: 全シナリオ一覧 ＆ 詳細インスペクター直結     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Table className="w-5 h-5 text-purple-600" />
                全配信ステップ一覧・一括管理
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                各行の「点検・編集」を押すと、その場でメッセージ文面・URL・タグ・停止条件を確認・手入れできます。
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="ステップ名や本文で検索..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">ステップ名</th>
                  <th className="p-3">チャネル</th>
                  <th className="p-3">タイミング</th>
                  <th className="p-3">停止条件</th>
                  <th className="p-3">自動実行</th>
                  <th className="p-3 text-right">点検・操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {scenarios
                  .filter((s) => !tableSearch || s.name.toLowerCase().includes(tableSearch.toLowerCase()) || (s.messageBody || '').toLowerCase().includes(tableSearch.toLowerCase()) || (s.emailSubject || '').toLowerCase().includes(tableSearch.toLowerCase()))
                  .map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {s.flexTitle || s.messageBody || s.emailSubject || '文面未設定'}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.channel === 'line'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.channel === 'email'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {s.channel === 'line' ? '📱 LINE' : s.channel === 'email' ? '✉️ メール' : '📱+✉️ 両方'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {s.waitMinutes === 0 ? '即時実行' : `${Math.round(s.waitMinutes / 1440)}日後`}
                      </td>
                      <td className="p-3 text-[11px]">
                        <span className="text-slate-500">
                          {s.stopOnBooking ? '面談予約' : ''} {s.stopOnDeal ? '/ 成約' : ''} で停止
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(s.id, Boolean(s.automationEnabled))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                            s.automationEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {s.automationEnabled ? <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" /> : <Pause className="w-3 h-3 text-slate-500" />}
                          <span>{s.automationEnabled ? '稼働中' : '停止中'}</span>
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewModalScenario(s)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition"
                            title="文面プレビュー"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenInspector(s)}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer shadow-xs transition"
                            title="点検・編集"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                            <span>点検・編集</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* トラック 1: 📱 LINE友だち導線（ウェルカム＋診断・相談フォロー） */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'flow' && activeTrack === 'line_welcome' && (
        <div className="space-y-6">
          {/* 安全ストッパー宣言バナー */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-900">安全ストッパー稼働中: </span>
                LINE友だちから返信メッセージがあった場合、または予約が入った時点で
                <strong className="underline decoration-emerald-500 mx-1">自動ステップ配信は即時停止（スキップ）</strong>
                され、統合受信箱での個別有人対応に自動切り替わります。
              </div>
            </div>
            {onOpenInbox && (
              <button
                type="button"
                onClick={onOpenInbox}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-xs shrink-0 cursor-pointer shadow-xs"
              >
                <span>📥 統合受信箱でチャットを確認</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 入口 ①: LINE友だち追加 ウェルカムメッセージ（統一正本エディタ） */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-emerald-50/70 p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-sm flex items-center justify-center">
                  1
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      【入口①・統一正本】LINE友だち追加直後（即時送信）
                    </span>
                    {welcomeLoadedFromDb && welcomeRuleId ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        welcomeEnabled
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}>
                        {welcomeEnabled ? '✓ 保存済み・自動配信設定を反映中' : '停止中（自動送信OFF）'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        未保存（初期プレビュー表示中）
                      </span>
                    )}
                    <span className="text-xs text-slate-500">Flexカード（3大相談メニュー分岐）</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    友だち追加ウェルカムメッセージ
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={welcomeSaving}
                    checked={welcomeEnabled}
                    onChange={(e) => void handleToggleWelcomeEnabled(e.target.checked)}
                    className="rounded accent-emerald-600"
                  />
                  <span>自動送信有効</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditingWelcome(!isEditingWelcome)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isEditingWelcome ? 'プレビューに戻る' : 'ウェルカム文面を編集'}</span>
                </button>
              </div>
            </div>

            {!welcomeRuleId && (
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                <span>
                  現在この画面の設定はまだDBへ確定保存されていません（保存するまではシステム標準のウェルカムカードまたは既存の自動返信ルールが送信されます）。
                </span>
                <button
                  type="button"
                  disabled={welcomeSaving}
                  onClick={() => void handleSaveWelcome('現在のLINE・メール自動配信ウェルカム設定をDBに確定保存しました！')}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {welcomeSaving ? '反映中…' : 'この設定を保存してLINEに反映'}
                </button>
              </div>
            )}

            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
              <span>
                ※ ブロック解除や新規追加時にLINEから「昔の挨拶メッセージ」が届く場合は、
                <strong className="text-slate-800">LINE Official Account Manager（設定 → 応答設定 → あいさつメッセージ）を「オフ」</strong>
                にしてください（本システムのWebhook配信と重複・競合するのを防ぎます）。
              </span>
              {lastWelcomeLog?.body && (
                <span className="shrink-0 font-mono text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-2 py-0.5">
                  直近送信: {lastWelcomeLog.body.slice(0, 32)}
                </span>
              )}
            </div>

            {activeWelcomeSource === 'legacy_keyword_rule' && !welcomeRuleId && (
              <div className="px-5 py-2.5 bg-amber-50/70 border-b border-amber-200 text-[11px] text-amber-900 font-medium">
                現在、旧キーワード自動応答ルール側が有効のためそちらが送信対象です。「この設定を保存してLINEに反映」を押すと本画面の設定が最優先になります。
              </div>
            )}

            {conflictingLegacyRules.length > 0 && (
              <div className="px-5 py-3 bg-sky-50 border-b border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-sky-900">
                <span>
                  別の自動返信ルール（{conflictingLegacyRules.map((r) => `「${r.match_text}」`).join('・')}）が有効になっています。上記の「LINE・メール自動配信」設定が最優先されますが、不要な旧ルールを停止できます。
                </span>
                <button
                  type="button"
                  disabled={disablingLegacy}
                  onClick={() => void handleDisableLegacyWelcomeRules()}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-sky-300 bg-white hover:bg-sky-100 text-sky-800 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {disablingLegacy ? '停止中…' : '旧ルールを停止する'}
                </button>
              </div>
            )}

            {/* ウェルカム編集フォーム */}
            {isEditingWelcome && (
              <div className="p-5 bg-slate-50/80 border-b border-slate-200 space-y-4 text-xs animate-fade-in">
                {/* 編集モード切り替えタブ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFlexEditMode('visual')}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1.5 transition ${
                        flexEditMode === 'visual' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LayoutTemplate className="w-3.5 h-3.5" />
                      <span>🎨 ビジュアル・ボタン設定</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFlexEditMode('json');
                        if (!customFlexJson.trim()) {
                          const generated = buildFlexBubbleFromVisual(
                            welcomeHeading,
                            welcomeSubheading,
                            welcomeIntro,
                            welcomeQuestion,
                            welcomeInstruction,
                            welcomeChoices
                          );
                          setCustomFlexJson(JSON.stringify(generated, null, 2));
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1.5 transition ${
                        flexEditMode === 'json' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>💻 Flex JSON直接編集（完全自由）</span>
                    </button>
                  </div>

                  {flexEditMode === 'json' && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isValidFlexJson ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {isValidFlexJson ? '✓ JSON構文正常' : '⚠️ JSON構文エラー'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const generated = buildFlexBubbleFromVisual(
                            welcomeHeading,
                            welcomeSubheading,
                            welcomeIntro,
                            welcomeQuestion,
                            welcomeInstruction,
                            welcomeChoices
                          );
                          setCustomFlexJson(JSON.stringify(generated, null, 2));
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                      >
                        ビジュアル設定から再生成
                      </button>
                    </div>
                  )}
                </div>

                {flexEditMode === 'visual' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">差出人・見出し（太字大）</label>
                        <input
                          type="text"
                          value={welcomeHeading}
                          onChange={(e) => setWelcomeHeading(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="大橋真人です。"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">サブ見出し（挨拶）</label>
                        <input
                          type="text"
                          value={welcomeSubheading}
                          onChange={(e) => setWelcomeSubheading(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="LINE登録ありがとうございます。"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">自己紹介・事業紹介文</label>
                      <textarea
                        rows={3}
                        value={welcomeIntro}
                        onChange={(e) => setWelcomeIntro(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-xs font-mono focus:outline-none focus:border-purple-500"
                        placeholder="MSTでは、中小企業の「経営の仕組み化×利益改善」と介護保険外サービスの開業を支援しています。"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">問いかけ文面（大）</label>
                        <input
                          type="text"
                          value={welcomeQuestion}
                          onChange={(e) => setWelcomeQuestion(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="まず、どのようなご相談をご希望ですか？"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">補足誘導文面（小）</label>
                        <input
                          type="text"
                          value={welcomeInstruction}
                          onChange={(e) => setWelcomeInstruction(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="ご希望に近いものをお選びください"
                        />
                      </div>
                    </div>

                    {/* Flexボタン（選択肢）マネージャー */}
                    <div className="space-y-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            Flexアクションボタン設定（タップ時の動作・分岐・カラー）
                          </h5>
                          <p className="text-[11px] text-slate-500">
                            ボタン文面（LINE規定: 最大20文字）、タップ時の動作（タグ付与／URLリンク）、背景色を自由に変更・追加できます。
                          </p>
                        </div>
                        {welcomeChoices.length < 4 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newChoice = {
                                id: `choice-${Date.now()}`,
                                label: `新しい選択肢 ${welcomeChoices.length + 1}`,
                                tag: `選択:カスタム${welcomeChoices.length + 1}`,
                                route: 'template' as const,
                                actionType: 'postback' as const,
                                color: '#8B5CF6',
                              };
                              setWelcomeChoices([...welcomeChoices, newChoice]);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-300 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>ボタン追加</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        {welcomeChoices.map((choice, index) => (
                          <div key={choice.id || index} className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-slate-100 text-[10px] flex items-center justify-center text-slate-600 font-mono">
                                  {index + 1}
                                </span>
                                ボタン {index + 1}
                              </span>
                              {welcomeChoices.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWelcomeChoices(welcomeChoices.filter((_, i) => i !== index));
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                                  title="このボタンを削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
                              <div className="md:col-span-5">
                                <label className="text-[11px] text-slate-500 block mb-0.5">表示文面（LINE規定: 最大20文字）</label>
                                <input
                                  type="text"
                                  maxLength={20}
                                  value={choice.label}
                                  onChange={(e) => {
                                    const next = [...welcomeChoices];
                                    next[index] = { ...choice, label: e.target.value };
                                    setWelcomeChoices(next);
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-purple-500"
                                  placeholder="例: 📊 3分無料経営診断を受ける"
                                />
                              </div>

                              <div className="md:col-span-3">
                                <label className="text-[11px] text-slate-500 block mb-0.5">アクション種別</label>
                                <select
                                  value={choice.actionType || (choice.route === 'form' && choice.formSlug?.startsWith('http') ? 'uri' : 'postback')}
                                  onChange={(e) => {
                                    const next = [...welcomeChoices];
                                    next[index] = { ...choice, actionType: e.target.value as 'postback' | 'uri' };
                                    setWelcomeChoices(next);
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-purple-500"
                                >
                                  <option value="postback">ポストバック（タグ付与・シナリオ起動）</option>
                                  <option value="uri">URLを開く（Webページ・カレンダー）</option>
                                </select>
                              </div>

                              <div className="md:col-span-4">
                                <label className="text-[11px] text-slate-500 block mb-0.5">
                                  {choice.actionType === 'uri' ? '遷移先URL（https://〜）' : '付与タグ（CRM・シナリオ連動）'}
                                </label>
                                {choice.actionType === 'uri' ? (
                                  <input
                                    type="text"
                                    value={choice.uri || ''}
                                    onChange={(e) => {
                                      const next = [...welcomeChoices];
                                      next[index] = { ...choice, uri: e.target.value };
                                      setWelcomeChoices(next);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-purple-500"
                                    placeholder="https://corp.mstcorp.info/..."
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={choice.tag || ''}
                                    onChange={(e) => {
                                      const next = [...welcomeChoices];
                                      next[index] = { ...choice, tag: e.target.value };
                                      setWelcomeChoices(next);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono focus:bg-white focus:outline-none focus:border-purple-500"
                                    placeholder="例: 選択:診断"
                                  />
                                )}
                              </div>
                            </div>

                            {/* ボタンカラー選択パレット */}
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[11px] text-slate-500 font-medium">背景色:</span>
                              {[
                                { color: '#10B981', label: 'エメラルド' },
                                { color: '#1E3A5F', label: 'ネイビー' },
                                { color: '#0284C7', label: 'スカイブルー' },
                                { color: '#8B5CF6', label: 'パープル' },
                                { color: '#E11D48', label: 'ローズ' },
                                { color: '#F59E0B', label: 'アンバー' },
                              ].map((c) => (
                                <button
                                  key={c.color}
                                  type="button"
                                  onClick={() => {
                                    const next = [...welcomeChoices];
                                    next[index] = { ...choice, color: c.color };
                                    setWelcomeChoices(next);
                                  }}
                                  style={{ backgroundColor: c.color }}
                                  title={c.label}
                                  className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                                    (choice.color || (index === 0 ? '#10B981' : index === 1 ? '#1E3A5F' : index === 2 ? '#0284C7' : '#8B5CF6')) === c.color
                                      ? 'border-slate-800 scale-110 shadow-xs'
                                      : 'border-transparent opacity-70 hover:opacity-100'
                                  }`}
                                />
                              ))}
                              <span className="text-[10px] text-slate-400 font-mono ml-1">
                                {choice.color || (index === 0 ? '#10B981' : index === 1 ? '#1E3A5F' : index === 2 ? '#0284C7' : '#8B5CF6')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* JSON直接編集モード */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-slate-700">
                        LINE Flex Bubble / Carousel JSON 定義（LINE Messaging API準拠）
                      </label>
                      <span className="text-slate-500 text-[11px]">
                        header, hero(画像), body, footer, boxes, buttons を完全自由に記述可能
                      </span>
                    </div>
                    <textarea
                      rows={14}
                      value={customFlexJson}
                      onChange={(e) => setCustomFlexJson(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-emerald-300 text-xs font-mono leading-relaxed focus:outline-none focus:border-purple-500"
                      placeholder={`{\n  "type": "bubble",\n  "body": {\n    "type": "box",\n    "layout": "vertical",\n    "contents": [...]\n  }\n}`}
                      spellCheck={false}
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>ヒント: LINE Bot Designer等で作成したFlex Message JSONをそのまま貼り付けられます。</span>
                      <button
                        type="button"
                        onClick={() => {
                          const generated = buildFlexBubbleFromVisual(
                            welcomeHeading,
                            welcomeSubheading,
                            welcomeIntro,
                            welcomeQuestion,
                            welcomeInstruction,
                            welcomeChoices
                          );
                          setCustomFlexJson(JSON.stringify(generated, null, 2));
                        }}
                        className="text-purple-600 hover:text-purple-700 underline cursor-pointer"
                      >
                        ビジュアル設定の現在の内容で上書きリセット
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsEditingWelcome(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs cursor-pointer transition font-medium"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    disabled={welcomeSaving || (flexEditMode === 'json' && !isValidFlexJson)}
                    onClick={() => void handleSaveWelcome()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{welcomeSaving ? '保存中…' : '保存してLINEに反映'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* プレビュー表示 */}
            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
              <div className="lg:col-span-5 flex flex-col items-center space-y-3">
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 text-xs self-center shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPreviewType('card')}
                    className={`px-2.5 py-1 rounded cursor-pointer font-bold transition ${
                      previewType === 'card' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📱 スマホUI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewType('line_official')}
                    className={`px-2.5 py-1 rounded cursor-pointer font-bold transition ${
                      previewType === 'line_official' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔍 LINE公式表示
                  </button>
                </div>

                {previewType === 'line_official' ? (
                  <div className="w-full max-w-sm">
                    <LineMessagePreview
                      type="flex"
                      payload={{
                        altText: `${welcomeHeading} ${welcomeSubheading}`,
                        contents:
                          flexEditMode === 'json' && parsedCustomFlex
                            ? parsedCustomFlex
                            : buildFlexBubbleFromVisual(
                                welcomeHeading,
                                welcomeSubheading,
                                welcomeIntro,
                                welcomeQuestion,
                                welcomeInstruction,
                                welcomeChoices
                              ),
                      }}
                      title="友だち追加時ウェルカムFlexプレビュー"
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-sm bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200 text-slate-800 p-5 space-y-4">
                    <div className="text-center space-y-1">
                      <p className="font-bold text-lg text-slate-900">{welcomeHeading}</p>
                      <p className="text-xs text-slate-600 font-medium">{welcomeSubheading}</p>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-600 text-center whitespace-pre-line leading-relaxed">
                        {welcomeIntro}
                      </p>
                    </div>
                    <div className="text-center pt-2">
                      <p className="font-bold text-sm text-slate-900">{welcomeQuestion}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{welcomeInstruction}</p>
                    </div>
                    <div className="space-y-2 pt-1">
                      {welcomeChoices.map((choice, idx) => {
                        const color =
                          choice.color || (idx === 0 ? '#10B981' : idx === 1 ? '#1E3A5F' : idx === 2 ? '#0284C7' : '#8B5CF6');
                        return (
                          <button
                            key={choice.id || idx}
                            type="button"
                            onClick={() => {
                              if (choice.id === 'diagnosis' || choice.tag?.includes('診断')) {
                                setExpandedBranch(expandedBranch === 'diagnosis' ? 'all' : 'diagnosis');
                              } else if (choice.id === 'consult' || choice.tag?.includes('相談')) {
                                setExpandedBranch(expandedBranch === 'consult' ? 'all' : 'consult');
                              } else if (choice.id === 'care' || choice.tag?.includes('介護')) {
                                setExpandedBranch(expandedBranch === 'care' ? 'all' : 'care');
                              }
                            }}
                            style={{ backgroundColor: color }}
                            className="w-full py-3 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-between shadow-xs transition cursor-pointer hover:opacity-90"
                          >
                            <span>{choice.label}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-3 text-xs">
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      LINE導線の全体設計：親身な相談 × 教育 → 最終ゴール（商談案内）
                    </h4>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      🎯 最終ゴール: 30分個別相談・商談予約
                    </span>
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    初日のウェルカム3択で興味に合わせた分岐（A/B/C）へ振り分け、未選択の友だちや検討中の見込み客は「2日後からの共通ストーリー教育（7話）」で育成して商談へつなぎます。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedBranch('diagnosis')}
                      className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-left hover:border-emerald-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/70 text-emerald-900">教育ルート</span>
                      <span className="font-bold block mt-1">A. 簡易診断×教育（4本）</span>
                      <span className="text-[11px] opacity-85 block">レポートは商談後のみ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedBranch('consult')}
                      className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-left hover:border-purple-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-200/70 text-purple-900">親身な相談ルート</span>
                      <span className="font-bold block mt-1">B. 個別相談（パターンA）</span>
                      <span className="text-[11px] opacity-85 block">タグ: 選択:個別相談</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedBranch('care')}
                      className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-left hover:border-sky-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-200/70 text-sky-900">相談×専門教育</span>
                      <span className="font-bold block mt-1">C. 介護開業（パターンB）</span>
                      <span className="text-[11px] opacity-85 block">タグ: 介護保険外開業</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedBranch('nurturing')}
                      className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-left hover:border-indigo-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-200/70 text-indigo-900">教育ルート（2日後〜）</span>
                      <span className="font-bold block mt-1">共通ストーリー（7話）</span>
                      <span className="text-[11px] opacity-85 block">未返信・未予約者を育成</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-slate-500 font-medium">表示フィルタ:</span>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    すべて表示
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('diagnosis')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'diagnosis' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    A: 診断×教育
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('consult')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'consult' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    B: 個別相談(A)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('care')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'care' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    C: 介護開業(B)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('nurturing')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'nurturing' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    📖 共通教育(7話)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 入口 ②: ⚡ キーワード自動応答シナリオ */}
          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-sm flex items-center justify-center">
                  2
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      【入口②】顧客からのキーワード送信時
                    </span>
                    <span className="text-xs text-slate-500">リアルタイム自動応答 ＆ タグ付与</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    キーワード自動応答シナリオ（{keywordRules.length}件登録）
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {keywordRules.every(
                  (r) => r.matchText.trim() !== RICHMENU_LINE_CONSULT_RULE.matchText || r.id.startsWith('kw-')
                ) && (
                  <button
                    type="button"
                    onClick={handleAddRichMenuConsultRule}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>リッチメニュー「LINE相談」用を登録</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateKeywordModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新しいキーワード応答を追加</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {keywordRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-amber-400 transition shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                        {rule.name}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium border ${
                          rule.matchMode === 'exact'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}
                      >
                        {rule.matchMode === 'exact' ? `「${rule.matchText}」と完全一致` : `「${rule.matchText}」を含む`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-3 whitespace-pre-line bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs">
                      {rule.replyText}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-emerald-700 font-mono font-medium">
                        {rule.tag ? `タグ: ${rule.tag}` : 'タグなし'}
                      </span>
                      {rule.id.startsWith('kw-') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          未保存
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleKeywordRule(rule.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                          rule.enabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {rule.enabled ? '有効' : '無効'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditKeywordModal(rule)}
                        className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-2xs transition"
                        title="編集"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteKeywordRule(rule.id)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 cursor-pointer border border-slate-200 transition"
                        title="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 分岐 A: 📊 3分無料経営診断 × 教育ルート → 商談案内 */}
          {(expandedBranch === 'all' || expandedBranch === 'diagnosis') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                    A
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      分岐 A: 📊 3分無料経営診断（HP簡易結果即時 → 教育 → 商談案内）
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                        教育・簡易診断ルート
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {diagnosisScenarios.length} ステップ登録中
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      未回答リマインド ──→ HP送信で【簡易診断結果】即時表示 ──→ 1〜7日後教育・商談案内 ──→ 商談後に詳細レポート＆提案書送付
                    </p>
                  </div>
                </div>

                {onApplyDiagnosisStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDiagnosisStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-200" />
                    <span>簡易診断×教育4本を最新化</span>
                  </button>
                )}
              </div>

              {/* 分岐A 全体フロー整理カード（HP簡易診断 〜 商談後限定レポート送付の境界） */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    分岐Aの実務フロー（簡易結果と詳細レポート・提案書の切り分け）
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 font-bold">
                    未商談者へは詳細レポート自動送付なし
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-100 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">① 未回答時</span>
                    <p className="font-bold text-slate-900">HP診断へ誘導</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      タグ「選択:診断」で1日後に教育リマインド（回答済みの場合は自動停止）。
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">② HP送信直後（自動）</span>
                    <p className="font-bold text-emerald-900">簡易診断結果を即時表示</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      HP画面にボトルネック傾向を即時表示。LINE/メールでも結果確認＋商談案内を送付。
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-100 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">③ 1〜7日後（未予約のみ）</span>
                    <p className="font-bold text-slate-900">簡易結果解説 → 商談案内</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      簡易結果の見方・事例教育から30分商談へ誘導。商談予約・LINE返信で自動停止。
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 text-white border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">④ 商談後（商談者のみ）</span>
                    <p className="font-bold text-white">詳細レポート＆提案書送付</p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      商談を実施された方限定で、商談後に担当者が送信センター等から個別にお送りします。
                    </p>
                  </div>
                </div>
              </div>

              {/* 分岐A タップ直後の即時返信（診断案内カード）インライン設定 & プレビュー */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                        タップ直後の即時返信（最初の1発目）
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        3分無料経営診断 案内カード（ホームページ診断リンク）
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      「📊 3分無料経営診断を受ける」ボタンが押された瞬間に返信され、ボタンを押すとコーポレートHPの診断ページへ遷移します。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPatternDiagnosis(!isEditingPatternDiagnosis)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                      isEditingPatternDiagnosis
                        ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingPatternDiagnosis ? '診断カード編集を閉じる' : '✍️ 診断案内カードを編集'}</span>
                  </button>
                </div>

                {isEditingPatternDiagnosis ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-emerald-200/70">
                    <div className="lg:col-span-7 space-y-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">カード見出し</label>
                        <input
                          type="text"
                          value={patternDiagnosisConfig.title}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          案内メッセージ（<code className="text-emerald-700">{'{recipient_name}'}</code> 差し込み可）
                        </label>
                        <textarea
                          rows={4}
                          value={patternDiagnosisConfig.body}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, body: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 leading-relaxed focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">CTAボタンラベル（20文字以内）</label>
                          <span className={`text-[10px] font-mono ${patternDiagnosisConfig.buttonLabel.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {patternDiagnosisConfig.buttonLabel.length} / 20文字
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          value={patternDiagnosisConfig.buttonLabel}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, buttonLabel: e.target.value }))}
                          placeholder="例: 診断を始める（約3分）"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">遷移先URL（本番ホームページ診断）</label>
                          <button
                            type="button"
                            onClick={() =>
                              setPatternDiagnosisConfig((prev) => ({
                                ...prev,
                                diagnosisUrl: OFFICIAL_VERCEL_URLS.diagnosis,
                              }))
                            }
                            className="text-[11px] text-emerald-700 hover:text-emerald-800 underline cursor-pointer font-medium"
                          >
                            公式HP診断URLを設定
                          </button>
                        </div>
                        <input
                          type="url"
                          value={patternDiagnosisConfig.diagnosisUrl}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, diagnosisUrl: e.target.value }))}
                          placeholder={OFFICIAL_VERCEL_URLS.diagnosis}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          ※ 送信時には自動で <code className="bg-white px-1 rounded border border-slate-200">?source=line&amp;luid=...&amp;cid=...</code> が付与され、回答者のCRM・LINEと紐付きます。
                        </p>
                        {/\.run\.app|\/f\/business-diagnosis|\/forms\/business-diagnosis/i.test(patternDiagnosisConfig.diagnosisUrl || '') && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                            旧OS用URLが入力されています。保存時に自動的に公式ホームページ（{OFFICIAL_VERCEL_URLS.diagnosis}）へ変換されます。
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setPatternDiagnosisConfig(DEFAULT_WELCOME_PATTERN_DIAGNOSIS)}
                          className="text-slate-500 hover:text-slate-800 underline cursor-pointer text-[11px]"
                        >
                          初期テンプレートに戻す
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingPatternDiagnosis(false)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            disabled={welcomeSaving}
                            onClick={() => void handleSaveWelcome('分岐A（3分無料経営診断案内カード）の設定を保存しました！')}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{welcomeSaving ? '保存中…' : '保存してLINEに反映'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <div className="w-full max-w-sm">
                        <LineMessagePreview
                          type="flex"
                          payload={{
                            altText: `【3分無料経営診断】${patternDiagnosisConfig.title}`,
                            contents: buildPatternDiagnosisFlexBubble(patternDiagnosisConfig),
                          }}
                          title="分岐A 診断案内プレビュー"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{patternDiagnosisConfig.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          タグ「選択:診断」付与
                        </span>
                      </div>
                      <p className="text-slate-600 whitespace-pre-line line-clamp-3 leading-relaxed">
                        {patternDiagnosisConfig.body}
                      </p>
                      <div className="p-2 rounded bg-emerald-50/70 border border-emerald-100 text-[11px] text-emerald-900 space-y-0.5">
                        <div className="font-bold">ボタン: 「{patternDiagnosisConfig.buttonLabel}」</div>
                        <div className="font-mono text-[10px] text-emerald-700 break-all">
                          遷移先: {patternDiagnosisConfig.diagnosisUrl}
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-5">
                      <LineMessagePreview
                        type="flex"
                        payload={{
                          altText: `【3分無料経営診断】${patternDiagnosisConfig.title}`,
                          contents: buildPatternDiagnosisFlexBubble(patternDiagnosisConfig),
                        }}
                        title="分岐A 実機イメージ"
                      />
                    </div>
                  </div>
                )}
              </div>

              {diagnosisScenarios.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-3">
                  <p className="text-xs text-slate-500">分岐A（簡易診断×教育）のシナリオがまだ登録されていません。</p>
                  {onApplyDiagnosisStarterSet && (
                    <button
                      type="button"
                      onClick={onApplyDiagnosisStarterSet}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>簡易診断×教育4本の標準シナリオを反映する</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnosisScenarios.map((scenario, index) => (
                    <div
                      key={scenario.id}
                      className="bg-slate-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition shadow-2xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-emerald-300">
                          {index + 1}
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                              {scenario.waitMinutes === 0 ? '即時実行' : `${Math.round(scenario.waitMinutes / 1440)}日後`}
                            </span>
                            {scenario.trigger === 'tag_added' && scenario.targetTag && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                タグ: {scenario.targetTag}
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                              {scenario.lineMessageType === 'flex' ? 'Flexカード' : 'テキスト'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {scenario.flexTitle || scenario.messageBody || scenario.emailSubject || '文面未設定'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            scenario.automationEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {scenario.automationEnabled ? (
                            <>
                              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                              <span>自動実行中</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3.5 h-3.5 text-slate-400" />
                              <span>一時停止中</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewModalScenario(scenario)}
                          className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer shadow-2xs"
                          title="文面プレビュー"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenInspector(scenario)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                          <span>点検・編集</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 分岐 B: 💬 経営改善・個別相談【パターンA：親身な相談ルート → 商談案内】 */}
          {(expandedBranch === 'all' || expandedBranch === 'consult') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-purple-100 text-purple-800 font-bold border border-purple-300">
                    B
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      分岐 B: 💬 経営改善・個別相談（パターンA：親身な相談 → 商談案内）
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 font-bold">
                        親身な相談ルート
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        後続 {consultScenarios.length} ステップ
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      「個別相談する」タップ（タグ: 選択:個別相談） ──→ 即時【パターンA】直通あいさつ ──→ 1日後 親身フォロー ──→ 3日後 商談案内
                    </p>
                  </div>
                </div>

                {onApplyDirectConsultStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDirectConsultStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5 text-purple-200" />
                    <span>相談・介護フォローを最新化</span>
                  </button>
                )}
              </div>

              {/* パターンA インライン設定 & プレビュー */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white">
                        タップ直後の即時返信（パターンA）
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        LINE直通チャット個別相談カード
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      「経営改善について個別相談する」ボタンが押された瞬間に返信され、CRMに未対応リードを自動起票します。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPatternA(!isEditingPatternA)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                      isEditingPatternA
                        ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingPatternA ? 'パターンA編集を閉じる' : '✍️ パターンA文面を編集'}</span>
                  </button>
                </div>

                {isEditingPatternA ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-purple-200/70">
                    <div className="lg:col-span-7 space-y-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">カード見出し</label>
                        <input
                          type="text"
                          value={patternAConfig.title}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          導入・挨拶文（<code className="text-purple-700">{'{recipient_name}'}</code> 差し込み可）
                        </label>
                        <textarea
                          rows={4}
                          value={patternAConfig.greetingBody}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, greetingBody: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 leading-relaxed focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">ヒアリング問いかけ（強調ボックス内）</label>
                          <textarea
                            rows={2}
                            value={patternAConfig.promptTitle}
                            onChange={(e) => setPatternAConfig((prev) => ({ ...prev, promptTitle: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">相談例テキスト（補足）</label>
                          <input
                            type="text"
                            value={patternAConfig.promptExamples}
                            onChange={(e) => setPatternAConfig((prev) => ({ ...prev, promptExamples: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">下部案内メッセージ</label>
                        <textarea
                          rows={2}
                          value={patternAConfig.footerNote}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, footerNote: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 leading-relaxed focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">商談予約ボタンラベル（{`{booking_url}`} へリンク・20文字以内）</label>
                          <span className={`text-[10px] font-mono ${patternAConfig.bookingButtonLabel.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {patternAConfig.bookingButtonLabel.length} / 20文字
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          value={patternAConfig.bookingButtonLabel}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, bookingButtonLabel: e.target.value }))}
                          placeholder="空欄にするとボタンを表示しません（例: 🗓️ 30分オンライン相談予約）"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setPatternAConfig(DEFAULT_WELCOME_PATTERN_A)}
                          className="text-slate-500 hover:text-slate-800 underline cursor-pointer text-[11px]"
                        >
                          初期テンプレートに戻す
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingPatternA(false)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            disabled={welcomeSaving}
                            onClick={() => void handleSaveWelcome('パターンA（経営改善・個別相談）の設定を保存しました！')}
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{welcomeSaving ? '保存中…' : '保存してLINEに反映'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <div className="w-full max-w-sm">
                        <LineMessagePreview
                          type="flex"
                          payload={{
                            altText: `【個別相談】${patternAConfig.title}`,
                            contents: buildPatternAFlexBubble(patternAConfig),
                          }}
                          title="パターンA LINEプレビュー"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{patternAConfig.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          タグ「選択:個別相談」＆ リード起票
                        </span>
                      </div>
                      <p className="text-slate-600 whitespace-pre-line line-clamp-3 leading-relaxed">
                        {patternAConfig.greetingBody}
                      </p>
                      <div className="p-2 rounded bg-slate-50 border border-slate-100 text-[11px] text-slate-700">
                        {patternAConfig.promptTitle}
                      </div>
                      {patternAConfig.bookingButtonLabel && (
                        <div className="text-[11px] text-purple-700 font-medium">
                          下部CTAボタン: 「{patternAConfig.bookingButtonLabel}」 → {'{booking_url}'}
                        </div>
                      )}
                    </div>
                    <div className="lg:col-span-5">
                      <LineMessagePreview
                        type="flex"
                        payload={{
                          altText: `【個別相談】${patternAConfig.title}`,
                          contents: buildPatternAFlexBubble(patternAConfig),
                        }}
                        title="パターンA 実機イメージ"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* パターンAの後の自動フォロー（未返信時のみ） */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    後続の自動フォロー・商談案内（お客様から返信・予約があれば自動停止）
                  </span>
                </div>
                {consultScenarios.length === 0 ? (
                  <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-500">分岐Bの後続フォローシナリオがまだ登録されていません。</p>
                    {onApplyDirectConsultStarterSet && (
                      <button
                        type="button"
                        onClick={onApplyDirectConsultStarterSet}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>親身フォロー・商談案内の標準シナリオを反映する</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consultScenarios.map((scenario, index) => (
                      <div
                        key={scenario.id}
                        className="bg-slate-50/60 border border-slate-200 hover:border-purple-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-purple-300">
                            {index + 1}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                {scenario.waitMinutes === 0 ? '即時実行' : `${Math.round(scenario.waitMinutes / 1440)}日後`}
                              </span>
                              {scenario.trigger === 'tag_added' && scenario.targetTag && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  タグ: {scenario.targetTag}
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                                {scenario.channel === 'line' ? 'LINE' : scenario.channel === 'email' ? 'メール' : 'LINE+メール'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {scenario.flexTitle || scenario.messageBody || scenario.emailSubject || '文面未設定'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              scenario.automationEnabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {scenario.automationEnabled ? (
                              <>
                                <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                                <span>自動実行中</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 text-slate-400" />
                                <span>一時停止中</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewModalScenario(scenario)}
                            className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer shadow-2xs"
                            title="文面プレビュー"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenInspector(scenario)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                            <span>点検・編集</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 分岐 C: 🌿 介護保険外サービス開業【パターンB：2問ヒアリング × 専門教育 → 商談案内】 */}
          {(expandedBranch === 'all' || expandedBranch === 'care') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-sky-100 text-sky-800 font-bold border border-sky-300">
                    C
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      分岐 C: 🌿 介護保険外サービス開業（パターンB：2問ヒアリング × 専門教育 → 商談案内）
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 font-bold">
                        相談×専門教育ルート
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                        後続 {careScenarios.length} ステップ
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      「開業相談」タップ（タグ: 介護保険外開業） ──→ 即時【パターンB】Q1状況→Q2テーマ→完了カード ──→ 1日後 事例教育 ──→ 3日後 商談案内
                    </p>
                  </div>
                </div>

                {onApplyDirectConsultStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDirectConsultStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5 text-sky-200" />
                    <span>相談・介護フォローを最新化</span>
                  </button>
                )}
              </div>

              {/* パターンB インライン設定 & プレビュー（Q1 / Q2 / 完了） */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-600 text-white">
                        タップ直後の2問クイックヒアリング（パターンB）
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        Q1（現在の状況） → Q2（関心テーマ） → 完了カード＆商談導線
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      2タップで顧客の状況・関心をCRMへ記録しつつ、直営事業「アシスタ大垣」の実務ノウハウと商談・資料URLを案内します。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPatternB(!isEditingPatternB)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                      isEditingPatternB
                        ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        : 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingPatternB ? 'パターンB編集を閉じる' : '✍️ パターンBを編集'}</span>
                  </button>
                </div>

                {/* Q1 / Q2 / 完了タブ切り替え */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-sky-200 w-fit text-xs">
                  <button
                    type="button"
                    onClick={() => setPatternBEditTab('q1')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      patternBEditTab === 'q1' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ① Q1 現在の状況
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatternBEditTab('q2')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      patternBEditTab === 'q2' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ② Q2 関心テーマ
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatternBEditTab('completion')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      patternBEditTab === 'completion' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ③ 完了カード＆商談導線
                  </button>
                </div>

                {isEditingPatternB ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-sky-200/70">
                    <div className="lg:col-span-7 space-y-3 text-xs">
                      {patternBEditTab === 'q1' && (
                        <>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Q1 カード見出し</label>
                            <input
                              type="text"
                              value={patternBConfig.q1.title}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  q1: { ...prev.q1, title: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              Q1 挨拶・導入文（<code className="text-sky-700">{'{recipient_name}'}</code> 差し込み可）
                            </label>
                            <textarea
                              rows={3}
                              value={patternBConfig.q1.greeting}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  q1: { ...prev.q1, greeting: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 leading-relaxed focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Q1 質問見出し</label>
                            <input
                              type="text"
                              value={patternBConfig.q1.question}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  q1: { ...prev.q1, question: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="font-bold text-slate-700 block">Q1 選択肢ボタン（各20文字以内）</label>
                            {patternBConfig.q1.choices.map((c, idx) => (
                              <div key={c.value} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                                      <span className="text-slate-500 font-medium">ボタン表示文字</span>
                                      <span className={`font-mono ${c.label.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                        {c.label.length}/20
                                      </span>
                                    </div>
                                    <input
                                      type="text"
                                      maxLength={20}
                                      value={c.label}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setPatternBConfig((prev) => ({
                                          ...prev,
                                          q1: {
                                            ...prev.q1,
                                            choices: prev.q1.choices.map((item, i) => (i === idx ? { ...item, label: val } : item)),
                                          },
                                        }));
                                      }}
                                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-slate-500 font-medium text-[11px] block mb-0.5">顧客側送信テキスト</span>
                                    <input
                                      type="text"
                                      value={c.displayText}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setPatternBConfig((prev) => ({
                                          ...prev,
                                          q1: {
                                            ...prev.q1,
                                            choices: prev.q1.choices.map((item, i) => (i === idx ? { ...item, displayText: val } : item)),
                                          },
                                        }));
                                      }}
                                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-slate-500">色:</span>
                                  {['#0284C7', '#1E3A5F', '#10B981', '#8B5CF6'].map((col) => (
                                    <button
                                      key={col}
                                      type="button"
                                      onClick={() =>
                                        setPatternBConfig((prev) => ({
                                          ...prev,
                                          q1: {
                                            ...prev.q1,
                                            choices: prev.q1.choices.map((item, i) => (i === idx ? { ...item, color: col } : item)),
                                          },
                                        }))
                                      }
                                      style={{ backgroundColor: col }}
                                      className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                                        c.color === col ? 'border-slate-900 scale-110' : 'border-transparent opacity-65'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {patternBEditTab === 'q2' && (
                        <>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Q2 カード見出し</label>
                            <input
                              type="text"
                              value={patternBConfig.q2.title}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  q2: { ...prev.q2, title: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              Q2 案内文（<code className="text-sky-700">{'{q1_label}'}</code> にQ1の回答が入ります）
                            </label>
                            <textarea
                              rows={3}
                              value={patternBConfig.q2.introTemplate}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  q2: { ...prev.q2, introTemplate: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 leading-relaxed focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="font-bold text-slate-700 block">Q2 テーマ選択肢（各20文字以内）</label>
                            {patternBConfig.q2.choices.map((c, idx) => (
                              <div key={c.value} className="p-2.5 bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                                    <span className="text-slate-500 font-medium">ボタン表示文字</span>
                                    <span className={`font-mono ${c.label.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                      {c.label.length}/20
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    maxLength={20}
                                    value={c.label}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPatternBConfig((prev) => ({
                                        ...prev,
                                        q2: {
                                          ...prev.q2,
                                          choices: prev.q2.choices.map((item, i) => (i === idx ? { ...item, label: val } : item)),
                                        },
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                                  />
                                </div>
                                <div>
                                  <span className="text-slate-500 font-medium text-[11px] block mb-0.5">顧客側送信テキスト</span>
                                  <input
                                    type="text"
                                    value={c.displayText}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPatternBConfig((prev) => ({
                                        ...prev,
                                        q2: {
                                          ...prev.q2,
                                          choices: prev.q2.choices.map((item, i) => (i === idx ? { ...item, displayText: val } : item)),
                                        },
                                      }));
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {patternBEditTab === 'completion' && (
                        <>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">完了カード見出し</label>
                            <input
                              type="text"
                              value={patternBConfig.completion.title}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  completion: { ...prev.completion, title: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">完了時の挨拶文</label>
                            <textarea
                              rows={2}
                              value={patternBConfig.completion.greeting}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  completion: { ...prev.completion, greeting: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">アドバイス・今後の案内文</label>
                            <textarea
                              rows={3}
                              value={patternBConfig.completion.body}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  completion: { ...prev.completion, body: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 leading-relaxed focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[11px] mb-0.5">
                                  <span className="font-bold text-slate-700">資料PDFボタン文言</span>
                                  <span className={`font-mono ${patternBConfig.completion.pdfButtonLabel.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                    {patternBConfig.completion.pdfButtonLabel.length}/20
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  maxLength={20}
                                  value={patternBConfig.completion.pdfButtonLabel}
                                  onChange={(e) =>
                                    setPatternBConfig((prev) => ({
                                      ...prev,
                                      completion: { ...prev.completion, pdfButtonLabel: e.target.value },
                                    }))
                                  }
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-700 text-[11px] block mb-0.5">資料PDF URL（空欄時は既定URL）</span>
                                <input
                                  type="url"
                                  value={patternBConfig.completion.pdfButtonUrl}
                                  onChange={(e) =>
                                    setPatternBConfig((prev) => ({
                                      ...prev,
                                      completion: { ...prev.completion, pdfButtonUrl: e.target.value },
                                    }))
                                  }
                                  placeholder="https://assist-care.jp"
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-[11px] mb-0.5">
                                <span className="font-bold text-slate-700">商談予約ボタン文言（{`{booking_url}`} へリンク）</span>
                                <span className={`font-mono ${patternBConfig.completion.bookingButtonLabel.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                  {patternBConfig.completion.bookingButtonLabel.length}/20
                                </span>
                              </div>
                              <input
                                type="text"
                                maxLength={20}
                                value={patternBConfig.completion.bookingButtonLabel}
                                onChange={(e) =>
                                  setPatternBConfig((prev) => ({
                                    ...prev,
                                    completion: { ...prev.completion, bookingButtonLabel: e.target.value },
                                  }))
                                }
                                placeholder="例: 🗓️ 30分無料開業相談を予約"
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-900"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setPatternBConfig(DEFAULT_WELCOME_PATTERN_B)}
                          className="text-slate-500 hover:text-slate-800 underline cursor-pointer text-[11px]"
                        >
                          初期テンプレートに戻す
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingPatternB(false)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            disabled={welcomeSaving}
                            onClick={() => void handleSaveWelcome('パターンB（介護保険外開業 2問ヒアリング）の設定を保存しました！')}
                            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{welcomeSaving ? '保存中…' : '保存してLINEに反映'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <div className="w-full max-w-sm">
                        <LineMessagePreview
                          type="flex"
                          payload={{
                            altText: `【介護保険外開業】${patternBEditTab.toUpperCase()}`,
                            contents: buildPatternBFlexBubble(patternBConfig, patternBEditTab),
                          }}
                          title={`パターンB (${patternBEditTab === 'q1' ? 'Q1' : patternBEditTab === 'q2' ? 'Q2' : '完了カード'}) プレビュー`}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">
                          {patternBEditTab === 'q1' ? patternBConfig.q1.title : patternBEditTab === 'q2' ? patternBConfig.q2.title : patternBConfig.completion.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold">
                          タグ「介護保険外開業」＆ リード自動登録
                        </span>
                      </div>
                      {patternBEditTab === 'q1' && (
                        <div className="space-y-1.5 text-slate-600">
                          <p className="font-medium text-slate-800">{patternBConfig.q1.question}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {patternBConfig.q1.choices.map((c) => (
                              <span key={c.value} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                {c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {patternBEditTab === 'q2' && (
                        <div className="space-y-1.5 text-slate-600">
                          <p className="whitespace-pre-line">{patternBConfig.q2.introTemplate}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {patternBConfig.q2.choices.map((c) => (
                              <span key={c.value} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                {c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {patternBEditTab === 'completion' && (
                        <div className="space-y-1.5 text-slate-600">
                          <p className="line-clamp-2">{patternBConfig.completion.body}</p>
                          <div className="flex flex-wrap gap-2 text-[11px] text-sky-700 font-medium">
                            {patternBConfig.completion.pdfButtonLabel && <span>資料: 「{patternBConfig.completion.pdfButtonLabel}」</span>}
                            {patternBConfig.completion.bookingButtonLabel && <span>商談予約: 「{patternBConfig.completion.bookingButtonLabel}」</span>}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="lg:col-span-5">
                      <LineMessagePreview
                        type="flex"
                        payload={{
                          altText: `【介護保険外開業】${patternBEditTab.toUpperCase()}`,
                          contents: buildPatternBFlexBubble(patternBConfig, patternBEditTab),
                        }}
                        title={`パターンB 実機イメージ (${patternBEditTab === 'q1' ? 'Q1' : patternBEditTab === 'q2' ? 'Q2' : '完了カード'})`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* パターンBの後の専門教育・商談案内 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    後続の専門教育・商談案内（お客様から返信・予約があれば自動停止）
                  </span>
                </div>
                {careScenarios.length === 0 ? (
                  <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-500">分岐C（介護開業）の後続シナリオがまだ登録されていません。</p>
                    {onApplyDirectConsultStarterSet && (
                      <button
                        type="button"
                        onClick={onApplyDirectConsultStarterSet}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>介護開業の専門教育・商談案内を反映する</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {careScenarios.map((scenario, index) => (
                      <div
                        key={scenario.id}
                        className="bg-slate-50/60 border border-slate-200 hover:border-sky-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-sky-300">
                            {index + 1}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                                {scenario.waitMinutes === 0 ? '即時実行' : `${Math.round(scenario.waitMinutes / 1440)}日後`}
                              </span>
                              {scenario.trigger === 'tag_added' && scenario.targetTag && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  タグ: {scenario.targetTag}
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                                {scenario.channel === 'line' ? 'LINE' : scenario.channel === 'email' ? 'メール' : 'LINE+メール'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {scenario.flexTitle || scenario.messageBody || scenario.emailSubject || '文面未設定'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              scenario.automationEnabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {scenario.automationEnabled ? (
                              <>
                                <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                                <span>自動実行中</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 text-slate-400" />
                                <span>一時停止中</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewModalScenario(scenario)}
                            className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer shadow-2xs"
                            title="文面プレビュー"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenInspector(scenario)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
                            <span>点検・編集</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 共通教育トラック: 📖 大橋ストーリー型 7話ナーチャリング（2日後〜 → 商談案内） */}
          {(expandedBranch === 'all' || expandedBranch === 'nurturing') && (
            <div className="bg-white border border-indigo-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-xl bg-indigo-100 text-indigo-800 border border-indigo-300">
                    <BookOpen className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      共通教育: 📖 大橋ストーリー型 7話ナーチャリング → 最終ゴール（商談案内）
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold">
                        2日後から自動教育・初日重複なし
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      友だち追加の【2日後】から3日おきに創業実話・改善事例を配信し、最終的に30分個別相談（{`{booking_url}`}）へつなげます。途中でLINE返信・診断回答・予約が入ると自動停止します。
                    </p>
                  </div>
                </div>

                {onApplyLineNurturingStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyLineNurturingStarterSet}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>共通教育7話を最新化</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7].map((stepNum) => {
                  const tpl = getNurturingStepTemplate(stepNum);
                  const waitDaysNum = (stepNum - 1) * 3 + 2;
                  const waitDays = `${waitDaysNum}日後`;
                  const matchedScenario = nurturingScenarios.find(s => s.name.includes(`第${stepNum}話`) || s.name.includes(String(stepNum)));

                  return (
                    <div
                      key={stepNum}
                      className="bg-slate-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl p-4 space-y-2.5 transition shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {stepNum}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold font-mono">
                                第{stepNum}話 ({waitDays}{(matchedScenario?.preferredSendTime ?? '10:00') ? ` · ${matchedScenario?.preferredSendTime || '10:00'}頃` : ''})
                              </span>
                              <span className="font-bold text-slate-900 text-sm">
                                {matchedScenario?.name || tpl.name}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              件名: {matchedScenario?.emailSubject || tpl.emailSubject}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {matchedScenario && (
                            <button
                              type="button"
                              onClick={() => toggleScenarioAutomation(matchedScenario.id, Boolean(matchedScenario.automationEnabled))}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                matchedScenario.automationEnabled
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {matchedScenario.automationEnabled ? <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" /> : <Pause className="w-3 h-3 text-slate-500" />}
                              <span>{matchedScenario.automationEnabled ? '自動実行中' : '一時停止中'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalScenario({
                                name: matchedScenario?.name || tpl.name,
                                emailSubject: matchedScenario?.emailSubject || tpl.emailSubject,
                                emailBody: matchedScenario?.emailBody || tpl.emailBody,
                                messageBody: matchedScenario?.messageBody || tpl.lineBody,
                              });
                            }}
                            className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer shadow-2xs"
                            title="文面プレビュー"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const target = matchedScenario || {
                                id: `story-${stepNum}`,
                                name: tpl.name,
                                trigger: 'line_registered' as const,
                                channel: 'both' as const,
                                audience: 'すべての見込み客',
                                waitMinutes: waitDaysNum * 1440,
                                emailSubject: tpl.emailSubject,
                                emailBody: tpl.emailBody,
                                messageBody: tpl.lineBody,
                                lineMessageType: 'text' as const,
                                lineImageUrl: '',
                                linePreviewImageUrl: '',
                                flexAltText: '',
                                flexTitle: '',
                                flexBody: '',
                                flexButtonLabel: '',
                                flexButtonUrl: '',
                                status: 'draft' as const,
                                automationEnabled: false,
                                stopOnBooking: true,
                                stopOnDeal: true,
                                consentBasis: 'LINE友だち登録時の同意に基づく',
                                updatedAt: Date.now(),
                              };
                              handleOpenInspector(target);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                            <span>点検・編集</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* トラック 2: ✉️ 営業メール（未接触見込み企業 5段階アウトバウンド）    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'flow' && activeTrack === 'sales_outreach' && (
        <div className="space-y-6 animate-fade-in">
          {/* トリガー仕様 ＆ 安全ストッパー詳細カード */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-100 text-blue-800 border border-blue-300">
                    <Mail className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      営業メール（全5段階アプローチ）トリガー仕様 ＆ タイムライン設計
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      未接触の見込み企業リストに対して、業界別の課題と仕組み化事例を自動で差し込み順次配信します。
                    </p>
                  </div>
                </div>
              </div>

              {onApplyOutreachStarterSet && (
                <button
                  type="button"
                  onClick={onApplyOutreachStarterSet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>営業メール5段階を最新化</span>
                </button>
              )}
            </div>

            {/* トリガー ＆ 停止条件の3大要素 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-blue-600" />
                  <span>① 開始トリガー（Trigger）</span>
                </div>
                <div className="text-slate-900 font-bold">
                  見込み客登録時（lead_created）
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  CRMに新しい見込み企業が登録された時点、または営業対象リストに追加された時点で第1通の配信ジョブが自動作成されます。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>② 配信スケジュール（3日おき）</span>
                </div>
                <div className="text-slate-900 font-bold">
                  0日後 ➜ 3日後 ➜ 6日後 ➜ 9日後 ➜ 12日後
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  送信可能時間帯（09:00〜20:00）を厳守し、相手が負担に感じない間隔で自然に信頼と診断動機を高めます。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                  <span>③ 自動停止ストッパー（Stop Condition）</span>
                </div>
                <div className="text-slate-900 font-bold">
                  面談予約・商談化・返信で即停止
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  相手が30分相談を予約した瞬間、または返信した瞬間に後続メールは自動キャンセルされ、重複連絡を完全に防ぎます。
                </p>
              </div>
            </div>

            {/* 18業種別シミュレーション */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    業種別メッセージ自動差し替えシミュレーター（重点5業種＋その他）:
                  </span>
                </div>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <optgroup label="★ 重点5業種（公式HPの主な支援対象）">
                    {PRIORITY_INDUSTRY_KEYS.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </optgroup>
                  <optgroup label="その他の業種">
                    {Object.keys(INDUSTRY_MESSAGES)
                      .filter((ind) => !(PRIORITY_INDUSTRY_KEYS as readonly string[]).includes(ind))
                      .map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1 shadow-2xs">
                  <span className="text-rose-700 font-bold block">
                    【第1通に自動挿入】{selectedIndustry} の急所・課題
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {getIndustryMessage(selectedIndustry, 'problem')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1 shadow-2xs">
                  <span className="text-emerald-700 font-bold block">
                    【第3通に自動挿入】{selectedIndustry} の導入変革メリット
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {getIndustryMessage(selectedIndustry, 'benefit')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 別枠: 一発直球提案（社外右腕）テンプレート編集スロット */}
          {(() => {
            const sampleDraft = resolveOneShotOutreachDraft(
              oneShotScenario,
              'サンプル株式会社',
              '山田 太郎',
              selectedIndustry,
              'https://corp.mstcorp.info/diagnosis'
            );
            const rawDefault = getOneShotOutreachTemplate('{company_name}', '{recipient_name}', undefined, '{link_url}');
            const isCustomized = Boolean(oneShotScenario);
            return (
              <div className="bg-white border border-purple-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs flex items-center justify-center shrink-0">
                      単発
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                          別枠 · 一発直球提案メール
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {isCustomized ? 'カスタム文面を保存済み' : '標準テンプレート使用中'}
                        </span>
                        <span className="text-xs text-slate-600 font-medium">
                          件名: {sampleDraft.subject}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {ONE_SHOT_SCENARIO_NAME}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        見込み企業リストからの「一発提案（社外右腕）」一括・個別発火および送信ドロワーで使用されます（署名・配信停止リンクは送信時に自動付与）。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                    {isCustomized && (
                      <button
                        type="button"
                        onClick={() => handleDeleteInspectorScenario(oneShotScenario!.id)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        title="カスタム編集を解除して初期の標準テンプレートに戻します"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span>標準に戻す</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewModalScenario({
                          name: ONE_SHOT_SCENARIO_NAME,
                          emailSubject: sampleDraft.subject,
                          emailBody: sampleDraft.body,
                        });
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 text-purple-600" />
                      <span>全文プレビュー</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target: MarketingScenario = oneShotScenario || {
                          id: ONE_SHOT_SCENARIO_ID,
                          name: ONE_SHOT_SCENARIO_NAME,
                          trigger: 'manual',
                          channel: 'email',
                          audience: '未接触の見込み企業（一発直球提案）',
                          waitMinutes: 0,
                          emailSubject: rawDefault.subject,
                          emailBody: rawDefault.body,
                          messageBody: '',
                          lineMessageType: 'text',
                          lineImageUrl: '',
                          linePreviewImageUrl: '',
                          flexAltText: '',
                          flexTitle: '',
                          flexBody: '',
                          flexButtonLabel: '',
                          flexButtonUrl: '',
                          status: 'prepared',
                          automationEnabled: false,
                          sendTimeWindow: '09:00-18:00',
                          preferredSendTime: '',
                          stopOnBooking: true,
                          stopOnDeal: true,
                          consentBasis: '特定電子メール法に基づく業務改善情報の提供（オプトアウト明記）',
                          updatedAt: Date.now(),
                        };
                        handleOpenInspector(target);
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-purple-100" />
                      <span>テンプレート編集</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 max-h-24 overflow-hidden relative">
                  <pre className="whitespace-pre-wrap">{sampleDraft.body}</pre>
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
                </div>
              </div>
            );
          })()}

          {/* 5ステップのタイムラインカード */}
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const draft = getSalesEmailTemplate(stepNum, 'サンプル株式会社', '山田 太郎', selectedIndustry, 'https://corp.mstcorp.info/diagnosis');
              const waitDays = stepNum === 1 ? '0日目（即時 / 待機: 0分）' : `${(stepNum - 1) * 3}日後（待機: ${(stepNum - 1) * 3 * 1440}分）`;
              const matchedScenario = outreachScenarios.find(s => s.id !== ONE_SHOT_SCENARIO_ID && !s.name.includes('一発直球') && s.name.includes(String(stepNum)));

              return (
                <div
                  key={stepNum}
                  className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 shadow-xs space-y-3 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-bold text-sm flex items-center justify-center shrink-0">
                        {stepNum}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                            第{stepNum}通 ({waitDays}{stepNum > 1 && (matchedScenario?.preferredSendTime ?? '10:00') ? ` · ${matchedScenario?.preferredSendTime || '10:00'}頃` : ''})
                          </span>
                          <span className="text-xs text-slate-600 font-medium">
                            件名: {draft.subject}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">
                          {draft.name}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {matchedScenario && (
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(matchedScenario.id, Boolean(matchedScenario.automationEnabled))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            matchedScenario.automationEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {matchedScenario.automationEnabled ? <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" /> : <Pause className="w-3 h-3 text-slate-500" />}
                          <span>{matchedScenario.automationEnabled ? '稼働中' : '停止中'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setPreviewModalScenario({
                            name: draft.name,
                            emailSubject: draft.subject,
                            emailBody: draft.body,
                          });
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>全文プレビュー</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const target = matchedScenario || {
                            id: `outreach-${stepNum}`,
                            name: draft.name,
                            trigger: 'lead_created' as const,
                            channel: 'email' as const,
                            audience: '未接触の見込み企業',
                            waitMinutes: (stepNum - 1) * 3 * 1440,
                            emailSubject: draft.subject,
                            emailBody: draft.body,
                            messageBody: '',
                            lineMessageType: 'text' as const,
                            lineImageUrl: '',
                            linePreviewImageUrl: '',
                            flexAltText: '',
                            flexTitle: '',
                            flexBody: '',
                            flexButtonLabel: '',
                            flexButtonUrl: '',
                            status: 'draft' as const,
                            automationEnabled: false,
                            stopOnBooking: true,
                            stopOnDeal: true,
                            consentBasis: '特定電子メール法に基づく業務改善情報の提供',
                            updatedAt: Date.now(),
                          };
                          handleOpenInspector(target);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                        <span>点検・編集</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 max-h-24 overflow-hidden relative">
                    <pre className="whitespace-pre-wrap">{draft.body}</pre>
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* キーワード追加・編集モーダル */}
      {isEditingKeywordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingRule ? 'キーワード自動応答を編集' : '新しいキーワード自動応答を追加'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingKeywordModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKeywordRule} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">管理名称</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="例: 「診断」送信時"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">反応キーワード *</label>
                  <input
                    type="text"
                    required
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    placeholder="例: 診断"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">マッチ方式</label>
                  <select
                    value={ruleMode}
                    onChange={(e) => setRuleMode(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="contains">部分一致（含むとき）</option>
                    <option value="exact">完全一致（一致のみ）</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">自動返信するメッセージ文面 *</label>
                <textarea
                  rows={4}
                  required
                  value={ruleReply}
                  onChange={(e) => setRuleReply(e.target.value)}
                  placeholder="返信する文章を入力してください。{link_url} や {booking_url} が利用できます。"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono leading-relaxed focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">自動付与するタグ</label>
                  <input
                    type="text"
                    value={ruleTag}
                    onChange={(e) => setRuleTag(e.target.value)}
                    placeholder="例: 選択:診断"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-emerald-700 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">連動する導線分岐</label>
                  <select
                    value={ruleTargetBranch}
                    onChange={(e) => setRuleTargetBranch(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="diagnosis">A: 3分無料経営診断</option>
                    <option value="consult">B: 経営個別相談</option>
                    <option value="care">C: 介護開業パッケージ</option>
                    <option value="general">一般問い合わせ</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingKeywordModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold cursor-pointer transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 文面プレビューモーダル */}
      {previewModalScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {previewModalScenario.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalScenario(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              {previewModalScenario.emailSubject && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1 font-sans font-medium">件名:</span>
                  <p className="text-slate-900 font-bold">{previewModalScenario.emailSubject}</p>
                </div>
              )}

              {previewModalScenario.emailBody && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1 font-sans font-medium">メール本文:</span>
                  <pre className="text-slate-800 whitespace-pre-wrap leading-relaxed font-mono">
                    {previewModalScenario.emailBody}
                  </pre>
                </div>
              )}

              {previewModalScenario.messageBody && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1 font-sans font-medium">LINEメッセージ本文:</span>
                  <pre className="text-slate-800 whitespace-pre-wrap leading-relaxed font-mono">
                    {previewModalScenario.messageBody}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalScenario(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 詳細インスペクターモーダル */}
      {inspectorScenario && (
        <FlowStepInspectorModal
          isOpen={isInspectorOpen}
          onClose={() => {
            setIsInspectorOpen(false);
            setInspectorScenario(null);
          }}
          scenario={inspectorScenario}
          onSave={handleSaveInspectorScenario}
          onDelete={handleDeleteInspectorScenario}
          allScenarios={scenarios}
        />
      )}
    </div>
  );
};
