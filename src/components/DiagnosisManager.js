import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { DiagnosisFormsWorkspace } from './DiagnosisFormsWorkspace';
import { getSupabase, getAuthHeaders } from '../lib/supabaseClient';
import { fetchDiagnosesList, fetchDiagnosisById, createDiagnosis, saveDiagnosisAnswers, fetchCompaniesList, fetchLeadsList, fetchAiReportsByDiagnosisId } from '../services/dataService';
import { QUESTIONNAIRE_V1, calculateScores } from '../constants/questionnaire';
import { ClipboardList, Plus, Search, RefreshCw, CheckCircle2, Clock, FileText, AlertTriangle, ShieldCheck, Building2, Layers, ChevronRight, Lock, Save, Sparkles, X, Info, Check, Award, Sliders, Inbox, ArrowRight } from 'lucide-react';
const STATUS_LABELS = {
    received: {
        label: '未確認',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: _jsx(Clock, { className: "w-3.5 h-3.5 text-amber-500" })
    },
    completed: {
        label: '回答完了',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: _jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-500" })
    },
    generating: {
        label: 'AI生成中',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        icon: _jsx(Sparkles, { className: "w-3.5 h-3.5 text-purple-500 animate-spin" })
    },
    reported: {
        label: 'レポート発行済',
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        icon: _jsx(Award, { className: "w-3.5 h-3.5 text-indigo-500" })
    }
};
const DIAGNOSIS_TYPE_LABELS = {
    standard: 'AI経営診断（標準）',
    comprehensive: '総合AI導入診断',
    quick: 'クイック簡易診断'
};
const DiagnosisRecordsView = ({ onOpenRls, initialLeadId, initialCompanyId, initialDiagnosisId }) => {
    const [diagnoses, setDiagnoses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [successBanner, setSuccessBanner] = useState(null);
    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeDiagnosisId, setActiveDiagnosisId] = useState(null);
    const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    // Master data for select
    const [companies, setCompanies] = useState([]);
    const [leads, setLeads] = useState([]);
    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [diagRes, compRes, leadRes] = await Promise.all([
                fetchDiagnosesList(),
                fetchCompaniesList(),
                fetchLeadsList(),
            ]);
            if (diagRes.error) {
                setError(diagRes.error);
            }
            else {
                setDiagnoses(diagRes.data);
            }
            setCompanies(compRes);
            setLeads(leadRes);
        }
        catch (err) {
            setError({
                type: 'UNKNOWN',
                message: err.message || '診断データの読み込みに失敗しました。'
            });
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData();
    }, []);
    // 詳細・回答モーダルを開く
    const handleOpenDetail = async (id) => {
        setActiveDiagnosisId(id);
        setDetailLoading(true);
        try {
            const res = await fetchDiagnosisById(id);
            if (res.data) {
                setSelectedDiagnosis(res.data);
            }
            else if (res.error) {
                setError(res.error);
            }
        }
        catch (err) {
            console.error(err);
        }
        finally {
            setDetailLoading(false);
        }
    };
    useEffect(() => {
        if (initialDiagnosisId)
            void handleOpenDetail(initialDiagnosisId);
    }, [initialDiagnosisId]);
    // フィルタ処理
    const filteredDiagnoses = diagnoses.filter(d => {
        if (initialLeadId && d.lead_id !== initialLeadId)
            return false;
        if (!initialLeadId && initialCompanyId && d.company_id !== initialCompanyId)
            return false;
        if (statusFilter !== 'ALL' && d.status !== statusFilter)
            return false;
        if (!searchQuery)
            return true;
        const q = searchQuery.toLowerCase();
        const compName = d.company?.company_name?.toLowerCase() || '';
        const compId = d.company_id?.toLowerCase() || '';
        const diagType = (DIAGNOSIS_TYPE_LABELS[d.diagnosis_type] || d.diagnosis_type).toLowerCase();
        const memo = (d.memo || '').toLowerCase();
        return compName.includes(q) || compId.includes(q) || diagType.includes(q) || memo.includes(q);
    });
    return (_jsxs("div", { className: "space-y-6 animate-fade-in pb-16", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u53D7\u4ED8\u30D5\u30A9\u30FC\u30E0\u30FB\u8A3A\u65AD\u8A2D\u8A08" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => setIsCreateOpen(true), className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u65B0\u898F\u8A3A\u65AD\u3092\u8D77\u7968" })] }), _jsx("button", { onClick: loadData, disabled: loading, className: "p-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors cursor-pointer", title: "\u518D\u8AAD\u307F\u8FBC\u307F", children: _jsx(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}` }) })] })] }), _jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-800", children: [_jsx(ShieldCheck, { className: "w-5 h-5 text-amber-600 shrink-0 mt-0.5" }), _jsxs("div", { className: "space-y-1 text-xs sm:text-sm", children: [_jsx("p", { className: "font-semibold text-amber-900", children: "\u3010\u5B89\u5168\u30AC\u30FC\u30C9\u4F5C\u52D5\u4E2D\u3011\u8A2D\u554F\u5B9A\u7FA9\u30FB\u5FC5\u9808\u8A2D\u554FID\u304C\u672A\u78BA\u5B9A\u306E\u305F\u3081\u3001\u5B8C\u4E86\uFF08completed\uFF09\u3078\u306E\u78BA\u5B9A\u9077\u79FB\u306F\u5B89\u5168\u306E\u305F\u3081\u610F\u56F3\u7684\u306B\u30ED\u30C3\u30AF\u3055\u308C\u3066\u3044\u307E\u3059" }), _jsx("p", { className: "text-amber-800/90 leading-relaxed text-xs", children: "\u9001\u4FE1\u6E08\u307F\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54\u306F\u300C\u672A\u78BA\u8A8D\u300D\u3068\u3057\u3066\u8A3A\u65AD\u306B\u5F15\u304D\u7D99\u304C\u308C\u307E\u3059\u3002\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u5FC5\u8981\u306A\u4FEE\u6B63\u3092\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })] })] }), successBanner && (_jsxs("div", { className: "bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-between animate-fade-in shadow-2xs", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600 shrink-0" }), _jsx("span", { children: successBanner })] }), _jsx("button", { onClick: () => setSuccessBanner(null), className: "text-emerald-600 hover:text-emerald-800", children: _jsx(X, { className: "w-4 h-4" }) })] })), error && (_jsxs("div", { className: "bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs sm:text-sm flex items-start gap-3 shadow-2xs", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-rose-600 shrink-0 mt-0.5" }), _jsxs("div", { className: "space-y-1 flex-1", children: [_jsx("p", { className: "font-semibold", children: error.message }), error.type === 'PERMISSION_DENIED' && onOpenRls && (_jsx("button", { onClick: onOpenRls, className: "text-xs text-rose-700 underline font-medium hover:text-rose-900", children: "RLS\u30DD\u30EA\u30B7\u30FC\u306E\u8A2D\u5B9A\u624B\u9806\u3092\u78BA\u8A8D\u3059\u308B" }))] }), _jsx("button", { onClick: () => setError(null), className: "text-rose-600 hover:text-rose-800", children: _jsx(X, { className: "w-4 h-4" }) })] })), _jsxs("div", { className: "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs", children: [_jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" }), _jsx("input", { type: "text", placeholder: "\u5BFE\u8C61\u4F1A\u793E\u540D\u30FBID\u30FB\u7A2E\u5225\u30FB\u30E1\u30E2\u3067\u691C\u7D22...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors" })] }), _jsx("div", { className: "flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs", children: ['ALL', 'received', 'completed', 'generating', 'reported'].map((st) => {
                            const isActive = statusFilter === st;
                            const label = st === 'ALL' ? 'すべて' : STATUS_LABELS[st]?.label || st;
                            return (_jsx("button", { onClick: () => setStatusFilter(st), className: `px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${isActive
                                    ? 'bg-purple-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`, children: label }, st));
                        }) })] }), _jsx("div", { className: "bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-xs sm:text-sm text-slate-700", children: [_jsx("thead", { className: "bg-slate-50 text-slate-600 text-[11px] sm:text-xs uppercase tracking-wider border-b border-slate-200 font-semibold", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3.5 px-4 font-semibold", children: "\u30B9\u30C6\u30FC\u30BF\u30B9" }), _jsx("th", { className: "py-3.5 px-4 font-semibold", children: "\u5BFE\u8C61\u4F1A\u793E" }), _jsx("th", { className: "py-3.5 px-4 font-semibold", children: "\u7D10\u3065\u304F\u30EA\u30FC\u30C9" }), _jsx("th", { className: "py-3.5 px-4 font-semibold", children: "\u8A3A\u65AD\u7A2E\u5225 / \u8A2D\u554F\u7248" }), _jsx("th", { className: "py-3.5 px-4 font-semibold", children: "\u56DE\u7B54\u72B6\u6CC1 / \u30B9\u30B3\u30A2" }), _jsx("th", { className: "py-3.5 px-4 font-semibold", children: "\u5B9F\u65BD / \u8D77\u7968\u65E5" }), _jsx("th", { className: "py-3.5 px-4 font-semibold text-right", children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "py-12 text-center text-slate-500", children: _jsxs("div", { className: "flex flex-col items-center justify-center gap-2", children: [_jsx(RefreshCw, { className: "w-6 h-6 animate-spin text-purple-600" }), _jsx("span", { children: "\u8A3A\u65AD\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D..." })] }) }) })) : filteredDiagnoses.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "py-12 text-center text-slate-500", children: _jsxs("div", { className: "flex flex-col items-center justify-center gap-2", children: [_jsx(ClipboardList, { className: "w-8 h-8 text-slate-400" }), _jsx("p", { className: "font-medium text-slate-600", children: "\u8A72\u5F53\u3059\u308B\u8A3A\u65AD\u30EC\u30B3\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093" }), _jsxs("button", { onClick: () => setIsCreateOpen(true), className: "mt-2 text-xs text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), " \u65B0\u3057\u3044\u8A3A\u65AD\u3092\u4F5C\u6210\u3059\u308B"] })] }) }) })) : (filteredDiagnoses.map((diag) => {
                                    const statusInfo = STATUS_LABELS[diag.status] || STATUS_LABELS.received;
                                    const answersCount = Object.keys(diag.answers || {}).filter((key) => key !== '_intake').length;
                                    const { totalQuestions } = calculateScores(diag.answers || {});
                                    return (_jsxs("tr", { onClick: () => handleOpenDetail(diag.id), className: "hover:bg-slate-50/70 transition-colors cursor-pointer group", children: [_jsx("td", { className: "py-3.5 px-4 whitespace-nowrap", children: _jsxs("span", { className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`, children: [statusInfo.icon, _jsx("span", { children: statusInfo.label })] }) }), _jsxs("td", { className: "py-3.5 px-4", children: [_jsx("div", { className: "font-semibold text-slate-900 group-hover:text-purple-600 transition-colors", children: diag.company?.company_name || diag.company_id }), _jsxs("div", { className: "text-[11px] text-slate-400 flex items-center gap-1 font-mono", children: [_jsx(Building2, { className: "w-3 h-3" }), _jsx("span", { children: diag.company_id })] })] }), _jsx("td", { className: "py-3.5 px-4", children: diag.lead ? (_jsxs("div", { className: "space-y-0.5", children: [_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-purple-700 font-medium", children: [_jsx(Layers, { className: "w-3 h-3 text-purple-500" }), _jsx("span", { children: diag.lead.service_type || 'リードあり' })] }), _jsx("div", { className: "text-[10px] text-slate-400 font-mono truncate max-w-[120px]", children: diag.lead_id })] })) : (_jsx("span", { className: "text-slate-400 text-xs", children: "-" })) }), _jsxs("td", { className: "py-3.5 px-4 whitespace-nowrap", children: [_jsx("div", { className: "font-medium text-slate-800", children: DIAGNOSIS_TYPE_LABELS[diag.diagnosis_type] || diag.diagnosis_type }), _jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono", children: diag.questionnaire_version })] }), _jsx("td", { className: "py-3.5 px-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center gap-2", children: [diag.score !== null && diag.score !== undefined ? (_jsxs("span", { className: "font-bold text-emerald-600 text-sm", children: [diag.score, "\u70B9"] })) : (_jsx("span", { className: "text-slate-400 text-xs", children: "\u672A\u7B97\u51FA" })), _jsxs("span", { className: "text-[11px] text-slate-500", children: ["(", answersCount, "\u554F \u56DE\u7B54\u6E08)"] })] }) }), _jsxs("td", { className: "py-3.5 px-4 whitespace-nowrap text-xs text-slate-500", children: [_jsx("div", { children: diag.conducted_at
                                                            ? new Date(diag.conducted_at).toLocaleDateString('ja-JP')
                                                            : '未実施' }), _jsxs("div", { className: "text-[10px] text-slate-400", children: ["\u8D77\u7968: ", diag.created_at ? new Date(diag.created_at).toLocaleDateString('ja-JP') : '-'] })] }), _jsx("td", { className: "py-3.5 px-4 text-right whitespace-nowrap", onClick: (e) => e.stopPropagation(), children: _jsxs("button", { onClick: () => handleOpenDetail(diag.id), className: "px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-2xs transition-colors inline-flex items-center gap-1 group-hover:border-purple-300", children: [_jsx("span", { children: "\u56DE\u7B54\u30FB\u8A73\u7D30" }), _jsx(ChevronRight, { className: "w-3 h-3 text-slate-400" })] }) })] }, diag.id));
                                })) })] }) }) }), isCreateOpen && (_jsx(DiagnosisCreateModal, { isOpen: isCreateOpen, companies: companies, leads: leads, onClose: () => setIsCreateOpen(false), onSuccess: (newId) => {
                    setIsCreateOpen(false);
                    setSuccessBanner('新規診断を作成しました。設問への回答を開始できます。');
                    loadData();
                    handleOpenDetail(newId);
                } })), activeDiagnosisId && (_jsx(DiagnosisDetailModal, { diagnosisId: activeDiagnosisId, initialDiagnosis: selectedDiagnosis, isLoading: detailLoading, onClose: () => {
                    setActiveDiagnosisId(null);
                    setSelectedDiagnosis(null);
                }, onUpdated: () => {
                    loadData();
                    if (activeDiagnosisId)
                        handleOpenDetail(activeDiagnosisId);
                } }))] }));
};
const DiagnosisCreateModal = ({ isOpen, companies, leads, onClose, onSuccess, }) => {
    const [companyId, setCompanyId] = useState('');
    const [leadId, setLeadId] = useState('');
    const [diagnosisType, setDiagnosisType] = useState('standard');
    const [memo, setMemo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    // 選択した会社に一致するリードにフィルタリング（整合性トリガー check_diagnosis_company_lead_match に適合させるため）
    const matchingLeads = leads.filter(l => !companyId || String(l.company_id) === companyId);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!companyId) {
            setErrorMsg('対象会社を選択してください。');
            return;
        }
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            const res = await createDiagnosis({
                company_id: companyId,
                lead_id: leadId ? leadId : null,
                diagnosis_type: diagnosisType,
                questionnaire_version: 'v1.0',
                memo: memo ? memo : null,
            });
            if (res.error) {
                setErrorMsg(res.error.message);
            }
            else if (res.data) {
                onSuccess(res.data.id);
            }
        }
        catch (err) {
            setErrorMsg(err.message || '作成中に予期せぬエラーが発生しました。');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in", children: _jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col", children: [_jsxs("div", { className: "px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700", children: _jsx(ClipboardList, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-base font-bold text-slate-900", children: "\u65B0\u898F\u8A3A\u65AD\u306E\u8D77\u7968" }), _jsx("p", { className: "text-xs text-slate-500", children: "\u5BFE\u8C61\u4F01\u696D\u3092\u9078\u629E\u3057\u8A3A\u65AD\u30EC\u30B3\u30FC\u30C9\u3092\u958B\u59CB\u3057\u307E\u3059" })] })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 p-1 rounded-lg", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-6 space-y-4", children: [errorMsg && (_jsxs("div", { className: "bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "w-4 h-4 text-rose-600 shrink-0" }), _jsx("span", { children: errorMsg })] })), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsxs("span", { children: ["\u5BFE\u8C61\u4F1A\u793E ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("span", { className: "text-[10px] text-slate-400", children: "companies \u30C6\u30FC\u30D6\u30EB\u53C2\u7167" })] }), _jsxs("select", { value: companyId, onChange: (e) => {
                                        setCompanyId(e.target.value);
                                        setLeadId(''); // 会社変更時はリード選択をリセット
                                    }, required: true, className: "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors", children: [_jsx("option", { value: "", children: "\u5BFE\u8C61\u4F1A\u793E\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044" }), companies.map((c) => (_jsxs("option", { value: c.id, children: [c.company_name, " (", c.id, ")"] }, c.id)))] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsx("span", { children: "\u7D10\u3065\u304F\u30EA\u30FC\u30C9\uFF08\u4EFB\u610F\uFF09" }), _jsx("span", { className: "text-[10px] text-slate-400", children: "\u6574\u5408\u6027\u30C8\u30EA\u30AC\u30FC\u306B\u3088\u308A\u540C\u793E\u30EA\u30FC\u30C9\u306E\u307F\u9078\u629E\u53EF" })] }), _jsxs("select", { value: leadId, onChange: (e) => setLeadId(e.target.value), disabled: !companyId, className: "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-colors", children: [_jsx("option", { value: "", children: "\u306A\u3057\uFF08\u4F1A\u793E\u5358\u4F53\u3067\u306E\u8A3A\u65AD\uFF09" }), matchingLeads.map((l) => (_jsxs("option", { value: l.id, children: [l.service_type || 'リード', " (ID: ", l.id.substring(0, 8), "...)"] }, l.id)))] }), companyId && matchingLeads.length === 0 && (_jsx("p", { className: "text-[11px] text-slate-400", children: "\u203B \u3053\u306E\u4F1A\u793E\u306B\u7D10\u3065\u304F\u30EA\u30FC\u30C9\u306F\u73FE\u5728\u3042\u308A\u307E\u305B\u3093" }))] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700", children: "\u8A3A\u65AD\u7A2E\u5225" }), _jsxs("select", { value: diagnosisType, onChange: (e) => setDiagnosisType(e.target.value), className: "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors", children: [_jsx("option", { value: "standard", children: "AI\u7D4C\u55B6\u8A3A\u65AD\uFF08\u6A19\u6E96\u30D7\u30E9\u30F3\u30FB5\u30AB\u30C6\u30B4\u30EA\uFF09" }), _jsx("option", { value: "comprehensive", children: "\u7DCF\u5408AI\u5C0E\u5165\u8A3A\u65AD\uFF08\u8A73\u7D30\u30D7\u30E9\u30F3\uFF09" }), _jsx("option", { value: "quick", children: "\u7C21\u6613\u30AF\u30A4\u30C3\u30AF\u8A3A\u65AD\uFF08\u30B9\u30D4\u30FC\u30C9\u8A55\u4FA1\uFF09" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700", children: "\u793E\u5185\u30E1\u30E2\u30FB\u5099\u8003\uFF08\u4EFB\u610F\uFF09" }), _jsx("textarea", { value: memo, onChange: (e) => setMemo(e.target.value), placeholder: "\u8A3A\u65AD\u306E\u76EE\u7684\u3084\u5546\u8AC7\u80CC\u666F\u3001\u30D2\u30A2\u30EA\u30F3\u30B0\u62C5\u5F53\u8005\u306A\u3069", rows: 3, className: "w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors" })] }), _jsxs("div", { className: "bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1", children: [_jsxs("p", { className: "text-slate-800 font-semibold flex items-center gap-1", children: [_jsx(Info, { className: "w-3.5 h-3.5 text-purple-600" }), "\u8D77\u7968\u6642\u306E\u30B9\u30C6\u30FC\u30BF\u30B9\u306B\u3064\u3044\u3066"] }), _jsxs("p", { children: ["\u8A3A\u65AD\u306F\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u6A29\u9650\u5236\u7D04\uFF08\u5217\u30EC\u30D9\u30EB\u6A29\u9650\u4FDD\u8B77\uFF09\u306B\u57FA\u3065\u304D\u3001\u521D\u671F\u30B9\u30C6\u30FC\u30BF\u30B9 ", _jsx("strong", { children: "\u300C\u672A\u78BA\u8A8D\u300D" }), " \u3067\u4F5C\u6210\u3055\u308C\u307E\u3059\u3002"] })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 flex items-center justify-end gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "submit", disabled: isSubmitting || !companyId, className: "px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer", children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5 animate-spin" }), _jsx("span", { children: "\u4F5C\u6210\u4E2D..." })] })) : (_jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u8D77\u7968\u3057\u3066\u56DE\u7B54\u3092\u958B\u59CB" })] })) })] })] })] }) }));
};
const DiagnosisDetailModal = ({ diagnosisId, initialDiagnosis, isLoading, onClose, onUpdated, }) => {
    const [diagnosis, setDiagnosis] = useState(initialDiagnosis);
    const [answers, setAnswers] = useState({});
    const [memo, setMemo] = useState('');
    const [diagnosisType, setDiagnosisType] = useState('standard');
    const [saving, setSaving] = useState(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    // ステータス差し戻し状態
    const [generatingReport, setGeneratingReport] = useState(false);
    const [reportDraft, setReportDraft] = useState(null);
    const [savingReport, setSavingReport] = useState(false);
    // 関連レポート一覧
    const [reports, setReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    useEffect(() => {
        if (initialDiagnosis) {
            setDiagnosis(initialDiagnosis);
            setAnswers(initialDiagnosis.answers || {});
            setMemo(initialDiagnosis.memo || '');
            setDiagnosisType(initialDiagnosis.diagnosis_type || 'standard');
        }
    }, [initialDiagnosis]);
    // レポート一覧のロード
    useEffect(() => {
        if (diagnosisId) {
            setReportsLoading(true);
            fetchAiReportsByDiagnosisId(diagnosisId).then((res) => {
                setReports(res.data);
                setReportsLoading(false);
            });
        }
    }, [diagnosisId]);
    // リアルタイムスコア算出
    const currentScores = calculateScores(answers);
    // 診断の編集可否判定
    // - completed, generating, reported は回答直接編集がDBトリガーで禁止されている
    const isLockedForDirectEdit = diagnosis?.status === 'completed' || diagnosis?.status === 'generating' || diagnosis?.status === 'reported';
    // 回答入力変更ハンドラ
    const handleAnswerChange = (questionId, value) => {
        if (isLockedForDirectEdit)
            return;
        setAnswers(prev => ({
            ...prev,
            [questionId]: value,
        }));
    };
    // 回答内容・社内メモを保存します。診断状態は「未確認」のまま維持します。
    const handleSaveAnswers = async () => {
        if (!diagnosis)
            return;
        setSaving(true);
        setErrorMsg(null);
        setSaveSuccessMsg(null);
        try {
            const saveRes = await saveDiagnosisAnswers(diagnosis.id, answers, {
                memo,
                diagnosis_type: diagnosisType,
                ...(isFormDiagnosis ? {} : { score: currentScores.totalScore, category_scores: currentScores.categoryScores }),
            });
            if (saveRes.error) {
                setErrorMsg(saveRes.error.message);
                return;
            }
            setSaveSuccessMsg('回答内容を保存しました。');
            onUpdated();
        }
        catch (err) {
            setErrorMsg(err.message || '保存中にエラーが発生しました。');
        }
        finally {
            setSaving(false);
        }
    };
    const handleGenerateReportDraft = async () => {
        if (!diagnosis)
            return;
        const supabase = getSupabase();
        if (!supabase) {
            setErrorMsg('データベースに接続できません。設定を確認してください。');
            return;
        }
        const answerEntries = Object.entries(answers).filter(([key, value]) => key !== '_intake' && value !== null && value !== undefined && String(value).trim() !== '');
        if (answerEntries.length === 0) {
            setErrorMsg('診断回答がありません。フォーム回答を確認してください。');
            return;
        }
        setGeneratingReport(true);
        setErrorMsg(null);
        setReportDraft(null);
        try {
            const [{ data: company }, { data: lead }, { data: deal }] = await Promise.all([
                supabase.from('companies').select('company_name, industry, website').eq('id', diagnosis.company_id).maybeSingle(),
                diagnosis.lead_id
                    ? supabase.from('leads').select('source, service_type, status, notes, interested_product_id').eq('id', diagnosis.lead_id).maybeSingle()
                    : Promise.resolve({ data: null }),
                supabase.from('deals').select('proposal_plan_name, proposal_status, proposal_type, total_amount, initial_fee, monthly_fee, product_id, memo').eq('company_id', diagnosis.company_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            ]);
            const context = {
                company: {
                    company_name: company?.company_name || diagnosis.company?.company_name,
                    industry: company?.industry || diagnosis.company?.industry,
                    website: company?.website || diagnosis.company?.website,
                },
                lead,
                latestDeal: deal,
                diagnosis: {
                    type: diagnosis.diagnosis_type,
                    questionnaireVersion: diagnosis.questionnaire_version,
                    answers: Object.fromEntries(answerEntries),
                    score: diagnosis.questionnaire_version.startsWith('form-') ? null : diagnosis.score ?? currentScores.totalScore,
                    categoryScores: diagnosis.questionnaire_version.startsWith('form-') ? null : diagnosis.category_scores ?? currentScores.categoryScores,
                },
            };
            const prompt = `あなたは有限会社MSTの「経営の仕組み化 × 利益改善」専門の経営診断レポート作成パートナーです。
以下の社内CRM情報と診断回答をもとに、経営者の心に響く「最優先ボトルネックの特定」「会社と経営者の未来像（Before/After）」「ボトルネック連鎖ロードマップ（継続改善サイクル）」を提示するレポート草案を作成してください。

【MSTのコアメッセージ】
・会社の可能性を広げ、経営者が次の一手を打てる経営へ。
・単なる業務効率化ではなく、会社の利益と経営者の選択肢を増やすこと。
・日々の業務に追われる経営から、次の一手を選べる経営へ。

【レポート構成（必須）】
1. ■ 診断サマリーと最優先ボトルネックの特定
   - 回答から読み取れる、現在会社の成長と利益を最も止めている「最大の急所（ボトルネック）」をズバリ明示。
   - そのボトルネックがもたらしている経営上の損失（時間、機会損失、経営者の負担）。

2. ■ 会社と経営者が手に入れる「未来」（Before & After）
   - 【会社の未来】: 現状の手作業・属人化・利益が残らない状態から、仕組みで業務が回り利益が残る会社へ。
   - 【経営者の未来】: 現場の火消しや業務処理から解放され、本来向き合うべき「経営判断・成長戦略・次の一手」に時間を使える状態へ。

3. ■ ボトルネック連鎖の解消ロードマップ（継続改善サイクル）
   ※「1つのボトルネックを解消すると、次はここが詰まるので、継続して改善を回していく必然性」を提示。
   - Phase 1（まず着手）: 最優先ボトルネックの解消（手作業の二重入力削減・即座の時間創出）
   - Phase 2（次の展開）: 集客〜商談〜顧客フォローがつながる売上の流れの構築
   - Phase 3（完成形）: 経営顧問による自走組織と新規事業への展開

4. ■ 推奨される最初の一歩（MSTサービス体系からの処方箋）
   - 経営戦略・利益改善顧問、業務改善・IT・DX顧問、システム構築・業務自動化、マーケティング集客導線から、貴社に最も適した組み合わせをご提案。

Markdown見出しを使い、前置きは付けず本文だけ出力してください。

【社内データ】
${JSON.stringify(context, null, 2)}`;
            const authHeaders = await getAuthHeaders();
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    character: { name: '経営診断レポート作成AI', role: '診断レポート作成専門AI', personality: '事実に忠実で慎重', tone: '明確で丁寧' },
                    stream: false,
                }),
            });
            const result = await response.json();
            if (!response.ok || typeof result.text !== 'string' || !result.text.trim()) {
                throw new Error(result.error || '診断レポートを生成できませんでした。');
            }
            setReportDraft({
                text: result.text.trim(),
                modelName: [result.provider, result.model].filter(Boolean).join('/') || 'configured-model',
                recommendedProductId: lead?.interested_product_id || deal?.product_id || null,
            });
        }
        catch (error) {
            setErrorMsg(error.message || '診断レポートの生成に失敗しました。');
        }
        finally {
            setGeneratingReport(false);
        }
    };
    const handleSaveGeneratedReport = async () => {
        if (!diagnosis || !reportDraft)
            return;
        const supabase = getSupabase();
        if (!supabase) {
            setErrorMsg('データベースに接続できません。設定を確認してください。');
            return;
        }
        setSavingReport(true);
        setErrorMsg(null);
        try {
            const previousLatest = reports.find((report) => report.is_latest);
            if (previousLatest) {
                const { error: supersedeError } = await supabase.from('ai_reports')
                    .update({ is_latest: false, status: 'superseded' }).eq('id', previousLatest.id);
                if (supersedeError)
                    throw supersedeError;
            }
            const reportVersion = Math.max(0, ...reports.map((report) => report.version)) + 1;
            const { data, error } = await supabase.from('ai_reports').insert([{
                    diagnosis_id: diagnosis.id,
                    version: reportVersion,
                    is_latest: true,
                    status: 'generated',
                    title: `${diagnosis.company?.company_name || diagnosis.company_id} 経営診断レポート`,
                    model_name: reportDraft.modelName,
                    prompt_version: 'diagnosis-report-v1',
                    summary: reportDraft.text.slice(0, 1200),
                    recommendations: [reportDraft.text],
                    recommended_product_id: reportDraft.recommendedProductId,
                    full_report_text: reportDraft.text,
                    generated_at: new Date().toISOString(),
                }]).select('*').single();
            if (error) {
                if (previousLatest) {
                    await supabase.from('ai_reports').update({ is_latest: true, status: previousLatest.status }).eq('id', previousLatest.id);
                }
                throw error;
            }
            // customer_documents（全社書類台帳）へ自動登録・一元同期
            try {
                const docHtml = `<div style="font-family: sans-serif; line-height: 1.8; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 22px; color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 20px;">
    ${diagnosis.company?.company_name || '御社'} 経営診断・ボトルネック改善レポート
  </h1>
  <div style="white-space: pre-wrap; font-size: 14px; color: #334155;">
${reportDraft.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </div>
</div>`;
                await supabase.from('customer_documents').insert({
                    company_id: diagnosis.company_id,
                    lead_id: diagnosis.lead_id || null,
                    document_type: 'diagnosis_report',
                    title: `${diagnosis.company?.company_name || '顧客'} 経営診断レポート (v${reportVersion})`,
                    body_html: docHtml,
                    status: 'draft',
                });
            }
            catch (docErr) {
                console.warn('Failed to sync to customer_documents:', docErr);
            }
            setReports((current) => [data, ...current.filter((report) => report.id !== previousLatest?.id)]);
            setReportDraft(null);
            setSaveSuccessMsg('診断レポートを保存しました。全社書類台帳（契約・書類）にも同期登録されました。');
            onUpdated();
        }
        catch (error) {
            setErrorMsg(error.message || '診断レポートを保存できませんでした。');
        }
        finally {
            setSavingReport(false);
        }
    };
    const [approvingAndSendingReport, setApprovingAndSendingReport] = useState(false);
    const handleApproveAndSendReport = async (reportToUse) => {
        const targetReport = reportToUse || reports[0];
        if (!targetReport || !diagnosis)
            return;
        const supabase = getSupabase();
        if (!supabase) {
            setErrorMsg('Supabaseに接続されていません。');
            return;
        }
        setApprovingAndSendingReport(true);
        setErrorMsg(null);
        try {
            // 1. レポートステータスを承認済（approved）に更新
            await supabase.from('ai_reports').update({ status: 'approved' }).eq('id', targetReport.id);
            // 2. 診断ステータスを reported に更新
            await supabase.from('diagnoses').update({ status: 'reported' }).eq('id', diagnosis.id);
            // 3. 全社書類台帳（customer_documents）の該当レポートも approved に同期
            await supabase.from('customer_documents')
                .update({ status: 'approved' })
                .eq('company_id', diagnosis.company_id)
                .eq('document_type', 'diagnosis_report');
            // 3. 会社紐づきの連絡先を取得
            let contact = null;
            if (diagnosis.lead_id) {
                const { data: leadData } = await supabase.from('leads').select('contact_id').eq('id', diagnosis.lead_id).maybeSingle();
                if (leadData?.contact_id) {
                    const { data: cData } = await supabase.from('contacts').select('*').eq('id', leadData.contact_id).maybeSingle();
                    contact = cData;
                }
            }
            if (!contact && diagnosis.company_id) {
                const { data: cData } = await supabase.from('contacts').select('*').eq('company_id', diagnosis.company_id).limit(1).maybeSingle();
                contact = cData;
            }
            const reportText = targetReport.full_report_text || targetReport.summary || '';
            const companyName = diagnosis.company?.company_name || '御社';
            if (contact?.line_user_id) {
                // LINE送信
                const linePayload = {
                    type: 'text',
                    text: `【MST】${companyName}様 経営診断レポートのご送付\n\n${contact.full_name || 'ご担当者'} 様\n大変お待たせいたしました。先般ご回答いただきました診断内容をもとに作成したレポートをお届けします。\n\n───────────────\n${reportText.slice(0, 4000)}\n───────────────\n\n詳細な改善施策や導入支援のご相談は、本LINEにそのままご返信いただくか、個別相談をお申し付けください。`,
                };
                const { data: outbox } = await supabase.from('communication_outbox').insert({
                    channel: 'line',
                    recipient_contact_id: contact.id,
                    recipient_address: contact.line_user_id,
                    body_text: linePayload.text,
                    line_message_payload: linePayload,
                    company_id: diagnosis.company_id,
                    source_type: 'diagnosis_report',
                    source_id: targetReport.id,
                    status: 'queued',
                    consent_confirmed_at: new Date().toISOString(),
                    consent_basis: 'transactional_intake',
                }).select('id').maybeSingle();
                if (outbox?.id) {
                    const session = await supabase.auth.getSession();
                    const token = session.data.session?.access_token;
                    if (token) {
                        await fetch('/api/communications/send', {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ outboxId: outbox.id }),
                        }).catch(() => { });
                    }
                }
                setSaveSuccessMsg(`✅ 診断レポートを承認し、${contact.full_name || '担当者'}様（LINE公式）へ送信完了しました！`);
            }
            else if (contact?.email) {
                // メール送信
                const subject = `【MST】${companyName}様 経営診断・改善レポートのご送付`;
                const bodyText = `${contact.full_name || 'ご担当者'} 様\n\n有限会社MST代表の大橋真人です。\n先般は経営診断にご回答いただき誠にありがとうございました。\n\n診断結果を取りまとめた個別レポートをお届けいたします。\n\n--------------------------------------------------\n${reportText}\n--------------------------------------------------\n\nレポート内容に関するご質問や、具体的な改善施策のご相談はお気軽にご連絡ください。\n\n--------------------------------------------------\n有限会社MST\n代表取締役: 大橋真人\n〒503-0981 岐阜県大垣市桧町127番地\n--------------------------------------------------`;
                const { data: outbox } = await supabase.from('communication_outbox').insert({
                    channel: 'email',
                    recipient_contact_id: contact.id,
                    recipient_address: contact.email,
                    subject,
                    body_text: bodyText,
                    company_id: diagnosis.company_id,
                    source_type: 'diagnosis_report',
                    source_id: targetReport.id,
                    status: 'queued',
                    consent_confirmed_at: new Date().toISOString(),
                    consent_basis: 'transactional_intake',
                }).select('id').maybeSingle();
                if (outbox?.id) {
                    const session = await supabase.auth.getSession();
                    const token = session.data.session?.access_token;
                    if (token) {
                        await fetch('/api/communications/send', {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ outboxId: outbox.id }),
                        }).catch(() => { });
                    }
                }
                setSaveSuccessMsg(`✅ 診断レポートを承認し、${contact.full_name || '担当者'}様（${contact.email}）へ送信完了しました！`);
            }
            else {
                setSaveSuccessMsg('✅ 診断レポートを「承認済（approved）」にし、診断ステータスを「レポート発行済」に更新しました。（※連絡先アドレス未登録のため送信待ちは保留）');
            }
            onUpdated();
        }
        catch (err) {
            setErrorMsg(`レポート承認送信エラー: ${err?.message || '不明なエラー'}`);
        }
        finally {
            setApprovingAndSendingReport(false);
        }
    };
    if (isLoading || !diagnosis) {
        return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in", children: _jsxs("div", { className: "bg-white border border-slate-200 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center justify-center space-y-3 shadow-xl", children: [_jsx(RefreshCw, { className: "w-8 h-8 animate-spin text-purple-600" }), _jsx("p", { className: "text-sm font-semibold text-slate-700", children: "\u8A3A\u65AD\u8A73\u7D30\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D..." })] }) }));
    }
    const statusInfo = STATUS_LABELS[diagnosis.status] || STATUS_LABELS.received;
    const isFormDiagnosis = diagnosis.questionnaire_version.startsWith('form-');
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in overflow-y-auto", children: _jsxs("div", { className: "bg-white border border-slate-200 rounded-3xl max-w-4xl w-full my-auto overflow-hidden shadow-2xl flex flex-col max-h-[92vh]", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`, children: [statusInfo.icon, _jsx("span", { children: statusInfo.label })] }), _jsxs("div", { children: [_jsxs("h2", { className: "text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2", children: [_jsx("span", { children: diagnosis.company?.company_name || diagnosis.company_id }), _jsx("span", { className: "text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono", children: DIAGNOSIS_TYPE_LABELS[diagnosis.diagnosis_type] || diagnosis.diagnosis_type })] }), _jsxs("p", { className: "text-xs text-slate-500 font-mono", children: ["ID: ", diagnosis.id, " / \u8A2D\u554F\u7248: ", diagnosis.questionnaire_version] })] })] }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 p-1 rounded-lg", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-6 space-y-6 overflow-y-auto flex-1", children: [saveSuccessMsg && (_jsxs("div", { className: "bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600 shrink-0" }), _jsx("span", { children: saveSuccessMsg })] })), errorMsg && (_jsxs("div", { className: "bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "w-4 h-4 text-rose-600 shrink-0" }), _jsx("span", { children: errorMsg })] })), _jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2 text-amber-900 font-semibold text-xs sm:text-sm", children: [_jsx(ShieldCheck, { className: "w-4 h-4 text-amber-600" }), _jsx("span", { children: "\u5FC5\u9808\u8A2D\u554F\u306B\u56DE\u7B54\u3059\u308B\u3068\u8A3A\u65AD\u3092\u5B8C\u4E86\u3067\u304D\u307E\u3059" })] }), _jsx("p", { className: "text-xs text-amber-800/90 leading-relaxed pl-6", children: "\u9001\u4FE1\u6E08\u307F\u306E\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54\u3092\u300C\u672A\u78BA\u8A8D\u300D\u3068\u3057\u3066\u5F15\u304D\u7D99\u304E\u307E\u3059\u3002\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u5FC5\u8981\u306A\u4FEE\u6B63\u3092\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })] }), isLockedForDirectEdit && (_jsx("div", { className: "bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Lock, { className: "w-5 h-5 text-amber-600 shrink-0" }), _jsxs("div", { className: "text-xs space-y-0.5", children: [_jsxs("p", { className: "font-semibold text-slate-800", children: ["\u56DE\u7B54\u5185\u5BB9\u306F\u73FE\u5728\u30ED\u30C3\u30AF\u3055\u308C\u3066\u3044\u307E\u3059\uFF08\u30B9\u30C6\u30FC\u30BF\u30B9: ", statusInfo.label, "\uFF09"] }), _jsx("p", { className: "text-slate-500", children: "\u5B8C\u4E86\u6E08\u307F\u30FB\u30EC\u30DD\u30FC\u30C8\u767A\u884C\u6E08\u307F\u306E\u56DE\u7B54\u306E\u76F4\u63A5\u7DE8\u96C6\u306FDB\u30C8\u30EA\u30AC\u30FC\u306B\u3088\u308A\u5B89\u5168\u306B\u906E\u65AD\u3055\u308C\u3066\u3044\u307E\u3059\u3002" })] })] }) })), isFormDiagnosis ? (_jsx("div", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700", children: "\u9001\u4FE1\u6E08\u307F\u306E\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54\u3092\u53D7\u3051\u4ED8\u3051\u307E\u3057\u305F\u3002\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u3001\u8A3A\u65AD\u7D50\u679C\u3084\u30EC\u30DD\u30FC\u30C8\u3092\u4F5C\u6210\u3067\u304D\u307E\u3059\u3002" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("span", { className: "text-[11px] font-medium text-slate-500", children: "\u7DCF\u5408\u30B9\u30B3\u30A2\uFF08\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\uFF09" }), _jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "text-2xl font-black text-emerald-600", children: currentScores.totalScore }), _jsx("span", { className: "text-xs text-slate-400", children: "/ 100\u70B9" })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("span", { className: "text-[11px] font-medium text-slate-500", children: "\u56DE\u7B54\u9032\u6357\u72B6\u6CC1" }), _jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "text-2xl font-black text-purple-600", children: currentScores.answeredCount }), _jsxs("span", { className: "text-xs text-slate-400", children: ["/ ", currentScores.totalQuestions, " \u554F\u56DE\u7B54\u6E08"] })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("span", { className: "text-[11px] font-medium text-slate-500", children: "AI\u30EC\u30DD\u30FC\u30C8\u767A\u884C\u72B6\u6CC1" }), _jsx("div", { className: "flex items-center gap-1.5 pt-1", children: reports.length > 0 ? (_jsxs("span", { className: "text-xs text-purple-700 font-semibold flex items-center gap-1", children: [_jsx(Award, { className: "w-3.5 h-3.5 text-purple-600" }), _jsxs("span", { children: ["\u6700\u65B0\u30EC\u30DD\u30FC\u30C8\u3042\u308A (v", reports[0].version, ")"] })] })) : (_jsx("span", { className: "text-xs text-slate-400", children: "\u30EC\u30DD\u30FC\u30C8\u672A\u767A\u884C" })) })] })] }), reports[0] && (_jsxs("details", { className: "rounded-2xl border border-purple-200 bg-purple-50/40 p-4", children: [_jsxs("summary", { className: "cursor-pointer text-sm font-semibold text-purple-900", children: ["\u6700\u65B0\u306EAI\u8A3A\u65AD\u30EC\u30DD\u30FC\u30C8\u3092\u78BA\u8A8D\uFF08v", reports[0].version, "\uFF09"] }), _jsx("div", { className: "mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-white border border-purple-100 p-4 text-sm leading-7 text-slate-800", children: reports[0].full_report_text || reports[0].summary || 'レポート本文はまだ作成されていません。' })] }))] })), _jsxs("section", { className: "space-y-3 rounded-2xl border border-purple-200 bg-purple-50/30 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-bold text-slate-900", children: "\u8A3A\u65AD\u30EC\u30DD\u30FC\u30C8" }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54\u3068\u793E\u5185CRM\u60C5\u5831\u304B\u3089\u8349\u6848\u3092\u751F\u6210\u3057\u307E\u3059\u3002\u5185\u5BB9\u3092\u78BA\u8A8D\u30FB\u4FEE\u6B63\u3057\u3066\u4FDD\u5B58\u3059\u308B\u3068\u3001\u9867\u5BA2\u66F8\u985E\u306B\u30EC\u30DD\u30FC\u30C8\u3068\u63D0\u6848\u66F8\u306E\u8349\u6848\u3092\u4F5C\u6210\u3057\u307E\u3059\u3002" })] }), _jsx("p", { className: "text-xs text-slate-500", children: "\u8A3A\u65AD\u56DE\u7B54\u3068\u4F1A\u793E\u540D\u30FB\u696D\u7A2E\u306A\u3069\u3092AI\u30B5\u30FC\u30D3\u30B9\u306B\u9001\u4FE1\u3057\u307E\u3059\u3002\u500B\u4EBA\u306E\u9023\u7D61\u5148\u3068\u793E\u5185\u30E1\u30E2\u306F\u9001\u4FE1\u3057\u307E\u305B\u3093\u3002" }), _jsxs("button", { type: "button", onClick: handleGenerateReportDraft, disabled: generatingReport || savingReport, className: "inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm", children: [generatingReport ? _jsx(RefreshCw, { className: "h-4 w-4 animate-spin" }) : _jsx(Sparkles, { className: "h-4 w-4" }), generatingReport ? '草案を生成中…' : 'AIで草案を生成'] })] }), reportDraft && (_jsxs("div", { className: "space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm", children: [_jsx("label", { className: "block text-xs font-medium text-slate-700", children: "\u8349\u6848\uFF08\u4FDD\u5B58\u524D\u306B\u7DE8\u96C6\u3067\u304D\u307E\u3059\uFF09" }), _jsx("textarea", { value: reportDraft.text, onChange: (event) => setReportDraft({ ...reportDraft, text: event.target.value }), rows: 16, className: "w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" }), _jsxs("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setReportDraft(null), className: "rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors", children: "\u7834\u68C4" }), _jsxs("button", { type: "button", onClick: handleSaveGeneratedReport, disabled: savingReport || !reportDraft.text.trim(), className: "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors", children: [savingReport && _jsx(RefreshCw, { className: "h-3.5 w-3.5 animate-spin" }), "\u9867\u5BA2\u66F8\u985E\u306B\u4FDD\u5B58"] })] })] })), reports[0] && !reportDraft && (_jsxs("div", { className: "rounded-xl border border-purple-200 bg-white p-3 space-y-3 shadow-sm", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Award, { className: "w-4 h-4 text-purple-600" }), _jsxs("span", { className: "text-xs font-bold text-slate-800", children: ["\u6700\u65B0\u30EC\u30DD\u30FC\u30C8 v", reports[0].version, " (", reports[0].status === 'approved' ? '承認済' : '承認待ち', ")"] })] }), _jsx("button", { type: "button", onClick: () => handleApproveAndSendReport(reports[0]), disabled: approvingAndSendingReport, className: "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-50 cursor-pointer", children: approvingAndSendingReport ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5 animate-spin" }), _jsx("span", { children: "\u627F\u8A8D\u30FB\u9001\u4FE1\u51E6\u7406\u4E2D\u2026" })] })) : (_jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "h-3.5 w-3.5 text-purple-200" }), _jsx("span", { children: "1\u30AF\u30EA\u30C3\u30AF\u627F\u8A8D\uFF06\u30EC\u30DD\u30FC\u30C8\u9001\u4FE1" })] })) })] }), _jsxs("details", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3", open: true, children: [_jsx("summary", { className: "cursor-pointer text-xs font-semibold text-slate-700", children: "\u30EC\u30DD\u30FC\u30C8\u672C\u6587\u3092\u78BA\u8A8D" }), _jsx("div", { className: "mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white border border-slate-200 p-3 text-sm leading-6 text-slate-800", children: reports[0].full_report_text || reports[0].summary || 'レポート本文がありません。' })] })] }))] }), diagnosis.questionnaire_version.startsWith('form-') ? (_jsxs("section", { className: "space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4", children: [_jsx("h3", { className: "text-sm font-bold text-slate-800", children: "\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54\uFF08\u9001\u4FE1\u6E08\u307F\uFF09" }), _jsx("dl", { className: "space-y-2", children: Object.entries(answers).filter(([key]) => key !== '_intake').map(([key, value]) => (_jsxs("div", { className: "grid gap-1 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)] shadow-sm", children: [_jsx("dt", { className: "text-xs font-medium text-slate-600", children: key }), _jsx("dd", { children: _jsx("textarea", { value: typeof value === 'string' ? value : Array.isArray(value) ? value.join('、') : JSON.stringify(value), onChange: (event) => handleAnswerChange(key, event.target.value), disabled: isLockedForDirectEdit, rows: Math.min(6, Math.max(2, String(value ?? '').split('\n').length)), className: "w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800 focus:bg-white focus:border-purple-400 disabled:opacity-60" }) })] }, key))) }), Boolean(answers._intake) && _jsxs("details", { className: "text-xs text-slate-500", children: [_jsx("summary", { className: "cursor-pointer", children: "\u53D7\u4ED8\u60C5\u5831" }), _jsx("pre", { className: "mt-2 whitespace-pre-wrap bg-white border border-slate-200 p-2 rounded-lg text-slate-700", children: JSON.stringify(answers._intake, null, 2) })] })] })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 pb-2", children: [_jsxs("h3", { className: "text-sm font-bold text-slate-800 flex items-center gap-2", children: [_jsx(Sliders, { className: "w-4 h-4 text-purple-600" }), _jsxs("span", { children: ["\u8A3A\u65AD\u8A2D\u554F\u3078\u306E\u56DE\u7B54\u5165\u529B\uFF08\u30D0\u30FC\u30B8\u30E7\u30F3: ", diagnosis.questionnaire_version, "\uFF09"] })] }), _jsx("span", { className: "text-xs text-slate-500", children: "\u5404\u8A2D\u554F 1\u301C5\u6BB5\u968E\u8A55\u4FA1" })] }), QUESTIONNAIRE_V1.map((cat) => {
                                    const catScore = currentScores.categoryScores[cat.key] || 0;
                                    return (_jsxs("div", { className: "bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 pb-2", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-xs sm:text-sm font-bold text-slate-900", children: cat.name }), _jsx("p", { className: "text-[11px] text-slate-500", children: cat.description })] }), _jsx("div", { className: "text-right", children: _jsxs("span", { className: "text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full", children: [catScore, "\u70B9"] }) })] }), _jsx("div", { className: "space-y-3", children: cat.questions.map((q) => {
                                                    const currentVal = answers[q.id];
                                                    return (_jsxs("div", { className: "space-y-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-800 flex items-center justify-between", children: [_jsx("span", { children: q.label }), _jsxs("span", { className: "text-[10px] text-slate-400 font-mono", children: ["ID: ", q.id] })] }), _jsx("p", { className: "text-[11px] text-slate-500", children: q.description })] }), _jsx("div", { className: "flex items-center gap-2 pt-1", children: [1, 2, 3, 4, 5].map((val) => {
                                                                    const isSelected = Number(currentVal) === val;
                                                                    return (_jsx("button", { type: "button", disabled: isLockedForDirectEdit, onClick: () => handleAnswerChange(q.id, val), className: `flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${isSelected
                                                                            ? 'bg-purple-600 text-white shadow-sm scale-[1.02]'
                                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'} disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`, children: val }, val));
                                                                }) })] }, q.id));
                                                }) })] }, cat.key));
                                })] })), _jsxs("div", { className: "space-y-2 pt-2 border-t border-slate-200", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsx("span", { children: "\u793E\u5185\u30E1\u30E2\u30FB\u8A3A\u65AD\u7DCF\u62EC\uFF08memo\uFF09" }), _jsx("span", { className: "text-[10px] text-slate-400", children: "\u203B\u5B8C\u4E86\u5F8C\u3082\u968F\u6642\u8FFD\u8A18\u53EF\u80FD" })] }), _jsx("textarea", { value: memo, onChange: (e) => setMemo(e.target.value), placeholder: "\u7D4C\u55B6\u8AB2\u984C\u3084\u5546\u8AC7\u3067\u306E\u3084\u308A\u53D6\u308A\u3001\u63D0\u6848\u65B9\u91DD\u306A\u3069", rows: 3, className: "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors shadow-xs" })] })] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0", children: [_jsxs("div", { className: "text-xs text-slate-500 flex items-center gap-1.5", children: [_jsx(Info, { className: "w-4 h-4 text-slate-400" }), _jsx("span", { children: "\u56DE\u7B54\u5185\u5BB9\u3084\u793E\u5185\u30E1\u30E2\u3092\u5909\u66F4\u3057\u305F\u5F8C\u306F\u300C\u56DE\u7B54\u3092\u4FDD\u5B58\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044" })] }), _jsxs("div", { className: "flex items-center gap-2.5 w-full sm:w-auto justify-end", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors", children: "\u9589\u3058\u308B" }), _jsxs("button", { type: "button", disabled: saving || isLockedForDirectEdit, onClick: () => handleSaveAnswers(), className: "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm", children: [_jsx(Save, { className: "w-3.5 h-3.5 text-purple-200" }), _jsx("span", { children: "\u56DE\u7B54\u3092\u4FDD\u5B58" })] }), _jsxs("div", { className: "relative group", children: [_jsxs("button", { type: "button", disabled: true, className: "px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center gap-1.5", title: "\u8A2D\u554F\u4ED5\u69D8\u306E\u5FC5\u9808\u30AD\u30FC\u4E00\u89A7\u304C\u78BA\u5B9A\u3059\u308B\u307E\u3067\u5B8C\u4E86\u5316\u306F\u5B89\u5168\u306B\u30ED\u30C3\u30AF\u3055\u308C\u3066\u3044\u307E\u3059", children: [_jsx(Lock, { className: "w-3.5 h-3.5 text-amber-500" }), _jsx("span", { children: "\u8A3A\u65AD\u5B8C\u4E86\uFF08\u30ED\u30C3\u30AF\u4E2D\uFF09" })] }), _jsxs("div", { className: "absolute bottom-full right-0 mb-2 w-64 p-2 bg-slate-800 border border-slate-700 rounded-xl text-[11px] text-amber-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50", children: ["\u26A0\uFE0F \u8A2D\u554F\u30D0\u30FC\u30B8\u30E7\u30F3 ", diagnosis.questionnaire_version, " \u306E\u5FC5\u9808\u8A2D\u554FID\u304C\u672A\u78BA\u5B9A\u306E\u305F\u3081\u3001completed \u3078\u306E\u5B8C\u4E86\u78BA\u5B9A\u306F\u5B89\u5168\u306E\u305F\u3081\u73FE\u5728\u30ED\u30C3\u30AF\u3055\u308C\u3066\u3044\u307E\u3059\u3002"] })] })] })] })] }) }));
};
export const DiagnosisManager = (props) => {
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs", children: _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u53D7\u4ED8\u30D5\u30A9\u30FC\u30E0\u8A2D\u8A08" }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500", children: "HP\u30FBLINE\u5411\u3051\u306E\u53CD\u97FF\u53D7\u4ED8\u30D5\u30A9\u30FC\u30E0\u3084\u8A3A\u65AD\u8A2D\u554F\u3092\u30CE\u30FC\u30B3\u30FC\u30C9\u3067\u8A2D\u8A08\u30FB\u516C\u958B\u7BA1\u7406\u3067\u304D\u307E\u3059\u3002\uFF08\u56DE\u7B54\u306F\u7D71\u5408\u53D7\u4FE1\u30C8\u30EC\u30A4\u30FB\u5546\u8AC7\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3\u3078\u81EA\u52D5\u53CD\u6620\uFF09" })] }), _jsx("div", { className: "flex items-center gap-2", children: props.onNavigateTab && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => props.onNavigateTab?.('document_templates'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition cursor-pointer", title: "\u91CD\u8981\u66F8\u985E\u30FB\u898B\u7A4D\u30FB\u5951\u7D04\u3067\u30EC\u30DD\u30FC\u30C8\u3084\u63D0\u6848\u66F8\u3092\u76F4\u63A5AI\u4F5C\u6210", children: [_jsx(FileText, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { children: "\u91CD\u8981\u66F8\u985E\u30FB\u898B\u7A4D\u30FB\u5951\u7D04\u3092\u958B\u304F" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5 text-purple-400" })] }), _jsxs("button", { onClick: () => props.onNavigateTab?.('inbox_hub'), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer", children: [_jsx(Inbox, { className: "w-3.5 h-3.5 text-slate-500" }), _jsx("span", { children: "\u53D7\u4FE1\u30C8\u30EC\u30A4\u3067\u56DE\u7B54\u78BA\u8A8D" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5 text-slate-400" })] })] })) })] }) }), _jsx(DiagnosisFormsWorkspace, { initialLeadId: props.initialLeadId, initialCompanyId: props.initialCompanyId, initialSection: "forms", activeSection: "forms", showHeader: false, onOpenDiagnosis: () => { }, onOpenSendCenter: props.onOpenSendCenter }, "forms")] }));
};
