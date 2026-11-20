import assert from 'node:assert/strict';
import {
  appendEmailFooter,
  appendHtmlEmailFooter,
  buildSenderSignature,
  prepareEmailPayloadContent,
  SENDER_PROFILE,
} from '../server/emailFooter';
import {
  buildCarePackageInstantReply,
  buildConsultationAdminAlertEmail,
  buildConsultationInstantReply,
  buildDiagnosisInstantReply,
  buildMaterialDownloadInstantReply,
  classifyPublicFormNotificationKind,
  extractConsultationDetailsText,
} from '../server/publicFormReply';
import {
  ONE_SHOT_SCENARIO_ID,
  ONE_SHOT_SCENARIO_NAME,
  MONITOR_ONE_SHOT_SCENARIO_ID,
  MONITOR_ONE_SHOT_SCENARIO_NAME,
  getNurturingStepTemplate,
  getOneShotOutreachTemplate,
  getMonitorOutreachTemplate,
  getSalesEmailTemplate,
  resolveOneShotOutreachDraft,
  resolveMonitorOutreachDraft,
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
  BRANCH_EDUCATION_DELAY_DAYS,
  MST_DIAGNOSIS_STARTER_SCENARIOS,
  MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS,
  MST_POST_MEETING_STARTER_SCENARIOS,
  classifyScenarioFunnelPhase,
  classifyScenarioTrack,
  doesScenarioMatchRequestedMaterials,
  formatJobActionLabel,
  formatScenarioStopCondition,
  formatScenarioTriggerLabel,
  formatScenarioWaitMinutes,
  getEducationStartDayForShift,
  getSupersededPhasesOnEvent,
  inferScenarioTargetMaterial,
  isConsultationLeadEligibleForHumanReplyEducation,
  isEligibleSourceTypeForConsultationHumanReply,
  isLegacyBranchAScenarioName,
  isLegacyBranchBScenario,
  isLegacyMaterialScenarioName,
  isLegacyPostMeetingScenarioName,
  isOverlappingEducationStepForBranch,
  mergeStarterScenarioBatch,
  resolvePreferredDeliveryChannels,
  shouldStopScenarioForDeal,
} from '../src/utils/followupStarterScenarios';
import { deduplicateMarketingScenarios } from '../src/utils/marketingStorage';
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

