export type ListFilterKind = 'batch' | 'segment' | 'tag';

export interface ListFilterOption {
  key: string;
  kind: ListFilterKind;
  id: string;
  label: string;
  groupLabel: string;
  matchCount: number;
}

export interface ListMatchSet {
  key: string;
  kind: ListFilterKind;
  id: string;
  label: string;
  contactIds: Set<string>;
  companyIds: Set<string>;
  emails: Set<string>;
  lineUserIds: Set<string>;
}

export interface ListFilterCatalog {
  options: ListFilterOption[];
  matchSets: Record<string, ListMatchSet>;
}

export interface ListFilterTarget {
  contactId?: string | null;
  companyId?: string | null;
  email?: string | null;
  lineUserId?: string | null;
}

export interface ListFilterSourceRecords {
  batches?: Array<Record<string, any>>;
  segments?: Array<Record<string, any>>;
  tags?: Array<Record<string, any>>;
  friendTags?: Array<Record<string, any>>;
  friends?: Array<Record<string, any>>;
  prospects?: Array<Record<string, any>>;
  contacts?: Array<Record<string, any>>;
  companies?: Array<Record<string, any>>;
  leads?: Array<Record<string, any>>;
  deals?: Array<Record<string, any>>;
  customers?: Array<Record<string, any>>;
}

export const EMPTY_LIST_FILTER_CATALOG: ListFilterCatalog = {
  options: [],
  matchSets: {},
};

export function normalizeFilterEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

function addContactToMatchSet(matchSet: ListMatchSet, contact: Record<string, any>) {
  if (contact.id) matchSet.contactIds.add(String(contact.id));
  if (contact.company_id) matchSet.companyIds.add(String(contact.company_id));
  const cleanEmail = normalizeFilterEmail(contact.email);
  if (cleanEmail) matchSet.emails.add(cleanEmail);
  if (contact.line_user_id) matchSet.lineUserIds.add(String(contact.line_user_id));
}

