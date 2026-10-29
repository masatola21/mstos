import { getSupabase } from '../lib/supabaseClient';

export interface RecurringCandidate {
  contractId: string;
  companyId: string;
  companyName: string;
  contractTitle: string;
  contractType: string;
  contractStatus: string;
  productId?: string;
  productName?: string;
  dealId?: string;
  monthlyFee: number;
  taxAmount: number;
  totalWithTax: number;
  startDate?: string;
  endDate?: string;
  alreadyBilled: boolean;
  existingInvoiceId?: string;
  existingInvoiceNumber?: string;
  existingInvoiceStatus?: string;
  suggestedIssueDate: string;
  suggestedDueDate: string;
}

export interface RecurringSummary {
  targetMonth: string; // YYYY-MM
  targetMonthLabel: string; // YYYY年M月分
  totalCandidates: number;
  readyToBillCount: number;
  alreadyBilledCount: number;
  estimatedMonthlyRevenue: number;
  alreadyBilledRevenue: number;
}

export interface RecurringCandidatesResponse {
  success: boolean;
  targetMonth: string;
  summary: RecurringSummary;
  candidates: RecurringCandidate[];
}

export interface GenerateRecurringParams {
  targetMonth: string; // YYYY-MM
  issueDate?: string;
  dueDate?: string;
  contractIds?: string[];
}

export interface GenerateRecurringResult {
  success: boolean;
  targetMonth: string;
  generatedCount: number;
  skippedCount: number;
  generatedInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    companyName: string;
    amount: number;
    documentId?: string;
  }>;
}

