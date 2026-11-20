export interface EntityFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface EntityFilterItem {
  companyName?: string | null;
  personName?: string | null;
}

const PLACEHOLDER_COMPANY_NAMES = new Set([
  '未設定',
  '-',
  '―',
  'ー',
  'なし',
  '個人',
  '個人事業主',
  'フリーランス',
]);

const PLACEHOLDER_PERSON_NAMES = new Set([
  '連絡先不明',
  '回答者未特定',
  '名前未設定',
  '未設定',
  '-',
]);

function cleanLabel(value?: string | null): string {
  return String(value || '').trim();
}

function resolveEntityPair(companyName?: string | null, personName?: string | null): {
  company: string;
  person: string;
  companyKey: string;
  personKey: string;
} {
  let company = cleanLabel(companyName);
  let person = cleanLabel(personName);

  if (company && PLACEHOLDER_COMPANY_NAMES.has(company)) {
    company = '';
  }
  if (person && PLACEHOLDER_PERSON_NAMES.has(person)) {
    person = '';
  }

  let companyKey = company.toLowerCase();
  const personKey = person.toLowerCase();

  // 個人事業主などで屋号欄に個人名がそのまま入っている場合は重複表示しない
  if (companyKey && personKey && companyKey === personKey) {
    company = '';
    companyKey = '';
  }

  return { company, person, companyKey, personKey };
}

export function buildEntityFilterOptions(items: EntityFilterItem[]): EntityFilterOption[] {
  const optionMap = new Map<string, { label: string; count: number }>();

  for (const item of items) {
    const { company, person, companyKey, personKey } = resolveEntityPair(item.companyName, item.personName);
    if (!companyKey && !personKey) continue;

    const value = `pair:${encodeURIComponent(companyKey)}|${encodeURIComponent(personKey)}`;
    const label =
      company && person
        ? `${company} / ${person}`
        : company
          ? company
          : `${person}（個人）`;

    const existing = optionMap.get(value);
    if (existing) {
      existing.count += 1;
    } else {
      optionMap.set(value, { label, count: 1 });
    }
  }

  return Array.from(optionMap.entries())
    .map(([value, entry]) => ({
      value,
      label: entry.label,
      count: entry.count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}

export function matchesEntityFilter(
  filterValue: string,
  companyName?: string | null,
  personName?: string | null,
): boolean {
  if (!filterValue || filterValue === 'all') return true;

  const { companyKey, personKey } = resolveEntityPair(companyName, personName);

  if (filterValue.startsWith('pair:')) {
    const raw = filterValue.slice('pair:'.length);
    const sepIndex = raw.indexOf('|');
    if (sepIndex === -1) return true;
    const targetCompany = decodeURIComponent(raw.slice(0, sepIndex));
    const targetPerson = decodeURIComponent(raw.slice(sepIndex + 1));
    return companyKey === targetCompany && personKey === targetPerson;
  }

  if (filterValue.startsWith('company:')) {
    return companyKey === filterValue.slice('company:'.length).toLowerCase();
  }
  if (filterValue.startsWith('person:')) {
    return personKey === filterValue.slice('person:'.length).toLowerCase();
  }
  return true;
}
