/**
 * ユニットテスト: 書類管理（会社名・担当者名検索、顧客別グルーピング、送信ログ集計）
 * & 月次入金ベース売上集計・CSVエクスポート
 */
import {
  resolveEffectiveDocumentType,
  normalizeDocumentStatus,
  getDocumentStatusLabel,
  resolveDocumentContactName,
  filterDocuments,
  groupDocumentsByCustomer,
  summarizeOutboxByDocument,
  type DocumentCompanyRef,
  type DocumentContactRef,
  type DocumentOutboxLog,
  type DocumentRecordLike,
} from '../src/utils/documentManagement';
import {
  getInvoiceAmounts,
  getPaidMonthKey,
  getUnpaidMonthKey,
  formatYearMonthLabel,
  buildMonthSequence,
  buildMonthlyRevenueBuckets,
  filterPaidInvoicesByMonth,
  buildPaidInvoicesCsv,
} from '../src/utils/monthlyRevenue';
import {
  wrapDocVarHtml,
  replacePlaceholderWithDocVar,
  hasDocVarMarkers,
  patchDocVarHtml,
  extractDocVarTextFromHtml,
  toInteractiveRichDom,
  rehydrateLegacyProposalHtml,
  rehydrateLegacyDocumentHtml,
} from '../src/utils/documentHtmlSync';
import { getProposalReportHtml, PROPOSAL_VARIABLES } from '../src/components/matrix/proposalTemplate';
import type { ManagedInvoice } from '../src/types/matrix';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== Running Document Management & Monthly Revenue Tests ===\n');

  const companies: DocumentCompanyRef[] = [
    { id: 'cmp-a', company_name: '株式会社アルファ' },
    { id: 'cmp-b', company_name: '合同会社ベータ商事' },
  ];

  const contacts: DocumentContactRef[] = [
    { id: 'cnt-1', company_id: 'cmp-a', full_name: '山田 太郎', email: 'yamada@alpha.example' },
    { id: 'cnt-2', company_id: 'cmp-b', full_name: '佐藤 花子', email: 'sato@beta.example' },
  ];

  const docs: DocumentRecordLike[] = [
    {
      id: 'doc-1',
      title: 'DX支援お見積書（初回）',
      document_type: 'proposal',
      status: 'sent',
      company_id: 'cmp-a',
      contact_id: 'cnt-1',
      updated_at: '2026-11-10T10:00:00Z',
    },
    {
      id: 'doc-2',
      title: 'DX支援お見積書（追加発注分）',
      document_type: 'estimate',
      status: 'approved',
      company_id: 'cmp-a',
      updated_at: '2026-11-12T10:00:00Z',
    },
    {
      id: 'doc-3',
      title: '業務委託基本契約書',
      document_type: 'contract',
      status: 'draft',
      company_id: 'cmp-b',
      contact_id: 'cnt-2',
      updated_at: '2026-11-11T09:00:00Z',
    },
    {
      id: 'doc-4',
      title: '未紐付け提案書',
      document_type: 'proposal',
      status: 'archived',
      updated_at: '2026-11-01T08:00:00Z',
    },
  ];

  console.log('Test 1: resolveEffectiveDocumentType & status normalization');
  {
    assert(resolveEffectiveDocumentType(docs[0]) === 'estimate', 'proposal with 見積 in title resolves to estimate');
    assert(resolveEffectiveDocumentType(docs[2]) === 'contract', 'contract remains contract');
    assert(normalizeDocumentStatus('sent') === 'sent', 'sent status normalized');
    assert(normalizeDocumentStatus('queued') === 'approved', 'queued maps to approved');
    assert(getDocumentStatusLabel('sent') === '送信済み', 'sent label matches');
    assert(resolveDocumentContactName(docs[1], contacts) === '山田 太郎', 'falls back to company contact name');
    console.log('  ✓ document type & status helpers passed');
  }

  console.log('Test 2: filterDocuments by company name, contact name, status, and type');
  {
    const byCompany = filterDocuments(docs, companies, contacts, { query: 'アルファ' });
    assert(byCompany.length === 2, `Expected 2 docs for アルファ, got ${byCompany.length}`);

    const byContact = filterDocuments(docs, companies, contacts, { query: '佐藤 花子' });
    assert(byContact.length === 1 && byContact[0].id === 'doc-3', 'Should match contact name 佐藤 花子');

    const byStatus = filterDocuments(docs, companies, contacts, { statusFilter: 'sent' });
    assert(byStatus.length === 1 && byStatus[0].id === 'doc-1', 'Should filter sent documents');

    const byType = filterDocuments(docs, companies, contacts, { typeFilter: 'estimate' });
    assert(byType.length === 2, `Expected 2 estimates, got ${byType.length}`);
    console.log('  ✓ filterDocuments passed');
  }

  console.log('Test 3: groupDocumentsByCustomer');
  {
    const groups = groupDocumentsByCustomer(docs, companies, contacts);
    assert(groups.length === 3, `Expected 3 groups (2 companies + unassigned), got ${groups.length}`);
    assert(groups[0].companyId === 'cmp-a', 'Most recently updated company group should come first');
    assert(groups[0].counts.total === 2 && groups[0].counts.sent === 1 && groups[0].counts.approved === 1, 'Counts should match');
    assert(groups[2].companyId === null, 'Unassigned group should come last');
    console.log('  ✓ groupDocumentsByCustomer passed');
  }

  console.log('Test 4: summarizeOutboxByDocument');
  {
    const logs: DocumentOutboxLog[] = [
      { id: 'log-1', document_id: 'doc-1', channel: 'email', status: 'sent', sent_at: '2026-11-10T10:05:00Z' },
      { id: 'log-2', document_id: 'doc-1', channel: 'line', status: 'sent', sent_at: '2026-11-10T10:06:00Z' },
      { id: 'log-3', document_id: 'doc-1', channel: 'email', status: 'failed', created_at: '2026-11-10T09:50:00Z' },
    ];
    const summary = summarizeOutboxByDocument(logs);
    assert(summary['doc-1'].totalLogs === 3, 'Expected 3 total logs');
    assert(summary['doc-1'].sentCount === 2, 'Expected 2 sent logs');
    assert(summary['doc-1'].emailSentCount === 1 && summary['doc-1'].lineSentCount === 1, 'Channel breakdown mismatch');
    assert(summary['doc-1'].failedCount === 1, 'Expected 1 failed log');
    assert(summary['doc-1'].lastSentAt === '2026-11-10T10:06:00Z', 'Latest sent timestamp mismatch');
    console.log('  ✓ summarizeOutboxByDocument passed');
  }

  console.log('Test 5: getInvoiceAmounts & month helpers');
  {
    const defaultTax = getInvoiceAmounts({ amount: 100000 });
    assert(defaultTax.subtotal === 100000 && defaultTax.taxAmount === 10000 && defaultTax.totalWithTax === 110000, 'Default 10% tax');

    const explicitTax = getInvoiceAmounts({ amount: 50000, taxAmount: 4500 });
    assert(explicitTax.totalWithTax === 54500, 'Explicit taxAmount should be respected');

    assert(getPaidMonthKey({ paidDate: '2026-11-15', issueDate: '2026-10-31', dueDate: '2026-11-30' }) === '2026-11', 'Cash-basis month prefers paidDate');
    assert(getUnpaidMonthKey({ dueDate: '2026-12-31', issueDate: '2026-11-01' }) === '2026-12', 'Unpaid bucket uses dueDate');
    assert(formatYearMonthLabel('2026-01') === '2026年1月', 'Year-month label format');
    const seq = buildMonthSequence('2026-02', 3);
    assert(seq.join(',') === '2025-12,2026-01,2026-02', `Month sequence across year boundary failed: ${seq.join(',')}`);
    console.log('  ✓ invoice amount & month helpers passed');
  }

  console.log('Test 6: buildMonthlyRevenueBuckets (cash-basis grouping & MoM)');
  {
    const invoices: ManagedInvoice[] = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        title: '10月分顧問料',
        companyId: 'cmp-a',
        recipientName: '株式会社アルファ',
        amount: 100000,
        taxAmount: 10000,
        status: 'paid',
        issueDate: '2026-09-30',
        dueDate: '2026-10-31',
        paidDate: '2026-10-25',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-002',
        title: '11月分顧問料',
        companyId: 'cmp-a',
        recipientName: '株式会社アルファ',
        amount: 150000,
        taxAmount: 15000,
        status: 'paid',
        issueDate: '2026-10-31',
        dueDate: '2026-11-30',
        paidDate: '2026-11-20',
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'inv-3',
        invoiceNumber: 'INV-003',
        title: '追加スポット開発',
        companyId: 'cmp-b',
        recipientName: '合同会社ベータ商事',
        amount: 50000,
        status: 'overdue',
        issueDate: '2026-10-01',
        dueDate: '2026-11-15',
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: 'inv-4',
        invoiceNumber: 'INV-004',
        title: 'キャンセル分',
        companyId: 'cmp-b',
        recipientName: '合同会社ベータ商事',
        amount: 999999,
        status: 'canceled',
        issueDate: '2026-11-01',
        dueDate: '2026-11-30',
        createdAt: 4,
        updatedAt: 4,
      },
    ];

    const buckets = buildMonthlyRevenueBuckets(invoices, '2026-11', 2);
    assert(buckets.length === 2, 'Expected 2 monthly buckets');
    const oct = buckets[0];
    const nov = buckets[1];
    assert(oct.month === '2026-10' && oct.paidTotal === 110000 && oct.paidCount === 1, 'October cash-basis revenue mismatch');
    assert(nov.month === '2026-11' && nov.paidTotal === 165000 && nov.paidCount === 1, 'November cash-basis revenue mismatch');
    assert(nov.momDiffTotal === 55000 && nov.momDiffPercent === 50, `Expected +55000 (+50%) MoM, got ${nov.momDiffTotal} (${nov.momDiffPercent}%)`);
    assert(nov.unpaidTotal === 55000 && nov.overdueCount === 1, 'November unpaid/overdue mismatch');

    const paidNov = filterPaidInvoicesByMonth(invoices, '2026-11');
    assert(paidNov.length === 1 && paidNov[0].id === 'inv-2', 'filterPaidInvoicesByMonth mismatch');
    console.log('  ✓ buildMonthlyRevenueBuckets passed');
  }

  console.log('Test 7: buildPaidInvoicesCsv (UTF-8 BOM & escaping)');
  {
    const csvInvoices: ManagedInvoice[] = [
      {
        id: 'inv-csv',
        invoiceNumber: 'INV-202611-01',
        title: '顧問支援, "特別枠"',
        companyId: 'cmp-a',
        recipientName: '',
        amount: 200000,
        taxAmount: 20000,
        status: 'paid',
        issueDate: '2026-10-31',
        dueDate: '2026-11-30',
        paidDate: '2026-11-18',
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const csv = buildPaidInvoicesCsv(csvInvoices, (cid) => (cid === 'cmp-a' ? '株式会社アルファ' : ''));
    assert(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
    assert(csv.includes('"顧問支援, ""特別枠"""'), 'CSV must properly escape commas and double quotes');
    assert(csv.includes('2026-11-18,INV-202611-01,株式会社アルファ'), 'CSV row values mismatch');
    assert(csv.includes('200000,20000,220000'), 'CSV amounts mismatch');
    console.log('  ✓ buildPaidInvoicesCsv passed');
  }

  console.log('Test 8: documentHtmlSync (two-way form <-> WYSIWYG sync)');
  {
    const initial = `<div><p>宛先: ${wrapDocVarHtml('client_company', '株式会社アルファ')} 御中</p><p>追加の自由記述テキスト</p><p>合計: ¥${wrapDocVarHtml('total_amount', '330,000')}</p></div>`;
    assert(hasDocVarMarkers(initial) === true, 'Expected data-doc-var markers to be detected');
    assert(hasDocVarMarkers('<div><p>旧形式HTML</p></div>') === false, 'Legacy HTML without markers should return false');

    // Simulate user editing free text in WYSIWYG ("追加の自由記述テキスト" -> "カスタム修正済み文言")
    const afterDirectEdit = initial.replace('追加の自由記述テキスト', 'カスタム修正済み文言');

    // Now simulate user switching back to 項目フォーム and updating total_amount
    const patched = patchDocVarHtml(
      afterDirectEdit,
      { total_amount: '550,000' },
      (_k, v) => v,
    );
    assert(patched.hasMarkers === true && patched.updatedCount === 1, 'Expected total_amount marker to be patched');
    assert(patched.html.includes('カスタム修正済み文言'), 'Direct WYSIWYG edit must be preserved');
    assert(patched.html.includes('¥<span data-doc-var="total_amount">550,000</span>'), 'Updated form variable must reflect in HTML');

    const extracted = extractDocVarTextFromHtml(patched.html);
    assert(extracted.client_company === '株式会社アルファ', 'Extracted client_company mismatch');
    assert(extracted.total_amount === '550,000', 'Extracted total_amount mismatch');

    const legacy = patchDocVarHtml('<div>旧形式HTML</div>', { total_amount: '550,000' }, (_k, v) => v);
    assert(legacy.hasMarkers === false && legacy.updatedCount === 0, 'Legacy HTML should report hasMarkers=false');
    console.log('  ✓ documentHtmlSync passed');
  }

  console.log('Test 9: proposalTemplate (tpl-proposal-report) block/sole-child sync');
  {
    let html = getProposalReportHtml('hybrid');
    const vars: Record<string, string> = Object.fromEntries(
      PROPOSAL_VARIABLES.map((v) => [v.key, v.defaultValue || '【未入力】']),
    );
    vars.client_company = '株式会社オメガ';
    vars.p1_policy = '業務整理から着手\n自動化へ移行';
    vars.p4_initial_fee = '300,000';
    vars.p4_total = '330,000';

    for (const [k, v] of Object.entries(vars)) {
      html = replacePlaceholderWithDocVar(html, k, v);
    }

    assert(!html.includes('<div data-doc-var="p1_policy"') || !html.includes('<span data-doc-var="p1_policy">'), 'Block data-doc-var must not nest a duplicate <span data-doc-var>');
    assert(!html.includes('<p data-doc-var="client_company"') || !html.includes('<span data-doc-var="client_company">'), 'client_company <p data-doc-var> must not nest a duplicate <span>');

    // Simulate direct WYSIWYG heading edit + updating p1_policy and client_company from form after switching back
    const directEdited = html.replace('診断の結果', '診断サマリー（修正）');
    const patched = patchDocVarHtml(
      directEdited,
      {
        client_company: '株式会社デルタ',
        p1_policy: 'フェーズ1: 棚卸し\nフェーズ2: システム構築',
        p4_total: '550,000',
      },
      (_k, v) => v,
    );
    assert(patched.hasMarkers === true && patched.updatedCount === 3, `Expected 3 updated markers in proposal, got ${patched.updatedCount}`);
    assert(patched.html.includes('診断サマリー（修正）'), 'Direct edit to proposal heading must be preserved');
    assert(patched.html.includes('株式会社デルタ'), 'Updated proposal client_company must appear');
    assert(patched.html.includes('フェーズ1: 棚卸し\nフェーズ2: システム構築'), 'Updated multiline p1_policy must appear');

    const extracted = extractDocVarTextFromHtml(patched.html);
    assert(extracted.client_company === '株式会社デルタ', 'Extracted proposal client_company mismatch');
    assert(extracted.p1_policy === 'フェーズ1: 棚卸し\nフェーズ2: システム構築', 'Extracted multiline p1_policy mismatch');
    assert(extracted.p4_total === '550,000', 'Extracted proposal p4_total mismatch');

    // Verify inline header, strong date, P4 row, and D0 summary all patch cleanly
    const patchHeaderAndCost = patchDocVarHtml(
      patched.html,
      {
        proposal_title: '営業DX自動化プロジェクト',
        client_name: '鈴木 一郎',
        issue_date: '2026年12月01日',
        p4_initial_fee: '450,000',
        d0_summary: '新しい結論サマリー\n2行目の補足',
      },
      (_k, v) => v,
    );
    assert(
      patchHeaderAndCost.updatedCount === 5,
      `Expected 5 updated proposal fields across inline/strong/block, got ${patchHeaderAndCost.updatedCount}`,
    );
    const extracted2 = extractDocVarTextFromHtml(patchHeaderAndCost.html);
    assert(extracted2.proposal_title === '営業DX自動化プロジェクト', 'proposal_title mismatch');
    assert(extracted2.client_name === '鈴木 一郎', 'client_name mismatch');
    assert(extracted2.issue_date === '2026年12月01日', 'issue_date mismatch');
    assert(extracted2.p4_initial_fee === '450,000', 'p4_initial_fee mismatch');
    assert(extracted2.d0_summary === '新しい結論サマリー\n2行目の補足', 'd0_summary mismatch');

    // Verify primary occurrence takes precedence and zero-width anchors are stripped cleanly
    const dupHtml = `<div><p data-doc-var="client_company">\u200B株式会社ファースト</p><p data-doc-var="client_company">古いコピー</p></div>`;
    const dupExtracted = extractDocVarTextFromHtml(dupHtml);
    assert(dupExtracted.client_company === '株式会社ファースト', `Expected primary marker value without \\u200B, got ${dupExtracted.client_company}`);

    // SSR fallback safety when DOMParser is undefined
    assert(toInteractiveRichDom(patchHeaderAndCost.html) === patchHeaderAndCost.html, 'SSR fallback for toInteractiveRichDom');
    assert(rehydrateLegacyProposalHtml('<div><p>legacy</p></div>') === '<div><p>legacy</p></div>', 'SSR fallback for rehydrateLegacyProposalHtml');
    assert(rehydrateLegacyDocumentHtml('<div><p>legacy</p></div>', 'tpl-unified-estimate') === '<div><p>legacy</p></div>', 'SSR fallback for rehydrateLegacyDocumentHtml');
    console.log('  ✓ proposalTemplate two-way sync passed');
  }

  console.log('\n=== All Document & Monthly Revenue Tests Passed! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
