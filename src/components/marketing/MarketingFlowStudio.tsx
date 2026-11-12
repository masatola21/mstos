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
  LayoutTemplate
} from 'lucide-react';
import { MarketingScenario, MarketingTrigger, MarketingChannel } from '../../types/marketing';
import {
  INDUSTRY_MESSAGES,
  PRIORITY_INDUSTRY_KEYS,
  getSalesEmailTemplate,
  getIndustryMessage,
  getNurturingStepTemplate
} from '../../utils/salesOutreachTemplates';
import { LineMessagePreview } from '../LineMessagePreview';
import { renderPlaceholders, PLACEHOLDER_SAMPLE_VALUES } from '../../utils/placeholders';
import { DEFAULT_WELCOME_CHOICES, WelcomeChoice } from './MarketingLineSettingsView';
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

const DEFAULT_KEYWORD_RULES: KeywordAutoReply[] = [
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
    tag: 'care:開業相談',
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
  const [expandedBranch, setExpandedBranch] = useState<'diagnosis' | 'consult' | 'care' | 'all'>('all');
  const [previewModalScenario, setPreviewModalScenario] = useState<ScenarioPreviewInfo | null>(null);

  // ─── LINEウェルカム設定用状態（単一の正本 / Single source of truth） ───
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
    { id: 'consult', label: '🗓️ 経営改善について個別相談する', tag: '選択:個別相談', route: 'booking', actionType: 'postback', color: '#1E3A5F' },
    { id: 'care', label: '🌿 介護保険外サービス開業を知る', tag: 'care:開業相談', route: 'template', actionType: 'postback', color: '#0284C7' },
  ]);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeRuleId, setWelcomeRuleId] = useState<string | null>(null);
  const [isEditingWelcome, setIsEditingWelcome] = useState(false);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeNotice, setWelcomeNotice] = useState('');
  
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
            uri: c.uri || 'https://corp.mstcorp.info',
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

    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'lg',
        contents: [
          { type: 'text', text: heading, size: 'xl', weight: 'bold', align: 'center', color: '#1E293B', wrap: true },
          { type: 'text', text: subheading, size: 'md', align: 'center', color: '#334155', margin: 'sm', wrap: true },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: intro, size: 'sm', align: 'center', color: '#475569', margin: 'lg', wrap: true },
          { type: 'text', text: question, size: 'lg', weight: 'bold', align: 'center', color: '#1E293B', margin: 'xl', wrap: true },
          { type: 'text', text: instruction, size: 'sm', align: 'center', color: '#64748B', margin: 'sm', wrap: true },
          ...buttons,
        ],
      },
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

  // Supabase line_auto_reply_rules からウェルカム設定をロード
  useEffect(() => {
    if (!db) return;
    const loadWelcome = async () => {
      try {
        const { data: sessionData } = await db.auth.getSession();
        const ownerId = sessionData.session?.user?.id;
        if (!ownerId) return;

        const { data, error } = await db
          .from('line_auto_reply_rules')
          .select('id, reply_type, reply_payload, reply_text, enabled')
          .eq('owner_id', ownerId)
          .eq('match_text', '__welcome__')
          .maybeSingle();

        if (!error && data) {
          setWelcomeRuleId(data.id);
          setWelcomeEnabled(data.enabled ?? true);
          let payload = data.reply_payload as any;
          if (!payload && data.reply_text) {
            try {
              payload = JSON.parse(data.reply_text);
            } catch {
              // ignore
            }
          }
          if (payload) {
            if (payload.contents) {
              setCustomFlexJson(JSON.stringify(payload.contents, null, 2));
            }
            const bodyContents = payload?.contents?.body?.contents;
            if (Array.isArray(bodyContents)) {
              if (bodyContents[0]?.text) setWelcomeHeading(bodyContents[0].text);
              if (bodyContents[1]?.text) setWelcomeSubheading(bodyContents[1].text);
              if (bodyContents[3]?.text) setWelcomeIntro(bodyContents[3].text);
              if (bodyContents[4]?.text) setWelcomeQuestion(bodyContents[4].text);
              if (bodyContents[5]?.text) setWelcomeInstruction(bodyContents[5].text);
            }
            if (Array.isArray(payload.choices) && payload.choices.length > 0) {
              setWelcomeChoices(payload.choices);
            }
          }
        }
      } catch (e) {
        console.warn('Welcome load error in FlowStudio:', e);
      }
    };
    void loadWelcome();
  }, [db]);

  // ウェルカムメッセージの保存
  const handleSaveWelcome = async () => {
    if (!db) return;
    setWelcomeSaving(true);
    setWelcomeNotice('');
    try {
      const { data: sessionData } = await db.auth.getSession();
      const ownerId = sessionData.session?.user?.id;
      if (!ownerId) throw new Error('ログインセッションが見つかりません');

      let finalContents: any;
      if (flexEditMode === 'json' && customFlexJson.trim()) {
        try {
          finalContents = JSON.parse(customFlexJson);
        } catch (jsonErr: any) {
          throw new Error('Flex JSONの構文エラーです。正しいJSONを入力してください: ' + (jsonErr?.message || ''));
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

      const payload = {
        altText: `${welcomeHeading} ${welcomeSubheading}`,
        contents: finalContents,
        choices: welcomeChoices,
      };

      const rowData = {
        owner_id: ownerId,
        name: '友だち追加ウェルカムFlexメッセージ',
        match_mode: 'exact',
        match_text: '__welcome__',
        reply_type: 'flex',
        reply_text: `${welcomeHeading} ${welcomeSubheading}`,
        reply_payload: payload,
        enabled: welcomeEnabled,
        priority: 0,
        updated_at: new Date().toISOString(),
      };

      const { data: upserted, error } = await db
        .from('line_auto_reply_rules')
        .upsert(
          (welcomeRuleId ? { id: welcomeRuleId, ...rowData } : rowData) as any,
          { onConflict: 'owner_id,match_text' }
        )
        .select('id')
        .single();

      if (!error && upserted) {
        setWelcomeRuleId(upserted.id);
      }

      setWelcomeNotice('友だち追加ウェルカムFlexメッセージを保存しました！LINE公式アカウントへ即時反映されます。');
      setIsEditingWelcome(false);
      setTimeout(() => setWelcomeNotice(''), 5000);
    } catch (err: any) {
      setWelcomeNotice(`保存エラー: ${err?.message || '不明なエラー'}`);
    } finally {
      setWelcomeSaving(false);
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
          await db.from('line_auto_reply_rules').upsert({
            id: newRule.id.startsWith('kw-') ? undefined : newRule.id,
            owner_id: ownerId,
            name: newRule.name,
            match_mode: newRule.matchMode,
            match_text: newRule.matchText,
            reply_text: newRule.replyText,
            tag_id: newRule.tag || null,
            enabled: newRule.enabled,
            priority: 100,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Supabase rule save warning:', err);
      }
    }

    setKeywordNotice(`キーワード自動応答「${newRule.matchText}」を保存しました。`);
    setTimeout(() => setKeywordNotice(''), 4000);
    setIsEditingKeywordModal(false);
    setEditingRule(null);
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
    const nextRules = keywordRules.map(r => {
      if (r.id === ruleId) {
        const toggled = !r.enabled;
        if (db && !ruleId.startsWith('kw-')) {
          void db.from('line_auto_reply_rules').update({ enabled: toggled }).eq('id', ruleId);
        }
        return { ...r, enabled: toggled };
      }
      return r;
    });
    setKeywordRules(nextRules);
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

  // シナリオの分類
  const diagnosisScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('診断') ||
      s.trigger.startsWith('diagnosis_') ||
      s.trigger.startsWith('report_') ||
      s.name.includes('【1. 初回') ||
      s.name.includes('【2. 診断') ||
      s.name.includes('【3. レポート') ||
      s.name.includes('【4. 3日') ||
      s.name.includes('【5. 7日')
    );
  }, [scenarios]);

  const consultScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('直相談') ||
      s.name.includes('個別相談') ||
      s.name.includes('面談') ||
      s.trigger.includes('booking') ||
      s.trigger.includes('meeting')
    );
  }, [scenarios]);

  const careScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('介護') ||
      s.name.includes('保険外') ||
      s.name.includes('開業')
    );
  }, [scenarios]);

  const outreachScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('営業メール') ||
      s.name.includes('【営業') ||
      (s.channel === 'email' && s.trigger === 'lead_created')
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

  // 新規ステップ作成（現在開いているトラックに合わせて初期設定）
  const handleCreateNewStep = () => {
    const isOutreach = activeTrack === 'sales_outreach';
    const isStory = activeTrack === 'story_nurturing';
    const isConsult = activeTrack === 'direct_consult';

    const defaultChannel: MarketingChannel = isOutreach ? 'email' : isStory ? 'both' : 'line';
    const defaultTrigger: MarketingTrigger = isOutreach ? 'lead_created' : isConsult ? 'booking_created' : 'line_registered';
    const defaultName = isOutreach
      ? '【営業メール】業務改善・仕組み化のご案内'
      : isStory
      ? '【ナーチャリング】ストーリー配信'
      : isConsult
      ? '【直相談】個別面談フォロー案内'
      : '【LINE】フォロー配信ステップ';

    const newStep: MarketingScenario = {
      id: `step-${Date.now()}`,
      name: defaultName,
      trigger: defaultTrigger,
      channel: defaultChannel,
      audience: isOutreach ? '未接触の見込み企業' : 'すべての見込み客',
      waitMinutes: 0,
      emailSubject: isOutreach || isStory ? '【有限会社MST】業務改善・仕組み化のご案内' : '',
      emailBody: isOutreach || isStory ? '{recipient_name} 様\n\n有限会社MSTの大橋です。\n本メールでは業務改革と利益改善の最新事例をご案内いたします。' : '',
      messageBody: !isOutreach ? '{recipient_name} 様\nご案内をお届けいたします。\n\n▼詳細はこちら\n{link_url}' : '',
      lineMessageType: 'flex',
      lineImageUrl: '',
      linePreviewImageUrl: '',
      flexAltText: '【ご案内】業務改善ロードマップ',
      flexTitle: '新しいご案内',
      flexBody: '{recipient_name} 様\nご案内をお届けいたします。',
      flexButtonLabel: '詳細を見る',
      flexButtonUrl: '{link_url}',
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
      {welcomeNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center justify-between animate-fade-in">
          <span>{welcomeNotice}</span>
          <button type="button" onClick={() => setWelcomeNotice('')} className="text-emerald-400 font-bold px-1">✕</button>
        </div>
      )}

      {keywordNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center justify-between animate-fade-in">
          <span>{keywordNotice}</span>
          <button type="button" onClick={() => setKeywordNotice('')} className="text-emerald-400 font-bold px-1">✕</button>
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
              目的別シナリオ（LINE導線・営業メール・ストーリー型・直相談）を即時切り替え＆編集。面談予約や返信が入った瞬間に自動停止し、安全に個別有人チャットへ移行します。
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
                        <span>全18本の公式プリセットを最新化</span>
                      </button>
                    )}
                    {onApplyDiagnosisStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyDiagnosisStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer text-left"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>診断フォロー5本を適用</span>
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
                  現在シナリオが登録されていません。公式スターターセット（3分無料診断フォロー、営業メール5段階、ストーリー型育成など）を適用して初期設定を完了するか、新規ステップを作成してください。
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
                    <span>全18本公式プリセットを一括適用</span>
                  </button>
                )}
                {onApplyDiagnosisStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDiagnosisStarterSet}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-200" />
                    <span>診断リマインド5本</span>
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

        {/* 下段: 目的別 導線トラック切り替えリッチタブ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* ① 診断フォロー */}
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
                ① 診断フォロー
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTrack === 'line_welcome' && viewMode === 'flow' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {diagnosisScenarios.length}件・Flex
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              LINE登録→診断→レポート→面談誘導
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
                ② 営業メール
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTrack === 'sales_outreach' && viewMode === 'flow' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                {outreachScenarios.length}ステップ
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              業界急所提起→仕組み化事例→3分診断
            </div>
          </button>

          {/* ③ ストーリー型 */}
          <button
            type="button"
            onClick={() => { setActiveTrack('story_nurturing'); setViewMode('flow'); }}
            className={`group flex flex-col justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'story_nurturing' && viewMode === 'flow'
                ? 'bg-purple-50 border-purple-500 shadow-xs ring-1 ring-purple-400'
                : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'story_nurturing' && viewMode === 'flow' ? 'text-purple-900' : 'text-slate-800'}`}>
                <BookOpen className={`w-3.5 h-3.5 ${activeTrack === 'story_nurturing' && viewMode === 'flow' ? 'text-purple-600' : 'text-slate-400 group-hover:text-purple-600'}`} />
                ③ ストーリー型
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTrack === 'story_nurturing' && viewMode === 'flow' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}`}>
                {nurturingScenarios.length}話
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              大橋真人実話・LINE+メルマガ共感重視
            </div>
          </button>

          {/* ④ 直相談 */}
          <button
            type="button"
            onClick={() => { setActiveTrack('direct_consult'); setViewMode('flow'); }}
            className={`group flex flex-col justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'direct_consult' && viewMode === 'flow'
                ? 'bg-sky-50 border-sky-500 shadow-xs ring-1 ring-sky-400'
                : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'direct_consult' && viewMode === 'flow' ? 'text-sky-900' : 'text-slate-800'}`}>
                <Calendar className={`w-3.5 h-3.5 ${activeTrack === 'direct_consult' && viewMode === 'flow' ? 'text-sky-600' : 'text-slate-400 group-hover:text-sky-600'}`} />
                ④ 直相談（面談・介護）
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTrack === 'direct_consult' && viewMode === 'flow' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>
                {consultScenarios.length}件
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              診断不要・即時30分面談案内Flex
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
                全ステップ一覧
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${viewMode === 'table' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}`}>
                {scenarios.length}件
              </span>
            </div>
            <div className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-1.5 line-clamp-1">
              全シナリオの横断検索・一括管理
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      【入口①・統一正本】LINE友だち追加直後（即時送信）
                    </span>
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
                    checked={welcomeEnabled}
                    onChange={(e) => setWelcomeEnabled(e.target.checked)}
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
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    ボタンタップ時の自動分岐・タグ付与仕様
                  </h4>
                  <p className="text-slate-500 leading-relaxed">
                    友だちが各ボタンをタップした瞬間に自動でタグが付与され、それぞれの後続フォローシナリオへ即座に分岐します。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <span className="font-bold block">① 診断ルート</span>
                      <span className="text-[11px] opacity-90">タグ「選択:診断」付与</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800">
                      <span className="font-bold block">② 個別相談ルート</span>
                      <span className="text-[11px] opacity-90">タグ「選択:個別相談」付与</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800">
                      <span className="font-bold block">③ 介護開業ルート</span>
                      <span className="text-[11px] opacity-90">タグ「care:開業相談」付与</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-500 font-medium">表示フィルタ:</span>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    すべての分岐を表示
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('diagnosis')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'diagnosis' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    ① 診断のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('consult')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'consult' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    ② 個別相談のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('care')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'care' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    ③ 介護開業のみ
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

              <div className="flex items-center gap-2">
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                        {rule.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-mono font-medium">
                        「{rule.matchText}」を含む
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 whitespace-pre-line bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs">
                      {rule.replyText}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-100 text-xs">
                    <span className="text-[11px] text-emerald-700 font-mono font-medium">
                      {rule.tag ? `タグ: ${rule.tag}` : 'タグなし'}
                    </span>
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

          {/* 分岐 A: 📊 3分無料経営診断 導線ツリー */}
          {(expandedBranch === 'all' || expandedBranch === 'diagnosis') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                    A
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      分岐 A: 📊 3分無料経営診断・個別面談フォロー（全5ステップ）
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {diagnosisScenarios.length} ステップ登録中
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      診断回答 ──→ 速報分析 ──→ レポート完成送付 ──→ 3日後・7日後の個別作戦会議フォロー
                    </p>
                  </div>
                </div>

                {onApplyDiagnosisStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDiagnosisStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-200" />
                    <span>診断フォロー5本を最新化</span>
                  </button>
                )}
              </div>

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
            </div>
          )}

          {/* 分岐 B: 🗓️ 直相談・個別面談フォロー */}
          {(expandedBranch === 'all' || expandedBranch === 'consult') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-purple-100 text-purple-800 font-bold border border-purple-300">
                    B
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      分岐 B: 🗓️ 直相談・個別面談フォロー（全{consultScenarios.length}ステップ）
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        {consultScenarios.length} ステップ登録中
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      直相談受付 ──→ 日程調整（Google Meet自動発行） ──→ 面談前日リマインド ──→ 面談後次回アクション提案
                    </p>
                  </div>
                </div>

                {onApplyDirectConsultStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDirectConsultStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-purple-200" />
                    <span>直相談フォローを最新化</span>
                  </button>
                )}
              </div>

              {consultScenarios.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-3">
                  <p className="text-xs text-slate-500">直相談・個別面談フォローのシナリオがまだ登録されていません。</p>
                  {onApplyDirectConsultStarterSet && (
                    <button
                      type="button"
                      onClick={onApplyDirectConsultStarterSet}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>直相談（30分無料面談）の標準シナリオを反映する</span>
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
                            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                              {scenario.channel === 'line' ? 'LINE' : scenario.channel === 'email' ? 'メール' : 'LINE+メール'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
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

          {/* 分岐 C: 🌿 介護保険外サービス開業フォロー */}
          {(expandedBranch === 'all' || expandedBranch === 'care') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-sky-100 text-sky-800 font-bold border border-sky-300">
                    C
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      分岐 C: 🌿 介護保険外サービス開業フォロー（全{careScenarios.length}ステップ）
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                        {careScenarios.length} ステップ登録中
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      自費リハビリ・自費看護の実務モデル案内 ──→ 開業パッケージ概要 ──→ 専任相談日程調整
                    </p>
                  </div>
                </div>

                {onApplyDirectConsultStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDirectConsultStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-sky-200" />
                    <span>介護開業フォローを最新化</span>
                  </button>
                )}
              </div>

              {careScenarios.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-3">
                  <p className="text-xs text-slate-500">介護保険外サービス開業フォローのシナリオがまだ登録されていません。</p>
                  {onApplyDirectConsultStarterSet && (
                    <button
                      type="button"
                      onClick={onApplyDirectConsultStarterSet}
                      className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>介護開業パッケージ案内のシナリオを反映する</span>
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
                            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                              {scenario.channel === 'line' ? 'LINE' : scenario.channel === 'email' ? 'メール' : 'LINE+メール'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
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

          {/* 5ステップのタイムラインカード */}
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const draft = getSalesEmailTemplate(stepNum, 'サンプル株式会社', '山田 太郎', selectedIndustry, 'https://corp.mstcorp.info/diagnosis');
              const waitDays = stepNum === 1 ? '0日目（即時 / 待機: 0分）' : `${(stepNum - 1) * 3}日後（待機: ${(stepNum - 1) * 3 * 1440}分）`;
              const matchedScenario = outreachScenarios.find(s => s.name.includes(String(stepNum)));

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
                            第{stepNum}通 ({waitDays})
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* トラック 3: 📖 大橋ストーリー型 7話ナーチャリング（LINE+メルマガ） */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'flow' && activeTrack === 'story_nurturing' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-purple-100 text-purple-800 border border-purple-300">
                  <BookOpen className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    大橋ストーリー型 7話ナーチャリング（LINE ＋ メール両対応）
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    有限会社MST 代表・大橋真人の創業実話と業務改革の軌跡をベースに、共感と信頼を積み上げるストーリー型ステップ配信です。
                  </p>
                </div>
              </div>

              {onApplyLineNurturingStarterSet && (
                <button
                  type="button"
                  onClick={onApplyLineNurturingStarterSet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>ストーリー型7話を最新化</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1">
                <span className="font-bold text-purple-900">① 開始トリガー</span>
                <p className="text-slate-900 font-bold">LINE登録時（line_registered）</p>
                <p className="text-slate-600 text-[11px]">LINE友だち追加、またはメルマガ登録時に即時スタート。</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1">
                <span className="font-bold text-purple-900">② チャネル仕様</span>
                <p className="text-slate-900 font-bold">LINE ＋ メール（両方対応）</p>
                <p className="text-slate-600 text-[11px]">LINEでは読みやすい短文・メールでは詳細な事例長文を自動適応。</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                <span className="font-bold text-emerald-900">③ 停止条件</span>
                <p className="text-slate-900 font-bold">面談予約・診断回答で停止</p>
                <p className="text-slate-600 text-[11px]">途中で診断回答または無料相談予約が入ると自動停止します。</p>
              </div>
            </div>
          </div>

          {/* 7話のカード一覧 */}
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7].map((stepNum) => {
              const tpl = getNurturingStepTemplate(stepNum);
              const waitDays = stepNum === 1 ? '0日目（即時）' : `${(stepNum - 1) * 3}日後`;
              const matchedScenario = nurturingScenarios.find(s => s.name.includes(String(stepNum)));

              return (
                <div
                  key={stepNum}
                  className="bg-white border border-slate-200 hover:border-purple-300 rounded-2xl p-5 shadow-xs space-y-3 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-bold text-sm flex items-center justify-center shrink-0">
                        {stepNum}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                            第{stepNum}話 ({waitDays})
                          </span>
                          <span className="text-xs text-slate-600 font-medium">
                            件名: {tpl.emailSubject}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">
                          {tpl.name}
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
                            name: tpl.name,
                            emailSubject: tpl.emailSubject,
                            emailBody: tpl.emailBody,
                            messageBody: tpl.lineBody,
                          });
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>文面プレビュー</span>
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
                            waitMinutes: (stepNum - 1) * 3 * 1440,
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
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                        <span>点検・編集</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 max-h-24 overflow-hidden relative">
                    <pre className="whitespace-pre-wrap">{tpl.emailBody}</pre>
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* トラック 4: 🌿 直相談（介護開業/経営）                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'flow' && activeTrack === 'direct_consult' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-sky-100 text-sky-800 border border-sky-300">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    【直相談】介護保険外サービス開業・個別経営相談 受付案内
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    診断回答を挟まず、すぐに30分のオンライン個別相談（大橋真人との直接面談）を希望する見込み客向けの即時Flexカードです。
                  </p>
                </div>
              </div>

              {onApplyDirectConsultStarterSet && (
                <button
                  type="button"
                  onClick={onApplyDirectConsultStarterSet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>直相談プリセットを最新化</span>
                </button>
              )}
            </div>

            <div className="p-4 bg-sky-50/70 rounded-xl border border-sky-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-900">
                  即時オンライン相談（30分）予約案内 Flexカード
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 font-bold">
                  タグ「選択:個別相談 / care:開業相談」連動
                </span>
              </div>
              <p className="text-xs text-slate-700">
                面談日程カレンダーURL（{`{booking_url}`}）が自動差し込みされ、相手が日時を選択すると自動でGoogle Meet発行・CRMカレンダーに即時反映されます。
              </p>
            </div>
          </div>

          {/* 直相談シナリオ一覧 & 点検・編集エリア */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>直相談・個別相談 登録シナリオ（{consultScenarios.length}件）</span>
              </h4>
              {onApplyDirectConsultStarterSet && consultScenarios.length === 0 && (
                <button
                  type="button"
                  onClick={onApplyDirectConsultStarterSet}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>公式直相談シナリオを追加</span>
                </button>
              )}
            </div>

            {consultScenarios.length === 0 ? (
              <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
                <p className="text-sm text-slate-700 font-bold">直相談シナリオがまだ登録されていません</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  「直相談プリセットを最新化」または「点検・編集」から、直相談用Flexカードや個別フォローメッセージを登録・編集できます。
                </p>
                {onApplyDirectConsultStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDirectConsultStarterSet}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-2 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>直相談（30分無料面談）の標準シナリオを反映する</span>
                  </button>
                )}
              </div>
            ) : (
              consultScenarios.map((scenario, index) => (
                <div
                  key={scenario.id}
                  className="bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition shadow-2xs"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-sky-300">
                      {index + 1}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          {scenario.waitMinutes === 0 ? '即時実行' : `${Math.round(scenario.waitMinutes / 1440)}日後`}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                          {scenario.channel === 'line' ? 'LINE' : scenario.channel === 'email' ? 'メール' : 'LINE+メール'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
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
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
                      <span>点検・編集</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* トラック 5: 📥 Web資料請求・問い合わせフォロー                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'flow' && activeTrack === 'inbound_material' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 animate-fade-in">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="p-2.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Web資料請求・お問い合わせ自動フォロー導線
              </h3>
              <p className="text-xs text-slate-500">
                HPやLPから資料請求があった際、即時お礼メールからLINE誘導・個別面談へのステップアップを自動化します。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                1
              </span>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-sm">【即時】資料ダウンロードURL送付 ＆ 御礼メール</span>
                <p className="text-xs text-slate-500">
                  お客様がフォームに入力したメールアドレス宛に、PDF閲覧URL（ダウンロード期限付き）を自動送信。
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                2
              </span>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-sm">【2日後】資料の重要ポイント要約 ＆ LINE無料診断のご案内</span>
                <p className="text-xs text-slate-500">
                  「読む時間が取れない方へ」として、貴社のボトルネックが3分で分かるLINE無料診断へ誘導。
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-xs">
                3
              </span>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 text-sm">【5日後】同業種の改善事例紹介 ＆ 30分無料作戦会議</span>
                <p className="text-xs text-slate-500">
                  実際に手作業を削減して利益率を改善した事例を共有し、大橋様との個別面談予約（オンライン）をご案内。
                </p>
              </div>
            </div>
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
