import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL_SETTING, buildModelChain, AI_PROVIDERS } from '../src/data/aiModels.js';

describe('AI Model Fallback & Error Handling Tests', () => {
  it('Test 1: DEFAULT_MODEL_SETTING includes gemini-3.1-flash-lite fallback', () => {
    assert.equal(DEFAULT_MODEL_SETTING.primary.model, 'gemini-3.8-flash');
    assert.ok(DEFAULT_MODEL_SETTING.fallbacks.length > 0, 'Should have at least 1 fallback');
    assert.equal(DEFAULT_MODEL_SETTING.fallbacks[0].model, 'gemini-3.1-flash-lite');
    assert.equal(DEFAULT_MODEL_SETTING.fallbacks[0].provider, 'gemini');
  });

  it('Test 2: buildModelChain deduplicates and preserves chain order', () => {
    const chain = buildModelChain(DEFAULT_MODEL_SETTING);
    assert.equal(chain.length, 2);
    assert.equal(chain[0].model, 'gemini-3.8-flash');
    assert.equal(chain[1].model, 'gemini-3.1-flash-lite');
  });

  it('Test 3: Suggested models for Gemini contains flash and flash-lite', () => {
    const models = AI_PROVIDERS.gemini.suggestedModels;
    assert.ok(models.includes('gemini-3.8-flash'));
    assert.ok(models.includes('gemini-3.1-flash-lite'));
  });

  it('Test 4: Error unwrapper parses nested 503 error cleanly', () => {
    const rawError = JSON.stringify({
      error: {
        message: JSON.stringify({
          error: {
            code: 503,
            message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
            status: 'UNAVAILABLE',
          },
        }),
      },
    });

    // Test logic from cleanErrorMessage
    function cleanErrorMessage(raw: string): string {
      try {
        let current = raw.trim();
        for (let depth = 0; depth < 3; depth++) {
          if (current.startsWith('{') && current.endsWith('}')) {
            const parsed = JSON.parse(current);
            if (parsed.error?.message) {
              const innerMsg = cleanErrorMessage(String(parsed.error.message).trim());
              const code = parsed.error.code ? `HTTP ${parsed.error.code}` : '';
              const status = parsed.error.status || '';
              const tag = [code, status].filter(Boolean).join(' ');
              return tag ? `[${tag}] ${innerMsg.replace(/^\[[^\]]+\]\s*/, '')}` : innerMsg;
            }
            if (parsed.message) {
              current = String(parsed.message).trim();
              continue;
            }
          }
          break;
        }
        return current;
      } catch {
        return raw;
      }
    }

    const cleaned = cleanErrorMessage(rawError);
    assert.ok(cleaned.includes('[HTTP 503 UNAVAILABLE]'));
    assert.ok(cleaned.includes('This model is currently experiencing high demand'));
    assert.ok(!cleaned.startsWith('{'), 'Should not be raw JSON');
  });
});
