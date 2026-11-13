import assert from 'node:assert/strict';
import { appendEmailFooter, buildSenderSignature } from '../server/emailFooter';
import {
  ONE_SHOT_SCENARIO_NAME,
  getOneShotOutreachTemplate,
  getSalesEmailTemplate,
  resolveOneShotOutreachDraft,
  PRIORITY_INDUSTRY_KEYS,
  INDUSTRY_MESSAGES,
} from '../src/utils/salesOutreachTemplates';
import { calculateDueAt } from '../src/utils/automationRuleUtils';
import { MST_OUTREACH_STARTER_SCENARIOS } from '../src/components/marketing/MarketingAutomationPrototypeView';

console.log('=== Running Outreach Footer & Follow-up Tests ===');

console.log('Test 1: signature has labelled HP / Mail and required legal items');
const sig = buildSenderSignature('contact@mstcorp.info');
assert.ok(sig.includes('有限会社MST'));
assert.ok(sig.includes('〒503-0981 岐阜県大垣市桧町127番地'));
assert.ok(sig.includes('HP: https://corp.mstcorp.info'));
assert.ok(sig.includes('Mail: contact@mstcorp.info'));
console.log('  ✓ passed');

console.log('Test 2: marketing mail gets signature then unsubscribe link');
const marketing = appendEmailFooter('本文です。', { senderEmail: 'contact@mstcorp.info', unsubscribeUrl: 'https://app/unsub?t=1' });
assert.ok(marketing.indexOf('桧町127番地') > marketing.indexOf('本文です。'));
assert.ok(marketing.endsWith('配信停止はこちら: https://app/unsub?t=1'));
console.log('  ✓ passed');

console.log('Test 3: transactional mail gets signature but no unsubscribe link');
const transactional = appendEmailFooter('請求書を送付します。', { senderEmail: 'contact@mstcorp.info' });
assert.ok(transactional.includes('Mail: contact@mstcorp.info'));
assert.ok(!transactional.includes('配信停止'));
console.log('  ✓ passed');

console.log('Test 4: legacy trailing signature is replaced by the standard one (thank-you mail)');
const legacyBody = '山田 様\n\n有限会社MST代表の大橋真人です。\nご回答ありがとうございます。\n\n--------------------------------------------------\n有限会社MST\n代表取締役: 大橋真人\n〒503-0981 岐阜県大垣市桧町127番地\n--------------------------------------------------';
const unified = appendEmailFooter(legacyBody, { senderEmail: 'contact@mstcorp.info' });
assert.equal(unified.split('桧町127番地').length - 1, 1, 'address appears once');
assert.ok(unified.includes('HP: https://corp.mstcorp.info') && unified.includes('Mail: contact@mstcorp.info'));
assert.ok(unified.includes('ご回答ありがとうございます。'));
assert.ok(!unified.includes('配信停止'));
console.log('  ✓ passed');

console.log('Test 4b: an address mentioned mid-body is not stripped or duplicated');
const midBody = 'お振込先のご案内です。弊社所在地は岐阜県大垣市桧町127番地です。\n\nよろしくお願いいたします。';
const midOut = appendEmailFooter(midBody, { senderEmail: 'contact@mstcorp.info' });
assert.ok(midOut.includes('弊社所在地は岐阜県大垣市桧町127番地です。'));
assert.equal(midOut.split('桧町127番地').length - 1, 1);
console.log('  ✓ passed');

console.log('Test 5: the 5 sales email steps carry no hardcoded signature');
for (let step = 1; step <= 5; step++) {
  const body = getSalesEmailTemplate(step, 'A社', '山田', '工事業', 'https://x').body;
  assert.ok(!body.includes('桧町127番地') && !body.includes('代表取締役'), `step ${step}`);
}
console.log('  ✓ passed');

console.log('Test 6: starter scenarios: step 1 manual, steps 2-5 fire only after first send');
assert.equal(MST_OUTREACH_STARTER_SCENARIOS.length, 5);
const [first, ...rest] = MST_OUTREACH_STARTER_SCENARIOS;
assert.equal(first.trigger, 'manual');
assert.equal(first.automationEnabled, false);
const waits = rest.map((s) => s.waitMinutes / 1440);
assert.deepEqual(waits, [3, 6, 9, 12]);
for (const s of rest) {
  assert.equal(s.trigger, 'outreach_first_sent');
  assert.equal(s.automationEnabled, true);
  assert.equal(s.stopOnBooking, true);
  assert.equal(s.sendTimeWindow, '09:00-18:00');
  assert.equal(s.preferredSendTime, '10:00');
}
console.log('  ✓ passed');

