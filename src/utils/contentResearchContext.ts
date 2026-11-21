import type { KnowledgeItem } from '../types/ai-president';
import { filterVisibleKnowledge } from './knowledgeContext';

/**
 * SNS投稿・動画構成案の「テーマ・タイトルだけ入れれば、OS内の情報をAIが自分で集める」ための
 * コンテキスト組み立てロジック。
 *
 * 集める場所: 社内ナレッジ / 自社メディア記事 / 資料・成果物保管庫 / 商品情報 / 集客戦略
 * （顧客個人の氏名・メール・商談メモなどの個人情報は、公開発信に混ざらないよう対象外）
 */

export interface ResearchArticle {
  id: string;
  title: string;
  payload?: { outline?: string; body?: string; slug?: string } | null;
}

export interface ResearchAsset {
  id: string;
  title: string;
  notes?: string | null;
  external_url?: string | null;
}

export interface ResearchProduct {
  id: string;
  product_name: string;
  description?: string | null;
  summary?: string | null;
  features?: string | null;
  target_customer?: string | null;
  initial_fee?: number | null;
  monthly_fee?: number | null;
}

export type ResearchSourceKind = 'knowledge' | 'article' | 'asset' | 'product';

export interface ResearchReference {
  kind: ResearchSourceKind;
  id: string;
  title: string;
  score: number;
}

export interface AutoContentContextInput {
  /** テーマ・タイトル（必須） */
  theme: string;
  /** 切り口・補足（任意） */
  angle?: string;
  knowledgeItems: KnowledgeItem[];
  articles: ResearchArticle[];
  assets: ResearchAsset[];
  products: ResearchProduct[];
  /** 参照範囲（knowledgeAccess）で絞り込む際の役割。既定は SNS・動画を作るマーケ実行担当 */
  workModeId?: Parameters<typeof filterVisibleKnowledge>[1];
  maxKnowledge?: number;
  maxArticles?: number;
  maxAssets?: number;
  maxProducts?: number;
}

export interface AutoContentContextResult {
  /** AIへ渡す「入力情報」ブロック */
  inputContext: string;
  /** AIへ渡す「参考ナレッジ」ブロック（/api/chat の knowledgeContext 用） */
  knowledgeContext: string;
  /** どの情報を参照したか（画面表示用） */
  references: ResearchReference[];
  /** 参照範囲の設定により、AIには渡さず除外したナレッジ件数 */
  excludedKnowledgeCount: number;
  /** テーマと関連する情報が1件も見つからなかった場合 true（直近の情報で補完した） */
  usedFallback: boolean;
}

