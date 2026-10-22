import { getSupabase } from '../lib/supabaseClient';
import { todayJst } from '../utils/date';

export interface DealWonResult {
  success: boolean;
  customerId?: string;
  contractId?: string;
  invoiceId?: string;
  engagementId?: string;
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
 * ② 書類データ（customer_documents - 契約書・請求書HTML）
 * ③ 契約書レコード（customer_contracts - 書類ID連携・定期請求スケジュール保持）
 * ④ 初回請求書レコード（customer_invoices - 書類ID・契約ID完全連結）
 * ⑤ 契約後サポート案件（customer_service_engagements - 工程マイルストーン付き）
 * を一括で自動生成・相互連携する
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
    const firstInvoiceAmount = initialFee > 0 ? initialFee : totalAmount;
    const taxAmount = firstInvoiceAmount > 0 ? Math.round(firstInvoiceAmount / 11) : 0;
    const companyName = deal.company?.company_name || '顧客企業';
    const invoiceNumber = `INV-${today.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const dueDate = defaultInvoiceDueDate();

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

    // ② 書類データ（customer_documents）の契約書・請求書下書きHTMLを先行生成
    let contractDocId: string | null = null;
    let invoiceDocId: string | null = null;
    const documentIds: string[] = [];

    const scheduleNote = monthlyFee > 0
      ? `月額費用: ¥${monthlyFee.toLocaleString('ja-JP')}（毎月25日締め翌月末払い）`
      : 'スポット契約（一括払い）';

    try {
      const contractHtml = `
        <div style="font-family: sans-serif; padding: 30px; line-height: 1.8; color: #1e293b;">
          <h1 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">業務委託基本契約書</h1>
          <p>発注者 <strong>${companyName}</strong>（以下「甲」）と、受注者 <strong>有限会社MST</strong>（以下「乙」）は、以下の通り契約を締結する。</p>
          <h3>第1条（業務内容）</h3>
          <p>${dealTitle}に関する業務支援および仕組み化伴走</p>
          <h3>第2条（委託料および請求スケジュール）</h3>
          <p>初期費用: 金 <strong>¥${initialFee > 0 ? initialFee.toLocaleString('ja-JP') : totalAmount.toLocaleString('ja-JP')}</strong> 円</p>
          ${monthlyFee > 0 ? `<p>継続顧問料: 月額 <strong>¥${monthlyFee.toLocaleString('ja-JP')}</strong> 円（毎月25日締め翌月払い）</p>` : ''}
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
            ご請求金額: ¥${firstInvoiceAmount.toLocaleString('ja-JP')} （税込）
          </div>
          <p style="margin-top: 20px;">支払期日: <strong>${dueDate}</strong></p>
          <p>振込先口座: ドコモSMTBネット銀行 法人第一支店 普通 2223730（口座名義：有限会社MST）</p>
        </div>
      `;

      const [cDoc, iDoc] = await Promise.all([
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

      if (cDoc.data?.id) {
        contractDocId = cDoc.data.id;
        documentIds.push(contractDocId);
      }
      if (iDoc.data?.id) {
        invoiceDocId = iDoc.data.id;
        documentIds.push(invoiceDocId);
      }
    } catch (docErr) {
      console.warn('Document draft auto-generation warning:', docErr);
    }

    // ③ 契約書レコード（customer_contracts）の自動起票（書類IDと定期請求スケジュールを保持）
    let contractId: string | undefined;
    const { data: contract, error: contractError } = await supabase
      .from('customer_contracts')
      .insert({
        company_id: companyId,
        product_id: deal.product_id || null,
        deal_id: dealId,
        document_id: contractDocId,
        title: `${dealTitle} 契約書`,
        contract_type: monthlyFee > 0 ? 'retainer' : 'service_agreement',
        amount: totalAmount,
        status: 'draft',
        start_date: today,
        counterparty_name: companyName,
        notes: `商談「${dealTitle}」成約による自動生成。${scheduleNote}。契約書書類ID: ${contractDocId || 'なし'}`,
      })
      .select('id')
      .single();

    if (!contractError && contract) {
      contractId = contract.id;
    }

    // ④ 初回請求書レコード（customer_invoices）の自動起票（書類ID・契約IDと完全連結）
    let invoiceId: string | undefined;
    const { data: invoice, error: invoiceError } = await supabase
      .from('customer_invoices')
      .insert({
        company_id: companyId,
        product_id: deal.product_id || null,
        contract_id: contractId || null,
        document_id: invoiceDocId,
        title: `${dealTitle} 初回ご請求書`,
        invoice_number: invoiceNumber,
        amount: firstInvoiceAmount,
        tax_amount: taxAmount,
        issue_date: today,
        due_date: dueDate,
        status: 'draft',
        recipient_name: companyName,
        notes: `商談「${dealTitle}」成約による自動起票。支払期日: ${dueDate}。振込先: ドコモSMTBネット銀行 法人第一支店 普通 2223730（有限会社MST）。書類ID: ${invoiceDocId || 'なし'}`,
      })
      .select('id')
      .single();

    if (!invoiceError && invoice) {
      invoiceId = invoice.id;
    }

    // ⑤ 契約後サポート案件（customer_service_engagements）の自動起票（マイルストーン付き）
    let engagementId: string | undefined;
    try {
      const milestones = [
        { phase: 1, title: '初回キックオフ・現状詳細ヒアリング', target_period: '第1週〜第2週', status: 'not_started' },
        { phase: 2, title: '急所業務の自動化・仕組み化の構築', target_period: '第1ヶ月〜第2ヶ月', status: 'not_started' },
        { phase: 3, title: '運用定着支援・定期顧問レビュー', target_period: '第3ヶ月以降', status: 'not_started' },
      ];

      const { data: engagement, error: engagementError } = await supabase
        .from('customer_service_engagements')
        .insert({
          company_id: companyId,
          contract_id: contractId || null,
          service_type: monthlyFee > 0 ? 'retainer' : 'implementation_support',
          title: `【伴走サポート】${companyName} 様 · ${dealTitle}`,
          status: 'active',
          milestone_data: milestones,
          notes: `商談成約（商談ID: ${dealId}）に伴い自動起票。${scheduleNote}`,
        })
        .select('id')
        .single();

      if (!engagementError && engagement) {
        engagementId = engagement.id;
      }
    } catch (engErr) {
      console.warn('Engagement auto-generation warning:', engErr);
    }

    return {
      success: true,
      customerId,
      contractId,
      invoiceId,
      engagementId,
      documentIds,
      message: `成約処理が完了しました。顧客マスタ、契約書、初回請求書（期日: ${dueDate}）、伴走サポート案件を一括起票・連結しました。`,
    };
  } catch (err: any) {
    console.error('Deal won automation failed:', err);
    return {
      success: false,
      message: `自動生成中にエラーが発生しました: ${err?.message || '不明なエラー'}`,
    };
  }
}
