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
  AlertCircle
} from 'lucide-react';
import { OfficialLinkItem } from '../../types/marketing';
import { 
  loadStoredOfficialLinks, 
  saveStoredOfficialLinks, 
  clearStoredOfficialLinks 
} from '../../utils/marketingStorage';
import { getSupabase } from '../../lib/supabaseClient';

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
  const [campaignName, setCampaignName] = useState<string>('brand_awareness');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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

  // UTMリンクジェネレーター（ベースURLが修正されると自動で連動）
  const generateUtmUrl = (baseUrl: string) => {
    if (!baseUrl) return '';
    const trimmed = baseUrl.trim();
    let fullUrl = trimmed;
    if (trimmed.startsWith('/')) {
      fullUrl = `${origin}${trimmed}`;
    }
    const separator = fullUrl.includes('?') ? '&' : '?';
    const sourceParam = encodeURIComponent(selectedMedium);
    const campaignParam = encodeURIComponent(campaignName || 'default');
    return `${fullUrl}${separator}utm_source=${sourceParam}&utm_campaign=${campaignParam}`;
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
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Share2 className="h-4 w-4 text-cyan-400" />
              媒体別 流入追跡リンク（UTM計測URL）発行ツール
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" /> 公式URLハブと自動連動中
            </span>
          </div>

          {/* ユーザーの疑問に明快に答える説明カード */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3 text-xs text-indigo-200/90 flex items-start gap-2.5 leading-relaxed">
            <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-indigo-100">
                【自動反映について】上記の公式URLハブでURLを修正すると、ここにある媒体別追跡リンクもすべて自動的に新しいURLへと書き換わります。
              </p>
              <p className="mt-0.5 text-slate-300 text-[11px]">
                修正後に個別の追跡URLを再生成・再入力する手間はありません。媒体（note / X / 広告など）を選ぶだけで、常に最新の公式URLに基づく計測リンクを即座にコピーできます。
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-slate-300 font-medium">貼り付け先の媒体（流入元 utm_source）</label>
            <select
              value={selectedMedium}
              onChange={(e) => setSelectedMedium(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"
            >
              <option value="note">note（ブログ・解説記事）</option>
              <option value="x_twitter">X / Twitter（SNS投稿・プロフィール）</option>
              <option value="instagram">Instagram（プロフリンク・ストーリーズ）</option>
              <option value="meta_ads">Meta広告（Facebook / Instagram広告）</option>
              <option value="google_ads">Googleリスティング広告 / PMax</option>
              <option value="youtube">YouTube（概要欄・固定コメント）</option>
              <option value="line_broadcast">LINE一斉配信 / リッチメッセージ</option>
              <option value="newsletter">メルマガ配信</option>
              <option value="flyer_qr">チラシ・名刺・POP（QRコード用）</option>
              <option value="partner">提携パートナー・外部メディア紹介</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium">施策・キャンペーン名（utm_campaign）</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="例: care_opening, bottleneck_2026"
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white font-mono"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {['brand_awareness', 'care_opening', 'lead_magnet', 'webinar_spring', 'dx_package'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setCampaignName(tag)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition font-mono ${
                    campaignName === tag
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>生成された媒体別追跡URL（クリックでワンタッチコピー）:</span>
            <span className="text-indigo-300 font-normal">全 {links.length} 件連動中</span>
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
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/60 transition group shadow-sm"
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
