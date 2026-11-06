import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { ProposalPlanTemplatePicker } from './ProposalPlanTemplatePicker';
import { todayJst } from '../utils/date';
import { fetchProductsList, fetchCustomerByCompanyId, insertRecord, updateRecord } from '../services/dataService';
import { executeDealWonAutomation } from '../services/dealWonAutomationService';
import { X, ArrowRight, Building2, AlertCircle, CheckCircle2, Loader2, Info, ShieldAlert, Briefcase, Layers, UserCheck, Sparkles } from 'lucide-react';
import { formatProductPrice } from '../services/productCatalogService';
export const StageTransitionModal = ({ isOpen, type, sourceRecord, onClose, onSuccess, onViewExistingCustomer, }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    // Products for Deal conversion
    const [products, setProducts] = useState([]);
    // Existing customer check for Deal -> Customer conversion
    const [existingCustomer, setExistingCustomer] = useState(null);
    const [checkingCustomer, setCheckingCustomer] = useState(false);
    // Form states for target record creation
    // For Prospect -> Lead
    const [leadSource, setLeadSource] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [serviceTypeProductChoice, setServiceTypeProductChoice] = useState('');
    const [priorityChannel, setPriorityChannel] = useState('メール');
    const [leadStatus, setLeadStatus] = useState('新規');
    const [leadNotes, setLeadNotes] = useState('');
    // For Lead -> Deal
    const [proposalPlanName, setProposalPlanName] = useState('');
    const [proposalPlanTemplateId, setProposalPlanTemplateId] = useState('');
    const [proposalStatus, setProposalStatus] = useState('初回面談');
    const [productId, setProductId] = useState('');
    const [initialFee, setInitialFee] = useState('');
    const [monthlyFee, setMonthlyFee] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [dealMemo, setDealMemo] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    // For Deal -> Customer
    const [contractStatus, setContractStatus] = useState('契約中');
    const [contractStartDate, setContractStartDate] = useState(todayJst());
    const [customerMemo, setCustomerMemo] = useState('');
    const company = sourceRecord?.company;
    const companyId = sourceRecord?.company_id || '';
    const companyName = company?.company_name || companyId;
    // 初期化
    useEffect(() => {
        if (!isOpen || !sourceRecord)
            return;
        setErrorMessage(null);
        setIsSubmitting(false);
        if (type === 'prospect_to_lead') {
            setLeadSource(sourceRecord.source || '見込みアプローチ');
            setServiceType(sourceRecord.service_type || '');
            setServiceTypeProductChoice('');
            setPriorityChannel(sourceRecord.approach_method === 'LINE' ? 'LINE' : 'メール');
            setLeadStatus('新規');
            setLeadNotes(sourceRecord.memo ? `【見込み時メモ引継ぎ】\n${sourceRecord.memo}` : '');
            void fetchProductsList().then((prods) => {
                setProducts(prods);
                const suggestedId = sourceRecord.recommended_product_id || sourceRecord.product_id || '';
                const matched = prods.find((product) => product.id === suggestedId)
                    || prods.find((product) => product.product_name === sourceRecord.service_type);
                setServiceTypeProductChoice(matched?.id || (sourceRecord.service_type ? '__custom' : ''));
                if (matched)
                    setServiceType(matched.product_name);
            });
        }
        else if (type === 'lead_to_deal') {
            setProposalPlanName(sourceRecord.service_type ? `${sourceRecord.service_type} 導入提案` : '新規導入提案');
            setProposalPlanTemplateId('');
            setProposalStatus('初回面談');
            setDealMemo(sourceRecord.notes ? `【リード相談引継ぎ】\n${sourceRecord.notes}` : '');
            setMeetingDate(sourceRecord.meeting_date || '');
            void fetchProductsList().then((prods) => {
                setProducts(prods);
                const suggestedId = sourceRecord.interested_product_id || sourceRecord.product_id || '';
                const selected = prods.find((product) => product.id === suggestedId)
                    || prods.find((product) => product.product_name === sourceRecord.service_type);
                if (selected) {
                    setProductId(selected.id);
                    setInitialFee(selected.initial_fee ?? 0);
                    setMonthlyFee(selected.monthly_fee ?? 0);
                    setTotalAmount(Number(selected.initial_fee || 0) + Number(selected.monthly_fee || 0));
                }
                else {
                    setProductId('');
                    setInitialFee('');
                    setMonthlyFee('');
                    setTotalAmount('');
                }
            });
        }
        else if (type === 'deal_to_customer') {
            setContractStatus('契約中');
            setContractStartDate(new Date().toISOString().split('T')[0]);
            setCustomerMemo(sourceRecord.proposal_plan_name ? `商談「${sourceRecord.proposal_plan_name}」受注に伴う契約登録` : '');
            // 既存顧客チェック（重複防止）
            if (companyId) {
                setCheckingCustomer(true);
                fetchCustomerByCompanyId(companyId)
                    .then((cust) => {
                    setExistingCustomer(cust);
                })
                    .finally(() => {
                    setCheckingCustomer(false);
                });
            }
        }
    }, [isOpen, type, sourceRecord]);
    // 商品変更時に金額を連動
    const handleProductChange = (newProductId) => {
        setProductId(newProductId);
        setProposalPlanTemplateId('');
        const selected = products.find(p => p.id === newProductId);
        if (selected) {
            const initF = selected.initial_fee ?? 0;
            const monthF = selected.monthly_fee ?? 0;
            setInitialFee(initF);
            setMonthlyFee(monthF);
            setTotalAmount(Number(initF) + Number(monthF));
        }
        else {
            setInitialFee('');
            setMonthlyFee('');
            setTotalAmount('');
        }
    };
    if (!isOpen)
        return null;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting)
            return; // 二重クリック防止
        setErrorMessage(null);
        setIsSubmitting(true);
        try {
            if (type === 'prospect_to_lead') {
                const payload = {
                    company_id: companyId,
                    source: leadSource.trim() || '見込みアプローチ',
                    service_type: serviceType.trim() || null,
                    interested_product_id: serviceTypeProductChoice && serviceTypeProductChoice !== '__custom' ? serviceTypeProductChoice : null,
                    priority_channel: priorityChannel || 'メール',
                    status: leadStatus || '新規',
                    notes: leadNotes.trim() || null,
                    first_registered_at: new Date().toISOString(),
                    last_contacted_at: sourceRecord.last_contacted_at || null,
                };
                const res = await insertRecord('leads', payload);
                if (res.error) {
                    setErrorMessage(res.error.message);
                    setIsSubmitting(false);
                    return;
                }
                onSuccess('leads', res.data?.id);
                onClose();
            }
            else if (type === 'lead_to_deal') {
                if (!proposalPlanName.trim()) {
                    setErrorMessage('提案プラン名・商談名を入力してください。');
                    setIsSubmitting(false);
                    return;
                }
                const selectedProd = products.find(p => p.id === productId);
                const payload = {
                    company_id: companyId || null,
                    lead_id: sourceRecord.id, // lead_id を引き継ぎ
                    proposal_plan_name: proposalPlanName.trim(),
                    proposal_plan_template_id: proposalPlanTemplateId || null,
                    proposal_type: selectedProd?.product_type || '月額サブスク',
                    proposal_status: proposalStatus,
                    product_id: productId || null,
                    initial_fee: initialFee !== '' ? Number(initialFee) : null,
                    monthly_fee: monthlyFee !== '' ? Number(monthlyFee) : null,
                    total_amount: totalAmount !== '' ? Number(totalAmount) : null,
                    proposal_date: todayJst(),
                    meeting_date: meetingDate || null,
                    memo: dealMemo.trim() || null,
                };
                const res = await insertRecord('deals', payload);
                if (res.error) {
                    setErrorMessage(res.error.message);
                    setIsSubmitting(false);
                    return;
                }
                onSuccess('deals', res.data?.id);
                onClose();
            }
            else if (type === 'deal_to_customer') {
                let customerRecordId = existingCustomer?.id;
                if (!existingCustomer) {
                    const payload = {
                        company_id: companyId,
                        contract_status: contractStatus,
                        contract_start_date: contractStartDate || null,
                        memo: customerMemo.trim() || null,
                    };
                    const res = await insertRecord('customers', payload);
                    if (res.error) {
                        setErrorMessage(res.error.message);
                        setIsSubmitting(false);
                        return;
                    }
                    customerRecordId = res.data?.id;
                }
                // 商談ステータスを「成約」に更新
                if (sourceRecord?.id && sourceRecord.proposal_status !== '成約') {
                    await updateRecord('deals', sourceRecord.id, { proposal_status: '成約' });
                }
                // 契約書下書き・初回請求書下書き・書類HTMLの一発自動生成を実行
                if (sourceRecord?.id) {
                    await executeDealWonAutomation(sourceRecord.id);
                }
                onSuccess('customers', customerRecordId);
                onClose();
            }
        }
        catch (err) {
            setErrorMessage(err.message || '処理中にエラーが発生しました。');
            setIsSubmitting(false);
        }
    };
    const titles = {
        prospect_to_lead: {
            title: '見込み企業からリードへ進める',
            subtitle: 'アプローチ対象の見込み企業を案件化リードとして登録します',
            icon: _jsx(Layers, { className: "w-5 h-5 text-cyan-400" }),
            buttonText: 'リードを作成して進める',
        },
        lead_to_deal: {
            title: 'リードから商談を作成する',
            subtitle: '個別相談リードを具体的な提案・商談パイプラインへ引き継ぎます',
            icon: _jsx(Briefcase, { className: "w-5 h-5 text-emerald-400" }),
            buttonText: '商談を作成する',
        },
        deal_to_customer: {
            title: '商談から顧客として登録する',
            subtitle: '成約・内諾に伴い、会社の顧客契約レコードを登録します',
            icon: _jsx(UserCheck, { className: "w-5 h-5 text-pink-400" }),
            buttonText: '顧客レコードを作成する',
        },
    };
    const currentMeta = titles[type];
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in", children: _jsxs("div", { className: "bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl", children: currentMeta.icon }), _jsxs("div", { children: [_jsx("h2", { className: "text-base sm:text-lg font-bold text-white", children: currentMeta.title }), _jsx("p", { className: "text-xs text-slate-400", children: currentMeta.subtitle })] })] }), _jsx("button", { onClick: onClose, className: "p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "p-6 overflow-y-auto space-y-5 text-sm text-slate-200", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 bg-blue-600 rounded-xl text-white", children: _jsx(Building2, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-[11px] text-blue-300 font-semibold", children: "\u5F15\u304D\u7D99\u304E\u5BFE\u8C61\u4F1A\u793E\uFF08company_id \u7D99\u627F\uFF09" }), _jsx("div", { className: "text-base font-bold text-white", children: companyName }), _jsxs("div", { className: "text-xs font-mono text-slate-400", children: ["\u4F1A\u793EID: ", companyId] })] })] }), company?.industry && (_jsx("span", { className: "text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium", children: company.industry }))] }), _jsxs("div", { className: "p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2", children: [_jsxs("div", { className: "text-[11px] font-bold text-slate-300 flex items-center justify-between", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(Info, { className: "w-3.5 h-3.5 text-slate-400" }), _jsx("span", { children: "\u5F15\u304D\u7D99\u304E\u5143\u30EC\u30B3\u30FC\u30C9\u306E\u78BA\u8A8D" })] }), _jsxs("span", { className: "font-mono text-slate-500", children: ["ID: ", sourceRecord?.id] })] }), type === 'prospect_to_lead' && (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-slate-400 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80", children: [_jsxs("div", { children: ["\u30A2\u30D7\u30ED\u30FC\u30C1\u65B9\u6CD5: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.approach_method || '未設定' })] }), _jsxs("div", { children: ["\u30B9\u30C6\u30FC\u30BF\u30B9: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.status || '未設定' })] }), _jsxs("div", { children: ["\u7372\u5F97\u5143: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.source || '未設定' })] }), _jsxs("div", { children: ["AI\u78BA\u5EA6\u30B9\u30B3\u30A2: ", _jsx("span", { className: "text-blue-300 font-medium", children: sourceRecord?.ai_score !== undefined && sourceRecord?.ai_score !== null ? `${sourceRecord.ai_score}点` : '-' })] }), sourceRecord?.memo && (_jsxs("div", { className: "col-span-2 text-slate-300 pt-1 border-t border-slate-800/60 line-clamp-2", children: ["\u30E1\u30E2: ", sourceRecord.memo] }))] })), type === 'lead_to_deal' && (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-slate-400 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80", children: [_jsxs("div", { children: ["\u691C\u8A0E\u30B5\u30FC\u30D3\u30B9: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.service_type || '未設定' })] }), _jsxs("div", { children: ["\u30B9\u30C6\u30FC\u30BF\u30B9: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.status || '未設定' })] }), _jsxs("div", { children: ["\u9023\u7D61\u30C1\u30E3\u30CD\u30EB: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.priority_channel || '未設定' })] }), _jsxs("div", { children: ["\u9762\u8AC7\u65E5: ", _jsx("span", { className: "text-white font-mono", children: sourceRecord?.meeting_date || '未定' })] }), sourceRecord?.notes && (_jsxs("div", { className: "col-span-2 text-slate-300 pt-1 border-t border-slate-800/60 line-clamp-2", children: ["\u76F8\u8AC7\u30E1\u30E2: ", sourceRecord.notes] }))] })), type === 'deal_to_customer' && (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-slate-400 text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80", children: [_jsxs("div", { children: ["\u5546\u8AC7\u30D7\u30E9\u30F3\u540D: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.proposal_plan_name || '未設定' })] }), _jsxs("div", { children: ["\u5546\u8AC7\u30B9\u30C6\u30FC\u30BF\u30B9: ", _jsx("span", { className: "text-emerald-300 font-medium", children: sourceRecord?.proposal_status || '未設定' })] }), _jsxs("div", { children: ["\u5546\u54C1: ", _jsx("span", { className: "text-white font-medium", children: sourceRecord?.product?.product_name || sourceRecord?.product_id || '未定' })] }), _jsxs("div", { children: ["\u60F3\u5B9A\u7DCF\u984D: ", _jsx("span", { className: "text-emerald-400 font-mono font-medium", children: sourceRecord?.total_amount ? `¥${Number(sourceRecord.total_amount).toLocaleString()}` : '-' })] }), sourceRecord?.memo && (_jsxs("div", { className: "col-span-2 text-slate-300 pt-1 border-t border-slate-800/60 line-clamp-2", children: ["\u5546\u8AC7\u30E1\u30E2: ", sourceRecord.memo] }))] }))] })] }), errorMessage && (_jsxs("div", { className: "p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in", children: [_jsx(AlertCircle, { className: "w-4 h-4 shrink-0 text-rose-400 mt-0.5" }), _jsx("span", { className: "leading-relaxed", children: errorMessage })] })), type === 'prospect_to_lead' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1", children: [_jsxs("div", { className: "font-semibold text-slate-300 flex items-center gap-1.5", children: [_jsx(Info, { className: "w-3.5 h-3.5 text-blue-400" }), _jsx("span", { children: "\u5B9F\u88C5\u4E0A\u306E\u5236\u9650\u4E8B\u9805\uFF08\u30B9\u30AD\u30FC\u30DE\u4ED5\u69D8\uFF09" })] }), _jsxs("p", { className: "leading-relaxed text-[11px]", children: ["\u203B \u73FE\u884C\u306ESupabase\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u30B9\u30AD\u30FC\u30DE\u3067\u306F\u3001", _jsx("code", { children: "leads" }), " \u30C6\u30FC\u30D6\u30EB\u306B ", _jsx("code", { children: "prospect_id" }), "\uFF08\u898B\u8FBC\u307F\u4F01\u696DID\uFF09\u5217\u304C\u5B58\u5728\u3057\u306A\u3044\u305F\u3081\u3001\u898B\u8FBC\u307F\u4F01\u696D\u3068\u30EA\u30FC\u30C9\u306F\u300C\u5171\u901A\u306E\u4F1A\u793EID\uFF08", _jsx("code", { children: "company_id" }), "\uFF09\u300D\u306B\u3088\u3063\u3066\u306E\u307F\u95A2\u9023\u4ED8\u3051\u3089\u308C\u307E\u3059\u3002\u540C\u4E00\u4F1A\u793E\u306B\u5BFE\u3057\u3066\u8907\u6570\u306E\u898B\u8FBC\u307F\u4F01\u696D\u3084\u30EA\u30FC\u30C9\u304C\u5B58\u5728\u3059\u308B\u5834\u5408\u3001\u3069\u306E\u898B\u8FBC\u307F\u4F01\u696D\u304B\u3089\u76F4\u63A5\u6D3E\u751F\u3057\u305F\u30EA\u30FC\u30C9\u304B\u3092DB\u5217\u304B\u3089\u7279\u5B9A\u30FB\u8FFD\u8DE1\u3059\u308B\u3053\u3068\u306F\u3067\u304D\u307E\u305B\u3093\u3002"] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3.5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u30EA\u30FC\u30C9\u7372\u5F97\u5143 (source)" }), _jsx("input", { type: "text", value: leadSource, onChange: (e) => setLeadSource(e.target.value), placeholder: "\u898B\u8FBC\u307F\u30A2\u30D7\u30ED\u30FC\u30C1", className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u691C\u8A0E\u30B5\u30FC\u30D3\u30B9\u7A2E\u5225 (service_type)" }), _jsxs("select", { value: serviceTypeProductChoice, onChange: (e) => {
                                                                const choice = e.target.value;
                                                                const product = products.find((item) => item.id === choice);
                                                                setServiceTypeProductChoice(choice);
                                                                setServiceType(product?.product_name || '');
                                                            }, className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500", children: [_jsx("option", { value: "", children: "\u5546\u54C1\u3092\u9078\u629E\uFF08\u672A\u5B9A\uFF09" }), products.map((product) => _jsx("option", { value: product.id, children: product.product_name }, product.id)), _jsx("option", { value: "__custom", children: "\u305D\u306E\u4ED6\uFF08\u81EA\u7531\u5165\u529B\uFF09" })] }), serviceTypeProductChoice === '__custom' && (_jsx("input", { type: "text", value: serviceType, onChange: (e) => setServiceType(e.target.value), placeholder: "\u30B5\u30FC\u30D3\u30B9\u540D\u3092\u5165\u529B", className: "mt-2 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u512A\u5148\u9023\u7D61\u30C1\u30E3\u30CD\u30EB (priority_channel)" }), _jsxs("select", { value: priorityChannel, onChange: (e) => setPriorityChannel(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500", children: [_jsx("option", { value: "\u30E1\u30FC\u30EB", children: "\u30E1\u30FC\u30EB" }), _jsx("option", { value: "\u96FB\u8A71", children: "\u96FB\u8A71" }), _jsx("option", { value: "LINE", children: "LINE" }), _jsx("option", { value: "Slack", children: "Slack" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u521D\u671F\u30B9\u30C6\u30FC\u30BF\u30B9 (status)" }), _jsxs("select", { value: leadStatus, onChange: (e) => setLeadStatus(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500", children: [_jsx("option", { value: "\u65B0\u898F", children: "\u65B0\u898F" }), _jsx("option", { value: "\u30D2\u30A2\u30EA\u30F3\u30B0\u6E08", children: "\u30D2\u30A2\u30EA\u30F3\u30B0\u6E08" }), _jsx("option", { value: "\u5546\u8AC7\u5316", children: "\u5546\u8AC7\u5316" })] })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u30EA\u30FC\u30C9\u76F8\u8AC7\u30E1\u30E2 (notes)" }), _jsx("textarea", { rows: 3, value: leadNotes, onChange: (e) => setLeadNotes(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" })] })] })] })), type === 'lead_to_deal' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1", children: [_jsxs("div", { className: "font-semibold text-slate-300 flex items-center gap-1.5", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-400" }), _jsx("span", { children: "\u30EA\u30FC\u30C9ID\u9023\u643A" })] }), _jsxs("p", { className: "leading-relaxed text-[11px]", children: ["\u203B ", _jsx("code", { children: "deals.lead_id" }), " \u306B\u672C\u30EA\u30FC\u30C9\u306EID\uFF08", _jsx("code", { children: sourceRecord.id }), "\uFF09\u304C\u81EA\u52D5\u7684\u306B\u5F15\u304D\u7D99\u304C\u308C\u3001\u5546\u8AC7\u3068\u30EA\u30FC\u30C9\u304C\u76F4\u63A5\u7D50\u3073\u4ED8\u3051\u3089\u308C\u307E\u3059\u3002"] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3.5", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: ["\u63D0\u6848\u30D7\u30E9\u30F3\u540D\u30FB\u5546\u8AC7\u540D ", _jsx("span", { className: "text-rose-400", children: "*" })] }), _jsx("input", { type: "text", required: true, value: proposalPlanName, onChange: (e) => setProposalPlanName(e.target.value), placeholder: "\u4F8B: AI\u7D4C\u55B6OS Standard\u5C0E\u5165\u63D0\u6848", className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u63D0\u6848\u5546\u54C1 (product_id)" }), _jsxs("select", { value: productId, onChange: (e) => handleProductChange(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500", children: [_jsx("option", { value: "", children: "-- \u672A\u5B9A --" }), products.map((p) => {
                                                                    const priceInfo = formatProductPrice(p);
                                                                    return (_jsxs("option", { value: p.id, children: [p.product_name, " (", priceInfo.label, priceInfo.isFlexible ? ` 【${priceInfo.badge}】` : '', ")"] }, p.id));
                                                                })] })] }), (() => {
                                                    const currentProduct = products.find((p) => p.id === productId);
                                                    if (!currentProduct || !currentProduct.pricing_model || currentProduct.pricing_model === 'fixed') {
                                                        return null;
                                                    }
                                                    const modelLabel = currentProduct.pricing_model === 'starting_at'
                                                        ? '最低価格〜（商談で本決め）'
                                                        : currentProduct.pricing_model === 'range'
                                                            ? '価格帯（商談で本決め）'
                                                            : '個別見積・商談時決定';
                                                    return (_jsxs("div", { className: "rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-3 text-xs text-cyan-200 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-1.5 font-bold text-cyan-300", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-cyan-400" }), _jsxs("span", { children: ["\u878D\u901A\u8A2D\u5B9A\u5546\u54C1: ", modelLabel] })] }), _jsx("p", { className: "text-[11px] text-cyan-200/90 leading-relaxed", children: currentProduct.price_note ? `💡 ${currentProduct.price_note}` : '💡 システム保守など顧客のアカウント規模や対応要件に合わせて、下記の金額欄に商談で合意した本決め金額を自由に入力してください。' })] }));
                                                })(), _jsx(ProposalPlanTemplatePicker, { productId: productId, selectedTemplateId: proposalPlanTemplateId, name: proposalPlanName, description: dealMemo, initialFee: initialFee, monthlyFee: monthlyFee, totalAmount: totalAmount, sharedTemplate: null, onApply: (template) => {
                                                        setProposalPlanTemplateId(template?.id || '');
                                                        if (template) {
                                                            setProductId(template.product_id);
                                                            setProposalPlanName(template.name);
                                                            setDealMemo(template.description || '');
                                                            setInitialFee(template.initial_fee ?? '');
                                                            setMonthlyFee(template.monthly_fee ?? '');
                                                            setTotalAmount(template.total_amount ?? '');
                                                        }
                                                    } }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u521D\u671F\u30B9\u30C6\u30FC\u30BF\u30B9 (proposal_status)" }), _jsxs("select", { value: proposalStatus, onChange: (e) => setProposalStatus(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500", children: [_jsx("option", { value: "\u521D\u56DE\u9762\u8AC7", children: "\u521D\u56DE\u9762\u8AC7" }), _jsx("option", { value: "\u8981\u4EF6\u63D0\u6848", children: "\u8981\u4EF6\u63D0\u6848" }), _jsx("option", { value: "\u898B\u7A4D\u63D0\u793A", children: "\u898B\u7A4D\u63D0\u793A" }), _jsx("option", { value: "\u6210\u7D04", children: "\u6210\u7D04" })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u521D\u671F\u8CBB\u7528\uFF08\u7A0E\u629C\u30FB\u5186\uFF09" }), _jsx("input", { type: "number", value: initialFee, onChange: (e) => {
                                                                        const val = e.target.value;
                                                                        setInitialFee(val);
                                                                        setTotalAmount(Number(val || 0) + Number(monthlyFee || 0));
                                                                    }, placeholder: "0", className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-blue-500" }), initialFee !== '' && !isNaN(Number(initialFee)) && (_jsxs("p", { className: "mt-1 text-[11px] font-medium text-cyan-300", children: ["\u7A0E\u8FBC: \u00A5", Math.floor(Number(initialFee) * 1.1).toLocaleString()] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u6708\u984D\u8CBB\u7528\uFF08\u7A0E\u629C\u30FB\u5186\uFF09" }), _jsx("input", { type: "number", value: monthlyFee, onChange: (e) => {
                                                                        const val = e.target.value;
                                                                        setMonthlyFee(val);
                                                                        setTotalAmount(Number(initialFee || 0) + Number(val || 0));
                                                                    }, placeholder: "0", className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-blue-500" }), monthlyFee !== '' && !isNaN(Number(monthlyFee)) && (_jsxs("p", { className: "mt-1 text-[11px] font-medium text-cyan-300", children: ["\u7A0E\u8FBC: \u00A5", Math.floor(Number(monthlyFee) * 1.1).toLocaleString()] }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u60F3\u5B9A\u7DCF\u984D\uFF08\u7A0E\u629C\u30FB\u5186\uFF09" }), _jsx("input", { type: "number", value: totalAmount, onChange: (e) => setTotalAmount(e.target.value), placeholder: "0", className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-blue-500" }), totalAmount !== '' && !isNaN(Number(totalAmount)) && (_jsxs("p", { className: "mt-1 text-[11px] font-semibold text-indigo-300", children: ["\u6D88\u8CBB\u7A0E (10%): \u00A5", Math.floor(Number(totalAmount) * 0.1).toLocaleString(), " \uFF5C \u7A0E\u8FBC\u5408\u8A08: \u00A5", Math.floor(Number(totalAmount) * 1.1).toLocaleString()] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u9762\u8AC7\u65E5 (meeting_date)" }), _jsx("input", { type: "date", value: meetingDate, onChange: (e) => setMeetingDate(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u5546\u8AC7\u30E1\u30E2 (memo)" }), _jsx("textarea", { rows: 3, value: dealMemo, onChange: (e) => setDealMemo(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" })] })] })] })), type === 'deal_to_customer' && (_jsx("div", { className: "space-y-4", children: checkingCustomer ? (_jsxs("div", { className: "p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin mx-auto mb-1 text-blue-400" }), "\u65E2\u5B58\u9867\u5BA2\u30EC\u30B3\u30FC\u30C9\u306E\u91CD\u8907\u30C1\u30A7\u30C3\u30AF\u4E2D..."] })) : existingCustomer ? (_jsxs("div", { className: "p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3", children: [_jsxs("div", { className: "flex items-start gap-2.5", children: [_jsx(ShieldAlert, { className: "w-5 h-5 text-amber-400 shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("div", { className: "font-bold text-amber-300 text-sm", children: "\u65E2\u306B\u3053\u306E\u4F1A\u793E\u306E\u9867\u5BA2\u30EC\u30B3\u30FC\u30C9\u304C\u5B58\u5728\u3057\u307E\u3059" }), _jsxs("p", { className: "text-xs text-amber-200/90 mt-1 leading-relaxed", children: ["Supabase\u306E\u30B9\u30AD\u30FC\u30DE\u5236\u7D04\u4E0A\u3001", _jsx("code", { children: "customers.company_id" }), " \u306F1\u793E\u306B\u3064\u304D1\u4EF6\u306E\u307F\u767B\u9332\u53EF\u80FD\u3067\u3059\u3002 \u91CD\u8907\u30EC\u30B3\u30FC\u30C9\u306F\u4F5C\u6210\u305B\u305A\u3001\u65E2\u5B58\u306E\u9867\u5BA2\u8A73\u7D30\u3092\u78BA\u8A8D\u30FB\u66F4\u65B0\u3057\u3066\u304F\u3060\u3055\u3044\u3002"] })] })] }), _jsxs("div", { className: "bg-slate-950/80 rounded-xl p-3 border border-amber-500/20 text-xs space-y-1", children: [_jsxs("div", { children: ["\u5951\u7D04\u30B9\u30C6\u30FC\u30BF\u30B9: ", _jsx("span", { className: "font-bold text-white", children: existingCustomer.contract_status })] }), _jsxs("div", { children: ["\u5951\u7D04\u958B\u59CB\u65E5: ", _jsx("span", { className: "font-mono text-slate-300", children: existingCustomer.contract_start_date || '未設定' })] }), _jsxs("div", { children: ["\u9867\u5BA2ID: ", _jsx("span", { className: "font-mono text-slate-400", children: existingCustomer.id })] })] }), onViewExistingCustomer && (_jsxs("button", { type: "button", onClick: () => {
                                                    onClose();
                                                    onViewExistingCustomer(existingCustomer);
                                                }, className: "w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md", children: [_jsx(UserCheck, { className: "w-4 h-4" }), _jsx("span", { children: "\u65E2\u5B58\u306E\u9867\u5BA2\u8A73\u7D30\u3092\u958B\u304F" })] }))] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2", children: [_jsxs("div", { className: "font-bold text-amber-300 flex items-center gap-1.5", children: [_jsx(Info, { className: "w-4 h-4 text-amber-400" }), _jsx("span", { children: "\u696D\u52D9\u4E0A\u306E\u524D\u63D0\uFF08\u5546\u8AC7\u6210\u7D04\u3068\u9867\u5BA2\u5951\u7D04\u306E\u5206\u96E2\uFF09" })] }), _jsx("p", { className: "text-amber-200/90 leading-relaxed text-[11px]", children: "\u203B \u5546\u8AC7\u306E\u300C\u6210\u7D04/\u53D7\u6CE8\u300D\u306F\u55B6\u696D\u9762\u8AC7\u306B\u304A\u3051\u308B\u5408\u610F\u30FB\u5185\u8AFE\u6BB5\u968E\u3067\u3042\u308A\u3001\u6CD5\u7684\u306A\u6B63\u5F0F\u5951\u7D04\u7DE0\u7D50\u3084\u30B5\u30FC\u30D3\u30B9\u5229\u7528\u958B\u59CB\u3068\u306F\u7570\u306A\u308B\u5834\u5408\u304C\u3042\u308A\u307E\u3059\u3002\u5546\u8AC7\u306E\u6210\u7D04\u3060\u3051\u3067\u4E00\u5F8B\u306B\u5951\u7D04\u7DE0\u7D50\u6E08\u307F\u3068\u5224\u65AD\u305B\u305A\u3001\u5B9F\u52D9\u306E\u9032\u884C\u6BB5\u968E\u306B\u5408\u308F\u305B\u3066\u9069\u5207\u306A\u5951\u7D04\u30B9\u30C6\u30FC\u30BF\u30B9\uFF08\u6B63\u5F0F\u5951\u7D04\u7DE0\u7D50\u6E08\u306E\u5834\u5408\u306F\u300C\u5951\u7D04\u4E2D\u300D\u3001\u5148\u884C\u5229\u7528\u306E\u5834\u5408\u306F\u300C\u30C8\u30E9\u30A4\u30A2\u30EB\u300D\u7B49\uFF09\u3068\u5951\u7D04\u958B\u59CB\u65E5\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3.5", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: ["\u521D\u671F\u5951\u7D04\u30B9\u30C6\u30FC\u30BF\u30B9 (contract_status) ", _jsx("span", { className: "text-rose-400", children: "*" })] }), _jsxs("select", { value: contractStatus, onChange: (e) => setContractStatus(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500", children: [_jsx("option", { value: "\u5951\u7D04\u4E2D", children: "\u5951\u7D04\u4E2D\uFF08\u6B63\u5F0F\u5951\u7D04\u7DE0\u7D50\u6E08\uFF09" }), _jsx("option", { value: "\u30C8\u30E9\u30A4\u30A2\u30EB", children: "\u30C8\u30E9\u30A4\u30A2\u30EB\uFF08\u8A66\u7528\u671F\u9593\u30FB\u5148\u884C\u5229\u7528\uFF09" }), _jsx("option", { value: "\u66F4\u65B0\u4EA4\u6E09\u4E2D", children: "\u66F4\u65B0\u4EA4\u6E09\u4E2D" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u5951\u7D04\u958B\u59CB\u65E5 (contract_start_date)" }), _jsx("input", { type: "date", value: contractStartDate, onChange: (e) => setContractStartDate(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" })] }), _jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-300 mb-1", children: "\u9867\u5BA2\u30E1\u30E2 (memo)" }), _jsx("textarea", { rows: 3, value: customerMemo, onChange: (e) => setCustomerMemo(e.target.value), className: "w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500" })] })] })] })) }))] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between", children: [_jsx("span", { className: "text-[11px] text-slate-500", children: type === 'deal_to_customer' && existingCustomer
                                        ? '※ 既存顧客のため新規作成はスキップされます'
                                        : '※ 会社IDを引き継ぎ、安全に次ステージへ移行します' }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), !(type === 'deal_to_customer' && existingCustomer) && (_jsx("button", { type: "submit", disabled: isSubmitting || checkingCustomer, className: "px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-colors disabled:opacity-50", children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin" }), _jsx("span", { children: "\u4F5C\u6210\u4E2D..." })] })) : (_jsxs(_Fragment, { children: [_jsx(ArrowRight, { className: "w-3.5 h-3.5" }), _jsx("span", { children: currentMeta.buttonText })] })) }))] })] })] })] }) }));
};
