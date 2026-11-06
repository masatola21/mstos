import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
/** 子コンポーネントの描画エラーで画面全体が真っ白になるのを防ぐ。 */
class ModalErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error) {
        console.error('Modal render error:', error);
    }
    render() {
        if (!this.state.error)
            return this.props.children;
        return (_jsxs("div", { className: "p-6 space-y-3 text-sm text-slate-800", children: [_jsx("p", { className: "font-bold text-rose-600", children: "\u3053\u306E\u753B\u9762\u306E\u8868\u793A\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F\u3002" }), _jsx("p", { className: "text-xs text-slate-500 break-words", children: this.state.error.message }), _jsx("button", { type: "button", onClick: this.props.onClose, className: "rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-xs cursor-pointer", children: "\u9589\u3058\u308B" })] }));
    }
}
export const ModalShell = ({ title, onClose, children, maxWidthClass = 'max-w-5xl' }) => {
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-xs sm:p-6", onMouseDown: (event) => {
            if (event.target === event.currentTarget)
                onClose();
        }, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": title, className: `relative w-full ${maxWidthClass} rounded-2xl border border-slate-200 bg-white shadow-2xl text-slate-900`, children: [_jsx("button", { type: "button", onClick: onClose, "aria-label": "\u9589\u3058\u308B", className: "absolute right-3 top-3 z-10 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer", children: _jsx(X, { className: "h-4 w-4" }) }), _jsx(ModalErrorBoundary, { onClose: onClose, children: children })] }) }));
};
