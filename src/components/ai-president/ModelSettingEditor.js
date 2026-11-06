import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AI_PROVIDERS, AI_PROVIDER_IDS, MAX_FALLBACKS, sanitizeTarget, } from '../../data/aiModels';
/** サーバーのAPIキー設定状況を取得する（キー自体は返ってこない）。 */
export function useProviderStatus() {
    const [providers, setProviders] = useState(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let cancelled = false;
        fetch('/api/ai-providers')
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then((data) => !cancelled && setProviders(data.providers))
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
        };
    }, []);
    return { providers, failed };
}
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs';
const TargetRow = ({ label, target, statuses, onChange, onRemove }) => {
    const listId = useId();
    const configured = statuses?.find((s) => s.id === target.provider)?.configured;
    const invalid = sanitizeTarget(target) === null;
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-[11px] font-semibold text-slate-700", children: [_jsx("span", { children: label }), onRemove && (_jsx("button", { type: "button", onClick: onRemove, "aria-label": `${label}を削除`, className: "text-slate-400 hover:text-rose-600 transition-colors cursor-pointer", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) }))] }), _jsxs("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-[170px_1fr]", children: [_jsx("select", { value: target.provider, onChange: (e) => {
                            const provider = e.target.value;
                            onChange({ provider, model: AI_PROVIDERS[provider].suggestedModels[0] });
                        }, className: inputClass, children: AI_PROVIDER_IDS.map((id) => (_jsx("option", { value: id, children: AI_PROVIDERS[id].label }, id))) }), _jsxs("div", { children: [_jsx("input", { list: listId, value: target.model, onChange: (e) => onChange({ ...target, model: e.target.value }), placeholder: "\u30E2\u30C7\u30EB\u540D", "aria-invalid": invalid, className: `${inputClass} ${invalid ? 'border-rose-500' : ''}` }), _jsx("datalist", { id: listId, children: AI_PROVIDERS[target.provider].suggestedModels.map((model) => (_jsx("option", { value: model }, model))) })] })] }), invalid && _jsx("p", { className: "text-[11px] text-rose-600", children: "\u30E2\u30C7\u30EB\u540D\u306F\u534A\u89D2\u306E\u82F1\u6570\u5B57\u3068 . _ : / - \u306E\u307F\u4F7F\u3048\u307E\u3059\u3002" }), configured === false && (_jsxs("p", { className: "text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200", children: ["\u30B5\u30FC\u30D0\u30FC\u306B ", AI_PROVIDERS[target.provider].envKey, " \u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u306A\u3044\u305F\u3081\u3001\u3053\u306E\u30E2\u30C7\u30EB\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002"] }))] }));
};
export const ModelSettingEditor = ({ value, onChange, statuses }) => (_jsxs("div", { className: "space-y-3", children: [_jsx(TargetRow, { label: "\u4F7F\u7528\u3059\u308B\u30E2\u30C7\u30EB", target: value.primary, statuses: statuses, onChange: (primary) => onChange({ ...value, primary }) }), value.fallbacks.map((fallback, index) => (_jsx(TargetRow, { label: `切り替え先 ${index + 1}（上のモデルが失敗したとき）`, target: fallback, statuses: statuses, onChange: (next) => onChange({ ...value, fallbacks: value.fallbacks.map((f, i) => (i === index ? next : f)) }), onRemove: () => onChange({ ...value, fallbacks: value.fallbacks.filter((_, i) => i !== index) }) }, index))), value.fallbacks.length < MAX_FALLBACKS && (_jsxs("button", { type: "button", onClick: () => onChange({ ...value, fallbacks: [...value.fallbacks, { provider: 'groq', model: AI_PROVIDERS.groq.suggestedModels[0] }] }), className: "inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " \u5207\u308A\u66FF\u3048\u5148\u3092\u8FFD\u52A0"] })), _jsx("p", { className: "text-[11px] leading-5 text-slate-500", children: "\u4E0A\u9650\u5230\u9054\u30FB\u30A8\u30E9\u30FC\u30FB\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u306A\u3069\u3067\u5FDC\u7B54\u304C\u59CB\u307E\u3089\u306A\u304B\u3063\u305F\u3068\u304D\u3060\u3051\u3001\u4E0A\u304B\u3089\u9806\u306B\u6B21\u306E\u30E2\u30C7\u30EB\u3078\u5207\u308A\u66FF\u3048\u307E\u3059\u3002\u4F1A\u8A71\u5C65\u6B74\u3068\u6307\u793A\u6587\u306F\u305D\u306E\u307E\u307E\u5F15\u304D\u7D99\u304C\u308C\u307E\u3059\u3002" })] }));
