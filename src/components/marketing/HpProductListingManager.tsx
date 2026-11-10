import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Globe, RefreshCw, CheckCircle2, EyeOff } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { HP_STATUS_OPTIONS, HP_TEMPLATE_PRODUCTS, type HpProductStatusType } from '../../data/hpTemplateProducts';

export type HpProductRow = {
  id: string;
  record_type: string;
  title: string;
  product_id: string | null;
  status: string | null;
  payload: Record<string, string>;
  updated_at: string;
};

type Draft = {
  title: string;
  category: string;
  statusType: HpProductStatusType;
  statusLabel: string;
  desc: string;
  price: string;
  href: string;
  visible: boolean;
};

const emptyDraft = (): Draft => ({
  title: '',
  category: '業務改善ツール',
  statusType: 'developing',
  statusLabel: '開発中',
  desc: '',
  price: '販売予定',
  href: '',
  visible: true,
});

const inputCls =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500';

const isPublished = (r: HpProductRow) => ['公開', 'published', '公開済み'].includes(r.status || r.payload?.publishStatus || '');

/**
 * 公式HP「商品・ツール」ページの掲載管理。
 * 記事と同じく mst_ai_acquisition_records（record_type='product'）に保存し、
 * 保存・削除のたびにHPを再デプロイする。HPには下記の表示項目だけが載る。
 */
