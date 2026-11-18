import assert from 'node:assert/strict';
import {
  appendEmailFooter,
  appendHtmlEmailFooter,
  buildSenderSignature,
  prepareEmailPayloadContent,
  SENDER_PROFILE,
} from '../server/emailFooter';
import {
  buildConsultationAdminAlertEmail,
  buildConsultationInstantReply,
  classifyPublicFormNotificationKind,
  extractConsultationDetailsText,
} from '../server/publicFormReply';
import {
  ONE_SHOT_SCENARIO_NAME,
  getNurturingStepTemplate,
  getOneShotOutreachTemplate,
  getSalesEmailTemplate,
  resolveOneShotOutreachDraft,
  PRIORITY_INDUSTRY_KEYS,
  INDUSTRY_MESSAGES,
} from '../src/utils/salesOutreachTemplates';
import { calculateDueAt } from '../src/utils/automationRuleUtils';
import {
  MST_CARE_STARTER_SCENARIOS,
  MST_CONSULT_STARTER_SCENARIOS,
  MST_LINE_NURTURING_STARTER_SCENARIOS,
  MST_OUTREACH_STARTER_SCENARIOS,
  getScenarioSortKey,
  sortScenarios,
} from '../src/components/marketing/MarketingAutomationPrototypeView';
import {
  MST_DIAGNOSIS_STARTER_SCENARIOS,
  MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS,
  MST_POST_MEETING_STARTER_SCENARIOS,
  classifyScenarioFunnelPhase,
  getSupersededPhasesOnEvent,
  isLegacyBranchAScenarioName,
  isOverlappingEducationStepForBranch,
  mergeStarterScenarioBatch,
  resolvePreferredDeliveryChannels,
  shouldStopScenarioForDeal,
} from '../src/utils/followupStarterScenarios';
import {
  classifyConsultationTheme,
  deduceLeadInquiryType,
  resolveConsultationInquiryType,
} from '../src/utils/leadClassification';

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

