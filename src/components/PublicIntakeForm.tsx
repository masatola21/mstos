import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Send, Lock, Calendar, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

type FormType = 'diagnosis' | 'consultation' | 'meeting';
type Question = { id: string; label: string; type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date'; required?: boolean; options?: string[] };
type PublicForm = { name: string; formType: FormType; definition: Record<string, unknown>; privacyNotice: string; bookingPageUrl?: string };

const TYPE_LABELS: Record<FormType, string> = {
  diagnosis: '診断受付',
  consultation: '相談受付',
  meeting: '面談受付',
};

function parseQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Question =>
    Boolean(item && typeof item === 'object' &&
      typeof (item as Question).id === 'string' &&
      typeof (item as Question).label === 'string' &&
      ['text', 'textarea', 'select', 'radio', 'checkbox', 'date'].includes((item as Question).type))
  ).slice(0, 40);
}


function analyzeBottleneck(answers: Record<string, string | boolean>) {
  const ops = String(answers.q_ops_bottleneck || '');
  const profit = String(answers.q_profit_bottleneck || '');
  const delay = String(answers.q_delay_reason || '');

  if (ops.includes('請求書') || ops.includes('二重入力') || ops.includes('属人化') || ops.includes('顧客対応') || ops.includes('散乱')) {
    return {
      typeTitle: '経営者の現場拘束 ＆ 事務手作業・属人化タイプ',
      badge: '業務・手作業の急所',
      summary: '売上はあるものの、請求書や見積書の手作業、顧客対応、特定の人への属人化に時間を奪われ、経営者が「次の一手」を打つ時間が月20〜30時間流出している可能性が高い状態です。',
      urgentAction: 'まずは請求・転記・顧客連絡の重複入力を自動化し、経営者ご自身の「改善を考える時間」を真っ先に創出することが最優先課題です。',
    };
  }
  if (profit.includes('残りにくい') || profit.includes('分断') || profit.includes('単価') || profit.includes('依存')) {
    return {
      typeTitle: '利益流出 ＆ 集客〜成約導線分断タイプ',
      badge: '売上・利益の急所',
      summary: '集客から商談・フォローまでの一連の流れが分断されているか、単価・コストの見直しが進んでいないため、売上規模に対して手元に残る利益が削られている可能性が高い状態です。',
      urgentAction: '集客・商談・顧客フォローを自動でつなぐ導線構築と、利益率を高める経営戦略の見直しが急所となります。',
    };
  }
  if (delay.includes('火消し') || delay.includes('優先順位') || delay.includes('定着') || delay.includes('右腕')) {
    return {
      typeTitle: '改善後回し ＆ 優先順位停滞タイプ',
      badge: '改善実行の急所',
      summary: '「改善したい」と思いながらも日々の現場対応や火消しに追われ、どこから手を付ければ一番効果が出るのか優先順位が決まらず、改善が後回しになっている状態です。',
      urgentAction: 'あれこれ手を広げず、一番利益インパクトの大きい急所から小さく着手し、確実に定着させる伴走パートナーが必要です。',
    };
  }
  return {
    typeTitle: '経営の仕組み化 ＆ 次の一手着手タイプ',
    badge: '事業成長ステージ',
    summary: '現状の事業基盤を活かしながら、経営者が現場作業から完全に離れ、新規事業や新収益源の創出・自走組織づくりへとシフトするタイミングです。',
    urgentAction: '属人化を排した仕組み化と、継続的な利益改善ロードマップの策定が次のステージへの鍵となります。',
  };
}

