import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Download,
  ExternalLink,
  Film,
  Filter,
  Globe,
  Image as ImageIcon,
  FileText,
  Link2,
  Plus,
  Search,
  Trash2,
  Upload,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Video,
  FileUp,
  Zap,
  RefreshCw,
  Copy,
  Check,
  Save,
} from 'lucide-react';
import {
  AssetStatus,
  AssetType,
  ASSET_STATUSES,
  ASSET_TYPES,
  createMarketingAsset,
  deleteMarketingAsset,
  fetchMarketingAssets,
  getAssetViewUrl,
  MarketingAsset,
  updateMarketingAssetStatus,
} from '../../services/marketingAssetService';
import { MigrationAlertBanner } from './MigrationAlertBanner';

type MarketingRecord = {
  id: string;
  record_type: string;
  title: string;
  product_id: string | null;
  status: string | null;
  payload: Record<string, string>;
  created_at?: string;
  updated_at: string;
};

type Product = { id: string; product_name: string };

const inputClass = 'mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white';

function detectAssetTypeFromFile(fileName: string): AssetType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(ext)) return 'document';
  if (['html', 'htm'].includes(ext)) return 'landing_page';
  if (['txt', 'md'].includes(ext)) return 'draft';
  return 'document';
}

function detectAssetTypeFromUrl(url: string): AssetType {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com') || lower.includes('tiktok.com')) return 'video';
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com') || lower.includes('notion.so') || lower.includes('dropbox.com')) return 'document';
  if (lower.includes('/lp') || lower.includes('lp.') || lower.includes('landing')) return 'landing_page';
  if (lower.match(/\.(jpg|jpeg|png|webp|gif)/i)) return 'image';
  if (lower.match(/\.(mp4|mov|webm)/i)) return 'video';
  return 'website';
}

function cleanFileNameToTitle(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
}

