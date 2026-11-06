import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { LayoutDashboard, Megaphone, Briefcase, Inbox, Send, Calendar, Sparkles, CheckSquare, Bot, Settings, ChevronDown, ChevronRight, User, DollarSign, Download, Sliders, ShieldCheck, X } from 'lucide-react';
export const AppSidebar = ({ currentTab, onSelectTab, pendingApprovalsCount, isOpenMobile, onCloseMobile, onOpenConfig, onOpenRls, onOpenPricing, onOpenBackup, onOpenProfile, onOpenModelSettings, }) => {
    // Navigation groups definition reflecting the confirmed business workflow
    const navGroups = [
        {
            id: 'marketing',
            label: '集客・営業開拓',
            icon: Megaphone,
            defaultOpen: true,
            items: [
                { id: 'ai_acquisition', label: '集客戦略・SNS・メディア' },
                { id: 'contacts', label: '見込み企業・友だちリスト（AI調査 & LINE）' },
                { id: 'marketing_automation', label: 'LINE・メール自動配信（営業メール5段階 & シナリオ）' },
                { id: 'mst_diagnoses', label: '受付フォーム設計（反響獲得・設問管理）' },
            ],
        },
        {
            id: 'sales',
            label: '営業・顧客管理',
            icon: Briefcase,
            defaultOpen: true,
            items: [
                { id: 'leads', label: '商談パイプライン（反響リード・商談・顧客）' },
                { id: 'document_templates', label: '重要書類・見積・契約' },
                { id: 'customer_operations', label: '契約・請求・顧問支援（月次請求・支援進捗）' },
                { id: 'companies', label: '会社・商品台帳（マスタ管理）' },
            ],
        },
        {
            id: 'ai_president',
            label: 'AI経営室',
            icon: Sparkles,
            defaultOpen: true,
            items: [
                { id: 'ai_chat', label: 'AI社長室・対話' },
                { id: 'product_hub', label: '新規商品企画・プロジェクト開発（AI共創）' },
                { id: 'ai_knowledge', label: 'ナレッジ・成果物保管庫' },
                { id: 'ai_presets', label: '専門AI・自動化ルール設定' },
            ],
        },
    ];
    // Collapsible groups state
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const toggleGroup = (groupId) => {
        setCollapsedGroups((prev) => ({
            ...prev,
            [groupId]: !prev[groupId],
        }));
    };
    const isTabActive = (tabId) => {
        if (currentTab === tabId)
            return true;
        if (tabId === 'companies' && (currentTab === 'companies' || currentTab === 'products'))
            return true;
        if (tabId === 'contacts' && currentTab === 'prospects')
            return true;
        if ((tabId === 'leads' || tabId === 'deals') && (currentTab === 'leads' || currentTab === 'deals' || currentTab === 'customers'))
            return true;
        if (tabId === 'product_hub' && currentTab === 'ai_projects')
            return true;
        if (tabId === 'ai_presets' && currentTab === 'automations')
            return true;
        if (tabId === 'mst_dashboard' && currentTab === 'inflow_dashboard')
            return true;
        if (tabId === 'communication_send' && (currentTab === 'deal_invitations' || currentTab === 'customer_meeting_invitations'))
            return true;
        return false;
    };
    const handleItemClick = (tabId) => {
        onSelectTab(tabId);
        onCloseMobile();
    };
    const [settingsOpen, setSettingsOpen] = useState(false);
    return (_jsxs(_Fragment, { children: [isOpenMobile && (_jsx("div", { className: "fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity", onClick: onCloseMobile })), _jsxs("aside", { className: `fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}`, children: [_jsxs("div", { className: "h-16 flex items-center justify-between px-5 border-b border-slate-200 bg-white", children: [_jsxs("div", { className: "flex items-center gap-3 cursor-pointer group", onClick: () => handleItemClick('mst_dashboard'), children: [_jsx("div", { className: "w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-sm group-hover:scale-105 transition-transform", children: "MST" }), _jsxs("div", { children: [_jsx("div", { className: "flex items-center gap-1.5", children: _jsx("span", { className: "font-bold text-base tracking-tight text-slate-800", children: "MST AI\u7D4C\u55B6OS" }) }), _jsx("p", { className: "text-[11px] text-slate-500 font-medium", children: "\u7D4C\u55B6\u652F\u63F4\u30FB\u81EA\u52D5\u5316\u57FA\u76E4" })] })] }), _jsx("button", { type: "button", onClick: onCloseMobile, className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden", "aria-label": "\u30E1\u30CB\u30E5\u30FC\u3092\u9589\u3058\u308B", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar text-sm", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "px-3 pb-1 pt-0.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase", children: "\u7D4C\u55B6\u30FB\u30C7\u30A4\u30EA\u30FC\u696D\u52D9" }), _jsxs("button", { type: "button", onClick: () => handleItemClick('mst_dashboard'), className: `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${isTabActive('mst_dashboard')
                                            ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}`, children: [_jsx(LayoutDashboard, { className: `w-4 h-4 ${isTabActive('mst_dashboard') ? 'text-purple-600' : 'text-slate-400'}` }), _jsx("span", { children: "\uD83D\uDCCA \u7D4C\u55B6\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" })] }), _jsxs("button", { type: "button", onClick: () => handleItemClick('unified_calendar'), className: `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${isTabActive('unified_calendar')
                                            ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}`, children: [_jsx(Calendar, { className: `w-4 h-4 ${isTabActive('unified_calendar') ? 'text-purple-600' : 'text-slate-400'}` }), _jsx("span", { children: "\uD83D\uDCC5 \u4E88\u5B9A\u30AB\u30EC\u30F3\u30C0\u30FC" })] }), _jsxs("button", { type: "button", onClick: () => handleItemClick('inbox_hub'), className: `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${isTabActive('inbox_hub')
                                            ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}`, children: [_jsx(Inbox, { className: `w-4 h-4 ${isTabActive('inbox_hub') ? 'text-purple-600' : 'text-slate-400'}` }), _jsx("span", { children: "\uD83D\uDCE5 \u7D71\u5408\u53D7\u4FE1\u30C8\u30EC\u30A4" })] }), _jsxs("button", { type: "button", onClick: () => handleItemClick('communication_send'), className: `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${isTabActive('communication_send')
                                            ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}`, children: [_jsx(Send, { className: `w-4 h-4 ${isTabActive('communication_send') ? 'text-purple-600' : 'text-slate-400'}` }), _jsx("span", { children: "\uD83D\uDCE4 \u9001\u4FE1\u30BB\u30F3\u30BF\u30FC" })] }), _jsxs("button", { type: "button", onClick: () => handleItemClick('ai_tasks'), className: `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${isTabActive('ai_tasks')
                                            ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs'
                                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}`, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(CheckSquare, { className: `w-4 h-4 ${isTabActive('ai_tasks') ? 'text-purple-600' : 'text-slate-400'}` }), _jsx("span", { children: "\u5168\u793E\u30BF\u30B9\u30AF\u30FB\u627F\u8A8D" })] }), pendingApprovalsCount > 0 && (_jsx("span", { className: "px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200", children: pendingApprovalsCount }))] })] }), navGroups.map((group) => {
                                const isCollapsed = !!collapsedGroups[group.id];
                                const hasActiveChild = group.items.some((item) => isTabActive(item.id));
                                const GroupIcon = group.icon;
                                return (_jsxs("div", { className: "space-y-1", children: [_jsxs("button", { type: "button", onClick: () => toggleGroup(group.id), className: "w-full flex items-center justify-between px-2.5 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-700 transition-colors", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(GroupIcon, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: group.label })] }), isCollapsed ? (_jsx(ChevronRight, { className: "w-3.5 h-3.5 text-slate-400" })) : (_jsx(ChevronDown, { className: "w-3.5 h-3.5 text-slate-400" }))] }), !isCollapsed && (_jsx("div", { className: "space-y-0.5 pt-0.5", children: group.items.map((item) => {
                                                const active = isTabActive(item.id);
                                                return (_jsxs("button", { type: "button", onClick: () => handleItemClick(item.id), className: `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${active
                                                        ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200/70 shadow-xs'
                                                        : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'}`, children: [_jsx("span", { className: "truncate", children: item.label }), item.badge !== undefined && (_jsx("span", { className: `ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${item.badgeColor || 'bg-purple-100 text-purple-700 border-purple-200'}`, children: item.badge }))] }, item.id));
                                            }) }))] }, group.id));
                            })] }), _jsxs("div", { className: "p-3 border-t border-slate-200 bg-slate-50/70 text-xs", children: [_jsxs("button", { type: "button", onClick: () => setSettingsOpen(!settingsOpen), className: "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-slate-700 hover:bg-slate-200/60 transition-colors font-medium cursor-pointer", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Settings, { className: "w-4 h-4 text-slate-500" }), _jsx("span", { children: "\u8A2D\u5B9A\u30FB\u30B7\u30B9\u30C6\u30E0\u7BA1\u7406" })] }), settingsOpen ? (_jsx(ChevronDown, { className: "w-3.5 h-3.5 text-slate-400" })) : (_jsx(ChevronRight, { className: "w-3.5 h-3.5 text-slate-400" }))] }), settingsOpen && (_jsxs("div", { className: "mt-2 space-y-1 pl-2 border-l-2 border-purple-300 ml-2 animate-in fade-in duration-150", children: [_jsxs("button", { type: "button", onClick: onOpenProfile, className: "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors", children: [_jsx(User, { className: "w-3.5 h-3.5 text-purple-500" }), _jsx("span", { children: "\u30AA\u30FC\u30CA\u30FC\u4F01\u696D\u60C5\u5831" })] }), _jsxs("button", { type: "button", onClick: onOpenModelSettings, className: "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors", children: [_jsx(Bot, { className: "w-3.5 h-3.5 text-indigo-500" }), _jsx("span", { children: "AI\u30E2\u30C7\u30EB\u30FB\u5F79\u5272\u8A2D\u5B9A" })] }), _jsxs("button", { type: "button", onClick: onOpenPricing, className: "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors", children: [_jsx(DollarSign, { className: "w-3.5 h-3.5 text-emerald-500" }), _jsx("span", { children: "API\u30C8\u30FC\u30AF\u30F3\u30FB\u6599\u91D1" })] }), _jsxs("button", { type: "button", onClick: onOpenBackup, className: "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors", children: [_jsx(Download, { className: "w-3.5 h-3.5 text-cyan-500" }), _jsx("span", { children: "\u30C7\u30FC\u30BF\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7" })] }), _jsxs("button", { type: "button", onClick: onOpenConfig, className: "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors", children: [_jsx(Sliders, { className: "w-3.5 h-3.5 text-slate-500" }), _jsx("span", { children: "Supabase\u63A5\u7D9A\u8A2D\u5B9A" })] }), _jsxs("button", { type: "button", onClick: onOpenRls, className: "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-600 hover:text-slate-900 hover:bg-white transition-colors", children: [_jsx(ShieldCheck, { className: "w-3.5 h-3.5 text-blue-500" }), _jsx("span", { children: "RLS\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3" })] })] }))] })] })] }));
};