export const PublicIntakeForm: React.FC<{ slug: string }> = ({ slug }) => {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
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
  const category = typeof form?.definition?.category === 'string'
    ? (form.definition.category as string).trim()
    : typeof form?.definition?.service_category === 'string'
      ? (form.definition.service_category as string).trim()
      : '';
  const questions = useMemo(() => parseQuestions(form?.definition?.questions), [form]);
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
          requestId, name, companyName, email, phone, answers, privacyAgreed, utm,
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
          {category ? (
            <p className="text-sm font-semibold tracking-wide text-sky-200">{category}</p>
          ) : null}
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{form?.name || 'お申し込みフォーム'}</h1>
          {intro ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{intro}</p> : null}
          {form && <span className="mt-5 inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs text-sky-100">{TYPE_LABELS[form.formType] || 'フォーム受付'}</span>}
        </header>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500"><Loader2 className="mx-auto h-6 w-6 animate-spin"/><p className="mt-3">フォームを読み込んでいます…</p></div>
        ) : error && !form ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-700">{error}</div>
        ) : submitted ? (
          form?.formType === 'diagnosis' ? (() => {
            const result = analyzeBottleneck(answers);
            const rawBookingUrl = form?.bookingPageUrl || (typeof form?.definition?.booking_url === 'string' ? form.definition.booking_url : '');
            let targetBookingUrl = rawBookingUrl.trim();
            if (targetBookingUrl) {
              const delim = targetBookingUrl.includes('?') ? '&' : '?';
              targetBookingUrl += delim + 'name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
            }

            return (
              <div className="space-y-6">
                {/* 1. 速報ヘッダー */}
                <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-6 text-white shadow-xl sm:p-8">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    診断回答の受付完了 ＆ 簡易速報
                  </div>
                  <h2 className="mt-3 text-xl font-extrabold sm:text-2xl">
                    ご回答ありがとうございました！<br />
                    貴社の<span className="text-sky-300">「ボトルネック速報判定」</span>が出ました
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    ご入力いただいた回答をもとに、現状の改善テーマを即時分類いたしました。
                  </p>
                </section>

                {/* 2. チラ見せ速報カード */}
                <section className="rounded-3xl border border-amber-200/80 bg-white p-6 shadow-md sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-400">【簡易診断結果速報】</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{result.badge}</span>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-500">貴社の最優先ボトルネック傾向：</p>
                    <h3 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl text-rose-600">
                      🚨 {result.typeTitle}
                    </h3>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700 sm:text-sm">
                    {result.summary}
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 leading-5">
                    <strong>💡 直近の改善指針:</strong> {result.urgentAction}
                  </div>
                </section>

                {/* 3. 鍵マーク・完全版レポートの予告 */}
                <section className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-md sm:p-8">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                    <Lock className="h-4 w-4" />
                    完全版レポートの内容（個別フィードバック面談にて限定公開・進呈）
                  </div>
                  <h4 className="mt-2 text-base font-bold text-white sm:text-lg">
                    以下の「具体的な処方箋」は、個別面談にて解説いたします
                  </h4>
                  <div className="mt-4 space-y-2.5">
                    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 sm:text-sm">
                      <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                      <span>🏢 <strong>会社と経営者の未来像（Before & After）</strong>：現場解放後の時間の使い方</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 sm:text-sm">
                      <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                      <span>🗺️ <strong>継続的な改善ロードマップ（Phase 1〜3）</strong>：手作業解消から新事業自走化まで</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 sm:text-sm">
                      <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                      <span>⚙️ <strong>推奨伴走プラン ＆ ツール自動化設計</strong>：御社に最適な具体的一手</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-400 leading-4">
                    ※机上の空論を避けるため、専任コンサルタントが貴社の個別事情をふまえてレポートを仕上げ、面談にてお渡しいたします。
                  </p>
                </section>

                {/* 4. 面談予約 CTA */}
                <section className="rounded-3xl border-2 border-blue-500 bg-white p-6 text-center shadow-xl sm:p-8">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-bold text-blue-800">
                    <Sparkles className="h-3.5 w-3.5" />
                    オンラインZoom（30分・無料）
                  </span>
                  <h3 className="mt-3 text-lg font-extrabold text-slate-900 sm:text-xl">
                    個別フィードバック面談で<br className="sm:hidden" />「完全版レポート」を受け取る
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm">
                    画面共有にて診断レポートを詳しく解説し、御社に利益が残る体制をつくる第一歩をご案内します。
                  </p>

                  <div className="mt-6">
                    {targetBookingUrl ? (
                      <a
                        href={targetBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-blue-500 active:scale-[0.99]"
                      >
                        <Calendar className="h-5 w-5" />
                        カレンダーから面談日時を選ぶ（予約する）
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-medium text-blue-900 sm:text-sm">
                        ご入力いただいたメールアドレス（{email}）宛に、専任コンサルタントより面談日程のご案内をお届けいたします。
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs leading-5 text-slate-600">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      面談についてのご案内
                    </div>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] sm:text-xs">
                      <li>事前準備は一切不要です。当日はZoomにてリラックスしてお話しいただけます。</li>
                      <li>面談終了後、画面で解説した完全版レポート（PDF）を進呈いたします。</li>
                      <li>強引な営業・売り込みは一切ありませんのでご安心ください。</li>
                    </ul>
                  </div>
                </section>
              </div>
            );
          })() : (
            <section className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600"/>
              <h2 className="mt-4 text-xl font-bold text-slate-900">お申し込みを受け付けました</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">ご入力いただいた内容を担当者が確認の上、折り返しご連絡いたします。</p>
            </section>
          )
        ) : form ? (
          <form onSubmit={submit} className="space-y-4">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-slate-900">お客様情報</h2>
              <label className="block text-sm font-medium text-slate-700">お名前 <span className="text-rose-600">*</span><input required autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={inputClass}/></label>
              <label className="block text-sm font-medium text-slate-700">会社名・屋号（任意）<input type="text" autoComplete="organization" maxLength={200} value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={inputClass}/><span className="mt-1 block text-xs font-normal text-slate-500">準備中・未定の場合は空欄で進められます。</span></label>
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
            <p className="text-center text-xs text-slate-500">送信された内容は担当者が確認の上、折り返しご連絡いたします。</p>
          </form>
        ) : null}
        <footer className="mt-8 text-center text-xs text-slate-500">{form?.name || ''}</footer>
      </div>
    </main>
  );
};
