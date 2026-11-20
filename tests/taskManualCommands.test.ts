import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySystemTaskCommand,
  classifyWorkspaceTaskCommand,
  isImportantManualSystemTask,
  isImportantManualWorkspaceTask,
  extractTaskContextRefs,
  extractNameAndCompanyFromTaskTitle,
  findMatchingSubmissionForTask,
  shouldCreateAutomationLowerTask,
  resolveCompletedTaskState,
  DiagnosisSubmissionSummary,
  KnowledgeItemLike,
} from '../src/utils/taskManualCommands';

describe('taskManualCommands', () => {
  it('classifies system tasks into the right manual commands', () => {
    assert.equal(
      classifySystemTaskCommand({
        title: '【要対応・レポート承認】山田 太郎 様（テスト株式会社）の回答',
        description: '無料診断回答が届きました。',
      }),
      'generate_diagnosis_report'
    );

    assert.equal(
      classifySystemTaskCommand({
        title: '【要対応・Web相談（メール返信）】佐藤 花子 様（個人）',
        description: 'Web相談・お問い合わせが届きました。',
      }),
      'reply_consultation'
    );

    assert.equal(
      classifySystemTaskCommand({
        title: '【TimeRex面談予約】田中 一郎 様（2026-11-25 14:00）',
        description: 'TimeRexより面談日程が確定しました。',
      }),
      'confirm_meeting'
    );

    assert.equal(
      classifySystemTaskCommand({
        title: '【面談完了確認】田中 一郎 様（2026-11-20 14:00）',
        description: '',
      }),
      'confirm_meeting'
    );

    assert.equal(
      classifySystemTaskCommand({
        title: '【支払督促・要確認】ABC株式会社 請求書未払い（期限: 2026-11-10）',
        description: '',
      }),
      'billing_or_warning'
    );

    assert.equal(
      classifySystemTaskCommand({
        title: '【未設定警告】資料URLが未登録です（鈴木様の資料請求）',
        description: '',
      }),
      'billing_or_warning'
    );

    assert.equal(
      classifySystemTaskCommand({
        title: '【🎉即時成約】DEF株式会社 様よりWeb申込・発注を受領しました',
        description: '',
      }),
      'material_and_contract'
    );
  });

  it('classifies workspace TaskItem including diagnosis automation task', () => {
    assert.equal(
      classifyWorkspaceTaskCommand({
        title: '診断回答を確認・分析する',
        description: '公開診断フォームに新しい回答が届きました。',
        sourceAutomationId: 'workflow-diagnosis-submitted',
        assignee: { type: 'role_ai', name: '診断AI' },
        status: 'waiting',
      }),
      'generate_diagnosis_report'
    );

    assert.equal(
      classifyWorkspaceTaskCommand({
        title: '定例データの市場調査まとめ',
        description: 'AIによる自動収集',
        assignee: { type: 'role_ai', name: '調査AI' },
        status: 'waiting',
      }),
      null
    );

    assert.equal(
      classifyWorkspaceTaskCommand({
        title: '契約先への確認電話',
        description: '',
        assignee: { type: 'human', name: '人間' },
        status: 'waiting',
      }),
      'general_manual'
    );
  });

  it('separates important manual tasks from completed or background AI tasks', () => {
    assert.equal(
      isImportantManualSystemTask({
        title: '【要対応・レポート承認】山田 様（個人）の回答',
        status: 'todo',
        priority: 'high',
      }),
      true
    );

    assert.equal(
      isImportantManualSystemTask({
        title: '【要対応・レポート承認】山田 様（個人）の回答',
        status: 'done',
        priority: 'high',
      }),
      false
    );

    assert.equal(
      isImportantManualSystemTask({
        title: '情報共有メモ',
        status: 'todo',
        priority: 'low',
      }),
      false
    );

    assert.equal(
      isImportantManualWorkspaceTask({
        title: '診断回答を確認・分析する',
        description: '',
        status: 'waiting',
        priority: 'medium',
        assignee: { type: 'role_ai', name: '診断AI' },
        sourceAutomationId: 'workflow-diagnosis-submitted',
      }),
      true
    );

    assert.equal(
      isImportantManualWorkspaceTask({
        title: '自動リサーチ',
        description: '',
        status: 'waiting',
        priority: 'medium',
        assignee: { type: 'role_ai', name: 'リサーチAI' },
      }),
      false
    );

    assert.equal(
      isImportantManualWorkspaceTask({
        title: '完了した手動タスク',
        description: '',
        status: 'completed',
        priority: 'high',
        assignee: { type: 'human', name: '人間' },
      }),
      false
    );
  });

  it('extracts context refs and title name/company accurately', () => {
    const refs = extractTaskContextRefs(
      [
        '■ 申込者: 山田 太郎 様（テスト法人 / taro@example.com）',
        '■ 回答ID: 11111111-1111-1111-1111-111111111111',
        '■ 企業ID: 22222222-2222-2222-2222-222222222222',
        '■ リードID: 33333333-3333-3333-3333-333333333333',
      ].join('\n')
    );
    assert.equal(refs.submissionId, '11111111-1111-1111-1111-111111111111');
    assert.equal(refs.companyId, '22222222-2222-2222-2222-222222222222');
    assert.equal(refs.leadId, '33333333-3333-3333-3333-333333333333');
    assert.equal(refs.email, 'taro@example.com');

    assert.deepEqual(
      extractNameAndCompanyFromTaskTitle('【要対応・レポート承認】山田 太郎 様（テスト法人）の回答'),
      { personName: '山田 太郎', companyName: 'テスト法人' }
    );
    assert.deepEqual(
      extractNameAndCompanyFromTaskTitle('【要対応・レポート承認】佐藤 花子 様（個人）の回答'),
      { personName: '佐藤 花子', companyName: undefined }
    );
  });

  it('matches diagnosis submissions via sourceAutomationRecordId, embedded ID, leadId, or legacy title fallback', () => {
    const diagFormId = 'form-diag';
    const matFormId = 'form-mat';
    const diagnosisFormIds = new Set([diagFormId]);

    const submissions: DiagnosisSubmissionSummary[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        form_id: diagFormId,
        company_id: '22222222-2222-2222-2222-222222222222',
        lead_id: '33333333-3333-3333-3333-333333333333',
        diagnosis_id: 'diag-1',
        respondent_name: '山田 太郎',
        respondent_company_name: 'テスト法人',
        respondent_email: 'taro@example.com',
        submitted_at: '2026-11-20T01:00:00.000Z',
      },
      {
        id: '99999999-9999-9999-9999-999999999999',
        form_id: matFormId,
        company_id: '22222222-2222-2222-2222-222222222222',
        lead_id: '33333333-3333-3333-3333-333333333333',
        diagnosis_id: null,
        respondent_name: '山田 太郎',
        respondent_company_name: 'テスト法人',
        respondent_email: 'taro@example.com',
        submitted_at: '2026-11-20T02:00:00.000Z',
      },
    ];

    // 1. Workspace task with sourceAutomationRecordId
    const matchedWs = findMatchingSubmissionForTask({
      workspaceTask: {
        id: 'ws-1',
        title: '診断回答を確認・分析する',
        sourceAutomationRecordId: '11111111-1111-1111-1111-111111111111',
      },
      submissions,
      diagnosisFormIds,
      preferDiagnosisOnly: true,
    });
    assert.equal(matchedWs?.id, '11111111-1111-1111-1111-111111111111');

    // 2. Legacy system task without embedded ID still matches diagnosis form (ignoring later material submission)
    const matchedLegacy = findMatchingSubmissionForTask({
      systemTask: {
        id: 'sys-1',
        title: '【要対応・レポート承認】山田 太郎 様（テスト法人）の回答',
        description: 'フォーム「無料診断」の回答が届きました。',
        created_at: '2026-11-20T01:00:05.000Z',
      },
      submissions,
      diagnosisFormIds,
      preferDiagnosisOnly: true,
    });
    assert.equal(matchedLegacy?.id, '11111111-1111-1111-1111-111111111111');

    // 3. System task with explicit submission ID
    const matchedExplicit = findMatchingSubmissionForTask({
      systemTask: {
        id: 'sys-2',
        title: '【要対応・レポート承認】別名義 様（個人）の回答',
        description: '■ 回答ID: 11111111-1111-1111-1111-111111111111',
      },
      submissions,
      diagnosisFormIds,
      preferDiagnosisOnly: true,
    });
    assert.equal(matchedExplicit?.id, '11111111-1111-1111-1111-111111111111');
  });

  it('prevents preset diagnosis and overdue invoice rules from duplicating top-panel alerts in lower tasks', () => {
    assert.equal(
      shouldCreateAutomationLowerTask({ id: 'workflow-diagnosis-submitted', isEnabled: true }),
      false
    );
    assert.equal(
      shouldCreateAutomationLowerTask({ id: 'workflow-invoice-overdue', isEnabled: true }),
      false
    );
    assert.equal(
      shouldCreateAutomationLowerTask({ id: 'workflow-deal-won', isEnabled: true }),
      true
    );
    assert.equal(
      shouldCreateAutomationLowerTask({ id: 'workflow-deal-won', isEnabled: false }),
      false
    );
    assert.equal(
      shouldCreateAutomationLowerTask({ id: 'custom-diagnosis-extra', isEnabled: true }),
      true
    );
  });

  it('auto-saves draftArtifact to knowledge and resolves pending approvals on 1-click completion', () => {
    const now = 1763600000000;
    const res = resolveCompletedTaskState({
      task: {
        id: 'task-proj-1',
        status: 'waiting',
        updatedAt: now - 1000,
        completedAt: undefined as number | undefined,
        knowledgeItemId: undefined as string | undefined,
        draftArtifact: {
          title: '成果物：新プランの構成案',
          category: 'product',
          content: '# 構成案\n- ステップ1',
          tags: ['AI作成', '商品設計AI'],
          createdAt: now - 500,
          sourceRoleId: 'new_product',
        },
      },
      existingKnowledge: [] as KnowledgeItemLike[],
      existingApprovals: [
        { id: 'appr-1', taskId: 'task-proj-1', status: 'pending' as const },
        { id: 'appr-2', taskId: 'task-other', status: 'pending' as const },
      ],
      now,
    });

    assert.equal(res.updatedTask.status, 'completed');
    assert.equal(res.updatedTask.completedAt, now);
    assert.equal(res.updatedTask.draftArtifact, undefined);
    assert.equal(res.updatedTask.knowledgeItemId, 'knowledge-task-task-proj-1');
    assert.equal(res.savedKnowledge?.sourceTaskId, 'task-proj-1');
    assert.equal(res.knowledgeItems.length, 1);
    assert.equal(res.resolvedApprovalCount, 1);
    assert.equal(res.approvals[0].status, 'approved');
    assert.equal(res.approvals[1].status, 'pending');
  });
});
