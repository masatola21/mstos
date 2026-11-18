import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLineInboundAlertEmailPayload,
  DEFAULT_LINE_ALERT_EMAIL,
  normalizeLineInboundAlertSettings,
  shouldSendLineInboundAlert,
} from '../server/lineInboundAlert';

describe('LINE Inbound Alert Helpers', () => {
  it('normalizes settings with valid fallback email and safe defaults', () => {
    const defaults = normalizeLineInboundAlertSettings(null);
    assert.equal(defaults.enabled, true);
    assert.equal(defaults.email, DEFAULT_LINE_ALERT_EMAIL);
    assert.equal(defaults.mode, 'all');

    const custom = normalizeLineInboundAlertSettings(
      { enabled: false, email: ' Admin@Example.COM ', mode: 'unmatched_only' },
      'fallback@example.com',
    );
    assert.equal(custom.enabled, false);
    assert.equal(custom.email, 'admin@example.com');
    assert.equal(custom.mode, 'unmatched_only');

    const invalidFallback = normalizeLineInboundAlertSettings({ email: 'not-an-email' }, 'owner@example.com');
    assert.equal(invalidFallback.email, 'owner@example.com');
  });

  it('respects enabled flag and all vs unmatched_only delivery mode', () => {
    assert.equal(
      shouldSendLineInboundAlert({
        settings: { enabled: false, email: 'a@b.com', mode: 'all' },
        matchedRuleName: null,
      }).shouldSend,
      false,
    );

    assert.equal(
      shouldSendLineInboundAlert({
        settings: { enabled: true, email: 'a@b.com', mode: 'all' },
        matchedRuleName: '経営改善ルール',
      }).shouldSend,
      true,
    );

    assert.equal(
      shouldSendLineInboundAlert({
        settings: { enabled: true, email: 'a@b.com', mode: 'unmatched_only' },
        matchedRuleName: '経営改善ルール',
      }).shouldSend,
      false,
    );

    assert.equal(
      shouldSendLineInboundAlert({
        settings: { enabled: true, email: 'a@b.com', mode: 'unmatched_only' },
        matchedRuleName: null,
      }).shouldSend,
      true,
    );
  });

  it('builds escaped HTML and clear subject lines distinguishing manual-reply vs rule-matched inbound messages', () => {
    const manualNeeded = buildLineInboundAlertEmailPayload({
      senderName: '山田太郎',
      companyName: '株式会社テスト',
      lineUserId: 'U123456',
      messageText: '相談希望 <script>alert(1)</script>',
      receivedAt: '2026-11-18T02:00:00.000Z',
      matchedRuleName: null,
      autoReplyText: '確認しております',
      inboxUrl: 'https://os.mstcorp.info',
    });
    assert.match(manualNeeded.subject, /【MST LINE受信・要返信】山田太郎様/);
    assert.ok(manualNeeded.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!manualNeeded.html.includes('<script>'));
    assert.ok(manualNeeded.text.includes('https://os.mstcorp.info'));

    const ruleMatched = buildLineInboundAlertEmailPayload({
      senderName: '佐藤花子',
      lineUserId: 'U654321',
      messageText: '資料希望',
      matchedRuleName: '資料請求案内',
      isTest: true,
    });
    assert.match(ruleMatched.subject, /^【テスト通知】【MST LINE受信（自動応答: 資料請求案内）】佐藤花子様$/);
  });
});
