import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDirectContactInsertPayload,
  findContactByEmail,
  isValidDirectEmail,
  normalizeDirectEmail,
  resolveDirectContactPreview,
} from '../src/utils/directEmailRecipient';

describe('Direct Email Recipient & Auto-Registration Tests', () => {
  const contacts = [
    { id: 'c1', full_name: '佐藤 健太', email: 'Sato@Example.co.jp', company_id: 'comp-1' },
    { id: 'c2', full_name: '鈴木 花子', email: null, company_id: null },
  ];

  it('validates and normalizes direct email addresses accurately', () => {
    assert.equal(normalizeDirectEmail('  Taro.Yamada@Example.COM '), 'taro.yamada@example.com');
    assert.equal(isValidDirectEmail('taro@example.com'), true);
    assert.equal(isValidDirectEmail('  taro+tag@sub.example.co.jp  '), true);
    assert.equal(isValidDirectEmail(''), false);
    assert.equal(isValidDirectEmail('invalid-email'), false);
    assert.equal(isValidDirectEmail('taro <taro@example.com>'), false);
  });

  it('finds existing contacts case-insensitively to prevent duplicate registrations', () => {
    const matched = findContactByEmail(contacts, ' sato@example.co.jp ');
    assert.equal(matched?.id, 'c1');
    assert.equal(findContactByEmail(contacts, 'new@example.com'), undefined);
  });

  it('builds valid contact auto-registration payloads with fallback recipient name', () => {
    assert.deepEqual(
      buildDirectContactInsertPayload({
        email: ' NewUser@Example.com ',
        recipientName: ' 山田 太郎 ',
        companyId: 'comp-2',
      }),
      {
        company_id: 'comp-2',
        full_name: '山田 太郎',
        email: 'newuser@example.com',
        preferred_channel: 'email',
        source: 'manual',
        email_consent_status: 'unknown',
      },
    );

    assert.deepEqual(
      buildDirectContactInsertPayload({
        email: 'solo@example.com',
        recipientName: '   ',
        companyId: null,
      }),
      {
        company_id: null,
        full_name: 'ご担当者',
        email: 'solo@example.com',
        preferred_channel: 'email',
        source: 'manual',
        email_consent_status: 'unknown',
      },
    );
  });

  it('resolves preview contact cleanly for both existing and unregistered emails', () => {
    const existing = resolveDirectContactPreview({
      contacts,
      email: 'sato@example.co.jp',
      recipientName: '別の名前',
    });
    assert.equal(existing.isExisting, true);
    assert.equal(existing.contact.id, 'c1');
    assert.equal(existing.contact.full_name, '佐藤 健太');

    const fresh = resolveDirectContactPreview({
      contacts,
      email: 'fresh@example.com',
      recipientName: '',
      companyId: 'comp-9',
    });
    assert.equal(fresh.isExisting, false);
    assert.equal(fresh.contact.id, '');
    assert.equal(fresh.contact.full_name, 'ご担当者');
    assert.equal(fresh.contact.email, 'fresh@example.com');
    assert.equal(fresh.contact.company_id, 'comp-9');
  });
});