console.log('Test 14: material request followups have 6 dual-pattern steps (3 management + 3 care) at 1d, 3d, 7d targeting 30-min free consultation');
assert.equal(MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS.length, 6);
assert.deepEqual(
  MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS.map((s) => s.waitMinutes),
  [1440, 4320, 10080, 1440, 4320, 10080]
);
assert.deepEqual(
  MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS.map((s) => s.targetMaterial),
  ['management', 'management', 'management', 'care', 'care', 'care']
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
  assert.ok(s.emailBody.includes('{booking_url}') || s.flexButtonUrl === '{booking_url}');
  assert.ok(s.messageBody.includes('{booking_url}') || s.flexButtonUrl === '{booking_url}');
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

console.log('Test 16: consolidated post-meeting / report_or_proposal_sent followups have 3 steps and do NOT stop on existing booking');
assert.equal(MST_POST_MEETING_STARTER_SCENARIOS.length, 3);
assert.deepEqual(
  MST_POST_MEETING_STARTER_SCENARIOS.map((s) => ({ trigger: s.trigger, wait: s.waitMinutes })),
  [
    { trigger: 'meeting_completed', wait: 120 },
    { trigger: 'report_or_proposal_sent', wait: 4320 },
    { trigger: 'report_or_proposal_sent', wait: 10080 },
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
// 面談・レポート＆提案書送付後は「商談化」では止まらず、「成約」「受注」「失注」「見送り」でのみ停止
assert.equal(shouldStopScenarioForDeal({ trigger: 'meeting_completed', leadStatus: '商談化' }).stop, false);
assert.equal(shouldStopScenarioForDeal({ trigger: 'report_sent', leadStatus: '商談化' }).stop, false);
assert.equal(shouldStopScenarioForDeal({ trigger: 'proposal_sent', leadStatus: '商談化' }).stop, false);
assert.equal(shouldStopScenarioForDeal({ trigger: 'report_or_proposal_sent', leadStatus: '商談化' }).stop, false);
assert.equal(shouldStopScenarioForDeal({ trigger: 'report_or_proposal_sent', leadStatus: '成約' }).stop, true);
assert.equal(shouldStopScenarioForDeal({ trigger: 'meeting_completed', dealProposalStatus: '成約' }).stop, true);
assert.equal(shouldStopScenarioForDeal({ trigger: 'proposal_sent', dealProposalStatus: '失注' }).stop, true);
console.log('  ✓ passed');

console.log('Test 18: mergeStarterScenarioBatch is idempotent and auto-replaces legacy split report/proposal & legacy material scenarios');
const firstApply = mergeStarterScenarioBatch([], [
  ...MST_DIAGNOSIS_STARTER_SCENARIOS,
  ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS,
  ...MST_POST_MEETING_STARTER_SCENARIOS,
], { replaceLegacyBranchA: true, nowMs: 1000 });
assert.equal(firstApply.addedCount, 13);
assert.equal(firstApply.merged.length, 13);
const secondApply = mergeStarterScenarioBatch(firstApply.merged, [
  ...MST_DIAGNOSIS_STARTER_SCENARIOS,
  ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS,
  ...MST_POST_MEETING_STARTER_SCENARIOS,
], { replaceLegacyBranchA: true, nowMs: 2000 });
assert.equal(secondApply.addedCount, 0);
assert.equal(secondApply.updatedCount, 13);
assert.equal(secondApply.merged.length, 13);

assert.equal(isLegacyMaterialScenarioName('【資料請求①】1日後：資料ご確認のお伺い ＆ 無料相談のご案内'), true);
assert.equal(isLegacyMaterialScenarioName('【資料請求・経営改善①】1日後：ガイドブックご確認 ＆ 30分無料相談のご案内'), false);
const legacyMaterialMix = [
  { ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[0], id: 'old-mat-1', targetMaterial: undefined, name: '【資料請求①】1日後：資料ご確認のお伺い ＆ 無料相談のご案内', updatedAt: 100 },
  { ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[1], id: 'old-mat-2', targetMaterial: undefined, name: '【資料請求②】3日後：3分診断・具体策のご提案', updatedAt: 100 },
  { ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[2], id: 'old-mat-3', targetMaterial: undefined, name: '【資料請求③】7日後：今後のご検討状況お伺い（自動フォロー最終）', updatedAt: 100 },
];
const cleanedMaterialMerge = mergeStarterScenarioBatch(legacyMaterialMix, MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS, { nowMs: 3000 });
assert.equal(cleanedMaterialMerge.merged.length, 6);
assert.ok(cleanedMaterialMerge.merged.every((s) => !isLegacyMaterialScenarioName(s.name)));

assert.equal(isLegacyPostMeetingScenarioName('【レポート後】3日後：詳細診断レポートのご感想・ご不明点'), true);
assert.equal(isLegacyPostMeetingScenarioName('【提案後①】3日後：ご提案書のご確認状況・ご質問のお伺い'), true);
assert.equal(isLegacyPostMeetingScenarioName('【提案後②】7日後：ご検討状況のお伺い（導入範囲や時期の調整）'), true);
assert.equal(isLegacyPostMeetingScenarioName('【レポート＆提案書送付後①】3日後：ご確認状況 ＆ ご質問のお伺い'), true);
assert.equal(isLegacyPostMeetingScenarioName('【提案書送付後①】3日後：ご確認状況 ＆ ご質問のお伺い'), false);
const legacyPostMix = [
  { ...MST_POST_MEETING_STARTER_SCENARIOS[0], id: 'old-rep', trigger: 'report_sent' as const, name: '【レポート後】3日後：詳細診断レポートのご感想・ご不明点', updatedAt: 100 },
  { ...MST_POST_MEETING_STARTER_SCENARIOS[0], id: 'old-prop1', trigger: 'proposal_sent' as const, name: '【提案後①】3日後：ご提案書のご確認状況・ご質問のお伺い', updatedAt: 100 },
  { ...MST_POST_MEETING_STARTER_SCENARIOS[0], id: 'old-prop2', trigger: 'proposal_sent' as const, name: '【提案後②】7日後：ご検討状況のお伺い（導入範囲や時期の調整）', updatedAt: 100 },
  { ...MST_POST_MEETING_STARTER_SCENARIOS[0], id: 'old-repprop1', trigger: 'report_or_proposal_sent' as const, name: '【レポート＆提案書送付後①】3日後：ご確認状況 ＆ ご質問のお伺い', updatedAt: 100 },
];
const cleanedPostMerge = mergeStarterScenarioBatch(legacyPostMix, MST_POST_MEETING_STARTER_SCENARIOS, { nowMs: 3000 });
assert.equal(cleanedPostMerge.merged.length, 3);
assert.ok(cleanedPostMerge.merged.every((s) => !isLegacyPostMeetingScenarioName(s.name)));
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

console.log('Test 28: Plan A delayed education shifts start timing per branch completion');
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS.line_registered), 2);
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS['選択:個別相談']), 7);
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS['介護保険外開業']), 7);
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS['選択:診断']), 5);
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS.public_form_consultation), 5);
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS.diagnosis_completed), 11);
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS.material_requested), 11);
console.log('  ✓ passed');

