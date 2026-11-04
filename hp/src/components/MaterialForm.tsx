import React, { useState, useEffect } from 'react';
import { submitIntakeToCRM } from '../lib/supabase';

type MaterialChoice = 'management' | 'care' | 'both';

export default function MaterialForm() {
  const [materialChoice, setMaterialChoice] = useState<MaterialChoice>('management');
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
  });

  const [source, setSource] = useState('corporate_website');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingUrl, setBookingUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get('type') || params.get('material');
      if (typeParam === 'care' || typeParam === 'care-package') {
        setMaterialChoice('care');
      } else if (typeParam === 'both') {
        setMaterialChoice('both');
      } else if (typeParam === 'management' || typeParam === 'guide') {
        setMaterialChoice('management');
      }
      const sourceParam = params.get('source');
      if (sourceParam) {
        setSource(sourceParam);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const choiceLabel = materialChoice === 'care'
      ? '介護保険外サービス開業パッケージ資料'
      : materialChoice === 'both'
        ? '経営改善実務ガイド ＆ 介護保険外サービス開業パッケージ資料（両方）'
        : '経営改善実務ガイドブック';

    try {
      const res = await submitIntakeToCRM({
        slug: 'material-download',
        name: formData.name,
        companyName: formData.company_name,
        email: formData.email,
        phone: formData.phone,
        inquiryType: materialChoice === 'care' ? 'care_package' : 'material',
        source: source,
        notes: `【資料請求】ご希望資料: ${choiceLabel}`,
        customFields: {
          material_choice: materialChoice,
          choice_label: choiceLabel,
        },
      });

      if (res.success) {
        let targetBookingUrl = res.bookingUrl || 'https://lin.ee/qWsuD6f';
        if (targetBookingUrl.includes('timerex') || targetBookingUrl.includes('booking') || targetBookingUrl.includes('calendar')) {
          const delim = targetBookingUrl.includes('?') ? '&' : '?';
          targetBookingUrl += `${delim}name=${encodeURIComponent(formData.name)}&email=${encodeURIComponent(formData.email)}`;
        }
        setBookingUrl(targetBookingUrl);
        setSubmitted(true);
      } else {
        setErrorMsg('送信に失敗しました。時間をおいて再度お試しください。');
      }
    } catch (err) {
      setErrorMsg('エラーが発生しました。通信環境をご確認ください。');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-sand-300 shadow-xl space-y-8 animate-fadeIn">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">
            請求受付完了
          </span>
          <h3 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900">
            資料請求を受け付けました
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            ご入力いただいたメールアドレス（<strong className="text-slate-900">{formData.email}</strong>）宛てにも資料リンクを送信いたしました。以下のボタンからも今すぐ直接ご覧いただけます。
          </p>
        </div>

        {/* ダウンロードボタン一覧 */}
        <div className="p-6 bg-sand-50/80 rounded-2xl border border-sand-200 space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-center">
            ご請求いただいたPDF資料
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(materialChoice === 'management' || materialChoice === 'both') && (
              <a
                href="/materials/mst-management-guide.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-brand-900 hover:bg-brand-800 text-white rounded-xl shadow transition text-center flex flex-col justify-center items-center gap-1 group"
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <svg className="w-4 h-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  経営改善実務ガイド
                </div>
                <span className="text-[11px] text-slate-300 group-hover:text-white">
                  全13スライド / PDFを開く →
                </span>
              </a>
            )}

            {(materialChoice === 'care' || materialChoice === 'both') && (
              <a
                href="/materials/care-package-overview.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl shadow transition text-center flex flex-col justify-center items-center gap-1 group"
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  介護保険外開業パッケージ
                </div>
                <span className="text-[11px] text-emerald-100 group-hover:text-white">
                  収支モデル・手順 / PDFを開く →
                </span>
              </a>
            )}
          </div>
        </div>

        {/* すぐ面談予約案内カード */}
        <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-brand-800 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            資料と合わせて具体的な相談をしたい方へ
          </div>
          <h4 className="text-lg sm:text-xl font-bold text-white font-serif">
            自社への当てはめや数値を個別解説「30分オンライン無料個別面談」
          </h4>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
            資料の内容を「自社に置き換えたらどうなるか？」「どこから着手すべきか？」を、代表または専任コンサルタントが直接アドバイスいたします（Zoom対応・完全無料）。
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              今すぐ面談の日程を予約する（無料） →
            </a>
            <a
              href="/diagnosis"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sand-800 hover:bg-sand-700 text-white font-bold rounded-xl text-sm transition shadow-md border border-sand-600"
            >
              自社の3分ボトルネック診断をする
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

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-2xl border border-sand-300 shadow-lg space-y-6">
      <div className="border-b border-sand-200 pb-4">
        <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full uppercase tracking-wider border border-brand-200">
          無料ダウンロード
        </span>
        <h2 className="text-xl sm:text-2xl font-bold font-serif text-slate-900 mt-2">
          資料請求フォーム
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          フォーム送信後、すぐにPDF資料を画面上でご確認・ダウンロードいただけます。
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
          {errorMsg}
        </div>
      )}

      {/* ご希望の資料（分岐UI） */}
      <div>
        <label className="block text-xs font-bold text-slate-800 mb-2">
          ご希望の資料を選択してください <span className="text-rose-500">*</span>
        </label>
        <div className="space-y-2.5">
          <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
            materialChoice === 'management'
              ? 'border-brand-700 bg-brand-50/60 shadow-sm'
              : 'border-sand-300 bg-white hover:bg-sand-50/50'
          }`}>
            <input
              type="radio"
              name="material_choice"
              value="management"
              checked={materialChoice === 'management'}
              onChange={() => setMaterialChoice('management')}
              className="mt-1 text-brand-700 focus:ring-brand-500"
            />
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                ① 経営改善実務ガイドブック（全13スライド）
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5">
                中小企業が「手作業の山」「属人化」から脱却し、利益を残すための仕組み化実践論。
              </div>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
            materialChoice === 'care'
              ? 'border-brand-700 bg-brand-50/60 shadow-sm'
              : 'border-sand-300 bg-white hover:bg-sand-50/50'
          }`}>
            <input
              type="radio"
              name="material_choice"
              value="care"
              checked={materialChoice === 'care'}
              onChange={() => setMaterialChoice('care')}
              className="mt-1 text-brand-700 focus:ring-brand-500"
            />
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                ② 介護保険外サービス開業・収益化パッケージ資料
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5">
                直営店舗の実践データ、初期収支モデル、集客・カルテ自動化の開業手順を網羅。
              </div>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
            materialChoice === 'both'
              ? 'border-brand-700 bg-brand-50/60 shadow-sm'
              : 'border-sand-300 bg-white hover:bg-sand-50/50'
          }`}>
            <input
              type="radio"
              name="material_choice"
              value="both"
              checked={materialChoice === 'both'}
              onChange={() => setMaterialChoice('both')}
              className="mt-1 text-brand-700 focus:ring-brand-500"
            />
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                ③ 両方の資料をまとめて希望する
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5">
                経営改善ガイドと介護保険外開業資料の2点ともダウンロードいただけます。
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 会社名・お名前 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-2">
            貴社名・屋号 <span className="text-gray-400 font-normal">（任意）</span>
          </label>
          <input
            type="text"
            placeholder="例：株式会社〇〇 / 個人"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
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
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition"
          />
        </div>
      </div>

      {/* メール・電話 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-2">
            メールアドレス <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            required
            placeholder="例：yamada@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition"
          />
        </div>
      </div>

      {/* 個人情報取り扱い */}
      <div className="text-xs text-gray-500 leading-relaxed bg-sand-50/70 p-3.5 rounded-xl border border-sand-200">
        ご入力いただいた情報は、資料送付および関連するご案内にのみ利用いたします。詳細は当社の<a href="/privacy" target="_blank" className="text-brand-700 underline font-semibold">プライバシーポリシー</a>をご確認ください。
      </div>

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 px-6 bg-brand-900 hover:bg-brand-800 disabled:bg-gray-400 text-white font-bold rounded-xl text-sm sm:text-base transition shadow-md flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            送信中...
          </>
        ) : (
          <>
            資料を今すぐ無料で受け取る →
          </>
        )}
      </button>
    </form>
  );
}
