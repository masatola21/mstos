import { WorkspaceSaveCoordinator } from '../src/services/workspaceSaveCoordinator';
import { matrixService } from '../src/services/matrixService';
import { WorkspaceData, SaveWorkspaceResult, mergeRecords } from '../src/services/workspaceStateService';
import { stableStringify } from '../src/utils/stableSerialize';

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
        s1StartedResolve();
        const res = await s1FinishPromise;
        if (typeof (matrixService as any).clearPendingDeletionsByIds === 'function') {
          (matrixService as any).clearPendingDeletionsByIds(uId, { contracts: ['cnt-1'] });
        } else {
          matrixService.clearPendingDeletions(uId);
        }
        return res;
      } else {
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

    assert(calls.length === 2, 'Expected 2 save calls, got ' + calls.length);
    assert(calls[0].pendingContracts.includes('cnt-1'), 'S1 must include cnt-1');
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

    // S1 が完了: 他端末が追加した P2 を含むマージ結果 (wasMerged: true)
    const p2Remote = { id: 'p2', name: 'Product 2 Added By Colleague' } as any;
    const mergedResultData = createDummyWorkspaceData({
      products: [p1Original, p2Remote],
    });

    s1FinishResolve!({ savedData: mergedResultData, wasMerged: true });
    await s1Promise;
    await s2Promise;

    assert(calls.length === 2, 'Expected 2 save calls, got ' + calls.length);
    const s2Data = calls[1].data;

    const hasP2 = s2Data.products.some((p: any) => p.id === 'p2');
    assert(
      hasP2,
      'CRITICAL: S2 payload must include remotely added product P2 after S1 wasMerged'
    );
    const p1InS2 = s2Data.products.find((p: any) => p.id === 'p1');
    assert(
      p1InS2?.name === 'Product 1 User Edited',
      'User edit on P1 must be preserved in S2'
    );

    console.log('  -> PASSED: Pending data rebased successfully; P2 preserved and user edit kept.\n');
  }

  // --------------------------------------------------------------------------
  // Test (c): 保存中の元戻し (A -> B(保存中) -> A) (Fix 4)
  // --------------------------------------------------------------------------
  console.log('Test (c): Undo during save (A -> B(in-flight) -> A) must enqueue A and save A');
  {
    const userId = 'user-race-undo';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    const calls: { userId: string; data: WorkspaceData }[] = [];
    let bStartedResolve: () => void;
    const bStartedPromise = new Promise<void>((r) => { bStartedResolve = r; });
    let bFinishResolve: (result: SaveWorkspaceResult) => void;
    const bFinishPromise = new Promise<SaveWorkspaceResult>((r) => { bFinishResolve = r; });

    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      calls.push({ userId: uId, data: d });
      if (calls.length === 1) {
        bStartedResolve();
        return await bFinishPromise;
      } else {
        return { savedData: d, wasMerged: false };
      }
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);

    const dataA = createDummyWorkspaceData({ topGoal: 'Goal A' });
    const dataB = createDummyWorkspaceData({ topGoal: 'Goal B' });

    coordinator.setInitialSavedSnapshot(dataA);

    const saveBPromise = coordinator.requestImmediateSave(userId, dataB);
    await bStartedPromise;

    // B の保存中に A に戻す
    const undoPromise = coordinator.requestImmediateSave(userId, dataA);

    // B 完了
    bFinishResolve!({ savedData: dataB, wasMerged: false });
    await saveBPromise;
    await undoPromise;

    assert(calls.length === 2, 'Expected 2 save calls for A->B->A, got ' + calls.length);
    assert(calls[0].data.topGoal === 'Goal B', 'First call should have saved B');
    assert(calls[1].data.topGoal === 'Goal A', 'CRITICAL: Second call must save undone state A, not skip it!');

    console.log('  -> PASSED: Undo during save (A->B->A) successfully scheduled and saved A.\n');
  }

  // --------------------------------------------------------------------------
  // Test (c-2): 実行中保存が一般エラーで失敗した場合の pendingData の扱い (Fix 4 補足)
  // --------------------------------------------------------------------------
  console.log('Test (c-2): In-flight save error correctly handles queued pendingData');
  {
    const userId = 'user-race-fail';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    const calls: { userId: string; data: WorkspaceData }[] = [];
    let bStartedResolve: () => void;
    const bStartedPromise = new Promise<void>((r) => { bStartedResolve = r; });
    let bFinishReject: (error: any) => void;
    const bFinishPromise = new Promise<SaveWorkspaceResult>((_, rej) => { bFinishReject = rej; });

    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      calls.push({ userId: uId, data: d });
      if (calls.length === 1) {
        bStartedResolve();
        return await bFinishPromise;
      } else {
        return { savedData: d, wasMerged: false };
      }
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);
    const dataA = createDummyWorkspaceData({ topGoal: 'Goal A' });
    const dataB = createDummyWorkspaceData({ topGoal: 'Goal B' });
    coordinator.setInitialSavedSnapshot(dataA);

    let bFailed = false as boolean;
    const saveBPromise = coordinator.requestImmediateSave(userId, dataB).catch(() => {
      bFailed = true;
    });
    await bStartedPromise;

    const saveAPromise = coordinator.requestImmediateSave(userId, dataA);

    bFinishReject!(new Error('Network temporary glitch'));
    await saveBPromise;
    await saveAPromise;

    assert(Boolean(bFailed), 'B should have failed');
    assert(calls.length === 2, 'A should have been executed next after non-conflict failure');
    assert(calls[1].data.topGoal === 'Goal A', 'Next execution should be A');

    console.log('  -> PASSED: Non-conflict failure properly drained pendingData A.\n');
  }

  
  // --------------------------------------------------------------------------
  // Test (d): キー順序違いのマージと安定シリアライズ (Fix 5)
  // --------------------------------------------------------------------------
  console.log('Test (d): Key-order differences in JSON should not cause false merge conflicts');
  {
    // baseline と remote でプロパティの挿入順序（キー順）が異なるレコード
    // （jsonb はキーをアルファベット順等で格納・返却するため、クライアント側の順序と異なる場合がある）
    const baselineItem = { id: 'item-1', b: 'value-b', a: 'value-a' };
    const remoteItem = { id: 'item-1', a: 'value-a', b: 'value-b' };

    // JSON.stringify だと順序違いで不一致と判定されることを前提として確認
    assert(
      JSON.stringify(baselineItem) !== JSON.stringify(remoteItem),
      'Standard JSON.stringify must be sensitive to key order for this test'
    );

    // ケース d-1: ローカル削除
    // ユーザーはローカルで item-1 を削除した（local = []）
    // リモートは未変更（キー順が違うだけ）。期待: item-1 は削除される（空配列）
    const mergedAfterDelete = mergeRecords(
      [remoteItem],
      [],
      [baselineItem]
    );
    assert(
      mergedAfterDelete.length === 0,
      'CRITICAL: Local deletion must be applied even when remote has different JSON key order'
    );

    // ケース d-2: ローカル編集
    // ユーザーはローカルで b を編集した
    // リモートは未変更（キー順が違うだけ）。期待: リモート未変更と認識されローカル編集が採用される
    const localItemEdited = { id: 'item-1', b: 'value-b-edited', a: 'value-a' };
    const mergedAfterEdit = mergeRecords(
      [remoteItem],
      [localItemEdited],
      [baselineItem]
    );
    assert(
      mergedAfterEdit.length === 1 && (mergedAfterEdit[0] as any).b === 'value-b-edited',
      'CRITICAL: Local edit must be preserved over remote when remote only differs by key order'
    );

    
    // 安定シリアライズ関数の単体検証
    assert(
      stableStringify({ z: 1, a: { y: 2, b: 3 } }) === stableStringify({ a: { b: 3, y: 2 }, z: 1 }),
      'Nested keys must be sorted and match exactly'
    );
    assert(
      stableStringify([1, 2, 3]) !== stableStringify([3, 2, 1]),
      'Array element order must be preserved'
    );
    assert(
      stableStringify({ a: undefined, b: 1 }) === JSON.stringify({ b: 1 }),
      'Undefined values must be omitted in object'
    );

    console.log('  -> PASSED: Key order independence verified for both deletion and edit.\n');
  }

  // --------------------------------------------------------------------------
  // Test (e): 修正A 欠陥1: キュー済みの別状態(C)が、実行中状態(B)への復帰で破棄されること
  // --------------------------------------------------------------------------
  console.log('Test (e): Reverting to in-flight state (A -> B(in-flight) -> C(queued) -> B) must drop queued C');
  {
    const userId = 'user-race-revert-inflight';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    const calls: { userId: string; data: WorkspaceData }[] = [];
    let bStartedResolve: () => void;
    const bStartedPromise = new Promise<void>((r) => { bStartedResolve = r; });
    let bFinishResolve: (result: SaveWorkspaceResult) => void;
    const bFinishPromise = new Promise<SaveWorkspaceResult>((r) => { bFinishResolve = r; });

    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      calls.push({ userId: uId, data: d });
      if (calls.length === 1) {
        bStartedResolve();
        return await bFinishPromise;
      } else {
        return { savedData: d, wasMerged: false };
      }
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);
    const dataA = createDummyWorkspaceData({ topGoal: 'Goal A' });
    const dataB = createDummyWorkspaceData({ topGoal: 'Goal B' });
    const dataC = createDummyWorkspaceData({ topGoal: 'Goal C' });

    coordinator.setInitialSavedSnapshot(dataA);

    // 1. B を保存開始
    const saveBPromise = coordinator.requestImmediateSave(userId, dataB);
    await bStartedPromise;

    // 2. 保存中に C をリクエスト (pendingData = C)
    const saveCPromise = coordinator.requestImmediateSave(userId, dataC);

    // 3. 画面上で B に戻してリクエスト (現在の画面状態は B、保存実行中の状態も B)
    // 期待: pendingData(C) が破棄され、S2 は走らない
    const returnToBPromise = coordinator.requestImmediateSave(userId, dataB);

    // 4. B の保存完了
    bFinishResolve!({ savedData: dataB, wasMerged: false });
    await saveBPromise;
    await saveCPromise;
    await returnToBPromise;

    // 検証: calls は B の 1 回のみであること！ (C は送信されない)
    assert(
      calls.length === 1,
      'CRITICAL: Save calls must be exactly 1 (B only). Queued C must be dropped, got ' + calls.length
    );
    assert(
      calls[0].data.topGoal === 'Goal B',
      'The only save call must be B'
    );

    console.log('  -> PASSED: Queued state C successfully dropped when user reverted to in-flight state B.\n');
  }

  // --------------------------------------------------------------------------
  // Test (f): 修正A 欠陥2: 同一内容リクエストの deferred が未解決のまま固まらず解決されること
  // --------------------------------------------------------------------------
  console.log('Test (f): In-flight identical request deferred must resolve or reject with in-flight save');
  {
    const userId = 'user-race-waiter-resolve';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    let bStartedResolve: () => void;
    const bStartedPromise = new Promise<void>((r) => { bStartedResolve = r; });
    let bFinishResolve: (result: SaveWorkspaceResult) => void;
    const bFinishPromise = new Promise<SaveWorkspaceResult>((r) => { bFinishResolve = r; });

    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      bStartedResolve();
      return await bFinishPromise;
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);
    const dataB = createDummyWorkspaceData({ topGoal: 'Goal B' });

    // 1. B を保存開始
    const saveB1 = coordinator.requestImmediateSave(userId, dataB);
    await bStartedPromise;

    // 2. pendingData が無い状態で、B と同一内容を deferred 付きでリクエスト
    const saveB2 = coordinator.requestImmediateSave(userId, dataB);

    // 3. 500ms タイマーを仕掛けて解決されるか検証
    let timeoutId: any;
    const timeoutPromise = new Promise((_, rej) => {
      timeoutId = setTimeout(() => rej(new Error('TIMEOUT: saveB2 deferred hung for >500ms')), 500);
    });

    // B 完了
    bFinishResolve!({ savedData: dataB, wasMerged: false });

    // saveB2 が正常に resolve されること
    const resB2 = await Promise.race([saveB2, timeoutPromise]);
    clearTimeout(timeoutId);
    await saveB1;

    assert((resB2 as any)?.savedData?.topGoal === 'Goal B', 'saveB2 must resolve with B result');

    // サブテスト: S1 が失敗した場合は inFlightWaiters も reject されること
    let bFailStartedResolve: () => void;
    const bFailStartedPromise = new Promise<void>((r) => { bFailStartedResolve = r; });
    let bFailFinishReject: (err: any) => void;
    const bFailFinishPromise = new Promise<SaveWorkspaceResult>((_, rej) => { bFailFinishReject = rej; });

    const failSaveFn = async () => {
      bFailStartedResolve();
      return await bFailFinishPromise;
    };
    const failCoordinator = new WorkspaceSaveCoordinator(failSaveFn);
    const failPromise1 = failCoordinator.requestImmediateSave(userId, dataB).catch((e) => e);
    await bFailStartedPromise;

    // 同一内容リクエスト
    let waiterRejected = false as boolean;
    const failPromise2 = failCoordinator.requestImmediateSave(userId, dataB).catch(() => {
      waiterRejected = true;
    });

    bFailFinishReject!(new Error('Save failed in cloud'));
    await failPromise1;
    await failPromise2;

    assert(Boolean(waiterRejected), 'CRITICAL: In-flight identical request must reject when in-flight save fails');

    console.log('  -> PASSED: In-flight identical request deferreds resolve/reject in lockstep with in-flight save.\n');
  }

  // --------------------------------------------------------------------------
  // Test (g): 同一内容のリクエストを繰り返しても保存の呼び出しが増えないこと
  // --------------------------------------------------------------------------
  console.log('Test (g): Repeated identical requests during save do not increase save calls');
  {
    const userId = 'user-race-repeat';
    matrixService.setActiveUserId(userId);
    matrixService.clearPendingDeletions(userId);

    let callCount = 0;
    let bStartedResolve: () => void;
    const bStartedPromise = new Promise<void>((r) => { bStartedResolve = r; });
    let bFinishResolve: (result: SaveWorkspaceResult) => void;
    const bFinishPromise = new Promise<SaveWorkspaceResult>((r) => { bFinishResolve = r; });

    const mockSaveFn = async (uId: string, d: WorkspaceData) => {
      callCount++;
      bStartedResolve();
      return await bFinishPromise;
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFn);
    const dataB = createDummyWorkspaceData({ topGoal: 'Goal B' });

    // 1. B 保存開始
    const p1 = coordinator.requestImmediateSave(userId, dataB);
    await bStartedPromise;

    // 2. 同一内容 B を 5 回連続でリクエスト
    const promises = [p1];
    for (let i = 0; i < 5; i++) {
      promises.push(coordinator.requestImmediateSave(userId, dataB));
    }

    bFinishResolve!({ savedData: dataB, wasMerged: false });
    await Promise.all(promises);

    assert(callCount === 1, 'Save calls must remain exactly 1, got ' + callCount);

    console.log('  -> PASSED: Repeated identical requests do not produce additional save calls.\n');
  }

  console.log('=====================================================');
  console.log('ALL TESTS COMPLETED!');
  console.log('=====================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
