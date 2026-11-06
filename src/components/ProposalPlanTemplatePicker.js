import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { BookmarkPlus, Loader2 } from 'lucide-react';
export const ProposalPlanTemplatePicker = ({ productId, selectedTemplateId, name, description, initialFee, monthlyFee, totalAmount, sharedTemplate, onApply, }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        const load = async () => {
            const supabase = getSupabase();
            if (!supabase || !productId) {
                setTemplates([]);
                return;
            }
            setLoading(true);
            setError('');
            const { data, error: queryError } = await supabase
                .from('proposal_plan_templates')
                .select('id,product_id,name,description,initial_fee,monthly_fee,total_amount')
                .eq('product_id', productId)
                .order('name');
            if (!active)
                return;
            if (queryError) {
                setError(queryError.message);
                setTemplates([]);
            }
            else
                setTemplates((data || []));
            setLoading(false);
        };
        void load();
        return () => { active = false; };
    }, [productId]);
    const saveTemplate = async () => {
        const supabase = getSupabase();
        if (!supabase || !productId || !name.trim()) {
            setError('商品と提案プラン名を入力してください。');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError)
                throw authError;
            if (!authData.user)
                throw new Error('ログイン状態を確認できません。');
            const payload = {
                owner_id: authData.user.id,
                product_id: productId,
                name: name.trim(),
                description: description.trim() || null,
                initial_fee: initialFee === '' ? null : Number(initialFee),
                monthly_fee: monthlyFee === '' ? null : Number(monthlyFee),
                total_amount: totalAmount === '' ? null : Number(totalAmount),
            };
            const { data, error: insertError } = await supabase
                .from('proposal_plan_templates')
                .insert(payload)
                .select('id,product_id,name,description,initial_fee,monthly_fee,total_amount')
                .single();
            if (insertError)
                throw insertError;
            const template = data;
            setTemplates((current) => [...current.filter((item) => item.id !== template.id), template].sort((a, b) => a.name.localeCompare(b.name, 'ja')));
            onApply(template);
        }
        catch (e) {
            setError(e?.message || '提案プランひな形を保存できませんでした。');
        }
        finally {
            setSaving(false);
        }
    };
    return _jsxs("div", { className: "rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:col-span-2", children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-300", children: ["\u5171\u901A\u63D0\u6848\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8 / \u4FDD\u5B58\u6E08\u307F\u3072\u306A\u5F62", _jsxs("select", { value: selectedTemplateId, onChange: (e) => onApply(templates.find((item) => item.id === e.target.value) || sharedTemplate), disabled: !productId || loading, className: "mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50", children: [_jsx("option", { value: "", children: productId ? (loading ? '保存済みひな形を読み込み中…' : '共通フォーマット（自動差し込み）') : '先に提案商品を選択してください' }), templates.map((template) => _jsx("option", { value: template.id, children: template.name }, template.id))] })] }), _jsxs("button", { type: "button", onClick: () => void saveTemplate(), disabled: saving || !productId || !name.trim(), className: "mt-2 inline-flex items-center gap-1.5 rounded border border-indigo-700 px-2.5 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-950/50 disabled:opacity-50", children: [saving ? _jsx(Loader2, { className: "h-3 w-3 animate-spin" }) : _jsx(BookmarkPlus, { className: "h-3 w-3" }), "\u73FE\u5728\u306E\u5185\u5BB9\u3092\u5546\u54C1\u5225\u3072\u306A\u5F62\u3068\u3057\u3066\u4FDD\u5B58"] }), error && _jsx("p", { role: "alert", className: "mt-2 text-[11px] text-rose-300", children: error }), _jsx("p", { className: "mt-1 text-[10px] leading-4 text-slate-500", children: "\u5546\u54C1\u9078\u629E\u6642\u306B\u5171\u901A\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8\u3078\u5546\u54C1\u540D\u30FB\u8AAC\u660E\u30FB\u4FA1\u683C\u30FB\u30D5\u30A7\u30FC\u30BA\u3092\u5DEE\u3057\u8FBC\u307F\u307E\u3059\u3002\u4FDD\u5B58\u6E08\u307F\u306E\u5546\u54C1\u5225\u3072\u306A\u5F62\u306F\u4EFB\u610F\u3067\u9078\u629E\u3067\u304D\u307E\u3059\u3002" })] });
};
