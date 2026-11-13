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
    name: 'HP・ブログ記事',
    category: 'Owned / Blog',
    badge: '記事',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: '公式HPコラムや解説記事からの誘導用',
    utmSource: 'hp_blog',
    utmMedium: 'article',
  },
  {
    id: 'sns',
    name: 'SNS（Instagram・Threads・Facebook・LinkedIn等のプロフィール）',
    category: 'Social',
    badge: 'SNS',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    description: '各SNSのプロフィールリンクや通常投稿用',
    utmSource: 'sns',
    utmMedium: 'social',
  },
  {
    id: 'line',
    name: 'LINE（配信・リッチメニュー）',
    category: 'Chat / CRM',
    badge: 'LINE',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'LINE公式アカウント配信やリッチメニュー用',
    utmSource: 'line',
    utmMedium: 'chat',
  },
  {
    id: 'email',
    name: 'メール（営業・教育ステップ）',
    category: 'Direct',
    badge: 'メール',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: '個別営業メールやメルマガ・案内文面用',
    utmSource: 'email',
    utmMedium: 'email',
  },
  {
    id: 'material',
    name: '資料（資料請求・商談資料内のリンク／QR）',
    category: 'Document',
    badge: '資料',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: '提案書・ダウンロード資料・名刺QR等用',
    utmSource: 'material',
    utmMedium: 'document',
  },
];

const COMMON_MEDIUM_TYPES = [
  { value: 'social', label: 'social（SNS投稿・プロフ）' },
  { value: 'article', label: 'article（記事・オウンドメディア）' },
  { value: 'short_video', label: 'short_video（TikTok・リール等）' },
  { value: 'video', label: 'video（YouTube動画・概要欄）' },
  { value: 'chat', label: 'chat（LINE・チャット・DM）' },
  { value: 'offline_qr', label: 'offline_qr（紙チラシ・名刺・POP）' },
  { value: 'email', label: 'email（メルマガ・ステップ配信）' },
  { value: 'cpc', label: 'cpc（Web広告・リスティング）' },
  { value: 'referral', label: 'referral（外部紹介・提携パートナー）' },
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
  { label: 'エメラルド（記事・ブログ）', value: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'スカイ（X / Twitter）', value: 'bg-sky-50 text-sky-700 border-sky-200' },
  { label: 'ピンク（Instagram）', value: 'bg-pink-50 text-pink-700 border-pink-200' },
  { label: 'グリーン（LINE）', value: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'アンバー（紙チラシ・QR）', value: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'パープル（広告・LP）', value: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'ローズ（動画・YouTube）', value: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'シアン（メール・予約）', value: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: 'ブルー（提携・外部）', value: 'bg-blue-50 text-blue-700 border-blue-200' },
];

