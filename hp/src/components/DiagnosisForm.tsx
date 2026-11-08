import React, { useState, useEffect } from 'react';
import {
  MST_OFFICIAL_BOTTLENECK_QUESTIONS,
  analyzeBottleneck,
  submitIntakeToCRM,
  OFFICIAL_TIMEREX_BOOKING_URL,
  type DiagnosisAnalysisResult
} from '../lib/supabase';

export default function DiagnosisForm() {
  const [currentStep, setCurrentStep] = useState(0); // 0..4: 設問, 5: 連絡先入力
  const [answers, setAnswers] = useState<Record<string, string>>({
    q_ops_bottleneck: '',
    q_profit_bottleneck: '',
    q_delay_reason: '',
    q_ideal_future: '',
    q_free_notes: '',
  });

  const [lead, setLead] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    hear_about: '',
  });

  const [source, setSource] = useState('corporate_website');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<DiagnosisAnalysisResult | null>(null);
  const [bookingUrl, setBookingUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('source');
      if (s) setSource(s);
    }
  }, []);

  const totalQuestions = MST_OFFICIAL_BOTTLENECK_QUESTIONS.length; // 5問

  const handleSelectRadio = (questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setErrorMsg('');
    // 選択したら次の問へ自動進捗
    if (currentStep < 3) {
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 180);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // 回答から即時判定
    const analysis = analyzeBottleneck(answers);
    setResult(analysis);

    try {
      const res = await submitIntakeToCRM({
        slug: 'business-diagnosis',
        name: lead.name,
        companyName: lead.company_name,
        email: lead.email,
        phone: lead.phone,
        inquiryType: 'diagnosis',
        source: source,
        answers: {
          ...answers,
          q_hear_about: lead.hear_about,
          hear_about: lead.hear_about,
        },
        notes: `【経営ボトルネック診断】判定: ${analysis.typeTitle}（${analysis.badge}）\n【手作業】${answers.q_ops_bottleneck}\n【売上・利益】${answers.q_profit_bottleneck}\n【停滞原因】${answers.q_delay_reason}\n【希望】${answers.q_ideal_future}\n【自由記入】${answers.q_free_notes || 'なし'}${lead.hear_about ? `\n【認知経路】${lead.hear_about}` : ''}`,
        customFields: {
          diagnosis_result: analysis,
          hear_about: lead.hear_about,
        },
      });

      if (res.success) {
        let targetBookingUrl = res.bookingUrl || OFFICIAL_TIMEREX_BOOKING_URL;
        if (targetBookingUrl.includes('timerex') || targetBookingUrl.includes('booking') || targetBookingUrl.includes('calendar')) {
          const delim = targetBookingUrl.includes('?') ? '&' : '?';
          targetBookingUrl += `${delim}name=${encodeURIComponent(lead.name)}&email=${encodeURIComponent(lead.email)}`;
        }
        setBookingUrl(targetBookingUrl);
        setSubmitted(true);
      } else {
        setErrorMsg('送信に失敗しました。');
      }
    } catch (err) {
      setErrorMsg('エラーが発生しました。通信環境をご確認ください。');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 結果画面（診断結果速報 ＋ 面談案内）
  // ==========================================
  if (submitted && result) {
    return (
      <div className="bg-white p-6 sm:p-12 rounded-3xl border border-sand-300 shadow-2xl space-y-8 animate-fadeIn max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-brand-950 via-slate-900 to-sky-950 p-6 sm:p-8 text-white text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            診断受付完了 ＆ 簡易速報
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold font-serif">
            {lead.name} 様、ご回答ありがとうございました！<br />
            貴社の<span className="text-amber-300">「ボトルネック速報判定」</span>が出ました
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed font-light">
            ご入力いただいた内容をもとに、現状の仕組み化の急所を即時分類いたしました。確認メール（サンクスメール）も送信しております。
          </p>
        </div>

        {/* チラ見せ速報カード */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
            <span className="text-xs font-bold text-slate-500 tracking-wider">【簡易診断結果速報】</span>
            <span className="rounded-full bg-amber-200/80 text-amber-900 px-3 py-1 text-xs font-bold">
              {result.badge}
            </span>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500">貴社が最優先で着手すべきボトルネック傾向：</p>
            <h3 className="mt-1 text-xl sm:text-2xl font-black text-rose-600 font-serif">
              🚨 {result.typeTitle}
            </h3>
          </div>

          <div className="p-4 bg-white rounded-xl border border-sand-300 text-xs sm:text-sm text-slate-700 leading-relaxed shadow-sm">
            {result.summary}
          </div>

          <div className="p-3.5 bg-brand-50 rounded-xl border border-brand-200 text-xs text-brand-900 leading-relaxed font-medium">
            <strong>💡 直近の改善指針:</strong> {result.urgentAction}
          </div>
        </div>

        {/* 鍵マーク・完全版レポートの予告 ＆ 面談予約導線 */}
        <div className="rounded-2xl border border-brand-800 bg-gradient-to-br from-brand-950 via-slate-900 to-brand-900 p-6 sm:p-8 text-white space-y-5 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            完全版レポート・数値シミュレーション（鍵付き）
          </div>

          <h4 className="text-lg sm:text-2xl font-bold font-serif leading-snug">
            「具体的な削減時間」と「利益改善ロードマップ」は<br className="hidden sm:inline" />
            30分のオンライン無料個別面談にて直接開示いたします
          </h4>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
            机上の空論ではなく「貴社の実際の業務フローにおいて、何をどのツールで自動化し、どこに仕組みを導入すれば最大利益が出るか」を、代表または専任コンサルタントが直接画面共有しながら解説します。終了後、貴社専用の診断カルテPDFを進呈いたします（強引な営業は一切行いません）。
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm sm:text-base transition shadow-lg hover:shadow-xl"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              今すぐ面談の日程を予約する（無料・30分） →
            </a>
            <a
              href="https://lin.ee/qWsuD6f"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl text-sm transition shadow"
            >
              LINEで日程調整する
            </a>
          </div>
        </div>

        <div className="text-center pt-2">
          <a href="/" className="text-xs font-bold text-brand-700 hover:text-brand-900 underline">
            ← トップページへ戻る
          </a>
        </div>
      </div>
    );
  }

  // ==========================================
  // 問診・入力ステップ画面
  // ==========================================
  const activeQuestion = MST_OFFICIAL_BOTTLENECK_QUESTIONS[currentStep];

  return (
    <div className="bg-white p-6 sm:p-10 rounded-3xl border border-sand-300 shadow-xl max-w-3xl mx-auto">
      {/* プログレスバー */}
      <div className="mb-6">
        <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
          <span>STEP {currentStep + 1} / {totalQuestions + 1}</span>
          <span className="text-brand-700">
            {currentStep < totalQuestions
              ? activeQuestion.categoryName
              : '診断結果のお届け先'}
          </span>
        </div>
        <div className="w-full bg-sand-200 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-brand-900 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / (totalQuestions + 1)) * 100}%` }}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
          {errorMsg}
        </div>
      )}

      {/* 設問 1〜4（単一選択） */}
      {currentStep < 4 && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              第 {currentStep + 1} 問
            </span>
            <h3 className="text-lg sm:text-xl font-bold font-serif text-slate-900 mt-3 leading-snug">
              {activeQuestion.label}
            </h3>
          </div>

          <div className="space-y-3">
            {activeQuestion.options.map((option, idx) => {
              const isSelected = answers[activeQuestion.id] === option;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectRadio(activeQuestion.id, option)}
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition flex items-start gap-3 ${
                    isSelected
                      ? 'border-brand-700 bg-brand-50/70 shadow-sm ring-1 ring-brand-700'
                      : 'border-sand-300 bg-white hover:bg-sand-50 hover:border-brand-300'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? 'border-brand-700 bg-brand-900 text-white' : 'border-sand-400 bg-white'
                  }`}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-sand-200">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-sand-100 transition"
              >
                ← 前の質問へ
              </button>
            ) : <div />}

            {answers[activeQuestion.id] && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-5 py-2.5 bg-brand-900 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition shadow"
              >
                次へ進む →
              </button>
            )}
          </div>
        </div>
      )}

      {/* 設問 5（自由記入・任意） */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              第 5 問（任意）
            </span>
            <h3 className="text-lg sm:text-xl font-bold font-serif text-slate-900 mt-3 leading-snug">
              {activeQuestion.label}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              特に思いつかない場合は未記入のまま次へお進みいただけます。
            </p>
          </div>

          <div>
            <textarea
              rows={4}
              placeholder="例：見積もりや請求業務を手書き・Excelでやっていてミスが怖い、営業の仕組みを作りたい、顧問契約でどこまで対応してもらえるか知りたい 等"
              value={answers.q_free_notes}
              onChange={(e) => setAnswers({ ...answers, q_free_notes: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition leading-relaxed"
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-sand-200">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-sand-100 transition"
            >
              ← 前の質問へ
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="px-6 py-2.5 bg-brand-900 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition shadow"
            >
              診断結果の確認へ進む →
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: 連絡先入力（年商・ステージは完全削除） */}
      {currentStep === 5 && (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
          <div className="border-b border-sand-200 pb-4">
            <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
              診断結果のお届け先
            </span>
            <h3 className="text-lg sm:text-2xl font-bold font-serif text-slate-900 mt-2">
              診断結果をお届けする連絡先をご入力ください
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              ご入力後、すぐに画面上にボトルネック速報判定が表示されます。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                貴社名・屋号 <span className="text-gray-400 font-normal">（任意）</span>
              </label>
              <input
                type="text"
                placeholder="例：株式会社〇〇 / 個人"
                value={lead.company_name}
                onChange={(e) => setLead({ ...lead, company_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                お名前 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="例：山田 太郎"
                value={lead.name}
                onChange={(e) => setLead({ ...lead, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                メールアドレス <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="例：yamada@example.com"
                value={lead.email}
                onChange={(e) => setLead({ ...lead, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                お電話番号 <span className="text-gray-400 font-normal">（任意）</span>
              </label>
              <input
                type="tel"
                placeholder="例：090-1234-5678"
                value={lead.phone}
                onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              どこで知りましたか？ <span className="text-gray-400 font-normal">（任意）</span>
            </label>
            <select
              value={lead.hear_about}
              onChange={(e) => setLead({ ...lead, hear_about: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition bg-white text-slate-800 cursor-pointer"
            >
              <option value="">選択してください（任意）</option>
              <option value="Instagram">Instagram</option>
              <option value="Threads">Threads</option>
              <option value="Facebook">Facebook</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="ブログ">ブログ・HPコラム</option>
              <option value="検索">検索（Google/Yahoo等）</option>
              <option value="紹介">知人・提携先からの紹介</option>
              <option value="メール">メールマガジン・案内</option>
              <option value="その他">その他</option>
            </select>
          </div>

          <div className="text-xs text-gray-500 leading-relaxed bg-sand-50/70 p-3.5 rounded-xl border border-sand-200">
            診断結果の送付および関連する情報提供にのみ利用いたします。電話によるしつこい営業は一切行いません。詳細は当社の<a href="/privacy" target="_blank" className="text-brand-700 underline font-semibold">プライバシーポリシー</a>をご確認ください。
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-sand-100 transition"
            >
              ← 設問を修正する
            </button>

            <button
              type="submit"
              disabled={loading}
              className="py-3.5 px-6 bg-brand-900 hover:bg-brand-800 disabled:bg-gray-400 text-white font-bold rounded-xl text-sm transition shadow-md flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  判定中...
                </>
              ) : (
                <>
                  ボトルネック診断結果を見る（無料） →
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
