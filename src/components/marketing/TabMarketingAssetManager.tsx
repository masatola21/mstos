import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  Film,
  Globe,
  Image as ImageIcon,
  FileText,
  Link2,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  FolderOpen,
  Sparkles,
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

interface TabMarketingAssetManagerProps {
  toolType: 'strategy' | 'content' | 'social' | 'video' | 'ad' | 'media' | 'funnel';
  title?: string;
  description?: string;
  currentRecordId?: string;
  currentRecordTitle?: string;
  records?: Array<{ id: string; title: string; record_type: string }>;
  products?: Array<{ id: string; product_name: string }>;
  userId?: string;
  compact?: boolean;
}

const TAB_CONFIGS: Record<
  TabMarketingAssetManagerProps['toolType'],
  {
    title: string;
    description: string;
    defaultAssetType: AssetType;
    urlPlaceholder: string;
    fileHelp: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  media: {
    title: '自社メディアのHP URL・素材・成果物',
    description: 'HPのトップURLや下層URL、サイト用ロゴ・画像、元HTML/テーマファイル、仕様書を保管します。',
    defaultAssetType: 'website',
    urlPlaceholder: 'https://example.com （自社HP・ブログURL）',
    fileHelp: 'ロゴ、サイト用画像、HTML/CSS、デザインファイル（50MBまで）',
    icon: Globe,
  },
  video: {
    title: '動画運用の素材・成果物',
    description: '完成動画URL（YouTube/TikTok/Drive/Vimeo等）、撮影動画素材、サムネイル画像、台本ファイルを保管します。',
    defaultAssetType: 'video',
    urlPlaceholder: 'https://youtube.com/... または https://drive.google.com/... （動画URL）',
    fileHelp: '動画ファイル(mp4, mov等)、サムネイル画像、構成・台本PDF（50MBまで）',
    icon: Film,
  },
  social: {
    title: 'SNS・note運用の素材・成果物',
    description: 'noteアイキャッチ画像、X/Instagram投稿用画像・カルーセルスライド、公開記事URLを保管します。',
    defaultAssetType: 'image',
    urlPlaceholder: 'https://note.com/... または https://x.com/... （投稿URL）',
    fileHelp: '投稿画像、アイキャッチ、カルーセル画像、投稿文原稿ファイル（50MBまで）',
    icon: ImageIcon,
  },
  content: {
    title: 'コンテンツ企画の素材・成果物',
    description: '企画書、記事構成案、下書きファイル、リサーチ資料、参考URLを保管します。',
    defaultAssetType: 'draft',
    urlPlaceholder: 'https://docs.google.com/... （企画書・スプレッドシートURL）',
    fileHelp: '企画書PDF、原稿テキスト/Word、リサーチ資料（50MBまで）',
    icon: FileText,
  },
  ad: {
    title: '広告運用の素材・成果物',
    description: '広告バナー画像、広告動画、クリエイティブ素材、遷移先LP URL、配信レポート資料を保管します。',
    defaultAssetType: 'image',
    urlPlaceholder: 'https://example.com/lp （広告誘導先LP URL）',
    fileHelp: 'バナー画像(正方形・横長)、縦型ショート動画、クリエイティブ素材（50MBまで）',
    icon: ImageIcon,
  },
  funnel: {
    title: 'LP・集客導線の素材・成果物',
    description: 'LPの公開URL、デザインカンプ、ワイヤーフレーム、診断/相談予約フォームURLを保管します。',
    defaultAssetType: 'landing_page',
    urlPlaceholder: 'https://example.com/lp-special （LP公開URL）',
    fileHelp: 'デザインカンプ画像、ワイヤーフレームPDF、構成案ファイル（50MBまで）',
    icon: Globe,
  },
  strategy: {
    title: '集客戦略の素材・成果物',
    description: '集客戦略シート、市場・競合リサーチ資料、ペルソナ定義書、KPI設計書を保管します。',
    defaultAssetType: 'document',
    urlPlaceholder: 'https://docs.google.com/... （戦略ドキュメントURL）',
    fileHelp: '戦略プレゼン資料(PDF/PPT)、リサーチデータ、KPI一覧（50MBまで）',
    icon: FileText,
  },
};

