export type OpsRecordType = 'contracts' | 'invoices' | 'services';

export interface OpsDuplicateGroup<T extends Record<string, any> = Record<string, any>> {
  key: string;
  companyId: string;
  keeper: T;
  duplicates: T[];
  all: T[];
}

const CONTRACT_STATUS_RANK: Record<string, number> = {
  canceled: 1,
  expired: 2,
  draft: 10,
  under_review: 20,
  sent: 30,
  signed: 90,
  active: 95,
  effective: 95,
  in_force: 95,
};

const INVOICE_STATUS_RANK: Record<string, number> = {
  canceled: 1,
  draft: 10,
  awaiting_approval: 20,
  issued: 30,
  overdue: 35,
  paid: 90,
};

const ENGAGEMENT_STATUS_RANK: Record<string, number> = {
  paused: 5,
  planned: 10,
  active: 50,
  completed: 90,
};

function statusRank(type: OpsRecordType, row: Record<string, any>): number {
  const s = String(row.status || '').toLowerCase();
  if (type === 'contracts') return CONTRACT_STATUS_RANK[s] ?? 0;
  if (type === 'invoices') return INVOICE_STATUS_RANK[s] ?? 0;
  return ENGAGEMENT_STATUS_RANK[s] ?? 0;
}

function completenessScore(type: OpsRecordType, row: Record<string, any>): number {
  let score = 0;
  if (row.document_id) score += 4;
  if (row.deal_id) score += 3;
  if (row.contract_id) score += 3;
  if (row.product_id) score += 1;
  if (Number(row.amount || 0) > 0) score += 2;
  if (type === 'services') {
    const msCount = Array.isArray(row.milestone_data) ? row.milestone_data.length : 0;
    if (msCount > 0) score += 2;
    if (row.support_details && typeof row.support_details === 'object') score += 2;
  }
  return score;
}

function compareKeeper(type: OpsRecordType, a: Record<string, any>, b: Record<string, any>): number {
  const rankDiff = statusRank(type, b) - statusRank(type, a);
  if (rankDiff !== 0) return rankDiff;
  const compDiff = completenessScore(type, b) - completenessScore(type, a);
  if (compDiff !== 0) return compDiff;
  const aTime = Date.parse(String(a.created_at || '')) || 0;
  const bTime = Date.parse(String(b.created_at || '')) || 0;
  if (aTime !== bTime) return aTime - bTime; // oldest first
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function extractDealIdFromNotes(notes?: string | null): string {
  const m = /商談ID[:：]\s*([A-Za-z0-9_-]+)/.exec(String(notes || ''));
  return m?.[1] || '';
}

function normalizeTitle(title?: string | null): string {
  return String(title || '')
    .replace(/（(?:電子合意|申込控)）/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeRecordsById<T extends Record<string, any>>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = String(row?.id || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(row);
  }
  return out;
}

/**
 * 同じ会社・同じ商談/契約/内容で重複して立ち上がったレコードを検出し、
 * 最も進捗が進んだレコードを keeper としてグループ化する。
 */
export function findOpsDuplicateGroups<T extends Record<string, any>>(
  type: OpsRecordType,
  rows: T[],
): OpsDuplicateGroup<T>[] {
  const uniqueRows = dedupeRecordsById(rows);
  const buckets = new Map<string, T[]>();

  for (const row of uniqueRows) {
    const companyId = String(row.company_id || '').trim();
    if (!companyId) continue;

    let groupKey = '';
    if (type === 'contracts') {
      const dealId = String(row.deal_id || extractDealIdFromNotes(row.notes) || '').trim();
      const docId = String(row.document_id || '').trim();
      const titleKey = normalizeTitle(row.title);
      if (dealId) groupKey = `c:${companyId}:deal:${dealId}`;
      else if (docId) groupKey = `c:${companyId}:doc:${docId}`;
      else if (titleKey) groupKey = `c:${companyId}:title:${titleKey}:${Number(row.amount || 0)}`;
    } else if (type === 'invoices') {
      const contractId = String(row.contract_id || '').trim();
      const dealId = String(row.deal_id || row.payload?.deal_id || extractDealIdFromNotes(row.notes) || '').trim();
      const titleKey = normalizeTitle(row.title);
      const amount = Number(row.amount || 0);
      const isInitialOrAuto =
        row.payload?.billing_type === 'initial' ||
        /初回|成約|Web申込/.test(`${titleKey} ${String(row.notes || '')}`);
      if (isInitialOrAuto && (contractId || dealId)) {
        groupKey = `i:${companyId}:init:${contractId || dealId}:${amount}`;
      } else if (titleKey && row.issue_date) {
        groupKey = `i:${companyId}:title:${titleKey}:${amount}:${String(row.issue_date).slice(0, 10)}`;
      }
    } else {
      const contractId = String(row.contract_id || '').trim();
      const dealId = extractDealIdFromNotes(row.notes);
      const titleKey = normalizeTitle(row.title);
      if (dealId) groupKey = `s:${companyId}:deal:${dealId}`;
      else if (contractId) groupKey = `s:${companyId}:contract:${contractId}`;
      else if (titleKey) groupKey = `s:${companyId}:title:${titleKey}`;
    }

    if (!groupKey) continue;
    const list = buckets.get(groupKey);
    if (list) list.push(row);
    else buckets.set(groupKey, [row]);
  }

  const groups: OpsDuplicateGroup<T>[] = [];
  for (const [key, list] of buckets.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => compareKeeper(type, a, b));
    groups.push({
      key,
      companyId: String(sorted[0].company_id),
      keeper: sorted[0],
      duplicates: sorted.slice(1),
      all: sorted,
    });
  }
  return groups;
}

export type SlimContractStatus = 'draft' | 'signed' | 'canceled';
export type SlimInvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'canceled';

/**
 * 契約ステータスをUI上のスリムな3状態へ正規化する（旧 under_review / sent は未締結、expired は終了・解約へ集約）
 */
export function normalizeContractUiStatus(status?: string | null): SlimContractStatus {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'signed' || s === 'active' || s === 'effective' || s === 'in_force') return 'signed';
  if (s === 'canceled' || s === 'expired') return 'canceled';
  return 'draft';
}

/**
 * 請求ステータスをUI上のスリムな状態へ正規化する（旧 awaiting_approval は未発行へ集約）
 */
export function normalizeInvoiceUiStatus(status?: string | null): SlimInvoiceStatus {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'paid') return 'paid';
  if (s === 'overdue') return 'overdue';
  if (s === 'issued') return 'issued';
  if (s === 'canceled') return 'canceled';
  return 'draft';
}

