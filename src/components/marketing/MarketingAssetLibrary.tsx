import React, { useEffect, useState } from 'react';
import { Download, Link2, Trash2, Upload } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

type MarketingRecord = {
  id: string;
  record_type: string;
  title: string;
  product_id: string | null;
  status: string | null;
  payload: Record<string, string>;
  updated_at: string;
};
type Product = { id: string; product_name: string };
type Asset = {
  id: string;
  title: string;
  asset_type: AssetType;
  source: 'upload' | 'url';
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  strategy_record_id: string | null;
  tool_record_id: string | null;
  product_id: string | null;
  status: AssetStatus;
  notes: string;
  created_at: string;
};
type AssetType = 'draft' | 'website' | 'landing_page' | 'image' | 'video' | 'document' | 'other';
type AssetStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

const BUCKET = 'mst-marketing-assets';
const ASSET_TYPES: Array<{ value: AssetType; label: string }> = [
  { value: 'draft', label: '草案・作業ファイル' }, { value: 'website', label: 'HP' },
  { value: 'landing_page', label: 'LP' }, { value: 'image', label: '画像' },
  { value: 'video', label: '動画' }, { value: 'document', label: '資料' },
  { value: 'other', label: 'その他素材' },
];
const ASSET_STATUSES: Array<{ value: AssetStatus; label: string }> = [
  { value: 'draft', label: '草案' }, { value: 'review', label: '確認中' },
  { value: 'approved', label: '承認済み' }, { value: 'published', label: '公開・利用中' },
  { value: 'archived', label: '保管' },
];
const inputClass = 'mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white';

