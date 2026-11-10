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

// 常設の商品・ツール（コード管理）。
// OS（商品ハブ →「HPに掲載する」）で掲載した商品は、この後ろに自動で追加されます。
export const BASE_PRODUCTS: Product[] = [
  {
    title: '介護保険外サービス開業 実務運営規約・同意書一式',
    category: '法務・運営ドキュメント',
    status: '現在提供中',
    statusType: 'available',
    desc: '生活支援・介護保険外サービスを提供する際に必要な利用規約、免責事項、重要事項説明書、事故対応マニュアルの実務テンプレート一式。',
    price: '開業パッケージにて提供中',
    href: '/services/care-package',
  },
  {
    title: '中小企業向け 業務棚卸し・属人化解消チェックリスト',
    category: 'テンプレート / ガイド',
    status: '開発中',
    statusType: 'developing',
    desc: '社内のどの業務が誰に依存しているかを1枚で可視化し、標準化の優先度を判定できるエクセル＆スプレッドシート形式のチェックシート。',
    price: '無償配布予定（一部有料版あり）',
  },
  {
    title: '案件別 採算・粗利管理スプレッドシート（自動計算GAS付き）',
    category: 'GAS / 業務ツール',
    status: '開発中',
    statusType: 'developing',
    desc: '工数と直接原価を入力するだけで、案件別・取引先別の限界利益と営業利益率を自動集計・グラフ化する管理テンプレート。',
    price: '販売予定',
  },
  {
    title: 'ChatGPT・生成AI 実務導入プロンプトテンプレート集',
    category: 'AI活用テンプレート',
    status: '将来提供予定',
    statusType: 'planned',
    desc: '議事録要約、問い合わせメール一次返信、営業提案書ドラフト、社内マニュアル作成など、中小企業実務で即使える厳選プロンプト集。',
    price: '販売予定',
  },
];

const PUBLISHED = ['公開', 'published', '公開済み'];

/**
 * 常設の商品 + OSで「HPに掲載」した商品を返す。
 * 取得に失敗しても常設の商品は必ず表示する（商品ページを空にしない）。
 */
export async function getLiveProducts(): Promise<Product[]> {
  if (!supabase) return BASE_PRODUCTS;

  const { data, error } = await supabase
    .from('mst_ai_acquisition_records')
    .select('*')
    .eq('record_type', 'product')
    .order('updated_at', { ascending: true });

  if (error) {
    console.warn(`[products] OS掲載分を取得できませんでした: ${error.message}`);
    return BASE_PRODUCTS;
  }

  const remote: Product[] = (data || [])
    .filter((row: any) => PUBLISHED.includes(row.status || row.payload?.publishStatus || ''))
    .map((row: any) => {
      const p = row.payload || {};
      const statusType = ['available', 'developing', 'planned'].includes(p.statusType) ? p.statusType : 'planned';
      return {
        title: row.title || '無題',
        category: p.category || '業務改善ツール',
        status: p.statusLabel || (statusType === 'available' ? '現在提供中' : statusType === 'developing' ? '開発中' : '将来提供予定'),
        statusType,
        desc: p.desc || '',
        price: p.price || '',
        href: p.href || undefined,
      } as Product;
    });

  return [...BASE_PRODUCTS, ...remote];
}