console.log('Test 29: deduplicateMarketingScenarios & mergeStarterScenarioBatch remove legacy renamed Episode 7');
const legacyEp7 = {
  ...MST_LINE_NURTURING_STARTER_SCENARIOS[6],
  id: 'legacy-ep7',
  name: '【第7話・最終話】自分がいないと現場が回らない状態から、脱却するチャンス',
  emailSubject: '【最終話】自分がいないと現場が回らない状態から、脱却するチャンス',
  automationEnabled: false,
  updatedAt: 9999999999999,
};
const currentEp7 = {
  ...MST_LINE_NURTURING_STARTER_SCENARIOS[6],
  id: 'current-ep7',
  automationEnabled: true,
  updatedAt: 1000,
};
const dedupedEp7 = deduplicateMarketingScenarios([legacyEp7, currentEp7]);
assert.equal(dedupedEp7.length, 1);
assert.equal(dedupedEp7[0].name, '【第7話・最終話】「自分がいなくても回る会社」への最初の一歩');

const mergedStory = mergeStarterScenarioBatch([legacyEp7], MST_LINE_NURTURING_STARTER_SCENARIOS, { nowMs: 5000 });
assert.equal(mergedStory.merged.length, 7);
assert.ok(!mergedStory.merged.some((s) => s.name.includes('脱却するチャンス')));
console.log('  ✓ passed');

console.log('Test 30: classifyScenarioTrack, formatting helpers, and funnel-order sorting across all 7 tracks');
assert.equal(classifyScenarioTrack(MST_DIAGNOSIS_STARTER_SCENARIOS[0]), 'branch_diagnosis');
assert.equal(classifyScenarioTrack(MST_CONSULT_STARTER_SCENARIOS[0]), 'branch_consult');
assert.equal(classifyScenarioTrack(MST_CARE_STARTER_SCENARIOS[0]), 'branch_care');
assert.equal(classifyScenarioTrack(MST_LINE_NURTURING_STARTER_SCENARIOS[0]), 'story_nurturing');
assert.equal(classifyScenarioTrack(MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[0]), 'material_followup');
assert.equal(classifyScenarioTrack(MST_POST_MEETING_STARTER_SCENARIOS[0]), 'post_meeting');
assert.equal(classifyScenarioTrack(MST_OUTREACH_STARTER_SCENARIOS[0]), 'sales_outreach');

