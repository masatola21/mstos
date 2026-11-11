import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { todayJst } from '../../utils/date';
import { 
  FileText, 
  FileCheck2, 
  Receipt, 
  Printer, 
  Copy, 
  Check, 
  Sliders, 
  FileCode,
  ExternalLink,
  Link2,
  Calculator,
  BarChart3,
  Send,
  Inbox,
  Coins,
  RefreshCw,
  Save,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import {
  getEndOfNextMonthDate,
  getOneMonthLaterDate,
  calculateMilestoneAmounts,
  calculateInstallmentAmounts,
} from '../../utils/billingUtils';

import {
  DocTemplateType,
  DocTemplate,
  PaymentMode,
  InvoiceSubtype,
  CORE_TEMPLATES,
  getDynamicTemplateHtml,
  normalizeTemplateId,
  getTemplateDefaultValues,
} from './documentGenerators';

export type { DocTemplateType, DocTemplate, PaymentMode, InvoiceSubtype };

const addOneMonthDate = (date = todayJst()) => getOneMonthLaterDate(date);
const invoiceDueDate = (date = todayJst()) => getEndOfNextMonthDate(date);
const formatDocumentDate = (value: string) => value ? value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日') : '';
const formatDocumentValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatDocumentValue).filter(Boolean).join(' / ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directText = formatDocumentValue(record.title || record.description || record.text || '');
    return directText || Object.values(record).map(formatDocumentValue).filter(Boolean).join(' / ');
  }
  return '';
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => {
  const replacements: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return replacements[char] || char;
});

const DEFAULT_TEMPLATES: DocTemplate[] = CORE_TEMPLATES;

interface DocumentTemplateViewProps { 
  initialCompanyId?: string; 
  initialLeadId?: string; 
  initialDealId?: string; 
  initialDocumentType?: DocTemplateType; 
  onOpenSendCenter?: (params: { companyId?: string; documentId?: string; dealId?: string; contactId?: string }) => void;
  onNavigateTab?: (tab: string) => void;
}