console.log('Test 11: HTML signature includes MST logo image, legal profile, clickable URLs, and safe HTML escaping');
const htmlPayload = prepareEmailPayloadContent(
  '山田 様\n\n詳細はこちら: https://corp.mstcorp.info/diagnosis?id=1。\n<script>alert(1)</script>',
  {
    senderEmail: 'contact@mstcorp.info',
    unsubscribeUrl: 'https://app.example.com/unsub?t=xyz',
  },
);
assert.ok(htmlPayload.text.includes('有限会社MST'));
assert.ok(htmlPayload.html.includes(`<img src="${SENDER_PROFILE.logoUrl}" alt="${SENDER_PROFILE.logoAlt}"`));
assert.ok(htmlPayload.html.includes('有限会社MST　代表取締役 大橋真人'));
assert.ok(htmlPayload.html.includes('〒503-0981 岐阜県大垣市桧町127番地'));
assert.ok(htmlPayload.html.includes('href="mailto:contact@mstcorp.info"'));
assert.ok(htmlPayload.html.includes('href="https://corp.mstcorp.info/diagnosis?id=1"'));
assert.ok(htmlPayload.html.includes('href="https://app.example.com/unsub?t=xyz"'));
assert.ok(!htmlPayload.html.includes('<script>alert(1)</script>'));
assert.ok(htmlPayload.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
console.log('  ✓ passed');

console.log('Test 12: HTML signature replaces legacy plain-text signature once and omits unsubscribe for transactional mail');
const transactionalHtml = appendHtmlEmailFooter(legacyBody, {
  senderEmail: 'contact@mstcorp.info',
});
assert.equal(transactionalHtml.split('桧町127番地').length - 1, 1);
assert.ok(transactionalHtml.includes(SENDER_PROFILE.logoUrl));
assert.ok(!transactionalHtml.includes('配信停止'));
console.log('  ✓ passed');

console.log('Test 13: custom logoUrl validation rejects javascript: and allows https:');
const unsafeLogoHtml = appendHtmlEmailFooter('テスト本文', {
  senderEmail: 'contact@mstcorp.info',
  logoUrl: 'javascript:alert(1)',
});
assert.ok(unsafeLogoHtml.includes(SENDER_PROFILE.logoUrl));
assert.ok(!unsafeLogoHtml.includes('javascript:alert(1)'));
console.log('  ✓ passed');

console.log('Test 14: material request followups have 3 dual-channel steps at 1d, 3d, 7d with booking/deal stops');
assert.equal(MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS.length, 3);
assert.deepEqual(
  MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS.map((s) => s.waitMinutes),
  [1440, 4320, 10080]
);
for (const s of MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS) {
  assert.equal(s.trigger, 'material_requested');
  assert.equal(s.channel, 'both');
  assert.equal(s.stopOnBooking, true);
  assert.equal(s.stopOnDeal, true);
  assert.equal(s.automationEnabled, true);
  assert.equal(s.status, 'prepared');
  assert.ok(s.emailSubject.trim().length > 0 && s.emailBody.trim().length > 0);
  assert.ok(s.messageBody.trim().length > 0);
}
console.log('  ✓ passed');

console.log('Test 15: diagnosis starter scenarios A2-A4 are enabled and support both LINE and Email');
assert.equal(MST_DIAGNOSIS_STARTER_SCENARIOS.length, 4);
const [diagA1, ...diagPostForm] = MST_DIAGNOSIS_STARTER_SCENARIOS;
assert.equal(diagA1.trigger, 'tag_added');
assert.equal(diagA1.automationEnabled, true);
for (const s of diagPostForm) {
  assert.equal(s.trigger, 'diagnosis_completed');
  assert.equal(s.channel, 'both');
  assert.equal(s.automationEnabled, true);
  assert.equal(s.status, 'prepared');
  assert.ok(s.emailSubject.trim().length > 0, `${s.name} has emailSubject`);
  assert.ok(s.emailBody.trim().length > 0, `${s.name} has emailBody`);
}
console.log('  ✓ passed');

console.log('Test 16: post-meeting/report/proposal followups do NOT stop on existing booking');
assert.equal(MST_POST_MEETING_STARTER_SCENARIOS.length, 4);
assert.deepEqual(
  MST_POST_MEETING_STARTER_SCENARIOS.map((s) => ({ trigger: s.trigger, wait: s.waitMinutes })),
  [
    { trigger: 'meeting_completed', wait: 120 },
    { trigger: 'report_sent', wait: 4320 },
    { trigger: 'proposal_sent', wait: 4320 },
    { trigger: 'proposal_sent', wait: 10080 },
  ]
);
for (const s of MST_POST_MEETING_STARTER_SCENARIOS) {
  assert.equal(s.channel, 'both');
  assert.equal(s.stopOnBooking, false);
  assert.equal(s.stopOnDeal, true);
  assert.equal(s.automationEnabled, true);
  assert.equal(s.status, 'prepared');
  assert.ok(s.emailSubject.trim().length > 0 && s.emailBody.trim().length > 0);
  assert.ok(s.messageBody.trim().length > 0);
}
console.log('  ✓ passed');

console.log('Test 17: shouldStopScenarioForDeal differentiates pre-meeting vs post-meeting deal stages');
// 商談前（資料請求・診断・営業メール）は「商談化」で停止
assert.equal(shouldStopScenarioForDeal({ trigger: 'material_requested', leadStatus: '商談化' }).stop, true);
assert.equal(shouldStopScenarioForDeal({ trigger: 'diagnosis_completed', leadStatus: '商談化' }).stop, true);
assert.equal(shouldStopScenarioForDeal({ trigger: 'outreach_first_sent', leadStatus: '商談化' }).stop, true);
// 面談・レポート・提案書送付後は「商談化」では止まらず、「成約」「受注」「失注」「見送り」でのみ停止
assert.equal(shouldStopScenarioForDeal({ trigger: 'meeting_completed', leadStatus: '商談化' }).stop, false);
assert.equal(shouldStopScenarioForDeal({ trigger: 'report_sent', leadStatus: '商談化' }).stop, false);
assert.equal(shouldStopScenarioForDeal({ trigger: 'proposal_sent', leadStatus: '商談化' }).stop, false);
assert.equal(shouldStopScenarioForDeal({ trigger: 'proposal_sent', leadStatus: '成約' }).stop, true);
assert.equal(shouldStopScenarioForDeal({ trigger: 'meeting_completed', dealProposalStatus: '成約' }).stop, true);
assert.equal(shouldStopScenarioForDeal({ trigger: 'proposal_sent', dealProposalStatus: '失注' }).stop, true);
console.log('  ✓ passed');

console.log('Test 18: mergeStarterScenarioBatch is idempotent across repeated applications');
const firstApply = mergeStarterScenarioBatch([], [
  ...MST_DIAGNOSIS_STARTER_SCENARIOS,
  ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS,
  ...MST_POST_MEETING_STARTER_SCENARIOS,
], { replaceLegacyBranchA: true, nowMs: 1000 });
assert.equal(firstApply.addedCount, 11);
assert.equal(firstApply.merged.length, 11);
const secondApply = mergeStarterScenarioBatch(firstApply.merged, [
  ...MST_DIAGNOSIS_STARTER_SCENARIOS,
  ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS,
  ...MST_POST_MEETING_STARTER_SCENARIOS,
], { replaceLegacyBranchA: true, nowMs: 2000 });
assert.equal(secondApply.addedCount, 0);
assert.equal(secondApply.updatedCount, 11);
assert.equal(secondApply.merged.length, 11);
console.log('  ✓ passed');

console.log('Test 19: isLegacyBranchAScenarioName identifies legacy numeric & old A-pattern scenarios without false positives');
assert.equal(isLegacyBranchAScenarioName('【1. 初回お礼＋診断誘導】'), true);
assert.equal(isLegacyBranchAScenarioName('【2. 診断後のフォロー】'), true);
assert.equal(isLegacyBranchAScenarioName('【3. レポート送付】'), true);
assert.equal(isLegacyBranchAScenarioName('【4. 3日後教育】'), true);
assert.equal(isLegacyBranchAScenarioName('【5. 7日後商談案内】'), true);
assert.equal(isLegacyBranchAScenarioName('【A1・教育リマインド】1日後：テスト'), true);
assert.equal(isLegacyBranchAScenarioName('【A1・未回答教育】1日後：なぜ「利益と時間」が同時に減るのか？'), false);
assert.equal(isLegacyBranchAScenarioName('【A4・商談案内】7日後：他社の改善事例と無料壁打ちのご案内'), false);
assert.equal(isLegacyBranchAScenarioName('【第1通】初期アプローチメール'), false);
assert.equal(isLegacyBranchAScenarioName('【第1話】物語のはじまり'), false);
assert.equal(isLegacyBranchAScenarioName('【資料請求①】1日後：資料ご確認のお伺い'), false);

const legacyMix = [
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[0], id: 'old-1', name: '【1. 初回お礼】', updatedAt: 100 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[1], id: 'old-2', name: '【2. 診断ご案内】', updatedAt: 100 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[2], id: 'old-3', name: '【3. レポート自動送付】', updatedAt: 100 },
];
const cleanedMerge = mergeStarterScenarioBatch(legacyMix, MST_DIAGNOSIS_STARTER_SCENARIOS, {
  replaceLegacyBranchA: true,
  nowMs: 3000,
});
assert.equal(cleanedMerge.merged.length, 4);
assert.ok(cleanedMerge.merged.every((s) => !isLegacyBranchAScenarioName(s.name)));
console.log('  ✓ passed');

