import { supabase } from '../lib/supabase';

export interface Product {
  title: string;
  category: string;
  status: string;
  statusType: 'available' | 'developing' | 'planned';
  desc: string;
  price: string;
  href?: string;
}

const PUBLISHED = ['公開', 'published', '公開済み'];

/**
 * OS（集客戦略・SNS・メディア →「自社HP・連携設定」→「商品・ツール掲載管理」）で
 * 公開中の商品・ツールを取得する。
 * Supabase未接続・取得エラー時は例外を投げてビルドを失敗させる（空のページを公開しないため）。
 * 0件は正常として [] を返す。
 */
export async function getLiveProducts(): Promise<Product[]> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized. Please ensure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are configured.');
  }

  const { data, error } = await supabase
    .from('mst_ai_acquisition_records')
    .select('*')
    .eq('record_type', 'product')
    .order('updated_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load products from Supabase: ${error.message} (code: ${error.code})`);
  }

  return (data || [])
    .filter((row: any) => PUBLISHED.includes(row.status || row.payload?.publishStatus || ''))
    .sort((a: any, b: any) => Number(a.payload?.sortOrder || 999) - Number(b.payload?.sortOrder || 999))
    .map((row: any) => {
      const p = row.payload || {};
      const statusType: Product['statusType'] = ['available', 'developing', 'planned'].includes(p.statusType) ? p.statusType : 'planned';
      return {
        title: row.title || '無題',
        category: p.category || '業務改善ツール',
        status: p.statusLabel || (statusType === 'available' ? '現在提供中' : statusType === 'developing' ? '開発中' : '将来提供予定'),
        statusType,
        desc: p.desc || '',
        price: p.price || '',
        href: p.href || undefined,
      };
    });
}