assert.equal(formatScenarioTriggerLabel('report_or_proposal_sent'), 'ご提案書・レポート送付時（統合）');
assert.equal(formatScenarioTriggerLabel('tag_added', '選択:個別相談'), 'タグ「選択:個別相談」');
assert.equal(formatScenarioWaitMinutes(0), '即時');
assert.equal(formatScenarioWaitMinutes(45), '45分後');
assert.equal(formatScenarioWaitMinutes(120), '2時間後');
assert.equal(formatScenarioWaitMinutes(4320), '3日後');
assert.equal(formatScenarioStopCondition({ trigger: 'report_or_proposal_sent', stopOnBooking: false, stopOnDeal: true }), '返信・成約・終了で停止');
assert.equal(formatScenarioStopCondition({ trigger: 'material_requested', stopOnBooking: true, stopOnDeal: true }), '返信・予約・成約で停止');

const mixedFunnelScenarios = [
  { ...MST_OUTREACH_STARTER_SCENARIOS[4], id: 'out-5', updatedAt: 1 },
  { ...MST_POST_MEETING_STARTER_SCENARIOS[2], id: 'post-2', updatedAt: 1 },
  { ...MST_POST_MEETING_STARTER_SCENARIOS[0], id: 'post-0', updatedAt: 1 },
  { ...MST_POST_MEETING_STARTER_SCENARIOS[1], id: 'post-1', updatedAt: 1 },
  { ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[3], id: 'mat-care-1', updatedAt: 1 },
  { ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[2], id: 'mat-3', updatedAt: 1 },
  { ...MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[0], id: 'mat-1', updatedAt: 1 },
  { ...MST_LINE_NURTURING_STARTER_SCENARIOS[6], id: 'edu-7', updatedAt: 1 },
  { ...MST_LINE_NURTURING_STARTER_SCENARIOS[0], id: 'edu-1', updatedAt: 1 },
  { ...MST_CARE_STARTER_SCENARIOS[1], id: 'care-2', updatedAt: 1 },
  { ...MST_CONSULT_STARTER_SCENARIOS[0], id: 'consult-1', updatedAt: 1 },
  { ...MST_DIAGNOSIS_STARTER_SCENARIOS[0], id: 'diag-1', updatedAt: 1 },
  { ...MST_OUTREACH_STARTER_SCENARIOS[0], id: 'out-1', updatedAt: 1 },
];
const sortedFunnelIds = sortScenarios(mixedFunnelScenarios).map((s) => s.id);
assert.deepEqual(sortedFunnelIds, [
  'diag-1',
  'consult-1',
  'care-2',
  'edu-1',
  'edu-7',
  'mat-1',
  'mat-3',
  'mat-care-1',
  'post-0',
  'post-1',
  'post-2',
  'out-1',
  'out-5',
]);
console.log('  ✓ passed');

console.log('Test 31: ContactForm notes + answers.message deduplication prevents duplicate inquiry body and metadata leaks');
const contactFormCombinedNotes = [
  '【ご関心のあるテーマ】業務効率化・IT/自動化について',
  '【認知経路】検索エンジン（Google / Yahoo!）',
  '【ご相談内容】月末の請求書作成に丸2日かかっており自動化したいです。',
].join('\n');
const dedupedDetails = extractConsultationDetailsText({
  userNotes: contactFormCombinedNotes,
  answers: {
    service_interest: '業務効率化・IT/自動化について',
    hear_about: '検索エンジン（Google / Yahoo!）',
    message: '月末の請求書作成に丸2日かかっており自動化したいです。',
  },
});
assert.equal(dedupedDetails.consultationText, '月末の請求書作成に丸2日かかっており自動化したいです。');
const contactReply = buildConsultationInstantReply({
  name: '佐藤',
  companyName: '株式会社サンプル',
  inquiryType: '業務効率化・IT/自動化について',
  consultationText: dedupedDetails.consultationText,
  bookingUrl: 'https://timerex.net/s/mst/example',
});
assert.equal(contactReply.bodyText.split('月末の請求書作成に丸2日かかっており自動化したいです。').length - 1, 1);
assert.ok(!contactReply.bodyText.includes('【認知経路】'));
assert.ok(!contactReply.bodyText.includes('【ご関心のあるテーマ】'));

