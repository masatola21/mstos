export type FlowStepState = 'done' | 'current' | 'upcoming' | 'paused' | 'lost';

export interface PipelineFlowStep {
  key: string;
  label: string;
  state: FlowStepState;
}

const LEAD_STATUS_RANK: Record<string, number> = {
  '': 0,
  '新規': 10,
  '未対応': 10,
  '資料請求': 20,
  '診断申込': 20,
  '相談申込': 25,
  'ヒアリング済': 30,
  '再調整待ち': 35,
  '面談予約済': 40,
  '面談実施済': 50,
  '商談化': 60,
  '成約': 90,
  '受注': 90,
  '失注': 95,
  '見送り': 95,
  '失注・対象外': 95,
};

const DEAL_STATUS_RANK: Record<string, number> = {
  '': 0,
  '新規': 10,
  '日程確定': 20,
  '日程再調整': 22,
  '初回面談': 25,
  '面談完了': 35,
  '要件提案': 45,
  '保留': 48,
  '見積提示': 55,
  '最終交渉': 65,
  '成約': 90,
  '受注': 90,
  'Won': 90,
  '失注': 95,
  '見送り': 95,
  'キャンセル': 95,
};

export function getLeadStatusRank(status?: string | null): number {
  const s = String(status || '').trim();
  return LEAD_STATUS_RANK[s] ?? 15;
}

export function getDealStatusRank(status?: string | null): number {
  const s = String(status || '').trim();
  return DEAL_STATUS_RANK[s] ?? 20;
}

/**
 * リードのステータスを後戻りさせずに進行させる。
 * 既に「面談予約済」「面談実施済」「商談化」「成約」等に達している場合、
 * 後続の資料請求・LINE相談・診断フォーム送信で古い段階に戻さない。
 */
export function resolveNonDowngradingLeadStatus(
  currentStatus?: string | null,
  candidateStatus?: string | null
): string {
  const cur = String(currentStatus || '').trim();
  const next = String(candidateStatus || '').trim();
  if (!next) return cur || '新規';
  if (!cur) return next;

  const curRank = getLeadStatusRank(cur);
  const nextRank = getLeadStatusRank(next);

  // 既に商談化・成約・失注済みなら保持（成約への遷移のみ許可）
  if (curRank >= 90) {
    if (cur === '失注・対象外' || cur === '失注' || cur === '見送り') {
      return cur;
    }
    return cur;
  }

  // 再調整待ち <-> 面談予約済 の遷移は許可
  if (cur === '再調整待ち' && next === '面談予約済') {
    return next;
  }

  return nextRank >= curRank ? next : cur;
}

/**
 * 商談のステータスを後戻りさせずに進行させる。
 */
export function resolveNonDowngradingDealStatus(
  currentStatus?: string | null,
  candidateStatus?: string | null
): string {
  const cur = String(currentStatus || '').trim();
  const next = String(candidateStatus || '').trim();
  if (!next) return cur || '日程確定';
  if (!cur) return next;

  const curRank = getDealStatusRank(cur);
  const nextRank = getDealStatusRank(next);

  // 成約・受注は常に優先して維持（失注へ自動上書きしない）
  if (['成約', '受注', 'Won'].includes(cur)) {
    return cur;
  }
  if (['成約', '受注', 'Won'].includes(next)) {
    return next;
  }

  // 日程再調整 -> 日程確定 は復帰を許可
  if (cur === '日程再調整' && next === '日程確定') {
    return next;
  }

  return nextRank >= curRank ? next : cur;
}

/**
 * 重複追記を防ぎつつ、メモ・履歴を結合する。
 */
export function appendUniqueNote(existingNote?: string | null, addition?: string | null, maxLength = 12000): string {
  const prev = String(existingNote || '').trim();
  const add = String(addition || '').trim();
  if (!add) return prev;
  if (!prev) return add.slice(-maxLength);
  if (prev.includes(add)) return prev;
  return `${prev}\n\n${add}`.slice(-maxLength);
}

/**
 * 商談1行の中で「今どの工程にいるか」を可視化するための5段階ステップ計算。
 */
export function getDealFlowSteps(proposalStatus?: string | null): PipelineFlowStep[] {
  const s = String(proposalStatus || '').trim();
  const isLost = ['失注', '見送り', 'キャンセル'].includes(s);
  const isPaused = s === '保留' || s === '日程再調整';

  let currentIdx = 0;
  if (['成約', '受注', 'Won'].includes(s)) currentIdx = 4;
  else if (s === '最終交渉') currentIdx = 3;
  else if (s === '見積提示' || s === '見積提出') currentIdx = 2;
  else if (s === '要件提案' || s === '提案中' || s === '提案済') currentIdx = 1;
  else if (s === '面談完了') currentIdx = 0;
  else currentIdx = 0; // 日程確定・初回面談・日程再調整・保留・新規

  const labels = [
    { key: 'meeting', label: '面談' },
    { key: 'proposal', label: '提案' },
    { key: 'estimate', label: '見積' },
    { key: 'negotiation', label: '交渉' },
    { key: 'won', label: '成約' },
  ];

  return labels.map((step, idx) => {
    if (isLost) {
      return {
        ...step,
        state: idx === 0 ? 'lost' : 'upcoming',
      };
    }
    if (idx < currentIdx) {
      return { ...step, state: 'done' };
    }
    if (idx === currentIdx) {
      return {
        ...step,
        state: isPaused ? 'paused' : currentIdx === 4 ? 'done' : 'current',
      };
    }
    return { ...step, state: 'upcoming' };
  });
}

/**
 * リード1行の中で「今どの工程にいるか」を可視化するための5段階ステップ計算。
 */
export function getLeadFlowSteps(status?: string | null): PipelineFlowStep[] {
  const s = String(status || '').trim();
  const isLost = ['失注・対象外', '失注', '見送り'].includes(s);
  const isPaused = s === '再調整待ち';

  let currentIdx = 0;
  if (['成約', '受注'].includes(s)) currentIdx = 4;
  else if (s === '商談化') currentIdx = 3;
  else if (s === '面談実施済' || s === 'ヒアリング済') currentIdx = 2;
  else if (s === '面談予約済' || s === '再調整待ち') currentIdx = 1;
  else currentIdx = 0; // 新規・資料請求・診断申込・相談申込

  const labels = [
    { key: 'inquiry', label: '反響' },
    { key: 'booked', label: '予約' },
    { key: 'interviewed', label: '面談' },
    { key: 'deal', label: '商談化' },
    { key: 'won', label: '成約' },
  ];

  return labels.map((step, idx) => {
    if (isLost) {
      return {
        ...step,
        state: idx === 0 ? 'lost' : 'upcoming',
      };
    }
    if (idx < currentIdx) {
      return { ...step, state: 'done' };
    }
    if (idx === currentIdx) {
      return {
        ...step,
        state: isPaused ? 'paused' : currentIdx === 4 ? 'done' : 'current',
      };
    }
    return { ...step, state: 'upcoming' };
  });
}