console.log('Test 20: sortScenarios places official A1-A4 strictly before legacy Branch A numeric items');
const unsorted = [
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[0], id: 'leg-2', name: '【2. 診断リマインド】', updatedAt: 1 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[3], id: 'new-4', updatedAt: 1 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[0], id: 'leg-1', name: '【1. 初回案内】', updatedAt: 1 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[0], id: 'new-1', updatedAt: 1 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[2], id: 'new-3', updatedAt: 1 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[1], id: 'new-2', updatedAt: 1 },
];
const sorted = sortScenarios(unsorted);
assert.deepEqual(
  sorted.map((s) => s.id),
  ['new-1', 'new-2', 'new-3', 'new-4', 'leg-1', 'leg-2']
);
assert.ok(getScenarioSortKey(unsorted[3]).stepNumber < getScenarioSortKey(unsorted[2]).stepNumber);
console.log('  ✓ passed');

console.log('Test 21: contact-inquiry classifies as consultation_inquiry and builds dedicated non-diagnosis instant reply');
assert.equal(
  classifyPublicFormNotificationKind({ slug: 'contact-inquiry', formType: 'consultation', inquiryType: '経営全体・利益改善', isCarePackage: false }),
  'consultation_inquiry'
);
assert.equal(
  classifyPublicFormNotificationKind({ slug: 'material-download', formType: 'consultation', inquiryType: '資料請求', isCarePackage: false }),
  'material_download'
);
assert.equal(
  classifyPublicFormNotificationKind({ slug: 'business-diagnosis', formType: 'diagnosis', inquiryType: 'ボトルネック診断', isCarePackage: false }),
  'diagnosis'
);

const details = extractConsultationDetailsText({
  userNotes: '利益率改善について相談したいです。',
  answers: { message: '利益率改善について相談したいです。', preferred_date: '来週火曜 午後' },
});
assert.equal(details.consultationText, '利益率改善について相談したいです。');
assert.equal(details.preferredDateText, '来週火曜 午後');

