import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage mock for Node test environment
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => { store.set(key, String(value)); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
};

import { hasLocalCharactersCache, loadCharacters, saveCharacters } from '../src/utils/storage';
import {
  hasLocalAIModelSettingsCache,
  loadAIModelSettings,
  normalizeAIModelSettings,
  saveAIModelSettings,
  type AIModelSettings,
} from '../src/utils/aiSettingsStorage';
import { sanitizeRoleOverride } from '../src/data/aiWorkModes';
import { mergeAIModelSettings } from '../src/services/workspaceStateService';
import { DEFAULT_MODEL_SETTING } from '../src/data/aiModels';

describe('AI Presets & Role Overrides Persistence Tests', () => {
  beforeEach(() => {
    store.clear();
  });

  it('hasLocalCharactersCache distinguishes uninitialized cache from saved characters and empty array never resurrects deleted presets', () => {
    assert.equal(hasLocalCharactersCache(), false, 'Initially localStorage has no characters key');
    const initial = loadCharacters();
    assert.ok(initial.length > 1, 'Initial fallback loads preset characters');

    // Saving empty array (e.g., user cleared everything except mandatory preset-ceo)
    saveCharacters([]);
    assert.equal(hasLocalCharactersCache(), true, 'Cache flag becomes true after saveCharacters');
    const afterEmptySave = loadCharacters();
    assert.equal(afterEmptySave.length, 1, 'Should only keep preset-ceo, never resurrect all 7 presets');
    assert.equal(afterEmptySave[0].id, 'preset-ceo');
  });

  it('sanitizeRoleOverride preserves updatedAt while stripping invalid fields', () => {
    const cleaned = sanitizeRoleOverride({
      name: '  営業統括AI  ',
      tone: '簡潔で論理的',
      responseLength: 'short',
      behaviorRules: ['数字で示す', '', '結論ファースト'],
      extraInstruction: '必ず次アクションを提案する',
      updatedAt: 1700000123456,
    });
    assert.equal(cleaned.name, '営業統括AI');
    assert.equal(cleaned.responseLength, 'short');
    assert.deepEqual(cleaned.behaviorRules, ['数字で示す', '結論ファースト']);
    assert.equal(cleaned.updatedAt, 1700000123456);
  });

  it('normalizeAIModelSettings strips empty overrides that only have updatedAt and preserves valid overrides', () => {
    const normalized = normalizeAIModelSettings({
      defaultSetting: DEFAULT_MODEL_SETTING,
      defaultSettingUpdatedAt: 1700000000000,
      roleOverrides: {
        advisor: { updatedAt: 1700000000000 }, // empty effective fields
        researcher: { tone: '調査重視', updatedAt: 1700000005000 },
      },
    });
    assert.equal(normalized.roleOverrides.advisor, undefined);
    assert.equal(normalized.roleOverrides.researcher?.tone, '調査重視');
    assert.equal(normalized.roleOverrides.researcher?.updatedAt, 1700000005000);
    assert.equal(normalized.defaultSettingUpdatedAt, 1700000000000);
  });

  it('hasLocalAIModelSettingsCache tracks initialization state properly', () => {
    assert.equal(hasLocalAIModelSettingsCache(), false);
    const settings: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: { advisor: { tone: '丁寧', updatedAt: 1700000001000 } },
    };
    saveAIModelSettings(settings);
    assert.equal(hasLocalAIModelSettingsCache(), true);
    assert.equal(loadAIModelSettings().roleOverrides.advisor?.tone, '丁寧');
  });

  it('mergeAIModelSettings ignores Postgres jsonb key-order differences and preserves local roleOverrides', () => {
    const baseline: AIModelSettings = {
      defaultSetting: {
        primary: { provider: 'gemini', model: 'gemini-3.8-flash' },
        fallbacks: [{ provider: 'gemini', model: 'gemini-3.1-flash-lite' }],
      },
      roleOverrides: {
        advisor: { name: '顧問A', tone: '冷静', updatedAt: 1000 },
      },
    };
    // Simulate Postgres jsonb reordered keys in remote
    const remoteReordered = {
      roleOverrides: {
        advisor: { updatedAt: 1000, tone: '冷静', name: '顧問A' },
      },
      defaultSetting: {
        fallbacks: [{ model: 'gemini-3.1-flash-lite', provider: 'gemini' }],
        primary: { model: 'gemini-3.8-flash', provider: 'gemini' },
      },
    } as AIModelSettings;

    // User locally edits researcher role override
    const local: AIModelSettings = {
      defaultSetting: {
        primary: { provider: 'gemini', model: 'gemini-3.8-flash' },
        fallbacks: [{ provider: 'gemini', model: 'gemini-3.1-flash-lite' }],
      },
      roleOverrides: {
        advisor: { name: '顧問A', tone: '冷静', updatedAt: 1000 },
        researcher: { tone: '箇条書き重視', updatedAt: 2000 },
      },
    };

    const merged = mergeAIModelSettings(remoteReordered, local, baseline, true);
    assert.equal(merged.roleOverrides.advisor?.name, '顧問A');
    assert.equal(merged.roleOverrides.researcher?.tone, '箇条書き重視');
  });

  it('mergeAIModelSettings merges independent edits across different roles and picks newer updatedAt on conflict', () => {
    const baseline: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: {
        advisor: { tone: '初期', updatedAt: 1000 },
        analyst: { tone: '初期', updatedAt: 1000 },
      },
    };
    const remote: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: {
        advisor: { tone: 'リモート更新', updatedAt: 3000 },
        analyst: { tone: 'リモート古い', updatedAt: 1500 },
        marketer: { tone: 'リモート新規', updatedAt: 2500 },
      },
    };
    const local: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: {
        advisor: { tone: 'ローカル古い', updatedAt: 2000 },
        analyst: { tone: 'ローカル最新', updatedAt: 4000 },
      },
    };

    const merged = mergeAIModelSettings(remote, local, baseline, true);
    assert.equal(merged.roleOverrides.advisor?.tone, 'リモート更新', 'Newer remote edit wins conflict');
    assert.equal(merged.roleOverrides.analyst?.tone, 'ローカル最新', 'Newer local edit wins conflict');
    assert.equal(merged.roleOverrides.marketer?.tone, 'リモート新規', 'Independent remote role addition is preserved');
  });

  it('mergeAIModelSettings respects local reset/deletion of a role override when remote is unchanged', () => {
    const baseline: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: {
        advisor: { tone: 'カスタム', updatedAt: 1000 },
      },
    };
    const remote: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: {
        advisor: { updatedAt: 1000, tone: 'カスタム' },
      },
    };
    const local: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: {}, // user clicked "標準に戻す"
    };

    const merged = mergeAIModelSettings(remote, local, baseline, true);
    assert.equal(merged.roleOverrides.advisor, undefined, 'Resetting role to standard is honored');
  });

  it('mergeAIModelSettings trusts remote when local cache is not initialized (fresh browser)', () => {
    const remote: AIModelSettings = {
      defaultSetting: {
        primary: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        fallbacks: [{ provider: 'gemini', model: 'gemini-3.1-flash-lite' }],
      },
      roleOverrides: {
        strategist: { name: '戦略参謀', updatedAt: 5000 },
      },
    };
    const local: AIModelSettings = {
      defaultSetting: DEFAULT_MODEL_SETTING,
      roleOverrides: {},
    };
    const merged = mergeAIModelSettings(remote, local, undefined, false);
    assert.equal(merged.roleOverrides.strategist?.name, '戦略参謀');
    assert.equal(merged.defaultSetting.primary.model, 'llama-3.3-70b-versatile');
  });
});
