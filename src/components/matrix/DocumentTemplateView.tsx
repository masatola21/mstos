import React, { useEffect, useRef, useState } from 'react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
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
  Calculator,
  BarChart3,
  Send,
  Inbox,
  Coins,
  RefreshCw,
  Save,
  CheckCircle2,
  Sparkles,
  ClipboardList,
  ExternalLink,
  Link2,
  Trash2,
  X,
  Search,
  FilePlus2,
  FolderOpen,
  ArrowLeft,
  Columns2,
  Maximize2,
  Eye,
  Type,
  Undo2,
  Bold,
  Underline,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { deleteTableRecord, bulkDeleteTableRecords } from '../../services/dataService';
import { MeetingSessionView } from '../meeting/MeetingSessionView';
import { resolveEffectiveDocumentType, getDocumentStatusLabel, type EffectiveDocumentType } from '../../utils/documentManagement';
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
import {
  parseDiagnosisReport,
  kindFromPaymentMode,
  markdownToPlainText,
  addDaysToIsoDate,
  PROPOSAL_KIND_LABELS,
  PROPOSAL_VALID_DAYS,
} from '../../constants/proposalChapters';
import {
  proposalEmptyText,
  defaultPaymentTermsFor,
  defaultP5For,
  isDefaultP5Value,
  buildInitialProposalFromHearing,
  requiredKeysFor,
  MULTILINE_KEYS,
  DRAFTABLE_KEYS,
} from './proposalTemplate';
import { calcProposalFees, parseYen, formatYen } from '../../utils/proposalFees';
import {
  composeMeetingMemo,
  sanitizeCoreAnswers,
  sanitizeExtraQuestions,
  customerIntentFrom,
  type CoreAnswers,
} from '../../constants/hearingSheet';
import { buildProposalDraftRow, approvalBlockers } from '../../utils/proposalDraftRecord';

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

function documentTypeFallbackCandidates(primary: string): string[] {
  switch (primary) {
    case 'estimate':
      return ['estimate', 'proposal', 'other'];
    case 'monthly_report':
      return ['monthly_report', 'diagnosis_report', 'report', 'proposal', 'other'];
    case 'diagnosis_report':
      return ['diagnosis_report', 'report', 'proposal', 'other'];
    case 'report':
      return ['report', 'diagnosis_report', 'proposal', 'other'];
    default:
      return [primary, 'proposal', 'other'].filter((v, i, a) => a.indexOf(v) === i);
  }
}

function isDocumentTypeCheckViolation(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return code === '23514' || /customer_documents_document_type_check|document_type_check/i.test(msg);
}

const DEFAULT_TEMPLATES: DocTemplate[] = CORE_TEMPLATES;

function templateIdForEffectiveType(effType: EffectiveDocumentType): string {
  switch (effType) {
    case 'estimate':
      return 'tpl-unified-estimate';
    case 'contract':
      return 'tpl-unified-contract';
    case 'invoice':
      return 'tpl-unified-invoice';
    case 'monthly_report':
      return 'tpl-monthly-report-01';
    case 'diagnosis_report':
    case 'proposal':
    default:
      return 'tpl-proposal-report';
  }
}

interface DocumentTemplateViewProps { 
  initialCompanyId?: string; 
  initialLeadId?: string; 
  initialDealId?: string; 
  initialDocumentType?: DocTemplateType; 
  initialDocumentId?: string;
  onBackToList?: () => void;
  onOpenSendCenter?: (params: { companyId?: string; documentId?: string; dealId?: string; contactId?: string }) => void;
  onNavigateTab?: (tab: string) => void;
}