export const HpProductListingManager: React.FC<{
  rows: HpProductRow[];
  userId: string;
  onRowsChange: (updater: (prev: HpProductRow[]) => HpProductRow[]) => void;
  kickDeploy: () => Promise<boolean>;
}> = ({ rows, userId, onRowsChange, kickDeploy }) => {
  const products = useMemo(
    () =>
      rows
        .filter((r) => r.record_type === 'product')
        .sort((a, b) => Number(a.payload?.sortOrder || 999) - Number(b.payload?.sortOrder || 999) || a.updated_at.localeCompare(b.updated_at)),
    [rows]
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const say = (msg: string, error = false) => {
    setMessage(msg);
    setIsError(error);
  };
  const deployNote = (ok: boolean) => (ok ? '（HPの再デプロイを開始しました）' : '（※HPに反映するには再デプロイが必要です）');

  const startNew = () => {
    setEditingId('new');
    setDraft(emptyDraft());
    say('');
  };

  const startEdit = (r: HpProductRow) => {
    const p = r.payload || {};
    const statusType = (['available', 'developing', 'planned'].includes(p.statusType) ? p.statusType : 'planned') as HpProductStatusType;
    setEditingId(r.id);
    setDraft({
      title: r.title,
      category: p.category || '',
      statusType,
      statusLabel: p.statusLabel || HP_STATUS_OPTIONS.find((o) => o.value === statusType)?.label || '',
      desc: p.desc || '',
      price: p.price || '',
      href: p.href || '',
      visible: isPublished(r),
    });
    say('');
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return say('掲載タイトルを入力してください。', true);
    if (!draft.desc.trim()) return say('説明文を入力してください。', true);
    const href = draft.href.trim();
    if (href && !/^(https:\/\/|\/)/.test(href)) return say('リンクは https:// か、/ から始まるHP内パスで入力してください。', true);
    const db = getSupabase();
    if (!db || !userId) return say('Supabaseに接続してログインしてください。', true);

    const existing = products.find((r) => r.id === editingId);
    const id = existing?.id || `hpproduct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const status = draft.visible ? '公開' : '非公開';
    const row: HpProductRow = {
      id,
      record_type: 'product',
      title: draft.title.trim(),
      product_id: null,
      status,
      payload: {
        publishStatus: status,
        category: draft.category.trim(),
        statusType: draft.statusType,
        statusLabel: draft.statusLabel.trim(),
        desc: draft.desc.trim(),
        price: draft.price.trim(),
        href,
        sortOrder: existing?.payload?.sortOrder || String(products.length + 1),
      },
      updated_at: new Date().toISOString(),
    };

    setBusy(true);
    const { error } = await db.from('mst_ai_acquisition_records').upsert({ ...row, user_id: userId }, { onConflict: 'user_id,id' });
    if (error) {
      setBusy(false);
      return say('保存できませんでした: ' + error.message, true);
    }
    onRowsChange((prev) => [row, ...prev.filter((r) => r.id !== id)]);
    const deployed = await kickDeploy();
    setBusy(false);
    cancel();
    say(`保存しました。${deployNote(deployed)}`);
  };

  const remove = async (r: HpProductRow) => {
    if (!window.confirm(`「${r.title}」を削除しますか？（HPからも消えます）`)) return;
    const db = getSupabase();
    if (!db) return;
    setBusy(true);
    const { error } = await db.from('mst_ai_acquisition_records').delete().eq('user_id', userId).eq('id', r.id);
    if (error) {
      setBusy(false);
      return say('削除できませんでした: ' + error.message, true);
    }
    onRowsChange((prev) => prev.filter((x) => x.id !== r.id));
    const deployed = isPublished(r) ? await kickDeploy() : true;
    setBusy(false);
    say(`削除しました。${deployNote(deployed)}`);
  };

  const restoreTemplates = async () => {
    const db = getSupabase();
    if (!db || !userId) return say('Supabaseに接続してログインしてください。', true);
    const existingIds = new Set(rows.map((r) => r.id));
    const targets = HP_TEMPLATE_PRODUCTS.filter((t) => !existingIds.has(t.id));
    if (targets.length === 0) return say('テンプレート商品はすべて登録済みです。');
    if (!window.confirm(`テンプレート商品 ${targets.length} 件を「公開」状態で復元します。HPにも反映されます。よろしいですか？`)) return;

    const now = new Date().toISOString();
    const newRows: HpProductRow[] = targets.map((t) => ({
      id: t.id,
      record_type: 'product',
      title: t.title,
      product_id: null,
      status: '公開',
      payload: { ...t.payload, publishStatus: '公開' },
      updated_at: now,
    }));
    setBusy(true);
    const { error } = await db
      .from('mst_ai_acquisition_records')
      .upsert(newRows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,id' });
    if (error) {
      setBusy(false);
      return say('テンプレート商品を復元できませんでした: ' + error.message, true);
    }
    onRowsChange((prev) => [...newRows, ...prev.filter((r) => !targets.some((t) => t.id === r.id))]);
    const deployed = await kickDeploy();
    setBusy(false);
    say(`テンプレート商品を ${targets.length} 件復元しました。${deployNote(deployed)}`);
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-600" />
            <h3 className="font-bold text-base text-slate-900">公式HP「商品・ツール」掲載管理</h3>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            ここに登録した商品・ツールが、公式HPの「商品・ツール」ページに表示されます。保存・削除するとHPが自動で再デプロイされます。
          </p>
        </div>
        {!draft && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void restoreTemplates()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="HPに最初から載っていた4件を復元します（復元後はOSで編集・削除できます）"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              テンプレート商品を復元
            </button>
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              商品・ツールを追加
            </button>
          </div>
        )}
      </div>

      {message && (
        <p role="status" aria-live="polite" className={`text-xs ${isError ? 'text-rose-600' : 'text-emerald-700'}`}>
          {message}
        </p>
      )}

      {draft && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">{editingId === 'new' ? '商品・ツールを追加' : '商品・ツールを編集'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-700 sm:col-span-2">
              掲載タイトル
              <input className={inputCls} value={draft.title} onChange={(e) => update({ title: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-slate-700">
              カテゴリ表示
              <input className={inputCls} value={draft.category} onChange={(e) => update({ category: e.target.value })} placeholder="例: GAS / 業務ツール" />
            </label>
            <label className="text-xs font-medium text-slate-700">
              提供状況
              <select
                className={inputCls}
                value={draft.statusType}
                onChange={(e) => {
                  const statusType = e.target.value as HpProductStatusType;
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
              <input className={inputCls} value={draft.price} onChange={(e) => update({ price: e.target.value })} placeholder="例: 無償配布予定 / 販売予定 / 3,000円" />
            </label>
            <label className="text-xs font-medium text-slate-700">
              HPでの表示
              <select className={inputCls} value={draft.visible ? 'on' : 'off'} onChange={(e) => update({ visible: e.target.value === 'on' })}>
                <option value="on">表示する（公開）</option>
                <option value="off">表示しない（非公開）</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-700 sm:col-span-2">
              説明文
              <textarea className={inputCls} rows={3} value={draft.desc} onChange={(e) => update({ desc: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-slate-700 sm:col-span-2">
              詳細リンク（任意）
              <input
                className={inputCls}
                value={draft.href}
                onChange={(e) => update({ href: e.target.value })}
                placeholder="https://... または /services/care-package（空欄なら「公開時にLINE等でお知らせ」と表示）"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" disabled={busy} onClick={cancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
              キャンセル
            </button>
            <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 cursor-pointer">
              {busy ? '保存中…' : '保存してHPに反映'}
            </button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm font-semibold text-slate-700">掲載中の商品・ツールはまだありません。</p>
          <p className="mt-1 text-xs text-slate-500">「テンプレート商品を復元」で従来の4件を戻すか、「商品・ツールを追加」から登録してください。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((r) => {
            const published = isPublished(r);
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900">{r.title}</h4>
                    {published ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        HP掲載中
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        <EyeOff className="h-3 w-3" />
                        非公開
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {r.payload?.category || 'カテゴリ未設定'} ・ {r.payload?.statusLabel || '-'} ・ {r.payload?.price || '価格表示なし'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(r)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                    編集
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(r)}
                    aria-label={`${r.title}を削除`}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
