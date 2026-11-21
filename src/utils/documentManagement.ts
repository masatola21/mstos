export interface DocumentCompanyRef {
  id: string;
  company_name?: string | null;
}

export interface DocumentContactRef {
  id: string;
  full_name?: string | null;
  company_id?: string | null;
  email?: string | null;
  line_user_id?: string | null;
}

export interface DocumentOutboxLog {
  id: string;
  document_id?: string | null;
  channel?: 'email' | 'line' | string | null;
  status?: string | null;
  recipient_address?: string | null;
  subject?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
  error_message?: string | null;
}

export interface DocumentRecordLike {
  id: string;
  title?: string | null;
  document_type?: string | null;
  status?: string | null;
  body_html?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  lead_id?: string | null;
  deal_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type EffectiveDocumentType =
  | 'proposal'
  | 'estimate'
  | 'contract'
  | 'invoice'
  | 'monthly_report'
  | 'diagnosis_report'
  | 'other';

export type DocumentStatusFilter = 'all' | 'draft' | 'approved' | 'sent' | 'archived';

export const DOCUMENT_TYPE_LABELS: Record<EffectiveDocumentType, string> = {
  proposal: '提案書（診断＋提案）',
  estimate: '見積書',
  contract: '契約書',
  invoice: '請求書',
  monthly_report: '月次報告書',
  diagnosis_report: '診断レポート',
  other: 'その他書類',
};

export function resolveEffectiveDocumentType(doc: Pick<DocumentRecordLike, 'document_type' | 'title'>): EffectiveDocumentType {
  const rawType = String(doc.document_type || '').trim();
  const titleText = String(doc.title || '');
  if ((rawType === 'proposal' || rawType === 'other') && /見積/.test(titleText)) {
    return 'estimate';
  }
  if (
    (rawType === 'diagnosis_report' || rawType === 'report' || rawType === 'proposal' || rawType === 'other') &&
    /(月次|月報)/.test(titleText)
  ) {
    return 'monthly_report';
  }
  if (rawType === 'report' || rawType === 'diagnosis_report') {
    return 'diagnosis_report';
  }
  if (rawType === 'proposal' || rawType === 'estimate' || rawType === 'contract' || rawType === 'invoice' || rawType === 'monthly_report') {
    return rawType;
  }
  return 'other';
}

export function normalizeDocumentStatus(status?: string | null): 'draft' | 'approved' | 'sent' | 'archived' {
  const s = String(status || '').trim();
  if (s === 'sent') return 'sent';
  if (s === 'approved' || s === 'queued') return 'approved';
  if (s === 'archived') return 'archived';
  return 'draft';
}

export function getDocumentStatusLabel(status?: string | null): string {
  switch (normalizeDocumentStatus(status)) {
    case 'sent':
      return '送信済み';
    case 'approved':
      return '確定（送付可能）';
    case 'archived':
      return '保管';
    default:
      return '作成中（下書き）';
  }
}

export function resolveDocumentContactName(
  doc: Pick<DocumentRecordLike, 'contact_id' | 'company_id'>,
  contacts: DocumentContactRef[],
): string {
  if (doc.contact_id) {
    const exact = contacts.find((c) => c.id === doc.contact_id);
    if (exact?.full_name) return exact.full_name;
  }
  if (doc.company_id) {
    const companyContacts = contacts.filter((c) => c.company_id === doc.company_id && c.full_name);
    if (companyContacts.length === 1) return String(companyContacts[0].full_name);
    if (companyContacts.length > 1) return String(companyContacts[0].full_name);
  }
  return '';
}

export function filterDocuments<T extends DocumentRecordLike>(
  docs: T[],
  companies: DocumentCompanyRef[],
  contacts: DocumentContactRef[],
  options: {
    query?: string;
    statusFilter?: DocumentStatusFilter;
    typeFilter?: 'all' | EffectiveDocumentType;
  },
): T[] {
  const normalizedQuery = String(options.query || '').trim().toLowerCase();
  const statusFilter = options.statusFilter || 'all';
  const typeFilter = options.typeFilter || 'all';

  return docs.filter((doc) => {
    if (statusFilter !== 'all' && normalizeDocumentStatus(doc.status) !== statusFilter) {
      return false;
    }
    const effectiveType = resolveEffectiveDocumentType(doc);
    if (typeFilter !== 'all' && effectiveType !== typeFilter) {
      return false;
    }
    if (!normalizedQuery) return true;

    const companyName = doc.company_id
      ? companies.find((c) => c.id === doc.company_id)?.company_name || ''
      : '';
    const companyContacts = doc.company_id
      ? contacts.filter((c) => c.company_id === doc.company_id).map((c) => c.full_name || '').join(' ')
      : '';
    const directContactName = doc.contact_id
      ? contacts.find((c) => c.id === doc.contact_id)?.full_name || ''
      : '';
    const haystack = [
      doc.title || '',
      companyName,
      directContactName,
      companyContacts,
      DOCUMENT_TYPE_LABELS[effectiveType] || '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export interface CustomerDocumentGroup<T extends DocumentRecordLike = DocumentRecordLike> {
  groupKey: string;
  companyId: string | null;
  companyName: string;
  contactNames: string[];
  documents: T[];
  counts: {
    total: number;
    draft: number;
    approved: number;
    sent: number;
    archived: number;
  };
  latestTimestamp: number;
}

export function groupDocumentsByCustomer<T extends DocumentRecordLike>(
  docs: T[],
  companies: DocumentCompanyRef[],
  contacts: DocumentContactRef[],
): CustomerDocumentGroup<T>[] {
  const map = new Map<string, CustomerDocumentGroup<T>>();

  for (const doc of docs) {
    const companyId = doc.company_id || null;
    const groupKey = companyId ? `company:${companyId}` : 'unassigned';
    const companyName = companyId
      ? companies.find((c) => c.id === companyId)?.company_name || `会社ID: ${companyId}`
      : '会社未紐付け';

    let group = map.get(groupKey);
    if (!group) {
      const linkedContacts = companyId
        ? contacts.filter((c) => c.company_id === companyId && c.full_name).map((c) => String(c.full_name))
        : [];
      group = {
        groupKey,
        companyId,
        companyName,
        contactNames: Array.from(new Set(linkedContacts)),
        documents: [],
        counts: { total: 0, draft: 0, approved: 0, sent: 0, archived: 0 },
        latestTimestamp: 0,
      };
      map.set(groupKey, group);
    }

    if (doc.contact_id) {
      const directContact = contacts.find((c) => c.id === doc.contact_id)?.full_name;
      if (directContact && !group.contactNames.includes(directContact)) {
        group.contactNames.push(directContact);
      }
    }

    group.documents.push(doc);
    group.counts.total += 1;
    const normStatus = normalizeDocumentStatus(doc.status);
    group.counts[normStatus] += 1;

    const ts = Date.parse(doc.updated_at || doc.created_at || '') || 0;
    if (ts > group.latestTimestamp) {
      group.latestTimestamp = ts;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (!a.companyId && b.companyId) return 1;
    if (a.companyId && !b.companyId) return -1;
    return b.latestTimestamp - a.latestTimestamp;
  });
}

export interface DocumentOutboxSummary {
  totalLogs: number;
  sentCount: number;
  failedCount: number;
  emailSentCount: number;
  lineSentCount: number;
  lastSentAt: string | null;
  logs: DocumentOutboxLog[];
}

export function summarizeOutboxByDocument(logs: DocumentOutboxLog[]): Record<string, DocumentOutboxSummary> {
  const result: Record<string, DocumentOutboxSummary> = {};
  for (const log of logs) {
    const docId = log.document_id;
    if (!docId) continue;
    if (!result[docId]) {
      result[docId] = {
        totalLogs: 0,
        sentCount: 0,
        failedCount: 0,
        emailSentCount: 0,
        lineSentCount: 0,
        lastSentAt: null,
        logs: [],
      };
    }
    const bucket = result[docId];
    bucket.totalLogs += 1;
    bucket.logs.push(log);

    const status = String(log.status || '').toLowerCase();
    const channel = String(log.channel || '').toLowerCase();
    if (status === 'sent') {
      bucket.sentCount += 1;
      if (channel === 'email') bucket.emailSentCount += 1;
      if (channel === 'line') bucket.lineSentCount += 1;
      const ts = log.sent_at || log.created_at || null;
      if (ts && (!bucket.lastSentAt || ts > bucket.lastSentAt)) {
        bucket.lastSentAt = ts;
      }
    } else if (status === 'failed') {
      bucket.failedCount += 1;
    }
  }
  return result;
}
