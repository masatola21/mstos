import React, { useState, useEffect, useMemo } from 'react';
import { 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Share2, 
  FileText, 
  MessageCircle, 
  Calendar, 
  Globe,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
  CheckCircle2,
  Info,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Tag,
  Settings2,
  SlidersHorizontal
} from 'lucide-react';
import { OfficialLinkItem } from '../../types/marketing';
import { 
  OFFICIAL_VERCEL_URLS,
  migrateOfficialLinks,
  loadStoredOfficialLinks, 
  saveStoredOfficialLinks, 
  clearStoredOfficialLinks,
  loadStoredTrackingMedia,
  saveStoredTrackingMedia,
  clearStoredTrackingMedia,
  migrateTrackingMediaList
} from '../../utils/marketingStorage';
import { getSupabase } from '../../lib/supabaseClient';

export interface MediumPreset {
  id: string;
  name: string;
  category: string;
  badge: string;
  badgeColor: string;
  description: string;
  utmSource: string;
  utmMedium: string;
  isCustom?: boolean;
}

export const TRACKING_MEDIA_PRESETS: MediumPreset[] = [
  {
    id: 'hp_blog',
    name: 'HP繝ｻ繝悶Ο繧ｰ險倅ｺ・,
    category: 'Owned / Blog',
    badge: '險倅ｺ・,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: '蜈ｬ蠑秋P繧ｳ繝ｩ繝繧・ｧ｣隱ｬ險倅ｺ九°繧峨・隱伜ｰ守畑',
    utmSource: 'hp_blog',
    utmMedium: 'article',
  },
  {
    id: 'sns',
    name: 'SNS・・nstagram繝ｻThreads繝ｻFacebook繝ｻLinkedIn遲峨・繝励Ο繝輔ぅ繝ｼ繝ｫ・・,
    category: 'Social',
    badge: 'SNS',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    description: '蜷ТNS縺ｮ繝励Ο繝輔ぅ繝ｼ繝ｫ繝ｪ繝ｳ繧ｯ繧・壼ｸｸ謚慕ｨｿ逕ｨ',
    utmSource: 'sns',
    utmMedium: 'social',
  },
  {
    id: 'line',
    name: 'LINE・磯・菫｡繝ｻ繝ｪ繝・メ繝｡繝九Η繝ｼ・・,
    category: 'Chat / CRM',
    badge: 'LINE',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'LINE蜈ｬ蠑上い繧ｫ繧ｦ繝ｳ繝磯・菫｡繧・Μ繝・メ繝｡繝九Η繝ｼ逕ｨ',
    utmSource: 'line',
    utmMedium: 'chat',
  },
  {
    id: 'email',
    name: '繝｡繝ｼ繝ｫ・亥霧讌ｭ繝ｻ謨呵ご繧ｹ繝・ャ繝暦ｼ・,
    category: 'Direct',
    badge: '繝｡繝ｼ繝ｫ',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: '蛟句挨蝟ｶ讌ｭ繝｡繝ｼ繝ｫ繧・Γ繝ｫ繝槭ぎ繝ｻ譯亥・譁・擇逕ｨ',
    utmSource: 'email',
    utmMedium: 'email',
  },
  {
    id: 'material',
    name: '雉・侭・郁ｳ・侭隲区ｱゅ・蝠・ｫ・ｳ・侭蜀・・繝ｪ繝ｳ繧ｯ・讐R・・,
    category: 'Document',
    badge: '雉・侭',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: '謠先｡域嶌繝ｻ繝繧ｦ繝ｳ繝ｭ繝ｼ繝芽ｳ・侭繝ｻ蜷榊絢QR遲臥畑',
    utmSource: 'material',
    utmMedium: 'document',
  },
];

