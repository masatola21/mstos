import { todayJst } from '../utils/date';

export interface PaidInvoiceCustomerSyncParams {
  invoiceId?: string;
  companyId?: string | null;
  recipientName?: string | null;
  invoiceTitle?: string | null;
  invoiceNumber?: string | null;
  paidDate?: string | null;
}

export interface PaidInvoiceCustomerSyncResult {
  status: 'already_exists' | 'created' | 'skipped' | 'error';
  companyId?: string;
  customerId?: string;
  companyCreated?: boolean;
  message: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDateString(value?: string | null): string {
  const trimmed = String(value || '').trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match && !Number.isNaN(Date.parse(match[1]))) {
    return match[1];
  }
  return todayJst();
}

function isDuplicateError(error: any): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  return /duplicate|unique/i.test(String(error.message || ''));
}

/**
 * 請求書が「入金済 (paid)」になったタイミングで、
 * 契約書を経由していない（請求先行の）取引であっても取りこぼさないよう、
 * 顧客台帳 (customers) に未登録であれば自動で「契約中」として登録する。
 */
export async function ensureCustomerRegisteredFromPaidInvoice(
  supabase: any,
  params: PaidInvoiceCustomerSyncParams,
): Promise<PaidInvoiceCustomerSyncResult> {
  if (!supabase) {
    return {
      status: 'skipped',
      message: 'Supabaseに接続できないため顧客台帳登録をスキップしました。',
    };
  }

  let companyId = String(params.companyId || '').trim() || undefined;
  let companyCreated = false;

  if (!companyId) {
    const cleanRecipient = String(params.recipientName || '').trim();
    if (!cleanRecipient) {
      return {
        status: 'skipped',
        message: '会社IDおよび請求先名が未設定のため、顧客台帳への自動登録をスキップしました。',
      };
    }

    try {
      const { data: exactCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('company_name', cleanRecipient)
        .limit(1)
        .maybeSingle();

      if (exactCompany?.id) {
        companyId = String(exactCompany.id);
      } else if (!cleanRecipient.includes('%') && !cleanRecipient.includes('_')) {
        const { data: ilikeCompany } = await supabase
          .from('companies')
          .select('id')
          .ilike('company_name', cleanRecipient)
          .limit(1)
          .maybeSingle();
        if (ilikeCompany?.id) {
          companyId = String(ilikeCompany.id);
        }
      }

      if (!companyId) {
        const firstTry = await supabase
          .from('companies')
          .insert({ company_name: cleanRecipient })
          .select('id')
          .single();

        if (!firstTry.error && firstTry.data?.id) {
          companyId = String(firstTry.data.id);
          companyCreated = true;
        } else {
          const fallbackCompanyId = `CID-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
          const retry = await supabase
            .from('companies')
            .insert({ id: fallbackCompanyId, company_name: cleanRecipient })
            .select('id')
            .single();
          if (retry.error || !retry.data?.id) {
            return {
              status: 'error',
              message: retry.error?.message || firstTry.error?.message || '取引先マスタの作成に失敗しました。',
            };
          }
          companyId = String(retry.data.id);
          companyCreated = true;
        }
      }

      // 請求書に company_id が未設定だった場合のみ補完
      const invoiceId = String(params.invoiceId || '').trim();
      if (companyId && invoiceId) {
        try {
          const column = UUID_REGEX.test(invoiceId) ? 'id' : 'legacy_id';
          await supabase
            .from('customer_invoices')
            .update({ company_id: companyId, updated_at: new Date().toISOString() })
            .eq(column, invoiceId)
            .is('company_id', null);
        } catch {
          // Non-fatal backfill
        }
      }
    } catch (err: any) {
      return {
        status: 'error',
        message: err?.message || '請求先企業の解決中にエラーが発生しました。',
      };
    }
  }

  try {
    const { data: existingCustomer, error: lookupError } = await supabase
      .from('customers')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (lookupError) {
      return {
        status: 'error',
        companyId,
        companyCreated,
        message: lookupError.message || '顧客台帳の確認に失敗しました。',
      };
    }

    if (existingCustomer?.id) {
      return {
        status: 'already_exists',
        companyId,
        customerId: String(existingCustomer.id),
        companyCreated,
        message: '既に顧客台帳に登録済みのためスキップしました。',
      };
    }

    const nowIso = new Date().toISOString();
    const startDate = normalizeDateString(params.paidDate);
    const invoiceLabel = [params.invoiceTitle?.trim(), params.invoiceNumber?.trim()]
      .filter(Boolean)
      .join(' / ') || '請求書';

    const { data: insertedCustomer, error: insertError } = await supabase
      .from('customers')
      .insert({
        company_id: companyId,
        contract_status: '契約中',
        contract_start_date: startDate,
        memo: `請求書「${invoiceLabel}」の入金確認に伴い自動登録`,
        last_updated_at: nowIso,
      })
      .select('id')
      .single();

    if (insertError) {
      if (isDuplicateError(insertError)) {
        const { data: racedCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('company_id', companyId)
          .maybeSingle();
        return {
          status: 'already_exists',
          companyId,
          customerId: racedCustomer?.id ? String(racedCustomer.id) : undefined,
          companyCreated,
          message: '既に顧客台帳に登録済みのためスキップしました。',
        };
      }
      return {
        status: 'error',
        companyId,
        companyCreated,
        message: insertError.message || '顧客台帳への自動登録に失敗しました。',
      };
    }

    return {
      status: 'created',
      companyId,
      customerId: insertedCustomer?.id ? String(insertedCustomer.id) : undefined,
      companyCreated,
      message: '入金確認に伴い、未登録だった顧客を顧客台帳へ「契約中」として自動登録しました。',
    };
  } catch (err: any) {
    return {
      status: 'error',
      companyId,
      companyCreated,
      message: err?.message || '顧客台帳への自動登録処理中にエラーが発生しました。',
    };
  }
}
