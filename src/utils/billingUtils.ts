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