const fallbackOnlyDetails = extractConsultationDetailsText({
  userNotes: contactFormCombinedNotes,
  answers: {},
});
assert.equal(fallbackOnlyDetails.consultationText, '月末の請求書作成に丸2日かかっており自動化したいです。');
console.log('  ✓ passed');

console.log('Test 32: material_download, diagnosis, and care_package instant replies align with submitted choices and unified footer');
const matReply = buildMaterialDownloadInstantReply({
  name: '高橋',
  requestedMaterials: [
    { label: '業務改善・DX推進ガイドブック', url: 'https://corp.mstcorp.info/materials/business-improvement-guide.pdf' },
  ],
  bookingUrl: 'https://timerex.net/s/mst/example',
});
assert.ok(matReply.bodyText.includes('業務改善・DX推進ガイドブック'));
assert.ok(matReply.bodyText.includes('https://corp.mstcorp.info/materials/business-improvement-guide.pdf'));
assert.ok(!matReply.bodyText.includes('詳細診断レポート'));

const diagReply = buildDiagnosisInstantReply({
  name: '鈴木',
  formName: '3分無料経営診断',
  typeTitle: '社長ボトルネック・現場過負荷型',
  badge: '要緊急改善',
  summary: '月末の請求処理や顧客対応が属人化し、経営判断の時間が圧迫されている状態です。',
  firstStep: '属人作業の棚卸し',
  freeNotes: '現場が回らず採用も難航しています。',
  bookingUrl: 'https://timerex.net/s/mst/example',
});
assert.ok(diagReply.emailBodyText.includes('社長ボトルネック・現場過負荷型'));
assert.ok(diagReply.emailBodyText.includes('要緊急改善'));
assert.ok(diagReply.emailBodyText.includes('月末の請求処理や顧客対応が属人化し、経営判断の時間が圧迫されている状態です。'));
assert.ok(diagReply.emailBodyText.includes('属人作業の棚卸し'));
assert.ok(diagReply.emailBodyText.includes('現場が回らず採用も難航しています。'));
assert.ok(diagReply.emailBodyText.includes('ご提案書（診断結果および改善プラン）'));
assert.ok(!diagReply.emailBodyText.includes('桧町127番地'));
assert.ok(diagReply.lineBodyText.includes('ご提案書（診断結果および改善プラン）'));

const careConsultReply = buildCarePackageInstantReply({
  name: '伊藤',
  inquiryType: '開業相談',
  bookingUrl: 'https://timerex.net/s/mst/care',
  consultationText: '訪問介護に保険外自費サービスを追加したい',
});
assert.ok(careConsultReply.bodyText.includes('訪問介護に保険外自費サービスを追加したい'));
assert.ok(careConsultReply.bodyText.includes('https://timerex.net/s/mst/care'));
assert.ok(!careConsultReply.bodyText.includes('開業パッケージ資料URL'));

const careBothReply = buildCarePackageInstantReply({
  name: '渡辺',
  inquiryType: '両方希望',
  requestedMaterials: [{ label: '介護保険外サービス開業パッケージ資料', url: 'https://corp.mstcorp.info/materials/care-package-proposal.pdf' }],
  bookingUrl: 'https://timerex.net/s/mst/care',
  consultationText: '資料と相談両方お願いします',
});
assert.ok(careBothReply.bodyText.includes('https://corp.mstcorp.info/materials/care-package-proposal.pdf'));
assert.ok(careBothReply.bodyText.includes('https://timerex.net/s/mst/care'));
assert.ok(careBothReply.bodyText.includes('資料と相談両方お願いします'));
console.log('  ✓ passed');

