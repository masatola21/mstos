import assert from 'node:assert/strict';
import {
  resolveNonDowngradingLeadStatus,
  resolveNonDowngradingDealStatus,
  appendUniqueNote,
  getDealFlowSteps,
  getLeadFlowSteps,
  isGenericDocumentTitle,
  resolveWebApplyDealPlanName,
  sortCrmRowsForCanonical,
  buildConsolidatedCrmPatch,
  planDuplicateCrmConsolidations,
} from '../src/utils/crmPipelineFlow';
import { splitTextWithUrls } from '../src/utils/linkify';
import {
  dedupeRecordsById,
  findOpsDuplicateGroups,
  normalizeContractUiStatus,
  normalizeInvoiceUiStatus,
} from '../src/utils/operationsDedup';

console.log('=== Running CRM Pipeline Flow, Deduplication & Preview Linkify Tests ===');

// Test 1: Lead status non-downgrading progression
console.log('Test 1: resolveNonDowngradingLeadStatus');
assert.equal(resolveNonDowngradingLeadStatus('面談予約済', '資料請求'), '面談予約済');
assert.equal(resolveNonDowngradingLeadStatus('商談化', '新規'), '商談化');
assert.equal(resolveNonDowngradingLeadStatus('新規', '面談実施済'), '面談実施済');
assert.equal(resolveNonDowngradingLeadStatus('再調整待ち', '面談予約済'), '面談予約済');
assert.equal(resolveNonDowngradingLeadStatus('成約', 'ヒアリング済'), '成約');
assert.equal(resolveNonDowngradingLeadStatus('失注・対象外', '新規'), '失注・対象外');
console.log('  -> PASSED: Lead status non-downgrade verified.');

// Test 2: Deal status non-downgrading progression
console.log('Test 2: resolveNonDowngradingDealStatus');
assert.equal(resolveNonDowngradingDealStatus('見積提示', '初回面談'), '見積提示');
assert.equal(resolveNonDowngradingDealStatus('成約', '失注'), '成約');
assert.equal(resolveNonDowngradingDealStatus('初回面談', '要件提案'), '要件提案');
assert.equal(resolveNonDowngradingDealStatus('日程再調整', '日程確定'), '日程確定');
assert.equal(resolveNonDowngradingDealStatus('最終交渉', '成約'), '成約');
console.log('  -> PASSED: Deal status non-downgrade verified.');

// Test 3: Unique note appending
console.log('Test 3: appendUniqueNote deduplication');
const n1 = appendUniqueNote('', '【TimeRex予約】11/25 14:00');
assert.equal(n1, '【TimeRex予約】11/25 14:00');
const n2 = appendUniqueNote(n1, '【TimeRex予約】11/25 14:00');
assert.equal(n2, n1, 'Duplicate note chunk should not be appended twice');
const n3 = appendUniqueNote(n2, '【見積提示】提案書送付済み');
assert.equal(n3, '【TimeRex予約】11/25 14:00\n\n【見積提示】提案書送付済み');
console.log('  -> PASSED: appendUniqueNote verified.');

// Test 4: 5-step Deal & Lead flow visualization
console.log('Test 4: getDealFlowSteps & getLeadFlowSteps');
const dealEstimateSteps = getDealFlowSteps('見積提示');
assert.equal(dealEstimateSteps.length, 5);
assert.deepEqual(
  dealEstimateSteps.map((s) => `${s.label}:${s.state}`),
  ['面談:done', '提案:done', '見積:current', '交渉:upcoming', '成約:upcoming']
);

const dealWonSteps = getDealFlowSteps('成約');
assert.deepEqual(
  dealWonSteps.map((s) => s.state),
  ['done', 'done', 'done', 'done', 'done']
);

const dealPausedSteps = getDealFlowSteps('保留');
assert.equal(dealPausedSteps[0].state, 'paused');

