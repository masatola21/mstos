import React, { useState, useEffect } from 'react';
import { submitIntakeToCRM, OFFICIAL_TIMEREX_BOOKING_URL } from '../lib/supabase';

const SERVICE_MAP: Record<string, string> = {
  strategy: '経営戦略・業務効率化設計・伴走顧問',
  'it-dx': '業務自動化・IT・DX・AI活用',
  system: 'システム構築・社内ツール・導線実装',
  marketing: '集客導線・成約Web基盤・LINE連携',
  'new-business': '新規事業立ち上げ・収益化支援',
  'care-package': '介護保険外サービス開業パッケージ',
};

export default function ContactForm() {
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    service_interest: '経営戦略・業務効率化設計・伴走顧問',
    message: '',
  });

  const [source, setSource] = useState('corporate_website');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const serviceParam = params.get('service');
      if (serviceParam && SERVICE_MAP[serviceParam]) {
        setFormData((prev) => ({
          ...prev,
          service_interest: SERVICE_MAP[serviceParam],
        }));
      }
      const sourceParam = params.get('source');
      if (sourceParam) {
        setSource(sourceParam);
      }
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingUrl, setBookingUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await submitIntakeToCRM({
        slug: 'contact-inquiry',
        name: formData.name,
        companyName: formData.company_name,
        email: formData.email,
        phone: formData.phone,
        inquiryType: 'consultation',
        source: source,
        notes: `【ご関心のあるテーマ】${formData.service_interest}\n【ご相談内容】${formData.message}`,
        customFields: {
          service_interest: formData.service_interest,
        },
      });

      if (res.success) {
        let targetBookingUrl = res.bookingUrl || OFFICIAL_TIMEREX_BOOKING_URL;
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
            受付完了
          </span>
          <h3 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900">
            お問い合わせを受け付けました
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            ご入力いただいたメールアドレス（<strong className="text-slate-900">{formData.email}</strong>）宛てに、受付確認のサンクスメールをお送りいたしました。通常1営業日以内に担当よりご連絡いたします。
          </p>
        </div>

        {/* すぐ面談予約案内カード */}
        <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-brand-800 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            お急ぎの方・すぐに相談したい方へ
          </div>
          <h4 className="text-lg sm:text-xl font-bold text-white font-serif">
            代表または専任コンサルタントによる「30分オンライン無料個別面談」
          </h4>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
            メールのやり取りを待たずに、ご都合の良い日時をカレンダーから今すぐ直接ご予約いただけます。現状の業務のボトルネック整理や、具体的な進め方について気軽にお話しいただけます（Zoom対応・完全無料）。
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            {/* 主ボタン: TimeRex 面談予約 */}
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm transition shadow-lg hover:shadow-xl hover:scale-[1.01]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              無料面談の日程を予約する（TimeRex・30分） →
            </a>
            {/* 補助ボタン: LINE 日程調整 */}
            <a
              href="https://lin.ee/qWsuD6f"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm border border-white/20 transition shadow"
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

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-2xl border border-sand-300 shadow-lg space-y-6">
      <div className="border-b border-sand-200 pb-4">
        <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full uppercase tracking-wider border border-brand-200">
          WEBフォーム相談窓口
        </span>
        <h2 className="text-xl sm:text-2xl font-bold font-serif text-slate-900 mt-2">
          お問い合わせ内容の入力
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          必要事項をご入力の上、送信してください。営業メールや強引な勧誘は一切行いません。
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
          {errorMsg}
        </div>
      )}

      {/* ご関心のあるテーマ */}
      <div>
        <label className="block text-xs font-bold text-slate-800 mb-2">
          ご関心のあるテーマ・サービス <span className="text-rose-500">*</span>
        </label>
        <select
          value={formData.service_interest}
          onChange={(e) => setFormData({ ...formData, service_interest: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm bg-sand-50/50 outline-none transition"
        >
          <option value="経営戦略・業務効率化設計・伴走顧問">経営戦略・業務効率化設計・伴走顧問</option>
          <option value="業務自動化・IT・DX・AI活用">業務自動化・IT・DX・AI活用</option>
          <option value="システム構築・社内ツール・導線実装">システム構築・社内ツール・導線実装</option>
          <option value="集客導線・成約Web基盤・LINE連携">集客導線・成約Web基盤・LINE連携</option>
          <option value="新規事業立ち上げ・収益化支援">新規事業立ち上げ・収益化支援</option>
          <option value="介護保険外サービス開業パッケージ">介護保険外サービス開業パッケージ</option>
          <option value="まずは全体的な相談・ヒアリング希望">まずは全体的な相談・ヒアリング希望</option>
        </select>
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

      {/* ご相談内容 */}
      <div>
        <label className="block text-xs font-bold text-slate-800 mb-2">
          ご相談内容・現状のお困りごと <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={4}
          required
          placeholder="例：業務の手作業が多く社長の時間が取れない、利益率を改善したい、社内ツールの自動化について相談したい、介護保険外サービスの開業について聞きたい等、ざっくりとした内容でも歓迎です。"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 text-sm outline-none transition leading-relaxed"
        />
      </div>

      {/* 個人情報取り扱い */}
      <div className="text-xs text-gray-500 leading-relaxed bg-sand-50/70 p-3.5 rounded-xl border border-sand-200">
        ご入力いただいた情報は、お問い合わせ対応および面談日程のご案内のためにのみ利用いたします。詳細は当社の<a href="/privacy" target="_blank" className="text-brand-700 underline font-semibold">プライバシーポリシー</a>をご確認ください。
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
            入力内容を送信する（無料相談） →
          </>
        )}
      </button>
    </form>
  );
}