const instantReply = buildConsultationInstantReply({
  name: '山田太郎',
  companyName: '株式会社テスト',
  inquiryType: '経営全体・利益改善',
  consultationText: details.consultationText,
  preferredDateText: details.preferredDateText,
  bookingUrl: 'https://timerex.net/s/mst/example',
});
assert.ok(instantReply.emailSubject.includes('Web相談・お問い合わせを受け付けました'));
assert.ok(!instantReply.bodyText.includes('簡易診断結果'));
assert.ok(instantReply.bodyText.includes('1営業日以内'));
assert.ok(instantReply.bodyText.includes('利益率改善について相談したいです。'));
const signedConsultationEmail = prepareEmailPayloadContent(instantReply.bodyText, { senderEmail: 'contact@mstcorp.info' });
assert.ok(signedConsultationEmail.text.includes('Mail: contact@mstcorp.info'));
assert.ok(!signedConsultationEmail.text.includes('配信停止はこちら'));
console.log('  ✓ passed');

console.log('Test 22: buildConsultationAdminAlertEmail surfaces failure status and reply details cleanly');
const alertSent = buildConsultationAdminAlertEmail({
  name: '山田太郎',
  companyName: '株式会社テスト',
  email: 'yamada@example.com',
  inquiryType: '業務効率化',
  consultationText: '請求業務の自動化相談',
  emailAutoReplyStatus: 'sent',
});
assert.ok(alertSent.subject.includes('要メール返信・Web相談'));
assert.ok(alertSent.text.includes('yamada@example.com'));
assert.ok(alertSent.text.includes('送信済み'));

const alertFailed = buildConsultationAdminAlertEmail({
  name: '山田太郎',
  companyName: '株式会社テスト',
  email: 'yamada@example.com',
  inquiryType: '業務効率化',
  consultationText: '請求業務の自動化相談',
  emailAutoReplyStatus: 'failed',
  emailAutoReplyError: 'HTTP 500',
});
assert.ok(alertFailed.subject.includes('至急対応・自動返信未完'));
assert.ok(alertFailed.text.includes('HTTP 500'));
console.log('  ✓ passed');

console.log('Test 23: consultation topic faithfully reflects homepage form selection even when legacy DB values or URLs exist');
assert.equal(classifyConsultationTheme('集客・マーケティングについて'), '集客・マーケティング');
assert.equal(classifyConsultationTheme('https://corp.mstcorp.info/visit?submit=1\nLP: website'), '経営相談');
assert.equal(
  classifyConsultationTheme('業務効率化・IT自動化について相談したい'),
  '業務効率化・IT/自動化'
);
assert.equal(
  resolveConsultationInquiryType({
    answers: { topic: '集客・マーケティングについて', website_url: 'https://example.com/visit' },
    fallbackText: '集客を増やしたい',
  }),
  '集客・マーケティングについて'
);
assert.equal(
  resolveConsultationInquiryType({
    answers: { inquiryType: 'consultation', service_interest: '補助金・事業再構築の活用について' },
    fallbackText: 'IT補助金について',
  }),
  '補助金・事業再構築の活用について'
);
assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '経営相談',
    service_type: '業務効率化・IT/自動化',
    source: 'HP：お問い合わせ',
    status: '相談申込',
    notes: '[申込 1] HP：お問い合わせ\n【流入詳細】LP: https://corp.mstcorp.info/visit\n{"service_interest":"集客・マーケティングについて"}',
  }),
  '集客・マーケティングについて'
);
assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '業務効率化・IT/自動化',
    source: 'HP：お問い合わせ',
    status: '相談申込',
    notes: '[申込 2] HP：お問い合わせ\n{"service_interest":"集客・マーケティングについて"}',
  }),
  '集客・マーケティングについて'
);
console.log('  ✓ passed');

console.log('Test 24: Education Steps 1-7 have clean salutations, no legacy footer, and soft CTAs');
for (let step = 1; step <= 7; step++) {
  const tpl = getNurturingStepTemplate(step);
  assert.ok(!tpl.emailBody.startsWith(' 様'), `step ${step} email salutation`);
  assert.ok(!tpl.lineBody.startsWith(' 様'), `step ${step} line salutation`);
  assert.ok(!tpl.emailBody.includes('（貴社）') && !tpl.emailBody.includes('（{company_name}）'), `step ${step} no awkward company parens`);
  assert.ok(!tpl.emailBody.includes('桧町127番地') && !tpl.emailBody.includes('配信停止'), `step ${step} no hardcoded signature/unsub`);
  const blankFallback = getNurturingStepTemplate(step, '');
  assert.ok(blankFallback.emailBody.startsWith('ご担当者 様'));
  assert.ok(blankFallback.lineBody.startsWith('ご担当者 様'));
}
console.log('  ✓ passed');

