import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { TABLE_CONFIGS } from '../types/database';
import { fetchCompaniesList, fetchProductsList, fetchLeadsList, insertRecord, updateRecord } from '../services/dataService';
import { ProposalPlanTemplatePicker } from './ProposalPlanTemplatePicker';
import { todayJst } from '../utils/date';
const CORE_FORM_FIELDS = {
    companies: ['company_name', 'industry', 'contact_name', 'email', 'phone', 'website'],
    contacts: ['full_name', 'company_id', 'email', 'phone', 'preferred_channel'],
    prospects: ['company_id', 'status', 'source', 'approach_method', 'recommended_product_id', 'target_flag'],
    leads: ['company_id', 'status', 'source', 'service_type', 'priority_channel', 'meeting_date', 'notes'],
    products: [
        'product_name',
        'product_type',
        'pricing_model',
        'initial_fee',
        'monthly_fee',
        'price_range_max',
        'price_note',
        'phase',
        'status',
        'description',
    ],
    deals: ['company_id', 'proposal_plan_name', 'proposal_status', 'product_id', 'lead_id', 'total_amount', 'monthly_fee', 'initial_fee'],
    customers: ['company_id', 'contract_status', 'contract_start_date'],
};
const buildSharedProposalDescription = (product) => [
    `【商品名】${product.product_name}`,
    `【説明】${product.description?.trim() || '商品説明未登録'}`,
    `【価格】初期費用 ¥${Number(product.initial_fee || 0).toLocaleString('ja-JP')} / 月額費用 ¥${Number(product.monthly_fee || 0).toLocaleString('ja-JP')}`,
    `【フェーズ】${product.phase?.trim() || '未設定（商品マスタで設定してください）'}`,
].join('\\n');
import { X, Check, AlertCircle, Loader2, PlusCircle, Edit3 } from 'lucide-react';
export const RecordFormModal = ({ isOpen, tableKey, editRecord, onClose, onSuccess, }) => {
    const config = TABLE_CONFIGS[tableKey];
    const isEditing = !!editRecord;
    const [formData, setFormData] = useState({});
    const [customFieldValues, setCustomFieldValues] = useState({});
    const [showAdvancedFields, setShowAdvancedFields] = useState(false);
    const [formErrors, setFormErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    // 外部キー候補リスト
    const [companies, setCompanies] = useState([]);
    const [products, setProducts] = useState([]);
    const [leads, setLeads] = useState([]);
    const [loadingLookups, setLoadingLookups] = useState(false);
    const [leadProductChoice, setLeadProductChoice] = useState('');
    const [proposalPlanTemplateId, setProposalPlanTemplateId] = useState('');
    // 初期化
    useEffect(() => {
        if (!isOpen)
            return;
        setSubmitError(null);
        setFormErrors({});
        setShowAdvancedFields(false);
        // 候補データの取得
        const loadLookups = async () => {
            setLoadingLookups(true);
            try {
                const [comps, prods, lds] = await Promise.all([
                    fetchCompaniesList(),
                    fetchProductsList(),
                    fetchLeadsList(),
                ]);
                setCompanies(comps);
                setProducts(prods);
                setLeads(lds);
                if (tableKey === 'leads') {
                    const selected = prods.find((product) => product.id === editRecord?.interested_product_id)
                        || prods.find((product) => product.product_name === editRecord?.service_type);
                    setLeadProductChoice(selected?.id || (editRecord?.service_type ? '__custom' : ''));
                }
            }
            catch (err) {
                console.warn('Failed to load foreign lookups', err);
            }
            finally {
                setLoadingLookups(false);
            }
        };
        loadLookups();
        if (editRecord) {
            // 編集時: 既存レコードの値をセット
            const initial = {};
            const customValues = {};
            config.fields.forEach((f) => {
                const existingValue = editRecord[f.key] !== undefined && editRecord[f.key] !== null ? editRecord[f.key] : '';
                const isKnownChoice = f.options?.some((option) => option.value === String(existingValue));
                if (f.allowCustom && existingValue !== '' && !isKnownChoice) {
                    initial[f.key] = '__custom';
                    customValues[f.key] = String(existingValue);
                }
                else {
                    initial[f.key] = existingValue;
                }
            });
            setCustomFieldValues(customValues);
            if (editRecord.id !== undefined) {
                initial.id = editRecord.id;
            }
            setFormData(initial);
            setProposalPlanTemplateId(editRecord.proposal_plan_template_id || '');
        }
        else {
            setLeadProductChoice('');
            setProposalPlanTemplateId('');
            // 新規登録時: デフォルト値
            const initial = {};
            setCustomFieldValues({});
            config.fields.forEach((f) => {
                if (f.type === 'select' && f.options && f.options.length > 0) {
                    initial[f.key] = f.options[0].value;
                }
                else if (['registered_at', 'first_registered_at'].includes(f.key)) {
                    initial[f.key] = todayJst();
                }
                else {
                    initial[f.key] = '';
                }
            });
            setFormData(initial);
        }
    }, [isOpen, tableKey, editRecord]);
    if (!isOpen)
        return null;
    const handleInputChange = (fieldKey, value) => {
        if (tableKey === 'deals' && fieldKey === 'product_id' && value !== formData.product_id) {
            setProposalPlanTemplateId('');
            const product = products.find((item) => item.id === value);
            setFormData((prev) => ({
                ...prev,
                [fieldKey]: value,
                initial_fee: product?.initial_fee ?? '',
                monthly_fee: product?.monthly_fee ?? '',
                total_amount: product ? Number(product.initial_fee || 0) + Number(product.monthly_fee || 0) : '',
                proposal_plan_name: product?.product_name || '',
                memo: product ? buildSharedProposalDescription(product) : '',
            }));
            return;
        }
        setFormData((prev) => ({
            ...prev,
            [fieldKey]: value,
        }));
        if (formErrors[fieldKey]) {
            setFormErrors((prev) => {
                const copy = { ...prev };
                delete copy[fieldKey];
                return copy;
            });
        }
    };
    const validate = () => {
        const errors = {};
        config.fields.forEach((field) => {
            const val = formData[field.key];
            // 必須チェック
            if (field.required && !(field.key === 'id' && !isEditing && ['companies', 'deals', 'products'].includes(tableKey)) && (val === undefined || val === null || String(val).trim() === '')) {
                errors[field.key] = `${field.label}は必須項目です。`;
                return;
            }
            // メールチェック
            if (field.type === 'email' && val) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(String(val).trim())) {
                    errors[field.key] = '有効なメールアドレス形式を入力してください。';
                    return;
                }
            }
            // 数値チェック
            if (field.type === 'number' && val !== '' && val !== undefined && val !== null) {
                const num = Number(val);
                if (isNaN(num)) {
                    errors[field.key] = '有効な数値を入力してください。';
                    return;
                }
                if (num < 0) {
                    errors[field.key] = '0以上の数値を入力してください。';
                    return;
                }
            }
        });
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError(null);
        if (!validate()) {
            return;
        }
        setIsSubmitting(true);
        // 送信ペイロードのクリーンアップ（数値の型変換、未入力項目の適切な処理）
        const payload = {};
        config.fields.forEach((field) => {
            let val = formData[field.key];
            if (field.allowCustom && val === '__custom') {
                val = customFieldValues[field.key]?.trim() || '';
            }
            // ブール型セレクトボックスの変換
            if (['target_flag', 'reply_flag', 'proposal_created'].includes(field.key)) {
                if (val === 'true')
                    val = true;
                else if (val === 'false')
                    val = false;
                else if (val === '' || val === undefined)
                    val = null;
            }
            if (field.type === 'number') {
                if (val !== '' && val !== null && val !== undefined) {
                    payload[field.key] = Number(val);
                }
                else if (isEditing) {
                    payload[field.key] = null;
                }
            }
            else if (val === '' || val === undefined) {
                if (isEditing) {
                    payload[field.key] = null;
                }
            }
            else {
                payload[field.key] = val;
            }
        });
        if (tableKey === 'companies' && formData.id) {
            payload.id = formData.id.trim();
        }
        if (tableKey === 'products' && formData.id) {
            payload.id = formData.id.trim();
        }
        if (tableKey === 'deals' && formData.id) {
            payload.id = formData.id.trim();
        }
        if (tableKey === 'leads') {
            payload.interested_product_id = leadProductChoice && leadProductChoice !== '__custom' ? leadProductChoice : null;
        }
        if (tableKey === 'deals') {
            payload.proposal_plan_template_id = proposalPlanTemplateId || null;
        }
        try {
            let result;
            if (isEditing) {
                result = await updateRecord(tableKey, editRecord.id, payload);
            }
            else {
                result = await insertRecord(tableKey, payload);
            }
            if (result.error) {
                setSubmitError(result.error.message);
            }
            else {
                onSuccess();
                onClose();
            }
        }
        catch (err) {
            setSubmitError(err.message || 'データ保存中にエラーが発生しました。');
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const sharedProposalTemplate = (() => {
        const product = products.find((item) => item.id === String(formData.product_id || ''));
        if (!product)
            return null;
        return {
            id: '',
            product_id: product.id,
            name: product.product_name,
            description: buildSharedProposalDescription(product),
            initial_fee: product.initial_fee ?? null,
            monthly_fee: product.monthly_fee ?? null,
            total_amount: Number(product.initial_fee || 0) + Number(product.monthly_fee || 0),
        };
    })();
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in", children: _jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]", children: [_jsxs("div", { className: "px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "p-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-700", children: isEditing ? _jsx(Edit3, { className: "w-5 h-5" }) : _jsx(PlusCircle, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: isEditing ? `${config.label} 編集` : `${config.label} 新規登録` }), _jsxs("p", { className: "text-xs text-slate-500 font-mono", children: ["\u30C6\u30FC\u30D6\u30EB: ", tableKey] })] })] }), _jsx("button", { onClick: onClose, className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "p-6 overflow-y-auto space-y-5 text-sm text-slate-700", children: [submitError && (_jsxs("div", { className: "p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fade-in", children: [_jsx(AlertCircle, { className: "w-4 h-4 shrink-0 text-rose-600 mt-0.5" }), _jsx("span", { className: "leading-relaxed", children: submitError })] })), config.fields.some((field) => !CORE_FORM_FIELDS[tableKey].includes(field.key)) && (_jsxs("button", { type: "button", onClick: () => setShowAdvancedFields((show) => !show), className: "flex items-center gap-2 text-xs font-semibold text-purple-700 hover:text-purple-800", children: [_jsx("span", { children: showAdvancedFields ? '詳細項目を隠す' : '詳細項目を表示' }), !showAdvancedFields && (_jsxs("span", { className: "rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] text-purple-700", children: [config.fields.filter((field) => !CORE_FORM_FIELDS[tableKey].includes(field.key)).length, "\u9805\u76EE"] }))] })), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: config.fields
                                        .filter((field) => showAdvancedFields || CORE_FORM_FIELDS[tableKey].includes(field.key))
                                        .map((field) => {
                                        const value = formData[field.key] ?? '';
                                        const error = formErrors[field.key];
                                        // 料金体系が価格帯(range)でない場合、上限価格項目は非表示
                                        if (field.key === 'price_range_max' && formData.pricing_model !== 'range') {
                                            return null;
                                        }
                                        const isFullWidth = field.type === 'textarea' ||
                                            field.key === 'company_name' ||
                                            field.key === 'deal_name' ||
                                            field.key === 'pricing_model' ||
                                            field.key === 'price_note';
                                        // 会社ID・商談ID・商品コードはDBで採番する。編集時のみ参照用に表示する。
                                        if (field.key === 'id' && !isEditing && ['companies', 'deals', 'products'].includes(tableKey)) {
                                            return null;
                                        }
                                        // 主キー (編集時は編集不可にする)
                                        if (field.key === 'id' && isEditing) {
                                            return (_jsxs("div", { className: "space-y-1", children: [_jsxs("label", { className: "block text-xs font-medium text-slate-500", children: [field.label, " (\u4E3B\u30AD\u30FC: \u5909\u66F4\u4E0D\u53EF)"] }), _jsx("input", { type: "text", disabled: true, value: value, className: "w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-mono cursor-not-allowed" })] }, field.key));
                                        }
                                        // 会社リレーション（プルダウン）
                                        if (field.type === 'fk_company') {
                                            return (_jsxs("div", { className: `space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`, children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsxs("span", { children: [field.label, " ", field.required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("span", { className: "font-mono text-[10px] text-slate-400", children: field.key })] }), loadingLookups ? (_jsxs("div", { className: "text-xs text-slate-500 flex items-center gap-2 p-2", children: [_jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-purple-600" }), "\u4F1A\u793E\u4E00\u89A7\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D..."] })) : (_jsxs("select", { value: value, onChange: (e) => handleInputChange(field.key, e.target.value), className: `w-full px-3 py-2 rounded-xl bg-white border ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs`, children: [_jsx("option", { value: "", children: "-- \u5BFE\u8C61\u4F1A\u793E\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044 --" }), companies.map((c) => (_jsxs("option", { value: c.id, children: [c.company_name, " (", c.id, ") ", c.industry ? `- ${c.industry}` : ''] }, c.id)))] })), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }, field.key));
                                        }
                                        if (tableKey === 'leads' && field.key === 'service_type') {
                                            return (_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700", children: "\u691C\u8A0E\u30B5\u30FC\u30D3\u30B9\u7A2E\u5225" }), _jsxs("select", { value: leadProductChoice, onChange: (e) => {
                                                            const choice = e.target.value;
                                                            setLeadProductChoice(choice);
                                                            const product = products.find((item) => item.id === choice);
                                                            handleInputChange('interested_product_id', product?.id || '');
                                                            handleInputChange('service_type', product?.product_name || '');
                                                        }, className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs", children: [_jsx("option", { value: "", children: "\u5546\u54C1\u3092\u9078\u629E\uFF08\u672A\u5B9A\uFF09" }), products.filter((product) => product.status !== 'inactive' || product.id === leadProductChoice).map((product) => _jsxs("option", { value: product.id, children: [product.product_name, product.status === 'inactive' ? '（取扱停止・既存記録）' : ''] }, product.id)), _jsx("option", { value: "__custom", children: "\u305D\u306E\u4ED6\uFF08\u81EA\u7531\u5165\u529B\uFF09" })] }), leadProductChoice === '__custom' && (_jsx("input", { type: "text", value: value, onChange: (e) => handleInputChange('service_type', e.target.value), placeholder: "\u30B5\u30FC\u30D3\u30B9\u540D\u3092\u5165\u529B", className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs mt-1.5" })), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }, field.key));
                                        }
                                        // 商品リレーション（プルダウン）
                                        if (field.type === 'fk_product') {
                                            return (_jsxs(React.Fragment, { children: [_jsxs("div", { className: `space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`, children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsxs("span", { children: [field.label, " ", field.required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("span", { className: "font-mono text-[10px] text-slate-400", children: field.key })] }), _jsxs("select", { value: value, onChange: (e) => handleInputChange(field.key, e.target.value), className: `w-full px-3 py-2 rounded-xl bg-white border ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs`, children: [_jsx("option", { value: "", children: "-- \u63D0\u6848\u5546\u54C1\u3092\u9078\u629E\uFF08\u672A\u5B9A\u53EF\uFF09 --" }), products.filter((p) => p.status !== 'inactive' || p.id === value).map((p) => _jsxs("option", { value: p.id, children: [p.product_name, p.status === 'inactive' ? '（取扱停止・既存記録）' : '', " (\u6708\u984D: \u00A5", Number(p.monthly_fee || 0).toLocaleString(), ")"] }, p.id))] }), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }), tableKey === 'deals' && field.key === 'product_id' && (_jsx(ProposalPlanTemplatePicker, { productId: String(formData.product_id || ''), selectedTemplateId: proposalPlanTemplateId, name: String(formData.proposal_plan_name || ''), description: String(formData.memo || ''), initialFee: formData.initial_fee ?? '', monthlyFee: formData.monthly_fee ?? '', totalAmount: formData.total_amount ?? '', sharedTemplate: sharedProposalTemplate, onApply: (template) => {
                                                            setProposalPlanTemplateId(template?.id || '');
                                                            if (template)
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    proposal_plan_template_id: template.id,
                                                                    product_id: template.product_id,
                                                                    proposal_plan_name: template.name,
                                                                    memo: template.description || prev.memo,
                                                                    initial_fee: template.initial_fee ?? '',
                                                                    monthly_fee: template.monthly_fee ?? '',
                                                                    total_amount: template.total_amount ?? '',
                                                                }));
                                                        } }))] }, field.key));
                                        }
                                        // リードリレーション（プルダウン）
                                        if (field.type === 'fk_lead') {
                                            return (_jsxs("div", { className: `space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`, children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsxs("span", { children: [field.label, " ", field.required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("span", { className: "font-mono text-[10px] text-slate-400", children: field.key })] }), _jsxs("select", { value: value, onChange: (e) => handleInputChange(field.key, e.target.value), className: `w-full px-3 py-2 rounded-xl bg-white border ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs`, children: [_jsx("option", { value: "", children: "-- \u7D10\u3065\u304F\u30EA\u30FC\u30C9\u3092\u9078\u629E\uFF08\u4EFB\u610F\uFF09 --" }), leads.map((l) => (_jsxs("option", { value: l.id, children: ["ID: ", l.id, " - ", l.service_type || l.source || 'リード', " (", l.status || '新規', ")"] }, l.id)))] }), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }, field.key));
                                        }
                                        // セレクトボックス
                                        if (field.type === 'select' && field.options) {
                                            const isCustomChoice = field.allowCustom && value === '__custom';
                                            return (_jsxs("div", { className: `space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`, children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsxs("span", { children: [field.label, " ", field.required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("span", { className: "font-mono text-[10px] text-slate-400", children: field.key })] }), _jsxs("select", { value: value, onChange: (e) => handleInputChange(field.key, e.target.value), className: `w-full px-3 py-2 rounded-xl bg-white border ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs`, children: [field.options.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))), field.allowCustom && _jsx("option", { value: "__custom", children: "\u305D\u306E\u4ED6\uFF08\u81EA\u7531\u5165\u529B\uFF09" })] }), isCustomChoice && (_jsx("input", { type: "text", value: customFieldValues[field.key] || '', onChange: (e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value })), placeholder: field.placeholder || `${field.label}を入力`, className: "w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs mt-1.5" })), field.key === 'pricing_model' && (_jsxs("div", { className: "p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 text-[11px] text-purple-900 space-y-1", children: [value === 'starting_at' && (_jsxs("p", { children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "\u6700\u4F4E\u4FA1\u683C\u301C\uFF08\u5546\u8AC7\u3067\u672C\u6C7A\u3081\uFF09" }), ": \u6708\u984D\u3084\u521D\u671F\u8CBB\u7528\u306E\u91D1\u984D\u6B04\u306B\u300C\u6700\u4F4E\u4FA1\u683C\uFF08\u4F8B: \uFFE510,000\uFF09\u300D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u5546\u8AC7\u753B\u9762\u3067\u300C\uFFE510,000\u301C\u300D\u3068\u8868\u793A\u3055\u308C\u3001\u9867\u5BA2\u898F\u6A21\u306B\u5408\u308F\u305B\u3066\u672C\u6C7A\u3081\u91D1\u984D\u3092\u5165\u529B\u3067\u304D\u307E\u3059\u3002"] })), value === 'range' && (_jsxs("p", { children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "\u4FA1\u683C\u5E2F\uFF08\u5546\u8AC7\u3067\u672C\u6C7A\u3081\uFF09" }), ": \u6708\u984D\u8CBB\u7528\u3092\u4E0B\u9650\u3001\u4E0B\u8A18\u306E\u4E0A\u9650\u4FA1\u683C\u6B04\u3092\u4E0A\u9650\uFF08\u4F8B: \uFFE510,000\u301C\uFFE550,000\uFF09\u3068\u3057\u3066\u8A2D\u5B9A\u3057\u3001\u5546\u8AC7\u3067\u5408\u610F\u91D1\u984D\u3092\u672C\u6C7A\u3081\u3067\u304D\u307E\u3059\u3002"] })), value === 'custom_quote' && (_jsxs("p", { children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "\u500B\u5225\u898B\u7A4D\u30FB\u5546\u8AC7\u6642\u6C7A\u5B9A" }), ": \u5B9A\u984D\u3092\u8A2D\u5B9A\u305B\u305A\u3001\u5546\u8AC7\u6642\u306B\u30D2\u30A2\u30EA\u30F3\u30B0\u3057\u3066\u672C\u6C7A\u3081\u3057\u307E\u3059\u3002"] })), (!value || value === 'fixed') && (_jsxs("p", { children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "\u56FA\u5B9A\u4FA1\u683C" }), ": \u5B9A\u984D\u63D0\u793A\u306E\u901A\u5E38\u5546\u54C1\u3067\u3059\u3002\u5546\u8AC7\u3067\u878D\u901A\u3092\u5229\u304B\u305B\u305F\u3044\u5834\u5408\u306F\u300C\u6700\u4F4E\u4FA1\u683C\u301C\u300D\u3084\u300C\u4FA1\u683C\u5E2F\u300D\u3078\u5207\u308A\u66FF\u3048\u3066\u304F\u3060\u3055\u3044\u3002"] }))] })), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }, field.key));
                                        }
                                        if (tableKey === 'deals' && field.key === 'proposal_plan_name') {
                                            return (_jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: [field.label, " ", field.required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { type: "text", value: value, placeholder: field.placeholder, onChange: (e) => handleInputChange(field.key, e.target.value), className: `w-full px-3 py-2 rounded-xl bg-white border ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs` }), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }, field.key));
                                        }
                                        // テキストエリア
                                        if (field.type === 'textarea') {
                                            return (_jsxs("div", { className: "sm:col-span-2 space-y-1.5", children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsxs("span", { children: [field.label, " ", field.required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("span", { className: "font-mono text-[10px] text-slate-400", children: field.key })] }), _jsx("textarea", { rows: 3, value: value, placeholder: field.placeholder, onChange: (e) => handleInputChange(field.key, e.target.value), className: `w-full px-3 py-2 rounded-xl bg-white border ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs` }), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }, field.key));
                                        }
                                        // ラベルの動的調整（最低価格〜の場合）
                                        let displayLabel = field.label;
                                        let displayPlaceholder = field.placeholder;
                                        if (tableKey === 'products' && formData.pricing_model === 'starting_at') {
                                            if (field.key === 'initial_fee') {
                                                displayLabel = '最低初期費用 (円) 〜';
                                                displayPlaceholder = '例: 300000（商談で本決め）';
                                            }
                                            else if (field.key === 'monthly_fee') {
                                                displayLabel = '最低月額費用 (円) 〜';
                                                displayPlaceholder = '例: 10000（商談で本決め）';
                                            }
                                        }
                                        else if (tableKey === 'products' && formData.pricing_model === 'range') {
                                            if (field.key === 'monthly_fee') {
                                                displayLabel = '下限月額費用 (円)';
                                            }
                                            else if (field.key === 'price_range_max') {
                                                displayLabel = '上限月額費用 (円)';
                                            }
                                        }
                                        // 通常の input (text, number, date, email, url, tel)
                                        return (_jsxs("div", { className: `space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`, children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 flex items-center justify-between", children: [_jsxs("span", { children: [displayLabel, " ", field.required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("span", { className: "font-mono text-[10px] text-slate-400", children: field.key })] }), _jsx("input", { type: field.type, autoComplete: {
                                                        full_name: 'name',
                                                        contact_name: 'name',
                                                        company_name: 'organization',
                                                        email: 'email',
                                                        phone: 'tel',
                                                        postal_code: 'postal-code',
                                                        address: 'street-address',
                                                        role_title: 'organization-title',
                                                        website: 'url',
                                                    }[field.key], value: value, placeholder: displayPlaceholder, onChange: (e) => handleInputChange(field.key, e.target.value), className: `w-full px-3 py-2 rounded-xl bg-white border ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} text-slate-800 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs` }), error && _jsx("p", { className: "text-[11px] text-rose-500", children: error })] }, field.key));
                                    }) })] }), _jsxs("div", { className: "px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-slate-500", children: isEditing ? '※ 既存レコードを安全に更新します' : '※ 新規レコードを追加します' }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 border border-slate-200 transition-colors", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "submit", disabled: isSubmitting, className: "px-5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50", children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin" }), _jsx("span", { children: "\u4FDD\u5B58\u4E2D..." })] })) : (_jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5" }), _jsx("span", { children: isEditing ? '更新を保存' : '新規登録する' })] })) })] })] })] })] }) }));
};