const leadDealSteps = getLeadFlowSteps('商談化');
assert.equal(leadDealSteps.length, 5);
assert.deepEqual(
  leadDealSteps.map((s) => `${s.label}:${s.state}`),
  ['反響:done', '予約:done', '面談:done', '商談化:current', '成約:upcoming']
);
console.log('  -> PASSED: 5-step flow progression verified.');

// Test 5: Preview URL linkification with Japanese text & punctuation
console.log('Test 5: splitTextWithUrls for email/LINE preview bodies');
const previewSample =
  '詳細はこちら（https://mst-consulting.co.jp/apply/doc-123）をご確認のうえ、\nWebページ https://mst-consulting.co.jp/diagnosis/?id=abc をご確認ください。';
const segments = splitTextWithUrls(previewSample);
const urlSegments = segments.filter((s) => s.type === 'url');
assert.equal(urlSegments.length, 2);
assert.equal(urlSegments[0].type === 'url' ? urlSegments[0].href : '', 'https://mst-consulting.co.jp/apply/doc-123');
assert.equal(urlSegments[1].type === 'url' ? urlSegments[1].href : '', 'https://mst-consulting.co.jp/diagnosis/?id=abc');
console.log('  -> PASSED: Preview URL linkification verified.');

// Test 6: Web apply deal plan name resolution avoids generic document titles
console.log('Test 6: resolveWebApplyDealPlanName & isGenericDocumentTitle');
assert.equal(isGenericDocumentTitle('業務委託基本契約書'), true);
assert.equal(isGenericDocumentTitle('御見積書'), true);
assert.equal(isGenericDocumentTitle('社外右腕・業務仕組み化伴走プラン'), false);

assert.equal(
  resolveWebApplyDealPlanName({
    existingPlanName: '業務委託基本契約書',
    docTitle: '業務委託基本契約書',
    bodyHtml: '<h1>業務委託基本契約書</h1><p>案件名: DX自動化伴走支援</p>',
    companyName: '株式会社サンプル',
  }),
  'DX自動化伴走支援'
);
assert.equal(
  resolveWebApplyDealPlanName({
    docTitle: '業務委託基本契約書',
    bodyHtml: '<p>業務委託基本契約書</p>',
    companyName: '株式会社サンプル',
  }),
  '株式会社サンプル 業務改善支援プラン'
);
assert.equal(
  resolveWebApplyDealPlanName({
    existingPlanName: '経営顧問パッケージ',
    docTitle: '業務委託基本契約書',
    companyName: '株式会社サンプル',
  }),
  '経営顧問パッケージ'
);
console.log('  -> PASSED: Web apply deal plan name resolution verified.');

// Test 7: Operations deduplication (contracts, invoices, engagements)
console.log('Test 7: dedupeRecordsById & findOpsDuplicateGroups');
const unique = dedupeRecordsById([{ id: '1', v: 'a' }, { id: '1', v: 'b' }, { id: '2', v: 'c' }]);
assert.equal(unique.length, 2);

const dupContracts = findOpsDuplicateGroups('contracts', [
  { id: 'c-draft', company_id: 'comp-1', deal_id: 'deal-1', status: 'draft', amount: 300000, created_at: '2026-11-01T00:00:00Z' },
  { id: 'c-signed', company_id: 'comp-1', deal_id: 'deal-1', status: 'signed', amount: 300000, document_id: 'doc-1', created_at: '2026-11-02T00:00:00Z' },
  { id: 'c-other', company_id: 'comp-2', deal_id: 'deal-2', status: 'draft', amount: 150000, created_at: '2026-11-01T00:00:00Z' },
]);
assert.equal(dupContracts.length, 1);
assert.equal(dupContracts[0].keeper.id, 'c-signed');
assert.deepEqual(dupContracts[0].duplicates.map((d) => d.id), ['c-draft']);

