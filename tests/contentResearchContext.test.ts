import assert from 'node:assert/strict';
import { buildAutoContentContext } from '../src/utils/contentResearchContext';
import type { KnowledgeItem } from '../src/types/ai-president';

console.log('=== Running Content Research Context (auto-collect for SNS/video) Tests ===');

const now = Date.now();
const mk = (over: Partial<KnowledgeItem> & { id: string; title: string; content: string }): KnowledgeItem => ({
  category: 'business',
  tags: [],
  createdAt: now,
  updatedAt: now,
  knowledgeAccess: { scope: 'all' } as any,
  ...over,
});

const knowledge: KnowledgeItem[] = [
  mk({ id: 'k1', title: '採用の仕組み化チェックリスト', content: '求人票の改善と面接評価シートの統一で応募数が増えた。', tags: ['採用'] }),
  mk({ id: 'k2', title: '請求書の発行フロー', content: '月末締めの請求を自動化する手順。' }),
  mk({ id: 'k3', title: '社長だけが見る資金繰りメモ', content: '採用計画と資金繰りの内部メモ。', knowledgeAccess: { scope: 'president' } as any }),
];

// Test 1: テーマに近い情報を自動で選ぶ（タイトル一致が優先される）
const r1 = buildAutoContentContext({
  theme: '採用の仕組み化',
  knowledgeItems: knowledge,
  articles: [{ id: 'a1', title: '採用ミスマッチを防ぐ3つの工夫', payload: { outline: '面接前の期待値すり合わせ', body: '採用の現場では…' } }],
  assets: [{ id: 's1', title: '請求書テンプレート', notes: '請求用' }],
  products: [{ id: 'p1', product_name: '採用支援パッケージ', description: '採用の仕組み化を支援', monthly_fee: 50000 }],
});
assert.equal(r1.usedFallback, false);
assert.ok(r1.references.some((r) => r.kind === 'knowledge' && r.id === 'k1'), '関連ナレッジを拾う');
assert.ok(r1.references.some((r) => r.kind === 'article' && r.id === 'a1'), '関連記事を拾う');
assert.ok(r1.references.some((r) => r.kind === 'product' && r.id === 'p1'), '関連商品を拾う');
assert.ok(!r1.references.some((r) => r.id === 's1'), '無関係な資料は拾わない');
assert.ok(r1.inputContext.includes('採用支援パッケージ') && r1.inputContext.includes('50,000円'), '商品情報と料金が入る');
assert.ok(r1.knowledgeContext.includes('採用の仕組み化チェックリスト'));
console.log('  -> PASSED: relevant sources are collected across knowledge/articles/products.');

// Test 2: 参照範囲が「社長のみ」のナレッジはAIに渡さず、除外件数として報告する
assert.ok(!r1.references.some((r) => r.id === 'k3'), '社長限定ナレッジは除外');
assert.ok(!r1.knowledgeContext.includes('資金繰り'), '社長限定の内容が漏れない');
assert.equal(r1.excludedKnowledgeCount, 1);
console.log('  -> PASSED: president-only knowledge is excluded and counted.');

// Test 3: テーマに合う情報が無くても空振りにならず、直近のナレッジで補完する
const r3 = buildAutoContentContext({
  theme: 'ゼロから始める宇宙開発',
  knowledgeItems: knowledge,
  articles: [],
  assets: [],
  products: [],
});
assert.equal(r3.usedFallback, true);
assert.ok(r3.references.length > 0 && r3.references.every((r) => r.kind === 'knowledge'));
console.log('  -> PASSED: falls back to recent knowledge when nothing matches.');

// Test 4: 創作防止の指示と、テーマ・切り口が入力情報に含まれる
const r4 = buildAutoContentContext({
  theme: '請求の自動化',
  angle: '失敗談を交えて',
  knowledgeItems: knowledge,
  articles: [],
  assets: [],
  products: [],
});
assert.ok(r4.inputContext.includes('テーマ・タイトル: 請求の自動化'));
assert.ok(r4.inputContext.includes('失敗談を交えて'));
assert.ok(r4.inputContext.includes('創作せず'));
console.log('  -> PASSED: theme/angle and anti-fabrication guard are present.');

console.log('=== Content Research Context tests passed ===');
