import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

type FormType = 'diagnosis' | 'consultation' | 'meeting';
type Question = { id: string; label: string; type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date'; required?: boolean; options?: string[] };
type PublicForm = { name: string; formType: FormType; definition: Record<string, unknown>; privacyNotice: string };

const TYPE_LABELS: Record<FormType, string> = {
  diagnosis: '開業診断',
  consultation: '相談申込',
  meeting: '面談申込',
};
const DEFAULT_QUESTIONS: Record<FormType, Question[]> = {
  diagnosis: [
    { id: 'opening_timing', label: '開業・事業開始の希望時期', type: 'select', required: true, options: ['3か月以内', '半年以内', '1年以内', '情報収集中'] },
    { id: 'current_challenge', label: '現在、特に知りたいこと・お困りのこと', type: 'textarea', required: true },
  ],
  consultation: [
    { id: 'consultation_topic', label: '相談したい内容', type: 'textarea', required: true },
  ],
  meeting: [
    { id: 'meeting_date', label: '面談希望日', type: 'date', required: true },
    { id: 'meeting_topic', label: '面談で相談したい内容', type: 'textarea', required: true },
  ],
};

function parseQuestions(value: unknown, formType: FormType): Question[] {
  if (!Array.isArray(value)) return DEFAULT_QUESTIONS[formType];
  const questions = value.filter((item): item is Question =>
    Boolean(item && typeof item === 'object' &&
      typeof (item as Question).id === 'string' &&
      typeof (item as Question).label === 'string' &&
      ['text', 'textarea', 'select', 'radio', 'checkbox', 'date'].includes((item as Question).type))
  ).slice(0, 40);
  return questions.length ? questions : DEFAULT_QUESTIONS[formType];
}

export const PublicIntakeForm: React.FC<{ slug: string }> = ({ slug }) => {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/forms/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'フォームを表示できません。');
        if (!cancelled) setForm(payload.form as PublicForm);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'フォームを読み込めませんでした。'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const formType = form?.formType || 'diagnosis';
  const questions = useMemo(() => parseQuestions(form?.definition?.questions, formType), [form, formType]);
  const intro = typeof form?.definition?.description === 'string' ? form.definition.description : '';

  const updateAnswer = (id: string, value: string | boolean) => setAnswers((current) => ({ ...current, [id]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || submitting) return;
    setSubmitting(true);
    setError('');
    const query = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ['source', 'utm_source', 'utm_medium', 'utm_campaign']) {
      const value = query.get(key);
      if (value) utm[key] = value.slice(0, 120);
    }
    try {
      const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId, name, email, phone, answers, privacyAgreed, utm,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || '送信できませんでした。入力内容をご確認ください。');
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '送信できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100';
  const questionClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 rounded-3xl bg-gradient-to-br from-sky-900 to-slate-900 p-7 text-white shadow-lg sm:p-10">
          <p className="text-sm font-semibold tracking-wide text-sky-200">介護保険外開業パッケージ</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{form?.name || 'お申し込みフォーム'}</h1>
          {intro && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{intro}</p>}
          {form && <span className="mt-5 inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs text-sky-100">{TYPE_LABELS[form.formType]}</span>}
        </header>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500"><Loader2 className="mx-auto h-6 w-6 animate-spin"/><p className="mt-3">フォームを読み込んでいます…</p></div>
        ) : error && !form ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-700">{error}</div>
        ) : submitted ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600"/>
            <h2 className="mt-4 text-xl font-bold text-slate-900">お申し込みを受け付けました</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">ご入力いただいた内容を担当者が確認します。診断フォームの場合、診断結果と相談案内は確認後にご連絡します。</p>
          </section>
        ) : form ? (
          <form onSubmit={submit} className="space-y-4">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-slate-900">お客様情報</h2>
              <label className="block text-sm font-medium text-slate-700">お名前 <span className="text-rose-600">*</span><input required autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={inputClass}/></label>
              <label className="block text-sm font-medium text-slate-700">メールアドレス <span className="text-rose-600">*</span><input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass}/><span className="mt-1 block text-xs font-normal text-slate-500">既にご登録がある場合、同じメールアドレスで情報を紐付けます。</span></label>
              <label className="block text-sm font-medium text-slate-700">電話番号<input type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass}/></label>
            </section>

            {questions.map((question) => (
              <section key={question.id} className={questionClass}>
                <label className="block text-sm font-semibold text-slate-800">{question.label}{question.required && <span className="ml-1 text-rose-600">*</span>}</label>
                {question.type === 'textarea' ? (
                  <textarea required={Boolean(question.required)} maxLength={4000} rows={4} value={String(answers[question.id] || '')} onChange={(event) => updateAnswer(question.id, event.target.value)} className={inputClass}/>
                ) : question.type === 'select' ? (
                  <select required={Boolean(question.required)} value={String(answers[question.id] || '')} onChange={(event) => updateAnswer(question.id, event.target.value)} className={inputClass}><option value="">選択してください</option>{(question.options || []).slice(0, 30).map((option) => <option key={option} value={option}>{option}</option>)}</select>
                ) : question.type === 'radio' ? (
                  <div className="mt-3 space-y-2">{(question.options || []).slice(0, 30).map((option) => <label key={option} className="flex items-center gap-3 text-sm text-slate-700"><input required={Boolean(question.required) && !answers[question.id]} type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => updateAnswer(question.id, option)} className="h-4 w-4 accent-sky-700"/>{option}</label>)}</div>
                ) : question.type === 'checkbox' ? (
                  <label className="mt-3 flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={answers[question.id] === true} onChange={(event) => updateAnswer(question.id, event.target.checked)} className="h-4 w-4 accent-sky-700"/>{(question.options || ['該当する']).join('・')}</label>
                ) : (
                  <input required={Boolean(question.required)} type={question.type === 'date' ? 'date' : 'text'} maxLength={4000} value={String(answers[question.id] || '')} onChange={(event) => updateAnswer(question.id, event.target.value)} className={inputClass}/>
                )}
              </section>
            ))}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-slate-900">個人情報の取り扱い</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{form.privacyNotice || '入力内容は、お申し込みへの対応および関連するご案内のために利用します。'}</p>
              <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700"><input required type="checkbox" checked={privacyAgreed} onChange={(event) => setPrivacyAgreed(event.target.checked)} className="mt-1 h-4 w-4 accent-sky-700"/><span>個人情報の取り扱いに同意します <span className="text-rose-600">*</span></span></label>
            </section>
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-800 px-5 py-4 text-base font-bold text-white shadow transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60"><Send className="h-4 w-4"/>{submitting ? '送信中…' : '入力内容を送信する'}</button>
            <p className="text-center text-xs text-slate-500">診断・相談・面談のお申し込みはリードとして登録され、担当者が内容を確認します。</p>
          </form>
        ) : null}
        <footer className="mt-8 text-center text-xs text-slate-500">MST 経営支援システム</footer>
      </div>
    </main>
  );
};
