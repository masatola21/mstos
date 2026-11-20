import { getAuthHeaders } from '../lib/supabaseClient';
import type { AIWorkModeId } from '../data/aiWorkModes';
import type { KnowledgeItem } from '../types/ai-president';

export function filterVisibleKnowledge(
  items: KnowledgeItem[],
  workModeId: AIWorkModeId,
  audience: 'president' | 'role' | 'custom' = workModeId === 'president' ? 'president' : 'role',
): KnowledgeItem[] {
  return items.filter((item) => {
    const access = item.knowledgeAccess;
    if (!access) return audience === 'president';
    if (access.scope === 'all') return true;
    if (access.scope === 'president') return audience === 'president';
    return (
      audience === 'president' ||
      (audience === 'role' && workModeId !== 'president' && (access.roleIds || []).includes(workModeId))
    );
  });
}

export function selectKnowledgeContext(
  items: KnowledgeItem[],
  request: string,
  workModeId: AIWorkModeId,
  audience: 'president' | 'role' | 'custom' = workModeId === 'president' ? 'president' : 'role',
): string {
  const visibleItems = filterVisibleKnowledge(items, workModeId, audience);
  if (!visibleItems.length) return '';

  const normalize = (value: string) => value.toLowerCase().replace(/[\s、。,.!?！？・「」『』（）【】]/g, '');
  const bigrams = (value: string) => {
    const chars = Array.from(normalize(value));
    const pairs = new Set<string>();
    for (let i = 0; i < chars.length - 1; i += 1) pairs.add(chars[i] + chars[i + 1]);
    return pairs;
  };
  const queryPairs = bigrams(request);
  const preferredCategoriesByRole: Record<string, string[]> = {
    marketing_strategy: ['business', 'product', 'research'],
    marketing_execution: ['product', 'business', 'deliverable'],
    sales_operations: ['customer', 'product'],
    billing_operations: ['business', 'decision'],
    operations_management: ['business', 'decision', 'deliverable'],
    new_product: ['product', 'customer', 'research'],
    customer_product: ['product', 'customer'],
    diagnosis: ['customer', 'research'],
    research: ['research', 'business'],
  };
  const preferredCategories = preferredCategoriesByRole[workModeId] || [];

  const ranked = visibleItems
    .map((item) => {
      const title = normalize(item.title);
      const tags = normalize(item.tags.join(' '));
      const content = normalize(item.content);
      let titleHits = 0;
      let tagHits = 0;
      let contentHits = 0;
      queryPairs.forEach((pair) => {
        if (title.includes(pair)) titleHits += 1;
        else if (tags.includes(pair)) tagHits += 1;
        else if (content.includes(pair)) contentHits += 1;
      });
      const categoryBoost = preferredCategories.includes(item.category) ? 3 : 0;
      const score = titleHits * 4 + tagHits * 3 + contentHits + categoryBoost + (item.category === 'business' ? 1 : 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
    .slice(0, 3);

  return ranked
    .map(({ item }) => `【${item.title} / ${item.category}】\n${item.content.slice(0, 2400)}`)
    .join('\n\n');
}

/**
 * セマンティックRAG（ベクトル検索 + レキシカルフォールバックのハイブリッド検索）
 */
export async function retrieveKnowledgeContext(
  items: KnowledgeItem[],
  request: string,
  workModeId: AIWorkModeId,
  audience: 'president' | 'role' | 'custom' = workModeId === 'president' ? 'president' : 'role',
): Promise<string> {
  const visibleItems = filterVisibleKnowledge(items, workModeId, audience);
  if (!visibleItems.length) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/knowledge/semantic-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      signal: controller.signal,
      body: JSON.stringify({
        query: request,
        items: visibleItems.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          tags: item.tags,
          content: item.content.slice(0, 1000),
          embedding: item.embedding,
        })),
        limit: 3,
      }),
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        return data.matches
          .map((m: any) => {
            const matchItem = visibleItems.find((vi) => vi.id === m.item.id) || m.item;
            const scorePercent = Math.round((m.similarity || 0) * 100);
            return `【${matchItem.title} / ${matchItem.category}（意味関連度: ${scorePercent}%）】\n${matchItem.content.slice(0, 2400)}`;
          })
          .join('\n\n');
      }
    }
  } catch {
    // タイムアウトや失敗時はレキシカル検索へ自動フォールバック
  }

  return selectKnowledgeContext(items, request, workModeId, audience);
}
