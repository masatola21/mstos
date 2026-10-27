import React, { useState, useEffect, useRef } from 'react';
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
  Play
} from 'lucide-react';
import { OfficialLinkItem } from '../../types/marketing';
import { loadStoredOfficialLinks } from '../../utils/marketingStorage';
import { getSupabase } from '../../lib/supabaseClient';
import { fetchMarketingAssets, getAssetViewUrl, MarketingAsset } from '../../services/marketingAssetService';

interface SocialPlatformConfig {
  id: 'facebook' | 'threads' | 'linkedin' | 'instagram' | 'x';
  name: string;
  badge: string;
  badgeColor: string;
  maxChars?: number;
  requiresImage?: boolean;
  description: string;
}

const PLATFORMS: SocialPlatformConfig[] = [
  {
    id: 'facebook',
    name: 'Facebook ページ',
    badge: '公式API / Webhook (動画対応)',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: '法人ページへテキスト・画像・動画を自動投稿',
  },
  {
    id: 'threads',
    name: 'Threads',
    badge: '公式API / Webhook (動画対応)',
    badgeColor: 'bg-zinc-500/20 text-zinc-200 border-zinc-500/30',
    maxChars: 500,
    description: '最大500文字のテキスト・画像・動画を自動投稿',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    badge: '公式API / Webhook',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    maxChars: 3000,
    description: '経営層・BtoB向けにビジネス知見や案内を自動投稿',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    badge: '公式API / Webhook (画像・動画Reels対応)',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    maxChars: 2200,
    requiresImage: true,
    description: 'フィード画像またはReels動画＋キャプション投稿（※メディア添付必須）',
  },
  {
    id: 'x',
    name: 'X (旧Twitter)',
    badge: 'ワンクリック即時シェア (API代0円)',
    badgeColor: 'bg-slate-700/50 text-slate-300 border-slate-600',
    maxChars: 140,
    description: 'API課金なしで文面入力済みのポスト画面を即時オープン',
  },
];

interface BroadcastHistoryItem {
  id: string;
  text: string;
  imageUrl?: string;
  platforms: string[];
  sentAt: string;
  status: 'sent' | 'partial' | 'draft';
}

const STORAGE_SETTINGS_KEY = 'mst_social_broadcast_settings_v1';
const STORAGE_HISTORY_KEY = 'mst_social_broadcast_history_v1';

