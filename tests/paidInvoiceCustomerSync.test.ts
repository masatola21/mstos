import assert from 'node:assert';
import { ensureCustomerRegisteredFromPaidInvoice } from '../src/services/paidInvoiceCustomerSync.js';

console.log('=== Running Paid Invoice Customer Auto-Registration Tests ===\n');

function createMockSupabase(initialState?: {
  companies?: any[];
  customers?: any[];
  customer_invoices?: any[];
  simulateDuplicateCustomerInsert?: boolean;
}) {
  const state = {
    companies: [...(initialState?.companies || [])],
    customers: [...(initialState?.customers || [])],
    customer_invoices: [...(initialState?.customer_invoices || [])],
  };

  const makeBuilder = (table: 'companies' | 'customers' | 'customer_invoices') => {
    const filters: Array<(row: any) => boolean> = [];
    let pendingInsert: any = null;
    let pendingUpdate: any = null;

    const executeSelect = () => state[table].filter((r) => filters.every((f) => f(r)));

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      ilike: (col: string, val: string) => {
        const needle = val.toLowerCase();
        filters.push((r) => String(r[col] || '').toLowerCase() === needle);
        return builder;
      },
      is: (col: string, val: any) => {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val));
        return builder;
      },
      limit: () => builder,
      maybeSingle: async () => {
        const rows = executeSelect();
        return { data: rows[0] || null, error: null };
      },
      insert: (payload: any) => {
        pendingInsert = payload;
        return builder;
      },
      update: (payload: any) => {
        pendingUpdate = payload;
        return builder;
      },
      single: async () => {
        if (pendingInsert) {
          if (table === 'customers' && initialState?.simulateDuplicateCustomerInsert) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          }
          const created = {
            ...pendingInsert,
            id: pendingInsert.id || (table === 'companies' ? `CID-${state.companies.length + 1}` : `cust-${state.customers.length + 1}`),
          };
          state[table].push(created);
          return { data: created, error: null };
        }
        const rows = executeSelect();
        return { data: rows[0] || null, error: null };
      },
      then: (resolve: (value: any) => void) => {
        if (pendingUpdate) {
          let updatedCount = 0;
          state[table] = state[table].map((row) => {
            if (filters.every((f) => f(row))) {
              updatedCount += 1;
              return { ...row, ...pendingUpdate };
            }
            return row;
          });
          resolve({ data: null, error: null, count: updatedCount });
          return;
        }
        resolve({ data: executeSelect(), error: null });
      },
    };
    return builder;
  };

  return {
    state,
    supabase: {
      from: (table: 'companies' | 'customers' | 'customer_invoices') => makeBuilder(table),
    },
  };
}

