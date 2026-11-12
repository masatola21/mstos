/**
 * 提案書(P4 費用)の金額計算。
 * 税率10%、端数は切り捨て(既存の請求・見積と同じ Math.floor)。
 * DB(proposal_drafts)の CHECK「小計 + 税 = 合計」を満たす値を返す。
 */

export const TAX_RATE = 0.1;

export interface ProposalFeeInput {
  initialFee: number;
  monthlyFee: number;
  discount: number;
}

export interface ProposalFees {
  subtotal: number;
  tax: number;
  total: number;
}

const toInt = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** 小計 = 初期費用 + 月額 - 値引き(既存の「初期構築+月額顧問」の合計と同じ考え方)。0 未満にはしない。 */
export function calcProposalFees(input: ProposalFeeInput): ProposalFees {
  const subtotal = Math.max(0, toInt(input.initialFee) + toInt(input.monthlyFee) - toInt(input.discount));
  const tax = Math.floor(subtotal * TAX_RATE);
  return { subtotal, tax, total: subtotal + tax };
}

/** "300,000" や "￥300,000円" のような文字列を整数にする。数字がなければ 0。 */
export function parseYen(value: string | undefined | null): number {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

export function formatYen(n: number): string {
  return Math.floor(n).toLocaleString('ja-JP');
}