export const SocialMediaBroadcastStudio: React.FC = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mstos.app';

  // フォーム状態
  const [postText, setPostText] = useState('');
  const [imageUrl, setImageUrl] = useState(''); // 画像または動画のURL
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [imageSourceMode, setImageSourceMode] = useState<'upload' | 'library' | 'url'>('upload');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 成果物保管庫（メディアライブラリ）モーダル状態
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<MarketingAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // プラットフォーム＆プレビュー
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook', 'threads', 'linkedin']);
  const [previewTab, setPreviewTab] = useState<'threads' | 'facebook' | 'linkedin' | 'instagram' | 'x'>('threads');

  // 公式URLハブからのリンク取得
  const [officialLinks, setOfficialLinks] = useState<OfficialLinkItem[]>([]);
  const [isLinkPickerOpen, setIsLinkPickerOpen] = useState(false);

  // 連携設定
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [metaPageToken, setMetaPageToken] = useState('');
  const [metaPageId, setMetaPageId] = useState('');
  const [threadsToken, setThreadsToken] = useState('');
  const [threadsUserId, setThreadsUserId] = useState('');
  const [linkedInToken, setLinkedInToken] = useState('');

  // 実行状態
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);

  // 初期読み込み
  useEffect(() => {
    // 公式リンク取得
    const stored = loadStoredOfficialLinks();
    if (stored && stored.length > 0) {
      setOfficialLinks(stored);
    }

    // 連携設定読み込み
    try {
      const rawSettings = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.webhookUrl) setWebhookUrl(parsed.webhookUrl);
        if (parsed.metaPageToken) setMetaPageToken(parsed.metaPageToken);
        if (parsed.metaPageId) setMetaPageId(parsed.metaPageId);
        if (parsed.threadsToken) setThreadsToken(parsed.threadsToken);
        if (parsed.threadsUserId) setThreadsUserId(parsed.threadsUserId);
        if (parsed.linkedInToken) setLinkedInToken(parsed.linkedInToken);
      }
    } catch (e) {
      console.warn('Failed to load social broadcast settings:', e);
    }

    // 履歴読み込み
    try {
      const rawHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (rawHistory) {
        setHistory(JSON.parse(rawHistory));
      }
    } catch (e) {
      console.warn('Failed to load social broadcast history:', e);
    }
  }, []);

  // 連携設定の保存
  const saveSettings = () => {
    try {
      localStorage.setItem(
        STORAGE_SETTINGS_KEY,
        JSON.stringify({
          webhookUrl,
          metaPageToken,
          metaPageId,
          threadsToken,
          threadsUserId,
          linkedInToken,
        })
      );
      setFeedback({ type: 'success', message: 'SNS連携設定を保存しました。' });
      setTimeout(() => setFeedback(null), 3000);
      setIsSettingsOpen(false);
    } catch {
      setFeedback({ type: 'error', message: '設定の保存に失敗しました。' });
    }
  };

  // プラットフォーム選択トグル
  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // 公式URLハブのURL挿入（媒体別UTMパラメータを自動付加）
  const insertOfficialLink = (link: OfficialLinkItem) => {
    let cleanUrl = link.url.trim();
    if (cleanUrl.startsWith('/')) {
      cleanUrl = `${origin}${cleanUrl}`;
    }
    const sep = cleanUrl.includes('?') ? '&' : '?';
    const utmUrl = `${cleanUrl}${sep}utm_source=social_multicast&utm_campaign=sns_broadcast`;
    setPostText((prev) => (prev ? `${prev}\n\n▼ ${link.title}\n${utmUrl}` : `${link.title}\n${utmUrl}`));
    setIsLinkPickerOpen(false);
    setFeedback({ type: 'info', message: `「${link.title}」の公式URL（UTM追跡付き）を挿入しました。` });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ── メディア（画像・動画）アップロード処理 ──
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      setFeedback({
        type: 'error',
        message: '画像ファイル（JPG, PNG, WEBP, GIF等）または動画ファイル（MP4, MOV, WEBM等）を選択してください。',
      });
      return;
    }

    const maxBytes = isVideo ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFeedback({
        type: 'error',
        message: isVideo
          ? '動画サイズは50MB以下にしてください（リール・ショート動画推奨）。'
          : '画像サイズは20MB以下にしてください。',
      });
      return;
    }

    setIsUploading(true);
    setFeedback({
      type: 'info',
      message: `「${file.name}」をアップロードして${isVideo ? '動画' : '画像'}配信用URLを生成中…`,
    });

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/marketing/upload-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: file.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'メディアのアップロードに失敗しました。');

      setImageUrl(data.url);
      setMediaType(data.mediaType || (isVideo ? 'video' : 'image'));
      setUploadedFileName(file.name);
      setFeedback({
        type: 'success',
        message: isVideo
          ? `🎬 動画「${file.name}」のアップロードが完了し、リール・動画配信用URLがセットされました！`
          : `画像「${file.name}」のアップロードが完了し、SNS配信URLがセットされました！`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'アップロード処理に失敗しました。' });
    } finally {
      setIsUploading(false);
    }
  };

  // 成果物保管庫のメディア（画像・動画）一覧を開く
  const handleOpenLibrary = async () => {
    setIsLibraryModalOpen(true);
    setLibraryLoading(true);
    try {
      const result = await fetchMarketingAssets();
      const mediaOnly = result.assets.filter(
        (a) =>
          a.asset_type === 'image' ||
          a.asset_type === 'video' ||
          a.mime_type?.startsWith('image/') ||
          a.mime_type?.startsWith('video/') ||
          (a.external_url && a.external_url.match(/\.(jpg|jpeg|png|webp|gif|mp4|mov|webm)/i))
      );
      setLibraryAssets(mediaOnly);
    } catch (err) {
      console.warn('Could not load library assets:', err);
    } finally {
      setLibraryLoading(false);
    }
  };

  // 成果物保管庫から選択
  const selectLibraryAsset = async (asset: MarketingAsset) => {
    try {
      const url = await getAssetViewUrl(asset);
      if (url) {
        setImageUrl(url);
        const isVid =
          asset.asset_type === 'video' ||
          asset.mime_type?.startsWith('video/') ||
          /\.(mp4|mov|webm)/i.test(url);
        setMediaType(isVid ? 'video' : 'image');
        setUploadedFileName(asset.title);
        setIsLibraryModalOpen(false);
        setFeedback({
          type: 'success',
          message: `成果物「${asset.title}」を${isVid ? '投稿動画' : '投稿画像'}にセットしました。`,
        });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'メディアの取得に失敗しました。' });
    }
  };

  // AIでSNS文面をブラッシュアップ
  const handleAIAssist = async () => {
    if (!postText.trim() || aiGenerating) return;
    setAiGenerating(true);
    setFeedback({ type: 'info', message: '社内AIが各SNSに刺さる文面にブラッシュアップ中…' });

    try {
      const prompt = `以下の文章をもとに、Facebook・Threads・LinkedIn・Instagramで反響が出やすいSNS投稿文を作成してください。
要件:
1. 冒頭1〜2行で読者の注意を引くフック（問題提起や意外な事実）
2. 読みやすい改行・箇条書き
3. CTA（診断や個別相談への誘導）
4. 末尾に関連ハッシュタグ（3〜5個）
5. 誇大広告や根拠のない数値を捏造しないこと

【元の文章】:
${postText}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          workModeId: 'marketing_execution',
          character: {
            name: 'SNSマーケティング責任者',
            role: 'マルチSNSコンテンツ制作',
            personality: '簡潔で心に刺さるフックを作り、ビジネス価値を明快に伝える',
            tone: 'プロフェッショナルで信頼感がある',
          },
          stream: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI生成に失敗しました。');

      setPostText(data.text.trim());
      setFeedback({ type: 'success', message: 'AIによるSNS最適化文面を入力欄に反映しました！' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'AI生成エラーが発生しました。' });
    } finally {
      setAiGenerating(false);
    }
  };

  // X（旧Twitter）ワンクリック投稿
  const openXIntent = () => {
    const text = encodeURIComponent(postText);
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Facebookワンクリック共有
  const openFacebookShare = () => {
    const quote = encodeURIComponent(postText);
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${quote}&u=${encodeURIComponent(origin)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // LinkedInワンクリック共有
  const openLinkedInShare = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(origin)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Threadsワンクリック起動
  const openThreadsShare = () => {
    const text = encodeURIComponent(postText);
    const url = `https://threads.net/intent/post?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 一括送信処理（Webhook / API / Web連携）
  const handleBroadcast = async () => {
    if (!postText.trim()) {
      setFeedback({ type: 'error', message: '投稿文を入力してください。' });
      return;
    }
    if (selectedPlatforms.length === 0) {
      setFeedback({ type: 'error', message: '少なくとも1つの配信先SNSを選択してください。' });
      return;
    }

    const isVid = mediaType === 'video' || /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(imageUrl.trim());
    if (selectedPlatforms.includes('instagram') && !imageUrl.trim()) {
      setFeedback({
        type: 'error',
        message: 'Instagramへの投稿には画像または動画（リール）の添付が必須です。ファイルをアップロードするかURLを指定してください。',
      });
      return;
    }

    setSending(true);
    setFeedback({ type: 'info', message: '選択したSNSへ一括配信リクエストを送信中…' });

    try {
      const response = await fetch('/api/marketing/social-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: postText,
          imageUrl: imageUrl.trim() || undefined,
          mediaUrl: imageUrl.trim() || undefined,
          mediaType: isVid ? 'video' : (imageUrl.trim() ? 'image' : null),
          platforms: selectedPlatforms,
          webhookUrl: webhookUrl.trim() || undefined,
          metaPageToken: metaPageToken.trim() || undefined,
          metaPageId: metaPageId.trim() || undefined,
          threadsToken: threadsToken.trim() || undefined,
          threadsUserId: threadsUserId.trim() || undefined,
          linkedInToken: linkedInToken.trim() || undefined,
        }),
      });

      const resData = await response.json();

      if (!response.ok && !resData.success) {
        if (resData.requiresConfig) {
          setFeedback({
            type: 'info',
            message: 'WebhookまたはAPIキーが未設定のため、下の「個別Web共有」ボタンからワンクリックで直接各SNSを開いて投稿できます。完全自動化する場合は右上の「⚙️ 連携設定」からWebhook URLを設定してください。',
          });
          setSending(false);
          return;
        }
        throw new Error(resData.error || '配信処理中にエラーが発生しました。');
      }

      // 履歴保存
      const newHistoryItem: BroadcastHistoryItem = {
        id: `broadcast_${Date.now()}`,
        text: postText,
        imageUrl: imageUrl.trim() || undefined,
        platforms: [...selectedPlatforms],
        sentAt: new Date().toISOString(),
        status: 'sent',
      };
      const updatedHistory = [newHistoryItem, ...history.slice(0, 19)];
      setHistory(updatedHistory);
      try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch {}

      // Supabaseへの成果物・施策記録同期
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth?.user) {
            await supabase.from('mst_ai_acquisition_records').insert({
              user_id: auth.user.id,
              id: `social_broadcast_${Date.now()}`,
              record_type: 'social',
              title: `一括同時投稿 (${selectedPlatforms.join(', ')})`,
              status: '公開済み',
              payload: {
                content: postText,
                assetUrl: imageUrl,
                platform: selectedPlatforms.join('|'),
                publishedUrl: origin,
                publishDate: new Date().toISOString().slice(0, 10),
              },
            });
          }
        }
      } catch (dbErr) {
        console.warn('Could not record social broadcast to DB:', dbErr);
      }

      setFeedback({
        type: 'success',
        message: `🎉 Facebook・Threads・LinkedIn等の選択したSNSへ一括配信が完了しました！`,
      });

      // もしXが含まれていたら、X投稿画面も開く案内
      if (selectedPlatforms.includes('x')) {
        openXIntent();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '一括送信に失敗しました。' });
    } finally {
      setSending(false);
    }
  };

  // 文字数判定
  const textLength = postText.length;
  const isOverThreads = textLength > 500;
  const isOverX = textLength > 140;

  return (
    <div className="space-y-6 text-slate-100">
      {/* ── ヘッダー ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">📱 SNS一括投稿スタジオ</h2>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
              マルチ同時配信
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Facebook、Threads、LinkedIn、Instagramへの一括同時配信と、X（Twitter）へのワンクリック即時シェアを行える統合管制スタジオです。
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
        >
          <Settings className="h-3.5 w-3.5 text-indigo-400" />
          {isSettingsOpen ? '設定パネルを閉じる' : '⚙️ API・Webhook連携設定'}
        </button>
      </div>

      {/* ── フィードバックバナー ── */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs shadow-md animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200'
              : feedback.type === 'error'
              ? 'border-rose-500/40 bg-rose-950/60 text-rose-200'
              : 'border-indigo-500/40 bg-indigo-950/60 text-indigo-200'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
          {feedback.type === 'error' && <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
          {feedback.type === 'info' && <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />}
          <div className="font-medium leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* ── 連携設定アコーディオン ── */}
      {isSettingsOpen && (
        <div className="rounded-2xl border border-indigo-500/40 bg-slate-900/95 p-5 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-indigo-400" />
                SNS自動配信の接続設定
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Make（旧Integromat）やZapierのWebhookを使うと、アプリ審査なしで今すぐ全SNSへの一括自動投稿が稼働します。
              </p>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
            >
              設定を保存
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* 方式1: Webhook連携（超おすすめ） */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>推奨: Webhook連携（Make / Zapier / n8n）</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                MakeやZapierで「Custom Webhook」を作成し、Facebook・Threads・LinkedIn・Instagramへの投稿モジュールを繋げるだけで、OSからの一括投稿が即座に完了します。
              </p>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hook.eu1.make.com/xxxxxxxxxxxx または Zapier Webhook"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-white text-[11px] focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 方式2: 直接API連携 */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 space-y-2">
              <div className="text-slate-300 font-bold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span>直接APIトークン設定（上級者向け）</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Meta Graph API / LinkedIn Developerのアクセストークンを直接登録して通信する場合に入力します。
              </p>
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-slate-400 block text-[10px]">Facebook Page Access Token & Page ID</label>
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <input
                      type="password"
                      value={metaPageToken}
                      onChange={(e) => setMetaPageToken(e.target.value)}
                      placeholder="Page Access Token"
                      className="rounded border border-slate-800 bg-slate-900 p-1.5 text-white text-[10px]"
                    />
                    <input
                      type="text"
                      value={metaPageId}
                      onChange={(e) => setMetaPageId(e.target.value)}
                      placeholder="Page ID"
                      className="rounded border border-slate-800 bg-slate-900 p-1.5 text-white text-[10px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">Threads User ID & Access Token</label>
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <input
                      type="password"
                      value={threadsToken}
                      onChange={(e) => setThreadsToken(e.target.value)}
                      placeholder="Threads Token"
                      className="rounded border border-slate-800 bg-slate-900 p-1.5 text-white text-[10px]"
                    />
                    <input
                      type="text"
                      value={threadsUserId}
                      onChange={(e) => setThreadsUserId(e.target.value)}
                      placeholder="Threads User ID"
                      className="rounded border border-slate-800 bg-slate-900 p-1.5 text-white text-[10px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">LinkedIn OAuth Access Token</label>
                  <input
                    type="password"
                    value={linkedInToken}
                    onChange={(e) => setLinkedInToken(e.target.value)}
                    placeholder="Bearer Token"
                    className="w-full mt-0.5 rounded border border-slate-800 bg-slate-900 p-1.5 text-white text-[10px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── メインエディタ & プレビューの2ペインレイアウト ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 左側: 投稿作成ペイン (7カラム) */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. 配信先プラットフォーム選択 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-indigo-400" />
                一括配信先のSNSを選択
              </label>
              <div className="text-[11px] text-slate-400">
                選択中: <span className="font-bold text-indigo-300">{selectedPlatforms.length}</span> 媒体
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLATFORMS.map((plat) => {
                const isSelected = selectedPlatforms.includes(plat.id);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => togglePlatform(plat.id)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs">{plat.name}</span>
                      <span
                        className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 line-clamp-1">{plat.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 本文エディタ */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-cyan-400" />
                投稿文（全SNS共通）
              </label>

              {/* 補助アクションボタン群 */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkPickerOpen(!isLinkPickerOpen)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] text-indigo-300 font-semibold transition"
                  title="先ほど設定した公式URLハブのリンクを本文に挿入"
                >
                  <Link2 className="h-3 w-3" />
                  公式URLを挿入
                </button>
                <button
                  type="button"
                  disabled={!postText.trim() || aiGenerating}
                  onClick={handleAIAssist}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 hover:bg-violet-500 px-2.5 py-1 text-[11px] font-bold text-white transition disabled:opacity-40"
                  title="AIがSNS向けのフック・要約・CTA・ハッシュタグを作成"
                >
                  <Sparkles className="h-3 w-3" />
                  {aiGenerating ? 'AI作成中…' : 'AI文章アシスト'}
                </button>
              </div>
            </div>

            {/* 公式リンク選択ドロップダウン */}
            {isLinkPickerOpen && (
              <div className="rounded-xl border border-indigo-500/40 bg-slate-950 p-3 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-indigo-300">挿入する公式URLを選択（UTM追跡タグ自動付与）:</span>
                  <button
                    type="button"
                    onClick={() => setIsLinkPickerOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {officialLinks.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => insertOfficialLink(item)}
                      className="text-left p-2 rounded-lg border border-slate-800 bg-slate-900 hover:border-indigo-500/60 hover:bg-slate-800 transition"
                    >
                      <div className="text-xs font-bold text-white truncate">{item.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{item.url}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <textarea
                rows={7}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="【業務の仕組み化で利益を残す実践ノウハウ】&#10;&#10;経営者が現場の作業に追われ続ける最大の原因は…&#10;&#10;▼ 3分無料ボトルネック診断はこちら&#10;https://..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white leading-relaxed placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* 文字数カウンター＆各SNS許容状況 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] border-t border-slate-800/80">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">
                  文字数: <strong className="text-white font-mono">{textLength}</strong> 文字
                </span>
                <span className={`inline-flex items-center gap-1 ${isOverThreads ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                  Threads (500字): {isOverThreads ? `超過 +${textLength - 500}` : 'OK'}
                </span>
                <span className={`inline-flex items-center gap-1 ${isOverX ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                  X (140字): {isOverX ? `長文 (${textLength}字)` : 'OK'}
                </span>
              </div>

              {/* クイックハッシュタグ */}
              <div className="flex items-center gap-1">
                {['#業務改善', '#AI集客', '#経営者', '#仕組み化'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setPostText((prev) => `${prev} ${tag}`)}
                    className="text-[10px] text-slate-400 hover:text-indigo-300 font-mono"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. メディア添付（画像・ショート動画・リール対応: ファイル直接アップロード / 成果物保管庫 / URL指定） */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-purple-400" />
                添付メディア（画像・ショート動画/リール対応）
              </label>

              {/* Instagram用アラート/完了バッジ */}
              {selectedPlatforms.includes('instagram') && (
                imageUrl ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {mediaType === 'video' || /\.(mp4|mov|webm|m4v)/i.test(imageUrl)
                      ? 'Instagram Reels動画セット完了'
                      : 'Instagram画像セット完了'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                    ※ Instagram配信には画像または動画（Reels）添付が必須です
                  </span>
                )
              )}
            </div>

            {/* モード切替タブ */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setImageSourceMode('upload')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
                  imageSourceMode === 'upload'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                PC・スマホから選択 (画像 / 動画)
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageSourceMode('library');
                  void handleOpenLibrary();
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
                  imageSourceMode === 'library'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                成果物保管庫から選ぶ
              </button>
              <button
                type="button"
                onClick={() => setImageSourceMode('url')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
                  imageSourceMode === 'url'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" />
                URL直接指定
              </button>
            </div>

            {/* モード①: 直接ファイル選択 / ドラッグ＆ドロップ */}
            {imageSourceMode === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/webm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                    isDragOver
                      ? 'border-indigo-400 bg-indigo-950/40'
                      : 'border-slate-700 bg-slate-950/60 hover:border-indigo-500 hover:bg-slate-950'
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 py-2 text-indigo-300">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs font-semibold">メディアをアップロード中…</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                          <Video className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-white">クリックして画像または動画（MP4/MOV）を選択</span>
                        <span className="text-xs text-slate-400"> またはここにドラッグ＆ドロップ</span>
                      </div>
                      <p className="text-[10px] text-slate-500 text-center max-w-md">
                        画像（JPG/PNG/WEBP 最大20MB） / 動画（MP4/MOV 最大50MB リール・ショート動画対応）<br />
                        自動で公開HTTPS URLに変換され各SNSへ配信されます
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* モード②: 成果物保管庫からの選択ボタン */}
            {imageSourceMode === 'library' && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-white block">成果物保管庫（画像・動画素材ライブラリ）</span>
                  <span className="text-[11px] text-slate-400">
                    過去に登録・保管されたバナー画像やショート動画素材を1クリックで投稿にセットできます。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenLibrary}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition shrink-0"
                >
                  保管庫の一覧を開く
                </button>
              </div>
            )}

            {/* モード③: URL直接指定 */}
            {imageSourceMode === 'url' && (
              <div>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setImageUrl(val);
                    setUploadedFileName('');
                    const isVid = /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(val);
                    setMediaType(isVid ? 'video' : (val ? 'image' : null));
                  }}
                  placeholder="https://... 画像URL または MP4/MOV動画URL"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {/* 選択済みメディアのプレビュー・削除 */}
            {imageUrl && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-white truncate">
                      {uploadedFileName || (mediaType === 'video' ? 'セットされた動画' : 'セットされた画像')}
                    </span>
                    {(mediaType === 'video' || /\.(mp4|mov|webm|m4v)/i.test(imageUrl)) && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 border border-purple-500/30 flex items-center gap-0.5">
                        <Play className="h-2.5 w-2.5" /> 動画 (Reels/Video)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl('');
                      setMediaType(null);
                      setUploadedFileName('');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    <Trash2 className="h-3 w-3" /> メディアを取り消す
                  </button>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900 max-h-52 flex items-center justify-center">
                  {mediaType === 'video' || /\.(mp4|mov|webm|m4v)/i.test(imageUrl) ? (
                    <video src={imageUrl} controls className="max-h-48 w-full object-contain bg-black rounded" />
                  ) : (
                    <img src={imageUrl} alt="添付メディアプレビュー" className="max-h-40 object-contain rounded" />
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  SNS配信用URL: {imageUrl}
                </div>
              </div>
            )}
          </div>

          {/* 4. アクションボタン群 */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={sending || !postText.trim()}
              onClick={handleBroadcast}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 p-3.5 text-sm font-bold text-white shadow-xl transition disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? '選択SNSへ一括配信中…' : '🚀 選択したSNSへ一括同時投稿する'}
            </button>

            {/* 個別ワンクリック共有バー（API不要で即時使えるバックアップ） */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>ワンクリック直接シェア（APIキー不要・今すぐ投稿画面を開く）:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!postText.trim()}
                  onClick={openXIntent}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                >
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                  X (Twitter) でポスト
                </button>
                <button
                  type="button"
                  disabled={!postText.trim()}
                  onClick={openThreadsShare}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
                >
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                  Threadsで開く
                </button>
                <button
                  type="button"
                  disabled={!postText.trim()}
                  onClick={openFacebookShare}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-blue-300 transition disabled:opacity-40"
                >
                  <ExternalLink className="h-3 w-3 text-blue-400" />
                  Facebookでシェア
                </button>
                <button
                  type="button"
                  disabled={!postText.trim()}
                  onClick={openLinkedInShare}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-sky-300 transition disabled:opacity-40"
                >
                  <ExternalLink className="h-3 w-3 text-sky-400" />
                  LinkedInで共有
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 右側: リアルタイム・プレビューペイン (5カラム) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                <span>各SNSライブプレビュー</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Real-time Preview</span>
            </div>

            {/* プレビュー切り替えタブ */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {[
                { id: 'threads', label: 'Threads' },
                { id: 'facebook', label: 'Facebook' },
                { id: 'linkedin', label: 'LinkedIn' },
                { id: 'instagram', label: 'Instagram' },
                { id: 'x', label: 'X (Twitter)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewTab(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                    previewTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* プレビュー表示コンテナ */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 min-h-[320px] flex flex-col justify-between">
              {/* アカウントヘッダー */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow">
                  MST
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white truncate">有限会社MST / 大橋真人</span>
                    <span className="text-[10px] text-indigo-400">✔︎</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {previewTab === 'threads' && '@mst_management · Threads'}
                    {previewTab === 'facebook' && '公式Facebookページ · 公開'}
                    {previewTab === 'linkedin' && '代表取締役 / 仕組み化支援 · 1日前'}
                    {previewTab === 'instagram' && 'mst_official · フィード投稿'}
                    {previewTab === 'x' && '@mst_japan · いま'}
                  </div>
                </div>
              </div>

              {/* 本文 */}
              <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap flex-1 break-words">
                {postText || (
                  <span className="text-slate-600 italic">
                    左側の入力欄に投稿文を入力すると、各SNSのカードレイアウトでリアルタイムにプレビューが表示されます。
                  </span>
                )}
              </div>

              {/* メディアプレビュー（画像または動画） */}
              {imageUrl && (
                mediaType === 'video' || /\.(mp4|mov|webm|m4v)/i.test(imageUrl) ? (
                  <div className="mt-3 relative rounded-lg overflow-hidden border border-slate-800 max-h-60 bg-black flex items-center justify-center">
                    <video src={imageUrl} controls className="max-h-56 w-full object-contain" />
                    <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 pointer-events-none">
                      <Film className="h-3 w-3 text-purple-400" />
                      {previewTab === 'instagram' ? 'Instagram Reels / 動画' : previewTab === 'threads' ? 'Threads Video' : 'Video Post'}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg overflow-hidden border border-slate-800 max-h-56 bg-slate-900 flex items-center justify-center">
                    <img src={imageUrl} alt="プレビュー画像" className="max-h-52 w-full object-cover" />
                  </div>
                )
              )}

              {/* SNS特有のアクションバー */}
              <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-slate-500 text-[11px]">
                <div className="flex items-center gap-3">
                  <span>❤️ いいね</span>
                  <span>💬 コメント</span>
                  <span>🔁 リポスト</span>
                </div>
                <span>🔗 シェア</span>
              </div>
            </div>
          </div>

          {/* 投稿履歴パネル */}
          {history.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  最近の一括配信履歴
                </span>
                <span className="text-[10px] text-slate-500">{history.length} 件</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 text-xs flex flex-col justify-between gap-1.5 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {h.platforms.map((p) => (
                          <span
                            key={p}
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(h.sentAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">{h.text}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPostText(h.text);
                        if (h.imageUrl) setImageUrl(h.imageUrl);
                        setSelectedPlatforms(h.platforms);
                      }}
                      className="text-left text-[10px] text-indigo-400 hover:underline"
                    >
                      この投稿を再利用する
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 成果物保管庫モーダル ── */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">成果物保管庫から画像を選択</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLibraryModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {libraryLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                <span>保管庫の画像素材を読み込み中…</span>
              </div>
            ) : libraryAssets.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 space-y-2">
                <p>保管庫に画像素材がまだ登録されていません。</p>
                <p className="text-[11px] text-slate-500">
                  左側の「PC・スマホから直接選択」で画像をアップロードするか、「営業資料・成果物保管庫」で画像を登録してください。
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-1">
                {libraryAssets.map((asset) => {
                  const isAssetVideo =
                    asset.asset_type === 'video' ||
                    asset.mime_type?.startsWith('video/') ||
                    (asset.external_url && /\.(mp4|mov|webm)/i.test(asset.external_url));

                  return (
                    <div
                      key={asset.id}
                      onClick={() => void selectLibraryAsset(asset)}
                      className="group rounded-xl border border-slate-800 bg-slate-950 p-2.5 flex flex-col justify-between gap-2 cursor-pointer hover:border-indigo-500 hover:bg-indigo-950/20 transition shadow-sm"
                    >
                      <div className="relative h-28 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800">
                        {isAssetVideo ? (
                          <div className="flex flex-col items-center justify-center gap-1 text-purple-400">
                            <Video className="h-8 w-8" />
                            <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded border border-purple-500/30">
                              動画
                            </span>
                          </div>
                        ) : asset.external_url ? (
                          <img
                            src={asset.external_url}
                            alt={asset.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-slate-600 group-hover:text-indigo-400 transition" />
                        )}
                        {isAssetVideo && (
                          <div className="absolute bottom-1 right-1 bg-black/80 rounded px-1.5 py-0.5 text-[9px] text-white flex items-center gap-0.5">
                            <Play className="h-2 w-2" /> 動画
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-white truncate">{asset.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(asset.created_at).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsLibraryModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