console.log('Test 33: prepareEmailPayloadContent places body -> signature -> embeddedHtmlSection');
const docEmail = prepareEmailPayloadContent('書類をご確認ください。\nhttps://os.mstcorp.info/docs/test-doc-id', {
  senderEmail: 'contact@mstcorp.info',
  embeddedHtmlSection: '<div id="doc-preview-card"><h1>業務委託基本契約書</h1></div>',
});
assert.ok(docEmail.html.includes('id="doc-preview-card"'));
assert.ok(docEmail.html.includes('max-width:760px'));
assert.ok(docEmail.html.indexOf('書類をご確認ください。') < docEmail.html.indexOf('桧町127番地'));
assert.ok(docEmail.html.indexOf('桧町127番地') < docEmail.html.indexOf('id="doc-preview-card"'));
assert.ok(!docEmail.text.includes('<div id="doc-preview-card">'));
console.log('  ✓ passed');

console.log('Test 34: Human reply to consultation leads shifts education steps to Day 4+ and excludes non-consultation leads');
assert.equal(getEducationStartDayForShift(BRANCH_EDUCATION_DELAY_DAYS.consultation_human_reply), 4);
const onHumanReply = getSupersededPhasesOnEvent({ trigger: 'consultation_human_replied' });
assert.deepEqual(onHumanReply.cancelPhases, ['education_nurturing']);

assert.equal(isEligibleSourceTypeForConsultationHumanReply('announcement_announcement'), true);
assert.equal(isEligibleSourceTypeForConsultationHumanReply('freeform_announcement'), true);
assert.equal(isEligibleSourceTypeForConsultationHumanReply('deal_invitation'), true);
assert.equal(isEligibleSourceTypeForConsultationHumanReply('line_reply'), true);
assert.equal(isEligibleSourceTypeForConsultationHumanReply('sales_outreach'), false);
assert.equal(isEligibleSourceTypeForConsultationHumanReply('customer_document'), false);
assert.equal(isEligibleSourceTypeForConsultationHumanReply('marketing_broadcast'), false);
assert.equal(isEligibleSourceTypeForConsultationHumanReply('customer_meeting_invitation'), false);

assert.equal(
  isConsultationLeadEligibleForHumanReplyEducation({
    hasProgressedBeyondNurturing: false,
    isExistingCustomer: false,
    latestLeadStatus: '相談申込',
    latestLeadSource: 'HP：相談・問い合わせ',
    branchTags: [],
  }),
  true
);
assert.equal(
  isConsultationLeadEligibleForHumanReplyEducation({
    hasProgressedBeyondNurturing: false,
    isExistingCustomer: false,
    latestLeadStatus: '未対応',
    latestLeadSource: 'LINE公式',
    branchTags: ['選択:個別相談'],
  }),
  true
);
assert.equal(
  isConsultationLeadEligibleForHumanReplyEducation({
    hasProgressedBeyondNurturing: true,
    isExistingCustomer: false,
    latestLeadStatus: '相談申込',
  }),
  false
);
assert.equal(
  isConsultationLeadEligibleForHumanReplyEducation({
    hasProgressedBeyondNurturing: false,
    isExistingCustomer: true,
    latestLeadStatus: '相談申込',
  }),
  false
);
assert.equal(
  isConsultationLeadEligibleForHumanReplyEducation({
    hasProgressedBeyondNurturing: false,
    isExistingCustomer: false,
    latestLeadStatus: '資料請求',
  }),
  false
);
assert.equal(
  isConsultationLeadEligibleForHumanReplyEducation({
    hasProgressedBeyondNurturing: false,
    isExistingCustomer: false,
    latestLeadStatus: '診断申込',
  }),
  false
);
assert.equal(
  isConsultationLeadEligibleForHumanReplyEducation({
    hasProgressedBeyondNurturing: false,
    isExistingCustomer: false,
    latestLeadStatus: '新規',
    latestLeadSource: '見込み企業リスト',
    branchTags: [],
  }),
  false
);
console.log('  ✓ passed');

