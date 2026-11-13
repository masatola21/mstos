// @ts-nocheck
import { buildProposalDraftRow, approvalBlockers, parseJaDate } from '../src/utils/proposalDraftRecord.js';
function assert(c: boolean, m: string) { if (!c) throw new Error(`Assertion failed: ${m}`); }

assert(parseJaDate('2026年11月3日') === '2026-11-03' && parseJaDate('xx') === '', 'date');
const base = {
  p1_policy: 'a', p2_service_name: 's', p2_deliverables: 'd', p3_roadmap: 'r', p4_initial_fee: '300,000', p4_discount: '10,000',
  p6_payment_terms: 't', issue_date: '2026年11月13日', due_date: '2026年12月13日', p_meeting_notes: 'SECRET', sender_rep: 'x',
};
const row = buildProposalDraftRow(base, 'lump_sum', { diagnosisId: 'd1', dealId: 'deal1', customerIntent: 'spot_build' });
assert(row.final_kind === 'spot_build' && row.subtotal === 290000 && row.tax_amount === 29000 && row.total_amount === 319000, 'fees');
assert(row.subtotal + row.tax_amount === row.total_amount, 'sum');
assert(!('p_meeting_notes' in row.chapters) && !('sender_rep' in row.chapters), 'internal keys excluded');
assert(row.issued_on === '2026-11-13' && row.valid_until === '2026-12-13', 'dates');
assert(buildProposalDraftRow({}, 'retainer', { diagnosisId: 'd' }).subtotal === null, 'no fee -> null');

assert(approvalBlockers(base, 'lump_sum', { dealId: 'deal1', roadmapConfirmed: true }).length === 0, 'ready');
const b = approvalBlockers(base, 'lump_sum', { dealId: '', roadmapConfirmed: false });
assert(b.length === 2 && b.some((x) => x.includes('商談')) && b.some((x) => x.includes('ロードマップ')), 'deal+roadmap');
assert(approvalBlockers(base, 'retainer', { dealId: 'x', roadmapConfirmed: true }).some((x) => x.includes('月額')), 'retainer needs monthly');
assert(approvalBlockers({ ...base, due_date: '2026年11月1日' }, 'lump_sum', { dealId: 'x', roadmapConfirmed: true }).some((x) => x.includes('発行日より前')), 'valid_until order');
console.log('proposalDraftRecord.test.ts: all assertions passed');
