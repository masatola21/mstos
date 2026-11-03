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
  Inbox
} from 'lucide-react';
import { MarketingScenario, MarketingTrigger, MarketingChannel } from '../../types/marketing';
import {
  INDUSTRY_MESSAGES,
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
    replyText: '介護保険外サービスの開業・事業展開についてのご相談ありがとうございます！\n自費リハビリ・自費看護等の立ち上げでは、収益モデルの設計と地域集客が成功の鍵となります。\n\n専任チームより最適な開業パッケージ案内をお届けします。',
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
    replyText: 'MSTの会社案内・サービス概要資料のご請求ありがとうございます。\n下記リンクより最新の会社概要PDFを閲覧いただけます。\n\n▼ 会社案内・サービス資料\nhttps://mstcorp.info/materials',
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
  const [selectedIndustry, setSelectedIndustry] = useState<string>('製造（BtoB）');
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
  const [welcomeChoices, setWelcomeChoices] = useState<WelcomeChoice[]>(DEFAULT_WELCOME_CHOICES);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeRuleId, setWelcomeRuleId] = useState<string | null>(null);
  const [isEditingWelcome, setIsEditingWelcome] = useState(false);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeNotice, setWelcomeNotice] = useState('');

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

      const buttonColors = ['#10B981', '#1E3A5F', '#0284C7', '#8B5CF6'];
      const buttons = welcomeChoices.map((c, i) => ({
        type: 'button',
        style: 'primary',
        color: buttonColors[i % buttonColors.length],
        height: 'lg',
        margin: i === 0 ? 'lg' : 'sm',
        action: {
          type: 'postback',
          label: (c.label || `選択肢 ${i + 1}`).slice(0, 20),
          data: `wc=${c.id}`,
          displayText: c.label || `選択肢 ${i + 1}`,
        },
      }));

      const payload = {
        altText: `${welcomeHeading} ${welcomeSubheading}`,
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'lg',
            contents: [
              { type: 'text', text: welcomeHeading, size: 'xl', weight: 'bold', align: 'center', color: '#1E293B', wrap: true },
              { type: 'text', text: welcomeSubheading, size: 'md', align: 'center', color: '#334155', margin: 'sm', wrap: true },
              { type: 'separator', margin: 'lg' },
              { type: 'text', text: welcomeIntro, size: 'sm', align: 'center', color: '#475569', margin: 'lg', wrap: true },
              { type: 'text', text: welcomeQuestion, size: 'lg', weight: 'bold', align: 'center', color: '#1E293B', margin: 'xl', wrap: true },
              { type: 'text', text: welcomeInstruction, size: 'sm', align: 'center', color: '#64748B', margin: 'sm', wrap: true },
              ...buttons,
            ],
          },
        },
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
          welcomeRuleId ? { id: welcomeRuleId, ...rowData } : rowData,
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
  const [viewMode, setViewMode] = useState<'flow' | 'table'>('flow');
  const [tableSearch, setTableSearch] = useState('');

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

  // 新規ステップ作成
  const handleCreateNewStep = () => {
    const newStep: MarketingScenario = {
      id: `step-${Date.now()}`,
      name: '新しい配信ステップ',
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
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 公式プリセット一括導入＆重複整理 統合ツールバー                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/60 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-bold text-indigo-200 text-sm">
              <Zap className="h-4 w-4 text-indigo-400" />
              <span>公式プリセット管理 ＆ シナリオ一括導入</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-300">
              目的別（LINE導線・営業メール・ストーリーナーチャリング・直相談）の完成シナリオをワンクリックで導入・最新化できます。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {duplicateCount > 0 && onDeduplicateScenarios && (
              <button
                type="button"
                onClick={onDeduplicateScenarios}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>重複を整理（{duplicateCount}件削除）</span>
              </button>
            )}

            {onApplyAllStarterSets && (
              <button
                type="button"
                onClick={onApplyAllStarterSets}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>全18本を一括導入・更新</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCreateNewStep}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>新規ステップ追加</span>
            </button>
          </div>
        </div>

        {/* 目的別プリセットボタン群 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-800/80 mt-3">
          <button
            type="button"
            onClick={onApplyDiagnosisStarterSet}
            className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/50 p-2.5 text-left transition cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-white">① 診断フォロー（5本・Flex）</div>
              <div className="text-[11px] text-emerald-200 mt-0.5">LINE登録→診断→レポート→面談誘導</div>
            </div>
            <Plus className="h-4 w-4 text-emerald-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onApplyOutreachStarterSet}
            className="flex items-center justify-between gap-2 rounded-xl border border-blue-500/30 bg-blue-950/30 hover:bg-blue-900/50 p-2.5 text-left transition cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-white">② 営業メール（5ステップ）</div>
              <div className="text-[11px] text-blue-200 mt-0.5">業界急所提起→仕組み化事例→3分診断</div>
            </div>
            <Plus className="h-4 w-4 text-blue-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onApplyLineNurturingStarterSet}
            className="flex items-center justify-between gap-2 rounded-xl border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/50 p-2.5 text-left transition cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-white">③ ストーリー型（7話）</div>
              <div className="text-[11px] text-purple-200 mt-0.5">大橋真人実話・LINE+メルマガ共感重視</div>
            </div>
            <Plus className="h-4 w-4 text-purple-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onApplyDirectConsultStarterSet}
            className="flex items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-950/30 hover:bg-sky-900/50 p-2.5 text-left transition cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-white">④ 直相談（介護開業/経営）</div>
              <div className="text-[11px] text-sky-200 mt-0.5">診断不要・即時30分面談案内Flex</div>
            </div>
            <Plus className="h-4 w-4 text-sky-400 shrink-0" />
          </button>
        </div>
      </div>

      {welcomeNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center justify-between">
          <span>{welcomeNotice}</span>
          <button type="button" onClick={() => setWelcomeNotice('')} className="text-emerald-400 font-bold px-1">✕</button>
        </div>
      )}

      {keywordNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center justify-between">
          <span>{keywordNotice}</span>
          <button type="button" onClick={() => setKeywordNotice('')} className="text-emerald-400 font-bold px-1">✕</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 導線トラック切り替えヘッダー                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <GitBranch className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                シナリオ別 配信設計 ＆ ビジュアル導線マップ
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  安全ストッパー・重複ゼロ
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                シナリオごとに配信ステップ・トリガー・文面を整理。面談予約や返信が入った瞬間に自動停止し、安全に個別チャットへ切り替わります。
              </p>
            </div>
          </div>
        </div>

        {/* シナリオ別トラック切り替えタブ */}
        <div className="flex flex-wrap items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTrack('line_welcome'); setViewMode('flow'); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTrack === 'line_welcome' && viewMode === 'flow'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-300" />
            <span>📱 LINE友だち・診断フォロー</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTrack('sales_outreach'); setViewMode('flow'); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTrack === 'sales_outreach' && viewMode === 'flow'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-300" />
            <span>✉️ 営業メール（5段階）</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTrack('story_nurturing'); setViewMode('flow'); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTrack === 'story_nurturing' && viewMode === 'flow'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-300" />
            <span>📖 ストーリー型（7話）</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTrack('direct_consult'); setViewMode('flow'); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTrack === 'direct_consult' && viewMode === 'flow'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-sky-300" />
            <span>🌿 直相談（介護開業/経営）</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-indigo-300" />
            <span>📋 全ステップ一覧（{scenarios.length}件）</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* テーブル表示モード: 全シナリオ一覧 ＆ 詳細インスペクター直結     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Table className="w-5 h-5 text-indigo-400" />
                全配信ステップ一覧・一括管理
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">ステップ名</th>
                  <th className="p-3">チャネル</th>
                  <th className="p-3">タイミング</th>
                  <th className="p-3">停止条件</th>
                  <th className="p-3">自動実行</th>
                  <th className="p-3 text-right">点検・操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {scenarios
                  .filter((s) => !tableSearch || s.name.toLowerCase().includes(tableSearch.toLowerCase()) || (s.messageBody || '').toLowerCase().includes(tableSearch.toLowerCase()) || (s.emailSubject || '').toLowerCase().includes(tableSearch.toLowerCase()))
                  .map((s) => (
                    <tr key={s.id} className="hover:bg-slate-950/60 transition">
                      <td className="p-3">
                        <div className="font-bold text-white">{s.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {s.flexTitle || s.messageBody || s.emailSubject || '文面未設定'}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.channel === 'line'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : s.channel === 'email'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {s.channel === 'line' ? '📱 LINE' : s.channel === 'email' ? '✉️ メール' : '📱+✉️ 両方'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {s.waitMinutes === 0 ? '即時実行' : `${Math.round(s.waitMinutes / 1440)}日後`}
                      </td>
                      <td className="p-3 text-[11px]">
                        <span className="text-slate-400">
                          {s.stopOnBooking ? '面談予約' : ''} {s.stopOnDeal ? '/ 成約' : ''} で停止
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(s.id, Boolean(s.automationEnabled))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                            s.automationEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {s.automationEnabled ? <Play className="w-3 h-3 fill-emerald-400" /> : <Pause className="w-3 h-3" />}
                          <span>{s.automationEnabled ? '稼働中' : '停止中'}</span>
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewModalScenario(s)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                            title="文面プレビュー"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenInspector(s)}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            title="点検・編集"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
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
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-200">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-white">安全ストッパー稼働中: </span>
                LINE友だちから返信メッセージがあった場合、または予約が入った時点で
                <strong className="underline decoration-emerald-400 mx-1">自動ステップ配信は即時停止（スキップ）</strong>
                され、統合受信箱での個別有人対応に自動切り替わります。
              </div>
            </div>
            {onOpenInbox && (
              <button
                type="button"
                onClick={onOpenInbox}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg transition text-xs shrink-0 cursor-pointer"
              >
                <span>📥 統合受信箱でチャットを確認</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 入口 ①: LINE友だち追加 ウェルカムメッセージ（統一正本エディタ） */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-sm flex items-center justify-center">
                  1
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      【入口①・統一正本】LINE友だち追加直後（即時送信）
                    </span>
                    <span className="text-xs text-slate-400">Flexカード（3大相談メニュー分岐）</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    友だち追加ウェルカムメッセージ
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-300 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={welcomeEnabled}
                    onChange={(e) => setWelcomeEnabled(e.target.checked)}
                    className="rounded accent-emerald-500"
                  />
                  <span>自動送信有効</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditingWelcome(!isEditingWelcome)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isEditingWelcome ? 'プレビューに戻る' : 'ウェルカム文面を編集'}</span>
                </button>
              </div>
            </div>

            {/* ウェルカム編集フォーム */}
            {isEditingWelcome && (
              <div className="p-5 bg-slate-950/80 border-b border-slate-800 space-y-4 text-xs animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">差出人・見出し（太字大）</label>
                    <input
                      type="text"
                      value={welcomeHeading}
                      onChange={(e) => setWelcomeHeading(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      placeholder="大橋真人です。"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">サブ見出し（挨拶）</label>
                    <input
                      type="text"
                      value={welcomeSubheading}
                      onChange={(e) => setWelcomeSubheading(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      placeholder="LINE登録ありがとうございます。"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">自己紹介・事業紹介文</label>
                  <textarea
                    rows={3}
                    value={welcomeIntro}
                    onChange={(e) => setWelcomeIntro(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-xs font-mono"
                    placeholder="MSTでは、中小企業の「経営の仕組み化×利益改善」と介護保険外サービスの開業を支援しています。"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">問いかけ文面（大）</label>
                    <input
                      type="text"
                      value={welcomeQuestion}
                      onChange={(e) => setWelcomeQuestion(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      placeholder="まず、どのようなご相談をご希望ですか？"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">補足誘導文面（小）</label>
                    <input
                      type="text"
                      value={welcomeInstruction}
                      onChange={(e) => setWelcomeInstruction(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      placeholder="ご希望に近いものをお選びください"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingWelcome(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    disabled={welcomeSaving}
                    onClick={() => void handleSaveWelcome()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{welcomeSaving ? '保存中…' : '保存してLINEに反映'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* プレビュー表示 */}
            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 flex justify-center">
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 text-slate-800 p-5 space-y-4">
                  <div className="text-center space-y-1">
                    <p className="font-black text-lg text-slate-900">{welcomeHeading}</p>
                    <p className="text-xs text-slate-600 font-medium">{welcomeSubheading}</p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-600 text-center whitespace-pre-line leading-relaxed">
                      {welcomeIntro}
                    </p>
                  </div>
                  <div className="text-center pt-2">
                    <p className="font-bold text-sm text-slate-900">{welcomeQuestion}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{welcomeInstruction}</p>
                  </div>
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedBranch(expandedBranch === 'diagnosis' ? 'all' : 'diagnosis')}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
                    >
                      <span>📊 3分無料経営診断を受ける</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedBranch(expandedBranch === 'consult' ? 'all' : 'consult')}
                      className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
                    >
                      <span>🗓️ 経営改善について個別相談する</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedBranch(expandedBranch === 'care' ? 'all' : 'care')}
                      className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-between shadow-sm transition cursor-pointer"
                    >
                      <span>🌿 介護保険外サービス開業を知る</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-3 text-xs">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    ボタンタップ時の自動分岐・タグ付与仕様
                  </h4>
                  <p className="text-slate-400 leading-relaxed">
                    友だちが各ボタンをタップした瞬間に自動でタグが付与され、それぞれの後続フォローシナリオへ即座に分岐します。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <span className="font-bold block">① 診断ルート</span>
                      <span className="text-[11px] opacity-80">タグ「選択:診断」付与</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200">
                      <span className="font-bold block">② 個別相談ルート</span>
                      <span className="text-[11px] opacity-80">タグ「選択:個別相談」付与</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300">
                      <span className="font-bold block">③ 介護開業ルート</span>
                      <span className="text-[11px] opacity-80">タグ「care:開業相談」付与</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-400">表示フィルタ:</span>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      expandedBranch === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    すべての分岐を表示
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('diagnosis')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      expandedBranch === 'diagnosis' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    ① 診断のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('consult')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      expandedBranch === 'consult' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    ② 個別相談のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('care')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      expandedBranch === 'care' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    ③ 介護開業のみ
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 入口 ②: ⚡ キーワード自動応答シナリオ */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-sm flex items-center justify-center">
                  2
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      【入口②】顧客からのキーワード送信時
                    </span>
                    <span className="text-xs text-slate-400">リアルタイム自動応答 ＆ タグ付与</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    キーワード自動応答シナリオ（{keywordRules.length}件登録）
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateKeywordModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
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
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {rule.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                        「{rule.matchText}」を含む
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 whitespace-pre-line bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      {rule.replyText}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-[11px] text-emerald-400 font-mono">
                      {rule.tag ? `タグ: ${rule.tag}` : 'タグなし'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleKeywordRule(rule.id)}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          rule.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {rule.enabled ? '有効' : '無効'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditKeywordModal(rule)}
                        className="p-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                        title="編集"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteKeywordRule(rule.id)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 cursor-pointer"
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
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-black">
                    A
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      分岐 A: 📊 3分無料経営診断・個別面談フォロー（全5ステップ）
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {diagnosisScenarios.length} ステップ登録中
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      診断回答 ──→ 速報分析 ──→ レポート完成送付 ──→ 3日後・7日後の個別作戦会議フォロー
                    </p>
                  </div>
                </div>

                {onApplyDiagnosisStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDiagnosisStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-300" />
                    <span>診断フォロー5本を最新化</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {diagnosisScenarios.map((scenario, index) => (
                  <div
                    key={scenario.id}
                    className="bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{scenario.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {scenario.waitMinutes === 0 ? '即時実行' : `${Math.round(scenario.waitMinutes / 1440)}日後`}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                            {scenario.lineMessageType === 'flex' ? 'Flexカード' : 'テキスト'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1">
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
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {scenario.automationEnabled ? (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
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
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 transition cursor-pointer"
                        title="文面プレビュー"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenInspector(scenario)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                        <span>点検・編集</span>
                      </button>
                    </div>
                  </div>
                ))}
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
          <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/40 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Mail className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      営業メール（全5段階アプローチ）トリガー仕様 ＆ タイムライン設計
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      未接触の見込み企業リストに対して、業界別の課題と仕組み化事例を自動で差し込み順次配信します。
                    </p>
                  </div>
                </div>
              </div>

              {onApplyOutreachStarterSet && (
                <button
                  type="button"
                  onClick={onApplyOutreachStarterSet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>営業メール5段階を最新化</span>
                </button>
              )}
            </div>

            {/* トリガー ＆ 停止条件の3大要素 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-blue-500/30 space-y-1.5">
                <div className="font-bold text-blue-300 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  <span>① 開始トリガー（Trigger）</span>
                </div>
                <div className="text-slate-200 font-semibold">
                  見込み客登録時（lead_created）
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  CRMに新しい見込み企業が登録された時点、または営業対象リストに追加された時点で第1通の配信ジョブが自動作成されます。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-1.5">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>② 配信スケジュール（3日おき）</span>
                </div>
                <div className="text-slate-200 font-semibold">
                  0日後 ➜ 3日後 ➜ 6日後 ➜ 9日後 ➜ 12日後
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  送信可能時間帯（09:00〜20:00）を厳守し、相手が負担に感じない間隔で自然に信頼と診断動機を高めます。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-1.5">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>③ 自動停止ストッパー（Stop Condition）</span>
                </div>
                <div className="text-slate-200 font-semibold">
                  面談予約・商談化・返信で即停止
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  相手が30分相談を予約した瞬間、または返信した瞬間に後続メールは自動キャンセルされ、重複連絡を完全に防ぎます。
                </p>
              </div>
            </div>

            {/* 18業種別シミュレーション */}
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">
                    業種別メッセージ自動差し替えシミュレーター（18業種対応）:
                  </span>
                </div>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:border-blue-500 cursor-pointer"
                >
                  {Object.keys(INDUSTRY_MESSAGES).map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-rose-400 font-bold block">
                    【第1通に自動挿入】{selectedIndustry} の急所・課題
                  </span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {getIndustryMessage(selectedIndustry, 'problem')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-emerald-400 font-bold block">
                    【第3通に自動挿入】{selectedIndustry} の導入変革メリット
                  </span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {getIndustryMessage(selectedIndustry, 'benefit')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 5ステップのタイムラインカード */}
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const draft = getSalesEmailTemplate(stepNum, 'サンプル株式会社', '山田 太郎', selectedIndustry, 'https://mstcorp.info/diagnosis');
              const waitDays = stepNum === 1 ? '0日目（即時 / 待機: 0分）' : `${(stepNum - 1) * 3}日後（待機: ${(stepNum - 1) * 3 * 1440}分）`;
              const matchedScenario = outreachScenarios.find(s => s.name.includes(String(stepNum)));

              return (
                <div
                  key={stepNum}
                  className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 shadow-sm space-y-3 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black text-sm flex items-center justify-center shrink-0">
                        {stepNum}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                            第{stepNum}通 ({waitDays})
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            件名: {draft.subject}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">
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
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {matchedScenario.automationEnabled ? <Play className="w-3 h-3 fill-emerald-400" /> : <Pause className="w-3 h-3" />}
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
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
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
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                        <span>点検・編集</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 max-h-24 overflow-hidden relative">
                    <pre className="whitespace-pre-wrap">{draft.body}</pre>
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
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
          <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/40 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <BookOpen className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    大橋ストーリー型 7話ナーチャリング（LINE ＋ メール両対応）
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    有限会社MST 代表・大橋真人の創業実話と業務改革の軌跡をベースに、共感と信頼を積み上げるストーリー型ステップ配信です。
                  </p>
                </div>
              </div>

              {onApplyLineNurturingStarterSet && (
                <button
                  type="button"
                  onClick={onApplyLineNurturingStarterSet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>ストーリー型7話を最新化</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-500/30 space-y-1">
                <span className="font-bold text-purple-300">① 開始トリガー</span>
                <p className="text-slate-300 font-semibold">LINE登録時（line_registered）</p>
                <p className="text-slate-400 text-[11px]">LINE友だち追加、またはメルマガ登録時に即時スタート。</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-1">
                <span className="font-bold text-indigo-300">② チャネル仕様</span>
                <p className="text-slate-300 font-semibold">LINE ＋ メール（両方対応）</p>
                <p className="text-slate-400 text-[11px]">LINEでは読みやすい短文・メールでは詳細な事例長文を自動適応。</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-1">
                <span className="font-bold text-emerald-300">③ 停止条件</span>
                <p className="text-slate-300 font-semibold">面談予約・診断回答で停止</p>
                <p className="text-slate-400 text-[11px]">途中で診断回答または無料相談予約が入ると自動停止します。</p>
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
                  className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 shadow-sm space-y-3 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-black text-sm flex items-center justify-center shrink-0">
                        {stepNum}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                            第{stepNum}話 ({waitDays})
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            件名: {tpl.emailSubject}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">
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
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {matchedScenario.automationEnabled ? <Play className="w-3 h-3 fill-emerald-400" /> : <Pause className="w-3 h-3" />}
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
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
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
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                        <span>点検・編集</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 max-h-24 overflow-hidden relative">
                    <pre className="whitespace-pre-wrap">{tpl.emailBody}</pre>
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
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
          <div className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-slate-900 border border-sky-500/40 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    【直相談】介護保険外サービス開業・個別経営相談 受付案内
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    診断回答を挟まず、すぐに30分のオンライン個別相談（大橋真人との直接面談）を希望する見込み客向けの即時Flexカードです。
                  </p>
                </div>
              </div>

              {onApplyDirectConsultStarterSet && (
                <button
                  type="button"
                  onClick={onApplyDirectConsultStarterSet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>直相談プリセットを最新化</span>
                </button>
              )}
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-300">
                  即時オンライン相談（30分）予約案内 Flexカード
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                  タグ「選択:個別相談 / care:開業相談」連動
                </span>
              </div>
              <p className="text-xs text-slate-300">
                面談日程カレンダーURL（{`{booking_url}`}）が自動差し込みされ、相手が日時を選択すると自動でGoogle Meet発行・CRMカレンダーに即時反映されます。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* トラック 5: 📥 Web資料請求・問い合わせフォロー                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewMode === 'flow' && activeTrack === 'inbound_material' && (
        <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <span className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">
                Web資料請求・お問い合わせ自動フォロー導線
              </h3>
              <p className="text-xs text-slate-400">
                HPやLPから資料請求があった際、即時お礼メールからLINE誘導・個別面談へのステップアップを自動化します。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div className="space-y-1">
                <span className="font-bold text-white text-sm">【即時】資料ダウンロードURL送付 ＆ 御礼メール</span>
                <p className="text-xs text-slate-400">
                  お客様がフォームに入力したメールアドレス宛に、PDF閲覧URL（ダウンロード期限付き）を自動送信。
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div className="space-y-1">
                <span className="font-bold text-white text-sm">【2日後】資料の重要ポイント要約 ＆ LINE無料診断のご案内</span>
                <p className="text-xs text-slate-400">
                  「読む時間が取れない方へ」として、貴社のボトルネックが3分で分かるLINE無料診断へ誘導。
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div className="space-y-1">
                <span className="font-bold text-white text-sm">【5日後】同業種の改善事例紹介 ＆ 30分無料作戦会議</span>
                <p className="text-xs text-slate-400">
                  実際に手作業を削減して利益率を改善した事例を共有し、大橋様との個別面談予約（オンライン）をご案内。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* キーワード追加・編集モーダル */}
      {isEditingKeywordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  {editingRule ? 'キーワード自動応答を編集' : '新しいキーワード自動応答を追加'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingKeywordModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKeywordRule} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">管理名称</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="例: 「診断」送信時"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">反応キーワード *</label>
                  <input
                    type="text"
                    required
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    placeholder="例: 診断"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">マッチ方式</label>
                  <select
                    value={ruleMode}
                    onChange={(e) => setRuleMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="contains">部分一致（含むとき）</option>
                    <option value="exact">完全一致（一致のみ）</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">自動返信するメッセージ文面 *</label>
                <textarea
                  rows={4}
                  required
                  value={ruleReply}
                  onChange={(e) => setRuleReply(e.target.value)}
                  placeholder="返信する文章を入力してください。{link_url} や {booking_url} が利用できます。"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">自動付与するタグ</label>
                  <input
                    type="text"
                    value={ruleTag}
                    onChange={(e) => setRuleTag(e.target.value)}
                    placeholder="例: 選択:診断"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-emerald-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">連動する導線分岐</label>
                  <select
                    value={ruleTargetBranch}
                    onChange={(e) => setRuleTargetBranch(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="diagnosis">A: 3分無料経営診断</option>
                    <option value="consult">B: 経営個別相談</option>
                    <option value="care">C: 介護開業パッケージ</option>
                    <option value="general">一般問い合わせ</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingKeywordModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">
                  {previewModalScenario.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalScenario(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              {previewModalScenario.emailSubject && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px] block mb-1">件名:</span>
                  <p className="text-white font-bold">{previewModalScenario.emailSubject}</p>
                </div>
              )}

              {previewModalScenario.emailBody && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px] block mb-1">メール本文:</span>
                  <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {previewModalScenario.emailBody}
                  </pre>
                </div>
              )}

              {previewModalScenario.messageBody && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-[11px] block mb-1">LINEメッセージ本文:</span>
                  <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {previewModalScenario.messageBody}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalScenario(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
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
