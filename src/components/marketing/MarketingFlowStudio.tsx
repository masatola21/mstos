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
import {
  FUNNEL_ORCHESTRATION_RULES,
  SCENARIO_TRACK_META,
  SCENARIO_TRACK_ORDER,
  ScenarioTrackCategory,
  classifyScenarioTrack,
  formatScenarioStopCondition,
  formatScenarioTriggerLabel,
  formatScenarioWaitMinutes,
  isLegacyBranchAScenarioName,
  isLegacyPostMeetingScenarioName,
  isPostDealStageTrigger,
  sortScenarios,
} from '../../utils/followupStarterScenarios';
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
  onApplyMaterialStarterSet?: () => void;
  onApplyPostMeetingStarterSet?: () => void;
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
  name: '縲舌Μ繝・メ繝｡繝九Η繝ｼ縲銑INE逶ｸ隲・ち繝・・譎・,
  matchText: '縲伸INE縺ｧ逶ｸ隲・＠縺溘＞縲・,
  matchMode: 'exact',
  replyText:
    '{recipient_name} 讒禄n縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺呻ｼ∵怏髯蝉ｼ夂､ｾMST縺ｮ螟ｧ讖狗悄莠ｺ縺ｧ縺吶・n\n縺皮嶌隲・・螳ｹ繧偵◎縺ｮ縺ｾ縺ｾ縺薙・LINE縺ｫ縺企√ｊ縺上□縺輔＞・井ｸ險繧・ｮ・擅譖ｸ縺阪〒繧ょ､ｧ荳亥､ｫ縺ｧ縺呻ｼ峨ら｢ｺ隱肴ｬ｡隨ｬ縲∝次蜑・4譎る俣莉･蜀・↓諡・ｽ薙ｈ繧顔峩謗･縺碑ｿ比ｿ｡縺・◆縺励∪縺吶・n\n笆ｼ 霑ｷ繧上ｌ縺溘ｉ逡ｪ蜿ｷ縺�縺代〒繧ゅ←縺・◇\n竭� 邨悟霧蜈ｨ闊ｬ繝ｻ蛻ｩ逶翫ｒ谿九☆莉慕ｵ・∩縺･縺上ｊ\n竭｡ 讌ｭ蜍吶・蜉ｹ邇・喧繝ｻ謇倶ｽ懈･ｭ縺ｮ蜑頑ｸ媾n竭｢ 莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ縺ｮ髢区･ｭ繝ｻ蜿守寢蛹暴n竭｣ 縺昴・莉厄ｼ医＞縺ｾ豌励↓縺ｪ縺｣縺ｦ縺・ｋ縺薙→・噂n\n窶ｻ縺頑･縺弱〒逶ｴ謗･縺願ｩｱ縺輔ｌ縺溘＞譁ｹ縺ｯ縲・0蛻・┌譁吶が繝ｳ繝ｩ繧､繝ｳ髱｢隲・ｂ縺比ｺ育ｴ・＞縺溘□縺代∪縺吶・n{booking_url}',
  tag: '驕ｸ謚・蛟句挨逶ｸ隲・,
  targetBranch: 'consult',
  enabled: true,
};

