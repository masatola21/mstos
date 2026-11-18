import assert from 'node:assert/strict';
import { deduceLeadInquiryType } from '../src/utils/leadClassification';
import {
  buildPublicFormAdminBackupEmail,
  classifyPublicFormNotificationKind,
  hasCoreDiagnosisAnswers,
} from '../server/publicFormReply';

console.log('=== Running Public Form Backup & Lead Classification Tests ===');

console.log('Test 1: deduceLeadInquiryType keeps consultation leads out of 資料請求 even when notes mention 資料 and 介護');
assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '開業相談',
    source: 'HP：開業パッケージ',
    status: '相談申込',
    notes: '[申込 req-1] HP：開業パッケージ / 2026-11-18\n【自由記入メモ】資料を見て介護保険外サービス開業パッケージについて相談したいです。',
  }),
  '開業相談',
);

assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '',
    source: 'HP：お問い合わせ',
    status: '相談申込',
    notes:
      '[申込 req-2] HP：お問い合わせ / 2026-11-18\n【ご関心のあるテーマ】介護保険外サービス開業パッケージについて\n【ご相談内容】資料を拝見し、開業相談を希望します。',
  }),
  '介護保険外開業',
);

assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '介護保険外開業',
    source: 'HP：お問い合わせ',
    status: '相談申込',
    notes: '[申込 req-3] HP：お問い合わせ\n【請求ではなく相談】資料の補足説明を希望',
  }),
  '介護保険外開業',
);

assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '両方希望',
    source: 'HP：開業パッケージ',
    status: '相談申込',
    notes: '介護保険外開業パッケージと資料の両方希望',
  }),
  '両方希望',
);
console.log('  ✓ passed');

console.log('Test 2: deduceLeadInquiryType evaluates only the latest submission block when prior material block exists');
const multiSubmissionNotes = [
  '[申込 old-1] HP：資料請求 / 2026-11-10\n【希望内容】資料請求\n【請求資料】② 介護保険外サービス開業パッケージ資料',
  '[申込 new-2] HP：お問い合わせ / 2026-11-18\n【希望内容】介護保険外開業\n【ご関心のあるテーマ】介護保険外サービス開業パッケージについて\n【ご相談内容】個別相談を申し込みます。',
].join('\n\n');

assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '',
    source: 'HP：お問い合わせ',
    status: '相談申込',
    notes: multiSubmissionNotes,
  }),
  '介護保険外開業',
);
console.log('  ✓ passed');

console.log('Test 3: deduceLeadInquiryType still enriches genuine material request leads accurately');
assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '資料請求',
    source: 'HP：資料請求',
    status: '資料請求',
    notes: '[申込 mat-1] HP：資料請求\n【請求資料】② 介護保険外サービス開業パッケージ資料',
  }),
  '資料請求: 介護保険外開業パッケージ',
);

assert.equal(
  deduceLeadInquiryType({
    inquiry_type: '資料請求',
    source: 'HP：資料請求',
    status: '資料請求',
    notes:
      '[申込 mat-2] HP：資料請求\n【請求資料】① 経営改善実務ガイドブック、② 介護保険外サービス開業パッケージ資料',
  }),
  '資料請求: 実務ガイド・介護開業パッケージ',
);
console.log('  ✓ passed');

console.log('Test 4: classifyPublicFormNotificationKind never misclassifies consultation forms as diagnosis');
assert.equal(
  classifyPublicFormNotificationKind({
    slug: 'contact-inquiry',
    formType: 'diagnosis', // DB legacy/default misconfiguration guard
    inquiryType: '介護保険外開業',
    isCarePackage: false,
    formName: 'MST 総合お問い合わせ・経営相談フォーム',
    answers: {
      service_interest: '介護保険外サービス開業パッケージについて',
      message: '個別相談を申し込みます。',
    },
    utmInquiryType: 'consultation',
  }),
  'consultation_inquiry',
);

assert.equal(
  classifyPublicFormNotificationKind({
    slug: 'custom-consult-2026',
    formType: 'diagnosis',
    inquiryType: '経営相談',
    isCarePackage: false,
    formName: '介護保険外 開業個別相談フォーム',
    answers: { message: '相談したいです' },
  }),
  'consultation_inquiry',
);

assert.equal(
  classifyPublicFormNotificationKind({
    slug: 'care-package-inquiry',
    formType: 'consultation',
    inquiryType: '開業相談',
    isCarePackage: true,
    formName: '介護保険外サービス開業パッケージ',
    answers: { q_inquiry_type: '開業相談' },
  }),
  'care_package',
);

