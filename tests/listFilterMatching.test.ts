import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListFilterCatalogFromRecords,
  groupListFilterOptions,
  matchesListFilter,
} from '../src/utils/listFilter';

describe('Unified List Filter Matching Tests', () => {
  const catalog = buildListFilterCatalogFromRecords({
    batches: [
      { id: 'batch-1', batch_name: '介護事業者AI調査リスト' },
      { id: 'batch-2', batch_name: 'SaaS企業リスト' },
    ],
    segments: [
      { id: 'seg-cust', name: '契約中企業', entity_type: 'customers', conditions: { field: 'contract_status', value: '契約中' } },
      { id: 'seg-it', name: 'IT企業', entity_type: 'companies', conditions: { field: 'industry', value: 'IT' } },
    ],
    tags: [
      { id: 'tag-vip', name: 'VIP顧客' },
      { id: 'tag-diag', name: '診断済み' },
    ],
    friends: [
      { id: 'fr-1', contact_id: 'ct-1', line_user_id: 'U_LINE_1' },
      { id: 'fr-2', contact_id: null, line_user_id: 'U_LINE_2' },
    ],
    friendTags: [
      { line_friend_id: 'fr-1', tag_id: 'tag-vip' },
      { line_friend_id: 'fr-2', tag_id: 'tag-diag' },
    ],
    companies: [
      { id: 'comp-1', company_name: '株式会社テストIT', industry: 'IT・DX' },
      { id: 'comp-2', company_name: '介護ケア株式会社', industry: '福祉' },
    ],
    prospects: [
      { id: 'pr-1', company_id: 'comp-2', email: 'care@example.com', opted_out: false, import_batch_id: 'batch-1' },
      { id: 'pr-2', company_id: 'comp-2', email: 'optout@example.com', opted_out: true, import_batch_id: 'batch-1' },
      { id: 'pr-3', company_id: null, email: 'saas@example.com', opted_out: false, import_batch_id: 'batch-2' },
    ],
    contacts: [
      { id: 'ct-1', full_name: '山田太郎', email: 'yamada@it.example.com', company_id: 'comp-1', line_user_id: 'U_LINE_1' },
      { id: 'ct-2', full_name: '佐藤花子', email: 'care@example.com', company_id: 'comp-2', line_user_id: null },
    ],
    customers: [
      { id: 'cust-1', company_id: 'comp-1', contract_status: '契約中' },
    ],
  });

  it('groups options cleanly by batches, segments, and tags', () => {
    const grouped = groupListFilterOptions(catalog);
    assert.equal(grouped.batches.length, 2);
    assert.equal(grouped.segments.length, 2);
    assert.equal(grouped.tags.length, 2);
  });

  it('returns true for all when filter is empty or all', () => {
    assert.equal(matchesListFilter(catalog, 'all', { contactId: 'ct-1' }), true);
    assert.equal(matchesListFilter(catalog, '', { email: 'unknown@example.com' }), true);
  });

  it('matches import batch by contactId, companyId, or email and excludes opted_out prospects', () => {
    assert.equal(matchesListFilter(catalog, 'batch:batch-1', { contactId: 'ct-2' }), true);
    assert.equal(matchesListFilter(catalog, 'batch:batch-1', { email: 'CARE@EXAMPLE.COM' }), true);
    assert.equal(matchesListFilter(catalog, 'batch:batch-1', { email: 'optout@example.com' }), false);
    assert.equal(matchesListFilter(catalog, 'batch:batch-2', { email: 'saas@example.com' }), true);
    assert.equal(matchesListFilter(catalog, 'batch:batch-1', { contactId: 'ct-1' }), false);
  });

  it('matches CRM segments across customers and companies', () => {
    assert.equal(matchesListFilter(catalog, 'segment:seg-cust', { contactId: 'ct-1' }), true);
    assert.equal(matchesListFilter(catalog, 'segment:seg-cust', { companyId: 'comp-2' }), false);
    assert.equal(matchesListFilter(catalog, 'segment:seg-it', { email: 'yamada@it.example.com' }), true);
    assert.equal(matchesListFilter(catalog, 'segment:seg-it', { companyId: 'comp-2' }), false);
  });

  it('matches LINE/contact tags by contactId, email, or lineUserId', () => {
    assert.equal(matchesListFilter(catalog, 'tag:tag-vip', { contactId: 'ct-1' }), true);
    assert.equal(matchesListFilter(catalog, 'tag:tag-vip', { email: 'yamada@it.example.com' }), true);
    assert.equal(matchesListFilter(catalog, 'tag:tag-diag', { lineUserId: 'U_LINE_2' }), true);
    assert.equal(matchesListFilter(catalog, 'tag:tag-diag', { contactId: 'ct-1' }), false);
  });
});
