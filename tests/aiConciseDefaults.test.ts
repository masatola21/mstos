import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AI_WORK_MODES,
  DEFAULT_ROLE_BEHAVIOR_RULES,
  DEFAULT_ROLE_RESPONSE_LENGTH,
  DEFAULT_ROLE_TONE,
  getAIWorkMode,
} from '../src/data/aiWorkModes.js';
import { PRESET_CHARACTERS } from '../src/data/presets.js';
import { buildSystemInstruction, resolveRoleCharacter } from '../server/chatPromptBuilder.js';
import { DRAFT_SYSTEM_INSTRUCTION } from '../server/proposalDraftBuilder.js';

describe('AI Concise Conclusion-First Defaults Tests', () => {
  it('all 10 AI_WORK_MODES instruct conclusion-first and concise output', () => {
    assert.equal(AI_WORK_MODES.length, 10);
    for (const mode of AI_WORK_MODES) {
      assert.ok(
        mode.systemInstruction.includes('結論から簡潔に'),
        `${mode.id} (${mode.label}) should include 結論から簡潔に`,
      );
    }
  });

  it('all PRESET_CHARACTERS include conclusion-first rule and preset-ceo defaults to medium length', () => {
    assert.ok(PRESET_CHARACTERS.length >= 7);
    const ceo = PRESET_CHARACTERS.find((c) => c.id === 'preset-ceo');
    assert.ok(ceo, 'preset-ceo should exist');
    assert.equal(ceo.responseLength, 'medium');
    assert.ok(ceo.customInstructions.includes('結論から簡潔に'));

    for (const char of PRESET_CHARACTERS) {
      assert.ok(
        char.behaviorRules.some((r) => r.includes('結論から簡潔に')),
        `${char.id} (${char.name}) should have 結論から簡潔に in behaviorRules`,
      );
    }
  });

  it('resolveRoleCharacter upgrades legacy saved preset-ceo and non-president roles to concise defaults', () => {
    const legacyCeo = {
      id: 'preset-ceo',
      name: 'シドウ (AI社長)',
      role: 'AI社長',
      personality: '先見性',
      tone: '丁寧な敬語',
      behaviorRules: ['計画JSONを出力する'],
      responseLength: 'detailed' as const,
    };

    // AI社長モード: legacy 'detailed' without roleOverride should resolve to 'medium' and prepend concise rule
    const resolvedCeo = resolveRoleCharacter(getAIWorkMode('president'), {}, legacyCeo);
    assert.equal(resolvedCeo.responseLength, DEFAULT_ROLE_RESPONSE_LENGTH);
    assert.ok(resolvedCeo.behaviorRules?.some((r) => r.includes('結論')));
    assert.ok(resolvedCeo.behaviorRules?.includes('計画JSONを出力する'));

    // 専門役割モード: should not inherit legacy 'detailed' or empty rules
    for (const mode of AI_WORK_MODES.filter((m) => m.id !== 'president')) {
      const resolved = resolveRoleCharacter(mode, {}, legacyCeo);
      assert.equal(resolved.responseLength, DEFAULT_ROLE_RESPONSE_LENGTH, `${mode.id} should default to medium`);
      assert.equal(resolved.tone, DEFAULT_ROLE_TONE, `${mode.id} should use concise default tone`);
      assert.deepEqual(resolved.behaviorRules, [...DEFAULT_ROLE_BEHAVIOR_RULES], `${mode.id} should use concise default rule`);
    }

    // User explicit roleOverride is respected
    const overridden = resolveRoleCharacter(
      getAIWorkMode('sales_operations'),
      { tone: 'フランク', responseLength: 'detailed', behaviorRules: ['数値必須'] },
      legacyCeo,
    );
    assert.equal(overridden.tone, 'フランク');
    assert.equal(overridden.responseLength, 'detailed');
    assert.deepEqual(overridden.behaviorRules, ['数値必須']);
  });

  it('buildSystemInstruction enforces 結論から簡潔に across all responseLength modes while respecting JSON output', () => {
    for (const len of ['short', 'medium', 'detailed'] as const) {
      const prompt = buildSystemInstruction({
        name: 'テストAI',
        role: '営業担当',
        personality: '誠実',
        tone: '明快',
        responseLength: len,
      });
      assert.ok(prompt.includes('結論から簡潔に'), `responseLength=${len} should include 結論から簡潔に`);
      assert.ok(prompt.includes('JSON形式'), `responseLength=${len} should preserve JSON compatibility note`);
    }
  });

  it('proposal and diagnosis drafts both include 結論から簡潔に instructions', () => {
    assert.ok(DRAFT_SYSTEM_INSTRUCTION.includes('結論から簡潔に'));
    const diagnosisManagerSource = readFileSync(new URL('../src/components/DiagnosisManager.tsx', import.meta.url), 'utf-8');
    assert.ok(diagnosisManagerSource.includes('結論から簡潔に'));
    const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');
    assert.ok(appSource.includes('結論から簡潔に伝える'));
  });
});
