import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageSquare,
  Bookmark,
  BookOpen,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wand2,
  Film,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import { createMarketingAsset, fetchMarketingAssets, MarketingAsset } from '../../services/marketingAssetService';
import { loadKnowledgeItems } from '../../utils/storage';
import { OFFICIAL_VERCEL_URLS } from '../../utils/marketingStorage';
import type { KnowledgeItem } from '../../types/ai-president';
import { SocialDmSalesStudio } from './SocialDmSalesStudio';

export interface SocialPlatformConfig {
  id: 'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x';
  name: string;
  badge: string;
  maxChars?: number;
  intentUrl?: (text: string, url: string) => string;
}

export const PLATFORMS: SocialPlatformConfig[] = [
  {
    id: 'threads',
    name: 'Threads',
    badge: '最大500字',
    maxChars: 500,
    intentUrl: (text) => `https://threads.net/intent/post?text=${encodeURIComponent(text)}`,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    badge: '長文対応',
    intentUrl: (text, url) =>
      `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}&u=${encodeURIComponent(url || OFFICIAL_VERCEL_URLS.media_top)}`,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    badge: 'BtoB向け',
    maxChars: 3000,
    intentUrl: (_text, url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url || OFFICIAL_VERCEL_URLS.media_top)}`,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    badge: '手動投稿',
    maxChars: 2200,
  },
  {
    id: 'x',
    name: 'X (旧Twitter)',
    badge: '140字',
    maxChars: 140,
    intentUrl: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  },
];

export type VideoFormatId = 'short_video' | 'youtube_explainer' | 'sales_promo' | 'idea_list';

export interface VideoFormatConfig {
  id: VideoFormatId;
  name: string;
  badge: string;
  durationHint: string;
  description: string;
}

export const VIDEO_FORMATS: VideoFormatConfig[] = [
  {
    id: 'short_video',
    name: 'ショート動画台本',
    badge: '30〜60秒・縦型',
    durationHint: 'Reels / TikTok / Shorts',
    description: '冒頭3秒のフックから要点・CTAまでテンポよく構成します',
  },
  {
    id: 'youtube_explainer',
    name: 'YouTube解説構成',
    badge: '3〜10分・横型',
    durationHint: 'ノウハウ解説・信頼獲得',
    description: '導入・3つのポイント・事例・まとめの章立てで台本化します',
  },
  {
    id: 'sales_promo',
    name: 'サービス紹介・営業動画',
    badge: '1〜3分・LP/商談用',
    durationHint: 'HP掲載・商談前送付',
    description: '課題共感→解決後の変化→サービス強み→無料診断案内を作ります',
  },
  {
    id: 'idea_list',
    name: '動画アイデア5本出し',
    badge: '企画ストック',
    durationHint: 'ネタ出し・シリーズ企画',
    description: '同じ情報・戦略から切り口の異なる動画企画を5パターン提案します',
  },
];

export interface GeneratedPostCandidate {
  platform: 'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x';
  text: string;
  hashtags: string;
  imagePrompt: string;
  trackingLink: string;
  savedAssetId?: string;
}

export interface GeneratedVideoDraft {
  format: VideoFormatId;
  titleHook: string;
  scriptBody: string;
  visualNotes: string;
  ctaLine: string;
  captionText: string;   // 動画投稿時のSNSキャプション文
  imagePrompt: string;   // サムネイル・添え画像のAI生成指示文
  savedAssetId?: string;
}

type InputSourceType = 'knowledge' | 'website' | 'article_asset' | 'freeform';

export const SocialMediaBroadcastStudio: React.FC<{
  onNavigateTab?: (tab: string, options?: any) => void;
}> = ({ onNavigateTab }) => {
  // 2つのシンプルモード: ① SNS投稿・動画作成 / ② 営業DMテンプレート
  const [studioMode, setStudioMode] = useState<'content_creation' | 'dm_templates'>(() => {
    try {
      const saved = localStorage.getItem('social_studio_mode');
      if (saved === 'dm_templates' || saved === 'dm_sales') return 'dm_templates';
    } catch {}
    return 'content_creation';
  });

  // 作成タイプ: ① SNSテキスト投稿 / ② 動画構成案・アイデア
  const [creationKind, setCreationKind] = useState<'sns' | 'video'>('sns');

  // 入力元: ① 社内ナレッジ ② ホームページ/URL ③ 記事・登録資料 ④ 自由メモ
  const [inputSourceType, setInputSourceType] = useState<InputSourceType>('knowledge');

  // ① 社内ナレッジ
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string>('');
  const [knowledgeAngleNote, setKnowledgeAngleNote] = useState<string>('');

  // ② ホームページ / URL
  const [websiteUrl, setWebsiteUrl] = useState<string>(OFFICIAL_VERCEL_URLS.media_top);
  const [websiteTitle, setWebsiteTitle] = useState<string>('');
  const [websiteExtractedText, setWebsiteExtractedText] = useState<string>('');
  const [fetchingUrl, setFetchingUrl] = useState<boolean>(false);

  // ③ 記事・登録資料
  const [articleRecords, setArticleRecords] = useState<any[]>([]);
  const [assetRecords, setAssetRecords] = useState<MarketingAsset[]>([]);
  const [selectedArticleOrAssetKey, setSelectedArticleOrAssetKey] = useState<string>('');

  // ④ 自由メモ
  const [freeformType, setFreeformType] = useState<'case_study' | 'faq' | 'announcement' | 'insight'>('insight');
  const [freeformNotes, setFreeformNotes] = useState<string>('');

  // 媒体・スタイル設定（対象商品は任意＆デフォルト未選択）
  const [selectedPlatforms, setSelectedPlatforms] = useState<Array<'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x'>>([
    'threads',
    'facebook',
    'x',
  ]);
  const [tone, setTone] = useState<string>('プロフェッショナル・信頼感');
  const [destinationUrl, setDestinationUrl] = useState<string>(OFFICIAL_VERCEL_URLS.diagnosis);
  const [showOptionalSettings, setShowOptionalSettings] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<string>('');

  // マスターデータ
  const [products, setProducts] = useState<Array<{ id: string; product_name: string }>>([]);
  const [hpUrls, setHpUrls] = useState<Array<{ label: string; url: string }>>([
    { label: '公式コーポレートHP', url: OFFICIAL_VERCEL_URLS.media_top },
    { label: '介護保険外開業LP', url: OFFICIAL_VERCEL_URLS.care_consult },
    { label: '3分無料経営診断', url: OFFICIAL_VERCEL_URLS.diagnosis },
  ]);
  const [strategyRecords, setStrategyRecords] = useState<any[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');

  // 投稿エディタ状態（AI生成前でも最初から手動で書ける）
  const [candidates, setCandidates] = useState<Record<string, GeneratedPostCandidate>>({});
  const [previewTab, setPreviewTab] = useState<'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x'>('threads');
  const [refineInstruction, setRefineInstruction] = useState<string>('');

  // 動画構成案・台本・アイデア作成用ステート
  const [selectedVideoFormats, setSelectedVideoFormats] = useState<VideoFormatId[]>(['short_video', 'idea_list']);
  const [videoTone, setVideoTone] = useState<string>('語りかけ・分かりやすく親しみやすい');
  const [videoSpeakerStyle, setVideoSpeakerStyle] = useState<string>('社長・担当者が1人でカメラに向かって話す');
  const [videoDrafts, setVideoDrafts] = useState<Partial<Record<VideoFormatId, GeneratedVideoDraft>>>({});
  const [videoPreviewTab, setVideoPreviewTab] = useState<VideoFormatId>('short_video');
  const [videoRefineInstruction, setVideoRefineInstruction] = useState<string>('');
  const [savingVideoFormat, setSavingVideoFormat] = useState<VideoFormatId | null>(null);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRefining, setAiRefining] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    // ローカルナレッジを即座に読み込み
    const localKnowledge = loadKnowledgeItems();
    if (localKnowledge.length > 0) {
      setKnowledgeItems(localKnowledge);
      setSelectedKnowledgeId(localKnowledge[0].id);
    }

    const loadMasterData = async () => {
      const db = getSupabase();
      if (!db) return;

      try {
        const { data: auth } = await db.auth.getUser();
        const userId = auth?.user?.id;

        const [prodRes, artRes, stratRes, mediaRes, knowRes, assetsRes] = await Promise.all([
          db.from('products').select('id, product_name').order('product_name'),
          db.from('mst_ai_acquisition_records').select('*').eq('record_type', 'article').order('updated_at', { ascending: false }).limit(50),
          db.from('mst_ai_acquisition_records').select('*').eq('record_type', 'strategy').order('updated_at', { ascending: false }).limit(10),
          db.from('mst_ai_acquisition_records').select('*').eq('record_type', 'media').order('updated_at', { ascending: false }).limit(10),
          userId
            ? db.from('mst_ai_knowledge_items').select('payload').eq('user_id', userId).order('updated_at', { ascending: false })
            : Promise.resolve({ data: null }),
          fetchMarketingAssets(userId),
        ]);

        if (prodRes.data && prodRes.data.length > 0) {
          setProducts(prodRes.data);
          // 対象商品は任意のため、初期値は未選択のままにする
        }

        if (knowRes.data && knowRes.data.length > 0) {
          const remoteKnow = knowRes.data
            .map((r: any) => r.payload as KnowledgeItem)
            .filter((k) => k && k.id && k.title);
          if (remoteKnow.length > 0) {
            setKnowledgeItems((prev) => {
              const map = new Map<string, KnowledgeItem>();
              [...remoteKnow, ...prev].forEach((item) => {
                if (item?.id && !map.has(item.id)) map.set(item.id, item);
              });
              const merged = Array.from(map.values());
              setSelectedKnowledgeId((curr) => curr || merged[0]?.id || '');
              return merged;
            });
          }
        }

        if (artRes.data && artRes.data.length > 0) {
          setArticleRecords(artRes.data);
          setSelectedArticleOrAssetKey((curr) => curr || `article:${artRes.data[0].id}`);
        }

        if (assetsRes.assets && assetsRes.assets.length > 0) {
          setAssetRecords(assetsRes.assets);
          if (!artRes.data?.length) {
            setSelectedArticleOrAssetKey((curr) => curr || `asset:${assetsRes.assets[0].id}`);
          }
        }

        if (mediaRes.data && mediaRes.data.length > 0) {
          const extraUrls = mediaRes.data
            .filter((m: any) => m.payload?.url)
            .map((m: any) => ({
              label: m.title || '登録メディアHP',
              url: String(m.payload.url),
            }));
          if (extraUrls.length > 0) {
            setHpUrls((prev) => {
              const seen = new Set(prev.map((p) => p.url));
              const merged = [...prev];
              extraUrls.forEach((u) => {
                if (!seen.has(u.url)) {
                  seen.add(u.url);
                  merged.unshift(u);
                }
              });
              return merged;
            });
          }
        }

        if (stratRes.data && stratRes.data.length > 0) {
          setStrategyRecords(stratRes.data);
          const snsPolicy =
            stratRes.data.find((s: any) => s.payload?.strategyType === 'SNS運用方針（1枚）' || s.payload?.snsPlatforms) ||
            stratRes.data[0];
          if (snsPolicy) {
            setSelectedStrategyId((curr) => curr || snsPolicy.id);
            if (snsPolicy.payload?.target) setTargetAudience((curr) => curr || snsPolicy.payload.target);
            if (snsPolicy.payload?.destination && String(snsPolicy.payload.destination).startsWith('http')) {
              setDestinationUrl(snsPolicy.payload.destination);
            }
          }
        }
      } catch (err) {
        console.warn('Master data load error:', err);
      }
    };

    void loadMasterData();
  }, []);

  const buildTrackingUrl = (platformId: string, campaignSlug = 'sns') => {
    let base = destinationUrl.trim();
    if (!base) return '';
    if (!base.startsWith('http')) base = `https://${base}`;
    const sep = base.includes('?') ? '&' : '?';
    const cleanCampaign = (campaignSlug || 'sns').replace(/[^a-zA-Z0-9_\-]/g, '_');
    return `${base}${sep}utm_source=${platformId}&utm_medium=social&utm_campaign=${cleanCampaign}`;
  };

  // URLからホームページ本文を読み込む
  const fetchWebsiteContext = async (targetUrl?: string): Promise<{ title: string; text: string } | null> => {
    const urlToLoad = (targetUrl ?? websiteUrl).trim();
    if (!urlToLoad) {
      setFeedback({ type: 'error', message: '読み込むホームページのURLを入力してください。' });
      return null;
    }

    setFetchingUrl(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/marketing/fetch-url-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ url: urlToLoad }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ページの読み込みに失敗しました。');
      }

      const combinedText = [data.description ? `【概要】${data.description}` : '', data.text || '']
        .filter(Boolean)
        .join('\n\n');
      setWebsiteTitle(data.title || urlToLoad);
      setWebsiteExtractedText(combinedText);
      setFeedback({ type: 'success', message: `「${data.title || urlToLoad}」の内容を読み込みました。` });
      setTimeout(() => setFeedback(null), 3000);
      return { title: data.title || urlToLoad, text: combinedText };
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'URLの読み込みに失敗しました。' });
      return null;
    } finally {
      setFetchingUrl(false);
    }
  };

  const selectedKnowledge = useMemo(
    () => knowledgeItems.find((k) => k.id === selectedKnowledgeId) || null,
    [knowledgeItems, selectedKnowledgeId]
  );

  const activeStrategyPolicy = useMemo(
    () => strategyRecords.find((s) => s.id === selectedStrategyId) || null,
    [strategyRecords, selectedStrategyId]
  );

  const strategyDirectionText = useMemo(() => {
    if (!activeStrategyPolicy) return '';
    const p = activeStrategyPolicy.payload || {};
    const lines = [
      `戦略名: ${activeStrategyPolicy.title}`,
      p.target ? `ターゲット: ${p.target}` : '',
      p.goal ? `集客目標: ${p.goal}` : '',
      p.needs ? `顧客の課題: ${p.needs}` : '',
      p.strengths ? `強み・訴求ポイント: ${p.strengths}` : '',
      p.contentPillars || p.contentPolicy ? `発信の柱・方針: ${p.contentPillars || p.contentPolicy}` : '',
      p.destination ? `誘導先: ${p.destination}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }, [activeStrategyPolicy]);

  // 共通: 選択中の入力元からAI向けコンテキストを組み立てる
  const resolveInputContext = async (): Promise<{
    inputContext: string;
    campaignSlug: string;
    knowledgeContextStr: string;
  }> => {
    let inputContext = '';
    let campaignSlug = 'sns_post';
    let knowledgeContextStr = '';

    if (inputSourceType === 'knowledge') {
      if (!selectedKnowledge) {
        throw new Error('参照する社内ナレッジを選択してください（まだ未登録の場合は「自由メモ」や「HP・URL」から作成できます）。');
      }
      campaignSlug = 'knowledge';
      knowledgeContextStr = `【メイン参照ナレッジ: ${selectedKnowledge.title}】\n${selectedKnowledge.content}`;
      inputContext = `【入力元: 社内ナレッジ】\nタイトル: ${selectedKnowledge.title}\n切り口・補足指示: ${knowledgeAngleNote.trim() || 'このナレッジから経営者・見込み客にとって有益な学びや気づきを切り出してください。'}`;
    } else if (inputSourceType === 'website') {
      let loadedTitle = websiteTitle;
      let loadedText = websiteExtractedText;
      if (!loadedText.trim()) {
        const fetched = await fetchWebsiteContext(websiteUrl);
        if (!fetched || !fetched.text.trim()) {
          throw new Error('ホームページの内容が取得できませんでした。URLを確認するか、下のテキスト欄に要約を貼り付けてください。');
        }
        loadedTitle = fetched.title;
        loadedText = fetched.text;
      }
      campaignSlug = 'website';
      inputContext = `【入力元: ホームページ / Webページ】\nURL: ${websiteUrl}\nページタイトル: ${loadedTitle}\nページ内容:\n${loadedText.slice(0, 2500)}`;
    } else if (inputSourceType === 'article_asset') {
      if (!selectedArticleOrAssetKey) {
        throw new Error('参照する自社記事または登録資料を選択してください。');
      }
      if (selectedArticleOrAssetKey.startsWith('article:')) {
        const artId = selectedArticleOrAssetKey.replace('article:', '');
        const article = articleRecords.find((a) => a.id === artId);
        if (!article) throw new Error('選択した自社記事が見つかりません。');
        campaignSlug = article.payload?.slug || 'article';
        inputContext = `【入力元: 自社記事】\nタイトル: ${article.title}\n概要: ${article.payload?.outline || ''}\n本文抜粋: ${(article.payload?.body || '').slice(0, 1500)}`;
      } else {
        const assetId = selectedArticleOrAssetKey.replace('asset:', '');
        const asset = assetRecords.find((a) => a.id === assetId);
        if (!asset) throw new Error('選択した資料が見つかりません。');
        campaignSlug = 'asset';
        inputContext = `【入力元: 資料・成果物保管庫】\n資料名: ${asset.title}\nメモ・内容: ${asset.notes || ''}\nURL: ${asset.external_url || ''}`;
      }
    } else {
      const labelMap: Record<string, string> = {
        case_study: '改善事例・実績',
        faq: 'よくある質問（FAQ）',
        announcement: '会社からのお知らせ',
        insight: '日々の気づき・経営コラム',
      };
      if (!freeformNotes.trim()) {
        throw new Error('伝えたい内容やメモを入力してください。');
      }
      campaignSlug = `memo_${freeformType}`;
      inputContext = `【入力元: 自由メモ（${labelMap[freeformType]}）】\n内容:\n${freeformNotes.trim()}`;
    }

    if (!knowledgeContextStr && knowledgeItems.length > 0) {
      knowledgeContextStr = knowledgeItems
        .slice(0, 3)
        .map((k) => `・${k.title}: ${(k.content || '').slice(0, 300)}`)
        .join('\n');
    }

    return { inputContext, campaignSlug, knowledgeContextStr };
  };

  // 1. SNSテキスト投稿 AI一括生成
  const handleGeneratePostDrafts = async () => {
    if (aiGenerating || selectedPlatforms.length === 0) return;
    setAiGenerating(true);
    setFeedback({ type: 'info', message: 'AIが選んだ情報をもとに各SNS向けの投稿案を作成中…' });

    try {
      const { inputContext, campaignSlug, knowledgeContextStr } = await resolveInputContext();
      const selectedProd = products.find((p) => p.id === selectedProductId);

      const prompt = `あなたはBtoB集客・SNSライティングの専門家です。
以下の情報と集客戦略の方向性をもとに、指定されたSNS媒体（${selectedPlatforms.join(', ')}）それぞれの読まれ方に合わせて投稿案を作成してください。

${inputContext}
${strategyDirectionText ? `\n【集客戦略・施策方針（方向性）】\n${strategyDirectionText}` : ''}

【作成条件】
・対象商品・切り口: ${selectedProd ? selectedProd.product_name : '指定なし（自社の経営仕組み化・業務改善全般の知見として発信）'}
・ターゲット層: ${targetAudience || activeStrategyPolicy?.payload?.target || '中小企業経営者・事業責任者'}
・文章トーン: ${tone}
・誘導先URL: ${destinationUrl || '（必要な場合のみ案内）'}

【媒体別ルール】
- threads: 最大500字。1行目のフックと改行で読みやすく。
- facebook: 課題への共感→背景→具体的な視点→自然な案内。
- linkedin: ビジネス・経営層向けに論理的かつ簡潔な知見共有。
- instagram: 保存したくなる要点まとめ・キャプション形式。
- x: 140字以内厳守（URLやタグ分も含めて短く鋭く）。

必ず以下のJSON形式（\`\`\`json ... \`\`\`）のみで返してください。
{
  "candidates": [
    {
      "platform": "threads",
      "text": "投稿本文",
      "hashtags": "#業務改善 #仕組み化",
      "imagePrompt": "添える画像案（1行）"
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
          knowledgeContext: knowledgeContextStr || undefined,
          character: {
            name: 'SNS投稿作成ディレクター',
            role: 'マルチSNSコンテンツ作成・最適化',
            personality: '事実とナレッジをベースに、実務に根ざした説得力ある文章を書く',
            tone: '誠実でわかりやすく簡潔',
          },
          stream: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI生成に失敗しました。');

      const cleaned = data.text.trim().replace(/^`{3}(?:json)?\s*/i, '').replace(/\s*`{3}$/i, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

      const nextCandidates: Record<string, GeneratedPostCandidate> = { ...candidates };
      for (const item of rawCandidates) {
        if (item.platform && selectedPlatforms.includes(item.platform)) {
          nextCandidates[item.platform] = {
            platform: item.platform,
            text: item.text || '',
            hashtags: item.hashtags || '',
            imagePrompt: item.imagePrompt || '',
            trackingLink: buildTrackingUrl(item.platform, campaignSlug),
          };
        }
      }

      setCandidates(nextCandidates);
      if (!selectedPlatforms.includes(previewTab) && selectedPlatforms.length > 0) {
        setPreviewTab(selectedPlatforms[0]);
      }

      setFeedback({ type: 'success', message: '各SNS向けの投稿案を作成しました。右側で自由に手動修正・保存できます。' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '生成に失敗しました。' });
    } finally {
      setAiGenerating(false);
    }
  };

  // 1-B. 動画の構成案・台本・アイデア AI一括作成
  const handleGenerateVideoDrafts = async () => {
    if (aiGenerating || selectedVideoFormats.length === 0) return;
    setAiGenerating(true);
    setFeedback({ type: 'info', message: 'AIが選んだ情報と戦略をもとに、動画のアイデア・構成案・台本を作成中…' });

    try {
      const { inputContext, knowledgeContextStr } = await resolveInputContext();
      const selectedProd = products.find((p) => p.id === selectedProductId);

      const formatDescriptions = selectedVideoFormats
        .map((fid) => {
          const cfg = VIDEO_FORMATS.find((f) => f.id === fid);
          return `- ${fid} (${cfg?.name} / ${cfg?.badge}): ${cfg?.description}`;
        })
        .join('\n');

      const prompt = `あなたはBtoB企業向けの動画マーケティング・台本ディレクターです。
以下の入力情報と集客戦略の方向性をもとに、指定された動画フォーマット（${selectedVideoFormats.join(', ')}）ごとに実用的な動画アイデア・構成案・台本を作成してください。

${inputContext}
${strategyDirectionText ? `\n【集客戦略・施策方針（方向性）】\n${strategyDirectionText}` : ''}

【制作条件】
・対象商品・切り口: ${selectedProd ? selectedProd.product_name : '指定なし（業務の仕組み化・経営改善全般）'}
・ターゲット層: ${targetAudience || activeStrategyPolicy?.payload?.target || '中小企業経営者・事業責任者'}
・話し方トーン: ${videoTone}
・撮影・出演スタイル: ${videoSpeakerStyle}
・誘導先（CTA）: ${destinationUrl || '無料経営診断・LINE案内'}

【出力してほしいフォーマット】
${formatDescriptions}

【フォーマット別の記載ルール】
- short_video: 【0〜3秒：冒頭フック】→【3〜15秒：課題共感】→【15〜45秒：要点・結論】→【45〜60秒：締め・CTA】の時間配分で、すぐ話せる口語台本＋テロップ指示を書く。
- youtube_explainer: 【冒頭フック＆動画の結論】→【チャプター1〜3（見出し＋話す内容の要点とセリフ例）】→【まとめ・CTA】の構成台本を書く。
- sales_promo: 【課題提起】→【解決後の変化】→【自社サービスの強み・特徴】→【次のアクション案内】の流れで1〜3分の構成台本を書く。
- idea_list: 同じ素材・戦略をベースに、切り口の違う動画企画アイデアを「案1〜案5」まで5本出力する（各案に「企画タイトル」「サムネ文言」「狙う悩み」「流れ（冒頭→本編→締め）」「おすすめ媒体・尺」を含める）。

必ず以下のJSON形式（\`\`\`json ... \`\`\`）のみで返してください。
{
  "videoDrafts": [
    {
      "format": "short_video",
      "titleHook": "視聴者の手が止まるタイトル／冒頭1行フック案",
      "scriptBody": "構成案・台本（または5本の企画アイデア一覧）",
      "visualNotes": "映像・撮影・テロップ・サムネイルの工夫メモ",
      "ctaLine": "最後の誘導フレーズ（例：プロフの無料診断へ）",
      "captionText": "この動画をSNS投稿する際のキャプション文（ハッシュタグ含む・150字前後）",
      "imagePrompt": "サムネイル画像をAIで生成する指示文（構図・色・テキスト要素を含む具体的な1〜2文）"
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
          knowledgeContext: knowledgeContextStr || undefined,
          character: {
            name: '動画構成・企画ディレクター',
            role: '動画構成案・ショート台本・企画アイデア作成',
            personality: '視聴者が最初の3秒で自分事化できる構成と、自社でも撮りやすい現実的な台本を提案する',
            tone: 'わかりやすく具体的で実践的',
          },
          stream: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || '動画案の生成に失敗しました。');

      const cleaned = data.text.trim().replace(/^`{3}(?:json)?\s*/i, '').replace(/\s*`{3}$/i, '');
      const nextDrafts: Partial<Record<VideoFormatId, GeneratedVideoDraft>> = { ...videoDrafts };

      try {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
        const rawList = Array.isArray(parsed.videoDrafts) ? parsed.videoDrafts : [];
        if (rawList.length === 0) throw new Error('empty');
        for (const item of rawList) {
          if (item.format && selectedVideoFormats.includes(item.format)) {
            nextDrafts[item.format as VideoFormatId] = {
              format: item.format,
              titleHook: item.titleHook || '',
              scriptBody: item.scriptBody || '',
              visualNotes: item.visualNotes || '',
              ctaLine: item.ctaLine || '',
              captionText: item.captionText || '',
              imagePrompt: item.imagePrompt || '',
            };
          }
        }
      } catch {
        // JSON解析できない場合は現在タブの台本欄へそのまま反映して失われないようにする
        const targetFmt = selectedVideoFormats[0] || videoPreviewTab;
        nextDrafts[targetFmt] = {
          format: targetFmt,
          titleHook: `${VIDEO_FORMATS.find((f) => f.id === targetFmt)?.name || '動画'}案`,
          scriptBody: data.text.trim(),
          visualNotes: '',
          ctaLine: '',
          captionText: '',
          imagePrompt: '',
        };
      }

      setVideoDrafts(nextDrafts);
      if (!selectedVideoFormats.includes(videoPreviewTab) && selectedVideoFormats.length > 0) {
        setVideoPreviewTab(selectedVideoFormats[0]);
      }

      setFeedback({ type: 'success', message: '動画の構成案・アイデアを作成しました。右側で自由に書き直し・保存できます。' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '動画案の作成に失敗しました。' });
    } finally {
      setAiGenerating(false);
    }
  };

  // 表示中タブの投稿データ（未生成時でも手動で入力できるよう初期オブジェクトを返す）
  const activeDraft: GeneratedPostCandidate = candidates[previewTab] || {
    platform: previewTab,
    text: '',
    hashtags: '',
    imagePrompt: '',
    trackingLink: buildTrackingUrl(previewTab, 'manual'),
  };

  const updateActiveDraft = (patch: Partial<GeneratedPostCandidate>) => {
    setCandidates((prev) => ({
      ...prev,
      [previewTab]: {
        ...(prev[previewTab] || {
          platform: previewTab,
          text: '',
          hashtags: '',
          imagePrompt: '',
          trackingLink: buildTrackingUrl(previewTab, 'manual'),
        }),
        ...patch,
      },
    }));
  };

  // 右側エディタのAIブラッシュアップ
  const handleAiRefineCurrent = async (presetInstruction?: string) => {
    const inst = (presetInstruction ?? refineInstruction).trim();
    if (!activeDraft.text.trim()) {
      setFeedback({ type: 'error', message: '先に本文を入力するか、左側で投稿案を生成してください。' });
      return;
    }
    if (!inst) {
      setFeedback({ type: 'error', message: 'どう直したいか指示を入力してください。' });
      return;
    }

    setAiRefining(true);
    try {
      const plat = PLATFORMS.find((p) => p.id === previewTab);
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `次の ${plat?.name || previewTab} 用投稿案を、以下の指示どおりに書き直してください。
${plat?.maxChars ? `文字数上限: ${plat.maxChars}字以内` : ''}
指示: ${inst}

【現在の本文】
${activeDraft.text}

※書き直した本文のみをそのまま返してください（説明不要）。`,
            },
          ],
          workModeId: 'marketing_execution',
          knowledgeContext: selectedKnowledge ? `${selectedKnowledge.title}\n${selectedKnowledge.content}` : undefined,
          stream: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI調整に失敗しました。');
      updateActiveDraft({ text: data.text.trim() });
      if (!presetInstruction) setRefineInstruction('');
      setFeedback({ type: 'success', message: `${plat?.name} の投稿文をブラッシュアップしました。` });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '調整に失敗しました。' });
    } finally {
      setAiRefining(false);
    }
  };

  // 資料・成果物保管庫へ保存
  const handleSaveToLibrary = async (platformId: string) => {
    const draft = candidates[platformId];
    if (!draft || !draft.text.trim()) return;

    setSavingId(platformId);
    try {
      const platConfig = PLATFORMS.find((p) => p.id === platformId);
      const title = `【${platConfig?.name || platformId}】${draft.text.slice(0, 28).replace(/\n/g, ' ')}…`;
      const tracking = draft.trackingLink || buildTrackingUrl(platformId, 'draft');
      const notes = [
        `【プラットフォーム】: ${platConfig?.name || platformId}`,
        tracking ? `【誘導リンク】: ${tracking}` : '',
        draft.hashtags ? `【ハッシュタグ】: ${draft.hashtags}` : '',
        '',
        draft.text,
      ]
        .filter(Boolean)
        .join('\n');

      const res = await createMarketingAsset({
        title,
        asset_type: 'draft',
        status: 'draft',
        notes,
        strategy_record_id: selectedStrategyId || undefined,
        product_id: selectedProductId || undefined,
        external_url: tracking || OFFICIAL_VERCEL_URLS.media_top,
      });

      if (!res.asset) {
        throw new Error(res.message || '保存に失敗しました。');
      }

      setCandidates((prev) => ({
        ...prev,
        [platformId]: { ...prev[platformId], savedAssetId: res.asset?.id },
      }));
      setFeedback({ type: 'success', message: `「${platConfig?.name}」の投稿案を「資料・成果物保管庫」に保存しました。` });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '保存に失敗しました。' });
    } finally {
      setSavingId(null);
    }
  };

  // 表示中タブの動画構成データ（未生成時でも手動入力可能）
  const activeVideoDraft: GeneratedVideoDraft = videoDrafts[videoPreviewTab] || {
    format: videoPreviewTab,
    titleHook: '',
    scriptBody: '',
    visualNotes: '',
    ctaLine: '',
    captionText: '',
    imagePrompt: '',
  };

  const updateActiveVideoDraft = (patch: Partial<GeneratedVideoDraft>) => {
    setVideoDrafts((prev) => ({
      ...prev,
      [videoPreviewTab]: {
        ...(prev[videoPreviewTab] || {
          format: videoPreviewTab,
          titleHook: '',
          scriptBody: '',
          visualNotes: '',
          ctaLine: '',
          captionText: '',
          imagePrompt: '',
        }),
        ...patch,
      },
    }));
  };

  // 動画構成のAI手直し
  const handleAiRefineVideo = async (presetInstruction?: string) => {
    const inst = (presetInstruction ?? videoRefineInstruction).trim();
    if (!activeVideoDraft.scriptBody.trim() && !activeVideoDraft.titleHook.trim()) {
      setFeedback({ type: 'error', message: '先に構成案・台本を入力するか、左側で動画案を作成してください。' });
      return;
    }
    if (!inst) {
      setFeedback({ type: 'error', message: 'どう直したいか指示を入力してください。' });
      return;
    }

    setAiRefining(true);
    try {
      const fmt = VIDEO_FORMATS.find((f) => f.id === videoPreviewTab);
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `次の「${fmt?.name || videoPreviewTab}」の内容を、以下の指示どおりにブラッシュアップしてください。
指示: ${inst}
${strategyDirectionText ? `\n参照する集客戦略:\n${strategyDirectionText}` : ''}

【現在のタイトル・フック】
${activeVideoDraft.titleHook}

【現在の構成・台本本文】
${activeVideoDraft.scriptBody}

※書き直した構成・台本本文のみをそのまま返してください（余計な前置きは不要です）。`,
            },
          ],
          workModeId: 'marketing_execution',
          knowledgeContext: selectedKnowledge ? `${selectedKnowledge.title}\n${selectedKnowledge.content}` : undefined,
          stream: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI調整に失敗しました。');
      updateActiveVideoDraft({ scriptBody: data.text.trim() });
      if (!presetInstruction) setVideoRefineInstruction('');
      setFeedback({ type: 'success', message: `${fmt?.name} の内容をブラッシュアップしました。` });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '調整に失敗しました。' });
    } finally {
      setAiRefining(false);
    }
  };

  const buildVideoFullText = (draft: GeneratedVideoDraft) => {
    const fmt = VIDEO_FORMATS.find((f) => f.id === draft.format);
    return [
      `【動画種別】${fmt?.name || draft.format}（${fmt?.badge || ''}）`,
      draft.titleHook.trim() ? `【タイトル・冒頭フック】\n${draft.titleHook.trim()}` : '',
      draft.scriptBody.trim() ? `【構成案・台本・アイデア】\n${draft.scriptBody.trim()}` : '',
      draft.visualNotes.trim() ? `【映像・テロップ・サムネイルメモ】\n${draft.visualNotes.trim()}` : '',
      draft.ctaLine.trim() ? `【締めの誘導CTA】\n${draft.ctaLine.trim()}` : '',
      draft.captionText?.trim() ? `【SNS投稿キャプション】\n${draft.captionText.trim()}` : '',
      draft.imagePrompt?.trim() ? `【サムネイル画像AI指示文】\n${draft.imagePrompt.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const handleCopyVideoDraft = () => {
    const full = buildVideoFullText(activeVideoDraft);
    if (!full.trim()) return;
    navigator.clipboard.writeText(full);
    setCopiedKey(`video_${videoPreviewTab}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveVideoToLibrary = async () => {
    if (!activeVideoDraft.scriptBody.trim() && !activeVideoDraft.titleHook.trim()) return;
    setSavingVideoFormat(videoPreviewTab);
    try {
      const fmt = VIDEO_FORMATS.find((f) => f.id === videoPreviewTab);
      const rawTitle = activeVideoDraft.titleHook.trim() || activeVideoDraft.scriptBody.slice(0, 28).replace(/\n/g, ' ');
      const title = `【動画案:${fmt?.name || videoPreviewTab}】${rawTitle}`;
      const notes = buildVideoFullText(activeVideoDraft);

      const res = await createMarketingAsset({
        title,
        asset_type: 'draft',
        status: 'draft',
        notes,
        strategy_record_id: selectedStrategyId || undefined,
        product_id: selectedProductId || undefined,
        external_url: destinationUrl.trim() || OFFICIAL_VERCEL_URLS.media_top,
      });

      if (!res.asset) {
        throw new Error(res.message || '保存に失敗しました。');
      }

      updateActiveVideoDraft({ savedAssetId: res.asset.id });
      setFeedback({ type: 'success', message: `「${fmt?.name}」の構成案を「資料・成果物保管庫」に保存しました。` });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '保存に失敗しました。' });
    } finally {
      setSavingVideoFormat(null);
    }
  };

  const handleOpenPlatformIntent = () => {
    if (!activeDraft.text.trim()) return;
    const tracking = activeDraft.trackingLink || buildTrackingUrl(previewTab, 'sns');
    const fullText = [activeDraft.text.trim(), activeDraft.hashtags.trim(), tracking].filter(Boolean).join('\n\n');
    const plat = PLATFORMS.find((p) => p.id === previewTab);

    if (previewTab === 'instagram') {
      navigator.clipboard.writeText(fullText);
      setFeedback({
        type: 'info',
        message: 'Instagram用の本文をコピーしました。Instagram画面で画像と一緒に貼り付けて投稿してください。',
      });
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (plat?.intentUrl) {
      window.open(plat.intentUrl(fullText, tracking), '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyFullPost = () => {
    if (!activeDraft.text.trim()) return;
    const tracking = activeDraft.trackingLink || buildTrackingUrl(previewTab, 'sns');
    const fullText = [activeDraft.text.trim(), activeDraft.hashtags.trim(), tracking].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedKey(`full_${previewTab}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activePlatformConfig = PLATFORMS.find((p) => p.id === previewTab);
  const currentCharCount = activeDraft.text.length;
  const isOverLimit = Boolean(activePlatformConfig?.maxChars && currentCharCount > activePlatformConfig.maxChars);

  const activeVideoConfig = VIDEO_FORMATS.find((f) => f.id === videoPreviewTab);
  const videoCharCount = activeVideoDraft.scriptBody.replace(/\s+/g, '').length;
  const estimatedMinutes = videoCharCount > 0 ? Math.max(0.2, Math.round((videoCharCount / 300) * 10) / 10) : 0;

  return (
    <div className="space-y-4 text-slate-800">
      {/* ── 最上部 2タブ切り替え ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setStudioMode('content_creation');
              try {
                localStorage.setItem('social_studio_mode', 'content_creation');
              } catch {}
            }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              studioMode === 'content_creation'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>SNS投稿・動画作成（AI × ナレッジ・HP）</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStudioMode('dm_templates');
              try {
                localStorage.setItem('social_studio_mode', 'dm_templates');
              } catch {}
            }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              studioMode === 'dm_templates'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>営業DMテンプレート</span>
          </button>
        </div>

        {studioMode === 'content_creation' && strategyRecords.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="shrink-0 font-medium">戦略方向性:</span>
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="max-w-[230px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-purple-500 focus:outline-none"
            >
              <option value="">指定なし（汎用作成）</option>
              {strategyRecords.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── フィードバックバナー ── */}
      {feedback && studioMode === 'content_creation' && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs shadow-xs ${
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
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ── モード1: SNS投稿・動画作成（AI × ナレッジ・HP × 手動編集） ── */}
      {studioMode === 'content_creation' && (
        <div className="space-y-3">
          {/* 作成タイプの切り替えバー（SNSテキスト投稿 vs 動画構成・アイデア） */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600 mr-1">作成するもの:</span>
              <button
                type="button"
                onClick={() => setCreationKind('sns')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  creationKind === 'sns'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>SNSテキスト投稿</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationKind('video')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  creationKind === 'video'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Film className="h-3.5 w-3.5" />
                <span>動画の構成案・台本・アイデア</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-500">
              {creationKind === 'video'
                ? '戦略やナレッジ・HPをもとに、ショート動画・YouTube・企画アイデア5本まで作成できます'
                : '同じ情報からSNS各媒体向けの投稿文を作成できます'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* 左側 (5カラム): 入力元と作成条件 */}
            <div className="lg:col-span-5 space-y-4">
              {/* 1. 元ネタ選択（SNS・動画で共通利用） */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                    <span>1. 元にする情報（入力元）</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                  {(
                    [
                      { id: 'knowledge', label: '社内ナレッジ' },
                      { id: 'website', label: 'HP・URL' },
                      { id: 'article_asset', label: '記事・資料' },
                      { id: 'freeform', label: '自由メモ' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setInputSourceType(item.id)}
                      className={`py-1.5 px-2 rounded-lg font-semibold transition text-center cursor-pointer ${
                        inputSourceType === item.id
                          ? 'bg-white text-purple-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* ① 社内ナレッジ */}
                {inputSourceType === 'knowledge' && (
                  <div className="space-y-2.5 pt-1">
                    {knowledgeItems.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                        <p className="font-semibold">社内ナレッジがまだ登録されていません。</p>
                        <p className="text-[11px]">
                          「管理・その他 ＞ 社内ナレッジ保管庫」で登録するとここで選択できます。いまは「HP・URL」や「自由メモ」から作成できます。
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            参照する社内ナレッジ（{knowledgeItems.length}件）
                          </label>
                          <select
                            value={selectedKnowledgeId}
                            onChange={(e) => setSelectedKnowledgeId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                          >
                            {knowledgeItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        {selectedKnowledge && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                            {selectedKnowledge.content}
                          </div>
                        )}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            どんな切り口で作るか（任意）
                          </label>
                          <input
                            type="text"
                            value={knowledgeAngleNote}
                            onChange={(e) => setKnowledgeAngleNote(e.target.value)}
                            placeholder="例: 経営者の悩み解決の視点で／具体例を交えて分かりやすく"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ② ホームページ・URL */}
                {inputSourceType === 'website' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {hpUrls.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => {
                            setWebsiteUrl(preset.url);
                            void fetchWebsiteContext(preset.url);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                            websiteUrl === preset.url
                              ? 'bg-purple-50 border-purple-300 text-purple-800'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://corp.mstcorp.info/..."
                        className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 font-mono focus:border-purple-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={fetchingUrl}
                        onClick={() => void fetchWebsiteContext()}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-2 text-xs font-bold text-purple-800 transition cursor-pointer disabled:opacity-50"
                      >
                        {fetchingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                        <span>内容を取得</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        読み込んだページ内容（そのまま編集・追記もOK）
                      </label>
                      <textarea
                        rows={4}
                        value={websiteExtractedText}
                        onChange={(e) => setWebsiteExtractedText(e.target.value)}
                        placeholder="「内容を取得」を押すとホームページの文章が読み込まれます（手動貼り付けも可）。未取得のまま下の生成ボタンを押しても自動で読み込みます。"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                )}

                {/* ③ 記事・登録資料 */}
                {inputSourceType === 'article_asset' && (
                  <div className="space-y-2 pt-1">
                    {articleRecords.length === 0 && assetRecords.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        登録済みの記事や資料がありません。「社内ナレッジ」や「HP・URL」「自由メモ」をご利用ください。
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          参照する自社記事・保管庫資料
                        </label>
                        <select
                          value={selectedArticleOrAssetKey}
                          onChange={(e) => setSelectedArticleOrAssetKey(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                        >
                          {articleRecords.length > 0 && (
                            <optgroup label="自社メディア記事">
                              {articleRecords.map((art) => (
                                <option key={`article:${art.id}`} value={`article:${art.id}`}>
                                  📄 {art.title}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {assetRecords.length > 0 && (
                            <optgroup label="資料・成果物保管庫">
                              {assetRecords.map((asset) => (
                                <option key={`asset:${asset.id}`} value={`asset:${asset.id}`}>
                                  📁 {asset.title}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* ④ 自由メモ */}
                {inputSourceType === 'freeform' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'insight', label: '日々の気づき' },
                        { key: 'case_study', label: '事例・実績' },
                        { key: 'faq', label: 'よくある質問' },
                        { key: 'announcement', label: 'お知らせ' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFreeformType(item.key as any)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            freeformType === item.key
                              ? 'bg-purple-600 text-white'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={4}
                      value={freeformNotes}
                      onChange={(e) => setFreeformNotes(e.target.value)}
                      placeholder="伝えたいテーマ、顧客との会話で出た悩み、動画や投稿にしたい要点をそのまま入力してください…"
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* 2. 出力設定（SNSモード vs 動画モード） */}
              {creationKind === 'sns' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                  <span className="text-xs font-bold text-slate-900 block">2. 出力するSNS・トーン</span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PLATFORMS.map((plat) => {
                      const isSelected = selectedPlatforms.includes(plat.id);
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() =>
                            setSelectedPlatforms((prev) =>
                              prev.includes(plat.id) ? prev.filter((p) => p !== plat.id) : [...prev, plat.id]
                            )
                          }
                          className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer text-xs font-semibold ${
                            isSelected
                              ? 'border-purple-400 bg-purple-50 text-purple-900 ring-1 ring-purple-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate">{plat.name}</div>
                          <div className="text-[10px] opacity-75 font-normal">{plat.badge}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">文章のトーン</label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                      >
                        <option>プロフェッショナル・信頼感</option>
                        <option>共感・親しみやすい</option>
                        <option>実践的・論理的</option>
                        <option>情熱・変革</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">誘導先URL（任意）</label>
                      <input
                        type="url"
                        value={destinationUrl}
                        onChange={(e) => setDestinationUrl(e.target.value)}
                        placeholder="https://corp.mstcorp.info/diagnosis"
                        className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 font-mono focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 任意詳細（対象商品・ターゲット層）は折りたたみ */}
                  <div className="border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOptionalSettings((v) => !v)}
                      className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer py-1"
                    >
                      <span>
                        任意設定（対象商品：{selectedProductId ? products.find((p) => p.id === selectedProductId)?.product_name : '指定なし'}）
                      </span>
                      {showOptionalSettings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {showOptionalSettings && (
                      <div className="mt-2 space-y-2.5 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            対象商品（特定の商品を訴求したい場合のみ選択）
                          </label>
                          <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                          >
                            <option value="">指定なし（全社共通・汎用）</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">ターゲット層（任意）</label>
                          <input
                            type="text"
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            placeholder="例: 中小企業経営者、介護事業所の責任者"
                            className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={aiGenerating || selectedPlatforms.length === 0}
                    onClick={() => void handleGeneratePostDrafts()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 text-xs shadow-xs disabled:opacity-50 transition cursor-pointer"
                  >
                    {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span>{aiGenerating ? 'AIが投稿案を作成中…' : '✨ 選んだ情報から投稿案を一括作成'}</span>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Film className="h-4 w-4 text-purple-600" />
                    <span>2. 動画の形式・制作スタイル</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {VIDEO_FORMATS.map((fmt) => {
                      const isSelected = selectedVideoFormats.includes(fmt.id);
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() =>
                            setSelectedVideoFormats((prev) =>
                              prev.includes(fmt.id) ? prev.filter((id) => id !== fmt.id) : [...prev, fmt.id]
                            )
                          }
                          className={`px-3 py-2 rounded-xl border text-left transition cursor-pointer text-xs font-semibold ${
                            isSelected
                              ? 'border-purple-400 bg-purple-50 text-purple-900 ring-1 ring-purple-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="truncate">{fmt.name}</div>
                          <div className="text-[10px] opacity-75 font-normal">{fmt.badge}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">話し方・トーン</label>
                      <select
                        value={videoTone}
                        onChange={(e) => setVideoTone(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                      >
                        <option>語りかけ・分かりやすく親しみやすい</option>
                        <option>結論ファースト・論理的</option>
                        <option>課題に鋭く切り込む・フック重視</option>
                        <option>丁寧で落ち着いた信頼感</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">撮影・出演イメージ</label>
                      <select
                        value={videoSpeakerStyle}
                        onChange={(e) => setVideoSpeakerStyle(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                      >
                        <option>社長・担当者が1人でカメラに向かって話す</option>
                        <option>スライド・図解＋ナレーション解説</option>
                        <option>インタビュー・質問に答える対話形式</option>
                        <option>画面収録・デモを見せながら紹介</option>
                      </select>
                    </div>
                  </div>

                  {/* 任意詳細（対象商品・ターゲット層）は折りたたみ */}
                  <div className="border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOptionalSettings((v) => !v)}
                      className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer py-1"
                    >
                      <span>
                        任意設定（対象商品：{selectedProductId ? products.find((p) => p.id === selectedProductId)?.product_name : '指定なし'}）
                      </span>
                      {showOptionalSettings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {showOptionalSettings && (
                      <div className="mt-2 space-y-2.5 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            対象商品（特定の商品を訴求したい場合のみ選択）
                          </label>
                          <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                          >
                            <option value="">指定なし（全社共通・汎用）</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">ターゲット層（任意）</label>
                          <input
                            type="text"
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            placeholder="例: 中小企業経営者、介護事業所の責任者"
                            className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={aiGenerating || selectedVideoFormats.length === 0}
                    onClick={() => void handleGenerateVideoDrafts()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 text-xs shadow-xs disabled:opacity-50 transition cursor-pointer"
                  >
                    {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                    <span>{aiGenerating ? 'AIが動画構成・アイデアを作成中…' : '🎬 選んだ情報・戦略から動画構成・アイデアを作成'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 右側 (7カラム): SNSエディタ または 動画構成案・台本エディタ */}
            {creationKind === 'sns' ? (
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PLATFORMS.map((p) => {
                      const isActive = previewTab === p.id;
                      const hasText = Boolean(candidates[p.id]?.text?.trim());
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
                          {hasText && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>

                  <span
                    className={`text-xs font-mono font-semibold ${
                      isOverLimit ? 'text-rose-600' : 'text-slate-500'
                    }`}
                  >
                    {currentCharCount}
                    {activePlatformConfig?.maxChars ? ` / ${activePlatformConfig.maxChars}字` : '字'}
                  </span>
                </div>

                {/* 本文手動エディタ（最初から入力可能） */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900">
                      {activePlatformConfig?.name} 投稿本文（直接編集・手動入力OK）
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeDraft.text);
                        setCopiedKey(`body_${previewTab}`);
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                      disabled={!activeDraft.text.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer disabled:opacity-40"
                    >
                      {copiedKey === `body_${previewTab}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span>本文のみコピー</span>
                    </button>
                  </div>
                  <textarea
                    rows={10}
                    value={activeDraft.text}
                    onChange={(e) => updateActiveDraft({ text: e.target.value })}
                    placeholder={`ここに ${activePlatformConfig?.name || ''} 向けの投稿文を手入力するか、左側の「✨ 投稿案を一括作成」で下書きを生成してください。`}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 leading-relaxed focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">ハッシュタグ</label>
                    <input
                      type="text"
                      value={activeDraft.hashtags}
                      onChange={(e) => updateActiveDraft({ hashtags: e.target.value })}
                      placeholder="#業務改善 #仕組み化 #経営"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">誘導リンク（UTM付き）</label>
                    <input
                      type="text"
                      value={activeDraft.trackingLink}
                      onChange={(e) => updateActiveDraft({ trackingLink: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 font-mono focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {activeDraft.imagePrompt && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-800">画像AI指示文（ChatGPT / Midjourneyへ貼り付け）</span>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(activeDraft.imagePrompt); setCopiedKey(`imgprompt_${previewTab}`); setTimeout(() => setCopiedKey(null), 2000); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] text-slate-600 font-semibold transition"
                      >
                        {copiedKey === `imgprompt_${previewTab}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        コピー
                      </button>
                    </div>
                    <p className="text-xs text-slate-700">{activeDraft.imagePrompt}</p>
                  </div>
                )}

                {/* AIワンクリックブラッシュアップバー */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-purple-900 mr-1 flex items-center gap-1">
                      <Wand2 className="h-3.5 w-3.5 text-purple-600" />
                      <span>AI手直し:</span>
                    </span>
                    {['もう少し短くスッキリ', '親しみやすいトーンに', '具体例・数字の視点を足す'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={aiRefining || !activeDraft.text.trim()}
                        onClick={() => void handleAiRefineCurrent(preset)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 hover:bg-purple-100 text-[11px] font-semibold text-purple-800 transition cursor-pointer disabled:opacity-40"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={refineInstruction}
                      onChange={(e) => setRefineInstruction(e.target.value)}
                      placeholder="自由指示（例: 冒頭1行目をもっと目を引く問いかけに変えて）"
                      className="flex-1 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={aiRefining || !activeDraft.text.trim() || !refineInstruction.trim()}
                      onClick={() => void handleAiRefineCurrent()}
                      className="shrink-0 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer disabled:opacity-40"
                    >
                      {aiRefining ? '修正中…' : 'AIで書き直す'}
                    </button>
                  </div>
                </div>

                {/* 出力アクション */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!activeDraft.text.trim()}
                      onClick={handleCopyFullPost}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 transition cursor-pointer disabled:opacity-40"
                    >
                      {copiedKey === `full_${previewTab}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                      <span>{copiedKey === `full_${previewTab}` ? 'コピー済み' : '全文（本文＋タグ＋URL）をコピー'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!activeDraft.text.trim() || savingId === previewTab}
                      onClick={() => void handleSaveToLibrary(previewTab)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3.5 py-2 text-xs font-bold text-purple-800 transition cursor-pointer disabled:opacity-40"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>{savingId === previewTab ? '保存中…' : '保管庫に保存'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!activeDraft.text.trim()}
                    onClick={handleOpenPlatformIntent}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-40"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>
                      {previewTab === 'instagram' ? 'コピーしてInstagramを開く' : `${activePlatformConfig?.name} の投稿画面を開く`}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {VIDEO_FORMATS.map((fmt) => {
                      const isActive = videoPreviewTab === fmt.id;
                      const hasContent = Boolean(videoDrafts[fmt.id]?.scriptBody?.trim() || videoDrafts[fmt.id]?.titleHook?.trim());
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setVideoPreviewTab(fmt.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{fmt.name}</span>
                          {hasContent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {videoCharCount}字
                      {videoPreviewTab !== 'idea_list' && estimatedMinutes > 0 ? `（話し言葉目安 約${estimatedMinutes}分）` : ''}
                    </span>
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      {videoPreviewTab === 'idea_list' ? '企画テーマ・シリーズ見出し' : '動画タイトル案 ／ 冒頭3秒のフック'}
                    </label>
                    <input
                      type="text"
                      value={activeVideoDraft.titleHook}
                      onChange={(e) => updateActiveVideoDraft({ titleHook: e.target.value })}
                      placeholder={
                        videoPreviewTab === 'idea_list'
                          ? '例: 社長が現場から抜けるための仕組み化ショート動画シリーズ'
                          : '例: 「社長が忙しすぎる会社に共通する3つの落とし穴」'
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900">
                        {activeVideoConfig?.name} 本文（直接入力・手動調整OK）
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeVideoDraft.scriptBody);
                          setCopiedKey(`video_body_${videoPreviewTab}`);
                          setTimeout(() => setCopiedKey(null), 2000);
                        }}
                        disabled={!activeVideoDraft.scriptBody.trim()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer disabled:opacity-40"
                      >
                        {copiedKey === `video_body_${videoPreviewTab}` ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>構成・台本のみコピー</span>
                      </button>
                    </div>
                    <textarea
                      rows={11}
                      value={activeVideoDraft.scriptBody}
                      onChange={(e) => updateActiveVideoDraft({ scriptBody: e.target.value })}
                      placeholder={`ここに${activeVideoConfig?.name || '動画構成案'}を直接入力するか、左側の「🎬 選んだ情報・戦略から動画構成・アイデアを作成」を押してください。`}
                      className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 leading-relaxed focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        映像・テロップ・サムネイル案メモ
                      </label>
                      <textarea
                        rows={2}
                        value={activeVideoDraft.visualNotes}
                        onChange={(e) => updateActiveVideoDraft({ visualNotes: e.target.value })}
                        placeholder="例: 白板で図解しながら撮影／冒頭に大きく赤文字でテロップ表示"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        締めの誘導セリフ（CTA）
                      </label>
                      <textarea
                        rows={2}
                        value={activeVideoDraft.ctaLine}
                        onChange={(e) => updateActiveVideoDraft({ ctaLine: e.target.value })}
                        placeholder="例: 「3分で会社の課題がわかる無料診断は概要欄のリンクからどうぞ！」"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SNS投稿キャプション & サムネイル画像AI指示文 */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-3">
                  <p className="text-[11px] font-bold text-blue-800">投稿・画像セット</p>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600">SNS投稿キャプション（動画に添えるテキスト）</label>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(activeVideoDraft.captionText || ''); setCopiedKey('video_caption'); setTimeout(() => setCopiedKey(null), 2000); }}
                        disabled={!activeVideoDraft.captionText?.trim()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] text-slate-600 font-semibold transition disabled:opacity-40"
                      >
                        {copiedKey === 'video_caption' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        コピー
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={activeVideoDraft.captionText || ''}
                      onChange={(e) => updateActiveVideoDraft({ captionText: e.target.value })}
                      placeholder="例: 社長が全部やる会社に共通する落とし穴3つ📌 仕組み化で残業ゼロになった事例を公開中。#業務改善 #中小企業経営"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600">サムネイル画像AI指示文（ChatGPT / Midjourneyへ貼り付け）</label>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(activeVideoDraft.imagePrompt || ''); setCopiedKey('video_imgprompt'); setTimeout(() => setCopiedKey(null), 2000); }}
                        disabled={!activeVideoDraft.imagePrompt?.trim()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] text-slate-600 font-semibold transition disabled:opacity-40"
                      >
                        {copiedKey === 'video_imgprompt' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        コピー
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={activeVideoDraft.imagePrompt || ''}
                      onChange={(e) => updateActiveVideoDraft({ imagePrompt: e.target.value })}
                      placeholder="例: A clean professional thumbnail with bold red text saying '社長が知らない落とし穴3つ', blue gradient background, Japanese business style"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 動画向けAIブラッシュアップバー */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-purple-900 mr-1 flex items-center gap-1">
                      <Wand2 className="h-3.5 w-3.5 text-purple-600" />
                      <span>AI手直し:</span>
                    </span>
                    {[
                      '冒頭3秒のフックを強く',
                      'もっと短く（30秒版）',
                      'そのまま読める話し言葉・セリフ調に',
                      '別切り口で企画を5本追加',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={aiRefining || (!activeVideoDraft.scriptBody.trim() && !activeVideoDraft.titleHook.trim())}
                        onClick={() => void handleAiRefineVideo(preset)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 hover:bg-purple-100 text-[11px] font-semibold text-purple-800 transition cursor-pointer disabled:opacity-40"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={videoRefineInstruction}
                      onChange={(e) => setVideoRefineInstruction(e.target.value)}
                      placeholder="自由指示（例: 介護事業所の施設長向けに具体例を書き換えて）"
                      className="flex-1 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={
                        aiRefining ||
                        (!activeVideoDraft.scriptBody.trim() && !activeVideoDraft.titleHook.trim()) ||
                        !videoRefineInstruction.trim()
                      }
                      onClick={() => void handleAiRefineVideo()}
                      className="shrink-0 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer disabled:opacity-40"
                    >
                      {aiRefining ? '修正中…' : 'AIで書き直す'}
                    </button>
                  </div>
                </div>

                {/* 動画構成アクション */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={!activeVideoDraft.scriptBody.trim() && !activeVideoDraft.titleHook.trim()}
                    onClick={handleCopyVideoDraft}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 transition cursor-pointer disabled:opacity-40"
                  >
                    {copiedKey === `video_${videoPreviewTab}` ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                    )}
                    <span>{copiedKey === `video_${videoPreviewTab}` ? 'コピー済み' : '動画構成・台本を一括コピー'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      (!activeVideoDraft.scriptBody.trim() && !activeVideoDraft.titleHook.trim()) ||
                      savingVideoFormat === videoPreviewTab
                    }
                    onClick={() => void handleSaveVideoToLibrary()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-40"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>{savingVideoFormat === videoPreviewTab ? '保存中…' : '資料・成果物保管庫に保存'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── モード2: 営業DMテンプレート（作成・AI調整・保管） ── */}
      {studioMode === 'dm_templates' && (
        <SocialDmSalesStudio mode="all" onNavigateTab={onNavigateTab} />
      )}
    </div>
  );
};
