import { supabase } from '../lib/supabase';

export const CATEGORY_MAP = {
    management: { name: '経営改善・利益改善', slug: 'management' },
    operations: { name: '業務改善・業務効率化', slug: 'operations' },
    marketing: { name: 'マーケティング・集客', slug: 'marketing' },
    'it-dx': { name: 'IT・DX・AI活用', slug: 'it-dx' },
    'new-business': { name: '新規事業・事業づくり', slug: 'new-business' },
};

// 直書き記事（空配列。Supabase直接連携）
export const ARTICLES = [];

/**
 * Supabase（mstosのAI集客運用）から公開中の最新記事を取得する
 * !supabase、取得エラー、catch ではフォールバックせず例外を投げてビルドを失敗させる（空のHPを公開しないため）
 * 0件は正常として [] を返す
 */
export async function getLiveArticles() {
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
    const remoteArticles = data
        .filter((row) => {
            const payload = row.payload || {};
            const status = row.status || payload.publishStatus || '';
            return ['公開', 'published', '公開済み'].includes(status);
        })
        .map((row) => {
            const p = row.payload || {};
            const slug = p.slug || row.id || `article-${row.created_at?.slice(0, 10)}`;
            const category = p.category || '経営改善・利益改善';
            const categorySlug =
                Object.values(CATEGORY_MAP).find((c) => c.name === category)?.slug || 'management';

            // 本文を行単位の配列に変換
            const rawBody = p.body || p.content || '';
            const contentLines = rawBody
                .split(/\n\n+|\r\n\r\n+/)
                .map((s) => s.trim())
                .filter(Boolean);

            return {
                id: row.id,
                slug,
                title: row.title || p.metaTitle || '無題の記事',
                category,
                categorySlug,
                publishedAt: p.publishedDate || row.created_at?.slice(0, 10)?.replace(/-/g, '.') || '2026.10.29',
                summary: p.metaDescription || p.excerpt || p.summary || '',
                content: contentLines.length > 0 ? contentLines : [p.body || ''],
                thumbnailTheme: {
                    bgGradient: p.bgGradient || 'from-brand-900 to-slate-900',
                    icon: p.icon || 'file-text',
                    accentColor: 'text-brand-300',
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
