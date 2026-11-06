import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export const InlineDeleteButton = ({ onConfirm, onSecondaryConfirm, secondaryConfirmLabel, children, warning = '削除しますか？', confirmLabel = '削除を確定', className = 'rounded border border-rose-800 px-2 py-1 text-xs text-rose-300', confirmClassName = 'rounded bg-rose-700 px-2 py-1 text-xs font-semibold text-white', cancelClassName = 'rounded border border-slate-700 px-2 py-1 text-xs text-slate-300', disabled = false, ariaLabel = '削除', }) => {
    const [confirming, setConfirming] = useState(false);
    const [pending, setPending] = useState(false);
    const confirm = async (event) => {
        event.stopPropagation();
        setPending(true);
        try {
            await onConfirm();
        }
        finally {
            setPending(false);
            setConfirming(false);
        }
    };
    if (!confirming) {
        return (_jsx("button", { type: "button", disabled: disabled || pending, "aria-label": ariaLabel, onClick: (event) => { event.stopPropagation(); setConfirming(true); }, className: className, children: children }));
    }
    return (_jsxs("span", { className: "inline-flex flex-wrap items-center gap-2", role: "group", "aria-label": ariaLabel, children: [_jsx("span", { className: "text-xs text-amber-200", children: warning }), _jsx("button", { type: "button", disabled: disabled || pending, onClick: (event) => void confirm(event), className: confirmClassName, children: pending ? '削除中…' : confirmLabel }), onSecondaryConfirm && secondaryConfirmLabel && _jsx("button", { type: "button", disabled: disabled || pending, onClick: async (event) => { event.stopPropagation(); setPending(true); try {
                    await onSecondaryConfirm();
                }
                finally {
                    setPending(false);
                    setConfirming(false);
                } }, className: confirmClassName, children: pending ? '削除中…' : secondaryConfirmLabel }), _jsx("button", { type: "button", disabled: pending, onClick: (event) => { event.stopPropagation(); setConfirming(false); }, className: cancelClassName, children: "\u30AD\u30E3\u30F3\u30BB\u30EB" })] }));
};
