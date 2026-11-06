import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { fetchTableCounts, fetchTableData, fetchDiagnosisCounts } from '../services/dataService';
import { getSupabase } from '../lib/supabaseClient';
import { getStatusBadgeClass } from '../utils/statusBadges';
import { Building2, TrendingUp, ArrowUpRight, RefreshCw, AlertCircle, FileCode2, DollarSign, Layers, ChevronRight, Calendar, Globe, CheckCircle2, Sparkles, MessageSquare, ShieldAlert, Play, Pause, X } from 'lucide-react';
export const Dashboard = ({ onNavigateTab, onOpenCreate, onOpenRls, }) => {
    const [counts, setCounts] = useState({
        companies: 0,
        contacts: 0,
        prospects: 0,
        leads: 0,
        products: 0,
        deals: 0,
        customers: 0,
    });
    const [recentDeals, setRecentDeals] = useState([]);
    const [pipelineSummary, setPipelineSummary] = useState({
        amount: 0,
        count: 0,
        wonAmount: 0,
        wonCount: 0,
        totalDeals: 0
    });
    const [inflowBreakdown, setInflowBreakdown] = useState([]);
    const [diagnosisStats, setDiagnosisStats] = useState({
        total: 0,
        byStatus: { received: 0, completed: 0, generating: 0, reported: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    // ─── 緊急停止（キルスイッチ）状態管理 ───
    const [automationControls, setAutomationControls] = useState([
        { target: 'all', paused: false, reason: '' },
        { target: 'ai', paused: false, reason: '' },
        { target: 'send', paused: false, reason: '' },
        { target: 'billing', paused: false, reason: '' },
    ]);
    const [isKillSwitchModalOpen, setIsKillSwitchModalOpen] = useState(false);
    const [selectedKillSwitchTarget, setSelectedKillSwitchTarget] = useState('all');
    const [killSwitchReasonInput, setKillSwitchReasonInput] = useState('');
    const [killSwitchUpdating, setKillSwitchUpdating] = useState(false);
    const [killSwitchMessage, setKillSwitchMessage] = useState(null);
    const loadAutomationControls = async () => {
        try {
            const res = await fetch('/api/admin/automation-controls');
            if (res.ok) {
                const data = await res.json();
                if (data.controls && Array.isArray(data.controls)) {
                    const map = new Map();
                    ['all', 'ai', 'send', 'billing'].forEach((t) => {
                        map.set(t, { target: t, paused: false, reason: '' });
                    });
                    data.controls.forEach((c) => {
                        if (map.has(c.target))
                            map.set(c.target, c);
                    });
                    setAutomationControls(Array.from(map.values()));
                }
            }
        }
        catch (err) {
            console.warn('Failed to fetch automation controls:', err);
        }
    };
    const handleToggleKillSwitch = async (target, nextPaused, customReason) => {
        setKillSwitchUpdating(true);
        setKillSwitchMessage(null);
        try {
            const supabase = getSupabase();
            let token = '';
            if (supabase) {
                const session = (await supabase.auth.getSession()).data.session;
                token = session?.access_token || '';
            }
            const reason = customReason !== undefined ? customReason : killSwitchReasonInput.trim();
            const res = await fetch('/api/admin/automation-controls', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    target,
                    paused: nextPaused,
                    reason: reason || (nextPaused ? '管理者による緊急停止' : '通常稼働に復旧'),
                }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'キルスイッチの更新に失敗しました');
            }
            await loadAutomationControls();
            const targetLabel = target === 'all' ? '全体' : target === 'ai' ? 'AI機能' : target === 'send' ? '自動配信' : '請求自動化';
            setKillSwitchMessage({
                type: 'success',
                text: nextPaused ? `【緊急停止】${targetLabel}の自動処理を停止しました。` : `【稼働再開】${targetLabel}の自動処理を再開しました。`,
            });
            setKillSwitchReasonInput('');
        }
        catch (err) {
            setKillSwitchMessage({
                type: 'error',
                text: err.message || '更新中にエラーが発生しました。',
            });
        }
        finally {
            setKillSwitchUpdating(false);
        }
    };
    const loadData = async () => {
        setLoading(true);
        setFetchError(null);
        loadAutomationControls();
        try {
            const [tableRes, diagRes, dealsRes, pipelineRes, leadsRes] = await Promise.all([
                fetchTableCounts(),
                fetchDiagnosisCounts(),
                fetchTableData('deals'),
                (async () => {
                    const supabase = getSupabase();
                    if (!supabase)
                        return null;
                    const pageSize = 1000;
                    let from = 0;
                    let amount = 0;
                    let count = 0;
                    let wonAmount = 0;
                    let wonCount = 0;
                    let totalDeals = 0;
                    while (true) {
                        const { data, error } = await supabase
                            .from('deals')
                            .select('id, proposal_status, total_amount')
                            .order('id', { ascending: true })
                            .range(from, from + pageSize - 1);
                        if (error)
                            throw error;
                        const page = data || [];
                        totalDeals += page.length;
                        for (const deal of page) {
                            const val = Number(deal.total_amount ?? 0) || 0;
                            if (deal.proposal_status === '受注') {
                                wonAmount += val;
                                wonCount += 1;
                            }
                            else if (deal.proposal_status !== '失注') {
                                amount += val;
                                count += 1;
                            }
                        }
                        if (page.length < pageSize)
                            break;
                        from += pageSize;
                    }
                    return { amount, count, wonAmount, wonCount, totalDeals };
                })(),
                (async () => {
                    const supabase = getSupabase();
                    if (!supabase)
                        return null;
                    try {
                        const { data, error } = await supabase
                            .from('leads')
                            .select('id, source, status, service_type')
                            .limit(1000);
                        if (error)
                            return null;
                        return data || [];
                    }
                    catch {
                        return null;
                    }
                })(),
            ]);
            if (tableRes.error) {
                setFetchError(tableRes.error);
            }
            else {
                setCounts(tableRes.counts);
            }
            if (diagRes) {
                setDiagnosisStats({ total: diagRes.total, byStatus: diagRes.byStatus });
            }
            if (dealsRes.data) {
                setRecentDeals([...dealsRes.data].sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0)).slice(0, 5));
            }
            if (pipelineRes) {
                setPipelineSummary(pipelineRes);
            }
            // Process inflow breakdown
            if (leadsRes && leadsRes.length > 0) {
                const sourceMap = new Map();
                leadsRes.forEach((lead) => {
                    const rawSource = lead.source?.trim() || lead.service_type?.trim() || '自社HP / 直接反響';
                    sourceMap.set(rawSource, (sourceMap.get(rawSource) || 0) + 1);
                });
                const total = leadsRes.length;
                const sorted = Array.from(sourceMap.entries())
                    .map(([source, count]) => ({
                    source,
                    count,
                    percentage: Math.round((count / total) * 100),
                }))
                    .sort((a, b) => b.count - a.count);
                setInflowBreakdown(sorted);
            }
            else {
                setInflowBreakdown([
                    { source: '自社HP・Web検索', count: 0, percentage: 0 },
                    { source: '無料診断・フォーム', count: 0, percentage: 0 },
                    { source: 'LINE友だち登録', count: 0, percentage: 0 },
                    { source: 'SNS・オウンドメディア', count: 0, percentage: 0 },
                ]);
            }
        }
        catch (err) {
            setFetchError({
                type: 'UNKNOWN',
                message: err.message || 'データ読み込み中にエラーが発生しました。'
            });
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData();
    }, []);
    const totalLeads = counts.leads || 0;
    const leadToDealRate = totalLeads > 0 && pipelineSummary.totalDeals > 0
        ? ((pipelineSummary.totalDeals / totalLeads) * 100).toFixed(1)
        : '0';
    const dealToWonRate = pipelineSummary.totalDeals > 0 && pipelineSummary.wonCount > 0
        ? ((pipelineSummary.wonCount / pipelineSummary.totalDeals) * 100).toFixed(1)
        : '0';
    return (_jsxs("div", { className: "space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u7D4C\u55B6\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("button", { type: "button", onClick: () => onNavigateTab('ai_chat'), className: "px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer", title: "AI\u793E\u9577\u3068\u7D4C\u55B6\u6226\u7565\u30FB\u8AB2\u984C\u30FB\u65BD\u7B56\u3092\u30C1\u30E3\u30C3\u30C8\u3067\u76F8\u8AC7", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "AI\u793E\u9577\u5BA4\u306B\u76F8\u8AC7" }), _jsx(ArrowUpRight, { className: "w-3.5 h-3.5" })] }), _jsxs("button", { type: "button", onClick: () => onNavigateTab('unified_calendar'), className: "px-3 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer", children: [_jsx(Calendar, { className: "w-3.5 h-3.5 text-indigo-600" }), _jsx("span", { children: "\u4E88\u5B9A\u30AB\u30EC\u30F3\u30C0\u30FC" })] }), (() => {
                                const pausedItems = automationControls.filter((c) => c.paused);
                                const isAnyPaused = pausedItems.length > 0;
                                const targetMap = { all: '全体', ai: 'AI', send: '配信', billing: '請求' };
                                return (_jsxs("button", { type: "button", onClick: () => {
                                        setIsKillSwitchModalOpen(true);
                                        setKillSwitchMessage(null);
                                    }, className: `px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isAnyPaused
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm ring-2 ring-rose-400/50 animate-pulse'
                                        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`, title: "AI\u30FB\u914D\u4FE1\u30FB\u8ACB\u6C42\u81EA\u52D5\u5316\u306E\u7DCA\u6025\u505C\u6B62\uFF08\u30AD\u30EB\u30B9\u30A4\u30C3\u30C1\uFF09\u3092\u8A2D\u5B9A", children: [_jsx(ShieldAlert, { className: `w-3.5 h-3.5 ${isAnyPaused ? 'text-white' : 'text-rose-500'}` }), _jsx("span", { children: isAnyPaused ? `🚨 緊急停止中 (${pausedItems.map((p) => targetMap[p.target] || p.target).join('/')})` : '緊急停止' })] }));
                            })(), _jsxs("button", { type: "button", onClick: loadData, disabled: loading, className: "px-3 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer", title: "\u6700\u65B0\u30C7\u30FC\u30BF\u3092\u518D\u96C6\u8A08", children: [_jsx(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}` }), _jsx("span", { children: "\u66F4\u65B0" })] })] })] }), fetchError && (_jsxs("div", { className: "p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(AlertCircle, { className: "w-5 h-5 text-amber-600 shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-sm text-amber-900", children: fetchError.type === 'PERMISSION_DENIED' ? 'データベース権限（RLS）の確認が必要です' : 'データ取得エラー' }), _jsx("p", { className: "text-xs text-amber-800 mt-0.5", children: fetchError.message })] })] }), fetchError.type === 'PERMISSION_DENIED' && (_jsxs("button", { onClick: onOpenRls, className: "px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 transition-colors", children: [_jsx(FileCode2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "RLS\u63A8\u5968SQL\u3092\u78BA\u8A8D" })] }))] })), _jsxs("section", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { onClick: () => onNavigateTab('customers'), className: "cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-600 flex items-center gap-1.5", children: [_jsx(DollarSign, { className: "w-4 h-4 text-amber-600" }), "\u53D7\u6CE8\u30FB\u78BA\u5B9A\u58F2\u4E0A\u7DCF\u984D"] }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold", children: "\u78BA\u5B9A\u696D\u7E3E" })] }), _jsx("div", { className: "mt-3 flex items-baseline gap-1.5", children: _jsx("span", { className: "text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono", children: loading ? '...' : `¥${pipelineSummary.wonAmount.toLocaleString('ja-JP')}` }) }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2", children: [_jsx("span", { children: "\u6210\u7D04 / \u5951\u7D04\u793E\u6570" }), _jsxs("span", { className: "font-bold text-slate-800", children: [pipelineSummary.wonCount, " \u4EF6 / ", counts.customers, " \u793E"] })] })] }), _jsxs("div", { onClick: () => onNavigateTab('deals'), className: "cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-600 flex items-center gap-1.5", children: [_jsx(TrendingUp, { className: "w-4 h-4 text-emerald-600" }), "\u9032\u884C\u4E2D \u5546\u8AC7\u91D1\u984D"] }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold", children: "\u5546\u8AC7\u4E2D" })] }), _jsx("div", { className: "mt-3 flex items-baseline gap-1.5", children: _jsx("span", { className: "text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono", children: loading ? '...' : `¥${pipelineSummary.amount.toLocaleString('ja-JP')}` }) }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2", children: [_jsx("span", { children: "\u5546\u8AC7\u4E2D \u6848\u4EF6\u6570" }), _jsxs("span", { className: "font-bold text-slate-800", children: [pipelineSummary.count, " \u4EF6"] })] })] }), _jsxs("div", { onClick: () => onNavigateTab('leads'), className: "cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-600 flex items-center gap-1.5", children: [_jsx(Layers, { className: "w-4 h-4 text-purple-600" }), "\u53CD\u97FF\u30FB\u7DCF\u30EA\u30FC\u30C9\u7372\u5F97"] }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold", children: "\u96C6\u5BA2\u6210\u679C" })] }), _jsxs("div", { className: "mt-3 flex items-baseline gap-1.5", children: [_jsx("span", { className: "text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono", children: loading ? '...' : totalLeads.toLocaleString() }), _jsx("span", { className: "text-xs text-slate-500", children: "\u4EF6" })] }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2", children: [_jsx("span", { children: "\u5546\u8AC7\u5316\u7387" }), _jsxs("span", { className: "font-bold text-purple-700", children: [leadToDealRate, "%"] })] })] }), _jsxs("div", { onClick: () => onNavigateTab('deals'), className: "cursor-pointer bg-white border border-slate-200 hover:border-purple-300 hover:shadow-xs p-5 rounded-2xl transition-all shadow-2xs group", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-600 flex items-center gap-1.5", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-indigo-600" }), "\u5546\u8AC7\u6210\u7D04\u7387 (\u53D7\u6CE8\u7387)"] }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold", children: "\u55B6\u696D\u52B9\u7387" })] }), _jsx("div", { className: "mt-3 flex items-baseline gap-1.5", children: _jsx("span", { className: "text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono", children: loading ? '...' : `${dealToWonRate}%` }) }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2", children: [_jsx("span", { children: "\u6210\u7D04\u4EF6\u6570" }), _jsxs("span", { className: "font-bold text-slate-800", children: [pipelineSummary.wonCount, " \u4EF6"] })] })] })] }), _jsxs("div", { className: "bg-gradient-to-r from-purple-50 via-white to-slate-50 border border-purple-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs", children: _jsx(Sparkles, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-bold text-sm text-slate-900", children: "AI\u793E\u9577\u5BA4 \u00D7 \u7D4C\u55B6\u53C2\u8B00" }), _jsx("span", { className: "text-[11px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-semibold", children: "\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u652F\u63F4" })] }), _jsxs("p", { className: "text-xs text-slate-600 mt-0.5", children: ["\u9032\u884C\u4E2D\u5546\u8AC7 \u00A5", pipelineSummary.amount.toLocaleString(), " \u3068\u53CD\u97FF\u30EA\u30FC\u30C9 ", totalLeads, "\u4EF6 \u306E\u30C7\u30FC\u30BF\u306B\u57FA\u3065\u304D\u3001\u6B21\u306E\u30A2\u30AF\u30B7\u30E7\u30F3\u30FB\u512A\u5148\u65BD\u7B56\u3092AI\u3068\u5373\u6642\u58C1\u6253\u3061\u3067\u304D\u307E\u3059\u3002"] })] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0 w-full md:w-auto", children: [_jsxs("button", { type: "button", onClick: () => onNavigateTab('ai_chat'), className: "flex-1 md:flex-none px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer", children: [_jsx(MessageSquare, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "AI\u793E\u9577\u306B\u76F8\u8AC7\u3059\u308B" })] }), _jsxs("button", { type: "button", onClick: () => onNavigateTab('ai_tasks'), className: "px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer", children: [_jsx("span", { children: "\u5168\u793E\u30BF\u30B9\u30AF\u30FB\u627F\u8A8D" }), _jsx(ChevronRight, { className: "w-3.5 h-3.5 text-slate-400" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6", children: [_jsx("div", { className: "lg:col-span-5 space-y-4", children: _jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between pb-3 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Globe, { className: "w-4 h-4 text-purple-600" }), _jsx("h2", { className: "font-bold text-sm text-slate-900", children: "\u53CD\u97FF\u30FB\u6D41\u5165\u30C1\u30E3\u30CD\u30EB\u5185\u8A33" })] }), _jsxs("button", { type: "button", onClick: () => onNavigateTab('leads'), className: "text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5 cursor-pointer", children: [_jsx("span", { children: "\u30EA\u30FC\u30C9\u53F0\u5E33" }), _jsx(ChevronRight, { className: "w-3.5 h-3.5" })] })] }), _jsx("div", { className: "space-y-3", children: inflowBreakdown.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400 text-center py-4", children: "\u30C7\u30FC\u30BF\u96C6\u8A08\u4E2D..." })) : (inflowBreakdown.slice(0, 5).map((item, idx) => (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsx("span", { className: "text-slate-700 font-medium truncate max-w-[180px]", children: item.source }), _jsxs("div", { className: "flex items-center gap-2 font-mono", children: [_jsxs("span", { className: "text-slate-400 text-[11px]", children: [item.percentage, "%"] }), _jsxs("span", { className: "text-slate-900 font-bold", children: [item.count, "\u4EF6"] })] })] }), _jsx("div", { className: "w-full h-1.5 bg-slate-100 rounded-full overflow-hidden", children: _jsx("div", { className: "bg-purple-600 h-full rounded-full transition-all duration-500", style: { width: `${item.percentage}%` } }) })] }, idx)))) }), _jsxs("div", { className: "mt-4 pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl", children: [_jsxs("div", { children: [_jsx("span", { className: "text-[11px] text-slate-500 block", children: "\u8A3A\u65AD\u30D5\u30A9\u30FC\u30E0\u7DCF\u56DE\u7B54" }), _jsxs("span", { className: "text-base font-bold text-slate-900 font-mono", children: [diagnosisStats.total, " \u4EF6"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-[11px] text-amber-700 block", children: "\u672A\u78BA\u8A8D\u56DE\u7B54" }), _jsxs("span", { className: "text-base font-bold text-amber-700 font-mono", children: [diagnosisStats.byStatus.received, " \u4EF6"] })] }), _jsx("button", { type: "button", onClick: () => onNavigateTab('mst_diagnoses'), className: "px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-semibold hover:bg-slate-100 transition-colors cursor-pointer", children: "\u8A3A\u65AD\u8A2D\u8A08\u3078" })] })] }) }), _jsx("div", { className: "lg:col-span-7", children: _jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between pb-3 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { className: "w-4 h-4 text-emerald-600" }), _jsx("h2", { className: "font-bold text-sm text-slate-900", children: "\u76F4\u8FD1\u306E\u5546\u8AC7\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3" })] }), _jsxs("button", { type: "button", onClick: () => onNavigateTab('deals'), className: "text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-0.5 cursor-pointer", children: [_jsx("span", { children: "\u5168\u5546\u8AC7\u3092\u898B\u308B" }), _jsx(ChevronRight, { className: "w-3.5 h-3.5" })] })] }), loading ? (_jsxs("div", { className: "p-8 text-center text-xs text-slate-500", children: [_jsx(RefreshCw, { className: "w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" }), "\u5546\u8AC7\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D..."] })) : recentDeals.length === 0 ? (_jsxs("div", { className: "p-8 text-center bg-slate-50 rounded-xl border border-slate-200", children: [_jsx("p", { className: "text-xs text-slate-500", children: "\u73FE\u5728\u9032\u884C\u4E2D\u306E\u5546\u8AC7\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }), _jsx("button", { type: "button", onClick: () => onNavigateTab('deals'), className: "mt-3 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer", children: _jsx("span", { children: "\u5546\u8AC7\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3\u3092\u958B\u304F" }) })] })) : (_jsx("div", { className: "overflow-x-auto border border-slate-200 rounded-xl", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2.5 px-3", children: "\u63D0\u6848\u30D7\u30E9\u30F3\u30FB\u5546\u8AC7\u540D" }), _jsx("th", { className: "py-2.5 px-3", children: "\u53D6\u5F15\u5148\u4F1A\u793E" }), _jsx("th", { className: "py-2.5 px-3", children: "\u30B9\u30C6\u30FC\u30BF\u30B9" }), _jsx("th", { className: "py-2.5 px-3 text-right", children: "\u60F3\u5B9A\u7DCF\u984D" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 text-slate-700", children: recentDeals.map((deal) => (_jsxs("tr", { onClick: () => onNavigateTab('deals'), className: "hover:bg-purple-50/40 cursor-pointer transition-colors", children: [_jsx("td", { className: "py-3 px-3 font-medium text-slate-900", children: deal.proposal_plan_name || deal.deal_name || `商談 #${deal.id}` }), _jsx("td", { className: "py-3 px-3", children: deal.company?.company_name ? (_jsx("span", { className: "font-semibold text-purple-700", children: deal.company.company_name })) : (_jsx("span", { className: "font-mono text-slate-400", children: deal.company_id || '-' })) }), _jsx("td", { className: "py-3 px-3", children: _jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-full text-[11px] border ${getStatusBadgeClass(deal.proposal_status || deal.stage)}`, children: deal.proposal_status || deal.stage || '検討中' }) }), _jsx("td", { className: "py-3 px-3 text-right font-mono font-bold text-slate-900", children: deal.total_amount !== undefined && deal.total_amount !== null
                                                                ? `¥${Number(deal.total_amount).toLocaleString()}`
                                                                : deal.amount
                                                                    ? `¥${Number(deal.amount).toLocaleString()}`
                                                                    : '-' })] }, deal.id))) })] }) }))] }) })] }), _jsxs("section", { className: "bg-white border border-slate-200 rounded-2xl p-5 shadow-xs", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("h2", { className: "font-bold text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5", children: [_jsx(Building2, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: "\u4E3B\u8981\u53F0\u5E33\u30EC\u30B3\u30FC\u30C9\u6982\u6CC1" })] }), _jsx("span", { className: "text-[11px] text-slate-400", children: "\u30AF\u30EA\u30C3\u30AF\u3067\u5404\u4E00\u89A7\u3078\u76F4\u63A5\u30B8\u30E3\u30F3\u30D7" })] }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3", children: [
                            { key: 'companies', label: '会社台帳', count: counts.companies, tab: 'companies', color: 'text-blue-700' },
                            { key: 'contacts', label: '連絡先・友だち', count: counts.contacts, tab: 'contacts', color: 'text-teal-700' },
                            { key: 'prospects', label: '見込み企業', count: counts.prospects, tab: 'contacts', color: 'text-amber-700' },
                            { key: 'leads', label: '反響リード', count: counts.leads, tab: 'leads', color: 'text-purple-700' },
                            { key: 'deals', label: '商談案件', count: counts.deals, tab: 'deals', color: 'text-emerald-700' },
                            { key: 'customers', label: '契約顧客', count: counts.customers, tab: 'customers', color: 'text-rose-700' },
                        ].map((item) => (_jsxs("button", { type: "button", onClick: () => onNavigateTab(item.tab), className: "p-3 rounded-xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 transition-all text-left cursor-pointer group", children: [_jsx("span", { className: "text-[11px] font-medium text-slate-500 block", children: item.label }), _jsxs("div", { className: "flex items-baseline justify-between mt-1", children: [_jsx("span", { className: `text-lg font-black font-mono ${item.color}`, children: loading ? '...' : item.count.toLocaleString() }), _jsx("span", { className: "text-[10px] text-slate-400", children: "\u4EF6" })] })] }, item.key))) })] }), isKillSwitchModalOpen && (_jsx("div", { className: "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 rounded-lg bg-rose-100 text-rose-700", children: _jsx(ShieldAlert, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-base font-bold text-slate-900", children: "\u81EA\u52D5\u5316\u7DCA\u6025\u505C\u6B62\uFF08\u30AD\u30EB\u30B9\u30A4\u30C3\u30C1\uFF09" }), _jsx("p", { className: "text-xs text-slate-500", children: "\u66B4\u8D70\u9632\u6B62\u30FB\u30E1\u30F3\u30C6\u30CA\u30F3\u30B9\u6642\u306E\u5373\u6642\u505C\u6B62\u7528\u30B9\u30A4\u30C3\u30C1\uFF08DB\u9023\u52D5\u30FB\u30B5\u30FC\u30D0\u30FC\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u53CD\u6620\uFF09" })] })] }), _jsx("button", { type: "button", onClick: () => setIsKillSwitchModalOpen(false), className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), killSwitchMessage && (_jsxs("div", { className: `mx-6 mt-4 p-3 rounded-lg text-xs font-medium flex items-center justify-between ${killSwitchMessage.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'}`, children: [_jsx("span", { children: killSwitchMessage.text }), _jsx("button", { type: "button", onClick: () => setKillSwitchMessage(null), className: "text-slate-400 hover:text-slate-600 ml-2", children: _jsx(X, { className: "w-4 h-4" }) })] })), _jsxs("div", { className: "p-6 space-y-5 max-h-[75vh] overflow-y-auto", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "text-xs font-bold text-slate-700 uppercase tracking-wider block", children: "\u505C\u6B62\u5BFE\u8C61\u3092\u9078\u629E" }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [
                                                {
                                                    target: 'all',
                                                    title: '🚨 全体一括停止',
                                                    desc: 'AI、メール/LINE自動配信、請求連携すべての自動処理を即座に停止します。',
                                                    tagColor: 'border-slate-300',
                                                },
                                                {
                                                    target: 'ai',
                                                    title: '🤖 AI機能停止',
                                                    desc: 'チャット、キャラクター自動生成、記憶抽出などのLLM呼び出しを停止（503返却）。',
                                                    tagColor: 'border-purple-200',
                                                },
                                                {
                                                    target: 'send',
                                                    title: '✉️ 自動配信停止',
                                                    desc: 'マーケティングシナリオのメール・LINE送信キュー処理を一時中断します。',
                                                    tagColor: 'border-blue-200',
                                                },
                                                {
                                                    target: 'billing',
                                                    title: '📑 請求自動化停止',
                                                    desc: '期限超過請求書の督促タスク起票・当月定期請求書の下書き自動生成を停止します。',
                                                    tagColor: 'border-emerald-200',
                                                },
                                            ].map((item) => {
                                                const control = automationControls.find((c) => c.target === item.target);
                                                const isPaused = Boolean(control?.paused);
                                                const isSelected = selectedKillSwitchTarget === item.target;
                                                return (_jsxs("div", { onClick: () => setSelectedKillSwitchTarget(item.target), className: `p-3.5 rounded-xl border-2 transition-all cursor-pointer text-left relative ${isSelected
                                                        ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-2 mb-1.5", children: [_jsx("span", { className: "font-bold text-sm text-slate-800", children: item.title }), _jsx("span", { className: `px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaused
                                                                        ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                                                        : 'bg-emerald-100 text-emerald-700 border border-emerald-300'}`, children: isPaused ? '🔴 停止中' : '🟢 稼働中' })] }), _jsx("p", { className: "text-xs text-slate-500 line-clamp-2 leading-relaxed", children: item.desc }), isPaused && control?.reason && (_jsxs("div", { className: "mt-2 text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-100", children: ["\u7406\u7531: ", control.reason] }))] }, item.target));
                                            }) })] }), (() => {
                                    const currentControl = automationControls.find((c) => c.target === selectedKillSwitchTarget);
                                    const isPaused = Boolean(currentControl?.paused);
                                    const targetLabels = {
                                        all: '全体一括',
                                        ai: 'AI機能',
                                        send: '自動配信（メール/LINE）',
                                        billing: '請求自動化',
                                    };
                                    return (_jsxs("div", { className: "p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "font-bold text-sm text-slate-800", children: ["\u9078\u629E\u4E2D: ", targetLabels[selectedKillSwitchTarget]] }), _jsxs("span", { className: `text-xs font-semibold px-2 py-0.5 rounded-full ${isPaused
                                                                    ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-300'}`, children: ["\u73FE\u5728: ", isPaused ? '緊急停止中' : '正常稼働中'] })] }), currentControl?.updated_at && (_jsxs("span", { className: "text-[11px] text-slate-400", children: ["\u6700\u7D42\u66F4\u65B0: ", new Date(currentControl.updated_at).toLocaleString('ja-JP'), currentControl.updated_by ? ` (${currentControl.updated_by})` : ''] }))] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-slate-600 block mb-1", children: "\u505C\u6B62\u30FB\u518D\u958B\u306E\u7406\u7531 / \u30E1\u30E2\uFF08\u4EFB\u610F\uFF09" }), _jsx("input", { type: "text", value: killSwitchReasonInput, onChange: (e) => setKillSwitchReasonInput(e.target.value), placeholder: isPaused
                                                            ? '例: メンテナンス完了のため再開'
                                                            : '例: API制限到達による一時停止 / 誤配信防止', className: "w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white" })] }), _jsx("div", { className: "pt-1 flex items-center justify-end gap-2", children: isPaused ? (_jsxs("button", { type: "button", disabled: killSwitchUpdating, onClick: () => handleToggleKillSwitch(selectedKillSwitchTarget, false), className: "px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs", children: [_jsx(Play, { className: "w-3.5 h-3.5 fill-current" }), _jsx("span", { children: killSwitchUpdating ? '更新中...' : '稼働を再開する' })] })) : (_jsxs("button", { type: "button", disabled: killSwitchUpdating, onClick: () => handleToggleKillSwitch(selectedKillSwitchTarget, true), className: "px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs", children: [_jsx(Pause, { className: "w-3.5 h-3.5 fill-current" }), _jsx("span", { children: killSwitchUpdating ? '更新中...' : '緊急停止を実行する' })] })) })] }));
                                })()] }), _jsxs("div", { className: "px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between", children: [_jsx("span", { className: "text-[11px] text-slate-400", children: "\u203B \u505C\u6B62\u3059\u308B\u3068\u8A72\u5F53\u6A5F\u80FD\u3078\u306EAPI\u30EA\u30AF\u30A8\u30B9\u30C8\u306F\u76F4\u3061\u306B\u62D2\u5426\u307E\u305F\u306F\u30B9\u30AD\u30C3\u30D7\u3055\u308C\u307E\u3059\u3002" }), _jsx("button", { type: "button", onClick: () => setIsKillSwitchModalOpen(false), className: "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer", children: "\u9589\u3058\u308B" })] })] }) }))] }));
};
