import React, { Fragment, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { InlineDeleteButton } from './InlineDeleteButton';
import { ArrowDown, ArrowUp, Clipboard, ClipboardCheck, ExternalLink, Plus, RefreshCw, Save, Trash2, Sparkles, AlertCircle } from 'lucide-react';

type FormType = 'diagnosis' | 'consultation' | 'meeting';
type QuestionType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date';
type FormQuestion = { id: string; label: string; type: QuestionType; required: boolean; options: string[] };
type FormDefinition = { category?: string; description: string; booking_url?: string; questions: FormQuestion[] };
type DiagnosisForm = { id: string; name: string; public_slug: string; form_type: FormType; status: 'draft'|'published'|'paused'|'archived'; questionnaire_version: string; definition: Record<string, unknown>; privacy_notice: string|null; created_at: string };
type Submission = { id: string; form_id: string; contact_id: string|null; company_id: string|null; respondent_company_name: string|null; lead_id: string|null; diagnosis_id?: string|null; status: 'received'|'reviewing'|'completed'|'rejected'; respondent_name: string|null; respondent_email: string|null; answers: Record<string, unknown>; score: number|null; submitted_at: string; reviewer_memo: string|null };

export const MST_OFFICIAL_BOTTLENECK_QUESTIONS: FormQuestion[] = [
  {
    id: 'q_ops_bottleneck',
    label: '【業務・手作業】日々の業務で最も時間や手間を奪われている手作業・ボトルネックは何ですか？',
    type: 'radio',
    required: true,
    options: [
      '請求書・見積書等の作成やツール間の二重入力・転記作業',
      '顧客対応や連絡漏れ・対応状況の確認に追われている',
      '経営者や特定の人に仕事が集中し、属人化している',
      '情報が散乱しており、どこに何があるか探す時間が長い',
      '特に大きな手作業の負担はなく、自走できている',
    ],
  },
  {
    id: 'q_profit_bottleneck',
    label: '【売上・利益】売上と利益の現状について、最も当てはまるお悩みは何ですか？',
    type: 'radio',
    required: true,
    options: [
      '売上はある程度あるが、手元に利益が残りにくい',
      '集客から商談・フォローまでの導線が分断され、案件化が漏れている',
      '日々の業務に追われ、単価アップや利益改善の見直しに着手できていない',
      '営業や顧客獲得が経営者の人脈や属人的な力に依存している',
      '利益は順調に出ており、さらなる事業拡大・新事業を目指したい',
    ],
  },
  {
    id: 'q_delay_reason',
    label: '【改善停滞の原因】「改善したい」と思いながらも後回しになっている主な原因は何ですか？',
    type: 'radio',
    required: true,
    options: [
      '日々の現場業務や火消しに追われ、改善を考える時間がない',
      '何から手を付ければ一番効果が出るか、優先順位が分からない',
      'ツールを導入してみたが、自社の業務に合わず定着しなかった',
      '改善を伴走・相談できる右腕（パートナー）が社内外にいない',
      '計画はあるが、社内だけで実行を継続するのが難しい',
    ],
  },
  {
    id: 'q_ideal_future',
    label: '【目指したい未来】仕組み化によって経営者の時間と利益が創出できたら、何に一番時間を使いたいですか？',
    type: 'radio',
    required: true,
    options: [
      '経営判断や戦略・次の一手（新規事業や新収益源の立ち上げ）',
      '既存事業の利益率向上とマーケティング・集客の強化',
      '組織化・人材育成・権限移譲を進め、自走する組織づくり',
      '経営者自身の余白・休日の確保と健康管理',
      'まずは目の前の手作業を減らし、日々の負担を軽減したい',
    ],
  },
  {
    id: 'q_free_notes',
    label: '現在最も気になっていることや、相談したい課題があればご自由にご記入ください（任意）',
    type: 'textarea',
    required: false,
    options: [],
  },
];

const DEFAULT_PRIVACY_NOTICE = 'ご入力いただいた情報は、お問い合わせ・お申し込みへの対応および関連するご連絡のために利用します。個人情報の取り扱いに関するお問い合わせは、運営者までご連絡ください。';
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

function newQuestion(): FormQuestion {
  return { id: 'question_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), label: '', type: 'text', required: false, options: [] };
}

function readDefinition(value: Record<string, unknown> | null | undefined): FormDefinition {
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
  return {
    category: typeof definition.category === 'string' ? definition.category : typeof definition.service_category === 'string' ? definition.service_category : '',
    description: typeof definition.description === 'string' ? definition.description : '',
    booking_url: typeof definition.booking_url === 'string' ? definition.booking_url : '',
    questions: questions.length ? questions : [newQuestion()],
  };
}

interface DiagnosisFormsWorkspaceProps { initialLeadId?: string; initialCompanyId?: string; initialSection?: 'forms'|'answers'; activeSection?: 'forms'|'answers'; showHeader?: boolean; onOpenDiagnosis?: (diagnosisId: string) => void; onOpenSendCenter?: (formId: string, url: string, kind: 'form'|'diagnosis') => void; }

export const DiagnosisFormsWorkspace: React.FC<DiagnosisFormsWorkspaceProps> = ({ initialLeadId, initialCompanyId, initialSection, activeSection, showHeader = true, onOpenDiagnosis, onOpenSendCenter }) => {
  const [section, setSection] = useState<'forms'|'answers'>(initialSection || (initialLeadId || initialCompanyId ? 'answers' : 'forms'));
  const [forms, setForms] = useState<DiagnosisForm[]>([]);
  const [answers, setAnswers] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [formType, setFormType] = useState<FormType>('consultation');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([newQuestion()]);
  const [privacyNotice, setPrivacyNotice] = useState(DEFAULT_PRIVACY_NOTICE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const visibleAnswers = answers.filter((answer) =>
    (!initialLeadId || answer.lead_id === initialLeadId) &&
    (!initialCompanyId || answer.company_id === initialCompanyId)
  );

  const selectForm = (form: DiagnosisForm) => {
    const definition = readDefinition(form.definition);
    setSelectedId(form.id);
    setName(form.name);
    setCategory(definition.category || '');
    setBookingUrl(definition.booking_url || '');
    setFormType(form.form_type || 'diagnosis');
    setDescription(definition.description || '');
    setQuestions(definition.questions);
    setPrivacyNotice(form.privacy_notice || DEFAULT_PRIVACY_NOTICE);
  };

  const applyOfficialBottleneckPreset = async (autoSave = false) => {
    setName('経営課題・業務診断フォーム');
    setCategory('経営の仕組み化 × 利益改善');
    setBookingUrl('');
    setFormType('diagnosis');
    setDescription('貴社の現状の経営課題（業務の手作業・売上利益・改善停滞原因・経営者の時間）のボトルネックを特定し、仕組み化と利益改善に向けた最適なロードマップを作成するための診断フォームです。');
    setQuestions(MST_OFFICIAL_BOTTLENECK_QUESTIONS);
    setPrivacyNotice(DEFAULT_PRIVACY_NOTICE);

    if (autoSave) {
      const supabase = getSupabase();
      if (!supabase) { setError('Supabaseに接続してください。'); return; }
      setLoading(true); setError(''); setNotice('');
      try {
        const payload = {
          name: '経営課題・業務診断フォーム',
          form_type: 'diagnosis' as FormType,
          questionnaire_version: 'v2.0-bottleneck',
          definition: {
            category: '経営の仕組み化 × 利益改善',
            description: '貴社の現状の経営課題（業務の手作業・売上利益・改善停滞原因・経営者の時間）のボトルネックを特定し、仕組み化と利益改善に向けた最適なロードマップを作成するための診断フォームです。',
            booking_url: bookingUrl.trim(),
            questions: MST_OFFICIAL_BOTTLENECK_QUESTIONS,
          },
          privacy_notice: DEFAULT_PRIVACY_NOTICE,
        };
        const slug = 'business-diagnosis';
        const result = selectedId
          ? await supabase.from('diagnosis_forms').update(payload).eq('id', selectedId)
          : await supabase.from('diagnosis_forms').insert({ ...payload, public_slug: slug, status: 'published' });
        if (result.error) throw result.error;
        setNotice('営業資料準拠の最新ボトルネック診断設問を保存しました。');
        await load();
      } catch (e: any) {
        setError(e?.message || '保存できませんでした。');
      } finally {
        setLoading(false);
      }
    } else {
      setNotice('営業資料準拠の最新設問（4大ボトルネック＋自由記述）を編集欄に反映しました。「変更を保存」ボタンを押して確定してください。');
    }
  };

  const resetForm = () => {
    setSelectedId('');
    setName('');
    setCategory('');
    setFormType('consultation');
    setDescription('');
    setBookingUrl('');
    setQuestions([newQuestion()]);
    setPrivacyNotice(DEFAULT_PRIVACY_NOTICE);
  };

  const load = async () => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabaseに接続してください。'); return; }
    setLoading(true); setError('');
    try {
      const [formResult, answerResult] = await Promise.all([
        supabase.from('diagnosis_forms').select('*').order('created_at', { ascending: false }),
        supabase.from('diagnosis_submissions').select('*').order('submitted_at', { ascending: false }).limit(200),
      ]);
      if (formResult.error) throw formResult.error;
      if (answerResult.error) throw answerResult.error;
      const loadedForms = (formResult.data || []) as DiagnosisForm[];
      setForms(loadedForms);
      if (selectedId) {
        const stillSelected = loadedForms.find((f) => f.id === selectedId);
        if (stillSelected) selectForm(stillSelected);
        else resetForm();
      } else if (loadedForms.length > 0) {
        selectForm(loadedForms[0]);
      }
      setAnswers((answerResult.data || []) as Submission[]);
    } catch (e: any) {
      setError(e?.message || 'フォーム・回答を読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (activeSection) setSection(activeSection); }, [activeSection]);

  const saveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !name.trim()) return;
    if (!questions.length) { setError('設問を1つ以上追加してください。'); return; }
    if (questions.some((question) => !question.label.trim())) { setError('設問文を入力してください。'); return; }
    if (questions.some((question) => (question.type === 'select' || question.type === 'radio') && question.options.filter(Boolean).length < 2)) {
      setError('選択式の設問には選択肢を2つ以上入力してください。'); return;
    }
    if (new Set(questions.map((question) => question.id)).size !== questions.length) { setError('設問IDが重複しています。'); return; }
    setError(''); setNotice('');
    const definition: FormDefinition = {
      category: category.trim(),
      description: description.trim(),
      booking_url: bookingUrl.trim(),
      questions,
    };
    const slug = (name.trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-').replace(/^-|-$/g, '') || 'form') + '-' + crypto.randomUUID().slice(0, 8);
    const payload = {
      name: name.trim(),
      form_type: formType,
      questionnaire_version: 'v1.0',
      definition,
      privacy_notice: privacyNotice.trim() || null,
    };
    const result = selectedId
      ? await supabase.from('diagnosis_forms').update(payload).eq('id', selectedId)
      : await supabase.from('diagnosis_forms').insert({ ...payload, public_slug: slug, status: 'draft' });
    if (result.error) { setError(result.error.message); return; }
    setNotice(selectedId ? 'フォーム定義を保存しました。' : 'フォームを下書き保存しました。フォーム一覧から選択して公開できます。');
    await load();
  };

  const updateStatus = async (form: DiagnosisForm, status: DiagnosisForm['status']) => {
    const supabase = getSupabase(); if (!supabase) return;
    if (status === 'published' && !form.privacy_notice?.trim()) {
      setError('公開する前にフォームを編集し、個人情報の取り扱い案内を保存してください。');
      return;
    }
    setError(''); setNotice('');
    const { error: updateError } = await supabase.from('diagnosis_forms').update({ status, published_at: status === 'published' ? new Date().toISOString() : null }).eq('id', form.id);
    if (updateError) { setError(updateError.message); return; }
    setNotice(status === 'published' ? 'フォームを公開しました。公開URLをコピーしてLPやLINEに掲載できます。' : status === 'paused' ? 'フォーム受付を停止しました。' : 'フォーム状態を更新しました。');
    await load();
  };

  const publishSelectedForm = () => {
    const form = forms.find(item => item.id === selectedId);
    if (!form) return;
    const currentDefinition: FormDefinition = { category: category.trim(), description: description.trim(), questions };
    const savedDefinition = readDefinition(form.definition);
    const hasUnsavedChanges = name.trim() !== form.name || formType !== (form.form_type || 'diagnosis') ||
      privacyNotice.trim() !== (form.privacy_notice || '') ||
      JSON.stringify(currentDefinition) !== JSON.stringify(savedDefinition);
    if (hasUnsavedChanges) {
      setError('公開前にフォームの変更を保存してください。');
      return;
    }
    void updateStatus(form, 'published');
  };

  const deleteSelectedForm = async () => {
    const form = forms.find(item => item.id === selectedId);
    if (!form) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setError(''); setNotice('');
    const { data: deleted, error: delError } = await supabase.from('diagnosis_forms').delete().eq('id', form.id).select('id').maybeSingle();
    if (delError) {
      setError('フォームを削除できませんでした: ' + delError.message);
      return;
    }
    if (!deleted) { setError('削除対象が見つからないか、削除権限がありません。'); return; }
    setNotice(`フォーム「${form.name}」を削除しました。`);
    resetForm();
    await load();
  };

  const updateSubmission = async (submission: Submission, status: Submission['status']) => {
    const supabase = getSupabase(); if (!supabase) return;
    setError('');
    const { error: updateError } = await supabase.from('diagnosis_submissions').update({
      status, reviewed_at: new Date().toISOString(),
    }).eq('id', submission.id);
    if (updateError) { setError(updateError.message); return; }
    await load();
  };

  const publicUrl = (form: DiagnosisForm) => window.location.origin + '/f/' + encodeURIComponent(form.public_slug);
  const copyUrl = async (form: DiagnosisForm) => {
    try {
      await navigator.clipboard.writeText(publicUrl(form));
      setCopiedId(form.id); window.setTimeout(() => setCopiedId(''), 1800);
    } catch { setError('URLをコピーできませんでした。URLを選択してコピーしてください。'); }
  };

  const updateQuestion = (index: number, patch: Partial<FormQuestion>) => setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...patch } : question));
  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  };
  const addQuestion = () => {
    if (questions.length >= 40) { setError('設問は40個まで追加できます。'); return; }
    setQuestions((current) => [...current, newQuestion()]);
  };
  const removeQuestion = (index: number) => setQuestions((current) => current.filter((_, i) => i !== index));

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white';
  const labelClass = 'block text-xs text-slate-400';

  return (
    <div className="space-y-4">
      {showHeader && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div><h2 className="font-bold text-white">フォーム・診断の受付管理</h2><p className="mt-1 text-xs text-slate-400">フォーム名・設問・説明文を自由に作成・管理できます。</p></div>
        <div className="flex gap-2">
          <button onClick={() => setSection('forms')} className={'rounded-lg px-3 py-2 text-sm ' + (section === 'forms' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800')}>フォーム設定</button>
          <button onClick={() => setSection('answers')} className={'rounded-lg px-3 py-2 text-sm ' + (section === 'answers' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800')}>フォーム回答 ({visibleAnswers.length})</button>
          <button onClick={() => void load()} title="更新" className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>}
      {error && <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</div>}
      {section === 'forms' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">フォーム一覧</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{forms.length}件</span>
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500">
                  <Plus className="h-3 w-3" />新規作成
                </button>
              </div>
            </div>
            {loading ? (
              <p className="text-sm text-slate-400">読み込み中…</p>
            ) : forms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400">
                フォームはまだ登録されていません。右側の入力欄から新規作成してください。
              </div>
            ) : (
              <ul className="space-y-2">
                {forms.map(form => (
                  <li key={form.id}>
                    <button onClick={() => selectForm(form)} className={'w-full rounded-lg border p-3 text-left ' + (selectedId === form.id ? 'border-blue-500 bg-blue-950/30' : 'border-slate-800 bg-slate-950 hover:bg-slate-800')}>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-white">{form.name}</span>
                        <div className="flex items-center gap-1.5">
                          {((form.form_type === 'diagnosis' || form.name.includes('診断')) && !readDefinition(form.definition).questions.some((q) => q.id === 'q_ops_bottleneck')) && (
                            <span className="rounded border border-amber-600/50 bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">最新化推奨</span>
                          )}
                          <span className="text-xs text-slate-400">{FORM_TYPES.find(x => x.value === form.form_type)?.label || '診断申込'} · {form.status}</span>
                        </div>
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-500">/{form.public_slug}</div>
                    </button>
                    {form.status === 'published' && (
                      <div className="mt-2 flex items-center gap-2 pl-2">
                        <a href={publicUrl(form)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200">
                          <ExternalLink className="h-3 w-3" />公開フォームを開く
                        </a>
                        <button type="button" onClick={() => void copyUrl(form)} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">
                          {copiedId === form.id ? <ClipboardCheck className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
                          {copiedId === form.id ? 'コピー済み' : 'URLをコピー'}
                        </button>
                        <button type="button" onClick={() => onOpenSendCenter?.(form.id, publicUrl(form), form.form_type === 'diagnosis' ? 'diagnosis' : 'form')} className="rounded bg-indigo-700 px-2 py-1 text-xs text-white">送信センターで案内</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {selectedId && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                {forms.find(x => x.id === selectedId)?.status !== 'published' ? (
                  <button type="button" onClick={publishSelectedForm} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">公開する</button>
                ) : (
                  <button type="button" onClick={() => { const f = forms.find(x => x.id === selectedId); if (f) void updateStatus(f, 'paused'); }} className="rounded border border-amber-800 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-950/50">受付停止</button>
                )}
                <button type="button" onClick={() => { const f = forms.find(x => x.id === selectedId); if (f) void updateStatus(f, 'archived'); }} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">アーカイブ</button>
                <button type="button" onClick={() => { const f = forms.find(x => x.id === selectedId); if (f) void updateStatus(f, 'draft'); }} className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">下書きに戻す</button>
                <InlineDeleteButton onConfirm={()=>void deleteSelectedForm()} warning={`フォーム「${forms.find(item => item.id === selectedId)?.name || ''}」を完全に削除しますか？この操作は取り消せません。`} confirmLabel="フォーム削除を確定" className="rounded border border-rose-800 bg-rose-950/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900/60">フォームを削除</InlineDeleteButton>
              </div>
            )}
          </section>

          <form onSubmit={saveForm} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-white">
                <Plus className="mr-1 inline h-4 w-4" />{selectedId ? 'フォームを編集' : '新しいフォームを作成'}
              </h3>
              {selectedId && (
                <button type="button" onClick={resetForm} className="text-xs text-blue-300 hover:underline">新規フォームを作成</button>
              )}
            </div>

            {formType === 'diagnosis' && (
            <div className="rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-bold text-sky-200 text-sm">
                    <Sparkles className="h-4 w-4 text-sky-400" />
                    営業資料準拠：経営の仕組み化 × 利益改善 ボトルネック診断（公式プリセット）
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    日々の手作業・売上利益・改善停滞原因・目指したい未来の4大ボトルネックを特定する最新設問構成です。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyOfficialBottleneckPreset(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/50 bg-sky-900/60 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-800 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    編集欄に反映
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyOfficialBottleneckPreset(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition"
                  >
                    <Save className="h-3.5 w-3.5" />
                    反映して即時保存
                  </button>
                </div>
              </div>
            </div>

            )}

            {formType === 'diagnosis' && !questions.some((q) => q.id === 'q_ops_bottleneck') && (
              <div className="rounded-lg border border-amber-600/60 bg-amber-950/40 p-3 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>現在の設問は旧構成です。「反映して即時保存」を押すと、営業資料に合わせた最新ボトルネック設問（4問＋自由記述）に一括更新されます。</span>
                </div>
                <button
                  type="button"
                  onClick={() => void applyOfficialBottleneckPreset(true)}
                  className="rounded bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-500 transition shadow"
                >
                  今すぐ更新して保存
                </button>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>受付の種類
                <select value={formType} onChange={event => setFormType(event.target.value as FormType)} className={inputClass}>
                  {FORM_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label className={labelClass}>サービス区分・上部ラベル（任意）
                <input value={category} onChange={event => setCategory(event.target.value)} className={inputClass} placeholder="例：経営の仕組み化 × 利益改善" />
              </label>
            </div>

            <label className={labelClass}>個別面談の予約カレンダーURL（任意・Spir / TimeRex / Calendly など）
              <input value={bookingUrl} onChange={event => setBookingUrl(event.target.value)} className={inputClass} placeholder="例：https://app.spirbot.com/... または https://timerex.net/..." />
              <span className="text-xs text-slate-500">設定すると、診断回答完了後の速報サンクスページに「面談日時を選ぶ（予約する）」ボタンとして表示されます。</span>
            </label>

            <label className={labelClass}>フォーム名 <span className="text-rose-400">*</span>
              <input required value={name} onChange={event => setName(event.target.value)} className={inputClass} placeholder="例：業務ヒアリングフォーム、初回相談受付" />
            </label>

            <label className={labelClass}>フォーム説明（任意）
              <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} className={inputClass} placeholder="回答者に表示する説明文を入力してください" />
            </label>

            <label className={labelClass}>個人情報の取り扱い案内 <span className="text-rose-400">*</span>
              <textarea required value={privacyNotice} onChange={event => setPrivacyNotice(event.target.value)} rows={3} className={inputClass} placeholder="個人情報の取り扱いに関する方針を入力してください" />
            </label>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-white">設問 ({questions.length}/40)</h4>
                  <p className="mt-1 text-xs text-slate-500">設問文、形式、選択肢、必須フラグを自由に設定できます。</p>
                </div>
                <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1 rounded-lg border border-blue-700 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-900/40">
                  <Plus className="h-3.5 w-3.5" />設問を追加
                </button>
              </div>

              {questions.map((question, index) => (
                <div key={question.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">設問 {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)} aria-label="上へ移動" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)} aria-label="下へ移動" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" disabled={questions.length <= 1} onClick={() => removeQuestion(index)} aria-label="設問を削除" className="rounded p-1.5 text-rose-300 hover:bg-rose-950 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={labelClass}>設問文 <span className="text-rose-400">*</span>
                      <input value={question.label} onChange={event => updateQuestion(index, { label: event.target.value })} className={inputClass} placeholder="設問文を入力してください" />
                    </label>
                    <label className={labelClass}>回答形式
                      <select value={question.type} onChange={event => updateQuestion(index, { type: event.target.value as QuestionType })} className={inputClass}>
                        {QUESTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </label>
                  </div>
                  {(question.type === 'select' || question.type === 'radio') && (
                    <label className={'mt-3 ' + labelClass}>選択肢（1行に1つ） <span className="text-rose-400">*</span>
                      <textarea value={question.options.join('\n')} onChange={event => updateQuestion(index, { options: event.target.value.split('\n').map(option => option.trim()).filter(Boolean) })} rows={3} className={inputClass} placeholder={'選択肢1\n選択肢2\n選択肢3'} />
                    </label>
                  )}
                  {question.type === 'checkbox' && (
                    <label className={'mt-3 ' + labelClass}>チェック項目の表示名
                      <input value={question.options[0] || ''} onChange={event => updateQuestion(index, { options: event.target.value ? [event.target.value] : [] })} className={inputClass} placeholder="例：該当する / 同意する" />
                    </label>
                  )}
                  <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={question.required} onChange={event => updateQuestion(index, { required: event.target.checked })} className="h-4 w-4 accent-blue-600" />
                    回答必須にする
                  </label>
                </div>
              ))}
            </div>

            <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">公開画面プレビュー</h4>
                {category && <span className="rounded border border-sky-800 bg-sky-950 px-2 py-0.5 text-xs text-sky-300">{category}</span>}
              </div>
              <div className="mt-2 text-base font-bold text-white">{name || '（フォーム名未設定）'}</div>
              {description ? (
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{description}</p>
              ) : (
                <p className="mt-2 text-xs italic text-slate-600">説明文は未設定です。</p>
              )}
              <div className="mt-3 space-y-2">
                {questions.map((question, index) => (
                  <div key={question.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <div className="text-xs font-medium text-slate-200">
                      {index + 1}. {question.label || '設問文未入力'}
                      {question.required && <span className="ml-1 text-rose-300">必須</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {QUESTION_TYPES.find(type => type.value === question.type)?.label}
                      {question.options.length ? ' · ' + question.options.join(' / ') : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <button disabled={loading} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50">
              <Save className="h-4 w-4" />{selectedId ? '変更を保存' : '下書き保存'}
            </button>
            <p className="text-xs text-slate-500">保存後、フォーム一覧から「公開する」を選択すると公開URLが発行されます。</p>
          </form>
        </div>
      )}

      {section === 'answers' && (
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {loading ? (
            <p className="p-4 text-sm text-slate-400">読み込み中…</p>
          ) : visibleAnswers.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">フォーム回答はまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="p-3">回答者</th>
                    <th className="p-3">フォーム</th>
                    <th className="p-3">受付日時</th>
                    <th className="p-3">状態</th>
                    <th className="p-3">確認</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAnswers.map(answer => (
                    <Fragment key={answer.id}>
                      <tr className="border-b border-slate-800/70">
                        <td className="p-3 text-white">
                          {answer.respondent_name || answer.respondent_email || '回答者未特定'}
                          <div className="text-xs text-slate-500">{answer.respondent_email || ''}</div>
                          {answer.respondent_company_name && <div className="mt-1 text-xs text-sky-300">会社名・屋号: {answer.respondent_company_name}</div>}
                        </td>
                        <td className="p-3 text-slate-300">
                          {forms.find(form => form.id === answer.form_id)?.name || answer.form_id.slice(0, 8)}
                          <div className="mt-1 text-xs">
                            {answer.diagnosis_id ? (
                              <button type="button" onClick={() => onOpenDiagnosis?.(answer.diagnosis_id!)} className="text-sky-300 underline hover:text-sky-200">診断を開く</button>
                            ) : forms.find(form => form.id === answer.form_id)?.form_type === 'diagnosis' ? (
                              <span className="text-amber-300">{answer.company_id ? '診断未作成' : '会社未紐付け'}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 text-slate-400">{new Date(answer.submitted_at).toLocaleString('ja-JP')}</td>
                        <td className="p-3 text-slate-300">{answer.status}</td>
                        <td className="p-3">
                          <select value={answer.status} onChange={event => void updateSubmission(answer, event.target.value as Submission['status'])} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white">
                            <option value="received">受付</option>
                            <option value="reviewing">対応中</option>
                            <option value="completed">完了</option>
                            <option value="rejected">対象外</option>
                          </select>
                        </td>
                      </tr>
                      <tr className="border-b border-slate-800/70">
                        <td colSpan={5} className="px-3 pb-3">
                          <details>
                            <summary className="cursor-pointer text-xs text-blue-300">回答内容を確認</summary>
                            {(() => {
                              const form = forms.find(item => item.id === answer.form_id);
                              const questions = readDefinition(form?.definition).questions;
                              const questionById = new Map(questions.map(question => [question.id, question]));
                              const entries = Object.entries(answer.answers || {});
                              if (!entries.length) return <p className="mt-2 text-xs text-slate-500">回答はありません。</p>;
                              return (
                                <dl className="mt-2 space-y-2">
                                  {entries.map(([id, value]) => {
                                    const question = questionById.get(id);
                                    const displayValue = typeof value === 'boolean'
                                      ? (value ? (question?.options[0] || 'はい') : 'いいえ')
                                      : Array.isArray(value) ? value.join('、') : String(value ?? '—');
                                    return (
                                      <div key={id} className="grid gap-1 rounded-lg border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                                        <dt className="text-xs font-medium text-slate-400">{question?.label || '設問 (' + id + ')'}</dt>
                                        <dd className="whitespace-pre-wrap break-words text-sm text-slate-200">{displayValue}</dd>
                                      </div>
                                    );
                                  })}
                                </dl>
                              );
                            })()}
                            {answer.reviewer_memo && <p className="mt-2 text-xs text-slate-400">確認メモ: {answer.reviewer_memo}</p>}
                          </details>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-slate-800 p-3 text-xs text-slate-400">診断フォームの回答は、対象会社が紐付いている場合に「未確認」の診断として自動作成されます。回答行の「診断を開く」から内容を確認できます。会社を特定できない回答は受付記録に保持します。</p>
        </section>
      )}
    </div>
  );
};
