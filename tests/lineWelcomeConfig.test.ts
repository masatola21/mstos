import assert from 'node:assert';
import {
  WELCOME_MATCH_TEXT,
  selectWelcomeRule,
  extractWelcomeFlexTarget,
  sanitizeWelcomeFlexNode,
  expandMessageVarAliases,
  replaceMessagePlaceholders,
} from '../server/lineWelcomeResolver';

console.log('=== Running LINE Welcome Config & Resolver Tests ===\n');

// Test 1: __welcome__ takes priority over legacy rules even if legacy rule has priority 0 or matches ownerId
{
  const ownerId = 'owner-1';
  const legacyRule = {
    id: 'rule-legacy',
    owner_id: ownerId,
    name: '旧友だち追加定型文',
    match_text: '友だち追加',
    reply_type: 'flex',
    priority: 0,
    enabled: true,
    updated_at: '2026-11-12T10:00:00Z',
  };
  const welcomeRule = {
    id: 'rule-welcome',
    owner_id: 'owner-2',
    name: '友だち追加ウェルカムFlexメッセージ',
    match_text: WELCOME_MATCH_TEXT,
    reply_type: 'flex',
    priority: 10,
    enabled: true,
    updated_at: '2026-11-11T10:00:00Z',
  };

  const result = selectWelcomeRule([legacyRule, welcomeRule], ownerId);
  assert.strictEqual(result.source, 'welcome_rule', 'Must select __welcome__ rule over legacy keyword rule');
  assert.strictEqual(result.rule?.id, 'rule-welcome');
  assert.strictEqual(result.disabled, false);
  assert.strictEqual(result.conflictingLegacyRules.length, 1);
  assert.strictEqual(result.conflictingLegacyRules[0].id, 'rule-legacy');
  console.log('  ✓ __welcome__ takes priority over legacy keyword rules');
}

// Test 2: Explicitly disabled __welcome__ suppresses welcome message and does NOT fall back to legacy or default
{
  const disabledWelcome = {
    id: 'rule-welcome-off',
    owner_id: 'owner-1',
    match_text: WELCOME_MATCH_TEXT,
    enabled: false,
    priority: 0,
  };
  const legacyEnabled = {
    id: 'rule-legacy-on',
    owner_id: 'owner-1',
    match_text: 'ウェルカム',
    enabled: true,
    priority: 10,
  };

  const result = selectWelcomeRule([disabledWelcome, legacyEnabled], 'owner-1');
  assert.strictEqual(result.source, 'welcome_disabled');
  assert.strictEqual(result.disabled, true);
  assert.strictEqual(result.rule, null);
  console.log('  ✓ Disabled __welcome__ blocks fallback to legacy/default');
}

// Test 3: Legacy keyword rule is used only when no __welcome__ exists
{
  const legacyEnabled = {
    id: 'rule-legacy',
    owner_id: 'owner-1',
    match_text: '挨拶',
    enabled: true,
    priority: 50,
  };
  const result = selectWelcomeRule([legacyEnabled], 'owner-1');
  assert.strictEqual(result.source, 'legacy_keyword_rule');
  assert.strictEqual(result.rule?.id, 'rule-legacy');
  assert.strictEqual(result.disabled, false);

  const emptyResult = selectWelcomeRule([], 'owner-1');
  assert.strictEqual(emptyResult.source, 'default_fallback');
  assert.strictEqual(emptyResult.rule, null);
  assert.strictEqual(emptyResult.disabled, false);
  console.log('  ✓ Legacy fallback and default fallback behave correctly');
}

// Test 4: extractWelcomeFlexTarget strips patternA/patternB/choices metadata from validation target
{
  const storedPayload = {
    altText: 'カスタムウェルカム',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '{お名前} 様、ようこそ！' },
          { type: 'text', text: '' },
          { type: 'button', height: 'lg', action: { type: 'uri', label: '診断へ', uri: '{案内URL}' } },
        ],
      },
    },
    choices: [{ id: 'c1', uri: '' }],
    patternA: { greetingBody: '{recipient_name} 様' },
    patternB: {
      q2: { introTemplate: '状況: {q1_label}' },
      completion: { pdfButtonUrl: 'relative-or-empty' },
    },
  };

  const target = extractWelcomeFlexTarget(storedPayload);
  assert(target !== null, 'Should extract altText and contents');
  assert.strictEqual(target.altText, 'カスタムウェルカム');
  assert.strictEqual((target as any).patternB, undefined, 'Metadata must not be included in validation target');
  assert.strictEqual((target as any).choices, undefined, 'Choices metadata must not be included in validation target');

  const sanitized = sanitizeWelcomeFlexNode(target.contents);
  assert.strictEqual(sanitized.body.contents.length, 2, 'Empty text node must be removed');
  assert.strictEqual(sanitized.body.contents[1].height, 'md', 'Invalid button height must normalize to md');
  console.log('  ✓ extractWelcomeFlexTarget & sanitizeWelcomeFlexNode passed');
}

// Test 5: Japanese and English placeholder expansion works consistently
{
  const vars = expandMessageVarAliases({
    recipient_name: '田中 健',
    company_name: '株式会社テスト',
    link_url: 'https://corp.mstcorp.info/diagnosis?cid=1',
    booking_url: 'https://timerex.net/s/test',
    material_url: 'https://corp.mstcorp.info/materials',
    document_url: 'https://corp.mstcorp.info/company',
  });
  const rendered = replaceMessagePlaceholders(
    '{お名前} 様（{会社名}）\n診断: {案内URL}\n予約: {面談予約URL}\n英名: {recipient_name}',
    vars
  );
  assert(rendered.includes('田中 健 様（株式会社テスト）'));
  assert(rendered.includes('https://corp.mstcorp.info/diagnosis?cid=1'));
  assert(rendered.includes('https://timerex.net/s/test'));
  assert(!rendered.includes('{お名前}') && !rendered.includes('{案内URL}') && !rendered.includes('{recipient_name}'));
  console.log('  ✓ Japanese and English placeholder alias expansion passed');
}

console.log('\n=== All LINE Welcome Config & Resolver Tests Passed! ===\n');