export function getCurrentTargetMonth(offsetMonths = 0): string {
  const d = new Date();
  if (offsetMonths !== 0) {
    d.setMonth(d.getMonth() + offsetMonths);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatTargetMonthLabel(targetMonth: string): string {
  const [y, m] = targetMonth.split('-');
  return `${y}年${parseInt(m, 10)}月分`;
}

export async function fetchRecurringCandidates(targetMonth?: string): Promise<RecurringCandidatesResponse> {
  const month = targetMonth || getCurrentTargetMonth();
  try {
    const res = await fetch(`/api/billing/recurring-candidates?month=${encodeURIComponent(month)}`);
    if (res.ok) {
      return (await res.json()) as RecurringCandidatesResponse;
    }
  } catch (err) {
    console.warn('API recurring-candidates failed, falling back to direct Supabase query:', err);
  }

  // Client-side fallback via Supabase
  return fallbackFetchCandidates(month);
}

export async function generateRecurringInvoices(params: GenerateRecurringParams): Promise<GenerateRecurringResult> {
  try {
    const res = await fetch('/api/billing/recurring-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      return (await res.json()) as GenerateRecurringResult;
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `定期請求書の生成に失敗しました (HTTP ${res.status})`);
  } catch (err: any) {
    console.warn('API recurring-generate failed, falling back to client-side Supabase creation:', err);
    return fallbackGenerateInvoices(params);
  }
}

// ─── Direct Supabase Client Fallback ───
async function fallbackFetchCandidates(targetMonth: string): Promise<RecurringCandidatesResponse> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabaseクライアントに接続できません');

  const [contractsRes, companiesRes, invoicesRes, dealsRes, productsRes] = await Promise.all([
    supabase.from('customer_contracts').select('*'),
    supabase.from('companies').select('id, company_name'),
    supabase.from('customer_invoices').select('*'),
    supabase.from('deals').select('id, company_id, monthly_fee, total_amount, proposal_plan_name'),
    supabase.from('products').select('id, product_name'),
  ]);

  const contracts = contractsRes.data || [];
  const companies = companiesRes.data || [];
  const invoices = invoicesRes.data || [];
  const deals = dealsRes.data || [];
  const products = productsRes.data || [];

  const companyMap = new Map(companies.map((c) => [c.id, c.company_name]));
  const productMap = new Map(products.map((p) => [p.id, p.product_name]));
  const dealMap = new Map(deals.map((d) => [d.id, d]));

  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthLabel = `${year}年${month}月分`;
  const compactMonthTag = `INV-${yearStr}${monthStr}-`;

  // Find default dates
  const defaultIssueDate = `${targetMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const defaultDueDate = `${targetMonth}-${String(Math.min(25, lastDay)).padStart(2, '0')}`;

  const candidates: RecurringCandidate[] = [];

  for (const contract of contracts) {
    const isSignedOrActive = ['signed', 'active', 'sent', 'under_review'].includes(contract.status);
    const isRetainer = contract.contract_type === 'retainer' || (contract.notes && contract.notes.includes('月額'));
    
    // Check if contract or deal has a monthly fee
    const linkedDeal = contract.deal_id ? dealMap.get(contract.deal_id) : undefined;
    let monthlyFee = 0;

    if (linkedDeal && typeof linkedDeal.monthly_fee === 'number' && linkedDeal.monthly_fee > 0) {
      monthlyFee = linkedDeal.monthly_fee;
    } else if (isRetainer && typeof contract.amount === 'number' && contract.amount > 0) {
      monthlyFee = contract.amount;
    } else if (contract.amount && contract.amount > 0 && isSignedOrActive) {
      // If contract has positive amount and is signed/active, treat as recurring if retainer or marked as recurring
      if (isRetainer || (contract.notes && /毎月|顧問|定期/.test(contract.notes))) {
        monthlyFee = contract.amount;
      }
    }

    if (monthlyFee <= 0) continue;

    // Check if already billed for this month
    const existingInv = invoices.find((inv) => {
      if (inv.contract_id === contract.id || (inv.company_id === contract.company_id && inv.company_id)) {
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

    const tax = Math.floor(monthlyFee * 0.1);
    const companyName = companyMap.get(contract.company_id) || contract.counterparty_name || '取引先';

    candidates.push({
      contractId: contract.id,
      companyId: contract.company_id,
      companyName,
      contractTitle: contract.title || `${companyName} 顧問契約`,
      contractType: contract.contract_type || 'retainer',
      contractStatus: contract.status || 'active',
      productId: contract.product_id || undefined,
      productName: contract.product_id ? productMap.get(contract.product_id) : undefined,
      dealId: contract.deal_id || undefined,
      monthlyFee,
      taxAmount: tax,
      totalWithTax: monthlyFee + tax,
      startDate: contract.start_date || undefined,
      endDate: contract.end_date || undefined,
      alreadyBilled: Boolean(existingInv),
      existingInvoiceId: existingInv?.id,
      existingInvoiceNumber: existingInv?.invoice_number,
      existingInvoiceStatus: existingInv?.status,
      suggestedIssueDate: defaultIssueDate,
      suggestedDueDate: defaultDueDate,
    });
  }

  const readyToBill = candidates.filter((c) => !c.alreadyBilled);
  const alreadyBilled = candidates.filter((c) => c.alreadyBilled);

  return {
    success: true,
    targetMonth,
    summary: {
      targetMonth,
      targetMonthLabel: monthLabel,
      totalCandidates: candidates.length,
      readyToBillCount: readyToBill.length,
      alreadyBilledCount: alreadyBilled.length,
      estimatedMonthlyRevenue: candidates.reduce((sum, c) => sum + c.monthlyFee, 0),
      alreadyBilledRevenue: alreadyBilled.reduce((sum, c) => sum + c.monthlyFee, 0),
    },
    candidates,
  };
}

async function fallbackGenerateInvoices(params: GenerateRecurringParams): Promise<GenerateRecurringResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabaseクライアントに接続できません');

  const { targetMonth, contractIds, issueDate, dueDate } = params;
  const candidateData = await fallbackFetchCandidates(targetMonth);
  const eligible = candidateData.candidates.filter(
    (c) => !c.alreadyBilled && (!contractIds || contractIds.length === 0 || contractIds.includes(c.contractId))
  );

  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthLabel = `${year}年${month}月分`;

  const finalIssueDate = issueDate || `${targetMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const finalDueDate = dueDate || `${targetMonth}-${String(Math.min(25, lastDay)).padStart(2, '0')}`;

  const generatedInvoices: GenerateRecurringResult['generatedInvoices'] = [];

  for (const candidate of eligible) {
    const invoiceNumber = `INV-${yearStr}${monthStr}-${candidate.contractId.slice(0, 6).toUpperCase()}`;
    const invoiceTitle = `${candidate.companyName} 【${monthLabel}】定期請求書`;

    const invoiceHtml = `
      <div style="font-family: sans-serif; padding: 30px; line-height: 1.8; color: #1e293b;">
        <h1 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">御 請 求 書</h1>
        <p style="text-align: right;">請求番号: ${invoiceNumber}<br>発行日: ${finalIssueDate}</p>
        <p style="font-size: 18px;"><strong>${candidate.companyName} 御中</strong></p>
        <p>下記の通り、${monthLabel}の月次顧問料・運用支援費用をご請求申し上げます。</p>
        
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #94a3b8; text-align: left;">
                <th style="padding: 8px 0;">品目・内容</th>
                <th style="padding: 8px 0; text-align: right;">金額（税抜）</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px 0;">月額顧問・システム運用支援費用（${monthLabel}）</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">¥${candidate.monthlyFee.toLocaleString('ja-JP')}</td>
              </tr>
              <tr style="border-top: 1px solid #cbd5e1;">
                <td style="padding: 6px 0; color: #64748b;">小計（税抜）:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold;">¥${candidate.monthlyFee.toLocaleString('ja-JP')}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; border-bottom: 1px solid #cbd5e1;">消費税（10%）:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; border-bottom: 1px solid #cbd5e1;">¥${candidate.taxAmount.toLocaleString('ja-JP')}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0 4px 0; font-size: 18px; font-weight: bold; color: #0f172a;">ご請求金額合計（税込）:</td>
                <td style="padding: 10px 0 4px 0; text-align: right; font-size: 20px; font-weight: 800; color: #1e3a8a;">¥${candidate.totalWithTax.toLocaleString('ja-JP')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style="margin-top: 20px;">お支払期日: <strong>${finalDueDate}</strong></p>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 16px; border-radius: 6px; font-size: 13px;">
          <strong>お振込先口座:</strong><br>
          ドコモSMTBネット銀行 法人第一支店 普通 2223730<br>
          口座名義: 有限会社MST
        </div>

        <div style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: right;">
          有限会社MST<br>
          代表取締役: 大橋真人<br>
          〒503-0981 岐阜県大垣市桧町127番地
        </div>
      </div>
    `;

    // 1. Create Document
    let documentId: string | undefined;
    const { data: docData, error: docError } = await supabase
      .from('customer_documents')
      .insert({
        document_type: 'invoice',
        title: `${candidate.companyName} · 定期請求書（${monthLabel}）`,
        body_html: invoiceHtml,
        company_id: candidate.companyId,
        deal_id: candidate.dealId || null,
        status: 'draft',
      })
      .select('id')
      .maybeSingle();

    if (!docError && docData?.id) {
      documentId = docData.id;
    }

    // 2. Create Invoice
    const { data: invData, error: invError } = await supabase
      .from('customer_invoices')
      .insert({
        company_id: candidate.companyId,
        contract_id: candidate.contractId,
        product_id: candidate.productId || null,
        document_id: documentId || null,
        title: invoiceTitle,
        invoice_number: invoiceNumber,
        amount: candidate.monthlyFee,
        tax_amount: candidate.taxAmount,
        issue_date: finalIssueDate,
        due_date: finalDueDate,
        status: 'draft',
        recipient_name: candidate.companyName,
        notes: `定期月次請求（${monthLabel}）。お支払期日: ${finalDueDate}。振込先: ドコモSMTBネット銀行 法人第一支店 普通 2223730（有限会社MST）。書類ID: ${documentId || 'なし'}`,
      })
      .select('id')
      .single();

    if (!invError && invData?.id) {
      generatedInvoices.push({
        invoiceId: invData.id,
        invoiceNumber,
        companyName: candidate.companyName,
        amount: candidate.monthlyFee,
        documentId,
      });
    }
  }

  return {
    success: true,
    targetMonth,
    generatedCount: generatedInvoices.length,
    skippedCount: candidateData.candidates.length - eligible.length,
    generatedInvoices,
  };
}
