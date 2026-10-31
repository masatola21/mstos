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
  Layers,
  ListFilter,
  FileSpreadsheet,
  QrCode
} from 'lucide-react';
import { OfficialLinkItem } from '../../types/marketing';
import { 
  loadStoredOfficialLinks, 
  saveStoredOfficialLinks, 
  clearStoredOfficialLinks 
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
}

export const TRACKING_MEDIA_PRESETS: MediumPreset[] = [
  { id: 'note', name: 'note（ブログ・解説記事）', category: 'Owned / Blog', badge: '記事', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', description: 'note記事の文末CTAやマガジンに埋め込み', utmSource: 'note', utmMedium: 'article' },
  { id: 'x_twitter', name: 'X / Twitter（SNS投稿・プロフ）', category: 'Social', badge: 'SNS', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30', description: '固定ポスト・日々の投稿・プロフィールリンク用', utmSource: 'x_twitter', utmMedium: 'social' },
  { id: 'instagram', name: 'Instagram（プロフ・ストーリーズ）', category: 'Social', badge: 'SNS', badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30', description: 'プロフのリンクツリーやストーリーズスタンプ用', utmSource: 'instagram', utmMedium: 'social' },
  { id: 'line_broadcast', name: 'LINE公式（一斉配信・リッチメニュー）', category: 'Chat / CRM', badge: 'LINE', badgeColor: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30', description: 'LINE配信メッセージやリッチメニューのタップ先', utmSource: 'line_broadcast', utmMedium: 'chat' },
  { id: 'flyer_qr', name: 'チラシ・名刺・POP（QRコード用）', category: 'Offline', badge: '紙/QR', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30', description: '印刷物・展示会・店舗POP等のQRコード生成用URL', utmSource: 'flyer_qr', utmMedium: 'offline_qr' },
  { id: 'meta_ads', name: 'Meta広告（FB / IG広告）', category: 'Paid Ads', badge: '広告', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', description: 'Meta広告マネージャのリンク先URL設定用', utmSource: 'meta_ads', utmMedium: 'cpc' },
  { id: 'google_ads', name: 'Google広告（検索・PMax）', category: 'Paid Ads', badge: '広告', badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30', description: 'リスティング・ディスプレイ広告の最終ページURL', utmSource: 'google_ads', utmMedium: 'cpc' },
  { id: 'youtube', name: 'YouTube（概要欄・固定コメント）', category: 'Video', badge: '動画', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30', description: '動画の概要欄や固定コメントの導線リンク', utmSource: 'youtube', utmMedium: 'video' },
  { id: 'newsletter', name: 'メルマガ配信（Eメール）', category: 'Direct', badge: 'メール', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', description: '定期メルマガやステップメール本文内のリンク', utmSource: 'newsletter', utmMedium: 'email' },
  { id: 'partner', name: '提携パートナー・外部メディア紹介', category: 'Partner', badge: '外部', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30', description: 'アライアンス先や紹介記事からの送客リンク', utmSource: 'partner', utmMedium: 'referral' },
];

export interface CampaignPreset {
  id: string;
  name: string;
  label: string;
  description: string;
}

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  { id: 'standard', name: '常設・普段の投稿', label: '常設・基本 (standard)', description: '特別な企画ではなく、日々の投稿やプロフに常時置く基本URL' },
  { id: 'business_opening', name: '独立・開業応援', label: '独立・開業支援 (opening)', description: '新規立ち上げ・開業応援キャンペーン用の告知リンク' },
  { id: 'free_gift', name: '無料特典・診断配布', label: '無料特典・診断 (gift)', description: 'チェックシートや診断PDFプレゼントなどの企画用リンク' },
  { id: 'webinar_spring', name: 'セミナー・説明会', label: 'セミナー・説明会 (webinar)', description: 'オンライン説明会やセミナー告知時の専用リンク' },
  { id: 'new_service', name: '新プラン・サービス開始', label: '新プラン告知 (new_service)', description: '新しいプランやサービス提供開始時の集中集客用' },
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
  { label: 'インディゴ（高成約）', value: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { label: 'エメラルド（相談・申込）', value: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { label: 'グリーン（LINE・リスト）', value: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { label: 'シアン（予約・面談）', value: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { label: 'パープル（メディア・HP）', value: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { label: 'アンバー（重要・限定）', value: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { label: 'ローズ（キャンペーン）', value: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
];

export const MarketingQuickLinksHub: React.FC = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mstos.app';

  // 初期デフォルトリンク定義
  const defaultLinks: OfficialLinkItem[] = useMemo(() => [
    {
      id: 'diagnosis',
      title: '3分無料ボトルネック診断',
      description: '経営・業務の急所と改善処方箋を特定する自動診断フォーム',
      url: `${origin}/f/business-diagnosis`,
      badge: '高成約率',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      iconName: 'sparkles',
    },
    {
      id: 'care_consult',
      title: '介護保険外サービス開業・個別相談',
      description: '診断不要で直接30分面談を申し込める専用受付フォーム',
      url: `${origin}/f/care-consultation`,
      badge: '高額パッケージ直結',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      iconName: 'file-text',
    },
    {
      id: 'line_add',
      title: '公式LINE 友だち追加リンク',
      description: 'ステップ配信（実話ストーリー7話）や無料ツール配布の入口',
      url: 'https://line.me/R/ti/p/@mst_management',
      badge: 'リスト獲得',
      badgeColor: 'bg-green-500/20 text-green-300 border-green-500/30',
      iconName: 'message-circle',
    },
    {
      id: 'booking',
      title: '30分無料作戦会議（面談日程調整）',
      description: '対面営業や相談後に案内するオンライン面談カレンダー',
      url: `${origin}/apply/booking`,
      badge: '商談直行',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      iconName: 'calendar',
    },
    {
      id: 'media_top',
      title: '自社オウンドメディア / コーポレートHP',
      description: '会社概要・専門コラム・デジタル商品の本拠地',
      url: `${origin}/`,
      badge: '信頼・資産',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      iconName: 'globe',
    },
  ], [origin]);

  const [links, setLinks] = useState<OfficialLinkItem[]>(defaultLinks);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedMedium, setSelectedMedium] = useState<string>('note');
  const [campaignName, setCampaignName] = useState<string>('standard');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // UTM表示モード & マトリクス選択状態
  const [utmViewMode, setUtmViewMode] = useState<'matrix' | 'single'>('matrix');
  const [selectedMatrixLinkId, setSelectedMatrixLinkId] = useState<string>('biz_diagnostic');
  const [showUtmGuide, setShowUtmGuide] = useState<boolean>(true);

  // 編集用モーダル状態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficialLinkItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editBadgeColor, setEditBadgeColor] = useState(BADGE_COLOR_OPTIONS[0].value);
  const [editIconName, setEditIconName] = useState<IconKey>('link');
  const [editError, setEditError] = useState('');

  // データの初回読み込み（Supabase優先、次にローカルストレージ）
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // まずローカルストレージのデータを初期表示
      const localStored = loadStoredOfficialLinks();
      if (localStored && localStored.length > 0 && isMounted) {
        setLinks(localStored);
        if (!selectedMatrixLinkId) {
          setSelectedMatrixLinkId(localStored[0].id);
        }
      }

      // Supabaseからリモート同期
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user) {
            const { data, error } = await supabase
              .from('mst_ai_acquisition_records')
              .select('payload')
              .eq('user_id', auth.user.id)
              .eq('id', 'mst_official_hub_links')
              .eq('record_type', 'funnel_hub_config')
              .maybeSingle();

            if (!error && data?.payload?.links && Array.isArray(data.payload.links) && isMounted) {
              setLinks(data.payload.links);
              saveStoredOfficialLinks(data.payload.links);
              if (!selectedMatrixLinkId && data.payload.links.length > 0) {
                setSelectedMatrixLinkId(data.payload.links[0].id);
              }
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load official links from remote DB:', err);
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [defaultLinks]);

  // 永続化保存ヘルパー
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 高機能UTMリンクビルダー（媒体・施策・媒体種別を柔軟に付与）
  const buildUtmUrl = (baseUrl: string, source: string, campaign: string, mediumParam?: string) => {
    if (!baseUrl) return '';
    const trimmed = baseUrl.trim();
    let fullUrl = trimmed;
    if (trimmed.startsWith('/')) {
      fullUrl = `${origin}${trimmed}`;
    }
    const separator = fullUrl.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.set('utm_source', source);
    if (mediumParam) {
      params.set('utm_medium', mediumParam);
    }
    params.set('utm_campaign', campaign || 'default');
    return `${fullUrl}${separator}${params.toString()}`;
  };

  // 従来の単一媒体用ラッパー
  const generateUtmUrl = (baseUrl: string) => {
    return buildUtmUrl(baseUrl, selectedMedium, campaignName);
  };

  // マトリクス全媒体の一括コピー処理
  const handleCopyAllMatrixUrls = (link: OfficialLinkItem) => {
    const lines = TRACKING_MEDIA_PRESETS.map((preset) => {
      const url = buildUtmUrl(link.url, preset.utmSource, campaignName, preset.utmMedium);
      return `【${preset.name}】（${preset.description}）\n${url}`;
    });
    const header = `▼ ${link.title}\n公式URL: ${link.url}\n施策キャンペーン名: ${campaignName || 'default'}\n----------------------------------------\n`;
    const fullText = header + lines.join('\n\n');
    copyToClipboard(fullText, 'matrix_all');
  };

  // 編集モーダルを開く
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

  // 新規追加モーダルを開く
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

  // 編集内容を保存
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
      // 既存編集
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
      setFeedbackMessage(`「${trimmedTitle}」のURLを更新しました。媒体別流入追跡リンクも新しいURLに自動反映されました。`);
    } else {
      // 新規作成
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
      setFeedbackMessage(`新しい公式リンク「${trimmedTitle}」を追加しました。流入追跡リンクも自動生成されます。`);
    }

    await persistLinks(updatedLinks);
    setIsEditModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // 特定のリンクを初期URLに戻す
  const handleResetSingleLink = async (linkId: string) => {
    const original = defaultLinks.find((d) => d.id === linkId);
    if (!original) return;

    const updated = links.map((l) => (l.id === linkId ? { ...original } : l));
    await persistLinks(updated);
    setFeedbackMessage(`「${original.title}」を初期URL（${original.url}）に戻しました。`);
    setIsEditModalOpen(false);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // 全リンクを初期値にリセット
  const handleResetAllToDefaults = async () => {
    if (!window.confirm('すべての公式リンクのURLと設定を初期状態に戻しますか？')) {
      return;
    }
    clearStoredOfficialLinks();
    await persistLinks(defaultLinks);
    setFeedbackMessage('すべての公式リンク設定を初期状態にリセットしました。');
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // カスタムリンクの削除
  const handleDeleteLink = async (linkId: string, title: string) => {
    if (!window.confirm(`「${title}」を削除しますか？`)) {
      return;
    }
    const updated = links.filter((l) => l.id !== linkId);
    await persistLinks(updated);
    setFeedbackMessage(`「${title}」を削除しました。`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // デフォルト値から変更されているか判定
  const isCustomized = (item: OfficialLinkItem) => {
    const original = defaultLinks.find((d) => d.id === item.id);
    if (!original) return true; // 自作リンク
    return original.url !== item.url || original.title !== item.title;
  };

  return (
    <div className="space-y-6">
      {/* 案内トースト / フィードバックバナー */}
      {feedbackMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3.5 text-sm text-emerald-200 shadow-lg animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* ── 1. 公式導線リンク集 ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Link2 className="h-5 w-5 text-indigo-400" />
              集客・導線公式リンク集（URL編集・追加対応）
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              SNS、ブログ、広告、名刺・チラシに貼るための公式URLです。「編集」ボタンから自社の実URLへ自由に変更でき、下の流入追跡リンクも即座に自動連動します。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              新規公式リンクを追加
            </button>
            <button
              type="button"
              onClick={handleResetAllToDefaults}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition"
              title="初期設定に戻す"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              初期設定に戻す
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
                className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between hover:border-slate-700 transition shadow-sm group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                        {item.badge}
                      </span>
                      {modified && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          編集済みURL
                        </span>
                      )}
                    </div>
                    <Icon className="h-4 w-4 text-indigo-400 shrink-0" />
                  </div>
                  <h3 className="font-bold text-sm text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description || '説明文はありません'}
                  </p>
                  
                  {/* URLボックス */}
                  <div className="mt-3 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 truncate select-all flex items-center justify-between gap-2">
                    <span className="truncate">{item.url}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
                      title="実際のリンクを開いて確認"
                    >
                      確認 <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-semibold hover:underline"
                    >
                      <Pencil className="h-3 w-3" /> 編集
                    </button>
                    {item.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(item.id, item.title)}
                        className="text-xs text-rose-400 hover:text-rose-300 inline-flex items-center gap-0.5"
                        title="削除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.url, item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> コピー完了
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> URLをコピー
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
            className="rounded-2xl border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/70 bg-indigo-950/10 hover:bg-indigo-950/30 p-5 flex flex-col items-center justify-center gap-2 transition text-center min-h-[160px] group cursor-pointer"
          >
            <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-300 group-hover:text-white">＋ 新規公式リンクを追加</span>
            <span className="text-[11px] text-slate-500">外部LP・相談フォーム・予約URLなどを登録</span>
          </button>
        </div>
      </section>

      {/* ── 2. 流入計測（UTMリンク）発行ツール ── */}
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-5 space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="h-5 w-5 text-cyan-400" />
                媒体別 流入追跡リンク（UTM計測URL）発行ツール
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                note、X、Instagram、LINE、チラシQR、広告など、媒体ごとに専用URLを発行して流入元を自動分析します。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> 公式URLハブと自動連動中
              </span>
              <button
                type="button"
                onClick={() => setShowUtmGuide((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-700/50 px-2.5 py-1 rounded-lg transition"
              >
                <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
                <span>仕組みと使い分けの解説</span>
                {showUtmGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* ユーザーの疑問に明快に答える解説ガイド（開閉可能） */}
          {showUtmGuide && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-4 text-xs text-indigo-100 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs border-b border-indigo-800/60 pb-2">
                <Info className="h-4 w-4 shrink-0 text-cyan-400" />
                <span>よくある疑問：流入分析の仕組みと「URLは1つしか作れない？」について</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
                <div className="rounded-lg bg-slate-900/80 p-3 border border-indigo-500/20">
                  <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-[10px]">1</span>
                    流入分析とは？
                  </div>
                  <p className="text-slate-300">
                    訪問者がリンクを踏んだ時、URL末尾の <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-300 font-mono">?utm_source=note</code> などをシステムが自動検知。
                    「誰がどの媒体から来たのか」を顧客カルテ（リード一覧）に自動記録する仕組みです。
                  </p>
                </div>

                <div className="rounded-lg bg-slate-900/80 p-3 border border-indigo-500/20">
                  <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-[10px]">2</span>
                    URLは1つしか作れない？
                  </div>
                  <p className="text-slate-300 font-semibold text-white">
                    いいえ！媒体ごとに別々のURLを同時に何本でも発行して並行利用できます。
                  </p>
                  <p className="text-slate-400 mt-1">
                    同じ「診断ページ」でも、note用・X用・チラシQR用・LINE配信用のURLを同時に配ることで、流入元を完全に区別できます。
                  </p>
                </div>

                <div className="rounded-lg bg-slate-900/80 p-3 border border-indigo-500/20">
                  <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-[10px]">3</span>
                    分析結果はどこで見れる？
                  </div>
                  <p className="text-slate-300">
                    顧客台帳（CRMリード一覧）の「流入元」列に <span className="text-emerald-300 font-mono">診断フォーム（流入: note）</span> などと自動記録されます。
                    どの媒体が最も成約に繋がっているかを比較分析できます。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 施策・キャンペーン名設定（全モード共通） */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-indigo-400"></span>
                <span>施策・企画名（utm_campaign）の選択・入力</span>
              </label>
              <p className="mt-0.5 text-[11px] text-slate-400">
                「いつの・どんな企画で配ったリンクか」をカルテに記録する目印です（普段使いなら「常設」のままでOK）。
              </p>
            </div>
            <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/50">
              現在適用中: {campaignName}
            </span>
          </div>

          {/* 日本語ワンクリック選択ボタン */}
          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <span>よく使う企画プリセット（ワンクリックで切り替え）:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {CAMPAIGN_PRESETS.map((preset) => {
                const isSelected = campaignName === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setCampaignName(preset.id)}
                    className={`text-left p-2 rounded-lg border text-xs transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    <span className="truncate">{preset.name}</span>
                    <span className={`text-[10px] font-mono truncate mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {preset.id}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 自由入力フォーム */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>独自の企画名・イベント名を指定する場合（自由入力）:</span>
              <span className="text-[10px] text-slate-400">例: spring_2026, opening_fair, 無料相談会</span>
            </div>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="例: standard, opening_2026, 春の開業支援"
              className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* わかりやすい機能解説カード */}
          <div className="rounded-lg bg-indigo-950/30 border border-indigo-500/20 p-2.5 text-[11px] text-indigo-200 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>「utm_campaign」は何のためにあって、どう役立つの？</span>
            </div>
            <p className="text-slate-300">
              同じ「note」や「X」にリンクを貼る場合でも、<strong>「普段の定期投稿」</strong>から来たのか、それとも<strong>「春の独立・開業フェア」</strong>の告知から来たのかを区別するために使います。
            </p>
            <p className="text-slate-400 text-[10px]">
              👉 顧客カルテの流入元に「診断フォーム（流入: note / 企画: opening_2026）」のように記録されるため、「どの企画イベントが一番見込み客を集められたか」を後から振り返ることができます。
              <strong>※特別なイベントでない普段使い時は【常設・基本（standard）】のままで問題ありません。</strong>
            </p>
          </div>
        </div>

        {/* 表示モード切り替えタブ */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setUtmViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                utmViewMode === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              全媒体マトリクス表示（推奨: 1つのURLを各媒体用に一括発行）
            </button>
            <button
              type="button"
              onClick={() => setUtmViewMode('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                utmViewMode === 'single'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              媒体別絞り込み（単一媒体 × 全URL）
            </button>
          </div>
          <span className="text-[11px] text-slate-400">
            {utmViewMode === 'matrix' ? '全 10 媒体の計測URLを一覧表示中' : '選択した1媒体のURLを一覧表示中'}
          </span>
        </div>

        {/* ── モードA: 全媒体マトリクス表示 ── */}
        {utmViewMode === 'matrix' && (() => {
          const activeMatrixLink = links.find((l) => l.id === selectedMatrixLinkId) || links[0];
          if (!activeMatrixLink) return null;

          return (
            <div className="space-y-4">
              {/* 発行対象リンク選択 */}
              <div className="rounded-xl border border-indigo-500/20 bg-slate-950/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>計測したい公式導線（URL）を選択:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyAllMatrixUrls(activeMatrixLink)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                  >
                    {copiedKey === 'matrix_all' ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> 全10媒体のURLを一括コピー完了！
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-3.5 w-3.5" /> 全10媒体のURLをまとめてコピー（スプシ・記録用）
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {links.map((link) => {
                    const isSelected = link.id === activeMatrixLink.id;
                    return (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => setSelectedMatrixLinkId(link.id)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-950/80 border-indigo-500 text-white font-bold shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate">{link.title}</span>
                        <span className="text-[10px] text-slate-400 font-normal font-mono truncate mt-1">
                          {link.url}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 全10媒体の個別追跡URLグリッド */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">
                    「{activeMatrixLink.title}」の媒体別 計測URL一覧（全 {TRACKING_MEDIA_PRESETS.length} 媒体）:
                  </span>
                  <span className="text-[11px] text-indigo-300">各媒体へ貼り付けて同時に配信可能</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TRACKING_MEDIA_PRESETS.map((preset) => {
                    const utmUrl = buildUtmUrl(activeMatrixLink.url, preset.utmSource, campaignName, preset.utmMedium);
                    const isCopied = copiedKey === `preset_${preset.id}`;

                    return (
                      <div
                        key={preset.id}
                        onClick={() => copyToClipboard(utmUrl, `preset_${preset.id}`)}
                        className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 flex flex-col justify-between gap-2.5 hover:border-indigo-500/60 transition cursor-pointer group shadow-sm"
                        title="クリックしてこの媒体専用URLをコピー"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${preset.badgeColor}`}>
                                {preset.badge}
                              </span>
                              <span className="font-bold text-xs text-white truncate">{preset.name}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                              {preset.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={utmUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
                              title="ブラウザでテスト表示"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 text-slate-200 group-hover:bg-indigo-600 group-hover:text-white'
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3 w-3" /> コピー済
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" /> コピー
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* URL表示枠 */}
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[10px] font-mono text-cyan-300/90 truncate select-all">
                          {utmUrl}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── モードB: 単一媒体絞り込み表示 ── */}
        {utmViewMode === 'single' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium">貼り付け先の媒体（流入元 utm_source）</label>
                <select
                  value={selectedMedium}
                  onChange={(e) => setSelectedMedium(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white"
                >
                  {TRACKING_MEDIA_PRESETS.map((p) => (
                    <option key={p.id} value={p.utmSource}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-[11px] text-slate-400">
                  選択中の媒体（<code className="text-cyan-300">{selectedMedium}</code>）がすべての公式リンクに適用されます。
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>生成された媒体別追跡URL（全 {links.length} 件）:</span>
                <span className="text-indigo-300 font-normal">クリックでワンタッチコピー</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {links.map((link) => {
                  const utmUrl = generateUtmUrl(link.url);
                  const isCopied = copiedKey === `utm_${link.id}`;
                  const modified = isCustomized(link);

                  return (
                    <div
                      key={link.id}
                      onClick={() => copyToClipboard(utmUrl, `utm_${link.id}`)}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/60 transition group shadow-sm"
                      title="クリックしてUTM追跡URLをコピー"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-white truncate">{link.title}</span>
                          {modified && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                              最新URL適用
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{utmUrl}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={utmUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
                          title="UTMリンクをテスト確認"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                            isCopied
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'
                          }`}
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 編集 / 追加モーダル ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    {editingItem ? `「${editingItem.title}」の公式URL編集` : '新規公式URLの登録'}
                  </h3>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {editingItem 
                    ? '実運用の正しいURLを入力してください。保存すると下の追跡リンクも自動更新されます。' 
                    : '自社のLP、個別相談フォーム、LINE登録リンクなどの公式URLを登録します。登録されたURLは下の媒体別追跡リンクにも自動反映されます。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-500/40 p-2.5 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  導線名・タイトル <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="例: 3分無料ボトルネック診断"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-indigo-500 focus:outline-none text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    公式URL <span className="text-rose-400">*</span>
                  </label>
                  {editingItem && defaultLinks.some((d) => d.id === editingItem.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        const orig = defaultLinks.find((d) => d.id === editingItem.id);
                        if (orig) setEditUrl(orig.url);
                      }}
                      className="text-[11px] text-indigo-400 hover:underline"
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
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white font-mono focus:border-indigo-500 focus:outline-none text-xs"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  ※ 外部URL（https://...）またはアプリ内パス（/f/...）どちらでも設定可能です。
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">説明文・用途</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="例: LINEステップ配信やブログ末尾から誘導する本命フォーム"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white focus:border-indigo-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">バッジ表記</label>
                  <input
                    type="text"
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    placeholder="例: 高成約率, 商談直行"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">バッジカラー</label>
                  <select
                    value={editBadgeColor}
                    onChange={(e) => setEditBadgeColor(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none text-xs"
                  >
                    {BADGE_COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* リアルタイム追跡URL連動プレビュー */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-[11px]">
                  <Share2 className="h-3.5 w-3.5" />
                  <span>このURLに変更した場合の「媒体別追跡URL」連動プレビュー:</span>
                </div>
                <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-emerald-300 truncate border border-slate-800">
                  {generateUtmUrl(editUrl) || 'URLを入力するとプレビューが表示されます'}
                </div>
                <p className="text-[10px] text-slate-400">
                  保存すると、上記の追跡URLも自動で更新されます。
                </p>
              </div>

              {/* ボタンエリア */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {editingItem && defaultLinks.some((d) => d.id === editingItem.id) ? (
                  <button
                    type="button"
                    onClick={() => handleResetSingleLink(editingItem.id)}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> このリンクを初期値に戻す
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white transition shadow-sm"
                  >
                    {editingItem ? '変更を保存する' : '公式URLを登録する'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