console.log('Test 35: Legacy Branch B (直相談 / lead_created) is detected and cleaned up cleanly');
const legacyDirectConsult = {
  ...MST_CONSULT_STARTER_SCENARIOS[1],
  id: 'legacy-direct-consult',
  name: '【B】直相談フォロー（見込み客登録時）',
  trigger: 'lead_created' as const,
  targetTag: undefined,
  updatedAt: 1000,
};
assert.equal(isLegacyBranchBScenario(legacyDirectConsult), true);
assert.equal(isLegacyBranchBScenario(MST_CONSULT_STARTER_SCENARIOS[0]), false);
assert.equal(isLegacyBranchBScenario(MST_CONSULT_STARTER_SCENARIOS[1]), false);

const mergedConsult = mergeStarterScenarioBatch(
  [legacyDirectConsult],
  MST_CONSULT_STARTER_SCENARIOS,
  { nowMs: 5000 }
);
assert.equal(mergedConsult.merged.length, MST_CONSULT_STARTER_SCENARIOS.length);
assert.ok(!mergedConsult.merged.some((s) => s.name.includes('直相談')));
console.log('  ✓ passed');

console.log('Test 36: line_registered trigger label clearly shows follow-up +4 days timing');
assert.equal(formatScenarioTriggerLabel('line_registered'), 'LINE登録された時 ＋ フォロー4日後');
console.log('  ✓ passed');

console.log('Test 37: dual-pattern material request matching routes management vs care-package vs both cleanly');
const mgmtStep = MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[0];
const careStep = MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS[3];
assert.equal(inferScenarioTargetMaterial(mgmtStep), 'management');
assert.equal(inferScenarioTargetMaterial(careStep), 'care');
assert.equal(inferScenarioTargetMaterial({ name: '【資料請求①】1日後：汎用資料フォロー' }), 'all');

assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: mgmtStep.targetMaterial,
    name: mgmtStep.name,
    materialKeys: ['management-guide'],
    isCarePackage: false,
  }),
  true
);
assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: careStep.targetMaterial,
    name: careStep.name,
    materialKeys: ['management-guide'],
    isCarePackage: false,
  }),
  false
);
assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: mgmtStep.targetMaterial,
    name: mgmtStep.name,
    materialKeys: ['care-package-overview'],
    isCarePackage: true,
  }),
  false
);
assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: careStep.targetMaterial,
    name: careStep.name,
    materialKeys: ['care-package-overview'],
    isCarePackage: true,
  }),
  true
);
// 両方請求時は二重配信防止のため1系統（isCarePackage=false時はmanagement、true時はcare）のみ起動
assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: mgmtStep.targetMaterial,
    name: mgmtStep.name,
    materialKeys: ['management-guide', 'care-package-overview'],
    isCarePackage: false,
  }),
  true
);
assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: careStep.targetMaterial,
    name: careStep.name,
    materialKeys: ['management-guide', 'care-package-overview'],
    isCarePackage: false,
  }),
  false
);
// care-package専用ページからの資料請求（キー省略時でも isCarePackage=true なら care に振り分け）
assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: careStep.targetMaterial,
    name: careStep.name,
    materialKeys: [],
    isCarePackage: true,
  }),
  true
);
assert.equal(
  doesScenarioMatchRequestedMaterials({
    targetMaterial: mgmtStep.targetMaterial,
    name: mgmtStep.name,
    materialKeys: [],
    isCarePackage: true,
  }),
  false
);
console.log('  ✓ passed');

console.log('Test 38: 1業種1社モニター提案テンプレート生成・カスタム差し替え・分類順の検証');
const monitorDefault = getMonitorOutreachTemplate('テスト建設株式会社', '山田太郎', '建設業', 'https://example.com/check');
assert.equal(monitorDefault.step, -1);
assert.match(monitorDefault.subject, /1業種1社限定|モニター/);
assert.match(monitorDefault.body, /山田太郎 様/);
assert.match(monitorDefault.body, /【建設業】/);
assert.match(monitorDefault.body, /1業種1社限定/);
assert.match(monitorDefault.body, /https:\/\/example\.com\/check/);

