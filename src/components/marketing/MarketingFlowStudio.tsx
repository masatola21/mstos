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
  Check
} from 'lucide-react';
import { MarketingScenario, MarketingTrigger, MarketingChannel } from '../../types/marketing';
import { INDUSTRY_MESSAGES, getSalesEmailTemplate, getIndustryMessage } from '../../utils/salesOutreachTemplates';
import { LineMessagePreview } from '../LineMessagePreview';
import { renderPlaceholders, PLACEHOLDER_SAMPLE_VALUES } from '../../utils/placeholders';
import { DEFAULT_WELCOME_CHOICES, WelcomeChoice } from './MarketingLineSettingsView';
import { getSupabase } from '../../lib/supabaseClient';
import { FlowStepInspectorModal } from './FlowStepInspectorModal';
import { UNIFIED_TAG_MASTER, MasterTag } from '../../constants/tagMaster';

export type FlowTrack = 'line_welcome' | 'sales_outreach' | 'inbound_material';

interface MarketingFlowStudioProps {
  scenarios: MarketingScenario[];
  onScenariosChange: (scenarios: MarketingScenario[]) => void;
  onEditScenario?: (scenario: MarketingScenario) => void;
  onOpenInbox?: () => void;
  onOpenJobs?: () => void;
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
}) => {
  const db = getSupabase();
  const [activeTrack, setActiveTrack] = useState<FlowTrack>('line_welcome');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('製造（BtoB）');
  const [expandedBranch, setExpandedBranch] = useState<'diagnosis' | 'consult' | 'care' | 'all'>('all');
  const [previewModalScenario, setPreviewModalScenario] = useState<ScenarioPreviewInfo | null>(null);

  // LINEウェルカム設定用状態
  const [welcomeHeading, setWelcomeHeading] = useState('大橋真人です。');
  const [welcomeSubheading, setWelcomeSubheading] = useState('LINE登録ありがとうございます。');
  const [welcomeIntro, setWelcomeIntro] = useState('MSTでは、中小企業の\n「経営の仕組み化×利益改善」と\n介護保険外サービスの開業を支援しています。');
  const [isEditingWelcome, setIsEditingWelcome] = useState(false);

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

    // Supabaseへの保存
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

  // キーワードルールの削除
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

  // キーワードルールの有効・無効切り替え
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

  // ビューモード切り替え: 'flow' (導線フロー全体図) または 'table' (全ステップ一覧テーブル)
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
      s.name.includes('【3. レポート')
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
      s.name.includes('話】')
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
      trigger: 'line_registered',
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
      {/* 導線トラック切り替えヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <GitBranch className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                コミュニケーション導線設計スタジオ
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  重複ゼロ・自動ストッパー連動
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                LINEとメールのステップ配信を1つの画面で俯瞰。返信・アポ獲得時は自動停止して現場チャットへ安全に引き継がれます。
              </p>
            </div>
          </div>
        </div>

        {/* 3つのトラック切り替えタブ */}
        <div className="flex flex-wrap items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => setActiveTrack('line_welcome')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTrack === 'line_welcome'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-300" />
            <span>📱 LINE導線（ウェルカム＋キーワード応答）</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTrack('sales_outreach')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTrack === 'sales_outreach'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-300" />
            <span>✉️ 営業メール（アウトバウンド5段階）</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTrack('inbound_material')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTrack === 'inbound_material'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span>📥 Web資料請求・問い合わせフォロー</span>
          </button>
        </div>
      </div>

      {keywordNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center justify-between">
          <span>{keywordNotice}</span>
          <button type="button" onClick={() => setKeywordNotice('')} className="text-emerald-400 font-bold px-1">✕</button>
        </div>
      )}

      {/* 表示形式切り替え ＆ 新規ステップ作成バー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('flow')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'flow'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>🗺️ ビジュアル導線マップ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>📋 全ステップ一覧テーブル（{scenarios.length}件）</span>
            </button>
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
            <Tag className="w-3.5 h-3.5" />
            <span>🏷️ CRM・LINE共通タグ辞書連動中</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCreateNewStep}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新しいステップを追加</span>
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
                各行の「点検・編集」を押すと、その場でメッセージ文面・設問・URL・タグ・停止条件を確認・手入れできます。
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
      {/* ビジュアル導線マップモード                                      */}
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

          {/* 入口 ①: LINE友だち追加 ウェルカムメッセージ */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-sm flex items-center justify-center">
                  1
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      【入口①】LINE友だち追加直後（即時送信）
                    </span>
                    <span className="text-xs text-slate-400">Flexメッセージ</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    ウェルカムメッセージ ＆ 3大ご相談メニュー分岐
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingWelcome(!isEditingWelcome)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer self-start sm:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEditingWelcome ? '編集を閉じる' : 'ウェルカム文面を編集'}</span>
              </button>
            </div>

            {/* ウェルカム編集フォーム */}
            {isEditingWelcome && (
              <div className="p-5 bg-slate-950/60 border-b border-slate-800 space-y-4 text-xs animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">差出人・見出し</label>
                    <input
                      type="text"
                      value={welcomeHeading}
                      onChange={(e) => setWelcomeHeading(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                      placeholder="大橋真人です。"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">サブ見出し</label>
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
                  <label className="font-bold text-slate-300 block mb-1">挨拶・事業紹介文</label>
                  <textarea
                    rows={3}
                    value={welcomeIntro}
                    onChange={(e) => setWelcomeIntro(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-xs font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingWelcome(false)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    保存してプレビューに反映
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
                    <p className="font-bold text-sm text-slate-900">まず、どのようなご相談をご希望ですか？</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ご希望に近いものをお選びください</p>
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
                    ボタンタップ時の自動分岐
                  </h4>
                  <p className="text-slate-400 leading-relaxed">
                    お客様がボタンをタップすると、サーバー側で自動的にタグが付与され、それぞれの専用シナリオへと分岐します。
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

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 入口 ②: ⚡ キーワード自動応答シナリオ                           */}
          {/* ═══════════════════════════════════════════════════════════════ */}
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

            <p className="text-xs text-slate-400">
              お客様がLINEのトーク画面で特定のキーワード（例：「診断」「相談」「介護」「料金」など）を送信した際、自動で最適なご案内文を即時返信し、対応するタグやフォロー導線へ繋ぎます。
            </p>

            {/* キーワード応答カード一覧 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {keywordRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-4 transition flex flex-col justify-between space-y-3 ${
                    rule.enabled
                      ? 'bg-slate-950 border-slate-800 hover:border-amber-500/40'
                      : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                        「{rule.matchText}」{rule.matchMode === 'contains' ? 'を含む' : 'と完全一致'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        タグ: {rule.tag || 'なし'}
                      </span>
                    </div>

                    <div className="font-bold text-white text-xs">{rule.name}</div>

                    {/* 連動する後続シナリオ・分岐 */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400">連動先:</span>
                      {rule.targetBranch === 'diagnosis' && (
                        <button
                          type="button"
                          onClick={() => setExpandedBranch('diagnosis')}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold hover:bg-emerald-500/30 transition cursor-pointer flex items-center gap-1"
                          title="クリックして分岐Aのステップ配信を表示"
                        >
                          <span>📊 分岐A（3分診断ステップ配信）へ直結</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {rule.targetBranch === 'consult' && (
                        <button
                          type="button"
                          onClick={() => setExpandedBranch('consult')}
                          className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold hover:bg-indigo-500/30 transition cursor-pointer flex items-center gap-1"
                          title="クリックして分岐Bの個別相談を表示"
                        >
                          <span>🗓️ 分岐B（個別相談・日程予約）へ直結</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {rule.targetBranch === 'care' && (
                        <button
                          type="button"
                          onClick={() => setExpandedBranch('care')}
                          className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/30 text-sky-300 font-bold hover:bg-sky-500/30 transition cursor-pointer flex items-center gap-1"
                          title="クリックして分岐Cの介護パッケージを表示"
                        >
                          <span>🌿 分岐C（介護開業パッケージ）へ直結</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                      {rule.targetBranch === 'general' && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                          ℹ️ 一般インフォメーション即時応答
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 line-clamp-3 font-mono leading-relaxed">
                      {rule.replyText}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleKeywordRule(rule.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                        rule.enabled
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rule.enabled ? <Play className="w-3 h-3 fill-emerald-400" /> : <Pause className="w-3 h-3" />}
                      <span>{rule.enabled ? '有効' : '停止中'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewModalScenario({
                            name: `LINEキーワード自動応答「${rule.matchText}」`,
                            messageBody: rule.replyText,
                          });
                        }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="プレビュー"
                      >
                        <Eye className="w-3.5 h-3.5" />
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

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 分岐 A: 📊 3分無料経営診断 導線ツリー                          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(expandedBranch === 'all' || expandedBranch === 'diagnosis') && (
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-black">
                    A
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      分岐 A: 📊 3分無料経営診断ルート
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {diagnosisScenarios.length} ステップ登録中
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      診断フォーム送信 ──→ レポート作成中通知 ──→ 完成レポート送付 ──→ 3日後・7日後の個別作戦会議フォロー
                    </p>
                  </div>
                </div>
              </div>

              {/* ステップ一覧 */}
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
                      {/* 自動配信トグル */}
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

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 分岐 B: 🗓️ 個別相談 導線ツリー                                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(expandedBranch === 'all' || expandedBranch === 'consult') && (
            <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 font-black">
                    B
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      分岐 B: 🗓️ 経営改善の個別相談ルート
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        {consultScenarios.length || 1} ステップ
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      日程調整URL送付 ──→ 未予約フォロー ──→ 予約完了時ストップ ＆ 前日リマインド
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateNewStep}
                  className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-indigo-500/40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ステップ追加</span>
                </button>
              </div>

              <div className="space-y-3">
                {consultScenarios.length > 0 ? (
                  consultScenarios.map((scenario, index) => (
                    <div
                      key={scenario.id}
                      className="bg-slate-950/80 border border-slate-800 hover:border-indigo-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{scenario.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {scenario.waitMinutes === 0 ? '即時実行' : `${Math.round(scenario.waitMinutes / 1440)}日後`}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                              {scenario.lineMessageType === 'flex' ? 'Flexカード' : 'テキスト'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              予約完了で即時停止
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">
                            {scenario.flexTitle || scenario.messageBody || '文面未設定'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            scenario.automationEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {scenario.automationEnabled ? <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                          <span>{scenario.automationEnabled ? '自動実行中' : '一時停止中'}</span>
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
                  ))
                ) : (
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-white text-sm">【直相談】介護保険外サービス開業・個別経営相談 受付案内</span>
                      <p className="text-slate-400">
                        面談カレンダー予約URLを含む専用Flexカードを即時送付。日程が確定するとGoogleカレンダーと統合予定表に反映されます。
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                        予約完了で即時停止
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const fallback = scenarios.find(s => s.name.includes('直相談') || s.name.includes('個別相談')) || {
                            id: `consult-${Date.now()}`,
                            name: '【直相談】介護保険外サービス開業・個別経営相談 受付案内',
                            trigger: 'lead_created' as const,
                            channel: 'both' as const,
                            audience: 'すべての見込み客',
                            waitMinutes: 0,
                            emailSubject: '【MST】個別経営相談の日程調整のご案内',
                            emailBody: '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n個別面談日程の選択はこちら\n{booking_url}',
                            messageBody: '{recipient_name} 様\n面談日程のご案内です。\n{booking_url}',
                            lineMessageType: 'flex' as const,
                            lineImageUrl: '',
                            linePreviewImageUrl: '',
                            flexAltText: '個別相談のご案内',
                            flexTitle: '🌿 個別経営相談・日程調整',
                            flexBody: '{recipient_name} 様\n無料オンライン相談（30分）をご案内いたします。',
                            flexButtonLabel: '面談日程を選ぶ',
                            flexButtonUrl: '{booking_url}',
                            status: 'draft' as const,
                            automationEnabled: false,
                            stopOnBooking: true,
                            stopOnDeal: true,
                            updatedAt: Date.now(),
                          };
                          handleOpenInspector(fallback);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                        <span>点検・編集</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 分岐 C: 🌿 介護保険外サービス開業パッケージ 導線ツリー             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(expandedBranch === 'all' || expandedBranch === 'care') && (
            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400 font-black">
                    C
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      分岐 C: 🌿 介護保険外サービス開業パッケージルート
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                        {careScenarios.length || 1} ステップ
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      専用資料・相談フォーム（7日間有効トークン付）──→ 開業成功事例と収益モデル ──→ 個別収支シミュレーション
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateNewStep}
                  className="px-3 py-1.5 bg-sky-600/30 hover:bg-sky-600 text-sky-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-sky-500/40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ステップ追加</span>
                </button>
              </div>

              <div className="space-y-3">
                {careScenarios.length > 0 ? (
                  careScenarios.map((scenario, index) => (
                    <div
                      key={scenario.id}
                      className="bg-slate-950/80 border border-slate-800 hover:border-sky-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{scenario.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {scenario.waitMinutes === 0 ? '即時実行' : `${Math.round(scenario.waitMinutes / 1440)}日後`}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                              {scenario.lineMessageType === 'flex' ? 'Flexカード' : 'テキスト'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                              タグ「care:開業相談」連動
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">
                            {scenario.flexTitle || scenario.messageBody || '文面未設定'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            scenario.automationEnabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {scenario.automationEnabled ? <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
                          <span>{scenario.automationEnabled ? '自動実行中' : '一時停止中'}</span>
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
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
                          <span>点検・編集</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-white text-sm">介護保険外サービス開業パッケージ案内 ＆ 専用ヒアリング</span>
                      <p className="text-slate-400">
                        資料請求・開業相談・両方希望の3択から、顧客の状況に応じた専用トークン付きフォームをLINE上で安全に発行・案内します。
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                        タグ「care:資料請求/相談」自動付与
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const fallback = {
                            id: `care-${Date.now()}`,
                            name: '【介護開業】保険外サービス開業パッケージ案内 ＆ ヒアリング',
                            trigger: 'lead_created' as const,
                            channel: 'line' as const,
                            audience: 'すべての見込み客',
                            waitMinutes: 0,
                            emailSubject: '',
                            emailBody: '',
                            messageBody: '介護保険外サービス開業パッケージのご案内です。\nhttps://mstcorp.info/care-package',
                            lineMessageType: 'flex' as const,
                            lineImageUrl: '',
                            linePreviewImageUrl: '',
                            flexAltText: '介護保険外サービス開業パッケージ案内',
                            flexTitle: '🌿 介護保険外サービス開業パッケージ',
                            flexBody: '{recipient_name} 様\n自費リハビリ・自費看護等の開業成功ステップと収支シミュレーションをお届けします。',
                            flexButtonLabel: '開業パッケージを見る',
                            flexButtonUrl: 'https://mstcorp.info/care-package',
                            status: 'draft' as const,
                            automationEnabled: false,
                            stopOnBooking: true,
                            stopOnDeal: true,
                            updatedAt: Date.now(),
                          };
                          handleOpenInspector(fallback);
                        }}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
                        <span>点検・編集</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* トラック 2: ✉️ 営業メール（アウトバウンド全5ステップ）              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTrack === 'sales_outreach' && (
        <div className="space-y-6">
          {/* 業種セレクター＆シミュレーション */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-400" />
                  営業メール 5ステップ（アウトバウンド・見込み開拓）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  未接触の見込み企業リストへ、3日おきに業界ごとの急所と成功事例を差し込んで自動送信します。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">シミュレーション業種:</span>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-medium focus:border-blue-500 cursor-pointer"
                >
                  {Object.keys(INDUSTRY_MESSAGES).map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 選択した業種の課題と解決メリットのチラ見せ */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-red-400 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  【{selectedIndustry}】業界の急所・課題（メール第1通に自動挿入）
                </span>
                <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  {getIndustryMessage(selectedIndustry, 'problem')}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  【{selectedIndustry}】導入後の変革・メリット（メール第3通に自動挿入）
                </span>
                <p className="text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  {getIndustryMessage(selectedIndustry, 'benefit')}
                </p>
              </div>
            </div>
          </div>

          {/* 5ステップのタイムラインカード */}
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const draft = getSalesEmailTemplate(stepNum, 'サンプル株式会社', '山田 太郎', selectedIndustry, 'https://mstcorp.info/diagnosis');
              const waitDays = stepNum === 1 ? '初回送信（0日目）' : `${(stepNum - 1) * 3}日後`;

              return (
                <div
                  key={stepNum}
                  className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 shadow-sm space-y-3 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black text-sm flex items-center justify-center">
                        {stepNum}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                            第{stepNum}通 ({waitDays})
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            件名: {draft.subject}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">
                          {draft.name}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                          const matched = outreachScenarios.find((s) => s.name.includes(String(stepNum))) || {
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
                          handleOpenInspector(matched);
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
      {/* トラック 3: 📥 Web資料請求・問い合わせフォロー                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTrack === 'inbound_material' && (
        <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-sm space-y-6">
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
                  placeholder="例：見積もり相談への自動応答"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">反応キーワード <span className="text-amber-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    placeholder="例：見積、診断、相談"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">一致判定</label>
                  <select
                    value={ruleMode}
                    onChange={(e) => setRuleMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="contains">部分一致（含む場合）</option>
                    <option value="exact">完全一致</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">自動返信するメッセージ本文 <span className="text-amber-400">*</span></label>
                <textarea
                  rows={4}
                  required
                  value={ruleReply}
                  onChange={(e) => setRuleReply(e.target.value)}
                  placeholder="メッセージ本文を入力。{link_url} や {booking_url} などの差し込みが利用できます。"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    自動付与するタグ（CRM・LINE共通辞書連動）
                  </label>
                  <input
                    type="text"
                    value={ruleTag}
                    onChange={(e) => setRuleTag(e.target.value)}
                    placeholder="例：選択:診断、選択:個別相談"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs mb-1.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {UNIFIED_TAG_MASTER.slice(0, 6).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setRuleTag(t.name)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                          ruleTag === t.name
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">合流する導線</label>
                  <select
                    value={ruleTargetBranch}
                    onChange={(e) => setRuleTargetBranch(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="general">一般（単発応答のみ）</option>
                    <option value="diagnosis">分岐A: 3分無料診断ルート</option>
                    <option value="consult">分岐B: 個別相談ルート</option>
                    <option value="care">分岐C: 介護開業ルート</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingKeywordModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* プレビュー用モーダル */}
      {previewModalScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
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
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-xs text-slate-200 space-y-4 font-mono leading-relaxed bg-slate-900/60">
              {previewModalScenario.emailSubject && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px] font-sans font-bold">メール件名:</span>
                  <span className="text-white font-bold">{previewModalScenario.emailSubject}</span>
                </div>
              )}
              {previewModalScenario.emailBody && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 whitespace-pre-wrap">
                  {previewModalScenario.emailBody}
                </div>
              )}
              {previewModalScenario.messageBody && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 whitespace-pre-wrap">
                  {previewModalScenario.messageBody}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalScenario(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 事故防止ステップインスペクター ＆ 詳細設定モーダル */}
      <FlowStepInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        scenario={inspectorScenario}
        onSave={handleSaveInspectorScenario}
        onDelete={handleDeleteInspectorScenario}
        allScenarios={scenarios}
      />
    </div>
  );
};
