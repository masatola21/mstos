import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { ClipboardList, Plus, RefreshCw, Save } from 'lucide-react';

type DiagnosisForm = { id: string; name: string; public_slug: string; status: 'draft'|'published'|'paused'|'archived'; questionnaire_version: string; definition: Record<string, unknown>; privacy_notice: string|null; created_at: string };
type Submission = { id: string; form_id: string; contact_id: string|null; company_id: string|null; lead_id: string|null; status: 'received'|'reviewing'|'converted'|'rejected'; respondent_name: string|null; respondent_email: string|null; answers: Record<string, unknown>; score: number|null; submitted_at: string; reviewer_memo: string|null };

export const DiagnosisFormsWorkspace: React.FC = () => {
  const [section, setSection] = useState<'forms'|'answers'>('forms');
  const [forms, setForms] = useState<DiagnosisForm[]>([]);
  const [answers, setAnswers] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [definitionText, setDefinitionText] = useState('{"questions":[]}');
  const [privacyNotice, setPrivacyNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabaseに接続してください。'); return; }
    setLoading(true); setError('');
    try {
      const [formResult, answerResult] = await Promise.all([
        supabase.from('diagnosis_forms').select('*').order('created_at',{ascending:false}),
        supabase.from('diagnosis_submissions').select('*').order('submitted_at',{ascending:false}).limit(200),
      ]);
      if (formResult.error) throw formResult.error;
      if (answerResult.error) throw answerResult.error;
      setForms((formResult.data||[]) as DiagnosisForm[]);
      setAnswers((answerResult.data||[]) as Submission[]);
    } catch (e:any) { setError(e?.message||'フォーム・回答を読み込めませんでした。'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ void load(); },[]);

  const saveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase=getSupabase();
    if(!supabase || !name.trim()) return;
    let definition: Record<string,unknown>;
    try { definition=JSON.parse(definitionText); if(!definition || typeof definition!=='object' || Array.isArray(definition)) throw new Error(); }
    catch { setError('設問定義はJSONオブジェクトで入力してください。'); return; }
    setError(''); setNotice('');
    const slug=(name.trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g,'-').replace(/^-|-$/g,'')||'diagnosis')+'-'+crypto.randomUUID().slice(0,8);
    const payload = {
      name:name.trim(), questionnaire_version:'v1.0', definition,
      privacy_notice:privacyNotice.trim()||null
    };
    const result = selectedId
      ? await supabase.from('diagnosis_forms').update(payload).eq('id',selectedId)
      : await supabase.from('diagnosis_forms').insert({...payload,public_slug:slug,status:'draft'});
    if(result.error){setError(result.error.message);return;}
    setSelectedId('');setName('');setPrivacyNotice('');setDefinitionText('{"questions":[]}');
    setNotice('フォーム定義を保存しました。公開フォームURLと回答受付は、公開画面を設定するまで有効になりません。');
    await load();
  };

  const updateStatus=async(form:DiagnosisForm,status:DiagnosisForm['status'])=>{
    const supabase=getSupabase(); if(!supabase)return;
    setError('');
    const {error:updateError}=await supabase.from('diagnosis_forms').update({status,published_at:status==='published'?new Date().toISOString():null}).eq('id',form.id);
    if(updateError){setError(updateError.message);return;}
    await load();
  };

  const updateSubmission=async(submission:Submission,status:Submission['status'])=>{
    const supabase=getSupabase();if(!supabase)return;
    setError('');
    const {error:updateError}=await supabase.from('diagnosis_submissions').update({
      status,reviewed_at:new Date().toISOString()
    }).eq('id',submission.id);
    if(updateError){setError(updateError.message);return;}
    await load();
  };

  const selectForm=(form:DiagnosisForm)=>{
    setSelectedId(form.id);setName(form.name);setPrivacyNotice(form.privacy_notice||'');
    setDefinitionText(JSON.stringify(form.definition,null,2));
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold text-white">フォーム・診断の受付管理</h2><p className="mt-1 text-xs text-slate-400">フォーム定義、受付回答、診断記録を同じ場所で確認します。</p></div>
      <div className="flex gap-2">
        <button onClick={()=>setSection('forms')} className={`rounded-lg px-3 py-2 text-sm ${section==='forms'?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-800'}`}>フォーム設定</button>
        <button onClick={()=>setSection('answers')} className={`rounded-lg px-3 py-2 text-sm ${section==='answers'?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-800'}`}>フォーム回答 ({answers.length})</button>
        <button onClick={()=>void load()} title="更新" className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300"><RefreshCw className="h-4 w-4"/></button>
      </div>
    </div>
    {error&&<div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>}
    {notice&&<div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</div>}
    {section==='forms'&&<div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">フォーム一覧</h3><span className="text-xs text-slate-400">{forms.length}件</span></div>
        {loading?<p className="text-sm text-slate-400">読み込み中…</p>:forms.length===0?<p className="text-sm text-slate-400">フォームはまだありません。</p>:<ul className="space-y-2">{forms.map(form=><li key={form.id}><button onClick={()=>selectForm(form)} className={`w-full rounded-lg border p-3 text-left ${selectedId===form.id?'border-blue-500 bg-blue-950/30':'border-slate-800 bg-slate-950 hover:bg-slate-800'}`}><div className="flex justify-between gap-2"><span className="font-medium text-white">{form.name}</span><span className="text-xs text-slate-400">{form.status}</span></div><div className="mt-1 text-xs text-slate-500">/{form.public_slug}</div></button></li>)}</ul>}
        {selectedId&&<div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
          <button onClick={()=>{const f=forms.find(x=>x.id===selectedId);if(f)void updateStatus(f,'paused')}} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300">受付停止</button>
          <button onClick={()=>{const f=forms.find(x=>x.id===selectedId);if(f)void updateStatus(f,'archived')}} className="rounded border border-rose-800 px-3 py-1.5 text-xs text-rose-300">アーカイブ</button>
          <button onClick={()=>{const f=forms.find(x=>x.id===selectedId);if(f)void updateStatus(f,'draft')}} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300">下書きに戻す</button>
        </div>}
      </section>
      <form onSubmit={saveForm} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-white"><Plus className="mr-1 inline h-4 w-4"/>{selectedId?'フォーム定義を編集':'新しいフォーム定義'}</h3>{selectedId&&<button type="button" onClick={()=>{setSelectedId('');setName('');setPrivacyNotice('');setDefinitionText('{\"questions\":[]}');}} className="text-xs text-blue-300">新規フォーム</button>}</div>
        <label className="block text-xs text-slate-400">フォーム名<input required value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="例：AI経営診断フォーム"/></label>
        <label className="block text-xs text-slate-400">個人情報の取り扱い案内<textarea value={privacyNotice} onChange={e=>setPrivacyNotice(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/></label>
        <label className="block text-xs text-slate-400">設問定義（JSON）<textarea value={definitionText} onChange={e=>setDefinitionText(e.target.value)} rows={8} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"/></label>
        <button disabled={loading} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{selectedId?'変更を保存':'下書き保存'}</button>
        <p className="text-xs text-amber-300">公開フォーム画面と匿名回答APIは未接続のため、ここでは公開状態にできません。回答受付は公開エンドポイント接続後に有効化します。</p>
      </form>
    </div>}
    {section==='answers'&&<section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      {loading?<p className="p-4 text-sm text-slate-400">読み込み中…</p>:answers.length===0?<p className="p-6 text-center text-sm text-slate-400">フォーム回答はまだありません。</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr className="border-b border-slate-800"><th className="p-3">回答者</th><th className="p-3">フォーム</th><th className="p-3">受付日時</th><th className="p-3">スコア</th><th className="p-3">状態</th><th className="p-3">確認</th></tr></thead><tbody>{answers.map(answer=><tr key={answer.id} className="border-b border-slate-800/70"><td className="p-3 text-white">{answer.respondent_name||answer.respondent_email||'回答者未特定'}<div className="text-xs text-slate-500">{answer.respondent_email||''}</div></td><td className="p-3 text-slate-300">{forms.find(form=>form.id===answer.form_id)?.name||answer.form_id.slice(0,8)}</td><td className="p-3 text-slate-400">{new Date(answer.submitted_at).toLocaleString('ja-JP')}</td><td className="p-3 text-slate-300">{answer.score??'—'}</td><td className="p-3 text-slate-300">{answer.status}</td><td className="p-3"><select value={answer.status} onChange={e=>void updateSubmission(answer,e.target.value as Submission['status'])} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"><option value="received">受付</option><option value="reviewing">確認中</option><option value="rejected">対象外</option></select></td></tr>)}</tbody></table></div>}
      <p className="border-t border-slate-800 p-3 text-xs text-slate-400">公開回答API・CRMとの自動照合は未接続です。現時点では回答状態の確認のみ行えます。</p>
    </section>}
  </div>;
};
