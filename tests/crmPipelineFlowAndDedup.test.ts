import assert from 'node:assert/strict';
import {
  resolveNonDowngradingLeadStatus,
  resolveNonDowngradingDealStatus,
  appendUniqueNote,
  getDealFlowSteps,
  getLeadFlowSteps,
} from '../src/utils/crmPipelineFlow';
import { splitTextWithUrls } from '../src/utils/linkify';

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

console.log('=== All CRM Pipeline Flow, Deduplication & Preview Linkify Tests Passed! ===');