export const MarketingAssetLibrary: React.FC<{
  records: MarketingRecord[];
  products: Product[];
  onOpenRecord: (record: MarketingRecord) => void;
  contextualAssetType?: AssetType;
  contextRecordType?: string;
  sectionTitle?: string;
}> = ({ records, products, onOpenRecord, contextualAssetType, contextRecordType, sectionTitle }) => {
  const strategies = records.filter((record) => record.record_type === 'strategy');
  const operationalRecords = records.filter((record) => ['content', 'social', 'video', 'ad', 'media', 'funnel'].includes(record.record_type) && (!contextRecordType || record.record_type === contextRecordType));
  const [userId, setUserId] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(contextualAssetType || 'draft');
  const [status, setStatus] = useState<AssetStatus>('draft');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [strategyRecordId, setStrategyRecordId] = useState('');
  const [toolRecordId, setToolRecordId] = useState('');
  const [productId, setProductId] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const db = getSupabase();
    if (!db) { setError('Supabaseに接続してください。'); setLoading(false); return; }
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) { setError('ログイン状態を確認できません。'); setLoading(false); return; }
    setUserId(auth.user.id);
    const { data, error: loadError } = await db.from('mst_marketing_assets')
      .select('*').eq('user_id', auth.user.id).order('updated_at', { ascending: false });
    if (loadError) {
      setError(loadError.message.includes('mst_marketing_assets')
        ? '素材保管DBがまだ使えません。PR #170 の supabase/migrations/20261020230000_marketing_asset_library.sql をSupabaseに適用し、画面を再読み込みしてください。'
        : '素材を読み込めませんでした: ' + loadError.message);
    } else setAssets((data || []) as Asset[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const resetForm = () => {
    setTitle(''); setAssetType(contextualAssetType || 'draft'); setStatus('draft'); setFile(null); setExternalUrl('');
    setStrategyRecordId(''); setToolRecordId(''); setProductId(''); setNotes('');
    const picker = document.getElementById('marketing-asset-file') as HTMLInputElement | null;
    if (picker) picker.value = '';
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const db = getSupabase();
    if (!db || !userId) { setError('ログインしてSupabaseへ接続してください。'); return; }
    if (!title.trim()) { setError('素材名を入力してください。'); return; }
    const url = externalUrl.trim();
    if (!file && !url) { setError('ファイルを選ぶか、HP・LP・素材のURLを入力してください。'); return; }
    if (!file && url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
      } catch { setError('URLは http:// または https:// で始まるものを入力してください。'); return; }
    }
    if (file && file.size > 52428800) { setError('ファイルは50MB以下にしてください。'); return; }
    setSaving(true); setError(''); setNotice('');
    let storagePath: string | null = null;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = userId + '/' + crypto.randomUUID() + '-' + safeName;
      const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) { setSaving(false); setError('アップロードできませんでした: ' + uploadError.message); return; }
    }
    const row = {
      user_id: userId, title: title.trim(), asset_type: assetType, source: file ? 'upload' : 'url',
      storage_path: storagePath, external_url: file ? null : url,
      mime_type: file?.type || null, file_size_bytes: file?.size || null,
      strategy_record_id: strategyRecordId || null, tool_record_id: toolRecordId || null,
      product_id: productId || null, status, notes: notes.trim(), updated_at: new Date().toISOString(),
    };
    const { data, error: saveError } = await db.from('mst_marketing_assets').insert(row).select('*').single();
    if (saveError) {
      if (storagePath) await db.storage.from(BUCKET).remove([storagePath]);
      setSaving(false); setError('素材情報を保存できませんでした: ' + saveError.message); return;
    }
    setAssets((current) => [data as Asset, ...current]);
    setSaving(false); setNotice('素材・成果物を保管しました。');
    resetForm();
  };

  const openAsset = async (asset: Asset) => {
    if (asset.external_url) { window.open(asset.external_url, '_blank', 'noopener,noreferrer'); return; }
    if (!asset.storage_path) return;
    const db = getSupabase();
    if (!db) return;
    const { data, error: linkError } = await db.storage.from(BUCKET).createSignedUrl(asset.storage_path, 600);
    if (linkError || !data?.signedUrl) { setError('ファイルを開けませんでした: ' + (linkError?.message || 'URLを作成できません。')); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const updateStatus = async (asset: Asset, nextStatus: AssetStatus) => {
    const db = getSupabase();
    if (!db) return;
    const { error: updateError } = await db.from('mst_marketing_assets')
      .update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', asset.id).eq('user_id', userId);
    if (updateError) { setError('状態を更新できませんでした: ' + updateError.message); return; }
    setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, status: nextStatus } : item));
  };

  const remove = async (asset: Asset) => {
    if (!window.confirm('「' + asset.title + '」を素材一覧から削除しますか？')) return;
    const db = getSupabase();
    if (!db) return;
    if (asset.storage_path) {
      const { error: storageError } = await db.storage.from(BUCKET).remove([asset.storage_path]);
      if (storageError) { setError('保存ファイルを削除できませんでした: ' + storageError.message); return; }
    }
    const { error: deleteError } = await db.from('mst_marketing_assets').delete().eq('id', asset.id).eq('user_id', userId);
    if (deleteError) { setError('素材情報を削除できませんでした: ' + deleteError.message); return; }
    setAssets((current) => current.filter((item) => item.id !== asset.id));
  };

  const visibleAssets = contextualAssetType ? assets.filter((asset) => asset.asset_type === contextualAssetType && (!asset.tool_record_id || operationalRecords.some((record) => record.id === asset.tool_record_id))) : assets;
  const strategyFor = (asset: Asset) => strategies.find((record) => record.id === asset.strategy_record_id);
  const toolFor = (asset: Asset) => operationalRecords.find((record) => record.id === asset.tool_record_id);

  return <section className='space-y-4'>
    <header className='rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4'>
      <h2 className='font-semibold text-white'>{sectionTitle || '素材・成果物の保管'}</h2>
      <p className='mt-1 text-sm text-slate-300'>草案ファイル、HP・LPのURLや元データ、画像・動画・資料を戦略や運用ツールに紐付けて保管します。公開サイトのホスティング・公開操作は行いません。</p>
    </header>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={'rounded-lg p-3 text-sm ' + (error ? 'bg-rose-950/50 text-rose-200' : 'bg-emerald-950/40 text-emerald-200')}>{error || notice}</p>}
    <div className='grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]'>
      <form onSubmit={(event) => void save(event)} className='space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4'>
        <h3 className='font-semibold text-white'>ファイル・リンクを追加</h3>
        <label className='block text-sm text-slate-300'>名前<input required value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder='例：LP構成案、広告バナー案' /></label>
        <label className='block text-sm text-slate-300'>分類<select value={assetType} onChange={(event) => setAssetType(event.target.value as AssetType)} className={inputClass}>{(contextualAssetType ? ASSET_TYPES.filter((item) => item.value === contextualAssetType) : ASSET_TYPES).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className='block text-sm text-slate-300'>ファイル（50MBまで）<input id='marketing-asset-file' type='file' accept='image/*,video/*,application/pdf,text/html,application/zip,.doc,.docx,.ppt,.pptx,.csv,.txt' onChange={(event) => { setFile(event.target.files?.[0] || null); if (event.target.files?.[0]) setExternalUrl(''); }} className={inputClass} /></label>
        <label className='block text-sm text-slate-300'>またはHP・LP・素材のURL<input type='url' value={externalUrl} onChange={(event) => { setExternalUrl(event.target.value); if (event.target.value) setFile(null); }} className={inputClass} placeholder='https://...' /></label>
        <label className='block text-sm text-slate-300'>関連する集客戦略<select value={strategyRecordId} onChange={(event) => setStrategyRecordId(event.target.value)} className={inputClass}><option value=''>指定しない</option>{strategies.map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select></label>
        <label className='block text-sm text-slate-300'>関連する運用草案<select value={toolRecordId} onChange={(event) => { const id = event.target.value; setToolRecordId(id); const linked = operationalRecords.find((record) => record.id === id); if (linked?.payload.strategyId) setStrategyRecordId(linked.payload.strategyId); }} className={inputClass}><option value=''>指定しない</option>{operationalRecords.map((record) => <option key={record.id} value={record.id}>{record.title} · {record.record_type}</option>)}</select></label>
        <label className='block text-sm text-slate-300'>対象商品<select value={productId} onChange={(event) => setProductId(event.target.value)} className={inputClass}><option value=''>指定しない</option>{products.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}</select></label>
        <label className='block text-sm text-slate-300'>状態<select value={status} onChange={(event) => setStatus(event.target.value as AssetStatus)} className={inputClass}>{ASSET_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className='block text-sm text-slate-300'>補足<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder='版、修正指示、利用目的など' /></label>
        <button disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'><Upload className='h-4 w-4' />{saving ? '保存中…' : '保管する'}</button>
        <p className='text-xs text-slate-500'>アップロードしたファイルは非公開領域に保存され、ログイン中の本人だけが開けます。</p>
      </form>
      <div className='space-y-4'>
        <section className='rounded-xl border border-slate-800 bg-slate-900 p-4'>
          <h3 className='font-semibold text-white'>草案・運用方針</h3>
          {strategies.length === 0 && operationalRecords.length === 0 ? <p className='mt-2 text-sm text-slate-400'>戦略・運用草案はありません。</p> : <ul className='mt-3 divide-y divide-slate-800'>{[...strategies, ...operationalRecords].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((record) => <li key={record.id} className='flex flex-wrap items-center justify-between gap-2 py-2'><div><p className='text-sm font-medium text-white'>{record.title}</p><p className='text-xs text-slate-500'>{record.record_type} · {record.status || '下書き'}{record.payload.strategyTitle ? ' · 戦略: ' + record.payload.strategyTitle : ''}</p></div><button type='button' onClick={() => onOpenRecord(record)} className='rounded border border-slate-700 px-2 py-1 text-xs text-cyan-200'>草案を開く</button></li>)}</ul>}
        </section>
        <section className='rounded-xl border border-slate-800 bg-slate-900 p-4'>
          <div className='flex items-center justify-between gap-2'><h3 className='font-semibold text-white'>保管ファイル・HP／LPリンク</h3><button type='button' onClick={() => void load()} className='rounded border border-slate-700 px-2 py-1 text-xs text-slate-300'>更新</button></div>
          {loading ? <p className='mt-3 text-sm text-slate-400'>読み込み中…</p> : assets.length === 0 ? <p className='mt-3 text-sm text-slate-400'>保管ファイル・リンクはありません。</p> : <ul className='mt-3 divide-y divide-slate-800'>{assets.map((asset) => {
            const strategy = strategyFor(asset); const tool = toolFor(asset);
            return <li key={asset.id} className='flex flex-wrap items-start justify-between gap-3 py-3'>
              <div className='min-w-0'><p className='break-words text-sm font-medium text-white'>{asset.title}</p><p className='mt-1 text-xs text-slate-400'>{ASSET_TYPES.find((item) => item.value === asset.asset_type)?.label} · {ASSET_STATUSES.find((item) => item.value === asset.status)?.label} · {asset.source === 'upload' ? (asset.file_size_bytes ? Math.ceil(asset.file_size_bytes / 1024) + 'KB' : 'ファイル') : 'URL'}</p><p className='mt-1 text-xs text-slate-500'>{strategy ? '戦略: ' + strategy.title : ''}{tool ? ' · 草案: ' + tool.title : ''}</p>{asset.notes && <p className='mt-1 whitespace-pre-wrap text-xs text-slate-400'>{asset.notes}</p>}</div>
              <div className='flex shrink-0 items-center gap-2'><select aria-label={asset.title + 'の状態'} value={asset.status} onChange={(event) => void updateStatus(asset, event.target.value as AssetStatus)} className='rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white'>{ASSET_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type='button' onClick={() => void openAsset(asset)} className='rounded border border-slate-700 p-2 text-cyan-200' aria-label={asset.source === 'upload' ? 'ファイルを開く' : 'リンクを開く'}>{asset.source === 'upload' ? <Download className='h-4 w-4' /> : <Link2 className='h-4 w-4' />}</button><button type='button' onClick={() => void remove(asset)} className='rounded border border-slate-700 p-2 text-rose-300' aria-label='素材を削除'><Trash2 className='h-4 w-4' /></button></div>
            </li>;
          })}</ul>}
        </section>
      </div>
    </div>
  </section>;
};
