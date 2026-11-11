/**
 * 請求・顧問料計算および請求書生成のための共通ユーティリティ
 */

export interface BillingAmountCalculation {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalWithTax: number;
}

/**
 * 金額（税抜）から消費税（10%端数切り捨て）と税込合計金額を計算
 */
export function calculateBillingAmount(subtotal: number, taxRate: number = 0.1): BillingAmountCalculation {
  const safeSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
  const taxAmount = Math.floor(safeSubtotal * taxRate);
  const totalWithTax = safeSubtotal + taxAmount;
  return {
    subtotal: safeSubtotal,
    taxRate,
    taxAmount,
    totalWithTax,
  };
}

/**
 * 契約レコードおよび紐付く商談から月額顧問料・請求金額を判定
 */
export function determineContractMonthlyFee(
  contract: {
    status?: string | null;
    contract_type?: string | null;
    amount?: number | null;
    notes?: string | null;
  },
  linkedDeal?: {
    monthly_fee?: number | null;
  }
): number {
  if (!contract) return 0;
  const isSignedOrActive = ['signed', 'active', 'sent', 'under_review'].includes(contract.status || '');
  const isRetainer = contract.contract_type === 'retainer' || (contract.notes && contract.notes.includes('月額'));

  if (linkedDeal && typeof linkedDeal.monthly_fee === 'number' && linkedDeal.monthly_fee > 0) {
    return Math.round(linkedDeal.monthly_fee);
  }

  if (isRetainer && typeof contract.amount === 'number' && contract.amount > 0) {
    return Math.round(contract.amount);
  }

  if (contract.amount && contract.amount > 0 && isSignedOrActive) {
    if (isRetainer || (contract.notes && /毎月|顧問|定期/.test(contract.notes))) {
      return Math.round(contract.amount);
    }
  }

  return 0;
}

/**
 * 同一契約または同一企業に対して指定月の請求書が既に発行済み（二重発行防止）か判定
 */
export function isContractAlreadyBilled(
  invoices: Array<{
    contract_id?: string | null;
    company_id?: string | null;
    invoice_number?: string | null;
    title?: string | null;
    notes?: string | null;
  }>,
  contractId: string,
  companyId: string | null | undefined,
  targetMonth: string // 例: "2026-11"
): boolean {
  if (!invoices || !targetMonth) return false;
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthLabel = `${year}年${month}月分`;
  const compactMonthTag = `INV-${yearStr}${monthStr}-`;

  return invoices.some((inv) => {
    if (inv.contract_id === contractId || (companyId && inv.company_id === companyId)) {
      const invNum = inv.invoice_number || '';
      const title = inv.title || '';
      const notes = inv.notes || '';
      if (
        invNum.startsWith(compactMonthTag) ||
        title.includes(monthLabel) ||
        title.includes(targetMonth) ||
        notes.includes(monthLabel) ||
        notes.includes(targetMonth)
      ) {
        return true;
      }
    }
    return false;
  });
}

/**
 * 支払期日（基準日の翌月末日）を算出（例: 2026-11-10 発行 → 2026-12-31 支払期日）
 */
export function getEndOfNextMonthDate(baseDateInput?: string | Date): string {
  let date: Date;
  if (!baseDateInput) {
    date = new Date();
  } else if (typeof baseDateInput === 'string') {
    const parts = baseDateInput.split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      date = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      date = new Date(baseDateInput);
    }
  } else {
    date = baseDateInput;
  }
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  // Day 0 of month + 2 gives the last day of month + 1 (the next month)
  const endOfNextMonth = new Date(year, month + 2, 0);
  const y = endOfNextMonth.getFullYear();
  const m = String(endOfNextMonth.getMonth() + 1).padStart(2, '0');
  const d = String(endOfNextMonth.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 見積有効期限（基準日から丸1ヶ月後）を算出（例: 2026-11-10 発行 → 2026-12-10 有効期限）
 */
export function getOneMonthLaterDate(baseDateInput?: string | Date): string {
  let date: Date;
  if (!baseDateInput) {
    date = new Date();
  } else if (typeof baseDateInput === 'string') {
    const parts = baseDateInput.split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      date = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      date = new Date(baseDateInput);
    }
  } else {
    date = baseDateInput;
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetLastDay = new Date(year, month + 2, 0).getDate();
  const targetDate = new Date(year, month + 1, Math.min(day, targetLastDay));
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type PaymentPlanType = 'lump_sum' | 'retainer' | 'milestone' | 'installments';

export interface MilestoneBreakdown {
  depositRatio: number; // e.g. 0.5 (50%)
  completionRatio: number; // e.g. 0.5 (50%)
  depositSubtotal: number;
  depositTax: number;
  depositTotalWithTax: number;
  completionSubtotal: number;
  completionTax: number;
  completionTotalWithTax: number;
  totalSubtotal: number;
  totalWithTax: number;
}

/**
 * 手付金（着手金）＋導入後（残金）の2段階マイルストーン計算
 * 端数が出た場合は1円単位で着手金側に寄せて合計が正確に一致するように調整
 */
export function calculateMilestoneAmounts(totalSubtotal: number, depositRatio = 0.5): MilestoneBreakdown {
  const safeTotal = Math.max(0, Math.round(Number(totalSubtotal) || 0));
  const safeRatio = Math.max(0.1, Math.min(0.9, depositRatio));
  const depositSubtotal = Math.floor(safeTotal * safeRatio);
  const completionSubtotal = safeTotal - depositSubtotal;

  const depositTax = Math.floor(depositSubtotal * 0.1);
  const depositTotalWithTax = depositSubtotal + depositTax;

  const completionTax = Math.floor(completionSubtotal * 0.1);
  const completionTotalWithTax = completionSubtotal + completionTax;

  return {
    depositRatio: safeRatio,
    completionRatio: Math.round((1 - safeRatio) * 100) / 100,
    depositSubtotal,
    depositTax,
    depositTotalWithTax,
    completionSubtotal,
    completionTax,
    completionTotalWithTax,
    totalSubtotal: safeTotal,
    totalWithTax: depositTotalWithTax + completionTotalWithTax,
  };
}

export interface InstallmentItem {
  installmentNumber: number;
  totalInstallments: number;
  subtotal: number;
  tax: number;
  totalWithTax: number;
  label: string;
}

/**
 * 分割払いの各回金額計算（2〜12回）
 * 端数は初回に合算して合計金額と完全に一致させる
 */
export function calculateInstallmentAmounts(totalSubtotal: number, installmentCount = 3): {
  installments: InstallmentItem[];
  totalSubtotal: number;
  totalWithTax: number;
} {
  const safeTotal = Math.max(0, Math.round(Number(totalSubtotal) || 0));
  const count = Math.max(2, Math.min(24, Math.round(Number(installmentCount) || 3)));
  
  const baseSubtotal = Math.floor(safeTotal / count);
  const remainder = safeTotal - baseSubtotal * count;

  const installments: InstallmentItem[] = [];
  let sumTotalWithTax = 0;

  for (let i = 1; i <= count; i++) {
    const subtotal = i === 1 ? baseSubtotal + remainder : baseSubtotal;
    const tax = Math.floor(subtotal * 0.1);
    const totalWithTax = subtotal + tax;
    sumTotalWithTax += totalWithTax;

    installments.push({
      installmentNumber: i,
      totalInstallments: count,
      subtotal,
      tax,
      totalWithTax,
      label: `第${i}回（全${count}回）`,
    });
  }

  return {
    installments,
    totalSubtotal: safeTotal,
    totalWithTax: sumTotalWithTax,
  };
}