export function buildListFilterCatalogFromRecords(records: ListFilterSourceRecords): ListFilterCatalog {
  const batches = records.batches || [];
  const segments = records.segments || [];
  const tags = records.tags || [];
  const friendTags = records.friendTags || [];
  const friends = records.friends || [];
  const prospects = records.prospects || [];
  const contacts = records.contacts || [];
  const companies = records.companies || [];
  const leads = records.leads || [];
  const deals: Array<Record<string, any>> = (records.deals || []).map((row) => ({
    ...row,
    status: row.status || row.proposal_status,
  }));
  const customers: Array<Record<string, any>> = (records.customers || []).map((row) => ({
    ...row,
    status: row.status || row.contract_status,
  }));

  const contactById = new Map<string, Record<string, any>>();
  const contactsByCompanyId = new Map<string, Array<Record<string, any>>>();
  const contactsByEmail = new Map<string, Array<Record<string, any>>>();
  const contactsByLineId = new Map<string, Array<Record<string, any>>>();

  for (const contact of contacts) {
    if (contact.id) contactById.set(String(contact.id), contact);
    if (contact.company_id) {
      const compId = String(contact.company_id);
      const list = contactsByCompanyId.get(compId) || [];
      list.push(contact);
      contactsByCompanyId.set(compId, list);
    }
    const email = normalizeFilterEmail(contact.email);
    if (email) {
      const list = contactsByEmail.get(email) || [];
      list.push(contact);
      contactsByEmail.set(email, list);
    }
    if (contact.line_user_id) {
      const lineId = String(contact.line_user_id);
      const list = contactsByLineId.get(lineId) || [];
      list.push(contact);
      contactsByLineId.set(lineId, list);
    }
  }

  const options: ListFilterOption[] = [];
  const matchSets: Record<string, ListMatchSet> = {};

  // 1. 取込バッチ（AI企業リスト等）
  for (const batch of batches) {
    const id = String(batch.id || '');
    if (!id) continue;
    const label = String(batch.batch_name || '名称未設定バッチ');
    const key = `batch:${id}`;
    const matchSet: ListMatchSet = {
      key,
      kind: 'batch',
      id,
      label,
      contactIds: new Set(),
      companyIds: new Set(),
      emails: new Set(),
      lineUserIds: new Set(),
    };

    const batchProspects = prospects.filter(
      (row) => String(row.import_batch_id || '') === id && row.opted_out !== true,
    );
    for (const p of batchProspects) {
      if (p.company_id) {
        const compId = String(p.company_id);
        matchSet.companyIds.add(compId);
        for (const c of contactsByCompanyId.get(compId) || []) {
          addContactToMatchSet(matchSet, c);
        }
      }
      const pEmail = normalizeFilterEmail(p.email);
      if (pEmail) {
        matchSet.emails.add(pEmail);
        for (const c of contactsByEmail.get(pEmail) || []) {
          addContactToMatchSet(matchSet, c);
        }
      }
    }

    matchSets[key] = matchSet;
    options.push({
      key,
      kind: 'batch',
      id,
      label,
      groupLabel: '取込バッチ（見込み企業リスト）',
      matchCount: Math.max(batchProspects.length, matchSet.contactIds.size),
    });
  }

  // 2. CRMセグメント
  for (const segment of segments) {
    const id = String(segment.id || '');
    const field = typeof segment.conditions?.field === 'string' ? segment.conditions.field.trim() : '';
    if (!id || !field) continue;
    const value = String(segment.conditions?.value || '').trim().toLowerCase();
    const label = String(segment.name || '名称未設定セグメント');
    const key = `segment:${id}`;
    const matchSet: ListMatchSet = {
      key,
      kind: 'segment',
      id,
      label,
      contactIds: new Set(),
      companyIds: new Set(),
      emails: new Set(),
      lineUserIds: new Set(),
    };

    const matchesCondition = (row: Record<string, any>) =>
      String(row[field] ?? '').toLowerCase().includes(value);

    const entityType = String(segment.entity_type || '');
    if (entityType === 'contacts') {
      for (const c of contacts) {
        if (matchesCondition(c)) addContactToMatchSet(matchSet, c);
      }
    } else if (entityType === 'companies') {
      for (const comp of companies) {
        if (matchesCondition(comp) && comp.id) {
          const compId = String(comp.id);
          matchSet.companyIds.add(compId);
          for (const c of contactsByCompanyId.get(compId) || []) {
            addContactToMatchSet(matchSet, c);
          }
        }
      }
    } else if (entityType === 'prospects') {
      for (const p of prospects) {
        if (!matchesCondition(p)) continue;
        if (p.company_id) {
          const compId = String(p.company_id);
          matchSet.companyIds.add(compId);
          for (const c of contactsByCompanyId.get(compId) || []) {
            addContactToMatchSet(matchSet, c);
          }
        }
        const pEmail = normalizeFilterEmail(p.email);
        if (pEmail) {
          matchSet.emails.add(pEmail);
          for (const c of contactsByEmail.get(pEmail) || []) {
            addContactToMatchSet(matchSet, c);
          }
        }
      }
    } else if (entityType === 'customers') {
      for (const cust of customers) {
        if (matchesCondition(cust) && cust.company_id) {
          const compId = String(cust.company_id);
          matchSet.companyIds.add(compId);
          for (const c of contactsByCompanyId.get(compId) || []) {
            addContactToMatchSet(matchSet, c);
          }
        }
      }
    } else if (entityType === 'leads') {
      for (const lead of leads) {
        if (!matchesCondition(lead)) continue;
        if (lead.contact_id) {
          const cid = String(lead.contact_id);
          matchSet.contactIds.add(cid);
          const c = contactById.get(cid);
          if (c) addContactToMatchSet(matchSet, c);
        }
        if (lead.company_id) {
          matchSet.companyIds.add(String(lead.company_id));
        }
        const leadEmail = normalizeFilterEmail(lead.email);
        if (leadEmail) matchSet.emails.add(leadEmail);
      }
    } else if (entityType === 'deals') {
      const leadIds = new Set<string>();
      for (const deal of deals) {
        if (matchesCondition(deal) && deal.lead_id) {
          leadIds.add(String(deal.lead_id));
        }
      }
      for (const lead of leads) {
        if (!lead.id || !leadIds.has(String(lead.id))) continue;
        if (lead.contact_id) {
          const cid = String(lead.contact_id);
          matchSet.contactIds.add(cid);
          const c = contactById.get(cid);
          if (c) addContactToMatchSet(matchSet, c);
        }
        if (lead.company_id) {
          matchSet.companyIds.add(String(lead.company_id));
        }
      }
    }

    matchSets[key] = matchSet;
    options.push({
      key,
      kind: 'segment',
      id,
      label,
      groupLabel: 'CRMセグメント',
      matchCount: Math.max(matchSet.contactIds.size, matchSet.companyIds.size),
    });
  }

  // 3. タグ（LINE友だちタグ）
  const friendsById = new Map<string, Record<string, any>>();
  for (const friend of friends) {
    if (friend.id) friendsById.set(String(friend.id), friend);
  }
  const friendIdsByTagId = new Map<string, string[]>();
  for (const ft of friendTags) {
    if (!ft.tag_id || !ft.line_friend_id) continue;
    const tagId = String(ft.tag_id);
    const arr = friendIdsByTagId.get(tagId) || [];
    arr.push(String(ft.line_friend_id));
    friendIdsByTagId.set(tagId, arr);
  }

  for (const tag of tags) {
    const id = String(tag.id || '');
    if (!id) continue;
    const label = String(tag.name || '名称未設定タグ');
    const key = `tag:${id}`;
    const matchSet: ListMatchSet = {
      key,
      kind: 'tag',
      id,
      label,
      contactIds: new Set(),
      companyIds: new Set(),
      emails: new Set(),
      lineUserIds: new Set(),
    };

    const friendIds = friendIdsByTagId.get(id) || [];
    for (const fid of friendIds) {
      const friend = friendsById.get(fid);
      if (!friend) continue;
      if (friend.line_user_id) {
        const lineId = String(friend.line_user_id);
        matchSet.lineUserIds.add(lineId);
        for (const c of contactsByLineId.get(lineId) || []) {
          addContactToMatchSet(matchSet, c);
        }
      }
      if (friend.contact_id) {
        const cid = String(friend.contact_id);
        matchSet.contactIds.add(cid);
        const c = contactById.get(cid);
        if (c) addContactToMatchSet(matchSet, c);
      }
    }

    matchSets[key] = matchSet;
    options.push({
      key,
      kind: 'tag',
      id,
      label,
      groupLabel: 'LINE・連絡先タグ',
      matchCount: Math.max(matchSet.contactIds.size, matchSet.lineUserIds.size),
    });
  }

  return { options, matchSets };
}

