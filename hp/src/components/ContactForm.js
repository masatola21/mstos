import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { submitIntakeToCRM, OFFICIAL_TIMEREX_BOOKING_URL } from '../lib/supabase';
const SERVICE_MAP = {
    strategy: '経営戦略・業務効率化設計・伴走顧問',
    'it-dx': '業務自動化・IT・DX・AI活用',
    system: 'システム構築・社内ツール・導線実装',
    marketing: '集客導線・成約Web基盤・LINE連携',
    'new-business': '新規事業立ち上げ・収益化支援',
    'care-package': '介護保険外サービス開業パッケージ',
};
export default function ContactForm() {
    const [formData, setFormData] = useState({
        company_name: '',
        name: '',
        email: '',
        phone: '',
        service_interest: '経営戦略・業務効率化設計・伴走顧問',
        message: '',
    });
    const [source, setSource] = useState('corporate_website');
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const serviceParam = params.get('service');
            if (serviceParam && SERVICE_MAP[serviceParam]) {
                setFormData((prev) => ({
                    ...prev,
                    service_interest: SERVICE_MAP[serviceParam],
                }));
            }
            const sourceParam = params.get('source');
            if (sourceParam) {
                setSource(sourceParam);
            }
        }
    }, []);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [bookingUrl, setBookingUrl] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await submitIntakeToCRM({
                slug: 'contact-inquiry',
                name: formData.name,
                companyName: formData.company_name,
                email: formData.email,
                phone: formData.phone,
                inquiryType: 'consultation',
                source: source,
                notes: `【ご関心のあるテーマ】${formData.service_interest}\n【ご相談内容】${formData.message}`,
                customFields: {
                    service_interest: formData.service_interest,
                },
            });
            if (res.success) {
                let targetBookingUrl = res.bookingUrl || OFFICIAL_TIMEREX_BOOKING_URL;
                if (targetBookingUrl.includes('timerex') || targetBookingUrl.includes('booking') || targetBookingUrl.includes('calendar')) {
                    const delim = targetBookingUrl.includes('?') ? '&' : '?';
                    targetBookingUrl += `${delim}name=${encodeURIComponent(formData.name)}&email=${encodeURIComponent(formData.email)}`;
                }
                setBookingUrl(targetBookingUrl);
                setSubmitted(true);
            }
            else {
                setErrorMsg('送信に失敗しました。時間をおいて再度お試しください。');
            }
        }
        catch (err) {
            setErrorMsg('エラーが発生しました。通信環境をご確認ください。');
        }
        finally {
            setLoading(false);
        }
    };
    if (submitted) {
        return (_jsxs("div", { className: "bg-white p-8 sm:p-12 rounded-2xl border border-sand-300 shadow-xl space-y-8 animate-fadeIn", children: [_jsxs("div", { className: "text-center space-y-3", children: [_jsx("div", { className: "w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm", children: _jsx("svg", { className: "w-8 h-8", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin="round", strokeWidth: 2.5, d: "M5 13l4 4L19 7" }) }) }), _jsx("span", { className: "text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wider", children: "\u53D7\u4ED8\u5B8C\u4E86" }), _jsx("h3", { className: "text-2xl sm:text-3xl font-bold font-serif text-slate-900", children: "\u304A\u554F\u3044\u5408\u308F\u305B\u3092\u53D7\u3051\u4ED8\u3051\u307E\u3057\u305F" }), _jsxs("p", { className: "text-xs sm:text-sm text-gray-600 max-w-lg mx-auto leading-relaxed", children: ["\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF08", _jsx("strong", { className: "text-slate-900", children: formData.email }), "\uFF09\u5B9B\u3066\u306B\u3001\u53D7\u4ED8\u78BA\u8A8D\u306E\u30B5\u30F3\u30AF\u30B9\u30E1\u30FC\u30EB\u3092\u304A\u9001\u308A\u3044\u305F\u3057\u307E\u3057\u305F\u3002\u901A\u5E381\u55B6\u696D\u65E5\u4EE5\u5185\u306B\u62C5\u5F53\u3088\u308A\u3054\u9023\u7D61\u3044\u305F\u3057\u307E\u3059\u3002"] })] }), _jsxs("div", { className: "bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-brand-800 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider", children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" }), "\u304A\u6025\u304E\u306E\u65B9\u30FB\u3059\u3050\u306B\u76F8\u8AC7\u3057\u305F\u3044\u65B9\u3078"] }), _jsx("h4", { className: "text-lg sm:text-xl font-bold text-white font-serif", children: "\u4EE3\u8868\u307E\u305F\u306F\u5C02\u4EFB\u30B3\u30F3\u30B5\u30EB\u30BF\u30F3\u30C8\u306B\u3088\u308B\u300C30\u5206\u30AA\u30F3\u30E9\u30A4\u30F3\u7121\u6599\u500B\u5225\u9762\u8AC7\u300D" }), _jsx("p", { className: "text-xs sm:text-sm text-slate-300 leading-relaxed font-light", children: "\u30E1\u30FC\u30EB\u306E\u3084\u308A\u53D6\u308A\u3092\u5F85\u305F\u305A\u306B\u3001\u3054\u90FD\u5408\u306E\u826F\u3044\u65E5\u6642\u3092\u30AB\u30EC\u30F3\u30C0\u30FC\u304B\u3089\u4ECA\u3059\u3050\u76F4\u63A5\u3054\u4E88\u7D04\u3044\u305F\u3060\u3051\u307E\u3059\u3002\u73FE\u72B6\u306E\u696D\u52D9\u306E\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u6574\u7406\u3084\u3001\u5177\u4F53\u7684\u306A\u9032\u3081\u65B9\u306B\u3064\u3044\u3066\u6C17\u8EFD\u306B\u304A\u8A71\u3057\u3044\u305F\u3060\u3051\u307E\u3059\uFF08Zoom\u5BFE\u5FDC\u30FB\u5B8C\u5168\u7121\u6599\uFF09\u3002" }), _jsxs("div", { className: "pt-2 flex flex-col sm:flex-row gap-3", children: [_jsxs("a", { href: bookingUrl, target: "_blank", rel: "noopener noreferrer", className: "flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm transition shadow-lg hover:shadow-xl hover:scale-[1.01]", children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin="round", strokeWidth: 2, d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }), "\u7121\u6599\u9762\u8AC7\u306E\u65E5\u7A0B\u3092\u4E88\u7D04\u3059\u308B\uFF08TimeRex\u30FB30\u5206\uFF09 \u2192"] }), _jsx("a", { href: "https://lin.ee/qWsuD6f", target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm border border-white/20 transition shadow", children: "LINE\u3067\u65E5\u7A0B\u8ABF\u6574\u3059\u308B" })] })] }), _jsx("div", { className: "text-center pt-2", children: _jsx("a", { href: "/", className: "text-xs font-bold text-brand-700 hover:text-brand-900 underline", children: "\u2190 \u30C8\u30C3\u30D7\u30DA\u30FC\u30B8\u3078\u623B\u308B" }) })] }));
    }
    return (_jsxs("form", { onSubmit: handleSubmit, className: "bg-white p-6 sm:p-10 rounded-2xl border border-sand-300 shadow-lg space-y-6", children: [_jsxs("div", { className: "border-b border-sand-200 pb-4", children: [_jsx("span", { className: "text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full uppercase tracking-wider border border-brand-200", children: "WEB\u30D5\u30A9\u30FC\u30E0\u76F8\u8AC7\u7A93\u53E3" }), _jsx("h2", { className: "text-xl sm:text-2xl font-bold font-serif text-slate-900 mt-2", children: "\u304A\u554F\u3044\u5408\u308F\u305B\u5185\u5BB9\u306E\u5165\u529B" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "\u5FC5\u8981\u4E8B\u9805\u3092\u3054\u5165\u529B\u306E\u4E0A\u3001\u9001\u4FE1\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u55B6\u696D\u30E1\u30FC\u30EB\u3084\u5F37\u5F15\u306A\u52E7\u8A98\u306F\u4E00\u5207\u884C\u3044\u307E\u305B\u3093\u3002" })] }), errorMsg && (_jsx("div", { className: "p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium", children: errorMsg })), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u3054\u95A2\u5FC3\u306E\u3042\u308B\u30C6\u30FC\u30DE\u30FB\u30B5\u30FC\u30D3\u30B9 ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsxs("select", { value: formData.service_interest, onChange: (e) => setFormData({ ...formData, service_interest: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm bg-sand-50/50 outline-none transition", children: [_jsx("option", { value: "\u7D4C\u55B6\u6226\u7565\u30FB\u696D\u52D9\u52B9\u7387\u5316\u8A2D\u8A08\u30FB\u4F34\u8D70\u9867\u554F", children: "\u7D4C\u55B6\u6226\u7565\u30FB\u696D\u52D9\u52B9\u7387\u5316\u8A2D\u8A08\u30FB\u4F34\u8D70\u9867\u554F" }), _jsx("option", { value: "\u696D\u52D9\u81EA\u52D5\u5316\u30FBIT\u30FBDX\u30FBAI\u6D3B\u7528", children: "\u696D\u52D9\u81EA\u52D5\u5316\u30FBIT\u30FBDX\u30FBAI\u6D3B\u7528" }), _jsx("option", { value: "\u30B7\u30B9\u30C6\u30E0\u69CB\u7BC9\u30FB\u793E\u5185\u30C4\u30FC\u30EB\u30FB\u5C0E\u7DDA\u5B9F\u88C5", children: "\u30B7\u30B9\u30C6\u30E0\u69CB\u7BC9\u30FB\u793E\u5185\u30C4\u30FC\u30EB\u30FB\u5C0E\u7DDA\u5B9F\u88C5" }), _jsx("option", { value: "\u96C6\u5BA2\u5C0E\u7DDA\u30FB\u6210\u7D04Web\u57FA\u76E4\u30FBLINE\u9023\u643A", children: "\u96C6\u5BA2\u5C0E\u7DDA\u30FB\u6210\u7D04Web\u57FA\u76E4\u30FBLINE\u9023\u643A" }), _jsx("option", { value: "\u65B0\u898F\u4E8B\u696D\u7ACB\u3061\u4E0A\u3052\u30FB\u53CE\u76CA\u5316\u652F\u63F4", children: "\u65B0\u898F\u4E8B\u696D\u7ACB\u3061\u4E0A\u3052\u30FB\u53CE\u76CA\u5316\u652F\u63F4" }), _jsx("option", { value: "\u4ECB\u8B77\u4FDD\u967A\u5916\u30B5\u30FC\u30D3\u30B9\u958B\u696D\u30D1\u30C3\u30B1\u30FC\u30B8", children: "\u4ECB\u8B77\u4FDD\u967A\u5916\u30B5\u30FC\u30D3\u30B9\u958B\u696D\u30D1\u30C3\u30B1\u30FC\u30B8" }), _jsx("option", { value: "\u307E\u305A\u306F\u5168\u4F53\u7684\u306A\u76F8\u8AC7\u30FB\u30D2\u30A2\u30EA\u30F3\u30B0\u5E0C\u671B", children: "\u307E\u305A\u306F\u5168\u4F53\u7684\u306A\u76F8\u8AC7\u30FB\u30D2\u30A2\u30EA\u30F3\u30B0\u5E0C\u671B" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u8CB4\u793E\u540D\u30FB\u5C4B\u53F7 ", _jsx("span", { className: "text-gray-400 font-normal", children: "\uFF08\u4EFB\u610F\uFF09" })] }), _jsx("input", { type: "text", placeholder: "\u4F8B\uFF1A\u682A\u5F0F\u4F1A\u793E\u3007\u3007 / \u500B\u4EBA", value: formData.company_name, onChange: (e) => setFormData({ ...formData, company_name: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u304A\u540D\u524D ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { type: "text", required: true, placeholder: "\u4F8B\uFF1A\u5C71\u7530 \u592A\u90CE", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9 ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { type: "email", required: true, placeholder: "\u4F8B\uFF1Ayamada@example.com", value: formData.email, onChange: (e) => setFormData({ ...formData, email: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u304A\u96FB\u8A71\u756A\u53F7 ", _jsx("span", { className: "text-gray-400 font-normal", children: "\uFF08\u4EFB\u610F\uFF09" })] }), _jsx("input", { type: "tel", placeholder: "\u4F8B\uFF1A090-1234-5678", value: formData.phone, onChange: (e) => setFormData({ ...formData, phone: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u3054\u76F8\u8AC7\u5185\u5BB9\u30FB\u73FE\u72B6\u306E\u304A\u56F0\u308A\u3054\u3068 ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("textarea", { rows: 4, required: true, placeholder: "\u4F8B\uFF1A\u696D\u52D9\u306E\u624B\u4F5C\u696D\u304C\u591A\u304F\u793E\u9577\u306E\u6642\u9593\u304C\u53D6\u308C\u306A\u3044\u3001\u5229\u76CA\u7387\u3092\u6539\u5584\u3057\u305F\u3044\u3001\u793E\u5185\u30C4\u30FC\u30EB\u306E\u81EA\u52D5\u5316\u306B\u3064\u3044\u3066\u76F8\u8AC7\u3057\u305F\u3044\u3001\u4ECB\u8B77\u4FDD\u967A\u5916\u30B5\u30FC\u30D3\u30B9\u306E\u958B\u696D\u306B\u3064\u3044\u3066\u805E\u304D\u305F\u3044\u7B49\u3001\u3056\u3063\u304F\u308A\u3068\u3057\u305F\u5185\u5BB9\u3067\u3082\u6B53\u8FCE\u3067\u3059\u3002", value: formData.message, onChange: (e) => setFormData({ ...formData, message: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition leading-relaxed" })] }), _jsxs("div", { className: "text-xs text-gray-500 leading-relaxed bg-sand-50/70 p-3.5 rounded-xl border border-sand-200", children: ["\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u60C5\u5831\u306F\u3001\u304A\u554F\u3044\u5408\u308F\u305B\u5BFE\u5FDC\u304A\u3088\u3073\u9762\u8AC7\u65E5\u7A0B\u306E\u3054\u6848\u5185\u306E\u305F\u3081\u306B\u306E\u307F\u5229\u7528\u3044\u305F\u3057\u307E\u3059\u3002\u8A73\u7D30\u306F\u5F53\u793E\u306E", _jsx("a", { href: "/privacy", target: "_blank", className: "text-brand-700 underline font-semibold", children: "\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC\u30DD\u30EA\u30B7\u30FC" }), "\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002"] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-4 px-6 bg-brand-900 hover:bg-brand-800 disabled:bg-gray-400 text-white font-bold rounded-xl text-sm sm:text-base transition shadow-md flex items-center justify-center gap-2", children: loading ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4 text-white", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "\u9001\u4FE1\u4E2D..."] })) : (_jsx(_Fragment, { children: "\u5165\u529B\u5185\u5BB9\u3092\u9001\u4FE1\u3059\u308B\uFF08\u7121\u6599\u76F8\u8AC7\uFF09 \u2192" })) })] }));
}
