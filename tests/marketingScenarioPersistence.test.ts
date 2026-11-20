import { WorkspaceSaveCoordinator } from '../src/services/workspaceSaveCoordinator';
import { matrixService } from '../src/services/matrixService';
import { WorkspaceData, mergeRecords } from '../src/services/workspaceStateService';
import {
  deduplicateMarketingScenarios,
  hasLocalMarketingScenariosCache,
  loadMarketingScenarios,
  saveMarketingScenarios,
} from '../src/utils/marketingStorage';
import type { MarketingScenario } from '../src/types/marketing';

if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    length: 0,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

function makeScenario(overrides: Partial<MarketingScenario> = {}): MarketingScenario {
  return {
    id: 'scn-1',
    name: 'テスト配信シナリオ',
    trigger: 'diagnosis_completed',
    channel: 'line',
    audience: 'すべての見込み客',
    waitMinutes: 0,
    emailSubject: '',
    emailBody: '',
    messageBody: 'テスト本文',
    lineMessageType: 'text',
    status: 'draft',
    automationEnabled: false,
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '配信同意に基づく',
    updatedAt: 1000,
    ...overrides,
  };
}

function createDummyWorkspaceData(partial?: Partial<WorkspaceData>): WorkspaceData {
  return {
    projects: [],
    tasks: [],
    approvals: [],
    activityLogs: [],
    tokenUsage: [],
    products: [],
    contracts: [],
    invoices: [],
    tools: [],
    customLists: [],
    automations: [],
    workModeHistories: {},
    knowledgeItems: [],
    marketingScenarios: [],
    topGoal: '',
    characters: [],
    activeCharacterId: '',
    userProfile: {} as any,
    aiModelSettings: {} as any,
    pricingRates: [],
    ...partial,
  };
}

async function runTests() {
  console.log('=== Running Marketing Scenario Persistence Tests ===\n');

  // Test 1: Stale localStorage (updatedAt < baseline) must NEVER roll back remote/baseline automationEnabled=true
  console.log('Test 1: Stale localStorage does not roll back newer enabled scenario in mergeRecords');
  {
    const baseline = [makeScenario({ id: 'scn-1', status: 'prepared', automationEnabled: true, updatedAt: 2000 })];
    const remote = [makeScenario({ id: 'scn-1', status: 'prepared', automationEnabled: true, updatedAt: 2000 })];
    const staleLocal = [makeScenario({ id: 'scn-1', status: 'draft', automationEnabled: false, updatedAt: 1000 })];

    const merged = mergeRecords(remote, staleLocal, baseline);
    assert(merged.length === 1, 'Merged list must keep 1 scenario');
    assert(merged[0].automationEnabled === true, 'CRITICAL: Stale localStorage must not revert automationEnabled back to false');
    assert(merged[0].status === 'prepared', 'CRITICAL: Stale localStorage must not revert status back to draft');
    console.log('  -> PASSED: Newer enabled state preserved against stale localStorage.\n');
  }

  // Test 2: Genuine newer local toggle (updatedAt > baseline) must still win over unchanged remote
  console.log('Test 2: Newer local toggle (updatedAt >= baseline) still wins over unchanged remote');
  {
    const baseline = [makeScenario({ id: 'scn-1', status: 'draft', automationEnabled: false, updatedAt: 1000 })];
    const remote = [makeScenario({ id: 'scn-1', status: 'draft', automationEnabled: false, updatedAt: 1000 })];
    const newerLocal = [makeScenario({ id: 'scn-1', status: 'prepared', automationEnabled: true, updatedAt: 2000 })];

    const merged = mergeRecords(remote, newerLocal, baseline);
    assert(merged.length === 1, 'Merged list must keep 1 scenario');
    assert(merged[0].automationEnabled === true, 'Newer local toggle must be adopted');
    assert(merged[0].updatedAt === 2000, 'Newer timestamp must be preserved');
    console.log('  -> PASSED: Genuine newer local edit preserved.\n');
  }

  // Test 3: deduplicateMarketingScenarios respects updatedAt before automationEnabled tie-break on story episodes 1-7
  console.log('Test 3: deduplicateMarketingScenarios keeps newer paused story episode over older enabled copy');
  {
    const olderEnabled = makeScenario({
      id: 'ep1-old',
      name: '【第1話】大橋の原体験：FC本部突然倒産の危機',
      trigger: 'line_registered',
      status: 'prepared',
      automationEnabled: true,
      updatedAt: 1000,
    });
    const newerPaused = makeScenario({
      id: 'ep1-new',
      name: '【第1話】大橋の原体験：FC本部突然倒産の危機',
      trigger: 'line_registered',
      status: 'draft',
      automationEnabled: false,
      updatedAt: 2000,
    });

    const dedupedA = deduplicateMarketingScenarios([olderEnabled, newerPaused]);
    const dedupedB = deduplicateMarketingScenarios([newerPaused, olderEnabled]);

    assert(dedupedA.length === 1 && dedupedA[0].id === 'ep1-new' && dedupedA[0].automationEnabled === false, 'Newer paused episode must win regardless of array order (A)');
    assert(dedupedB.length === 1 && dedupedB[0].id === 'ep1-new' && dedupedB[0].automationEnabled === false, 'Newer paused episode must win regardless of array order (B)');
    console.log('  -> PASSED: Timestamp takes precedence over automationEnabled during dedup.\n');
  }

  // Test 4: hasLocalMarketingScenariosCache distinguishes uninitialized cache vs explicit empty array
  console.log('Test 4: hasLocalMarketingScenariosCache distinguishes absent cache from saved []');
  {
    localStorage.removeItem('mst_marketing_scenarios_v1');
    assert(hasLocalMarketingScenariosCache() === false, 'Absent cache must return false');

    saveMarketingScenarios([]);
    assert(hasLocalMarketingScenariosCache() === true, 'Explicit empty array saved must return true');
    assert(loadMarketingScenarios().length === 0, 'Saved empty array loads back as []');
    console.log('  -> PASSED: Cache presence helper behaves accurately.\n');
  }

  // Test 5: WorkspaceSaveCoordinator.flushPendingDebounce() flushes queued debounced save immediately
  console.log('Test 5: WorkspaceSaveCoordinator.flushPendingDebounce() executes pending debounced save immediately');
  {
    const userId = 'user-flush-test';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    const savedPayloads: WorkspaceData[] = [];
    const coordinator = new WorkspaceSaveCoordinator(async (_uid, data) => {
      savedPayloads.push(data);
      return { savedData: data, wasMerged: false };
    });

    const toggledScenario = makeScenario({ id: 'scn-flush', status: 'prepared', automationEnabled: true, updatedAt: 5000 });
    coordinator.requestDebouncedSave(
      userId,
      () => createDummyWorkspaceData({ marketingScenarios: [toggledScenario] }),
      10_000
    );

    assert(savedPayloads.length === 0, 'Debounced save should not have fired before flush');
    const flushed = coordinator.flushPendingDebounce();
    assert(flushed === true, 'flushPendingDebounce must return true when save was pending');

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert(savedPayloads.length === 1, 'Flushed save must execute immediately');
    assert(savedPayloads[0].marketingScenarios[0]?.automationEnabled === true, 'Flushed save payload must contain toggled scenario');
    assert(coordinator.flushPendingDebounce() === false, 'Second flush when nothing pending must return false');
    console.log('  -> PASSED: Debounced save flushed immediately on unload/hide.\n');
  }

  console.log('ALL MARKETING SCENARIO PERSISTENCE TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