const dupServices = findOpsDuplicateGroups('services', [
  { id: 's-1', company_id: 'comp-1', contract_id: 'c-signed', title: '【伴走サポート】A社', notes: '商談ID: deal-1', status: 'active', milestone_data: [{ id: 'm1' }], created_at: '2026-11-01T00:00:00Z' },
  { id: 's-2', company_id: 'comp-1', contract_id: null, title: '【伴走サポート】A社', notes: '商談ID: deal-1', status: 'active', milestone_data: [], created_at: '2026-11-02T00:00:00Z' },
]);
assert.equal(dupServices.length, 1);
assert.equal(dupServices[0].keeper.id, 's-1');
assert.deepEqual(dupServices[0].duplicates.map((d) => d.id), ['s-2']);

// 追加契約: 件名・金額が同じでも、別の書類・別の支援は重複とみなさない
const addlContracts = findOpsDuplicateGroups('contracts', [
  { id: 'c-1', company_id: 'comp-1', title: '顧問契約', amount: 100000, document_id: 'doc-1', status: 'signed', created_at: '2026-11-01T00:00:00Z' },
  { id: 'c-2', company_id: 'comp-1', title: '顧問契約', amount: 100000, document_id: 'doc-2', status: 'draft', created_at: '2026-11-20T00:00:00Z' },
  { id: 'c-3', company_id: 'comp-1', title: '顧問契約', amount: 100000, status: 'draft', created_at: '2026-11-21T00:00:00Z' },
  { id: 'c-4', company_id: 'comp-1', title: '顧問契約', amount: 100000, status: 'draft', created_at: '2026-11-21T01:00:00Z' },
]);
assert.equal(addlContracts.length, 0, '件名・金額が同じだけの契約は重複扱いにしない');

const addlServices = findOpsDuplicateGroups('services', [
  { id: 's-a', company_id: 'comp-1', title: '【伴走サポート】A社', notes: '商談ID: deal-1', status: 'active', created_at: '2026-11-01T00:00:00Z' },
  { id: 's-b', company_id: 'comp-1', title: '【伴走サポート】A社', contract_id: 'c-2', status: 'planned', created_at: '2026-11-20T00:00:00Z' },
  { id: 's-c', company_id: 'comp-1', title: '【伴走サポート】A社', status: 'planned', created_at: '2026-11-21T00:00:00Z' },
]);
assert.equal(addlServices.length, 0, '同じ件名の2件目の支援は重複扱いにしない');

const addlInvoices = findOpsDuplicateGroups('invoices', [
  { id: 'i-1', company_id: 'comp-1', title: '11月分 顧問料', amount: 100000, issue_date: '2026-11-01', status: 'issued', created_at: '2026-11-01T00:00:00Z' },
  { id: 'i-2', company_id: 'comp-1', title: '11月分 顧問料', amount: 100000, issue_date: '2026-11-01', status: 'issued', created_at: '2026-11-01T01:00:00Z' },
]);
assert.equal(addlInvoices.length, 0, '契約に紐付かない請求は件名・金額・日付が同じでも重複扱いにしない');

// 同じ契約・同じ商談の初回請求の二重作成は引き続き検出する
const dupInitialInvoices = findOpsDuplicateGroups('invoices', [
  { id: 'i-a', company_id: 'comp-1', contract_id: 'c-1', title: '初回請求', amount: 50000, status: 'issued', created_at: '2026-11-01T00:00:00Z' },
  { id: 'i-b', company_id: 'comp-1', contract_id: 'c-1', title: '初回請求', amount: 50000, status: 'draft', created_at: '2026-11-02T00:00:00Z' },
]);
assert.equal(dupInitialInvoices.length, 1);
console.log('  -> PASSED: Operations deduplication verified (additional contracts are kept).');

