import React, { useEffect, useState } from 'react';
import { Globe, CheckCircle2 } from 'lucide-react';
import type { ManagedProduct } from '../../types/matrix';
import {
  HP_STATUS_OPTIONS,
  buildDefaultListing,
  loadHpListing,
  publishProductToHp,
  unpublishProductFromHp,
  type HpListingStatusType,
  type HpProductListing,
} from '../../services/hpProductPublishService';

const inputCls =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500';

/** 商品マスタの1商品を、公式HPの「商品・ツール」ページへ掲載／取り下げするパネル */
export const HpProductPublishPanel: React.FC<{ product: ManagedProduct }> = ({ product }) => {
  const [listing, setListing] = useState<HpProductListing>(() => buildDefaultListing(product));
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage('');
    setListing(buildDefaultListing(product));
    setPublished(false);
    void loadHpListing(product.id).then((existing) => {
      if (cancelled) return;
      if (existing) {
        setListing(existing);
        setPublished(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // 商品を切り替えたときだけ読み込み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const update = (patch: Partial<HpProductListing>) => setListing((l) => ({ ...l, ...patch }));

  const publish = async () => {
    setBusy(true);
    setMessage('');
    const res = await publishProductToHp(product, listing);
    setBusy(false);
    setIsError(!res.ok);
    setMessage(res.message);
    if (res.ok) setPublished(true);
  };

  const unpublish = async () => {
    if (!window.confirm(`「${listing.title}」をHPの商品・ツールページから外しますか？（OSの商品マスタは残ります）`)) return;
    setBusy(true);
    setMessage('');
    const res = await unpublishProductFromHp(product.id);
    setBusy(false);
    setIsError(!res.ok);
    setMessage(res.message);
    if (res.ok) setPublished(false);
  };

  if (product.status === 'archived') return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="h-4 w-4 text-purple-600" />
        <h4 className="text-sm font-bold text-slate-900">公式HPの「商品・ツール」への掲載</h4>
        {published && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            HP掲載中
          </span>
        )}
      </div>
      <p className="text-[11px] leading-5 text-slate-500">
        ここで入力した表示項目だけがHPに載ります（原価・KPI・契約などの内部情報は載りません）。掲載・取り下げするとHPが自動で再デプロイされます。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs font-medium text-slate-700">
          掲載タイトル
          <input className={inputCls} value={listing.title} onChange={(e) => update({ title: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-slate-700">
          カテゴリ表示
          <input className={inputCls} value={listing.category} onChange={(e) => update({ category: e.target.value })} placeholder="例: GAS / 業務ツール" />
        </label>
        <label className="text-xs font-medium text-slate-700">
          提供状況
          <select
            className={inputCls}
            value={listing.statusType}
            onChange={(e) => {
              const statusType = e.target.value as HpListingStatusType;
              update({ statusType, statusLabel: HP_STATUS_OPTIONS.find((o) => o.value === statusType)?.label || '' });
            }}
          >
            {HP_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          価格表示
          <input className={inputCls} value={listing.price} onChange={(e) => update({ price: e.target.value })} placeholder="例: 無償配布予定 / 販売予定" />
        </label>
        <label className="text-xs font-medium text-slate-700 sm:col-span-2">
          説明文
          <textarea className={inputCls} rows={3} value={listing.desc} onChange={(e) => update({ desc: e.target.value })} />
        </label>
        <label className="text-xs font-medium text-slate-700 sm:col-span-2">
          詳細リンク（任意）
          <input className={inputCls} value={listing.href} onChange={(e) => update({ href: e.target.value })} placeholder="https://... または /services/care-package（空欄なら「公開時にLINEでお知らせ」と表示）" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void publish()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50"
        >
          <Globe className="h-3.5 w-3.5" />
          {busy ? '処理中…' : published ? 'HPの掲載内容を更新' : 'HPに掲載する'}
        </button>
        {published && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void unpublish()}
            className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
          >
            HPから外す
          </button>
        )}
      </div>
      {message && (
        <p role="status" aria-live="polite" className={`text-xs ${isError ? 'text-rose-600' : 'text-emerald-700'}`}>
          {message}
        </p>
      )}
    </div>
  );
};
