import { getSupabase } from '../lib/supabaseClient';
import { todayJst } from '../utils/date';
import { getEndOfNextMonthDate } from '../utils/billingUtils';
import { resolveNonDowngradingLeadStatus } from '../utils/crmPipelineFlow';

export interface DealWonResult {
  success: boolean;
  customerId?: string;
  contractId?: string;
  invoiceId?: string;
  engagementId?: string;
  documentIds?: string[];
  createdAny?: boolean;
  message: string;
}

const defaultInvoiceDueDate = (date = new Date()) => getEndOfNextMonthDate(date);

// 同時並行実行を防ぐインフライトPromise共有（後から来た呼び出しも同じ完了を待つ）
const inFlightDealPromises = new Map<string, Promise<DealWonResult>>();
let inFlightReconcile: Promise<{ checkedCount: number; completedCount: number }> | null = null;

function isMissingColumnErr(error: any, columnName: string): boolean {
  const msg = String(error?.message || '');
  const code = String(error?.code || '');
  return (
    (code === '42703' || code === 'PGRST204' || /column|schema cache/i.test(msg)) &&
    msg.toLowerCase().includes(columnName.toLowerCase())
  );
}

/**
 * 商談が成約（Won）になった際に、
 * ① 顧客レコード（customers）
 * ② 書類データ（customer_documents - 契約書・請求書HTML）
 * ③ 契約書レコード（customer_contracts - 書類ID連携・定期請求スケジュール保持）
 * ④ 初回請求書レコード（customer_invoices - 書類ID・契約ID完全連結）
 * ⑤ 契約後サポート案件（customer_service_engagements - 工程マイルストーン付き）
 * を不足分のみ冪等に自動生成・相互連携する
 */
export async function executeDealWonAutomation(dealId: string, forceRecreate = false): Promise<DealWonResult> {
  const safeDealId = String(dealId || '').trim();
  if (!safeDealId) {
    return { success: false, message: '商談IDが指定されていません。' };
  }

  const existingPromise = inFlightDealPromises.get(safeDealId);
  if (existingPromise) {
    if (!forceRecreate) {
      return await existingPromise;
    }
    await existingPromise.catch(() => undefined);
  }

  const runPromise = executeDealWonAutomationInternal(safeDealId, forceRecreate).finally(() => {
    if (inFlightDealPromises.get(safeDealId) === runPromise) {
      inFlightDealPromises.delete(safeDealId);
    }
  });
  inFlightDealPromises.set(safeDealId, runPromise);
  return await runPromise;
}