// Test 8: Slimmed contract and invoice status normalization
console.log('Test 8: normalizeContractUiStatus & normalizeInvoiceUiStatus');
assert.equal(normalizeContractUiStatus('draft'), 'draft');
assert.equal(normalizeContractUiStatus('under_review'), 'draft');
assert.equal(normalizeContractUiStatus('sent'), 'draft');
assert.equal(normalizeContractUiStatus('signed'), 'signed');
assert.equal(normalizeContractUiStatus('active'), 'signed');
assert.equal(normalizeContractUiStatus('expired'), 'canceled');
assert.equal(normalizeContractUiStatus('canceled'), 'canceled');

assert.equal(normalizeInvoiceUiStatus('draft'), 'draft');
assert.equal(normalizeInvoiceUiStatus('awaiting_approval'), 'draft');
assert.equal(normalizeInvoiceUiStatus('issued'), 'issued');
assert.equal(normalizeInvoiceUiStatus('paid'), 'paid');
assert.equal(normalizeInvoiceUiStatus('overdue'), 'overdue');
assert.equal(normalizeInvoiceUiStatus('canceled'), 'canceled');
console.log('  -> PASSED: Slimmed status normalization verified.');

// Test 9: CRM Deal & Lead duplicate consolidation planning
console.log('Test 9: sortCrmRowsForCanonical, buildConsolidatedCrmPatch & planDuplicateCrmConsolidations');
const dealPlans = planDuplicateCrmConsolidations('deals', [
  {
    id: 'DEAL-1',
    company_id: 'CID-001',
    lead_id: 'lead-1',
    proposal_status: '日程確定',
    meeting_date: '2026-11-20',
    memo: 'TimeRex予約メモ',
    total_amount: null,
    updated_at: '2026-11-12T01:00:00Z',
  },
  {
    id: 'DEAL-2',
    company_id: 'CID-001',
    lead_id: null,
    proposal_status: '見積提示',
    meeting_date: null,
    memo: '見積送付済み',
    total_amount: 550000,
    updated_at: '2026-11-11T10:00:00Z',
  },
  {
    id: 'DEAL-SINGLE',
    company_id: 'CID-002',
    proposal_status: '初回面談',
    updated_at: '2026-11-11T10:00:00Z',
  },
  {
    id: 'DEAL-NO-CID',
    company_id: null,
    proposal_status: '初回面談',
  },
]);
assert.equal(dealPlans.length, 1);
assert.equal(dealPlans[0].companyId, 'CID-001');
assert.equal(dealPlans[0].canonical.id, 'DEAL-2', 'Higher stage rank deal must be chosen as canonical');
assert.deepEqual(dealPlans[0].dupIds, ['DEAL-1']);
assert.equal(dealPlans[0].mergedPatch.proposal_status, '見積提示');
assert.equal(dealPlans[0].mergedPatch.lead_id, 'lead-1', 'Missing lead_id must be backfilled from duplicate');
assert.equal(dealPlans[0].mergedPatch.meeting_date, '2026-11-20', 'Missing meeting_date must be backfilled');
assert.equal(dealPlans[0].mergedPatch.total_amount, 550000);
assert.ok(String(dealPlans[0].mergedPatch.memo).includes('見積送付済み'));
assert.ok(String(dealPlans[0].mergedPatch.memo).includes('TimeRex予約メモ'));

const sortedLeads = sortCrmRowsForCanonical('leads', [
  { id: 'L-1', company_id: 'CID-001', status: '資料請求', updated_at: '2026-11-12T00:00:00Z' },
  { id: 'L-2', company_id: 'CID-001', status: '面談予約済', updated_at: '2026-11-10T00:00:00Z' },
]);
assert.equal(sortedLeads[0].id, 'L-2');
const leadPatch = buildConsolidatedCrmPatch('leads', sortedLeads[0], [sortedLeads[1]]);
assert.equal(leadPatch.status, '面談予約済');
console.log('  -> PASSED: CRM duplicate consolidation planning verified.');

console.log('=== All CRM Pipeline Flow, Deduplication & Preview Linkify Tests Passed! ===');

