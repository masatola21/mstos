/**
 * ユニットテスト: 請求金額計算、送信条件（時間帯・配信停止）、指数バックオフ、キルスイッチ
 */
import {
  calculateBillingAmount,
  determineContractMonthlyFee,
  isContractAlreadyBilled,
  getEndOfNextMonthDate,
} from '../src/utils/billingUtils';
import {
  checkSendTimeWindow,
  shouldSkipAutomationDelivery,
  calculateExponentialBackoff,
} from '../src/utils/automationRuleUtils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== Running Billing & Automation Review Tests ===\n');

  // --------------------------------------------------------------------------
  // Test 1: 請求金額計算ロジック（税抜、10%消費税、税込合計、端数切り捨て）
  // --------------------------------------------------------------------------
  console.log('Test 1: calculateBillingAmount');
  {
    // 通常のケース: 100,000円 ➔ 税10,000円 ➔ 税込110,000円
    const res1 = calculateBillingAmount(100000);
    assert(res1.subtotal === 100000, `subtotal should be 100000, got ${res1.subtotal}`);
    assert(res1.taxAmount === 10000, `taxAmount should be 10000, got ${res1.taxAmount}`);
    assert(res1.totalWithTax === 110000, `totalWithTax should be 110000, got ${res1.totalWithTax}`);

    // 端数切り捨てテスト: 999円 ➔ 10%は 99.9円 ➔ 切り捨てて 99円 ➔ 合計 1,098円
    const res2 = calculateBillingAmount(999);
    assert(res2.taxAmount === 99, `taxAmount for 999 should floor to 99, got ${res2.taxAmount}`);
    assert(res2.totalWithTax === 1098, `totalWithTax should be 1098, got ${res2.totalWithTax}`);

    // 0円・負数ガード
    const res3 = calculateBillingAmount(0);
    assert(res3.totalWithTax === 0, 'Zero subtotal should yield 0 total');
    const res4 = calculateBillingAmount(-500);
    assert(res4.totalWithTax === 0, 'Negative subtotal should floor to 0');
    console.log('  ✓ calculateBillingAmount passed');
  }

  // --------------------------------------------------------------------------
  // Test 2: 契約・商談からの月額料金判定 (determineContractMonthlyFee)
  // --------------------------------------------------------------------------
  console.log('Test 2: determineContractMonthlyFee');
  {
    // 商談に明示的な monthly_fee がある場合
    const feeFromDeal = determineContractMonthlyFee(
      { status: 'active', contract_type: 'retainer', amount: 50000 },
      { monthly_fee: 80000 }
    );
    assert(feeFromDeal === 80000, `Should prioritize deal monthly_fee (expected 80000, got ${feeFromDeal})`);

    // リテーナー契約で契約金額を使用する場合
    const feeFromRetainer = determineContractMonthlyFee(
      { status: 'signed', contract_type: 'retainer', amount: 150000 }
    );
    assert(feeFromRetainer === 150000, `Should use contract retainer amount (expected 150000, got ${feeFromRetainer})`);

    // 契約終了または非定期契約
    const feeNonRetainer = determineContractMonthlyFee(
      { status: 'cancelled', contract_type: 'one_time', amount: 200000 }
    );
    assert(feeNonRetainer === 0, 'Cancelled or non-retainer contract should return 0 fee');
    console.log('  ✓ determineContractMonthlyFee passed');
  }

  // --------------------------------------------------------------------------
  // Test 3: 二重請求防止判定 (isContractAlreadyBilled)
  // --------------------------------------------------------------------------
  console.log('Test 3: isContractAlreadyBilled');
  {
    const existingInvoices = [
      {
        contract_id: 'cnt-123',
        company_id: 'cmp-001',
        invoice_number: 'INV-202611-ABCDEF',
        title: '株式会社テスト 2026年11月分 定期請求書',
      },
    ];

    const billed = isContractAlreadyBilled(existingInvoices, 'cnt-123', 'cmp-001', '2026-11');
    assert(billed === true, 'Should detect that 2026-11 invoice already exists');

    const notBilled = isContractAlreadyBilled(existingInvoices, 'cnt-123', 'cmp-001', '2026-12');
    assert(notBilled === false, 'Should allow billing for 2026-12 (not yet billed)');
    console.log('  ✓ isContractAlreadyBilled passed');
  }

  // --------------------------------------------------------------------------
  // Test 4: 送信時間帯チェック (checkSendTimeWindow)
  // --------------------------------------------------------------------------
  console.log('Test 4: checkSendTimeWindow');
  {
    // 空や未設定は常に許可
    assert(checkSendTimeWindow(null).allowed === true, 'Empty time window should be allowed');
    assert(checkSendTimeWindow('').allowed === true, 'Empty string should be allowed');

    // 2026-11-05 14:00 JST (Asia/Tokyo) ➔ 09:00 - 18:00 の範囲内
    const afternoonJst = new Date('2026-11-05T05:00:00Z'); // UTC 05:00 = JST 14:00
    const inWindow = checkSendTimeWindow('09:00 - 18:00', afternoonJst);
    assert(inWindow.allowed === true, '14:00 JST should be inside 09:00-18:00 window');

    // 2026-11-05 23:00 JST (Asia/Tokyo) ➔ 09:00 - 18:00 の範囲外
    const lateNightJst = new Date('2026-11-05T14:00:00Z'); // UTC 14:00 = JST 23:00
    const outWindow = checkSendTimeWindow('09:00 - 18:00', lateNightJst);
    assert(outWindow.allowed === false, '23:00 JST should be outside 09:00-18:00 window');
    assert(Boolean(outWindow.nextDueAt), 'Should compute nextDueAt when outside window');
    console.log('  ✓ checkSendTimeWindow passed');
  }

  // --------------------------------------------------------------------------
  // Test 5: 配信停止（opted_out）スキップ判定 (shouldSkipAutomationDelivery)
  // --------------------------------------------------------------------------
  console.log('Test 5: shouldSkipAutomationDelivery');
  {
    // 正常なオプトイン連絡先
    const contactNormal = {
      email: 'customer@example.com',
      email_consent_status: 'opted_in',
      line_user_id: 'U12345678',
    };
    const allowEmail = shouldSkipAutomationDelivery('email', contactNormal);
    assert(allowEmail.skip === false, 'Opted-in contact should not be skipped');

    // オプトアウト（配信停止）連絡先
    const contactOptedOut = {
      email: 'unsub@example.com',
      email_consent_status: 'opted_out',
      line_user_id: 'U12345678',
    };
    const skipEmail = shouldSkipAutomationDelivery('email', contactOptedOut);
    assert(skipEmail.skip === true, 'Opted-out contact must be skipped');
    assert(skipEmail.reason?.includes('opted_out') === true, 'Reason should mention opted_out');

    // LINE未連携
    const contactNoLine = {
      email: 'test@example.com',
      line_user_id: '',
    };
    const skipLine = shouldSkipAutomationDelivery('line', contactNoLine);
    assert(skipLine.skip === true, 'Missing line_user_id should be skipped');
    console.log('  ✓ shouldSkipAutomationDelivery passed');
  }

  // --------------------------------------------------------------------------
  // Test 6: 指数バックオフ自動リトライ計算 (calculateExponentialBackoff)
  // --------------------------------------------------------------------------
  console.log('Test 6: calculateExponentialBackoff');
  {
    // 1回目の失敗 ➔ 1分後 (delayMinutes: 1)
    const retry1 = calculateExponentialBackoff(0, 3);
    assert(retry1.canRetry === true, 'Retry 1 should be allowed');
    assert(retry1.nextRetryCount === 1, `Expected nextRetryCount 1, got ${retry1.nextRetryCount}`);
    assert(retry1.delayMinutes === 1, `Expected delayMinutes 1, got ${retry1.delayMinutes}`);

    // 2回目の失敗 ➔ 5分後 (delayMinutes: 5)
    const retry2 = calculateExponentialBackoff(1, 3);
    assert(retry2.canRetry === true, 'Retry 2 should be allowed');
    assert(retry2.nextRetryCount === 2, `Expected nextRetryCount 2, got ${retry2.nextRetryCount}`);
    assert(retry2.delayMinutes === 5, `Expected delayMinutes 5, got ${retry2.delayMinutes}`);

    // 3回目の失敗 ➔ 15分後 (delayMinutes: 15)
    const retry3 = calculateExponentialBackoff(2, 3);
    assert(retry3.canRetry === true, 'Retry 3 should be allowed');
    assert(retry3.nextRetryCount === 3, `Expected nextRetryCount 3, got ${retry3.nextRetryCount}`);
    assert(retry3.delayMinutes === 15, `Expected delayMinutes 15, got ${retry3.delayMinutes}`);

    // 3回リトライ超過 ➔ 失敗 (failed, canRetry: false)
    const retryOver = calculateExponentialBackoff(3, 3);
    assert(retryOver.canRetry === false, 'Retry count >= 3 must NOT be allowed to retry');
    console.log('  ✓ calculateExponentialBackoff passed');
  }

  // --------------------------------------------------------------------------
  // Test 7: 支払期日の算出（翌月末日 - getEndOfNextMonthDate）
  // --------------------------------------------------------------------------
  console.log('Test 7: getEndOfNextMonthDate');
  {
    // 2026年11月1日発行 ➔ 翌月末日: 2026年12月31日
    assert(getEndOfNextMonthDate('2026-11-01') === '2026-12-31', '2026-11-01 must yield 2026-12-31');
    // 2026年11月25日発行 ➔ 翌月末日: 2026年12月31日
    assert(getEndOfNextMonthDate('2026-11-25') === '2026-12-31', '2026-11-25 must yield 2026-12-31');
    // 2026年12月1日発行 ➔ 翌月末日: 2027年1月31日（年跨ぎ）
    assert(getEndOfNextMonthDate('2026-12-01') === '2027-01-31', '2026-12-01 must yield 2027-01-31');
    // 2027年1月15日発行 ➔ 翌月末日: 2027年2月28日（平年）
    assert(getEndOfNextMonthDate('2027-01-15') === '2027-02-28', '2027-01-15 must yield 2027-02-28');
    // 2028年1月15日発行 ➔ 翌月末日: 2028年2月29日（うるう年）
    assert(getEndOfNextMonthDate('2028-01-15') === '2028-02-29', '2028-01-15 must yield 2028-02-29 (leap year)');
    console.log('  ✓ getEndOfNextMonthDate passed');
  }

  console.log('\n=== All Tests Passed Successfully! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
