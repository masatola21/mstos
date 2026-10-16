import React, { Fragment, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { ArrowDown, ArrowUp, Clipboard, ClipboardCheck, ExternalLink, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

type FormType = 'diagnosis' | 'consultation' | 'meeting';
type QuestionType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date';
type FormQuestion = { id: string; label: string; type: QuestionType; required: boolean; options: string[] };
type FormDefinition = { description: string; questions: FormQuestion[] };
type DiagnosisForm = { id: string; name: string; public_slug: string; form_type: FormType; status: 'draft'|'published'|'paused'|'archived'; questionnaire_version: string; definition: Record<string, unknown>; privacy_notice: string|null; created_at: string };
type Submission = { id: string; form_id: string; contact_id: string|null; company_id: string|null; respondent_company_name: string|null; lead_id: string|null; status: 'received'|'reviewing'|'completed'|'rejected'; respondent_name: string|null; respondent_email: string|null; answers: Record<string, unknown>; score: number|null; submitted_at: string; reviewer_memo: string|null };

const DEFAULT_PRIVACY_NOTICE = 'ご入力いただいた情報は、診断・相談・面談のお申し込みへの対応および関連するご案内のために利用します。個人情報の取り扱いに関するお問い合わせは、運営者までご連絡ください。なお、この文案は初期例です。実際の利用目的・保管方法・問い合わせ先に合わせて編集してください。';
const FORM_TYPES: { value: FormType; label: string }[] = [
  { value: 'diagnosis', label: '診断申込' },
  { value: 'consultation', label: '相談申込' },
  { value: 'meeting', label: '面談申込' },
];
const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: '一行入力' },
  { value: 'textarea', label: '複数行入力' },
  { value: 'select', label: 'プルダウン選択' },
  { value: 'radio', label: '単一選択' },
  { value: 'checkbox', label: 'チェックボックス' },
  { value: 'date', label: '日付' },
];
const QUESTION_EXAMPLES: Record<FormType, FormDefinition> = {
  diagnosis: { description: '介護保険外サービスの開業準備状況をお聞かせください。回答を確認後、診断結果と相談案内をご連絡します。', questions: [
    { id: 'opening_timing', label: '開業・事業開始の希望時期', type: 'select', required: true, options: ['3か月以内', '半年以内', '1年以内', '情報収集中'] },
    { id: 'current_challenge', label: '現在、特に知りたいこと・お困りのこと', type: 'textarea', required: true, options: [] },
  ] },
  consultation: { description: 'ご相談内容をお送りください。担当者が確認し、ご連絡します。', questions: [
    { id: 'consultation_topic', label: '相談したい内容', type: 'textarea', required: true, options: [] },
  ] },
  meeting: { description: '面談のご希望をお知らせください。日程は担当者から確認のご連絡をします。', questions: [
    { id: 'meeting_date', label: '面談希望日', type: 'date', required: true, options: [] },
    { id: 'meeting_topic', label: '面談で相談したい内容', type: 'textarea', required: true, options: [] },
  ] },
};

