import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Mail, Share2, FileText, CheckCircle2, RefreshCw, Search, Filter, UserCheck, Calendar, ArrowRight, Send, Sparkles, ChevronDown, ChevronUp, Tag as TagIcon, Building2 } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { MarketingLineInboxView } from '../marketing/MarketingLineInboxView';
import { MarketingEmailInboxView } from '../marketing/MarketingEmailInboxView';
import { SocialDmSalesStudio } from '../marketing/SocialDmSalesStudio';
const STORAGE_DM_KEY = 'ai_social_dm_sales_items_v1';
export const UnifiedInboxView = ({ initialChannel = 'forms', initialLineUserId, onNavigateTab, onOpenSendCenter, onOpenCustomerWorkspace }) => {
    const db = getSupabase();
    const [activeChannel, setActiveChannel] = useState(() => {
        if (initialChannel && initialChannel !== 'forms')
            return initialChannel;
        try {
            const saved = localStorage.getItem('unified_inbox_active_channel');
            if (saved && ['line', 'email', 'social_dm', 'forms'].includes(saved)) {
                return saved;
            }
        }
        catch { }
        return initialChannel || 'forms';
    });
    useEffect(() => {
        if (initialChannel) {
            setActiveChannel(initialChannel);
        }
    }, [initialChannel]);
    const handleSelectChannel = (ch) => {
        setActiveChannel(ch);
        try {
            localStorage.setItem('unified_inbox_active_channel', ch);
        }
        catch { }
    };
    // Badge counters
    const [counts, setCounts] = useState({
        lineTotal: 0,
        lineInbound: 0,
        emailTotal: 0,
        dmInboundWaiting: 0,
        formsTotal: 0,
        formsReceived: 0,
    });
    // Forms & Submissions state
    const [submissions, setSubmissions] = useState([]);
    const [formsMeta, setFormsMeta] = useState(new Map());
    const [customerCompanyIds, setCustomerCompanyIds] = useState(new Set());
    const [customerStageFilter, setCustomerStageFilter] = useState('all');
    const [formFilterStatus, setFormFilterStatus] = useState('all');
    const [formSearchQuery, setFormSearchQuery] = useState('');
    const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);
    const [submissionNotice, setSubmissionNotice] = useState('');
    const [submissionError, setSubmissionError] = useState('');
    // Fetch summary counts for the 4 touchpoints
    const loadCounts = async () => {
        if (!db)
            return;
        try {
            const [lineRes, emailRes, subRes] = await Promise.all([
                db.from('line_inbox_messages').select('id,direction', { count: 'exact' }),
                db.from('email_inbox_messages').select('id', { count: 'exact' }),
                db.from('diagnosis_submissions').select('id,status'),
            ]);
            const lineList = (lineRes.data || []);
            const lineInbound = lineList.filter((m) => m.direction === 'inbound').length;
            const emailTotal = emailRes.count || 0;
            const subList = (subRes.data || []);
            const formsReceived = subList.filter((s) => s.status === 'received').length;
            // DM count from localStorage
            let dmInbound = 0;
            try {
                const rawDm = localStorage.getItem(STORAGE_DM_KEY);
                if (rawDm) {
                    const dmList = JSON.parse(rawDm);
                    dmInbound = dmList.filter((d) => d.status === 'inbound_waiting').length;
                }
            }
            catch {
                // ignore
            }
            setCounts({
                lineTotal: lineList.length,
                lineInbound,
                emailTotal,
                dmInboundWaiting: dmInbound,
                formsTotal: subList.length,
                formsReceived,
            });
        }
        catch {
            // quiet fallback
        }
    };
    // Load Form Submissions & Definitions & Customer Status
    const loadSubmissions = async () => {
        if (!db)
            return;
        setLoadingSubmissions(true);
        setSubmissionError('');
        try {
            const [subRes, formRes, custRes] = await Promise.all([
                db.from('diagnosis_submissions').select('*').order('submitted_at', { ascending: false }).limit(200),
                db.from('diagnosis_forms').select('id,name,form_type,public_slug,definition'),
                db.from('customers').select('company_id'),
            ]);
            if (subRes.error) {
                setSubmissionError(`回答一覧を取得できませんでした: ${subRes.error.message}`);
            }
            else {
                setSubmissions((subRes.data || []));
            }
            if (formRes.data) {
                const map = new Map();
                formRes.data.forEach((f) => {
                    map.set(f.id, f);
                });
                setFormsMeta(map);
            }
            if (custRes.data) {
                setCustomerCompanyIds(new Set(custRes.data.map((c) => c.company_id).filter(Boolean)));
            }
        }
        catch (err) {
            setSubmissionError(err.message || 'データ取得エラー');
        }
        finally {
            setLoadingSubmissions(false);
        }
    };
    useEffect(() => {
        void loadCounts();
        void loadSubmissions();
    }, []);
    // Update submission status
    const handleUpdateSubmissionStatus = async (sub, newStatus) => {
        if (!db)
            return;
        const { error } = await db
            .from('diagnosis_submissions')
            .update({ status: newStatus })
            .eq('id', sub.id);
        if (error) {
            setSubmissionError(`更新に失敗しました: ${error.message}`);
        }
        else {
            setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: newStatus } : s)));
            void loadCounts();
        }
    };
    // Quick 1-click convert to Lead
    const handleConvertToLead = async (sub) => {
        if (!db)
            return;
        setSubmissionNotice('');
        setSubmissionError('');
        try {
            const formMeta = formsMeta.get(sub.form_id);
            const companyName = sub.respondent_company_name || '新規反響企業（フォーム経由）';
            // 1. Check or create company
            let companyId = sub.company_id;
            if (!companyId) {
                const { data: comp, error: compErr } = await db
                    .from('companies')
                    .insert({
                    company_name: companyName,
                    status: 'active',
                })
                    .select('id')
                    .single();
                if (!compErr && comp) {
                    companyId = comp.id;
                }
            }
            // 2. Insert Lead
            const { data: newLead, error: leadErr } = await db
                .from('leads')
                .insert({
                company_id: companyId,
                source: 'form_diagnosis',
                status: 'uncontacted',
                inquiry_type: formMeta?.name || 'フォーム回答',
                notes: `【フォーム・診断回答より自動リード化】\n回答者: ${sub.respondent_name || '未記入'} (${sub.respondent_email || 'メール未記入'})\n受付日時: ${new Date(sub.submitted_at).toLocaleString('ja-JP')}`,
            })
                .select('id')
                .single();
            if (leadErr) {
                setSubmissionError(`リード作成に失敗しました: ${leadErr.message}`);
                return;
            }
            // 3. Update Submission with lead_id & company_id
            await db
                .from('diagnosis_submissions')
                .update({
                lead_id: newLead.id,
                company_id: companyId,
                status: 'reviewing',
            })
                .eq('id', sub.id);
            setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, lead_id: newLead.id, company_id: companyId, status: 'reviewing' } : s)));
            setSubmissionNotice(`「${companyName}」を反響リードに登録しました。リード一覧で詳細確認やフォローが可能です。`);
            void loadCounts();
        }
        catch (err) {
            setSubmissionError(`エラーが発生しました: ${err.message}`);
        }
    };
    // Save reviewer memo
    const handleSaveMemo = async (subId, memo) => {
        if (!db)
            return;
        await db.from('diagnosis_submissions').update({ reviewer_memo: memo }).eq('id', subId);
        setSubmissions((prev) => prev.map((s) => (s.id === subId ? { ...s, reviewer_memo: memo } : s)));
    };
    // Filtered submissions
    const visibleSubmissions = useMemo(() => {
        return submissions.filter((sub) => {
            if (formFilterStatus !== 'all' && sub.status !== formFilterStatus)
                return false;
            const isContracted = sub.company_id ? customerCompanyIds.has(sub.company_id) : false;
            if (customerStageFilter === 'customers' && !isContracted)
                return false;
            if (customerStageFilter === 'leads' && isContracted)
                return false;
            if (!formSearchQuery.trim())
                return true;
            const q = formSearchQuery.toLowerCase();
            const name = (sub.respondent_name || '').toLowerCase();
            const email = (sub.respondent_email || '').toLowerCase();
            const company = (sub.respondent_company_name || '').toLowerCase();
            const formName = (formsMeta.get(sub.form_id)?.name || '').toLowerCase();
            return name.includes(q) || email.includes(q) || company.includes(q) || formName.includes(q);
        });
    }, [submissions, formFilterStatus, customerStageFilter, formSearchQuery, formsMeta, customerCompanyIds]);
    const totalInboundNeedsAttention = counts.lineInbound + counts.dmInboundWaiting + counts.formsReceived;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u7D71\u5408\u53D7\u4FE1\u30C8\u30EC\u30A4" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("button", { onClick: () => {
                                    void loadCounts();
                                    void loadSubmissions();
                                }, className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer", title: "\u6700\u65B0\u306E\u53D7\u4FE1\u72B6\u614B\u3092\u518D\u8AAD\u307F\u8FBC\u307F", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: "\u66F4\u65B0" })] }), _jsxs("button", { onClick: () => onNavigateTab('leads'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer", children: [_jsx("span", { children: "\u53CD\u97FF\u30EA\u30FC\u30C9" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5 text-slate-400" })] }), _jsxs("button", { onClick: () => onNavigateTab('customers'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer", children: [_jsx("span", { children: "\u5951\u7D04\u9867\u5BA2\u53F0\u5E33" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5 text-slate-400" })] }), _jsxs("button", { onClick: () => onNavigateTab('document_templates'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer", children: [_jsx(FileText, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: "\u66F8\u985E\u30FB\u63D0\u6848\u66F8\u4F5C\u6210" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5 text-slate-400" })] }), _jsxs("button", { onClick: () => onNavigateTab('communication_send'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-xs font-medium text-white transition cursor-pointer", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5" })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3", children: [_jsxs("button", { onClick: () => handleSelectChannel('forms'), className: `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${activeChannel === 'forms'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'}`, children: [_jsx(FileText, { className: `w-4 h-4 ${activeChannel === 'forms' ? 'text-white' : 'text-emerald-600'}` }), _jsx("span", { children: "\u30D5\u30A9\u30FC\u30E0\u30FB\u7121\u6599\u8A3A\u65AD\u56DE\u7B54" }), _jsxs("span", { className: `px-2 py-0.5 rounded-full text-xs font-bold ${activeChannel === 'forms' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'}`, children: [counts.formsTotal, "\u4EF6"] }), counts.formsReceived > 0 && (_jsxs("span", { className: `px-2 py-0.5 rounded-full text-[11px] font-bold ${activeChannel === 'forms' ? 'bg-amber-300 text-amber-950' : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'}`, children: ["\u672A\u5BFE\u5FDC ", counts.formsReceived] }))] }), _jsxs("button", { onClick: () => handleSelectChannel('line'), className: `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${activeChannel === 'line'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'}`, children: [_jsx(MessageSquare, { className: `w-4 h-4 ${activeChannel === 'line' ? 'text-white' : 'text-emerald-600'}` }), _jsx("span", { children: "LINE\u516C\u5F0F\u30C1\u30E3\u30C3\u30C8" }), _jsxs("span", { className: `px-2 py-0.5 rounded-full text-xs font-bold ${activeChannel === 'line' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'}`, children: [counts.lineTotal, "\u901A"] }), counts.lineInbound > 0 && (_jsxs("span", { className: `px-2 py-0.5 rounded-full text-[11px] font-bold ${activeChannel === 'line' ? 'bg-emerald-300 text-emerald-950' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`, children: ["\u53D7\u4FE1 ", counts.lineInbound] }))] }), _jsxs("button", { onClick: () => handleSelectChannel('email'), className: `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${activeChannel === 'email'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'}`, children: [_jsx(Mail, { className: `w-4 h-4 ${activeChannel === 'email' ? 'text-white' : 'text-sky-600'}` }), _jsx("span", { children: "\u30E1\u30FC\u30EB\u53D7\u4FE1\u7BB1" }), _jsxs("span", { className: `px-2 py-0.5 rounded-full text-xs font-bold ${activeChannel === 'email' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'}`, children: [counts.emailTotal, "\u901A"] })] }), _jsxs("button", { onClick: () => handleSelectChannel('social_dm'), className: `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${activeChannel === 'social_dm'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'}`, children: [_jsx(Share2, { className: `w-4 h-4 ${activeChannel === 'social_dm' ? 'text-white' : 'text-purple-600'}` }), _jsx("span", { children: "SNS DM\u55B6\u696D\u30FB\u53D7\u4FE1" }), counts.dmInboundWaiting > 0 ? (_jsxs("span", { className: `px-2 py-0.5 rounded-full text-[11px] font-bold ${activeChannel === 'social_dm' ? 'bg-purple-300 text-purple-950' : 'bg-purple-100 text-purple-800 border border-purple-300 animate-pulse'}`, children: ["\u8FD4\u4FE1\u5F85\u3061 ", counts.dmInboundWaiting] })) : (_jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-bold ${activeChannel === 'social_dm' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'}`, children: "0\u4EF6" }))] })] }), submissionNotice && (_jsxs("div", { className: "p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between", children: [_jsx("span", { children: submissionNotice }), _jsx("button", { onClick: () => setSubmissionNotice(''), className: "text-emerald-600 hover:text-emerald-800 font-bold", children: "\u00D7" })] })), submissionError && (_jsxs("div", { className: "p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between", children: [_jsx("span", { children: submissionError }), _jsx("button", { onClick: () => setSubmissionError(''), className: "text-rose-600 hover:text-rose-800 font-bold", children: "\u00D7" })] })), activeChannel === 'forms' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-xs", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2.5", children: [_jsxs("div", { className: "flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs", children: [_jsxs("button", { type: "button", onClick: () => setCustomerStageFilter('all'), className: `px-2.5 py-1 rounded font-medium transition cursor-pointer ${customerStageFilter === 'all'
                                                    ? 'bg-purple-600 text-white font-semibold shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'}`, children: ["\u5168\u5BFE\u8C61 (", submissions.length, ")"] }), _jsxs("button", { type: "button", onClick: () => setCustomerStageFilter('leads'), className: `px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${customerStageFilter === 'leads'
                                                    ? 'bg-purple-600 text-white font-semibold shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'}`, children: [_jsx("span", { children: "\u53CD\u97FF\u30FB\u30EA\u30FC\u30C9" }), _jsxs("span", { className: "text-[10px] opacity-75", children: ["(", submissions.filter((s) => !s.company_id || !customerCompanyIds.has(s.company_id)).length, ")"] })] }), _jsxs("button", { type: "button", onClick: () => setCustomerStageFilter('customers'), className: `px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${customerStageFilter === 'customers'
                                                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'}`, children: [_jsx(Building2, { className: "w-3 h-3 text-emerald-200" }), _jsx("span", { children: "\u5951\u7D04\u4E2D\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8" }), _jsxs("span", { className: "text-[10px] opacity-75", children: ["(", submissions.filter((s) => s.company_id && customerCompanyIds.has(s.company_id)).length, ")"] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [_jsxs("span", { className: "text-xs text-slate-500 mr-1 flex items-center gap-1", children: [_jsx(Filter, { className: "w-3.5 h-3.5" }), " \u72B6\u614B:"] }), [
                                                { key: 'all', label: `すべて` },
                                                {
                                                    key: 'received',
                                                    label: `未対応 (${submissions.filter((s) => s.status === 'received').length})`,
                                                    color: 'text-amber-700 font-bold',
                                                },
                                                { key: 'reviewing', label: `対応中 (${submissions.filter((s) => s.status === 'reviewing').length})` },
                                                { key: 'completed', label: `完了 (${submissions.filter((s) => s.status === 'completed').length})` },
                                                { key: 'rejected', label: `対象外 (${submissions.filter((s) => s.status === 'rejected').length})` },
                                            ].map((filter) => (_jsx("button", { onClick: () => setFormFilterStatus(filter.key), className: `px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${formFilterStatus === filter.key
                                                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`, children: _jsx("span", { className: filter.color, children: filter.label }) }, filter.key)))] })] }), _jsxs("div", { className: "relative min-w-[240px]", children: [_jsx(Search, { className: "w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" }), _jsx("input", { type: "text", value: formSearchQuery, onChange: (e) => setFormSearchQuery(e.target.value), placeholder: "\u56DE\u7B54\u8005\u540D\u30FB\u4F1A\u793E\u540D\u30FB\u30E1\u30FC\u30EB\u691C\u7D22...", className: "w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500" })] })] }), loadingSubmissions ? (_jsxs("div", { className: "p-12 text-center text-sm text-slate-500 rounded-2xl border border-slate-200 bg-white shadow-xs", children: [_jsx(RefreshCw, { className: "w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" }), "\u56DE\u7B54\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D..."] })) : visibleSubmissions.length === 0 ? (_jsxs("div", { className: "p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-xs", children: [_jsx(FileText, { className: "w-10 h-10 mx-auto text-slate-300 mb-2" }), _jsx("p", { className: "text-sm font-semibold text-slate-800", children: "\u8A72\u5F53\u3059\u308B\u56DE\u7B54\u30C7\u30FC\u30BF\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }), _jsx("p", { className: "text-xs text-slate-500 mt-1", children: "HP\u3084\u516C\u958B\u8A3A\u65AD\u30D5\u30A9\u30FC\u30E0\u304B\u3089\u306E\u56DE\u7B54\u3092\u53D7\u4FE1\u3059\u308B\u3068\u3001\u3053\u3053\u306B\u5373\u6642\u84C4\u7A4D\u3055\u308C\u307E\u3059\u3002" }), _jsx("button", { onClick: () => onNavigateTab('mst_diagnoses'), className: "mt-4 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-xs text-purple-700 font-semibold border border-purple-200 transition cursor-pointer", children: "\u30D5\u30A9\u30FC\u30E0\u30FB\u8A3A\u65AD\u306E\u516C\u958B\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3059\u308B" })] })) : (_jsx("div", { className: "space-y-3", children: visibleSubmissions.map((sub) => {
                            const form = formsMeta.get(sub.form_id);
                            const isExpanded = expandedSubmissionId === sub.id;
                            const isContracted = sub.company_id ? customerCompanyIds.has(sub.company_id) : false;
                            const statusBadge = sub.status === 'received'
                                ? { label: '未対応（新規受付）', color: 'bg-amber-50 text-amber-800 border-amber-300' }
                                : sub.status === 'reviewing'
                                    ? { label: '対応中', color: 'bg-purple-50 text-purple-700 border-purple-300' }
                                    : sub.status === 'completed'
                                        ? { label: '完了', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
                                        : { label: '対象外', color: 'bg-slate-100 text-slate-600 border-slate-300' };
                            return (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-5 hover:border-purple-300 transition-all shadow-xs", children: [_jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: `px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.color}`, children: statusBadge.label }), isContracted ? (_jsxs("span", { className: "text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold flex items-center gap-1", children: [_jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-600" }), "\u5951\u7D04\u4E2D\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8"] })) : (_jsx("span", { className: "text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium", children: "\u53CD\u97FF\u30EA\u30FC\u30C9" })), _jsx("span", { className: "text-sm font-bold text-slate-900", children: sub.respondent_name || sub.respondent_email || '回答者（氏名未入力）' }), sub.respondent_company_name && (_jsx("span", { className: "text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium", children: sub.respondent_company_name })), _jsxs("span", { className: "text-xs text-slate-500", children: ["\u53D7\u4ED8\u65E5\u6642: ", new Date(sub.submitted_at).toLocaleString('ja-JP')] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5", children: [_jsxs("span", { children: ["\u30D5\u30A9\u30FC\u30E0: ", _jsx("strong", { className: "text-slate-800", children: form?.name || sub.form_id.slice(0, 8) })] }), sub.respondent_email && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u00B7" }), _jsxs("span", { children: ["\u2709\uFE0F ", sub.respondent_email] })] })), sub.score != null && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u00B7" }), _jsxs("span", { className: "text-purple-700 font-semibold", children: ["\u8A3A\u65AD\u30B9\u30B3\u30A2: ", sub.score, "\u70B9"] })] }))] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("select", { value: sub.status, onChange: (e) => void handleUpdateSubmissionStatus(sub, e.target.value), className: "px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-xs", children: [_jsx("option", { value: "received", children: "\u672A\u5BFE\u5FDC\uFF08\u53D7\u4ED8\uFF09" }), _jsx("option", { value: "reviewing", children: "\u5BFE\u5FDC\u4E2D" }), _jsx("option", { value: "completed", children: "\u5B8C\u4E86" }), _jsx("option", { value: "rejected", children: "\u5BFE\u8C61\u5916" })] }), isContracted && sub.company_id && (_jsxs("button", { type: "button", onClick: () => onOpenCustomerWorkspace?.(sub.company_id), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-300 shadow-xs transition cursor-pointer", title: "\u5951\u7D04\u9867\u5BA2\u30AB\u30EB\u30C6\u30FB\u652F\u63F4\u30BF\u30B9\u30AF\u3092\u958B\u304F", children: [_jsx(Building2, { className: "w-3.5 h-3.5 text-emerald-600" }), _jsx("span", { children: "\u9867\u5BA2\u30AB\u30EB\u30C6" })] })), !sub.lead_id ? (_jsxs("button", { onClick: () => void handleConvertToLead(sub), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white shadow-xs transition cursor-pointer", title: "\u3053\u306E\u56DE\u7B54\u5185\u5BB9\u3092\u55B6\u696D\u30EA\u30FC\u30C9\u53F0\u5E33\u306B\u767B\u9332", children: [_jsx(UserCheck, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u53CD\u97FF\u30EA\u30FC\u30C9\u306B\u767B\u9332" })] })) : (_jsxs("button", { onClick: () => onNavigateTab('leads'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-700 border border-purple-200 transition cursor-pointer", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: "\u30EA\u30FC\u30C9\u767B\u9332\u6E08" })] })), _jsxs("button", { onClick: () => {
                                                            if (onOpenSendCenter) {
                                                                onOpenSendCenter({
                                                                    companyId: sub.company_id || undefined,
                                                                    contactId: sub.contact_id || undefined,
                                                                    formId: sub.form_id,
                                                                    sendKind: isContracted ? 'customer_meeting' : 'deal',
                                                                });
                                                            }
                                                            onNavigateTab(isContracted ? 'customer_meeting_invitations' : 'deal_invitations');
                                                        }, className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer", children: [_jsx(Calendar, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: isContracted ? '面談案内' : '商談案内' })] }), _jsxs("button", { onClick: () => {
                                                            if (onOpenCustomerWorkspace && sub.company_id) {
                                                                onOpenCustomerWorkspace(sub.company_id, 'documents');
                                                            }
                                                            else {
                                                                onNavigateTab('document_templates');
                                                            }
                                                        }, className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-200 transition cursor-pointer", title: "\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54\u3092\u57FA\u306B\u91CD\u8981\u66F8\u985E\uFF08\u8A3A\u65AD\u30EC\u30DD\u30FC\u30C8\u30FB\u63D0\u6848\u66F8\uFF09\u3092\u76F4\u63A5AI\u751F\u6210\u30FB\u4F5C\u6210\u3057\u307E\u3059", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-emerald-600" }), _jsx("span", { children: "\u63D0\u6848\u66F8\u30FB\u30EC\u30DD\u30FC\u30C8\u4F5C\u6210" })] }), _jsxs("button", { onClick: () => setExpandedSubmissionId(isExpanded ? null : sub.id), className: "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer", children: [_jsx("span", { children: isExpanded ? '回答を閉じる' : '回答を見る' }), isExpanded ? _jsx(ChevronUp, { className: "w-3.5 h-3.5" }) : _jsx(ChevronDown, { className: "w-3.5 h-3.5" })] })] })] }), isExpanded && (_jsxs("div", { className: "mt-4 pt-4 border-t border-slate-200 space-y-4", children: [_jsxs("div", { className: "bg-slate-50 rounded-xl p-4 border border-slate-200", children: [_jsxs("h4", { className: "text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: "\u9001\u4FE1\u3055\u308C\u305F\u8A2D\u554F\u56DE\u7B54\u4E00\u89A7:" })] }), (() => {
                                                        const entries = Object.entries(sub.answers || {});
                                                        if (!entries.length) {
                                                            return _jsx("p", { className: "text-xs text-slate-500", children: "\u56DE\u7B54\u30C7\u30FC\u30BF\u304C\u3042\u308A\u307E\u305B\u3093\u3002" });
                                                        }
                                                        // Read question labels from form definition if available
                                                        const defQuestions = form?.definition?.questions || [];
                                                        const questionMap = new Map();
                                                        defQuestions.forEach((q) => {
                                                            if (q && q.id)
                                                                questionMap.set(q.id, q.label || q.id);
                                                        });
                                                        return (_jsx("div", { className: "space-y-2.5", children: entries.map(([key, val]) => {
                                                                const questionLabel = questionMap.get(key) || key;
                                                                const formattedValue = typeof val === 'boolean'
                                                                    ? val
                                                                        ? 'はい'
                                                                        : 'いいえ'
                                                                    : Array.isArray(val)
                                                                        ? val.join('、')
                                                                        : typeof val === 'object' && val !== null
                                                                            ? JSON.stringify(val, null, 2)
                                                                            : String(val ?? '—');
                                                                return (_jsxs("div", { className: "grid sm:grid-cols-[220px_1fr] gap-2 p-3 rounded-lg bg-white border border-slate-200 text-xs", children: [_jsx("div", { className: "font-semibold text-slate-600 break-words", children: questionLabel }), _jsx("div", { className: "text-slate-900 whitespace-pre-wrap break-words font-sans", children: formattedValue })] }, key));
                                                            }) }));
                                                    })()] }), _jsxs("div", { className: "flex flex-col sm:flex-row items-stretch sm:items-center gap-2", children: [_jsx("input", { type: "text", defaultValue: sub.reviewer_memo || '', onBlur: (e) => void handleSaveMemo(sub.id, e.target.value), placeholder: "\u793E\u5185\u5BFE\u5FDC\u30E1\u30E2\u3092\u5165\u529B\uFF08\u30D5\u30A9\u30FC\u30AB\u30B9\u304C\u5916\u308C\u308B\u3068\u81EA\u52D5\u4FDD\u5B58\u3055\u308C\u307E\u3059\uFF09", className: "flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500" }), _jsx("span", { className: "text-[11px] text-slate-400 self-center", children: "\u81EA\u52D5\u4FDD\u5B58\u6E08\u307F" })] })] }))] }, sub.id));
                        }) }))] })), activeChannel === 'line' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-600 animate-pulse" }), _jsx("span", { children: "LINE\u516C\u5F0F\u30A2\u30AB\u30A6\u30F3\u30C8\u306E1:1\u500B\u5225\u30C1\u30E3\u30C3\u30C8\u753B\u9762\u3067\u3059\u3002\u53CB\u3060\u3061\u3078\u306E\u500B\u5225\u8FD4\u4FE1\u3084\u30E1\u30C3\u30BB\u30FC\u30B8\u5C65\u6B74\u3092\u95B2\u89A7\u3067\u304D\u307E\u3059\u3002" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => onNavigateTab('contacts'), className: "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-xs transition cursor-pointer", children: [_jsx(TagIcon, { className: "w-3.5 h-3.5 text-emerald-600" }), _jsx("span", { children: "\u53CB\u3060\u3061\u30FB\u30BF\u30B0\u7BA1\u7406" })] }), _jsxs("button", { onClick: () => onNavigateTab('marketing_automation'), className: "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer", title: "\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0\u81EA\u52D5\u5316\u306ELINE\u8A2D\u5B9A\u3078", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u30A6\u30A7\u30EB\u30AB\u30E0Flex\u30FB\u81EA\u52D5\u8FD4\u4FE1\u8A2D\u5B9A\u3078" })] })] })] }), _jsx(MarketingLineInboxView, { initialLineUserId: initialLineUserId, chatOnly: true, onNavigateSettings: () => onNavigateTab('marketing_automation') })] })), activeChannel === 'email' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between p-4 rounded-xl border border-purple-200 bg-purple-50/70 text-xs text-purple-900", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-purple-600" }), _jsx("span", { children: "\u53D7\u4FE1\u7528\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u5B9B\u306B\u5C4A\u3044\u305F\u304A\u554F\u3044\u5408\u308F\u305B\u3084\u30A2\u30A6\u30C8\u30EA\u30FC\u30C1\u8FD4\u4FE1\u3092\u95B2\u89A7\u30FB\u7BA1\u7406\u3057\u307E\u3059\u3002" })] }), _jsxs("button", { onClick: () => onNavigateTab('communication_send'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200 shadow-xs transition cursor-pointer", children: [_jsx(Send, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: "\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC\uFF08\u8FD4\u4FE1\u30FB\u5546\u8AC7\u6848\u5185\uFF09\u3092\u958B\u304F" })] })] }), _jsx(MarketingEmailInboxView, {})] })), activeChannel === 'social_dm' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50/70 text-xs text-purple-900", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-purple-600 animate-pulse" }), _jsx("span", { children: "SNS\u304B\u3089\u5C4A\u3044\u305FDM\u30FB\u554F\u3044\u5408\u308F\u305B\u306E\u53D7\u4FE1\u30C8\u30EC\u30A4\u3067\u3059\u3002\u30C6\u30F3\u30D7\u30EC\u9078\u629E\u3084\u624B\u52D5\u8FD4\u4FE1\u3001CRM\u898B\u8FBC\u307F\u5BA2\u767B\u9332\u3092\u884C\u3048\u307E\u3059\u3002" })] }), _jsxs("button", { onClick: () => {
                                    try {
                                        localStorage.setItem('ai_acquisition_active_tab', 'social_studio');
                                        localStorage.setItem('social_studio_mode', 'dm_sales');
                                    }
                                    catch { }
                                    onNavigateTab('ai_acquisition', { acquisitionTab: 'social_studio', studioMode: 'dm_sales' });
                                }, className: "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\uD83C\uDFAF \u653B\u3081\u306EDM\u55B6\u696D\uFF08\u30EA\u30B9\u30C8\u30A2\u30C3\u30D7\u30FB\u30C6\u30F3\u30D7\u30EC\u9001\u4FE1\uFF09\u3078" })] })] }), _jsx(SocialDmSalesStudio, { mode: "inbound", onNavigateTab: onNavigateTab })] }))] }));
};
