import assert from 'node:assert/strict';
import { appendEmailFooter, buildSenderSignature } from '../server/emailFooter';
import { getSalesEmailTemplate, PRIORITY_INDUSTRY_KEYS, INDUSTRY_MESSAGES } from '../src/utils/salesOutreachTemplates';
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
}
console.log('  ✓ passed');

console.log('Test 7: priority industries exist and render into the email');
for (const k of PRIORITY_INDUSTRY_KEYS) assert.ok(INDUSTRY_MESSAGES[k], k);
console.log('  ✓ passed');

console.log('=== All Outreach Footer & Follow-up Tests Passed! ===');