const STOP_CHARS = /[\s、。,.!?！？・「」『』（）()【】\[\]:：;；/／\-_"'“”‘’]/g;

function normalize(value: string): string {
  return String(value || '').toLowerCase().replace(STOP_CHARS, '');
}

function bigrams(value: string): Set<string> {
  const chars = Array.from(normalize(value));
  const pairs = new Set<string>();
  for (let i = 0; i < chars.length - 1; i += 1) pairs.add(chars[i] + chars[i + 1]);
  // 1〜2文字のテーマ（例:「採用」）でも検索できるよう単字も許容
  if (chars.length === 1) pairs.add(chars[0]);
  return pairs;
}

/** タイトル一致を最も重く、次にタグ、本文の順で評価する */
export function scoreTextMatch(
  queryPairs: Set<string>,
  parts: { title?: string; tags?: string; body?: string },
): number {
  if (queryPairs.size === 0) return 0;
  const title = normalize(parts.title || '');
  const tags = normalize(parts.tags || '');
  const body = normalize(parts.body || '');
  let score = 0;
  queryPairs.forEach((pair) => {
    if (title.includes(pair)) score += 4;
    else if (tags.includes(pair)) score += 3;
    else if (body.includes(pair)) score += 1;
  });
  return score;
}

function clip(text: string | null | undefined, max: number): string {
  const t = String(text || '').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function rank<T>(
  items: T[],
  scorer: (item: T) => number,
  limit: number,
): Array<{ item: T; score: number }> {
  return items
    .map((item) => ({ item, score: scorer(item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildAutoContentContext(input: AutoContentContextInput): AutoContentContextResult {
  const theme = String(input.theme || '').trim();
  const angle = String(input.angle || '').trim();
  const query = `${theme} ${angle}`.trim();
  const queryPairs = bigrams(query);

  const maxKnowledge = input.maxKnowledge ?? 4;
  const maxArticles = input.maxArticles ?? 2;
  const maxAssets = input.maxAssets ?? 2;
  const maxProducts = input.maxProducts ?? 2;

  const workModeId = input.workModeId ?? 'marketing_execution';
  const visibleKnowledge = filterVisibleKnowledge(input.knowledgeItems, workModeId, 'role');
  const excludedKnowledgeCount = Math.max(0, input.knowledgeItems.length - visibleKnowledge.length);

  const rankedKnowledge = rank(
    visibleKnowledge,
    (k) => scoreTextMatch(queryPairs, { title: k.title, tags: (k.tags || []).join(' '), body: k.content }),
    maxKnowledge,
  );
  const rankedArticles = rank(
    input.articles,
    (a) => scoreTextMatch(queryPairs, { title: a.title, body: `${a.payload?.outline || ''} ${a.payload?.body || ''}` }),
    maxArticles,
  );
  const rankedAssets = rank(
    input.assets,
    (a) => scoreTextMatch(queryPairs, { title: a.title, body: a.notes || '' }),
    maxAssets,
  );
  const rankedProducts = rank(
    input.products,
    (p) =>
      scoreTextMatch(queryPairs, {
        title: p.product_name,
        body: `${p.description || ''} ${p.summary || ''} ${p.features || ''} ${p.target_customer || ''}`,
      }),
    maxProducts,
  );

  let usedFallback = false;
  let knowledgeForPrompt = rankedKnowledge.map((r) => r.item);

  // テーマに近い情報が1件も無い場合でも空振りにならないよう、直近更新のナレッジで補完する
  const totalHits = rankedKnowledge.length + rankedArticles.length + rankedAssets.length + rankedProducts.length;
  if (totalHits === 0) {
    usedFallback = true;
    knowledgeForPrompt = [...visibleKnowledge].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 2);
  }

  const references: ResearchReference[] = [];
  const knowledgeBlocks: string[] = [];
  const sourceBlocks: string[] = [];

  knowledgeForPrompt.forEach((k) => {
    const hit = rankedKnowledge.find((r) => r.item.id === k.id);
    references.push({ kind: 'knowledge', id: k.id, title: k.title, score: hit?.score ?? 0 });
    knowledgeBlocks.push(`【社内ナレッジ: ${k.title}（${k.category}）】\n${clip(k.content, 1400)}`);
  });

  rankedArticles.forEach(({ item: a, score }) => {
    references.push({ kind: 'article', id: a.id, title: a.title, score });
    sourceBlocks.push(
      `【自社メディア記事: ${a.title}】\n概要: ${clip(a.payload?.outline, 300)}\n本文抜粋: ${clip(a.payload?.body, 900)}`,
    );
  });

  rankedAssets.forEach(({ item: a, score }) => {
    references.push({ kind: 'asset', id: a.id, title: a.title, score });
    sourceBlocks.push(`【資料・成果物: ${a.title}】\n${clip(a.notes, 900)}${a.external_url ? `\nURL: ${a.external_url}` : ''}`);
  });

  rankedProducts.forEach(({ item: p, score }) => {
    references.push({ kind: 'product', id: p.id, title: p.product_name, score });
    const fees = [
      p.initial_fee ? `初期費用 ${Number(p.initial_fee).toLocaleString('ja-JP')}円` : '',
      p.monthly_fee ? `月額 ${Number(p.monthly_fee).toLocaleString('ja-JP')}円` : '',
    ]
      .filter(Boolean)
      .join(' / ');
    sourceBlocks.push(
      [
        `【商品・サービス: ${p.product_name}】`,
        p.description || p.summary ? `内容: ${clip(p.description || p.summary, 500)}` : '',
        p.features ? `特徴: ${clip(p.features, 400)}` : '',
        p.target_customer ? `対象: ${clip(p.target_customer, 200)}` : '',
        fees ? `料金: ${fees}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  });

  const inputContext = [
    '【入力元: テーマ・タイトルからOS内の情報を自動収集】',
    `テーマ・タイトル: ${theme}`,
    `切り口・補足指示: ${angle || 'このテーマについて、下記の自社情報から経営者・見込み客にとって有益で、自社ならではの具体性がある内容を選んで構成してください。'}`,
    sourceBlocks.length > 0
      ? `\n【OS内から集めた関連情報（事実の根拠として使用してください）】\n${sourceBlocks.join('\n\n')}`
      : '',
    '\n※上記の情報に無い数字・実績・固有名詞は創作せず、情報が足りない部分は一般論や問いかけで補ってください。',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    inputContext,
    knowledgeContext: knowledgeBlocks.join('\n\n'),
    references,
    excludedKnowledgeCount,
    usedFallback,
  };
}

export const RESEARCH_KIND_LABELS: Record<ResearchSourceKind, string> = {
  knowledge: 'ナレッジ',
  article: '記事',
  asset: '資料',
  product: '商品',
};
