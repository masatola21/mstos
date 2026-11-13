import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countUnreadEmails,
  countUnreadLineByUser,
  countUnreadLineMessages,
  isEmailMessageRead,
  isLineMessageUnread,
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
});
