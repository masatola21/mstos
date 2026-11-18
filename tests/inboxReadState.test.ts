import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countUnreadEmails,
  countUnreadLineByUser,
  countUnreadLineMessages,
  getLatestLineInboundAt,
  isAutomatedLineOutboundMessage,
  isEmailMessageRead,
  isLineConversationAwaitingReply,
  isLineMessageUnread,
  isLineNoReplyInboundText,
  isManualLineOutboundMessage,
} from '../src/utils/inboxReadState';

describe('Inbox Read/Unread State Helpers', () => {
  it('counts unread LINE inbound messages and groups unread counts per friend', () => {
    const messages = [
      { line_user_id: 'U1', direction: 'inbound', status: 'received' },
      { line_user_id: 'U1', direction: 'inbound', status: 'received' },
      { line_user_id: 'U1', direction: 'outbound', status: 'sent' },
      { line_user_id: 'U2', direction: 'inbound', status: 'read' },
      { line_user_id: 'U3', direction: 'inbound', status: 'received' },
      { line_user_id: 'U3', direction: 'inbound', status: 'read' },
    ];

    assert.equal(isLineMessageUnread(messages[0]), true);
    assert.equal(isLineMessageUnread(messages[2]), false);
    assert.equal(isLineMessageUnread(messages[3]), false);

    assert.equal(countUnreadLineMessages(messages), 3);

    const byUser = countUnreadLineByUser(messages);
    assert.equal(byUser.get('U1'), 2);
    assert.equal(byUser.get('U2'), undefined);
    assert.equal(byUser.get('U3'), 1);
  });

  it('determines email read state from DB is_read first, falling back to localReadIds', () => {
    const localReadIds = new Set(['e-local-read']);

    // DB column present (true/false overrides local set)
    assert.equal(isEmailMessageRead({ id: 'e-db-unread', is_read: false }, new Set(['e-db-unread'])), false);
    assert.equal(isEmailMessageRead({ id: 'e-db-read', is_read: true }, new Set()), true);

    // DB column absent (undefined falls back to local set)
    assert.equal(isEmailMessageRead({ id: 'e-local-read' }, localReadIds), true);
    assert.equal(isEmailMessageRead({ id: 'e-local-unread' }, localReadIds), false);

    const emails = [
      { id: 'e-db-unread', is_read: false },
      { id: 'e-db-read', is_read: true },
      { id: 'e-local-read' },
      { id: 'e-local-unread' },
    ];
    assert.equal(countUnreadEmails(emails, localReadIds), 2);
  });

  it('detects LINE awaiting-reply conversations even when automated replies fired, and clears only on manual reply or matching dismiss timestamp', () => {
    assert.equal(isAutomatedLineOutboundMessage({ direction: 'outbound', line_event_id: 'welcome-ev1' }), true);
    assert.equal(isAutomatedLineOutboundMessage({ direction: 'outbound', line_event_id: 'reply-ev1' }), true);
    assert.equal(isAutomatedLineOutboundMessage({ direction: 'outbound', line_event_id: 'rule-reply-ev1' }), true);
    assert.equal(isAutomatedLineOutboundMessage({ direction: 'outbound', line_event_id: 'broadcast-out1' }), true);
    assert.equal(isAutomatedLineOutboundMessage({ direction: 'outbound', line_event_id: 'postback-ev1' }), true);
    assert.equal(isAutomatedLineOutboundMessage({ direction: 'outbound', line_event_id: 'manual-out1' }), false);
    assert.equal(isManualLineOutboundMessage({ direction: 'outbound', line_event_id: 'manual-out1' }), true);

    // Only welcome outbound -> NOT awaiting reply
    assert.equal(
      isLineConversationAwaitingReply([
        { direction: 'outbound', line_event_id: 'welcome-1', received_at: '2026-11-18T01:00:00Z' },
      ]),
      false,
    );

    // Inbound followed by automated reply-... -> STILL awaiting human reply
    const autoRepliedMsgs = [
      { direction: 'outbound', line_event_id: 'welcome-1', received_at: '2026-11-18T01:00:00Z' },
      { direction: 'inbound', line_event_id: 'ev-2', body: 'サービスについて相談したいです', received_at: '2026-11-18T01:05:00Z' },
      { direction: 'outbound', line_event_id: 'reply-ev-2', received_at: '2026-11-18T01:05:01Z' },
    ];
    assert.equal(isLineConversationAwaitingReply(autoRepliedMsgs), true);
    assert.equal(getLatestLineInboundAt(autoRepliedMsgs), '2026-11-18T01:05:00Z');

    // Broadcast outbound does NOT resolve an unanswered 1-on-1 inbound
    assert.equal(
      isLineConversationAwaitingReply([
        ...autoRepliedMsgs,
        { direction: 'outbound', line_event_id: 'broadcast-out1', received_at: '2026-11-18T01:10:00Z' },
      ]),
      true,
    );

    // Dismissed for '2026-11-18T01:05:00Z' -> cleared
    assert.equal(isLineConversationAwaitingReply(autoRepliedMsgs, '2026-11-18T01:05:00Z'), false);

    // Newer inbound arrives after dismiss -> awaiting reply turns back ON
    const newerInboundMsgs = [
      ...autoRepliedMsgs,
      { direction: 'inbound', line_event_id: 'ev-3', body: '来週の打ち合わせは可能ですか？', received_at: '2026-11-18T02:00:00Z' },
    ];
    assert.equal(isLineConversationAwaitingReply(newerInboundMsgs, '2026-11-18T01:05:00Z'), true);

    // Manual reply sent after latest inbound -> cleared
    const manuallyRepliedMsgs = [
      ...newerInboundMsgs,
      { direction: 'outbound', line_event_id: 'manual-outbox-99', received_at: '2026-11-18T02:10:00Z' },
    ];
    assert.equal(isLineConversationAwaitingReply(manuallyRepliedMsgs), false);
  });

  it('does not mark rule-resolved inbound or pure thank-you/acknowledgment replies as awaiting reply', () => {
    assert.equal(isLineNoReplyInboundText('ありがとうございます！'), true);
    assert.equal(isLineNoReplyInboundText('承知いたしました。'), true);
    assert.equal(isLineNoReplyInboundText('了解です'), true);
    assert.equal(isLineNoReplyInboundText('OK'), true);
    assert.equal(isLineNoReplyInboundText('👍'), true);
    assert.equal(isLineNoReplyInboundText('[スタンプ]'), true);

    assert.equal(isLineNoReplyInboundText('ありがとうございます！来週の日程ですがいつが良いですか？'), false);
    assert.equal(isLineNoReplyInboundText('資料をお願いします'), false);
    assert.equal(isLineNoReplyInboundText('相談したいです'), false);

    // Inbound resolved by an explicit auto-reply rule (rule-reply-{eventId}) -> NOT awaiting reply
    assert.equal(
      isLineConversationAwaitingReply([
        { direction: 'inbound', line_event_id: 'ev-rule-1', body: '料金について', received_at: '2026-11-18T03:00:00Z' },
        { direction: 'outbound', line_event_id: 'rule-reply-ev-rule-1', received_at: '2026-11-18T03:00:01Z' },
      ]),
      false,
    );

    // Earlier unanswered inbound remains awaiting even if a later message hits a rule
    assert.equal(
      isLineConversationAwaitingReply([
        { direction: 'inbound', line_event_id: 'ev-open-1', body: '導入時期の相談です', received_at: '2026-11-18T03:00:00Z' },
        { direction: 'inbound', line_event_id: 'ev-rule-2', body: '料金表', received_at: '2026-11-18T03:01:00Z' },
        { direction: 'outbound', line_event_id: 'rule-reply-ev-rule-2', received_at: '2026-11-18T03:01:01Z' },
      ]),
      true,
    );

    // Conversation ending with a pure thank-you after manual reply remains cleared
    assert.equal(
      isLineConversationAwaitingReply([
        { direction: 'inbound', line_event_id: 'ev-q1', body: '日程を教えてください', received_at: '2026-11-18T04:00:00Z' },
        { direction: 'outbound', line_event_id: 'manual-1', received_at: '2026-11-18T04:05:00Z' },
        { direction: 'inbound', line_event_id: 'ev-thx', body: 'ありがとうございます！', received_at: '2026-11-18T04:10:00Z' },
      ]),
      false,
    );
  });
});

