import type { ManagedInvoice } from '../types/matrix';

export interface InvoiceAmountBreakdown {
  subtotal: number;
  taxAmount: number;
  totalWithTax: number;
}

export interface MonthlyRevenueBucket {
  month: string; // YYYY-MM
  label: string; // YYYY年M月
  paidSubtotal: number;
  paidTax: number;
  paidTotal: number;
  paidCount: number;
  paidInvoices: ManagedInvoice[];
  unpaidSubtotal: number;
  unpaidTotal: number;
  unpaidCount: number;
  overdueCount: number;
  unpaidInvoices: ManagedInvoice[];
  momDiffTotal: number | null;
  momDiffPercent: number | null;
}

export function getInvoiceAmounts(inv: Pick<ManagedInvoice, 'amount' | 'taxAmount'>): InvoiceAmountBreakdown {
  const subtotal = Math.max(0, Math.round(Number(inv.amount || 0)));
  const taxAmount =
    inv.taxAmount != null && Number.isFinite(Number(inv.taxAmount))
      ? Math.max(0, Math.round(Number(inv.taxAmount)))
      : Math.floor(subtotal * 0.1);
  return {
    subtotal,
    taxAmount,
    totalWithTax: subtotal + taxAmount,
  };
}

export function getPaidMonthKey(inv: Pick<ManagedInvoice, 'paidDate' | 'issueDate' | 'dueDate'>): string {
  const raw = inv.paidDate || inv.issueDate || inv.dueDate || '';
  return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : '';
}

export function getUnpaidMonthKey(inv: Pick<ManagedInvoice, 'dueDate' | 'issueDate'>): string {
  const raw = inv.dueDate || inv.issueDate || '';
  return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : '';
}

export function formatYearMonthLabel(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return ym;
  return `${match[1]}年${Number(match[2])}月`;
}

export function buildMonthSequence(anchorMonth: string, count: number): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(anchorMonth);
  const now = new Date();
  const baseYear = match ? Number(match[1]) : now.getFullYear();
  const baseMonth = match ? Number(match[2]) : now.getMonth() + 1;

  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(baseYear, baseMonth - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

export function buildMonthlyRevenueBuckets(
  invoices: ManagedInvoice[],
  anchorMonth: string,
  monthCount = 6,
): MonthlyRevenueBucket[] {
  const months = buildMonthSequence(anchorMonth, monthCount);
  // Compute one extra prior month so the oldest visible month also gets an accurate MoM comparison if data exists
  const extendedMonths = buildMonthSequence(anchorMonth, monthCount + 1);
  const map = new Map<string, MonthlyRevenueBucket>();

  for (const ym of extendedMonths) {
    map.set(ym, {
      month: ym,
      label: formatYearMonthLabel(ym),
      paidSubtotal: 0,
      paidTax: 0,
      paidTotal: 0,
      paidCount: 0,
      paidInvoices: [],
      unpaidSubtotal: 0,
      unpaidTotal: 0,
      unpaidCount: 0,
      overdueCount: 0,
      unpaidInvoices: [],
      momDiffTotal: null,
      momDiffPercent: null,
    });
  }

  for (const inv of invoices) {
    const status = String(inv.status || '').toLowerCase();
    const amounts = getInvoiceAmounts(inv);
    if (status === 'paid') {
      const ym = getPaidMonthKey(inv);
      const bucket = map.get(ym);
      if (bucket) {
        bucket.paidSubtotal += amounts.subtotal;
        bucket.paidTax += amounts.taxAmount;
        bucket.paidTotal += amounts.totalWithTax;
        bucket.paidCount += 1;
        bucket.paidInvoices.push(inv);
      }
    } else if (status === 'issued' || status === 'overdue') {
      const ym = getUnpaidMonthKey(inv);
      const bucket = map.get(ym);
      if (bucket) {
        bucket.unpaidSubtotal += amounts.subtotal;
        bucket.unpaidTotal += amounts.totalWithTax;
        bucket.unpaidCount += 1;
        if (status === 'overdue') bucket.overdueCount += 1;
        bucket.unpaidInvoices.push(inv);
      }
    }
  }

  const ordered = months.map((ym, idx) => {
    const bucket = map.get(ym)!;
    const prevMonth = extendedMonths[idx];
    const prevBucket = prevMonth ? map.get(prevMonth) : undefined;
    if (prevBucket && (prevBucket.paidTotal > 0 || bucket.paidTotal > 0)) {
      bucket.momDiffTotal = bucket.paidTotal - prevBucket.paidTotal;
      bucket.momDiffPercent =
        prevBucket.paidTotal > 0
          ? Math.round(((bucket.paidTotal - prevBucket.paidTotal) / prevBucket.paidTotal) * 100)
          : null;
    }
    bucket.paidInvoices.sort((a, b) => (b.paidDate || b.issueDate || '').localeCompare(a.paidDate || a.issueDate || ''));
    bucket.unpaidInvoices.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    return bucket;
  });

  return ordered;
}

export function filterPaidInvoicesByMonth(invoices: ManagedInvoice[], targetMonth: string): ManagedInvoice[] {
  return invoices
    .filter((inv) => {
      if (String(inv.status || '').toLowerCase() !== 'paid') return false;
      if (!targetMonth || targetMonth === 'all') return true;
      return getPaidMonthKey(inv) === targetMonth;
    })
    .sort((a, b) => (b.paidDate || b.issueDate || '').localeCompare(a.paidDate || a.issueDate || ''));
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildPaidInvoicesCsv(
  invoices: ManagedInvoice[],
  companyNameResolver: (companyId?: string, fallbackName?: string) => string,
): string {
  const header = [
    '入金日',
    '請求番号',
    '顧客会社名',
    '件名',
    '税抜金額',
    '消費税(10%)',
    '税込合計',
    '発行日',
    '支払期日',
    'ステータス',
  ];

  const rows = invoices.map((inv) => {
    const amounts = getInvoiceAmounts(inv);
    const companyName = companyNameResolver(inv.companyId, inv.recipientName);
    return [
      inv.paidDate || '',
      inv.invoiceNumber || '',
      companyName || '未設定',
      inv.title || '',
      amounts.subtotal,
      amounts.taxAmount,
      amounts.totalWithTax,
      inv.issueDate || '',
      inv.dueDate || '',
      inv.status === 'paid' ? '入金済み' : inv.status,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return '\uFEFF' + [header.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}