export function matchesListFilter(
  catalog: ListFilterCatalog,
  selectedKey: string | null | undefined,
  target: ListFilterTarget,
): boolean {
  if (!selectedKey || selectedKey === 'all') return true;
  const matchSet = catalog.matchSets[selectedKey];
  if (!matchSet) return false;
  if (target.contactId && matchSet.contactIds.has(String(target.contactId))) return true;
  if (target.companyId && matchSet.companyIds.has(String(target.companyId))) return true;
  const cleanEmail = normalizeFilterEmail(target.email);
  if (cleanEmail && matchSet.emails.has(cleanEmail)) return true;
  if (target.lineUserId && matchSet.lineUserIds.has(String(target.lineUserId))) return true;
  return false;
}

export function groupListFilterOptions(catalog: ListFilterCatalog): {
  batches: ListFilterOption[];
  segments: ListFilterOption[];
  tags: ListFilterOption[];
} {
  return {
    batches: catalog.options.filter((o) => o.kind === 'batch'),
    segments: catalog.options.filter((o) => o.kind === 'segment'),
    tags: catalog.options.filter((o) => o.kind === 'tag'),
  };
}

export async function loadListFilterCatalog(db: any): Promise<ListFilterCatalog> {
  if (!db) return EMPTY_LIST_FILTER_CATALOG;
  const safeQuery = async (promise: PromiseLike<any>) => {
    try {
      const res = await promise;
      return res?.error ? [] : (res?.data || []);
    } catch {
      return [];
    }
  };

  const [
    batches,
    segments,
    tags,
    friendTags,
    friends,
    prospects,
    contacts,
    companies,
    leads,
    deals,
    customers,
  ] = await Promise.all([
    safeQuery(db.from('prospect_import_batches').select('id,batch_name,source_ai,imported_count,created_at').order('created_at', { ascending: false }).limit(100)),
    safeQuery(db.from('crm_segments').select('id,name,entity_type,conditions').order('name')),
    safeQuery(db.from('contact_tags').select('id,name').order('name')),
    safeQuery(db.from('line_friend_tags').select('line_friend_id,tag_id').limit(5000)),
    safeQuery(db.from('line_friends').select('id,contact_id,line_user_id').limit(5000)),
    safeQuery(db.from('prospects').select('id,company_id,email,opted_out,import_batch_id,source,status').limit(5000)),
    safeQuery(db.from('contacts').select('id,full_name,email,company_id,line_user_id').limit(5000)),
    safeQuery(db.from('companies').select('id,company_name,industry').limit(2000)),
    safeQuery(db.from('leads').select('id,contact_id,company_id,email,status').limit(2000)),
    safeQuery(db.from('deals').select('id,lead_id,proposal_status').limit(2000)),
    safeQuery(db.from('customers').select('id,company_id,contract_status').limit(2000)),
  ]);

  return buildListFilterCatalogFromRecords({
    batches,
    segments,
    tags,
    friendTags,
    friends,
    prospects,
    contacts,
    companies,
    leads,
    deals,
    customers,
  });
}