export const DocumentTemplateView: React.FC<DocumentTemplateViewProps> = ({ 
  initialCompanyId, 
  initialLeadId, 
  initialDealId, 
  initialDocumentType,
  onOpenSendCenter,
  onNavigateTab
}) => {
  const [templates, setTemplates] = useState<DocTemplate[]>(DEFAULT_TEMPLATES);
  const [templateStatus, setTemplateStatus] = useState('');
  
  // 5 unified templates state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (initialDocumentType === 'invoice') return 'tpl-unified-invoice';
    if (initialDealId || initialDocumentType === 'estimate') return 'tpl-unified-estimate';
    if (initialDocumentType === 'contract') return 'tpl-unified-contract';
    if (initialDocumentType === 'monthly_report') return 'tpl-monthly-report-01';
    return 'tpl-proposal-report';
  });

  // Dynamic inside-template modes
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('lump_sum');
  const [invoiceSubtype, setInvoiceSubtype] = useState<InvoiceSubtype>('lump_sum');
  const [customHtmlOverride, setCustomHtmlOverride] = useState<string | null>(null);

  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedApplyUrl, setCopiedApplyUrl] = useState<boolean>(false);
  const [companies, setCompanies] = useState<Array<{id:string;company_name:string}>>([]);
  const [contacts, setContacts] = useState<Array<{id:string;full_name:string;company_id?:string|null;email?:string|null;phone?:string|null;role_title?:string|null}>>([]);
  const [deals, setDeals] = useState<Array<{id:string;proposal_plan_name:string;company_id?:string|null;lead_id?:string|null}>>([]);
  const [leads, setLeads] = useState<Array<{id:string;source?:string|null;status?:string|null;company_id?:string|null}>>([]);
  const [companyId, setCompanyId] = useState(initialCompanyId || '');
  const [leadId, setLeadId] = useState(initialLeadId || '');
  const [contactId, setContactId] = useState('');
  const [dealId, setDealId] = useState(initialDealId || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [hasStartedDocument, setHasStartedDocument] = useState<boolean>(false);
  const [isSavingDocument, setIsSavingDocument] = useState<boolean>(false);
  const [savedDocIds, setSavedDocIds] = useState<Record<string, string>>({});
  const autosavedDocumentIds = useRef<Record<string, string>>({});
  const autosaveQueues = useRef<Record<string, Promise<void>>>({});

  // Active template resolution
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Variable inputs state
  const [variableValues, setVariableValues] = useState<Record<string, string>>(() => {
    const today = todayJst();
    const activeId = initialDocumentType === 'invoice' 
      ? 'tpl-unified-invoice' 
      : initialDealId 
      ? 'tpl-unified-estimate' 
      : 'tpl-proposal-report';
    return getTemplateDefaultValues(activeId, today, 'lump_sum', 'lump_sum');
  });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void Promise.all([
      supabase.from('companies').select('id,company_name').order('company_name'),
      supabase.from('contacts').select('id,full_name,company_id,email,phone,role_title').order('full_name'),
      supabase.from('deals').select('id,proposal_plan_name,company_id,lead_id').order('created_at',{ascending:false}),
      supabase.from('leads').select('id,source,status,company_id').order('created_at',{ascending:false}),
    ]).then(([companyResult,contactResult,dealResult,leadResult]) => {
      const loadedCompanies = companyResult.data || [];
      const loadedContacts = contactResult.data || [];
      const loadedDeals = dealResult.data || [];
      const loadedLeads = leadResult.data || [];
      if (!companyResult.error) setCompanies(loadedCompanies);
      if (!contactResult.error) setContacts(loadedContacts);
      if (!dealResult.error) setDeals(loadedDeals);
      if (!leadResult.error) setLeads(loadedLeads);
      if (!initialCompanyId && initialDealId) {
        const sourceDeal = loadedDeals.find((deal: { id: string; company_id?: string | null; lead_id?: string | null }) => deal.id === initialDealId);
        if (sourceDeal?.company_id) setCompanyId(sourceDeal.company_id);
        if (sourceDeal?.lead_id) setLeadId(sourceDeal.lead_id);
      } else if (!initialCompanyId && initialLeadId) {
        const sourceLead = loadedLeads.find((lead: { id: string; company_id?: string | null }) => lead.id === initialLeadId);
        if (sourceLead?.company_id) setCompanyId(sourceLead.company_id);
      }
    });
  }, [initialCompanyId, initialDealId, initialLeadId]);

  // Sync templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const { data, error } = await supabase.from('customer_document_templates').select('*').order('created_at');
        if (error) { 
          setTemplateStatus('最新の統合テンプレート（5種）を読み込みました。'); 
          return; 
        }
        // Always prioritize the 5 unified templates
        setTemplates(DEFAULT_TEMPLATES);
        if (data?.length === 0) {
          const defaults = DEFAULT_TEMPLATES.map((template) => ({
            template_key: template.id,
            document_type: template.type === 'report' ? 'diagnosis_report' : template.type,
            title: template.title,
            description: template.description,
            body_html: template.htmlContent,
            variables: template.variables,
          }));
          await supabase.from('customer_document_templates').insert(defaults);
        }
      } catch {
        setTemplates(DEFAULT_TEMPLATES);
      }
    };
    void loadTemplates();
  }, []);

  // Pull CRM, deal, and diagnosis data into matching template variables.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || (!companyId && !leadId && !dealId && !contactId)) return;
    let cancelled = false;
    const populate = async () => {
      const [companyResult, leadResult, dealResult, contactResult] = await Promise.all([
        companyId ? supabase.from('companies').select('*').eq('id', companyId).maybeSingle() : Promise.resolve({data:null}),
        leadId ? supabase.from('leads').select('*').eq('id', leadId).maybeSingle() : Promise.resolve({data:null}),
        dealId ? supabase.from('deals').select('*').eq('id', dealId).maybeSingle() : Promise.resolve({data:null}),
        contactId ? supabase.from('contacts').select('*').eq('id', contactId).maybeSingle() : Promise.resolve({data:null}),
      ]);
      const lead = leadResult.data;
      const deal = dealResult.data;
      const contact = contactResult.data;
      const resolvedCompanyId = companyId || deal?.company_id || lead?.company_id || contact?.company_id || '';
      const company = companyResult.data || (resolvedCompanyId
        ? (await supabase.from('companies').select('*').eq('id', resolvedCompanyId).maybeSingle()).data
        : null);
      const customerResult = resolvedCompanyId ? await supabase.from('customers').select('contract_start_date').eq('company_id', resolvedCompanyId).maybeSingle() : { data: null };
      
      let diagnosis: any = null;
      let formSubmission: any = null;
      if (leadId || resolvedCompanyId) {
        let diagnosisQuery = supabase.from('diagnoses').select('*').order('created_at', {ascending:false}).limit(1);
        diagnosisQuery = leadId ? diagnosisQuery.eq('lead_id', leadId) : diagnosisQuery.eq('company_id', resolvedCompanyId);
        const result = await diagnosisQuery.maybeSingle();
        diagnosis = result.data;

        let subQuery = supabase.from('diagnosis_submissions').select('*').order('submitted_at', {ascending:false}).limit(1);
        subQuery = leadId ? subQuery.eq('lead_id', leadId) : subQuery.eq('company_id', resolvedCompanyId);
        const subResult = await subQuery.maybeSingle();
        formSubmission = subResult.data;
      }
      let report: any = null;
      if (diagnosis?.id) {
        const result = await supabase.from('ai_reports').select('*').eq('diagnosis_id', diagnosis.id).eq('is_latest', true).maybeSingle();
        report = result.data;
      }
      let productName = '';
      let product: any = null;
      if (deal?.product_id) {
        const result = await supabase.from('products').select('product_name,initial_fee,monthly_fee,description').eq('id', deal.product_id).maybeSingle();
        product = result.data;
        productName = product?.product_name || '';
      }
      if (cancelled) return;
      const score = diagnosis?.score;
      const recommendations = report?.recommendations;
      const recommendationText = formatDocumentValue(recommendations);
      const submissionAnswers = (formSubmission?.answers || diagnosis?.answers || {}) as Record<string, unknown>;
      const rawBottleneck = Object.entries(submissionAnswers).find(([k, v]) => typeof v === 'string' && (k.includes('bottleneck') || k.includes('issue') || k.includes('challenge') || k.includes('problem') || k.includes('悩') || k.includes('課題')))?.[1] as string | undefined;
      const challengeText = formatDocumentValue(report?.challenges) || rawBottleneck || '';
      const today = todayJst();
      const quoteExpiry = addOneMonthDate();
      const invoiceDue = invoiceDueDate();
      const initialFee = Number(deal?.initial_fee ?? product?.initial_fee ?? 0);
      const monthlyFee = Number(deal?.monthly_fee ?? product?.monthly_fee ?? 0);
      const dealAmount = Number(deal?.total_amount ?? 0);
      const subtotal = dealAmount > 0 ? dealAmount : (initialFee + monthlyFee);
      const tax = Math.floor(subtotal * 0.1);
      const total = subtotal + tax;
      const invoiceNumber = `INV-${today.replaceAll('-', '')}-${(deal?.id || crypto.randomUUID()).slice(0, 6).toUpperCase()}`;

      // Milestone calculations (50% / 50%)
      const mb = calculateMilestoneAmounts(subtotal, 0.5);

      // Installment calculations (3 installments)
      const inst = calculateInstallmentAmounts(subtotal, 3);

      const defaultTerms = paymentMode === 'milestone'
        ? '着手金（50%）：契約締結後翌月末日振込 ／ 残金（50%）：導入検収月翌月末日振込'
        : paymentMode.startsWith('installments')
        ? `毎月末日締め翌月末日振込（全${paymentMode === 'installments_6' ? '6' : '3'}回均等分割・期限の利益喪失条項あり）`
        : paymentMode === 'retainer'
        ? '毎月末日締め翌月末日振込（最低6ヶ月契約・自動更新条項あり）'
        : deal?.memo || '月末締め翌月末日振込（翌月末日一括払い）';

      const values: Record<string, string> = {
        client_company: company?.company_name || '',
        client_name: contact?.full_name || company?.contact_name || '',
        client_address: company?.address || '',
        client_rep: contact?.role_title?.includes('代表') ? contact.full_name : '',
        start_date: customerResult.data?.contract_start_date ? formatDocumentDate(String(customerResult.data.contract_start_date).slice(0,10)) : '',
        end_date: '',
        my_company: '有限会社MST', 
        my_address: '〒503-0981　岐阜県大垣市桧町127番地', 
        my_rep: '大橋真人', 
        sender_name: '大橋真人', 
        sender_company: '有限会社MST',
        bank_account_info: 'ドコモSMTBネット銀行　法人第一支店　普通預金　2223730（口座名義：有限会社MST）',
        sender_address: '〒503-0981　岐阜県大垣市桧町127番地', 
        sender_rep: '大橋真人',
        payment_terms: defaultTerms,
        cost_breakdown: [initialFee > 0 ? `初期構築費 ${initialFee.toLocaleString('ja-JP')}円` : '', monthlyFee > 0 ? `月額顧問料 ${monthlyFee.toLocaleString('ja-JP')}円` : ''].filter(Boolean).join(' / '),
        proposal_title: deal?.proposal_plan_name || deal?.deal_name || '経営の仕組み化 × 利益改善 伴走ご提案書',
        project_name: deal?.proposal_plan_name || deal?.deal_name || productName || '業務改善・自動化システム構築',
        total_project_amount: subtotal > 0 ? subtotal.toLocaleString('ja-JP') : '',
        total_amount: total > 0 ? total.toLocaleString('ja-JP') : '',
        subtotal_amount: subtotal > 0 ? subtotal.toLocaleString('ja-JP') : '',
        tax_amount: tax > 0 ? tax.toLocaleString('ja-JP') : '',
        initial_fee: initialFee > 0 ? initialFee.toLocaleString('ja-JP') : '300,000',
        initial_fee_tax: initialFee > 0 ? Math.floor(initialFee * 0.1).toLocaleString('ja-JP') : '30,000',
        initial_fee_tax_included: initialFee > 0 ? Math.floor(initialFee * 1.1).toLocaleString('ja-JP') : '330,000',
        monthly_fee: monthlyFee > 0 ? monthlyFee.toLocaleString('ja-JP') : '100,000',
        monthly_fee_tax: monthlyFee > 0 ? Math.floor(monthlyFee * 0.1).toLocaleString('ja-JP') : '10,000',
        monthly_fee_tax_included: monthlyFee > 0 ? Math.floor(monthlyFee * 1.1).toLocaleString('ja-JP') : '110,000',
        monthly_amount: monthlyFee > 0 ? monthlyFee.toLocaleString('ja-JP') : '100,000',
        tax_included_amount: monthlyFee > 0 ? Math.floor(monthlyFee * 1.1).toLocaleString('ja-JP') : '110,000',
        deposit_rate: '50',
        deposit_subtotal: mb.depositSubtotal > 0 ? mb.depositSubtotal.toLocaleString('ja-JP') : '',
        deposit_tax: mb.depositTax > 0 ? mb.depositTax.toLocaleString('ja-JP') : '',
        deposit_total: mb.depositTotalWithTax > 0 ? mb.depositTotalWithTax.toLocaleString('ja-JP') : '',
        completion_rate: '50',
        completion_subtotal: mb.completionSubtotal > 0 ? mb.completionSubtotal.toLocaleString('ja-JP') : '',
        completion_tax: mb.completionTax > 0 ? mb.completionTax.toLocaleString('ja-JP') : '',
        completion_total: mb.completionTotalWithTax > 0 ? mb.completionTotalWithTax.toLocaleString('ja-JP') : '',
        installment_number: '1',
        installment_count: '3',
        installment_subtotal: inst.installments[0]?.subtotal ? inst.installments[0].subtotal.toLocaleString('ja-JP') : '',
        installment_tax: inst.installments[0]?.tax ? inst.installments[0].tax.toLocaleString('ja-JP') : '',
        installment_amount: inst.installments[0]?.totalWithTax ? inst.installments[0].totalWithTax.toLocaleString('ja-JP') : '',
        invoice_number: invoiceNumber,
        item_name_1: deal?.proposal_plan_name || deal?.deal_name || productName || 'サービス提供費',
        item_qty_1: '1', 
        item_price_1: subtotal > 0 ? subtotal.toLocaleString('ja-JP') : '', 
        item_amount_1: subtotal > 0 ? subtotal.toLocaleString('ja-JP') : '',
        item_name_2: 'なし', 
        item_qty_2: '0', 
        item_price_2: '', 
        item_amount_2: '',
        issue_date: formatDocumentDate(today),
        due_date: formatDocumentDate(selectedTemplateId.includes('estimate') ? quoteExpiry : invoiceDue),
        overall_score: score == null ? '72' : String(score),
        primary_bottleneck: challengeText || '現場拘束と手作業の二重入力による経営時間の圧迫',
        bottleneck_impact: report?.summary || '請求・見積の手作業や顧客対応の遅れにより、月間約25時間の経営リソースが現場に奪われ、売上につながる次の一手が後回しになっています。',
        company_before: '手作業や属人化により、売上はあるのに手元に利益が残らず、仕事が特定の人に集中している',
        company_after: '業務が仕組みで回り、限られた人員でもミスなく自動連携し、売上だけでなく利益がしっかり残る会社へ',
        ceo_before: '日々の火消しや業務処理に追われ、会社の改善や戦略を考える時間が奪われている',
        ceo_after: '現場から解放され、本来向き合うべき「経営判断」「人材育成」「次の一手（新規事業）」に集中できる',
        phase1_action: '【業務・時間の急所解消】毎月の請求・見積・顧客情報の重複入力を自動化し、月20時間以上の経営時間を即座に創出',
        phase2_action: '【売上・集客の導線構築】LINE・メール・CRMを連携し、集客から問い合わせ・商談・顧客フォローが自動でつながる流れを構築',
        phase3_action: '【経営の自走化・新規事業】経営戦略・利益改善顧問の定期伴走により、新たな収益源の創出と自走組織を実現',
        current_challenge: challengeText || '手作業や二重入力に時間を奪われ、改善を着手したいが日々の業務に追われて優先順位が決まらない状態です。',
        solution_overview: product?.description || '経営戦略・利益改善顧問および業務自動化パッケージにより、手作業の撲滅と利益の残る仕組み化を同時に進めます。',
        expected_outcome: recommendationText || '現場の手作業が自動化され、月20時間以上の余白を創出。経営者が次の一手を選べる経営体質へ変革します。',
        recommended_product: productName || '業務改善・IT・DX顧問 ＋ 業務自動化パッケージ',
      };
      setVariableValues((prev) => ({...prev, ...values}));
    };
    void populate();
    return () => { cancelled = true; };
  }, [companyId, leadId, dealId, contactId, selectedTemplateId, paymentMode]);

  // When switching unified template, load its default variables and reset custom override
  const handleSelectTemplate = (rawId: string) => {
    const id = normalizeTemplateId(rawId);
    setSelectedTemplateId(id);
    setCustomHtmlOverride(null);
    const today = todayJst();
    const defaults = getTemplateDefaultValues(id, today, paymentMode, invoiceSubtype);
    setVariableValues((prev) => ({
      ...defaults,
      ...prev,
      ...defaults,
      client_company: prev.client_company || defaults.client_company || '',
      issue_date: formatDocumentDate(today),
      due_date: formatDocumentDate(id.includes('estimate') ? addOneMonthDate(today) : invoiceDueDate(today)),
    }));
    setIsEditingTemplate(false);
  };

  const handleVariableChange = (key: string, value: string) => {
    setHasStartedDocument(true);
    setVariableValues((prev) => ({ ...prev, [key]: value }));
  };

  // Switch Payment Mode (for Estimate and Contract)
  const switchPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    setHasStartedDocument(true);
    setCustomHtmlOverride(null); // allow dynamic generator to re-render table/clauses
    const parseNum = (v?: string) => Number((v || '').replace(/[^\d]/g, '')) || 0;
    const rawSubtotal = parseNum(variableValues.subtotal_amount) || parseNum(variableValues.total_project_amount) || 300000;
    const today = todayJst();
    const nextMonthEnd = invoiceDueDate(today);
    const oneMonthLater = addOneMonthDate(today);

    if (mode === 'lump_sum') {
      const tax = Math.floor(rawSubtotal * 0.1);
      const total = rawSubtotal + tax;
      setVariableValues((prev) => ({
        ...prev,
        payment_terms: '契約締結月の翌月末日振込（一括払い）',
        due_date: formatDocumentDate(selectedTemplateId.includes('estimate') ? oneMonthLater : nextMonthEnd),
        subtotal_amount: rawSubtotal.toLocaleString('ja-JP'),
        tax_amount: tax.toLocaleString('ja-JP'),
        total_amount: total.toLocaleString('ja-JP'),
      }));
    } else if (mode === 'retainer') {
      const monthly = parseNum(variableValues.monthly_fee) || 100000;
      const initial = parseNum(variableValues.initial_fee) || 0;
      const sub = monthly + initial;
      const tax = Math.floor(sub * 0.1);
      const total = sub + tax;
      setVariableValues((prev) => ({
        ...prev,
        monthly_fee: monthly.toLocaleString('ja-JP'),
        initial_fee: initial > 0 ? initial.toLocaleString('ja-JP') : '0',
        payment_terms: '毎月末日締め翌月末日振込（月額顧問契約・最低契約期間6ヶ月・自動更新条項あり）',
        due_date: formatDocumentDate(selectedTemplateId.includes('estimate') ? oneMonthLater : nextMonthEnd),
        cost_breakdown: initial > 0 ? `初期費用 ${initial.toLocaleString('ja-JP')}円 / 月額顧問料 ${monthly.toLocaleString('ja-JP')}円` : `月額顧問料 ${monthly.toLocaleString('ja-JP')}円`,
        subtotal_amount: sub.toLocaleString('ja-JP'),
        tax_amount: tax.toLocaleString('ja-JP'),
        total_amount: total.toLocaleString('ja-JP'),
      }));
    } else if (mode === 'milestone') {
      const mb = calculateMilestoneAmounts(rawSubtotal, 0.5);
      setVariableValues((prev) => ({
        ...prev,
        deposit_rate: '50',
        completion_rate: '50',
        total_project_amount: rawSubtotal.toLocaleString('ja-JP'),
        deposit_subtotal: mb.depositSubtotal.toLocaleString('ja-JP'),
        deposit_tax: mb.depositTax.toLocaleString('ja-JP'),
        deposit_total: mb.depositTotalWithTax.toLocaleString('ja-JP'),
        completion_subtotal: mb.completionSubtotal.toLocaleString('ja-JP'),
        completion_tax: mb.completionTax.toLocaleString('ja-JP'),
        completion_total: mb.completionTotalWithTax.toLocaleString('ja-JP'),
        subtotal_amount: rawSubtotal.toLocaleString('ja-JP'),
        tax_amount: (mb.depositTax + mb.completionTax).toLocaleString('ja-JP'),
        total_amount: mb.totalWithTax.toLocaleString('ja-JP'),
        payment_terms: '着手金（50%）：契約締結後翌月末日振込 ／ 残金（50%）：導入検収月翌月末日振込',
        due_date: formatDocumentDate(selectedTemplateId.includes('estimate') ? oneMonthLater : nextMonthEnd),
      }));
    } else if (mode === 'installments_3') {
      const inst = calculateInstallmentAmounts(rawSubtotal, 3);
      setVariableValues((prev) => ({
        ...prev,
        installment_count: '3',
        installment_number: '1',
        installment_subtotal: (inst.installments[0]?.subtotal ?? 0).toLocaleString('ja-JP'),
        installment_tax: (inst.installments[0]?.tax ?? 0).toLocaleString('ja-JP'),
        installment_amount: (inst.installments[0]?.totalWithTax ?? 0).toLocaleString('ja-JP'),
        subtotal_amount: rawSubtotal.toLocaleString('ja-JP'),
        tax_amount: (inst.totalWithTax - inst.totalSubtotal).toLocaleString('ja-JP'),
        total_amount: inst.totalWithTax.toLocaleString('ja-JP'),
        payment_terms: '毎月末日締め翌月末日振込（全3回均等分割払い・期限の利益喪失条項あり）',
        due_date: formatDocumentDate(selectedTemplateId.includes('estimate') ? oneMonthLater : nextMonthEnd),
      }));
    } else if (mode === 'hybrid_setup_retainer') {
      const initial = parseNum(variableValues.initial_fee) || 300000;
      const monthly = parseNum(variableValues.monthly_fee) || 100000;
      const initialTax = Math.floor(initial * 0.1);
      const monthlyTax = Math.floor(monthly * 0.1);
      const sub = initial + monthly;
      const tax = initialTax + monthlyTax;
      const total = sub + tax;
      setVariableValues((prev) => ({
        ...prev,
        initial_fee: initial.toLocaleString('ja-JP'),
        initial_fee_tax: initialTax.toLocaleString('ja-JP'),
        initial_fee_tax_included: (initial + initialTax).toLocaleString('ja-JP'),
        monthly_fee: monthly.toLocaleString('ja-JP'),
        monthly_fee_tax: monthlyTax.toLocaleString('ja-JP'),
        monthly_fee_tax_included: (monthly + monthlyTax).toLocaleString('ja-JP'),
        subtotal_amount: sub.toLocaleString('ja-JP'),
        tax_amount: tax.toLocaleString('ja-JP'),
        total_amount: total.toLocaleString('ja-JP'),
        payment_terms: '初期構築費：契約締結月の翌月末日振込 ／ 月額顧問料：毎月末日締め翌月末日振込（最低6ヶ月契約）',
        due_date: formatDocumentDate(selectedTemplateId.includes('estimate') ? oneMonthLater : nextMonthEnd),
        cost_breakdown: `初期構築費 ${initial.toLocaleString('ja-JP')}円 ＋ 月額顧問料 ${monthly.toLocaleString('ja-JP')}円/月`,
      }));
    } else if (mode === 'installments_6') {
      const inst = calculateInstallmentAmounts(rawSubtotal, 6);
      setVariableValues((prev) => ({
        ...prev,
        installment_count: '6',
        installment_number: '1',
        installment_subtotal: (inst.installments[0]?.subtotal ?? 0).toLocaleString('ja-JP'),
        installment_tax: (inst.installments[0]?.tax ?? 0).toLocaleString('ja-JP'),
        installment_amount: (inst.installments[0]?.totalWithTax ?? 0).toLocaleString('ja-JP'),
        subtotal_amount: rawSubtotal.toLocaleString('ja-JP'),
        tax_amount: (inst.totalWithTax - inst.totalSubtotal).toLocaleString('ja-JP'),
        total_amount: inst.totalWithTax.toLocaleString('ja-JP'),
        payment_terms: '毎月末日締め翌月末日振込（全6回均等分割払い・期限の利益喪失条項あり）',
        due_date: formatDocumentDate(selectedTemplateId.includes('estimate') ? oneMonthLater : nextMonthEnd),
      }));
    }
  };

  // Switch Invoice Subtype (for Invoice)
  const switchInvoiceSubtype = (subtype: InvoiceSubtype) => {
    setInvoiceSubtype(subtype);
    setHasStartedDocument(true);
    setCustomHtmlOverride(null);
    const parseNum = (v?: string) => Number((v || '').replace(/[^\d]/g, '')) || 0;
    const baseSubtotal = parseNum(variableValues.total_project_amount) || parseNum(variableValues.subtotal_amount) || 300000;
    const today = todayJst();
    const nextMonthEnd = invoiceDueDate(today);

    if (subtype === 'hybrid_setup_retainer') {
      const initial = parseNum(variableValues.initial_fee) || 300000;
      const monthly = parseNum(variableValues.monthly_fee) || 100000;
      const initialTax = Math.floor(initial * 0.1);
      const monthlyTax = Math.floor(monthly * 0.1);
      const sub = initial + monthly;
      const tax = initialTax + monthlyTax;
      const total = sub + tax;
      setVariableValues((prev) => ({
        ...prev,
        initial_fee: initial.toLocaleString('ja-JP'),
        initial_fee_tax: initialTax.toLocaleString('ja-JP'),
        initial_fee_tax_included: (initial + initialTax).toLocaleString('ja-JP'),
        monthly_fee: monthly.toLocaleString('ja-JP'),
        monthly_fee_tax: monthlyTax.toLocaleString('ja-JP'),
        monthly_fee_tax_included: (monthly + monthlyTax).toLocaleString('ja-JP'),
        item_name_1: '初期システム構築・導入設定費（一時金）',
        item_qty_1: '1',
        item_price_1: initial.toLocaleString('ja-JP'),
        item_amount_1: initial.toLocaleString('ja-JP'),
        item_name_2: `月額経営改善・DX顧問支援料（${prev.billing_month || '当月度分'}）`,
        item_qty_2: '1',
        item_price_2: monthly.toLocaleString('ja-JP'),
        item_amount_2: monthly.toLocaleString('ja-JP'),
        subtotal_amount: sub.toLocaleString('ja-JP'),
        tax_amount: tax.toLocaleString('ja-JP'),
        total_amount: total.toLocaleString('ja-JP'),
        due_date: formatDocumentDate(nextMonthEnd),
        payment_terms: '翌月末日振込（初期構築費および初月度顧問支援料の合算）',
      }));
    } else if (subtype === 'deposit') {
      const mb = calculateMilestoneAmounts(baseSubtotal, 0.5);
      setVariableValues((prev) => ({
        ...prev,
        item_name_1: '着手金（プロジェクト着手金 50%）',
        item_qty_1: '1',
        item_price_1: mb.depositSubtotal.toLocaleString('ja-JP'),
        item_amount_1: mb.depositSubtotal.toLocaleString('ja-JP'),
        item_name_2: 'なし',
        item_qty_2: '0',
        item_price_2: '',
        item_amount_2: '',
        subtotal_amount: mb.depositSubtotal.toLocaleString('ja-JP'),
        tax_amount: mb.depositTax.toLocaleString('ja-JP'),
        total_amount: mb.depositTotalWithTax.toLocaleString('ja-JP'),
        due_date: formatDocumentDate(nextMonthEnd),
        payment_terms: '契約締結月の翌月末日振込（着手金50%）',
      }));
    } else if (subtype === 'completion') {
      const mb = calculateMilestoneAmounts(baseSubtotal, 0.5);
      setVariableValues((prev) => ({
        ...prev,
        item_name_1: '導入後残金（プロジェクト検収残金 50%）',
        item_qty_1: '1',
        item_price_1: mb.completionSubtotal.toLocaleString('ja-JP'),
        item_amount_1: mb.completionSubtotal.toLocaleString('ja-JP'),
        item_name_2: 'なし',
        item_qty_2: '0',
        item_price_2: '',
        item_amount_2: '',
        subtotal_amount: mb.completionSubtotal.toLocaleString('ja-JP'),
        tax_amount: mb.completionTax.toLocaleString('ja-JP'),
        total_amount: mb.completionTotalWithTax.toLocaleString('ja-JP'),
        due_date: formatDocumentDate(nextMonthEnd),
        payment_terms: 'システム検収月の翌月末日振込（導入残金50%）',
      }));
    } else if (subtype === 'retainer') {
      const monthly = parseNum(variableValues.monthly_fee) || 100000;
      const tax = Math.floor(monthly * 0.1);
      setVariableValues((prev) => ({
        ...prev,
        item_name_1: `業務改善・DX顧問支援料（${variableValues.billing_month || '当月度分'}）`,
        item_qty_1: '1',
        item_price_1: monthly.toLocaleString('ja-JP'),
        item_amount_1: monthly.toLocaleString('ja-JP'),
        item_name_2: 'なし',
        item_qty_2: '0',
        item_price_2: '',
        item_amount_2: '',
        subtotal_amount: monthly.toLocaleString('ja-JP'),
        tax_amount: tax.toLocaleString('ja-JP'),
        total_amount: (monthly + tax).toLocaleString('ja-JP'),
        due_date: formatDocumentDate(nextMonthEnd),
        payment_terms: '毎月末日締め翌月末日振込（月額顧問料）',
      }));
    } else if (subtype === 'installment') {
      const inst = calculateInstallmentAmounts(baseSubtotal, 3);
      const first = inst.installments[0];
      setVariableValues((prev) => ({
        ...prev,
        item_name_1: `業務改善システム構築料（第1回 / 全3回分割払い）`,
        item_qty_1: '1',
        item_price_1: first.subtotal.toLocaleString('ja-JP'),
        item_amount_1: first.subtotal.toLocaleString('ja-JP'),
        item_name_2: 'なし',
        item_qty_2: '0',
        item_price_2: '',
        item_amount_2: '',
        subtotal_amount: first.subtotal.toLocaleString('ja-JP'),
        tax_amount: first.tax.toLocaleString('ja-JP'),
        total_amount: first.totalWithTax.toLocaleString('ja-JP'),
        due_date: formatDocumentDate(nextMonthEnd),
        payment_terms: '毎月末日締め翌月末日振込（全3回分割払い・第1回目）',
      }));
    } else {
      // lump_sum
      const tax = Math.floor(baseSubtotal * 0.1);
      setVariableValues((prev) => ({
        ...prev,
        item_name_1: '業務改善システム構築・伴走支援一式',
        item_qty_1: '1',
        item_price_1: baseSubtotal.toLocaleString('ja-JP'),
        item_amount_1: baseSubtotal.toLocaleString('ja-JP'),
        item_name_2: 'なし',
        item_qty_2: '0',
        item_price_2: '',
        item_amount_2: '',
        subtotal_amount: baseSubtotal.toLocaleString('ja-JP'),
        tax_amount: tax.toLocaleString('ja-JP'),
        total_amount: (baseSubtotal + tax).toLocaleString('ja-JP'),
        due_date: formatDocumentDate(nextMonthEnd),
        payment_terms: '毎月末日締め翌月末日振込（一括払い）',
      }));
    }
  };

  // Deterministic HTML renderer with variable hydration
  const getPopulatedHtml = (): string => {
    let result = customHtmlOverride || getDynamicTemplateHtml(currentTemplate.id, paymentMode, invoiceSubtype);
    
    Object.entries(variableValues).forEach(([key, val]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, escapeHtml(val || ''));
    });

    const currentDocId = savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id];
    const applyUrl = currentDocId
      ? `${window.location.origin}/apply/${currentDocId}`
      : 'javascript:alert("書類の申込URLを発行中です。右上の「確認待ち保存」をクリックしてください。");';
    result = result.replace(/{{apply_url}}/g, applyUrl);

    // If proposal/estimate, guarantee Web Application CTA box
    if (['proposal', 'report', 'estimate'].includes(currentTemplate.type) || currentTemplate.id === 'tpl-unified-estimate' || currentTemplate.id === 'tpl-proposal-report') {
      if (!result.includes('web-apply-box')) {
        const ctaHtml = `<div class="web-apply-box" style="margin-top: 40px; padding: 24px; border: 2px solid #10b981; border-radius: 12px; background: #f0fdf4; text-align: center;">
  <p style="font-weight: bold; font-size: 16px; color: #065f46; margin: 0 0 6px 0;">【Web申込・オンライン即時成約】</p>
  <p style="font-size: 13px; color: #047857; margin: 0 0 16px 0;">上記のお見積・ご提案内容にご承諾いただける場合は、Web上でワンタップで申し込み・ご成約いただけます。</p>
  <a href="${applyUrl}" ${currentDocId ? 'target="_blank" rel="noopener noreferrer"' : ''} style="display: inline-block; background: #059669; color: #ffffff; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 15px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(16,185,129,0.3);">👉 この内容で申し込む</a>
</div>`;
        const lastDivIndex = result.lastIndexOf('</div>');
        if (lastDivIndex !== -1) {
          result = result.slice(0, lastDivIndex) + ctaHtml + '\n</div>' + result.slice(lastDivIndex + 6);
        }
      }
    }

    return result;
  };

  const populatedHtml = getPopulatedHtml();

  // Auto-save changes to Supabase when user has started editing
  useEffect(() => {
    const templateId = currentTemplate.id;
    const existingId = autosavedDocumentIds.current[templateId];
    if (!hasStartedDocument || !existingId) return;

    setSaveMessage('変更内容を更新中…');
    const timer = window.setTimeout(() => {
      const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
      const payload = {
        document_type: documentType,
        title: currentTemplate.title,
        body_html: populatedHtml,
        company_id: companyId || null,
        contact_id: contactId || null,
        lead_id: leadId || null,
        deal_id: dealId || null,
      };
      const previousQueue = autosaveQueues.current[templateId] || Promise.resolve();
      const save = previousQueue.catch(() => undefined).then(async () => {
        const supabase = getSupabase();
        if (!supabase) return;
        const { data, error } = await supabase.from('customer_documents')
          .update(payload)
          .eq('id', existingId)
          .eq('status', 'awaiting_approval')
          .select('id')
          .maybeSingle();
        if (!error && data) {
          setSaveMessage('保存済み書類の内容を自動更新しました。');
        }
      });
      autosaveQueues.current[templateId] = save;
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hasStartedDocument, currentTemplate.id, currentTemplate.title, currentTemplate.type, populatedHtml, companyId, contactId, leadId, dealId]);

  const handlePrintPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('ポップアップがブロックされました。ブラウザの設定をご確認ください。');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${currentTemplate.title}</title>
          <style>
            body { margin: 0; padding: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${populatedHtml}
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(populatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSave = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setSaveMessage('Supabase接続後に確認待ち書類として保存できます。');
      return;
    }
    const templateId = currentTemplate.id;
    const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
    const payload = {
      document_type: documentType,
      title: currentTemplate.title,
      body_html: populatedHtml,
      company_id: companyId || null,
      contact_id: contactId || null,
      lead_id: leadId || null,
      deal_id: dealId || null,
    };
    setIsSavingDocument(true);
    setSaveMessage('書類を保存しています…');
    try {
      const existingId = autosavedDocumentIds.current[templateId];
      if (existingId) {
        const { error } = await supabase.from('customer_documents')
          .update(payload)
          .eq('id', existingId);
        if (error) throw error;
        setSavedDocIds((prev) => ({ ...prev, [templateId]: existingId }));
        setSaveMessage('確認待ち書類を更新しました。');
      } else {
        const { data, error } = await supabase.from('customer_documents')
          .insert({ ...payload, status: 'awaiting_approval' })
          .select('id')
          .single();
        if (error || !data?.id) throw error || new Error('書類IDを取得できませんでした。');
        autosavedDocumentIds.current[templateId] = data.id;
        setSavedDocIds((prev) => ({ ...prev, [templateId]: data.id }));
        setHasStartedDocument(true);
        setSaveMessage('確認待ち書類として保存しました。');
      }
    } catch (e: any) {
      setSaveMessage(`保存エラー: ${e.message}`);
    } finally {
      setIsSavingDocument(false);
    }
  };

  const handleSendViaSendCenter = async () => {
    const templateId = currentTemplate.id;
    let docIdToUse = savedDocIds[templateId] || autosavedDocumentIds.current[templateId];

    if (!docIdToUse) {
      const supabase = getSupabase();
      if (supabase) {
        setIsSavingDocument(true);
        try {
          const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
          const payload = {
            document_type: documentType,
            title: currentTemplate.title,
            body_html: populatedHtml,
            company_id: companyId || null,
            contact_id: contactId || null,
            lead_id: leadId || null,
            deal_id: dealId || null,
          };
          const { data, error } = await supabase.from('customer_documents')
            .insert({ ...payload, status: 'awaiting_approval' })
            .select('id')
            .single();
          if (!error && data?.id) {
            docIdToUse = data.id;
            autosavedDocumentIds.current[templateId] = data.id;
            setSavedDocIds((prev) => ({ ...prev, [templateId]: data.id }));
            setHasStartedDocument(true);
          }
        } catch (e: any) {
          console.error('Error auto-saving before send center:', e);
        } finally {
          setIsSavingDocument(false);
        }
      }
    }

    if (onOpenSendCenter) {
      onOpenSendCenter({
        companyId: companyId || undefined,
        documentId: docIdToUse || undefined,
        dealId: dealId || undefined,
        contactId: contactId || undefined,
      });
    }
  };

  const missingVariables = currentTemplate.variables.filter((v) => v.key !== 'end_date' && !(variableValues[v.key] || '').trim());

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">重要書類・見積・契約</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
              5大統合ワークフロー
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            1つの書類内で支払条件（一括・月額・手付残金・分割）を即時切り替えできます。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('inbox_hub')}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Inbox className="w-3.5 h-3.5 text-purple-600" />
              <span>受信トレイ</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('communication_send')}
              className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-purple-600" />
              <span>送信履歴</span>
            </button>
          )}

          {(savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]) && (
            <>
              <button
                type="button"
                onClick={() => {
                  const docId = savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id];
                  if (!docId) return;
                  const url = `${window.location.origin}/apply/${docId}`;
                  navigator.clipboard.writeText(url);
                  setCopiedApplyUrl(true);
                  setTimeout(() => setCopiedApplyUrl(false), 2500);
                }}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="顧客に送信するワンタップ申込用URLをコピーします"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{copiedApplyUrl ? 'コピー完了' : 'Web申込URL'}</span>
              </button>

              <a
                href={`/apply/${savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">申込プレビュー</span>
              </a>
            </>
          )}

          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSavingDocument}
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingDocument ? '保存中…' : (savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]) ? '上書き保存' : '確認待ち保存'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendViaSendCenter}
            disabled={isSavingDocument}
            className="px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>送信ドロワーで送る</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>PDF出力</span>
          </button>
        </div>
      </div>

      {/* Customer / Deal Relationship Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            書類の紐付け（会社・担当者・商談を選ぶと自動流し込み）
          </h2>
          {saveMessage && <p role="status" className="text-xs text-purple-700 font-medium">{saveMessage}</p>}
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <label className="text-xs font-semibold text-slate-700">
            会社（顧客企業）
            <select
              value={companyId}
              disabled={Boolean(initialCompanyId || initialLeadId || initialDealId)}
              onChange={(e) => {
                const nextId = e.target.value;
                if (nextId) setHasStartedDocument(true);
                setCompanyId(nextId);
                setContactId('');
                setLeadId('');
                setDealId('');
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none disabled:opacity-60"
            >
              <option value="">未選択</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            担当者
            <select
              value={contactId}
              onChange={(e) => {
                const id = e.target.value;
                const c = contacts.find((item) => item.id === id);
                if (id) setHasStartedDocument(true);
                setContactId(id);
                if (c?.company_id && c.company_id !== companyId) {
                  setCompanyId(c.company_id);
                  setLeadId('');
                  setDealId('');
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none"
            >
              <option value="">未選択</option>
              {contacts.filter((c) => !companyId || c.company_id === companyId || !c.company_id).map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            反響リード
            <select
              value={leadId}
              disabled={Boolean(initialLeadId || initialDealId)}
              onChange={(e) => {
                const id = e.target.value;
                const lead = leads.find((item) => item.id === id);
                if (id) setHasStartedDocument(true);
                setLeadId(id);
                if (lead?.company_id && lead.company_id !== companyId) {
                  setCompanyId(lead.company_id);
                  setContactId((cur) => contacts.find((item) => item.id === cur)?.company_id === lead.company_id ? cur : '');
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none disabled:opacity-60"
            >
              <option value="">未選択</option>
              {leads.filter((lead) => !companyId || lead.company_id === companyId || !lead.company_id).map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.source || 'リード'} · {lead.status || lead.id.slice(0, 8)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            商談案件
            <select
              value={dealId}
              disabled={Boolean(initialDealId)}
              onChange={(e) => {
                const id = e.target.value;
                const deal = deals.find((item) => item.id === id);
                if (id) setHasStartedDocument(true);
                setDealId(id);
                if (deal?.lead_id && deal.lead_id !== leadId) setLeadId(deal.lead_id);
                if (deal?.company_id && deal.company_id !== companyId) {
                  setCompanyId(deal.company_id);
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none disabled:opacity-60"
            >
              <option value="">未選択</option>
              {deals.filter((d) => (!companyId || d.company_id === companyId || !d.company_id) && (!leadId || d.lead_id === leadId)).map((d) => (
                <option key={d.id} value={d.id}>{d.proposal_plan_name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* 5 Core Unified Document Cards (1 Single Row) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            営業〜契約・請求 5大コア書類（1クリック切替）
          </span>
          <span className="text-[11px] text-slate-600">
            書類種別を選び、内部で条件（一括／月額／手付／分割）を切り替えます
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {CORE_TEMPLATES.map((tpl) => {
            const isSelected = tpl.id === selectedTemplateId;
            const icons: Record<DocTemplateType, React.ReactNode> = {
              proposal: <Sparkles className="w-4 h-4 text-blue-600" />,
              estimate: <Calculator className="w-4 h-4 text-emerald-600" />,
              contract: <FileCheck2 className="w-4 h-4 text-purple-600" />,
              invoice: <Receipt className="w-4 h-4 text-amber-600" />,
              monthly_report: <BarChart3 className="w-4 h-4 text-cyan-600" />,
              report: <FileText className="w-4 h-4 text-indigo-600" />,
            };

            return (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-purple-50/90 border-purple-600 shadow-sm ring-2 ring-purple-600'
                    : 'bg-white border-slate-200 hover:border-purple-300 text-slate-600 hover:text-slate-900 shadow-2xs hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded font-mono">
                      {tpl.stepNum}
                    </span>
                    <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-purple-200/60' : 'bg-slate-100'}`}>
                      {icons[tpl.type]}
                    </span>
                  </div>
                  <h3 className={`font-bold text-xs sm:text-sm line-clamp-1 ${isSelected ? 'text-purple-950 font-extrabold' : 'text-slate-800'}`}>
                    {tpl.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-purple-700/80 mt-0.5">{tpl.subtitle}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-snug">{tpl.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {tpl.badge}
                  </span>
                  <span className={isSelected ? 'text-purple-700 font-bold flex items-center gap-1' : 'text-slate-600'}>
                    {isSelected ? <>選択中 <CheckCircle2 className="w-3 h-3 inline" /></> : '選択'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Split: Left Form Inputs / Right Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form / Variable Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <h2 className="font-bold text-sm text-slate-900">
                  {currentTemplate.title} の設定・入力
                </h2>
              </div>
              <button
                onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                  isEditingTemplate
                    ? 'bg-purple-50 border-purple-300 text-purple-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{isEditingTemplate ? 'フォームに戻る' : 'HTML直接編集'}</span>
              </button>
            </div>

            {isEditingTemplate ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  HTMLと変数タグ（例: <code className="text-purple-700 font-semibold">{'{{client_company}}'}</code>）を直接編集できます。
                </p>
                <textarea
                  value={customHtmlOverride || getDynamicTemplateHtml(currentTemplate.id, paymentMode, invoiceSubtype)}
                  onChange={(e) => setCustomHtmlOverride(e.target.value)}
                  rows={20}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setCustomHtmlOverride(null)}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>自動生成HTMLに戻す</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
                {/* 1. If Proposal/Report: Highlight Unified Nature */}
                {selectedTemplateId === 'tpl-proposal-report' && (
                  <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>診断レポート ＋ 業務改善提案書の統合版</span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      診断結果（急所分析・改善前後の姿）から3段階ロードマップ、概算費用、Web申込CTAまで1枚のストーリーとしてスムーズにつながります。
                    </p>
                  </div>
                )}

                {/* 2. If Estimate or Contract: Segmented Payment Switcher */}
                {(selectedTemplateId === 'tpl-unified-estimate' || selectedTemplateId === 'tpl-unified-contract') && (
                  <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/80 via-indigo-50/40 to-white p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                        <Coins className="w-3.5 h-3.5 text-purple-600" />
                        <span>お支払い条件・条項の即時切替</span>
                      </div>
                      <span className="text-[10px] font-medium text-purple-700 bg-white/90 px-2 py-0.5 rounded border border-purple-200 whitespace-nowrap">
                        {selectedTemplateId.includes('estimate') ? '有効期限: 発行日より1ヶ月間' : '支払期日: 翌月末日統一'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      ワンタップで金額・消費税・条項文（期限の利益喪失条項・手付残金・顧問自動更新）が自動切替されます。
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                      {[
                        { id: 'lump_sum' as PaymentMode, label: '① 一括払い', sub: '翌月末日振込' },
                        { id: 'retainer' as PaymentMode, label: '② 月額顧問', sub: '毎月締め翌月末' },
                        { id: 'hybrid_setup_retainer' as PaymentMode, label: '③ 初期構築＋月額顧問', sub: '構築費＋月々顧問' },
                        { id: 'milestone' as PaymentMode, label: '④ 手付50%＋残金50%', sub: '着手時 & 導入検収時' },
                        { id: 'installments_3' as PaymentMode, label: '⑤ 3回均等分割', sub: '翌月末×3回' },
                        { id: 'installments_6' as PaymentMode, label: '⑥ 6回均等分割', sub: '翌月末×6回' },
                      ].map((item) => {
                        const active = paymentMode === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => switchPaymentMode(item.id)}
                            className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-purple-600 border-purple-600 text-white shadow-xs font-bold'
                                : 'bg-white border-slate-200 hover:border-purple-300 text-slate-700 hover:bg-purple-50/50'
                            }`}
                          >
                            <p className="text-[11px] leading-tight">{item.label}</p>
                            <p className={`text-[10px] mt-0.5 ${active ? 'text-purple-100' : 'text-slate-600'}`}>{item.sub}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. If Invoice: Segmented Invoice Subtype Switcher */}
                {selectedTemplateId === 'tpl-unified-invoice' && (
                  <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-white p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <Receipt className="w-3.5 h-3.5 text-amber-600" />
                        <span>ご請求種別の即時切替</span>
                      </div>
                      <span className="text-[10px] font-medium text-amber-800 bg-white/90 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                        支払期日: 翌月末日
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      内訳明細・件名・備考が請求種別に応じて自動セットされます。
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                      {[
                        { id: 'lump_sum' as InvoiceSubtype, label: '通常一括', sub: '全額翌月末払い' },
                        { id: 'retainer' as InvoiceSubtype, label: '月額顧問料', sub: '定期伴走支援費' },
                        { id: 'hybrid_setup_retainer' as InvoiceSubtype, label: '初期構築＋初月顧問', sub: '合算一括請求' },
                        { id: 'deposit' as InvoiceSubtype, label: '着手金 (50%)', sub: 'プロジェクト開始時' },
                        { id: 'completion' as InvoiceSubtype, label: '導入残金 (50%)', sub: '検収完了時' },
                        { id: 'installment' as InvoiceSubtype, label: '分割請求', sub: '第1回目など' },
                      ].map((item) => {
                        const active = invoiceSubtype === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => switchInvoiceSubtype(item.id)}
                            className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-amber-600 border-amber-600 text-white shadow-xs font-bold'
                                : 'bg-white border-slate-200 hover:border-amber-300 text-slate-700 hover:bg-amber-50/50'
                            }`}
                          >
                            <p className="text-[11px] leading-tight">{item.label}</p>
                            <p className={`text-[10px] mt-0.5 ${active ? 'text-amber-100' : 'text-slate-600'}`}>{item.sub}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {missingVariables.length > 0 && (
                  <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 shadow-2xs">
                    自動入力できなかった項目が {missingVariables.length} 件あります。
                    <span className="mt-1 block font-medium text-amber-800">{missingVariables.map((v) => v.label).join('、')}</span>
                  </div>
                )}

                {/* Form fields for template variables */}
                {currentTemplate.variables.map((v) => (
                  <div key={v.key} className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{v.label}</span>
                      <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                        {`{{${v.key}}}`}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={variableValues[v.key] ?? ''}
                      onChange={(e) => handleVariableChange(v.key, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 focus:bg-white transition-colors shadow-2xs"
                      placeholder={v.key === 'end_date' ? '任意（定める場合のみ入力）' : `${v.label}（未登録の場合は入力）`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-emerald-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              変数・計算式 反映中
            </span>
            <button
              onClick={() => handleSelectTemplate(currentTemplate.id)}
              className="text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>初期値に戻す</span>
            </button>
          </div>
        </div>

        {/* Right Live Preview Panel (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-purple-600" />
              <h2 className="font-bold text-sm text-slate-900">リアルタイムプレビュー</h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded">
                A4縦レイアウト
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendViaSendCenter}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>送信ドロワーで送る</span>
              </button>
              <button
                onClick={handleCopyHtml}
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'コピー完了!' : 'HTMLコピー'}</span>
              </button>
              <button
                onClick={handlePrintPdf}
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>印刷 / PDF</span>
              </button>
            </div>
          </div>

          {/* Rendered HTML Container */}
          <div className="flex-1 bg-white rounded-xl shadow-xs overflow-hidden min-h-[620px] max-h-[750px] overflow-y-auto border border-slate-200">
            <div dangerouslySetInnerHTML={{ __html: populatedHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
};