assert.equal(
  classifyPublicFormNotificationKind({
    slug: 'business-diagnosis',
    formType: 'diagnosis',
    inquiryType: 'ボトルネック診断',
    isCarePackage: false,
    answers: {
      q_ops_bottleneck: '手作業が多く残業が減らない',
      q_profit_bottleneck: '粗利率の把握ができていない',
    },
  }),
  'diagnosis',
);

assert.equal(hasCoreDiagnosisAnswers({ q_ops_bottleneck: '手作業が多い' }), true);
assert.equal(hasCoreDiagnosisAnswers({ service_interest: '介護保険外サービス開業パッケージについて' }), false);
console.log('  ✓ passed');

console.log('Test 5: buildPublicFormAdminBackupEmail generates personal backup emails for all form types');
const diagBackup = buildPublicFormAdminBackupEmail({
  notificationKind: 'diagnosis',
  formName: '経営ボトルネック診断フォーム',
  slug: 'business-diagnosis',
  name: '佐藤花子',
  companyName: '医療法人テスト',
  email: 'sato@example.com',
  phone: '090-1111-2222',
  inquiryType: 'ボトルネック診断',
  answers: {
    q_ops_bottleneck: 'Excel転記が多い',
    q_profit_bottleneck: '単価設計が曖昧',
    q_free_notes: '来月から改善を進めたい',
  },
  quickBottleneck: {
    typeTitle: '属人化・手作業停滞タイプ',
    badge: '業務負荷大',
  },
  hearAbout: '検索',
  utmDetails: '流入: Google検索',
  lineAutoReplySent: false,
  emailAutoReplySent: true,
  emailAutoReplyStatus: 'sent',
  appUrl: 'https://os.mstcorp.info',
});
assert.ok(diagBackup.subject.includes('フォーム控え・経営診断'));
assert.ok(diagBackup.subject.includes('佐藤花子 様'));
assert.ok(diagBackup.text.includes('属人化・手作業停滞タイプ'));
assert.ok(diagBackup.text.includes('手作業・業務プロセスの急所：Excel転記が多い'));
assert.ok(diagBackup.text.includes('お客様メール自動返信送信済み'));

const materialBackup = buildPublicFormAdminBackupEmail({
  notificationKind: 'material_download',
  formName: '経営改善実務ガイド 資料請求フォーム',
  slug: 'material-download',
  name: '鈴木一郎',
  companyName: '有限会社サンプル',
  email: 'suzuki@example.com',
  inquiryType: '資料請求: 介護保険外開業パッケージ',
  requestedMaterials: [{ label: '② 介護保険外サービス開業パッケージ資料' }],
  lineAutoReplySent: true,
  emailAutoReplySent: false,
  emailAutoReplyStatus: 'queued',
});
assert.ok(materialBackup.subject.includes('フォーム控え・資料請求'));
assert.ok(materialBackup.text.includes('② 介護保険外サービス開業パッケージ資料'));
assert.ok(materialBackup.text.includes('LINE自動返信送信済み'));

const careBackup = buildPublicFormAdminBackupEmail({
  notificationKind: 'care_package',
  formName: '介護保険外サービス開業パッケージ',
  slug: 'care-package-inquiry',
  name: '高橋健太',
  companyName: 'ケアサポート株式会社',
  email: 'takahashi@example.com',
  inquiryType: '開業相談',
  consultationText: '自費リハビリの立ち上げを相談したい',
  emailAutoReplySent: true,
  emailAutoReplyStatus: 'sent',
});
assert.ok(careBackup.subject.includes('フォーム控え・開業パッケージ（開業相談）'));
assert.ok(careBackup.text.includes('自費リハビリの立ち上げを相談したい'));

const consultBackup = buildPublicFormAdminBackupEmail({
  notificationKind: 'consultation_inquiry',
  formName: 'MST 総合お問い合わせ・経営相談フォーム',
  slug: 'contact-inquiry',
  name: '田中美咲',
  companyName: '株式会社田中介護',
  email: 'tanaka@example.com',
  inquiryType: '介護保険外開業',
  consultationText: '介護保険外開業パッケージの個別相談を希望します',
  preferredDateText: '今週木曜 14時希望',
  hearAbout: 'Instagram',
  utmDetails: '流入: Instagram',
  lineAutoReplySent: false,
  emailAutoReplySent: true,
  emailAutoReplyStatus: 'sent',
});
assert.ok(consultBackup.subject.includes('要メール返信・Web相談'));
assert.ok(consultBackup.text.includes('tanaka@example.com'));
assert.ok(consultBackup.text.includes('介護保険外開業パッケージの個別相談を希望します'));
assert.ok(consultBackup.text.includes('認知経路：Instagram'));
console.log('  ✓ passed');

console.log('=== All Public Form Backup & Lead Classification Tests Passed! ===');
