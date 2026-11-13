/**
 * 提案書の入力値 ⇄ proposal_drafts の1行。
 * - 金額は画面の欄から再計算する(小計+消費税=合計をDBの制約どおりに保つ)。
 * - 承認待ちにできない理由(approvalBlockers)は、DBの CHECK と仕様書 §3 の「承認不可」の章に合わせる。
 *   DBが最後の砦。ここは、画面で理由を分かりやすく見せるためのもの。
 */

import { kindFromPaymentMode, type ProposalKind, type ProposalPaymentMode } from '../constants/proposalChapters';
import { calcProposalFees, parseYen } from './proposalFees';

/** 保存しない欄(社内の材料・発行者情報は固定値) */
const EXCLUDED_KEYS = new Set(['p_meeting_notes', 'sender_company', 'sender_rep', 'sender_address']);

/** "2026年11月13日" → "2026-11-13"。読めなければ空 */
export function parseJaDate(value: string | undefined | null): string {
  const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(String(value ?? ''));
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) ? String(value) : '';
}

export interface DraftContext {
  diagnosisId: string;
  dealId?: string | null;
  hearingSheetId?: string | null;
  customerIntent?: ProposalKind | null;
}

export function buildProposalDraftRow(values: Record<string, string>, paymentMode: ProposalPaymentMode, ctx: DraftContext) {
  const kind = kindFromPaymentMode(paymentMode);
  const initialFee = parseYen(values.p4_initial_fee);
  const monthlyFee = parseYen(values.p4_monthly_fee);
  const discount = parseYen(values.p4_discount);
  const fees = calcProposalFees({ initialFee, monthlyFee, discount });
  const hasFee = initialFee > 0 || monthlyFee > 0;
  const chapters: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (!EXCLUDED_KEYS.has(k) && String(v ?? '').trim()) chapters[k] = String(v);
  return {
    diagnosis_id: ctx.diagnosisId,
    deal_id: ctx.dealId || null,
    hearing_sheet_id: ctx.hearingSheetId || null,
    customer_intent: ctx.customerIntent ?? null,
    final_kind: kind,
    payment_mode: paymentMode,
    chapters,
    initial_fee: initialFee || null,
    monthly_fee: monthlyFee || null,
    discount_amount: discount || null,
    subtotal: hasFee ? fees.subtotal : null,
    tax_amount: hasFee ? fees.tax : null,
    total_amount: hasFee ? fees.total : null,
    issued_on: parseJaDate(values.issue_date) || null,
    valid_until: parseJaDate(values.due_date) || null,
  };
}

const filled = (v: string | undefined) => Boolean(String(v ?? '').trim());

/** 承認待ちにできない理由。空なら進められる */
export function approvalBlockers(
  values: Record<string, string>,
  paymentMode: ProposalPaymentMode,
  ctx: { dealId?: string | null; roadmapConfirmed: boolean },
): string[] {
  const kind = kindFromPaymentMode(paymentMode);
  const row = buildProposalDraftRow(values, paymentMode, { diagnosisId: 'x', dealId: ctx.dealId });
  const out: string[] = [];
  if (!ctx.dealId) out.push('商談(案件)を選んでください');
  if (!filled(values.p1_policy)) out.push('P1 提案の方針が未入力です');
  if (!filled(values.p2_service_name)) out.push('P2 サービス名が未入力です');
  if (kind !== 'retainer' && !filled(values.p2_deliverables)) out.push('P2 成果物の一覧が未入力です');
  if (kind !== 'spot_build' && !filled(values.p2_monthly_support)) out.push('P2 月次の支援内容が未入力です');
  if (!filled(values.p3_roadmap)) out.push('P3 ロードマップが未入力です');
  if (kind !== 'retainer' && !(row.initial_fee && row.initial_fee > 0)) out.push('P4 初期費用が未入力です');
  if (kind !== 'spot_build' && !(row.monthly_fee && row.monthly_fee > 0)) out.push('P4 月額が未入力です');
  if (kind !== 'spot_build' && !filled(values.p6_contract_period)) out.push('P6 契約期間が未入力です');
  if (!filled(values.p6_payment_terms)) out.push('P6 お支払い条件が未入力です');
  if (!row.issued_on) out.push('発行日が未入力です');
  if (!row.valid_until) out.push('有効期限が未入力です');
  if (row.issued_on && row.valid_until && row.valid_until < row.issued_on) out.push('有効期限が発行日より前になっています');
  if (!ctx.roadmapConfirmed) out.push('ロードマップ(P3)の確認がまだです');
  return out;
}
