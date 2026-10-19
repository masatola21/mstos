import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { BookmarkPlus, Loader2 } from 'lucide-react';

export type ProposalPlanTemplate = {
  id: string;
  product_id: string;
  name: string;
  description?: string | null;
  initial_fee?: number | null;
  monthly_fee?: number | null;
  total_amount?: number | null;
};

interface Props {
  productId: string;
  selectedTemplateId: string;
  name: string;
  description: string;
  initialFee: number | string;
  monthlyFee: number | string;
  totalAmount: number | string;
  sharedTemplate: ProposalPlanTemplate | null;
  onApply: (template?: ProposalPlanTemplate | null) => void;
}

export const ProposalPlanTemplatePicker: React.FC<Props> = ({
  productId, selectedTemplateId, name, description, initialFee, monthlyFee, totalAmount, sharedTemplate, onApply,
}) => {
  const [templates, setTemplates] = useState<ProposalPlanTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase || !productId) { setTemplates([]); return; }
      setLoading(true); setError('');
      const { data, error: queryError } = await supabase
        .from('proposal_plan_templates')
        .select('id,product_id,name,description,initial_fee,monthly_fee,total_amount')
        .eq('product_id', productId)
        .order('name');
      if (!active) return;
      if (queryError) { setError(queryError.message); setTemplates([]); }
      else setTemplates((data || []) as ProposalPlanTemplate[]);
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
    setSaving(true); setError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('ログイン状態を確認できません。');
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
      if (insertError) throw insertError;
      const template = data as ProposalPlanTemplate;
      setTemplates((current) => [...current.filter((item) => item.id !== template.id), template].sort((a,b)=>a.name.localeCompare(b.name, 'ja')));
      onApply(template);
    } catch (e: any) {
      setError(e?.message || '提案プランひな形を保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:col-span-2">
    <label className="block text-xs font-semibold text-slate-300">共通提案フォーマット / 保存済みひな形
      <select value={selectedTemplateId} onChange={(e)=>onApply(templates.find((item)=>item.id===e.target.value) || sharedTemplate)} disabled={!productId || loading} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">
        <option value="">{productId ? (loading ? '保存済みひな形を読み込み中…' : '共通フォーマット（自動差し込み）') : '先に提案商品を選択してください'}</option>
        {templates.map((template)=><option key={template.id} value={template.id}>{template.name}</option>)}
      </select>
    </label>
    <button type="button" onClick={()=>void saveTemplate()} disabled={saving || !productId || !name.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded border border-indigo-700 px-2.5 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-950/50 disabled:opacity-50">
      {saving?<Loader2 className="h-3 w-3 animate-spin"/>:<BookmarkPlus className="h-3 w-3"/>}
      現在の内容を商品別ひな形として保存
    </button>
    {error&&<p role="alert" className="mt-2 text-[11px] text-rose-300">{error}</p>}
    <p className="mt-1 text-[10px] leading-4 text-slate-500">商品選択時に共通フォーマットへ商品名・説明・価格・フェーズを差し込みます。保存済みの商品別ひな形は任意で選択できます。</p>
  </div>;
};