const COMMON_MEDIUM_TYPES = [
  { value: 'social', label: 'social・・NS謚慕ｨｿ繝ｻ繝励Ο繝包ｼ・ },
  { value: 'article', label: 'article・郁ｨ倅ｺ九・繧ｪ繧ｦ繝ｳ繝峨Γ繝・ぅ繧｢・・ },
  { value: 'short_video', label: 'short_video・・ikTok繝ｻ繝ｪ繝ｼ繝ｫ遲会ｼ・ },
  { value: 'video', label: 'video・・ouTube蜍慕判繝ｻ讎りｦ∵ｬ・ｼ・ },
  { value: 'chat', label: 'chat・・INE繝ｻ繝√Ε繝・ヨ繝ｻDM・・ },
  { value: 'offline_qr', label: 'offline_qr・育ｴ吶メ繝ｩ繧ｷ繝ｻ蜷榊絢繝ｻPOP・・ },
  { value: 'email', label: 'email・医Γ繝ｫ繝槭ぎ繝ｻ繧ｹ繝・ャ繝鈴・菫｡・・ },
  { value: 'cpc', label: 'cpc・・eb蠎・相繝ｻ繝ｪ繧ｹ繝・ぅ繝ｳ繧ｰ・・ },
  { value: 'referral', label: 'referral・亥､夜Κ邏ｹ莉九・謠先声繝代・繝医リ繝ｼ・・ },
];

const ICON_MAP = {
  'sparkles': Sparkles,
  'file-text': FileText,
  'message-circle': MessageCircle,
  'calendar': Calendar,
  'globe': Globe,
  'link': Link2,
};

type IconKey = keyof typeof ICON_MAP;

const BADGE_COLOR_OPTIONS = [
  { label: '繧ｨ繝｡繝ｩ繝ｫ繝会ｼ郁ｨ倅ｺ九・繝悶Ο繧ｰ・・, value: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: '繧ｹ繧ｫ繧､・・ / Twitter・・, value: 'bg-sky-50 text-sky-700 border-sky-200' },
  { label: '繝斐Φ繧ｯ・・nstagram・・, value: 'bg-pink-50 text-pink-700 border-pink-200' },
  { label: '繧ｰ繝ｪ繝ｼ繝ｳ・・INE・・, value: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: '繧｢繝ｳ繝舌・・育ｴ吶メ繝ｩ繧ｷ繝ｻQR・・, value: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: '繝代・繝励Ν・亥ｺ・相繝ｻLP・・, value: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: '繝ｭ繝ｼ繧ｺ・亥虚逕ｻ繝ｻYouTube・・, value: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: '繧ｷ繧｢繝ｳ・医Γ繝ｼ繝ｫ繝ｻ莠育ｴ・ｼ・, value: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: '繝悶Ν繝ｼ・域署謳ｺ繝ｻ螟夜Κ・・, value: 'bg-blue-50 text-blue-700 border-blue-200' },
];

export const MarketingQuickLinksHub: React.FC = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mstos.app';

  // 蛻晄悄繝・ヵ繧ｩ繝ｫ繝医Μ繝ｳ繧ｯ螳夂ｾｩ・・ercel蜈ｬ蠑秋P繝ｻ險ｺ譁ｭ繝ｻ蛟句挨逶ｸ隲・・菴懈姶莨夊ｭｰ繧貞・鬆ｭ縺ｫ驟咲ｽｮ・・  const defaultLinks: OfficialLinkItem[] = useMemo(() => [
    {
      id: 'diagnosis',
      title: '3蛻・┌譁吶・繝医Ν繝阪ャ繧ｯ險ｺ譁ｭ',
      description: '蜈ｬ蠑秋P荳翫・閾ｪ蜍戊ｨｺ譁ｭ繝輔か繝ｼ繝・育ｵ悟霧繝ｻ讌ｭ蜍吶・諤･謇縺ｨ謾ｹ蝟・・譁ｹ邂九ｒ迚ｹ螳夲ｼ・,
      url: OFFICIAL_VERCEL_URLS.diagnosis,
      badge: '鬮俶・邏・紫',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      iconName: 'sparkles',
    },
    {
      id: 'care_consult',
      title: '莉玖ｭｷ菫晞匱螟悶し繝ｼ繝薙せ髢区･ｭ繝ｻ蛟句挨逶ｸ隲・,
      description: '莉玖ｭｷ菫晞匱螟夜幕讌ｭ繝代ャ繧ｱ繝ｼ繧ｸ蟆ら畑LP繝ｻ縺顔筏縺苓ｾｼ縺ｿ繝壹・繧ｸ',
      url: OFFICIAL_VERCEL_URLS.care_consult,
      badge: '鬮倬｡阪ヱ繝・こ繝ｼ繧ｸ逶ｴ邨・,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconName: 'file-text',
    },
    {
      id: 'booking',
      title: '30蛻・┌譁吩ｽ懈姶莨夊ｭｰ・磯擇隲・律遞倶ｺ育ｴ・ｼ・,
      description: '蟇ｾ髱｢蝟ｶ讌ｭ繧・嶌隲・ｾ後↓譯亥・縺吶ｋ繧ｪ繝ｳ繝ｩ繧､繝ｳ髱｢隲・き繝ｬ繝ｳ繝繝ｼ',
      url: 'https://timerex.net/s/mstcorp/c3dd3eea',
      badge: '蝠・ｫ・峩陦・,
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      iconName: 'calendar',
    },
    {
      id: 'material_download',
      title: '邨悟霧謾ｹ蝟・ｮ溷漁繧ｬ繧､繝・雉・侭隲区ｱ・,
      description: '蜈ｬ蠑秋P縺ｮ雉・侭繝繧ｦ繝ｳ繝ｭ繝ｼ繝峨・莨夂､ｾ讎りｦ∬ｫ区ｱゅ・繝ｼ繧ｸ',
      url: OFFICIAL_VERCEL_URLS.material_download,
      badge: '雉・侭隲区ｱ・,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      iconName: 'file-text',
    },
    {
      id: 'line_add',
      title: '蜈ｬ蠑臭INE 蜿九□縺｡霑ｽ蜉繝ｪ繝ｳ繧ｯ',
      description: 'LINE蜈ｬ蠑上い繧ｫ繧ｦ繝ｳ繝亥暑縺縺｡霑ｽ蜉・遺ｻ豬∝・蜈・ｨ域ｸｬ荳榊庄・・,
      url: 'https://line.me/R/ti/p/@mst_management',
      badge: '蜿九□縺｡霑ｽ蜉',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconName: 'message-circle',
    },
    {
      id: 'media_top',
      title: '閾ｪ遉ｾ繧ｪ繧ｦ繝ｳ繝峨Γ繝・ぅ繧｢ / 繧ｳ繝ｼ繝昴Ξ繝ｼ繝・P',
      description: '莨夂､ｾ讎りｦ√・蟆る摩繧ｳ繝ｩ繝繝ｻ繝・ず繧ｿ繝ｫ蝠・刀縺ｮ譛ｬ諡蝨ｰ',
      url: OFFICIAL_VERCEL_URLS.media_top,
      badge: 'HP逶ｴ謗･',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      iconName: 'globe',
    },
  ], []);

  const [links, setLinks] = useState<OfficialLinkItem[]>(defaultLinks);
  const [mediaList, setMediaList] = useState<MediumPreset[]>(() => {
    const stored = loadStoredTrackingMedia<MediumPreset>(TRACKING_MEDIA_PRESETS);
    return stored && stored.length > 0 ? stored : TRACKING_MEDIA_PRESETS;
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // 譁ｽ遲悶・莨∫判蜷搾ｼ井ｻｻ諢剰ｨｭ螳壹∝・譛溘・謚倥ｊ縺溘◆縺ｿ・・  const [campaignName, setCampaignName] = useState<string>('');
  const [showCampaignOption, setShowCampaignOption] = useState<boolean>(false);
  const [showMediaManagement, setShowMediaManagement] = useState<boolean>(false);
  const [showUtmGuide, setShowUtmGuide] = useState<boolean>(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [selectedMatrixLinkId, setSelectedMatrixLinkId] = useState<string>('diagnosis');

  // 1. 蜈ｬ蠑上Μ繝ｳ繧ｯ邱ｨ髮・畑繝｢繝ｼ繝繝ｫ迥ｶ諷・  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficialLinkItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editBadgeColor, setEditBadgeColor] = useState(BADGE_COLOR_OPTIONS[0].value);
  const [editIconName, setEditIconName] = useState<IconKey>('link');
  const [editError, setEditError] = useState('');

  // 2. 蟐剃ｽ灘挨險ｭ螳夂ｷｨ髮・畑繝｢繝ｼ繝繝ｫ迥ｶ諷具ｼ亥ｪ剃ｽ灘錐縲∬ｪｬ譏弱「tm_source縲「tm_medium縲√ヰ繝・ず縺ｮ邱ｨ髮・・譁ｰ隕剰ｿｽ蜉・・  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediumPreset | null>(null);
  const [mediaFormName, setMediaFormName] = useState('');
  const [mediaFormDescription, setMediaFormDescription] = useState('');
  const [mediaFormSource, setMediaFormSource] = useState('');
  const [mediaFormMedium, setMediaFormMedium] = useState('social');
  const [mediaFormBadge, setMediaFormBadge] = useState('SNS');
  const [mediaFormBadgeColor, setMediaFormBadgeColor] = useState(BADGE_COLOR_OPTIONS[0].value);
  const [mediaFormError, setMediaFormError] = useState('');

  // 3. 蜑企勁繝ｻ繝ｪ繧ｻ繝・ヨ遒ｺ隱阪Δ繝ｼ繝繝ｫ迥ｶ諷具ｼ・indow.confirm縺ｮ莉｣譖ｿ縺ｧiframe螳牙ｿ・虚菴懶ｼ・  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // 繝・・繧ｿ縺ｮ蛻晏屓隱ｭ縺ｿ霎ｼ縺ｿ・医Ο繝ｼ繧ｫ繝ｫ繧ｹ繝医Ξ繝ｼ繧ｸ蜆ｪ蜈医ヾupabase蜷梧悄・・  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // 蜈ｬ蠑上Μ繝ｳ繧ｯ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ
      const localStoredLinks = loadStoredOfficialLinks();
      if (localStoredLinks && localStoredLinks.length > 0 && isMounted) {
        setLinks(localStoredLinks);
        if (!selectedMatrixLinkId) {
          setSelectedMatrixLinkId(localStoredLinks[0].id);
        }
      }

      // 蟐剃ｽ薙・繝ｪ繧ｻ繝・ヨ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ・域眠5蟐剃ｽ薙∈縺ｮ閾ｪ蜍輔・繧､繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ蟇ｾ蠢懶ｼ・      const localStoredMedia = loadStoredTrackingMedia<MediumPreset>(TRACKING_MEDIA_PRESETS);
      if (localStoredMedia && localStoredMedia.length > 0 && isMounted) {
        setMediaList(localStoredMedia);
      }

      // Supabase縺九ｉ繝ｪ繝｢繝ｼ繝亥酔譛・      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            // 繝ｪ繝ｳ繧ｯ險ｭ螳壹・隱ｭ縺ｿ霎ｼ縺ｿ
            const { data: linkData } = await supabase
              .from('mst_ai_acquisition_records')
              .select('payload')
              .eq('user_id', auth.user.id)
              .eq('id', 'mst_official_hub_links')
              .eq('record_type', 'funnel_hub_config')
              .maybeSingle();

            if (linkData?.payload?.links && Array.isArray(linkData.payload.links) && isMounted) {
              const { links: migratedLinks, changed } = migrateOfficialLinks(linkData.payload.links);
              setLinks(migratedLinks);
              saveStoredOfficialLinks(migratedLinks);
              if (changed) {
                await supabase.from('mst_ai_acquisition_records').upsert({
                  user_id: auth.user.id,
                  id: 'mst_official_hub_links',
                  record_type: 'funnel_hub_config',
                  title: '髮・ｮ｢蜍慕ｷ壼・蠑酋RL繝上ヶ險ｭ螳・,
                  payload: { links: migratedLinks },
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,id' });
              }
              if (!selectedMatrixLinkId && migratedLinks.length > 0) {
                setSelectedMatrixLinkId(migratedLinks[0].id);
              }
            }

            // 蟐剃ｽ楢ｨｭ螳壹・隱ｭ縺ｿ霎ｼ縺ｿ・医Μ繝｢繝ｼ繝医・譌ｧ險ｭ螳壹ｂ譁ｰ5蟐剃ｽ難ｼ九き繧ｹ繧ｿ繝縺ｫ閾ｪ蜍輔・繧､繧ｰ繝ｬ繝ｼ繧ｷ繝ｧ繝ｳ・・            const { data: mediaData } = await supabase
              .from('mst_ai_acquisition_records')
              .select('payload')
              .eq('user_id', auth.user.id)
              .eq('id', 'mst_official_hub_media')
              .eq('record_type', 'funnel_hub_config')
              .maybeSingle();

            if (mediaData?.payload?.media && Array.isArray(mediaData.payload.media) && isMounted) {
              const migrated = migrateTrackingMediaList(mediaData.payload.media, TRACKING_MEDIA_PRESETS);
              setMediaList(migrated);
              saveStoredTrackingMedia(migrated);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load official hub config from remote DB:', err);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [defaultLinks]);

  // 蜈ｬ蠑上Μ繝ｳ繧ｯ縺ｮ菫晏ｭ倥・繝ｫ繝代・
  const persistLinks = async (updatedLinks: OfficialLinkItem[]) => {
    setLinks(updatedLinks);
    saveStoredOfficialLinks(updatedLinks);

    try {
      const supabase = getSupabase();
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user) {
          await supabase.from('mst_ai_acquisition_records').upsert({
            user_id: auth.user.id,
            id: 'mst_official_hub_links',
            record_type: 'funnel_hub_config',
            title: '髮・ｮ｢蜍慕ｷ壼・蠑酋RL繝上ヶ險ｭ螳・,
            payload: { links: updatedLinks },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,id' });
        }
      }
    } catch (err) {
      console.warn('Could not sync official links to remote DB:', err);
    }
  };

  // 蟐剃ｽ楢ｨｭ螳壹・菫晏ｭ倥・繝ｫ繝代・
  const persistMedia = async (updatedMedia: MediumPreset[]) => {
    setMediaList(updatedMedia);
    saveStoredTrackingMedia(updatedMedia);

    try {
      const supabase = getSupabase();
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user) {
          await supabase.from('mst_ai_acquisition_records').upsert({
            user_id: auth.user.id,
            id: 'mst_official_hub_media',
            record_type: 'funnel_hub_config',
            title: '髮・ｮ｢蜍慕ｷ壼ｪ剃ｽ灘挨險ｭ螳・,
            payload: { media: updatedMedia },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,id' });
        }
      }
    } catch (err) {
      console.warn('Could not sync tracking media to remote DB:', err);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 鬮俶ｩ溯・UTM繝ｪ繝ｳ繧ｯ繝薙Ν繝繝ｼ・医く繝｣繝ｳ繝壹・繝ｳ蜷阪・謖・ｮ壹′縺ゅｋ譎ゅ・縺ｿ莉倅ｸ趣ｼ・  const buildUtmUrl = (baseUrl: string, source: string, campaign?: string, mediumParam?: string) => {
    if (!baseUrl) return '';
    const trimmed = baseUrl.trim();
    let fullUrl = trimmed;
    if (trimmed.startsWith('/')) {
      fullUrl = `${origin}${trimmed}`;
    }
    const separator = fullUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    if (source && source.trim()) {
      params.set('utm_source', source.trim());
    }
    if (mediumParam && mediumParam.trim()) {
      params.set('utm_medium', mediumParam.trim());
    }
    if (campaign && campaign.trim()) {
      params.set('utm_campaign', campaign.trim());
    }
    return `${fullUrl}${separator}${params.toString()}`;
  };

  // 繝槭ヨ繝ｪ繧ｯ繧ｹ蜈ｨ蟐剃ｽ薙・荳諡ｬ繧ｳ繝斐・蜃ｦ逅・  const handleCopyAllMatrixUrls = (link: OfficialLinkItem) => {
    const lines = mediaList.map((preset) => {
      const url = buildUtmUrl(link.url, preset.utmSource, campaignName, preset.utmMedium);
      return `縲・{preset.name}縲托ｼ・{preset.description}・噂n${url}`;
    });
    const header = `笆ｼ ${link.title}\n蜈ｬ蠑酋RL: ${link.url}\n${campaignName.trim() ? `莨∫判繧ｿ繧ｰ: ${campaignName.trim()}\n` : ''}----------------------------------------\n`;
    const fullText = header + lines.join('\n\n');
    copyToClipboard(fullText, 'matrix_all');
  };

  // 蜈ｬ蠑上Μ繝ｳ繧ｯ邱ｨ髮・Δ繝ｼ繝繝ｫ繧帝幕縺・  const handleOpenEdit = (item: OfficialLinkItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditUrl(item.url);
    setEditDescription(item.description);
    setEditBadge(item.badge);
    setEditBadgeColor(item.badgeColor || BADGE_COLOR_OPTIONS[0].value);
    setEditIconName((item.iconName as IconKey) || 'link');
    setEditError('');
    setIsEditModalOpen(true);
  };

  // 蜈ｬ蠑上Μ繝ｳ繧ｯ譁ｰ隕剰ｿｽ蜉繝｢繝ｼ繝繝ｫ繧帝幕縺・  const handleOpenCreate = () => {
    setEditingItem(null);
    setEditTitle('');
    setEditUrl('');
    setEditDescription('');
    setEditBadge('蜈ｬ蠑丞ｰ守ｷ・);
    setEditBadgeColor(BADGE_COLOR_OPTIONS[0].value);
    setEditIconName('link');
    setEditError('');
    setIsEditModalOpen(true);
  };

  // 蜈ｬ蠑上Μ繝ｳ繧ｯ縺ｮ菫晏ｭ・  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = editUrl.trim();
    const trimmedTitle = editTitle.trim();

    if (!trimmedTitle) {
      setEditError('繝ｪ繝ｳ繧ｯ蜷搾ｼ医ち繧､繝医Ν・峨ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    if (!trimmedUrl) {
      setEditError('URL繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }

    let updatedLinks: OfficialLinkItem[];

    if (editingItem) {
      updatedLinks = links.map((link) => {
        if (link.id === editingItem.id) {
          return {
            ...link,
            title: trimmedTitle,
            url: trimmedUrl,
            description: editDescription.trim(),
            badge: editBadge.trim() || '蜈ｬ蠑丞ｰ守ｷ・,
            badgeColor: editBadgeColor,
            iconName: editIconName,
            updatedAt: new Date().toISOString(),
          };
        }
        return link;
      });
      setFeedbackMessage(`縲・{trimmedTitle}縲阪・URL繧呈峩譁ｰ縺励∪縺励◆縲ゆｸ九・豬∝・霑ｽ霍｡繝ｪ繝ｳ繧ｯ縺ｫ繧ょ叉譎ょ渚譏縺輔ｌ縺ｾ縺励◆縲Ａ);
    } else {
      const newItem: OfficialLinkItem = {
        id: `custom_link_${Date.now()}`,
        title: trimmedTitle,
        url: trimmedUrl,
        description: editDescription.trim(),
        badge: editBadge.trim() || '譁ｰ隕丞ｰ守ｷ・,
        badgeColor: editBadgeColor,
        iconName: editIconName,
        isCustom: true,
        updatedAt: new Date().toISOString(),
      };
      updatedLinks = [...links, newItem];
      setFeedbackMessage(`譁ｰ縺励＞蜈ｬ蠑上Μ繝ｳ繧ｯ縲・{trimmedTitle}縲阪ｒ霑ｽ蜉縺励∪縺励◆縲Ａ);
    }

    await persistLinks(updatedLinks);
    setIsEditModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // 蜈ｬ蠑上Μ繝ｳ繧ｯ縺ｮ繝ｪ繧ｻ繝・ヨ繝ｻ蜑企勁
  const handleResetSingleLink = async (linkId: string) => {
    const original = defaultLinks.find((d) => d.id === linkId);
    if (!original) return;

    const updated = links.map((l) => (l.id === linkId ? { ...original } : l));
    await persistLinks(updated);
    setFeedbackMessage(`縲・{original.title}縲阪ｒ蛻晄悄險ｭ螳壹↓謌ｻ縺励∪縺励◆縲Ａ);
    setIsEditModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleResetAllToDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: '蜈ｬ蠑上Μ繝ｳ繧ｯ縺ｮ蛻晄悄蛹・,
      message: '縺吶∋縺ｦ縺ｮ蜈ｬ蠑上Μ繝ｳ繧ｯ縺ｮURL縺ｨ險ｭ螳壹ｒ蛻晄悄迥ｶ諷九↓謌ｻ縺励∪縺吶°・滂ｼ郁・菴懊・繧ｫ繧ｹ繧ｿ繝URL縺ｯ繝ｪ繧ｻ繝・ヨ縺輔ｌ縺ｾ縺呻ｼ・,
      onConfirm: async () => {
        clearStoredOfficialLinks();
        await persistLinks(defaultLinks);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage('縺吶∋縺ｦ縺ｮ蜈ｬ蠑上Μ繝ｳ繧ｯ險ｭ螳壹ｒ蛻晄悄迥ｶ諷九↓繝ｪ繧ｻ繝・ヨ縺励∪縺励◆縲・);
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  const handleDeleteLink = (linkId: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '繝ｪ繝ｳ繧ｯ縺ｮ蜑企勁',
      message: `蜈ｬ蠑上Μ繝ｳ繧ｯ縲・{title}縲阪ｒ蜑企勁縺励∪縺吶°・歔,
      onConfirm: async () => {
        const updated = links.filter((l) => l.id !== linkId);
        await persistLinks(updated);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage(`縲・{title}縲阪ｒ蜑企勁縺励∪縺励◆縲Ａ);
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  // 笏笏 蟐剃ｽ鍋ｷｨ髮・・譁ｰ隕剰ｿｽ蜉縺ｮ繝上Φ繝峨Λ繝ｼ 笏笏
  const handleOpenEditMedia = (preset: MediumPreset) => {
    setEditingMedia(preset);
    setMediaFormName(preset.name);
    setMediaFormDescription(preset.description);
    setMediaFormSource(preset.utmSource);
    setMediaFormMedium(preset.utmMedium);
    setMediaFormBadge(preset.badge);
    setMediaFormBadgeColor(preset.badgeColor || BADGE_COLOR_OPTIONS[0].value);
    setMediaFormError('');
    setIsMediaModalOpen(true);
  };

  const handleOpenCreateMedia = () => {
    setEditingMedia(null);
    setMediaFormName('');
    setMediaFormDescription('');
    setMediaFormSource('');
    setMediaFormMedium('social');
    setMediaFormBadge('蟐剃ｽ・);
    setMediaFormBadgeColor(BADGE_COLOR_OPTIONS[1].value);
    setMediaFormError('');
    setIsMediaModalOpen(true);
  };

  const handleSaveMediaModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = mediaFormName.trim();
    const trimmedSource = mediaFormSource.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    if (!trimmedName) {
      setMediaFormError('蟐剃ｽ灘錐・郁｡ｨ遉ｺ蜷搾ｼ峨ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    if (!trimmedSource) {
      setMediaFormError('豬∝・蜈・ち繧ｰ・・tm_source・峨ｒ蜊願ｧ定恭謨ｰ蟄励〒蜈･蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }

    let updated: MediumPreset[];
    if (editingMedia) {
      updated = mediaList.map((m) => {
        if (m.id === editingMedia.id) {
          return {
            ...m,
            name: trimmedName,
            description: mediaFormDescription.trim(),
            utmSource: trimmedSource,
            utmMedium: mediaFormMedium.trim() || 'social',
            badge: mediaFormBadge.trim() || '蟐剃ｽ・,
            badgeColor: mediaFormBadgeColor,
          };
        }
        return m;
      });
      setFeedbackMessage(`蟐剃ｽ薙・{trimmedName}縲阪・險ｭ螳壹ｒ譖ｴ譁ｰ縺励∪縺励◆縲りｿｽ霍｡繝ｪ繝ｳ繧ｯ繧ょ叉蠎ｧ縺ｫ蜀咲函謌舌＆繧後∪縺吶Ａ);
    } else {
      const newMedia: MediumPreset = {
        id: `custom_media_${Date.now()}`,
        name: trimmedName,
        description: mediaFormDescription.trim(),
        utmSource: trimmedSource,
        utmMedium: mediaFormMedium.trim() || 'social',
        badge: mediaFormBadge.trim() || '蟐剃ｽ・,
        badgeColor: mediaFormBadgeColor,
        category: 'Custom',
        isCustom: true,
      };
      updated = [...mediaList, newMedia];
      setFeedbackMessage(`譁ｰ隕丞ｪ剃ｽ薙・{trimmedName}縲阪ｒ霑ｽ蜉縺励∪縺励◆縲Ａ);
    }

    await persistMedia(updated);
    setIsMediaModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleDeleteMedia = (mediaId: string, mediaName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '蟐剃ｽ薙・蜑企勁',
      message: `蟐剃ｽ薙・{mediaName}縲阪ｒ荳隕ｧ縺九ｉ蜑企勁縺励∪縺吶°・歔,
      onConfirm: async () => {
        const updated = mediaList.filter((m) => m.id !== mediaId);
        await persistMedia(updated);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage(`縲・{mediaName}縲阪ｒ蜑企勁縺励∪縺励◆縲Ａ);
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  const handleResetMediaToDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: '蟐剃ｽ謎ｸ隕ｧ縺ｮ蛻晄悄蛹・,
      message: '蟐剃ｽ謎ｸ隕ｧ繧貞・譛溯ｨｭ螳夲ｼ・ote縲々縲！nstagram縲´INE縲√メ繝ｩ繧ｷQR縺ｪ縺ｩ蝓ｺ譛ｬ10蟐剃ｽ難ｼ峨↓謌ｻ縺励∪縺吶°・・,
      onConfirm: async () => {
        clearStoredTrackingMedia();
        await persistMedia(TRACKING_MEDIA_PRESETS);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage('蟐剃ｽ楢ｨｭ螳壹ｒ蛻晄悄迥ｶ諷九↓繝ｪ繧ｻ繝・ヨ縺励∪縺励◆縲・);
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  // 繝・ヵ繧ｩ繝ｫ繝亥､縺九ｉ螟画峩縺輔ｌ縺ｦ縺・ｋ縺句愛螳・  const isCustomized = (item: OfficialLinkItem) => {
    const original = defaultLinks.find((d) => d.id === item.id);
    if (!original) return true;
    return original.url !== item.url || original.title !== item.title;
  };

  const activeMatrixLink = links.find((l) => l.id === selectedMatrixLinkId) || links[0];

  return (
    <div className="space-y-6">
      {/* 譯亥・繝医・繧ｹ繝・/ 繝輔ぅ繝ｼ繝峨ヰ繝・け繝舌リ繝ｼ */}
      {feedbackMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3.5 text-sm text-emerald-200 shadow-lg animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* 笏笏 1. 閾ｪ遉ｾ蜈ｬ蠑上Μ繝ｳ繧ｯ荳隕ｧ・・RL繝上ヶ・・笏笏 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-700" />
              閾ｪ遉ｾ蜈ｬ蠑上Μ繝ｳ繧ｯ荳隕ｧ・・RL繝上ヶ・・            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              險ｺ譁ｭ繝輔か繝ｼ繝繝ｻ蛟句挨逶ｸ隲・・LINE繝ｻ莠育ｴ・き繝ｬ繝ｳ繝繝ｼ繝ｻHP縺ｪ縺ｩ縺ｮ繝槭せ繧ｿ繝ｼURL縺ｧ縺吶らｷｨ髮・☆繧九→縲∽ｸ九・蟐剃ｽ灘挨繝ｪ繝ｳ繧ｯ繧り・蜍暮｣蜍輔＠縺ｾ縺吶・            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              譁ｰ隕上Μ繝ｳ繧ｯ霑ｽ蜉
            </button>
            <button
              type="button"
              onClick={handleResetAllToDefaults}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition shadow-xs"
              title="蛻晄悄險ｭ螳壹↓謌ｻ縺・
            >
              <RotateCcw className="h-3.5 w-3.5" />
              蛻晄悄蛟､縺ｫ謌ｻ縺・            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {links.map((item) => {
            const Icon = (item.iconName && ICON_MAP[item.iconName as IconKey]) || Link2;
            const isCopied = copiedKey === item.id;
            const modified = isCustomized(item);

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between hover:border-purple-300 hover:shadow-xs transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {item.badge}
                      </span>
                      {modified && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          螟画峩貂医∩
                        </span>
                      )}
                    </div>
                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {item.description || '隱ｬ譏取枚縺ｯ縺ゅｊ縺ｾ縺帙ｓ'}
                  </p>
                  
                  {/* URL繝懊ャ繧ｯ繧ｹ */}
                  <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 truncate select-all flex items-center justify-between gap-2">
                    <span className="truncate">{item.url}</span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 font-medium"
                      title="螳滄圀縺ｮ繝ｪ繝ｳ繧ｯ繧帝幕縺・※遒ｺ隱・
                    >
                      遒ｺ隱・<ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="text-xs text-purple-700 hover:text-purple-800 inline-flex items-center gap-1 font-semibold hover:underline"
                    >
                      <Pencil className="h-3 w-3" /> 邱ｨ髮・                    </button>
                    {item.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(item.id, item.title)}
                        className="text-xs text-rose-600 hover:text-rose-700 inline-flex items-center gap-0.5"
                        title="蜑企勁"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.url, item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-700 hover:bg-purple-800 text-white shadow-xs'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> 繧ｳ繝斐・螳御ｺ・                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> 繧ｳ繝斐・
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* 譁ｰ隕丞・蠑酋RL霑ｽ蜉繧ｫ繝ｼ繝・*/}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="rounded-xl border border-dashed border-slate-300 hover:border-purple-400 bg-slate-50/70 hover:bg-purple-50/40 p-4 flex flex-col items-center justify-center gap-1.5 transition text-center min-h-[140px] group cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-purple-700">・・譁ｰ隕上Μ繝ｳ繧ｯ繧定ｿｽ蜉</span>
            <span className="text-[11px] text-slate-500">螟夜ΚLP繧・挨繝輔か繝ｼ繝繧堤匳骭ｲ</span>
          </button>
        </div>
      </section>

      {/* 笏笏 2. 蟐剃ｽ灘挨 豬∝・霑ｽ霍｡繝ｪ繝ｳ繧ｯ逋ｺ陦鯉ｼ・繧ｹ繝・ャ繝玲桃菴・・・5蟐剃ｽ灘・譛溯｡ｨ遉ｺ・・笏笏 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-xs">
        {/* 豕ｨ諢丞繭襍ｷ繝舌リ繝ｼ・・陦瑚｡ｨ遉ｺ・・*/}
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-medium">
            蜿九□縺｡霑ｽ蜉・・ine.me・峨・URL縺ｯ豬∝・蜈・ｒ險域ｸｬ縺ｧ縺阪∪縺帙ｓ縲りｨｺ譁ｭ繝輔か繝ｼ繝繧貞・蜿｣縺ｫ縺吶ｋ縺ｨ豬∝・蜈・′谿九ｊ縺ｾ縺吶・          </span>
        </div>

        {/* 繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ隕句・縺・*/}
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-purple-700" />
            蟐剃ｽ灘挨 豬∝・霑ｽ霍｡繝ｪ繝ｳ繧ｯ逋ｺ陦・          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            繝壹・繧ｸ繧帝∈繧薙〒蟐剃ｽ薙き繝ｼ繝峨・縲後さ繝斐・縲阪ｒ謚ｼ縺吶□縺代〒縲∝推豬∝・蜈・ｒ閾ｪ蜍戊ｨ域ｸｬ縺吶ｋ霑ｽ霍｡繝ｪ繝ｳ繧ｯ繧貞叙蠕励〒縺阪∪縺吶・          </p>
        </div>

        {/* 縲舌せ繝・ャ繝・1縲代Μ繝ｳ繧ｯ繧剃ｽ懊ｋ繝壹・繧ｸ繧帝∈縺ｶ */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-700 text-[11px] font-bold text-white shadow-2xs">
              1
            </span>
            <span className="text-xs font-bold text-slate-800">繝ｪ繝ｳ繧ｯ繧剃ｽ懊ｋ繝壹・繧ｸ繧帝∈縺ｶ:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              const isSelected = link.id === activeMatrixLink?.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setSelectedMatrixLinkId(link.id)}
                  className={`px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-700 text-white font-bold shadow-xs ring-2 ring-purple-600/30'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[220px]">{link.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 縲舌せ繝・ャ繝・2縲大ｪ剃ｽ薙き繝ｼ繝峨・縲後さ繝斐・縲阪ｒ謚ｼ縺・*/}
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-700 text-[11px] font-bold text-white shadow-2xs">
                2
              </span>
              <span className="text-xs font-bold text-slate-800">蟐剃ｽ薙き繝ｼ繝峨・縲後さ繝斐・縲阪ｒ謚ｼ縺・</span>
            </div>
            <span className="text-[11px] text-slate-500">
              逋ｺ陦悟ｯｾ雎｡: <strong className="text-purple-700">{activeMatrixLink?.title}</strong>
            </span>
          </div>

          {/* 蟐剃ｽ薙き繝ｼ繝我ｸ隕ｧ・亥・譛・蟐剃ｽ薙・蜷・き繝ｼ繝峨・蟐剃ｽ灘錐縲∫畑騾斐・荳險縲√さ繝斐・繝懊ち繝ｳ縺ｮ縺ｿ・・*/}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mediaList.map((preset) => {
              const utmUrl = buildUtmUrl(activeMatrixLink.url, preset.utmSource, campaignName, preset.utmMedium);
              const isCopied = copiedKey === `preset_${preset.id}`;
              const isExpanded = expandedCardId === preset.id;

              return (
                <div
                  key={preset.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-purple-300 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${preset.badgeColor}`}>
                        {preset.badge}
                      </span>
                      {preset.isCustom && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                          霑ｽ蜉蟐剃ｽ・                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{preset.name}</h4>
                    <p className="mt-1 text-xs text-slate-500 leading-snug line-clamp-1">
                      {preset.description || '逕ｨ騾斐Γ繝｢縺ｪ縺・}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedCardId(isExpanded ? null : preset.id)}
                        className="text-[11px] text-slate-500 hover:text-purple-700 inline-flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <span>{isExpanded ? 'URL繧帝國縺・ : 'URL蜈ｨ譁・ｒ遒ｺ隱・}</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(utmUrl, `preset_${preset.id}`)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-purple-700 hover:bg-purple-800 text-white shadow-xs'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> 繧ｳ繝斐・螳御ｺ・                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> 繧ｳ繝斐・
                          </>
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-[10px] font-mono text-purple-900 break-all select-all animate-in fade-in duration-150">
                        <div className="break-all">{utmUrl}</div>
                        <div className="flex items-center justify-end pt-1">
                          <a
                            href={utmUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 font-sans"
                          >
                            繝悶Λ繧ｦ繧ｶ縺ｧ繝・せ繝郁｡ｨ遉ｺ <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 笏笏 蛻晄悄迥ｶ諷九〒縺ｯ謚倥ｊ縺溘◆繧隧ｳ邏ｰ險ｭ螳夂ｾ､ 笏笏 */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          {/* 1. 莨∫判繧ｿ繧ｰ・・tm_campaign・・*/}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCampaignOption((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-purple-700 transition font-medium cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5 text-slate-500" />
                <span>莨∫判繧ｿ繧ｰ・・tm_campaign・峨ｒ險ｭ螳壹☆繧具ｼ井ｻｻ諢擾ｼ・/span>
                {campaignName.trim() && (
                  <span className="ml-1 text-[10px] font-mono bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                    驕ｩ逕ｨ荳ｭ: {campaignName.trim()}
                  </span>
                )}
                {showCampaignOption ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
              </button>
              {campaignName.trim() && (
                <button
                  type="button"
                  onClick={() => setCampaignName('')}
                  className="text-[11px] text-slate-500 hover:text-rose-600 underline font-medium cursor-pointer"
                >
                  莨∫判繧ｿ繧ｰ繧定ｧ｣髯､
                </button>
              )}
            </div>

            {showCampaignOption && (
              <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-white space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-700 font-semibold">莨∫判繧ｿ繧ｰ・・tm_campaign・・</span>
                  <span className="text-[10px] text-slate-500">遨ｺ谺・・蝣ｴ蜷医・繧ｹ繝・く繝ｪ縺励◆蝓ｺ譛ｬURL縺檎匱陦後＆繧後∪縺・/span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="萓・ spring2026, opening_fair ・育ｩｺ谺・〒OK・・
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  {campaignName && (
                    <button
                      type="button"
                      onClick={() => setCampaignName('')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer"
                    >
                      繧ｯ繝ｪ繧｢
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. 蟐剃ｽ薙・霑ｽ蜉繝ｻ邱ｨ髮・・蜑企勁縲√悟・譛溷ｪ剃ｽ薙↓謌ｻ縺吶・*/}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <button
              type="button"
              onClick={() => setShowMediaManagement((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs text-slate-700 hover:text-purple-700 transition font-medium cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <span>蟐剃ｽ薙・繧ｫ繧ｹ繧ｿ繝槭う繧ｺ・郁ｿｽ蜉繝ｻ邱ｨ髮・・蜑企勁繝ｻ蛻晄悄蛟､繝ｪ繧ｻ繝・ヨ・・/span>
              </div>
              {showMediaManagement ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showMediaManagement && (
              <div className="mt-3 p-3.5 rounded-lg border border-slate-200 bg-white space-y-3 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-bold text-slate-800">
                    逋ｻ骭ｲ貂医∩蟐剃ｽ謎ｸ隕ｧ・亥・ {mediaList.length} 莉ｶ・・                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenCreateMedia}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> 譁ｰ隕丞ｪ剃ｽ薙ｒ霑ｽ蜉
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyAllMatrixUrls(activeMatrixLink)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
                      title="蜈ｨ蟐剃ｽ薙・URL繧呈隼陦悟玄蛻・ｊ縺ｧ縺ｾ縺ｨ繧√※繧ｳ繝斐・"
                    >
                      {copiedKey === 'matrix_all' ? <Check className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                      <span>蜈ｨ蟐剃ｽ薙∪縺ｨ繧√※繧ｳ繝斐・</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetMediaToDefaults}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                      title="蝓ｺ譛ｬ5蟐剃ｽ薙↓繝ｪ繧ｻ繝・ヨ"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>蛻晄悄蟐剃ｽ薙↓謌ｻ縺・/span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {mediaList.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${m.badgeColor}`}>
                          {m.badge}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">{m.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">utm_source={m.utmSource}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditMedia(m)}
                          className="p-1 rounded text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
                          title="邱ｨ髮・
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(m.id, m.name)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="蜑企勁"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. 莉慕ｵ・∩縺ｮ隗｣隱ｬ */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <button
              type="button"
              onClick={() => setShowUtmGuide((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs text-slate-700 hover:text-purple-700 transition font-medium cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                <span>莉慕ｵ・∩縺ｨ豬∝・險域ｸｬ縺ｮ隗｣隱ｬ</span>
              </div>
              {showUtmGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showUtmGuide && (
              <div className="mt-3 p-4 rounded-lg border border-purple-200 bg-purple-50/60 text-xs text-slate-700 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs border-b border-purple-200 pb-2">
                  <Info className="h-4 w-4 shrink-0 text-purple-700" />
                  <span>豬∝・霑ｽ霍｡縺ｨ閾ｪ蜍輔ち繧ｰ莉倅ｸ弱・莉慕ｵ・∩</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
                  <div className="rounded-lg bg-white p-3 border border-purple-100 shadow-xs">
                    <span className="font-bold text-slate-900 block mb-1">1. URL閾ｪ蜍墓ｭ｣隕丞喧</span>
                    <p className="text-slate-600">
                      URL譛ｫ蟆ｾ縺ｮ <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-mono">?utm_source=sns</code> 縺ｪ縺ｩ繧貞ｰ乗枚蟄苓恭謨ｰ蟄励∈閾ｪ蜍墓ｭ｣隕丞喧縲ゅΜ繝ｼ繝峨Γ繝｢縺ｫ縲梧ｵ∝・: SNS縲阪→譏手ｨ倥＆繧後∪縺吶・                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-purple-100 shadow-xs">
                    <span className="font-bold text-slate-900 block mb-1">2. LINE繧ｿ繧ｰ閾ｪ蜍穂ｻ倅ｸ・/span>
                    <p className="text-slate-600">
                      LINE騾｣謳ｺ貂医∩縺ｮ鬘ｧ螳｢縺後ヵ繧ｩ繝ｼ繝繧帝∽ｿ｡縺吶ｋ縺ｨ縲√瑚ｨｺ譁ｭ蜿玲､懈ｸ医∩縲阪→縲梧ｵ∝・:SNS縲阪ち繧ｰ縺碁㍾隍・↑縺剰・蜍輔〒莉倅ｸ弱＆繧後∪縺吶・                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-purple-100 shadow-xs">
                    <span className="font-bold text-slate-900 block mb-1">3. 蛻晄悄5蟐剃ｽ薙→諡｡蠑ｵ諤ｧ</span>
                    <p className="text-slate-600">
                      譌･蟶ｸ驕狗畑縺ｯHP繝悶Ο繧ｰ繝ｻSNS繝ｻLINE繝ｻ繝｡繝ｼ繝ｫ繝ｻ雉・侭縺ｮ5蟐剃ｽ薙↓髮・ｴ・ょｺ・相繧・､夜Κ邏ｹ莉九↑縺ｩ縺ｯ縲梧眠隕丞ｪ剃ｽ薙ｒ霑ｽ蜉縲阪°繧峨＞縺､縺ｧ繧よ僑蠑ｵ縺ｧ縺阪∪縺吶・                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 笏笏 1. 蜈ｬ蠑上Μ繝ｳ繧ｯ 邱ｨ髮・/ 霑ｽ蜉繝｢繝ｼ繝繝ｫ 笏笏 */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-purple-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    {editingItem ? `縲・{editingItem.title}縲阪・蜈ｬ蠑酋RL邱ｨ髮・ : '譁ｰ隕丞・蠑酋RL縺ｮ逋ｻ骭ｲ'}
                  </h3>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {editingItem 
                    ? '螳滄°逕ｨ縺ｮ豁｣縺励＞URL繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲ゆｿ晏ｭ倥☆繧九→蟐剃ｽ灘挨霑ｽ霍｡繝ｪ繝ｳ繧ｯ繧ょ叉蠎ｧ縺ｫ閾ｪ蜍墓峩譁ｰ縺輔ｌ縺ｾ縺吶・ 
                    : '閾ｪ遉ｾ縺ｮLP縲∝句挨逶ｸ隲・ヵ繧ｩ繝ｼ繝縲´INE逋ｻ骭ｲ繝ｪ繝ｳ繧ｯ縺ｪ縺ｩ縺ｮ蜈ｬ蠑酋RL繧堤匳骭ｲ縺励∪縺吶・}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  繝ｪ繝ｳ繧ｯ蜷阪・繧ｿ繧､繝医Ν <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="萓・ 3蛻・┌譁吶・繝医Ν繝阪ャ繧ｯ險ｺ譁ｭ"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold">
                    蜈ｬ蠑酋RL <span className="text-rose-500">*</span>
                  </label>
                  {editingItem && defaultLinks.some((d) => d.id === editingItem.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        const orig = defaultLinks.find((d) => d.id === editingItem.id);
                        if (orig) setEditUrl(orig.url);
                      }}
                      className="text-[11px] text-purple-700 hover:underline font-medium"
                    >
                      蛻晄悄URL繧貞他縺ｳ蜃ｺ縺・                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://example.com/your-form 縺ｾ縺溘・ /f/your-slug"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  窶ｻ 螟夜ΚURL・・ttps://...・峨∪縺溘・繧｢繝励Μ蜀・ヱ繧ｹ・・f/...・峨←縺｡繧峨〒繧りｨｭ螳壼庄閭ｽ縺ｧ縺吶・                </p>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">隱ｬ譏取枚繝ｻ逕ｨ騾費ｼ井ｻｻ諢擾ｼ・/label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="萓・ LINE繧ｹ繝・ャ繝鈴・菫｡繧・ヶ繝ｭ繧ｰ譛ｫ蟆ｾ縺九ｉ隱伜ｰ弱☆繧区悽蜻ｽ繝輔か繝ｼ繝"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">繝舌ャ繧ｸ陦ｨ險・/label>
                  <input
                    type="text"
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    placeholder="萓・ 鬮俶・邏・紫, 蝠・ｫ・峩陦・
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">繝舌ャ繧ｸ繧ｫ繝ｩ繝ｼ</label>
                  <select
                    value={editBadgeColor}
                    onChange={(e) => setEditBadgeColor(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  >
                    {BADGE_COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 繝懊ち繝ｳ繧ｨ繝ｪ繧｢ */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingItem && defaultLinks.some((d) => d.id === editingItem.id) ? (
                  <button
                    type="button"
                    onClick={() => handleResetSingleLink(editingItem.id)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-700 font-medium"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> 縺薙・繝ｪ繝ｳ繧ｯ繧貞・譛溷､縺ｫ謌ｻ縺・                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium shadow-xs"
                  >
                    繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-purple-700 hover:bg-purple-800 px-4 py-1.5 text-xs font-semibold text-white transition shadow-xs"
                  >
                    {editingItem ? '螟画峩繧剃ｿ晏ｭ倥☆繧・ : '蜈ｬ蠑酋RL繧堤匳骭ｲ縺吶ｋ'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 笏笏 2. 蟐剃ｽ楢ｨｭ螳夲ｼ亥錐遘ｰ繝ｻ逕ｨ騾斐・繧ｿ繧ｰ・臥ｷｨ髮・/ 譁ｰ隕剰ｿｽ蜉繝｢繝ｼ繝繝ｫ 笏笏 */}
      {isMediaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-purple-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    {editingMedia ? `蟐剃ｽ楢ｨｭ螳壹・邱ｨ髮・ｼ・{editingMedia.name}・荏 : '譁ｰ隕丞ｪ剃ｽ薙・霑ｽ蜉'}
                  </h3>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  蟐剃ｽ灘錐繧・畑騾斐Γ繝｢縲・｡ｧ螳｢蜿ｰ蟶ｳ縺ｸ險倬鹸縺輔ｌ繧区ｵ∝・蜈・ｭ伜挨繧ｿ繧ｰ・・tm_source・峨ｒ險ｭ螳壹〒縺阪∪縺吶・                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {mediaFormError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{mediaFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMediaModal} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  蟐剃ｽ灘錐繝ｻ陦ｨ遉ｺ繝ｩ繝吶Ν <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mediaFormName}
                  onChange={(e) => setMediaFormName(e.target.value)}
                  placeholder="萓・ TikTok・医す繝ｧ繝ｼ繝亥虚逕ｻ・・ Threads・域律蟶ｸ逋ｺ菫｡・・ 縲・・署謳ｺ蜈・
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    豬∝・蜈・ち繧ｰ・・tm_source・・<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mediaFormSource}
                    onChange={(e) => setMediaFormSource(e.target.value)}
                    placeholder="萓・ tiktok, threads, seminar"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">窶ｻ 蜊願ｧ定恭謨ｰ蟄励・繧｢繝ｳ繝繝ｼ繧ｹ繧ｳ繧｢</span>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    蟐剃ｽ鍋ｨｮ蛻･・・tm_medium・・                  </label>
                  <select
                    value={mediaFormMedium}
                    onChange={(e) => setMediaFormMedium(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  >
                    {COMMON_MEDIUM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">逕ｨ騾斐・驕狗畑縺ｮ繝｡繝｢・井ｻｻ諢擾ｼ・/label>
                <input
                  type="text"
                  value={mediaFormDescription}
                  onChange={(e) => setMediaFormDescription(e.target.value)}
                  placeholder="萓・ 繝励Ο繝輔ぅ繝ｼ繝ｫ縺ｮ繝ｪ繝ｳ繧ｯ繝・Μ繝ｼ繧・虚逕ｻ縺ｮ蝗ｺ螳壹さ繝｡繝ｳ繝医↓驟咲ｽｮ"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">繝舌ャ繧ｸ陦ｨ險・/label>
                  <input
                    type="text"
                    value={mediaFormBadge}
                    onChange={(e) => setMediaFormBadge(e.target.value)}
                    placeholder="萓・ 蜍慕判, SNS, 螟夜Κ"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">繝舌ャ繧ｸ繧ｫ繝ｩ繝ｼ</label>
                  <select
                    value={mediaFormBadgeColor}
                    onChange={(e) => setMediaFormBadgeColor(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  >
                    {BADGE_COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 繝ｪ繧｢繝ｫ繧ｿ繧､繝逕滓・URL繝励Ξ繝薙Η繝ｼ */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-[11px]">
                  <Share2 className="h-3.5 w-3.5 text-purple-700" />
                  <span>縺薙・蟐剃ｽ楢ｨｭ螳壹〒逋ｺ陦後＆繧後ｋURL繝励Ξ繝薙Η繝ｼ:</span>
                </div>
                <div className="rounded bg-white p-2 font-mono text-[10px] text-purple-950 truncate border border-purple-100">
                  {buildUtmUrl(
                    activeMatrixLink.url,
                    mediaFormSource.trim() || 'your_source',
                    campaignName,
                    mediaFormMedium.trim() || 'social'
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  窶ｻ 鬘ｧ螳｢繧ｫ繝ｫ繝・・豬∝・蜈・↓縺ｯ縲鶏mediaFormName || '蟐剃ｽ灘錐'}・・mediaFormSource.trim() || 'source'}・峨阪→縺励※險倬鹸縺輔ｌ縺ｾ縺吶・                </p>
              </div>

              {/* 繝懊ち繝ｳ繧ｨ繝ｪ繧｢ */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium shadow-xs"
                >
                  繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-purple-700 hover:bg-purple-800 px-4 py-1.5 text-xs font-semibold text-white transition shadow-xs"
                >
                  {editingMedia ? '蟐剃ｽ楢ｨｭ螳壹ｒ譖ｴ譁ｰ縺吶ｋ' : '蟐剃ｽ薙ｒ霑ｽ蜉縺吶ｋ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 笏笏 蜑企勁繝ｻ蛻晄悄蛹悶・繧､繝ｳ繝ｩ繧､繝ｳ遒ｺ隱阪ム繧､繧｢繝ｭ繧ｰ・・frame縺ｧ繧ょｮ牙・蜍穂ｽ懶ｼ・笏笏 */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">{confirmDialog.title}</h4>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium shadow-xs"
              >
                繧ｭ繝｣繝ｳ繧ｻ繝ｫ
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white transition shadow-xs"
              >
                螳溯｡後☆繧・              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