export const DocumentTemplateView: React.FC<DocumentTemplateViewProps> = ({ 
  initialCompanyId, 
  initialLeadId, 
  initialDealId, 
  initialDocumentType,
  initialDocumentId,
  onBackToList,
  onOpenSendCenter,
  onNavigateTab
}) => {
  const [templates, setTemplates] = useState<DocTemplate[]>(DEFAULT_TEMPLATES);
  const [templateStatus, setTemplateStatus] = useState('');
  
  // 5 unified templates state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (initialDocumentType === 'proposal') return 'tpl-proposal-report';
    if (initialDocumentType === 'invoice') return 'tpl-unified-invoice';
    if (initialDocumentType === 'estimate') return 'tpl-unified-estimate';
    if (initialDocumentType === 'contract') return 'tpl-unified-contract';
    if (initialDocumentType === 'monthly_report') return 'tpl-monthly-report-01';
    if (initialDealId) return 'tpl-unified-estimate';
    return 'tpl-proposal-report';
  });

  // Dynamic inside-template modes
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('lump_sum');
  const [invoiceSubtype, setInvoiceSubtype] = useState<InvoiceSubtype>('lump_sum');
  const [customHtmlOverride, setCustomHtmlOverride] = useState<string | null>(null);

  const [editorMode, setEditorMode] = useState<'form' | 'rich' | 'html'>('form');
  const [layoutMode, setLayoutMode] = useState<'split' | 'editor_wide' | 'preview_wide'>('split');
  const [relationshipExpanded, setRelationshipExpanded] = useState<boolean>(
    () => !initialCompanyId && !initialLeadId && !initialDealId && !initialDocumentId
  );
  const richEditorRef = useRef<HTMLDivElement>(null);
  const skipNextRichSyncRef = useRef(false);
  const loadedInitialDocIdRef = useRef<string | null>(null);
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
  // 提案書の下書き(proposal_drafts)。テーブル未作成なら、保存せず従来どおり画面だけで使える。
  const [draftCtx, setDraftCtx] = useState<{ diagnosisId: string; hearingSheetId: string | null; intent: any } | null>(null);
  const [meetingCtx, setMeetingCtx] = useState<{ diagnosisId: string; companyId: string | null; companyName: string; formAnswers: Record<string, unknown> } | null>(null);
  const [hearingCoreAnswers, setHearingCoreAnswers] = useState<CoreAnswers | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [populateSeq, setPopulateSeq] = useState(0);
  const refreshMeetingMemoRef = useRef(false);
  const [draftRec, setDraftRec] = useState<{ id: string; status: string; version: number } | null>(null);
  const [draftTableMissing, setDraftTableMissing] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const restoredPaymentFor = useRef<string | null>(null);
  const [roadmapOk, setRoadmapOk] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasStartedDocument, setHasStartedDocument] = useState<boolean>(false);
  const [isSavingDocument, setIsSavingDocument] = useState<boolean>(false);
  const [savedDocIds, setSavedDocIds] = useState<Record<string, string>>({});
  const autosavedDocumentIds = useRef<Record<string, string>>({});
  const autosaveQueues = useRef<Record<string, Promise<void>>>({});
  const [companyCleanupOpen, setCompanyCleanupOpen] = useState(false);
  const [selectedCleanupCompanyIds, setSelectedCleanupCompanyIds] = useState<string[]>([]);
  const [confirmDeleteSingleCompany, setConfirmDeleteSingleCompany] = useState<{ id: string; company_name: string } | null>(null);
  const [isDeletingCompanies, setIsDeletingCompanies] = useState(false);
  const [companyCleanupError, setCompanyCleanupError] = useState('');
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [existingCompanyDocs, setExistingCompanyDocs] = useState<Array<{
    id: string;
    title: string;
    document_type: string;
    status: string;
    body_html: string;
    deal_id?: string | null;
    contact_id?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
  }>>([]);
  const [activeSavedDocMeta, setActiveSavedDocMeta] = useState<{ id: string; title: string; status: string } | null>(null);
  const [customDocumentTitle, setCustomDocumentTitle] = useState('');
  const [forceNewDocMode, setForceNewDocMode] = useState(false);

  // Active template resolution
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Variable inputs state
  const [variableValues, setVariableValues] = useState<Record<string, string>>(() => {
    const today = todayJst();
    const activeId =
      initialDocumentType === 'proposal'
        ? 'tpl-proposal-report'
        : initialDocumentType === 'invoice'
          ? 'tpl-unified-invoice'
          : initialDocumentType === 'estimate'
            ? 'tpl-unified-estimate'
            : initialDocumentType === 'contract'
              ? 'tpl-unified-contract'
              : initialDocumentType === 'monthly_report'
                ? 'tpl-monthly-report-01'
                : initialDealId
                  ? 'tpl-unified-estimate'
                  : 'tpl-proposal-report';
    return getTemplateDefaultValues(activeId, today, 'lump_sum', 'lump_sum');
  });

  const loadCrmEntities = React.useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [companyResult, contactResult, dealResult, leadResult] = await Promise.all([
      supabase.from('companies').select('id,company_name').order('company_name'),
      supabase.from('contacts').select('id,full_name,company_id,email,phone,role_title').order('full_name'),
      supabase.from('deals').select('id,proposal_plan_name,company_id,lead_id').order('created_at', { ascending: false }),
      supabase.from('leads').select('id,source,status,company_id').order('created_at', { ascending: false }),
    ]);
    const loadedCompanies = companyResult.data || [];
    const loadedContacts = contactResult.data || [];
    const loadedDeals = dealResult.data || [];
    const loadedLeads = leadResult.data || [];
    if (!companyResult.error) {
      setCompanies(loadedCompanies);
      setCompanyId((prev) => (prev && !loadedCompanies.some((c: any) => c.id === prev) ? '' : prev));
    }
    if (!contactResult.error) {
      setContacts(loadedContacts);
      setContactId((prev) => (prev && !loadedContacts.some((c: any) => c.id === prev) ? '' : prev));
    }
    if (!dealResult.error) {
      setDeals(loadedDeals);
      setDealId((prev) => (prev && !loadedDeals.some((d: any) => d.id === prev) ? '' : prev));
    }
    if (!leadResult.error) {
      setLeads(loadedLeads);
      setLeadId((prev) => (prev && !loadedLeads.some((l: any) => l.id === prev) ? '' : prev));
    }
    if (!initialCompanyId && initialDealId) {
      const sourceDeal = loadedDeals.find((deal: { id: string; company_id?: string | null; lead_id?: string | null }) => deal.id === initialDealId);
      if (sourceDeal?.company_id) setCompanyId(sourceDeal.company_id);
      if (sourceDeal?.lead_id) setLeadId(sourceDeal.lead_id);
    } else if (!initialCompanyId && initialLeadId) {
      const sourceLead = loadedLeads.find((lead: { id: string; company_id?: string | null }) => lead.id === initialLeadId);
      if (sourceLead?.company_id) setCompanyId(sourceLead.company_id);
    }
  }, [initialCompanyId, initialDealId, initialLeadId]);

  useEffect(() => {
    void loadCrmEntities();
  }, [loadCrmEntities]);

  useEffect(() => {
    const reload = () => {
      void loadCrmEntities();
    };
    window.addEventListener('mst:crm-data-changed', reload);
    window.addEventListener('mst:documents-changed', reload);
    return () => {
      window.removeEventListener('mst:crm-data-changed', reload);
      window.removeEventListener('mst:documents-changed', reload);
    };
  }, [loadCrmEntities]);

  const resetSelectionAfterCompanyRemoval = (removedIds: string[]) => {
    if (companyId && removedIds.includes(companyId)) {
      setCompanyId('');
      setContactId('');
      setLeadId('');
      setDealId('');
      setDraftCtx(null);
      setMeetingCtx(null);
      setDraftRec(null);
      setSavedDocIds({});
      setActiveSavedDocMeta(null);
      setExistingCompanyDocs([]);
      setCustomDocumentTitle('');
      autosavedDocumentIds.current = {};
      setVariableValues(getTemplateDefaultValues(selectedTemplateId, todayJst(), paymentMode, invoiceSubtype));
    }
  };

  // Load existing saved documents for the selected company/deal & template type to avoid accidental duplicates
  const loadExistingDocsForContext = React.useCallback(async () => {
    const supabase = getSupabase();
    const targetType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
    if (!supabase || (!companyId && !dealId)) {
      setExistingCompanyDocs([]);
      return;
    }
    let query = supabase
      .from('customer_documents')
      .select('id,title,document_type,status,body_html,deal_id,contact_id,updated_at,created_at')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);
    if (companyId) query = query.eq('company_id', companyId);
    else if (dealId) query = query.eq('deal_id', dealId);

    const { data, error } = await query;
    if (error || !data) return;

    const matching = data.filter((doc: any) => {
      const eff = resolveEffectiveDocumentType(doc);
      if (targetType === 'diagnosis_report') return eff === 'diagnosis_report' || eff === 'monthly_report';
      return eff === targetType;
    });
    setExistingCompanyDocs(matching);

    const templateKey = currentTemplate.id;
    const currentLinkedId = autosavedDocumentIds.current[templateKey] || savedDocIds[templateKey];
    const currentDoc = currentLinkedId ? matching.find((d: any) => d.id === currentLinkedId) : undefined;
    if (currentDoc) {
      setActiveSavedDocMeta({ id: currentDoc.id, title: currentDoc.title, status: currentDoc.status });
      return;
    }

    if (!forceNewDocMode && !currentLinkedId && !initialDocumentId) {
      const editable = matching.find((d: any) => ['draft', 'awaiting_approval', 'approved'].includes(String(d.status || '')));
      if (editable) {
        autosavedDocumentIds.current[templateKey] = editable.id;
        setSavedDocIds((prev) => ({ ...prev, [templateKey]: editable.id }));
        setActiveSavedDocMeta({ id: editable.id, title: editable.title, status: editable.status });
        setCustomDocumentTitle(editable.title || '');
      } else {
        setActiveSavedDocMeta(null);
      }
    }
  }, [companyId, dealId, currentTemplate.id, currentTemplate.type, forceNewDocMode, savedDocIds, initialDocumentId]);

  useEffect(() => {
    void loadExistingDocsForContext();
  }, [loadExistingDocsForContext]);

  // Load explicit document when opened via "編集する" from Customer Document List
  useEffect(() => {
    if (!initialDocumentId || loadedInitialDocIdRef.current === initialDocumentId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    loadedInitialDocIdRef.current = initialDocumentId;

    void supabase
      .from('customer_documents')
      .select('*')
      .eq('id', initialDocumentId)
      .maybeSingle()
      .then(({ data: doc, error }) => {
        if (cancelled || error || !doc) return;
        const effType = resolveEffectiveDocumentType(doc);
        const tplId = templateIdForEffectiveType(effType);
        setSelectedTemplateId(tplId);
        if (doc.company_id) setCompanyId(String(doc.company_id));
        if (doc.contact_id) setContactId(String(doc.contact_id));
        if (doc.lead_id) setLeadId(String(doc.lead_id));
        if (doc.deal_id) setDealId(String(doc.deal_id));

        const isProtected = ['sent', 'archived'].includes(String(doc.status || ''));
        setForceNewDocMode(false);
        autosavedDocumentIds.current[tplId] = doc.id;
        setSavedDocIds((prev) => ({ ...prev, [tplId]: doc.id }));
        setActiveSavedDocMeta({ id: doc.id, title: doc.title || '書類', status: doc.status || 'draft' });
        setCustomDocumentTitle(doc.title || '');
        if (doc.body_html) {
          setCustomHtmlOverride(String(doc.body_html));
        }
        setEditorMode('rich');
        setRelationshipExpanded(false);
        setSaveMessage(
          isProtected
            ? `「${doc.title}」は${getDocumentStatusLabel(doc.status)}のため閲覧モードで開きました（複製して新規作成できます）。`
            : `保存済み書類「${doc.title}」を編集画面に読み込みました。`
        );
      });

    return () => {
      cancelled = true;
    };
  }, [initialDocumentId]);

  const handleConfirmSingleCompanyDelete = async () => {
    if (!confirmDeleteSingleCompany) return;
    setIsDeletingCompanies(true);
    setCompanyCleanupError('');
    const target = confirmDeleteSingleCompany;
    const result = await deleteTableRecord('companies', { id: target.id }, {
      force: true,
      deleteDocuments: true,
      deleteLinkedCrm: true,
    });
    setIsDeletingCompanies(false);
    if (result.error) {
      setCompanyCleanupError(result.error.message || '会社の削除に失敗しました。');
      return;
    }
    setConfirmDeleteSingleCompany(null);
    resetSelectionAfterCompanyRemoval([target.id]);
    setSelectedCleanupCompanyIds((prev) => prev.filter((id) => id !== target.id));
    setSaveMessage(`「${target.company_name}」および関連する担当者・リード・商談・重要書類を削除しました。`);
    await loadCrmEntities();
  };

  const handleBulkCompanyDelete = async (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    setIsDeletingCompanies(true);
    setCompanyCleanupError('');
    const result = await bulkDeleteTableRecords('companies', targetIds, {
      force: true,
      deleteDocuments: true,
      deleteLinkedCrm: true,
    });
    setIsDeletingCompanies(false);
    if (result.error && result.successCount === 0) {
      setCompanyCleanupError(result.error.message || '会社の一括削除に失敗しました。');
      return;
    }
    const deletedIds = result.deletedIds?.length ? result.deletedIds : targetIds;
    resetSelectionAfterCompanyRemoval(deletedIds);
    setSelectedCleanupCompanyIds([]);
    setCompanyCleanupOpen(false);
    setSaveMessage(`${result.successCount} 社の会社データと関連する担当者・リード・商談・重要書類を削除しました。`);
    await loadCrmEntities();
  };

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
        // Always prioritize the 5 unified templates and sync stale rows in DB
        setTemplates(DEFAULT_TEMPLATES);
        const defaults = DEFAULT_TEMPLATES.map((template) => ({
          template_key: template.id,
          document_type: template.type === 'report' ? 'diagnosis_report' : template.type,
          title: template.title,
          description: template.description,
          body_html: template.htmlContent,
          variables: template.variables,
        }));
        if (!data || data.length === 0) {
          await supabase.from('customer_document_templates').insert(defaults);
        } else {
          await supabase.from('customer_document_templates').upsert(defaults, { onConflict: 'template_key' }).select('template_key').then(() => undefined, () => undefined);
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
    if (!supabase || (!companyId && !leadId && !dealId && !contactId)) {
      setMeetingCtx(null);
      return;
    }
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
      // ヒアリングシートがあれば、その内容を商談メモの材料にする(テーブル未作成・未入力なら何もしない)
      let hearingMemo = '';
      let hearingSheetId: string | null = null;
      let hearingIntent: any = null;
      let hearingCore: CoreAnswers | null = null;
      let savedDraft: any = null;
      if (diagnosis?.id) {
        const hs = await supabase.from('hearing_sheets').select('id,core_answers,extra_questions').eq('diagnosis_id', diagnosis.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!hs.error && hs.data) {
          const core = sanitizeCoreAnswers(hs.data.core_answers);
          hearingCore = core;
          hearingMemo = composeMeetingMemo(core, sanitizeExtraQuestions(hs.data.extra_questions));
          hearingSheetId = hs.data.id;
          hearingIntent = customerIntentFrom(core);
        }
        const pd = await supabase.from('proposal_drafts').select('id,status,version,chapters,payment_mode').eq('diagnosis_id', diagnosis.id).eq('is_current', true).maybeSingle();
        if (pd.error) {
          if (['PGRST205', '42P01'].includes(String(pd.error.code))) setDraftTableMissing(true);
        } else if (pd.data) {
          savedDraft = pd.data;
        }
      }
      // 保存した支払い方式に戻す(開き直しても選択が初期値に戻らない)。1つの診断につき最初の1回だけ
      if (!cancelled && selectedTemplateId === 'tpl-proposal-report' && savedDraft?.payment_mode && diagnosis?.id && restoredPaymentFor.current !== diagnosis.id) {
        restoredPaymentFor.current = diagnosis.id;
        if (savedDraft.payment_mode !== paymentMode) setPaymentMode(savedDraft.payment_mode);
      }
      if (!cancelled) {
        setDraftCtx(diagnosis?.id ? { diagnosisId: diagnosis.id, hearingSheetId, intent: hearingIntent } : null);
        setHearingCoreAnswers(hearingCore);
        setMeetingCtx(diagnosis?.id ? {
          diagnosisId: diagnosis.id,
          companyId: resolvedCompanyId || diagnosis.company_id || null,
          companyName: company?.company_name || '',
          formAnswers: (formSubmission?.answers || diagnosis?.answers || {}) as Record<string, unknown>,
        } : null);
        setDraftRec(savedDraft ? { id: savedDraft.id, status: savedDraft.status, version: savedDraft.version } : null);
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

      const hasExplicitFees = initialFee > 0 || monthlyFee > 0;
      const effectiveInitial = hasExplicitFees ? initialFee : 300000;
      const effectiveMonthly = hasExplicitFees ? monthlyFee : 100000;
      const initialTax = Math.floor(effectiveInitial * 0.1);
      const monthlyTax = Math.floor(effectiveMonthly * 0.1);
      const effectiveInst = calculateInstallmentAmounts(subtotal, paymentMode === 'installments_6' ? 6 : 3);

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
        initial_fee: effectiveInitial.toLocaleString('ja-JP'),
        initial_fee_tax: initialTax.toLocaleString('ja-JP'),
        initial_fee_tax_included: (effectiveInitial + initialTax).toLocaleString('ja-JP'),
        monthly_fee: effectiveMonthly.toLocaleString('ja-JP'),
        monthly_fee_tax: monthlyTax.toLocaleString('ja-JP'),
        monthly_fee_tax_included: (effectiveMonthly + monthlyTax).toLocaleString('ja-JP'),
        monthly_amount: effectiveMonthly.toLocaleString('ja-JP'),
        tax_included_amount: (effectiveMonthly + monthlyTax).toLocaleString('ja-JP'),
        deposit_rate: '50',
        deposit_subtotal: mb.depositSubtotal > 0 ? mb.depositSubtotal.toLocaleString('ja-JP') : '',
        deposit_tax: mb.depositTax > 0 ? mb.depositTax.toLocaleString('ja-JP') : '',
        deposit_total: mb.depositTotalWithTax > 0 ? mb.depositTotalWithTax.toLocaleString('ja-JP') : '',
        completion_rate: '50',
        completion_subtotal: mb.completionSubtotal > 0 ? mb.completionSubtotal.toLocaleString('ja-JP') : '',
        completion_tax: mb.completionTax > 0 ? mb.completionTax.toLocaleString('ja-JP') : '',
        completion_total: mb.completionTotalWithTax > 0 ? mb.completionTotalWithTax.toLocaleString('ja-JP') : '',
        installment_number: '1',
        installment_count: String(paymentMode === 'installments_6' ? 6 : 3),
        installment_subtotal: effectiveInst.installments[0]?.subtotal ? effectiveInst.installments[0].subtotal.toLocaleString('ja-JP') : '',
        installment_tax: effectiveInst.installments[0]?.tax ? effectiveInst.installments[0].tax.toLocaleString('ja-JP') : '',
        installment_amount: effectiveInst.installments[0]?.totalWithTax ? effectiveInst.installments[0].totalWithTax.toLocaleString('ja-JP') : '',
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
      };
      // 提案書: 診断の章(D0〜D5)・サービス名・P5標準文・商談ヒント・商談の金額は、空または初期文の欄にだけ入れる(担当者の入力を上書きしない)
      const proposalSeed: Record<string, string> = {};
      if (selectedTemplateId === 'tpl-proposal-report') {
        const effectiveMode = (savedDraft?.payment_mode || paymentMode) as PaymentMode;
        const effectiveKind = kindFromPaymentMode(effectiveMode);
        if (hearingCore) {
          const hinted = buildInitialProposalFromHearing(effectiveKind, hearingCore);
          if (hinted.p3_metrics) proposalSeed.p3_metrics = hinted.p3_metrics;
          proposalSeed.p5_requests = hinted.p5_requests;
          proposalSeed.p5_prerequisites = hinted.p5_prerequisites;
          proposalSeed.p5_exclusions = hinted.p5_exclusions;
        } else {
          const p5Defaults = defaultP5For(effectiveKind);
          proposalSeed.p5_requests = p5Defaults.requests;
          proposalSeed.p5_prerequisites = p5Defaults.prerequisites;
          proposalSeed.p5_exclusions = p5Defaults.exclusions;
        }
        if (hearingMemo) proposalSeed.p_meeting_notes = hearingMemo;
        if (deal?.proposal_plan_name) proposalSeed.proposal_title = String(deal.proposal_plan_name);
        if (productName) proposalSeed.p2_service_name = productName;
        const parsedReport = parseDiagnosisReport(report?.full_report_text || '');
        if (!parsedReport.legacy) {
          const byId = (id: string) => markdownToPlainText(parsedReport.chapters.find((c) => c.id === id)?.body || '');
          Object.assign(proposalSeed, {
            d0_summary: byId('D0'), d1_premise: byId('D1'), d2_current: byId('D2'),
            d3_bottleneck: byId('D3'), d4_impact: byId('D4'), d5_direction: byId('D5'),
          });
        }
        const discount = Number(deal?.discount_amount ?? 0);
        if (initialFee > 0 || monthlyFee > 0) {
          const fees = calcProposalFees({ initialFee, monthlyFee, discount });
          Object.assign(proposalSeed, {
            p4_initial_fee: initialFee > 0 ? formatYen(initialFee) : '',
            p4_monthly_fee: monthlyFee > 0 ? formatYen(monthlyFee) : '',
            p4_discount: discount > 0 ? formatYen(discount) : '',
            p4_subtotal: formatYen(fees.subtotal), p4_tax: formatYen(fees.tax), p4_total: formatYen(fees.total),
          });
        }
      }
      if (selectedTemplateId === 'tpl-proposal-report' && savedDraft?.chapters && typeof savedDraft.chapters === 'object') Object.assign(proposalSeed, savedDraft.chapters);
      const shouldForceRefreshMemo = refreshMeetingMemoRef.current;
      refreshMeetingMemoRef.current = false;
      setVariableValues((prev) => {
        const next = { ...prev, ...values };
        for (const [k, v] of Object.entries(proposalSeed)) {
          if (!v) continue;
          const isUntouchedP5 =
            (k === 'p5_requests' || k === 'p5_prerequisites' || k === 'p5_exclusions') &&
            isDefaultP5Value(k, prev[k] || '');
          if ((k === 'p_meeting_notes' && shouldForceRefreshMemo) || isUntouchedP5 || !String(prev[k] || '').trim()) {
            next[k] = v;
          }
        }
        return next;
      });
    };
    void populate();
    return () => { cancelled = true; };
  }, [companyId, leadId, dealId, contactId, selectedTemplateId, paymentMode, populateSeq]);

  // テンプレート切り替え時の変数引き継ぎマッピング（提案書 ⇄ 見積書・契約書・請求書）
  const handleSelectTemplate = (rawId: string) => {
    const id = normalizeTemplateId(rawId);
    setSelectedTemplateId(id);
    setCustomHtmlOverride(null);
    setCustomDocumentTitle('');
    setForceNewDocMode(false);
    setActiveSavedDocMeta(null);
    const today = todayJst();
    const defaults = getTemplateDefaultValues(id, today, paymentMode, invoiceSubtype);

    setVariableValues((prev) => {
      // 共通・基本情報の引き継ぎ
      const company = prev.client_company || prev.customer_company || defaults.client_company || '';
      const rep = prev.client_name || prev.customer_rep || defaults.client_name || '';
      const title = prev.proposal_title || prev.project_name || defaults.proposal_title || '';
      const serviceName = prev.p2_service_name || prev.project_name || defaults.project_name || '';

      // 金額の引き継ぎ
      const subtotal = prev.p4_subtotal || prev.subtotal_amount || defaults.subtotal_amount || '';
      const tax = prev.p4_tax || prev.tax_amount || defaults.tax_amount || '';
      const total = prev.p4_total || prev.total_amount || defaults.total_amount || '';
      const initialFee = prev.p4_initial_fee || prev.initial_fee || '';
      const monthlyFee = prev.p4_monthly_fee || prev.monthly_fee || '';
      const paymentTerms = prev.p6_payment_terms || prev.payment_terms || defaults.payment_terms || '';
      const contractPeriod = prev.p6_contract_period || prev.contract_period || defaults.contract_period || '';

      const next: Record<string, string> = {
        ...defaults,
        ...prev,
        client_company: company,
        customer_company: company,
        client_name: rep,
        customer_rep: rep,
        proposal_title: title,
        project_name: serviceName,
        issue_date: prev.issue_date || formatDocumentDate(today),
        due_date: id === 'tpl-proposal-report'
          ? (prev.due_date || defaults.due_date)
          : formatDocumentDate(id.includes('estimate') ? addOneMonthDate(today) : invoiceDueDate(today)),
      };

      // 切り替え先が見積書・契約書・請求書の場合
      if (id !== 'tpl-proposal-report') {
        if (subtotal) next.subtotal_amount = subtotal;
        if (tax) next.tax_amount = tax;
        if (total) {
          next.total_amount = total;
          next.total_project_amount = subtotal || total;
        }
        if (initialFee) next.initial_fee = initialFee;
        if (monthlyFee) next.monthly_fee = monthlyFee;
        if (paymentTerms) next.payment_terms = paymentTerms;
        if (contractPeriod) next.contract_period = contractPeriod;
        if (serviceName) next.project_name = serviceName;
      } else {
        // 切り替え先が提案書の場合
        if (serviceName) next.p2_service_name = serviceName;
        if (subtotal) next.p4_subtotal = subtotal;
        if (tax) next.p4_tax = tax;
        if (total) next.p4_total = total;
        if (initialFee) next.p4_initial_fee = initialFee;
        if (monthlyFee) next.p4_monthly_fee = monthlyFee;
        if (paymentTerms) next.p6_payment_terms = paymentTerms;
        if (contractPeriod) next.p6_contract_period = contractPeriod;
      }

      return next;
    });

    setEditorMode('form');
  };

  // 提案書: P1(方針)・P3(ロードマップ)のAI下書き
  const [draftingKey, setDraftingKey] = useState<string | null>(null);
  const [draftNotices, setDraftNotices] = useState<Record<string, { warnings: string[]; placeholders: number; error?: string }>>({});

  const handleDraftWithAi = async (key: string) => {
    const chapter = DRAFTABLE_KEYS[key];
    if (!chapter || draftingKey) return;
    if ((variableValues[key] || '').trim() && !window.confirm('すでに入力があります。AIの下書きで置き換えますか？')) return;
    setDraftingKey(key);
    setDraftNotices((prev) => ({ ...prev, [key]: { warnings: [], placeholders: 0 } }));
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/proposals/draft-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          chapter,
          kind: kindFromPaymentMode(paymentMode),
          context: {
            companyName: variableValues.client_company,
            diagnosis: { d0: variableValues.d0_summary, d2: variableValues.d2_current, d3: variableValues.d3_bottleneck, d5: variableValues.d5_direction },
            serviceName: variableValues.p2_service_name,
            deliverables: variableValues.p2_deliverables,
            monthlySupport: variableValues.p2_monthly_support,
            policy: variableValues.p1_policy,
            roadmap: variableValues.p3_roadmap,
            meetingNotes: variableValues.p_meeting_notes,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '下書きを作成できませんでした。');
      handleVariableChange(key, String(result.text || ''));
      setDraftNotices((prev) => ({ ...prev, [key]: { warnings: result.warnings || [], placeholders: Number(result.placeholders) || 0 } }));
    } catch (err: any) {
      setDraftNotices((prev) => ({ ...prev, [key]: { warnings: [], placeholders: 0, error: err?.message || '下書きを作成できませんでした。' } }));
    } finally {
      setDraftingKey(null);
    }
  };

  const handleApplyHearingHintsToProposal = () => {
    if (!hearingCoreAnswers || selectedTemplateId !== 'tpl-proposal-report') return;
    const hinted = buildInitialProposalFromHearing(kindFromPaymentMode(paymentMode), hearingCoreAnswers);
    setHasStartedDocument(true);
    setVariableValues((prev) => ({
      ...prev,
      p3_metrics: hinted.p3_metrics || prev.p3_metrics || '',
      p5_requests: hinted.p5_requests,
      p5_prerequisites: hinted.p5_prerequisites,
      p5_exclusions: hinted.p5_exclusions,
    }));
    setSaveMessage('商談シートの回答を P3 確認指標・P5（お願い事項／前提条件／対象外）へ反映しました。');
  };

  const handleVariableChange = (key: string, value: string) => {
    setHasStartedDocument(true);
    setVariableValues((prev) => {
      const next = { ...prev, [key]: value };
      if (selectedTemplateId === 'tpl-proposal-report') {
        // 費用: 初期費用・月額・値引きから、小計・消費税(切り捨て)・合計を自動計算する
        if (['p4_initial_fee', 'p4_monthly_fee', 'p4_discount'].includes(key)) {
          const fees = calcProposalFees({
            initialFee: parseYen(next.p4_initial_fee), monthlyFee: parseYen(next.p4_monthly_fee), discount: parseYen(next.p4_discount),
          });
          next.p4_subtotal = fees.subtotal > 0 ? formatYen(fees.subtotal) : '';
          next.p4_tax = fees.subtotal > 0 ? formatYen(fees.tax) : '';
          next.p4_total = fees.subtotal > 0 ? formatYen(fees.total) : '';
        }
        // 有効期限: 発行日から自動計算する
        if (key === 'issue_date') {
          const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(value);
          if (m) {
            const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
            next.due_date = formatDocumentDate(addDaysToIsoDate(iso, PROPOSAL_VALID_DAYS));
          }
        }
      } else if (selectedTemplateId !== 'tpl-monthly-report-01') {
        // 見積書・契約書・請求書: 税抜金額変更時に消費税・税込金額・分割/手付残金を連動再計算
        if (key === 'initial_fee' || key === 'monthly_fee') {
          const initial = parseYen(next.initial_fee);
          const monthly = parseYen(next.monthly_fee);
          const initialTax = Math.floor(initial * 0.1);
          const monthlyTax = Math.floor(monthly * 0.1);
          next.initial_fee_tax = formatYen(initialTax);
          next.initial_fee_tax_included = formatYen(initial + initialTax);
          next.monthly_fee_tax = formatYen(monthlyTax);
          next.monthly_fee_tax_included = formatYen(monthly + monthlyTax);

          const isSubFromInitMonthly =
            paymentMode === 'hybrid_setup_retainer' ||
            paymentMode === 'retainer' ||
            (selectedTemplateId === 'tpl-unified-invoice' && (invoiceSubtype === 'hybrid_setup_retainer' || invoiceSubtype === 'retainer'));
          if (isSubFromInitMonthly) {
            const sub =
              selectedTemplateId === 'tpl-unified-invoice' && invoiceSubtype === 'retainer'
                ? monthly
                : initial + monthly;
            const tax = Math.floor(sub * 0.1);
            next.subtotal_amount = formatYen(sub);
            next.tax_amount = formatYen(tax);
            next.total_amount = formatYen(sub + tax);
            next.total_project_amount = formatYen(sub);
          }
        } else if (key === 'subtotal_amount') {
          const sub = parseYen(next.subtotal_amount);
          const tax = Math.floor(sub * 0.1);
          const mb = calculateMilestoneAmounts(sub, 0.5);
          const instCount = paymentMode === 'installments_6' ? 6 : 3;
          const inst = calculateInstallmentAmounts(sub, instCount);
          next.tax_amount = formatYen(tax);
          next.total_amount = formatYen(sub + tax);
          next.total_project_amount = formatYen(sub);
          next.deposit_subtotal = formatYen(mb.depositSubtotal);
          next.deposit_tax = formatYen(mb.depositTax);
          next.deposit_total = formatYen(mb.depositTotalWithTax);
          next.completion_subtotal = formatYen(mb.completionSubtotal);
          next.completion_tax = formatYen(mb.completionTax);
          next.completion_total = formatYen(mb.completionTotalWithTax);
          next.installment_subtotal = formatYen(inst.installments[0]?.subtotal ?? 0);
          next.installment_tax = formatYen(inst.installments[0]?.tax ?? 0);
          next.installment_amount = formatYen(inst.installments[0]?.totalWithTax ?? 0);
        }
      }
      return next;
    });
  };

  // Switch Payment Mode (for Estimate and Contract)
  const switchPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    setHasStartedDocument(true);
    setCustomHtmlOverride(null); // allow dynamic generator to re-render table/clauses
    if (selectedTemplateId === 'tpl-proposal-report') {
      // 提案書: 型は支払い方式から決まる。金額は商談で決めた値だけを使うので、ここでは書き換えない。
      const nextP5 = defaultP5For(kindFromPaymentMode(mode));
      setVariableValues((prev) => ({
        ...prev,
        p6_payment_terms: defaultPaymentTermsFor(mode),
        p5_requests: isDefaultP5Value('p5_requests', prev.p5_requests || '') ? nextP5.requests : prev.p5_requests,
        p5_prerequisites: isDefaultP5Value('p5_prerequisites', prev.p5_prerequisites || '') ? nextP5.prerequisites : prev.p5_prerequisites,
        p5_exclusions: isDefaultP5Value('p5_exclusions', prev.p5_exclusions || '') ? nextP5.exclusions : prev.p5_exclusions,
      }));
      return;
    }
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
      const initialTax = Math.floor(initial * 0.1);
      const monthlyTax = Math.floor(monthly * 0.1);
      const sub = monthly + initial;
      const tax = Math.floor(sub * 0.1);
      const total = sub + tax;
      setVariableValues((prev) => ({
        ...prev,
        monthly_fee: monthly.toLocaleString('ja-JP'),
        monthly_fee_tax: monthlyTax.toLocaleString('ja-JP'),
        monthly_fee_tax_included: (monthly + monthlyTax).toLocaleString('ja-JP'),
        initial_fee: initial > 0 ? initial.toLocaleString('ja-JP') : '0',
        initial_fee_tax: initialTax.toLocaleString('ja-JP'),
        initial_fee_tax_included: (initial + initialTax).toLocaleString('ja-JP'),
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
    
    const isProposal = currentTemplate.id === 'tpl-proposal-report';
    const proposalKind = kindFromPaymentMode(paymentMode);
    const formatProposalVal = (key: string, rawVal: string) => {
      const escaped = escapeHtml(rawVal);
      if (!isProposal || !MULTILINE_KEYS.has(key)) return escaped;
      return escaped
        .replace(
          /\*\*([^*\n]+?)\*\*/g,
          '<strong style="color:#1e3a8a; font-weight:700; background:#fef9c3; padding:0 3px; border-radius:3px;">$1</strong>',
        )
        .replace(/\*\*/g, '');
    };
    Object.entries(variableValues).forEach(([key, val]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      // 提案書: 空の項目は、必須なら「【未入力】」、それ以外は決めた代替文を出す
      result = result.replace(regex, formatProposalVal(key, val || (isProposal ? proposalEmptyText(key, proposalKind) : '')));
    });
    const activeDocId = savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id] || 'preview';
    const applyUrl = `${window.location.origin}/docs/${encodeURIComponent(activeDocId)}`;

    if (isProposal) {
      result = result.replace(/{{(\w+)}}/g, (_whole, key) => (key === 'apply_url' ? applyUrl : escapeHtml(proposalEmptyText(key, proposalKind))));
    }
    result = result.replace(/{{apply_url}}/g, applyUrl);

    if (!isProposal && !result.includes('web-apply-box') && (currentTemplate.type === 'estimate' || currentTemplate.type === 'contract')) {
      const boxHtml = `<div class="web-apply-box" style="margin-top:24px; padding:16px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; text-align:center;"><p style="margin:0 0 6px 0; font-weight:bold; color:#065f46; font-size:14px;">Webでのお申し込み</p><p style="margin:0 0 12px 0; font-size:12px; color:#047857;">同意いただいた記録が残ります。</p><a href="${applyUrl}" style="display:inline-block; background:#059669; color:#ffffff; padding:10px 26px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:13px;">この内容で申し込む</a></div>`;
      const lastDivIdx = result.lastIndexOf('</div>');
      result = lastDivIdx >= 0 ? `${result.slice(0, lastDivIdx)}${boxHtml}${result.slice(lastDivIdx)}` : `${result}${boxHtml}`;
    }

    return result;
  };

  const populatedHtml = getPopulatedHtml();

  // Sync rich WYSIWYG editor DOM without causing caret jumps while typing
  useEffect(() => {
    if (editorMode !== 'rich') return;
    if (skipNextRichSyncRef.current) {
      skipNextRichSyncRef.current = false;
      return;
    }
    if (richEditorRef.current && richEditorRef.current.innerHTML !== populatedHtml) {
      richEditorRef.current.innerHTML = populatedHtml;
    }
  }, [editorMode, layoutMode, populatedHtml, selectedTemplateId, activeSavedDocMeta?.id]);

  // Auto-save changes to Supabase when user has started editing (never overwrite sent/archived)
  useEffect(() => {
    const templateId = currentTemplate.id;
    const existingId = autosavedDocumentIds.current[templateId];
    if (!hasStartedDocument || !existingId) return;
    if (activeSavedDocMeta && ['sent', 'archived'].includes(String(activeSavedDocMeta.status))) return;

    setSaveMessage('変更内容を更新中…');
    const timer = window.setTimeout(() => {
      const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
      const effectiveTitle = customDocumentTitle.trim() || currentTemplate.title;
      const payload = {
        document_type: documentType,
        title: effectiveTitle,
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
        for (const candidateType of documentTypeFallbackCandidates(documentType)) {
          const { data, error } = await supabase.from('customer_documents')
            .update({ ...payload, document_type: candidateType })
            .eq('id', existingId)
            .in('status', ['draft', 'awaiting_approval', 'approved'])
            .select('id')
            .maybeSingle();
          if (!error) {
            if (data) {
              setSaveMessage('保存済み書類の内容を自動更新しました。');
              window.dispatchEvent(new CustomEvent('mst:documents-changed'));
            }
            break;
          }
          if (!isDocumentTypeCheckViolation(error)) break;
        }
      });
      autosaveQueues.current[templateId] = save;
    }, 800);
    return () => window.clearTimeout(timer);
  }, [hasStartedDocument, currentTemplate.id, currentTemplate.title, currentTemplate.type, customDocumentTitle, populatedHtml, companyId, contactId, leadId, dealId, activeSavedDocMeta]);

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

  const persistCustomerDocument = async (
    supabase: NonNullable<ReturnType<typeof getSupabase>>,
    existingId: string | undefined,
    payload: {
      document_type: string;
      title: string;
      body_html: string;
      company_id: string | null;
      contact_id: string | null;
      lead_id: string | null;
      deal_id: string | null;
    },
    statusOverride?: 'draft' | 'approved',
  ): Promise<{ id: string; inserted: boolean }> => {
    let resolvedDealId = payload.deal_id;
    if (!resolvedDealId && payload.lead_id) {
      const { data: leadDeal } = await supabase
        .from('deals')
        .select('id')
        .eq('lead_id', payload.lead_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (leadDeal?.id) resolvedDealId = String(leadDeal.id);
    }
    if (!resolvedDealId && payload.company_id) {
      const { data: companyDeal } = await supabase
        .from('deals')
        .select('id')
        .eq('company_id', payload.company_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (companyDeal?.id) resolvedDealId = String(companyDeal.id);
    }
    const normalizedPayload = { ...payload, deal_id: resolvedDealId };

    const candidates = documentTypeFallbackCandidates(normalizedPayload.document_type);
    let lastError: any = null;
    for (const candidateType of candidates) {
      if (existingId) {
        const updateBody = statusOverride
          ? { ...normalizedPayload, document_type: candidateType, status: statusOverride }
          : { ...normalizedPayload, document_type: candidateType };
        const { error } = await supabase.from('customer_documents').update(updateBody).eq('id', existingId);
        if (!error) return { id: existingId, inserted: false };
        lastError = error;
        if (!isDocumentTypeCheckViolation(error)) throw error;
      } else {
        const { data, error } = await supabase.from('customer_documents')
          .insert({ ...normalizedPayload, document_type: candidateType, status: statusOverride ?? 'approved' })
          .select('id')
          .single();
        if (!error && data?.id) {
          const resolvedHtml = normalizedPayload.body_html.replace(/\/(?:apply|docs)\/preview/g, `/docs/${encodeURIComponent(data.id)}`);
          if (resolvedHtml !== normalizedPayload.body_html) {
            await supabase.from('customer_documents').update({ body_html: resolvedHtml }).eq('id', data.id);
          }
          return { id: data.id, inserted: true };
        }
        lastError = error || new Error('書類IDを取得できませんでした。');
        if (!isDocumentTypeCheckViolation(error)) throw lastError;
      }
    }
    throw lastError || new Error('書類を保存できませんでした。');
  };

  const handleManualSave = async (opts?: { status?: 'draft' | 'approved' }): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase) {
      setSaveMessage('Supabase接続後に確認待ち書類として保存できます。');
      return null;
    }
    const templateId = currentTemplate.id;
    const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
    const effectiveTitle = customDocumentTitle.trim() || currentTemplate.title;
    const payload = {
      document_type: documentType,
      title: effectiveTitle,
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
      const saved = await persistCustomerDocument(supabase, existingId, payload, opts?.status);
      autosavedDocumentIds.current[templateId] = saved.id;
      setSavedDocIds((prev) => ({ ...prev, [templateId]: saved.id }));
      setForceNewDocMode(false);
      setActiveSavedDocMeta({ id: saved.id, title: effectiveTitle, status: opts?.status ?? 'approved' });
      if (saved.inserted) {
        setHasStartedDocument(true);
        setSaveMessage(opts?.status === 'draft' ? '作成中の書類として保存しました。' : '確定書類（送付可能）として保存しました。');
      } else {
        setSaveMessage('書類を更新しました。');
      }
      window.dispatchEvent(new CustomEvent('mst:documents-changed'));
      void loadExistingDocsForContext();
      return saved.id;
    } catch (e: any) {
      setSaveMessage(`保存エラー: ${e.message}`);
    } finally {
      setIsSavingDocument(false);
    }
    return null;
  };

  const handleSendViaSendCenter = async () => {
    const templateId = currentTemplate.id;
    let docIdToUse = savedDocIds[templateId] || autosavedDocumentIds.current[templateId];

    // 提案書の場合: 必須項目チェック & 確定保存
    if (isProposalDoc && draftCtx && !draftTableMissing) {
      if (blockers.length > 0) {
        setDraftMsg(`送信ドロワーを開くには未入力の項目を入力してください: ${blockers.join('、')}`);
        setSaveMessage(`未入力項目があるため送付できません: ${blockers[0]}`);
        return;
      }
      const savedDocId = await saveProposalDraft('approved');
      if (savedDocId) {
        docIdToUse = savedDocId;
      }
    } else if (docIdToUse) {
      // 既存の書類でも編集済みの最新HTMLを保存してから送信ドロワーを開く
      const updatedId = await handleManualSave();
      if (updatedId) {
        docIdToUse = updatedId;
      }
    }

    if (!docIdToUse) {
      const supabase = getSupabase();
      if (supabase) {
        setIsSavingDocument(true);
        try {
          const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
          const effectiveTitle = customDocumentTitle.trim() || currentTemplate.title;
          const payload = {
            document_type: documentType,
            title: effectiveTitle,
            body_html: populatedHtml,
            company_id: companyId || null,
            contact_id: contactId || null,
            lead_id: leadId || null,
            deal_id: dealId || null,
          };
          const saved = await persistCustomerDocument(supabase, undefined, payload, 'approved');
          docIdToUse = saved.id;
          autosavedDocumentIds.current[templateId] = saved.id;
          setSavedDocIds((prev) => ({ ...prev, [templateId]: saved.id }));
          setActiveSavedDocMeta({ id: saved.id, title: effectiveTitle, status: 'approved' });
          setForceNewDocMode(false);
          setHasStartedDocument(true);
          window.dispatchEvent(new CustomEvent('mst:documents-changed'));
          void loadExistingDocsForContext();
        } catch (e: any) {
          console.error('Error auto-saving before send center:', e);
          setSaveMessage(`保存エラー: ${e?.message || '書類保存に失敗しました'}`);
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


  // ── 提案書の下書きの保存・承認 ──
  const isProposalDoc = currentTemplate.id === 'tpl-proposal-report';
  const blockers = isProposalDoc ? approvalBlockers(variableValues, paymentMode, { dealId, roadmapConfirmed: roadmapOk }) : [];

  const currentUserLabel = async (): Promise<string> => {
    const supabase = getSupabase();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } as any };
    return String(data?.user?.email || '');
  };

  const saveProposalDraft = async (target: 'drafting' | 'approved'): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase || !draftCtx || draftBusy) return null;
    if (target === 'approved' && blockers.length > 0) {
      setDraftMsg(`未入力の項目があります: ${blockers.join('、')}`);
      return null;
    }
    setDraftBusy(true); setDraftMsg('');
    try {
      const who = await currentUserLabel();
      const now = new Date().toISOString();
      const base: any = buildProposalDraftRow(variableValues, paymentMode, {
        diagnosisId: draftCtx.diagnosisId, dealId: dealId || null, hearingSheetId: draftCtx.hearingSheetId, customerIntent: draftCtx.intent,
      });
      // 内容を保存し直したら、承認の記録はいったん外す(直した内容を承認していない状態を作らない)
      const fields: any = { ...base, status: target, roadmap_confirmed_by: null, roadmap_confirmed_at: null, approved_by: null, approved_at: null };
      if (target === 'approved') { fields.roadmap_confirmed_by = who || '担当者'; fields.roadmap_confirmed_at = now; fields.approved_by = who || '担当者'; fields.approved_at = now; }
      // 書類台帳の「作成中/確定」と同じ状態にそろえる(同じ書類を指す)
      const docId = await handleManualSave({ status: target === 'approved' ? 'approved' : 'draft' });
      if (docId) fields.document_id = docId;

      let result: any;
      if (draftRec && draftRec.status === 'sent') {
        // 送付済みは編集できない。新しい版を作る
        const sup = await supabase.from('proposal_drafts').update({ status: 'superseded', is_current: false }).eq('id', draftRec.id);
        if (sup.error) throw sup.error;
        result = await supabase.from('proposal_drafts').insert({ ...fields, version: draftRec.version + 1, is_current: true, supersedes_id: draftRec.id }).select('id,status,version').maybeSingle();
      } else if (draftRec) {
        result = await supabase.from('proposal_drafts').update(fields).eq('id', draftRec.id).select('id,status,version').maybeSingle();
      } else {
        result = await supabase.from('proposal_drafts').insert({ ...fields, version: 1, is_current: true }).select('id,status,version').maybeSingle();
      }
      if (result.error) throw result.error;
      setDraftRec(result.data);
      setDraftMsg(target === 'drafting' ? '作成中として保存しました。' : '確定しました。送信ドロワーで送付できます。');
      return docId || null;
    } catch (err: any) {
      if (['PGRST205', '42P01'].includes(String(err?.code))) setDraftTableMissing(true);
      setDraftMsg(`保存できませんでした: ${err?.message || err}`);
      return null;
    } finally { setDraftBusy(false); }
  };

  const draftStatusLabel: Record<string, string> = { drafting: '作成中', awaiting_approval: '作成中', approved: '確定', sent: '送付済み', superseded: '置き換え済み' };

  const proposalRequired = currentTemplate.id === 'tpl-proposal-report' ? requiredKeysFor(kindFromPaymentMode(paymentMode)) : null;
  const missingVariables = currentTemplate.variables.filter((v) =>
    proposalRequired
      ? proposalRequired.includes(v.key) && !(variableValues[v.key] || '').trim()
      : v.key !== 'end_date' && !(variableValues[v.key] || '').trim());

  const isProtectedSavedDoc = Boolean(
    activeSavedDocMeta && ['sent', 'archived'].includes(String(activeSavedDocMeta.status))
  );
  const selectedCompanyName = companies.find((c) => c.id === companyId)?.company_name || '';
  const selectedContactName = contacts.find((c) => c.id === contactId)?.full_name || '';
  const selectedDealName = deals.find((d) => d.id === dealId)?.proposal_plan_name || '';

  const duplicateProtectedAsNew = () => {
    const templateKey = currentTemplate.id;
    const preservedHtml = populatedHtml;
    const baseTitle = activeSavedDocMeta?.title || customDocumentTitle || currentTemplate.title;
    setForceNewDocMode(true);
    delete autosavedDocumentIds.current[templateKey];
    setSavedDocIds((prev) => {
      const next = { ...prev };
      delete next[templateKey];
      return next;
    });
    setActiveSavedDocMeta(null);
    setCustomDocumentTitle(`${baseTitle}（再発行）`);
    setCustomHtmlOverride(preservedHtml);
    setHasStartedDocument(true);
    setSaveMessage('送付済み・保管済み書類を複製し、新規書類として編集できる状態にしました。');
  };

  return (
    <div className="space-y-3">
      {/* Compact Sticky-style Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>顧客別一覧に戻る</span>
            </button>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900 truncate">
                {customDocumentTitle.trim() || activeSavedDocMeta?.title || currentTemplate.title}
              </span>
              <span className="text-xs text-slate-400">·</span>
              {activeSavedDocMeta ? (
                <span className={`text-xs font-semibold ${
                  isProtectedSavedDoc ? 'text-emerald-700' : 'text-purple-700'
                }`}>
                  {getDocumentStatusLabel(activeSavedDocMeta.status)}
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-700">新規作成中</span>
              )}
            </div>
            {saveMessage && <p role="status" className="text-[11px] text-purple-700 font-medium mt-0.5 truncate">{saveMessage}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]) && (() => {
            const activeDocId = savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id];
            const applyUrl = `${window.location.origin}/docs/${encodeURIComponent(activeDocId)}`;
            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(applyUrl);
                    setCopiedApplyUrl(true);
                    setTimeout(() => setCopiedApplyUrl(false), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="顧客に送るWeb申込・書類確認ページのURLをコピー"
                >
                  {copiedApplyUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{copiedApplyUrl ? 'URLコピー完了' : 'Web申込URL'}</span>
                </button>
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1 transition-all"
                  title="顧客が見るWeb申込・書類確認ページを開く"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>申込画面</span>
                </a>
              </>
            );
          })()}

          {isProtectedSavedDoc ? (
            <button
              type="button"
              onClick={duplicateProtectedAsNew}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>複製して新規編集</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleManualSave({ status: 'draft' })}
                disabled={isSavingDocument || draftBusy}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>下書き保存</span>
              </button>
              <button
                type="button"
                onClick={() => (isProposalDoc && draftCtx && !draftTableMissing ? void saveProposalDraft('approved') : void handleManualSave({ status: 'approved' }))}
                disabled={isSavingDocument || draftBusy}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDocument ? '保存中…' : (savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]) ? '上書き保存（確定）' : '確定保存'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSendViaSendCenter}
            disabled={isSavingDocument}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>送信ドロワーで送る</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Compact Control Strip: Collapsible Relationship Summary + Single-Row 5-Step Template Switcher */}
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
            <span className="font-bold text-slate-700">紐付け対象:</span>
            <span className={`font-semibold ${selectedCompanyName ? 'text-slate-900' : 'text-amber-700'}`}>
              {selectedCompanyName || '会社未選択'}
            </span>
            {selectedContactName && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700">担当: {selectedContactName}</span>
              </>
            )}
            {selectedDealName && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-slate-600">商談: {selectedDealName}</span>
              </>
            )}
            {existingCompanyDocs.length > 0 && !relationshipExpanded && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-purple-700 font-medium">同社の保存済み書類 {existingCompanyDocs.length}件</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeSavedDocMeta && !isProtectedSavedDoc && (
              <button
                type="button"
                onClick={() => {
                  const templateKey = currentTemplate.id;
                  setForceNewDocMode(true);
                  delete autosavedDocumentIds.current[templateKey];
                  setSavedDocIds((prev) => {
                    const next = { ...prev };
                    delete next[templateKey];
                    return next;
                  });
                  setActiveSavedDocMeta(null);
                  setCustomHtmlOverride(null);
                  setCustomDocumentTitle('');
                  setEditorMode('form');
                  setSaveMessage('追加発注・別版用の新規書類作成に切り替えました。');
                }}
                className="px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>新規追加発注として作る</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setRelationshipExpanded((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              {relationshipExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{relationshipExpanded ? '紐付け・書類名設定を閉じる' : '会社・担当者・書類名を変更'}</span>
            </button>
          </div>
        </div>

        {relationshipExpanded && (
          <div className="pt-2.5 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {!initialCompanyId && !initialLeadId && !initialDealId && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={entitySearchQuery}
                    onChange={(e) => setEntitySearchQuery(e.target.value)}
                    placeholder="会社名・担当者名で絞り込み..."
                    className="pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-600 focus:outline-none w-56 sm:w-64"
                  />
                  {entitySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setEntitySearchQuery('')}
                      aria-label="検索をクリア"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {!initialCompanyId && !initialLeadId && !initialDealId && companies.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCompanyCleanupError('');
                    setSelectedCleanupCompanyIds([]);
                    setCompanyCleanupOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="会社リストに残っている不要な会社データを選択削除・全削除します"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>残っている会社を整理・削除 ({companies.length}社)</span>
                </button>
              )}
            </div>

            {(() => {
              const q = entitySearchQuery.trim().toLowerCase();
              const filteredCompanies = !q
                ? companies
                : companies.filter((c) => {
                    if (c.id === companyId) return true;
                    if (c.company_name.toLowerCase().includes(q)) return true;
                    return contacts.some((ct) => ct.company_id === c.id && ct.full_name.toLowerCase().includes(q));
                  });
              const filteredContacts = contacts.filter((c) => {
                if (c.id === contactId) return true;
                if (companyId && c.company_id !== companyId && c.company_id) return false;
                if (!q) return true;
                const compName = c.company_id ? (companies.find((comp) => comp.id === c.company_id)?.company_name || '') : '';
                return c.full_name.toLowerCase().includes(q) || compName.toLowerCase().includes(q);
              });

              return (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold text-slate-700">
                    会社（顧客企業）{q && <span className="text-[11px] font-normal text-purple-700 ml-1">({filteredCompanies.length}件)</span>}
                    <div className="mt-1 flex items-center gap-1.5">
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
                          setForceNewDocMode(false);
                          setActiveSavedDocMeta(null);
                          setCustomHtmlOverride(null);
                          autosavedDocumentIds.current = {};
                          setSavedDocIds({});
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none disabled:opacity-60"
                      >
                        <option value="">未選択</option>
                        {filteredCompanies.map((c) => (
                          <option key={c.id} value={c.id}>{c.company_name}</option>
                        ))}
                      </select>
                      {companyId && !initialCompanyId && !initialLeadId && !initialDealId && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = companies.find((c) => c.id === companyId);
                            if (target) {
                              setCompanyCleanupError('');
                              setConfirmDeleteSingleCompany(target);
                            }
                          }}
                          title="選択中の会社と関連データを削除"
                          aria-label="選択中の会社と関連データを削除"
                          className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 shrink-0 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    担当者{q && <span className="text-[11px] font-normal text-purple-700 ml-1">({filteredContacts.length}名)</span>}
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
                          setForceNewDocMode(false);
                          setActiveSavedDocMeta(null);
                          setCustomHtmlOverride(null);
                          autosavedDocumentIds.current = {};
                          setSavedDocIds({});
                        }
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none"
                    >
                      <option value="">未選択</option>
                      {filteredContacts.map((c) => {
                        const compName = !companyId && c.company_id ? companies.find((comp) => comp.id === c.company_id)?.company_name : '';
                        return (
                          <option key={c.id} value={c.id}>
                            {c.full_name}{compName ? `（${compName}）` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    商談案件（任意）
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
                  <label className="text-xs font-semibold text-slate-600">
                    反響リード（任意）
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
                </div>
              );
            })()}

            {/* Title & Existing saved document selector */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-semibold text-slate-700">書類名・対象書類:</span>
                <input
                  type="text"
                  value={customDocumentTitle}
                  onChange={(e) => {
                    setHasStartedDocument(true);
                    setCustomDocumentTitle(e.target.value);
                  }}
                  placeholder={`書類名（空欄なら「${currentTemplate.title}」）`}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-600 focus:outline-none w-56"
                />
              </div>

              {existingCompanyDocs.length > 0 && (
                <select
                  aria-label="保存済み書類の切替"
                  value={activeSavedDocMeta?.id || '__new__'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const templateKey = currentTemplate.id;
                    if (val === '__new__') {
                      setForceNewDocMode(true);
                      delete autosavedDocumentIds.current[templateKey];
                      setSavedDocIds((prev) => {
                        const next = { ...prev };
                        delete next[templateKey];
                        return next;
                      });
                      setActiveSavedDocMeta(null);
                      setCustomHtmlOverride(null);
                      setCustomDocumentTitle('');
                      setEditorMode('form');
                      setSaveMessage('追加発注・再見積用の新規書類モードに切り替えました。');
                      return;
                    }
                    const chosen = existingCompanyDocs.find((d) => d.id === val);
                    if (!chosen) return;
                    if (['sent', 'archived'].includes(String(chosen.status))) {
                      setForceNewDocMode(true);
                      delete autosavedDocumentIds.current[templateKey];
                      setSavedDocIds((prev) => {
                        const next = { ...prev };
                        delete next[templateKey];
                        return next;
                      });
                      setActiveSavedDocMeta(null);
                      setCustomDocumentTitle(`${chosen.title}（再発行）`);
                      setCustomHtmlOverride(chosen.body_html || null);
                      setSaveMessage('送付済み・保管済み書類は上書きされないため、新規書類として内容を引き継ぎました。');
                      return;
                    }
                    setForceNewDocMode(false);
                    autosavedDocumentIds.current[templateKey] = chosen.id;
                    setSavedDocIds((prev) => ({ ...prev, [templateKey]: chosen.id }));
                    setActiveSavedDocMeta({ id: chosen.id, title: chosen.title, status: chosen.status });
                    setCustomDocumentTitle(chosen.title || '');
                    setCustomHtmlOverride(chosen.body_html || null);
                    setEditorMode('rich');
                    setSaveMessage(`保存済み書類「${chosen.title}」を上書き編集対象に設定しました。`);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:border-purple-600 focus:outline-none max-w-[280px]"
                >
                  <option value="__new__">＋ 新規書類として作成（追加発注・別版）</option>
                  {existingCompanyDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{getDocumentStatusLabel(d.status)}] {d.title} ({new Date(d.updated_at || d.created_at || '').toLocaleDateString('ja-JP')})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Compact Single-Row 5-Step Core Template Switcher + Layout Mode Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {CORE_TEMPLATES.map((tpl) => {
              const isSelected = tpl.id === selectedTemplateId;
              const icons: Record<DocTemplateType, React.ReactNode> = {
                proposal: <Sparkles className="w-3.5 h-3.5 text-blue-600" />,
                estimate: <Calculator className="w-3.5 h-3.5 text-emerald-600" />,
                contract: <FileCheck2 className="w-3.5 h-3.5 text-purple-600" />,
                invoice: <Receipt className="w-3.5 h-3.5 text-amber-600" />,
                monthly_report: <BarChart3 className="w-3.5 h-3.5 text-cyan-600" />,
                report: <FileText className="w-3.5 h-3.5 text-indigo-600" />,
              };
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 border-purple-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-purple-300 font-medium'
                  }`}
                >
                  <span className={`font-mono text-[10px] ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                    {tpl.stepNum}
                  </span>
                  <span className={isSelected ? 'text-white [&>svg]:text-white' : ''}>
                    {icons[tpl.type]}
                  </span>
                  <span>{tpl.title}</span>
                </button>
              );
            })}
          </div>

          {/* Layout Expansion Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                layoutMode === 'split' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="左で編集・右でA4プレビューを同時表示"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>分割表示</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('editor_wide')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                layoutMode === 'editor_wide' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="編集エリアを横幅100%に拡大"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>編集を全幅拡大</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('preview_wide')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                layoutMode === 'preview_wide' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="A4プレビューを横幅100%に拡大"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>プレビュー拡大</span>
            </button>
          </div>
        </div>
      </section>

      {isProtectedSavedDoc && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <span>
            この書類は「{getDocumentStatusLabel(activeSavedDocMeta?.status)}」のため保護されており、直接上書きされません。内容を直して再発行する場合は「複製して新規編集」を押してください。
          </span>
          <button
            type="button"
            onClick={duplicateProtectedAsNew}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer shrink-0"
          >
            複製して新規編集する
          </button>
        </div>
      )}

      {/* Spacious Main Workspace Split / Wide View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Editor Panel */}
        {layoutMode !== 'preview_wide' && (
          <div className={`${layoutMode === 'editor_wide' ? 'lg:col-span-12' : 'lg:col-span-6'} bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col`}>
            {/* Editor Mode Tabs (Unified Form + WYSIWYG Direct Edit + HTML Source) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <h2 className="font-bold text-sm text-slate-900">
                  {currentTemplate.title} の編集
                </h2>
              </div>

              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorMode('form')}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    editorMode === 'form' ? 'bg-white text-purple-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>項目フォーム</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('rich')}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    editorMode === 'rich' ? 'bg-white text-purple-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>本文を直接編集</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('html')}
                  className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                    editorMode === 'html' ? 'bg-white text-purple-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>HTML編集</span>
                </button>
              </div>
            </div>

            {editorMode === 'rich' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!isProtectedSavedDoc && (
                      <>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            document.execCommand('bold');
                          }}
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                          title="選択文字を太字にする"
                        >
                          <Bold className="w-3.5 h-3.5" />
                          <span>太字</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            document.execCommand('underline');
                          }}
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                          title="選択文字に下線を引く"
                        >
                          <Underline className="w-3.5 h-3.5" />
                          <span>下線</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            document.execCommand('undo');
                          }}
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                          title="直前の操作を取り消す"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>元に戻す</span>
                        </button>
                      </>
                    )}
                    <span className="text-[11px] text-slate-500 ml-1">
                      {isProtectedSavedDoc
                        ? '送付済み・保管済み書類の閲覧ビューです。'
                        : '書類内の文字を直接クリックして自由に文言を修正できます。'}
                    </span>
                  </div>

                  {customHtmlOverride !== null && !isProtectedSavedDoc && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomHtmlOverride(null);
                        setHasStartedDocument(true);
                        setSaveMessage('項目フォームの内容から本文を再生成しました。');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>フォーム値で再生成</span>
                    </button>
                  )}
                </div>

                <div
                  ref={richEditorRef}
                  aria-label="書類本文の直接編集エリア"
                  contentEditable={!isProtectedSavedDoc}
                  suppressContentEditableWarning
                  onInput={(e) => {
                    if (isProtectedSavedDoc) return;
                    const nextHtml = e.currentTarget.innerHTML;
                    skipNextRichSyncRef.current = true;
                    setHasStartedDocument(true);
                    setCustomHtmlOverride(nextHtml);
                  }}
                  className="w-full min-h-[640px] max-h-[78vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-900 shadow-inner focus:outline-none focus:border-purple-600"
                />
              </div>
            ) : editorMode === 'html' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  HTMLと変数タグ（例: <code className="text-purple-700 font-semibold">{'{{client_company}}'}</code>）を直接編集できます。
                </p>
                <textarea
                  value={customHtmlOverride || getDynamicTemplateHtml(currentTemplate.id, paymentMode, invoiceSubtype)}
                  onChange={(e) => {
                    setHasStartedDocument(true);
                    setCustomHtmlOverride(e.target.value);
                  }}
                  disabled={isProtectedSavedDoc}
                  rows={26}
                  className="w-full min-h-[600px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-600 focus:bg-white disabled:opacity-60"
                />
                {!isProtectedSavedDoc && (
                  <button
                    type="button"
                    onClick={() => setCustomHtmlOverride(null)}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>自動生成HTMLに戻す</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3.5 min-h-[640px] max-h-[78vh] overflow-y-auto pr-1">
                {customHtmlOverride !== null && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2.5 text-xs text-purple-900 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      現在、保存済みまたは「本文を直接編集」で調整した本文が優先表示されています。フォームの入力内容を本文へ反映し直す場合は右のボタンを押してください。
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomHtmlOverride(null);
                        setHasStartedDocument(true);
                        setSaveMessage('項目フォームの入力内容を本文に再反映しました。');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs cursor-pointer shrink-0"
                    >
                      フォーム内容を本文に反映
                    </button>
                  </div>
                )}

                {/* 1. If Proposal/Report: Highlight Unified Nature */}
                {selectedTemplateId === 'tpl-proposal-report' && (
                  <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-3.5 space-y-2 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>診断の結果（D0〜D5）＋ ご提案（P1〜P7）</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!hearingCoreAnswers}
                          onClick={handleApplyHearingHintsToProposal}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-300 bg-white hover:bg-blue-50 text-blue-800 text-[11px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition whitespace-nowrap"
                          title={hearingCoreAnswers ? '商談シートのゴール・ツール・条件・対象外範囲を P3確認指標 と P5 に反映します' : '保存済みの商談シートがあると反映できます'}
                        >
                          <span>指標・P5へ反映</span>
                        </button>
                        <button
                          type="button"
                          disabled={!meetingCtx}
                          onClick={() => setMeetingModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition whitespace-nowrap"
                          title={meetingCtx ? 'ヒアリング回答・商談要約・合意事項を確認・編集して提案書へ反映します' : '紐付く診断レコードがある企業・リードを選択すると商談シートを開けます'}
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>商談シートを開く</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      下の「お支払い方式」を選ぶと、提案の型（現在: {PROPOSAL_KIND_LABELS[kindFromPaymentMode(paymentMode)]}）に合わせて項目とP5標準文が切り替わります。P1・P3（ロードマップ／確認指標）・P5（お願い／前提／対象外）は「AIで下書き」も使えます。
                    </p>
                  </div>
                )}

                {/* 2. If Estimate or Contract: Segmented Payment Switcher */}
                {(selectedTemplateId === 'tpl-unified-estimate' || selectedTemplateId === 'tpl-unified-contract' || selectedTemplateId === 'tpl-proposal-report') && (
                  <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/80 via-indigo-50/40 to-white p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                        <Coins className="w-3.5 h-3.5 text-purple-600" />
                        <span>お支払い条件・条項の即時切替</span>
                      </div>
                      <span className="text-[10px] font-medium text-purple-700 bg-white/90 px-2 py-0.5 rounded border border-purple-200 whitespace-nowrap">
                        {selectedTemplateId === 'tpl-proposal-report' ? `有効期限: 発行日から${PROPOSAL_VALID_DAYS}日間` : selectedTemplateId.includes('estimate') ? '有効期限: 発行日より1ヶ月間' : '支払期日: 翌月末日統一'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      {selectedTemplateId === 'tpl-proposal-report'
                        ? `選んだ方式で提案の型（${PROPOSAL_KIND_LABELS[kindFromPaymentMode(paymentMode)]}）とお支払い条件の初期文が切り替わります。金額は書き換わりません。`
                        : 'ワンタップで金額・消費税・条項文（期限の利益喪失条項・手付残金・顧問自動更新）が自動切替されます。'}
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

                {isProposalDoc && draftCtx && (
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-2xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800">状態: {draftRec ? `${draftStatusLabel[draftRec.status] || draftRec.status}(v${draftRec.version})` : '未保存'}</span>
                      <div className="flex gap-2">
                        <button type="button" disabled={draftBusy || draftTableMissing} onClick={() => void saveProposalDraft('drafting')} className="px-2.5 py-1 rounded-lg border border-slate-300 font-semibold disabled:opacity-50">作成中として保存</button>
                        <button type="button" disabled={draftBusy || draftTableMissing || blockers.length > 0} onClick={() => void saveProposalDraft('approved')} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">確定する</button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={roadmapOk} onChange={(e) => setRoadmapOk(e.target.checked)} />ロードマップ(P3)の内容を確認した</label>
                    {blockers.length > 0 && <p className="text-amber-800">確定するには: {blockers.join(' / ')}</p>}
                    {draftTableMissing && <p className="text-amber-800">保存先のテーブルが未作成のため、保存できません(docs/db-proposals の SQL を実行してください)。</p>}
                    {draftMsg && <p className="text-slate-700">{draftMsg}</p>}
                    <p className="text-slate-500">内容を直して保存し直すと「作成中」に戻ります。書類台帳の「作成中/確定」と同じ状態です。</p>
                  </div>
                )}

                {missingVariables.length > 0 && (
                  <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 shadow-2xs">
                    自動入力できなかった項目が {missingVariables.length} 件あります。
                    <span className="mt-1 block font-medium text-amber-800">{missingVariables.map((v) => v.label).join('、')}</span>
                  </div>
                )}

                {/* Form fields for template variables */}
                {currentTemplate.variables.map((v) => {
                  const isProposal = currentTemplate.id === 'tpl-proposal-report';
                  const isMonthlyReport = currentTemplate.id === 'tpl-monthly-report-01';
                  const multiline =
                    (isProposal && MULTILINE_KEYS.has(v.key)) ||
                    (isMonthlyReport && ['monthly_summary', 'accomplishments', 'next_actions'].includes(v.key));
                  const canDraft = isProposal && Boolean(DRAFTABLE_KEYS[v.key]);
                  const notice = draftNotices[v.key];
                  const fieldClass = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 focus:bg-white transition-colors shadow-2xs';
                  const placeholder = v.key === 'end_date' ? '任意（定める場合のみ入力）' : `${v.label}（未登録の場合は入力）`;
                  return (
                    <div key={v.key} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between gap-2">
                        <span>{v.label}</span>
                        <span className="flex items-center gap-1.5">
                          {canDraft && (
                            <button
                              type="button"
                              onClick={() => void handleDraftWithAi(v.key)}
                              disabled={Boolean(draftingKey)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-[10px] font-semibold text-emerald-800 border border-emerald-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                              title="診断の内容と商談メモをもとに、AIが下書きを作ります。サービス名・金額・期間は書きません"
                            >
                              <Sparkles className={`w-3 h-3 ${draftingKey === v.key ? 'animate-pulse' : ''}`} />
                              <span>{draftingKey === v.key ? '作成中…' : 'AIで下書き'}</span>
                            </button>
                          )}
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            {`{{${v.key}}}`}
                          </span>
                        </span>
                      </label>
                      {multiline ? (
                        <textarea
                          value={variableValues[v.key] ?? ''}
                          onChange={(e) => handleVariableChange(v.key, e.target.value)}
                          rows={v.key.startsWith('d') || v.key.startsWith('p_') || v.key === 'p1_policy' || v.key === 'p3_roadmap' ? 5 : isMonthlyReport && v.key !== 'monthly_summary' ? 4 : 3}
                          className={`${fieldClass} leading-relaxed resize-y`}
                          placeholder={placeholder}
                        />
                      ) : (
                        <input
                          type="text"
                          value={variableValues[v.key] ?? ''}
                          onChange={(e) => handleVariableChange(v.key, e.target.value)}
                          className={fieldClass}
                          placeholder={placeholder}
                        />
                      )}
                      {notice?.error && <p className="text-[11px] text-rose-700">{notice.error}</p>}
                      {notice && !notice.error && notice.placeholders > 0 && (
                        <p className="text-[11px] text-slate-600">下書きの「【○○: 要入力】」の {notice.placeholders} 箇所を、商談で決めた内容で埋めてください。</p>
                      )}
                      {notice?.warnings?.map((w) => (
                        <p key={w} className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">{w}</p>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {customHtmlOverride !== null ? '直接編集の内容を反映中' : '変数・計算式 反映中'}
              </span>
              <button
                type="button"
                onClick={() => handleSelectTemplate(currentTemplate.id)}
                className="text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>初期値に戻す</span>
              </button>
            </div>
          </div>
        )}

        {/* Right Live Preview Panel */}
        {layoutMode !== 'editor_wide' && (
          <div className={`${layoutMode === 'preview_wide' ? 'lg:col-span-12' : 'lg:col-span-6'} bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
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
                  type="button"
                  onClick={handleCopyHtml}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'コピー完了!' : 'HTMLコピー'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>印刷 / PDF</span>
                </button>
              </div>
            </div>

            {/* Rendered HTML Container */}
            <div className="flex-1 bg-white rounded-xl shadow-xs overflow-hidden min-h-[680px] max-h-[78vh] overflow-y-auto border border-slate-200">
              <div dangerouslySetInnerHTML={{ __html: populatedHtml }} />
            </div>
          </div>
        )}
      </div>

      {meetingModalOpen && meetingCtx && (
        <MeetingSessionView
          diagnosisId={meetingCtx.diagnosisId}
          companyId={meetingCtx.companyId}
          companyName={meetingCtx.companyName}
          formAnswers={meetingCtx.formAnswers}
          onClose={() => {
            setMeetingModalOpen(false);
            refreshMeetingMemoRef.current = true;
            setPopulateSeq((n) => n + 1);
          }}
        />
      )}

      {confirmDeleteSingleCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">会社データの削除確認</h3>
                  <p className="text-xs text-slate-500">関連する担当者・リード・商談・重要書類も連動削除</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteSingleCompany(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              「<span className="font-bold text-slate-900">{confirmDeleteSingleCompany.company_name}</span>」を削除しますか？
              紐づく担当者・リード・商談・顧客・契約・請求・重要書類・診断データも連動して削除されます（メール・LINE送信履歴は紐付け解除の上で保持されます）。
            </p>
            {companyCleanupError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {companyCleanupError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteSingleCompany(null)}
                disabled={isDeletingCompanies}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSingleCompanyDelete()}
                disabled={isDeletingCompanies}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingCompanies ? '削除中…' : '削除を実行する'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {companyCleanupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">会社データの整理・削除</h3>
                  <p className="text-xs text-slate-500">以前の登録や商談未紐付けで残った会社をまとめて削除できます</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompanyCleanupOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={companies.length > 0 && selectedCleanupCompanyIds.length === companies.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCleanupCompanyIds(companies.map((c) => c.id));
                      } else {
                        setSelectedCleanupCompanyIds([]);
                      }
                    }}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span>すべて選択 ({selectedCleanupCompanyIds.length} / {companies.length}社)</span>
                </label>
                <span className="text-[11px] text-slate-500">関連する担当者・リード・商談・書類も連動削除</span>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1">
                {companies.map((c) => {
                  const checked = selectedCleanupCompanyIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition ${
                        checked ? 'bg-rose-50/70 text-slate-900 border border-rose-200' : 'hover:bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCleanupCompanyIds((prev) => [...prev, c.id]);
                            } else {
                              setSelectedCleanupCompanyIds((prev) => prev.filter((id) => id !== c.id));
                            }
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="font-medium truncate">{c.company_name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{c.id}</span>
                    </label>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                ※ メール・LINEの送信履歴自体は証跡保全のため削除されず、会社・担当者等との紐付けのみ解除されます。
              </p>
            </div>

            {companyCleanupError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {companyCleanupError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCompanyCleanupOpen(false)}
                disabled={isDeletingCompanies}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleBulkCompanyDelete(selectedCleanupCompanyIds)}
                disabled={isDeletingCompanies || selectedCleanupCompanyIds.length === 0}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>選択した {selectedCleanupCompanyIds.length} 社を削除</span>
              </button>
              <button
                type="button"
                onClick={() => void handleBulkCompanyDelete(companies.map((c) => c.id))}
                disabled={isDeletingCompanies || companies.length === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingCompanies ? '削除実行中…' : `全 ${companies.length} 社を削除`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
