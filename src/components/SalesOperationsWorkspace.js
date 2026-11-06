import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { InlineDeleteButton } from './InlineDeleteButton';
import { FileText, Plus, RefreshCw, Receipt, Wrench, Trash2, Sparkles, CheckCircle2, X, Send } from 'lucide-react';
import { CustomerSupportWorkspace } from './CustomerSupportWorkspace';
import { fetchRecurringCandidates, generateRecurringInvoices, getCurrentTargetMonth, formatTargetMonthLabel, } from '../services/recurringInvoiceService';
const entityOptions = [
    ['companies', '会社'], ['contacts', '連絡先'], ['prospects', '見込み企業'],
    ['leads', 'リード'], ['deals', '商談'], ['customers', '顧客'],
];
const segmentConditionFields = {
    contacts: ['source', 'preferred_channel', 'role_title'],
    companies: ['industry'],
    prospects: ['status', 'source', 'approach_method', 'target_flag'],
    leads: ['status', 'inquiry_type', 'source', 'service_type', 'priority_channel'],
    deals: ['proposal_status', 'proposal_type'],
    customers: ['contract_status'],
};
const segmentConditionFieldLabels = {
    source: '流入元',
    preferred_channel: '希望する連絡手段',
    role_title: '役職',
    industry: '業種',
    status: '状況',
    inquiry_type: '希望内容（資料請求/相談）',
    approach_method: 'アプローチ方法',
    target_flag: '対象フラグ',
    service_type: '希望サービス',
    priority_channel: '優先する連絡手段',
    proposal_status: '提案状況',
    proposal_type: '提案の種類',
    contract_status: '契約状況',
};
const segmentConditionFieldHelp = {
    source: 'どこから問い合わせ・登録したか（例：ウェブサイト、紹介）',
    preferred_channel: '連絡先が希望する連絡方法（例：メール、電話）',
    role_title: '連絡先の役職・担当（例：代表、営業担当）',
    industry: '会社の業種（例：飲食、不動産）',
    status: '現在の対応状況（例：新規、対応中）',
    approach_method: '見込み企業への接触方法（例：電話、メール）',
    target_flag: '対象にするかどうかの登録値（例：true、false）',
    service_type: 'リードが希望するサービス（例：集客支援）',
    priority_channel: '優先する連絡方法（例：メール、電話）',
    proposal_status: '提案の進み具合（例：準備中、提出済み）',
    proposal_type: '提案の種類（例：新規提案、更新提案）',
    contract_status: '契約の状態（例：有効、終了）',
};
const opsTabs = [
    { key: 'contracts', label: '契約', table: 'customer_contracts', icon: FileText },
    { key: 'invoices', label: '請求', table: 'customer_invoices', icon: Receipt },
    { key: 'services', label: '顧問・構築支援', table: 'customer_service_engagements', icon: Wrench },
];
const contractStatusLabels = {
    draft: '下書き（未送付）',
    under_review: '社内確認中',
    sent: 'メール送付済み（同意返信待ち）',
    signed: '締結済み（相手の合意を確認）',
    expired: '期限切れ',
    canceled: '取消',
};
const invoiceStatusLabels = {
    draft: '下書き（未発行）',
    awaiting_approval: '承認待ち',
    issued: '発行済み（入金待ち）',
    paid: '入金済み',
    overdue: '支払期限超過',
    canceled: '取消',
};
const localDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const defaultInvoiceDueDate = (date = new Date()) => {
    const due = new Date(date.getFullYear(), date.getMonth(), 25);
    if (date.getDate() >= 25)
        due.setMonth(due.getMonth() + 1);
    return localDateString(due);
};
export const SalesOperationsWorkspace = ({ tab, companyId, leadId, dealId, onClearCompanyFilter, onOperationalRecordsChange, onMilestoneReached, onContractSigned, onInvoiceOverdue, onDeleteContract, onDeleteInvoice, invoices = [], tasks = [], onCreateTask, onUpdateTask, onOpenInvoiceDocuments }) => {
    const [segments, setSegments] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [outbox, setOutbox] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [deals, setDeals] = useState([]);
    const [savedContracts, setSavedContracts] = useState([]);
    const [recordProductId, setRecordProductId] = useState('');
    const [recordDealId, setRecordDealId] = useState('');
    const [recordContractId, setRecordContractId] = useState('');
    const [editingDocumentId, setEditingDocumentId] = useState('');
    const [editingDocumentBody, setEditingDocumentBody] = useState('');
    const [pendingDeleteDocumentId, setPendingDeleteDocumentId] = useState('');
    const [records, setRecords] = useState([]);
    const [activeOpsTab, setActiveOpsTab] = useState('contracts');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [segmentName, setSegmentName] = useState('');
    const [entityType, setEntityType] = useState('contacts');
    const [filterField, setFilterField] = useState('source');
    const [filterValue, setFilterValue] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [recordTitle, setRecordTitle] = useState('');
    const [recordCompany, setRecordCompany] = useState('');
    const [recordAmount, setRecordAmount] = useState('');
    const [recordDate, setRecordDate] = useState('');
    const [serviceType, setServiceType] = useState('retainer');
    const [milestoneDrafts, setMilestoneDrafts] = useState({});
    const [previewSegmentId, setPreviewSegmentId] = useState('');
    const [previewRows, setPreviewRows] = useState([]);
    // ─── 月次定期請求（MRR自動起票）State ───
    const [recurringMonth, setRecurringMonth] = useState(getCurrentTargetMonth());
    const [recurringCandidates, setRecurringCandidates] = useState([]);
    const [recurringSummary, setRecurringSummary] = useState(null);
    const [recurringModalOpen, setRecurringModalOpen] = useState(false);
    const [selectedContractIds, setSelectedContractIds] = useState([]);
    const [recurringIssueDate, setRecurringIssueDate] = useState('');
    const [recurringDueDate, setRecurringDueDate] = useState('');
    const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false);
    const [loadingRecurring, setLoadingRecurring] = useState(false);
    const selectedOps = opsTabs.find((item) => item.key === activeOpsTab) || opsTabs[0];
    const loadRecurringCandidates = async (month) => {
        setLoadingRecurring(true);
        try {
            const res = await fetchRecurringCandidates(month);
            setRecurringSummary(res.summary);
            setRecurringCandidates(res.candidates);
            // 未請求のものを初期選択
            const unbilledIds = res.candidates.filter((c) => !c.alreadyBilled).map((c) => c.contractId);
            setSelectedContractIds(unbilledIds);
            // 日付の初期化
            const [y, m] = month.split('-');
            setRecurringIssueDate(`${month}-01`);
            const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
            setRecurringDueDate(`${month}-${String(Math.min(25, lastDay)).padStart(2, '0')}`);
        }
        catch (err) {
            console.warn('loadRecurringCandidates error:', err);
        }
        finally {
            setLoadingRecurring(false);
        }
    };
    useEffect(() => {
        if (tab === 'operations' && activeOpsTab === 'invoices') {
            void loadRecurringCandidates(recurringMonth);
        }
    }, [tab, activeOpsTab, recurringMonth]);
    const handleGenerateRecurring = async () => {
        if (selectedContractIds.length === 0) {
            setError('発行対象の契約を1件以上選択してください。');
            return;
        }
        setIsGeneratingRecurring(true);
        setError('');
        try {
            const res = await generateRecurringInvoices({
                targetMonth: recurringMonth,
                contractIds: selectedContractIds,
                issueDate: recurringIssueDate,
                dueDate: recurringDueDate,
            });
            setNotice(`【${formatTargetMonthLabel(recurringMonth)}】定期請求書を ${res.generatedCount}件 一括生成しました。（スキップ: ${res.skippedCount}件）`);
            setRecurringModalOpen(false);
            await Promise.all([load(), loadRecurringCandidates(recurringMonth)]);
        }
        catch (err) {
            setError(err.message || '定期請求書の生成に失敗しました。');
        }
        finally {
            setIsGeneratingRecurring(false);
        }
    };
    useEffect(() => {
        if (!formOpen || activeOpsTab === 'services')
            return;
        const supabase = getSupabase();
        setRecordCompany(companyId || '');
        setRecordDate(activeOpsTab === 'invoices' ? defaultInvoiceDueDate() : localDateString());
        setRecordTitle(activeOpsTab === 'invoices' ? '請求書' : '契約書');
        setRecordDealId(dealId || '');
        setRecordProductId('');
        setRecordContractId('');
        if (!dealId || !supabase) {
            setRecordAmount('');
            return;
        }
        let cancelled = false;
        void supabase.from('deals').select('*').eq('id', dealId).maybeSingle().then(({ data }) => {
            if (cancelled || !data)
                return;
            setRecordTitle(data.deal_name || data.proposal_plan_name || (activeOpsTab === 'invoices' ? '請求書' : '契約書'));
            setRecordAmount(data.total_amount == null ? '' : String(data.total_amount));
            setRecordProductId(data.product_id || '');
            setRecordCompany(data.company_id || '');
        });
        return () => { cancelled = true; };
    }, [formOpen, activeOpsTab, dealId]);
    const load = async () => {
        const supabase = getSupabase();
        if (!supabase) {
            setError('Supabaseに接続してください。');
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (tab === 'segments') {
                const { data, error: queryError } = await supabase.from('crm_segments').select('*').order('created_at', { ascending: false });
                if (queryError)
                    throw queryError;
                setSegments((data || []));
            }
            else if (tab === 'documents') {
                let documentsQuery = supabase.from('customer_documents').select('*').order('created_at', { ascending: false }).limit(100);
                if (leadId)
                    documentsQuery = documentsQuery.or(`lead_id.eq.${leadId},and(lead_id.is.null,deal_id.is.null,company_id.eq.${companyId})`);
                else if (dealId)
                    documentsQuery = documentsQuery.or(`deal_id.eq.${dealId},and(deal_id.is.null,company_id.eq.${companyId})`);
                else if (companyId)
                    documentsQuery = documentsQuery.eq('company_id', companyId);
                const [docs, messages, companyResult] = await Promise.all([
                    documentsQuery,
                    supabase.from('communication_outbox').select('*').order('created_at', { ascending: false }).limit(100),
                    supabase.from('companies').select('id,company_name').order('company_name'),
                ]);
                if (docs.error)
                    throw docs.error;
                if (messages.error)
                    throw messages.error;
                if (!companyResult.error)
                    setCompanies(companyResult.data || []);
                setDocuments(docs.data || []);
                setOutbox(companyId ? (messages.data || []).filter((message) => (docs.data || []).some((doc) => doc.id === message.document_id)) : messages.data || []);
            }
            else {
                let recordsQuery = supabase.from(selectedOps.table).select('*').order('created_at', { ascending: false });
                if (companyId)
                    recordsQuery = recordsQuery.eq('company_id', companyId);
                const [recordsResult, companyResult, contractsResult, invoicesResult, productsResult, dealsResult] = await Promise.all([
                    recordsQuery,
                    supabase.from('companies').select('id,company_name').order('company_name'),
                    supabase.from('customer_contracts').select('*').order('created_at', { ascending: false }),
                    supabase.from('customer_invoices').select('*').order('created_at', { ascending: false }),
                    supabase.from('products').select('id,product_name,product_type,status').order('product_name'),
                    supabase.from('deals').select('id,company_id,product_id,proposal_plan_name,total_amount,proposal_status').order('created_at', { ascending: false }),
                ]);
                if (recordsResult.error)
                    throw recordsResult.error;
                if (companyResult.error)
                    throw companyResult.error;
                if (contractsResult.error)
                    throw contractsResult.error;
                if (invoicesResult.error)
                    throw invoicesResult.error;
                if (productsResult.error)
                    throw productsResult.error;
                if (dealsResult.error)
                    throw dealsResult.error;
                setRecords(recordsResult.data || []);
                setCompanies(companyResult.data || []);
                setCatalogProducts(productsResult.data || []);
                setDeals(dealsResult.data || []);
                setSavedContracts(contractsResult.data || []);
                const asTime = (value) => value ? (Date.parse(value) || Date.now()) : Date.now();
                onOperationalRecordsChange?.((contractsResult.data || []).map((row) => ({ id: row.legacy_id || row.id, title: row.title, type: row.contract_type, productId: row.product_id || undefined, companyId: row.company_id || undefined, counterpartyName: row.counterparty_name || '', status: row.status, startDate: row.start_date || undefined, endDate: row.end_date || undefined, amount: Number(row.amount || 0), notes: row.notes || undefined, createdAt: asTime(row.created_at), updatedAt: asTime(row.updated_at) })), (invoicesResult.data || []).map((row) => ({ id: row.legacy_id || row.id, invoiceNumber: row.invoice_number, title: row.title, productId: row.product_id || undefined, companyId: row.company_id || undefined, recipientName: row.recipient_name || '', amount: Number(row.amount || 0), taxAmount: row.tax_amount == null ? undefined : Number(row.tax_amount), status: row.status, issueDate: row.issue_date || '', dueDate: row.due_date || '', paidDate: row.paid_at || undefined, notes: row.notes || undefined, createdAt: asTime(row.created_at), updatedAt: asTime(row.updated_at) })));
            }
        }
        catch (e) {
            setError(e?.message || 'データを読み込めませんでした。');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, [tab, activeOpsTab, companyId, leadId, dealId]);
    const createSegment = async (event) => {
        event.preventDefault();
        const supabase = getSupabase();
        if (!filterField.trim() || !filterValue.trim()) {
            setError('項目と含む値を入力してください。');
            return;
        }
        if (!supabase || !segmentName.trim())
            return;
        setError('');
        setNotice('');
        const { error: insertError } = await supabase.from('crm_segments').insert({
            name: segmentName.trim(), entity_type: entityType,
            conditions: { field: filterField, operator: 'contains', value: filterValue.trim() },
        });
        if (insertError) {
            setError(insertError.message);
            return;
        }
        setSegmentName('');
        setFilterValue('');
        setNotice('配信対象リストを登録しました。対象CRMデータは複製していません。');
        await load();
    };
    const approveOutboxMessage = async (messageId) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        const { error: updateError } = await supabase.from('communication_outbox')
            .update({ status: 'queued' }).eq('id', messageId).eq('status', 'awaiting_approval');
        if (updateError)
            setError(updateError.message);
        else {
            setNotice('承認しました。送信待ちに登録しました。');
            await load();
        }
    };
    const cancelOutboxMessage = async (messageId) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        const { error: updateError } = await supabase.from('communication_outbox')
            .update({ status: 'canceled' }).eq('id', messageId).in('status', ['awaiting_approval', 'queued']);
        if (updateError)
            setError(updateError.message);
        else {
            setNotice('送信依頼を取り消しました。');
            await load();
        }
    };
    const updateDocumentStatus = async (documentId, status) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        setError('');
        setNotice('');
        const { error: updateError } = await supabase.from('customer_documents').update({ status }).eq('id', documentId);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        // 承認された場合、自動で送信キュー（communication_outbox）に送付ドラフトを作成
        if (status === 'approved') {
            try {
                const { data: docData } = await supabase.from('customer_documents').select('*').eq('id', documentId).maybeSingle();
                if (docData) {
                    // すでにキューに登録されていないかチェック
                    const { data: existingOutbox } = await supabase.from('communication_outbox')
                        .select('id')
                        .eq('document_id', documentId)
                        .in('status', ['awaiting_approval', 'queued', 'sent'])
                        .maybeSingle();
                    if (!existingOutbox) {
                        let targetContact = null;
                        if (docData.contact_id) {
                            const { data: c } = await supabase.from('contacts').select('*').eq('id', docData.contact_id).maybeSingle();
                            targetContact = c;
                        }
                        else if (docData.company_id) {
                            const { data: c } = await supabase.from('contacts').select('*').eq('company_id', docData.company_id).limit(1).maybeSingle();
                            targetContact = c;
                        }
                        if (targetContact) {
                            const docUrl = `${window.location.origin}/docs/${encodeURIComponent(documentId)}`;
                            const docTypeName = docData.document_type === 'diagnosis_report' ? '診断レポート' : docData.document_type === 'proposal' ? '提案書' : docData.document_type === 'estimate' ? '見積書' : docData.document_type === 'contract' ? '契約書' : docData.document_type === 'invoice' ? '請求書' : docData.document_type === 'monthly_report' ? '月次報告書' : '書類';
                            const subject = `【${docTypeName}のご送付】${docData.title}｜${targetContact.full_name} 様`;
                            const body = `${targetContact.full_name} 様\n\nお世話になっております。有限会社MSTです。\n作成いたしました${docTypeName}「${docData.title}」をお送りいたします。\n\n以下のリンクよりWeb上でご確認・PDF保存いただけます。\n${docUrl}\n\n内容をご確認いただき、ご不明点やご要望がございましたらお気軽にご連絡ください。\nよろしくお願いいたします。\n\n有限会社MST`;
                            const channel = targetContact.line_user_id ? 'line' : 'email';
                            const address = channel === 'line' ? targetContact.line_user_id : targetContact.email;
                            if (address) {
                                const { data: authData } = await supabase.auth.getUser();
                                const ownerId = authData?.user?.id;
                                if (ownerId) {
                                    await supabase.from('communication_outbox').insert({
                                        owner_id: ownerId,
                                        channel,
                                        recipient_contact_id: targetContact.id,
                                        recipient_address: address,
                                        subject,
                                        body_text: body,
                                        document_id: documentId,
                                        source_type: 'document_approval',
                                        status: 'awaiting_approval',
                                    });
                                    setNotice(`書類を承認し、送信キューに送付案（承認待ち）を自動作成しました。下部の送信キューで確認・送信できます。`);
                                }
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.error('Failed to auto-create outbox draft:', err);
            }
        }
        await load();
    };
    const deleteDocumentDraft = async (doc) => {
        if (!['draft', 'awaiting_approval'].includes(doc.status))
            return;
        const supabase = getSupabase();
        if (!supabase) {
            setError('Supabaseに接続できません。');
            return;
        }
        setError('');
        setNotice('');
        try {
            const [outboxResult, contractResult, invoiceResult] = await Promise.all([
                supabase.from('communication_outbox').select('id').eq('document_id', doc.id).limit(1),
                supabase.from('customer_contracts').select('id').eq('document_id', doc.id).limit(1),
                supabase.from('customer_invoices').select('id').eq('document_id', doc.id).limit(1),
            ]);
            const referenceError = outboxResult.error || contractResult.error || invoiceResult.error;
            if (referenceError) {
                setError(`関連データを確認できず削除を中止しました: ${referenceError.message}`);
                return;
            }
            if (outboxResult.data?.length) {
                setError('送信履歴がある書類は削除できません。保管に変更してください。');
                return;
            }
            if (contractResult.data?.length || invoiceResult.data?.length) {
                setError('契約または請求に紐づく書類は削除できません。関連記録を保護するため保管にしてください。');
                return;
            }
            const { data: deleted, error: deleteError } = await supabase.from('customer_documents')
                .delete().eq('id', doc.id).in('status', ['draft', 'awaiting_approval']).select('id').maybeSingle();
            if (deleteError) {
                setError(`削除できませんでした: ${deleteError.message}`);
                return;
            }
            if (!deleted) {
                setError('削除対象が見つからないか、削除権限がありません。画面を再読み込みしてください。');
                return;
            }
            setPendingDeleteDocumentId('');
            setNotice('未送信の書類を削除しました。');
            if (editingDocumentId === doc.id) {
                setEditingDocumentId('');
                setEditingDocumentBody('');
            }
            await load();
        }
        catch (error) {
            setError(error instanceof Error ? `削除できませんでした: ${error.message}` : '書類を削除できませんでした。');
        }
    };
    const saveDocumentBody = async (documentId) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        const editor = document.getElementById(`generated-document-editor-${documentId}`);
        const bodyHtml = editor?.innerHTML ?? editingDocumentBody;
        const { error: updateError } = await supabase.from('customer_documents')
            .update({ body_html: bodyHtml, updated_at: new Date().toISOString() }).eq('id', documentId);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        setNotice('書類本文を保存しました。確認後に承認してください。');
        setEditingDocumentId('');
        setEditingDocumentBody('');
        await load();
    };
    const deleteOperationRecord = async (record) => {
        const isContract = activeOpsTab === 'contracts';
        if (!isContract && activeOpsTab !== 'invoices')
            return;
        const statusLabel = (isContract ? contractStatusLabels : invoiceStatusLabels)[record.status] || record.status || '未設定';
        const details = isContract
            ? `契約名: ${record.title || '契約書'}\n契約相手: ${companies.find((item) => item.id === record.company_id)?.company_name || record.counterparty_name || '未設定'}\n状態: ${statusLabel}`
            : `請求番号: ${record.invoice_number || '未設定'}\n件名: ${record.title || '請求書'}\n金額: ${record.amount == null ? '未設定' : Number(record.amount).toLocaleString('ja-JP') + '円'}\n状態: ${statusLabel}`;
        if (!window.confirm(`この${isContract ? '契約' : '請求'}を削除しますか？\n\n${details}`))
            return;
        const confirmedStatuses = isContract ? ['signed', 'active', 'effective', 'in_force'] : ['issued', 'paid', 'overdue'];
        if (confirmedStatuses.includes(String(record.status).toLowerCase()) && !window.confirm('確定した記録です。会計・契約の記録として残す場合は、削除ではなく『取消』の状態にしてください。削除すると元に戻せません。'))
            return;
        const deleteHandler = isContract ? onDeleteContract : onDeleteInvoice;
        if (!deleteHandler) {
            setError('削除処理が接続されていません。');
            return;
        }
        setError('');
        setNotice('');
        setRecords((current) => current.filter((item) => item.id !== record.id));
        try {
            await deleteHandler(String(record.legacy_id || record.id));
            setNotice(`${isContract ? '契約' : '請求'}を削除しました。`);
            await load();
        }
        catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : '削除の保存に失敗しました。');
        }
    };
    const updateOperationStatus = async (record, status) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        const { error: updateError } = await supabase.from(selectedOps.table).update({ status, updated_at: new Date().toISOString() }).eq('id', record.id);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        const sourceId = String(record.legacy_id || record.id);
        const companyName = companies.find((item) => item.id === record.company_id)?.company_name || record.counterparty_name || record.recipient_name || undefined;
        if (activeOpsTab === 'contracts' && status === 'signed') {
            if (record.status !== 'signed') {
                onContractSigned?.({ id: sourceId, title: record.title || '契約書', companyId: record.company_id || undefined, companyName, amount: record.amount == null ? undefined : Number(record.amount) });
            }
            if (record.company_id) {
                await supabase.from('deals')
                    .update({ proposal_status: '成約', updated_at: new Date().toISOString() })
                    .eq('company_id', record.company_id)
                    .neq('proposal_status', '成約');
            }
        }
        if (activeOpsTab === 'invoices' && status === 'paid' && record.company_id) {
            await supabase.from('deals')
                .update({ proposal_status: '成約', updated_at: new Date().toISOString() })
                .eq('company_id', record.company_id)
                .neq('proposal_status', '成約');
        }
        if (activeOpsTab === 'invoices' && status === 'overdue' && record.status !== 'overdue') {
            onInvoiceOverdue?.({ id: sourceId, title: record.title || '請求書', invoiceNumber: record.invoice_number || undefined, companyId: record.company_id || undefined, companyName, amount: record.amount == null ? undefined : Number(record.amount), dueDate: record.due_date || undefined });
        }
        await load();
    };
    const readMilestones = (record) => Array.isArray(record.milestone_data) ? record.milestone_data : [];
    const addServiceMilestone = async (record, titleOverride, dueDate) => {
        const title = (titleOverride || milestoneDrafts[record.id] || '').trim();
        const supabase = getSupabase();
        if (!supabase || !title)
            return;
        const milestones = readMilestones(record);
        const milestone = { id: crypto.randomUUID(), title, status: 'pending', due_date: dueDate || null, created_at: new Date().toISOString() };
        const { error: updateError } = await supabase.from('customer_service_engagements')
            .update({ milestone_data: [...milestones, milestone], updated_at: new Date().toISOString() }).eq('id', record.id);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        setMilestoneDrafts((current) => ({ ...current, [record.id]: '' }));
        setNotice('支援マイルストーンを登録しました。到達時に自動化タスクを作成できます。');
        await load();
    };
    const reachServiceMilestone = async (record, milestoneId) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        const milestones = readMilestones(record);
        const target = milestones.find((item) => item.id === milestoneId);
        if (!target || target.status === 'completed')
            return;
        const completedAt = new Date().toISOString();
        const updatedMilestones = milestones.map((item) => item.id === milestoneId ? { ...item, status: 'completed', completed_at: completedAt } : item);
        const { error: updateError } = await supabase.from('customer_service_engagements')
            .update({ milestone_data: updatedMilestones, updated_at: completedAt }).eq('id', record.id);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        const companyName = companies.find((item) => item.id === record.company_id)?.company_name;
        onMilestoneReached?.({ engagementId: record.id, milestoneId, milestoneTitle: target.title, companyId: record.company_id || undefined, companyName });
        setNotice('到達を記録し、設定が有効な場合は自動化タスクを作成しました。');
        await load();
    };
    const previewSegment = async (segment) => {
        const field = segment.conditions?.field?.trim() || '';
        if (!field) {
            setError('条件が未設定のため配信対象に使えません');
            setPreviewSegmentId(segment.id);
            setPreviewRows([]);
            return;
        }
        const supabase = getSupabase();
        if (!supabase)
            return;
        setError('');
        setPreviewSegmentId(segment.id);
        const { data, error: queryError } = await supabase.from(segment.entity_type).select('*');
        if (queryError) {
            setError(queryError.message);
            return;
        }
        const value = String(segment.conditions?.value || '').toLowerCase();
        setPreviewRows((data || []).filter((row) => String(row[field] ?? '').toLowerCase().includes(value)));
    };
    const createOperation = async (event) => {
        event.preventDefault();
        const supabase = getSupabase();
        if (!supabase || !recordTitle.trim())
            return;
        const selectedDeal = deals.find((deal) => deal.id === recordDealId);
        const selectedContract = savedContracts.find((contract) => contract.id === recordContractId);
        const operationCompanyId = companyId || recordCompany || selectedDeal?.company_id || selectedContract?.company_id;
        const operationProductId = activeOpsTab === 'invoices' ? (selectedContract?.product_id || recordProductId) : recordProductId;
        const payload = { title: recordTitle.trim(), company_id: operationCompanyId || null, product_id: operationProductId || null };
        if (activeOpsTab === 'contracts') {
            payload.amount = Number(recordAmount) || 0;
            payload.counterparty_name = companies.find((company) => company.id === operationCompanyId)?.company_name || null;
            payload.start_date = recordDate || null;
            payload.status = 'draft';
            payload.contract_type = 'service_agreement';
            payload.deal_id = recordDealId || null;
        }
        else if (activeOpsTab === 'invoices') {
            payload.invoice_number = `INV-${localDateString().replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
            payload.amount = Number(recordAmount) || 0;
            payload.recipient_name = companies.find((company) => company.id === operationCompanyId)?.company_name || null;
            payload.due_date = recordDate || null;
            payload.issue_date = localDateString();
            payload.contract_id = recordContractId || null;
            payload.status = 'draft';
        }
        else {
            payload.service_type = serviceType;
            payload.status = 'planned';
            payload.next_meeting_at = recordDate ? new Date(recordDate).toISOString() : null;
        }
        const { error: insertError } = await supabase.from(selectedOps.table).insert(payload);
        if (insertError) {
            setError(insertError.message);
            return;
        }
        setRecordTitle('');
        setRecordCompany('');
        setRecordAmount('');
        setRecordDate('');
        setRecordProductId('');
        setRecordDealId('');
        setRecordContractId('');
        setFormOpen(false);
        setNotice('記録を追加しました。送信・外部連携は承認と接続設定後に行います。');
        await load();
    };
    const title = tab === 'segments' ? '配信対象リスト' : tab === 'documents' ? '顧客書類・送付履歴' : '契約後の顧客運営';
    const description = tab === 'segments'
        ? '一斉配信や自動配信で、この条件に合う人だけに送るために使います。CRMレコードを条件で抽出します。会社・連絡先の複製は作りません。'
        : tab === 'documents'
            ? '生成済み書類と送信履歴を同じ顧客・商談に紐付けて追跡します。'
            : '契約・請求・顧問・構築支援の状態を管理します。顧客への連絡は送信センターへ渡します。';
    return _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: title }), _jsxs("button", { onClick: () => void load(), className: "flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer", children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5" }), "\u66F4\u65B0"] })] }), error && _jsx("div", { role: "alert", className: "rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs", children: error }), notice && _jsx("div", { role: "status", className: "rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 shadow-2xs", children: notice }), tab === 'segments' && _jsxs("div", { className: "grid gap-5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]", children: [_jsxs("form", { onSubmit: createSegment, className: "space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs", children: [_jsx("h2", { className: "font-bold text-slate-900 text-sm", children: "\u914D\u4FE1\u5BFE\u8C61\u30EA\u30B9\u30C8\u3092\u4F5C\u6210" }), _jsxs("label", { className: "block text-xs font-semibold text-slate-600", children: ["\u8868\u793A\u540D", _jsx("input", { value: segmentName, onChange: (e) => setSegmentName(e.target.value), required: true, className: "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs", placeholder: "\u4F8B\uFF1A\u8A3A\u65AD\u6E08\u307F\u306E\u30EA\u30FC\u30C9" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-600", children: ["\u5BFE\u8C61", _jsx("select", { value: entityType, onChange: (e) => { setEntityType(e.target.value); setFilterField(segmentConditionFields[e.target.value]?.[0] || ''); }, className: "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs cursor-pointer", children: entityOptions.map(([key, label]) => _jsx("option", { value: key, children: label }, key)) })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-600", children: ["\u6761\u4EF6\u306B\u4F7F\u3046\u9805\u76EE", _jsx("select", { value: filterField, onChange: (e) => setFilterField(e.target.value), required: true, className: "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs cursor-pointer", children: (segmentConditionFields[entityType] || []).map((field) => _jsx("option", { value: field, children: segmentConditionFieldLabels[field] || field }, field)) }), _jsx("span", { className: "mt-1 block text-[11px] leading-relaxed text-slate-400", children: segmentConditionFieldHelp[filterField] || '選んだ項目に、次の値が含まれるレコードを対象にします。' })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-600", children: ["\u542B\u3080\u5024", _jsx("input", { value: filterValue, onChange: (e) => setFilterValue(e.target.value), required: true, className: "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-purple-500 shadow-2xs", placeholder: "\u4F8B: Web\u30D5\u30A9\u30FC\u30E0\u3001\u6210\u7D04\u3001\u96C6\u5BA2\u652F\u63F4..." })] }), _jsxs("button", { disabled: loading, className: "flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 w-full", children: [_jsx(Plus, { className: "h-4 w-4" }), "\u6761\u4EF6\u3092\u4FDD\u5B58"] })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4", children: [_jsx("h2", { className: "font-bold text-slate-900 text-sm", children: "\u4FDD\u5B58\u3057\u305F\u914D\u4FE1\u5BFE\u8C61\u30EA\u30B9\u30C8" }), loading ? _jsx("p", { className: "text-xs text-slate-400", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" }) : segments.length === 0 ? _jsx("p", { className: "text-xs text-slate-400", children: "\u307E\u3060\u914D\u4FE1\u5BFE\u8C61\u30EA\u30B9\u30C8\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }) :
                                _jsx("ul", { className: "divide-y divide-slate-100", children: segments.map((segment) => _jsxs("li", { className: "flex flex-wrap items-center justify-between gap-2 py-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-bold text-xs text-slate-900", children: segment.name }), _jsxs("div", { className: "text-[11px] text-slate-500 mt-0.5", children: [entityOptions.find(([key]) => key === segment.entity_type)?.[1] || segment.entity_type, " \u00B7 ", segment.conditions?.field?.trim() ? _jsxs(_Fragment, { children: [segmentConditionFieldLabels[segment.conditions?.field || ''] || segment.conditions?.field, " \u306B\u300C", _jsx("span", { className: "font-semibold text-purple-700", children: segment.conditions?.value }), "\u300D\u3092\u542B\u3080"] }) : _jsx("span", { className: "text-amber-600", children: "\u6761\u4EF6\u304C\u672A\u8A2D\u5B9A\u306E\u305F\u3081\u914D\u4FE1\u5BFE\u8C61\u306B\u4F7F\u3048\u307E\u305B\u3093" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => void previewSegment(segment), className: "rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-2xs", children: "\u5BFE\u8C61\u3092\u78BA\u8A8D" }), _jsx(InlineDeleteButton, { warning: `「${segment.name}」を削除しますか？`, onConfirm: async () => { const db = getSupabase(); if (!db) {
                                                            setError('Supabaseに接続してください。');
                                                            return;
                                                        } const { data: deleted, error: deleteError } = await db.from('crm_segments').delete().eq('id', segment.id).select('id').maybeSingle(); if (deleteError) {
                                                            setError(deleteError.message);
                                                            return;
                                                        } if (!deleted) {
                                                            setError('削除対象が見つからないか、削除権限がありません。');
                                                            return;
                                                        } if (previewSegmentId === segment.id) {
                                                            setPreviewSegmentId('');
                                                            setPreviewRows([]);
                                                        } setNotice('配信対象リストを削除しました。'); await load(); }, children: "\u524A\u9664" })] })] }, segment.id)) }), previewSegmentId && _jsxs("div", { className: "mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2", children: [_jsxs("div", { className: "font-bold text-xs text-slate-800", children: ["\u62BD\u51FA\u5BFE\u8C61\u30EC\u30B3\u30FC\u30C9: ", _jsx("span", { className: "font-mono text-purple-700", children: previewRows.length }), " \u4EF6"] }), _jsx("ul", { className: "max-h-48 space-y-1 overflow-auto text-xs text-slate-600 divide-y divide-slate-100", children: previewRows.slice(0, 50).map((row, index) => _jsx("li", { className: "py-1", children: row.full_name || row.company_name || row.proposal_plan_name || row.id || 'レコード' }, String(row.id || index))) })] }), _jsx("p", { className: "text-[11px] text-slate-400", children: "\u914D\u4FE1\u76F4\u524D\u306B\u6761\u4EF6\u304B\u3089\u5BFE\u8C61\u3092\u81EA\u52D5\u62BD\u51FA\u3057\u307E\u3059\u3002\u9001\u4FE1\u6642\u70B9\u306E\u5B9B\u5148\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u3068\u540C\u610F\u72B6\u614B\u306E\u78BA\u8A8D\u306F\u3001\u914D\u4FE1\u5B9F\u884C\u6A5F\u80FD\u306E\u63A5\u7D9A\u6642\u306B\u8A18\u9332\u3057\u307E\u3059\u3002" })] })] }), tab === 'documents' && _jsxs("div", { className: "space-y-4", children: [companyId && _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs", children: [_jsx("span", { className: "text-purple-900 font-semibold", children: leadId ? `リードに関連する書類を表示中（ID: ${leadId}）` : dealId ? `商談に関連する書類を表示中（ID: ${dealId}）` : `この顧客に関連する書類を表示中（会社ID: ${companyId}）` }), onClearCompanyFilter && _jsx("button", { type: "button", onClick: onClearCompanyFilter, className: "rounded-lg border border-purple-300 bg-white px-2.5 py-1 text-purple-800 font-semibold hover:bg-purple-100 cursor-pointer shadow-2xs", children: "\u5168\u9867\u5BA2\u3092\u8868\u793A" })] }), _jsxs("div", { className: "grid gap-5 xl:grid-cols-2", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs", children: [_jsx("h2", { className: "mb-2 font-bold text-slate-900 text-sm", children: "\u751F\u6210\u6E08\u307F\u66F8\u985E" }), _jsx("p", { className: "mb-3.5 text-xs text-slate-500", children: "\u66F8\u985E\u3092\u9078\u3093\u3067\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC\u3092\u958B\u304D\u3001\u5B9B\u5148\u30FB\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30FB\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u9001\u4FE1\u3067\u304D\u307E\u3059\u3002" }), loading ? (_jsx("p", { className: "text-xs text-slate-400", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" })) : documents.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400 py-6 text-center", children: "\u66F8\u985E\u3072\u306A\u5F62\u304B\u3089\u4FDD\u5B58\u3057\u305F\u66F8\u985E\u304C\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059\u3002" })) : (_jsx("ul", { className: "divide-y divide-slate-100", children: documents.map((doc) => {
                                            const linkedCompany = doc.company_id ? companies.find((c) => c.id === doc.company_id) : undefined;
                                            return (_jsxs("li", { className: "py-3.5 space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("span", { className: "font-bold text-sm text-slate-900", children: doc.title }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { "aria-label": `${doc.title}の状態`, value: doc.status, onChange: (e) => void updateDocumentStatus(doc.id, e.target.value), className: "rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none", children: [_jsx("option", { value: "draft", children: "\u4E0B\u66F8\u304D" }), _jsx("option", { value: "awaiting_approval", children: "\u78BA\u8A8D\u5F85\u3061" }), _jsx("option", { value: "approved", children: "\u627F\u8A8D\u6E08\u307F" }), _jsx("option", { value: "archived", children: "\u4FDD\u7BA1" })] }), ['draft', 'awaiting_approval', 'archived'].includes(doc.status) && (pendingDeleteDocumentId === doc.id ? (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-amber-700 font-semibold", children: "\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F" }), _jsx("button", { type: "button", onClick: () => void deleteDocumentDraft(doc), className: "rounded-lg bg-rose-600 px-2 py-1 text-xs text-white font-semibold cursor-pointer", children: "\u524A\u9664\u78BA\u5B9A" }), _jsx("button", { type: "button", onClick: () => setPendingDeleteDocumentId(''), className: "rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 cursor-pointer", children: "\u53D6\u6D88" })] })) : (_jsxs("button", { type: "button", onClick: () => { setError(''); setPendingDeleteDocumentId(doc.id); }, className: "inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 cursor-pointer", children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u524A\u9664" })] })))] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-slate-500", children: [_jsx("span", { className: "rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] text-purple-700 font-semibold", children: doc.document_type === 'diagnosis_report' ? '診断レポート' : doc.document_type === 'proposal' ? '提案書' : doc.document_type === 'estimate' ? '見積書' : doc.document_type === 'contract' ? '契約書' : doc.document_type === 'invoice' ? '請求書' : doc.document_type === 'monthly_report' ? '月次報告書' : doc.document_type }), _jsx("span", { children: new Date(doc.created_at).toLocaleString('ja-JP') }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { className: linkedCompany ? 'text-purple-700 font-semibold' : 'text-slate-400', children: ["\u4F1A\u793E: ", linkedCompany ? linkedCompany.company_name : '未紐付け（送信センターで選択可能）'] })] }), ['draft', 'awaiting_approval'].includes(doc.status) && (_jsxs("details", { className: "rounded-xl border border-slate-200 bg-slate-50 p-3", children: [_jsx("summary", { className: "cursor-pointer text-xs text-purple-700 font-bold hover:text-purple-800", children: "\u672C\u6587\u3092\u78BA\u8A8D\u30FB\u76F4\u63A5\u7DE8\u96C6" }), _jsx("p", { className: "mt-2 text-xs leading-5 text-slate-500", children: "\u66F8\u985E\u306E\u898B\u305F\u76EE\u3092\u78BA\u8A8D\u3057\u306A\u304C\u3089\u3001\u672C\u6587\u3092\u76F4\u63A5\u4FEE\u6B63\u3067\u304D\u307E\u3059\u3002\u6587\u5B57\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u7DE8\u96C6\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), _jsx("div", { id: `generated-document-editor-${doc.id}`, "aria-label": `${doc.title}の本文`, contentEditable: true, suppressContentEditableWarning: true, role: "textbox", onFocus: () => {
                                                                    setEditingDocumentId(doc.id);
                                                                    setEditingDocumentBody(doc.body_html || '');
                                                                }, dangerouslySetInnerHTML: {
                                                                    __html: editingDocumentId === doc.id ? editingDocumentBody : (doc.body_html || ''),
                                                                }, className: "mt-2 max-h-[680px] min-h-96 overflow-auto rounded-xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-900 shadow-inner" }), _jsx("button", { type: "button", onClick: () => void saveDocumentBody(doc.id), disabled: editingDocumentId !== doc.id, className: "mt-2 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer shadow-2xs", children: "\u672C\u6587\u3092\u4FDD\u5B58" })] })), _jsxs("div", { className: "pt-1 flex flex-wrap items-center gap-2.5", children: [_jsxs("button", { type: "button", onClick: async () => {
                                                                    if (doc.status !== 'approved') {
                                                                        await updateDocumentStatus(doc.id, 'approved');
                                                                    }
                                                                    onOpenInvoiceDocuments?.(doc.company_id || '', doc.id);
                                                                }, disabled: !onOpenInvoiceDocuments, className: "inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50", title: "\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC\u3067\u5B9B\u5148\u30FB\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30FB\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u78BA\u8A8D\u3057\u3066\u9001\u4ED8\u3057\u307E\u3059", children: [_jsx(Send, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC\u3067\u9001\u308B" })] }), doc.status !== 'approved' && (_jsx("span", { className: "text-[11px] text-amber-700 font-medium", children: "\u203B \u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3068\u627F\u8A8D\u72B6\u614B\u306B\u66F4\u65B0\u3057\u3066\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC\u3092\u958B\u304D\u307E\u3059" }))] })] }, doc.id));
                                        }) }))] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs", children: [_jsx("h2", { className: "mb-2 font-bold text-slate-900 text-sm", children: "\u9001\u4FE1\u5C65\u6B74\u30FB\u9001\u4FE1\u5F85\u3061" }), loading ? (_jsx("p", { className: "text-xs text-slate-400", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" })) : outbox.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400 py-6 text-center", children: "\u500B\u5225\u9001\u4FE1\u30FB\u4E00\u6589\u914D\u4FE1\u30FB\u66F8\u985E\u9001\u4ED8\u306F\u3001\u540C\u3058\u9001\u4FE1\u53F0\u5E33\u306B\u96C6\u7D04\u3057\u307E\u3059\u3002" })) : (_jsx("ul", { className: "divide-y divide-slate-100", children: outbox.map((msg) => (_jsxs("li", { className: "py-3 space-y-1", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("span", { className: "font-semibold text-xs text-slate-900", children: msg.subject || msg.recipient_address }), _jsxs("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600", children: [msg.channel, " \u00B7 ", msg.status] })] }), _jsxs("div", { className: "text-xs text-slate-500", children: [new Date(msg.created_at).toLocaleString('ja-JP'), " \u00B7 \u540C\u610F\u6839\u62E0: ", msg.consent_basis || '記録なし'] }), ['awaiting_approval', 'queued'].includes(msg.status) && (_jsxs("div", { className: "mt-2 flex gap-2", children: [msg.status === 'awaiting_approval' && (_jsx("button", { type: "button", onClick: () => void approveOutboxMessage(msg.id), className: "rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer shadow-2xs", children: "\u627F\u8A8D\u3057\u3066\u9001\u4FE1\u5F85\u3061\u3078" })), _jsx("button", { type: "button", onClick: () => void cancelOutboxMessage(msg.id), className: "rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer", children: "\u9001\u4FE1\u4F9D\u983C\u3092\u53D6\u308A\u6D88\u3059" })] }))] }, msg.id))) })), _jsx("p", { className: "mt-3 text-xs text-amber-700 font-medium", children: "\u203B \u5B9F\u9001\u4FE1\u306F\u30B5\u30FC\u30D0\u30FC\u5074\u306ELINE\u30FB\u30E1\u30FC\u30EB\u63A5\u7D9A\u304C\u5FC5\u8981\u3067\u3059\u3002\u4E00\u89A7\u3078\u306E\u767B\u9332\u3060\u3051\u3067\u914D\u4FE1\u5B8C\u4E86\u306B\u306F\u306A\u308A\u307E\u305B\u3093\u3002" })] })] })] }), tab === 'operations' && _jsxs("section", { className: "space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs", children: [companyId && _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs", children: [_jsxs("span", { className: "text-purple-900 font-semibold", children: ["\u9867\u5BA2\u306B\u95A2\u9023\u3059\u308B\u5951\u7D04\u30FB\u8ACB\u6C42\u30FB\u652F\u63F4\u3092\u8868\u793A\u4E2D\uFF1A", companies.find((company) => company.id === companyId)?.company_name || companyId] }), onClearCompanyFilter && _jsx("button", { type: "button", onClick: onClearCompanyFilter, className: "rounded-lg border border-purple-300 bg-white px-2.5 py-1 text-purple-800 font-semibold hover:bg-purple-100 cursor-pointer shadow-2xs", children: "\u5168\u9867\u5BA2\u3092\u8868\u793A" })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("div", { className: "flex flex-wrap gap-2", children: opsTabs.map(({ key, label, icon: Icon }) => (_jsxs("button", { onClick: () => setActiveOpsTab(key), className: `flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${activeOpsTab === key
                                        ? 'bg-purple-600 text-white shadow-2xs'
                                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`, children: [_jsx(Icon, { className: "h-4 w-4" }), label] }, key))) }), activeOpsTab !== 'services' && (_jsxs("button", { onClick: () => setFormOpen((value) => !value), className: "flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer shadow-xs shadow-purple-600/20", children: [_jsx(Plus, { className: "h-4 w-4" }), "\u65B0\u898F\u767B\u9332"] }))] }), activeOpsTab === 'services' ? _jsx(CustomerSupportWorkspace, { companyId: companyId, companies: companies, engagements: records, invoices: invoices, tasks: tasks, onCreateTask: (task) => onCreateTask?.(task), onUpdateTask: (task) => onUpdateTask?.(task), onRefresh: load, onAddMilestone: addServiceMilestone, onCompleteMilestone: reachServiceMilestone }) : _jsxs(_Fragment, { children: [formOpen && _jsxs("form", { onSubmit: createOperation, className: "grid gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u540D\u79F0\uFF08\u521D\u671F\u5165\u529B\u6E08\u307F\u30FB\u5FC5\u8981\u306A\u5834\u5408\u306E\u307F\u4FEE\u6B63\uFF09", _jsx("input", { required: true, value: recordTitle, onChange: (e) => setRecordTitle(e.target.value), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u4F1A\u793E", _jsxs("select", { value: companyId || recordCompany, disabled: Boolean(companyId), onChange: (e) => setRecordCompany(e.target.value), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 disabled:opacity-60 focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "", children: "\u4F1A\u793E\u3092\u9078\u629E" }), companies.map(company => _jsx("option", { value: company.id, children: company.company_name }, company.id))] })] }), activeOpsTab === 'contracts' && _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u95A2\u9023\u5546\u8AC7\uFF08\u4EFB\u610F\uFF09", _jsxs("select", { value: recordDealId, onChange: (e) => { const id = e.target.value; setRecordDealId(id); const deal = deals.find((item) => item.id === id); if (deal) {
                                                    setRecordCompany(deal.company_id || '');
                                                    setRecordProductId(deal.product_id || '');
                                                    if (deal.proposal_plan_name)
                                                        setRecordTitle(deal.proposal_plan_name);
                                                    if (deal.total_amount != null)
                                                        setRecordAmount(String(deal.total_amount));
                                                } }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "", children: "\u5546\u8AC7\u3092\u9078\u629E\u3057\u306A\u3044" }), deals.filter((deal) => !(companyId || recordCompany) || deal.company_id === (companyId || recordCompany)).map((deal) => _jsx("option", { value: deal.id, children: deal.proposal_plan_name || deal.id }, deal.id))] })] }), activeOpsTab === 'invoices' && _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u95A2\u9023\u5951\u7D04\uFF08\u4EFB\u610F\uFF09", _jsxs("select", { value: recordContractId, onChange: (e) => { const id = e.target.value; setRecordContractId(id); const contract = savedContracts.find((item) => item.id === id); if (contract) {
                                                    setRecordCompany(contract.company_id || '');
                                                    setRecordProductId(contract.product_id || '');
                                                } }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "", children: "\u5951\u7D04\u3092\u9078\u629E\u3057\u306A\u3044" }), savedContracts.filter((contract) => !(companyId || recordCompany) || contract.company_id === (companyId || recordCompany)).map((contract) => _jsx("option", { value: contract.id, children: contract.title }, contract.id))] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u95A2\u9023\u5546\u54C1\uFF08\u4EFB\u610F\uFF09", _jsxs("select", { value: recordProductId, onChange: (e) => setRecordProductId(e.target.value), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "", children: "\u5546\u54C1\u3092\u9078\u629E\u3057\u306A\u3044" }), catalogProducts.filter((product) => product.status !== 'inactive' || product.id === recordProductId).map((product) => _jsxs("option", { value: product.id, children: [product.product_name, product.status === 'inactive' ? '（取扱停止・既存記録）' : ''] }, product.id))] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u91D1\u984D\uFF08\u7A0E\u629C\u30FB\u5186 / \u5546\u8AC7\u304B\u3089\u521D\u671F\u5165\u529B\uFF09", _jsx("input", { type: "number", min: "0", value: recordAmount, onChange: (e) => setRecordAmount(e.target.value), placeholder: "0", className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs" }), recordAmount !== '' && !isNaN(Number(recordAmount)) && (_jsxs("span", { className: "mt-1 block text-[11px] font-semibold text-purple-700", children: ["\u6D88\u8CBB\u7A0E (10%): \u00A5", Math.floor(Number(recordAmount) * 0.1).toLocaleString('ja-JP'), " \uFF5C \u7A0E\u8FBC\u5408\u8A08: \u00A5", Math.floor(Number(recordAmount) * 1.1).toLocaleString('ja-JP')] }))] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: [activeOpsTab === 'contracts' ? '開始日' : '支払期限（当月25日／25日以降は翌月25日）', _jsx("input", { type: "date", value: recordDate, onChange: (e) => setRecordDate(e.target.value), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs" })] }), _jsx("div", { className: "md:col-span-2", children: _jsx("button", { className: "rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 cursor-pointer", children: "\u4FDD\u5B58\u3059\u308B" }) })] }), activeOpsTab === 'invoices' && (_jsx("div", { className: "rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-2xs", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200", children: [_jsx(Sparkles, { className: "h-3 w-3" }), " \u6708\u6B21\u5B9A\u671F\u8ACB\u6C42\u30FBMRR\u81EA\u52D5\u5316"] }), _jsx("span", { className: "text-xs text-slate-500", children: "\u5BFE\u8C61\u6708:" }), _jsx("span", { className: "font-bold text-slate-900", children: formatTargetMonthLabel(recurringMonth) }), _jsx("div", { className: "inline-flex items-center gap-1 ml-1", children: [-1, 0, 1].map((offset) => {
                                                                const m = getCurrentTargetMonth(offset);
                                                                const label = offset === -1 ? '先月' : offset === 0 ? '今月' : '翌月';
                                                                return (_jsx("button", { type: "button", onClick: () => setRecurringMonth(m), className: `rounded-lg px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${recurringMonth === m
                                                                        ? 'bg-purple-600 text-white'
                                                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`, children: label }, m));
                                                            }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4 text-xs pt-1", children: [_jsxs("div", { className: "text-slate-600", children: ["\u7D99\u7D9A\u5951\u7D04: ", _jsx("strong", { className: "text-slate-900 text-sm", children: recurringSummary?.totalCandidates ?? '…' }), " \u793E"] }), _jsxs("div", { className: "text-slate-600", children: ["\u5B9A\u671FMRR: ", _jsxs("strong", { className: "text-purple-700 text-sm", children: ["\u00A5", (recurringSummary?.estimatedMonthlyRevenue ?? 0).toLocaleString('ja-JP')] }), " ", _jsx("span", { className: "text-[10px] text-slate-500", children: "(\u7A0E\u629C)" })] }), _jsxs("div", { className: "text-slate-600", children: ["\u8ACB\u6C42\u72B6\u6CC1: ", _jsxs("span", { className: "text-emerald-700 font-semibold", children: [recurringSummary?.alreadyBilledCount ?? 0, "\u793E \u767A\u884C\u6E08"] }), " / ", _jsxs("span", { className: "text-amber-700 font-semibold", children: [recurringSummary?.readyToBillCount ?? 0, "\u793E \u672A\u8ACB\u6C42"] })] })] })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs("button", { type: "button", onClick: () => {
                                                    setRecurringModalOpen(true);
                                                    void loadRecurringCandidates(recurringMonth);
                                                }, className: "flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 transition-all cursor-pointer", children: [_jsx(Receipt, { className: "h-4 w-4" }), _jsx("span", { children: "\u5B9A\u671F\u8ACB\u6C42\u66F8\u3092\u4E00\u62EC\u751F\u6210" }), (recurringSummary?.readyToBillCount ?? 0) > 0 && (_jsx("span", { className: "rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900", children: recurringSummary?.readyToBillCount }))] }) })] }) })), recurringModalOpen && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs", children: _jsxs("div", { className: "w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-3", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-base font-bold text-slate-900 flex items-center gap-2", children: [_jsx(Receipt, { className: "h-5 w-5 text-purple-600" }), "\u3010", formatTargetMonthLabel(recurringMonth), "\u3011\u6708\u6B21\u5B9A\u671F\u8ACB\u6C42\u66F8\u306E\u4E00\u62EC\u751F\u6210"] }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "\u7DE0\u7D50\u30FB\u6709\u52B9\u306A\u9867\u554F\u5951\u7D04\u304B\u3089\u3001\u5F53\u6708\u5206\u306E\u8ACB\u6C42\u66F8\u3068\u8ACB\u6C42\u66F8\u985E\uFF08\u632F\u8FBC\u5148: \u6709\u9650\u4F1A\u793EMST\uFF09\u3092\u4E00\u62EC\u8D77\u7968\u3057\u307E\u3059\u3002" })] }), _jsx("button", { type: "button", onClick: () => setRecurringModalOpen(false), className: "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer", children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-slate-600 font-semibold mb-1", children: "\u5BFE\u8C61\u6708 (YYYY-MM)" }), _jsx("input", { type: "month", value: recurringMonth, onChange: (e) => {
                                                                if (e.target.value)
                                                                    setRecurringMonth(e.target.value);
                                                            }, className: "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-slate-600 font-semibold mb-1", children: "\u767A\u884C\u65E5 (\u8D77\u7968\u65E5)" }), _jsx("input", { type: "date", value: recurringIssueDate, onChange: (e) => setRecurringIssueDate(e.target.value), className: "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-slate-600 font-semibold mb-1", children: "\u652F\u6255\u671F\u65E5" }), _jsx("input", { type: "date", value: recurringDueDate, onChange: (e) => setRecurringDueDate(e.target.value), className: "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto space-y-2 min-h-48 border border-slate-200 rounded-xl bg-slate-50 p-2.5", children: [_jsxs("div", { className: "flex items-center justify-between px-2 py-1 text-xs text-slate-500 border-b border-slate-200/80", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("button", { type: "button", onClick: () => {
                                                                        const unbilled = recurringCandidates.filter((c) => !c.alreadyBilled).map((c) => c.contractId);
                                                                        setSelectedContractIds(unbilled);
                                                                    }, className: "text-purple-700 font-semibold hover:underline cursor-pointer", children: ["\u672A\u8ACB\u6C42\u306E\u307F\u5168\u9078\u629E (", recurringCandidates.filter((c) => !c.alreadyBilled).length, "\u4EF6)"] }), _jsx("span", { children: "\uFF5C" }), _jsx("button", { type: "button", onClick: () => setSelectedContractIds([]), className: "text-slate-500 hover:underline cursor-pointer", children: "\u9078\u629E\u89E3\u9664" })] }), _jsxs("span", { children: ["\u9078\u629E\u4E2D: ", _jsx("strong", { className: "text-purple-700 font-bold", children: selectedContractIds.length }), " \u4EF6"] })] }), loadingRecurring ? (_jsxs("div", { className: "p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2", children: [_jsx(RefreshCw, { className: "h-4 w-4 animate-spin text-purple-600" }), "\u5B9A\u671F\u8ACB\u6C42\u5BFE\u8C61\u306E\u5951\u7D04\u3092\u78BA\u8A8D\u4E2D\u2026"] })) : recurringCandidates.length === 0 ? (_jsx("div", { className: "p-8 text-center text-xs text-slate-400", children: "\u6709\u52B9\u306A\u9867\u554F\u5951\u7D04\u307E\u305F\u306F\u6708\u6B21\u8CBB\u7528\u304C\u8A2D\u5B9A\u3055\u308C\u305F\u5951\u7D04\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u300C\u5951\u7D04\u300D\u30BF\u30D6\u304B\u3089\u9867\u554F\u5951\u7D04\uFF08retainer\uFF09\u3092\u767B\u9332\u30FB\u7DE0\u7D50\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })) : (_jsx("div", { className: "divide-y divide-slate-200", children: recurringCandidates.map((c) => {
                                                        const isChecked = selectedContractIds.includes(c.contractId);
                                                        return (_jsxs("div", { className: `flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${c.alreadyBilled
                                                                ? 'opacity-60 bg-slate-100/60'
                                                                : isChecked
                                                                    ? 'bg-purple-50/80 border border-purple-200'
                                                                    : 'hover:bg-white'}`, children: [_jsxs("label", { className: "flex items-center gap-3 cursor-pointer flex-1", children: [_jsx("input", { type: "checkbox", disabled: c.alreadyBilled || isGeneratingRecurring, checked: isChecked, onChange: (e) => {
                                                                                if (e.target.checked) {
                                                                                    setSelectedContractIds((prev) => [...prev, c.contractId]);
                                                                                }
                                                                                else {
                                                                                    setSelectedContractIds((prev) => prev.filter((id) => id !== c.contractId));
                                                                                }
                                                                            }, className: "rounded border-slate-300 text-purple-600 focus:ring-purple-500 disabled:opacity-40" }), _jsxs("div", { children: [_jsxs("div", { className: "font-bold text-slate-900 flex items-center gap-2", children: [c.companyName, c.alreadyBilled ? (_jsxs("span", { className: "inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 font-medium", children: [_jsx(CheckCircle2, { className: "h-3 w-3 text-emerald-600" }), " ", c.existingInvoiceNumber || '今月発行済'] })) : (_jsx("span", { className: "inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] text-emerald-700 font-bold", children: "\u672A\u8ACB\u6C42\u30FB\u767A\u884C\u53EF\u80FD" }))] }), _jsxs("div", { className: "text-[11px] text-slate-500", children: [c.contractTitle, " ", c.productName ? `· ${c.productName}` : ''] })] })] }), _jsxs("div", { className: "text-right pl-3", children: [_jsxs("div", { className: "font-bold text-slate-900 text-sm", children: ["\u00A5", c.monthlyFee.toLocaleString('ja-JP'), " ", _jsx("span", { className: "text-[10px] text-slate-500 font-sans", children: "(\u7A0E\u629C)" })] }), _jsxs("div", { className: "text-[11px] text-purple-700 font-semibold", children: ["\u00A5", c.totalWithTax.toLocaleString('ja-JP'), " ", _jsx("span", { className: "text-[10px] text-slate-500 font-sans", children: "(\u7A0E\u8FBC)" })] })] })] }, c.contractId));
                                                    }) }))] }), _jsxs("div", { className: "border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-3", children: [_jsx("div", { className: "text-[11px] text-slate-500", children: "\u632F\u8FBC\u5148\u53E3\u5EA7: \u30C9\u30B3\u30E2SMTB\u30CD\u30C3\u30C8\u9280\u884C \u6CD5\u4EBA\u7B2C\u4E00\u652F\u5E97 \u666E\u901A 2223730\uFF08\u6709\u9650\u4F1A\u793EMST\uFF09" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setRecurringModalOpen(false), disabled: isGeneratingRecurring, className: "rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer", children: "\u9589\u3058\u308B" }), _jsx("button", { type: "button", onClick: () => void handleGenerateRecurring(), disabled: isGeneratingRecurring || selectedContractIds.length === 0, className: "flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 disabled:opacity-50 cursor-pointer", children: isGeneratingRecurring ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5 animate-spin" }), _jsx("span", { children: "\u4E00\u62EC\u8D77\u7968\u4E2D\u2026" })] })) : (_jsxs(_Fragment, { children: [_jsx(Receipt, { className: "h-3.5 w-3.5" }), _jsxs("span", { children: ["\u9078\u629E\u3057\u305F ", selectedContractIds.length, "\u4EF6 \u3092\u4E00\u62EC\u751F\u6210\u3059\u308B"] })] })) })] })] })] }) })), activeOpsTab === 'contracts' ? _jsx("p", { className: "text-xs text-slate-500", children: "\u72B6\u614B\u306E\u6D41\u308C\uFF1A\u4E0B\u66F8\u304D \u2192 \u793E\u5185\u78BA\u8A8D\u4E2D \u2192 \u30E1\u30FC\u30EB\u9001\u4ED8\u6E08\u307F\uFF08\u540C\u610F\u8FD4\u4FE1\u5F85\u3061\uFF09\u2192 \u7DE0\u7D50\u6E08\u307F\uFF08\u76F8\u624B\u306E\u5408\u610F\u3092\u78BA\u8A8D\uFF09\u3002\u76F8\u624B\u306E\u660E\u793A\u7684\u306A\u540C\u610F\u8FD4\u4FE1\u3092\u78BA\u8A8D\u3057\u305F\u5F8C\u306B\u300C\u7DE0\u7D50\u6E08\u307F\u300D\u3078\u66F4\u65B0\u3057\u3001\u8FD4\u4FE1\u30E1\u30FC\u30EB\u3068\u5951\u7D04\u66F8PDF\u3092\u5951\u7D04\u8A18\u9332\u3068\u3057\u3066\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u671F\u9650\u5207\u308C\u30FB\u53D6\u6D88\u306F\u7D42\u4E86\u72B6\u614B\u3067\u3059\u3002" }) : _jsx("p", { className: "text-xs text-slate-500", children: "\u72B6\u614B\u306E\u6D41\u308C\uFF1A\u4E0B\u66F8\u304D\uFF08\u672A\u767A\u884C\uFF09\u2192 \u627F\u8A8D\u5F85\u3061 \u2192 \u767A\u884C\u6E08\u307F\uFF08\u5165\u91D1\u5F85\u3061\uFF09\u2192 \u5165\u91D1\u6E08\u307F\u3002\u652F\u6255\u671F\u9650\u3092\u904E\u304E\u308B\u3068\u300C\u652F\u6255\u671F\u9650\u8D85\u904E\u300D\u3001\u53D6\u6D88\u306F\u7D42\u4E86\u72B6\u614B\u3067\u3059\u3002" }), loading ? _jsx("p", { className: "text-xs text-slate-400", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" }) : records.length === 0 ? _jsx("p", { className: "py-8 text-center text-xs text-slate-400", children: "\u767B\u9332\u30C7\u30FC\u30BF\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }) : _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200 text-xs font-semibold text-slate-600", children: [_jsx("th", { className: "p-2.5", children: "\u540D\u79F0" }), _jsx("th", { className: "p-2.5", children: "\u4F1A\u793E" }), _jsx("th", { className: "p-2.5", children: "\u95A2\u9023" }), _jsx("th", { className: "p-2.5", children: "\u72B6\u614B" }), _jsx("th", { className: "p-2.5", children: "\u91D1\u984D\uFF08\u7A0E\u629C / \u7A0E\u8FBC\uFF09" }), _jsx("th", { className: "p-2.5", children: "\u65E5\u4ED8" }), activeOpsTab === 'invoices' && _jsx("th", { className: "p-2.5", children: "\u66F8\u985E" }), _jsx("th", { className: "p-2.5", children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: records.map((record) => _jsxs("tr", { className: "text-slate-800 hover:bg-slate-50/50", children: [_jsx("td", { className: "p-2.5 font-semibold", children: record.title || record.invoice_number }), _jsx("td", { className: "p-2.5", children: companies.find((item) => item.id === record.company_id)?.company_name || record.company_id || '—' }), _jsx("td", { className: "p-2.5 text-xs text-slate-500", children: activeOpsTab === 'contracts' ? _jsxs(_Fragment, { children: [catalogProducts.find((product) => product.id === record.product_id)?.product_name || record.product_id || '商品未設定', record.deal_id && _jsxs("div", { children: ["\u5546\u8AC7: ", deals.find((deal) => deal.id === record.deal_id)?.proposal_plan_name || record.deal_id] })] }) : _jsxs(_Fragment, { children: [catalogProducts.find((product) => product.id === record.product_id)?.product_name || record.product_id || '商品未設定', record.contract_id && _jsxs("div", { children: ["\u5951\u7D04: ", savedContracts.find((contract) => contract.id === record.contract_id)?.title || record.contract_id] })] }) }), _jsx("td", { className: "p-2.5", children: _jsx("select", { "aria-label": `${record.title || record.invoice_number}の状態`, value: record.status, onChange: (e) => void updateOperationStatus(record, e.target.value), className: "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-purple-600 shadow-2xs", children: (activeOpsTab === 'contracts' ? ['draft', 'under_review', 'sent', 'signed', 'expired', 'canceled'] : ['draft', 'awaiting_approval', 'issued', 'paid', 'overdue', 'canceled']).map(status => _jsx("option", { value: status, children: (activeOpsTab === 'contracts' ? contractStatusLabels : invoiceStatusLabels)[status] || status }, status)) }) }), _jsx("td", { className: "p-2.5", children: record.amount == null ? '—' : _jsxs("div", { children: [_jsxs("div", { className: "font-medium text-slate-900", children: ["\u00A5", Number(record.amount).toLocaleString('ja-JP'), " ", _jsx("span", { className: "text-[10px] text-slate-500 font-sans", children: "(\u7A0E\u629C)" })] }), _jsxs("div", { className: "text-[11px] text-purple-700 font-semibold", children: ["\u00A5", Math.floor(Number(record.amount) * 1.1).toLocaleString('ja-JP'), " ", _jsx("span", { className: "text-[10px] text-slate-500 font-sans", children: "(\u7A0E\u8FBC)" })] })] }) }), _jsx("td", { className: "p-2.5 text-slate-600", children: record.due_date || record.start_date || '—' }), _jsx("td", { className: "p-2.5", children: activeOpsTab === 'invoices' && _jsx("button", { type: "button", onClick: () => record.company_id && onOpenInvoiceDocuments?.(record.company_id, record.document_id || undefined), disabled: !record.company_id || !onOpenInvoiceDocuments, className: "whitespace-nowrap rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-40 cursor-pointer shadow-2xs", children: "\u8ACB\u6C42\u66F8\u985E\u3092\u958B\u304F" }) }), _jsx("td", { className: "p-2.5", children: _jsx("button", { type: "button", onClick: () => void deleteOperationRecord(record), className: "rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer shadow-2xs", children: "\u524A\u9664" }) })] }, record.id)) })] }) })] })] })] });
};
