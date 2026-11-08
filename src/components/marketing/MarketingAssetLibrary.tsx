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
  LayoutGrid,
  List,
  Eye,
  FileCheck,
  ShieldCheck,
  Briefcase
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
import { getAuthHeaders } from '../../lib/supabaseClient';

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

const inputClass = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none';

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
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com') || lower.includes('notion.so') || lower.includes('dropbox.com') || lower.includes('docsend.com')) return 'document';
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

  // 表示モード（グリッド vs リスト）
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // フィルター & 検索
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

  // クリップボードコピー
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // かんたん即時登録（Quick Upload）用ステート
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォーム用ステート
  const [title, setTitle] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('document');
  const [status, setStatus] = useState<AssetStatus>('published');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [strategyRecordId, setStrategyRecordId] = useState('');
  const [toolRecordId, setToolRecordId] = useState('');
  const [productId, setProductId] = useState('');
  const [notes, setNotes] = useState('');

  /* 広告開始時に、コンテンツ作成の用途『広告』として再実装する */
  const copyAssetLink = async (asset: MarketingAsset) => {
    try {
      const url = asset.external_url || (await getAssetViewUrl(asset));
      if (url) {
        await navigator.clipboard.writeText(url);
        setCopiedId(asset.id);
        setTimeout(() => setCopiedId(null), 2500);
      }
    } catch {
      setError('URLのコピーに失敗しました。');
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

  const handleSelectFile = (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setExternalUrl('');
    const cleanTitle = cleanFileNameToTitle(selectedFile.name);
    if (!title.trim() || title === '未設定の素材') {
      setTitle(cleanTitle);
    }
    const detected = detectAssetTypeFromFile(selectedFile.name);
    setAssetType(detected);
    setStatus('published');
    setError('');
  };

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
        } catch {}
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('素材名を入力してください。');
      return;
    }
    if (uploadMode === 'file' && !file) {
      setError('ファイルを選択してください。');
      return;
    }
    if (uploadMode === 'url' && !externalUrl.trim()) {
      setError('URLリンクを入力してください。');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const result = await createMarketingAsset(
        {
          title: title.trim(),
          asset_type: assetType,
          status,
          file: file || undefined,
          external_url: externalUrl.trim() || undefined,
          strategy_record_id: strategyRecordId || undefined,
          tool_record_id: toolRecordId || undefined,
          product_id: productId || undefined,
          notes: notes.trim() || undefined,
        },
        userId
      );

      if (!result.asset) {
        setError(result.message || '保存に失敗しました。');
        return;
      }

      setNotice(result.message || '素材・成果物を保管しました。');
      resetForm();
      await load();
    } catch (err: any) {
      setError(err?.message || '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (asset: MarketingAsset) => {
    if (!window.confirm(`「${asset.title}」を保管庫から削除しますか？`)) return;
    setError('');
    const result = await deleteMarketingAsset(asset);
    if (!result.success) {
      setError(result.message || '削除に失敗しました。');
      return;
    }
    setNotice(result.message || '素材を削除しました。');
    await load();
  };

  const openAsset = async (asset: MarketingAsset) => {
    try {
      const url = await getAssetViewUrl(asset);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setError('ファイルまたはリンクのURLを取得できませんでした。');
      }
    } catch (err: any) {
      setError(err.message || 'ファイルを開けませんでした。');
    }
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (selectedTypeFilter !== 'all') {
        if (selectedTypeFilter === 'sales_doc') {
          if (asset.asset_type !== 'document') return false;
        } else if (asset.asset_type !== selectedTypeFilter) {
          return false;
        }
      }
      if (selectedProductFilter !== 'all' && asset.product_id !== selectedProductFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = asset.title.toLowerCase().includes(q);
        const matchNotes = asset.notes ? asset.notes.toLowerCase().includes(q) : false;
        const matchUrl = asset.external_url ? asset.external_url.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchNotes && !matchUrl) return false;
      }
      return true;
    });
  }, [assets, selectedTypeFilter, selectedProductFilter, searchQuery]);

  return (
    <section className="space-y-5 text-slate-800">
      {/* ── ヘッダー ── */}
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-purple-700" />
              <h2 className="text-[19px] font-bold text-slate-800 tracking-tight">資料・成果物保管庫</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              投稿案・営業資料・広告コピー・配布PDFなどの外部発信・営業成果物を一元管理します（※AIが参照する社内ナレッジ・規程等は「AI経営室 ＞ ナレッジ・成果物保管庫」で管理されます）。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition cursor-pointer shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
              <span>再読み込み</span>
            </button>
          </div>
        </div>
      </header>

      {/* メッセージ */}
      {(error || notice) && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-xs shadow-xs ${
            error
              ? 'border border-rose-200 bg-rose-50 text-rose-800'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error ? <X className="h-4 w-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
          <span className="font-medium leading-relaxed">{error || notice}</span>
        </div>
      )}

      {/* ── 2カラム構成: 左側アップロード / 右側資料一覧 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 左側: かんたんアップロード＆登録フォーム (4カラム) */}
        <form onSubmit={(e) => void handleSubmit(e)} className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileUp className="h-4 w-4 text-purple-600" />
                営業資料・成果物を登録
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                PDF・提案書・画像動画・Webリンクを即時保管
              </p>
            </div>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
              即時保管
            </span>
          </div>

          {/* モード切替タブ */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setUploadMode('file');
                setExternalUrl('');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                uploadMode === 'file' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              ファイルを保存
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMode('url');
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                uploadMode === 'url' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              URLリンク登録
            </button>
          </div>

          {/* ファイル選択エリア */}
          {uploadMode === 'file' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,video/*,text/html,application/zip,.csv,.txt,.xlsx,.xls"
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
                      ? 'border-purple-400 bg-purple-50/60'
                      : 'border-slate-300 bg-slate-50/70 hover:border-purple-400 hover:bg-purple-50/30'
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold text-slate-800">クリックしてファイルを選択</span>
                    <span className="text-xs text-slate-500 block mt-0.5">またはドラッグ＆ドロップ</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">
                    PDF提案書・会社案内・動画・画像（最大50MB）<br />
                    ファイル名から分類と名称を自動判別します
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900 truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 text-xs cursor-pointer"
                      title="取り消す"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-600">自動分類:</span>
                    <span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800 border border-purple-200">
                      {ASSET_TYPES.find((t) => t.value === assetType)?.label || assetType}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-purple-700 hover:underline ml-auto text-[10px] cursor-pointer"
                    >
                      ファイルを変更
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* URLリンクモード */}
          {uploadMode === 'url' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Googleドライブ・Notion・DocSend・HP URL
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => handleUrlInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none"
                placeholder="https://drive.google.com/... または Notion / YouTube"
              />
              {externalUrl && (
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span>判定分類:</span>
                  <span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800 border border-purple-200">
                    {ASSET_TYPES.find((t) => t.value === assetType)?.label || assetType}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 資料名・用途 */}
          <div className="space-y-1">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>資料名・タイトル <span className="text-rose-600">*</span></span>
              <span className="text-[10px] text-slate-500 font-normal">（自動補完・修正可）</span>
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none"
              placeholder="例: 会社案内 2026年最新版、業務改善提案書テンプレート"
            />
          </div>

          {/* メイン保存ボタン */}
          <button
            type="submit"
            disabled={saving || (uploadMode === 'file' ? !file : !externalUrl.trim())}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 p-3 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            {saving ? '保管庫に保存中…' : '🚀 保管庫に保存する'}
          </button>

          {/* 任意: 詳細紐付け設定 */}
          <div className="border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-1 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                任意設定（商品紐付け・分類変更・メモ）
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 animate-in fade-in duration-150 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">分類の手動変更</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as AssetType)}
                    className={inputClass}
                  >
                    {ASSET_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">対象商品（商品マスター）</label>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">指定しない</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.product_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">補足メモ・営業活用用途</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                    placeholder="例: 初回商談用、送付用、契約時確認事項など"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* 右側: 資料一覧・検索・クイック共有 (8カラム) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">保管中の営業資料・成果物一覧</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-purple-700 font-bold border border-slate-200">
                  {filteredAssets.length} 件
                </span>
              </div>

              {/* グリッド/リスト切り替え */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      viewMode === 'grid' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="グリッド表示"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      viewMode === 'list' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="リスト表示"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* クイック分類フィルターバー */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'すべて' },
                { id: 'document', label: '📄 営業提案書・資料' },
                { id: 'image', label: '🖼️ 画像・バナー' },
                { id: 'video', label: '🎬 動画・Reels' },
                { id: 'website', label: '🌐 HP・Web・LP' },
                { id: 'draft', label: '✍️ コピー・下書き' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    selectedTypeFilter === f.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 検索・商品フィルター */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="資料名・メモ・URLで検索"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
              >
                <option value="all">すべての関連商品</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                資料データを読み込み中…
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <p>該当する営業資料・保管成果物はありません。</p>
                <p className="text-[11px] text-slate-400">
                  左側のフォームから会社案内、提案書PDF、画像動画、またはドライブURLを登録してください。
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* ── グリッド表示モード ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredAssets.map((asset) => {
                  const isVideo = asset.asset_type === 'video';
                  const isImage = asset.asset_type === 'image';
                  const isDoc = asset.asset_type === 'document';
                  const isCopied = copiedId === asset.id;

                  return (
                    <div
                      key={asset.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3 hover:border-purple-300 hover:shadow-xs transition shadow-2xs group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-slate-50 p-2 text-purple-600 border border-slate-200">
                              {isVideo ? <Film className="h-4 w-4 text-purple-600" /> : isImage ? <ImageIcon className="h-4 w-4 text-emerald-600" /> : isDoc ? <FileText className="h-4 w-4 text-amber-600" /> : <Globe className="h-4 w-4 text-sky-600" />}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {ASSET_TYPES.find((t) => t.value === asset.asset_type)?.label || asset.asset_type}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => void remove(asset)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="削除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <h4 className="mt-2.5 text-xs font-bold text-slate-900 line-clamp-2 leading-relaxed">
                          {asset.title}
                        </h4>

                        {asset.notes && (
                          <p className="mt-1 text-[11px] text-slate-600 line-clamp-2 leading-normal bg-slate-50 p-1.5 rounded border border-slate-100">
                            {asset.notes}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{asset.source === 'upload' ? 'ローカル保管' : '外部共有リンク'}</span>
                          {asset.file_size_bytes ? (
                            <span>・ {(asset.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                          ) : null}
                        </div>
                      </div>

                      {/* アクションボタン群 */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => void copyAssetLink(asset)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                            isCopied
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                          title="共有リンクをクリップボードにコピー"
                        >
                          {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-500" />}
                          <span>{isCopied ? 'コピー完了' : 'リンク取得'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void openAsset(asset)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer ml-auto"
                        >
                          {asset.source === 'upload' ? <Download className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                          <span>開く / 閲覧</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── リスト表示モード ── */
              <ul className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto pr-1">
                {filteredAssets.map((asset) => {
                  const isCopied = copiedId === asset.id;
                  return (
                    <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {ASSET_TYPES.find((t) => t.value === asset.asset_type)?.label}
                          </span>
                          <span className="font-bold text-xs text-slate-900 truncate">{asset.title}</span>
                        </div>
                        {asset.notes && (
                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">{asset.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void copyAssetLink(asset)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                        >
                          {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>{isCopied ? 'コピー済' : 'リンク'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void openAsset(asset)}
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer shadow-xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>開く</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(asset)}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
