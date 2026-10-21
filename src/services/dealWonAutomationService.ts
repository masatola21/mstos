import { getSupabase } from '../lib/supabaseClient';
import { todayJst } from '../utils/date';

export interface DealWonResult {
  success: boolean;
  customerId?: string;
  contractId?: string;
  invoiceId?: string;
  documentIds?: string[];
  message: string;
}

const defaultInvoiceDueDate = (date = new Date()) => {
  const due = new Date(date.getFullYear(), date.getMonth(), 25);
  if (date.getDate() >= 25) due.setMonth(due.getMonth() + 1);
  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, '0');
  const day = String(due.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 商談が成約（Won）になった際に、
 * ① 顧客レコード（customers）
 * ② 契約書レコード（customer_contracts）
 * ③ 初回請求書レコード（customer_invoices）
 * ④ 顧客書類（customer_documents - 契約書・請求書HTML）
 * を一括で自動生成・起票する
 */
export async function executeDealWonAutomation(dealId: string): Promise<DealWonResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, message: 'Supabaseクライアントに接続できません。' };
  }

  try {
    // 1. 商談データの取得
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*, company:companies(*), product:products(*), lead:leads(*)')
      .eq('id', dealId)
      .maybeSingle();

    if (dealError || !deal) {
      return { success: false, message: '商談データが見つかりません。' };
    }

    const companyId = deal.company_id;
    if (!companyId) {
      return { success: false, message: '商談に紐付く会社情報がありません。' };
    }

    const today = todayJst();
    const dealTitle = deal.proposal_plan_name || deal.deal_name || 'サービス業務委託';
    const totalAmount = Number(deal.total_amount || 0);
    const initialFee = Number(deal.initial_fee || deal.product?.initial_fee || 0);
    const monthlyFee = Number(deal.monthly_fee || deal.product?.monthly_fee || 0);
    const taxAmount = totalAmount > 0 ? Math.round(totalAmount / 11) : 0;
    const companyName = deal.company?.company_name || '顧客企業';

    // ① 顧客レコード（customers）の確認・自動起票
    let customerId: string | undefined;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          company_id: companyId,
          contract_status: '契約中',
          contract_start_date: today,
          memo: `商談「${dealTitle}」成約に伴い自動起票`,
        })
        .select('id')
        .single();

      if (!customerError && newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // ② 契約書レコード（customer_contracts）の自動起票
    let contractId: string | undefined;
    const { data: contract, error: contractError } = await supabase
      .from('customer_contracts')
      .insert({
        company_id: companyId,
        product_id: deal.product_id || null,
        title: `${dealTitle} 契約書`,
        contract_type: deal.proposal_type === 'スポット' ? 'consulting' : 'retainer',
        amount: totalAmount,
        status: 'draft', // 下書き（確認待ち）
        start_date: today,
        counterparty_name: companyName,
        notes: `商談「${dealTitle}」成約による自動生成。金額: ¥${totalAmount.toLocaleString('ja-JP')}`,
      })
      .select('id')
      .single();

    if (!contractError && contract) {
      contractId = contract.id;
    }

    // ③ 初回請求書レコード（customer_invoices）の自動起票
    let invoiceId: string | undefined;
    const invoiceNumber = `INV-${today.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const dueDate = defaultInvoiceDueDate();

    const { data: invoice, error: invoiceError } = await supabase
      .from('customer_invoices')
      .insert({
        company_id: companyId,
        product_id: deal.product_id || null,
        title: `${dealTitle} 初回ご請求書`,
        invoice_number: invoiceNumber,
        amount: totalAmount,
        tax_amount: taxAmount,
        issue_date: today,
        due_date: dueDate,
        status: 'draft', // 下書き（未発行）
        recipient_name: companyName,
        notes: `商談「${dealTitle}」成約による自動生成。支払期日: ${dueDate}。振込先: ドコモSMTBネット銀行 法人第一支店 普通 2223730（有限会社MST）`,
      })
      .select('id')
      .single();

    if (!invoiceError && invoice) {
      invoiceId = invoice.id;
    }

    // ④ 書類データ（customer_documents）の契約書・請求書下書きHTML自動保存
    const documentIds: string[] = [];
    try {
      const contractHtml = `
        <div style="font-family: sans-serif; padding: 30px; line-height: 1.8; color: #1e293b;">
          <h1 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">業務委託基本契約書</h1>
          <p>発注者 <strong>${companyName}</strong>（以下「甲」）と、受注者 <strong>有限会社MST</strong>（以下「乙」）は、以下の通り契約を締結する。</p>
          <h3>第1条（業務内容）</h3>
          <p>${dealTitle}に関する業務</p>
          <h3>第2条（委託料）</h3>
          <p>総額: 金 <strong>¥${totalAmount.toLocaleString('ja-JP')}</strong> 円（消費税込 金 ¥${taxAmount.toLocaleString('ja-JP')} 円）</p>
          <h3>第3条（契約開始日）</h3>
          <p>${today}</p>
        </div>
      `;

      const invoiceHtml = `
        <div style="font-family: sans-serif; padding: 30px; line-height: 1.8; color: #1e293b;">
          <h1 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">御 請 求 書</h1>
          <p style="text-align: right;">請求番号: ${invoiceNumber}<br>発行日: ${today}</p>
          <p style="font-size: 18px;"><strong>${companyName} 御中</strong></p>
          <p>下記の通りご請求申し上げます。</p>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; font-size: 20px; font-weight: bold; text-align: center;">
            ご請求金額: ¥${totalAmount.toLocaleString('ja-JP')} （税込）
          </div>
          <p style="margin-top: 20px;">支払期日: <strong>${dueDate}</strong></p>
          <p>振込先口座: ドコモSMTBネット銀行 法人第一支店 普通 2223730（有限会社MST）</p>
        </div>
      `;

      const [contractDoc, invoiceDoc] = await Promise.all([
        supabase.from('customer_documents').insert({
          document_type: 'contract',
          title: `${companyName} · 契約書（${dealTitle}）`,
          body_html: contractHtml,
          company_id: companyId,
          deal_id: dealId,
          lead_id: deal.lead_id || null,
          status: 'draft',
        }).select('id').maybeSingle(),

        supabase.from('customer_documents').insert({
          document_type: 'invoice',
          title: `${companyName} · 初回請求書（${invoiceNumber}）`,
          body_html: invoiceHtml,
          company_id: companyId,
          deal_id: dealId,
          lead_id: deal.lead_id || null,
          status: 'draft',
        }).select('id').maybeSingle(),
      ]);

      if (contractDoc.data?.id) documentIds.push(contractDoc.data.id);
      if (invoiceDoc.data?.id) documentIds.push(invoiceDoc.data.id);
    } catch (docErr) {
      console.warn('Document draft auto-generation warning:', docErr);
    }

    return {
      success: true,
      customerId,
      contractId,
      invoiceId,
      documentIds,
      message: `成約処理が完了しました。顧客マスタ、契約書下書き、初回請求書（期日: ${dueDate}）を自動起票しました。`,
    };
  } catch (err: any) {
    console.error('Deal won automation failed:', err);
    return {
      success: false,
      message: `自動生成中にエラーが発生しました: ${err?.message || '不明なエラー'}`,
    };
  }
}
