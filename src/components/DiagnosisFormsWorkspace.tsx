import React, { Fragment, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { Clipboard, ClipboardCheck, ExternalLink, Plus, RefreshCw, Save } from 'lucide-react';

type FormType = 'diagnosis' | 'consultation' | 'meeting';
type DiagnosisForm = { id: string; name: string; public_slug: string; form_type: FormType; status: 'draft'|'published'|'paused'|'archived'; questionnaire_version: string; definition: Record<string, unknown>; privacy_notice: string|null; created_at: string };
type Submission = { id: string; form_id: string; contact_id: string|null; company_id: string|null; lead_id: string|null; status: 'received'|'reviewing'|'converted'|'rejected'; respondent_name: string|null; respondent_email: string|null; answers: Record<string, unknown>; score: number|null; submitted_at: string; reviewer_memo: string|null };

const FORM_TYPES: { value: FormType; label: string }[] = [
  { value: 'diagnosis', label: '診断申込' },
  { value: 'consultation', label: '相談申込' },
  { value: 'meeting', label: '面談申込' },
];
const QUESTION_EXAMPLES: Record<FormType, Record<string, unknown>> = {
  diagnosis: { description: '介護保険外サービスの開業準備状況をお聞かせください。回答を確認後、診断結果と相談案内をご連絡します。', questions: [
    { id: 'opening_timing', label: '開業・事業開始の希望時期', type: 'select', required: true, options: ['3か月以内', '半年以内', '1年以内', '情報収集中'] },
    { id: 'current_challenge', label: '現在、特に知りたいこと・お困りのこと', type: 'textarea', required: true },
  ] },
  consultation: { description: 'ご相談内容をお送りください。担当者が確認し、ご連絡します。', questions: [
    { id: 'consultation_topic', label: '相談したい内容', type: 'textarea', required: true },
  ] },
  meeting: { description: '面談のご希望をお知らせください。日程は担当者から確認のご連絡をします。', questions: [
    { id: 'meeting_date', label: '面談希望日', type: 'date', required: true },
    { id: 'meeting_topic', label: '面談で相談したい内容', type: 'textarea', required: true },
  ] },
};

export const DiagnosisFormsWorkspace: React.FC = () => {
  const [section, setSection] = useState<'forms'|'answers'>('forms');
  const [forms, setForms] = useState<DiagnosisForm[]>([]);
  const [answers, setAnswers] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [formType, setFormType] = useState<FormType>('diagnosis');
  const [definitionText, setDefinitionText] = useState(JSON.stringify(QUESTION_EXAMPLES.diagnosis, null, 2));
  const [privacyNotice, setPrivacyNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState('');

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

  const resetForm = () => {
    setSelectedId(''); setName(''); setFormType('diagnosis');
    setPrivacyNotice(''); setDefinitionText(JSON.stringify(QUESTION_EXAMPLES.diagnosis, null, 2));
  };

  const saveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase=getSupabase();
    if(!supabase || !name.trim()) return;
    let definition: Record<string,unknown>;
    try { definition=JSON.parse(definitionText); if(!definition || typeof definition!=='object' || Array.isArray(definition)) throw new Error(); }
    catch { setError('設問定義はJSONオブジェクトで入力してください。'); return; }
    setError(''); setNotice('');
    const slug=(name.trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g,'-').replace(/^-|-$/g,'')||'intake')+'-'+crypto.randomUUID().slice(0,8);
    const payload = {
      name:name.trim(), form_type:formType, questionnaire_version:'v1.0', definition,
      privacy_notice:privacyNotice.trim()||null
    };
    const result = selectedId
      ? await supabase.from('diagnosis_forms').update(payload).eq('id',selectedId)
      : await supabase.from('diagnosis_forms').insert({...payload,public_slug:slug,status:'draft'});
    if(result.error){setError(result.error.message);return;}
    setNotice(selectedId ? 'フォーム定義を保存しました。' : 'フォームを下書き保存しました。公開前に個人情報の案内を設定してください。');
    resetForm();
    await load();
  };

  const updateStatus=async(form:DiagnosisForm,status:DiagnosisForm['status'])=>{
    const supabase=getSupabase(); if(!supabase)return;
    if(status==='published' && !form.privacy_notice?.trim()) {
      setError('公開する前にフォームを編集し、個人情報の取り扱い案内を保存してください。');
      return;
    }
    setError(''); setNotice('');
    const {error:updateError}=await supabase.from('diagnosis_forms').update({status,published_at:status==='published'?new Date().toISOString():null}).eq('id',form.id);
    if(updateError){setError(updateError.message);return;}
    setNotice(status==='published'?'フォームを公開しました。公開URLをコピーしてLPやLINEに掲載できます。':status==='paused'?'フォーム受付を停止しました。':'フォーム状態を更新しました。');
    await load();
  };

  const publishSelectedForm=()=>{
    const form=forms.find(item=>item.id===selectedId);
    if(!form)return;
    let definition:Record<string,unknown>;
    try {
      definition=JSON.parse(definitionText);
      if(!definition||typeof definition!=='object'||Array.isArray(definition))throw new Error();
    } catch {
      setError('設問定義はJSONオブジェクトで入力してください。');
      return;
    }
    const hasUnsavedChanges=name.trim()!==form.name||formType!==(form.form_type||'diagnosis')||
      privacyNotice.trim()!==(form.privacy_notice||'')||
      JSON.stringify(definition)!==JSON.stringify(form.definition||{});
    if(hasUnsavedChanges){
      setError('公開前にフォームの変更を保存してください。');
      return;
    }
    void updateStatus(form,'published');
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
    setSelectedId(form.id);setName(form.name);setFormType(form.form_type || 'diagnosis');
    setPrivacyNotice(form.privacy_notice||'');
    setDefinitionText(JSON.stringify(form.definition,null,2));
  };

  const publicUrl=(form:DiagnosisForm)=>`${window.location.origin}/f/${encodeURIComponent(form.public_slug)}`;
  const copyUrl=async(form:DiagnosisForm)=>{
    try {
      await navigator.clipboard.writeText(publicUrl(form));
      setCopiedId(form.id); window.setTimeout(()=>setCopiedId(''),1800);
    } catch { setError('URLをコピーできませんでした。URLを選択してコピーしてください。'); }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold text-white">フォーム・診断の受付管理</h2><p className="mt-1 text-xs text-slate-400">診断・相談・面談フォームの作成、公開URL、回答をまとめて管理します。</p></div>
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
        {loading?<p className="text-sm text-slate-400">読み込み中…</p>:forms.length===0?<p className="text-sm text-slate-400">フォームはまだありません。</p>:<ul className="space-y-2">{forms.map(form=><li key={form.id}>
          <button onClick={()=>selectForm(form)} className={`w-full rounded-lg border p-3 text-left ${selectedId===form.id?'border-blue-500 bg-blue-950/30':'border-slate-800 bg-slate-950 hover:bg-slate-800'}`}>
            <div className="flex justify-between gap-2"><span className="font-medium text-white">{form.name}</span><span className="text-xs text-slate-400">{FORM_TYPES.find(x=>x.value===form.form_type)?.label||'診断申込'} · {form.status}</span></div>
            <div className="mt-1 break-all text-xs text-slate-500">/{form.public_slug}</div>
          </button>
          {form.status==='published'&&<div className="mt-2 flex items-center gap-2 pl-2">
            <a href={publicUrl(form)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"><ExternalLink className="h-3 w-3"/>公開フォームを開く</a>
            <button type="button" onClick={()=>void copyUrl(form)} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">{copiedId===form.id?<ClipboardCheck className="h-3 w-3"/>:<Clipboard className="h-3 w-3"/>}{copiedId===form.id?'コピー済み':'URLをコピー'}</button>
          </div>}
        </li>)}</ul>}
        {selectedId&&<div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
          {forms.find(x=>x.id===selectedId)?.status!=='published'
            ? <button onClick={publishSelectedForm} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">公開する</button>
            : <button onClick={()=>{const f=forms.find(x=>x.id===selectedId);if(f)void updateStatus(f,'paused')}} className="rounded border border-amber-800 px-3 py-1.5 text-xs text-amber-300">受付停止</button>}
          <button onClick={()=>{const f=forms.find(x=>x.id===selectedId);if(f)void updateStatus(f,'archived')}} className="rounded border border-rose-800 px-3 py-1.5 text-xs text-rose-300">アーカイブ</button>
          <button onClick={()=>{const f=forms.find(x=>x.id===selectedId);if(f)void updateStatus(f,'draft')}} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300">下書きに戻す</button>
        </div>}
      </section>
      <form onSubmit={saveForm} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-white"><Plus className="mr-1 inline h-4 w-4"/>{selectedId?'フォーム定義を編集':'新しいフォーム定義'}</h3>{selectedId&&<button type="button" onClick={resetForm} className="text-xs text-blue-300">新規フォーム</button>}</div>
        <label className="block text-xs text-slate-400">受付の種類<select value={formType} onChange={e=>{const next=e.target.value as FormType;setFormType(next);if(!selectedId)setDefinitionText(JSON.stringify(QUESTION_EXAMPLES[next],null,2));}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{FORM_TYPES.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="block text-xs text-slate-400">フォーム名<input required value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="例：介護保険外開業診断"/></label>
        <label className="block text-xs text-slate-400">個人情報の取り扱い案内<textarea required value={privacyNotice} onChange={e=>setPrivacyNotice(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="利用目的、保管方法、問い合わせ先など"/></label>
        <label className="block text-xs text-slate-400">フォーム説明・設問（JSON）<textarea value={definitionText} onChange={e=>setDefinitionText(e.target.value)} rows={12} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"/></label>
        <p className="text-xs leading-5 text-slate-500">設問はJSONの questions に設定します。型: text / textarea / select / radio / checkbox / date。各設問に id・label・type・required を指定し、選択式には options を追加します。</p>
        <button disabled={loading} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{selectedId?'変更を保存':'下書き保存'}</button>
        <p className="text-xs text-slate-500">公開URLは「公開する」を押すと利用できます。URLをLPやLINEに掲載すると、回答は連絡先・リードに紐付き、同じメールアドレスの再申込は既存情報に追記されます。</p>
      </form>
    </div>}
    {section==='answers'&&<section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      {loading?<p className="p-4 text-sm text-slate-400">読み込み中…</p>:answers.length===0?<p className="p-6 text-center text-sm text-slate-400">フォーム回答はまだありません。</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr className="border-b border-slate-800"><th className="p-3">回答者</th><th className="p-3">フォーム</th><th className="p-3">受付日時</th><th className="p-3">状態</th><th className="p-3">確認</th></tr></thead><tbody>{answers.map(answer=><Fragment key={answer.id}><tr className="border-b border-slate-800/70"><td className="p-3 text-white">{answer.respondent_name||answer.respondent_email||'回答者未特定'}<div className="text-xs text-slate-500">{answer.respondent_email||''}</div></td><td className="p-3 text-slate-300">{forms.find(form=>form.id===answer.form_id)?.name||answer.form_id.slice(0,8)}</td><td className="p-3 text-slate-400">{new Date(answer.submitted_at).toLocaleString('ja-JP')}</td><td className="p-3 text-slate-300">{answer.status}</td><td className="p-3"><select value={answer.status} onChange={e=>void updateSubmission(answer,e.target.value as Submission['status'])} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"><option value="received">受付</option><option value="reviewing">確認中</option><option value="converted">リード紐付け済</option><option value="rejected">対象外</option></select></td></tr><tr className="border-b border-slate-800/70"><td colSpan={5} className="px-3 pb-3"><details><summary className="cursor-pointer text-xs text-blue-300">回答内容を確認</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(answer.answers,null,2)}</pre>{answer.reviewer_memo&&<p className="mt-2 text-xs text-slate-400">確認メモ: {answer.reviewer_memo}</p>}</details></td></tr></Fragment>)}</tbody></table></div>}
      <p className="border-t border-slate-800 p-3 text-xs text-slate-400">回答内容は診断・相談・面談の受付記録として保存され、連絡先とリードに紐付きます。診断結果の作成・送付は後続の工程です。</p>
    </section>}
  </div>;
};