(async () => {
  // 1. Existing company_id with no customer -> auto-creates customer row
  {
    const { state, supabase } = createMockSupabase({
      companies: [{ id: 'CID-100', company_name: '株式会社テスト' }],
      customers: [],
    });
    const res = await ensureCustomerRegisteredFromPaidInvoice(supabase, {
      companyId: 'CID-100',
      invoiceTitle: '顧問契約 初回請求',
      invoiceNumber: 'INV-20261120-001',
      paidDate: '2026-11-20',
    });
    assert.strictEqual(res.status, 'created');
    assert.strictEqual(res.companyId, 'CID-100');
    assert.strictEqual(state.customers.length, 1);
    assert.strictEqual(state.customers[0].contract_status, '契約中');
    assert.strictEqual(state.customers[0].contract_start_date, '2026-11-20');
    assert.ok(state.customers[0].memo.includes('INV-20261120-001'));
    console.log('  ✓ Auto-registers customer when companyId has no customer row');
  }

  // 2. Existing customer row -> skips cleanly without modifying existing status/memo
  {
    const { state, supabase } = createMockSupabase({
      companies: [{ id: 'CID-101', company_name: '既存顧客株式会社' }],
      customers: [{ id: 'cust-existing', company_id: 'CID-101', contract_status: '更新交渉中', memo: '既存メモ' }],
    });
    const res = await ensureCustomerRegisteredFromPaidInvoice(supabase, {
      companyId: 'CID-101',
      invoiceTitle: '月額顧問料',
      invoiceNumber: 'INV-20261120-002',
      paidDate: '2026-11-20',
    });
    assert.strictEqual(res.status, 'already_exists');
    assert.strictEqual(res.customerId, 'cust-existing');
    assert.strictEqual(state.customers.length, 1);
    assert.strictEqual(state.customers[0].contract_status, '更新交渉中');
    console.log('  ✓ Skips cleanly when customer already exists');
  }

  // 3. No companyId on invoice, matches existing company by recipientName -> backfills & registers customer
  {
    const invUuid = '11111111-1111-1111-1111-111111111111';
    const { state, supabase } = createMockSupabase({
      companies: [{ id: 'CID-200', company_name: '山本商店' }],
      customers: [],
      customer_invoices: [{ id: invUuid, company_id: null, recipient_name: '山本商店' }],
    });
    const res = await ensureCustomerRegisteredFromPaidInvoice(supabase, {
      invoiceId: invUuid,
      companyId: null,
      recipientName: '山本商店',
      invoiceTitle: 'スポット支援請求',
      paidDate: '2026-11-19',
    });
    assert.strictEqual(res.status, 'created');
    assert.strictEqual(res.companyId, 'CID-200');
    assert.strictEqual(res.companyCreated, false);
    assert.strictEqual(state.customer_invoices[0].company_id, 'CID-200');
    assert.strictEqual(state.customers.length, 1);
    console.log('  ✓ Matches existing company by recipientName and backfills invoice company_id');
  }

  // 4. No companyId and unknown recipientName -> creates company + customer
  {
    const { state, supabase } = createMockSupabase({
      companies: [],
      customers: [],
      customer_invoices: [{ id: 'inv-legacy-1', legacy_id: 'inv-legacy-1', company_id: null }],
    });
    const res = await ensureCustomerRegisteredFromPaidInvoice(supabase, {
      invoiceId: 'inv-legacy-1',
      companyId: undefined,
      recipientName: '佐藤デザイン事務所',
      invoiceTitle: '初期構築費用',
      paidDate: '2026-11-20',
    });
    assert.strictEqual(res.status, 'created');
    assert.strictEqual(res.companyCreated, true);
    assert.strictEqual(state.companies.length, 1);
    assert.strictEqual(state.companies[0].company_name, '佐藤デザイン事務所');
    assert.strictEqual(state.customers.length, 1);
    assert.strictEqual(state.customer_invoices[0].company_id, state.companies[0].id);
    console.log('  ✓ Creates company and customer for invoice-first sole proprietor without companyId');
  }

  // 5. Missing both companyId and recipientName -> skips cleanly
  {
    const { supabase } = createMockSupabase();
    const res = await ensureCustomerRegisteredFromPaidInvoice(supabase, {
      companyId: '',
      recipientName: '',
      invoiceTitle: '不明請求書',
    });
    assert.strictEqual(res.status, 'skipped');
    console.log('  ✓ Skips cleanly when both companyId and recipientName are missing');
  }

  // 6. Race-condition 23505 unique constraint recovery -> returns already_exists cleanly
  {
    const { supabase } = createMockSupabase({
      companies: [{ id: 'CID-300', company_name: '競合テスト社' }],
      customers: [],
      simulateDuplicateCustomerInsert: true,
    });
    const res = await ensureCustomerRegisteredFromPaidInvoice(supabase, {
      companyId: 'CID-300',
      invoiceTitle: 'テスト請求',
    });
    assert.strictEqual(res.status, 'already_exists');
    console.log('  ✓ Handles 23505 unique constraint race gracefully');
  }

  console.log('\n🎉 All paid invoice customer auto-registration tests passed!');
})();