async function executeDealWonAutomationInternal(dealId: string, forceRecreate = false): Promise<DealWonResult> {
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

    // すでに成約自動化が完了しており、明示的な再作成フラグがない場合は再生成をスキップ（削除後の復活を防止）
    if (!forceRecreate && (deal as any).won_automation_completed_at) {
      return {
        success: true,
        createdAny: false,
        message: `商談（ID: ${dealId}）は成約自動化が完了済みです（削除後の自動再生成をスキップしました）。`,
      };
    }

    // company_id は lead.company_id からも補完
    let companyId: string | null = deal.company_id || deal.lead?.company_id || null;
    if (!deal.company_id && companyId) {
      await supabase.from('deals').update({ company_id: companyId }).eq('id', dealId);
    }

    if (!companyId) {
      return { success: false, message: '商談に紐付く会社情報がありません。' };
    }

    const today = todayJst();
    const nowIso = new Date().toISOString();
    const dealTitle = deal.proposal_plan_name || deal.deal_name || 'サービス業務委託';
    const totalAmount = Number(deal.total_amount || 0);
    const initialFee = Number(deal.initial_fee || deal.product?.initial_fee || 0);
    const monthlyFee = Number(deal.monthly_fee || deal.product?.monthly_fee || 0);
    const firstInvoiceAmount = initialFee > 0 ? initialFee : totalAmount;
    const taxAmount = firstInvoiceAmount > 0 ? Math.floor(firstInvoiceAmount * 0.1) : 0;
    const firstInvoiceTotalWithTax = firstInvoiceAmount + taxAmount;
    const companyName = deal.company?.company_name || '顧客企業';
    const dueDate = defaultInvoiceDueDate();
    const scheduleNote = monthlyFee > 0
      ? `月額費用: ¥${monthlyFee.toLocaleString('ja-JP')}（税抜 / 税込 ¥${Math.floor(monthlyFee * 1.1).toLocaleString('ja-JP')}・毎月末日締め翌月末日振込）`
      : `スポット契約（一括払い・支払期日: ${dueDate}）`;

    let createdAny = false;
    const errors: string[] = [];

    // 既存契約・入金状況を確認して顧客ステータス（申込済み vs 契約中）を決定
    let existingContract: { id: string; document_id?: string | null; status?: string | null; deal_id?: string | null } | null = null;
    if (!forceRecreate) {
      const { data: existingContracts } = await supabase
        .from('customer_contracts')
        .select('id, document_id, status, deal_id')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true })
        .limit(1);
      existingContract = existingContracts?.[0] || null;

      if (!existingContract) {
        const { data: companyContracts } = await supabase
          .from('customer_contracts')
          .select('id, document_id, status, deal_id, title')
          .eq('company_id', companyId)
          .in('status', ['draft', 'under_review', 'sent', 'signed', 'active', 'effective', 'in_force'])
          .order('created_at', { ascending: true })
          .limit(10);
        const matched = (companyContracts || []).find((c: any) =>
          !c.deal_id ||
          c.title === `${dealTitle} 契約書` ||
          (dealTitle && String(c.title || '').includes(dealTitle))
        );
        if (matched) {
          existingContract = matched;
          if (!matched.deal_id) {
            await supabase
              .from('customer_contracts')
              .update({ deal_id: dealId, updated_at: nowIso })
              .eq('id', matched.id);
          }
        }
      }
    }

    const { data: paidInvoices } = await supabase
      .from('customer_invoices')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'paid')
      .limit(1);

    const hasSignedContract = ['signed', 'active', 'effective', 'in_force'].includes(
      String(existingContract?.status || '').toLowerCase()
    );
    const hasPaidInvoice = Boolean(paidInvoices && paidInvoices.length > 0);
    const targetCustomerStatus = (hasSignedContract || hasPaidInvoice) ? '契約中' : '申込済み';

    // ① 顧客レコード（customers）の確認・自動起票（契約締結前＝申込済み / 締結または入金済＝契約中）
    let customerId: string | undefined;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, contract_status')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      const curCustStatus = String(existingCustomer.contract_status || '').trim();
      if (targetCustomerStatus === '契約中' && (!curCustStatus || curCustStatus === '申込済み')) {
        await supabase
          .from('customers')
          .update({ contract_status: '契約中', last_updated_at: nowIso })
          .eq('id', existingCustomer.id);
      }
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          company_id: companyId,
          contract_status: targetCustomerStatus,
          contract_start_date: today,
          memo: `商談「${dealTitle}」成約に伴い自動起票`,
        })
        .select('id')
        .single();

      if (customerError) {
        errors.push(`顧客登録: ${customerError.message}`);
      } else if (newCustomer) {
        customerId = newCustomer.id;
        createdAny = true;
      }
    }

    let contractId: string | undefined = existingContract?.id;
    let contractDocId: string | null = existingContract?.document_id || null;
    const documentIds: string[] = [];

    // ②・③ 契約書ドラフト書類 + 契約書レコード（customer_contracts）
    if (!contractId) {
      try {
        const isRetainer = monthlyFee > 0;
        const initialFeeVal = initialFee > 0 ? initialFee : totalAmount;
        const contractHtml = `
          <div style="font-family: sans-serif; padding: 30px; line-height: 1.8; color: #1e293b;">
            <h1 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">${isRetainer ? '経営・業務顧問 委託契約書' : '業務委託基本契約書'}</h1>
            <p>発注者 <strong>${companyName}</strong>（以下「甲」）と、受注者 <strong>有限会社MST</strong>（以下「乙」）は、以下の通り契約を締結する。</p>
            <h3>第1条（業務内容）</h3>
            <p>${dealTitle}に関する業務支援および仕組み化伴走</p>
            <h3>第2条（委託料および請求スケジュール）</h3>
            <p>初期費用: 金 <strong>¥${initialFeeVal.toLocaleString('ja-JP')}</strong> 円（税抜 / 消費税10%込 金 ¥${Math.floor(initialFeeVal * 1.1).toLocaleString('ja-JP')} 円 / 支払期日: <strong>${dueDate}</strong> 翌月末日振込）</p>
            ${isRetainer ? `<p>継続顧問料: 月額 <strong>¥${monthlyFee.toLocaleString('ja-JP')}</strong> 円（税抜 / 消費税10%込 金 ¥${Math.floor(monthlyFee * 1.1).toLocaleString('ja-JP')} 円 / 毎月末日締め翌月末日振込）</p>` : ''}
            <h3>第3条（契約期間および最低契約期間）</h3>
            ${isRetainer
              ? `<p>1. 本契約の有効期間は <strong>${today}</strong> からとし、<strong>契約締結日より最低6ヶ月間</strong>を最低契約期間とする。<br>
2. 期間満了の1ヶ月前までに甲乙いずれからも書面または電磁的方法（電子メール・チャット等）による終了の申し出がない場合は、同一条件で6ヶ月間自動更新するものとし、以後も同様とする。<br>
3. 最低契約期間内の中途解約時は、甲は最低契約期間残余期間分の顧問料相当額を一括して乙に支払うものとする。</p>`
              : `<p>本契約の有効期間は <strong>${today}</strong> からとし、個別業務の納品・完了をもって終了とする。</p>`}
          </div>
        `;
        const { data: cDoc } = await supabase.from('customer_documents').insert({
          document_type: 'contract',
          title: `${companyName} · 契約書（${dealTitle}）`,
          body_html: contractHtml,
          company_id: companyId,
          deal_id: dealId,
          lead_id: deal.lead_id || null,
          status: 'draft',
        }).select('id').maybeSingle();
        if (cDoc?.id) {
          contractDocId = cDoc.id;
          documentIds.push(cDoc.id);
        }
      } catch (docErr) {
        console.warn('Contract document draft auto-generation warning:', docErr);
      }

      const generatedContractId = crypto.randomUUID();
      const { data: contract, error: contractError } = await supabase
        .from('customer_contracts')
        .insert({
          id: generatedContractId,
          legacy_id: generatedContractId,
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

      if (contractError) {
        errors.push(`契約書起票: ${contractError.message}`);
      } else {
        contractId = contract?.id || generatedContractId;
        createdAny = true;
      }
    }

    // ④ 初回請求書レコード（customer_invoices）の確認・補完起票
    let invoiceId: string | undefined;
    if (!forceRecreate) {
      if (contractId) {
        const { data: existingInvoices } = await supabase
          .from('customer_invoices')
          .select('id')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: true })
          .limit(1);
        invoiceId = existingInvoices?.[0]?.id;
      }
      if (!invoiceId) {
        const { data: existingDealInv } = await supabase
          .from('customer_invoices')
          .select('id')
          .eq('company_id', companyId)
          .ilike('notes', `%商談ID: ${dealId}%`)
          .order('created_at', { ascending: true })
          .limit(1);
        invoiceId = existingDealInv?.[0]?.id;
      }
      if (!invoiceId) {
        const { data: existingTitleInv } = await supabase
          .from('customer_invoices')
          .select('id')
          .eq('company_id', companyId)
          .eq('title', `${dealTitle} 初回ご請求書`)
          .order('created_at', { ascending: true })
          .limit(1);
        invoiceId = existingTitleInv?.[0]?.id;
      }
    }

    if (!invoiceId) {
      let invoiceNumber = `INV-${today.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      let invoiceDocId: string | null = null;
      try {
        const invoiceHtml = `
          <div style="font-family: sans-serif; padding: 30px; line-height: 1.8; color: #1e293b;">
            <h1 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">御 請 求 書</h1>
            <p style="text-align: right;">請求番号: ${invoiceNumber}<br>発行日: ${today}</p>
            <p style="font-size: 18px;"><strong>${companyName} 御中</strong></p>
            <p>下記の通りご請求申し上げます。</p>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">小計（税抜）:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: bold;">¥${firstInvoiceAmount.toLocaleString('ja-JP')}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; border-bottom: 1px solid #cbd5e1;">消費税（10%）:</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: bold; border-bottom: 1px solid #cbd5e1;">¥${taxAmount.toLocaleString('ja-JP')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0 4px 0; font-size: 18px; font-weight: bold; color: #0f172a;">ご請求金額合計（税込）:</td>
                  <td style="padding: 10px 0 4px 0; text-align: right; font-size: 20px; font-weight: 800; color: #1e3a8a;">¥${firstInvoiceTotalWithTax.toLocaleString('ja-JP')}</td>
                </tr>
              </table>
            </div>
            <p style="margin-top: 20px;">お支払期日: <strong>${dueDate}（翌月末日）</strong></p>
            <p>振込先口座: ドコモSMTBネット銀行 法人第一支店 普通 2223730（口座名義：有限会社MST）</p>
          </div>
        `;
        const { data: iDoc } = await supabase.from('customer_documents').insert({
          document_type: 'invoice',
          title: `${companyName} · 初回請求書（${invoiceNumber}）`,
          body_html: invoiceHtml,
          company_id: companyId,
          deal_id: dealId,
          lead_id: deal.lead_id || null,
          status: 'draft',
        }).select('id').maybeSingle();
        if (iDoc?.id) {
          invoiceDocId = iDoc.id;
          documentIds.push(iDoc.id);
        }
      } catch (docErr) {
        console.warn('Invoice document draft auto-generation warning:', docErr);
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        const generatedInvoiceId = crypto.randomUUID();
        const invoicePayload: Record<string, any> = {
          id: generatedInvoiceId,
          legacy_id: generatedInvoiceId,
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
          notes: `商談「${dealTitle}」（商談ID: ${dealId}）成約による自動起票。支払期日: ${dueDate}。振込先: ドコモSMTBネット銀行 法人第一支店 普通 2223730（有限会社MST）。書類ID: ${invoiceDocId || 'なし'}`,
        };
        const { data: invoice, error: invoiceError } = await supabase
          .from('customer_invoices')
          .insert(invoicePayload)
          .select('id')
          .single();

        if (!invoiceError) {
          invoiceId = invoice?.id || generatedInvoiceId;
          createdAny = true;
          break;
        }
        if (invoiceError.code === '23505' && attempt === 0) {
          invoiceNumber = `INV-${today.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
          continue;
        }
        errors.push(`初回請求書起票: ${invoiceError.message}`);
        break;
      }
    }

    // ⑤ 契約後サポート案件（customer_service_engagements）の確認・補完起票
    let engagementId: string | undefined;
    if (!forceRecreate) {
      if (contractId) {
        const { data: existingEng } = await supabase
          .from('customer_service_engagements')
          .select('id')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: true })
          .limit(1);
        engagementId = existingEng?.[0]?.id;
      }
      if (!engagementId) {
        const { data: existingDealEng } = await supabase
          .from('customer_service_engagements')
          .select('id')
          .eq('company_id', companyId)
          .ilike('notes', `%商談ID: ${dealId}%`)
          .order('created_at', { ascending: true })
          .limit(1);
        engagementId = existingDealEng?.[0]?.id;
      }
      if (!engagementId) {
        const { data: existingTitleEng } = await supabase
          .from('customer_service_engagements')
          .select('id')
          .eq('company_id', companyId)
          .eq('title', `【伴走サポート】${companyName} 様 · ${dealTitle}`)
          .order('created_at', { ascending: true })
          .limit(1);
        engagementId = existingTitleEng?.[0]?.id;
      }
    }

    if (!engagementId) {
      const milestones = [
        { id: crypto.randomUUID(), phase: 1, title: '初回キックオフ・現状詳細ヒアリング', target_period: '第1週〜第2週', status: 'pending' },
        { id: crypto.randomUUID(), phase: 2, title: '急所業務の自動化・仕組み化の構築', target_period: '第1ヶ月〜第2ヶ月', status: 'pending' },
        { id: crypto.randomUUID(), phase: 3, title: '運用定着支援・定期顧問レビュー', target_period: '第3ヶ月以降', status: 'pending' },
      ];
      const supportDetails = {
        purpose: `${dealTitle}の目標達成・運用定着支援`,
        startedAt: today,
        phase: '初期導入・キックオフ準備',
        progressStatus: 'active',
        summary: scheduleNote,
      };
      const baseEngagementPayload: Record<string, any> = {
        company_id: companyId,
        contract_id: contractId || null,
        service_type: monthlyFee > 0 ? 'retainer' : 'implementation_support',
        title: `【伴走サポート】${companyName} 様 · ${dealTitle}`,
        status: 'active',
        milestone_data: milestones,
        support_details: supportDetails,
        notes: `商談成約（商談ID: ${dealId}）に伴い自動起票。${scheduleNote}`,
      };

      let engRes = await supabase
        .from('customer_service_engagements')
        .insert(baseEngagementPayload)
        .select('id')
        .single();

      if (engRes.error && isMissingColumnErr(engRes.error, 'support_details')) {
        const { support_details: _ignored, ...withoutSupportDetails } = baseEngagementPayload;
        engRes = await supabase
          .from('customer_service_engagements')
          .insert(withoutSupportDetails)
          .select('id')
          .single();
      }

      if (engRes.error) {
        errors.push(`支援案件起票: ${engRes.error.message}`);
      } else if (engRes.data) {
        engagementId = engRes.data.id;
        createdAny = true;
      }
    }

    // 紐づくリードのステータスも「成約」に同期（後戻りさせない）
    if (deal.lead_id) {
      const nextLeadStatus = resolveNonDowngradingLeadStatus(deal.lead?.status, '成約');
      if (nextLeadStatus !== deal.lead?.status) {
        await supabase
          .from('leads')
          .update({ status: nextLeadStatus, last_contacted_at: nowIso })
          .eq('id', deal.lead_id);
      }
    }

    // 主要3テーブル（契約・請求・支援）がすべて揃った場合のみ自動化完了タイムスタンプを記録
    if (contractId && invoiceId && engagementId && errors.length === 0) {
      await supabase
        .from('deals')
        .update({ won_automation_completed_at: nowIso })
        .eq('id', dealId);
    }

    if (errors.length > 0 && !createdAny) {
      return {
        success: false,
        customerId,
        contractId,
        invoiceId,
        engagementId,
        documentIds,
        createdAny,
        message: `自動起票の一部に失敗しました: ${errors.join(' / ')}`,
      };
    }

    return {
      success: errors.length === 0,
      customerId,
      contractId,
      invoiceId,
      engagementId,
      documentIds,
      createdAny,
      message: errors.length > 0
        ? `一部を起票しましたが残りの項目でエラーが発生しました: ${errors.join(' / ')}`
        : createdAny
          ? `成約処理が完了しました。顧客マスタ、契約書、初回請求書（期日: ${dueDate}）、伴走サポート案件を一括起票・連結しました。`
          : `商談（ID: ${dealId}）の契約・請求・支援データはすべて作成済みです。`,
    };
  } catch (err: any) {
    console.error('Deal won automation failed:', err);
    return {
      success: false,
      message: `自動生成中にエラーが発生しました: ${err?.message || '不明なエラー'}`,
    };
  }
}

