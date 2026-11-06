import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { CheckCircle2, AlertCircle, Loader2, Printer, Sparkles, ArrowRight, ShieldCheck, Building2, FileText } from 'lucide-react';
export const PublicDocumentApplyView = ({ documentId }) => {
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [agreeChecked, setAgreeChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [applied, setApplied] = useState(false);
    const [resultDealId, setResultDealId] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [consentInfo, setConsentInfo] = useState(null);
    useEffect(() => {
        let cancelled = false;
        const fetchDocument = async () => {
            try {
                setLoading(true);
                setError('');
                // 1. まずサーバーAPIを試行
                let fetchedDoc = null;
                try {
                    const res = await fetch(`/api/public/documents/${encodeURIComponent(documentId)}`);
                    if (res.ok) {
                        const data = await res.json();
                        fetchedDoc = data.document;
                    }
                }
                catch {
                    // API失敗時はクライアント側Supabaseへフォールバック
                }
                // 2. サーバーAPIで取得できなかった場合、Supabaseクライアントから直接取得
                if (!fetchedDoc) {
                    const supabase = getSupabase();
                    if (supabase) {
                        const { data: dbDoc, error: dbErr } = await supabase
                            .from('customer_documents')
                            .select('id, title, document_type, status, body_html, company_id, lead_id, contact_id, deal_id, created_at, updated_at')
                            .eq('id', documentId)
                            .maybeSingle();
                        if (!dbErr && dbDoc) {
                            let companyName = '';
                            if (dbDoc.company_id) {
                                const { data: comp } = await supabase.from('companies').select('company_name').eq('id', dbDoc.company_id).maybeSingle();
                                companyName = comp?.company_name || '';
                            }
                            let dealStatus = '';
                            let dealAmount;
                            if (dbDoc.deal_id) {
                                const { data: deal } = await supabase.from('deals').select('proposal_status, total_amount').eq('id', dbDoc.deal_id).maybeSingle();
                                dealStatus = deal?.proposal_status || '';
                                dealAmount = deal?.total_amount;
                            }
                            fetchedDoc = {
                                id: dbDoc.id,
                                title: dbDoc.title,
                                documentType: dbDoc.document_type,
                                status: dbDoc.status,
                                bodyHtml: dbDoc.body_html,
                                companyId: dbDoc.company_id,
                                companyName,
                                dealId: dbDoc.deal_id,
                                dealStatus,
                                dealAmount,
                                leadId: dbDoc.lead_id,
                                createdAt: dbDoc.created_at,
                                updatedAt: dbDoc.updated_at,
                            };
                        }
                    }
                }
                if (cancelled)
                    return;
                if (!fetchedDoc) {
                    throw new Error('書類が見つかりませんでした。URLが正しいかご確認ください。');
                }
                setDoc(fetchedDoc);
                if (fetchedDoc.status === 'approved' || fetchedDoc.dealStatus === '成約' || fetchedDoc.dealStatus === '受注') {
                    setApplied(true);
                    setResultDealId(fetchedDoc.dealId || null);
                }
            }
            catch (err) {
                if (!cancelled)
                    setError(err.message || '書類の読み込みに失敗しました。');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void fetchDocument();
        return () => { cancelled = true; };
    }, [documentId]);
    // 書類本文内の「この内容で申し込む」ボタンを押した際、下部の確定エリアへスムーズスクロール
    useEffect(() => {
        const handleCtaClick = (e) => {
            const target = e.target?.closest('.web-apply-box a');
            if (target) {
                e.preventDefault();
                setAgreeChecked(true);
                const section = document.getElementById('apply-cta-section');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        };
        document.addEventListener('click', handleCtaClick);
        return () => document.removeEventListener('click', handleCtaClick);
    }, []);
    const handleExecuteApply = async () => {
        try {
            setSubmitting(true);
            setError('');
            setShowConfirmModal(false);
            let appliedDealId = null;
            // 1. まずサーバーAPIを試行
            try {
                const consentEvidenceText = '上記の内容（金額、委託範囲、支払条件等）を確認し、本内容での発注および申し込みに同意します。';
                const res = await fetch(`/api/public/documents/${encodeURIComponent(documentId)}/apply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        consentMethod: 'web_apply',
                        consentEvidenceText,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        appliedDealId = data.dealId;
                        setConsentInfo({ recordedAt: data.consentRecordedAt, ip: data.consentIp });
                    }
                }
            }
            catch {
                // フォールバックへ
            }
            // 2. サーバーAPIが未設定または失敗した場合、Supabaseクライアントから直接実行
            if (!appliedDealId) {
                const supabase = getSupabase();
                if (!supabase)
                    throw new Error('データベース接続が見つかりません。');
                const nowIso = new Date().toISOString();
                const todayStr = nowIso.slice(0, 10);
                // 金額の抽出
                let totalAmount = doc?.dealAmount || 0;
                if (!totalAmount) {
                    const matchAmount = (doc?.bodyHtml || '').replace(/&yen;|¥/g, '').match(/(?:合計|総額)[^\d]{0,15}([0-9,]+)\s*円?/);
                    if (matchAmount && matchAmount[1]) {
                        totalAmount = parseInt(matchAmount[1].replace(/,/g, ''), 10) || 0;
                    }
                }
                // 会社IDの解決
                let targetCompanyId = doc?.companyId;
                if (!targetCompanyId) {
                    const { data: firstComp } = await supabase.from('companies').select('id').limit(1).maybeSingle();
                    targetCompanyId = firstComp?.id || 'COMP-DEFAULT';
                }
                if (doc?.dealId) {
                    // 既存商談を成約に更新
                    appliedDealId = doc.dealId;
                    const { data: curDeal } = await supabase.from('deals').select('memo').eq('id', appliedDealId).maybeSingle();
                    const memo = [curDeal?.memo, `【Web申込】顧客がWeb上で「この内容で申し込む」をタップして即時成約（日時: ${nowIso}）`].filter(Boolean).join('\n');
                    await supabase.from('deals').update({
                        proposal_status: '成約',
                        memo,
                        updated_at: nowIso,
                    }).eq('id', appliedDealId);
                }
                else {
                    // 新規商談を自動起票
                    appliedDealId = `DEAL-WEB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
                    const { error: insDealErr } = await supabase.from('deals').insert({
                        id: appliedDealId,
                        company_id: targetCompanyId,
                        lead_id: doc?.leadId || null,
                        proposal_plan_name: doc?.title || 'Web申込プラン',
                        proposal_status: '成約',
                        proposal_date: todayStr,
                        total_amount: totalAmount > 0 ? totalAmount : null,
                        memo: `【Web申込自動起票・即時成約】書類「${doc?.title}」（ID: ${doc?.id}）より即時自動起票・成約`,
                        created_at: nowIso,
                        updated_at: nowIso,
                    });
                    if (insDealErr)
                        throw insDealErr;
                }
                const consentEvidenceText = '上記の内容（金額、委託範囲、支払条件等）を確認し、本内容での発注および申し込みに同意します。';
                const userAgentStr = typeof navigator !== 'undefined' ? navigator.userAgent : '';
                // 書類ステータスを approved に更新（電子承諾ログも保存）
                await supabase.from('customer_documents').update({
                    status: 'approved',
                    deal_id: appliedDealId,
                    company_id: targetCompanyId,
                    consent_method: 'web_apply',
                    consent_recorded_at: nowIso,
                    consent_user_agent: userAgentStr,
                    consent_evidence_text: consentEvidenceText,
                    updated_at: nowIso,
                }).eq('id', documentId);
                // 契約書テーブルに電子合意レコードを記録
                try {
                    const { data: existingContract } = await supabase
                        .from('customer_contracts')
                        .select('id')
                        .or(`document_id.eq.${documentId},deal_id.eq.${appliedDealId}`)
                        .maybeSingle();
                    if (existingContract) {
                        await supabase.from('customer_contracts').update({
                            status: 'signed',
                            consent_method: 'web_apply',
                            consent_recorded_at: nowIso,
                            consent_user_agent: userAgentStr,
                            consent_evidence_text: consentEvidenceText,
                            updated_at: nowIso,
                        }).eq('id', existingContract.id);
                    }
                    else {
                        await supabase.from('customer_contracts').insert({
                            company_id: targetCompanyId,
                            contact_id: doc?.contact_id || null,
                            deal_id: appliedDealId,
                            document_id: documentId,
                            title: doc?.title ? `${doc.title}（電子合意）` : 'Web申込契約合意',
                            contract_type: 'service_agreement',
                            amount: totalAmount > 0 ? totalAmount : 0,
                            status: 'signed',
                            start_date: todayStr,
                            consent_method: 'web_apply',
                            consent_recorded_at: nowIso,
                            consent_user_agent: userAgentStr,
                            consent_evidence_text: consentEvidenceText,
                            notes: `【Web申込・電子承諾エビデンス】\n承諾方式: web_apply\n承諾日時: ${nowIso}\n合意文面: ${consentEvidenceText}`,
                            created_at: nowIso,
                            updated_at: nowIso,
                        });
                    }
                }
                catch (contractErr) {
                    console.warn('Customer contract fallback consent sync warning:', contractErr);
                }
                setConsentInfo({ recordedAt: nowIso });
                // 顧客マスタに登録
                if (targetCompanyId) {
                    const { data: existingCust } = await supabase.from('customers').select('id').eq('company_id', targetCompanyId).maybeSingle();
                    if (!existingCust) {
                        await supabase.from('customers').insert({
                            company_id: targetCompanyId,
                            contract_status: '契約中',
                            contract_start_date: todayStr,
                            memo: `Web申込（商談ID: ${appliedDealId}）により自動成約登録`,
                            created_at: nowIso,
                            last_updated_at: nowIso,
                        });
                    }
                }
                // リードステータスを成約に更新
                if (doc?.leadId) {
                    await supabase.from('leads').update({
                        status: '成約',
                        last_contacted_at: nowIso,
                    }).eq('id', doc.leadId);
                }
                // 社内タスク起票
                try {
                    await supabase.from('tasks').insert({
                        title: `【🎉即時成約】${doc?.companyName || '顧客企業'} 様よりWeb申込・発注を受領しました`,
                        description: `書類「${doc?.title}」のWeb申込ボタンより発注が確定し、商談（${appliedDealId}）が即座に「成約」となりました。金額: ${totalAmount > 0 ? totalAmount.toLocaleString('ja-JP') + '円' : '未定'}。初回キックオフや契約締結手続きを進めてください。`,
                        status: 'todo',
                        priority: 'high',
                        due_date: todayStr,
                        created_at: nowIso,
                    });
                }
                catch {
                    // ignore task error
                }
            }
            setApplied(true);
            setResultDealId(appliedDealId);
            if (doc) {
                setDoc({
                    ...doc,
                    status: 'approved',
                    dealId: appliedDealId || undefined,
                    dealStatus: '成約',
                });
            }
        }
        catch (err) {
            setError(err.message || 'お申し込みを完了できませんでした。');
        }
        finally {
            setSubmitting(false);
        }
    };
    const handlePrint = () => {
        window.print();
    };
    if (loading) {
        return (_jsxs("div", { className: "min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-6", children: [_jsx(Loader2, { className: "w-10 h-10 animate-spin text-emerald-400 mb-4" }), _jsx("p", { className: "text-sm font-medium", children: "\u66F8\u985E\u60C5\u5831\u3092\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u2026" })] }));
    }
    if (error && !doc) {
        return (_jsx("div", { className: "min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center", children: _jsxs("div", { className: "max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl", children: [_jsx(AlertCircle, { className: "w-12 h-12 text-rose-400 mx-auto mb-4" }), _jsx("h2", { className: "text-lg font-bold text-white mb-2", children: "\u66F8\u985E\u3092\u8868\u793A\u3067\u304D\u307E\u305B\u3093" }), _jsx("p", { className: "text-sm text-slate-400 mb-6", children: error }), _jsx("a", { href: "/", className: "inline-block px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all", children: "\u30C8\u30C3\u30D7\u30DA\u30FC\u30B8\u3078\u623B\u308B" })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white", children: [_jsx("style", { children: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
        }
      ` }), _jsxs("header", { className: "no-print sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-8 py-3.5 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-600/30", children: "MST" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-bold text-white tracking-wide", children: "\u6709\u9650\u4F1A\u793EMST" }), _jsx("div", { className: "text-[10px] text-slate-400", children: "\u516C\u5F0FWeb\u7533\u8FBC\u30FB\u96FB\u5B50\u627F\u8AFE\u30DD\u30FC\u30BF\u30EB" })] })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsxs("button", { onClick: handlePrint, className: "px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer", children: [_jsx(Printer, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { className: "hidden sm:inline", children: "\u5370\u5237 / PDF\u4FDD\u5B58" })] }) })] }), _jsxs("main", { className: "flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6", children: [applied && (_jsxs("div", { className: "no-print rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 p-6 sm:p-8 shadow-2xl relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" }), _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400", children: _jsx(CheckCircle2, { className: "w-7 h-7" }) }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40", children: "\u6210\u7D04\u30FB\u304A\u7533\u3057\u8FBC\u307F\u5B8C\u4E86" }), resultDealId && (_jsxs("span", { className: "text-xs font-mono text-slate-400", children: ["\u5546\u8AC7\u7BA1\u7406\u756A\u53F7: ", resultDealId] }))] }), _jsx("h1", { className: "text-xl sm:text-2xl font-bold text-white tracking-tight", children: "\u304A\u7533\u3057\u8FBC\u307F\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01" }), _jsxs("p", { className: "text-xs sm:text-sm text-slate-300 leading-relaxed", children: ["\u672C\u63D0\u6848\u30FB\u898B\u7A4D\u5185\u5BB9\u3067\u306E\u304A\u7533\u3057\u8FBC\u307F\u304C\u6B63\u5E38\u306B\u53D7\u7406\u3055\u308C\u3001\u30B7\u30B9\u30C6\u30E0\u4E0A\u3067", _jsx("strong", { className: "text-emerald-400 font-semibold", children: "\u300C\u5373\u6642\u6210\u7D04\uFF08\u53D7\u6CE8\uFF09\u300D" }), "\u3068\u3057\u3066\u78BA\u5B9A\u3044\u305F\u3057\u307E\u3057\u305F\u3002", _jsx("br", {}), "\u62C5\u5F53\u8CAC\u4EFB\u8005\uFF08\u5927\u6A4B\u771F\u4EBA\uFF09\u3088\u308A\u3001\u521D\u56DE\u30AD\u30C3\u30AF\u30AA\u30D5\u304A\u3088\u3073\u4ECA\u5F8C\u306E\u9032\u3081\u65B9\u306B\u3064\u3044\u3066\u6298\u308A\u8FD4\u3057\u3054\u9023\u7D61\u5DEE\u3057\u4E0A\u3052\u307E\u3059\u3002"] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded-xl px-3.5 py-2", children: [_jsx(ShieldCheck, { className: "w-4 h-4 text-emerald-400 shrink-0" }), _jsxs("span", { children: ["\u96FB\u5B50\u5408\u610F\u30A8\u30D3\u30C7\u30F3\u30B9\u8A18\u9332\u6E08\uFF08\u627F\u8AFE\u65E5\u6642: ", consentInfo?.recordedAt ? new Date(consentInfo.recordedAt).toLocaleString('ja-JP') : new Date().toLocaleString('ja-JP'), " / \u65B9\u5F0F: Web\u5373\u6642\u5408\u610F\u30FB\u6539\u3056\u3093\u9632\u6B62\u30ED\u30B0\u4FDD\u6301\uFF09"] })] }), _jsx("div", { className: "pt-2 flex flex-wrap gap-3", children: _jsxs("button", { onClick: handlePrint, className: "px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer", children: [_jsx(Printer, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u6210\u7D04\u63A7\u3048\u3092\u5370\u5237\u30FBPDF\u4FDD\u5B58" })] }) })] })] })] })), _jsxs("div", { className: "print-area rounded-2xl border border-slate-800 bg-white text-slate-900 shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "no-print bg-slate-100 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FileText, { className: "w-4 h-4 text-slate-500" }), _jsx("span", { className: "font-semibold text-slate-800", children: doc?.title })] }), doc?.companyName && (_jsxs("div", { className: "flex items-center gap-1.5 text-slate-600", children: [_jsx(Building2, { className: "w-3.5 h-3.5" }), _jsxs("span", { children: ["\u5B9B\u5148: ", _jsx("strong", { children: doc.companyName }), " \u5FA1\u4E2D"] })] }))] }), _jsx("div", { className: "p-6 sm:p-12 document-body", dangerouslySetInnerHTML: { __html: doc?.bodyHtml || '' } })] }), !applied && (_jsxs("div", { id: "apply-cta-section", className: "no-print rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl space-y-6", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner", children: _jsx(Sparkles, { className: "w-6 h-6" }) }), _jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40", children: "\u30EF\u30F3\u30BF\u30C3\u30D7\u30AA\u30F3\u30E9\u30A4\u30F3\u767A\u6CE8" }), _jsx("span", { className: "text-xs text-slate-400", children: "\u5373\u6642\u6210\u7D04\u30B7\u30B9\u30C6\u30E0" })] }), _jsx("h2", { className: "text-xl font-bold text-white tracking-tight", children: "\u3053\u306E\u5185\u5BB9\u3067\u7533\u3057\u8FBC\u3080\uFF08\u767A\u6CE8\u3092\u78BA\u5B9A\u3059\u308B\uFF09" }), _jsxs("p", { className: "text-xs sm:text-sm text-slate-300 leading-relaxed", children: ["\u4E0A\u8A18\u306E\u304A\u898B\u7A4D\u3082\u308A\u30FB\u63D0\u6848\u5185\u5BB9\u3092\u3054\u78BA\u8A8D\u3044\u305F\u3060\u304D\u3001\u3088\u308D\u3057\u3051\u308C\u3070\u4E0B\u8A18\u3088\u308A\u304A\u7533\u3057\u8FBC\u307F\u304F\u3060\u3055\u3044\u3002", _jsx("br", { className: "hidden sm:inline" }), "Web\u4E0A\u3067\u78BA\u5B9A\u3055\u308C\u305F\u77AC\u9593\u306B\u5546\u8AC7\u304C\u8D77\u7968\u3055\u308C\u3001\u6B63\u5F0F\u306B\u6210\u7D04\u624B\u7D9A\u304D\u304C\u884C\u308F\u308C\u307E\u3059\u3002"] })] })] }), error && (_jsxs("div", { className: "flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300", children: [_jsx(AlertCircle, { className: "w-4 h-4 shrink-0 text-rose-400" }), _jsx("span", { children: error })] })), _jsx("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-4", children: _jsxs("label", { className: "flex items-start gap-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: agreeChecked, onChange: (e) => setAgreeChecked(e.target.checked), className: "mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400" }), _jsx("span", { className: "text-xs text-slate-300 leading-relaxed", children: "\u4E0A\u8A18\u306E\u5185\u5BB9\uFF08\u91D1\u984D\u3001\u59D4\u8A17\u7BC4\u56F2\u3001\u652F\u6255\u6761\u4EF6\u7B49\uFF09\u3092\u78BA\u8A8D\u3057\u3001\u672C\u5185\u5BB9\u3067\u306E\u767A\u6CE8\u304A\u3088\u3073\u7533\u3057\u8FBC\u307F\u306B\u540C\u610F\u3057\u307E\u3059\u3002" })] }) }), _jsxs("div", { className: "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-400", children: [_jsx(ShieldCheck, { className: "w-4 h-4 text-emerald-400" }), _jsx("span", { children: "\u6709\u9650\u4F1A\u793EMST SSL\u6697\u53F7\u5316\u30BB\u30AD\u30E5\u30A2\u6210\u7D04\u30B7\u30B9\u30C6\u30E0" })] }), _jsx("button", { type: "button", disabled: !agreeChecked || submitting, onClick: () => setShowConfirmModal(true), className: `px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${agreeChecked && !submitting
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:scale-[1.01]'
                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'}`, children: submitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), _jsx("span", { children: "\u6210\u7D04\u51E6\u7406\u4E2D\u2026" })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u3053\u306E\u5185\u5BB9\u3067\u7533\u3057\u8FBC\u3080" }), _jsx(ArrowRight, { className: "w-4 h-4" })] })) })] })] }))] }), showConfirmModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4", children: _jsxs("div", { className: "max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center", children: _jsx(Sparkles, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-white text-base", children: "\u304A\u7533\u3057\u8FBC\u307F\u306E\u6700\u7D42\u78BA\u8A8D" }), _jsx("p", { className: "text-xs text-slate-400", children: "\u6210\u7D04\u306E\u78BA\u5B9A\u624B\u7D9A\u304D" })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs text-slate-300", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-400", children: "\u66F8\u985E\u4EF6\u540D:" }), _jsx("span", { className: "font-medium text-white text-right", children: doc?.title })] }), doc?.companyName && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-400", children: "\u5B9B\u5148\u4F01\u696D:" }), _jsxs("span", { className: "font-medium text-white", children: [doc.companyName, " \u69D8"] })] }))] }), _jsx("p", { className: "text-xs text-slate-300 leading-relaxed", children: "\u300C\u78BA\u5B9A\u3057\u3066\u7533\u3057\u8FBC\u3080\u300D\u3092\u62BC\u3059\u3068\u3001\u5373\u5EA7\u306B\u5546\u8AC7\u304C\u8D77\u7968\u3055\u308C\u6210\u7D04\uFF08\u53D7\u6CE8\uFF09\u3068\u3057\u3066\u53D7\u7406\u3055\u308C\u307E\u3059\u3002\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F" }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: () => setShowConfirmModal(false), className: "px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-all cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", onClick: handleExecuteApply, className: "px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer", children: "\u78BA\u5B9A\u3057\u3066\u7533\u3057\u8FBC\u3080" })] })] }) })), _jsxs("footer", { className: "no-print mt-auto border-t border-slate-900 py-6 text-center text-xs text-slate-500", children: ["\u00A9 ", new Date().getFullYear(), " \u6709\u9650\u4F1A\u793EMST. All rights reserved."] })] }));
};