function newQuestion(): FormQuestion {
  return { id: 'question_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), label: '', type: 'text', required: false, options: [] };
}

function readDefinition(value: Record<string, unknown> | null | undefined, formType: FormType): FormDefinition {
  const definition = value && typeof value === 'object' ? value : {};
  const rawQuestions = Array.isArray(definition.questions) ? definition.questions : [];
  const questions = rawQuestions.slice(0, 40).filter((item: any) =>
    item && typeof item === 'object' && typeof item.id === 'string' && typeof item.label === 'string'
  ).map((item: any): FormQuestion => ({
    id: item.id,
    label: item.label,
    type: QUESTION_TYPES.some((type) => type.value === item.type) ? item.type : 'text',
    required: Boolean(item.required),
    options: Array.isArray(item.options) ? item.options.filter((option: unknown): option is string => typeof option === 'string') : [],
  }));
  const fallback = QUESTION_EXAMPLES[formType];
  return {
    description: typeof definition.description === 'string' ? definition.description : fallback.description,
    questions: questions.length ? questions : fallback.questions.map((question) => ({ ...question, options: [...question.options] })),
  };
}

interface DiagnosisFormsWorkspaceProps { initialLeadId?: string; initialCompanyId?: string; initialSection?: 'forms'|'answers'; }

export const DiagnosisFormsWorkspace: React.FC<DiagnosisFormsWorkspaceProps> = ({ initialLeadId, initialCompanyId, initialSection }) => {
  const [section, setSection] = useState<'forms'|'answers'>(initialSection || (initialLeadId || initialCompanyId ? 'answers' : 'forms'));
  const [forms, setForms] = useState<DiagnosisForm[]>([]);
  const [answers, setAnswers] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [formType, setFormType] = useState<FormType>('diagnosis');
  const [description, setDescription] = useState(QUESTION_EXAMPLES.diagnosis.description);
  const [questions, setQuestions] = useState<FormQuestion[]>(QUESTION_EXAMPLES.diagnosis.questions.map((question) => ({ ...question, options: [...question.options] })));
  const [privacyNotice, setPrivacyNotice] = useState(DEFAULT_PRIVACY_NOTICE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const visibleAnswers = answers.filter((answer) =>
    (!initialLeadId || answer.lead_id === initialLeadId) &&
    (!initialCompanyId || answer.company_id === initialCompanyId)
  );

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
    setDescription(QUESTION_EXAMPLES.diagnosis.description);
    setQuestions(QUESTION_EXAMPLES.diagnosis.questions.map((question) => ({ ...question, options: [...question.options] })));
    setPrivacyNotice(DEFAULT_PRIVACY_NOTICE);
  };

  const saveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase=getSupabase();
    if(!supabase || !name.trim()) return;
    if(!questions.length){setError('設問を1つ以上追加してください。');return;}
    if(questions.some((question)=>!question.label.trim())){setError('設問文を入力してください。');return;}
    if(questions.some((question)=>(question.type==='select'||question.type==='radio')&&question.options.filter(Boolean).length<2)){setError('選択式の設問には選択肢を2つ以上入力してください。');return;}
    if(new Set(questions.map((question)=>question.id)).size!==questions.length){setError('設問IDが重複しています。');return;}
    setError(''); setNotice('');
    const definition: FormDefinition = { description: description.trim(), questions };
    const slug=(name.trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g,'-').replace(/^-|-$/g,'')||'intake')+'-'+crypto.randomUUID().slice(0,8);
    const payload = {
      name:name.trim(), form_type:formType, questionnaire_version:'v1.0', definition,
      privacy_notice:privacyNotice.trim()||null
    };
    const result = selectedId
      ? await supabase.from('diagnosis_forms').update(payload).eq('id',selectedId)
      : await supabase.from('diagnosis_forms').insert({...payload,public_slug:slug,status:'draft'});
    if(result.error){setError(result.error.message);return;}
    setNotice(selectedId ? 'フォーム定義を保存しました。' : 'フォームを下書き保存しました。フォーム一覧から選択して公開できます。');
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
    const currentDefinition: FormDefinition = { description: description.trim(), questions };
    const savedDefinition = readDefinition(form.definition, form.form_type || 'diagnosis');
    const hasUnsavedChanges=name.trim()!==form.name||formType!==(form.form_type||'diagnosis')||
      privacyNotice.trim()!==(form.privacy_notice||'')||
      JSON.stringify(currentDefinition)!==JSON.stringify(savedDefinition);
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
    const definition = readDefinition(form.definition, form.form_type || 'diagnosis');
    setSelectedId(form.id);setName(form.name);setFormType(form.form_type || 'diagnosis');
    setDescription(definition.description);setQuestions(definition.questions);
    setPrivacyNotice(form.privacy_notice||DEFAULT_PRIVACY_NOTICE);
  };

  const publicUrl=(form:DiagnosisForm)=>window.location.origin+'/f/'+encodeURIComponent(form.public_slug);
  const copyUrl=async(form:DiagnosisForm)=>{
    try {
      await navigator.clipboard.writeText(publicUrl(form));
      setCopiedId(form.id); window.setTimeout(()=>setCopiedId(''),1800);
    } catch { setError('URLをコピーできませんでした。URLを選択してコピーしてください。'); }
  };

  const updateQuestion=(index:number,patch:Partial<FormQuestion>)=>setQuestions((current)=>current.map((question,i)=>i===index?{...question,...patch}:question));
  const moveQuestion=(index:number,direction:-1|1)=>{
    setQuestions((current)=>{
      const nextIndex=index+direction;
      if(nextIndex<0||nextIndex>=current.length)return current;
      const updated=[...current];
      [updated[index],updated[nextIndex]]=[updated[nextIndex],updated[index]];
      return updated;
    });
  };
  const addQuestion=()=>{
    if(questions.length>=40){setError('設問は40個まで追加できます。');return;}
    setQuestions((current)=>[...current,newQuestion()]);
  };
  const removeQuestion=(index:number)=>setQuestions((current)=>current.filter((_,i)=>i!==index));

  const inputClass='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white';
  const labelClass='block text-xs text-slate-400';

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold text-white">フォーム・診断の受付管理</h2><p className="mt-1 text-xs text-slate-400">診断・相談・面談フォームの作成、公開URL、回答をまとめて管理します。</p></div>
      <div className="flex gap-2">
        <button onClick={()=>setSection('forms')} className={'rounded-lg px-3 py-2 text-sm '+(section==='forms'?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-800')}>フォーム設定</button>
        <button onClick={()=>setSection('answers')} className={'rounded-lg px-3 py-2 text-sm '+(section==='answers'?'bg-blue-600 text-white':'text-slate-300 hover:bg-slate-800')}>フォーム回答 ({visibleAnswers.length})</button>
        <button onClick={()=>void load()} title="更新" className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300"><RefreshCw className="h-4 w-4"/></button>
      </div>
    </div>
    {error&&<div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>}
    {notice&&<div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</div>}
    {section==='forms'&&<div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-white">フォーム一覧</h3><span className="text-xs text-slate-400">{forms.length}件</span></div>
        {loading?<p className="text-sm text-slate-400">読み込み中…</p>:forms.length===0?<p className="text-sm text-slate-400">フォームはまだありません。</p>:<ul className="space-y-2">{forms.map(form=><li key={form.id}>
          <button onClick={()=>selectForm(form)} className={'w-full rounded-lg border p-3 text-left '+(selectedId===form.id?'border-blue-500 bg-blue-950/30':'border-slate-800 bg-slate-950 hover:bg-slate-800')}>
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
      <form onSubmit={saveForm} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-white"><Plus className="mr-1 inline h-4 w-4"/>{selectedId?'フォームを編集':'新しいフォーム'}</h3>{selectedId&&<button type="button" onClick={resetForm} className="text-xs text-blue-300">新規フォーム</button>}</div>
        <label className={labelClass}>受付の種類<select value={formType} onChange={event=>{const next=event.target.value as FormType;setFormType(next);if(!selectedId){const example=QUESTION_EXAMPLES[next];setDescription(example.description);setQuestions(example.questions.map((question)=>({...question,options:[...question.options]})));}}} className={inputClass}>{FORM_TYPES.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className={labelClass}>フォーム名<input required value={name} onChange={event=>setName(event.target.value)} className={inputClass} placeholder="例：介護保険外開業診断"/></label>
        <label className={labelClass}>フォーム説明<textarea value={description} onChange={event=>setDescription(event.target.value)} rows={3} className={inputClass} placeholder="回答者に表示する説明"/></label>
        <label className={labelClass}>個人情報の取り扱い案内<textarea required value={privacyNotice} onChange={event=>setPrivacyNotice(event.target.value)} rows={3} className={inputClass} placeholder="初期文案です。実際の利用目的・保管方法・問い合わせ先に合わせて編集してください。"/></label>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold text-white">設問 ({questions.length}/40)</h4><p className="mt-1 text-xs text-slate-500">追加・編集・並べ替えができます。選択式には選択肢を設定します。</p></div><button type="button" onClick={addQuestion} className="inline-flex items-center gap-1 rounded-lg border border-blue-700 px-3 py-2 text-xs font-semibold text-blue-200"><Plus className="h-3.5 w-3.5"/>設問を追加</button></div>
          {questions.map((question,index)=><div key={question.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">設問 {index+1}</span><div className="flex items-center gap-1">
              <button type="button" disabled={index===0} onClick={()=>moveQuestion(index,-1)} aria-label="上へ移動" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4"/></button>
              <button type="button" disabled={index===questions.length-1} onClick={()=>moveQuestion(index,1)} aria-label="下へ移動" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4"/></button>
              <button type="button" onClick={()=>removeQuestion(index)} aria-label="設問を削除" className="rounded p-1.5 text-rose-300 hover:bg-rose-950"><Trash2 className="h-4 w-4"/></button>
            </div></div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>設問文<input value={question.label} onChange={event=>updateQuestion(index,{label:event.target.value})} className={inputClass} placeholder="例：開業の希望時期を教えてください"/></label>
              <label className={labelClass}>回答形式<select value={question.type} onChange={event=>updateQuestion(index,{type:event.target.value as QuestionType})} className={inputClass}>{QUESTION_TYPES.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            </div>
            {(question.type==='select'||question.type==='radio')&&<label className={'mt-3 '+labelClass}>選択肢（1行に1つ）<textarea value={question.options.join('\n')} onChange={event=>updateQuestion(index,{options:event.target.value.split('\n').map(option=>option.trim()).filter(Boolean)})} rows={3} className={inputClass} placeholder={'3か月以内\n半年以内\n1年以内'}/></label>}
            {question.type==='checkbox'&&<label className={'mt-3 '+labelClass}>チェック項目の表示<input value={question.options[0]||''} onChange={event=>updateQuestion(index,{options:event.target.value?[event.target.value]:[]})} className={inputClass} placeholder="例：該当する"/></label>}
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={question.required} onChange={event=>updateQuestion(index,{required:event.target.checked})} className="h-4 w-4 accent-blue-600"/>回答必須にする</label>
          </div>)}
        </div>
        <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h4 className="text-sm font-semibold text-white">公開画面プレビュー</h4>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{description||'フォーム説明は未入力です。'}</p>
          <div className="mt-3 space-y-2">{questions.map((question,index)=><div key={question.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3"><div className="text-xs font-medium text-slate-200">{index+1}. {question.label||'設問文を入力してください'}{question.required&&<span className="ml-1 text-rose-300">必須</span>}</div><div className="mt-1 text-xs text-slate-500">{QUESTION_TYPES.find(type=>type.value===question.type)?.label}{question.options.length?' · '+question.options.join(' / '):''}</div></div>)}</div>
        </section>
        <button disabled={loading} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{selectedId?'変更を保存':'下書き保存'}</button>
        <p className="text-xs text-slate-500">保存後、フォーム一覧から選択して公開します。URLをLPやLINEに掲載すると回答が連絡先・リードに紐付きます。</p>
      </form>
    </div>}
    {section==='answers'&&<section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      {loading?<p className="p-4 text-sm text-slate-400">読み込み中…</p>:visibleAnswers.length===0?<p className="p-6 text-center text-sm text-slate-400">フォーム回答はまだありません。</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr className="border-b border-slate-800"><th className="p-3">回答者</th><th className="p-3">フォーム</th><th className="p-3">受付日時</th><th className="p-3">状態</th><th className="p-3">確認</th></tr></thead><tbody>{visibleAnswers.map(answer=><Fragment key={answer.id}><tr className="border-b border-slate-800/70"><td className="p-3 text-white">{answer.respondent_name||answer.respondent_email||'回答者未特定'}<div className="text-xs text-slate-500">{answer.respondent_email||''}</div>{answer.respondent_company_name&&<div className="mt-1 text-xs text-sky-300">会社名・屋号: {answer.respondent_company_name}</div>}</td><td className="p-3 text-slate-300">{forms.find(form=>form.id===answer.form_id)?.name||answer.form_id.slice(0,8)}</td><td className="p-3 text-slate-400">{new Date(answer.submitted_at).toLocaleString('ja-JP')}</td><td className="p-3 text-slate-300">{answer.status}</td><td className="p-3"><select value={answer.status} onChange={event=>void updateSubmission(answer,event.target.value as Submission['status'])} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"><option value="received">受付</option><option value="reviewing">対応中</option><option value="completed">完了</option><option value="rejected">対象外</option></select></td></tr><tr className="border-b border-slate-800/70"><td colSpan={5} className="px-3 pb-3"><details><summary className="cursor-pointer text-xs text-blue-300">回答内容を確認</summary>{(() => {
              const form = forms.find(item => item.id === answer.form_id);
              const questions = readDefinition(form?.definition, form?.form_type || 'diagnosis').questions;
              const questionById = new Map(questions.map(question => [question.id, question]));
              const entries = Object.entries(answer.answers || {});
              if (!entries.length) return <p className="mt-2 text-xs text-slate-500">回答はありません。</p>;
              return <dl className="mt-2 space-y-2">{entries.map(([id, value]) => {
                const question = questionById.get(id);
                const displayValue = typeof value === 'boolean'
                  ? (value ? (question?.options[0] || 'はい') : 'いいえ')
                  : Array.isArray(value) ? value.join('、') : String(value ?? '—');
                return <div key={id} className="grid gap-1 rounded-lg border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                  <dt className="text-xs font-medium text-slate-400">{question?.label || '設問が見つかりません (' + id + ')'}</dt>
                  <dd className="whitespace-pre-wrap break-words text-sm text-slate-200">{displayValue}</dd>
                </div>;
              })}</dl>;
            })()}{answer.reviewer_memo&&<p className="mt-2 text-xs text-slate-400">確認メモ: {answer.reviewer_memo}</p>}</details></td></tr></Fragment>)}</tbody></table></div>}
      <p className="border-t border-slate-800 p-3 text-xs text-slate-400">回答内容は診断・相談・面談の受付記録として保存され、連絡先とリードに紐付きます。診断結果の作成・送付は後続の工程です。</p>
    </section>}
  </div>;
};