export const TabMarketingAssetManager: React.FC<TabMarketingAssetManagerProps> = ({
  toolType,
  title,
  description,
  currentRecordId,
  currentRecordTitle,
  records = [],
  products = [],
  userId,
  compact = false,
}) => {
  const config = TAB_CONFIGS[toolType];
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDbReady, setIsDbReady] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // 登録フォーム
  const [assetTitle, setAssetTitle] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(config.defaultAssetType);
  const [status, setStatus] = useState<AssetStatus>('draft');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [linkedRecordId, setLinkedRecordId] = useState(currentRecordId || '');
  const [productId, setProductId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (currentRecordId) {
      setLinkedRecordId(currentRecordId);
    }
  }, [currentRecordId]);

  // このタブに関連する素材を抽出
  // 1. tool_record_id がこのタブのレコードと一致
  // 2. もしくは asset_type がこのタブの関連型と一致
  // 3. currentRecordId があればそれを優先表示
  const filteredAssets = useMemo(() => {
    const tabRecordIds = new Set(records.filter((r) => r.record_type === toolType).map((r) => r.id));
    if (currentRecordId) {
      tabRecordIds.add(currentRecordId);
    }

    return assets.filter((asset) => {
      // 現在開いている特定の施策に紐付く場合
      if (currentRecordId && asset.tool_record_id === currentRecordId) return true;
      // このタブの施策群に紐付く場合
      if (asset.tool_record_id && tabRecordIds.has(asset.tool_record_id)) return true;

      // タブごとのカテゴリ一致
      if (toolType === 'video' && asset.asset_type === 'video') return true;
      if (toolType === 'media' && (asset.asset_type === 'website' || asset.asset_type === 'document')) return true;
      if (toolType === 'social' && (asset.asset_type === 'image' || asset.asset_type === 'draft')) return true;
      if (toolType === 'content' && (asset.asset_type === 'draft' || asset.asset_type === 'document')) return true;
      if (toolType === 'ad' && (asset.asset_type === 'image' || asset.asset_type === 'video' || asset.asset_type === 'landing_page')) return true;
      if (toolType === 'funnel' && (asset.asset_type === 'landing_page' || asset.asset_type === 'website')) return true;
      if (toolType === 'strategy' && (asset.asset_type === 'document' || asset.asset_type === 'draft')) return true;

      return false;
    });
  }, [assets, toolType, records, currentRecordId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetTitle.trim()) {
      setError('素材名を入力してください。');
      return;
    }
    const url = externalUrl.trim();
    if (!file && !url) {
      setError('ファイルを選択するか、URLを入力してください。');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await createMarketingAsset(
        {
          title: assetTitle.trim(),
          asset_type: assetType,
          status,
          external_url: url || undefined,
          file: file || null,
          tool_record_id: linkedRecordId || currentRecordId || null,
          product_id: productId || null,
          notes: notes.trim(),
        },
        userId
      );

      setAssets((prev) => [res.asset, ...prev.filter((a) => a.id !== res.asset.id)]);
      setNotice(res.message || '素材を保存しました。');
      // フォームリセット
      setAssetTitle('');
      setExternalUrl('');
      setFile(null);
      setNotes('');
      setShowAddForm(false);
    } catch (err: any) {
      setError(err?.message || '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = async (asset: MarketingAsset) => {
    const url = await getAssetViewUrl(asset);
    if (!url) {
      setError('素材URLを取得できませんでした。');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleStatusChange = async (asset: MarketingAsset, nextStatus: AssetStatus) => {
    const res = await updateMarketingAssetStatus(asset, nextStatus);
    if (res.success) {
      setAssets((prev) =>
        prev.map((item) => (item.id === asset.id ? { ...item, status: nextStatus } : item))
      );
    } else {
      setError(res.message || '更新に失敗しました。');
    }
  };

  const handleDelete = async (asset: MarketingAsset) => {
    if (!window.confirm(`「${asset.title}」を削除しますか？`)) return;
    const res = await deleteMarketingAsset(asset);
    if (res.success) {
      setAssets((prev) => prev.filter((item) => item.id !== asset.id));
      setNotice('削除しました。');
    } else {
      setError(res.message || '削除に失敗しました。');
    }
  };

  const Icon = config.icon;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-sm">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/20">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-base">
                {title || config.title}
              </h3>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300 font-medium">
                {filteredAssets.length}件
              </span>
              {currentRecordTitle && (
                <span className="rounded bg-indigo-950/70 border border-indigo-700/50 px-2 py-0.5 text-[11px] text-indigo-300">
                  {currentRecordTitle} 関連
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {description || config.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? 'フォームを閉じる' : '素材・URLを追加'}
          </button>
        </div>
      </div>

      {/* DB未適用バナー（未適用時のみ） */}
      {!isDbReady && (
        <MigrationAlertBanner compact={compact} onRefresh={load} />
      )}

      {/* 通知 & エラー */}
      {notice && (
        <p className="rounded-lg bg-emerald-950/50 border border-emerald-700/40 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      )}
      {error && !isDbReady && (
        <p className="text-xs text-amber-300/80">
          ※ 現在はローカル一時保存モードで安全に動作しています。DBマイグレーション適用後にクラウドへ保存されます。
        </p>
      )}

      {/* 追加フォーム */}
      {showAddForm && (
        <form
          onSubmit={handleSave}
          className="space-y-3 rounded-xl border border-indigo-500/30 bg-slate-950/80 p-4 transition-all"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              新しい素材・URLを登録
            </h4>
            <span className="text-[11px] text-slate-500">
              {toolType === 'video'
                ? '動画ファイルまたはYouTube/Vimeo/Drive URL'
                : toolType === 'media'
                ? 'HPのURLやサイト素材'
                : 'ファイルまたは外部URL'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-300">
              素材名・用途 <span className="text-rose-400">*</span>
              <input
                required
                value={assetTitle}
                onChange={(e) => setAssetTitle(e.target.value)}
                placeholder={
                  toolType === 'video'
                    ? '例：商品紹介YouTube本編、TikTok冒頭フック素材'
                    : toolType === 'media'
                    ? '例：公式コーポレートHP、オウンドメディアトップURL'
                    : '例：noteアイキャッチ画像、LPワイヤーフレーム'
                }
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white placeholder:text-slate-500"
              />
            </label>

            <label className="text-xs text-slate-300">
              分類
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as AssetType)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-300 sm:col-span-2">
              URL（HP URL、動画URL、オンライン共有URLなど）
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => {
                  setExternalUrl(e.target.value);
                  if (e.target.value) setFile(null);
                }}
                placeholder={config.urlPlaceholder}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white placeholder:text-slate-500"
              />
            </label>

            <label className="text-xs text-slate-300 sm:col-span-2">
              または直接ファイルをアップロード（最大50MB）
              <input
                type="file"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  setFile(selected);
                  if (selected) setExternalUrl('');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-xs file:text-white"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {config.fileHelp}
              </span>
            </label>

            {records.length > 0 && (
              <label className="text-xs text-slate-300">
                関連する施策レコード
                <select
                  value={linkedRecordId}
                  onChange={(e) => setLinkedRecordId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                >
                  <option value="">指定しない（このタブ全体）</option>
                  {records
                    .filter((r) => r.record_type === toolType)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className="text-xs text-slate-300">
              ステータス
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AssetStatus)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
              >
                {ASSET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-300 sm:col-span-2">
              備考・制作メモ
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="台本修正版、YouTube公開設定、サムネイルのABテスト指示など"
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white placeholder:text-slate-500"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {saving ? '保存中…' : 'このタブの素材として保管'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* 素材一覧リスト */}
      {loading ? (
        <p className="py-4 text-center text-xs text-slate-400">素材データを読み込み中…</p>
      ) : filteredAssets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">
            このタブに登録された素材・成果物はまだありません。
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            「素材・URLを追加」からHPのURL、動画素材、画像、ファイルなどを登録できます。
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            <Plus className="h-3 w-3" /> 素材を追加する
          </button>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
            const statusConfig = ASSET_STATUSES.find((s) => s.value === asset.status);
            const isVideo = asset.asset_type === 'video';
            const isWebsite = asset.asset_type === 'website' || asset.asset_type === 'landing_page';
            const isImage = asset.asset_type === 'image';
            const linkedRecord = records.find((r) => r.id === asset.tool_record_id);

            return (
              <div
                key={asset.id}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 hover:border-slate-700 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="rounded bg-slate-800 p-1 text-slate-300 shrink-0">
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
                      <p className="text-xs font-semibold text-white truncate" title={asset.title}>
                        {asset.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {asset.is_local && (
                        <span
                          className="rounded bg-amber-950/80 border border-amber-700/60 px-1.5 py-0.2 text-[10px] text-amber-300 font-mono"
                          title="DB未適用のためローカル保管中"
                        >
                          Local
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(asset)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity"
                        title="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* プレビューまたはURL表示 */}
                  {asset.external_url && (
                    <a
                      href={asset.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block truncate text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{asset.external_url}</span>
                    </a>
                  )}

                  {asset.notes && (
                    <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {asset.notes}
                    </p>
                  )}

                  {linkedRecord && (
                    <p className="mt-1 text-[10px] text-slate-500 truncate">
                      施策: {linkedRecord.title}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-900 pt-2 text-[11px]">
                  <select
                    value={asset.status}
                    onChange={(e) => handleStatusChange(asset, e.target.value as AssetStatus)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium bg-slate-900 ${
                      statusConfig?.badgeClass || 'text-slate-300 border-slate-700'
                    }`}
                  >
                    {ASSET_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleOpen(asset)}
                    className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    {asset.source === 'upload' ? (
                      <>
                        <Download className="h-3 w-3 text-cyan-300" />
                        開く
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3 w-3 text-cyan-300" />
                        リンク
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
