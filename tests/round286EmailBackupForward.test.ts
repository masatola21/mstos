/**
 * ユニットテスト: 【2-8-6 受信メールのバックアップ転送（Gmailへのコピー）】
 * - shouldForwardInboundEmail の判定ロジック検証
 *   - 有効/無効フラグ
 *   - バックアップアドレスの形式
 *   - ループ防止 1: 差出人がバックアップ先アドレスと一致
 *   - ループ防止 2: 差出人がOS差出人アドレスと一致
 *   - ループ防止 3: noreply/mailer-daemon などの配信専用アドレス
 *   - ループ防止 4: X-MST-Backup-Copy ヘッダー（object / array）
 *   - 配信停止・不達バウンス通知の除外
 *   - 正常な受信メールの転送許可
 * - extractEmailAddress の抽出検証
 * - resolveEmailSender のフォールバック検証
 */

import {
  shouldForwardInboundEmail,
  extractEmailAddress,
  resolveEmailSender,
} from '../server.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== Running Round 2-8-6 Email Backup Forward Unit Tests ===\n');

  // Test 1: extractEmailAddress
  console.log('Test 1: extractEmailAddress');
  {
    assert(extractEmailAddress('Masato Ohashi <contact@mstcorp.info>') === 'contact@mstcorp.info', 'Bracket email');
    assert(extractEmailAddress('  mst.shikumikaizen@gmail.com  ') === 'mst.shikumikaizen@gmail.com', 'Raw trimmed email');
    assert(extractEmailAddress('"Support Team" <support@example.jp>') === 'support@example.jp', 'Quoted name email');
    assert(extractEmailAddress('') === '', 'Empty email');
    console.log('  ✓ extractEmailAddress passed');
  }

  // Test 2: shouldForwardInboundEmail - 無効設定および未設定アドレス
  console.log('Test 2: Disabled or missing forward address');
  {
    const resDisabled = shouldForwardInboundEmail({
      senderEmail: 'client@example.com',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: false,
      osSenderEmail: 'contact@mstcorp.info',
      subject: '業務改善の相談について',
    });
    assert(!resDisabled.shouldForward, 'Should not forward when disabled');
    assert(Boolean(resDisabled.reason?.includes('無効')), 'Reason mentions disabled');

    const resNoAddress = shouldForwardInboundEmail({
      senderEmail: 'client@example.com',
      backupForwardAddress: '',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: '業務改善の相談について',
    });
    assert(!resNoAddress.shouldForward, 'Should not forward when address is empty');

    const resInvalidAddress = shouldForwardInboundEmail({
      senderEmail: 'client@example.com',
      backupForwardAddress: 'not-an-email',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: '業務改善の相談について',
    });
    assert(!resInvalidAddress.shouldForward, 'Should not forward when address is invalid');
    console.log('  ✓ Disabled or missing forward address passed');
  }

  // Test 3: shouldForwardInboundEmail - ループ防止 1 & 2 (差出人がバックアップ先またはOS差出人)
  console.log('Test 3: Loop prevention (forward destination & OS sender)');
  {
    const resSameAsBackup = shouldForwardInboundEmail({
      senderEmail: 'mst.shikumikaizen@gmail.com',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: 'Re: 【控え】業務改善の相談について',
    });
    assert(!resSameAsBackup.shouldForward, 'Should block forwarding if sender is backup address');
    assert(Boolean(resSameAsBackup.reason?.includes('バックアップ先アドレスと一致')), 'Reason mentions backup match');

    const resSameAsOs = shouldForwardInboundEmail({
      senderEmail: '有限会社MST <contact@mstcorp.info>',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: 'Re: 業務改善の相談について',
    });
    assert(!resSameAsOs.shouldForward, 'Should block forwarding if sender is OS sender address');
    assert(Boolean(resSameAsOs.reason?.includes('OS差出人アドレスと一致')), 'Reason mentions OS sender match');
    console.log('  ✓ Loop prevention (forward destination & OS sender) passed');
  }

  // Test 4: shouldForwardInboundEmail - ループ防止 3 (noreply等)
  console.log('Test 4: Loop prevention (noreply addresses)');
  {
    for (const noreply of [
      'no-reply@service.com',
      'noreply@marketing.example.com',
      'mailer-daemon@googlemail.com',
      'postmaster@mail.yahoo.co.jp',
      'notifications@slack.com',
      'bounce@bounce.resend.com',
    ]) {
      const res = shouldForwardInboundEmail({
        senderEmail: noreply,
        backupForwardAddress: 'mst.shikumikaizen@gmail.com',
        backupForwardEnabled: true,
        osSenderEmail: 'contact@mstcorp.info',
        subject: '自動配信メッセージ',
      });
      assert(!res.shouldForward, `Should block ${noreply}`);
      assert(Boolean(res.reason?.includes('システム/配信専用アドレス')), `Reason for ${noreply}`);
    }
    console.log('  ✓ Loop prevention (noreply addresses) passed');
  }

  // Test 5: shouldForwardInboundEmail - ループ防止 4 (X-MST-Backup-Copy ヘッダー)
  console.log('Test 5: Loop prevention (X-MST-Backup-Copy header)');
  {
    // Object header
    const resHeaderObj = shouldForwardInboundEmail({
      senderEmail: 'external@example.com',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: '【控え】テスト',
      headers: { 'X-MST-Backup-Copy': '1', 'Message-ID': '<123@abc>' },
    });
    assert(!resHeaderObj.shouldForward, 'Should block if X-MST-Backup-Copy header is present in object');
    assert(Boolean(resHeaderObj.reason?.includes('X-MST-Backup-Copy')), 'Reason mentions header');

    // Array header (Resend format)
    const resHeaderArr = shouldForwardInboundEmail({
      senderEmail: 'external@example.com',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: '【控え】テスト',
      headers: [
        { name: 'Subject', value: 'Test' },
        { name: 'x-mst-backup-copy', value: '1' },
      ],
    });
    assert(!resHeaderArr.shouldForward, 'Should block if x-mst-backup-copy is in header array');
    console.log('  ✓ Loop prevention (X-MST-Backup-Copy header) passed');
  }

  // Test 6: shouldForwardInboundEmail - 配信停止・不達バウンス通知の除外
  console.log('Test 6: Bounce and opt-out notifications');
  {
    const resBounce = shouldForwardInboundEmail({
      senderEmail: 'mail-system@provider.com',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: 'Delivery Status Notification (Failure)',
    });
    assert(!resBounce.shouldForward, 'Should block bounce notice');
    assert(Boolean(resBounce.reason?.includes('不達または配信停止')), 'Reason mentions bounce/opt-out');

    const resOptOut = shouldForwardInboundEmail({
      senderEmail: 'customer@company.com',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: 'メール配信停止完了のご連絡',
    });
    assert(!resOptOut.shouldForward, 'Should block opt-out confirmation notice');
    console.log('  ✓ Bounce and opt-out notifications passed');
  }

  // Test 7: shouldForwardInboundEmail - 正常な受信メールの転送許可
  console.log('Test 7: Valid inbound email forward');
  {
    const resValid = shouldForwardInboundEmail({
      senderEmail: 'Yamada Taro <yamada@tanaka-corp.jp>',
      backupForwardAddress: 'mst.shikumikaizen@gmail.com',
      backupForwardEnabled: true,
      osSenderEmail: 'contact@mstcorp.info',
      subject: '介護保険外サービス開業パッケージについてのお問い合わせ',
      textBody: '担当者様\n\n自費リハビリの開業を検討しており資料を拝見しました。\n詳しい相談をお願いできますでしょうか。',
    });
    assert(resValid.shouldForward, 'Valid inbound email should be forwarded');
    assert(!resValid.reason, 'No block reason for valid email');
    console.log('  ✓ Valid inbound email forward passed');
  }

  // Test 8: resolveEmailSender
  console.log('Test 8: resolveEmailSender fallback');
  {
    const sender = await resolveEmailSender(null);
    assert(Boolean(sender.senderName), 'Sender name should be present');
    assert(Boolean(sender.senderEmail), 'Sender email should be present');
    assert(sender.fromString.includes(sender.senderEmail), 'fromString contains senderEmail');
    assert(Boolean(sender.replyToEmail), 'replyToEmail should be present');
    console.log('  ✓ resolveEmailSender fallback passed');
  }

  console.log('\n=== All Round 2-8-6 Email Backup Forward Unit Tests Passed! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
