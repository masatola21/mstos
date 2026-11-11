import { supabase } from '../lib/supabase';

export interface Article {
  id?: string;
  slug: string;
  title: string;
  category: '経営改善・利益改善' | '業務改善・業務効率化' | 'マーケティング・集客' | 'IT・DX・AI活用' | '新規事業・事業づくり' | string;
  categorySlug: 'management' | 'operations' | 'marketing' | 'it-dx' | 'new-business' | string;
  publishedAt: string;
  date?: string;
  summary: string;
  description?: string;
  content: string[];
  heroImage: string;
  thumbnailTheme?: {
    bgGradient: string;
    icon: string;
    accentColor: string;
  };
  relatedService?: {
    name: string;
    href: string;
  };
}

export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  management: '/images/service-strategy.jpg',
  operations: '/images/service-it-dx.jpg',
  marketing: '/images/service-marketing.jpg',
  'it-dx': '/images/service-system.jpg',
  'new-business': '/images/consulting-meeting.jpg',
};
export const DEFAULT_HERO_IMAGE = '/images/hero-consulting.jpg';

export const CATEGORY_MAP: Record<string, { name: Article['category']; slug: Article['categorySlug'] }> = {
  management: { name: '経営改善・利益改善', slug: 'management' },
  operations: { name: '業務改善・業務効率化', slug: 'operations' },
  marketing: { name: 'マーケティング・集客', slug: 'marketing' },
  'it-dx': { name: 'IT・DX・AI活用', slug: 'it-dx' },
  'new-business': { name: '新規事業・事業づくり', slug: 'new-business' },
};

// カテゴリごとのサムネイル配色。
// Tailwindは「コード内にそのまま書かれたクラス名」しか出力しないため、
// DBに保存された色指定は使わず、ここにリテラルで定義する（白抜けの防止）。
export const CATEGORY_THEME: Record<string, { bgGradient: string; accentColor: string }> = {
  management: { bgGradient: 'from-blue-900 to-slate-900', accentColor: 'text-brand-300' },
  operations: { bgGradient: 'from-slate-800 to-slate-950', accentColor: 'text-slate-300' },
  marketing: { bgGradient: 'from-emerald-950 to-slate-900', accentColor: 'text-emerald-300' },
  'it-dx': { bgGradient: 'from-brand-900 to-slate-900', accentColor: 'text-brand-300' },
  'new-business': { bgGradient: 'from-amber-950 to-slate-900', accentColor: 'text-amber-300' },
};
const DEFAULT_THEME = { bgGradient: 'from-brand-900 to-slate-900', accentColor: 'text-brand-300' };

// 直書き記事（空配列。Supabase直接連携）
export const ARTICLES: Article[] = [];

/**
 * Supabase（mstosのAI集客運用）から公開中の最新記事を取得する
 * !supabase、取得エラー、catch ではフォールバックせず例外を投げてビルドを失敗させる（空のHPを公開しないため）
 * 0件は正常として [] を返す
 */
export async function getLiveArticles(): Promise<Article[]> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized. Please ensure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are configured.');
  }

  const { data, error } = await supabase
    .from('mst_ai_acquisition_records')
    .select('*')
    .eq('record_type', 'article')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load articles from Supabase: ${error.message} (code: ${error.code})`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Supabaseから取得した記事を Article 型に変換
  const remoteArticles: Article[] = data
    .filter((row: any) => {
      const payload = row.payload || {};
      const status = row.status || payload.publishStatus || '';
      return ['公開', 'published', '公開済み'].includes(status);
    })
    .map((row: any) => {
      const p = row.payload || {};
      const slug = p.slug || row.id || `article-${row.created_at?.slice(0, 10)}`;
      const category = p.category || '経営改善・利益改善';
      const categorySlug =
        Object.values(CATEGORY_MAP).find((c) => c.name === category)?.slug || 'management';

      // 本文を行単位の配列に変換
      const rawBody = p.body || p.content || '';
      const contentLines = rawBody
        .split(/\n\n+|\r\n\r\n+/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      const publishedAt = p.publishedDate || row.created_at?.slice(0, 10)?.replace(/-/g, '.') || '2026.10.29';
      const summary = p.metaDescription || p.excerpt || p.summary || '';
      const heroImage = p.heroImage || p.thumbnail || p.image || CATEGORY_IMAGE_MAP[categorySlug] || DEFAULT_HERO_IMAGE;

      return {
        id: row.id,
        slug,
        title: row.title || p.metaTitle || '無題の記事',
        category,
        categorySlug,
        publishedAt,
        date: publishedAt,
        summary,
        description: summary,
        heroImage,
        content: contentLines.length > 0 ? contentLines : [p.body || ''],
        thumbnailTheme: {
          bgGradient: (CATEGORY_THEME[categorySlug] || DEFAULT_THEME).bgGradient,
          icon: p.icon || 'file-text',
          accentColor: (CATEGORY_THEME[categorySlug] || DEFAULT_THEME).accentColor,
        },
        relatedService: p.relatedServiceName
          ? {
              name: p.relatedServiceName,
              href: p.relatedServiceHref || '/services',
            }
          : {
              name: '経営戦略・利益改善顧問',
              href: '/services/strategy',
            },
      };
    });

  return remoteArticles;
}
