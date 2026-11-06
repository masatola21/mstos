import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from '../context/AuthContext';
import { Building2, LogOut, SlidersHorizontal, FileCode2, Sparkles, Package, Layers, Zap, Bot, DollarSign, Download, User, ListTodo } from 'lucide-react';
import { TABLE_CONFIGS } from '../types/database';
export const UnifiedNavbar = ({ currentTab, onTabChange, onOpenConfig, onOpenRls, onOpenPricing, onOpenBackup, onOpenProfile, pendingApprovalsCount, }) => {
    const { user, signOut, config } = useAuth();
    // Determine current active section
    const getCurrentSection = () => {
        if (currentTab === 'ai_dashboard' ||
            currentTab === 'ai_chat' ||
            currentTab === 'ai_presets' ||
            currentTab === 'ai_knowledge' ||
            currentTab === 'automations') {
            return 'ai_president';
        }
        if (currentTab === 'customer_operations')
            return 'mst';
        if (currentTab === 'product_hub' ||
            currentTab === 'category_hub' ||
            currentTab === 'ai_projects' ||
            currentTab === 'ai_tasks' ||
            currentTab === 'ai_approvals') {
            return 'matrix';
        }
        return 'mst';
    };
    const activeSection = getCurrentSection();
    return (_jsx("header", { className: "sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "flex items-center justify-between h-16", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-3 cursor-pointer", onClick: () => onTabChange('mst_dashboard'), children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black tracking-wider", children: "MST" }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-bold text-lg tracking-tight text-white", children: "MST AI\u7D4C\u55B6OS" }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium hidden sm:inline-block", children: "\u7D71\u5408\u7D4C\u55B6\u57FA\u76E4" })] }), _jsx("p", { className: "text-[10px] text-slate-400 hidden md:block", children: "\u55B6\u696D\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3 \u00D7 AI\u793E\u9577\u30B7\u30C9\u30A6 \u00D7 \u591A\u6B21\u5143\u5546\u54C1\u7BA1\u7406" })] })] }), _jsxs("div", { className: "hidden lg:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs ml-2", children: [_jsxs("button", { onClick: () => onTabChange('mst_dashboard'), className: `px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${activeSection === 'mst'
                                                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                                                : 'text-slate-400 hover:text-white'}`, children: [_jsx(Building2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u55B6\u696D\u30FB\u9867\u5BA2\u7BA1\u7406" })] }), _jsxs("button", { onClick: () => onTabChange('product_hub'), className: `px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${activeSection === 'matrix'
                                                ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30'
                                                : 'text-slate-400 hover:text-white'}`, children: [_jsx(Layers, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u4E8B\u696D\u904B\u55B6" })] }), _jsxs("button", { onClick: () => onTabChange('ai_dashboard'), className: `px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${activeSection === 'ai_president'
                                                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                                                : 'text-slate-400 hover:text-white'}`, children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u7D4C\u55B6\u30FBAI\u793E\u9577" }), pendingApprovalsCount > 0 && (_jsx("span", { className: "w-2 h-2 rounded-full bg-amber-400 animate-pulse" }))] })] })] }), _jsxs("div", { className: "flex items-center gap-2 sm:gap-3", children: [_jsx("button", { onClick: onOpenPricing, className: "p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors", title: "API\u30C8\u30FC\u30AF\u30F3\u5229\u7528\u91CF\u30FB\u6599\u91D1\u5358\u4FA1\u8A2D\u5B9A", children: _jsx(DollarSign, { className: "w-4 h-4 text-emerald-400" }) }), _jsx("button", { onClick: onOpenBackup, className: "p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors hidden sm:block", title: "\u30C7\u30FC\u30BF\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30FB\u5FA9\u5143", children: _jsx(Download, { className: "w-4 h-4 text-cyan-400" }) }), _jsx("button", { onClick: onOpenProfile, className: "p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors hidden sm:block", title: "\u30AA\u30FC\u30CA\u30FC\u60C5\u5831\u8A2D\u5B9A", children: _jsx(User, { className: "w-4 h-4 text-purple-400" }) }), _jsx("button", { onClick: onOpenRls, className: "p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors hidden md:block", title: "RLS\u30BB\u30AD\u30E5\u30EA\u30C6\u30A3\u8A2D\u5B9A", children: _jsx(FileCode2, { className: "w-4 h-4 text-indigo-400" }) }), _jsx("button", { onClick: onOpenConfig, className: "p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors", title: "Supabase\u74B0\u5883\u5909\u6570\u30FB\u63A5\u7D9A\u8A2D\u5B9A", children: _jsx(SlidersHorizontal, { className: "w-4 h-4" }) }), user && (_jsx("button", { onClick: signOut, className: "p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors ml-1", title: "\u30ED\u30B0\u30A2\u30A6\u30C8", children: _jsx(LogOut, { className: "w-4 h-4" }) }))] })] }), _jsxs("nav", { className: "border-t border-slate-800/70 py-2 text-xs font-medium", children: [activeSection === 'mst' && (() => {
                            const groups = [
                                { id: 'dashboard', label: '経営・日程', items: ['mst_dashboard', 'unified_calendar'] },
                                { id: 'communications', label: '対話・送受信', items: ['inbox_hub', 'communication_send', 'deal_invitations', 'customer_meeting_invitations'] },
                                { id: 'acquisition', label: '集客・開拓', items: ['ai_acquisition', 'marketing_automation', 'prospects', 'contacts'] },
                                { id: 'pipeline', label: '反響・商談', items: ['leads', 'deals', 'mst_diagnoses'] },
                                { id: 'contracts', label: '書類・契約', items: ['document_templates'] },
                                { id: 'customers', label: '顧客・支援', items: ['customers', 'customer_operations', 'products', 'companies'] },
                            ];
                            const activeGroup = groups.find((group) => group.items.includes(currentTab)) || groups[0];
                            const labelFor = (tab) => {
                                if (tab === 'inbox_hub')
                                    return '📥 統合受信トレイ（反響・契約後顧客・全チャネル）';
                                if (tab === 'communication_send')
                                    return '📤 送信センター（個別・一斉・書類送付・テンプレート保管庫）';
                                if (tab === 'mst_dashboard')
                                    return '営業・反響 統合ダッシュボード';
                                if (tab === 'inflow_dashboard')
                                    return '営業・反響 統合ダッシュボード';
                                if (tab === 'unified_calendar')
                                    return '統合予定カレンダー（Google同期・全社日程）';
                                if (tab === 'deal_invitations')
                                    return '商談予約案内';
                                if (tab === 'customer_meeting_invitations')
                                    return '顧客面談案内';
                                if (tab === 'ai_acquisition')
                                    return 'AI集客運用（HP/SNS/メディア）';
                                if (tab === 'prospects')
                                    return '見込み企業（AI検索）';
                                if (tab === 'contacts')
                                    return '連絡先・LINE友だち（タグ管理）';
                                if (tab === 'marketing_automation')
                                    return 'LINE・メール自動配信（シナリオ・ジョブ）';
                                if (tab === 'leads')
                                    return '反響リード';
                                if (tab === 'deals')
                                    return '商談一覧';
                                if (tab === 'mst_diagnoses')
                                    return 'フォーム・診断設計';
                                if (tab === 'document_templates')
                                    return '重要書類（見積・契約・請求・レポート）';
                                if (tab === 'customers')
                                    return '契約顧客台帳';
                                if (tab === 'customer_operations')
                                    return '支援案件・タスク';
                                if (tab === 'products')
                                    return '商品マスタ（デジタル含む）';
                                if (tab === 'companies')
                                    return '会社台帳（法人マスタ）';
                                if (tab === 'custom_lists')
                                    return '配信対象リスト';
                                return TABLE_CONFIGS[tab]?.label || String(tab);
                            };
                            return _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "flex flex-wrap gap-1.5", role: "tablist", "aria-label": "\u55B6\u696D\u30FB\u9867\u5BA2\u7BA1\u7406\u306E\u6A5F\u80FD\u30B0\u30EB\u30FC\u30D7", children: groups.map((group) => _jsx("button", { onClick: () => onTabChange(group.items[0]), "aria-current": activeGroup.id === group.id ? 'page' : undefined, className: `rounded-lg px-3 py-1.5 transition-colors ${activeGroup.id === group.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: group.label }, group.id)) }), _jsx("div", { className: "flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1", "aria-label": activeGroup.label, children: activeGroup.items.map((tab) => _jsx("button", { onClick: () => onTabChange(tab), "aria-current": currentTab === tab ? 'page' : undefined, className: `rounded-lg px-3 py-1.5 transition-colors ${currentTab === tab ? 'bg-blue-600 font-semibold text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`, children: labelFor(tab) }, tab)) })] });
                        })(), activeSection === 'matrix' && (_jsxs("div", { className: "flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1", children: [_jsxs("button", { onClick: () => onTabChange('product_hub'), "aria-current": currentTab === 'product_hub' ? 'page' : undefined, className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'product_hub' ? 'bg-cyan-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: [_jsx(Package, { className: "w-3.5 h-3.5 text-cyan-400" }), _jsx("span", { children: "AI\u30D7\u30ED\u30C0\u30AF\u30C8\u8A2D\u8A08" })] }), _jsx("button", { onClick: () => onTabChange('ai_projects'), "aria-current": currentTab === 'ai_projects' ? 'page' : undefined, className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${currentTab === 'ai_projects' ? 'bg-cyan-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8" }), _jsxs("button", { onClick: () => onTabChange('ai_tasks'), "aria-current": currentTab === 'ai_tasks' || currentTab === 'ai_approvals' ? 'page' : undefined, className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${currentTab === 'ai_tasks' || currentTab === 'ai_approvals' ? 'bg-cyan-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: [_jsx(ListTodo, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u5171\u901A\u30BF\u30B9\u30AF" }), pendingApprovalsCount > 0 && _jsx("span", { className: "rounded bg-amber-500 px-1 text-[10px] font-bold text-slate-950", children: pendingApprovalsCount })] })] })), activeSection === 'ai_president' && (_jsxs("div", { className: "flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1", children: [_jsx("button", { onClick: () => onTabChange('ai_dashboard'), className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'ai_dashboard'
                                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: "\uD83D\uDCCA AI\u793E\u9577\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" }), _jsx("button", { onClick: () => onTabChange('ai_chat'), className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'ai_chat'
                                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: "\uD83D\uDCAC \u6307\u793A\u30FB\u30C1\u30E3\u30C3\u30C8\u5BFE\u8A71" }), _jsx("button", { onClick: () => onTabChange('ai_knowledge'), className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'ai_knowledge'
                                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: "\uD83D\uDCDA \u30CA\u30EC\u30C3\u30B8\u30FB\u6210\u679C\u7269" }), _jsxs("button", { onClick: () => onTabChange('ai_presets'), className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'ai_presets'
                                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: [_jsx(Bot, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u5C02\u9580AI\u4E00\u89A7" })] }), _jsxs("button", { onClick: () => onTabChange('automations'), className: `px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${currentTab === 'automations' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`, children: [_jsx(Zap, { className: "w-3.5 h-3.5 text-amber-400" }), _jsx("span", { children: "AI\u81EA\u52D5\u5316\u30FB\u627F\u8A8D\u30EB\u30FC\u30EB" })] })] }))] })] }) }));
};
