import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => { store.set(key, String(value)); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
};

import {
  DEFAULT_KNOWLEDGE_ITEMS,
  MST_CORE_BUSINESS_PROFILE,
  seedMissingDefaultKnowledge,
  upsertOfficialDefaultKnowledge,
} from '../src/data/defaultKnowledge.js';
import {
  hasLocalKnowledgeCache,
  hasSeededDefaultKnowledge,
  loadKnowledgeItems,
  saveKnowledgeItems,
} from '../src/utils/storage.js';
import { selectKnowledgeContext } from '../src/utils/knowledgeContext.js';
import { buildSystemInstruction } from '../server/chatPromptBuilder.js';

describe('Default MST & HP/LP/OS Knowledge Tests', () => {
  beforeEach(() => {
    store.clear();
  });

  it('DEFAULT_KNOWLEDGE_ITEMS cover company profile, services, care package, target industries, and OS workflow with scope=all', () => {
    assert.equal(DEFAULT_KNOWLEDGE_ITEMS.length, 5);
    for (const item of DEFAULT_KNOWLEDGE_ITEMS) {
      assert.equal(item.knowledgeAccess?.scope, 'all', `${item.id} should be accessible to all AIs`);
      assert.ok(item.title.length > 0);
      assert.ok(item.content.length > 50);
    }
    const joined = DEFAULT_KNOWLEDGE_ITEMS.map((i) => `${i.title}\n${i.content}`).join('\n');
    assert.ok(joined.includes('有限会社MST'));
    assert.ok(joined.includes('経営戦略・利益改善顧問'));
    assert.ok(joined.includes('介護保険外サービス開業パッケージ'));
    assert.ok(joined.includes('工事業') && joined.includes('店舗サービス業'));
    assert.ok(joined.includes('MST経営OS'));
    assert.ok(MST_CORE_BUSINESS_PROFILE.includes('一緒に会社を成長させていく'));
    assert.ok(MST_CORE_BUSINESS_PROFILE.includes('必ず役に立てる'));
    assert.ok(MST_CORE_BUSINESS_PROFILE.includes('自分のため'));
    assert.ok(DEFAULT_KNOWLEDGE_ITEMS[0].content.includes('一緒に会社を成長させていく'));
    assert.ok(DEFAULT_KNOWLEDGE_ITEMS[0].content.includes('必ず役に立てる'));
    assert.ok(DEFAULT_KNOWLEDGE_ITEMS[0].content.includes('自分のため'));
  });

  it('buildSystemInstruction injects MST_CORE_BUSINESS_PROFILE for all AIs while preventing unsolicited pricing/sales claims', () => {
    const prompt = buildSystemInstruction({
      name: 'セイル',
      role: '営業・顧客管理',
      personality: '誠実',
      tone: '簡潔',
    });
    assert.ok(prompt.includes('有限会社MST'));
    assert.ok(prompt.includes(MST_CORE_BUSINESS_PROFILE));
    assert.ok(prompt.includes('一緒に会社を成長させていく'));
    assert.ok(prompt.includes('必ず役に立てる'));
    assert.ok(prompt.includes('自分のため'));
    assert.ok(prompt.includes('サービス名や金額を勝手に断定'));
  });

  it('loadKnowledgeItems provides defaults for fresh browsers and seeds once for existing empty workspaces without resurrecting deletions', () => {
    assert.equal(hasLocalKnowledgeCache(), false);
    const fresh = loadKnowledgeItems();
    assert.equal(fresh.length, 5);

    // Existing workspace previously saved empty array before seed feature existed
    store.clear();
    store.set('mst_knowledge_library_v1', JSON.stringify([]));
    assert.equal(hasLocalKnowledgeCache(), true);
    assert.equal(hasSeededDefaultKnowledge(), false);

    const migrated = loadKnowledgeItems();
    assert.equal(migrated.length, 5, 'Seeds official defaults once on existing workspace');
    assert.equal(hasSeededDefaultKnowledge(), true);

    // User intentionally deletes one default item and saves
    const afterDelete = migrated.filter((i) => i.id !== 'mst-default-os-workflow');
    saveKnowledgeItems(afterDelete);
    const reloaded = loadKnowledgeItems();
    assert.equal(reloaded.length, 4, 'Deleted default item should not resurrect on reload');
  });

  it('seedMissingDefaultKnowledge safely upgrades untouched v1 company profile to v2 without overwriting user edits', () => {
    const v1ProfileContent = `■ 会社基本情報
・会社名: 有限会社MST（MST Co., Ltd.）
・代表者: 代表取締役 大橋 真人
・設立: 平成17年（2005年）6月16日 / 資本金: 3,000,000円
・所在地: 〒503-0981 岐阜県大垣市桧町127番地
・連絡先: contact@mstcorp.info

■ 代表の実務背景と支援スタンス
代表自身がWeb事業起業、スクール運営、自動車流通、M&Aによる事業承継、実店舗サロン経営、介護保険外生活支援サービス「アシスタ大垣」の直営など、多様な現場で事業立ち上げと経営改善を実践。
・コア方針: 「経営の仕組み化 × 利益改善」
・基本スタンス: すべてをシステム化するのではなく、人が担うべきことと仕組みで効率化すべきことを見極め、中小企業が無理なく運用・自走できる形に落とし込む。`;

    const untouchedV1 = [
      {
        id: 'mst-default-company-profile',
        title: '有限会社MST 会社概要と代表スタンス（公式HPベース）',
        category: 'business' as const,
        content: v1ProfileContent,
        tags: ['MST', '会社概要'],
        createdAt: 1000,
        updatedAt: 1000,
        knowledgeAccess: { scope: 'all' as const, roleIds: [] },
      },
    ];
    const upgraded = seedMissingDefaultKnowledge(untouchedV1);
    assert.equal(upgraded.length, 1);
    assert.ok(upgraded[0].content.includes('一緒に会社を成長させていく'));
    assert.ok(upgraded[0].content.includes('必ず役に立てる'));
    assert.ok(upgraded[0].content.includes('自分のため'));

    const customizedV1 = [
      {
        ...untouchedV1[0],
        content: `${v1ProfileContent}\n\n■ 自社メモ: 独自追記`,
      },
    ];
    const preserved = seedMissingDefaultKnowledge(customizedV1);
    assert.equal(preserved[0].content, customizedV1[0].content);
  });

  it('seedMissingDefaultKnowledge and upsertOfficialDefaultKnowledge preserve user items cleanly', () => {
    const customItem = {
      id: 'custom-user-1',
      title: '自社独自ルール',
      category: 'business' as const,
      content: '商談時の社内チェックリスト',
      tags: ['社内'],
      createdAt: 1000,
      updatedAt: 1000,
      knowledgeAccess: { scope: 'all' as const, roleIds: [] },
    };

    const seeded = seedMissingDefaultKnowledge([customItem]);
    assert.equal(seeded.length, 6);
    assert.equal(seeded[0].id, 'custom-user-1');

    // If at least one official default already exists, seedMissingDefaultKnowledge does not resurrect others
    const partial = seeded.filter((i) => i.id !== 'mst-default-care-and-newbiz');
    assert.equal(seedMissingDefaultKnowledge(partial).length, 5);

    // Explicit upsert restores missing official items and leaves custom item intact
    const upserted = upsertOfficialDefaultKnowledge(partial);
    assert.equal(upserted.addedCount, 1);
    assert.equal(upserted.items.length, 6);
    assert.ok(upserted.items.some((i) => i.id === 'custom-user-1'));
  });

  it('selectKnowledgeContext surfaces official default items to specialist roles as well as president', () => {
    const salesHit = selectKnowledgeContext(DEFAULT_KNOWLEDGE_ITEMS, '工事業の粗利改善と二重入力について相談したい', 'sales_operations');
    assert.ok(salesHit.includes('重点5業種') || salesHit.includes('主力4サービス'));

    const careHit = selectKnowledgeContext(DEFAULT_KNOWLEDGE_ITEMS, '介護保険外開業パッケージの4つの柱を教えて', 'new_product');
    assert.ok(careHit.includes('介護保険外'));
  });
});
