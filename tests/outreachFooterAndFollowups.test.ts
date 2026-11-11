import assert from 'node:assert/strict';
import { appendEmailFooter, buildSenderSignature } from '../server/emailFooter';
import { getSalesEmailTemplate, PRIORITY_INDUSTRY_KEYS, INDUSTRY_MESSAGES } from '../src/utils/salesOutreachTemplates';
import { MST_OUTREACH_STARTER_SCENARIOS } from '../src/components/marketing/MarketingAutomationPrototypeView';

console.log('=== Running Outreach Footer & Follow-up Tests ===');

console.log('Test 1: signature has labelled HP / Mail and required legal items');
const sig = buildSenderSignature('contact@mstcorp.info');
assert.ok(sig.includes('有限会社MST'));
assert.ok(sig.includes('〒503-0981 岐阜県大垣市桧町127番地'));
assert.ok(sig.includes('HP: https://mstcorp.info'));
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

console.log('Test 4: body that already has the address is not given a second signature');
const legacy = appendEmailFooter('本文\n〒503-0981 岐阜県大垣市桧町127番地', { senderEmail: 'contact@mstcorp.info', unsubscribeUrl: 'https://app/u' });
assert.equal(legacy.split('桧町127番地').length - 1, 1);
assert.ok(legacy.includes('配信停止はこちら'));
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
