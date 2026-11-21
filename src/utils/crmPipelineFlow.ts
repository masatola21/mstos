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

const GENERIC_DOCUMENT_TITLES = new Set([
  '業務委託基本契約書',
  '経営・業務顧問 委託契約書',
  '御見積書',
  '御 見 積 書',
  '御請求書',
  '御 請 求 書',
  '経営・業務改善 ご提案書',
  '月次業務改善・伴走支援レポート',
  'Web申込プラン',
]);

export function isGenericDocumentTitle(title?: string | null): boolean {
  const s = String(title || '').replace(/\s+/g, ' ').trim();
  if (!s) return true;
  if (GENERIC_DOCUMENT_TITLES.has(s)) return true;
  return /^(業務委託基本契約書|御\s*見\s*積\s*書|御\s*請\s*求\s*書|経営・業務改善\s*ご提案書)$/.test(s);
}

/**
 * 書類のWeb申込時に商談へ設定する「提案プラン名・商談名」を解決する。
 * 既に適切なプラン名がある場合や、書類本文から案件名・委託業務名を抽出できる場合はそれを使い、
 * 「業務委託基本契約書」「御見積書」などの書類タイトルそのものは使わない。
 */
export function resolveWebApplyDealPlanName(params: {
  existingPlanName?: string | null;
  docTitle?: string | null;
  bodyHtml?: string | null;
  companyName?: string | null;
}): string {
  const existing = String(params.existingPlanName || '').trim();
  if (existing && !isGenericDocumentTitle(existing)) {
    return existing;
  }

  const htmlText = String(params.bodyHtml || '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r/g, '');

  const extractPatterns = [
    /案件名\s*[:：]\s*([^\n]+)/,
    /案件・プラン名\s*[:：]\s*([^\n]+)/,
    /件名\s*[:：]\s*([^\n]+)/,
    /委託業務名\s*[:：]\s*([^\n]+)/,
    /サービス名\s*\n+\s*([^\n]+)/,
    /第1条（業務内容）\s*\n+\s*([^\n]+)/,
  ];

  for (const re of extractPatterns) {
    const m = re.exec(htmlText);
    const candidate = String(m?.[1] || '')
      .replace(/に関する業務支援および仕組み化伴走$/, '')
      .replace(/【未入力】/g, '')
      .trim();
    if (candidate && candidate.length >= 2 && candidate.length <= 80 && !isGenericDocumentTitle(candidate)) {
      return candidate;
    }
  }

  const rawDocTitle = String(params.docTitle || '').trim();
  const parenMatch = /[（(]([^（）()]{2,60})[）)]\s*$/.exec(rawDocTitle);
  if (parenMatch?.[1] && !isGenericDocumentTitle(parenMatch[1]) && !/契約|合意|控|INV-/.test(parenMatch[1])) {
    return parenMatch[1].trim();
  }
  if (rawDocTitle && !isGenericDocumentTitle(rawDocTitle)) {
    const cleaned = rawDocTitle
      .replace(/^.+?\s*·\s*/, '')
      .replace(/（[^）]*）$/, '')
      .trim();
    if (cleaned && !isGenericDocumentTitle(cleaned)) {
      return cleaned;
    }
  }

  const comp = String(params.companyName || '').trim();
  if (comp && comp !== '顧客企業' && comp !== 'Web申込顧客') {
    return `${comp} 業務改善支援プラン`;
  }
  return 'Web申込 業務改善支援プラン';
}

export interface DuplicateCrmConsolidationPlan {
  companyId: string;
  canonical: any;
  duplicates: any[];
  dupIds: string[];
  mergedPatch: Record<string, any>;
}

const LEAD_FILL_FIELDS = [
  'contact_id',
  'line_user_id',
  'interested_product_id',
  'service_type',
  'inquiry_type',
  'meeting_date',
  'meeting_start_time',
  'priority_channel',
  'source',
  'first_registered_at',
  'last_contacted_at',
  'next_action_at',
  'report_url',
] as const;

const DEAL_FILL_FIELDS = [
  'lead_id',
  'contact_id',
  'product_id',
  'proposal_plan_template_id',
  'proposal_plan_name',
  'proposal_type',
  'deal_name',
  'initial_fee',
  'monthly_fee',
  'total_amount',
  'amount',
  'proposal_date',
  'meeting_date',
  'meeting_start_time',
  'next_followup_at',
  'won_automation_completed_at',
] as const;

function isEmptyCrmField(val: unknown): boolean {
  return val === null || val === undefined || val === '';
}

export function sortCrmRowsForCanonical(tableKey: 'leads' | 'deals', rows: any[]): any[] {
  return [...(rows || [])].sort((a, b) => {
    if (tableKey === 'deals') {
      const rankDiff = getDealStatusRank(b?.proposal_status) - getDealStatusRank(a?.proposal_status);
      if (rankDiff !== 0) return rankDiff;
      const wonDiff = (b?.won_automation_completed_at ? 1 : 0) - (a?.won_automation_completed_at ? 1 : 0);
      if (wonDiff !== 0) return wonDiff;
    } else {
      const rankDiff = getLeadStatusRank(b?.status) - getLeadStatusRank(a?.status);
      if (rankDiff !== 0) return rankDiff;
    }
    const updatedDiff =
      new Date(b?.updated_at || b?.created_at || 0).getTime() -
      new Date(a?.updated_at || a?.created_at || 0).getTime();
    if (updatedDiff !== 0) return updatedDiff;
    const createdDiff =
      new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
    if (createdDiff !== 0) return createdDiff;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

export function buildConsolidatedCrmPatch(
  tableKey: 'leads' | 'deals',
  canonical: any,
  duplicates: any[]
): Record<string, any> {
  const allRows = [canonical, ...(duplicates || [])];
  const hasColumn = (key: string) => allRows.some((row) => row && Object.prototype.hasOwnProperty.call(row, key));

  if (tableKey === 'leads') {
    let mergedStatus = canonical?.status || '新規';
    let mergedNotes = canonical?.notes || '';
    const mergedPatch: Record<string, any> = {};
    for (const key of LEAD_FILL_FIELDS) {
      if (hasColumn(key)) {
        mergedPatch[key] = canonical?.[key] ?? null;
      }
    }

    for (const dup of duplicates || []) {
      mergedStatus = resolveNonDowngradingLeadStatus(mergedStatus, dup?.status);
      mergedNotes = appendUniqueNote(mergedNotes, dup?.notes);
      for (const key of Object.keys(mergedPatch)) {
        if (isEmptyCrmField(mergedPatch[key]) && !isEmptyCrmField(dup?.[key])) {
          mergedPatch[key] = dup[key];
        }
      }
    }
    mergedPatch.status = mergedStatus;
    mergedPatch.notes = mergedNotes || null;
    return mergedPatch;
  }

  let mergedStatus = canonical?.proposal_status || '日程確定';
  let mergedMemo = canonical?.memo || '';
  const mergedPatch: Record<string, any> = {};
  for (const key of DEAL_FILL_FIELDS) {
    if (hasColumn(key)) {
      mergedPatch[key] = canonical?.[key] ?? null;
    }
  }

  for (const dup of duplicates || []) {
    mergedStatus = resolveNonDowngradingDealStatus(mergedStatus, dup?.proposal_status);
    mergedMemo = appendUniqueNote(mergedMemo, dup?.memo);
    for (const key of Object.keys(mergedPatch)) {
      if (isEmptyCrmField(mergedPatch[key]) && !isEmptyCrmField(dup?.[key])) {
        mergedPatch[key] = dup[key];
      }
    }
  }
  mergedPatch.proposal_status = mergedStatus;
  mergedPatch.memo = mergedMemo || null;
  return mergedPatch;
}

export function planDuplicateCrmConsolidations(
  tableKey: 'leads' | 'deals',
  rows: any[]
): DuplicateCrmConsolidationPlan[] {
  const byCompany = new Map<string, any[]>();
  for (const row of rows || []) {
    const cid = String(row?.company_id || '').trim();
    if (!cid) continue;
    const list = byCompany.get(cid) || [];
    list.push(row);
    byCompany.set(cid, list);
  }

  const plans: DuplicateCrmConsolidationPlan[] = [];
  for (const [companyId, group] of byCompany.entries()) {
    if (group.length <= 1) continue;
    const sorted = sortCrmRowsForCanonical(tableKey, group);
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);
    const dupIds = duplicates.map((d) => String(d.id)).filter(Boolean);
    if (!canonical?.id || dupIds.length === 0) continue;
    plans.push({
      companyId,
      canonical,
      duplicates,
      dupIds,
      mergedPatch: buildConsolidatedCrmPatch(tableKey, canonical, duplicates),
    });
  }
  return plans;
}

