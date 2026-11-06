import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Download, Upload, Copy, Check, RotateCcw, X, Database } from 'lucide-react';
import { PRESET_CHARACTERS } from '../../data/presets';
import { DEFAULT_USER_PROFILE, DEFAULT_TOP_GOAL, DEFAULT_PRICING_RATES, } from '../../utils/storage';
export const BackupModal = ({ isOpen, onClose, characters, userProfile, projects, tasks, approvals, activityLogs, topGoal, pricingRates, tokenUsageRecords, knowledgeItems, workModeHistories, marketingScenarios, onRestoreData, }) => {
    const [copied, setCopied] = useState(false);
    const [importText, setImportText] = useState('');
    const [importStatus, setImportStatus] = useState(null);
    if (!isOpen)
        return null;
    const currentExportJson = JSON.stringify({
        version: '2.2',
        exportedAt: new Date().toISOString(),
        topGoal,
        projects,
        tasks,
        approvals,
        activityLogs,
        pricingRates,
        tokenUsage: tokenUsageRecords,
        knowledgeItems,
        workModeHistories,
        marketingScenarios,
        characters,
        userProfile,
    }, null, 2);
    const handleCopyJson = () => {
        navigator.clipboard.writeText(currentExportJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const handleDownloadFile = () => {
        const blob = new Blob([currentExportJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-president-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleImport = () => {
        try {
            const parsed = JSON.parse(importText);
            // Backward compatible restoration
            const restoredChars = Array.isArray(parsed.characters) && parsed.characters.length > 0
                ? parsed.characters
                : characters;
            const restoredProfile = parsed.userProfile || DEFAULT_USER_PROFILE;
            const restoredProjects = Array.isArray(parsed.projects) ? parsed.projects : projects;
            const restoredTasks = Array.isArray(parsed.tasks) ? parsed.tasks : tasks;
            const restoredApprovals = Array.isArray(parsed.approvals) ? parsed.approvals : approvals;
            const restoredLogs = Array.isArray(parsed.activityLogs) ? parsed.activityLogs : activityLogs;
            const restoredGoal = parsed.topGoal || topGoal || DEFAULT_TOP_GOAL;
            const restoredPricing = Array.isArray(parsed.pricingRates) ? parsed.pricingRates : pricingRates;
            const restoredKnowledge = Array.isArray(parsed.knowledgeItems) ? parsed.knowledgeItems : knowledgeItems;
            const restoredHistories = parsed.workModeHistories && typeof parsed.workModeHistories === 'object' ? parsed.workModeHistories : workModeHistories;
            const restoredMarketingScenarios = Array.isArray(parsed.marketingScenarios) ? parsed.marketingScenarios : marketingScenarios;
            const restoredUsage = Array.isArray(parsed.tokenUsage)
                ? parsed.tokenUsage
                : Array.isArray(parsed.tokenUsageRecords)
                    ? parsed.tokenUsageRecords
                    : tokenUsageRecords;
            onRestoreData({
                characters: restoredChars,
                userProfile: restoredProfile,
                projects: restoredProjects,
                tasks: restoredTasks,
                approvals: restoredApprovals,
                activityLogs: restoredLogs,
                topGoal: restoredGoal,
                pricingRates: restoredPricing,
                tokenUsageRecords: restoredUsage,
                knowledgeItems: restoredKnowledge,
                workModeHistories: restoredHistories,
                marketingScenarios: restoredMarketingScenarios,
            });
            setImportStatus('✅ データのインポートと復元に成功しました！');
            setTimeout(() => {
                setImportStatus(null);
                onClose();
            }, 1500);
        }
        catch (err) {
            setImportStatus(`❌ エラー: ${err.message || '無効なJSONフォーマットです'}`);
        }
    };
    const handleResetToDefaults = () => {
        if (window.confirm('初期状態にリセットしますか？作成したプロジェクトやタスク、カスタマイズ内容は失われます。')) {
            onRestoreData({
                characters: PRESET_CHARACTERS,
                userProfile: DEFAULT_USER_PROFILE,
                projects: [],
                tasks: [],
                approvals: [],
                activityLogs: [],
                topGoal: DEFAULT_TOP_GOAL,
                pricingRates: DEFAULT_PRICING_RATES,
                tokenUsageRecords: [],
                knowledgeItems: [],
                workModeHistories: {},
                marketingScenarios: [],
            });
            onClose();
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in", children: _jsxs("div", { className: "w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5 text-slate-900", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-900 font-bold text-base", children: [_jsx(Database, { className: "w-5 h-5 text-purple-600" }), _jsx("span", { children: "\u5168\u30C7\u30FC\u30BF\u7BA1\u7406\u30FB\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7 & \u30A4\u30F3\u30DD\u30FC\u30C8" })] }), _jsx("button", { type: "button", onClick: onClose, className: "text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-xs font-bold text-purple-700 uppercase tracking-wider", children: "1. \u5168\u30C7\u30FC\u30BF\uFF08\u76EE\u6A19\u30FBPJ\u30FB\u30BF\u30B9\u30AF\u30FB\u627F\u8A8D\u5C65\u6B74\u30FB\u5358\u4FA1\u30FB\u5229\u7528\u91CF\u30FBAI\u8A2D\u5B9A\uFF09\u306E\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { type: "button", onClick: handleDownloadFile, className: "flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs", children: [_jsx(Download, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "JSON\u30D5\u30A1\u30A4\u30EB\u4FDD\u5B58" })] }), _jsxs("button", { type: "button", onClick: handleCopyJson, className: "flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shadow-2xs", children: [copied ? _jsx(Check, { className: "w-3.5 h-3.5 text-emerald-600" }) : _jsx(Copy, { className: "w-3.5 h-3.5" }), _jsx("span", { children: copied ? 'コピー完了' : 'JSON文字列をコピー' })] })] })] }), _jsxs("div", { className: "space-y-2 pt-2 border-t border-slate-200", children: [_jsx("label", { className: "block text-xs font-bold text-purple-700 uppercase tracking-wider", children: "2. JSON\u304B\u3089\u5FA9\u5143\u30FB\u30A4\u30F3\u30DD\u30FC\u30C8 (\u65E7\u5F62\u5F0F\u4E92\u63DB\u5BFE\u5FDC)" }), _jsx("textarea", { rows: 4, value: importText, onChange: (e) => setImportText(e.target.value), placeholder: "\u3053\u3053\u306B\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8\u3057\u305FJSON\u3092\u8CBC\u308A\u4ED8\u3051\u3066\u304F\u3060\u3055\u3044...", className: "w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500 shadow-2xs" }), importStatus && (_jsx("div", { className: "text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800", children: importStatus })), _jsxs("button", { type: "button", onClick: handleImport, disabled: !importText.trim(), className: "w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs", children: [_jsx(Upload, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u30A4\u30F3\u30DD\u30FC\u30C8\u3092\u5B9F\u884C" })] })] }), _jsxs("div", { className: "pt-2 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500", children: [_jsx("span", { children: "\u521D\u671F\u72B6\u614B\u306B\u623B\u3057\u305F\u3044\u5834\u5408:" }), _jsxs("button", { type: "button", onClick: handleResetToDefaults, className: "text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer", children: [_jsx(RotateCcw, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u521D\u671F\u72B6\u614B\u306B\u30EA\u30BB\u30C3\u30C8" })] })] })] }) }));
};
