import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { ModalShell } from '../ModalShell';
import { ModelSettingEditor } from './ModelSettingEditor';
import { sanitizeModelSetting } from '../../data/aiModels';
import { sanitizeRoleOverride } from '../../data/aiWorkModes';
const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs';
const labelClass = 'block text-xs font-semibold text-slate-700';
export const RoleAIEditor = ({ mode, override, defaultSetting, statuses, onSave, onReset, onClose, }) => {
    const [name, setName] = useState(override.name ?? '');
    const [emoji, setEmoji] = useState(override.avatarEmoji ?? '');
    const [description, setDescription] = useState(override.description ?? '');
    const [tone, setTone] = useState(override.tone ?? '');
    const [responseLength, setResponseLength] = useState(override.responseLength ?? '');
    const [rules, setRules] = useState((override.behaviorRules ?? []).join('\n'));
    const [extra, setExtra] = useState(override.extraInstruction ?? '');
    const [useCustomModel, setUseCustomModel] = useState(Boolean(override.modelSetting));
    const [modelSetting, setModelSetting] = useState(override.modelSetting ?? defaultSetting);
    const [error, setError] = useState('');
    const handleSave = () => {
        if (useCustomModel && !sanitizeModelSetting(modelSetting)) {
            setError('モデル名が正しくありません。半角の英数字と . _ : / - のみ使えます。');
            return;
        }
        const cleaned = sanitizeRoleOverride({
            name,
            avatarEmoji: emoji,
            description,
            tone,
            responseLength: responseLength || undefined,
            behaviorRules: rules.split('\n'),
            extraInstruction: extra,
            modelSetting: useCustomModel ? modelSetting : undefined,
        });
        onSave(cleaned);
    };
    return (_jsx(ModalShell, { title: `${mode.label}の詳細設定`, onClose: onClose, maxWidthClass: "max-w-3xl", children: _jsxs("div", { className: "space-y-5 p-5 sm:p-6 text-slate-900", children: [_jsxs("div", { className: "pr-10", children: [_jsxs("h2", { className: "text-lg font-extrabold text-slate-900", children: [(emoji || mode.avatarEmoji), " ", (name || mode.name), "\uFF5C", mode.label] }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "\u540D\u524D\u30FB\u53E3\u8ABF\u30FB\u8FFD\u52A0\u6307\u793A\u30FB\u4F7F\u3046\u30E2\u30C7\u30EB\u3092\u5909\u66F4\u3067\u304D\u307E\u3059\u3002\u7A7A\u6B04\u306E\u9805\u76EE\u306F\u6A19\u6E96\u8A2D\u5B9A\u306E\u307E\u307E\u3067\u3059\u3002" })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]", children: [_jsxs("label", { className: labelClass, children: ["\u540D\u524D\uFF08\u6A19\u6E96: ", mode.name, "\uFF09", _jsx("input", { value: name, maxLength: 30, onChange: (e) => setName(e.target.value), className: fieldClass })] }), _jsxs("label", { className: labelClass, children: ["\u7D75\u6587\u5B57\uFF08\u6A19\u6E96: ", mode.avatarEmoji, "\uFF09", _jsx("input", { value: emoji, maxLength: 8, onChange: (e) => setEmoji(e.target.value), className: fieldClass })] })] }), _jsxs("label", { className: labelClass, children: ["\u62C5\u5F53\u306E\u8AAC\u660E", _jsx("input", { value: description, maxLength: 200, onChange: (e) => setDescription(e.target.value), placeholder: mode.description, className: fieldClass })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("label", { className: labelClass, children: ["\u53E3\u8ABF", _jsx("input", { value: tone, maxLength: 200, onChange: (e) => setTone(e.target.value), placeholder: "\u4F8B: \u7C21\u6F54\u3067\u7D50\u8AD6\u304B\u3089\u8A71\u3059", className: fieldClass })] }), _jsxs("label", { className: labelClass, children: ["\u56DE\u7B54\u306E\u9577\u3055", _jsxs("select", { value: responseLength, onChange: (e) => setResponseLength(e.target.value), className: fieldClass, children: [_jsx("option", { value: "", children: "\u6A19\u6E96" }), _jsx("option", { value: "short", children: "\u77ED\u3081" }), _jsx("option", { value: "medium", children: "\u3075\u3064\u3046" }), _jsx("option", { value: "detailed", children: "\u8A73\u3057\u304F" })] })] })] }), _jsxs("label", { className: labelClass, children: ["\u884C\u52D5\u30EB\u30FC\u30EB\uFF081\u884C\u306B1\u3064\u3001\u6700\u592710\u500B\uFF09", _jsx("textarea", { value: rules, rows: 4, onChange: (e) => setRules(e.target.value), placeholder: '例:\n結論を最初に書く\n不明点は推測せず質問する', className: fieldClass })] }), _jsxs("label", { className: labelClass, children: ["\u8FFD\u52A0\u6307\u793A\uFF08\u6A19\u6E96\u306E\u5F79\u5272\u6307\u793A\u306B\u52A0\u3048\u3066\u9069\u7528\u3055\u308C\u307E\u3059\uFF09", _jsx("textarea", { value: extra, rows: 5, maxLength: 4000, onChange: (e) => setExtra(e.target.value), placeholder: "\u4F8B: \u5F53\u793E\u306F\u4E2D\u5C0F\u4F01\u696D\u5411\u3051\u306E\u7D4C\u55B6\u652F\u63F4\u30B5\u30FC\u30D3\u30B9\u3067\u3059\u3002\u63D0\u6848\u306F\u5FC5\u305A3\u6848\u306B\u7D5E\u3063\u3066\u304F\u3060\u3055\u3044\u3002", className: fieldClass })] }), _jsxs("details", { className: "rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600", children: [_jsx("summary", { className: "cursor-pointer font-semibold text-slate-700", children: "\u6A19\u6E96\u306E\u5F79\u5272\u6307\u793A\u3092\u78BA\u8A8D\u3059\u308B\uFF08\u5909\u66F4\u4E0D\u53EF\uFF09" }), _jsx("p", { className: "mt-2 leading-5", children: mode.systemInstruction })] }), _jsxs("section", { className: "space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4", children: [_jsx("h3", { className: "text-sm font-bold text-slate-900", children: "\u3053\u306E\u5F79\u5272\u304C\u4F7F\u3046AI\u30E2\u30C7\u30EB" }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-700", children: [_jsx("input", { type: "checkbox", checked: !useCustomModel, onChange: (e) => setUseCustomModel(!e.target.checked) }), "\u5168\u4F53\u306E\u30C7\u30D5\u30A9\u30EB\u30C8\u8A2D\u5B9A\u3092\u4F7F\u3046\uFF08\u73FE\u5728: ", defaultSetting.primary.model, "\uFF09"] }), useCustomModel && _jsx(ModelSettingEditor, { value: modelSetting, onChange: setModelSetting, statuses: statuses })] }), error && _jsx("p", { className: "rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700", children: error }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200", children: [_jsxs("button", { type: "button", onClick: () => {
                                if (window.confirm('この役割の設定をすべて標準に戻しますか？'))
                                    onReset();
                            }, className: "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer", children: [_jsx(RotateCcw, { className: "h-3.5 w-3.5" }), " \u6A19\u6E96\u306B\u623B\u3059"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsxs("button", { type: "button", onClick: handleSave, className: "inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-xs transition-colors cursor-pointer", children: [_jsx(Save, { className: "h-3.5 w-3.5" }), " \u4FDD\u5B58"] })] })] })] }) }));
};
