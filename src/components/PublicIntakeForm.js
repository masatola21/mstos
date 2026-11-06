import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Send, Lock, Calendar, Sparkles, ArrowRight, ShieldCheck, FileText, Download, ExternalLink } from 'lucide-react';
const TYPE_LABELS = {
    diagnosis: '診断受付',
    consultation: '相談受付',
    meeting: '面談受付',
};
function parseQuestions(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => Boolean(item && typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        ['text', 'textarea', 'select', 'radio', 'checkbox', 'date'].includes(item.type))).slice(0, 40);
}
function analyzeBottleneck(answers) {
    const ops = String(answers.q_ops_bottleneck || '');
    const profit = String(answers.q_profit_bottleneck || '');
    const delay = String(answers.q_delay_reason || '');
    if (ops.includes('請求書') || ops.includes('二重入力') || ops.includes('属人化') || ops.includes('顧客対応') || ops.includes('散乱')) {
        return {
            typeTitle: '経営者の現場拘束 ＆ 事務手作業・属人化タイプ',
            badge: '業務・手作業の急所',
            summary: '売上はあるものの、請求書や見積書の手作業、顧客対応、特定の人への属人化に時間を奪われ、経営者が「次の一手」を打つ時間が月20〜30時間流出している可能性が高い状態です。',
            urgentAction: 'まずは請求・転記・顧客連絡の重複入力を自動化し、経営者ご自身の「改善を考える時間」を真っ先に創出することが最優先課題です。',
        };
    }
    if (profit.includes('残りにくい') || profit.includes('分断') || profit.includes('単価') || profit.includes('依存')) {
        return {
            typeTitle: '利益流出 ＆ 集客〜成約導線分断タイプ',
            badge: '売上・利益の急所',
            summary: '集客から商談・フォローまでの一連の流れが分断されているか、単価・コストの見直しが進んでいないため、売上規模に対して手元に残る利益が削られている可能性が高い状態です。',
            urgentAction: '集客・商談・顧客フォローを自動でつなぐ導線構築と、利益率を高める経営戦略の見直しが急所となります。',
        };
    }
    if (delay.includes('火消し') || delay.includes('優先順位') || delay.includes('定着') || delay.includes('右腕')) {
        return {
            typeTitle: '改善後回し ＆ 優先順位停滞タイプ',
            badge: '改善実行の急所',
            summary: '「改善したい」と思いながらも日々の現場対応や火消しに追われ、どこから手を付ければ一番効果が出るのか優先順位が決まらず、改善が後回しになっている状態です。',
            urgentAction: 'あれこれ手を広げず、一番利益インパクトの大きい急所から小さく着手し、確実に定着させる伴走パートナーが必要です。',
        };
    }
    return {
        typeTitle: '経営の仕組み化 ＆ 次の一手着手タイプ',
        badge: '事業成長ステージ',
        summary: '現状の事業基盤を活かしながら、経営者が現場作業から完全に離れ、新規事業や新収益源の創出・自走組織づくりへとシフトするタイミングです。',
        urgentAction: '属人化を排した仕組み化と、継続的な利益改善ロードマップの策定が次のステージへの鍵となります。',
    };
}
export const PublicIntakeForm = ({ slug }) => {
    const [form, setForm] = useState(null);
    const [answers, setAnswers] = useState({});
    const [name, setName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [error, setError] = useState('');
    const [requestId] = useState(() => crypto.randomUUID());
    useEffect(() => {
        let cancelled = false;
        const query = new URLSearchParams(window.location.search);
        const tokenParam = query.get('t') || query.get('token') || '';
        const fetchUrl = `/api/public/forms/${encodeURIComponent(slug)}${tokenParam ? `?t=${encodeURIComponent(tokenParam)}` : ''}`;
        fetch(fetchUrl)
            .then(async (response) => {
            const payload = await response.json().catch(() => null);
            if (!response.ok)
                throw new Error(payload?.error || 'フォームを表示できません。');
            if (!cancelled) {
                setForm(payload.form);
                if (payload.initialRequestType) {
                    setAnswers((prev) => ({
                        ...prev,
                        q_inquiry_type: payload.initialRequestType,
                    }));
                }
            }
        })
            .catch((reason) => { if (!cancelled)
            setError(reason instanceof Error ? reason.message : 'フォームを読み込めませんでした。'); })
            .finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; };
    }, [slug]);
    const formType = form?.formType || 'diagnosis';
    const category = typeof form?.definition?.category === 'string'
        ? form.definition.category.trim()
        : typeof form?.definition?.service_category === 'string'
            ? form.definition.service_category.trim()
            : '';
    const questions = useMemo(() => parseQuestions(form?.definition?.questions), [form]);
    const intro = typeof form?.definition?.description === 'string' ? form.definition.description : '';
    const updateAnswer = (id, value) => setAnswers((current) => ({ ...current, [id]: value }));
    const submit = async (event) => {
        event.preventDefault();
        if (!form || submitting)
            return;
        setSubmitting(true);
        setError('');
        const query = new URLSearchParams(window.location.search);
        const utm = {};
        for (const key of ['source', 'utm_source', 'utm_medium', 'utm_campaign']) {
            const value = query.get(key);
            if (value)
                utm[key] = value.slice(0, 120);
        }
        const lineUserId = query.get('luid') || query.get('line_user_id') || undefined;
        const contactId = query.get('cid') || query.get('contact_id') || undefined;
        try {
            const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId, name, companyName, email, phone, answers, privacyAgreed, utm, lineUserId, contactId,
                    token: query.get('t') || query.get('token') || undefined,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok)
                throw new Error(payload?.error || '送信できませんでした。入力内容をご確認ください。');
            setSubmissionResult(payload);
            setSubmitted(true);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : '送信できませんでした。');
        }
        finally {
            setSubmitting(false);
        }
    };
    const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100';
    const questionClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
    return (_jsx("main", { className: "min-h-screen bg-slate-100 px-4 py-8 sm:py-14", children: _jsxs("div", { className: "mx-auto max-w-2xl", children: [_jsxs("header", { className: "mb-6 rounded-3xl bg-gradient-to-br from-sky-900 to-slate-900 p-7 text-white shadow-lg sm:p-10", children: [category ? (_jsx("p", { className: "text-sm font-semibold tracking-wide text-sky-200", children: category })) : null, _jsx("h1", { className: "mt-3 text-2xl font-bold sm:text-3xl", children: form?.name || 'お申し込みフォーム' }), intro ? _jsx("p", { className: "mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200", children: intro }) : null, form && _jsx("span", { className: "mt-5 inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs text-sky-100", children: TYPE_LABELS[form.formType] || 'フォーム受付' })] }), loading ? (_jsxs("div", { className: "rounded-2xl bg-white p-10 text-center text-slate-500", children: [_jsx(Loader2, { className: "mx-auto h-6 w-6 animate-spin" }), _jsx("p", { className: "mt-3", children: "\u30D5\u30A9\u30FC\u30E0\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059\u2026" })] })) : error && !form ? (_jsx("div", { role: "alert", className: "rounded-2xl border border-rose-200 bg-white p-6 text-rose-700", children: error })) : submitted ? (form?.formType === 'diagnosis' ? (() => {
                    const result = analyzeBottleneck(answers);
                    const rawBookingUrl = form?.bookingPageUrl || (typeof form?.definition?.booking_url === 'string' ? form.definition.booking_url : '');
                    let targetBookingUrl = rawBookingUrl.trim();
                    if (targetBookingUrl) {
                        const delim = targetBookingUrl.includes('?') ? '&' : '?';
                        targetBookingUrl += delim + 'name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
                    }
                    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-6 text-white shadow-xl sm:p-8", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400", children: [_jsx(CheckCircle2, { className: "h-4 w-4" }), "\u8A3A\u65AD\u56DE\u7B54\u306E\u53D7\u4ED8\u5B8C\u4E86 \uFF06 \u7C21\u6613\u901F\u5831"] }), _jsxs("h2", { className: "mt-3 text-xl font-extrabold sm:text-2xl", children: ["\u3054\u56DE\u7B54\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\uFF01", _jsx("br", {}), "\u8CB4\u793E\u306E", _jsx("span", { className: "text-sky-300", children: "\u300C\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u901F\u5831\u5224\u5B9A\u300D" }), "\u304C\u51FA\u307E\u3057\u305F"] }), _jsx("p", { className: "mt-2 text-xs leading-5 text-slate-300", children: "\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u56DE\u7B54\u3092\u3082\u3068\u306B\u3001\u73FE\u72B6\u306E\u6539\u5584\u30C6\u30FC\u30DE\u3092\u5373\u6642\u5206\u985E\u3044\u305F\u3057\u307E\u3057\u305F\u3002" })] }), _jsxs("section", { className: "rounded-3xl border border-amber-200/80 bg-white p-6 shadow-md sm:p-8", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3", children: [_jsx("span", { className: "text-xs font-bold text-slate-400", children: "\u3010\u7C21\u6613\u8A3A\u65AD\u7D50\u679C\u901F\u5831\u3011" }), _jsx("span", { className: "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800", children: result.badge })] }), _jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500", children: "\u8CB4\u793E\u306E\u6700\u512A\u5148\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u50BE\u5411\uFF1A" }), _jsxs("h3", { className: "mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl text-rose-600", children: ["\uD83D\uDEA8 ", result.typeTitle] })] }), _jsx("div", { className: "mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700 sm:text-sm", children: result.summary }), _jsxs("div", { className: "mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 leading-5", children: [_jsx("strong", { children: "\uD83D\uDCA1 \u76F4\u8FD1\u306E\u6539\u5584\u6307\u91DD:" }), " ", result.urgentAction] })] }), _jsxs("section", { className: "rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-md sm:p-8", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-sky-400", children: [_jsx(Lock, { className: "h-4 w-4" }), "\u5B8C\u5168\u7248\u30EC\u30DD\u30FC\u30C8\u306E\u5185\u5BB9\uFF08\u500B\u5225\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u9762\u8AC7\u306B\u3066\u9650\u5B9A\u516C\u958B\u30FB\u9032\u5448\uFF09"] }), _jsx("h4", { className: "mt-2 text-base font-bold text-white sm:text-lg", children: "\u4EE5\u4E0B\u306E\u300C\u5177\u4F53\u7684\u306A\u51E6\u65B9\u7B8B\u300D\u306F\u3001\u500B\u5225\u9762\u8AC7\u306B\u3066\u89E3\u8AAC\u3044\u305F\u3057\u307E\u3059" }), _jsxs("div", { className: "mt-4 space-y-2.5", children: [_jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 sm:text-sm", children: [_jsx(Lock, { className: "h-4 w-4 shrink-0 text-slate-500" }), _jsxs("span", { children: ["\uD83C\uDFE2 ", _jsx("strong", { children: "\u4F1A\u793E\u3068\u7D4C\u55B6\u8005\u306E\u672A\u6765\u50CF\uFF08Before & After\uFF09" }), "\uFF1A\u73FE\u5834\u89E3\u653E\u5F8C\u306E\u6642\u9593\u306E\u4F7F\u3044\u65B9"] })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 sm:text-sm", children: [_jsx(Lock, { className: "h-4 w-4 shrink-0 text-slate-500" }), _jsxs("span", { children: ["\uD83D\uDDFA\uFE0F ", _jsx("strong", { children: "\u7D99\u7D9A\u7684\u306A\u6539\u5584\u30ED\u30FC\u30C9\u30DE\u30C3\u30D7\uFF08Phase 1\u301C3\uFF09" }), "\uFF1A\u624B\u4F5C\u696D\u89E3\u6D88\u304B\u3089\u65B0\u4E8B\u696D\u81EA\u8D70\u5316\u307E\u3067"] })] }), _jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 sm:text-sm", children: [_jsx(Lock, { className: "h-4 w-4 shrink-0 text-slate-500" }), _jsxs("span", { children: ["\u2699\uFE0F ", _jsx("strong", { children: "\u63A8\u5968\u4F34\u8D70\u30D7\u30E9\u30F3 \uFF06 \u30C4\u30FC\u30EB\u81EA\u52D5\u5316\u8A2D\u8A08" }), "\uFF1A\u5FA1\u793E\u306B\u6700\u9069\u306A\u5177\u4F53\u7684\u4E00\u624B"] })] })] }), _jsx("p", { className: "mt-3 text-[11px] text-slate-400 leading-4", children: "\u203B\u673A\u4E0A\u306E\u7A7A\u8AD6\u3092\u907F\u3051\u308B\u305F\u3081\u3001\u5C02\u4EFB\u30B3\u30F3\u30B5\u30EB\u30BF\u30F3\u30C8\u304C\u8CB4\u793E\u306E\u500B\u5225\u4E8B\u60C5\u3092\u3075\u307E\u3048\u3066\u30EC\u30DD\u30FC\u30C8\u3092\u4ED5\u4E0A\u3052\u3001\u9762\u8AC7\u306B\u3066\u304A\u6E21\u3057\u3044\u305F\u3057\u307E\u3059\u3002" })] }), _jsxs("section", { className: "rounded-3xl border-2 border-blue-500 bg-white p-6 text-center shadow-xl sm:p-8", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-bold text-blue-800", children: [_jsx(Sparkles, { className: "h-3.5 w-3.5" }), "\u30AA\u30F3\u30E9\u30A4\u30F3Zoom\uFF0830\u5206\u30FB\u7121\u6599\uFF09"] }), _jsxs("h3", { className: "mt-3 text-lg font-extrabold text-slate-900 sm:text-xl", children: ["\u500B\u5225\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u9762\u8AC7\u3067", _jsx("br", { className: "sm:hidden" }), "\u300C\u5B8C\u5168\u7248\u30EC\u30DD\u30FC\u30C8\u300D\u3092\u53D7\u3051\u53D6\u308B"] }), _jsx("p", { className: "mt-2 text-xs leading-5 text-slate-600 sm:text-sm", children: "\u753B\u9762\u5171\u6709\u306B\u3066\u8A3A\u65AD\u30EC\u30DD\u30FC\u30C8\u3092\u8A73\u3057\u304F\u89E3\u8AAC\u3057\u3001\u5FA1\u793E\u306B\u5229\u76CA\u304C\u6B8B\u308B\u4F53\u5236\u3092\u3064\u304F\u308B\u7B2C\u4E00\u6B69\u3092\u3054\u6848\u5185\u3057\u307E\u3059\u3002" }), _jsx("div", { className: "mt-6", children: targetBookingUrl ? (_jsxs("a", { href: targetBookingUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-blue-500 active:scale-[0.99]", children: [_jsx(Calendar, { className: "h-5 w-5" }), "\u30AB\u30EC\u30F3\u30C0\u30FC\u304B\u3089\u9762\u8AC7\u65E5\u6642\u3092\u9078\u3076\uFF08\u4E88\u7D04\u3059\u308B\uFF09", _jsx(ArrowRight, { className: "h-4 w-4" })] })) : (_jsxs("div", { className: "rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-medium text-blue-900 sm:text-sm", children: ["\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF08", email, "\uFF09\u5B9B\u306B\u3001\u5C02\u4EFB\u30B3\u30F3\u30B5\u30EB\u30BF\u30F3\u30C8\u3088\u308A\u9762\u8AC7\u65E5\u7A0B\u306E\u3054\u6848\u5185\u3092\u304A\u5C4A\u3051\u3044\u305F\u3057\u307E\u3059\u3002"] })) }), _jsxs("div", { className: "mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs leading-5 text-slate-600", children: [_jsxs("div", { className: "flex items-center gap-1.5 font-bold text-slate-800", children: [_jsx(ShieldCheck, { className: "h-4 w-4 text-emerald-600" }), "\u9762\u8AC7\u306B\u3064\u3044\u3066\u306E\u3054\u6848\u5185"] }), _jsxs("ul", { className: "mt-1.5 list-disc space-y-1 pl-4 text-[11px] sm:text-xs", children: [_jsx("li", { children: "\u4E8B\u524D\u6E96\u5099\u306F\u4E00\u5207\u4E0D\u8981\u3067\u3059\u3002\u5F53\u65E5\u306FZoom\u306B\u3066\u30EA\u30E9\u30C3\u30AF\u30B9\u3057\u3066\u304A\u8A71\u3057\u3044\u305F\u3060\u3051\u307E\u3059\u3002" }), _jsx("li", { children: "\u9762\u8AC7\u7D42\u4E86\u5F8C\u3001\u753B\u9762\u3067\u89E3\u8AAC\u3057\u305F\u5B8C\u5168\u7248\u30EC\u30DD\u30FC\u30C8\uFF08PDF\uFF09\u3092\u9032\u5448\u3044\u305F\u3057\u307E\u3059\u3002" }), _jsx("li", { children: "\u5F37\u5F15\u306A\u55B6\u696D\u30FB\u58F2\u308A\u8FBC\u307F\u306F\u4E00\u5207\u3042\u308A\u307E\u305B\u3093\u306E\u3067\u3054\u5B89\u5FC3\u304F\u3060\u3055\u3044\u3002" })] })] })] })] }));
                })() : slug === 'care-package-inquiry' || submissionResult?.inquiryType ? (() => {
                    const inqType = submissionResult?.inquiryType || String(answers.q_inquiry_type || 'お問い合わせ');
                    const hasMaterial = inqType === '資料請求' || inqType === '両方希望';
                    const hasConsult = inqType === '開業相談' || inqType === '両方希望';
                    const matUrl = submissionResult?.materialUrl;
                    const matReady = Boolean(submissionResult?.materialReady && matUrl);
                    let bookUrl = submissionResult?.bookingUrl || form?.bookingPageUrl || '';
                    if (bookUrl) {
                        const delim = bookUrl.includes('?') ? '&' : '?';
                        bookUrl += delim + 'name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
                    }
                    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-3xl border border-sky-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-6 text-white shadow-xl sm:p-8", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400", children: [_jsx(CheckCircle2, { className: "h-4 w-4" }), "\u304A\u7533\u3057\u8FBC\u307F\u5B8C\u4E86\uFF08", inqType, "\uFF09"] }), _jsxs("h2", { className: "mt-3 text-xl font-extrabold sm:text-2xl", children: ["\u3054\u5165\u529B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\uFF01", _jsx("br", {}), "\u3010\u4ECB\u8B77\u4FDD\u967A\u5916\u30B5\u30FC\u30D3\u30B9\u958B\u696D\u30D1\u30C3\u30B1\u30FC\u30B8\u3011"] }), _jsx("p", { className: "mt-2 text-xs leading-5 text-slate-300", children: "\u5C02\u4EFB\u30C1\u30FC\u30E0\u306B\u3066\u3054\u5165\u529B\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3001\u6700\u9069\u306A\u3054\u6848\u5185\u3092\u304A\u5C4A\u3051\u3044\u305F\u3057\u307E\u3059\u3002" })] }), hasMaterial && (_jsxs("section", { className: "rounded-3xl border border-slate-200 bg-white p-6 shadow-md sm:p-8 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-900 font-bold text-base", children: [_jsx(FileText, { className: "h-5 w-5 text-sky-600" }), "\u4ECB\u8B77\u4FDD\u967A\u5916\u30B5\u30FC\u30D3\u30B9\u958B\u696D\u30D1\u30C3\u30B1\u30FC\u30B8 \u6982\u8981\u8CC7\u6599"] }), matReady ? (_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-600 mb-3", children: "\u4EE5\u4E0B\u306E\u30EA\u30F3\u30AF\u3088\u308A\u958B\u696D\u30D1\u30C3\u30B1\u30FC\u30B8\u306E\u6982\u8981\u8CC7\u6599\uFF08PDF\u30FBWeb\u8CC7\u6599\uFF09\u3092\u4ECA\u3059\u3050\u3054\u89A7\u3044\u305F\u3060\u3051\u307E\u3059\u3002" }), _jsxs("a", { href: matUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-6 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-sky-500 active:scale-[0.99]", children: [_jsx(Download, { className: "h-4 w-4" }), "\u6982\u8981\u8CC7\u6599\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9 / \u95B2\u89A7\u3059\u308B", _jsx(ExternalLink, { className: "h-4 w-4 ml-1" })] })] })) : (_jsxs("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 leading-relaxed", children: ["\uD83D\uDCC4 \u8CC7\u6599\u306E\u9001\u4ED8\u6E96\u5099\u4E2D\u3067\u3059\u3002\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u9023\u7D61\u5148\uFF08", email || 'LINE', "\uFF09\u5B9B\u306B\u3001\u5C02\u4EFB\u62C5\u5F53\u8005\u3088\u308A\u8FFD\u3063\u3066\u6700\u65B0\u7248\u8CC7\u6599\u3092\u304A\u9001\u308A\u3044\u305F\u3057\u307E\u3059\u3002"] }))] })), hasConsult && (_jsxs("section", { className: "rounded-3xl border-2 border-indigo-500 bg-white p-6 text-center shadow-xl sm:p-8 space-y-4", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3.5 py-1 text-xs font-bold text-indigo-800", children: [_jsx(Sparkles, { className: "h-3.5 w-3.5" }), "\u30AA\u30F3\u30E9\u30A4\u30F3Zoom\uFF0830\u5206\u30FB\u7121\u6599\uFF09"] }), _jsx("h3", { className: "text-lg font-extrabold text-slate-900 sm:text-xl", children: "\u500B\u5225\u76F8\u8AC7\u306E\u65E5\u7A0B\u3092\u4E88\u7D04\u3059\u308B" }), _jsx("p", { className: "text-xs leading-5 text-slate-600 sm:text-sm", children: "\u8CB4\u793E\u306E\u5730\u57DF\u7279\u6027\u3084\u69CB\u60F3\u306B\u5408\u308F\u305B\u305F\u958B\u696D\u30E2\u30C7\u30EB\u30FB\u53CE\u76CA\u8A2D\u8A08\u306B\u3064\u3044\u3066\u3001\u5C02\u4EFB\u30B3\u30F3\u30B5\u30EB\u30BF\u30F3\u30C8\u304C\u76F4\u63A5\u30A2\u30C9\u30D0\u30A4\u30B9\u3044\u305F\u3057\u307E\u3059\u3002" }), bookUrl ? (_jsxs("a", { href: bookUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-indigo-500 active:scale-[0.99]", children: [_jsx(Calendar, { className: "h-5 w-5" }), "\u30AB\u30EC\u30F3\u30C0\u30FC\u304B\u3089\u9762\u8AC7\u65E5\u6642\u3092\u9078\u3076\uFF08\u4E88\u7D04\u3059\u308B\uFF09", _jsx(ArrowRight, { className: "h-4 w-4" })] })) : (_jsx("div", { className: "rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-medium text-indigo-900 sm:text-sm", children: "\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u9023\u7D61\u5148\u5B9B\u306B\u3001\u62C5\u5F53\u8005\u3088\u308A\u65E5\u7A0B\u8ABF\u6574\u306E\u3054\u6848\u5185\u3092\u500B\u5225\u306B\u304A\u5C4A\u3051\u3044\u305F\u3057\u307E\u3059\u3002" }))] }))] }));
                })() : (_jsxs("section", { className: "rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm", children: [_jsx(CheckCircle2, { className: "mx-auto h-12 w-12 text-emerald-600" }), _jsx("h2", { className: "mt-4 text-xl font-bold text-slate-900", children: "\u304A\u7533\u3057\u8FBC\u307F\u3092\u53D7\u3051\u4ED8\u3051\u307E\u3057\u305F" }), _jsx("p", { className: "mt-3 text-sm leading-6 text-slate-600", children: "\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u5185\u5BB9\u3092\u62C5\u5F53\u8005\u304C\u78BA\u8A8D\u306E\u4E0A\u3001\u6298\u308A\u8FD4\u3057\u3054\u9023\u7D61\u3044\u305F\u3057\u307E\u3059\u3002" })] }))) : form ? (_jsxs("form", { onSubmit: submit, className: "space-y-4", children: [_jsxs("section", { className: "space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "\u304A\u5BA2\u69D8\u60C5\u5831" }), _jsxs("label", { className: "block text-sm font-medium text-slate-700", children: ["\u304A\u540D\u524D ", _jsx("span", { className: "text-rose-600", children: "*" }), _jsx("input", { required: true, autoComplete: "name", maxLength: 120, value: name, onChange: (event) => setName(event.target.value), className: inputClass })] }), _jsxs("label", { className: "block text-sm font-medium text-slate-700", children: ["\u4F1A\u793E\u540D\u30FB\u5C4B\u53F7\uFF08\u4EFB\u610F\uFF09", _jsx("input", { type: "text", autoComplete: "organization", maxLength: 200, value: companyName, onChange: (event) => setCompanyName(event.target.value), className: inputClass }), _jsx("span", { className: "mt-1 block text-xs font-normal text-slate-500", children: "\u6E96\u5099\u4E2D\u30FB\u672A\u5B9A\u306E\u5834\u5408\u306F\u7A7A\u6B04\u3067\u9032\u3081\u3089\u308C\u307E\u3059\u3002" })] }), _jsxs("label", { className: "block text-sm font-medium text-slate-700", children: ["\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9 ", _jsx("span", { className: "text-rose-600", children: "*" }), _jsx("input", { required: true, type: "email", autoComplete: "email", maxLength: 254, value: email, onChange: (event) => setEmail(event.target.value), className: inputClass }), _jsx("span", { className: "mt-1 block text-xs font-normal text-slate-500", children: "\u65E2\u306B\u3054\u767B\u9332\u304C\u3042\u308B\u5834\u5408\u3001\u540C\u3058\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3067\u60C5\u5831\u3092\u7D10\u4ED8\u3051\u307E\u3059\u3002" })] }), _jsxs("label", { className: "block text-sm font-medium text-slate-700", children: ["\u96FB\u8A71\u756A\u53F7", _jsx("input", { type: "tel", autoComplete: "tel", maxLength: 40, value: phone, onChange: (event) => setPhone(event.target.value), className: inputClass })] })] }), questions.map((question) => (_jsxs("section", { className: questionClass, children: [_jsxs("label", { className: "block text-sm font-semibold text-slate-800", children: [question.label, question.required && _jsx("span", { className: "ml-1 text-rose-600", children: "*" })] }), question.type === 'textarea' ? (_jsx("textarea", { required: Boolean(question.required), maxLength: 4000, rows: 4, value: String(answers[question.id] || ''), onChange: (event) => updateAnswer(question.id, event.target.value), className: inputClass })) : question.type === 'select' ? (_jsxs("select", { required: Boolean(question.required), value: String(answers[question.id] || ''), onChange: (event) => updateAnswer(question.id, event.target.value), className: inputClass, children: [_jsx("option", { value: "", children: "\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044" }), (question.options || []).slice(0, 30).map((option) => _jsx("option", { value: option, children: option }, option))] })) : question.type === 'radio' ? (_jsx("div", { className: "mt-3 space-y-2", children: (question.options || []).slice(0, 30).map((option) => _jsxs("label", { className: "flex items-center gap-3 text-sm text-slate-700", children: [_jsx("input", { required: Boolean(question.required) && !answers[question.id], type: "radio", name: question.id, value: option, checked: answers[question.id] === option, onChange: () => updateAnswer(question.id, option), className: "h-4 w-4 accent-sky-700" }), option] }, option)) })) : question.type === 'checkbox' ? (_jsxs("label", { className: "mt-3 flex items-center gap-3 text-sm text-slate-700", children: [_jsx("input", { type: "checkbox", checked: answers[question.id] === true, onChange: (event) => updateAnswer(question.id, event.target.checked), className: "h-4 w-4 accent-sky-700" }), (question.options || ['該当する']).join('・')] })) : (_jsx("input", { required: Boolean(question.required), type: question.type === 'date' ? 'date' : 'text', maxLength: 4000, value: String(answers[question.id] || ''), onChange: (event) => updateAnswer(question.id, event.target.value), className: inputClass }))] }, question.id))), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "\u500B\u4EBA\u60C5\u5831\u306E\u53D6\u308A\u6271\u3044" }), _jsx("p", { className: "mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600", children: form.privacyNotice || '入力内容は、お申し込みへの対応および関連するご案内のために利用します。' }), _jsxs("label", { className: "mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700", children: [_jsx("input", { required: true, type: "checkbox", checked: privacyAgreed, onChange: (event) => setPrivacyAgreed(event.target.checked), className: "mt-1 h-4 w-4 accent-sky-700" }), _jsxs("span", { children: ["\u500B\u4EBA\u60C5\u5831\u306E\u53D6\u308A\u6271\u3044\u306B\u540C\u610F\u3057\u307E\u3059 ", _jsx("span", { className: "text-rose-600", children: "*" })] })] })] }), error && _jsx("div", { role: "alert", className: "rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700", children: error }), _jsxs("button", { disabled: submitting, className: "flex w-full items-center justify-center gap-2 rounded-xl bg-sky-800 px-5 py-4 text-base font-bold text-white shadow transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60", children: [_jsx(Send, { className: "h-4 w-4" }), submitting ? '送信中…' : '入力内容を送信する'] }), _jsx("p", { className: "text-center text-xs text-slate-500", children: "\u9001\u4FE1\u3055\u308C\u305F\u5185\u5BB9\u306F\u62C5\u5F53\u8005\u304C\u78BA\u8A8D\u306E\u4E0A\u3001\u6298\u308A\u8FD4\u3057\u3054\u9023\u7D61\u3044\u305F\u3057\u307E\u3059\u3002" })] })) : null, _jsx("footer", { className: "mt-8 text-center text-xs text-slate-500", children: form?.name || '' })] }) }));
};
