import { WorkspaceSaveCoordinator } from '../src/services/workspaceSaveCoordinator';
import { WorkspaceData, SaveWorkspaceResult, isWorkspaceConflictError } from '../src/services/workspaceStateService';

// localStorage mock for Node environment
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
    products: [{ id: 'p-1', name: 'Product A' } as any],
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
  console.log('=== Running Workspace Conflict & Runaway Prevention Tests ===\n');

  // --------------------------------------------------------------------------
  // Test 1: 競合（40001 / WORKSPACE_CONFLICT）発生時に最大3回でリトライが停止し、
  //         「他の端末で更新されました。再読み込みしてください」が表示され自動保存が停止すること
  // --------------------------------------------------------------------------
  console.log('Test 1: Conflict retry上限（最大3回）と自動保存の停止（haltOnConflict）');
  {
    let rpcAttempts = 0;
    const attemptTimestamps: number[] = [];

    // 人工的に古い p_expected_updated_at に起因する 40001 (WORKSPACE_CONFLICT) を返すモック saveFn
    const mockSaveFnWithConflict = async (
      userId: string,
      data: WorkspaceData,
      options?: { maxConflictRetries?: number }
    ): Promise<SaveWorkspaceResult> => {
      const maxRetries = options?.maxConflictRetries ?? 3;
      let retries = 0;

      while (true) {
        rpcAttempts++;
        attemptTimestamps.push(Date.now());

        // 人工的な WORKSPACE_CONFLICT エラー (SQLSTATE 40001)
        const conflictError = {
          code: '40001',
          message: 'WORKSPACE_CONFLICT: expected updated_at does not match database current updated_at',
          details: 'stale p_expected_updated_at detected',
        };

        if (retries < maxRetries) {
          retries++;
          // 指数バックオフ待機（テストを高速化するため短いスケールで検証）
          const backoffMs = Math.round(50 * Math.pow(2, retries - 1));
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        // 上限到達
        throw conflictError;
      }
    };

    const coordinator = new WorkspaceSaveCoordinator(mockSaveFnWithConflict);
    const userId = 'user-conflict-test-1';
    const testData = createDummyWorkspaceData({ products: [{ id: 'p-conflict', name: 'Conflict Product' } as any] });

    let caughtError: any = null;
    try {
      await coordinator.requestImmediateSave(userId, testData);
    } catch (err) {
      caughtError = err;
    }

    // 1. エラーが正しく catch されたこと
    assert(caughtError !== null, 'Save must fail when conflict persists');
    assert(isWorkspaceConflictError(caughtError), 'Caught error must be recognized as WORKSPACE_CONFLICT');

    // 2. 初回1回 + 最大3回リトライ = 合計4回（maxConflictRetries: 3）で確実に止まっていること
    assert(
      rpcAttempts === 4,
      `Expected exactly 4 attempts (1 initial + 3 retries), but got ${rpcAttempts}`
    );

    // 3. 自動保存が完全に停止（isStopped() === true）していること
    assert(coordinator.isStopped() === true, 'Coordinator must be halted on persistent conflict');
    assert(coordinator.getStatus() === 'conflict', 'Sync status must be "conflict"');
    assert(
      coordinator.getError().includes('他の端末で更新されました。再読み込みしてください'),
      `Error message must include reload instruction, got: "${coordinator.getError()}"`
    );

    // 4. 停止後は、ユーザーがリロード等で操作するまで、新たな保存リクエストが即座に拒否されサーバーへ再送されないこと
    let rejectedImmediate = false;
    try {
      await coordinator.requestImmediateSave(userId, testData);
    } catch (err: any) {
      rejectedImmediate = true;
      assert(
        err.message.includes('自動保存は停止されています'),
        'Immediate save while stopped must be rejected immediately'
      );
    }
    assert(rejectedImmediate, 'requestImmediateSave must be rejected while stopped');

    // debounce経由の自動保存も発火しないこと（rpcAttempts が増えないこと）
    const initialAttempts = rpcAttempts;
    coordinator.requestDebouncedSave(userId, () => testData, 10);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert(rpcAttempts === initialAttempts, 'No RPCs must be issued by debounced save while halted');

    console.log('  -> PASSED: Max 3 retries executed, auto-save halted, reload prompt shown, future saves blocked.\n');
  }

  // --------------------------------------------------------------------------
  // Test 2: 競合以外のエラーが3回連続した場合も自動保存を停止（暴走防止）
  // --------------------------------------------------------------------------
  console.log('Test 2: 競合以外の連続エラー（ネットワーク/サーバー障害等）でも上限到達で自動停止');
  {
    let nonConflictAttempts = 0;
    const failingSaveFn = async (): Promise<SaveWorkspaceResult> => {
      nonConflictAttempts++;
      throw new Error('Database 500 internal server error or network unreachable');
    };

    const coordinator = new WorkspaceSaveCoordinator(failingSaveFn);
    const userId = 'user-err-test-2';

    // 1回目のエラー
    try {
      await coordinator.requestImmediateSave(userId, createDummyWorkspaceData({ topGoal: 'Goal 1' }));
    } catch {}
    assert(coordinator.getConsecutiveErrorCount() === 1, 'Consecutive error count should be 1');
    assert(coordinator.isStopped() === false, 'Coordinator should not halt on first transient error');

    // 2回目のエラー
    try {
      await coordinator.requestImmediateSave(userId, createDummyWorkspaceData({ topGoal: 'Goal 2' }));
    } catch {}
    assert(coordinator.getConsecutiveErrorCount() === 2, 'Consecutive error count should be 2');
    assert(coordinator.isStopped() === false, 'Coordinator should not halt on second transient error');

    // 3回目の連続エラー -> 上限到達で自動停止
    try {
      await coordinator.requestImmediateSave(userId, createDummyWorkspaceData({ topGoal: 'Goal 3' }));
    } catch {}
    assert(coordinator.getConsecutiveErrorCount() >= 3, 'Consecutive error count should be at least 3');
    assert(coordinator.isStopped() === true, 'Coordinator must halt on 3 consecutive errors');
    assert(coordinator.getStatus() === 'conflict', 'Coordinator must transition to conflict status to prompt reload');
    assert(
      coordinator.getError().includes('他の端末で更新されました。再読み込みしてください'),
      'Must prompt user to reload after consecutive failures'
    );

    console.log('  -> PASSED: Consecutive non-conflict errors bounded and halted safely.\n');
  }

  // --------------------------------------------------------------------------
  // Test 3: 重複エラーログの抑制（同一内容の連続ログを1回にまとめる）
  // --------------------------------------------------------------------------
  console.log('Test 3: 重複エラーログの抑制機能');
  {
    const originalConsoleError = console.error;
    let loggedErrorCount = 0;
    console.error = () => {
      loggedErrorCount++;
    };

    const coordinator = new WorkspaceSaveCoordinator(async () => {
      throw new Error('Repeated identical network timeout');
    });

    try {
      // 連続で同一エラーを発生させる
      for (let i = 0; i < 5; i++) {
        (coordinator as any).logCloudSaveError(new Error('Repeated identical network timeout'));
      }
    } finally {
      console.error = originalConsoleError;
    }

    // 5回呼んでも、初回1回のみコンソールに出力され、残りは抑制されていること
    assert(
      loggedErrorCount === 1,
      `Duplicate errors must be suppressed to 1, but got ${loggedErrorCount} logs`
    );

    console.log('  -> PASSED: 5 identical errors logged only once.\n');
  }

  // --------------------------------------------------------------------------
  // Test 4: 保存実行中のリクエストはキューにまとめられ、同時に複数走らないこと
  // --------------------------------------------------------------------------
  console.log('Test 4: 並行保存のキューまとめ（同時多重実行の防止）');
  {
    let activeConcurrentSaves = 0;
    let maxConcurrentSaves = 0;
    let saveCallCount = 0;

    let finishS1: () => void;
    const s1Blocker = new Promise<void>((r) => { finishS1 = r; });

    const slowSaveFn = async (uId: string, d: WorkspaceData): Promise<SaveWorkspaceResult> => {
      saveCallCount++;
      activeConcurrentSaves++;
      maxConcurrentSaves = Math.max(maxConcurrentSaves, activeConcurrentSaves);

      if (saveCallCount === 1) {
        await s1Blocker;
      }

      activeConcurrentSaves--;
      return { savedData: d, wasMerged: false };
    };

    const coordinator = new WorkspaceSaveCoordinator(slowSaveFn);
    const userId = 'user-queue-test';

    // 1つ目の保存を開始（実行中）
    const p1 = coordinator.requestImmediateSave(userId, createDummyWorkspaceData({ topGoal: 'State 1' }));

    // 実行中に2つ目、3つ目の保存リクエストを送信
    const p2 = coordinator.requestImmediateSave(userId, createDummyWorkspaceData({ topGoal: 'State 2' }));
    const p3 = coordinator.requestImmediateSave(userId, createDummyWorkspaceData({ topGoal: 'State 3' }));

    // S1 を完了させる
    finishS1!();
    await Promise.all([p1, p2, p3]);

    // 最大並行実行数は常に 1 であること
    assert(maxConcurrentSaves === 1, `Max concurrent saves must be 1, got ${maxConcurrentSaves}`);
    // p2 と p3 は最新の State 3 の1回にまとめられるため、全体で合計 2 回の保存で完了すること
    assert(saveCallCount === 2, `Expected coalesced 2 save calls, got ${saveCallCount}`);

    console.log('  -> PASSED: Concurrency strictly bounded to 1, pending saves coalesced.\n');
  }

  console.log('=====================================================');
  console.log('ALL WORKSPACE CONFLICT & RUNAWAY TESTS PASSED!');
  console.log('=====================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