console.log('Test 25: Education 7 steps and Branch B/C starter presets are enabled and scheduled cleanly');
assert.equal(MST_LINE_NURTURING_STARTER_SCENARIOS.length, 7);
assert.deepEqual(
  MST_LINE_NURTURING_STARTER_SCENARIOS.map((s) => s.waitMinutes / 1440),
  [2, 5, 8, 11, 14, 17, 20]
);
for (const s of [
  ...MST_LINE_NURTURING_STARTER_SCENARIOS,
  ...MST_CONSULT_STARTER_SCENARIOS,
  ...MST_CARE_STARTER_SCENARIOS,
]) {
  assert.equal(s.status, 'prepared');
  assert.equal(s.automationEnabled, true);
  assert.equal(s.stopOnBooking, true);
  assert.equal(s.stopOnDeal, true);
  assert.equal(s.preferredSendTime, '10:00');
  assert.equal(s.sendTimeWindow, '09:00-20:00');
}
console.log('  ✓ passed');

console.log('Test 26: resolvePreferredDeliveryChannels uses LINE-first with Email fallback and zero double-blast');
assert.deepEqual(
  resolvePreferredDeliveryChannels({ channelSetting: 'both', hasLineDeliverable: true, hasEmail: true }),
  ['line']
);
assert.deepEqual(
  resolvePreferredDeliveryChannels({ channelSetting: 'both', hasLineDeliverable: false, hasEmail: true }),
  ['email']
);
assert.deepEqual(
  resolvePreferredDeliveryChannels({ channelSetting: 'both', hasLineDeliverable: false, hasEmail: false }),
  []
);
assert.deepEqual(
  resolvePreferredDeliveryChannels({ channelSetting: 'line', hasLineDeliverable: false, hasEmail: true }),
  []
);
assert.deepEqual(
  resolvePreferredDeliveryChannels({ channelSetting: 'email', hasLineDeliverable: true, hasEmail: true }),
  ['email']
);
console.log('  ✓ passed');

console.log('Test 27: funnel phase classification, superseded cancellations, and Day-2 overlap guard');
assert.equal(classifyScenarioFunnelPhase(MST_LINE_NURTURING_STARTER_SCENARIOS[0]), 'education_nurturing');
assert.equal(classifyScenarioFunnelPhase(MST_DIAGNOSIS_STARTER_SCENARIOS[0]), 'diagnosis_followup');
assert.equal(classifyScenarioFunnelPhase(MST_DIAGNOSIS_STARTER_SCENARIOS[1]), 'diagnosis_followup');
assert.equal(classifyScenarioFunnelPhase(MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[0]), 'material_followup');
assert.equal(classifyScenarioFunnelPhase(MST_CONSULT_STARTER_SCENARIOS[0]), 'line_welcome_branch');
assert.equal(classifyScenarioFunnelPhase(MST_POST_MEETING_STARTER_SCENARIOS[0]), 'post_meeting');

const onBooking = getSupersededPhasesOnEvent({ trigger: 'booking_created' });
assert.ok(onBooking.cancelPhases.includes('education_nurturing'));
assert.ok(onBooking.cancelPhases.includes('diagnosis_followup'));
assert.ok(onBooking.cancelPhases.includes('material_followup'));
assert.ok(!onBooking.cancelPhases.includes('post_meeting'));

const onContract = getSupersededPhasesOnEvent({ trigger: 'contract_signed' });
assert.ok(onContract.cancelPhases.includes('post_meeting'));
assert.ok(onContract.cancelPhases.includes('education_nurturing'));

const onDiag = getSupersededPhasesOnEvent({ trigger: 'diagnosis_completed' });
assert.ok(onDiag.cancelPhases.includes('education_nurturing'));
assert.ok(onDiag.cancelSpecificTargets?.some((t) => t.trigger === 'tag_added' && t.targetTag === '選択:診断'));

assert.equal(isOverlappingEducationStepForBranch(MST_LINE_NURTURING_STARTER_SCENARIOS[0], ['選択:個別相談']), true);
assert.equal(isOverlappingEducationStepForBranch(MST_LINE_NURTURING_STARTER_SCENARIOS[1], ['選択:個別相談']), false);
assert.equal(isOverlappingEducationStepForBranch(MST_LINE_NURTURING_STARTER_SCENARIOS[0], []), false);
console.log('  ✓ passed');

console.log('=== All Outreach Footer & Follow-up Tests Passed! ===');
