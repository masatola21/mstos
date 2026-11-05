import { WorkspaceSaveCoordinator } from '../src/services/workspaceSaveCoordinator';
import { matrixService } from '../src/services/matrixService';
import { WorkspaceData, SaveWorkspaceResult } from '../src/services/workspaceStateService';

// localStorage stub
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
  console.log('=== Running Workspace Sync Races Acceptance Tests ===\n');

  // --------------------------------------------------------------------------
  // Test (a): 保存中の削除 (Fix 1)
  // --------------------------------------------------------------------------
  console.log('Test (a): Deletion recorded during in-flight save must survive for S2');
  {
    const userId = 'user-race-del';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    // 事前に cnt-1 の削除マーカーをセット
    matrixService.recordPendingDeletion(userId, 'contracts', 'cnt-1');

    let s1StartedResolve: () => void;
    const s1StartedPromise = new Promise<void>((r) => { s1StartedResolve = r; });
    let s1FinishResolve: (result: SaveWorkspaceResult) => void;
    const s1FinishPromise = new Promise<SaveWorkspaceResult>((r) => { s1FinishResolve = r; });

    const calls: { userId: string; data: WorkspaceData; pendingContracts: string[] }[] = [];

    // モック saveFn
    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      const pending = matrixService.getPendingDeletions(uId);
      calls.push({ userId: uId, data: d, pendingContracts: [...pending.contracts] });

      if (calls.length === 1) {
        // S1: 呼び出し開始を通知して待機
        s1StartedResolve();
        const res = await s1FinishPromise;
        // 古い実装の模倣：S1完了時に clearPendingDeletions(uId) を呼ぶ（もし修正前なら）
        if (typeof (matrixService as any).clearPendingDeletionsByIds === 'function') {
          (matrixService as any).clearPendingDeletionsByIds(uId, { contracts: ['cnt-1'] });
        } else {
          // 修正前: 全消ししてしまう
          matrixService.clearPendingDeletions(uId);
        }
        return res;
      } else {
        // S2
        if (typeof (matrixService as any).clearPendingDeletionsByIds === 'function') {
          (matrixService as any).clearPendingDeletionsByIds(uId, { contracts: [...pending.contracts] });
        } else {
          matrixService.clearPendingDeletions(uId);
        }
        return { savedData: d, wasMerged: false };
      }
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);

    const initialData = createDummyWorkspaceData({
      contracts: [{ id: 'cnt-keep', title: 'Keep' } as any],
    });

    // S1 開始
    const s1Promise = coordinator.requestImmediateSave(userId, initialData);
    await s1StartedPromise;

    // S1の保存中にユーザーが cnt-2 を削除してマーカーを記録
    matrixService.recordPendingDeletion(userId, 'contracts', 'cnt-2');

    // S1実行中に追加の保存リクエスト (S2)
    const updatedData = createDummyWorkspaceData({
      contracts: [{ id: 'cnt-keep', title: 'Keep updated' } as any],
    });
    const s2Promise = coordinator.requestImmediateSave(userId, updatedData);

    // S1 を完了させる
    s1FinishResolve!({ savedData: initialData, wasMerged: false });
    await s1Promise;
    await s2Promise;

    // 検証:
    // S1 は cnt-1 を送信
    assert(calls.length === 2, 'Expected 2 save calls, got ' + calls.length);
    assert(calls[0].pendingContracts.includes('cnt-1'), 'S1 must include cnt-1');
    
    // 【最重要】S2 は S1 実行中に追加された cnt-2 を保持して送信できていること！
    assert(
      calls[1].pendingContracts.includes('cnt-2'),
      'CRITICAL: S2 must send pending deletion cnt-2 which was recorded during S1'
    );

    console.log('  -> PASSED: cnt-2 deletion during S1 was preserved and sent in S2.\n');
  }

  
  // --------------------------------------------------------------------------
  // Test (b): マージ後の割り込みと pendingData の再基底化 (Fix 2)
  // --------------------------------------------------------------------------
  console.log('Test (b): wasMerged must rebase pendingData so remote additions (P2) survive in S2');
  {
    const userId = 'user-race-rebase';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    let s1StartedResolve: () => void;
    const s1StartedPromise = new Promise<void>((r) => { s1StartedResolve = r; });
    let s1FinishResolve: (result: SaveWorkspaceResult) => void;
    const s1FinishPromise = new Promise<SaveWorkspaceResult>((r) => { s1FinishResolve = r; });

    const calls: { userId: string; data: WorkspaceData }[] = [];

    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      calls.push({ userId: uId, data: d });
      if (calls.length === 1) {
        s1StartedResolve();
        return await s1FinishPromise;
      } else {
        return { savedData: d, wasMerged: false };
      }
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);

    // S1 開始時のデータ: products に P1
    const p1Original = { id: 'p1', name: 'Product 1 Original' } as any;
    const initialData = createDummyWorkspaceData({
      products: [p1Original],
    });

    const s1Promise = coordinator.requestImmediateSave(userId, initialData);
    await s1StartedPromise;

    // S1 実行中にユーザーが P1 をローカルで編集し、S2 をリクエスト
    const p1Edited = { id: 'p1', name: 'Product 1 User Edited' } as any;
    const pendingDataBeforeRebase = createDummyWorkspaceData({
      products: [p1Edited],
    });
    const s2Promise = coordinator.requestImmediateSave(userId, pendingDataBeforeRebase);

    // S1 が完了: 他端末が追加した P2 を含むマージ結果 (wasMerged: true) が返ってくる
    const p2Remote = { id: 'p2', name: 'Product 2 Added By Colleague' } as any;
    const mergedResultData = createDummyWorkspaceData({
      products: [p1Original, p2Remote],
    });

    s1FinishResolve!({ savedData: mergedResultData, wasMerged: true });
    await s1Promise;
    await s2Promise;

    // S2 が呼び出されたことを確認
    assert(calls.length === 2, 'Expected 2 save calls, got ' + calls.length);
    const s2Data = calls[1].data;

    // 【最重要】S2 に渡された products に、S1でマージされた P2 が含まれていること！
    const hasP2 = s2Data.products.some((p: any) => p.id === 'p2');
    assert(
      hasP2,
      'CRITICAL: S2 payload must include remotely added product P2 after S1 wasMerged'
    );

    // かつ、ユーザー編集 P1(User Edited) も保持されていること！
    const p1InS2 = s2Data.products.find((p: any) => p.id === 'p1');
    assert(
      p1InS2?.name === 'Product 1 User Edited',
      'User edit on P1 must be preserved in S2'
    );

    console.log('  -> PASSED: Pending data rebased successfully; P2 preserved and user edit kept.\n');
  }

  console.log('=====================================================');
  console.log('ALL TESTS COMPLETED!');
  
  // --------------------------------------------------------------------------
  // Test (b): マージ後の割り込みと pendingData の再基底化 (Fix 2)
  // --------------------------------------------------------------------------
  console.log('Test (b): wasMerged must rebase pendingData so remote additions (P2) survive in S2');
  {
    const userId = 'user-race-rebase';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    let s1StartedResolve: () => void;
    const s1StartedPromise = new Promise<void>((r) => { s1StartedResolve = r; });
    let s1FinishResolve: (result: SaveWorkspaceResult) => void;
    const s1FinishPromise = new Promise<SaveWorkspaceResult>((r) => { s1FinishResolve = r; });

    const calls: { userId: string; data: WorkspaceData }[] = [];

    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      calls.push({ userId: uId, data: d });
      if (calls.length === 1) {
        s1StartedResolve();
        return await s1FinishPromise;
      } else {
        return { savedData: d, wasMerged: false };
      }
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);

    // S1 開始時のデータ: products に P1
    const p1Original = { id: 'p1', name: 'Product 1 Original' } as any;
    const initialData = createDummyWorkspaceData({
      products: [p1Original],
    });

    const s1Promise = coordinator.requestImmediateSave(userId, initialData);
    await s1StartedPromise;

    // S1 実行中にユーザーが P1 をローカルで編集し、S2 をリクエスト
    const p1Edited = { id: 'p1', name: 'Product 1 User Edited' } as any;
    const pendingDataBeforeRebase = createDummyWorkspaceData({
      products: [p1Edited],
    });
    const s2Promise = coordinator.requestImmediateSave(userId, pendingDataBeforeRebase);

    // S1 が完了: 他端末が追加した P2 を含むマージ結果 (wasMerged: true) が返ってくる
    const p2Remote = { id: 'p2', name: 'Product 2 Added By Colleague' } as any;
    const mergedResultData = createDummyWorkspaceData({
      products: [p1Original, p2Remote],
    });

    s1FinishResolve!({ savedData: mergedResultData, wasMerged: true });
    await s1Promise;
    await s2Promise;

    // S2 が呼び出されたことを確認
    assert(calls.length === 2, 'Expected 2 save calls, got ' + calls.length);
    const s2Data = calls[1].data;

    // 【最重要】S2 に渡された products に、S1でマージされた P2 が含まれていること！
    const hasP2 = s2Data.products.some((p: any) => p.id === 'p2');
    assert(
      hasP2,
      'CRITICAL: S2 payload must include remotely added product P2 after S1 wasMerged'
    );

    // かつ、ユーザー編集 P1(User Edited) も保持されていること！
    const p1InS2 = s2Data.products.find((p: any) => p.id === 'p1');
    assert(
      p1InS2?.name === 'Product 1 User Edited',
      'User edit on P1 must be preserved in S2'
    );

    console.log('  -> PASSED: Pending data rebased successfully; P2 preserved and user edit kept.\n');
  }

  console.log('=====================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
