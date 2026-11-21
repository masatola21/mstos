import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_WORKSPACE_ROUTE_KEY,
  LOCAL_WORKSPACE_ROUTE_KEY,
  LOCAL_ROUTE_MAX_AGE_MS,
  normalizeWorkspaceTab,
  buildWorkspaceUrlWithTab,
  buildWorkspaceUrlWithoutTab,
  resolveInitialWorkspaceRoute,
  persistWorkspaceRoute,
  clearPersistedWorkspaceRoute,
  type StorageLike,
} from '../src/utils/workspaceRoutePersistence';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe('Workspace Route Persistence', () => {
  it('normalizes legacy and valid tabs and rejects unknown values', () => {
    assert.equal(normalizeWorkspaceTab('inbox_hub'), 'inbox_hub');
    assert.equal(normalizeWorkspaceTab('ai_dashboard'), 'mst_dashboard');
    assert.equal(normalizeWorkspaceTab('diagnoses'), 'mst_diagnoses');
    assert.equal(normalizeWorkspaceTab('unknown_tab'), null);
    assert.equal(normalizeWorkspaceTab(''), null);
  });

  it('prefers explicit ?tab= query param while preserving matching context', () => {
    const sStorage = createMemoryStorage();
    const lStorage = createMemoryStorage();
    persistWorkspaceRoute(
      {
        tab: 'inbox_hub',
        inboxTargetChannel: 'line',
        customerWorkspaceContext: { companyId: 'CID-001' },
      },
      { sessionStorage: sStorage, localStorage: lStorage }
    );

    const resolved = resolveInitialWorkspaceRoute({
      href: 'https://example.com/?tab=inbox_hub&other=1',
      historyState: { mst: true, tab: 'mst_dashboard' },
      sessionStorage: sStorage,
      localStorage: lStorage,
      now: 1_000_000,
    });

    assert.equal(resolved.tab, 'inbox_hub');
    assert.equal(resolved.inboxTargetChannel, 'line');
    assert.deepEqual(resolved.customerWorkspaceContext, { companyId: 'CID-001' });
  });

  it('restores active tab from sessionStorage when page reloads without ?tab= or after tab discard', () => {
    const sStorage = createMemoryStorage();
    const lStorage = createMemoryStorage();
    persistWorkspaceRoute(
      {
        tab: 'document_templates',
        customerWorkspaceContext: { companyId: 'CID-007', documentType: 'estimate' },
        savedAt: 5_000,
      },
      { sessionStorage: sStorage, localStorage: lStorage }
    );

    // Case A: history.state was lost on reload/discard
    const resolvedNoHistory = resolveInitialWorkspaceRoute({
      href: 'https://example.com/',
      historyState: null,
      sessionStorage: sStorage,
      localStorage: lStorage,
      now: 10_000,
    });
    assert.equal(resolvedNoHistory.tab, 'document_templates');
    assert.deepEqual(resolvedNoHistory.customerWorkspaceContext, {
      companyId: 'CID-007',
      documentType: 'estimate',
    });

    // Case B: history.state stayed on stale mst_dashboard
    const resolvedStaleHistory = resolveInitialWorkspaceRoute({
      href: 'https://example.com/',
      historyState: { mst: true, tab: 'mst_dashboard' },
      sessionStorage: sStorage,
      localStorage: lStorage,
      now: 10_000,
    });
    assert.equal(resolvedStaleHistory.tab, 'document_templates');
  });

  it('restores from recent localStorage after iframe reload, and expires stale entries after 24h', () => {
    const sStorage = createMemoryStorage();
    const lStorage = createMemoryStorage();
    const savedAt = 1_000_000;
    persistWorkspaceRoute(
      { tab: 'leads', savedAt },
      { sessionStorage: sStorage, localStorage: lStorage }
    );

    // Simulate iframe reload where sessionStorage and historyState are cleared
    const freshSession = createMemoryStorage();
    const restoredRecent = resolveInitialWorkspaceRoute({
      href: 'https://example.com/',
      historyState: null,
      sessionStorage: freshSession,
      localStorage: lStorage,
      now: savedAt + 60 * 60 * 1000,
    });
    assert.equal(restoredRecent.tab, 'leads');

    // Expired after >24h -> defaults to mst_dashboard
    const expired = resolveInitialWorkspaceRoute({
      href: 'https://example.com/',
      historyState: null,
      sessionStorage: freshSession,
      localStorage: lStorage,
      now: savedAt + LOCAL_ROUTE_MAX_AGE_MS + 1,
    });
    assert.equal(expired.tab, 'mst_dashboard');
  });

  it('preserves existing query params and hash when updating ?tab= in URL and clears storage on logout', () => {
    const withTab = buildWorkspaceUrlWithTab('https://example.com/?foo=bar#section', 'ai_chat');
    assert.equal(withTab, 'https://example.com/?foo=bar&tab=ai_chat#section');
    const withoutTab = buildWorkspaceUrlWithoutTab(withTab);
    assert.equal(withoutTab, 'https://example.com/?foo=bar#section');

    const sStorage = createMemoryStorage();
    const lStorage = createMemoryStorage();
    persistWorkspaceRoute({ tab: 'deals' }, { sessionStorage: sStorage, localStorage: lStorage });
    assert.ok(sStorage.getItem(SESSION_WORKSPACE_ROUTE_KEY));
    assert.ok(lStorage.getItem(LOCAL_WORKSPACE_ROUTE_KEY));

    clearPersistedWorkspaceRoute({ sessionStorage: sStorage, localStorage: lStorage });
    assert.equal(sStorage.getItem(SESSION_WORKSPACE_ROUTE_KEY), null);
    assert.equal(lStorage.getItem(LOCAL_WORKSPACE_ROUTE_KEY), null);
  });
});
