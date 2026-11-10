import { getSupabase } from '../lib/supabaseClient';
import type { ManagedProduct } from '../types/matrix';
import { formatProductPrice } from './productCatalogService';

/**
 * OSの商品マスタを、公式HP「商品・ツール」ページへ掲載するためのサービス。
 *
 * 記事と同じ仕組みで mst_ai_acquisition_records に record_type='product' で保存する。
 * HPに出すのは下記の表示項目だけ（原価・KPI・契約などの内部情報は含めない）。
 * 掲載・取り下げのたびに、メディア設定の Vercel Deploy Hook でHPを再デプロイする。
 */

export type HpListingStatusType = 'available' | 'developing' | 'planned';

export type HpProductListing = {
  title: string;
  category: string;
  statusType: HpListingStatusType;
  statusLabel: string;
  desc: string;
  price: string;
  href: string;
};

const STATUS_LABELS: Record<HpListingStatusType, string> = {
  available: '現在提供中',
  developing: '開発中',
  planned: '将来提供予定',
};

export const HP_STATUS_OPTIONS: { value: HpListingStatusType; label: string }[] = [
  { value: 'available', label: STATUS_LABELS.available },
  { value: 'developing', label: STATUS_LABELS.developing },
  { value: 'planned', label: STATUS_LABELS.planned },
];

export const hpProductRecordId = (productId: string) => `hpproduct-${productId}`;

/** 商品マスタの内容から、HP掲載の初期値を作る（掲載前に画面で編集できる） */
export function buildDefaultListing(product: ManagedProduct): HpProductListing {
  const statusType: HpListingStatusType =
    product.status === 'active' ? 'available' : product.status === 'developing' ? 'developing' : 'planned';
  return {
    title: product.name,
    category: product.category?.trim() || '業務改善ツール',
    statusType,
    statusLabel: STATUS_LABELS[statusType],
    desc: product.description?.trim() || '',
    price: formatProductPrice(product).label,
    href: '',
  };
}

type Result = { ok: boolean; message: string };

type Ctx =
  | { ok: true; db: NonNullable<ReturnType<typeof getSupabase>>; userId: string }
  | { ok: false; error: string };

async function getContext(): Promise<Ctx> {
  const db = getSupabase();
  if (!db) return { ok: false, error: 'Supabaseに接続してください。' };
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return { ok: false, error: 'ログイン状態を確認できません。' };
  return { ok: true, db, userId: data.user.id };
}

/** メディア設定に登録されたVercel Deploy HookでHPを再デプロイする */
async function kickHpDeploy(db: NonNullable<ReturnType<typeof getSupabase>>, userId: string): Promise<boolean> {
  const { data } = await db
    .from('mst_ai_acquisition_records')
    .select('payload')
    .eq('user_id', userId)
    .eq('record_type', 'media');
  const hook = (data || [])
    .map((r: any) => r?.payload?.vercelDeployHook as string | undefined)
    .find((h) => typeof h === 'string' && h.startsWith('https://'));
  if (!hook) return false;
  try {
    await fetch(hook, { method: 'POST', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}

const deployNote = (triggered: boolean) =>
  triggered ? '（HPの再デプロイを開始しました）' : '（※HPに反映するには再デプロイが必要です）';

/** この商品が現在HPに掲載されていれば、その掲載内容を返す */
export async function loadHpListing(productId: string): Promise<HpProductListing | null> {
  const ctx = await getContext();
  if (!ctx.ok) return null;
  const { data } = await ctx.db
    .from('mst_ai_acquisition_records')
    .select('title,status,payload')
    .eq('user_id', ctx.userId)
    .eq('id', hpProductRecordId(productId))
    .maybeSingle();
  if (!data) return null;
  const p = (data.payload || {}) as Record<string, string>;
  const statusType = (['available', 'developing', 'planned'].includes(p.statusType) ? p.statusType : 'planned') as HpListingStatusType;
  return {
    title: data.title,
    category: p.category || '',
    statusType,
    statusLabel: p.statusLabel || STATUS_LABELS[statusType],
    desc: p.desc || '',
    price: p.price || '',
    href: p.href || '',
  };
}

export async function publishProductToHp(product: ManagedProduct, listing: HpProductListing): Promise<Result> {
  if (!listing.title.trim()) return { ok: false, message: '掲載タイトルを入力してください。' };
  if (!listing.desc.trim()) return { ok: false, message: '説明文を入力してください。' };
  const href = listing.href.trim();
  if (href && !/^(https:\/\/|\/)/.test(href)) {
    return { ok: false, message: 'リンクは https:// か、/ から始まるHP内パスで入力してください。' };
  }
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, message: ctx.error };

  const { error } = await ctx.db.from('mst_ai_acquisition_records').upsert(
    {
      user_id: ctx.userId,
      id: hpProductRecordId(product.id),
      record_type: 'product',
      title: listing.title.trim(),
      product_id: null,
      status: '公開',
      payload: {
        publishStatus: '公開',
        sourceProductId: product.id,
        category: listing.category.trim(),
        statusType: listing.statusType,
        statusLabel: listing.statusLabel.trim() || STATUS_LABELS[listing.statusType],
        desc: listing.desc.trim(),
        price: listing.price.trim(),
        href,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,id' }
  );
  if (error) return { ok: false, message: 'HPに掲載できませんでした: ' + error.message };
  return { ok: true, message: `HPの商品・ツールページに掲載しました。${deployNote(await kickHpDeploy(ctx.db, ctx.userId))}` };
}

export async function unpublishProductFromHp(productId: string): Promise<Result> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, message: ctx.error };
  const { error } = await ctx.db
    .from('mst_ai_acquisition_records')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('id', hpProductRecordId(productId));
  if (error) return { ok: false, message: 'HPから外せませんでした: ' + error.message };
  return { ok: true, message: `HPの掲載を外しました。${deployNote(await kickHpDeploy(ctx.db, ctx.userId))}` };
}
