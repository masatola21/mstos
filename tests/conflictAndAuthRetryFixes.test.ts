import { isWorkspaceConflictError } from '../src/services/workspaceStateService';
import { WorkspaceSaveCoordinator } from '../src/services/workspaceSaveCoordinator';
import { isMarketingAuthError, MarketingApiAuthError } from '../src/components/marketing/MarketingAutomationJobsPanel';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

async function runTests() {
  console.log('=== Running Conflict & 401 Retry Fixes Acceptance Tests ===\n');

  // Test 1: isWorkspaceConflictError detects all conflict variants
  console.log('Test 1: isWorkspaceConflictError detection');
  {
    assert(isWorkspaceConflictError({ code: '40001', message: 'WORKSPACE_CONFLICT' }), 'Must detect code 40001');
    assert(isWorkspaceConflictError({ status: 409, message: 'Conflict' }), 'Must detect status 409');
    assert(isWorkspaceConflictError({ code: 'P0001', message: 'ERROR: WORKSPACE_CONFLICT' }), 'Must detect P0001 + WORKSPACE_CONFLICT');
    assert(isWorkspaceConflictError({ details: 'WORKSPACE_CONFLICT' }), 'Must detect details WORKSPACE_CONFLICT');
    assert(isWorkspaceConflictError('WORKSPACE_CONFLICT (40001)'), 'Must detect string WORKSPACE_CONFLICT');
    assert(!isWorkspaceConflictError({ code: '23505', message: 'duplicate key' }), 'Must NOT detect 23505 duplicate key');
    assert(!isWorkspaceConflictError(null), 'Must return false for null');
    console.log('  -> PASSED: All conflict error structures correctly detected.\n');
  }

  // Test 2: haltOnConflict stops all future saves and rejects immediately
  console.log('Test 2: WorkspaceSaveCoordinator.haltOnConflict');
  {
    const coordinator = new WorkspaceSaveCoordinator();
    coordinator.haltOnConflict('他の端末で更新されています。再読み込みしてください');

    assert(coordinator.isStopped() === true, 'Coordinator must be marked as stopped');
    assert(coordinator.getStatus() === 'conflict', 'Status must be conflict');

    let debouncedCalled = false;
    coordinator.requestDebouncedSave('user-1', () => {
      debouncedCalled = true;
      return {} as any;
    }, 10);

    await new Promise((r) => setTimeout(r, 50));
    assert(debouncedCalled === false, 'Debounced save must not execute when conflict halted');

    let immediateRejected = false;
    try {
      await coordinator.requestImmediateSave('user-1', {} as any);
    } catch (err: any) {
      immediateRejected = true;
      assert(err.message.includes('WORKSPACE_CONFLICT'), 'Error message must mention WORKSPACE_CONFLICT');
    }
    assert(immediateRejected, 'Immediate save must reject immediately when conflict halted');

    console.log('  -> PASSED: Coordinator halts cleanly on conflict.\n');
  }

  // Test 3: isMarketingAuthError detects 401 unauthorized and permission errors
  console.log('Test 3: isMarketingAuthError detection');
  {
    assert(isMarketingAuthError(new MarketingApiAuthError()), 'Must detect MarketingApiAuthError');
    assert(isMarketingAuthError({ status: 401 }), 'Must detect status 401');
    assert(isMarketingAuthError({ status: 403 }), 'Must detect status 403');
    assert(isMarketingAuthError({ code: '42501' }), 'Must detect code 42501 (insufficient_privilege)');
    assert(isMarketingAuthError({ code: 'PGRST301' }), 'Must detect PGRST301 (JWT expired)');
    assert(isMarketingAuthError({ message: 'JWT expired' }), 'Must detect JWT expired message');
    assert(isMarketingAuthError({ message: 'permission denied for table marketing_automation_jobs' }), 'Must detect permission denied');
    assert(!isMarketingAuthError({ code: '42703', message: 'column does not exist' }), 'Must not flag schema error as auth error');
    assert(!isMarketingAuthError(null), 'Must return false for null');
    console.log('  -> PASSED: All 401/auth errors correctly detected.\n');
  }

  console.log('=====================================================');
  console.log('ALL FIX TESTS COMPLETED SUCCESSFULLY! (3/3)');
  console.log('=====================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
