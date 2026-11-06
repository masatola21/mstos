import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Menu, Search, Calendar, Bell, LogOut, User, CheckCircle2, AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
export const AppHeader = ({ currentTab, onSelectTab, onOpenMobileSidebar, pendingApprovalsCount, workspaceSyncStatus, workspaceSaveError, onOpenQuickAiDrawer, pageAssistantEmoji, onOpenProfile, }) => {
    const { user, signOut } = useAuth();
    // Breadcrumb mapping
    const getBreadcrumbs = () => {
        switch (currentTab) {
            case 'mst_dashboard':
            case 'inflow_dashboard':
                return { category: '経営全般', page: 'ダッシュボード' };
            case 'ai_acquisition':
                return { category: '集客・営業開拓', page: '集客戦略・SNS・メディア' };
            case 'marketing_automation':
                return { category: '集客・営業開拓', page: 'LINE・メール自動配信（営業メール5段階 & シナリオ）' };
            case 'mst_diagnoses':
                return { category: '集客・営業開拓', page: '受付フォーム・診断設計（反響獲得・フック）' };
            case 'prospects':
                return { category: '集客・営業開拓', page: '見込み企業（AI検索・開拓）' };
            case 'contacts':
                return { category: '集客・営業開拓', page: '見込み企業・友だちリスト（AI調査 & LINE）' };
            case 'leads':
                return { category: '営業・顧客管理', page: '反響リード管理' };
            case 'deals':
                return { category: '営業・顧客管理', page: '商談パイプライン' };
            case 'companies':
                return { category: '営業・顧客管理', page: '会社台帳（法人マスタ）' };
            case 'customers':
                return { category: '営業・顧客管理', page: '契約顧客台帳' };
            case 'custom_lists':
                return { category: '営業・顧客管理', page: '配信対象セグメント' };
            case 'document_templates':
                return { category: '営業・顧客管理', page: '重要書類・見積・契約（見積書・契約書作成）' };
            case 'customer_operations':
                return { category: '営業・顧客管理', page: '契約・請求・顧問支援（月次請求・支援進捗）' };
            case 'products':
                return { category: '営業・顧客管理', page: '販売商品・料金台帳（見積・請求用）' };
            case 'inbox_hub':
                return { category: 'デイリー業務', page: '統合受信トレイ' };
            case 'communication_send':
            case 'deal_invitations':
            case 'customer_meeting_invitations':
                return { category: 'デイリー業務', page: '送信センター' };
            case 'unified_calendar':
                return { category: 'デイリー業務', page: '予定カレンダー（Google同期・全社日程）' };
            case 'product_hub':
                return { category: 'AI経営室', page: '新規商品企画・プロジェクト開発（AI共創）' };
            case 'category_hub':
                return { category: 'AI経営室', page: '事業マトリクス' };
            case 'ai_chat':
                return { category: 'AI経営室', page: 'AI社長室・対話' };
            case 'ai_tasks':
                return { category: 'AI経営室', page: '共通タスク・承認' };
            case 'ai_projects':
                return { category: 'AI経営室', page: 'プロジェクト管理' };
            case 'ai_knowledge':
                return { category: 'AI経営室', page: 'ナレッジ・成果物保管庫' };
            case 'ai_presets':
                return { category: 'AI経営室', page: '専門AI・役割一覧' };
            case 'automations':
                return { category: 'AI経営室', page: 'AI自動化・承認ルール' };
            default:
                return { category: 'MST AI経営OS', page: String(currentTab) };
        }
    };
    const breadcrumbs = getBreadcrumbs();
    return (_jsxs("header", { className: "sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("button", { type: "button", onClick: onOpenMobileSidebar, className: "p-1.5 -ml-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden cursor-pointer", "aria-label": "\u30E1\u30CB\u30E5\u30FC\u3092\u958B\u304F", children: _jsx(Menu, { className: "w-5 h-5" }) }), _jsxs("div", { className: "flex items-center gap-1.5 text-xs text-slate-500 truncate", children: [_jsx("span", { className: "font-medium text-slate-400 hidden sm:inline", children: breadcrumbs.category }), _jsx("span", { className: "text-slate-300 hidden sm:inline", children: "/" }), _jsx("span", { className: "font-semibold text-slate-800 text-sm truncate", children: breadcrumbs.page })] })] }), _jsx("div", { className: "hidden md:flex items-center flex-1 max-w-md mx-6", children: _jsxs("div", { className: "relative w-full", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" }), _jsx("input", { type: "text", readOnly: true, onClick: () => onSelectTab('mst_dashboard'), placeholder: "\u5168\u4F53\u691C\u7D22\u30FB\u79FB\u52D5\uFF08\u9867\u5BA2\u3001\u5546\u8AC7\u3001\u66F8\u985E\u3001\u30BF\u30B9\u30AF...\uFF09", className: "w-full pl-9 pr-12 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 hover:bg-white focus:bg-white focus:border-purple-500 transition-colors cursor-pointer" }), _jsx("kbd", { className: "absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs", children: "\u2318K" })] }) }), _jsxs("div", { className: "flex items-center gap-2 sm:gap-3 shrink-0", children: [_jsxs("button", { type: "button", onClick: () => onSelectTab('inbox_hub'), className: `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${currentTab === 'inbox_hub'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, title: "\u5168\u30C1\u30E3\u30CD\u30EB\u306E\u672A\u5BFE\u5FDC\u30E1\u30C3\u30BB\u30FC\u30B8\u30FB\u53CD\u97FF\u3092\u78BA\u8A8D", children: [_jsx(Inbox, { className: "w-3.5 h-3.5 text-purple-600" }), _jsx("span", { className: "hidden sm:inline", children: "\u53D7\u4FE1\u30C8\u30EC\u30A4" })] }), _jsxs("button", { type: "button", onClick: () => onSelectTab('unified_calendar'), className: `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${currentTab === 'unified_calendar'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, title: "\u5546\u8AC7\u30FB\u9762\u8AC7\u30FB\u30BF\u30B9\u30AF\u30FB\u8ACB\u6C42\u671F\u65E5\u3092\u5168\u793E\u30AB\u30EC\u30F3\u30C0\u30FC\u3067\u78BA\u8A8D", children: [_jsx(Calendar, { className: "w-3.5 h-3.5 text-indigo-500" }), _jsx("span", { className: "hidden sm:inline", children: "\u4E88\u5B9A\u30AB\u30EC\u30F3\u30C0\u30FC" })] }), _jsxs("div", { className: "hidden sm:flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-50 border border-slate-200", children: [workspaceSyncStatus === 'loading' && (_jsxs("span", { className: "flex items-center gap-1 text-slate-500", children: [_jsx(RefreshCw, { className: "w-3 h-3 animate-spin text-slate-400" }), _jsx("span", { children: "\u540C\u671F\u4E2D" })] })), workspaceSyncStatus === 'saving' && (_jsxs("span", { className: "flex items-center gap-1 text-amber-600", children: [_jsx(RefreshCw, { className: "w-3 h-3 animate-spin text-amber-500" }), _jsx("span", { children: "\u4FDD\u5B58\u4E2D" })] })), workspaceSyncStatus === 'saved' && (_jsxs("span", { className: "flex items-center gap-1 text-emerald-600", children: [_jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-500" }), _jsx("span", { children: "\u540C\u671F\u6E08" })] })), (workspaceSyncStatus === 'error' || workspaceSyncStatus === 'conflict') && (_jsxs("span", { className: "flex items-center gap-1 text-rose-600", title: workspaceSaveError, children: [_jsx(AlertCircle, { className: "w-3 h-3 text-rose-500" }), _jsx("span", { children: "\u540C\u671F\u30A8\u30E9\u30FC" })] }))] }), pendingApprovalsCount > 0 && (_jsxs("button", { type: "button", onClick: () => onSelectTab('ai_tasks'), className: "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer", title: `承認待ちタスクが ${pendingApprovalsCount} 件あります`, children: [_jsx(Bell, { className: "w-3.5 h-3.5 text-amber-600 animate-bounce" }), _jsxs("span", { children: ["\u627F\u8A8D\u5F85\u3061 ", pendingApprovalsCount] })] })), _jsxs("button", { type: "button", onClick: onOpenQuickAiDrawer, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer", title: "\u3053\u306E\u753B\u9762\u306B\u3064\u3044\u3066AI\u306B\u76F8\u8AC7\u30FB\u30BF\u30B9\u30AF\u4F9D\u983C", children: [_jsx("span", { className: "text-sm", children: pageAssistantEmoji }), _jsx("span", { className: "hidden md:inline", children: "AI\u306B\u76F8\u8AC7" })] }), _jsxs("div", { className: "flex items-center gap-1 pl-1 border-l border-slate-200", children: [_jsx("button", { type: "button", onClick: onOpenProfile, className: "p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer", title: "\u30AA\u30FC\u30CA\u30FC\u4F01\u696D\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB", children: _jsx(User, { className: "w-4 h-4 text-purple-600" }) }), user && (_jsx("button", { type: "button", onClick: signOut, className: "p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer", title: "\u30ED\u30B0\u30A2\u30A6\u30C8", children: _jsx(LogOut, { className: "w-4 h-4" }) }))] })] })] }));
};
