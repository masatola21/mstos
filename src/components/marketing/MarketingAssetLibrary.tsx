import React, { useEffect, useMemo, useState } from 'react';
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
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // フォーム用ステート
  const [title, setTitle] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('draft');
  const [status, setStatus] = useState<AssetStatus>('draft');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [strategyRecordId, setStrategyRecordId] = useState('');
  const [toolRecordId, setToolRecordId] = useState('');
  const [productId, setProductId] = useState('');
  const [notes, setNotes] = useState('');

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

  const resetForm = () => {
    setTitle('');
    setAssetType('draft');
    setStatus('draft');
    setFile(null);
    setExternalUrl('');
    setStrategyRecordId('');
    setToolRecordId('');
    setProductId('');
    setNotes('');
    const picker = document.getElementById('marketing-asset-file') as HTMLInputElement | null;
    if (picker) picker.value = '';
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

  // フィルタリング処理
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (selectedTypeFilter !== 'all' && asset.asset_type !== selectedTypeFilter) return false;
      if (selectedStatusFilter !== 'all' && asset.status !== selectedStatusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchTitle = asset.title.toLowerCase().includes(query);
        const matchNotes = asset.notes?.toLowerCase().includes(query);
        const matchUrl = asset.external_url?.toLowerCase().includes(query);
        if (!matchTitle && !matchNotes && !matchUrl) return false;
      }
      return true;
    });
  }, [assets, selectedTypeFilter, selectedStatusFilter, searchQuery]);

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
              onClick={() => void load()}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              再読み込み
            </button>
          </div>
        </div>
      </header>

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
        {/* 新規登録フォーム */}
        <form
          onSubmit={(event) => void save(event)}
          className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-white flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-cyan-400" />
              素材・成果物を保管
            </h3>
            <span className="text-xs text-slate-400">ファイルまたはURL</span>
          </div>

          <label className="block text-sm text-slate-300">
            素材名・用途 <span className="text-rose-400">*</span>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
              placeholder="例：公式HPトップURL、商品動画本編、広告バナー案"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              分類
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value as AssetType)}
                className={inputClass}
              >
                {ASSET_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-300">
              状態
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as AssetStatus)}
                className={inputClass}
              >
                {ASSET_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm text-slate-300">
            ファイル（画像、動画、PDF、HTMLなど最大50MB）
            <input
              id="marketing-asset-file"
              type="file"
              accept="image/*,video/*,application/pdf,text/html,application/zip,.doc,.docx,.ppt,.pptx,.csv,.txt"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                if (event.target.files?.[0]) setExternalUrl('');
              }}
              className={inputClass}
            />
          </label>

          <label className="block text-sm text-slate-300">
            またはHP・LP・動画・オンライン素材のURL
            <input
              type="url"
              value={externalUrl}
              onChange={(event) => {
                setExternalUrl(event.target.value);
                if (event.target.value) setFile(null);
              }}
              className={inputClass}
              placeholder="https://example.com または YouTube/Drive URL"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              関連する集客戦略
              <select
                value={strategyRecordId}
                onChange={(event) => setStrategyRecordId(event.target.value)}
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

            <label className="block text-sm text-slate-300">
              関連する運用草案・ツール
              <select
                value={toolRecordId}
                onChange={(event) => {
                  const id = event.target.value;
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

          <label className="block text-sm text-slate-300">
            対象商品（商品マスター）
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
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

          <label className="block text-sm text-slate-300">
            補足メモ・備考
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass}
              placeholder="版、修正指示、利用目的など"
            />
          </label>

          <div className="pt-2">
            <button
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {saving ? '保存中…' : '保管する'}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              アップロードしたファイルは非公開領域に安全に保存され、ログイン中のユーザーのみ閲覧できます。
            </p>
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
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                更新
              </button>
            </div>

            {/* フィルターバー */}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="素材名・URLで検索"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-2 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              >
                <option value="all">すべての分類</option>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              >
                <option value="all">すべての状態</option>
                {ASSET_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
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
                          {ASSET_TYPES.find((item) => item.value === asset.asset_type)?.label} ·{' '}
                          {ASSET_STATUSES.find((item) => item.value === asset.status)?.label} ·{' '}
                          {asset.source === 'upload'
                            ? asset.file_size_bytes
                              ? Math.ceil(asset.file_size_bytes / 1024) + 'KB'
                              : 'ファイル'
                            : 'URL'}
                        </p>

                        {asset.external_url && (
                          <a
                            href={asset.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block truncate text-xs text-cyan-400 hover:underline flex items-center gap-1"
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
                        <select
                          aria-label={asset.title + 'の状態'}
                          value={asset.status}
                          onChange={(event) => void updateStatus(asset, event.target.value as AssetStatus)}
                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        >
                          {ASSET_STATUSES.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void openAsset(asset)}
                          className="rounded border border-slate-700 p-2 text-cyan-200 hover:bg-slate-800"
                          title={asset.source === 'upload' ? 'ファイルを開く' : 'リンクを開く'}
                        >
                          {asset.source === 'upload' ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(asset)}
                          className="rounded border border-slate-700 p-2 text-rose-300 hover:bg-rose-950/40"
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
