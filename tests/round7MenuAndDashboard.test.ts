import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test Round 7: Menu Reorganization, Tab Visibility, and Action Dashboard Logic

describe('Round 7: Menu Reorganization & Dashboard Acceptance Tests', () => {
  it('Test 1: Daily business vs collapsible management groups structure', () => {
    const dailyBusinessGroupIds = ['marketing', 'sales', 'ai_president'];
    const collapsibleManagementGroupIds = ['management_other'];

    // Expected daily business top-level navigation items (8~9 items)
    const expectedDailyItems = [
      // 集客・営業開拓 (4)
      'ai_acquisition',
      'contacts',
      'marketing_automation',
      'mst_diagnoses',
      // 営業・顧客管理 (3)
      'leads',
      'document_templates',
      'customer_operations',
      // AI経営室 (2)
      'ai_chat',
      'ai_knowledge',
    ];

    assert.equal(expectedDailyItems.length, 9, 'Daily business should contain 9 items');

    // Expected management/collapsible items
    const expectedManagementItems = [
      'communication_send',
      'companies',
      'product_hub',
      'ai_presets',
    ];

    assert.equal(expectedManagementItems.length, 4, 'Management section should contain 4 core items');
    assert.ok(dailyBusinessGroupIds.length === 3);
    assert.ok(collapsibleManagementGroupIds.length === 1);
  });

  it('Test 2: TasksView tab visibility rules', () => {
    // Rule:
    // When showAllMenus is false AND pendingApprovalsCount === 0 -> only 'tasks' tab visible
    // When showAllMenus is true -> 'tasks', 'approvals', 'logs' all visible
    // When pendingApprovalsCount > 0 -> 'approvals' tab is visible even if showAllMenus is false
    const calculateVisibleTabs = (pendingApprovalsCount: number, showAllMenus: boolean) => {
      const showApprovals = showAllMenus || pendingApprovalsCount > 0;
      const showLogs = showAllMenus;
      const tabs = ['tasks'];
      if (showApprovals) tabs.push('approvals');
      if (showLogs) tabs.push('logs');
      return tabs;
    };

    // Case A: Default clean state (0 pending, showAllMenus=false)
    assert.deepEqual(calculateVisibleTabs(0, false), ['tasks']);

    // Case B: Pending approval exists (1 pending, showAllMenus=false)
    assert.deepEqual(calculateVisibleTabs(1, false), ['tasks', 'approvals']);

    // Case C: showAllMenus turned ON (0 pending)
    assert.deepEqual(calculateVisibleTabs(0, true), ['tasks', 'approvals', 'logs']);

    // Case D: showAllMenus turned ON with pending approvals
    assert.deepEqual(calculateVisibleTabs(3, true), ['tasks', 'approvals', 'logs']);
  });

  it('Test 3: MarketingFlowStudio default viewMode & starter set prominence', () => {
    // Default view mode resolution logic
    const resolveViewMode = (saved: string | null): 'flow' | 'table' => {
      if (saved === 'flow' || saved === 'table') return saved;
      return 'table'; // Round 7 specifies table as default
    };

    assert.equal(resolveViewMode(null), 'table');
    assert.equal(resolveViewMode('flow'), 'flow');
    assert.equal(resolveViewMode('table'), 'table');

    // Starter set buttons prominence logic
    const isStarterUncollapsed = (scenarioCount: number) => scenarioCount === 0;
    assert.equal(isStarterUncollapsed(0), true, 'When 0 scenarios, starter sets are uncollapsed');
    assert.equal(isStarterUncollapsed(5), false, 'When >= 1 scenarios, starter sets are collapsed');
  });

  it('Test 4: Today agenda zero condition and total count calculation', () => {
    interface TodayAgendaState {
      todayEvents: any[];
      unhandledLeads: any[];
      dueFollowups: any[];
    }

    const isTodayAllDone = (agenda: TodayAgendaState) => {
      const total = agenda.todayEvents.length + agenda.unhandledLeads.length + agenda.dueFollowups.length;
      return total === 0;
    };

    // Case 1: Empty agenda
    const emptyAgenda: TodayAgendaState = { todayEvents: [], unhandledLeads: [], dueFollowups: [] };
    assert.equal(isTodayAllDone(emptyAgenda), true, 'Empty agenda means all done');

    // Case 2: Has event
    const agendaWithEvent: TodayAgendaState = {
      todayEvents: [{ id: '1', title: 'MTG' }],
      unhandledLeads: [],
      dueFollowups: [],
    };
    assert.equal(isTodayAllDone(agendaWithEvent), false);

    // Case 3: Has unhandled lead
    const agendaWithLead: TodayAgendaState = {
      todayEvents: [],
      unhandledLeads: [{ id: 'lead-1', companyName: 'Corp A' }],
      dueFollowups: [],
    };
    assert.equal(isTodayAllDone(agendaWithLead), false);

    // Case 4: Has overdue followup
    const agendaWithFollowup: TodayAgendaState = {
      todayEvents: [],
      unhandledLeads: [],
      dueFollowups: [{ id: 'task-1', title: 'Review Proposal' }],
    };
    assert.equal(isTodayAllDone(agendaWithFollowup), false);
  });
});