const DEFAULT_KEYWORD_RULES: KeywordAutoReply[] = [
  RICHMENU_LINE_CONSULT_RULE,
  {
    id: 'kw-diagnosis',
    name: '縲瑚ｨｺ譁ｭ縲阪檎ｵ悟霧險ｺ譁ｭ縲埼∽ｿ｡譎・,
    matchText: '險ｺ譁ｭ',
    matchMode: 'contains',
    replyText: '辟｡譁咏ｵ悟霧險ｺ譁ｭ縺ｮ縺疲｡亥・縺ｧ縺吶・n莉･荳九・URL繧医ｊ邏・蛻・〒縺泌屓遲斐＞縺溘□縺代∪縺吶ょ屓遲泌女鬆伜ｾ後∝､ｧ讖狗悄莠ｺ繧医ｊ蟆ゆｻｻ繝ｬ繝昴・繝医ｒ縺雁ｱ翫￠縺励∪縺吶・n\n笆ｼ 3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ縺ｯ縺薙■繧噂n{link_url}',
    tag: '驕ｸ謚・險ｺ譁ｭ',
    targetBranch: 'diagnosis',
    enabled: true,
  },
  {
    id: 'kw-consult',
    name: '縲檎嶌隲・阪碁擇隲・阪御ｺ育ｴ・埼∽ｿ｡譎・,
    matchText: '逶ｸ隲・,
    matchMode: 'contains',
    replyText: '蛟句挨逶ｸ隲・・縺泌ｸ梧悍縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺呻ｼ―n荳玖ｨ倥・譌･遞玖ｪｿ謨ｴ繧ｫ繝ｬ繝ｳ繝繝ｼ繧医ｊ縲√＃驛ｽ蜷医・繧医＞譌･譎ゅｒ縺企∈縺ｳ縺上□縺輔＞・・0蛻・・繧ｪ繝ｳ繝ｩ繧､繝ｳ・峨・n\n笆ｼ 髱｢隲・律遞九・驕ｸ謚槭・縺薙■繧噂n{booking_url}',
    tag: '驕ｸ謚・蛟句挨逶ｸ隲・,
    targetBranch: 'consult',
    enabled: true,
  },
  {
    id: 'kw-care',
    name: '縲御ｻ玖ｭｷ縲阪御ｿ晞匱螟悶阪碁幕讌ｭ縲埼∽ｿ｡譎・,
    matchText: '莉玖ｭｷ',
    matchMode: 'contains',
    replyText: '莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ縺ｮ髢区･ｭ繝ｻ莠区･ｭ螻暮幕縺ｫ縺､縺・※縺ｮ縺皮嶌隲・≠繧翫′縺ｨ縺・＃縺悶＞縺ｾ縺呻ｼ―n閾ｪ雋ｻ繝ｪ繝上ン繝ｪ繝ｻ閾ｪ雋ｻ逵玖ｭｷ遲峨・遶九■荳翫￡縺ｧ縺ｯ縲∵署萓帙Γ繝九Η繝ｼ縺ｮ險ｭ險医→蝨ｰ蝓滄寔螳｢縺梧・蜉溘・骰ｵ縺ｨ縺ｪ繧翫∪縺吶・n\n蟆ゆｻｻ繝√・繝�繧医ｊ譛驕ｩ縺ｪ髢区･ｭ繝代ャ繧ｱ繝ｼ繧ｸ譯亥・繧偵♀螻翫￠縺励∪縺吶・,
    tag: '莉玖ｭｷ菫晞匱螟夜幕讌ｭ',
    targetBranch: 'care',
    enabled: true,
  },
  {
    id: 'kw-pricing',
    name: '縲梧侭驥代阪瑚ｲｻ逕ｨ縲阪御ｾ｡譬ｼ縲埼∽ｿ｡譎・,
    matchText: '譁咎≡',
    matchMode: 'contains',
    replyText: 'MST縺ｮ繧ｵ繝ｼ繝薙せ譁咎≡繝ｻ蝣ｱ驟ｬ菴鍋ｳｻ縺ｫ縺､縺・※縺ｮ縺雁撫縺・粋繧上○縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺吶・n\n莨∵･ｭ縺ｮ隕乗ｨ｡繧・隼蝟・ヵ繧ｧ繝ｼ繧ｺ縺ｫ蠢懊§縺滓怦鬘阪・繝ｩ繝ｳ縺翫ｈ縺ｳ謌先棡騾｣蜍戊ｨｭ險医ｒ縺皮畑諢上＠縺ｦ縺翫ｊ縺ｾ縺吶・n縺ｾ縺壹・雋ｴ遉ｾ縺ｮ迴ｾ迥ｶ繧偵・蛻・┌譁呵ｨｺ譁ｭ縲代∪縺溘・縲・0蛻・┌譁吶が繝ｳ繝ｩ繧､繝ｳ逶ｸ隲・代↓縺ｦ縺願◇縺九○縺上□縺輔＞縲・n\n笆ｼ 3蛻・┌譁呵ｨｺ譁ｭ\n{link_url}',
    tag: '髢｢蠢・譁咎≡',
    targetBranch: 'general',
    enabled: true,
  },
  {
    id: 'kw-material',
    name: '縲瑚ｳ・侭縲阪後ヱ繝ｳ繝輔Ξ繝・ヨ縲埼∽ｿ｡譎・,
    matchText: '雉・侭',
    matchMode: 'contains',
    replyText: 'MST縺ｮ莨夂､ｾ譯亥・繝ｻ繧ｵ繝ｼ繝薙せ讎りｦ∬ｳ・侭縺ｮ縺碑ｫ区ｱゅ≠繧翫′縺ｨ縺・＃縺悶＞縺ｾ縺吶・n荳玖ｨ倥Μ繝ｳ繧ｯ繧医ｊ譛譁ｰ縺ｮ莨夂､ｾ讎りｦ￣DF繧帝夢隕ｧ縺・◆縺�縺代∪縺吶・n\n笆ｼ 莨夂､ｾ譯亥・繝ｻ繧ｵ繝ｼ繝薙せ雉・侭\nhttps://corp.mstcorp.info/materials',
    tag: '雉・侭隲区ｱ・,
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
  onApplyMaterialStarterSet,
  onApplyPostMeetingStarterSet,
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

  // 笏笏笏 LINE繧ｦ繧ｧ繝ｫ繧ｫ繝�繝ｻ蛻・ｲ舌ヱ繧ｿ繝ｼ繝ｳA/B險ｭ螳夂畑迥ｶ諷具ｼ亥腰荳縺ｮ豁｣譛ｬ / Single source of truth・・笏笏笏
  const [welcomeHeading, setWelcomeHeading] = useState('螟ｧ讖狗悄莠ｺ縺ｧ縺吶・);
  const [welcomeSubheading, setWelcomeSubheading] = useState('LINE逋ｻ骭ｲ縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺吶・);
  const [welcomeIntro, setWelcomeIntro] = useState(
    'MST縺ｧ縺ｯ縲∽ｸｭ蟆丈ｼ∵･ｭ縺ｮ\n縲檎ｵ悟霧縺ｮ莉慕ｵ・∩蛹姪怜茜逶頑隼蝟・阪→\n莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ縺ｮ髢区･ｭ繧呈髪謠ｴ縺励※縺・∪縺吶・
  );
  const [welcomeQuestion, setWelcomeQuestion] = useState('縺ｾ縺壹√←縺ｮ繧医≧縺ｪ縺皮嶌隲・ｒ縺泌ｸ梧悍縺ｧ縺吶°・・);
  const [welcomeInstruction, setWelcomeInstruction] = useState('縺泌ｸ梧悍縺ｫ霑代＞繧ゅ・繧偵♀驕ｸ縺ｳ縺上□縺輔＞');

  // 驕ｸ謚櫁い・医・繧ｿ繝ｳ譁・擇繝ｻ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝ｻ濶ｲ・・  const [welcomeChoices, setWelcomeChoices] = useState<Array<WelcomeChoice & { actionType?: 'postback' | 'uri'; uri?: string; color?: string }>>([
    { id: 'diagnosis', label: '�投 3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ繧貞女縺代ｋ', tag: '驕ｸ謚・險ｺ譁ｭ', route: 'form', formSlug: 'business-diagnosis', actionType: 'postback', color: '#10B981' },
    { id: 'consult', label: '�欄・・邨悟霧謾ｹ蝟・↓縺､縺・※蛟句挨逶ｸ隲・☆繧・, tag: '驕ｸ謚・蛟句挨逶ｸ隲・, route: 'chat', actionType: 'postback', color: '#1E3A5F' },
    { id: 'care', label: '�諺 莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ縺ｮ髢区･ｭ逶ｸ隲・, tag: '莉玖ｭｷ菫晞匱螟夜幕讌ｭ', route: 'care_interactive', actionType: 'postback', color: '#0284C7' },
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
  
  // Flex邱ｨ髮・Δ繝ｼ繝・ 'visual' (蜷・�・岼・・・繧ｿ繝ｳ險ｭ螳・ | 'json' (Flex Bubble/Carousel JSON逶ｴ謗･邱ｨ髮・
  const [flexEditMode, setFlexEditMode] = useState<'visual' | 'json'>('visual');
  const [customFlexJson, setCustomFlexJson] = useState<string>('');
  const [previewType, setPreviewType] = useState<'card' | 'line_official'>('card');

  // 繝薙ず繝･繧｢繝ｫ險ｭ螳壹°繧鵜INE Flex Bubble JSON繧堤ｵ・∩遶九※繧矩未謨ｰ
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
            label: (c.label || `驕ｸ謚櫁い ${i + 1}`).slice(0, 20),
            uri: (c.uri || 'https://corp.mstcorp.info').trim(),
          }
        : {
            type: 'postback',
            label: (c.label || `驕ｸ謚櫁い ${i + 1}`).slice(0, 20),
            data: c.tag ? `tag=${encodeURIComponent(c.tag)}&wc=${c.id}` : `wc=${c.id}`,
            displayText: c.label || `驕ｸ謚櫁い ${i + 1}`,
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
      textItems.push({ type: 'text', text: '蜿九□縺｡霑ｽ蜉�縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺吶・, size: 'md', align: 'center', color: '#1E293B', wrap: true });
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

  // 蛻・ｲ植・郁ｨｺ譁ｭ譯亥・繧ｫ繝ｼ繝会ｼ峨・繝ｬ繝薙Η繝ｼ逕ｨFlex逕滓・
  const buildPatternDiagnosisFlexBubble = (cfg: WelcomePatternDiagnosisConfig) => {
    const sampleName = PLACEHOLDER_SAMPLE_VALUES.recipient_name || '譬ｪ蠑丈ｼ夂､ｾ繧ｵ繝ｳ繝励Ν 諡・ｽ楢・;
    const bodyText = renderPlaceholders(cfg.body, { ...PLACEHOLDER_SAMPLE_VALUES, recipient_name: sampleName });
    const btnLabel = (cfg.buttonLabel || '險ｺ譁ｭ繧貞ｧ九ａ繧具ｼ育ｴ・蛻・ｼ・).trim().slice(0, 20);
    const targetUri = upgradeLegacyMstUrl(cfg.diagnosisUrl || OFFICIAL_VERCEL_URLS.diagnosis, 'diagnosis') || OFFICIAL_VERCEL_URLS.diagnosis;
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: cfg.title || '�投 3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ', weight: 'bold', size: 'lg', color: '#1E293B', wrap: true },
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

  // 繝代ち繝ｼ繝ｳA繝励Ξ繝薙Η繝ｼ逕ｨFlex逕滓・
  const buildPatternAFlexBubble = (cfg: WelcomePatternAConfig) => {
    const sampleName = PLACEHOLDER_SAMPLE_VALUES.recipient_name || '譬ｪ蠑丈ｼ夂､ｾ繧ｵ繝ｳ繝励Ν 諡・ｽ楢・;
    const greetingText = renderPlaceholders(cfg.greetingBody, { ...PLACEHOLDER_SAMPLE_VALUES, recipient_name: sampleName });
    const bookingLabel = (cfg.bookingButtonLabel || '').trim().slice(0, 20);
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: cfg.title || '�欄・・邨悟霧謾ｹ蝟・・蛟句挨逶ｸ隲・, weight: 'bold', size: 'lg', color: '#1E293B', wrap: true },
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

  // 繝代ち繝ｼ繝ｳB繝励Ξ繝薙Η繝ｼ逕ｨFlex逕滓・
  const buildPatternBFlexBubble = (cfg: WelcomePatternBConfig, step: 'q1' | 'q2' | 'completion') => {
    const sampleName = PLACEHOLDER_SAMPLE_VALUES.recipient_name || '譬ｪ蠑丈ｼ夂､ｾ繧ｵ繝ｳ繝励Ν 諡・ｽ楢・;
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
                label: (c.label || `驕ｸ謚櫁い${idx + 1}`).slice(0, 20),
                data: `care_q1=${c.value}`,
                displayText: c.displayText || c.label,
              },
            })),
          ],
        },
      };
    }
    if (step === 'q2') {
      const sampleQ1 = cfg.q1.choices[0]?.label || '譌｢蟄倥・莉玖ｭｷ繝ｻ遖冗･我ｺ区･ｭ閠・;
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
                label: (c.label || `繝・・繝・{idx + 1}`).slice(0, 20),
                data: `care_q2=existing:${c.value}`,
                displayText: c.displayText || c.label,
              },
            })),
          ],
        },
      };
    }
    const sampleQ1 = cfg.q1.choices[0]?.label || '譌｢蟄倥・莉玖ｭｷ繝ｻ遖冗･我ｺ区･ｭ閠・;
    const sampleQ2 = cfg.q2.choices[0]?.label || '蜿守寢繝｢繝・Ν繝ｻ譁咎≡險ｭ螳・;
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
              { type: 'text', text: `繝ｻ迴ｾ蝨ｨ縺ｮ迥ｶ豕・ ${sampleQ1}`, size: 'xs', color: '#0369A1', weight: 'bold', wrap: true },
              { type: 'text', text: `繝ｻ髢｢蠢・ユ繝ｼ繝・ ${sampleQ2}`, size: 'xs', color: '#0369A1', weight: 'bold', margin: 'xs', wrap: true },
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

  // Flex JSON 縺ｮ讒区枚讀懆ｨｼ
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

  // Supabase / API 縺九ｉ繧ｦ繧ｧ繝ｫ繧ｫ繝�險ｭ螳壹ｒ繝ｭ繝ｼ繝会ｼ亥腰荳豁｣譛ｬ: __welcome__・・  useEffect(() => {
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
              const legacyLabels = ['�諺 莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ髢区･ｭ繧堤衍繧・, '�諺 莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ髢区･ｭ繝代ャ繧ｱ繝ｼ繧ｸ縺ｫ縺､縺・※遏･繧・, '莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ髢区･ｭ繝代ャ繧ｱ繝ｼ繧ｸ縺ｫ縺､縺・※遏･繧・];
              const legacyTags = ['care:髢区･ｭ逶ｸ隲・, '驕ｸ謚・髢区･ｭ繝代ャ繧ｱ繝ｼ繧ｸ'];
              return {
                ...c,
                label: legacyLabels.includes(c.label) ? '�諺 莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ縺ｮ髢区･ｭ逶ｸ隲・ : c.label,
                tag: legacyTags.includes(c.tag) || !c.tag ? '莉玖ｭｷ菫晞匱螟夜幕讌ｭ' : c.tag,
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
        // 繝・く繧ｹ繝亥ｽ｢蠑上・譌ｧ繧ｦ繧ｧ繝ｫ繧ｫ繝�縺檎峩謗･險ｭ螳壹＆繧後※縺・◆蝣ｴ蜷医ｂ繝励Ξ繝薙Η繝ｼ縺ｸ蜿肴丐
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
            // API譛ｪ謗･邯壽凾縺ｯ逶ｴ謗･Supabase繧ｯ繧ｨ繝ｪ縺ｫ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
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
          .in('match_text', ['蜿九□縺｡霑ｽ蜉�', '繧ｦ繧ｧ繝ｫ繧ｫ繝�', '縺ゅ＞縺輔▽', '謖ｨ諡ｶ']);
        if (Array.isArray(legacyRows)) {
          setConflictingLegacyRules(legacyRows);
        }
      } catch (e) {
        console.warn('Welcome load error in FlowStudio:', e);
      }
    };
    void loadWelcome();
  }, [db]);

  // 繧ｦ繧ｧ繝ｫ繧ｫ繝�・・・蟯舌ヱ繧ｿ繝ｼ繝ｳA/B險ｭ螳壹・荳諡ｬ菫晏ｭ假ｼ亥腰荳縺ｮ豁｣譛ｬ縺ｫ邨ｱ蜷井ｿ晏ｭ假ｼ・  const handleSaveWelcome = async (successMessage?: string, overrideEnabled?: boolean) => {
    if (!db) return;
    setWelcomeSaving(true);
    setWelcomeNotice('');
    setWelcomeError('');
    try {
      const { data: sessionData } = await db.auth.getSession();
      const ownerId = sessionData.session?.user?.id;
      const token = sessionData.session?.access_token;
      if (!ownerId) throw new Error('繝ｭ繧ｰ繧､繝ｳ繧ｻ繝・す繝ｧ繝ｳ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ');

      const effectiveEnabled = overrideEnabled !== undefined ? overrideEnabled : welcomeEnabled;

      let finalContents: any;
      let parsedCustomEnvelopeAltText = '';
      if (flexEditMode === 'json' && customFlexJson.trim()) {
        let parsedJson: any;
        try {
          parsedJson = JSON.parse(customFlexJson);
        } catch (jsonErr: any) {
          throw new Error('Flex JSON縺ｮ讒区枚繧ｨ繝ｩ繝ｼ縺ｧ縺吶よｭ｣縺励＞JSON繧貞・蜉帙＠縺ｦ縺上□縺輔＞: ' + (jsonErr?.message || ''));
        }
        if (parsedJson?.type === 'flex' && parsedJson?.contents && ['bubble', 'carousel'].includes(parsedJson.contents.type)) {
          parsedCustomEnvelopeAltText = typeof parsedJson.altText === 'string' ? parsedJson.altText.trim() : '';
          finalContents = parsedJson.contents;
        } else if (parsedJson && typeof parsedJson === 'object' && ['bubble', 'carousel'].includes(parsedJson.type)) {
          finalContents = parsedJson;
        } else {
          throw new Error('Flex JSON縺ｮ繝ｫ繝ｼ繝郁ｦ∫ｴ�縺ｯ "type": "bubble" 縺ｾ縺溘・ "carousel"・医∪縺溘・ "type": "flex" + contents・峨〒縺ゅｋ蠢・ｦ√′縺ゅｊ縺ｾ縺吶・);
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
        ? (parsedCustomEnvelopeAltText || extractFirstTextFromFlex(finalContents) || '蜿九□縺｡霑ｽ蜉�縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺・).slice(0, 400)
        : ([welcomeHeading, welcomeSubheading].filter((s) => s && s.trim()).join(' ') || '蜿九□縺｡霑ｽ蜉�縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺・).slice(0, 400);

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
          throw new Error(errJson?.error || `繧ｵ繝ｼ繝舌・菫晏ｭ倥お繝ｩ繝ｼ (${apiResp.status})`);
        }
      }

      if (!savedViaApi) {
        const nowIso = new Date().toISOString();
        const rowData = {
          owner_id: ownerId,
          name: '蜿九□縺｡霑ｽ蜉�繧ｦ繧ｧ繝ｫ繧ｫ繝�Flex繝｡繝・そ繝ｼ繧ｸ',
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
          name: '蜿九□縺｡霑ｽ蜉�繧ｦ繧ｧ繝ｫ繧ｫ繝�Flex繝｡繝・そ繝ｼ繧ｸ',
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
      setWelcomeNotice(successMessage || 'LINE繧ｦ繧ｧ繝ｫ繧ｫ繝�繝ｻ蛻・ｲ占ｿ比ｿ｡險ｭ螳壹ｒ菫晏ｭ倥＠縺ｾ縺励◆・´INE蜈ｬ蠑上い繧ｫ繧ｦ繝ｳ繝医∈蜊ｳ譎ょ渚譏�縺輔ｌ縺ｾ縺吶・);
      setIsEditingWelcome(false);
      setIsEditingPatternDiagnosis(false);
      setIsEditingPatternA(false);
      setIsEditingPatternB(false);
      setTimeout(() => setWelcomeNotice(''), 5000);
    } catch (err: any) {
      setWelcomeError(`菫晏ｭ倥お繝ｩ繝ｼ: ${err?.message || '荳肴・縺ｪ繧ｨ繝ｩ繝ｼ'}`);
    } finally {
      setWelcomeSaving(false);
    }
  };

  const handleToggleWelcomeEnabled = async (nextEnabled: boolean) => {
    setWelcomeEnabled(nextEnabled);
    await handleSaveWelcome(
      nextEnabled
        ? '蜿九□縺｡霑ｽ蜉�繧ｦ繧ｧ繝ｫ繧ｫ繝�繝｡繝・そ繝ｼ繧ｸ縺ｮ閾ｪ蜍暮∽ｿ｡繧呈怏蜉ｹ縺ｫ縺励※菫晏ｭ倥＠縺ｾ縺励◆縲・
        : '蜿九□縺｡霑ｽ蜉�繧ｦ繧ｧ繝ｫ繧ｫ繝�繝｡繝・そ繝ｼ繧ｸ縺ｮ閾ｪ蜍暮∽ｿ｡繧貞●豁｢縺励∪縺励◆縲・,
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
          .in('match_text', ['蜿九□縺｡霑ｽ蜉�', '繧ｦ繧ｧ繝ｫ繧ｫ繝�', '縺ゅ＞縺輔▽', '謖ｨ諡ｶ'])
          .eq('enabled', true);
        if (error) throw error;
      }
      setConflictingLegacyRules([]);
      setWelcomeNotice('譌ｧ繧ｦ繧ｧ繝ｫ繧ｫ繝�髢｢騾｣繝ｫ繝ｼ繝ｫ繧貞●豁｢縺励∪縺励◆縲ゆｻ雁ｾ後・LINE繝ｻ繝｡繝ｼ繝ｫ閾ｪ蜍暮・菫｡縺ｮ險ｭ螳壹・縺ｿ縺碁∽ｿ｡縺輔ｌ縺ｾ縺吶・);
      setTimeout(() => setWelcomeNotice(''), 5000);
    } catch (err: any) {
      setWelcomeError(`譌ｧ繝ｫ繝ｼ繝ｫ蛛懈ｭ｢繧ｨ繝ｩ繝ｼ: ${err?.message || '荳肴・縺ｪ繧ｨ繝ｩ繝ｼ'}`);
    } finally {
      setDisablingLegacy(false);
    }
  };

  // 繧ｭ繝ｼ繝ｯ繝ｼ繝芽・蜍募ｿ懃ｭ斐Ν繝ｼ繝ｫ逕ｨ迥ｶ諷・  const [keywordRules, setKeywordRules] = useState<KeywordAutoReply[]>(DEFAULT_KEYWORD_RULES);
  const [isEditingKeywordModal, setIsEditingKeywordModal] = useState(false);
  const [editingRule, setEditingRule] = useState<KeywordAutoReply | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleMode, setRuleMode] = useState<'contains' | 'exact'>('contains');
  const [ruleReply, setRuleReply] = useState('');
  const [ruleTag, setRuleTag] = useState('');
  const [ruleTargetBranch, setRuleTargetBranch] = useState<'diagnosis' | 'consult' | 'care' | 'general'>('general');
  const [keywordNotice, setKeywordNotice] = useState('');

  // Supabase line_auto_reply_rules 縺ｮ蜷梧悄
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
            name: r.name || `縲・{r.match_text}縲阪∈縺ｮ蠢懃ｭ覗,
            matchText: r.match_text,
            matchMode: r.match_mode || 'contains',
            replyText: r.reply_text || '',
            tag: r.tag_id || '',
            targetBranch: (r.name?.includes('險ｺ譁ｭ') ? 'diagnosis' : r.name?.includes('逶ｸ隲・) ? 'consult' : r.name?.includes('莉玖ｭｷ') ? 'care' : 'general') as any,
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

  // 繧ｭ繝ｼ繝ｯ繝ｼ繝峨Ν繝ｼ繝ｫ縺ｮ菫晏ｭ・  const handleSaveKeywordRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleKeyword.trim() || !ruleReply.trim()) return;

    const newRule: KeywordAutoReply = {
      id: editingRule?.id || `kw-${Date.now()}`,
      name: ruleName.trim() || `縲・{ruleKeyword.trim()}縲阪∈縺ｮ蠢懃ｭ覗,
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
            setWelcomeError(`繧ｭ繝ｼ繝ｯ繝ｼ繝峨Ν繝ｼ繝ｫ菫晏ｭ倥お繝ｩ繝ｼ: ${res.error.message}`);
            return;
          }
          if (res.data?.id && res.data.id !== newRule.id) {
            setKeywordRules((prev) => prev.map((r) => (r.id === newRule.id ? { ...r, id: res.data.id } : r)));
          }
        }
      } catch (err: any) {
        console.warn('Supabase rule save warning:', err);
        setWelcomeError(`繧ｭ繝ｼ繝ｯ繝ｼ繝峨Ν繝ｼ繝ｫ菫晏ｭ倥お繝ｩ繝ｼ: ${err?.message || '荳肴・縺ｪ繧ｨ繝ｩ繝ｼ'}`);
        return;
      }
    }

    setKeywordNotice(`繧ｭ繝ｼ繝ｯ繝ｼ繝芽・蜍募ｿ懃ｭ斐・{newRule.matchText}縲阪ｒ菫晏ｭ倥＠縺ｾ縺励◆縲Ａ);
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
            setWelcomeError(`繝ｪ繝・メ繝｡繝九Η繝ｼ逕ｨ繝ｫ繝ｼ繝ｫ縺ｮ逋ｻ骭ｲ繧ｨ繝ｩ繝ｼ: ${res.error.message}`);
            return;
          }
          if (res.data?.id) {
            createdRule = { ...createdRule, id: res.data.id };
          }
        }
      } catch (err: any) {
        console.warn('Rich menu consult rule insert warning:', err);
        setWelcomeError(`繝ｪ繝・メ繝｡繝九Η繝ｼ逕ｨ繝ｫ繝ｼ繝ｫ縺ｮ逋ｻ骭ｲ繧ｨ繝ｩ繝ｼ: ${err?.message || '荳肴・縺ｪ繧ｨ繝ｩ繝ｼ'}`);
        return;
      }
    }

    setKeywordRules((prev) => {
      const filtered = prev.filter((r) => r.matchText.trim() !== RICHMENU_LINE_CONSULT_RULE.matchText);
      return [createdRule, ...filtered];
    });
    setKeywordNotice(`繝ｪ繝・メ繝｡繝九Η繝ｼ縲鍬INE逶ｸ隲・咲畑繝ｫ繝ｼ繝ｫ・・{RICHMENU_LINE_CONSULT_RULE.matchText}・峨ｒ逋ｻ骭ｲ縺励∪縺励◆縲Ａ);
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
    setKeywordNotice(`繧ｭ繝ｼ繝ｯ繝ｼ繝峨・{target?.matchText || ''}縲阪ｒ蜑企勁縺励∪縺励◆縲Ａ);
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
        setWelcomeError(`繝ｫ繝ｼ繝ｫ蛻・崛繧ｨ繝ｩ繝ｼ: ${error.message}`);
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
        setWelcomeError(`繝ｫ繝ｼ繝ｫ菫晏ｭ倥お繝ｩ繝ｼ: ${res.error.message}`);
        return;
      }
      if (res.data?.id) {
        setKeywordRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, id: res.data.id } : r))
        );
      }
    } catch (err: any) {
      setWelcomeError(`繝ｫ繝ｼ繝ｫ菫晏ｭ倥お繝ｩ繝ｼ: ${err?.message || '荳肴・縺ｪ繧ｨ繝ｩ繝ｼ'}`);
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

  // 繝薙Η繝ｼ繝｢繝ｼ繝牙・繧頑崛縺・ 'flow' (繝薙ず繝･繧｢繝ｫ蟆守ｷ壹・繝・・) 縺ｾ縺溘・ 'table' (蜈ｨ繧ｹ繝・ャ繝嶺ｸ隕ｧ繝・・繝悶Ν)
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
  const [tableChannelFilter, setTableChannelFilter] = useState<'all' | 'line' | 'email' | 'both'>('all');
  const [tableTrackFilter, setTableTrackFilter] = useState<'all' | ScenarioTrackCategory>('all');
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [tableGroupByTrack, setTableGroupByTrack] = useState<boolean>(true);
  const [isStarterOpen, setIsStarterOpen] = useState(false);
  const [showOutreachSpec, setShowOutreachSpec] = useState(false);

  // 繧ｹ繝・ャ繝励う繝ｳ繧ｹ繝壹け繧ｿ繝ｼ / 邱ｨ髮・Δ繝ｼ繝繝ｫ迥ｶ諷・  const [inspectorScenario, setInspectorScenario] = useState<MarketingScenario | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const sortedAllScenarios = useMemo(() => sortScenarios(scenarios), [scenarios]);

  const legacyPostMeetingScenarios = useMemo(
    () => scenarios.filter((s) => isLegacyPostMeetingScenarioName(s.name || '')),
    [scenarios]
  );

  const tableTrackCounts = useMemo(() => {
    const counts: Record<ScenarioTrackCategory, number> = {
      branch_diagnosis: 0,
      branch_consult: 0,
      branch_care: 0,
      story_nurturing: 0,
      material_followup: 0,
      post_meeting: 0,
      sales_outreach: 0,
      other: 0,
    };
    for (const s of sortedAllScenarios) {
      counts[classifyScenarioTrack(s)]++;
    }
    return counts;
  }, [sortedAllScenarios]);

  const filteredTableScenarios = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return sortedAllScenarios.filter((s) => {
      if (tableTrackFilter !== 'all' && classifyScenarioTrack(s) !== tableTrackFilter) {
        return false;
      }
      if (tableChannelFilter !== 'all' && s.channel !== tableChannelFilter) {
        return false;
      }
      if (tableStatusFilter === 'active' && !s.automationEnabled) {
        return false;
      }
      if (tableStatusFilter === 'paused' && s.automationEnabled) {
        return false;
      }
      if (!q) return true;
      const triggerText = formatScenarioTriggerLabel(s.trigger, s.targetTag).toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.messageBody || '').toLowerCase().includes(q) ||
        (s.emailSubject || '').toLowerCase().includes(q) ||
        (s.flexTitle || '').toLowerCase().includes(q) ||
        (s.targetTag || '').toLowerCase().includes(q) ||
        triggerText.includes(q)
      );
    });
  }, [sortedAllScenarios, tableTrackFilter, tableChannelFilter, tableStatusFilter, tableSearch]);

  const groupedTableSections = useMemo(() => {
    const map = new Map<ScenarioTrackCategory, MarketingScenario[]>();
    for (const trackId of SCENARIO_TRACK_ORDER) {
      map.set(trackId, []);
    }
    for (const s of filteredTableScenarios) {
      const track = classifyScenarioTrack(s);
      map.get(track)?.push(s);
    }
    return SCENARIO_TRACK_ORDER
      .map((trackId) => ({
        meta: SCENARIO_TRACK_META[trackId],
        items: map.get(trackId) || [],
      }))
      .filter((section) => section.items.length > 0);
  }, [filteredTableScenarios]);

  const isMaterialFollowupScenario = (s: MarketingScenario) =>
    s.trigger === 'material_requested' || s.name.includes('縲占ｳ・侭隲区ｱ・);

  const isPostMeetingFollowupScenario = (s: MarketingScenario) =>
    isPostDealStageTrigger(s.trigger) ||
    s.name.includes('縲宣擇隲・ｾ・) ||
    s.name.includes('縲先署譯域嶌騾∽ｻ伜ｾ・) ||
    s.name.includes('縲舌Ξ繝昴・繝茨ｼ・署譯域嶌') ||
    s.name.includes('縲舌Ξ繝昴・繝亥ｾ・) ||
    s.name.includes('縲先署譯亥ｾ・);

  const isSalesOutreachScenario = (s: MarketingScenario) =>
    s.id === ONE_SHOT_SCENARIO_ID ||
    s.name.includes('荳逋ｺ逶ｴ逅・) ||
    s.name.includes('蝟ｶ讌ｭ繝｡繝ｼ繝ｫ') ||
    s.name.includes('縲仙霧讌ｭ') ||
    s.trigger === 'outreach_first_sent' ||
    (s.channel === 'email' &&
      (s.trigger === 'lead_created' || (s.trigger === 'manual' && /^縲千ｬｬ\d+騾・.test(s.name || ''))));

  // 繧ｷ繝翫Μ繧ｪ縺ｮ蛻・｡橸ｼ磯㍾隍・↑縺丞・蟯植 / B / C / 蜈ｱ騾壽蕗閧ｲ / 蝟ｶ讌ｭ繝｡繝ｼ繝ｫ / 雉・侭隲区ｱょｾ・/ 髱｢隲・・謠先｡亥ｾ後∈謖ｯ繧雁・縺托ｼ・  const diagnosisScenarios = useMemo(() => {
    const extractStepNumber = (name: string) => {
      const m = (name || '').match(/[縲撰ｼｻ\[A]*\s*(\d+)/) || (name || '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 999;
    };
    return scenarios
      .filter(s =>
        !isMaterialFollowupScenario(s) &&
        !isPostMeetingFollowupScenario(s) &&
        !isSalesOutreachScenario(s) &&
        (
          s.name.includes('縲植') ||
          s.name.includes('險ｺ譁ｭ') ||
          s.trigger.startsWith('diagnosis_') ||
          s.trigger.startsWith('report_') ||
          s.targetTag === '驕ｸ謚・險ｺ譁ｭ' ||
          isLegacyBranchAScenarioName(s.name || '')
        )
      )
      .sort((a, b) => {
        const legacyA = isLegacyBranchAScenarioName(a.name || '') ? 1 : 0;
        const legacyB = isLegacyBranchAScenarioName(b.name || '') ? 1 : 0;
        if (legacyA !== legacyB) return legacyA - legacyB;
        const stepA = extractStepNumber(a.name || '');
        const stepB = extractStepNumber(b.name || '');
        if (stepA !== stepB) return stepA - stepB;
        return (a.waitMinutes || 0) - (b.waitMinutes || 0);
      });
  }, [scenarios]);

  const legacyDiagnosisScenarios = useMemo(
    () => diagnosisScenarios.filter((s) => isLegacyBranchAScenarioName(s.name || '')),
    [diagnosisScenarios]
  );

  const handleCleanupLegacyDiagnosisScenarios = () => {
    if (onApplyDiagnosisStarterSet) {
      onApplyDiagnosisStarterSet();
      return;
    }
    const cleaned = scenarios.filter((s) => !isLegacyBranchAScenarioName(s.name || ''));
    onScenariosChange(cleaned);
    setKeywordNotice('譌ｧ繝舌・繧ｸ繝ｧ繝ｳ縺ｮ蛻・ｲ植繧ｷ繝翫Μ繧ｪ繧貞炎髯､縺励∪縺励◆縲・);
    setTimeout(() => setKeywordNotice(''), 4000);
  };

  const consultScenarios = useMemo(() => {
    return scenarios.filter(s =>
      !isMaterialFollowupScenario(s) &&
      !isPostMeetingFollowupScenario(s) &&
      (s.name.includes('縲殖') ||
        s.name.includes('逶ｴ逶ｸ隲・) ||
        s.name.includes('蛟句挨逶ｸ隲・) ||
        s.name.includes('髱｢隲・) ||
        s.targetTag === '驕ｸ謚・蛟句挨逶ｸ隲・ ||
        s.trigger.includes('booking') ||
        s.trigger.includes('meeting')) &&
      !s.name.includes('險ｺ譁ｭ') &&
      !s.name.includes('莉玖ｭｷ') &&
      !s.name.includes('縲植') &&
      !s.name.includes('縲燭')
    );
  }, [scenarios]);

  const materialFollowupScenarios = useMemo(() => {
    return scenarios
      .filter(isMaterialFollowupScenario)
      .sort((a, b) => (a.waitMinutes || 0) - (b.waitMinutes || 0));
  }, [scenarios]);

  const postMeetingScenarios = useMemo(() => {
    const triggerOrder: Record<string, number> = {
      meeting_completed: 1,
      report_or_proposal_sent: 2,
      report_approved: 3,
      report_sent: 4,
      proposal_approved: 5,
      proposal_sent: 6,
    };
    return scenarios
      .filter(isPostMeetingFollowupScenario)
      .sort((a, b) => {
        const orderA = triggerOrder[a.trigger] ?? 99;
        const orderB = triggerOrder[b.trigger] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.waitMinutes || 0) - (b.waitMinutes || 0);
      });
  }, [scenarios]);

  const careScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('縲燭') ||
      s.name.includes('莉玖ｭｷ') ||
      s.name.includes('菫晞匱螟・) ||
      s.name.includes('髢区･ｭ') ||
      s.targetTag === '莉玖ｭｷ菫晞匱螟夜幕讌ｭ'
    );
  }, [scenarios]);

  const oneShotScenario = useMemo(() => {
    return scenarios.find(
      (s) => s.id === ONE_SHOT_SCENARIO_ID || s.name.includes('荳逋ｺ逶ｴ逅・)
    ) || null;
  }, [scenarios]);

  const outreachScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.id !== ONE_SHOT_SCENARIO_ID &&
      !s.name.includes('荳逋ｺ逶ｴ逅・) &&
      isSalesOutreachScenario(s)
    );
  }, [scenarios]);

  const nurturingScenarios = useMemo(() => {
    return scenarios.filter(s =>
      s.name.includes('繧ｹ繝医・繝ｪ繝ｼ') ||
      s.name.includes('繝翫・繝√Ε繝ｪ繝ｳ繧ｰ') ||
      s.name.includes('隧ｱ縲・) ||
      s.name.includes('螟ｧ讖・)
    );
  }, [scenarios]);

  // 繧､繝ｳ繧ｹ繝壹け繧ｿ繝ｼ繧帝幕縺・  const handleOpenInspector = (scenario: MarketingScenario) => {
    setInspectorScenario(scenario);
    setIsInspectorOpen(true);
  };

  const handleOpenOneShotEditor = () => {
    const rawDefault = getOneShotOutreachTemplate('{company_name}', '{recipient_name}', undefined, '{link_url}');
    const target: MarketingScenario = oneShotScenario || {
      id: ONE_SHOT_SCENARIO_ID,
      name: ONE_SHOT_SCENARIO_NAME,
      trigger: 'manual',
      channel: 'email',
      audience: '譛ｪ謗･隗ｦ縺ｮ隕玖ｾｼ縺ｿ莨∵･ｭ・井ｸ逋ｺ逶ｴ逅・署譯茨ｼ・,
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
      consentBasis: '迚ｹ螳夐崕蟄舌Γ繝ｼ繝ｫ豕輔↓蝓ｺ縺･縺乗･ｭ蜍呎隼蝟・ュ蝣ｱ縺ｮ謠蝉ｾ幢ｼ医が繝励ヨ繧｢繧ｦ繝域・險假ｼ・,
      updatedAt: Date.now(),
    };
    handleOpenInspector(target);
  };

  // 譁ｰ隕上せ繝・ャ繝嶺ｽ懈・・育樟蝨ｨ髢九＞縺ｦ縺・ｋ繝医Λ繝・け繝ｻ蛻・ｲ舌↓蜷医ｏ縺帙※蛻晄悄險ｭ螳夲ｼ・  const handleCreateNewStep = () => {
    const isOutreach = activeTrack === 'sales_outreach';
    const isNurturing = activeTrack === 'story_nurturing';
    const isInboundMaterial = activeTrack === 'inbound_material';
    const isConsult = activeTrack === 'line_welcome' && expandedBranch === 'consult';
    const isCare = activeTrack === 'line_welcome' && expandedBranch === 'care';
    const isDiagnosis = activeTrack === 'line_welcome' && expandedBranch === 'diagnosis';

    const defaultChannel: MarketingChannel = isOutreach ? 'email' : (isNurturing || isInboundMaterial) ? 'both' : 'line';
    const defaultTrigger: MarketingTrigger = isOutreach
      ? 'lead_created'
      : isInboundMaterial
      ? 'material_requested'
      : isConsult || isCare || isDiagnosis
      ? 'tag_added'
      : 'line_registered';
    const defaultTargetTag = isConsult
      ? '驕ｸ謚・蛟句挨逶ｸ隲・
      : isCare
      ? '莉玖ｭｷ菫晞匱螟夜幕讌ｭ'
      : isDiagnosis
      ? '驕ｸ謚・險ｺ譁ｭ'
      : undefined;
    const defaultName = isOutreach
      ? '縲仙霧讌ｭ繝｡繝ｼ繝ｫ縲第･ｭ蜍呎隼蝟・・莉慕ｵ・∩蛹悶・縺疲｡亥・'
      : isInboundMaterial
      ? '縲占ｳ・侭隲区ｱゅ代ヵ繧ｩ繝ｭ繝ｼ驟堺ｿ｡繧ｹ繝・ャ繝・
      : isNurturing
      ? '縲仙・騾壽蕗閧ｲ繝ｻ霑ｽ蜉�隧ｱ縲代せ繝医・繝ｪ繝ｼ繝輔か繝ｭ繝ｼ驟堺ｿ｡'
      : isConsult
      ? '縲殖繝ｻ隕ｪ霄ｫ繝輔か繝ｭ繝ｼ縲大句挨逶ｸ隲・・縺疲｡亥・'
      : isCare
      ? '縲燭繝ｻ蟆る摩謨呵ご縲台ｻ玖ｭｷ菫晞匱螟夜幕讌ｭ縺ｮ縺疲｡亥・'
      : isDiagnosis
      ? '縲植繝ｻ謨呵ご縲醍┌譁咏ｵ悟霧險ｺ譁ｭ繝輔か繝ｭ繝ｼ'
      : '縲伸INE縲代ヵ繧ｩ繝ｭ繝ｼ驟堺ｿ｡繧ｹ繝・ャ繝・;

    const newStep: MarketingScenario = {
      id: `step-${Date.now()}`,
      name: defaultName,
      trigger: defaultTrigger,
      targetTag: defaultTargetTag,
      channel: defaultChannel,
      audience: isOutreach ? '譛ｪ謗･隗ｦ縺ｮ隕玖ｾｼ縺ｿ莨∵･ｭ' : isInboundMaterial ? '雉・侭隲区ｱり・ｼ郁ｿ比ｿ｡繝ｻ莠育ｴ・〒蛛懈ｭ｢・・ : 'LINE蜿九□縺｡隕玖ｾｼ縺ｿ螳｢',
      waitMinutes: isOutreach ? 0 : 1440,
      emailSubject: isOutreach || isNurturing || isInboundMaterial ? '縲先怏髯蝉ｼ夂､ｾMST縲題ｳ・侭縺ｮ縺皮｢ｺ隱阪≠繧翫′縺ｨ縺・＃縺悶＞縺ｾ縺・ : '',
      emailBody: isOutreach || isNurturing || isInboundMaterial ? '{recipient_name} 讒禄n\n譛蛾剞莨夂､ｾMST縺ｮ螟ｧ讖九〒縺吶・n縺碑ｫ区ｱゅ＞縺溘□縺・◆雉・侭縺ｯ縺頑焔蜈・〒縺碑ｦｧ縺・◆縺�縺代∪縺励◆縺ｧ縺励ｇ縺・°縲・ : '',
      messageBody: !isOutreach ? '{recipient_name} 讒禄n縺疲｡亥・繧偵♀螻翫￠縺・◆縺励∪縺吶・n\n笆ｼ30蛻・┌譁吶が繝ｳ繝ｩ繧､繝ｳ逶ｸ隲・・縺薙■繧噂n{booking_url}' : '',
      lineMessageType: isInboundMaterial ? 'text' : 'flex',
      lineImageUrl: '',
      linePreviewImageUrl: '',
      flexAltText: '縲舌＃譯亥・縲第･ｭ蜍呎隼蝟・・蛟句挨逶ｸ隲・,
      flexTitle: '譁ｰ縺励＞縺疲｡亥・',
      flexBody: '{recipient_name} 讒禄n縺疲｡亥・繧偵♀螻翫￠縺・◆縺励∪縺吶・,
      flexButtonLabel: '30蛻・嶌隲・ｒ莠育ｴ・☆繧・,
      flexButtonUrl: '{booking_url}',
      status: 'draft',
      automationEnabled: false,
      stopOnBooking: true,
      stopOnDeal: true,
      consentBasis: isOutreach ? '迚ｹ螳夐崕蟄舌Γ繝ｼ繝ｫ豕輔↓蝓ｺ縺･縺乗･ｭ蜍呎隼蝟・ュ蝣ｱ縺ｮ謠蝉ｾ・ : isInboundMaterial ? '雉・侭隲区ｱゅヵ繧ｩ繝ｼ繝�騾∽ｿ｡譎ゅ・蜷梧э縺ｫ蝓ｺ縺･縺・ : 'LINE蜿九□縺｡逋ｻ骭ｲ譎ゅ・蜷梧э縺ｫ蝓ｺ縺･縺・,
      updatedAt: Date.now(),
    };
    setInspectorScenario(newStep);
    setIsInspectorOpen(true);
  };

  // 繧､繝ｳ繧ｹ繝壹け繧ｿ繝ｼ縺九ｉ縺ｮ菫晏ｭ・  const handleSaveInspectorScenario = (saved: MarketingScenario) => {
    const exists = scenarios.some(s => s.id === saved.id);
    const updated = exists
      ? scenarios.map(s => s.id === saved.id ? saved : s)
      : [saved, ...scenarios];
    onScenariosChange(updated);
    setKeywordNotice(`繧ｹ繝・ャ繝励・{saved.name}縲阪・險ｭ螳壹ｒ菫晏ｭ倥＠縺ｾ縺励◆縲Ａ);
    setTimeout(() => setKeywordNotice(''), 4000);
  };

  // 繧､繝ｳ繧ｹ繝壹け繧ｿ繝ｼ縺九ｉ縺ｮ蜑企勁
  const handleDeleteInspectorScenario = (scenarioId: string) => {
    const updated = scenarios.filter(s => s.id !== scenarioId);
    onScenariosChange(updated);
    setKeywordNotice('繧ｹ繝・ャ繝励ｒ蜑企勁縺励∪縺励◆縲・);
    setTimeout(() => setKeywordNotice(''), 3000);
  };

  // 繝医げ繝ｫ閾ｪ蜍暮・菫｡縺ｮ譛牙柑蛹厄ｼ井ｸ譎ょ●豁｢譎ゅ・ status 繧・draft 縺ｫ謌ｻ縺励※繧ｵ繝ｼ繝舌・繧ｨ繝ｳ繧ｭ繝･繝ｼ繧堤｢ｺ螳溘↓豁｢繧√ｋ・・  const toggleScenarioAutomation = (scenarioId: string, currentStatus: boolean) => {
    const nextEnabled = !currentStatus;
    const updated = scenarios.map(s => {
      if (s.id === scenarioId) {
        return {
          ...s,
          automationEnabled: nextEnabled,
          status: nextEnabled ? ('prepared' as const) : ('draft' as const),
          updatedAt: Date.now(),
        };
      }
      return s;
    });
    onScenariosChange(updated);
  };

  const toggleGroupAutomation = (targetScenarios: MarketingScenario[], nextEnabled: boolean) => {
    if (targetScenarios.length === 0) return;
    const targetIds = new Set(targetScenarios.map((s) => s.id));
    const now = Date.now();
    onScenariosChange(
      scenarios.map((s) =>
        targetIds.has(s.id)
          ? {
              ...s,
              automationEnabled: nextEnabled,
              status: nextEnabled ? ('prepared' as const) : ('draft' as const),
              updatedAt: now,
            }
          : s
      )
    );
  };

  return (
    <div className="space-y-6">
      {welcomeError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 flex items-center justify-between">
          <span>{welcomeError}</span>
          <button type="button" onClick={() => setWelcomeError('')} className="text-rose-600 font-bold px-1 cursor-pointer">笨・/button>
        </div>
      )}

      {welcomeNotice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{welcomeNotice}</span>
          <button type="button" onClick={() => setWelcomeNotice('')} className="text-emerald-600 font-bold px-1 cursor-pointer">笨・/button>
        </div>
      )}

      {keywordNotice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{keywordNotice}</span>
          <button type="button" onClick={() => setKeywordNotice('')} className="text-emerald-600 font-bold px-1 cursor-pointer">笨・/button>
        </div>
      )}

      {/* 繧ｳ繝ｳ繝医Ο繝ｼ繝ｫ繝倥ャ繝繝ｼ・・ン繝･繝ｼ蛻・ｊ譖ｿ縺・*/}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-4 h-4 text-purple-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">
              驟堺ｿ｡繧ｷ繝翫Μ繧ｪ ・・蟆守ｷ夂ｮ｡逅・            </h2>
            <span className="text-xs text-slate-500 hidden sm:inline">
              ・郁ｿ比ｿ｡繝ｻ莠育ｴ・′蜈･繧九→閾ｪ蜍暮・菫｡縺ｯ蜊ｳ譎ょ●豁｢縺励∪縺呻ｼ・            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {scenarios.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsStarterOpen(!isStarterOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer whitespace-nowrap"
                >
                  <Zap className="h-3.5 w-3.5 text-purple-600" />
                  <span>蛻晄悄繧ｻ繝・ヨ繝ｻ謨ｴ逅・/span>
                  {duplicateCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                  {isStarterOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                {isStarterOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-white border border-slate-200 shadow-lg p-2.5 z-30 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 px-2 py-0.5">繝励Μ繧ｻ繝・ヨ繝ｻ陬懷勧謫堺ｽ・/div>
                    {duplicateCount > 0 && onDeduplicateScenarios && (
                      <button
                        type="button"
                        onClick={() => { onDeduplicateScenarios(); setIsStarterOpen(false); }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>驥崎､・す繝翫Μ繧ｪ繧呈紛逅・/span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">{duplicateCount}莉ｶ</span>
                      </button>
                    )}
                    {onApplyAllStarterSets && (
                      <button
                        type="button"
                        onClick={() => { onApplyAllStarterSets(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition cursor-pointer text-left"
                      >
                        <Zap className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span>蜈ｨ蜈ｬ蠑上・繝ｪ繧ｻ繝・ヨ繧呈怙譁ｰ蛹・/span>
                      </button>
                    )}
                    {onApplyDiagnosisStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyDiagnosisStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer text-left"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>蛻・ｲ植: 邁｡譏楢ｨｺ譁ｭﾃ玲蕗閧ｲ4譛ｬ繧帝←逕ｨ</span>
                      </button>
                    )}
                    {onApplyMaterialStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyMaterialStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition cursor-pointer text-left"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                        <span>雉・侭隲区ｱょｾ・ 閾ｪ蜍戊ｿｽ螳｢3譛ｬ繧帝←逕ｨ</span>
                      </button>
                    )}
                    {onApplyPostMeetingStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyPostMeetingStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition cursor-pointer text-left"
                      >
                        <UserCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>髱｢隲・・謠先｡亥ｾ・ 邨ｱ蜷医ヵ繧ｩ繝ｭ繝ｼ3譛ｬ繧帝←逕ｨ</span>
                      </button>
                    )}
                    {onApplyDirectConsultStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyDirectConsultStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition cursor-pointer text-left"
                      >
                        <Calendar className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                        <span>蛻・ｲ殖繝ｻC: 逶ｸ隲・・莉玖ｭｷ繝輔か繝ｭ繝ｼ驕ｩ逕ｨ</span>
                      </button>
                    )}
                    {onApplyLineNurturingStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyLineNurturingStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition cursor-pointer text-left"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span>蜈ｱ騾壽蕗閧ｲ: 繧ｹ繝医・繝ｪ繝ｼ7隧ｱ繧帝←逕ｨ</span>
                      </button>
                    )}
                    {onApplyOutreachStarterSet && (
                      <button
                        type="button"
                        onClick={() => { onApplyOutreachStarterSet(); setIsStarterOpen(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer text-left"
                      >
                        <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span>蝟ｶ讌ｭ繝｡繝ｼ繝ｫ5谿ｵ髫弱ｒ驕ｩ逕ｨ</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 繧ｷ繝翫Μ繧ｪ0莉ｶ譎ゅ・蛻晄悄繧ｻ繝・ヨ繧｢繝・・譯亥・ */}
        {scenarios.length === 0 && (
          <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50/40 p-5 text-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">驟堺ｿ｡繧ｷ繝翫Μ繧ｪ縺ｮ蛻晄悄繧ｻ繝・ヨ繧｢繝・・</h3>
                <p className="text-xs text-slate-600 mt-1">
                  蜈ｬ蠑上せ繧ｿ繝ｼ繧ｿ繝ｼ繧ｻ繝・ヨ・・INE逶ｸ隲・・謨呵ご繝輔Ο繝ｼ縲∝霧讌ｭ繝｡繝ｼ繝ｫ5谿ｵ髫弱↑縺ｩ・峨ｒ驕ｩ逕ｨ縺吶ｋ縺九∵眠隕上せ繝・ャ繝励ｒ菴懈・縺励※縺上□縺輔＞縲・                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onApplyAllStarterSets && (
                  <button
                    type="button"
                    onClick={onApplyAllStarterSets}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>蜈ｬ蠑上・繝ｪ繧ｻ繝・ヨ繧剃ｸ諡ｬ驕ｩ逕ｨ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCreateNewStep}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>譁ｰ隕丈ｽ懈・</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5縺､縺ｮ陦ｨ遉ｺ蛻・ｊ譖ｿ縺医ち繝・*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              viewMode === 'table'
                ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-400'
                : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="min-w-0">
              <div className={`flex items-center gap-1.5 font-bold text-xs ${viewMode === 'table' ? 'text-purple-900' : 'text-slate-800'}`}>
                <Table className={`w-3.5 h-3.5 shrink-0 ${viewMode === 'table' ? 'text-purple-600' : 'text-slate-400'}`} />
                <span className="truncate">蜈ｨ繧ｹ繝・ャ繝嶺ｸ隕ｧ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                讀懃ｴ｢繝ｻON/OFF繝ｻ蜊倡匱邱ｨ髮・              </div>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ml-2 ${viewMode === 'table' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'}`}>
              {scenarios.length}莉ｶ
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTrack('line_welcome'); setViewMode('flow'); }}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'line_welcome' && viewMode === 'flow'
                ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-400'
                : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="min-w-0">
              <div className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'line_welcome' && viewMode === 'flow' ? 'text-emerald-900' : 'text-slate-800'}`}>
                <MessageCircle className={`w-3.5 h-3.5 shrink-0 ${activeTrack === 'line_welcome' && viewMode === 'flow' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="truncate">LINE蟆守ｷ壹・險ｺ譁ｭ蠕・/span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                繧ｦ繧ｧ繝ｫ繧ｫ繝�繝ｻ蛻・ｲ植/B/C
              </div>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ml-2 ${activeTrack === 'line_welcome' && viewMode === 'flow' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
              LINE
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTrack('inbound_material'); setViewMode('flow'); }}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'inbound_material' && viewMode === 'flow'
                ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-400'
                : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="min-w-0">
              <div className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'inbound_material' && viewMode === 'flow' ? 'text-teal-900' : 'text-slate-800'}`}>
                <UserCheck className={`w-3.5 h-3.5 shrink-0 ${activeTrack === 'inbound_material' && viewMode === 'flow' ? 'text-teal-600' : 'text-slate-400'}`} />
                <span className="truncate">雉・侭繝ｻ髱｢隲・・謠先｡亥ｾ・/span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                閾ｪ蜍戊ｿｽ螳｢6繧ｹ繝・ャ繝・              </div>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ml-2 ${activeTrack === 'inbound_material' && viewMode === 'flow' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
              {materialFollowupScenarios.length + postMeetingScenarios.length}譛ｬ
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTrack('story_nurturing'); setViewMode('flow'); }}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'story_nurturing' && viewMode === 'flow'
                ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-400'
                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="min-w-0">
              <div className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'story_nurturing' && viewMode === 'flow' ? 'text-indigo-900' : 'text-slate-800'}`}>
                <BookOpen className={`w-3.5 h-3.5 shrink-0 ${activeTrack === 'story_nurturing' && viewMode === 'flow' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="truncate">謨呵ご繧ｹ繝・ャ繝・/span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                蜈ｱ騾壹せ繝医・繝ｪ繝ｼ7隧ｱ
              </div>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ml-2 ${activeTrack === 'story_nurturing' && viewMode === 'flow' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
              {nurturingScenarios.length || 7}隧ｱ
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTrack('sales_outreach'); setViewMode('flow'); }}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
              activeTrack === 'sales_outreach' && viewMode === 'flow'
                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-400'
                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/70'
            }`}
          >
            <div className="min-w-0">
              <div className={`flex items-center gap-1.5 font-bold text-xs ${activeTrack === 'sales_outreach' && viewMode === 'flow' ? 'text-blue-900' : 'text-slate-800'}`}>
                <Mail className={`w-3.5 h-3.5 shrink-0 ${activeTrack === 'sales_outreach' && viewMode === 'flow' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="truncate">蝟ｶ讌ｭ繝｡繝ｼ繝ｫ・・谿ｵ髫趣ｼ・/span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                蜊倡匱繝ｻ閾ｪ蜍戊ｿｽ螳｢
              </div>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ml-2 ${activeTrack === 'sales_outreach' && viewMode === 'flow' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
              {outreachScenarios.length}莉ｶ
            </span>
          </button>
        </div>
      </div>

      {/* 繝・・繝悶Ν陦ｨ遉ｺ繝｢繝ｼ繝・ 蜈ｨ繧ｹ繝・ャ繝嶺ｸ隕ｧ ・・蟆守ｷ壹げ繝ｫ繝ｼ繝玲紛逅・*/}
      {viewMode === 'table' && (
        <div className="space-y-4 animate-fade-in">

          {/* �迫 驟堺ｿ｡蟆守ｷ啅RL險ｭ螳夂憾豕√き繝ｼ繝・*/}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm font-bold text-blue-900">�迫 驟堺ｿ｡蟆守ｷ啅RL險ｭ螳夂憾豕・/span>
              <span className="text-xs text-blue-600 ml-1">窶・蜷・せ繝・ャ繝励↓豁｣縺励￥蟆守ｷ啅RL縺悟・縺｣縺ｦ縺・ｋ縺狗｢ｺ隱阪〒縺阪∪縺・/span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <a
                href="https://corp.mstcorp.info/diagnosis"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 bg-white border border-blue-100 rounded-xl px-3 py-2.5 hover:border-blue-300 hover:shadow-sm transition group"
              >
                <span className="text-lg leading-none mt-0.5">�剥</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">險ｺ譁ｭ繝壹・繧ｸ</div>
                  <div className="text-[11px] text-slate-500 truncate">corp.mstcorp.info/diagnosis</div>
                  <div className="text-[10px] text-blue-600 mt-0.5 font-mono">{'{link_url}'}</div>
                </div>
              </a>
              <a
                href="https://corp.mstcorp.info/materials"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 bg-white border border-blue-100 rounded-xl px-3 py-2.5 hover:border-blue-300 hover:shadow-sm transition group"
              >
                <span className="text-lg leading-none mt-0.5">�塘</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">雉・侭隲区ｱゅ・繝ｼ繧ｸ</div>
                  <div className="text-[11px] text-slate-500 truncate">corp.mstcorp.info/materials</div>
                  <div className="text-[10px] text-blue-600 mt-0.5 font-mono">{'{material_url}'}</div>
                </div>
              </a>
              <a
                href="https://corp.mstcorp.info/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 bg-white border border-blue-100 rounded-xl px-3 py-2.5 hover:border-blue-300 hover:shadow-sm transition group"
              >
                <span className="text-lg leading-none mt-0.5">�町</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">逶ｸ隲・・縺雁撫縺・粋繧上○</div>
                  <div className="text-[11px] text-slate-500 truncate">corp.mstcorp.info/contact</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">逶ｴ謗･URL險倩ｼ・/div>
                </div>
              </a>
              <a
                href="https://timerex.net/s/mstcorp/c3dd3eea"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 bg-white border border-blue-100 rounded-xl px-3 py-2.5 hover:border-blue-300 hover:shadow-sm transition group"
              >
                <span className="text-lg leading-none mt-0.5">�套</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">TimeRex 髱｢隲・ｺ育ｴ・/div>
                  <div className="text-[11px] text-slate-500 truncate">timerex.net/s/mstcorp/c3dd3eea</div>
                  <div className="text-[10px] text-blue-600 mt-0.5 font-mono">{'{booking_url}'}</div>
                </div>
              </a>
            </div>
          </div>

          {/* 驥崎､・・譌ｧ繧ｷ繝翫Μ繧ｪ謨ｴ逅・け繧､繝・け繝舌・ */}
          {(duplicateCount > 0 || legacyDiagnosisScenarios.length > 0 || legacyPostMeetingScenarios.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold">謨ｴ逅・庄閭ｽ縺ｪ繧ｷ繝翫Μ繧ｪ縺瑚ｦ九▽縺九ｊ縺ｾ縺励◆・・/span>
                  <span className="text-amber-800">
                    {[
                      duplicateCount > 0 ? `驥崎､・${duplicateCount}莉ｶ` : '',
                      legacyDiagnosisScenarios.length > 0 ? `譌ｧ蛻・ｲ植 ${legacyDiagnosisScenarios.length}莉ｶ` : '',
                      legacyPostMeetingScenarios.length > 0 ? `譌ｧ髱｢隲・謠先｡亥ｾ・${legacyPostMeetingScenarios.length}莉ｶ` : '',
                    ]
                      .filter(Boolean)
                      .join(' ・・')}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {duplicateCount > 0 && onDeduplicateScenarios && (
                  <button
                    type="button"
                    onClick={onDeduplicateScenarios}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>驥崎､・ｒ謨ｴ逅・ｼ・duplicateCount}莉ｶ・・/span>
                  </button>
                )}
                {legacyDiagnosisScenarios.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCleanupLegacyDiagnosisScenarios}
                    className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    蛻・ｲ植繧呈怙譁ｰ4譛ｬ縺ｸ謨ｴ逅・                  </button>
                )}
                {legacyPostMeetingScenarios.length > 0 && onApplyPostMeetingStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyPostMeetingStarterSet}
                    className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    髱｢隲・・謠先｡亥ｾ後ｒ3譛ｬ縺ｸ邨ｱ蜷・                  </button>
                )}
              </div>
            </div>
          )}

          {/* 蜊倡匱蝟ｶ讌ｭ繝｡繝ｼ繝ｫ・井ｸ逋ｺ逶ｴ逅・署譯茨ｼ峨け繧､繝・け邱ｨ髮・ヰ繝ｼ */}
          {(tableTrackFilter === 'all' || tableTrackFilter === 'sales_outreach') &&
            (tableChannelFilter === 'all' || tableChannelFilter === 'email') && (
              <div className="bg-white border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      蜊倡匱蝟ｶ讌ｭ繝｡繝ｼ繝ｫ・域焔蜍穂ｸ逋ｺ謠先｡茨ｼ・                    </span>
                    <span className="text-xs text-slate-500">
                      {oneShotScenario ? '繧ｫ繧ｹ繧ｿ繝�邱ｨ髮・ｸ医∩' : '讓呎ｺ悶ユ繝ｳ繝励Ξ繝ｼ繝井ｽｿ逕ｨ荳ｭ'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 truncate mt-1">
                    {ONE_SHOT_SCENARIO_NAME}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {oneShotScenario && (
                    <button
                      type="button"
                      onClick={() => handleDeleteInspectorScenario(oneShotScenario.id)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>讓呎ｺ悶↓謌ｻ縺・/span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenOneShotEditor}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>繝・Φ繝励Ξ繝ｼ繝医ｒ邱ｨ髮・/span>
                  </button>
                </div>
              </div>
            )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            {/* 蟆守ｷ壹・繧ｫ繝・ざ繝ｪ蛻･繝輔ぅ繝ｫ繧ｿ繝ｼ */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setTableTrackFilter('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  tableTrackFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>縺吶∋縺ｦ</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${tableTrackFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white text-slate-600'}`}>
                  {scenarios.length}
                </span>
              </button>
              {SCENARIO_TRACK_ORDER.filter(
                (trackId) => trackId !== 'other' || tableTrackCounts.other > 0
              ).map((trackId) => {
                const meta = SCENARIO_TRACK_META[trackId];
                const count = tableTrackCounts[trackId];
                const active = tableTrackFilter === trackId;
                return (
                  <button
                    key={trackId}
                    type="button"
                    onClick={() => setTableTrackFilter(trackId)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap border ${
                      active
                        ? `${meta.badgeClass} ring-1 ring-current font-bold`
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{meta.shortLabel}</span>
                    <span className={`text-[10px] px-1.5 rounded ${active ? 'bg-white/80 text-slate-900 font-bold' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 蟐剃ｽ薙・迥ｶ諷九・陦ｨ遉ｺ蠖｢蠑上・讀懃ｴ｢繝舌・ */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'all', label: '蜈ｨ蟐剃ｽ・ },
                      { id: 'line', label: 'LINE' },
                      { id: 'email', label: '繝｡繝ｼ繝ｫ' },
                      { id: 'both', label: 'LINE蜆ｪ蜈茨ｼ医Γ繝ｼ繝ｫ陬懷ｮ鯉ｼ・ },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTableChannelFilter(item.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        tableChannelFilter === item.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <span className="hidden sm:inline text-slate-300">|</span>

                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all', label: '蜈ｨ迥ｶ諷・ },
                      { id: 'active', label: '遞ｼ蜒堺ｸｭ' },
                      { id: 'paused', label: '蛛懈ｭ｢荳ｭ' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setTableStatusFilter(st.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        tableStatusFilter === st.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTableGroupByTrack((prev) => !prev)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    tableGroupByTrack
                      ? 'bg-purple-50 border-purple-200 text-purple-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="蟆守ｷ壹＃縺ｨ縺ｮ隕句・縺励〒縺ｾ縺ｨ繧√ｋ縺九・壹＠荳隕ｧ縺ｧ陦ｨ遉ｺ縺吶ｋ縺九ｒ蛻・ｊ譖ｿ縺医∪縺・
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>{tableGroupByTrack ? '蟆守ｷ壹げ繝ｫ繝ｼ繝苓｡ｨ遉ｺ' : '繝輔Λ繝・ヨ陦ｨ遉ｺ'}</span>
                </button>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="繧ｹ繝・ャ繝怜錐繝ｻ譚｡莉ｶ繝ｻ譛ｬ譁・〒讀懃ｴ｢..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
                  />
                  {tableSearch && (
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      aria-label="讀懃ｴ｢繧偵け繝ｪ繧｢"
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredTableScenarios.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-slate-500">
                  迴ｾ蝨ｨ縺ｮ譚｡莉ｶ縺ｫ荳閾ｴ縺吶ｋ繧ｹ繝・ャ繝励・隕九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆縲・                </p>
                {(tableTrackFilter !== 'all' ||
                  tableChannelFilter !== 'all' ||
                  tableStatusFilter !== 'all' ||
                  tableSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTableTrackFilter('all');
                      setTableChannelFilter('all');
                      setTableStatusFilter('all');
                      setTableSearch('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>邨槭ｊ霎ｼ縺ｿ繧偵Μ繧ｻ繝・ヨ</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">繧ｹ繝・ャ繝怜錐</th>
                      <th className="p-3 whitespace-nowrap">髢句ｧ区擅莉ｶ</th>
                      <th className="p-3 whitespace-nowrap">蟐剃ｽ・/th>
                      <th className="p-3 whitespace-nowrap">繧ｿ繧､繝溘Φ繧ｰ</th>
                      <th className="p-3 whitespace-nowrap">閾ｪ蜍募●豁｢</th>
                      <th className="p-3 whitespace-nowrap">遞ｼ蜒・/th>
                      <th className="p-3 text-right whitespace-nowrap">謫堺ｽ・/th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(tableGroupByTrack
                      ? groupedTableSections
                      : [{ meta: null as null, items: filteredTableScenarios }]
                    ).map((section, sectionIdx) => {
                      const sectionAllActive =
                        section.items.length > 0 && section.items.every((s) => s.automationEnabled);
                      const sectionActiveCount = section.items.filter((s) => s.automationEnabled).length;
                      return (
                        <React.Fragment key={section.meta ? section.meta.id : `flat-${sectionIdx}`}>
                          {section.meta && (
                            <tr className={`border-y ${section.meta.headerBgClass}`}>
                              <td colSpan={7} className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${section.meta.badgeClass}`}>
                                      {section.meta.label}
                                    </span>
                                    <span className="text-[11px] text-slate-600">
                                      {section.meta.description}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-slate-700">
                                      {sectionActiveCount} / {section.items.length}莉ｶ 遞ｼ蜒堺ｸｭ
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleGroupAutomation(section.items, !sectionAllActive)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                                    >
                                      {sectionAllActive ? (
                                        <>
                                          <Pause className="w-3 h-3 text-slate-500" />
                                          <span>荳諡ｬ蛛懈ｭ｢</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                                          <span>荳諡ｬON</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {section.items.map((s) => {
                            const trackMeta = SCENARIO_TRACK_META[classifyScenarioTrack(s)];
                            const isLegacyRow =
                              isLegacyBranchAScenarioName(s.name || '') ||
                              isLegacyPostMeetingScenarioName(s.name || '');
                            const isPlanAStory = s.trigger === 'line_registered';
                            const waitLabel = formatScenarioWaitMinutes(s.waitMinutes);
                            const triggerLabel = formatScenarioTriggerLabel(s.trigger, s.targetTag);
                            const stopLabel = formatScenarioStopCondition(s);

                            return (
                              <tr key={s.id} className="hover:bg-slate-50/70 transition">
                                <td className="p-3 min-w-[240px]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {!tableGroupByTrack && (
                                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${trackMeta.badgeClass}`}>
                                        {trackMeta.shortLabel}
                                      </span>
                                    )}
                                    {isLegacyRow && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold shrink-0">
                                        譌ｧ險ｭ螳・                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenInspector(s)}
                                      className="font-bold text-slate-900 hover:text-purple-700 text-left cursor-pointer"
                                    >
                                      {s.name}
                                    </button>
                                  </div>
                                  <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                    {s.flexTitle || s.messageBody || s.emailSubject || '譁・擇譛ｪ險ｭ螳・}
                                  </div>
                                </td>
                                <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">
                                  {triggerLabel}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      s.channel === 'line'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : s.channel === 'email'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                                    }`}
                                  >
                                    {s.channel === 'line'
                                      ? 'LINE'
                                      : s.channel === 'email'
                                      ? '繝｡繝ｼ繝ｫ'
                                      : 'LINE蜆ｪ蜈茨ｼ医Γ繝ｼ繝ｫ陬懷ｮ鯉ｼ・}
                                  </span>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <div className="font-mono text-[11px] font-semibold text-slate-700">
                                    {waitLabel}
                                  </div>
                                  {isPlanAStory && (
                                    <div className="text-[10px] text-indigo-600 mt-0.5">
                                      蛻・ｲ舌・Web蠕後・+3縲・譌･
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap">
                                  {stopLabel}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => toggleScenarioAutomation(s.id, Boolean(s.automationEnabled))}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition whitespace-nowrap ${
                                      s.automationEnabled
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                    }`}
                                  >
                                    {s.automationEnabled ? (
                                      <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                                    ) : (
                                      <Pause className="w-3 h-3 text-slate-500" />
                                    )}
                                    <span>{s.automationEnabled ? '遞ｼ蜒堺ｸｭ' : '蛛懈ｭ｢荳ｭ'}</span>
                                  </button>
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenInspector(s)}
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>邱ｨ髮・・轤ｹ讀・/span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {/* 繝医Λ繝・け 1: �導 LINE蜿九□縺｡蟆守ｷ夲ｼ医え繧ｧ繝ｫ繧ｫ繝�・玖ｨｺ譁ｭ繝ｻ逶ｸ隲・ヵ繧ｩ繝ｭ繝ｼ・・*/}
      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {viewMode === 'flow' && activeTrack === 'line_welcome' && (
        <div className="space-y-6">
          {/* 螳牙・繧ｹ繝医ャ繝代・邁｡貎斐ヰ繝翫・ */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                LINE蜿九□縺｡縺九ｉ霑比ｿ｡繝ｻ髱｢隲・ｺ育ｴ・′蜈･繧九→縲∽ｻ･髯阪・閾ｪ蜍暮・菫｡縺ｯ蜊ｳ譎ょ●豁｢縺励∪縺吶・              </span>
            </div>
            {onOpenInbox && (
              <button
                type="button"
                onClick={onOpenInbox}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg transition text-xs shrink-0 cursor-pointer whitespace-nowrap"
              >
                <span>邨ｱ蜷亥女菫｡邂ｱ繧帝幕縺・/span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 蜈･蜿｣ 竭�: LINE蜿九□縺｡霑ｽ蜉� 繧ｦ繧ｧ繝ｫ繧ｫ繝�繝｡繝・そ繝ｼ繧ｸ・育ｵｱ荳豁｣譛ｬ繧ｨ繝・ぅ繧ｿ・・*/}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-emerald-50/70 p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-sm flex items-center justify-center">
                  1
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      縲仙・蜿｣竭�繝ｻ邨ｱ荳豁｣譛ｬ縲銑INE蜿九□縺｡霑ｽ蜉�逶ｴ蠕鯉ｼ亥叉譎る∽ｿ｡・・                    </span>
                    {welcomeLoadedFromDb && welcomeRuleId ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        welcomeEnabled
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}>
                        {welcomeEnabled ? '笨・菫晏ｭ俶ｸ医∩繝ｻ閾ｪ蜍暮・菫｡險ｭ螳壹ｒ蜿肴丐荳ｭ' : '蛛懈ｭ｢荳ｭ・郁・蜍暮∽ｿ｡OFF・・}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        譛ｪ菫晏ｭ假ｼ亥・譛溘・繝ｬ繝薙Η繝ｼ陦ｨ遉ｺ荳ｭ・・                      </span>
                    )}
                    <span className="text-xs text-slate-500">Flex繧ｫ繝ｼ繝会ｼ・螟ｧ逶ｸ隲・Γ繝九Η繝ｼ蛻・ｲ撰ｼ・/span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    蜿九□縺｡霑ｽ蜉�繧ｦ繧ｧ繝ｫ繧ｫ繝�繝｡繝・そ繝ｼ繧ｸ
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
                  <span>閾ｪ蜍暮∽ｿ｡譛牙柑</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsEditingWelcome(!isEditingWelcome)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isEditingWelcome ? '繝励Ξ繝薙Η繝ｼ縺ｫ謌ｻ繧・ : '繧ｦ繧ｧ繝ｫ繧ｫ繝�譁・擇繧堤ｷｨ髮・}</span>
                </button>
              </div>
            </div>

            {!welcomeRuleId && (
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                <span>
                  迴ｾ蝨ｨ縺薙・逕ｻ髱｢縺ｮ險ｭ螳壹・縺ｾ縺�DB縺ｸ遒ｺ螳壻ｿ晏ｭ倥＆繧後※縺・∪縺帙ｓ・井ｿ晏ｭ倥☆繧九∪縺ｧ縺ｯ繧ｷ繧ｹ繝・Β讓呎ｺ悶・繧ｦ繧ｧ繝ｫ繧ｫ繝�繧ｫ繝ｼ繝峨∪縺溘・譌｢蟄倥・閾ｪ蜍戊ｿ比ｿ｡繝ｫ繝ｼ繝ｫ縺碁∽ｿ｡縺輔ｌ縺ｾ縺呻ｼ峨・                </span>
                <button
                  type="button"
                  disabled={welcomeSaving}
                  onClick={() => void handleSaveWelcome('迴ｾ蝨ｨ縺ｮLINE繝ｻ繝｡繝ｼ繝ｫ閾ｪ蜍暮・菫｡繧ｦ繧ｧ繝ｫ繧ｫ繝�險ｭ螳壹ｒDB縺ｫ遒ｺ螳壻ｿ晏ｭ倥＠縺ｾ縺励◆・・)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {welcomeSaving ? '蜿肴丐荳ｭ窶ｦ' : '縺薙・險ｭ螳壹ｒ菫晏ｭ倥＠縺ｦLINE縺ｫ蜿肴丐'}
                </button>
              </div>
            )}

            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
              <span>
                窶ｻ 繝悶Ο繝・け隗｣髯､繧・眠隕剰ｿｽ蜉�譎ゅ↓LINE縺九ｉ縲梧・縺ｮ謖ｨ諡ｶ繝｡繝・そ繝ｼ繧ｸ縲阪′螻翫￥蝣ｴ蜷医・縲・                <strong className="text-slate-800">LINE Official Account Manager・郁ｨｭ螳・竊・蠢懃ｭ碑ｨｭ螳・竊・縺ゅ＞縺輔▽繝｡繝・そ繝ｼ繧ｸ・峨ｒ縲後が繝輔・/strong>
                縺ｫ縺励※縺上□縺輔＞・域悽繧ｷ繧ｹ繝・Β縺ｮWebhook驟堺ｿ｡縺ｨ驥崎､・・遶ｶ蜷医☆繧九・繧帝亟縺弱∪縺呻ｼ峨・              </span>
              {lastWelcomeLog?.body && (
                <span className="shrink-0 font-mono text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-2 py-0.5">
                  逶ｴ霑鷹∽ｿ｡: {lastWelcomeLog.body.slice(0, 32)}
                </span>
              )}
            </div>

            {activeWelcomeSource === 'legacy_keyword_rule' && !welcomeRuleId && (
              <div className="px-5 py-2.5 bg-amber-50/70 border-b border-amber-200 text-[11px] text-amber-900 font-medium">
                迴ｾ蝨ｨ縲∵立繧ｭ繝ｼ繝ｯ繝ｼ繝芽・蜍募ｿ懃ｭ斐Ν繝ｼ繝ｫ蛛ｴ縺梧怏蜉ｹ縺ｮ縺溘ａ縺昴■繧峨′騾∽ｿ｡蟇ｾ雎｡縺ｧ縺吶ゅ後％縺ｮ險ｭ螳壹ｒ菫晏ｭ倥＠縺ｦLINE縺ｫ蜿肴丐縲阪ｒ謚ｼ縺吶→譛ｬ逕ｻ髱｢縺ｮ險ｭ螳壹′譛蜆ｪ蜈医↓縺ｪ繧翫∪縺吶・              </div>
            )}

            {conflictingLegacyRules.length > 0 && (
              <div className="px-5 py-3 bg-sky-50 border-b border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-sky-900">
                <span>
                  蛻･縺ｮ閾ｪ蜍戊ｿ比ｿ｡繝ｫ繝ｼ繝ｫ・・conflictingLegacyRules.map((r) => `縲・{r.match_text}縲港).join('繝ｻ')}・峨′譛牙柑縺ｫ縺ｪ縺｣縺ｦ縺・∪縺吶ゆｸ願ｨ倥・縲鍬INE繝ｻ繝｡繝ｼ繝ｫ閾ｪ蜍暮・菫｡縲崎ｨｭ螳壹′譛蜆ｪ蜈医＆繧後∪縺吶′縲∽ｸ崎ｦ√↑譌ｧ繝ｫ繝ｼ繝ｫ繧貞●豁｢縺ｧ縺阪∪縺吶・                </span>
                <button
                  type="button"
                  disabled={disablingLegacy}
                  onClick={() => void handleDisableLegacyWelcomeRules()}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-sky-300 bg-white hover:bg-sky-100 text-sky-800 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {disablingLegacy ? '蛛懈ｭ｢荳ｭ窶ｦ' : '譌ｧ繝ｫ繝ｼ繝ｫ繧貞●豁｢縺吶ｋ'}
                </button>
              </div>
            )}

            {/* 繧ｦ繧ｧ繝ｫ繧ｫ繝�邱ｨ髮・ヵ繧ｩ繝ｼ繝� */}
            {isEditingWelcome && (
              <div className="p-5 bg-slate-50/80 border-b border-slate-200 space-y-4 text-xs animate-fade-in">
                {/* 邱ｨ髮・Δ繝ｼ繝牙・繧頑崛縺医ち繝・*/}
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
                      <span>�耳 繝薙ず繝･繧｢繝ｫ繝ｻ繝懊ち繝ｳ險ｭ螳・/span>
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
                      <span>�捗 Flex JSON逶ｴ謗･邱ｨ髮・ｼ亥ｮ悟・閾ｪ逕ｱ・・/span>
                    </button>
                  </div>

                  {flexEditMode === 'json' && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isValidFlexJson ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {isValidFlexJson ? '笨・JSON讒区枚豁｣蟶ｸ' : '笞�・・JSON讒区枚繧ｨ繝ｩ繝ｼ'}
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
                        繝薙ず繝･繧｢繝ｫ險ｭ螳壹°繧牙・逕滓・
                      </button>
                    </div>
                  )}
                </div>

                {flexEditMode === 'visual' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">蟾ｮ蜃ｺ莠ｺ繝ｻ隕句・縺暦ｼ亥､ｪ蟄怜､ｧ・・/label>
                        <input
                          type="text"
                          value={welcomeHeading}
                          onChange={(e) => setWelcomeHeading(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="螟ｧ讖狗悄莠ｺ縺ｧ縺吶・
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">繧ｵ繝冶ｦ句・縺暦ｼ域肩諡ｶ・・/label>
                        <input
                          type="text"
                          value={welcomeSubheading}
                          onChange={(e) => setWelcomeSubheading(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="LINE逋ｻ骭ｲ縺ゅｊ縺後→縺・＃縺悶＞縺ｾ縺吶・
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">閾ｪ蟾ｱ邏ｹ莉九・莠区･ｭ邏ｹ莉区枚</label>
                      <textarea
                        rows={6}
                        value={welcomeIntro}
                        onChange={(e) => setWelcomeIntro(e.target.value)}
                        className="w-full min-h-[130px] bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-sm leading-relaxed focus:outline-none focus:border-purple-500 resize-y"
                        placeholder="MST縺ｧ縺ｯ縲∽ｸｭ蟆丈ｼ∵･ｭ縺ｮ縲檎ｵ悟霧縺ｮ莉慕ｵ・∩蛹姪怜茜逶頑隼蝟・阪→莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ縺ｮ髢区･ｭ繧呈髪謠ｴ縺励※縺・∪縺吶・
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">蝠上＞縺九￠譁・擇・亥､ｧ・・/label>
                        <input
                          type="text"
                          value={welcomeQuestion}
                          onChange={(e) => setWelcomeQuestion(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="縺ｾ縺壹√←縺ｮ繧医≧縺ｪ縺皮嶌隲・ｒ縺泌ｸ梧悍縺ｧ縺吶°・・
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">陬懆ｶｳ隱伜ｰ取枚髱｢・亥ｰ擾ｼ・/label>
                        <input
                          type="text"
                          value={welcomeInstruction}
                          onChange={(e) => setWelcomeInstruction(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500"
                          placeholder="縺泌ｸ梧悍縺ｫ霑代＞繧ゅ・繧偵♀驕ｸ縺ｳ縺上□縺輔＞"
                        />
                      </div>
                    </div>

                    {/* Flex繝懊ち繝ｳ・磯∈謚櫁い・峨・繝阪・繧ｸ繝｣繝ｼ */}
                    <div className="space-y-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            Flex繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝懊ち繝ｳ險ｭ螳夲ｼ医ち繝・・譎ゅ・蜍穂ｽ懊・蛻・ｲ舌・繧ｫ繝ｩ繝ｼ・・                          </h5>
                          <p className="text-[11px] text-slate-500">
                            繝懊ち繝ｳ譁・擇・・INE隕丞ｮ・ 譛螟ｧ20譁・ｭ暦ｼ峨√ち繝・・譎ゅ・蜍穂ｽ懶ｼ医ち繧ｰ莉倅ｸ趣ｼ酋RL繝ｪ繝ｳ繧ｯ・峨∬レ譎ｯ濶ｲ繧定・逕ｱ縺ｫ螟画峩繝ｻ霑ｽ蜉�縺ｧ縺阪∪縺吶・                          </p>
                        </div>
                        {welcomeChoices.length < 4 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newChoice = {
                                id: `choice-${Date.now()}`,
                                label: `譁ｰ縺励＞驕ｸ謚櫁い ${welcomeChoices.length + 1}`,
                                tag: `驕ｸ謚・繧ｫ繧ｹ繧ｿ繝�${welcomeChoices.length + 1}`,
                                route: 'template' as const,
                                actionType: 'postback' as const,
                                color: '#8B5CF6',
                              };
                              setWelcomeChoices([...welcomeChoices, newChoice]);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-300 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>繝懊ち繝ｳ霑ｽ蜉�</span>
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
                                繝懊ち繝ｳ {index + 1}
                              </span>
                              {welcomeChoices.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWelcomeChoices(welcomeChoices.filter((_, i) => i !== index));
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                                  title="縺薙・繝懊ち繝ｳ繧貞炎髯､"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
                              <div className="md:col-span-5">
                                <label className="text-[11px] text-slate-500 block mb-0.5">陦ｨ遉ｺ譁・擇・・INE隕丞ｮ・ 譛螟ｧ20譁・ｭ暦ｼ・/label>
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
                                  placeholder="萓・ �投 3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ繧貞女縺代ｋ"
                                />
                              </div>

                              <div className="md:col-span-3">
                                <label className="text-[11px] text-slate-500 block mb-0.5">繧｢繧ｯ繧ｷ繝ｧ繝ｳ遞ｮ蛻･</label>
                                <select
                                  value={choice.actionType || (choice.route === 'form' && choice.formSlug?.startsWith('http') ? 'uri' : 'postback')}
                                  onChange={(e) => {
                                    const next = [...welcomeChoices];
                                    next[index] = { ...choice, actionType: e.target.value as 'postback' | 'uri' };
                                    setWelcomeChoices(next);
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-purple-500"
                                >
                                  <option value="postback">繝昴せ繝医ヰ繝・け・医ち繧ｰ莉倅ｸ弱・繧ｷ繝翫Μ繧ｪ襍ｷ蜍包ｼ・/option>
                                  <option value="uri">URL繧帝幕縺擾ｼ・eb繝壹・繧ｸ繝ｻ繧ｫ繝ｬ繝ｳ繝繝ｼ・・/option>
                                </select>
                              </div>

                              <div className="md:col-span-4">
                                <label className="text-[11px] text-slate-500 block mb-0.5">
                                  {choice.actionType === 'uri' ? '驕ｷ遘ｻ蜈・RL・・ttps://縲懶ｼ・ : '莉倅ｸ弱ち繧ｰ・・RM繝ｻ繧ｷ繝翫Μ繧ｪ騾｣蜍包ｼ・}
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
                                    placeholder="萓・ 驕ｸ謚・險ｺ譁ｭ"
                                  />
                                )}
                              </div>
                            </div>

                            {/* 繝懊ち繝ｳ繧ｫ繝ｩ繝ｼ驕ｸ謚槭ヱ繝ｬ繝・ヨ */}
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[11px] text-slate-500 font-medium">閭梧勹濶ｲ:</span>
                              {[
                                { color: '#10B981', label: '繧ｨ繝｡繝ｩ繝ｫ繝・ },
                                { color: '#1E3A5F', label: '繝阪う繝薙・' },
                                { color: '#0284C7', label: '繧ｹ繧ｫ繧､繝悶Ν繝ｼ' },
                                { color: '#8B5CF6', label: '繝代・繝励Ν' },
                                { color: '#E11D48', label: '繝ｭ繝ｼ繧ｺ' },
                                { color: '#F59E0B', label: '繧｢繝ｳ繝舌・' },
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
                  /* JSON逶ｴ謗･邱ｨ髮・Δ繝ｼ繝・*/
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-slate-700">
                        LINE Flex Bubble / Carousel JSON 螳夂ｾｩ・・INE Messaging API貅匁侠・・                      </label>
                      <span className="text-slate-500 text-[11px]">
                        header, hero(逕ｻ蜒・, body, footer, boxes, buttons 繧貞ｮ悟・閾ｪ逕ｱ縺ｫ險倩ｿｰ蜿ｯ閭ｽ
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
                      <span>繝偵Φ繝・ LINE Bot Designer遲峨〒菴懈・縺励◆Flex Message JSON繧偵◎縺ｮ縺ｾ縺ｾ雋ｼ繧贋ｻ倥￠繧峨ｌ縺ｾ縺吶・/span>
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
                        繝薙ず繝･繧｢繝ｫ險ｭ螳壹・迴ｾ蝨ｨ縺ｮ蜀・ｮｹ縺ｧ荳頑嶌縺阪Μ繧ｻ繝・ヨ
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
                    繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                  </button>
                  <button
                    type="button"
                    disabled={welcomeSaving || (flexEditMode === 'json' && !isValidFlexJson)}
                    onClick={() => void handleSaveWelcome()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{welcomeSaving ? '菫晏ｭ倅ｸｭ窶ｦ' : '菫晏ｭ倥＠縺ｦLINE縺ｫ蜿肴丐'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 繝励Ξ繝薙Η繝ｼ陦ｨ遉ｺ */}
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
                    �導 繧ｹ繝槭・UI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewType('line_official')}
                    className={`px-2.5 py-1 rounded cursor-pointer font-bold transition ${
                      previewType === 'line_official' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    �剥 LINE蜈ｬ蠑剰｡ｨ遉ｺ
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
                      title="蜿九□縺｡霑ｽ蜉�譎ゅえ繧ｧ繝ｫ繧ｫ繝�Flex繝励Ξ繝薙Η繝ｼ"
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
                              if (choice.id === 'diagnosis' || choice.tag?.includes('險ｺ譁ｭ')) {
                                setExpandedBranch(expandedBranch === 'diagnosis' ? 'all' : 'diagnosis');
                              } else if (choice.id === 'consult' || choice.tag?.includes('逶ｸ隲・)) {
                                setExpandedBranch(expandedBranch === 'consult' ? 'all' : 'consult');
                              } else if (choice.id === 'care' || choice.tag?.includes('莉玖ｭｷ')) {
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
                      LINE蟆守ｷ壹・蜈ｨ菴楢ｨｭ險茨ｼ夊ｦｪ霄ｫ縺ｪ逶ｸ隲・ﾃ・謨呵ご 竊・譛邨ゅざ繝ｼ繝ｫ・亥膚隲・｡亥・・・                    </h4>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      �識 譛邨ゅざ繝ｼ繝ｫ: 30蛻・句挨逶ｸ隲・・蝠・ｫ・ｺ育ｴ・                    </span>
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    蛻晄律縺ｮ繧ｦ繧ｧ繝ｫ繧ｫ繝�3謚槭〒闊亥袖縺ｫ蜷医ｏ縺帙◆蛻・ｲ撰ｼ・/B/C・峨∈謖ｯ繧雁・縺代∵悴驕ｸ謚槭・蜿九□縺｡繧・､懆ｨ惹ｸｭ縺ｮ隕玖ｾｼ縺ｿ螳｢縺ｯ縲・譌･蠕後°繧峨・蜈ｱ騾壹せ繝医・繝ｪ繝ｼ謨呵ご・・隧ｱ・峨阪〒閧ｲ謌舌＠縺ｦ蝠・ｫ・∈縺､縺ｪ縺弱∪縺吶・                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedBranch('diagnosis')}
                      className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-left hover:border-emerald-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/70 text-emerald-900">謨呵ご繝ｫ繝ｼ繝・/span>
                      <span className="font-bold block mt-1">A. 邁｡譏楢ｨｺ譁ｭﾃ玲蕗閧ｲ・・譛ｬ・・/span>
                      <span className="text-[11px] opacity-85 block">繝ｬ繝昴・繝医・蝠・ｫ・ｾ後・縺ｿ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedBranch('consult')}
                      className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-left hover:border-purple-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-200/70 text-purple-900">隕ｪ霄ｫ縺ｪ逶ｸ隲・Ν繝ｼ繝・/span>
                      <span className="font-bold block mt-1">B. 蛟句挨逶ｸ隲・ｼ医ヱ繧ｿ繝ｼ繝ｳA・・/span>
                      <span className="text-[11px] opacity-85 block">繧ｿ繧ｰ: 驕ｸ謚・蛟句挨逶ｸ隲・/span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedBranch('care')}
                      className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-left hover:border-sky-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-200/70 text-sky-900">逶ｸ隲・怜ｰる摩謨呵ご</span>
                      <span className="font-bold block mt-1">C. 莉玖ｭｷ髢区･ｭ・医ヱ繧ｿ繝ｼ繝ｳB・・/span>
                      <span className="text-[11px] opacity-85 block">繧ｿ繧ｰ: 莉玖ｭｷ菫晞匱螟夜幕讌ｭ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTrack('story_nurturing'); setViewMode('flow'); }}
                      className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-left hover:border-indigo-400 transition cursor-pointer"
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-200/70 text-indigo-900">謨呵ご繧ｹ繝・ャ繝励ち繝悶∈</span>
                      <span className="font-bold block mt-1">蜈ｱ騾壹せ繝医・繝ｪ繝ｼ・・隧ｱ・・/span>
                      <span className="text-[11px] opacity-85 block">譛ｪ霑比ｿ｡繝ｻ譛ｪ莠育ｴ・・ｒ閧ｲ謌・竊・/span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-slate-500 font-medium">陦ｨ遉ｺ繝輔ぅ繝ｫ繧ｿ:</span>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    縺吶∋縺ｦ陦ｨ遉ｺ
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('diagnosis')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'diagnosis' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    A: 險ｺ譁ｭﾃ玲蕗閧ｲ
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('consult')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'consult' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    B: 蛟句挨逶ｸ隲・A)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedBranch('care')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      expandedBranch === 'care' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    C: 莉玖ｭｷ髢区･ｭ(B)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 蜈･蜿｣ 竭｡: 笞｡ 繧ｭ繝ｼ繝ｯ繝ｼ繝芽・蜍募ｿ懃ｭ斐す繝翫Μ繧ｪ */}
          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-sm flex items-center justify-center">
                  2
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      縲仙・蜿｣竭｡縲鷹｡ｧ螳｢縺九ｉ縺ｮ繧ｭ繝ｼ繝ｯ繝ｼ繝蛾∽ｿ｡譎・                    </span>
                    <span className="text-xs text-slate-500">繝ｪ繧｢繝ｫ繧ｿ繧､繝�閾ｪ蜍募ｿ懃ｭ・・・繧ｿ繧ｰ莉倅ｸ・/span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    繧ｭ繝ｼ繝ｯ繝ｼ繝芽・蜍募ｿ懃ｭ斐す繝翫Μ繧ｪ・・keywordRules.length}莉ｶ逋ｻ骭ｲ・・                  </h3>
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
                    <span>繝ｪ繝・メ繝｡繝九Η繝ｼ縲鍬INE逶ｸ隲・咲畑繧堤匳骭ｲ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCreateKeywordModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>譁ｰ縺励＞繧ｭ繝ｼ繝ｯ繝ｼ繝牙ｿ懃ｭ斐ｒ霑ｽ蜉�</span>
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
                        {rule.matchMode === 'exact' ? `縲・{rule.matchText}縲阪→螳悟・荳閾ｴ` : `縲・{rule.matchText}縲阪ｒ蜷ｫ繧`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-3 whitespace-pre-line bg-white p-2.5 rounded-lg border border-amber-100 shadow-2xs">
                      {rule.replyText}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-amber-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-emerald-700 font-mono font-medium">
                        {rule.tag ? `繧ｿ繧ｰ: ${rule.tag}` : '繧ｿ繧ｰ縺ｪ縺・}
                      </span>
                      {rule.id.startsWith('kw-') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          譛ｪ菫晏ｭ・                        </span>
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
                        {rule.enabled ? '譛牙柑' : '辟｡蜉ｹ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditKeywordModal(rule)}
                        className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-2xs transition"
                        title="邱ｨ髮・
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteKeywordRule(rule.id)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 cursor-pointer border border-slate-200 transition"
                        title="蜑企勁"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 蛻・ｲ・A: �投 3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ ﾃ・謨呵ご繝ｫ繝ｼ繝・竊・蝠・ｫ・｡亥・ */}
          {(expandedBranch === 'all' || expandedBranch === 'diagnosis') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                    A
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      蛻・ｲ・A: �投 3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ・・P邁｡譏鍋ｵ先棡蜊ｳ譎・竊・謨呵ご 竊・蝠・ｫ・｡亥・・・                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                        謨呵ご繝ｻ邁｡譏楢ｨｺ譁ｭ繝ｫ繝ｼ繝・                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {diagnosisScenarios.length} 繧ｹ繝・ャ繝礼匳骭ｲ荳ｭ
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      譛ｪ蝗樒ｭ斐Μ繝槭う繝ｳ繝・笏笏竊・HP騾∽ｿ｡縺ｧ縲千ｰ｡譏楢ｨｺ譁ｭ邨先棡縲大叉譎り｡ｨ遉ｺ 笏笏竊・1縲・譌･蠕梧蕗閧ｲ繝ｻ蝠・ｫ・｡亥・ 笏笏竊・蝠・ｫ・ｾ後↓縺疲署譯域嶌・郁ｨｺ譁ｭ邨先棡・区署譯茨ｼ蛾∽ｻ・                    </p>
                  </div>
                </div>

                {onApplyDiagnosisStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyDiagnosisStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-200" />
                    <span>邁｡譏楢ｨｺ譁ｭﾃ玲蕗閧ｲ4譛ｬ繧呈怙譁ｰ蛹・/span>
                  </button>
                )}
              </div>

              {/* 蛻・ｲ植 蜈ｨ菴薙ヵ繝ｭ繝ｼ謨ｴ逅・き繝ｼ繝会ｼ・P邁｡譏楢ｨｺ譁ｭ 縲・蝠・ｫ・ｾ碁剞螳壹＃謠先｡域嶌騾∽ｻ倥・蠅・阜・・*/}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    蛻・ｲ植縺ｮ螳溷漁繝輔Ο繝ｼ・育ｰ｡譏鍋ｵ先棡縺ｨ隧ｳ邏ｰ險ｺ譁ｭ蜈･繧翫＃謠先｡域嶌縺ｮ蛻・ｊ蛻・￠・・                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 font-bold">
                    譛ｪ蝠・ｫ・・∈縺ｯ隧ｳ邏ｰ險ｺ譁ｭ蜈･繧翫＃謠先｡域嶌縺ｮ閾ｪ蜍暮∽ｻ倥↑縺・                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-100 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">竭� 譛ｪ蝗樒ｭ疲凾</span>
                    <p className="font-bold text-slate-900">HP險ｺ譁ｭ縺ｸ隱伜ｰ・/p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      繧ｿ繧ｰ縲碁∈謚・險ｺ譁ｭ縲阪〒1譌･蠕後↓謨呵ご繝ｪ繝槭う繝ｳ繝会ｼ亥屓遲疲ｸ医∩縺ｮ蝣ｴ蜷医・閾ｪ蜍募●豁｢・峨・                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">竭｡ HP騾∽ｿ｡逶ｴ蠕鯉ｼ郁・蜍包ｼ・/span>
                    <p className="font-bold text-emerald-900">邁｡譏楢ｨｺ譁ｭ邨先棡繧貞叉譎り｡ｨ遉ｺ</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      HP逕ｻ髱｢縺ｫ繝懊ヨ繝ｫ繝阪ャ繧ｯ蛯ｾ蜷代ｒ蜊ｳ譎り｡ｨ遉ｺ縲・INE/繝｡繝ｼ繝ｫ縺ｧ繧らｵ先棡遒ｺ隱搾ｼ句膚隲・｡亥・繧帝∽ｻ倥・                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-100 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">竭｢ 1縲・譌･蠕鯉ｼ域悴莠育ｴ・・縺ｿ・・/span>
                    <p className="font-bold text-slate-900">邁｡譏鍋ｵ先棡隗｣隱ｬ 竊・蝠・ｫ・｡亥・</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      邁｡譏鍋ｵ先棡縺ｮ隕区婿繝ｻ莠倶ｾ区蕗閧ｲ縺九ｉ30蛻・膚隲・∈隱伜ｰ弱ょ膚隲・ｺ育ｴ・・LINE霑比ｿ｡縺ｧ閾ｪ蜍募●豁｢縲・                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 text-white border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">竭｣ 蝠・ｫ・ｾ鯉ｼ亥膚隲・・・縺ｿ・・/span>
                    <p className="font-bold text-white">縺疲署譯域嶌・郁ｨｺ譁ｭ邨先棡・区署譯茨ｼ蛾∽ｻ・/p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      蝠・ｫ・ｒ螳滓命縺輔ｌ縺滓婿髯仙ｮ壹〒縲∝膚隲・ｾ後↓諡・ｽ楢・′騾∽ｿ｡繧ｻ繝ｳ繧ｿ繝ｼ遲峨°繧牙句挨縺ｫ縺企√ｊ縺励∪縺吶・                    </p>
                  </div>
                </div>
              </div>

              {/* 蛻・ｲ植 繧ｿ繝・・逶ｴ蠕後・蜊ｳ譎りｿ比ｿ｡・郁ｨｺ譁ｭ譯亥・繧ｫ繝ｼ繝会ｼ峨う繝ｳ繝ｩ繧､繝ｳ險ｭ螳・& 繝励Ξ繝薙Η繝ｼ */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                        繧ｿ繝・・逶ｴ蠕後・蜊ｳ譎りｿ比ｿ｡・域怙蛻昴・1逋ｺ逶ｮ・・                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ 譯亥・繧ｫ繝ｼ繝会ｼ医・繝ｼ繝�繝壹・繧ｸ險ｺ譁ｭ繝ｪ繝ｳ繧ｯ・・                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      縲交沒・3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ繧貞女縺代ｋ縲阪・繧ｿ繝ｳ縺梧款縺輔ｌ縺溽椪髢薙↓霑比ｿ｡縺輔ｌ縲√・繧ｿ繝ｳ繧呈款縺吶→繧ｳ繝ｼ繝昴Ξ繝ｼ繝・P縺ｮ險ｺ譁ｭ繝壹・繧ｸ縺ｸ驕ｷ遘ｻ縺励∪縺吶・                    </p>
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
                    <span>{isEditingPatternDiagnosis ? '險ｺ譁ｭ繧ｫ繝ｼ繝臥ｷｨ髮・ｒ髢峨§繧・ : '笨搾ｸ・險ｺ譁ｭ譯亥・繧ｫ繝ｼ繝峨ｒ邱ｨ髮・}</span>
                  </button>
                </div>

                {isEditingPatternDiagnosis ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-emerald-200/70">
                    <div className="lg:col-span-7 space-y-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">繧ｫ繝ｼ繝芽ｦ句・縺・/label>
                        <input
                          type="text"
                          value={patternDiagnosisConfig.title}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          譯亥・繝｡繝・そ繝ｼ繧ｸ・・code className="text-emerald-700">{'{recipient_name}'}</code> 蟾ｮ縺苓ｾｼ縺ｿ蜿ｯ・・                        </label>
                        <textarea
                          rows={7}
                          value={patternDiagnosisConfig.body}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, body: e.target.value }))}
                          className="w-full min-h-[150px] bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-sm leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">CTA繝懊ち繝ｳ繝ｩ繝吶Ν・・0譁・ｭ嶺ｻ･蜀・ｼ・/label>
                          <span className={`text-[10px] font-mono ${patternDiagnosisConfig.buttonLabel.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {patternDiagnosisConfig.buttonLabel.length} / 20譁・ｭ・                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          value={patternDiagnosisConfig.buttonLabel}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, buttonLabel: e.target.value }))}
                          placeholder="萓・ 險ｺ譁ｭ繧貞ｧ九ａ繧具ｼ育ｴ・蛻・ｼ・
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">驕ｷ遘ｻ蜈・RL・域悽逡ｪ繝帙・繝�繝壹・繧ｸ險ｺ譁ｭ・・/label>
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
                            蜈ｬ蠑秋P險ｺ譁ｭURL繧定ｨｭ螳・                          </button>
                        </div>
                        <input
                          type="url"
                          value={patternDiagnosisConfig.diagnosisUrl}
                          onChange={(e) => setPatternDiagnosisConfig((prev) => ({ ...prev, diagnosisUrl: e.target.value }))}
                          placeholder={OFFICIAL_VERCEL_URLS.diagnosis}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          窶ｻ 騾∽ｿ｡譎ゅ↓縺ｯ閾ｪ蜍輔〒 <code className="bg-white px-1 rounded border border-slate-200">?source=line&amp;luid=...&amp;cid=...</code> 縺御ｻ倅ｸ弱＆繧後∝屓遲碑・・CRM繝ｻLINE縺ｨ邏蝉ｻ倥″縺ｾ縺吶・                        </p>
                        {/\.run\.app|\/f\/business-diagnosis|\/forms\/business-diagnosis/i.test(patternDiagnosisConfig.diagnosisUrl || '') && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                            譌ｧOS逕ｨURL縺悟・蜉帙＆繧後※縺・∪縺吶ゆｿ晏ｭ俶凾縺ｫ閾ｪ蜍慕噪縺ｫ蜈ｬ蠑上・繝ｼ繝�繝壹・繧ｸ・・OFFICIAL_VERCEL_URLS.diagnosis}・峨∈螟画鋤縺輔ｌ縺ｾ縺吶・                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setPatternDiagnosisConfig(DEFAULT_WELCOME_PATTERN_DIAGNOSIS)}
                          className="text-slate-500 hover:text-slate-800 underline cursor-pointer text-[11px]"
                        >
                          蛻晄悄繝・Φ繝励Ξ繝ｼ繝医↓謌ｻ縺・                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingPatternDiagnosis(false)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                          </button>
                          <button
                            type="button"
                            disabled={welcomeSaving}
                            onClick={() => void handleSaveWelcome('蛻・ｲ植・・蛻・┌譁咏ｵ悟霧險ｺ譁ｭ譯亥・繧ｫ繝ｼ繝会ｼ峨・險ｭ螳壹ｒ菫晏ｭ倥＠縺ｾ縺励◆・・)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{welcomeSaving ? '菫晏ｭ倅ｸｭ窶ｦ' : '菫晏ｭ倥＠縺ｦLINE縺ｫ蜿肴丐'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <div className="w-full max-w-sm">
                        <LineMessagePreview
                          type="flex"
                          payload={{
                            altText: `縲・蛻・┌譁咏ｵ悟霧險ｺ譁ｭ縲・{patternDiagnosisConfig.title}`,
                            contents: buildPatternDiagnosisFlexBubble(patternDiagnosisConfig),
                          }}
                          title="蛻・ｲ植 險ｺ譁ｭ譯亥・繝励Ξ繝薙Η繝ｼ"
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
                          繧ｿ繧ｰ縲碁∈謚・險ｺ譁ｭ縲堺ｻ倅ｸ・                        </span>
                      </div>
                      <p className="text-slate-600 whitespace-pre-line line-clamp-3 leading-relaxed">
                        {patternDiagnosisConfig.body}
                      </p>
                      <div className="p-2 rounded bg-emerald-50/70 border border-emerald-100 text-[11px] text-emerald-900 space-y-0.5">
                        <div className="font-bold">繝懊ち繝ｳ: 縲鶏patternDiagnosisConfig.buttonLabel}縲・/div>
                        <div className="font-mono text-[10px] text-emerald-700 break-all">
                          驕ｷ遘ｻ蜈・ {patternDiagnosisConfig.diagnosisUrl}
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-5">
                      <LineMessagePreview
                        type="flex"
                        payload={{
                          altText: `縲・蛻・┌譁咏ｵ悟霧險ｺ譁ｭ縲・{patternDiagnosisConfig.title}`,
                          contents: buildPatternDiagnosisFlexBubble(patternDiagnosisConfig),
                        }}
                        title="蛻・ｲ植 螳滓ｩ溘う繝｡繝ｼ繧ｸ"
                      />
                    </div>
                  </div>
                )}
              </div>

              {diagnosisScenarios.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-3">
                  <p className="text-xs text-slate-500">蛻・ｲ植・育ｰ｡譏楢ｨｺ譁ｭﾃ玲蕗閧ｲ・峨・繧ｷ繝翫Μ繧ｪ縺後∪縺�逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ縲・/p>
                  {onApplyDiagnosisStarterSet && (
                    <button
                      type="button"
                      onClick={onApplyDiagnosisStarterSet}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>邁｡譏楢ｨｺ譁ｭﾃ玲蕗閧ｲ4譛ｬ縺ｮ讓呎ｺ悶す繝翫Μ繧ｪ繧貞渚譏�縺吶ｋ</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {legacyDiagnosisScenarios.length > 0 && (
                    <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 text-xs text-amber-950">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold">
                            譌ｧ繝舌・繧ｸ繝ｧ繝ｳ・域焚蟄励ヱ繧ｿ繝ｼ繝ｳ遲・{legacyDiagnosisScenarios.length}莉ｶ・峨′谿九▲縺ｦ縺・ｋ縺溘ａ陦ｨ遉ｺ縺輔ｌ縺ｦ縺・∪縺・                          </p>
                          <p className="text-[11px] text-amber-900 leading-relaxed">
                            迴ｾ蝨ｨ縺ｯ<strong>譁ｰ繝舌・繧ｸ繝ｧ繝ｳ・・1縲廣4・峨・縺ｿ遞ｼ蜒・/strong>縺輔○繧後・OK縺ｧ縺呻ｼ井ｸ｡譁ｹON縺ｫ縺吶ｋ縺ｨ莠碁㍾驟堺ｿ｡縺ｫ縺ｪ繧翫∪縺呻ｼ峨ゆｸ九・繝懊ち繝ｳ縺ｧ譌ｧ繝代ち繝ｼ繝ｳ繧偵∪縺ｨ繧√※謨ｴ逅・〒縺阪∪縺吶・                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCleanupLegacyDiagnosisScenarios}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>譌ｧ繝代ち繝ｼ繝ｳ繧貞炎髯､縺励※A1縲廣4縺�縺代↓謨ｴ逅・/span>
                      </button>
                    </div>
                  )}

                  {diagnosisScenarios.map((scenario, index) => {
                    const isLegacy = isLegacyBranchAScenarioName(scenario.name || '');
                    return (
                    <div
                      key={scenario.id}
                      className={`rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition shadow-2xs border ${
                        isLegacy
                          ? 'bg-amber-50/40 border-amber-200/90 opacity-85 hover:border-amber-300'
                          : 'bg-slate-50/60 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border ${
                          isLegacy
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                            {isLegacy && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                                譌ｧ繝舌・繧ｸ繝ｧ繝ｳ・亥●豁｢謗ｨ螂ｨ・・                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                              {scenario.waitMinutes === 0 ? '蜊ｳ譎ょｮ溯｡・ : `${Math.round(scenario.waitMinutes / 1440)}譌･蠕形}
                            </span>
                            {scenario.trigger === 'tag_added' && scenario.targetTag && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                繧ｿ繧ｰ: {scenario.targetTag}
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                              {scenario.channel === 'both'
                                ? 'LINE・九Γ繝ｼ繝ｫ'
                                : scenario.channel === 'email'
                                ? '繝｡繝ｼ繝ｫ縺ｮ縺ｿ'
                                : scenario.lineMessageType === 'flex'
                                ? 'LINE Flex繧ｫ繝ｼ繝・
                                : 'LINE繝・く繧ｹ繝・}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {scenario.flexTitle || scenario.messageBody || scenario.emailSubject || '譁・擇譛ｪ險ｭ螳・}
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
                              <span>閾ｪ蜍募ｮ溯｡御ｸｭ</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3.5 h-3.5 text-slate-400" />
                              <span>荳譎ょ●豁｢荳ｭ</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewModalScenario(scenario)}
                          className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer shadow-2xs"
                          title="譁・擇繝励Ξ繝薙Η繝ｼ"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenInspector(scenario)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                          <span>轤ｹ讀懊・邱ｨ髮・/span>
                        </button>

                        {isLegacy && (
                          <button
                            type="button"
                            onClick={() => handleDeleteInspectorScenario(scenario.id)}
                            className="p-2 bg-white hover:bg-rose-50 text-rose-600 rounded-lg text-xs border border-rose-200 transition cursor-pointer shadow-2xs"
                            title="譌ｧ繧ｷ繝翫Μ繧ｪ繧貞炎髯､"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 蛻・ｲ・B: �町 邨悟霧謾ｹ蝟・・蛟句挨逶ｸ隲・舌ヱ繧ｿ繝ｼ繝ｳA・夊ｦｪ霄ｫ縺ｪ逶ｸ隲・Ν繝ｼ繝・竊・蝠・ｫ・｡亥・縲・*/}
          {(expandedBranch === 'all' || expandedBranch === 'consult') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-purple-100 text-purple-800 font-bold border border-purple-300">
                    B
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      蛻・ｲ・B: �町 邨悟霧謾ｹ蝟・・蛟句挨逶ｸ隲・ｼ医ヱ繧ｿ繝ｼ繝ｳA・夊ｦｪ霄ｫ縺ｪ逶ｸ隲・竊・蝠・ｫ・｡亥・・・                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 font-bold">
                        隕ｪ霄ｫ縺ｪ逶ｸ隲・Ν繝ｼ繝・                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        蠕檎ｶ・{consultScenarios.length} 繧ｹ繝・ャ繝・                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      縲悟句挨逶ｸ隲・☆繧九阪ち繝・・・医ち繧ｰ: 驕ｸ謚・蛟句挨逶ｸ隲・ｼ・笏笏竊・蜊ｳ譎ゅ舌ヱ繧ｿ繝ｼ繝ｳA縲醍峩騾壹≠縺・＆縺､ 笏笏竊・1譌･蠕・隕ｪ霄ｫ繝輔か繝ｭ繝ｼ 笏笏竊・3譌･蠕・蝠・ｫ・｡亥・
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
                    <span>逶ｸ隲・・莉玖ｭｷ繝輔か繝ｭ繝ｼ繧呈怙譁ｰ蛹・/span>
                  </button>
                )}
              </div>

              {/* 繝代ち繝ｼ繝ｳA 繧､繝ｳ繝ｩ繧､繝ｳ險ｭ螳・& 繝励Ξ繝薙Η繝ｼ */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white">
                        繧ｿ繝・・逶ｴ蠕後・蜊ｳ譎りｿ比ｿ｡・医ヱ繧ｿ繝ｼ繝ｳA・・                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        LINE逶ｴ騾壹メ繝｣繝・ヨ蛟句挨逶ｸ隲・き繝ｼ繝・                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      縲檎ｵ悟霧謾ｹ蝟・↓縺､縺・※蛟句挨逶ｸ隲・☆繧九阪・繧ｿ繝ｳ縺梧款縺輔ｌ縺溽椪髢薙↓霑比ｿ｡縺輔ｌ縲，RM縺ｫ譛ｪ蟇ｾ蠢懊Μ繝ｼ繝峨ｒ閾ｪ蜍戊ｵｷ逾ｨ縺励∪縺吶・                    </p>
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
                    <span>{isEditingPatternA ? '繝代ち繝ｼ繝ｳA邱ｨ髮・ｒ髢峨§繧・ : '笨搾ｸ・繝代ち繝ｼ繝ｳA譁・擇繧堤ｷｨ髮・}</span>
                  </button>
                </div>

                {isEditingPatternA ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-purple-200/70">
                    <div className="lg:col-span-7 space-y-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">繧ｫ繝ｼ繝芽ｦ句・縺・/label>
                        <input
                          type="text"
                          value={patternAConfig.title}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          蟆主・繝ｻ謖ｨ諡ｶ譁・ｼ・code className="text-purple-700">{'{recipient_name}'}</code> 蟾ｮ縺苓ｾｼ縺ｿ蜿ｯ・・                        </label>
                        <textarea
                          rows={7}
                          value={patternAConfig.greetingBody}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, greetingBody: e.target.value }))}
                          className="w-full min-h-[150px] bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-sm leading-relaxed focus:outline-none focus:border-purple-500 resize-y"
                        />
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">繝偵い繝ｪ繝ｳ繧ｰ蝠上＞縺九￠・亥ｼｷ隱ｿ繝懊ャ繧ｯ繧ｹ蜀・ｼ・/label>
                          <textarea
                            rows={3}
                            value={patternAConfig.promptTitle}
                            onChange={(e) => setPatternAConfig((prev) => ({ ...prev, promptTitle: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-purple-500 resize-y"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">逶ｸ隲・ｾ九ユ繧ｭ繧ｹ繝茨ｼ郁｣懆ｶｳ・・/label>
                          <input
                            type="text"
                            value={patternAConfig.promptExamples}
                            onChange={(e) => setPatternAConfig((prev) => ({ ...prev, promptExamples: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">荳矩Κ譯亥・繝｡繝・そ繝ｼ繧ｸ</label>
                        <textarea
                          rows={3}
                          value={patternAConfig.footerNote}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, footerNote: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-xs leading-relaxed focus:outline-none focus:border-purple-500 resize-y"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-700">蝠・ｫ・ｺ育ｴ・・繧ｿ繝ｳ繝ｩ繝吶Ν・・`{booking_url}`} 縺ｸ繝ｪ繝ｳ繧ｯ繝ｻ20譁・ｭ嶺ｻ･蜀・ｼ・/label>
                          <span className={`text-[10px] font-mono ${patternAConfig.bookingButtonLabel.length > 20 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            {patternAConfig.bookingButtonLabel.length} / 20譁・ｭ・                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          value={patternAConfig.bookingButtonLabel}
                          onChange={(e) => setPatternAConfig((prev) => ({ ...prev, bookingButtonLabel: e.target.value }))}
                          placeholder="遨ｺ谺・↓縺吶ｋ縺ｨ繝懊ち繝ｳ繧定｡ｨ遉ｺ縺励∪縺帙ｓ・井ｾ・ �欄・・30蛻・が繝ｳ繝ｩ繧､繝ｳ逶ｸ隲・ｺ育ｴ・ｼ・
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setPatternAConfig(DEFAULT_WELCOME_PATTERN_A)}
                          className="text-slate-500 hover:text-slate-800 underline cursor-pointer text-[11px]"
                        >
                          蛻晄悄繝・Φ繝励Ξ繝ｼ繝医↓謌ｻ縺・                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingPatternA(false)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                          </button>
                          <button
                            type="button"
                            disabled={welcomeSaving}
                            onClick={() => void handleSaveWelcome('繝代ち繝ｼ繝ｳA・育ｵ悟霧謾ｹ蝟・・蛟句挨逶ｸ隲・ｼ峨・險ｭ螳壹ｒ菫晏ｭ倥＠縺ｾ縺励◆・・)}
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{welcomeSaving ? '菫晏ｭ倅ｸｭ窶ｦ' : '菫晏ｭ倥＠縺ｦLINE縺ｫ蜿肴丐'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <div className="w-full max-w-sm">
                        <LineMessagePreview
                          type="flex"
                          payload={{
                            altText: `縲仙句挨逶ｸ隲・・{patternAConfig.title}`,
                            contents: buildPatternAFlexBubble(patternAConfig),
                          }}
                          title="繝代ち繝ｼ繝ｳA LINE繝励Ξ繝薙Η繝ｼ"
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
                          繧ｿ繧ｰ縲碁∈謚・蛟句挨逶ｸ隲・搾ｼ・繝ｪ繝ｼ繝芽ｵｷ逾ｨ
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
                          荳矩ΚCTA繝懊ち繝ｳ: 縲鶏patternAConfig.bookingButtonLabel}縲・竊・{'{booking_url}'}
                        </div>
                      )}
                    </div>
                    <div className="lg:col-span-5">
                      <LineMessagePreview
                        type="flex"
                        payload={{
                          altText: `縲仙句挨逶ｸ隲・・{patternAConfig.title}`,
                          contents: buildPatternAFlexBubble(patternAConfig),
                        }}
                        title="繝代ち繝ｼ繝ｳA 螳滓ｩ溘う繝｡繝ｼ繧ｸ"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 繝代ち繝ｼ繝ｳA縺ｮ蠕後・閾ｪ蜍輔ヵ繧ｩ繝ｭ繝ｼ・域悴霑比ｿ｡譎ゅ・縺ｿ・・*/}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    蠕檎ｶ壹・閾ｪ蜍輔ヵ繧ｩ繝ｭ繝ｼ繝ｻ蝠・ｫ・｡亥・・医♀螳｢讒倥°繧芽ｿ比ｿ｡繝ｻ莠育ｴ・′縺ゅｌ縺ｰ閾ｪ蜍募●豁｢・・                  </span>
                </div>
                {consultScenarios.length === 0 ? (
                  <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-500">蛻・ｲ殖縺ｮ蠕檎ｶ壹ヵ繧ｩ繝ｭ繝ｼ繧ｷ繝翫Μ繧ｪ縺後∪縺�逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ縲・/p>
                    {onApplyDirectConsultStarterSet && (
                      <button
                        type="button"
                        onClick={onApplyDirectConsultStarterSet}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>隕ｪ霄ｫ繝輔か繝ｭ繝ｼ繝ｻ蝠・ｫ・｡亥・縺ｮ讓呎ｺ悶す繝翫Μ繧ｪ繧貞渚譏�縺吶ｋ</span>
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
                                {scenario.waitMinutes === 0 ? '蜊ｳ譎ょｮ溯｡・ : `${Math.round(scenario.waitMinutes / 1440)}譌･蠕形}
                              </span>
                              {scenario.trigger === 'tag_added' && scenario.targetTag && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  繧ｿ繧ｰ: {scenario.targetTag}
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                                {scenario.channel === 'line' ? 'LINE' : scenario.channel === 'email' ? '繝｡繝ｼ繝ｫ' : 'LINE+繝｡繝ｼ繝ｫ'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {scenario.flexTitle || scenario.messageBody || scenario.emailSubject || '譁・擇譛ｪ險ｭ螳・}
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
                                <span>閾ｪ蜍募ｮ溯｡御ｸｭ</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 text-slate-400" />
                                <span>荳譎ょ●豁｢荳ｭ</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewModalScenario(scenario)}
                            className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer shadow-2xs"
                            title="譁・擇繝励Ξ繝薙Η繝ｼ"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenInspector(scenario)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                            <span>轤ｹ讀懊・邱ｨ髮・/span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 蛻・ｲ・C: �諺 莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ髢区･ｭ縲舌ヱ繧ｿ繝ｼ繝ｳB・・蝠上ヲ繧｢繝ｪ繝ｳ繧ｰ ﾃ・蟆る摩謨呵ご 竊・蝠・ｫ・｡亥・縲・*/}
          {(expandedBranch === 'all' || expandedBranch === 'care') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-sky-100 text-sky-800 font-bold border border-sky-300">
                    C
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      蛻・ｲ・C: �諺 莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ髢区･ｭ・医ヱ繧ｿ繝ｼ繝ｳB・・蝠上ヲ繧｢繝ｪ繝ｳ繧ｰ ﾃ・蟆る摩謨呵ご 竊・蝠・ｫ・｡亥・・・                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 font-bold">
                        逶ｸ隲・怜ｰる摩謨呵ご繝ｫ繝ｼ繝・                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                        蠕檎ｶ・{careScenarios.length} 繧ｹ繝・ャ繝・                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      縲碁幕讌ｭ逶ｸ隲・阪ち繝・・・医ち繧ｰ: 莉玖ｭｷ菫晞匱螟夜幕讌ｭ・・笏笏竊・蜊ｳ譎ゅ舌ヱ繧ｿ繝ｼ繝ｳB縲漸1迥ｶ豕≫・Q2繝・・繝樞・螳御ｺ・き繝ｼ繝・笏笏竊・1譌･蠕・莠倶ｾ区蕗閧ｲ 笏笏竊・3譌･蠕・蝠・ｫ・｡亥・
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
                    <span>逶ｸ隲・・莉玖ｭｷ繝輔か繝ｭ繝ｼ繧呈怙譁ｰ蛹・/span>
                  </button>
                )}
              </div>

              {/* 繝代ち繝ｼ繝ｳB 繧､繝ｳ繝ｩ繧､繝ｳ險ｭ螳・& 繝励Ξ繝薙Η繝ｼ・・1 / Q2 / 螳御ｺ・ｼ・*/}
              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-600 text-white">
                        繧ｿ繝・・逶ｴ蠕後・2蝠上け繧､繝・け繝偵い繝ｪ繝ｳ繧ｰ・医ヱ繧ｿ繝ｼ繝ｳB・・                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        Q1・育樟蝨ｨ縺ｮ迥ｶ豕・ｼ・竊・Q2・磯未蠢・ユ繝ｼ繝橸ｼ・竊・螳御ｺ・き繝ｼ繝会ｼ・膚隲・ｰ守ｷ・                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      2繧ｿ繝・・縺ｧ鬘ｧ螳｢縺ｮ迥ｶ豕√・髢｢蠢・ｒCRM縺ｸ險倬鹸縺励▽縺､縲∫峩蝟ｶ莠区･ｭ縲後い繧ｷ繧ｹ繧ｿ螟ｧ蝙｣縲阪・螳溷漁繝弱え繝上え縺ｨ蝠・ｫ・・雉・侭URL繧呈｡亥・縺励∪縺吶・                    </p>
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
                    <span>{isEditingPatternB ? '繝代ち繝ｼ繝ｳB邱ｨ髮・ｒ髢峨§繧・ : '笨搾ｸ・繝代ち繝ｼ繝ｳB繧堤ｷｨ髮・}</span>
                  </button>
                </div>

                {/* Q1 / Q2 / 螳御ｺ・ち繝門・繧頑崛縺・*/}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-sky-200 w-fit text-xs">
                  <button
                    type="button"
                    onClick={() => setPatternBEditTab('q1')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      patternBEditTab === 'q1' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    竭� Q1 迴ｾ蝨ｨ縺ｮ迥ｶ豕・                  </button>
                  <button
                    type="button"
                    onClick={() => setPatternBEditTab('q2')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      patternBEditTab === 'q2' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    竭｡ Q2 髢｢蠢・ユ繝ｼ繝・                  </button>
                  <button
                    type="button"
                    onClick={() => setPatternBEditTab('completion')}
                    className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                      patternBEditTab === 'completion' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    竭｢ 螳御ｺ・き繝ｼ繝会ｼ・膚隲・ｰ守ｷ・                  </button>
                </div>

                {isEditingPatternB ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-sky-200/70">
                    <div className="lg:col-span-7 space-y-3 text-xs">
                      {patternBEditTab === 'q1' && (
                        <>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Q1 繧ｫ繝ｼ繝芽ｦ句・縺・/label>
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
                              Q1 謖ｨ諡ｶ繝ｻ蟆主・譁・ｼ・code className="text-sky-700">{'{recipient_name}'}</code> 蟾ｮ縺苓ｾｼ縺ｿ蜿ｯ・・                            </label>
                            <textarea
                              rows={6}
                              value={patternBConfig.q1.greeting}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  q1: { ...prev.q1, greeting: e.target.value },
                                }))
                              }
                              className="w-full min-h-[130px] bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-sm leading-relaxed focus:outline-none focus:border-sky-500 resize-y"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Q1 雉ｪ蝠剰ｦ句・縺・/label>
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
                            <label className="font-bold text-slate-700 block">Q1 驕ｸ謚櫁い繝懊ち繝ｳ・亥推20譁・ｭ嶺ｻ･蜀・ｼ・/label>
                            {patternBConfig.q1.choices.map((c, idx) => (
                              <div key={c.value} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                                      <span className="text-slate-500 font-medium">繝懊ち繝ｳ陦ｨ遉ｺ譁・ｭ・/span>
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
                                    <span className="text-slate-500 font-medium text-[11px] block mb-0.5">鬘ｧ螳｢蛛ｴ騾∽ｿ｡繝・く繧ｹ繝・/span>
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
                                  <span className="text-[11px] text-slate-500">濶ｲ:</span>
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
                            <label className="font-bold text-slate-700 block mb-1">Q2 繧ｫ繝ｼ繝芽ｦ句・縺・/label>
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
                              Q2 譯亥・譁・ｼ・code className="text-sky-700">{'{q1_label}'}</code> 縺ｫQ1縺ｮ蝗樒ｭ斐′蜈･繧翫∪縺呻ｼ・                            </label>
                            <textarea
                              rows={6}
                              value={patternBConfig.q2.introTemplate}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  q2: { ...prev.q2, introTemplate: e.target.value },
                                }))
                              }
                              className="w-full min-h-[130px] bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-sm leading-relaxed focus:outline-none focus:border-sky-500 resize-y"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="font-bold text-slate-700 block">Q2 繝・・繝樣∈謚櫁い・亥推20譁・ｭ嶺ｻ･蜀・ｼ・/label>
                            {patternBConfig.q2.choices.map((c, idx) => (
                              <div key={c.value} className="p-2.5 bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                                    <span className="text-slate-500 font-medium">繝懊ち繝ｳ陦ｨ遉ｺ譁・ｭ・/span>
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
                                  <span className="text-slate-500 font-medium text-[11px] block mb-0.5">鬘ｧ螳｢蛛ｴ騾∽ｿ｡繝・く繧ｹ繝・/span>
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
                            <label className="font-bold text-slate-700 block mb-1">螳御ｺ・き繝ｼ繝芽ｦ句・縺・/label>
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
                            <label className="font-bold text-slate-700 block mb-1">螳御ｺ・凾縺ｮ謖ｨ諡ｶ譁・/label>
                            <textarea
                              rows={3}
                              value={patternBConfig.completion.greeting}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  completion: { ...prev.completion, greeting: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-xs leading-relaxed focus:outline-none focus:border-sky-500 resize-y"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">繧｢繝峨ヰ繧､繧ｹ繝ｻ莉雁ｾ後・譯亥・譁・/label>
                            <textarea
                              rows={6}
                              value={patternBConfig.completion.body}
                              onChange={(e) =>
                                setPatternBConfig((prev) => ({
                                  ...prev,
                                  completion: { ...prev.completion, body: e.target.value },
                                }))
                              }
                              className="w-full min-h-[130px] bg-white border border-slate-200 rounded-lg p-3 text-slate-900 text-sm leading-relaxed focus:outline-none focus:border-sky-500 resize-y"
                            />
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[11px] mb-0.5">
                                  <span className="font-bold text-slate-700">雉・侭PDF繝懊ち繝ｳ譁・ｨ</span>
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
                                <span className="font-bold text-slate-700 text-[11px] block mb-0.5">雉・侭PDF URL・育ｩｺ谺・凾縺ｯ譌｢螳啅RL・・/span>
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
                                <span className="font-bold text-slate-700">蝠・ｫ・ｺ育ｴ・・繧ｿ繝ｳ譁・ｨ・・`{booking_url}`} 縺ｸ繝ｪ繝ｳ繧ｯ・・/span>
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
                                placeholder="萓・ �欄・・30蛻・┌譁咎幕讌ｭ逶ｸ隲・ｒ莠育ｴ・
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
                          蛻晄悄繝・Φ繝励Ξ繝ｼ繝医↓謌ｻ縺・                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingPatternB(false)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                          </button>
                          <button
                            type="button"
                            disabled={welcomeSaving}
                            onClick={() => void handleSaveWelcome('繝代ち繝ｼ繝ｳB・井ｻ玖ｭｷ菫晞匱螟夜幕讌ｭ 2蝠上ヲ繧｢繝ｪ繝ｳ繧ｰ・峨・險ｭ螳壹ｒ菫晏ｭ倥＠縺ｾ縺励◆・・)}
                            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{welcomeSaving ? '菫晏ｭ倅ｸｭ窶ｦ' : '菫晏ｭ倥＠縺ｦLINE縺ｫ蜿肴丐'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col items-center">
                      <div className="w-full max-w-sm">
                        <LineMessagePreview
                          type="flex"
                          payload={{
                            altText: `縲蝉ｻ玖ｭｷ菫晞匱螟夜幕讌ｭ縲・{patternBEditTab.toUpperCase()}`,
                            contents: buildPatternBFlexBubble(patternBConfig, patternBEditTab),
                          }}
                          title={`繝代ち繝ｼ繝ｳB (${patternBEditTab === 'q1' ? 'Q1' : patternBEditTab === 'q2' ? 'Q2' : '螳御ｺ・き繝ｼ繝・}) 繝励Ξ繝薙Η繝ｼ`}
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
                          繧ｿ繧ｰ縲御ｻ玖ｭｷ菫晞匱螟夜幕讌ｭ縲搾ｼ・繝ｪ繝ｼ繝芽・蜍慕匳骭ｲ
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
                            {patternBConfig.completion.pdfButtonLabel && <span>雉・侭: 縲鶏patternBConfig.completion.pdfButtonLabel}縲・/span>}
                            {patternBConfig.completion.bookingButtonLabel && <span>蝠・ｫ・ｺ育ｴ・ 縲鶏patternBConfig.completion.bookingButtonLabel}縲・/span>}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="lg:col-span-5">
                      <LineMessagePreview
                        type="flex"
                        payload={{
                          altText: `縲蝉ｻ玖ｭｷ菫晞匱螟夜幕讌ｭ縲・{patternBEditTab.toUpperCase()}`,
                          contents: buildPatternBFlexBubble(patternBConfig, patternBEditTab),
                        }}
                        title={`繝代ち繝ｼ繝ｳB 螳滓ｩ溘う繝｡繝ｼ繧ｸ (${patternBEditTab === 'q1' ? 'Q1' : patternBEditTab === 'q2' ? 'Q2' : '螳御ｺ・き繝ｼ繝・})`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 繝代ち繝ｼ繝ｳB縺ｮ蠕後・蟆る摩謨呵ご繝ｻ蝠・ｫ・｡亥・ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    蠕檎ｶ壹・蟆る摩謨呵ご繝ｻ蝠・ｫ・｡亥・・医♀螳｢讒倥°繧芽ｿ比ｿ｡繝ｻ莠育ｴ・′縺ゅｌ縺ｰ閾ｪ蜍募●豁｢・・                  </span>
                </div>
                {careScenarios.length === 0 ? (
                  <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-500">蛻・ｲ燭・井ｻ玖ｭｷ髢区･ｭ・峨・蠕檎ｶ壹す繝翫Μ繧ｪ縺後∪縺�逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ縲・/p>
                    {onApplyDirectConsultStarterSet && (
                      <button
                        type="button"
                        onClick={onApplyDirectConsultStarterSet}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>莉玖ｭｷ髢区･ｭ縺ｮ蟆る摩謨呵ご繝ｻ蝠・ｫ・｡亥・繧貞渚譏�縺吶ｋ</span>
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
                                {scenario.waitMinutes === 0 ? '蜊ｳ譎ょｮ溯｡・ : `${Math.round(scenario.waitMinutes / 1440)}譌･蠕形}
                              </span>
                              {scenario.trigger === 'tag_added' && scenario.targetTag && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  繧ｿ繧ｰ: {scenario.targetTag}
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                                {scenario.channel === 'line' ? 'LINE' : scenario.channel === 'email' ? '繝｡繝ｼ繝ｫ' : 'LINE+繝｡繝ｼ繝ｫ'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {scenario.flexTitle || scenario.messageBody || scenario.emailSubject || '譁・擇譛ｪ險ｭ螳・}
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
                                <span>閾ｪ蜍募ｮ溯｡御ｸｭ</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 text-slate-400" />
                                <span>荳譎ょ●豁｢荳ｭ</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPreviewModalScenario(scenario)}
                            className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer shadow-2xs"
                            title="譁・擇繝励Ξ繝薙Η繝ｼ"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenInspector(scenario)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
                            <span>轤ｹ讀懊・邱ｨ髮・/span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {/* 繝医Λ繝・け 2: �当 謨呵ご繧ｹ繝・ャ繝暦ｼ亥・騾壹せ繝医・繝ｪ繝ｼ7隧ｱ / LINE+繝｡繝ｼ繝ｫ・・  */}
      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {viewMode === 'flow' && activeTrack === 'story_nurturing' && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-white border border-indigo-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-indigo-100 text-indigo-800 border border-indigo-300">
                  <BookOpen className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    謨呵ご繧ｹ繝・ャ繝暦ｼ亥・騾壹せ繝医・繝ｪ繝ｼ7隧ｱ繝翫・繝√Ε繝ｪ繝ｳ繧ｰ繝ｻA譯茨ｼ・                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 font-bold">
                      LINE蜆ｪ蜈医・譛ｪ騾｣謳ｺ譎ゅ・繝｡繝ｼ繝ｫ驟堺ｿ｡
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold">
                      辟｡蜿榊ｿ・譌･縲・/ 蛻・ｲ・譌･縲・/ 險ｺ譁ｭ繝ｻ雉・侭11譌･縲・                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    繧ｦ繧ｧ繝ｫ繧ｫ繝�辟｡蜿榊ｿ懊・縲・譌･蠕後代°繧峨∝句挨逶ｸ隲・・莉玖ｭｷ繝ｻ險ｺ譁ｭ繝ｻ雉・侭隲区ｱゅ・Web逶ｸ隲・ヵ繧ｩ繝ｼ繝�邨檎罰縺ｮ譁ｹ縺ｯ蜷・峩蠕後ヵ繧ｩ繝ｭ繝ｼ螳御ｺ・・縲・譌･蠕後代°繧・譌･縺翫″縺ｫ謨呵ご7隧ｱ繧偵♀螻翫￠縺励∪縺呻ｼ・INE譛ｪ騾｣謳ｺ縺ｮWeb邨檎罰繧ゅΓ繝ｼ繝ｫ縺ｧ閾ｪ蜍暮・菫｡・丈ｺ育ｴ・・霑比ｿ｡縺ｧ蛛懈ｭ｢・峨・                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateNewStep}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>謨呵ご繧ｹ繝・ャ繝励ｒ霑ｽ蜉�</span>
                </button>
                {onApplyLineNurturingStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyLineNurturingStarterSet}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>蜈ｱ騾壽蕗閧ｲ7隧ｱ繧呈怙譁ｰ蛹・/span>
                  </button>
                )}
              </div>
            </div>

            {/* 謨呵ご繧ｹ繝・ャ繝鈴・菫｡繝ｫ繝ｼ繝ｫ ・・蜈ｨ蟆守ｷ夐｣蜍穂ｻ墓ｧ・*/}
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>謨呵ご繧ｹ繝・ャ繝励・驟堺ｿ｡繝ｫ繝ｼ繝ｫ・・譯茨ｼ夐聞譛溯ご謌仙梛・会ｼ・蜈ｨ蟆守ｷ夐｣蜍・/span>
                </div>
                <span className="text-[11px] font-mono text-indigo-700 bg-white px-2.5 py-0.5 rounded-md border border-indigo-200">
                  蝓ｺ貅・ 2譌･縲・0譌･・亥・蟯殖/C: 7譌･縲・5譌･ ・・險ｺ譁ｭ繝ｻ雉・侭: 11譌･縲・9譌･・・                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {FUNNEL_ORCHESTRATION_RULES.map((rule) => (
                  <div
                    key={rule.id}
                    className="bg-white rounded-xl border border-indigo-100 p-3 space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{rule.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold shrink-0">
                        {rule.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{rule.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {(() => {
                const matchedEntries = [1, 2, 3, 4, 5, 6, 7].map((stepNum) => ({
                  stepNum,
                  matchedScenario:
                    nurturingScenarios.find((s) => s.name.includes(`隨ｬ${stepNum}隧ｱ`)) ||
                    nurturingScenarios.find((s) => s.name.includes(String(stepNum))),
                }));
                const matchedIds = new Set(
                  matchedEntries.map((entry) => entry.matchedScenario?.id).filter((id): id is string => Boolean(id))
                );
                const extraNurturing = nurturingScenarios.filter((s) => !matchedIds.has(s.id));

                return (
                  <>
                    {matchedEntries.map(({ stepNum, matchedScenario }) => {
                      const tpl = getNurturingStepTemplate(stepNum);
                      const waitDaysNum = (stepNum - 1) * 3 + 2;
                      const waitDays = `${waitDaysNum}譌･蠕形;

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
                                    隨ｬ{stepNum}隧ｱ ({waitDays}
                                    {(matchedScenario?.preferredSendTime ?? '10:00')
                                      ? ` ﾂｷ ${matchedScenario?.preferredSendTime || '10:00'}鬆チ
                                      : ''}
                                    )
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                                    {matchedScenario?.channel === 'line'
                                      ? 'LINE'
                                      : matchedScenario?.channel === 'email'
                                      ? '繝｡繝ｼ繝ｫ'
                                      : 'LINE蜆ｪ蜈茨ｼ医Γ繝ｼ繝ｫ陬懷ｮ鯉ｼ・}
                                  </span>
                                  <span className="font-bold text-slate-900 text-sm">
                                    {matchedScenario?.name || tpl.name}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                  莉ｶ蜷・ {matchedScenario?.emailSubject || tpl.emailSubject}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                              {matchedScenario && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleScenarioAutomation(matchedScenario.id, Boolean(matchedScenario.automationEnabled))
                                  }
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    matchedScenario.automationEnabled
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {matchedScenario.automationEnabled ? (
                                    <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                                  ) : (
                                    <Pause className="w-3 h-3 text-slate-500" />
                                  )}
                                  <span>{matchedScenario.automationEnabled ? '閾ｪ蜍募ｮ溯｡御ｸｭ' : '荳譎ょ●豁｢荳ｭ'}</span>
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
                                title="譁・擇繝励Ξ繝薙Η繝ｼ"
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
                                    audience: '縺吶∋縺ｦ縺ｮ隕玖ｾｼ縺ｿ螳｢',
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
                                    status: 'prepared' as const,
                                    automationEnabled: true,
                                    sendTimeWindow: '09:00-20:00',
                                    preferredSendTime: '10:00',
                                    stopOnBooking: true,
                                    stopOnDeal: true,
                                    consentBasis: '驟堺ｿ｡蜷梧э縺ｫ蝓ｺ縺･縺擾ｼ・INE蜆ｪ蜈医・譛ｪ騾｣謳ｺ譎ゅΓ繝ｼ繝ｫ閾ｪ蜍募・譖ｿ・・,
                                    updatedAt: Date.now(),
                                  };
                                  handleOpenInspector(target);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                                <span>轤ｹ讀懊・邱ｨ髮・/span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {extraNurturing.map((scenario) => (
                      <div
                        key={scenario.id}
                        className="bg-slate-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-2xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold font-mono">
                              {scenario.waitMinutes === 0 ? '蜊ｳ譎・ : `${Math.round(scenario.waitMinutes / 1440)}譌･蠕形}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                              {scenario.channel === 'line'
                                ? 'LINE'
                                : scenario.channel === 'email'
                                ? '繝｡繝ｼ繝ｫ'
                                : 'LINE+繝｡繝ｼ繝ｫ'}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {scenario.emailSubject || scenario.messageBody || '譁・擇譛ｪ險ｭ螳・}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              scenario.automationEnabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {scenario.automationEnabled ? (
                              <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                            ) : (
                              <Pause className="w-3 h-3 text-slate-500" />
                            )}
                            <span>{scenario.automationEnabled ? '閾ｪ蜍募ｮ溯｡御ｸｭ' : '荳譎ょ●豁｢荳ｭ'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenInspector(scenario)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                            <span>轤ｹ讀懊・邱ｨ髮・/span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {/* 繝医Λ繝・け 2: 笨会ｸ・蝟ｶ讌ｭ繝｡繝ｼ繝ｫ・亥腰逋ｺ繝・Φ繝励Ξ繝ｼ繝・・・5谿ｵ髫弱せ繝・ャ繝暦ｼ・    */}
      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {viewMode === 'flow' && activeTrack === 'sales_outreach' && (
        <div className="space-y-5 animate-fade-in">
          {/* 繧ｳ繝ｳ繝代け繝医↑繝倥ャ繝繝ｼ ・・繝ｫ繝ｼ繝ｫ遒ｺ隱阪ヨ繧ｰ繝ｫ */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  蝟ｶ讌ｭ繝｡繝ｼ繝ｫ繝・Φ繝励Ξ繝ｼ繝茨ｼ亥腰逋ｺ謠先｡・・・5谿ｵ髫手ｿｽ螳｢・・                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  3譌･縺翫″閾ｪ蜍暮・菫｡・・9:00縲・8:00・峨・霑比ｿ｡繧・ｺ育ｴ・′蜈･繧九→谿九ｊ縺ｮ閾ｪ蜍暮∽ｿ｡縺ｯ蜊ｳ譎ょ●豁｢縺励∪縺吶・                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOutreachSpec((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                >
                  <span>驟堺ｿ｡莉墓ｧ倥・讌ｭ遞ｮ蛻･繧ｵ繝ｳ繝励Ν</span>
                  {showOutreachSpec ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {onApplyOutreachStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyOutreachStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>5谿ｵ髫弱ｒ讓呎ｺ匁枚髱｢縺ｫ譖ｴ譁ｰ</span>
                  </button>
                )}
              </div>
            </div>

            {showOutreachSpec && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">髢句ｧ九ち繧､繝溘Φ繧ｰ</div>
                    <div className="text-slate-600">
                      隕玖ｾｼ縺ｿ莨∵･ｭ繝ｪ繧ｹ繝医°繧蛾∽ｿ｡縺励◆譎ゑｼ・縲・騾夂岼縺ｯ隨ｬ1騾夐∽ｿ｡蠕後・縺ｿ襍ｷ蜍包ｼ・                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">驟堺ｿ｡繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ</div>
                    <div className="text-slate-600">
                      0譌･逶ｮ 竊・3譌･蠕・竊・6譌･蠕・竊・9譌･蠕・竊・12譌･蠕鯉ｼ・0:00鬆・・09:00縲・8:00・・                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900">閾ｪ蜍募●豁｢譚｡莉ｶ</div>
                    <div className="text-slate-600">
                      霑比ｿ｡繝ｻ險ｺ譁ｭ蝗樒ｭ斐・髱｢隲・ｺ育ｴ・・驟堺ｿ｡蛛懈ｭ｢繝ｻ荳埼＃繧呈､懃衍縺励◆迸ｬ髢薙↓蛛懈ｭ｢
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      讌ｭ遞ｮ蛻･縺ｮ閾ｪ蜍募ｷｮ縺苓ｾｼ縺ｿ譁・ｾ九ｒ遒ｺ隱・
                    </span>
                    <select
                      value={selectedIndustry}
                      onChange={(e) => setSelectedIndustry(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:border-blue-500 cursor-pointer"
                    >
                      <optgroup label="驥咲せ5讌ｭ遞ｮ">
                        {PRIORITY_INDUSTRY_KEYS.map((ind) => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </optgroup>
                      <optgroup label="縺昴・莉悶・讌ｭ遞ｮ">
                        {Object.keys(INDUSTRY_MESSAGES)
                          .filter((ind) => !(PRIORITY_INDUSTRY_KEYS as readonly string[]).includes(ind))
                          .map((ind) => (
                            <option key={ind} value={ind}>{ind}</option>
                          ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <span className="text-rose-700 font-bold block">隨ｬ1騾壹・隱ｲ鬘後Γ繝・そ繝ｼ繧ｸ・・selectedIndustry}・・/span>
                      <p className="text-slate-600 leading-relaxed text-[11px]">{getIndustryMessage(selectedIndustry, 'problem')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                      <span className="text-emerald-700 font-bold block">隨ｬ3騾壹・繝｡繝ｪ繝・ヨ繝｡繝・そ繝ｼ繧ｸ・・selectedIndustry}・・/span>
                      <p className="text-slate-600 leading-relaxed text-[11px]">{getIndustryMessage(selectedIndustry, 'benefit')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 蜊倡匱: 荳逋ｺ逶ｴ逅・署譯茨ｼ育､ｾ螟門承閻包ｼ峨ユ繝ｳ繝励Ξ繝ｼ繝育ｷｨ髮・せ繝ｭ繝・ヨ */}
          {(() => {
            const sampleDraft = resolveOneShotOutreachDraft(
              oneShotScenario,
              '繧ｵ繝ｳ繝励Ν譬ｪ蠑丈ｼ夂､ｾ',
              '螻ｱ逕ｰ 螟ｪ驛・,
              selectedIndustry,
              'https://corp.mstcorp.info/diagnosis'
            );
            const isCustomized = Boolean(oneShotScenario);
            return (
              <div className="bg-white border border-purple-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-purple-800">
                        蜊倡匱蝟ｶ讌ｭ繝｡繝ｼ繝ｫ・井ｸ逋ｺ逶ｴ逅・署譯茨ｼ・                      </span>
                      <span className="text-[11px] text-slate-500">
                        ﾂｷ {isCustomized ? '繧ｫ繧ｹ繧ｿ繝�邱ｨ髮・ｸ医∩' : '讓呎ｺ悶ユ繝ｳ繝励Ξ繝ｼ繝井ｽｿ逕ｨ荳ｭ'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {ONE_SHOT_SCENARIO_NAME}
                    </h4>
                    <div className="text-xs text-slate-600 mt-0.5 truncate">
                      莉ｶ蜷・ {sampleDraft.subject}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {isCustomized && (
                      <button
                        type="button"
                        onClick={() => handleDeleteInspectorScenario(oneShotScenario!.id)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        title="繧ｫ繧ｹ繧ｿ繝�邱ｨ髮・ｒ隗｣髯､縺励※蛻晄悄縺ｮ讓呎ｺ悶ユ繝ｳ繝励Ξ繝ｼ繝医↓謌ｻ縺励∪縺・
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span>讓呎ｺ悶↓謌ｻ縺・/span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenOneShotEditor}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>繝・Φ繝励Ξ繝ｼ繝育ｷｨ髮・/span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-sans text-xs text-slate-700 max-h-24 overflow-hidden relative">
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed">{sampleDraft.body}</pre>
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
                </div>
              </div>
            );
          })()}

          {/* 5繧ｹ繝・ャ繝励・繧ｿ繧､繝�繝ｩ繧､繝ｳ繧ｫ繝ｼ繝・*/}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const draft = getSalesEmailTemplate(stepNum, '繧ｵ繝ｳ繝励Ν譬ｪ蠑丈ｼ夂､ｾ', '螻ｱ逕ｰ 螟ｪ驛・, selectedIndustry, 'https://corp.mstcorp.info/diagnosis');
              const waitDays = stepNum === 1 ? '0譌･逶ｮ・亥・蝗橸ｼ・ : `${(stepNum - 1) * 3}譌･蠕形;
              const matchedScenario = outreachScenarios.find(s => s.id !== ONE_SHOT_SCENARIO_ID && !s.name.includes('荳逋ｺ逶ｴ逅・) && s.name.includes(String(stepNum)));
              const displaySubject = matchedScenario?.emailSubject || draft.subject;
              const displayBody = matchedScenario?.emailBody || draft.body;

              return (
                <div
                  key={stepNum}
                  className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-xs space-y-2.5 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {stepNum}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-blue-700">
                            隨ｬ{stepNum}騾・ﾂｷ {waitDays}{stepNum > 1 && (matchedScenario?.preferredSendTime ?? '10:00') ? ` (${matchedScenario?.preferredSendTime || '10:00'}鬆・` : ''}
                          </span>
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {matchedScenario?.name || draft.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 truncate">
                          莉ｶ蜷・ {displaySubject}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {matchedScenario && (
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(matchedScenario.id, Boolean(matchedScenario.automationEnabled))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                            matchedScenario.automationEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {matchedScenario.automationEnabled ? <Play className="w-3 h-3 fill-emerald-600 text-emerald-600" /> : <Pause className="w-3 h-3 text-slate-500" />}
                          <span>{matchedScenario.automationEnabled ? '遞ｼ蜒堺ｸｭ' : '蛛懈ｭ｢荳ｭ'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const target = matchedScenario || {
                            id: `outreach-${stepNum}`,
                            name: draft.name,
                            trigger: 'lead_created' as const,
                            channel: 'email' as const,
                            audience: '譛ｪ謗･隗ｦ縺ｮ隕玖ｾｼ縺ｿ莨∵･ｭ',
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
                            consentBasis: '迚ｹ螳夐崕蟄舌Γ繝ｼ繝ｫ豕輔↓蝓ｺ縺･縺乗･ｭ蜍呎隼蝟・ュ蝣ｱ縺ｮ謠蝉ｾ・,
                            updatedAt: Date.now(),
                          };
                          handleOpenInspector(target);
                        }}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>邱ｨ髮・・繝励Ξ繝薙Η繝ｼ</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-sans text-xs text-slate-600 max-h-16 overflow-hidden relative">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{displayBody}</pre>
                    <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {/* 繝医Λ繝・け 3: �祷 雉・侭隲区ｱょｾ・・・�､・髱｢隲・・謠先｡域嶌騾∽ｻ伜ｾ後ヵ繧ｩ繝ｭ繝ｼ      */}
      {/* 笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊絶武笊・*/}
      {viewMode === 'flow' && activeTrack === 'inbound_material' && (
        <div className="space-y-6 animate-fade-in">
          {/* 繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ 1: 雉・侭隲区ｱょｾ後・閾ｪ蜍戊ｿｽ螳｢・・譌･蠕後・3譌･蠕後・7譌･蠕鯉ｼ・*/}
          <div className="bg-white border border-teal-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
                    雉・侭隲区ｱょｾ・                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    雉・侭隲区ｱょｾ後・閾ｪ蜍戊ｿｽ螳｢・・譌･蠕後・3譌･蠕後・7譌･蠕鯉ｼ・                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {materialFollowupScenarios.filter((s) => s.automationEnabled).length}/{materialFollowupScenarios.length}莉ｶ 遞ｼ蜒堺ｸｭ
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  雉・侭隲区ｱゅヵ繧ｩ繝ｼ繝�騾∽ｿ｡譎ゅ↓襍ｷ蜍輔＠縲´INE・九Γ繝ｼ繝ｫ縺ｮ荳｡譁ｹ縺ｧ閾ｪ蜍輔ヵ繧ｩ繝ｭ繝ｼ縺励∪縺呻ｼ育嶌謇九°繧峨・霑比ｿ｡繝ｻ蝠・ｫ・ｺ育ｴ・・蝠・ｫ・喧縺ｧ蜊ｳ蛛懈ｭ｢・峨・                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {materialFollowupScenarios.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allActive = materialFollowupScenarios.every((s) => s.automationEnabled);
                      toggleGroupAutomation(materialFollowupScenarios, !allActive);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                  >
                    {materialFollowupScenarios.every((s) => s.automationEnabled) ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-slate-500" />
                        <span>荳諡ｬ蛛懈ｭ｢</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-teal-600 fill-teal-600" />
                        <span>荳諡ｬON</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCreateNewStep}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>繧ｹ繝・ャ繝苓ｿｽ蜉�</span>
                </button>
                {onApplyMaterialStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyMaterialStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5 text-teal-200" />
                    <span>蟆主・ / 譛譁ｰ蛹・/span>
                  </button>
                )}
              </div>
            </div>

            {materialFollowupScenarios.length === 0 ? (
              <div className="p-6 bg-teal-50/40 rounded-xl border border-dashed border-teal-200 text-center space-y-3">
                <p className="text-xs text-slate-600">
                  雉・侭隲区ｱょｾ後・閾ｪ蜍戊ｿｽ螳｢繧ｹ繝・ャ繝暦ｼ・譌･蠕鯉ｼ夊ｳ・侭遒ｺ隱・竊・3譌･蠕鯉ｼ壻ｺ倶ｾ具ｼ・嶌隲・竊・7譌･蠕鯉ｼ壽怙邨ゅ♀莨ｺ縺・ｼ峨′縺ｾ縺�逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ縲・                </p>
                {onApplyMaterialStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyMaterialStarterSet}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>雉・侭隲区ｱゅヵ繧ｩ繝ｭ繝ｼ3譛ｬ繧貞ｰ主・縺吶ｋ</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {materialFollowupScenarios.map((scenario, idx) => (
                  <div
                    key={scenario.id}
                    className="bg-slate-50/70 border border-slate-200 hover:border-teal-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 border border-teal-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono">
                            {scenario.waitMinutes === 0 ? '蜊ｳ譎・ : `${Math.round(scenario.waitMinutes / 1440)}譌･蠕形}
                            {scenario.preferredSendTime ? ` (${scenario.preferredSendTime}鬆・` : ''}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-medium">
                            {scenario.channel === 'both' ? 'LINE・九Γ繝ｼ繝ｫ' : scenario.channel === 'email' ? '繝｡繝ｼ繝ｫ縺ｮ縺ｿ' : 'LINE縺ｮ縺ｿ'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          莉ｶ蜷・ {scenario.emailSubject || scenario.flexTitle || scenario.messageBody || '譛ｪ險ｭ螳・}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                          scenario.automationEnabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {scenario.automationEnabled ? (
                          <>
                            <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                            <span>閾ｪ蜍募ｮ溯｡御ｸｭ</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3 text-slate-400" />
                            <span>荳譎ょ●豁｢荳ｭ</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewModalScenario(scenario)}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer"
                        title="譁・擇繝励Ξ繝薙Η繝ｼ"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInspector(scenario)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs whitespace-nowrap"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                        <span>轤ｹ讀懊・邱ｨ髮・/span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ 2: 髱｢隲・ｾ後・隧ｳ邏ｰ繝ｬ繝昴・繝医・謠先｡域嶌騾∽ｻ伜ｾ後・閾ｪ蜍輔ヵ繧ｩ繝ｭ繝ｼ */}
          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    蝠・ｫ・・謠先｡亥ｾ・                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    髱｢隲・ｾ後・縺疲署譯域嶌騾∽ｻ伜ｾ後・閾ｪ蜍輔ヵ繧ｩ繝ｭ繝ｼ
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {postMeetingScenarios.filter((s) => s.automationEnabled).length}/{postMeetingScenarios.length}莉ｶ 遞ｼ蜒堺ｸｭ
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  縲悟膚隲・ｮ御ｺ・阪ｄ縲後＃謠先｡域嶌・郁ｨｺ譁ｭ邨先棡・区署譯茨ｼ峨・騾∽ｿ｡縲阪ｒ襍ｷ轤ｹ縺ｫ閾ｪ蜍暮・菫｡縲ゆｸ・ｸ繝ｬ繝昴・繝医・謠先｡域嶌縺ｮ荳｡譁ｹ縺碁∽ｻ倥＆繧後※繧・譌･蠕後・7譌･蠕後・1騾壹・縺ｿ騾∽ｿ｡縺輔ｌ縲∬ｿ比ｿ｡縺ｾ縺溘・謌千ｴ・・螟ｱ豕ｨ縺ｧ閾ｪ蜍募●豁｢縺励∪縺吶・                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {postMeetingScenarios.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allActive = postMeetingScenarios.every((s) => s.automationEnabled);
                      toggleGroupAutomation(postMeetingScenarios, !allActive);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                  >
                    {postMeetingScenarios.every((s) => s.automationEnabled) ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-slate-500" />
                        <span>荳諡ｬ蛛懈ｭ｢</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                        <span>荳諡ｬON</span>
                      </>
                    )}
                  </button>
                )}
                {onApplyPostMeetingStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyPostMeetingStarterSet}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-100" />
                    <span>蟆主・ / 譛譁ｰ蛹・/span>
                  </button>
                )}
              </div>
            </div>

            {postMeetingScenarios.length === 0 ? (
              <div className="p-6 bg-amber-50/40 rounded-xl border border-dashed border-amber-200 text-center space-y-3">
                <p className="text-xs text-slate-600">
                  髱｢隲・ｾ鯉ｼ・譎る俣蠕後♀遉ｼ・峨・縺疲署譯域嶌騾∽ｻ伜ｾ鯉ｼ・譌･蠕後・7譌･蠕鯉ｼ峨・邨ｱ蜷医ヵ繧ｩ繝ｭ繝ｼ縺後∪縺�逋ｻ骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ縲・                </p>
                {onApplyPostMeetingStarterSet && (
                  <button
                    type="button"
                    onClick={onApplyPostMeetingStarterSet}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>髱｢隲・・謠先｡亥ｾ後ヵ繧ｩ繝ｭ繝ｼ3譛ｬ繧貞ｰ主・縺吶ｋ</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {postMeetingScenarios.map((scenario, idx) => {
                  const triggerLabelText =
                    scenario.trigger === 'meeting_completed'
                      ? '髱｢隲・ｮ御ｺ・凾'
                      : scenario.trigger === 'report_or_proposal_sent'
                      ? '謠先｡域嶌繝ｻ繝ｬ繝昴・繝磯∽ｻ俶凾・育ｵｱ蜷茨ｼ・
                      : scenario.trigger === 'report_sent'
                      ? '繝ｬ繝昴・繝磯∽ｻ俶凾'
                      : scenario.trigger === 'report_approved'
                      ? '繝ｬ繝昴・繝域価隱肴凾'
                      : scenario.trigger === 'proposal_sent'
                      ? '謠先｡域嶌騾∽ｻ俶凾'
                      : scenario.trigger === 'proposal_approved'
                      ? '謠先｡域嶌謇ｿ隱肴凾'
                      : '謇句虚';
                  const waitText =
                    scenario.waitMinutes === 0
                      ? '蜊ｳ譎・
                      : scenario.waitMinutes < 1440
                      ? `${Math.max(1, Math.round(scenario.waitMinutes / 60))}譎る俣蠕形
                      : `${Math.round(scenario.waitMinutes / 1440)}譌･蠕形;
                  return (
                    <div
                      key={scenario.id}
                      className="bg-slate-50/70 border border-slate-200 hover:border-amber-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{scenario.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                              {triggerLabelText}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono">
                              {waitText}
                              {scenario.waitMinutes >= 1440 && scenario.preferredSendTime ? ` (${scenario.preferredSendTime}鬆・` : ''}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                              {scenario.channel === 'both' ? 'LINE・九Γ繝ｼ繝ｫ' : scenario.channel === 'email' ? '繝｡繝ｼ繝ｫ縺ｮ縺ｿ' : 'LINE縺ｮ縺ｿ'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            莉ｶ蜷・ {scenario.emailSubject || scenario.messageBody || '譛ｪ險ｭ螳・}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleScenarioAutomation(scenario.id, Boolean(scenario.automationEnabled))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                            scenario.automationEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {scenario.automationEnabled ? (
                            <>
                              <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                              <span>閾ｪ蜍募ｮ溯｡御ｸｭ</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 text-slate-400" />
                              <span>荳譎ょ●豁｢荳ｭ</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewModalScenario(scenario)}
                          className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs border border-slate-200 transition cursor-pointer"
                          title="譁・擇繝励Ξ繝薙Η繝ｼ"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenInspector(scenario)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs whitespace-nowrap"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                          <span>轤ｹ讀懊・邱ｨ髮・/span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}



      {/* 繧ｭ繝ｼ繝ｯ繝ｼ繝芽ｿｽ蜉�繝ｻ邱ｨ髮・Δ繝ｼ繝繝ｫ */}
      {isEditingKeywordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingRule ? '繧ｭ繝ｼ繝ｯ繝ｼ繝芽・蜍募ｿ懃ｭ斐ｒ邱ｨ髮・ : '譁ｰ縺励＞繧ｭ繝ｼ繝ｯ繝ｼ繝芽・蜍募ｿ懃ｭ斐ｒ霑ｽ蜉�'}
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
                <label className="font-bold text-slate-700 block mb-1">邂｡逅・錐遘ｰ</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="萓・ 縲瑚ｨｺ譁ｭ縲埼∽ｿ｡譎・
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">蜿榊ｿ懊く繝ｼ繝ｯ繝ｼ繝・*</label>
                  <input
                    type="text"
                    required
                    value={ruleKeyword}
                    onChange={(e) => setRuleKeyword(e.target.value)}
                    placeholder="萓・ 險ｺ譁ｭ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">繝槭ャ繝∵婿蠑・/label>
                  <select
                    value={ruleMode}
                    onChange={(e) => setRuleMode(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="contains">驛ｨ蛻・ｸ閾ｴ・亥性繧縺ｨ縺搾ｼ・/option>
                    <option value="exact">螳悟・荳閾ｴ・井ｸ閾ｴ縺ｮ縺ｿ・・/option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">閾ｪ蜍戊ｿ比ｿ｡縺吶ｋ繝｡繝・そ繝ｼ繧ｸ譁・擇 *</label>
                <textarea
                  rows={8}
                  required
                  value={ruleReply}
                  onChange={(e) => setRuleReply(e.target.value)}
                  placeholder="霑比ｿ｡縺吶ｋ譁・ｫ�繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・link_url} 繧・{booking_url} 縺悟茜逕ｨ縺ｧ縺阪∪縺吶・
                  className="w-full min-h-[180px] bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 font-sans leading-relaxed focus:bg-white focus:outline-none focus:border-amber-500 resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">閾ｪ蜍穂ｻ倅ｸ弱☆繧九ち繧ｰ</label>
                  <input
                    type="text"
                    value={ruleTag}
                    onChange={(e) => setRuleTag(e.target.value)}
                    placeholder="萓・ 驕ｸ謚・險ｺ譁ｭ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-emerald-700 focus:bg-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">騾｣蜍輔☆繧句ｰ守ｷ壼・蟯・/label>
                  <select
                    value={ruleTargetBranch}
                    onChange={(e) => setRuleTargetBranch(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="diagnosis">A: 3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ</option>
                    <option value="consult">B: 邨悟霧蛟句挨逶ｸ隲・/option>
                    <option value="care">C: 莉玖ｭｷ髢区･ｭ繝代ャ繧ｱ繝ｼ繧ｸ</option>
                    <option value="general">荳闊ｬ蝠上＞蜷医ｏ縺・/option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingKeywordModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold cursor-pointer transition"
                >
                  繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  菫晏ｭ倥☆繧・                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 譁・擇繝励Ξ繝薙Η繝ｼ繝｢繝ｼ繝繝ｫ */}
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
                  <span className="text-slate-500 text-[11px] block mb-1 font-sans font-medium">莉ｶ蜷・</span>
                  <p className="text-slate-900 font-bold">{previewModalScenario.emailSubject}</p>
                </div>
              )}

              {previewModalScenario.emailBody && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1 font-sans font-medium">繝｡繝ｼ繝ｫ譛ｬ譁・</span>
                  <pre className="text-slate-800 whitespace-pre-wrap leading-relaxed font-mono">
                    {previewModalScenario.emailBody}
                  </pre>
                </div>
              )}

              {previewModalScenario.messageBody && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1 font-sans font-medium">LINE繝｡繝・そ繝ｼ繧ｸ譛ｬ譁・</span>
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
                髢峨§繧・              </button>
            </div>
          </div>
        </div>
      )}

      {/* 隧ｳ邏ｰ繧､繝ｳ繧ｹ繝壹け繧ｿ繝ｼ繝｢繝ｼ繝繝ｫ */}
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