const monitorCustom = resolveMonitorOutreachDraft(
  {
    emailSubject: '【{industry}・1社限定】{company_name}様へモニターのご案内',
    emailBody: '{recipient_name} 様\n業種:{industry}\nURL:{link_url}',
  },
  '株式会社サンプル',
  '佐藤花子',
  '医療・クリニック',
  'https://example.com/monitor'
);
assert.equal(monitorCustom.name, MONITOR_ONE_SHOT_SCENARIO_NAME);
assert.equal(monitorCustom.subject, '【医療・クリニック・1社限定】株式会社サンプル様へモニターのご案内');
assert.equal(monitorCustom.body, '佐藤花子 様\n業種:医療・クリニック\nURL:https://example.com/monitor');

const baseOutreachScenario = MST_OUTREACH_STARTER_SCENARIOS[0];
const monitorScenarioMock = {
  ...baseOutreachScenario,
  id: MONITOR_ONE_SHOT_SCENARIO_ID,
  name: MONITOR_ONE_SHOT_SCENARIO_NAME,
  trigger: 'manual' as const,
  updatedAt: 1,
};
const oneShotScenarioMock = {
  ...baseOutreachScenario,
  id: ONE_SHOT_SCENARIO_ID,
  name: ONE_SHOT_SCENARIO_NAME,
  trigger: 'manual' as const,
  updatedAt: 1,
};
const step1ScenarioMock = {
  ...baseOutreachScenario,
  id: 'outreach-step-1',
  name: '【営業メール第1通】導入・簡易診断のご案内',
  trigger: 'manual' as const,
  updatedAt: 1,
};

assert.equal(classifyScenarioTrack(monitorScenarioMock), 'sales_outreach');
const oneShotSort = getScenarioSortKey(oneShotScenarioMock);
const monitorSort = getScenarioSortKey(monitorScenarioMock);
const step1Sort = getScenarioSortKey(step1ScenarioMock);
assert.ok(oneShotSort.stepNumber < monitorSort.stepNumber, 'モニター提案は一発直球の直後に並ぶ');
assert.ok(monitorSort.stepNumber < step1Sort.stepNumber, 'モニター提案はステップ第1通より前に並ぶ');
console.log('  ✓ passed');

console.log('Test 39: public_form_consultation supersedes outreach/short education & formatJobActionLabel aligns job action labels');
const onConsultForm = getSupersededPhasesOnEvent({ trigger: 'public_form_consultation' });
assert.deepEqual(onConsultForm.cancelPhases, ['education_nurturing', 'sales_outreach']);
assert.match(onConsultForm.reason, /^相談フォームを受信したため/);

assert.equal(formatJobActionLabel({ eventKey: 'material_requested:c1:s1:email' }), '資料請求フォーム送信');
assert.equal(formatJobActionLabel({ eventKey: 'diagnosis_completed:c1:s1:line' }), '診断フォーム完了');
assert.equal(formatJobActionLabel({ eventKey: 'education_delayed:lead_created:c1:s1:email' }), '相談フォーム（長期育成）');
assert.equal(formatJobActionLabel({ eventKey: 'prospect_monitor_one_shot:p1:c1:2026-11-20', scenarioId: 'prospect-monitor-one-shot' }), '営業メール（モニター提案）');
assert.equal(formatJobActionLabel({ eventKey: 'booking_created:c1:s1:email' }), '面談予約確定');
assert.equal(formatJobActionLabel({ eventKey: 'tag_added:c1:s1:line', scenarioTrigger: 'tag_added', scenarioTargetTag: '選択:診断' }), 'タグ「選択:診断」');
assert.equal(formatJobActionLabel({ scenarioTrigger: 'meeting_completed' }), '面談完了時');
console.log('  ✓ passed');

console.log('=== All Outreach Footer & Follow-up Tests Passed! ===');