export const MarketingQuickLinksHub: React.FC = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mstos.app';

  // 初期デフォルトリンク定義（Vercel公式HP・診断・個別相談・作戦会議を先頭に配置）
  const defaultLinks: OfficialLinkItem[] = useMemo(() => [
    {
      id: 'diagnosis',
      title: '3分無料ボトルネック診断',
      description: '公式HP上の自動診断フォーム（経営・業務の急所と改善処方箋を特定）',
      url: OFFICIAL_VERCEL_URLS.diagnosis,
      badge: '高成約率',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      iconName: 'sparkles',
    },
    {
      id: 'care_consult',
      title: '介護保険外サービス開業・個別相談',
      description: '介護保険外開業パッケージ専用LP・お申し込みページ',
      url: OFFICIAL_VERCEL_URLS.care_consult,
      badge: '高額パッケージ直結',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconName: 'file-text',
    },
    {
      id: 'booking',
      title: '30分無料作戦会議（面談日程予約）',
      description: '対面営業や相談後に案内するオンライン面談カレンダー',
      url: 'https://timerex.net/s/mst.shikumikaizen_b173/4ac78e37',
      badge: '商談直行',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      iconName: 'calendar',
    },
    {
      id: 'material_download',
      title: '経営改善実務ガイド 資料請求',
      description: '公式HPの資料ダウンロード・会社概要請求ページ',
      url: OFFICIAL_VERCEL_URLS.material_download,
      badge: '資料請求',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      iconName: 'file-text',
    },
    {
      id: 'line_add',
      title: '公式LINE 友だち追加リンク',
      description: 'LINE公式アカウント友だち追加（※流入元計測不可）',
      url: 'https://line.me/R/ti/p/@mst_management',
      badge: '友だち追加',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconName: 'message-circle',
    },
    {
      id: 'media_top',
      title: '自社オウンドメディア / コーポレートHP',
      description: '会社概要・専門コラム・デジタル商品の本拠地',
      url: OFFICIAL_VERCEL_URLS.media_top,
      badge: 'HP直接',
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
  
  // 施策・企画名（任意設定、初期は折りたたみ）
  const [campaignName, setCampaignName] = useState<string>('');
  const [showCampaignOption, setShowCampaignOption] = useState<boolean>(false);
  const [showMediaManagement, setShowMediaManagement] = useState<boolean>(false);
  const [showUtmGuide, setShowUtmGuide] = useState<boolean>(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [selectedMatrixLinkId, setSelectedMatrixLinkId] = useState<string>('diagnosis');

  // 1. 公式リンク編集用モーダル状態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficialLinkItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editBadgeColor, setEditBadgeColor] = useState(BADGE_COLOR_OPTIONS[0].value);
  const [editIconName, setEditIconName] = useState<IconKey>('link');
  const [editError, setEditError] = useState('');

  // 2. 媒体別設定編集用モーダル状態（媒体名、説明、utm_source、utm_medium、バッジの編集・新規追加）
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediumPreset | null>(null);
  const [mediaFormName, setMediaFormName] = useState('');
  const [mediaFormDescription, setMediaFormDescription] = useState('');
  const [mediaFormSource, setMediaFormSource] = useState('');
  const [mediaFormMedium, setMediaFormMedium] = useState('social');
  const [mediaFormBadge, setMediaFormBadge] = useState('SNS');
  const [mediaFormBadgeColor, setMediaFormBadgeColor] = useState(BADGE_COLOR_OPTIONS[0].value);
  const [mediaFormError, setMediaFormError] = useState('');

  // 3. 削除・リセット確認モーダル状態（window.confirmの代替でiframe安心動作）
  const [confirmDialog, setConfirmDialog] = useState<{
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

  // データの初回読み込み（ローカルストレージ優先、Supabase同期）
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // 公式リンクの読み込み
      const localStoredLinks = loadStoredOfficialLinks();
      if (localStoredLinks && localStoredLinks.length > 0 && isMounted) {
        setLinks(localStoredLinks);
        if (!selectedMatrixLinkId) {
          setSelectedMatrixLinkId(localStoredLinks[0].id);
        }
      }

      // 媒体プリセットの読み込み（新5媒体への自動マイグレーション対応）
      const localStoredMedia = loadStoredTrackingMedia<MediumPreset>(TRACKING_MEDIA_PRESETS);
      if (localStoredMedia && localStoredMedia.length > 0 && isMounted) {
        setMediaList(localStoredMedia);
      }

      // Supabaseからリモート同期
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            // リンク設定の読み込み
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
                  title: '集客動線公式URLハブ設定',
                  payload: { links: migratedLinks },
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,id' });
              }
              if (!selectedMatrixLinkId && migratedLinks.length > 0) {
                setSelectedMatrixLinkId(migratedLinks[0].id);
              }
            }

            // 媒体設定の読み込み（リモートの旧設定も新5媒体＋カスタムに自動マイグレーション）
            const { data: mediaData } = await supabase
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

  // 公式リンクの保存ヘルパー
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
            title: '集客動線公式URLハブ設定',
            payload: { links: updatedLinks },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,id' });
        }
      }
    } catch (err) {
      console.warn('Could not sync official links to remote DB:', err);
    }
  };

  // 媒体設定の保存ヘルパー
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
            title: '集客動線媒体別設定',
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

  // 高機能UTMリンクビルダー（キャンペーン名は指定がある時のみ付与）
  const buildUtmUrl = (baseUrl: string, source: string, campaign?: string, mediumParam?: string) => {
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

  // マトリクス全媒体の一括コピー処理
  const handleCopyAllMatrixUrls = (link: OfficialLinkItem) => {
    const lines = mediaList.map((preset) => {
      const url = buildUtmUrl(link.url, preset.utmSource, campaignName, preset.utmMedium);
      return `【${preset.name}】（${preset.description}）\n${url}`;
    });
    const header = `▼ ${link.title}\n公式URL: ${link.url}\n${campaignName.trim() ? `企画タグ: ${campaignName.trim()}\n` : ''}----------------------------------------\n`;
    const fullText = header + lines.join('\n\n');
    copyToClipboard(fullText, 'matrix_all');
  };

  // 公式リンク編集モーダルを開く
  const handleOpenEdit = (item: OfficialLinkItem) => {
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

  // 公式リンク新規追加モーダルを開く
  const handleOpenCreate = () => {
    setEditingItem(null);
    setEditTitle('');
    setEditUrl('');
    setEditDescription('');
    setEditBadge('公式導線');
    setEditBadgeColor(BADGE_COLOR_OPTIONS[0].value);
    setEditIconName('link');
    setEditError('');
    setIsEditModalOpen(true);
  };

  // 公式リンクの保存
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = editUrl.trim();
    const trimmedTitle = editTitle.trim();

    if (!trimmedTitle) {
      setEditError('リンク名（タイトル）を入力してください。');
      return;
    }
    if (!trimmedUrl) {
      setEditError('URLを入力してください。');
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
            badge: editBadge.trim() || '公式導線',
            badgeColor: editBadgeColor,
            iconName: editIconName,
            updatedAt: new Date().toISOString(),
          };
        }
        return link;
      });
      setFeedbackMessage(`「${trimmedTitle}」のURLを更新しました。下の流入追跡リンクにも即時反映されました。`);
    } else {
      const newItem: OfficialLinkItem = {
        id: `custom_link_${Date.now()}`,
        title: trimmedTitle,
        url: trimmedUrl,
        description: editDescription.trim(),
        badge: editBadge.trim() || '新規導線',
        badgeColor: editBadgeColor,
        iconName: editIconName,
        isCustom: true,
        updatedAt: new Date().toISOString(),
      };
      updatedLinks = [...links, newItem];
      setFeedbackMessage(`新しい公式リンク「${trimmedTitle}」を追加しました。`);
    }

    await persistLinks(updatedLinks);
    setIsEditModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // 公式リンクのリセット・削除
  const handleResetSingleLink = async (linkId: string) => {
    const original = defaultLinks.find((d) => d.id === linkId);
    if (!original) return;

    const updated = links.map((l) => (l.id === linkId ? { ...original } : l));
    await persistLinks(updated);
    setFeedbackMessage(`「${original.title}」を初期設定に戻しました。`);
    setIsEditModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleResetAllToDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: '公式リンクの初期化',
      message: 'すべての公式リンクのURLと設定を初期状態に戻しますか？（自作のカスタムURLはリセットされます）',
      onConfirm: async () => {
        clearStoredOfficialLinks();
        await persistLinks(defaultLinks);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage('すべての公式リンク設定を初期状態にリセットしました。');
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  const handleDeleteLink = (linkId: string, title: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'リンクの削除',
      message: `公式リンク「${title}」を削除しますか？`,
      onConfirm: async () => {
        const updated = links.filter((l) => l.id !== linkId);
        await persistLinks(updated);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage(`「${title}」を削除しました。`);
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  // ── 媒体編集・新規追加のハンドラー ──
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
    setMediaFormBadge('媒体');
    setMediaFormBadgeColor(BADGE_COLOR_OPTIONS[1].value);
    setMediaFormError('');
    setIsMediaModalOpen(true);
  };

  const handleSaveMediaModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = mediaFormName.trim();
    const trimmedSource = mediaFormSource.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    if (!trimmedName) {
      setMediaFormError('媒体名（表示名）を入力してください。');
      return;
    }
    if (!trimmedSource) {
      setMediaFormError('流入元タグ（utm_source）を半角英数字で入力してください。');
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
            badge: mediaFormBadge.trim() || '媒体',
            badgeColor: mediaFormBadgeColor,
          };
        }
        return m;
      });
      setFeedbackMessage(`媒体「${trimmedName}」の設定を更新しました。追跡リンクも即座に再生成されます。`);
    } else {
      const newMedia: MediumPreset = {
        id: `custom_media_${Date.now()}`,
        name: trimmedName,
        description: mediaFormDescription.trim(),
        utmSource: trimmedSource,
        utmMedium: mediaFormMedium.trim() || 'social',
        badge: mediaFormBadge.trim() || '媒体',
        badgeColor: mediaFormBadgeColor,
        category: 'Custom',
        isCustom: true,
      };
      updated = [...mediaList, newMedia];
      setFeedbackMessage(`新規媒体「${trimmedName}」を追加しました。`);
    }

    await persistMedia(updated);
    setIsMediaModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleDeleteMedia = (mediaId: string, mediaName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '媒体の削除',
      message: `媒体「${mediaName}」を一覧から削除しますか？`,
      onConfirm: async () => {
        const updated = mediaList.filter((m) => m.id !== mediaId);
        await persistMedia(updated);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage(`「${mediaName}」を削除しました。`);
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  const handleResetMediaToDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: '媒体一覧の初期化',
      message: '媒体一覧を初期設定（note、X、Instagram、LINE、チラシQRなど基本10媒体）に戻しますか？',
      onConfirm: async () => {
        clearStoredTrackingMedia();
        await persistMedia(TRACKING_MEDIA_PRESETS);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setFeedbackMessage('媒体設定を初期状態にリセットしました。');
        setTimeout(() => setFeedbackMessage(null), 4000);
      },
    });
  };

  // デフォルト値から変更されているか判定
  const isCustomized = (item: OfficialLinkItem) => {
    const original = defaultLinks.find((d) => d.id === item.id);
    if (!original) return true;
    return original.url !== item.url || original.title !== item.title;
  };

  const activeMatrixLink = links.find((l) => l.id === selectedMatrixLinkId) || links[0];

  return (
    <div className="space-y-6">
      {/* 案内トースト / フィードバックバナー */}
      {feedbackMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3.5 text-sm text-emerald-200 shadow-lg animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* ── 1. 自社公式リンク一覧（URLハブ） ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-700" />
              自社公式リンク一覧（URLハブ）
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              診断フォーム・個別相談・LINE・予約カレンダー・HPなどのマスターURLです。編集すると、下の媒体別リンクも自動連動します。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              新規リンク追加
            </button>
            <button
              type="button"
              onClick={handleResetAllToDefaults}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition shadow-xs"
              title="初期設定に戻す"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              初期値に戻す
            </button>
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
                          変更済み
                        </span>
                      )}
                    </div>
                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {item.description || '説明文はありません'}
                  </p>
                  
                  {/* URLボックス */}
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
                      title="実際のリンクを開いて確認"
                    >
                      確認 <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="text-xs text-purple-700 hover:text-purple-800 inline-flex items-center gap-1 font-semibold hover:underline"
                    >
                      <Pencil className="h-3 w-3" /> 編集
                    </button>
                    {item.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(item.id, item.title)}
                        className="text-xs text-rose-600 hover:text-rose-700 inline-flex items-center gap-0.5"
                        title="削除"
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
                        <Check className="h-3.5 w-3.5" /> コピー完了
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> コピー
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* 新規公式URL追加カード */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="rounded-xl border border-dashed border-slate-300 hover:border-purple-400 bg-slate-50/70 hover:bg-purple-50/40 p-4 flex flex-col items-center justify-center gap-1.5 transition text-center min-h-[140px] group cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 group-hover:text-purple-700">＋ 新規リンクを追加</span>
            <span className="text-[11px] text-slate-500">外部LPや別フォームを登録</span>
          </button>
        </div>
      </section>

      {/* ── 2. 媒体別 流入追跡リンク発行（2ステップ操作 ＆ 5媒体初期表示） ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-xs">
        {/* 注意喚起バナー（1行表示） */}
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-medium">
            友だち追加（line.me）のURLは流入元を計測できません。診断フォームを入口にすると流入元が残ります。
          </span>
        </div>

        {/* セクション見出し */}
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-purple-700" />
            媒体別 流入追跡リンク発行
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            ページを選んで媒体カードの「コピー」を押すだけで、各流入元を自動計測する追跡リンクを取得できます。
          </p>
        </div>

        {/* 【ステップ 1】リンクを作るページを選ぶ */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-700 text-[11px] font-bold text-white shadow-2xs">
              1
            </span>
            <span className="text-xs font-bold text-slate-800">リンクを作るページを選ぶ:</span>
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

        {/* 【ステップ 2】媒体カードの「コピー」を押す */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-700 text-[11px] font-bold text-white shadow-2xs">
                2
              </span>
              <span className="text-xs font-bold text-slate-800">媒体カードの「コピー」を押す:</span>
            </div>
            <span className="text-[11px] text-slate-500">
              発行対象: <strong className="text-purple-700">{activeMatrixLink?.title}</strong>
            </span>
          </div>

          {/* 媒体カード一覧（初期5媒体・各カードは媒体名、用途の一言、コピーボタンのみ） */}
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
                          追加媒体
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{preset.name}</h4>
                    <p className="mt-1 text-xs text-slate-500 leading-snug line-clamp-1">
                      {preset.description || '用途メモなし'}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedCardId(isExpanded ? null : preset.id)}
                        className="text-[11px] text-slate-500 hover:text-purple-700 inline-flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <span>{isExpanded ? 'URLを隠す' : 'URL全文を確認'}</span>
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
                            <Check className="h-3.5 w-3.5" /> コピー完了
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> コピー
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
                            ブラウザでテスト表示 <ExternalLink className="h-3 w-3" />
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

        {/* ── 初期状態では折りたたむ詳細設定群 ── */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          {/* 1. 企画タグ（utm_campaign） */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCampaignOption((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-purple-700 transition font-medium cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5 text-slate-500" />
                <span>企画タグ（utm_campaign）を設定する（任意）</span>
                {campaignName.trim() && (
                  <span className="ml-1 text-[10px] font-mono bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                    適用中: {campaignName.trim()}
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
                  企画タグを解除
                </button>
              )}
            </div>

            {showCampaignOption && (
              <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-white space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-700 font-semibold">企画タグ（utm_campaign）:</span>
                  <span className="text-[10px] text-slate-500">空欄の場合はスッキリした基本URLが発行されます</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="例: spring2026, opening_fair （空欄でOK）"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  {campaignName && (
                    <button
                      type="button"
                      onClick={() => setCampaignName('')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer"
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. 媒体の追加・編集・削除、「初期媒体に戻す」 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <button
              type="button"
              onClick={() => setShowMediaManagement((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs text-slate-700 hover:text-purple-700 transition font-medium cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <span>媒体のカスタマイズ（追加・編集・削除・初期値リセット）</span>
              </div>
              {showMediaManagement ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showMediaManagement && (
              <div className="mt-3 p-3.5 rounded-lg border border-slate-200 bg-white space-y-3 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-bold text-slate-800">
                    登録済み媒体一覧（全 {mediaList.length} 件）
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenCreateMedia}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> 新規媒体を追加
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyAllMatrixUrls(activeMatrixLink)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
                      title="全媒体のURLを改行区切りでまとめてコピー"
                    >
                      {copiedKey === 'matrix_all' ? <Check className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                      <span>全媒体まとめてコピー</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetMediaToDefaults}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                      title="基本5媒体にリセット"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>初期媒体に戻す</span>
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
                          title="編集"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(m.id, m.name)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="削除"
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

          {/* 3. 仕組みの解説 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <button
              type="button"
              onClick={() => setShowUtmGuide((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs text-slate-700 hover:text-purple-700 transition font-medium cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                <span>仕組みと流入計測の解説</span>
              </div>
              {showUtmGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showUtmGuide && (
              <div className="mt-3 p-4 rounded-lg border border-purple-200 bg-purple-50/60 text-xs text-slate-700 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs border-b border-purple-200 pb-2">
                  <Info className="h-4 w-4 shrink-0 text-purple-700" />
                  <span>流入追跡と自動タグ付与の仕組み</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
                  <div className="rounded-lg bg-white p-3 border border-purple-100 shadow-xs">
                    <span className="font-bold text-slate-900 block mb-1">1. URL自動正規化</span>
                    <p className="text-slate-600">
                      URL末尾の <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-mono">?utm_source=sns</code> などを小文字英数字へ自動正規化。リードメモに「流入: SNS」と明記されます。
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-purple-100 shadow-xs">
                    <span className="font-bold text-slate-900 block mb-1">2. LINEタグ自動付与</span>
                    <p className="text-slate-600">
                      LINE連携済みの顧客がフォームを送信すると、「診断受検済み」と「流入:SNS」タグが重複なく自動で付与されます。
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-purple-100 shadow-xs">
                    <span className="font-bold text-slate-900 block mb-1">3. 初期5媒体と拡張性</span>
                    <p className="text-slate-600">
                      日常運用はHPブログ・SNS・LINE・メール・資料の5媒体に集約。広告や外部紹介などは「新規媒体を追加」からいつでも拡張できます。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 1. 公式リンク 編集 / 追加モーダル ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-purple-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    {editingItem ? `「${editingItem.title}」の公式URL編集` : '新規公式URLの登録'}
                  </h3>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {editingItem 
                    ? '実運用の正しいURLを入力してください。保存すると媒体別追跡リンクも即座に自動更新されます。' 
                    : '自社のLP、個別相談フォーム、LINE登録リンクなどの公式URLを登録します。'}
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
                  リンク名・タイトル <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="例: 3分無料ボトルネック診断"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold">
                    公式URL <span className="text-rose-500">*</span>
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
                      初期URLを呼び出す
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://example.com/your-form または /f/your-slug"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  ※ 外部URL（https://...）またはアプリ内パス（/f/...）どちらでも設定可能です。
                </p>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">説明文・用途（任意）</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="例: LINEステップ配信やブログ末尾から誘導する本命フォーム"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">バッジ表記</label>
                  <input
                    type="text"
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    placeholder="例: 高成約率, 商談直行"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">バッジカラー</label>
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

              {/* ボタンエリア */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingItem && defaultLinks.some((d) => d.id === editingItem.id) ? (
                  <button
                    type="button"
                    onClick={() => handleResetSingleLink(editingItem.id)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-700 font-medium"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> このリンクを初期値に戻す
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium shadow-xs"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-purple-700 hover:bg-purple-800 px-4 py-1.5 text-xs font-semibold text-white transition shadow-xs"
                  >
                    {editingItem ? '変更を保存する' : '公式URLを登録する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 2. 媒体設定（名称・用途・タグ）編集 / 新規追加モーダル ── */}
      {isMediaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-purple-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    {editingMedia ? `媒体設定の編集（${editingMedia.name}）` : '新規媒体の追加'}
                  </h3>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  媒体名や用途メモ、顧客台帳へ記録される流入元識別タグ（utm_source）を設定できます。
                </p>
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
                  媒体名・表示ラベル <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mediaFormName}
                  onChange={(e) => setMediaFormName(e.target.value)}
                  placeholder="例: TikTok（ショート動画）, Threads（日常発信）, 〇〇提携先"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    流入元タグ（utm_source） <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mediaFormSource}
                    onChange={(e) => setMediaFormSource(e.target.value)}
                    placeholder="例: tiktok, threads, seminar"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">※ 半角英数字・アンダースコア</span>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    媒体種別（utm_medium）
                  </label>
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
                <label className="text-slate-700 font-semibold block mb-1">用途・運用のメモ（任意）</label>
                <input
                  type="text"
                  value={mediaFormDescription}
                  onChange={(e) => setMediaFormDescription(e.target.value)}
                  placeholder="例: プロフィールのリンクツリーや動画の固定コメントに配置"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">バッジ表記</label>
                  <input
                    type="text"
                    value={mediaFormBadge}
                    onChange={(e) => setMediaFormBadge(e.target.value)}
                    placeholder="例: 動画, SNS, 外部"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">バッジカラー</label>
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

              {/* リアルタイム生成URLプレビュー */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-[11px]">
                  <Share2 className="h-3.5 w-3.5 text-purple-700" />
                  <span>この媒体設定で発行されるURLプレビュー:</span>
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
                  ※ 顧客カルテの流入元には「{mediaFormName || '媒体名'}（{mediaFormSource.trim() || 'source'}）」として記録されます。
                </p>
              </div>

              {/* ボタンエリア */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium shadow-xs"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-purple-700 hover:bg-purple-800 px-4 py-1.5 text-xs font-semibold text-white transition shadow-xs"
                >
                  {editingMedia ? '媒体設定を更新する' : '媒体を追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 削除・初期化のインライン確認ダイアログ（iframeでも安全動作） ── */}
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
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white transition shadow-xs"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
