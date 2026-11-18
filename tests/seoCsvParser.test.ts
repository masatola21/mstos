import { parseSeoCsv, resolvePageInfo } from '../src/utils/seoCsvParser';

function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }

const sampleGscPages = `Top pages,Clicks,Impressions,CTR,Position
https://corp.mstcorp.info/posts/dx-efficiency,145,2800,5.18%,3.8
https://corp.mstcorp.info/posts/ai-operations,82,1200,6.83%,5.2
https://corp.mstcorp.info/posts/workflow-automation,23,980,2.35%,11.4
`;

const mockArticles = [
  { id: 'art-1', title: 'DX業務効率化の完全ガイド', payload: { slug: 'dx-efficiency' } },
  { id: 'art-2', title: '中小企業のためのAI業務活用術', payload: { slug: 'ai-operations' } },
];

const result = parseSeoCsv(sampleGscPages, mockArticles);
assert(result.rows.length === 3, '3 rows parsed');
assert(result.rows[0].clicks === 145, 'clicks 145');
assert(result.rows[0].impressions === 2800, 'impressions 2800');
assert(result.rows[0].avgPosition === 3.8, 'position 3.8');
assert(result.rows[0].matchedArticleId === 'art-1', 'matched article 1');
assert(result.rows[1].matchedArticleId === 'art-2', 'matched article 2');
assert(result.rows[2].matchedArticleId === undefined, 'unmatched article 3');
assert(result.rows[0].resolvedTitle === '📄 DX業務効率化の完全ガイド', 'resolvedTitle for article');
assert(result.totalClicks === 250, 'total clicks 250');
assert(result.totalImpressions === 4980, 'total impressions 4980');

// 日本語ヘッダー
const sampleJp = `上位のページ,クリック数,表示回数,CTR,掲載順位
https://corp.mstcorp.info/posts/dx-efficiency,100,"1,500",6.67%,4.0
`;
const resultJp = parseSeoCsv(sampleJp, mockArticles);
assert(resultJp.rows.length === 1, 'jp 1 row');
assert(resultJp.rows[0].impressions === 1500, 'jp impressions parsed with comma');

// resolvePageInfo のテスト
const homeInfo = resolvePageInfo('https://corp.mstcorp.info/', mockArticles);
assert(homeInfo.pageType === 'home', 'home type');
assert(homeInfo.displayName.includes('トップページ'), 'home display name');

const mediaInfo = resolvePageInfo('https://corp.mstcorp.info/media', mockArticles);
assert(mediaInfo.pageType === 'media_index', 'media index type');

const contactInfo = resolvePageInfo('https://corp.mstcorp.info/contact/', mockArticles);
assert(contactInfo.pageType === 'contact', 'contact type');

const queryInfo = resolvePageInfo('dx 業務効率化 ツール', mockArticles);
assert(queryInfo.pageType === 'query', 'query type');

console.log('seoCsvParser.test.ts: all assertions passed!');
