import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { MST_OFFICIAL_BOTTLENECK_QUESTIONS, analyzeBottleneck, submitIntakeToCRM, OFFICIAL_TIMEREX_BOOKING_URL } from '../lib/supabase';
export default function DiagnosisForm() {
    const [currentStep, setCurrentStep] = useState(0); // 0..4: 設問, 5: 連絡先入力
    const [answers, setAnswers] = useState({
        q_ops_bottleneck: '',
        q_profit_bottleneck: '',
        q_delay_reason: '',
        q_ideal_future: '',
        q_free_notes: '',
    });
    const [lead, setLead] = useState({
        company_name: '',
        name: '',
        email: '',
        phone: '',
    });
    const [source, setSource] = useState('corporate_website');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState(null);
    const [bookingUrl, setBookingUrl] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const s = params.get('source');
            if (s)
                setSource(s);
        }
    }, []);
    const totalQuestions = MST_OFFICIAL_BOTTLENECK_QUESTIONS.length; // 5問
    const handleSelectRadio = (questionId, option) => {
        setAnswers((prev) => ({ ...prev, [questionId]: option }));
        setErrorMsg('');
        // 選択したら次の問へ自動進捗
        if (currentStep < 3) {
            setTimeout(() => {
                setCurrentStep((prev) => prev + 1);
            }, 180);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        // 回答から即時判定
        const analysis = analyzeBottleneck(answers);
        setResult(analysis);
        try {
            const res = await submitIntakeToCRM({
                slug: 'business-diagnosis',
                name: lead.name,
                companyName: lead.company_name,
                email: lead.email,
                phone: lead.phone,
                inquiryType: 'diagnosis',
                source: source,
                answers: answers,
                notes: `【経営ボトルネック診断】判定: ${analysis.typeTitle}（${analysis.badge}）\n【手作業】${answers.q_ops_bottleneck}\n【売上・利益】${answers.q_profit_bottleneck}\n【停滞原因】${answers.q_delay_reason}\n【希望】${answers.q_ideal_future}\n【自由記入】${answers.q_free_notes || 'なし'}`,
                customFields: {
                    diagnosis_result: analysis,
                },
            });
            if (res.success) {
                let targetBookingUrl = res.bookingUrl || OFFICIAL_TIMEREX_BOOKING_URL;
                if (targetBookingUrl.includes('timerex') || targetBookingUrl.includes('booking') || targetBookingUrl.includes('calendar')) {
                    const delim = targetBookingUrl.includes('?') ? '&' : '?';
                    targetBookingUrl += `${delim}name=${encodeURIComponent(lead.name)}&email=${encodeURIComponent(lead.email)}`;
                }
                setBookingUrl(targetBookingUrl);
                setSubmitted(true);
            }
            else {
                setErrorMsg('送信に失敗しました。');
            }
        }
        catch (err) {
            setErrorMsg('エラーが発生しました。通信環境をご確認ください。');
        }
        finally {
            setLoading(false);
        }
    };
    // ==========================================
    // 結果画面（診断結果速報 ＋ 面談案内）
    // ==========================================
    if (submitted && result) {
        return (_jsxs("div", { className: "bg-white p-6 sm:p-12 rounded-3xl border border-sand-300 shadow-2xl space-y-8 animate-fadeIn max-w-3xl mx-auto", children: [_jsxs("div", { className: "rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-brand-950 via-slate-900 to-sky-950 p-6 sm:p-8 text-white text-center space-y-3", children: [_jsxs("div", { className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30", children: [_jsx("svg", { className: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2.5, d: "M5 13l4 4L19 7" }) }), "\u8A3A\u65AD\u53D7\u4ED8\u5B8C\u4E86 \uFF06 \u7C21\u6613\u901F\u5831"] }), _jsxs("h2", { className: "text-xl sm:text-3xl font-extrabold font-serif", children: [lead.name, " \u69D8\u3001\u3054\u56DE\u7B54\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\uFF01", _jsx("br", {}), "\u8CB4\u793E\u306E", _jsx("span", { className: "text-amber-300", children: "\u300C\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u901F\u5831\u5224\u5B9A\u300D" }), "\u304C\u51FA\u307E\u3057\u305F"] }), _jsx("p", { className: "text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed font-light", children: "\u3054\u5165\u529B\u3044\u305F\u3060\u3044\u305F\u5185\u5BB9\u3092\u3082\u3068\u306B\u3001\u73FE\u72B6\u306E\u4ED5\u7D44\u307F\u5316\u306E\u6025\u6240\u3092\u5373\u6642\u5206\u985E\u3044\u305F\u3057\u307E\u3057\u305F\u3002\u78BA\u8A8D\u30E1\u30FC\u30EB\uFF08\u30B5\u30F3\u30AF\u30B9\u30E1\u30FC\u30EB\uFF09\u3082\u9001\u4FE1\u3057\u3066\u304A\u308A\u307E\u3059\u3002" })] }), _jsxs("div", { className: "rounded-2xl border border-amber-200 bg-amber-50/40 p-6 sm:p-8 space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3", children: [_jsx("span", { className: "text-xs font-bold text-slate-500 tracking-wider", children: "\u3010\u7C21\u6613\u8A3A\u65AD\u7D50\u679C\u901F\u5831\u3011" }), _jsx("span", { className: "rounded-full bg-amber-200/80 text-amber-900 px-3 py-1 text-xs font-bold", children: result.badge })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold text-slate-500", children: "\u8CB4\u793E\u304C\u6700\u512A\u5148\u3067\u7740\u624B\u3059\u3079\u304D\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u50BE\u5411\uFF1A" }), _jsxs("h3", { className: "mt-1 text-xl sm:text-2xl font-black text-rose-600 font-serif", children: ["\uD83D\uDEA8 ", result.typeTitle] })] }), _jsx("div", { className: "p-4 bg-white rounded-xl border border-sand-300 text-xs sm:text-sm text-slate-700 leading-relaxed shadow-sm", children: result.summary }), _jsxs("div", { className: "p-3.5 bg-brand-50 rounded-xl border border-brand-200 text-xs text-brand-900 leading-relaxed font-medium", children: [_jsx("strong", { children: "\uD83D\uDCA1 \u76F4\u8FD1\u306E\u6539\u5584\u6307\u91DD:" }), " ", result.urgentAction] })] }), _jsxs("div", { className: "rounded-2xl border border-brand-800 bg-gradient-to-br from-brand-950 via-slate-900 to-brand-900 p-6 sm:p-8 text-white space-y-5 shadow-xl", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider", children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }), "\u5B8C\u5168\u7248\u30EC\u30DD\u30FC\u30C8\u30FB\u6570\u5024\u30B7\u30DF\u30E5\u30EC\u30FC\u30B7\u30E7\u30F3\uFF08\u9375\u4ED8\u304D\uFF09"] }), _jsxs("h4", { className: "text-lg sm:text-2xl font-bold font-serif leading-snug", children: ["\u300C\u5177\u4F53\u7684\u306A\u524A\u6E1B\u6642\u9593\u300D\u3068\u300C\u5229\u76CA\u6539\u5584\u30ED\u30FC\u30C9\u30DE\u30C3\u30D7\u300D\u306F", _jsx("br", { className: "hidden sm:inline" }), "30\u5206\u306E\u30AA\u30F3\u30E9\u30A4\u30F3\u7121\u6599\u500B\u5225\u9762\u8AC7\u306B\u3066\u76F4\u63A5\u958B\u793A\u3044\u305F\u3057\u307E\u3059"] }), _jsx("p", { className: "text-xs sm:text-sm text-slate-300 leading-relaxed font-light", children: "\u673A\u4E0A\u306E\u7A7A\u8AD6\u3067\u306F\u306A\u304F\u300C\u8CB4\u793E\u306E\u5B9F\u969B\u306E\u696D\u52D9\u30D5\u30ED\u30FC\u306B\u304A\u3044\u3066\u3001\u4F55\u3092\u3069\u306E\u30C4\u30FC\u30EB\u3067\u81EA\u52D5\u5316\u3057\u3001\u3069\u3053\u306B\u4ED5\u7D44\u307F\u3092\u5C0E\u5165\u3059\u308C\u3070\u6700\u5927\u5229\u76CA\u304C\u51FA\u308B\u304B\u300D\u3092\u3001\u4EE3\u8868\u307E\u305F\u306F\u5C02\u4EFB\u30B3\u30F3\u30B5\u30EB\u30BF\u30F3\u30C8\u304C\u76F4\u63A5\u753B\u9762\u5171\u6709\u3057\u306A\u304C\u3089\u89E3\u8AAC\u3057\u307E\u3059\u3002\u7D42\u4E86\u5F8C\u3001\u8CB4\u793E\u5C02\u7528\u306E\u8A3A\u65AD\u30AB\u30EB\u30C6PDF\u3092\u9032\u5448\u3044\u305F\u3057\u307E\u3059\uFF08\u5F37\u5F15\u306A\u55B6\u696D\u306F\u4E00\u5207\u884C\u3044\u307E\u305B\u3093\uFF09\u3002" }), _jsxs("div", { className: "pt-2 flex flex-col sm:flex-row gap-3", children: [_jsxs("a", { href: bookingUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm sm:text-base transition shadow-lg hover:shadow-xl", children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }), "\u4ECA\u3059\u3050\u9762\u8AC7\u306E\u65E5\u7A0B\u3092\u4E88\u7D04\u3059\u308B\uFF08\u7121\u6599\u30FB30\u5206\uFF09 \u2192"] }), _jsx("a", { href: "https://lin.ee/qWsuD6f", target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center justify-center gap-2 px-5 py-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl text-sm transition shadow", children: "LINE\u3067\u65E5\u7A0B\u8ABF\u6574\u3059\u308B" })] })] }), _jsx("div", { className: "text-center pt-2", children: _jsx("a", { href: "/", className: "text-xs font-bold text-brand-700 hover:text-brand-900 underline", children: "\u2190 \u30C8\u30C3\u30D7\u30DA\u30FC\u30B8\u3078\u623B\u308B" }) })] }));
    }
    // ==========================================
    // 問診・入力ステップ画面
    // ==========================================
    const activeQuestion = MST_OFFICIAL_BOTTLENECK_QUESTIONS[currentStep];
    return (_jsxs("div", { className: "bg-white p-6 sm:p-10 rounded-3xl border border-sand-300 shadow-xl max-w-3xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex justify-between items-center text-xs font-bold text-slate-500 mb-2", children: [_jsxs("span", { children: ["STEP ", currentStep + 1, " / ", totalQuestions + 1] }), _jsx("span", { className: "text-brand-700", children: currentStep < totalQuestions
                                    ? activeQuestion.categoryName
                                    : '診断結果のお届け先' })] }), _jsx("div", { className: "w-full bg-sand-200 h-2.5 rounded-full overflow-hidden", children: _jsx("div", { className: "bg-brand-900 h-full rounded-full transition-all duration-300", style: { width: `${((currentStep + 1) / (totalQuestions + 1)) * 100}%` } }) })] }), errorMsg && (_jsx("div", { className: "mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium", children: errorMsg })), currentStep < 4 && (_jsxs("div", { className: "space-y-6 animate-fadeIn", children: [_jsxs("div", { children: [_jsxs("span", { className: "text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200", children: ["\u7B2C ", currentStep + 1, " \u554F"] }), _jsx("h3", { className: "text-lg sm:text-xl font-bold font-serif text-slate-900 mt-3 leading-snug", children: activeQuestion.label })] }), _jsx("div", { className: "space-y-3", children: activeQuestion.options.map((option, idx) => {
                            const isSelected = answers[activeQuestion.id] === option;
                            return (_jsxs("button", { type: "button", onClick: () => handleSelectRadio(activeQuestion.id, option), className: `w-full text-left p-4 sm:p-5 rounded-2xl border transition flex items-start gap-3 ${isSelected
                                    ? 'border-brand-700 bg-brand-50/70 shadow-sm ring-1 ring-brand-700'
                                    : 'border-sand-300 bg-white hover:bg-sand-50 hover:border-brand-300'}`, children: [_jsx("span", { className: `w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'border-brand-700 bg-brand-900 text-white' : 'border-sand-400 bg-white'}`, children: isSelected && _jsx("span", { className: "w-2 h-2 rounded-full bg-white" }) }), _jsx("span", { className: "text-xs sm:text-sm font-medium text-slate-800 leading-relaxed", children: option })] }, idx));
                        }) }), _jsxs("div", { className: "flex justify-between items-center pt-4 border-t border-sand-200", children: [currentStep > 0 ? (_jsx("button", { type: "button", onClick: () => setCurrentStep((prev) => prev - 1), className: "text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-sand-100 transition", children: "\u2190 \u524D\u306E\u8CEA\u554F\u3078" })) : _jsx("div", {}), answers[activeQuestion.id] && (_jsx("button", { type: "button", onClick: () => setCurrentStep((prev) => prev + 1), className: "px-5 py-2.5 bg-brand-900 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition shadow", children: "\u6B21\u3078\u9032\u3080 \u2192" }))] })] })), currentStep === 4 && (_jsxs("div", { className: "space-y-6 animate-fadeIn", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200", children: "\u7B2C 5 \u554F\uFF08\u4EFB\u610F\uFF09" }), _jsx("h3", { className: "text-lg sm:text-xl font-bold font-serif text-slate-900 mt-3 leading-snug", children: activeQuestion.label }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "\u7279\u306B\u601D\u3044\u3064\u304B\u306A\u3044\u5834\u5408\u306F\u672A\u8A18\u5165\u306E\u307E\u307E\u6B21\u3078\u304A\u9032\u307F\u3044\u305F\u3060\u3051\u307E\u3059\u3002" })] }), _jsx("div", { children: _jsx("textarea", { rows: 4, placeholder: "\u4F8B\uFF1A\u898B\u7A4D\u3082\u308A\u3084\u8ACB\u6C42\u696D\u52D9\u3092\u624B\u66F8\u304D\u30FBExcel\u3067\u3084\u3063\u3066\u3044\u3066\u30DF\u30B9\u304C\u6016\u3044\u3001\u55B6\u696D\u306E\u4ED5\u7D44\u307F\u3092\u4F5C\u308A\u305F\u3044\u3001\u9867\u554F\u5951\u7D04\u3067\u3069\u3053\u307E\u3067\u5BFE\u5FDC\u3057\u3066\u3082\u3089\u3048\u308B\u304B\u77E5\u308A\u305F\u3044 \u7B49", value: answers.q_free_notes, onChange: (e) => setAnswers({ ...answers, q_free_notes: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition leading-relaxed" }) }), _jsxs("div", { className: "flex justify-between items-center pt-4 border-t border-sand-200", children: [_jsx("button", { type: "button", onClick: () => setCurrentStep((prev) => prev - 1), className: "text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-sand-100 transition", children: "\u2190 \u524D\u306E\u8CEA\u554F\u3078" }), _jsx("button", { type: "button", onClick: () => setCurrentStep(5), className: "px-6 py-2.5 bg-brand-900 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition shadow", children: "\u8A3A\u65AD\u7D50\u679C\u306E\u78BA\u8A8D\u3078\u9032\u3080 \u2192" })] })] })), currentStep === 5 && (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-6 animate-fadeIn", children: [_jsxs("div", { className: "border-b border-sand-200 pb-4", children: [_jsx("span", { className: "text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200", children: "\u8A3A\u65AD\u7D50\u679C\u306E\u304A\u5C4A\u3051\u5148" }), _jsx("h3", { className: "text-lg sm:text-2xl font-bold font-serif text-slate-900 mt-2", children: "\u8A3A\u65AD\u7D50\u679C\u3092\u304A\u5C4A\u3051\u3059\u308B\u9023\u7D61\u5148\u3092\u3054\u5165\u529B\u304F\u3060\u3055\u3044" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "\u3054\u5165\u529B\u5F8C\u3001\u3059\u3050\u306B\u753B\u9762\u4E0A\u306B\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u901F\u5831\u5224\u5B9A\u304C\u8868\u793A\u3055\u308C\u307E\u3059\u3002" })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u8CB4\u793E\u540D\u30FB\u5C4B\u53F7 ", _jsx("span", { className: "text-gray-400 font-normal", children: "\uFF08\u4EFB\u610F\uFF09" })] }), _jsx("input", { type: "text", placeholder: "\u4F8B\uFF1A\u682A\u5F0F\u4F1A\u793E\u3007\u3007 / \u500B\u4EBA", value: lead.company_name, onChange: (e) => setLead({ ...lead, company_name: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u304A\u540D\u524D ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { type: "text", required: true, placeholder: "\u4F8B\uFF1A\u5C71\u7530 \u592A\u90CE", value: lead.name, onChange: (e) => setLead({ ...lead, name: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9 ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { type: "email", required: true, placeholder: "\u4F8B\uFF1Ayamada@example.com", value: lead.email, onChange: (e) => setLead({ ...lead, email: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-bold text-slate-800 mb-2", children: ["\u304A\u96FB\u8A71\u756A\u53F7 ", _jsx("span", { className: "text-gray-400 font-normal", children: "\uFF08\u4EFB\u610F\uFF09" })] }), _jsx("input", { type: "tel", placeholder: "\u4F8B\uFF1A090-1234-5678", value: lead.phone, onChange: (e) => setLead({ ...lead, phone: e.target.value }), className: "w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition" })] })] }), _jsxs("div", { className: "text-xs text-gray-500 leading-relaxed bg-sand-50/70 p-3.5 rounded-xl border border-sand-200", children: ["\u8A3A\u65AD\u7D50\u679C\u306E\u9001\u4ED8\u304A\u3088\u3073\u95A2\u9023\u3059\u308B\u60C5\u5831\u63D0\u4F9B\u306B\u306E\u307F\u5229\u7528\u3044\u305F\u3057\u307E\u3059\u3002\u96FB\u8A71\u306B\u3088\u308B\u3057\u3064\u3053\u3044\u55B6\u696D\u306F\u4E00\u5207\u884C\u3044\u307E\u305B\u3093\u3002\u8A73\u7D30\u306F\u5F53\u793E\u306E", _jsx("a", { href: "/privacy", target: "_blank", className: "text-brand-700 underline font-semibold", children: "\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC\u30DD\u30EA\u30B7\u30FC" }), "\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002"] }), _jsxs("div", { className: "flex justify-between items-center pt-2", children: [_jsx("button", { type: "button", onClick: () => setCurrentStep(4), className: "text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-sand-100 transition", children: "\u2190 \u8A2D\u554F\u3092\u4FEE\u6B63\u3059\u308B" }), _jsx("button", { type: "submit", disabled: loading, className: "py-3.5 px-6 bg-brand-900 hover:bg-brand-800 disabled:bg-gray-400 text-white font-bold rounded-xl text-sm transition shadow-md flex items-center gap-2", children: loading ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4 text-white", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "\u5224\u5B9A\u4E2D..."] })) : (_jsx(_Fragment, { children: "\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u8A3A\u65AD\u7D50\u679C\u3092\u898B\u308B\uFF08\u7121\u6599\uFF09 \u2192" })) })] })] }))] }));
}
