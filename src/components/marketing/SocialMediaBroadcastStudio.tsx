import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Share2,
  Send,
  Sparkles,
  Link2,
  Image as ImageIcon,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Settings,
  HelpCircle,
  RotateCcw,
  Clock,
  Layers,
  Eye,
  FileText,
  Upload,
  FolderOpen,
  Trash2,
  Loader2,
  X,
  Video,
  Film,
  Play,
  MessageSquare,
  Inbox,
  Hash,
  Info,
  Download,
  Calendar,
  Filter,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Plus,
  Bookmark,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { OfficialLinkItem } from '../../types/marketing';
import { loadStoredOfficialLinks } from '../../utils/marketingStorage';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import { fetchMarketingAssets, getAssetViewUrl, MarketingAsset, createMarketingAsset } from '../../services/marketingAssetService';
import { SocialDmSalesStudio } from './SocialDmSalesStudio';

export interface SocialPlatformConfig {
  id: 'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x';
  name: string;
  badge: string;
  badgeColor: string;
  maxChars?: number;
  requiresImage?: boolean;
  description: string;
  intentUrl?: (text: string, url: string) => string;
}

export const PLATFORMS: SocialPlatformConfig[] = [
  {
    id: 'threads',
    name: 'Threads',
    badge: '最大500字 / 画像・動画対応',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    maxChars: 500,
    description: '最大500文字の知見共有・問題提起・対話型ポスト',
    intentUrl: (text) => `https://threads.net/intent/post?text=${encodeURIComponent(text)}`,
  },
  {
    id: 'facebook',
    name: 'Facebook ページ',
    badge: '長文・画像・動画対応',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: '法人ページやビジネス層向けに課題解説・事例を共有',
    intentUrl: (text, url) => `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}&u=${encodeURIComponent(url || 'https://os.mstcorp.info')}`,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    badge: 'BtoB・経営層向け',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    maxChars: 3000,
    description: '経営者・役員層向けに組織開発や業務改善知見を投稿',
    intentUrl: (_text, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url || 'https://os.mstcorp.info')}`,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    badge: '画像・Reels必須 (手動投稿)',
    badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
    maxChars: 2200,
    requiresImage: true,
    description: '本文をコピーし、画像・動画と一緒に手動で投稿',
  },
  {
    id: 'x',
    name: 'X (旧Twitter)',
    badge: '140字 / ワンクリック投稿',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    maxChars: 140,
    description: 'フックと要約を140字で凝縮し、診断や記事へ誘導',
    intentUrl: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  },
];

export interface GeneratedPostCandidate {
  platform: 'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x';
  text: string;
  hashtags: string;
  imagePrompt: string;
  trackingLink: string;
  scheduledDate: string;
  savedAssetId?: string;
  status: 'draft' | 'approved' | 'published';
}

export interface BroadcastHistoryItem {
  id: string;
  text: string;
  imageUrl?: string;
  platforms: string[];
  sentAt: string;
  scheduledDate?: string;
  status: 'sent' | 'partial' | 'draft';
}

export interface ScheduledPostItem {
  id: string;
  title: string;
  platform: string;
  content: string;
  publishDate: string;
  status: 'draft' | 'review' | 'approved' | 'published';
  imageUrl?: string;
  trackingLink?: string;
  created_at: string;
}

const STORAGE_SETTINGS_KEY = 'mst_social_broadcast_settings_v1';
const STORAGE_HISTORY_KEY = 'mst_social_broadcast_history_v1';

export const SocialMediaBroadcastStudio: React.FC<{
  onNavigateTab?: (tab: string, options?: any) => void;
}> = ({ onNavigateTab }) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://os.mstcorp.info';

  // スタジオモード切り替え（コンテンツ作成 / DM営業メモ / 投稿予定一覧）
  const [studioMode, setStudioMode] = useState<'content_creation' | 'dm_sales' | 'weekly_schedule'>(() => {
    try {
      const saved = localStorage.getItem('social_studio_mode');
      if (saved === 'dm_sales' || saved === 'weekly_schedule' || saved === 'broadcast' || saved === 'content_creation') {
        return saved === 'broadcast' ? 'content_creation' : (saved as any);
      }
    } catch {}
    return 'content_creation';
  });

  // 用途の切替（現在は「SNS投稿」のみ表示。広告はローンチ後に開放できるよう型と構造を定義）
  const [usageType, setUsageType] = useState<'social' | 'ad'>('social');

  // 入力元選択: ①記事(自社オウンドメディア) ②資料(登録済み資料) ③自由入力
  const [inputSourceType, setInputSourceType] = useState<'article' | 'material' | 'freeform'>('article');
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [selectedMaterialKey, setSelectedMaterialKey] = useState<string>('business-improvement-guide');
  const [freeformType, setFreeformType] = useState<'case_study' | 'faq' | 'announcement' | 'insight'>('case_study');
  const [freeformNotes, setFreeformNotes] = useState<string>('');

  // 共通入力
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [tone, setTone] = useState<string>('プロフェッショナル・信頼感');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['threads', 'facebook', 'linkedin', 'x']);
  const [destinationUrl, setDestinationUrl] = useState<string>('https://os.mstcorp.info/diagnosis');
  const [scheduledDate, setScheduledDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // 記事・資料・商品・戦略マスターデータ
  const [articleRecords, setArticleRecords] = useState<any[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; product_name: string }>>([]);
  const [activeStrategyPolicy, setActiveStrategyPolicy] = useState<any | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostItem[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // 標準資料定義
  const standardMaterials = useMemo(() => [
    {
      key: 'business-improvement-guide',
      title: '中小企業のための業務改善・利益改善 実務ガイド',
      description: '経営者の手作業削減、利益率向上、業務の仕組み化手順をまとめた実践マニュアル',
      url: 'https://os.mstcorp.info/materials/business-improvement-guide.pdf',
    },
    {
      key: 'care-package-overview',
      title: '介護保険外サービス開業パッケージ 概要資料',
      description: '自費リハビリ・保険外看護など介護保険外サービスの立ち上げ・集客・実務モデル',
      url: 'https://os.mstcorp.info/materials/care-package-overview.pdf',
    },
    {
      key: 'mst-management-guide',
      title: 'MST経営の仕組み化・DX総合案内',
      description: '伴走型DX・業務自動化・社内ツール構築の全体像と導入事例',
      url: 'https://os.mstcorp.info/materials/mst-management-guide.pdf',
    },
  ], []);

  // 生成された候補一覧
  const [candidates, setCandidates] = useState<Record<string, GeneratedPostCandidate>>({});
  const [previewTab, setPreviewTab] = useState<'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x'>('threads');

  // 画像・メディア状態
  const [imageUrl, setImageUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [imageSourceMode, setImageSourceMode] = useState<'upload' | 'library' | 'url'>('upload');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 成果物保管庫（メディアライブラリ）モーダル状態
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<MarketingAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // 連携設定（Webhookのみ・トークン直接入力は完全撤去）
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // 実行状態
  const [sending, setSending] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. 初期データ読み込み＆セキュリティ整理（localStorageからトークンを完全消去）
  useEffect(() => {
    // セキュリティ整理: 旧バージョンのアクセストークンをlocalStorageから即時消去
    try {
      ['mst_meta_token', 'mst_threads_token', 'mst_linkedin_token'].forEach((k) => localStorage.removeItem(k));
      const rawSettings = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.webhookUrl) setWebhookUrl(parsed.webhookUrl);
        // トークンを含まないWebhook設定のみにサニタイズ保存
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify({ webhookUrl: parsed.webhookUrl || '' }));
      }
    } catch {}

    try {
      const rawHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (rawHistory) setHistory(JSON.parse(rawHistory));
    } catch {}

    const loadMasterData = async () => {
      const db = getSupabase();
      if (!db) return;

      try {
        // 商品マスタ取得
        const { data: prodData } = await db.from('products').select('id, product_name').order('product_name');
        if (prodData && prodData.length > 0) {
          setProducts(prodData);
          setSelectedProductId(prodData[0].id);
        }

        // 自社メディア記事一覧取得
        const { data: artData } = await db
          .from('mst_ai_acquisition_records')
          .select('*')
          .eq('record_type', 'article')
          .order('updated_at', { ascending: false })
          .limit(50);
        if (artData && artData.length > 0) {
          setArticleRecords(artData);
          setSelectedArticleId(artData[0].id);
        }

        // 集客戦略（SNS運用方針）の取得と既定値自動反映
        const { data: stratData } = await db
          .from('mst_ai_acquisition_records')
          .select('*')
          .eq('record_type', 'strategy')
          .order('updated_at', { ascending: false })
          .limit(20);

        if (stratData && stratData.length > 0) {
          const snsPolicy = stratData.find(
            (s: any) => s.payload?.strategyType === 'SNS運用方針（1枚）' || s.payload?.snsPlatforms
          ) || stratData[0];

          if (snsPolicy) {
            setActiveStrategyPolicy(snsPolicy);
            if (snsPolicy.payload?.target && !targetAudience) {
              setTargetAudience(snsPolicy.payload.target);
            }
            if (snsPolicy.payload?.destination) {
              setDestinationUrl(snsPolicy.payload.destination);
            }
            if (snsPolicy.payload?.snsPlatforms) {
              const rawPlatforms = snsPolicy.payload.snsPlatforms.split('|').map((p: string) => p.trim().toLowerCase());
              const mapped = rawPlatforms.map((p: string) => {
                if (p.includes('thread')) return 'threads';
                if (p.includes('face')) return 'facebook';
                if (p.includes('link')) return 'linkedin';
                if (p.includes('insta')) return 'instagram';
                if (p === 'x' || p.includes('twit')) return 'x';
                return null;
              }).filter(Boolean);
              if (mapped.length > 0) {
                setSelectedPlatforms(mapped);
              }
            }
          }
        }

        // 投稿予定一覧の取得
        await loadScheduledPostsList();
      } catch (err) {
        console.warn('Initial master data load error:', err);
      }
    };

    void loadMasterData();
  }, []);

  // 投稿予定一覧の取得
  const loadScheduledPostsList = async () => {
    const db = getSupabase();
    if (!db) return;
    setLoadingSchedule(true);
    try {
      const { data } = await db
        .from('mst_ai_acquisition_records')
        .select('*')
        .eq('record_type', 'social')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (data) {
        const items: ScheduledPostItem[] = data.map((d: any) => ({
          id: d.id,
          title: d.title,
          platform: d.payload?.platform || 'SNS',
          content: d.payload?.content || '',
          publishDate: d.payload?.publishDate || '',
          status: (d.status === '承認済み' ? 'approved' : d.status === '公開済み' ? 'published' : 'draft') as any,
          imageUrl: d.payload?.assetUrl || undefined,
          trackingLink: d.payload?.trackingLink || undefined,
          created_at: d.created_at,
        }));
        setScheduledPosts(items);
      }
    } catch (e) {
      console.warn('Failed to load scheduled posts:', e);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // 計測リンク（UTM）生成ヘルパー
  const buildTrackingUrl = (platformId: string, campaignSlug: string) => {
    let base = destinationUrl.trim() || 'https://os.mstcorp.info/diagnosis';
    if (!base.startsWith('http')) {
      base = `https://${base}`;
    }
    const sep = base.includes('?') ? '&' : '?';
    const cleanCampaign = (campaignSlug || 'strategy').replace(/[^a-zA-Z0-9_\-]/g, '_');
    return `${base}${sep}utm_source=${platformId}&utm_medium=social&utm_campaign=${cleanCampaign}`;
  };

  // 2. AI一括生成（記事・資料・自由入力から各SNS最適化文面を一括出力）
  const handleGeneratePostDrafts = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    setFeedback({ type: 'info', message: '社内AIが選択された媒体向けに投稿案・ハッシュタグ・画像案を考案中…' });

    try {
      // 入力元の解決
      let inputContext = '';
      let campaignSlug = 'sns_post';

      if (inputSourceType === 'article') {
        const article = articleRecords.find((a) => a.id === selectedArticleId);
        if (!article) throw new Error('参照する自社記事を選択してください。');
        campaignSlug = article.payload?.slug || article.title.slice(0, 20);
        inputContext = `【入力元: 自社メディア記事】
タイトル: ${article.title}
概要・要点: ${article.payload?.outline || ''}
本文抜粋: ${(article.payload?.body || '').slice(0, 1200)}
カテゴリ: ${article.payload?.category || ''}`;
      } else if (inputSourceType === 'material') {
        const material = standardMaterials.find((m) => m.key === selectedMaterialKey);
        campaignSlug = selectedMaterialKey;
        inputContext = `【入力元: 営業資料・実務ガイド】
資料名: ${material?.title}
概要・内容: ${material?.description}
公式案内先: ${material?.url}`;
      } else {
        const labelMap: Record<string, string> = {
          case_study: '改善事例・実績',
          faq: 'よくある質問（FAQ）',
          announcement: '会社からのお知らせ',
          insight: '日々の気づき・経営コラム',
        };
        campaignSlug = `freeform_${freeformType}`;
        inputContext = `【入力元: 自由入力（${labelMap[freeformType]}）】
内容・メモ: ${freeformNotes || '経営の仕組み化と利益改善の実践ノウハウ'}`;
      }

      const selectedProd = products.find((p) => p.id === selectedProductId);

      const prompt = `あなたはSNSマーケティングとBtoB顧客開拓のトップエキスパートです。
以下の前提条件と入力元をもとに、選択されたSNS媒体（${selectedPlatforms.join(', ')}）それぞれの特性・文字数上限に最適化された投稿案を作成してください。

${inputContext}

【共通条件】
対象商品: ${selectedProd?.product_name || '経営の仕組み化・利益改善支援'}
ターゲット層: ${targetAudience || '中小企業経営者・事業責任者'}
トーン: ${tone}
誘導先URL: ${destinationUrl}

【各媒体の要件】
1. Threads: 最大500字。冒頭で注意を引くフック、改行と箇条書き、共感と問いかけ。
2. Facebook: 長文可。背景、経営課題への考察、具体的な解決のヒント、CTA。
3. LinkedIn: ビジネス層向け。プロフェッショナルな論理構成、学び・知見の共有、考察。
4. Instagram: キャプション（本文）。画像やReelsと一緒に見て理解しやすいストーリー、保存したくなるまとめ。
5. X: 140字以内厳守。1行フック、要約、短縮CTA。

必ず以下のJSON形式のみを返してください。コードブロック (\`\`\`json ... \`\`\`) 形式で返してください。
{
  "candidates": [
    {
      "platform": "threads",
      "text": "投稿本文",
      "hashtags": "#業務改善 #経営者 #仕組み化",
      "imagePrompt": "投稿に添える推奨画像のプロンプト・構図指示"
    }
  ]
}`;

      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          workModeId: 'marketing_execution',
          character: {
            name: 'コンテンツ作成ディレクター',
            role: 'マルチSNSコンテンツ制作・最適化',
            personality: '各プラットフォームのアルゴリズムとユーザー心理を熟知したプロ',
            tone: '説得力があり簡潔',
          },
          stream: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI生成に失敗しました。');

      const cleaned = data.text.trim().replace(/^`{3}(?:json)?\s*/i, '').replace(/\s*`{3}$/i, '');
      const parsed = JSON.parse(cleaned);
      const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

      const newCandidates: Record<string, GeneratedPostCandidate> = {};
      for (const item of rawCandidates) {
        if (item.platform && selectedPlatforms.includes(item.platform)) {
          const tLink = buildTrackingUrl(item.platform, campaignSlug);
          newCandidates[item.platform] = {
            platform: item.platform,
            text: item.text || '',
            hashtags: item.hashtags || '',
            imagePrompt: item.imagePrompt || '',
            trackingLink: tLink,
            scheduledDate: scheduledDate,
            status: 'draft',
          };
        }
      }

      setCandidates(newCandidates);
      if (selectedPlatforms.length > 0 && selectedPlatforms.includes(previewTab)) {
        // keep previewTab
      } else if (selectedPlatforms.length > 0) {
        setPreviewTab(selectedPlatforms[0] as any);
      }
      setFeedback({ type: 'success', message: '各SNS向けの投稿案を一括生成しました！確認・編集の上、保存またはワンクリック投稿できます。' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || '生成に失敗しました。' });
    } finally {
      setAiGenerating(false);
    }
  };

  // 3. 保管庫への保存（mst_marketing_assets ＆ mst_ai_acquisition_records）
  const handleSaveToLibrary = async (platformId: string) => {
    const candidate = candidates[platformId];
    if (!candidate) return;

    try {
      const db = getSupabase();
      const authHeaders = await getAuthHeaders();
      const platConfig = PLATFORMS.find((p) => p.id === platformId);
      const title = `【${platConfig?.name || platformId}】${candidate.text.slice(0, 30).replace(/\n/g, ' ')}…`;

      // 1. MarketingAssetLibrary (mst_marketing_assets) へ保存
      const content = [
        `【プラットフォーム】: ${platConfig?.name || platformId}`,
        `【投稿予定日】: ${candidate.scheduledDate || '未定'}`,
        `【計測リンク】: ${candidate.trackingLink}`,
        `【推奨画像指示】: ${candidate.imagePrompt}`,
        `【ハッシュタグ】: ${candidate.hashtags}`,
        '',
        '■ 本文:',
        candidate.text,
      ].join('\n');

      const assetRes = await createMarketingAsset({
        title,
        asset_type: 'draft',
        status: candidate.status === 'published' ? 'published' : candidate.status === 'approved' ? 'approved' : 'draft',
        notes: content,
        product_id: selectedProductId || undefined,
        external_url: candidate.trackingLink,
      });

      // 2. mst_ai_acquisition_records (record_type = 'social') へ保存
      if (db) {
        const { data: auth } = await db.auth.getUser();
        if (auth.user) {
          await db.from('mst_ai_acquisition_records').upsert({
            user_id: auth.user.id,
            id: candidate.savedAssetId || `social_post_${Date.now()}_${platformId}`,
            record_type: 'social',
            title,
            product_id: selectedProductId || null,
            status: candidate.status === 'published' ? '公開済み' : candidate.status === 'approved' ? '承認済み' : '下書き',
            payload: {
              platform: platformId,
              content: candidate.text,
              hashtags: candidate.hashtags,
              trackingLink: candidate.trackingLink,
              imagePrompt: candidate.imagePrompt,
              publishDate: candidate.scheduledDate,
              assetUrl: imageUrl || '',
            },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,id' });
        }
      }

      setCandidates((prev) => ({
        ...prev,
        [platformId]: {
          ...prev[platformId],
          savedAssetId: assetRes.asset?.id || 'saved',
        },
      }));

      await loadScheduledPostsList();
      setFeedback({ type: 'success', message: `「${platConfig?.name}」向けの投稿案を資料・成果物保管庫に保存しました！` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: `保存に失敗しました: ${err.message}` });
    }
  };

  // 全件一括保存
  const handleSaveAllToLibrary = async () => {
    const keys = Object.keys(candidates);
    if (keys.length === 0) return;
    for (const key of keys) {
      await handleSaveToLibrary(key);
    }
    setFeedback({ type: 'success', message: '生成されたすべての投稿案を保管庫に保存しました！' });
    setTimeout(() => setFeedback(null), 3500);
  };

  // 4. CSV書き出し（列：投稿予定日時、プラットフォーム、本文、ハッシュタグ、画像URL、リンク）
  const handleExportCsv = () => {
    const listToExport: Array<{
      scheduledDate: string;
      platform: string;
      text: string;
      hashtags: string;
      imageUrl?: string;
      link: string;
    }> = [];

    // 現在生成されている候補
    Object.values(candidates).forEach((c) => {
      listToExport.push({
        scheduledDate: c.scheduledDate || '',
        platform: c.platform,
        text: c.text,
        hashtags: c.hashtags,
        imageUrl: imageUrl || '',
        link: c.trackingLink,
      });
    });

    // 候補が空なら投稿予定一覧から出力
    if (listToExport.length === 0 && scheduledPosts.length > 0) {
      scheduledPosts.forEach((p) => {
        listToExport.push({
          scheduledDate: p.publishDate || '',
          platform: p.platform,
          text: p.content,
          hashtags: '',
          imageUrl: p.imageUrl || '',
          link: p.trackingLink || '',
        });
      });
    }

    if (listToExport.length === 0) {
      setFeedback({ type: 'error', message: '書き出す投稿案がありません。先に投稿案を生成するか保存してください。' });
      return;
    }

    const headers = ['投稿予定日時', 'プラットフォーム', '本文', 'ハッシュタグ', '画像URL', 'リンク'];
    const rows = listToExport.map((item) => [
      `"${(item.scheduledDate || '').replace(/"/g, '""')}"`,
      `"${(item.platform || '').replace(/"/g, '""')}"`,
      `"${(item.text || '').replace(/"/g, '""')}"`,
      `"${(item.hashtags || '').replace(/"/g, '""')}"`,
      `"${(item.imageUrl || '').replace(/"/g, '""')}"`,
      `"${(item.link || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sns_post_schedule_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback({ type: 'success', message: `予約投稿ツール向け汎用CSV（${listToExport.length}件）を書き出しました！` });
    setTimeout(() => setFeedback(null), 3000);
  };

  // 5. Webhook送信（Make / Zapier / Buffer 等）
  const handleSendWebhook = async (platformId?: string) => {
    if (!webhookUrl.trim()) {
      setIsSettingsOpen(true);
      setFeedback({
        type: 'error',
        message: 'Webhook URLが未設定です。右上の「連携設定」からMake/Zapier/Buffer等のHTTPS Webhook URLを入力してください。',
      });
      return;
    }

    setSending(true);
    setFeedback({ type: 'info', message: '予約投稿Webhookへ送信中…' });

    try {
      const targetCandidate = platformId ? candidates[platformId] : Object.values(candidates)[0];
      const postTextToSend = targetCandidate ? `${targetCandidate.text}\n\n${targetCandidate.hashtags}\n${targetCandidate.trackingLink}` : '';

      if (!postTextToSend.trim()) {
        throw new Error('送信する投稿文がありません。');
      }

      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/marketing/social-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          text: postTextToSend,
          imageUrl: imageUrl.trim() || undefined,
          mediaUrl: imageUrl.trim() || undefined,
          mediaType: mediaType,
          platforms: platformId ? [platformId] : selectedPlatforms,
          webhookUrl: webhookUrl.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Webhook送信に失敗しました。');
      }

      setFeedback({ type: 'success', message: 'Webhookへの投稿リクエスト送信が完了しました！' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Webhook送信エラーが発生しました。' });
    } finally {
      setSending(false);
    }
  };

  // ワンクリック投稿画面を開く
  const handleOpenPlatformIntent = (platformId: string) => {
    const candidate = candidates[platformId];
    if (!candidate) return;
    const fullText = `${candidate.text}\n\n${candidate.hashtags}\n${candidate.trackingLink}`.trim();
    const plat = PLATFORMS.find((p) => p.id === platformId);

    if (platformId === 'instagram') {
      navigator.clipboard.writeText(fullText);
      setFeedback({
        type: 'info',
        message: 'Instagram用の本文をクリップボードにコピーしました！InstagramアプリまたはMeta Business Suiteを開き、画像・動画と一緒に貼り付けて投稿してください。',
      });
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (plat?.intentUrl) {
      const url = plat.intentUrl(fullText, candidate.trackingLink);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // コピー処理
  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 成果物から投稿案を再構築
  const handleReloadFromScheduledItem = (item: ScheduledPostItem) => {
    setInputSourceType('freeform');
    setFreeformType('insight');
    setFreeformNotes(item.content);
    if (item.imageUrl) setImageUrl(item.imageUrl);
    setScheduledDate(item.publishDate || new Date().toISOString().slice(0, 10));
    setStudioMode('content_creation');
    setFeedback({ type: 'info', message: '過去の投稿内容をコンテンツ作成エディタにセットしました。ブラッシュアップして再利用できます。' });
    setTimeout(() => setFeedback(null), 3000);
  };

  // 週別グルーピング
  const groupedWeeklySchedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(today.getDate() + (7 - today.getDay()));

    const nextWeekEnd = new Date(thisWeekEnd);
    nextWeekEnd.setDate(thisWeekEnd.getDate() + 7);

    const groups: {
      thisWeek: ScheduledPostItem[];
      nextWeek: ScheduledPostItem[];
      later: ScheduledPostItem[];
      unscheduled: ScheduledPostItem[];
    } = {
      thisWeek: [],
      nextWeek: [],
      later: [],
      unscheduled: [],
    };

    scheduledPosts.forEach((p) => {
      if (!p.publishDate) {
        groups.unscheduled.push(p);
        return;
      }
      const pDate = new Date(p.publishDate);
      if (isNaN(pDate.getTime())) {
        groups.unscheduled.push(p);
      } else if (pDate <= thisWeekEnd) {
        groups.thisWeek.push(p);
      } else if (pDate <= nextWeekEnd) {
        groups.nextWeek.push(p);
      } else {
        groups.later.push(p);
      }
    });

    return groups;
  }, [scheduledPosts]);

  return (
    <div className="space-y-5 text-slate-800">
      {/* ── 最上部モード切替バー ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setStudioMode('content_creation');
              try { localStorage.setItem('social_studio_mode', 'content_creation'); } catch {}
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              studioMode === 'content_creation'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>コンテンツ作成（SNS投稿）</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStudioMode('weekly_schedule');
              try { localStorage.setItem('social_studio_mode', 'weekly_schedule'); } catch {}
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              studioMode === 'weekly_schedule'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>投稿予定一覧（週別）</span>
            {scheduledPosts.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${studioMode === 'weekly_schedule' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {scheduledPosts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setStudioMode('dm_sales');
              try { localStorage.setItem('social_studio_mode', 'dm_sales'); } catch {}
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              studioMode === 'dm_sales'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>DM営業メモ</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {studioMode === 'content_creation' && Object.keys(candidates).length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
                title="予約投稿ツール向け汎用CSVエクスポート"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>CSV書き出し</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAllToLibrary}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>全件を保管庫に保存</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-purple-600" />
            <span>{isSettingsOpen ? '設定を閉じる' : '連携設定 (Webhook)'}</span>
          </button>
        </div>
      </div>

      {/* ── フィードバックバナー ── */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs shadow-xs animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-purple-200 bg-purple-50 text-purple-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium leading-relaxed">{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ── 連携設定モーダル (Webhook専用・トークン入力は撤去) ── */}
      {isSettingsOpen && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5 text-purple-600" />
                <span>予約投稿ツール連携設定（Webhook）</span>
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Make、Zapier、Buffer、n8n 等の予約投稿自動化ツールと連携するWebhook URLを設定できます。
              </p>
            </div>
            <span className="text-[10px] bg-white border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
              HTTPS URL限定 / SSRF保護
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-12 items-end">
            <div className="sm:col-span-9 space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                Webhook URL <span className="text-purple-600 font-normal">（例: https://hook.eu1.make.com/...）</span>
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify({ webhookUrl: webhookUrl.trim() }));
                    setFeedback({ type: 'success', message: 'Webhook設定を保存しました。' });
                    setIsSettingsOpen(false);
                    setTimeout(() => setFeedback(null), 3000);
                  } catch {
                    setFeedback({ type: 'error', message: '保存に失敗しました。' });
                  }
                }}
                className="w-full rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 text-xs shadow-xs transition cursor-pointer"
              >
                設定を保存
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-white/70 border border-slate-200 p-2.5 text-[11px] text-slate-500 leading-relaxed">
            🔒 <strong>セキュリティ方針:</strong> OS側で各SNSのアクセストークンを直接保持・管理しません。審査不要で規約リスクのない「ワンクリック手動投稿」または「Webhook＋CSV書き出し」で安全に運用できます。
          </div>
        </div>
      )}

      {/* ── モード1: コンテンツ作成（SNS投稿案生成） ── */}
      {studioMode === 'content_creation' && (
        <div className="space-y-5">
          {/* 用途切替 ＆ 運用方針連携サマリー */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setUsageType('social')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    usageType === 'social'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📱 SNS投稿案作成
                </button>
                <div
                  className="px-3 py-1 rounded-lg text-slate-400 text-xs flex items-center gap-1 cursor-not-allowed"
                  title="広告運用（Meta/Google）はOSローンチ後にコンテンツ作成の用途切替として追加予定です"
                >
                  <span>📢 広告コピー（ローンチ後開放）</span>
                </div>
              </div>

              {activeStrategyPolicy && (
                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>集客戦略連携: <strong>{activeStrategyPolicy.title}</strong></span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              記事・資料・自由メモから各SNSに刺さるフックと計測リンクを自動作成
            </div>
          </div>

          {/* 入力ブロック（2カラム: 左=条件設定 / 右=プレビュー＆個別投稿） */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 左側: 生成入力フォーム (6カラム) */}
            <div className="lg:col-span-6 space-y-4">
              {/* 1. 入力元の選択 (記事 / 資料 / 自由入力) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                    <span>入力元コンテンツの選択</span>
                  </label>
                  <span className="text-[10px] text-slate-400">元ネタをもとにAIが各SNSに最適化</span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setInputSourceType('article')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition text-center cursor-pointer ${
                      inputSourceType === 'article'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ① 自社記事から
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputSourceType('material')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition text-center cursor-pointer ${
                      inputSourceType === 'material'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ② 登録資料から
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputSourceType('freeform')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition text-center cursor-pointer ${
                      inputSourceType === 'freeform'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ③ 自由入力から
                  </button>
                </div>

                {/* ① 自社記事選択 */}
                {inputSourceType === 'article' && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      参照する自社オウンドメディア記事:
                    </label>
                    {articleRecords.length === 0 ? (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        登録された自社メディア記事がありません。「自社メディア・HP設定」タブで記事を登録するか、資料・自由入力をご利用ください。
                      </div>
                    ) : (
                      <select
                        value={selectedArticleId}
                        onChange={(e) => setSelectedArticleId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                      >
                        {articleRecords.map((art) => (
                          <option key={art.id} value={art.id}>
                            {art.title} {art.payload?.category ? `(${art.payload.category})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* ② 登録資料選択 */}
                {inputSourceType === 'material' && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      参照する登録資料・実務ガイド:
                    </label>
                    <div className="space-y-2">
                      {standardMaterials.map((mat) => (
                        <label
                          key={mat.key}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                            selectedMaterialKey === mat.key
                              ? 'border-purple-300 bg-purple-50/70 text-slate-900 ring-1 ring-purple-300'
                              : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name="materialChoice"
                            checked={selectedMaterialKey === mat.key}
                            onChange={() => setSelectedMaterialKey(mat.key)}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-bold text-slate-900">{mat.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{mat.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* ③ 自由入力 */}
                {inputSourceType === 'freeform' && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      発信の種別ラベル:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'case_study', label: '事例・実績' },
                        { key: 'faq', label: 'よくある質問' },
                        { key: 'announcement', label: 'お知らせ・告知' },
                        { key: 'insight', label: '日々の気づき' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFreeformType(item.key as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            freeformType === item.key
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={3}
                      value={freeformNotes}
                      onChange={(e) => setFreeformNotes(e.target.value)}
                      placeholder="伝えたい気づき、顧客からよく聞かれる質問、最近の改善事例メモを入力してください…"
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 2. 共通入力（商品、ターゲット、トーン、誘導先URL、予定日） */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 shadow-xs">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-purple-600" />
                  <span>共通条件・誘導先設定</span>
                </h4>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">対象商品</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">商品を選択（任意）</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.product_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">文章のトーン</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    >
                      <option>プロフェッショナル・信頼感</option>
                      <option>共感・親しみやすい</option>
                      <option>実践的・論理的</option>
                      <option>情熱・変革</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ターゲット層 <span className="text-[10px] text-purple-600 font-normal">（SNS運用方針から自動入力）</span>
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="例: 中小企業経営者、後継者、手作業に追われる事業責任者"
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      誘導先URL（UTM自動付与）
                    </label>
                    <input
                      type="url"
                      value={destinationUrl}
                      onChange={(e) => setDestinationUrl(e.target.value)}
                      placeholder="https://os.mstcorp.info/..."
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      投稿予定日
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* 配信先プラットフォーム選択 */}
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                    作成するSNSプラットフォーム:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {PLATFORMS.map((plat) => {
                      const isSelected = selectedPlatforms.includes(plat.id);
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlatforms((prev) =>
                              prev.includes(plat.id) ? prev.filter((p) => p !== plat.id) : [...prev, plat.id]
                            );
                          }}
                          className={`p-2 rounded-xl border text-center transition cursor-pointer text-xs font-semibold ${
                            isSelected
                              ? 'border-purple-400 bg-purple-50 text-purple-900 ring-1 ring-purple-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate">{plat.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 生成ボタン */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={aiGenerating || selectedPlatforms.length === 0}
                    onClick={handleGeneratePostDrafts}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 text-xs shadow-xs disabled:opacity-50 transition cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{aiGenerating ? 'AIが各SNS向け投稿案を考案中…' : '✨ 各SNS向けの投稿案を一括生成する'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 右側: 出力・プレビュー・個別投稿ペイン (6カラム) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 shadow-xs">
                {/* 媒体タブセレクタ */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {PLATFORMS.filter((p) => selectedPlatforms.includes(p.id)).map((p) => {
                      const isActive = previewTab === p.id;
                      const hasCandidate = Boolean(candidates[p.id]);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPreviewTab(p.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{p.name}</span>
                          {hasCandidate && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {candidates[previewTab] && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      文字数: {candidates[previewTab].text.length}字
                    </span>
                  )}
                </div>

                {/* 選択された媒体のコンテンツエディタ＆カード */}
                {candidates[previewTab] ? (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <span>{PLATFORMS.find((p) => p.id === previewTab)?.name} 向け投稿案</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyText(candidates[previewTab].text, `text_${previewTab}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                        >
                          {copiedKey === `text_${previewTab}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>本文コピー</span>
                        </button>
                      </div>
                    </div>

                    {/* 投稿本文 textarea */}
                    <textarea
                      rows={6}
                      value={candidates[previewTab].text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCandidates((prev) => ({
                          ...prev,
                          [previewTab]: { ...prev[previewTab], text: val },
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 leading-relaxed focus:border-purple-500 focus:outline-none"
                    />

                    {/* ハッシュタグ */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        ハッシュタグ:
                      </label>
                      <input
                        type="text"
                        value={candidates[previewTab].hashtags}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCandidates((prev) => ({
                            ...prev,
                            [previewTab]: { ...prev[previewTab], hashtags: val },
                          }));
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:border-purple-500 focus:outline-none font-mono"
                      />
                    </div>

                    {/* 計測リンク（UTM付き） */}
                    <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-purple-900">🔗 計測リンク（UTMパラメータ付与済み）:</span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(candidates[previewTab].trackingLink, `link_${previewTab}`)}
                          className="text-purple-700 hover:underline font-semibold cursor-pointer flex items-center gap-0.5"
                        >
                          {copiedKey === `link_${previewTab}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>URLコピー</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 font-mono break-all bg-white p-1.5 rounded border border-purple-200">
                        {candidates[previewTab].trackingLink}
                      </p>
                    </div>

                    {/* 推奨画像案プロンプト */}
                    {candidates[previewTab].imagePrompt && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700">🎨 画像案・生成指示:</span>
                        <p className="text-[11px] text-slate-600 italic">
                          {candidates[previewTab].imagePrompt}
                        </p>
                      </div>
                    )}

                    {/* 投稿アクションボタン群 */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveToLibrary(previewTab)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 transition cursor-pointer"
                        >
                          <Bookmark className="h-3.5 w-3.5 text-purple-600" />
                          <span>保管庫に保存</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendWebhook(previewTab)}
                          disabled={sending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer"
                          title="設定したMake/Zapier/Buffer等のWebhookへ送信"
                        >
                          <Send className="h-3.5 w-3.5 text-slate-500" />
                          <span>Webhook送信</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPlatformIntent(previewTab)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-xs cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>
                          {previewTab === 'instagram' ? 'Instagram手動投稿案内' : 'ワンクリック投稿画面を開く'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                    <Sparkles className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-600">左側の入力元と条件を選択し、「✨ 投稿案を一括生成する」を押してください。</p>
                    <p className="text-[11px] text-slate-400">
                      各媒体の文字数やトーンに最適化された文面と計測リンクがここに生成されます。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── モード2: 投稿予定一覧（週別ビュー） ── */}
      {studioMode === 'weekly_schedule' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span>週別・SNS投稿予定一覧</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                投稿予定日ごとにグルーピングして一覧化。汎用CSV書き出しや投稿案の再利用が可能です。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>CSV書き出し</span>
              </button>
              <button
                type="button"
                onClick={loadScheduledPostsList}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition shadow-xs cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingSchedule ? 'animate-spin text-purple-600' : 'text-slate-400'}`} />
                <span>更新</span>
              </button>
            </div>
          </div>

          {/* 週別セクション */}
          <div className="space-y-4">
            {[
              { key: 'thisWeek', label: '📅 今週の投稿予定', items: groupedWeeklySchedule.thisWeek, badge: '今週' },
              { key: 'nextWeek', label: '⏭️ 来週の投稿予定', items: groupedWeeklySchedule.nextWeek, badge: '来週' },
              { key: 'later', label: '📆 2週間後以降の予定', items: groupedWeeklySchedule.later, badge: '以降' },
              { key: 'unscheduled', label: '📝 日付未定・下書きストック', items: groupedWeeklySchedule.unscheduled, badge: 'ストック' },
            ].map((section) => (
              <div key={section.key} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{section.label}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      {section.items.length}件
                    </span>
                  </h4>
                </div>

                {section.items.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">該当する投稿予定はありません。</p>
                ) : (
                  <div className="space-y-2.5">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-purple-300 transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[10px] px-2 py-0.5 rounded uppercase bg-purple-50 text-purple-700 border border-purple-200">
                              {item.platform}
                            </span>
                            {item.publishDate && (
                              <span className="text-[11px] font-mono text-slate-500">
                                予定日: <strong>{item.publishDate}</strong>
                              </span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              item.status === 'published'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                : item.status === 'approved'
                                ? 'bg-sky-50 text-sky-800 border border-sky-300'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {item.status === 'published' ? '投稿済み' : item.status === 'approved' ? '承認済み' : '下書き'}
                            </span>
                          </div>
                          <p className="text-slate-800 line-clamp-2 leading-relaxed">
                            {item.content}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyText(item.content, `sched_${item.id}`)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
                          >
                            {copiedKey === `sched_${item.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            <span>コピー</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReloadFromScheduledItem(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition cursor-pointer"
                          >
                            <span>この内容で再作成</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── モード3: DM営業メモ（テンプレート＋手動記録） ── */}
      {studioMode === 'dm_sales' && (
        <SocialDmSalesStudio mode="all" onNavigateTab={onNavigateTab} />
      )}
    </div>
  );
};