/**
 * 成約済み（proposal_status IN ('成約', '受注', 'Won')）かつ
 * まだ自動化が完了していない商談（won_automation_completed_at IS NULL）の契約・請求・支援を一括補完する。
 * won_automation_completed_at が記録済みの商談は対象外とし、削除済みデータの復活は防ぐ。
 */
export async function reconcilePendingWonDeals(
  supabaseClient?: any,
  options?: { companyId?: string; limit?: number }
): Promise<{ checkedCount: number; completedCount: number }> {
  if (inFlightReconcile) {
    return await inFlightReconcile;
  }

  const supabase = supabaseClient || getSupabase();
  if (!supabase) return { checkedCount: 0, completedCount: 0 };

  inFlightReconcile = (async () => {
    try {
      let query = supabase
        .from('deals')
        .select('id')
        .in('proposal_status', ['成約', '受注', 'Won'])
        .is('won_automation_completed_at', null)
        .order('updated_at', { ascending: false })
        .limit(options?.limit ?? 25);

      if (options?.companyId) {
        query = query.eq('company_id', options.companyId);
      }

      const { data: pendingDeals, error } = await query;
      if (error || !pendingDeals || pendingDeals.length === 0) {
        return { checkedCount: 0, completedCount: 0 };
      }

      let completedCount = 0;
      for (const deal of pendingDeals) {
        const res = await executeDealWonAutomation(String(deal.id), false);
        if (res.success && res.createdAny) {
          completedCount += 1;
        }
      }

      return { checkedCount: pendingDeals.length, completedCount };
    } catch (err) {
      console.warn('reconcilePendingWonDeals warning:', err);
      return { checkedCount: 0, completedCount: 0 };
    } finally {
      inFlightReconcile = null;
    }
  })();

  return await inFlightReconcile;
}