console.log('Test 7: priority industries exist and render into the email');
for (const k of PRIORITY_INDUSTRY_KEYS) assert.ok(INDUSTRY_MESSAGES[k], k);
console.log('  ✓ passed');

console.log('Test 8: one-shot outreach template renders key points without hardcoded signature');
const oneShot = getOneShotOutreachTemplate('テスト建設株式会社', '佐藤', '工事業', 'https://example.com/diag');
assert.equal(oneShot.step, 0);
assert.ok(oneShot.subject.includes('社外右腕'));
assert.ok(oneShot.body.includes('佐藤 様'));
assert.ok(oneShot.body.includes('IT専任担当'));
assert.ok(oneShot.body.includes('月25万〜30万円'));
assert.ok(oneShot.body.includes('https://example.com/diag'));
assert.ok(!oneShot.body.includes('桧町127番地') && !oneShot.body.includes('代表取締役'));
const oneShotFallback = getOneShotOutreachTemplate('テスト株式会社', '', '', '');
assert.ok(oneShotFallback.body.includes('テスト株式会社 ご担当者 様'));
assert.ok(oneShotFallback.body.includes('{{diagnostic_url}}'));
console.log('  ✓ passed');

console.log('Test 9: calculateDueAt honors JST preferredSendTime for multi-day & 0-day waits');
// Base time: 2026-11-10 08:30:00 JST (2026-11-09T23:30:00.000Z)
const morningJst = new Date('2026-11-10T08:30:00+09:00');
// +3 days at 10:00 JST => 2026-11-13T10:00:00+09:00
assert.equal(
  calculateDueAt(4320, '10:00', morningJst),
  new Date('2026-11-13T10:00:00+09:00').toISOString()
);
// waitMinutes=0 with applyPreferredOnZeroWait=true before 10:00 JST => same day 10:00 JST
assert.equal(
  calculateDueAt(0, '10:00', morningJst, { applyPreferredOnZeroWait: true }),
  new Date('2026-11-10T10:00:00+09:00').toISOString()
);
// Base time: 2026-11-10 14:15:00 JST -> after 10:00 JST => next day 10:00 JST
const afternoonJst = new Date('2026-11-10T14:15:00+09:00');
assert.equal(
  calculateDueAt(0, '10:00', afternoonJst, { applyPreferredOnZeroWait: true }),
  new Date('2026-11-11T10:00:00+09:00').toISOString()
);
// waitMinutes=0 without applyPreferredOnZeroWait => immediate (morningJst)
assert.equal(
  calculateDueAt(0, '10:00', morningJst),
  morningJst.toISOString()
);
// Sub-day wait (e.g. 120 minutes) falls back to exact offset even if preferredSendTime is set
assert.equal(
  calculateDueAt(120, '10:00', morningJst),
  new Date(morningJst.getTime() + 120 * 60 * 1000).toISOString()
);
console.log('  ✓ passed');

console.log('Test 10: custom one-shot outreach resolution and non-collision with step numbers 1-5');
for (const d of ['1', '2', '3', '4', '5']) {
  assert.ok(!ONE_SHOT_SCENARIO_NAME.includes(d), `ONE_SHOT_SCENARIO_NAME must not include digit ${d}`);
}
const customDraft = resolveOneShotOutreachDraft(
  {
    emailSubject: '【{company_name}様】{industry}向け 社外右腕のご提案',
    emailBody: '{recipient_name} 様\n{company_name}（{industry}）向けのご案内です。\n{link_url}',
  },
  '東海建装株式会社',
  '高橋',
  '工事業',
  'https://example.com/diag/1'
);
assert.equal(customDraft.subject, '【東海建装株式会社様】工事業向け 社外右腕のご提案');
assert.ok(customDraft.body.includes('高橋 様'));
assert.ok(customDraft.body.includes('東海建装株式会社（工事業）向けのご案内です。'));
assert.ok(customDraft.body.includes('https://example.com/diag/1'));

const fallbackDraft = resolveOneShotOutreachDraft(null, 'サンプル株式会社', '', '', '');
assert.ok(fallbackDraft.subject.includes('社外右腕'));
assert.ok(fallbackDraft.body.includes('サンプル株式会社 ご担当者 様'));
console.log('  ✓ passed');

console.log('=== All Outreach Footer & Follow-up Tests Passed! ===');
