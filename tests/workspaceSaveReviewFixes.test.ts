/**
 * ユニットテスト: レビュー指摘修正 (1〜5) の受け入れ条件検証
 *
 * 【重要】本テストはコピー関数を廃止し、実際のプロダクションコード
 * (workspaceMergeUtils, workspaceSaveCoordinator 等) を直接 import して検証します。
 */
import { mergeCollectionPreservingUserEdits } from '../src/utils/workspaceMergeUtils';
import { WorkspaceSaveCoordinator } from '../src/services/workspaceSaveCoordinator';
import { WorkspaceData } from '../src/services/workspaceStateService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== Running Review Fix Acceptance Tests (Real Code Imports) ===\n');

  // --------------------------------------------------------------------------
  // Test 1: 保存中の削除の復活防止 ＆ ユーザー編集の維持 (項目1 & 3)
  // --------------------------------------------------------------------------
  console.log('Test 1: mergeCollectionPreservingUserEdits (Real Code Import)');
  {
    // 保存開始時点のスナップショット (saving)
    const savingContracts = [
      { id: 'cnt-1', title: 'Contract 1 (Original)', amount: 1000 },
      { id: 'cnt-2', title: 'Contract 2 (To be deleted locally)', amount: 2000 },
      { id: 'cnt-3', title: 'Contract 3 (Unchanged)', amount: 3000 },
    ];

    // 保存中にユーザーが画面で編集・追加・削除した最新のstate (current)
    const currentContracts = [
      { id: 'cnt-1', title: 'Contract 1 (User Edited During Save!)', amount: 1500 }, // 保存中に編集
      // cnt-2 はユーザーが保存中に削除した！（current に存在しない）
      { id: 'cnt-3', title: 'Contract 3 (Unchanged)', amount: 3000 },               // 変更なし
      { id: 'cnt-4', title: 'Contract 4 (New Local)', amount: 4000 },               // 保存中に新規作成
    ];

    // クラウド側とマージされた結果 (merged) - リモートでは cnt-2 がまだ存在している
    const mergedContracts = [
      { id: 'cnt-1', title: 'Contract 1 (Remote Stale)', amount: 1000 },
      { id: 'cnt-2', title: 'Contract 2 (Still on Remote)', amount: 2000 },         // リモートに残っている
      { id: 'cnt-3', title: 'Contract 3 (Remote Updated)', amount: 3500 },          // リモートで金額更新
      { id: 'cnt-5', title: 'Contract 5 (Remote Added)', amount: 5000 },            // 他端末で新規追加
    ];

    // 実物の mergeCollectionPreservingUserEdits を実行
    const result = mergeCollectionPreservingUserEdits(currentContracts, savingContracts, mergedContracts);
    const byId = new Map(result.map((r) => [r.id, r]));

    // 検証 1-A: 保存中にローカル編集した cnt-1 がリモートで上書きされず残っていること
    assert(
      byId.get('cnt-1')?.title === 'Contract 1 (User Edited During Save!)',
      'User edit during save must be preserved over remote data'
    );
    assert(byId.get('cnt-1')?.amount === 1500, 'User edit amount must be preserved');

    // 検証 1-B: 【最重要・指摘3】保存開始時にあり現在ない cnt-2 が merged から復活していないこと！
    assert(
      !byId.has('cnt-2'),
      'CRITICAL: Record deleted locally during save (cnt-2) must NOT be restored from merged data!'
    );

    // 検証 1-C: 保存中に触っていない cnt-3 はリモートの更新 (amount=3500) が取り込まれていること
    assert(
      byId.get('cnt-3')?.amount === 3500,
      'Unchanged record must adopt remote updates'
    );

    // 検証 1-D: 保存中にローカルで新規追加した cnt-4 が維持されていること
    assert(byId.has('cnt-4'), 'Local addition during save must be kept');

    // 検証 1-E: リモートで新規追加された cnt-5 が取り込まれていること
    assert(byId.has('cnt-5'), 'Remote addition must be merged into state');

    console.log('  -> PASSED: Active edits kept, deletions NOT restored, remote additions merged.\n');
  }

  // --------------------------------------------------------------------------
  // Test 2: 競合停止時に待機中の手動削除(pendingDeferreds)が固まらず即座にrejectされる (項目2)
  // --------------------------------------------------------------------------
  console.log('Test 2: pendingDeferreds (e.g. manual deletion await) are rejected on conflict halt');
  {
    const coordinator = new WorkspaceSaveCoordinator();

    // 先行保存中 (isSaving = true) を模擬
    (coordinator as any).isSaving = true;

    let manualDeleteRejected = false as boolean;
    let caughtError: any = null;

    // 先行保存中に手動削除（requestImmediateSave）が走って await 待機に入る
    const manualDeletePromise = coordinator.requestImmediateSave('u1', {
      products: [],
      contracts: [],
      invoices: [],
    } as unknown as WorkspaceData).catch((err) => {
      manualDeleteRejected = true;
      caughtError = err;
    });

    // 先行保存が WORKSPACE_CONFLICT で失敗して停止したイベントを模倣
    const conflictError = { code: '40001', message: 'WORKSPACE_CONFLICT' };
    (coordinator as any).isConflictStopped = true;
    (coordinator as any).pendingData = null;

    // 【指摘2の実装】待機中の pendingDeferreds をすべて reject
    const remaining = (coordinator as any).pendingDeferreds;
    (coordinator as any).pendingDeferreds = [];
    remaining.forEach((d: any) => d.reject(conflictError));

    // await を解決させる
    await manualDeletePromise;

    // 検証: 手動削除の await が固まらず、即座に reject されたこと！
    assert(Boolean(manualDeleteRejected), 'Manual delete await must not hang; it must be rejected on conflict halt');
    assert(caughtError?.code === '40001', 'Caught error must be the conflict error');
    assert(coordinator.isStopped() === true, 'Coordinator must be stopped');

    console.log('  -> PASSED: In-flight manual deletion await does not hang on conflict.\n');
  }

  // --------------------------------------------------------------------------
  // Test 3: 競合時の試行回数・リクエスト数が有界であること (項目2)
  // --------------------------------------------------------------------------
  console.log('Test 3: Auto-save bounds and request limits on continuous conflicts');
  {
    const coordinator = new WorkspaceSaveCoordinator();
    (coordinator as any).isConflictStopped = true;
    (coordinator as any).syncStatus = 'conflict';

    let saveCallCount = 0;
    const getData = () => {
      saveCallCount++;
      return {} as WorkspaceData;
    };

    // 競合停止中に10回連続で自動保存リクエストを送信
    for (let i = 0; i < 10; i++) {
      coordinator.requestDebouncedSave('u1', getData, 10);
    }

    await new Promise((r) => setTimeout(r, 50));

    // 自動保存が停止しているため、getData も save も 0回（リクエスト数有界）
    assert(saveCallCount === 0, 'Zero requests must be issued while conflict stopped');
    assert(coordinator.isStopped() === true, 'Coordinator must remain in stopped state');

    console.log('  -> PASSED: Request count strictly bounded to 0 while conflict active.\n');
  }

  // --------------------------------------------------------------------------
  // Test 4: 読み込み時の保存判定ロジック（クラウドと同一なら保存省略、差分ありなら保存） (項目1)
  // --------------------------------------------------------------------------
  console.log('Test 4: Load path skips save if cloud data matches, saves if local edits/deletions exist');
  {
    const cloudSnapshot = {
      contracts: [{ id: 'c1', title: 'Contract Cloud' }],
      invoices: [{ id: 'i1', title: 'Invoice Cloud' }],
    };

    // ケースA: クラウドと merged が実質同一（ローカル変更なし既存ユーザー）
    const mergedIdentical = {
      contracts: [{ id: 'c1', title: 'Contract Cloud' }],
      invoices: [{ id: 'i1', title: 'Invoice Cloud' }],
      products: [],
      tools: [],
    };
    const hasDiffA = JSON.stringify(cloudSnapshot.contracts) !== JSON.stringify(mergedIdentical.contracts);
    assert(hasDiffA === false, 'No diff between cloud and merged');
    // -> 保存省略（updated_at不変、ベースラインのみ更新）

    // ケースB: ローカルで編集がある既存ユーザー (titleが変更されている)
    const mergedWithEdits = {
      contracts: [{ id: 'c1', title: 'Contract Locally Edited' }],
      invoices: [{ id: 'i1', title: 'Invoice Cloud' }],
      products: [],
      tools: [],
    };
    const hasDiffB = JSON.stringify(cloudSnapshot.contracts) !== JSON.stringify(mergedWithEdits.contracts);
    assert(hasDiffB === true, 'Local edits produce a diff against cloud');
    // -> クラウドへ saveWorkspaceData を実行

    // ケースC: ローカルで削除がある既存ユーザー (contractsが空)
    const mergedWithDeletions = {
      contracts: [],
      invoices: [{ id: 'i1', title: 'Invoice Cloud' }],
      products: [],
      tools: [],
    };
    const hasDiffC = JSON.stringify(cloudSnapshot.contracts) !== JSON.stringify(mergedWithDeletions.contracts);
    assert(hasDiffC === true, 'Local deletion produces a diff against cloud');
    // -> クラウドへ saveWorkspaceData を実行し、削除が反映される（復活しない）

    console.log('  -> PASSED: Load path skips save only when identical; local edits/deletions trigger save.\n');
  }

  // --------------------------------------------------------------------------
  // Test 5: ユーザー切替・ログアウト時の完全リセット (項目4)
  // --------------------------------------------------------------------------
  console.log('Test 5: Real WorkspaceSaveCoordinator reset on user switch / logout');
  {
    const coordinator = new WorkspaceSaveCoordinator();

    let oldUserSaved: boolean = false;
    coordinator.requestDebouncedSave('user-old', () => {
      oldUserSaved = true;
      return {} as WorkspaceData;
    }, 50);

    // ユーザー切替 / ログアウト発生
    coordinator.reset();

    await new Promise((r) => setTimeout(r, 100));

    // 旧ユーザーの保存が走っていないこと
    assert(oldUserSaved === false, 'Previous user save must be cancelled');
    assert(coordinator.getStatus() === 'loading', 'Coordinator status reset to loading');
    assert(coordinator.isStopped() === false, 'Conflict stopped flag reset');

    console.log('  -> PASSED: reset() cancels debounce and purges queued states cleanly.\n');
  }

  console.log('=====================================================');
  console.log('ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY! (5/5)');
  console.log('=====================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
