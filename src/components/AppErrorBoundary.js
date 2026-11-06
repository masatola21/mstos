import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
export class AppErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error('Application render error', error, info.componentStack);
    }
    render() {
        if (this.state.error) {
            return (_jsx("main", { className: "min-h-screen bg-slate-950 px-6 py-16 text-slate-100", children: _jsxs("section", { role: "alert", className: "mx-auto max-w-xl rounded-2xl border border-rose-800/70 bg-slate-900 p-6 shadow-xl", children: [_jsx("h1", { className: "text-xl font-bold", children: "\u753B\u9762\u306E\u8868\u793A\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F" }), _jsx("p", { className: "mt-2 text-sm text-slate-300", children: "\u30A2\u30D7\u30EA\u5168\u4F53\u304C\u771F\u3063\u767D\u306B\u306A\u3089\u306A\u3044\u3088\u3046\u3001\u8868\u793A\u3092\u505C\u6B62\u3057\u307E\u3057\u305F\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u3082\u7D9A\u304F\u5834\u5408\u306F\u3001\u4E0B\u306E\u30A8\u30E9\u30FC\u5185\u5BB9\u3092\u30B5\u30DD\u30FC\u30C8\u3078\u5171\u6709\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), _jsx("pre", { className: "mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-rose-200", children: this.state.error.message }), _jsx("button", { type: "button", onClick: () => window.location.reload(), className: "mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500", children: "\u518D\u8AAD\u307F\u8FBC\u307F" })] }) }));
        }
        return this.props.children;
    }
}