export const MarketingAssetLibrary: React.FC<{
  records: MarketingRecord[];
  products: Product[];
  onOpenRecord: (record: any) => void;
  userId?: string;
}> = ({ records, products, onOpenRecord, userId }) => {
  const strategies = useMemo(() => records.filter((r) => r.record_type === 'strategy'), [records]);
  const operationalRecords = useMemo(
    () => records.filter((r) => ['content', 'social', 'video', 'ad', 'media', 'funnel'].includes(r.record_type)),
    [records]
  );

  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDbReady, setIsDbReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // フィルター & 検索
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // かんたん即時登録（Quick Upload）用ステート
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム用ステート
  const [title, setTitle] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('document');
  const [status, setStatus] = useState<AssetStatus>('published'); // デフォルトで利用中・保管済み
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [strategyRecordId, setStrategyRecordId] = useState('');
  const [toolRecordId, setToolRecordId] = useState('');
  const [productId, setProductId] = useState('');
  const [notes, setNotes] = useState('');

  // ★ 広告コピー（見出し・本文・説明文）AI生成＆入稿保管用ステート
  const [showAdCopyStudio, setShowAdCopyStudio] = useState(false);
  const [adPlatform, setAdPlatform] = useState<'meta' | 'google' | 'x'>('meta');
  const [adProductId, setAdProductId] = useState('');
  const [adTargetAudience, setAdTargetAudience] = useState('');
  const [adAppealPoints, setAdAppealPoints] = useState('');
  const [adGenerating, setAdGenerating] = useState(false);
  const [adGeneratedResult, setAdGeneratedResult] = useState<{
    headlines: string[];
    mainTexts: string[];
    descriptions: string[];
  } | null>(null);
  const [adCopyNotice, setAdCopyNotice] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const updateAdHeadline = (index: number, val: string) => {
    setAdGeneratedResult((prev) => {
      if (!prev) return null;
      const next = [...prev.headlines];
      next[index] = val;
      return { ...prev, headlines: next };
    });
  };

  const updateAdMainText = (index: number, val: string) => {
    setAdGeneratedResult((prev) => {
      if (!prev) return null;
      const next = [...prev.mainTexts];
      next[index] = val;
      return { ...prev, mainTexts: next };
    });
  };

  const updateAdDescription = (index: number, val: string) => {
    setAdGeneratedResult((prev) => {
      if (!prev) return null;
      const next = [...prev.descriptions];
      next[index] = val;
      return { ...prev, descriptions: next };
    });
  };

  const generateAdCopies = async () => {
    setAdGenerating(true);
    setAdCopyNotice('');
    try {
      const selectedProduct = products.find((p) => p.id === adProductId);
      const prompt = [
        `あなたは運用型Web広告（${adPlatform === 'meta' ? 'Meta広告 (Facebook/Instagram)' : adPlatform === 'google' ? 'Google検索・P-MAX広告' : 'X (Twitter) 広告'}）のプロのコピーライターです。`,
        '広告の入稿で実際に使える以下の項目を高品質に考案してください。',
        '必ずJSONオブジェクトのみをコードブロック (```json ... ```) 形式で返してください。',
        '',
        '【案件情報】',
        `- 媒体: ${adPlatform.toUpperCase()}`,
        `- 対象商品: ${selectedProduct?.product_name || '自社商品・サービス'}`,
        `- ターゲット: ${adTargetAudience || '課題を抱える見込み客'}`,
        `- 訴求ポイント・強み: ${adAppealPoints || '実績、短期間、費用対効果、手軽さ'}`,
        '',
        '【JSON出力フォーマット】',
        '{',
        '  "headlines": [',
        '    "見出し1（30文字以内。クリックしたくなる強いフック）",',
        '    "見出し2（30文字以内。数字や実績を明記）",',
        '    "見出し3（30文字以内。読者の悩みに共感）"',
        '  ],',
        '  "mainTexts": [',
        '    "メインテキスト案1（短文〜中文。共感→ベネフィット→CTA）",',
        '    "メインテキスト案2（長文・ストーリー型。なぜ今必要なのかを深掘り）"',
        '  ],',
        '  "descriptions": [',
        '    "説明文案1（リンク直下の補足・安心感を与える文言）",',
        '    "説明文案2（無料相談・特典案内などアクション喚起）"',
        '  ]',
        '}',
      ].join('\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          workModeId: 'marketing_execution',
          character: {
            name: '運用型広告コピーライター',
            role: '広告コピー制作・最適化',
            personality: '売上とCTRに直結するコピーを作るプロ',
            tone: '説得力があり簡潔',
          },
          stream: false,
        }),
      });

      const resData = await response.json();
      if (!response.ok || typeof resData.text !== 'string') {
        throw new Error(resData.error || '広告コピー生成に失敗しました。');
      }

      const cleaned = resData.text.trim().replace(/^`{3}(?:json)?\s*/i, '').replace(/\s*`{3}$/i, '');
      const parsed = JSON.parse(cleaned);

      setAdGeneratedResult({
        headlines: Array.isArray(parsed.headlines) ? parsed.headlines : [],
        mainTexts: Array.isArray(parsed.mainTexts) ? parsed.mainTexts : [],
        descriptions: Array.isArray(parsed.descriptions) ? parsed.descriptions : [],
      });
      setAdCopyNotice('✨ 広告コピー候補を一括生成しました！ワンクリックでコピーまたは保管庫に保存できます。');
    } catch (err: any) {
      console.error(err);
      setError(err.message || '広告コピーの生成に失敗しました。');
    } finally {
      setAdGenerating(false);
    }
  };

  const saveAdCopyAsAsset = async () => {
    if (!adGeneratedResult) return;
    const selectedProduct = products.find((p) => p.id === adProductId);
    const content = [
      `【広告媒体】: ${adPlatform.toUpperCase()}`,
      `【対象商品】: ${selectedProduct?.product_name || '自社商品'}`,
      `【ターゲット】: ${adTargetAudience || '未指定'}`,
      '',
      '■ 見出し候補 (Headlines):',
      ...adGeneratedResult.headlines.map((h, i) => `${i + 1}. ${h}`),
      '',
      '■ メインテキスト (Primary Text):',
      ...adGeneratedResult.mainTexts.map((m, i) => `[パターン ${i + 1}]\n${m}\n`),
      '■ 説明文 (Description):',
      ...adGeneratedResult.descriptions.map((d, i) => `${i + 1}. ${d}`),
    ].join('\n');

    const copyTitle = `${selectedProduct?.product_name || '広告'} - ${adPlatform.toUpperCase()}入稿用コピー`;

    try {
      setSaving(true);
      const res = await createMarketingAsset({
        title: copyTitle,
        asset_type: 'draft',
        status: 'published',
        notes: content,
        product_id: adProductId || undefined,
      }, userId);
      if (res.asset) {
        setNotice(`広告コピー「${copyTitle}」を保管庫に保存しました！`);
        await load();
      } else {
        setError(res.message || '保存に失敗しました。');
      }
    } catch (err: any) {
      setError(err.message || '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await fetchMarketingAssets(userId);
    setAssets(res.assets);
    setIsDbReady(res.isDbReady);
    if (!res.isDbReady && res.errorMessage) {
      setError(res.errorMessage);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [userId]);

  // ファイル選択・ドロップ時の自動反映
  const handleSelectFile = (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setExternalUrl('');
    // ファイル名から素材名を自動生成
    const cleanTitle = cleanFileNameToTitle(selectedFile.name);
    if (!title.trim() || title === '未設定の素材') {
      setTitle(cleanTitle);
    }
    // 分類を自動判定
    const detected = detectAssetTypeFromFile(selectedFile.name);
    setAssetType(detected);
    setStatus('published');
    setError('');
  };

  // URL入力時の自動反映
  const handleUrlInput = (newUrl: string) => {
    setExternalUrl(newUrl);
    setFile(null);
    if (newUrl.trim()) {
      const detected = detectAssetTypeFromUrl(newUrl);
      setAssetType(detected);
      setStatus('published');
      if (!title.trim()) {
        try {
          const parsed = new URL(newUrl);
          if (newUrl.includes('youtube') || newUrl.includes('youtu.be')) {
            setTitle('YouTube動画リンク');
          } else if (newUrl.includes('drive.google') || newUrl.includes('docs.google')) {
            setTitle('Googleドライブ資料リンク');
          } else if (newUrl.includes('/lp') || newUrl.includes('landing')) {
            setTitle(`${parsed.hostname} LPリンク`);
          } else {
            setTitle(`${parsed.hostname} 公式Webサイト`);
          }
        } catch {
          // 入力中の不完全URLは無視
        }
      }
      setError('');
    }
  };

  const resetForm = () => {
    setTitle('');
    setAssetType('document');
    setStatus('published');
    setFile(null);
    setExternalUrl('');
    setStrategyRecordId('');
    setToolRecordId('');
    setProductId('');
    setNotes('');
    setShowAdvanced(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('素材名を入力してください。');
      return;
    }
    const url = externalUrl.trim();
    if (!file && !url) {
      setError('ファイルを選ぶか、HP・LP・素材のURLを入力してください。');
      return;
    }
    if (!file && url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
      } catch {
        setError('URLは http:// または https:// で始まるものを入力してください。');
        return;
      }
    }
    if (file && file.size > 52428800) {
      setError('ファイルは50MB以下にしてください。');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await createMarketingAsset(
        {
          title: title.trim(),
          asset_type: assetType,
          status,
          external_url: url || undefined,
          file: file || null,
          strategy_record_id: strategyRecordId || null,
          tool_record_id: toolRecordId || null,
          product_id: productId || null,
          notes: notes.trim(),
        },
        userId
      );

      setAssets((prev) => [res.asset, ...prev.filter((a) => a.id !== res.asset.id)]);
      setNotice(res.message || '素材・成果物を保管しました。');
      resetForm();
    } catch (err: any) {
      setError('素材情報を保存できませんでした: ' + (err?.message || '不明なエラー'));
    } finally {
      setSaving(false);
    }
  };

  const openAsset = async (asset: MarketingAsset) => {
    const url = await getAssetViewUrl(asset);
    if (!url) {
      setError('ファイルまたはURLを開けませんでした。');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const updateStatus = async (asset: MarketingAsset, nextStatus: AssetStatus) => {
    const res = await updateMarketingAssetStatus(asset, nextStatus);
    if (res.success) {
      setAssets((current) => current.map((item) => (item.id === asset.id ? { ...item, status: nextStatus } : item)));
    } else {
      setError(res.message || '状態を更新できませんでした。');
    }
  };

  const remove = async (asset: MarketingAsset) => {
    if (!window.confirm(`「${asset.title}」を素材一覧から削除しますか？`)) return;
    const res = await deleteMarketingAsset(asset);
    if (res.success) {
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setNotice('削除しました。');
    } else {
      setError(res.message || '素材情報を削除できませんでした。');
    }
  };

  // フィルタリング処理（分類・キーワード検索）
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (selectedTypeFilter !== 'all' && asset.asset_type !== selectedTypeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchTitle = asset.title.toLowerCase().includes(query);
        const matchNotes = asset.notes?.toLowerCase().includes(query);
        const matchUrl = asset.external_url?.toLowerCase().includes(query);
        if (!matchTitle && !matchNotes && !matchUrl) return false;
      }
      return true;
    });
  }, [assets, selectedTypeFilter, searchQuery]);

  const strategyFor = (asset: MarketingAsset) => strategies.find((record) => record.id === asset.strategy_record_id);
  const toolFor = (asset: MarketingAsset) => operationalRecords.find((record) => record.id === asset.tool_record_id);

  return (
    <section className="space-y-4 text-slate-100">
      <header className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-cyan-400" />
              素材・成果物の統合保管ライブラリ
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              各運用タブ（自社メディアHP、動画、SNS、広告、LP、企画）で登録した素材や成果物を横断管理・保管します。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdCopyStudio(!showAdCopyStudio)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/30 transition"
            >
              <Sparkles className="h-4 w-4" />
              {showAdCopyStudio ? '広告コピー生成を閉じる' : '📢 広告コピーAI生成＆入稿スタジオ'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
            >
              再読み込み
            </button>
          </div>
        </div>
      </header>

      {/* ★ 広告コピー（見出し・本文・説明文）AI生成＆入稿スタジオ パネル ★ */}
      {showAdCopyStudio && (
        <section className="rounded-2xl border border-purple-500/40 bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                広告クリエイティブ・コピー作成＆保管スタジオ
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Meta広告やGoogle広告に必要な「見出し・メインテキスト・説明文」の候補をAIが一括生成。保管庫に保存し、ワンクリックで媒体へコピペ入稿できます。
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold">
              Meta / Google広告 入稿対応
            </span>
          </div>

          {/* 媒体タブ & 条件入力 */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">配信媒体</label>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                {(['meta', 'google', 'x'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAdPlatform(p)}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition ${
                      adPlatform === p ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p === 'meta' ? 'Meta広告' : p === 'google' ? 'Google' : 'X広告'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">対象商品・サービス</label>
              <select
                value={adProductId}
                onChange={(e) => setAdProductId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">商品を選択（任意）</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">ターゲット層（任意）</label>
              <input
                value={adTargetAudience}
                onChange={(e) => setAdTargetAudience(e.target.value)}
                placeholder="例: 集客に悩む店舗オーナー、経営者"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">訴求ポイント（任意）</label>
              <input
                value={adAppealPoints}
                onChange={(e) => setAdAppealPoints(e.target.value)}
                placeholder="例: 初期費用0円、導入実績300社、最短1日"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button
              type="button"
              disabled={adGenerating}
              onClick={() => void generateAdCopies()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/30 disabled:opacity-50 transition"
            >
              <Sparkles className="h-4 w-4" />
              {adGenerating ? 'AIが広告コピーを考案中…' : '✨ 広告コピー候補を一括生成する'}
            </button>
            {adCopyNotice && <span className="text-xs font-medium text-emerald-300">{adCopyNotice}</span>}
          </div>

          {/* 生成結果の表示・直接手修正・個別コピー・保存 */}
          {adGeneratedResult && (
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 mt-2">
              <div className="flex items-center justify-between text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
                <span className="flex items-center gap-1.5">
                  ✏️ <strong>直接手修正が可能：</strong> 各候補の入力枠をクリックして自由に加筆・修正できます。編集内容は「コピー」や「成果物保管庫に保存」にそのまま反映されます。
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* 見出し候補 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-300">■ 見出し候補（各30文字目安）</h4>
                    <span className="text-[10px] text-slate-500">Google / Meta</span>
                  </div>
                  <div className="space-y-2.5">
                    {adGeneratedResult.headlines.map((hl, i) => (
                      <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>候補 {i + 1} ({hl.length}文字)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(hl, `headline-${i}`)}
                            className="p-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="この見出しをコピー"
                          >
                            {copiedKey === `headline-${i}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={hl}
                          onChange={(e) => updateAdHeadline(i, e.target.value)}
                          placeholder={`見出し候補 ${i + 1}`}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* メインテキスト */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-300">■ メインテキスト（本文）</h4>
                    <span className="text-[10px] text-slate-500">短文・ストーリー</span>
                  </div>
                  <div className="space-y-2.5">
                    {adGeneratedResult.mainTexts.map((mt, i) => (
                      <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>パターン {i + 1} ({mt.length}文字)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mt, `mainText-${i}`)}
                            className="p-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="この本文をコピー"
                          >
                            {copiedKey === `mainText-${i}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={mt}
                          onChange={(e) => updateAdMainText(i, e.target.value)}
                          placeholder={`本文パターン ${i + 1}`}
                          className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs leading-relaxed text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 説明文 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-300">■ 説明文 / ディスクリプション</h4>
                    <span className="text-[10px] text-slate-500">CTA・リンク直下</span>
                  </div>
                  <div className="space-y-2.5">
                    {adGeneratedResult.descriptions.map((desc, i) => (
                      <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>説明文 {i + 1} ({desc.length}文字)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(desc, `desc-${i}`)}
                            className="p-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="この説明文をコピー"
                          >
                            {copiedKey === `desc-${i}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={desc}
                          onChange={(e) => updateAdDescription(i, e.target.value)}
                          placeholder={`説明文 ${i + 1}`}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 一括操作バー */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    const fullText = [
                      `【${adPlatform.toUpperCase()} 入稿用テキスト】`,
                      '',
                      '■ 見出し:',
                      ...adGeneratedResult.headlines.map((h, i) => `${i + 1}. ${h}`),
                      '',
                      '■ メインテキスト:',
                      ...adGeneratedResult.mainTexts.map((m, i) => `[案 ${i + 1}]\n${m}\n`),
                      '■ 説明文:',
                      ...adGeneratedResult.descriptions.map((d, i) => `${i + 1}. ${d}`),
                    ].join('\n');
                    copyToClipboard(fullText, 'full-text');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                >
                  {copiedKey === 'full-text' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  入稿用全テキストを一括コピー
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveAdCopyAsAsset()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow transition disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? '保存中…' : '💾 この広告コピーセットを成果物保管庫に保存'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* DB未適用バナー（未適用時のみ） */}
      {!isDbReady && (
        <MigrationAlertBanner onRefresh={load} />
      )}

      {(error || notice) && (
        <p
          role={error ? 'alert' : 'status'}
          className={`rounded-lg p-3 text-sm ${
            error ? 'bg-rose-950/50 text-rose-200 border border-rose-800/50' : 'bg-emerald-950/40 text-emerald-200 border border-emerald-800/50'
          }`}
        >
          {error || notice}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* かんたん即時登録フォーム */}
        <form
          onSubmit={(event) => void save(event)}
          className="space-y-4 rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-5 shadow-sm"
        >
          {/* フォームヘッダー */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2 text-base">
                <FileUp className="h-5 w-5 text-cyan-400" />
                素材・成果物を保管（アップロード）
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ① ファイル選択（またはURL入力） → ② 下の【保存する】ボタンでアップロード完了
              </p>
            </div>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
              <Zap className="h-3 w-3" /> かんたん即時保管
            </span>
          </div>

          {/* モード切り替えタブ (ファイル vs URL) */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setUploadMode('file');
                setExternalUrl('');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                uploadMode === 'file'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              ファイルをドラッグ＆ドロップ
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMode('url');
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                uploadMode === 'url'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              URLリンク（HP / LP / 動画等）
            </button>
          </div>

          {/* 入力エリア: ファイルモード */}
          {uploadMode === 'file' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf,text/html,application/zip,.doc,.docx,.ppt,.pptx,.csv,.txt,.xlsx,.xls"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleSelectFile(selected);
                }}
                className="hidden"
              />

              {!file ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) handleSelectFile(dropped);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                    isDragOver
                      ? 'border-cyan-400 bg-cyan-950/40'
                      : 'border-slate-700 bg-slate-950/60 hover:border-cyan-500 hover:bg-slate-950'
                  }`}
                >
                  <div className="h-11 w-11 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold text-white">クリックしてファイルを選択</span>
                    <span className="text-xs text-slate-400"> またはここにドラッグ＆ドロップ</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">
                    画像、動画(MP4/MOV)、PDF、提案書、ZIPなど（最大50MB）<br />
                    ファイル名から素材名と分類を自動判定します
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-white truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-rose-400 p-1 text-xs"
                      title="取り消す"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">自動判定された分類:</span>
                    <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-bold text-cyan-300 border border-cyan-500/30">
                      {ASSET_TYPES.find((t) => t.value === assetType)?.label || assetType}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-cyan-400 hover:underline ml-auto text-[10px]"
                    >
                      ファイルを変更
                    </button>
                  </div>
                  <p className="text-[11px] text-cyan-200 bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-1 rounded text-center">
                    👇 下の【保存する】ボタンを押すと保管庫へのアップロードが完了します
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 入力エリア: URLモード */}
          {uploadMode === 'url' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                HP・LP・動画・オンライン共有URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => handleUrlInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="https://example.com または YouTube/Drive URL"
                />
              </div>
              {externalUrl && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>自動判定分類:</span>
                  <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-bold text-cyan-300 border border-cyan-500/30">
                    {ASSET_TYPES.find((t) => t.value === assetType)?.label || assetType}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 素材名（ファイル名・URLから自動補完されるので確認・微調整するだけ） */}
          <div className="space-y-1">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>
                素材名・用途 <span className="text-rose-400">*</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                （ファイル選択時に自動入力されます）
              </span>
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="例：会社案内パンフレット、商品解説動画、広告バナー案"
            />
          </div>

          {/* メインアクション：アップロード・保存ボタン */}
          {file ? (
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 p-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-950/50 transition-all cursor-pointer ring-2 ring-cyan-400/40"
            >
              <Upload className="h-4 w-4" />
              {saving ? 'ファイルをアップロード中…' : `🚀 「${file.name}」を保管庫に保存する`}
            </button>
          ) : externalUrl.trim() ? (
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 p-3.5 text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
            >
              <Link2 className="h-4 w-4" />
              {saving ? 'URLを保存中…' : '🔗 このURLを保管庫に保存する'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (uploadMode === 'file') {
                  fileInputRef.current?.click();
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cyan-500/40 bg-slate-950/70 hover:border-cyan-400 hover:bg-cyan-950/20 p-3.5 text-xs font-semibold text-cyan-300 transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4 text-cyan-400" />
              <span>ファイルを選択してアップロード（ここをクリック）</span>
            </button>
          )}

          {/* ⚙️ 任意：詳細設定のアコーディオン（戦略・商品紐付け・メモ） */}
          <div className="border-t border-slate-800/80 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-1 text-xs text-slate-400 hover:text-slate-200 transition"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                任意：詳細設定（分類手動変更、集客戦略・商品紐付け、メモ）
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 animate-in fade-in duration-150">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-300">
                    分類の手動指定
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value as AssetType)}
                      className={inputClass}
                    >
                      {ASSET_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs text-slate-300">
                    対象商品（商品マスター）
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">指定しない</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.product_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-300">
                    関連する集客戦略
                    <select
                      value={strategyRecordId}
                      onChange={(e) => setStrategyRecordId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">指定しない</option>
                      {strategies.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs text-slate-300">
                    関連する運用草案・ツール
                    <select
                      value={toolRecordId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setToolRecordId(id);
                        const linked = operationalRecords.find((record) => record.id === id);
                        if (linked?.payload.strategyId) setStrategyRecordId(linked.payload.strategyId);
                      }}
                      className={inputClass}
                    >
                      <option value="">指定しない</option>
                      {operationalRecords.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.title} · {record.record_type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>


                <label className="block text-xs text-slate-300">
                  補足メモ・備考
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                    placeholder="版、修正指示、利用目的など"
                  />
                </label>
              </div>
            )}
          </div>
        </form>

        {/* 素材一覧・草案一覧 */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base">保管ファイル・HP／LP・動画リンク</h3>
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300 font-medium">
                  {filteredAssets.length}件
                </span>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition"
                title="保管ファイルの一覧を最新状態に再読み込み"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>一覧を再読み込み</span>
              </button>
            </div>

            {/* フィルターバー */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="素材名・URLで検索"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">すべての分類（画像・動画・HP・LP・資料等）</option>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <p className="mt-4 text-center text-sm text-slate-400">読み込み中…</p>
            ) : filteredAssets.length === 0 ? (
              <p className="mt-4 text-center text-sm text-slate-400">
                該当する保管素材・リンクはありません。
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-800 max-h-[500px] overflow-y-auto pr-1">
                {filteredAssets.map((asset) => {
                  const strategy = strategyFor(asset);
                  const tool = toolFor(asset);
                  const isVideo = asset.asset_type === 'video';
                  const isWebsite = asset.asset_type === 'website' || asset.asset_type === 'landing_page';
                  const isImage = asset.asset_type === 'image';

                  return (
                    <li key={asset.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-800 p-1 text-slate-300">
                            {isVideo ? (
                              <Film className="h-3.5 w-3.5 text-indigo-400" />
                            ) : isWebsite ? (
                              <Globe className="h-3.5 w-3.5 text-cyan-400" />
                            ) : isImage ? (
                              <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-amber-400" />
                            )}
                          </span>
                          <p className="break-words text-sm font-medium text-white">{asset.title}</p>
                          {asset.is_local && (
                            <span className="rounded bg-amber-950/80 border border-amber-700/60 px-1.5 py-0.2 text-[10px] text-amber-300 font-mono">
                              Local
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-slate-400">
                          <span className="font-medium text-slate-300">
                            {ASSET_TYPES.find((item) => item.value === asset.asset_type)?.label}
                          </span>
                          {' · '}
                          {asset.source === 'upload'
                            ? asset.file_size_bytes
                              ? Math.ceil(asset.file_size_bytes / 1024) + ' KB'
                              : 'ファイル保管'
                            : '外部リンク'}
                        </p>

                        {asset.external_url && (
                          <a
                            href={asset.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline max-w-full truncate"
                          >
                            <Link2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{asset.external_url}</span>
                          </a>
                        )}

                        <p className="mt-1 text-xs text-slate-500">
                          {strategy ? '戦略: ' + strategy.title : ''}
                          {tool ? ' · 運用: ' + tool.title : ''}
                        </p>

                        {asset.notes && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400 bg-slate-950/50 p-2 rounded">
                            {asset.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void openAsset(asset)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-slate-700 hover:text-cyan-200 transition"
                          title={asset.source === 'upload' ? 'ファイルを開く / ダウンロード' : '登録URLリンクを開く'}
                        >
                          {asset.source === 'upload' ? (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              <span>開く</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>リンクを開く</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(asset)}
                          className="rounded-lg border border-slate-700/80 p-1.5 text-slate-400 hover:border-rose-700/60 hover:bg-rose-950/40 hover:text-rose-300 transition"
                          title="素材を削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 草案・運用方針セクション */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
            <h3 className="font-semibold text-white text-base border-b border-slate-800 pb-3">
              登録済みの集客戦略・運用草案
            </h3>
            {strategies.length === 0 && operationalRecords.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">戦略・運用草案はありません。</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-800 max-h-60 overflow-y-auto pr-1">
                {[...strategies, ...operationalRecords]
                  .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                  .map((record) => (
                    <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <p className="text-sm font-medium text-white">{record.title}</p>
                        <p className="text-xs text-slate-500">
                          {record.record_type} · {record.status || '下書き'}
                          {record.payload.strategyTitle ? ' · 戦略: ' + record.payload.strategyTitle : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenRecord(record)}
                        className="rounded border border-slate-700 px-2 py-1 text-xs text-cyan-200 hover:bg-slate-800"
                      >
                        草案を開く
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};
