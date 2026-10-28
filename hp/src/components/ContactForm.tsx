import React, { useState } from 'react';
import { submitLead } from '../lib/supabase';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    service_interest: '経営戦略・利益改善顧問',
    current_status: '',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await submitLead({
        company_name: formData.company_name,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        inquiry_type: 'consultation',
        notes: `【ご関心のあるテーマ】${formData.service_interest}\n【現在の状況】${formData.current_status}\n【ご相談内容】${formData.message}`,
        custom_fields: {
          interest: formData.service_interest,
          current_status: formData.current_status,
        },
      });

      if (res.success) {
        setSubmitted(true);
      } else {
        setErrorMsg('送信に失敗しました。時間をおいて再送信してください。');
      }
    } catch (err) {
      setErrorMsg('エラーが発生しました。通信環境をご確認ください。');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-sand-300 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold font-serif text-slate-900">お問い合わせありがとうございます</h3>
        <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
          内容を確認の上、通常1営業日以内に担当よりご連絡申し上げます。<br />
          お急ぎの場合は、公式LINEまたはFAX（0584-91-4897）でもご連絡いただけます。
        </p>
        <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
          <a
            href="/"
            className="px-6 py-2.5 bg-brand-900 text-white rounded-lg text-sm font-semibold hover:bg-brand-800 transition"
          >
            トップページへ戻る
          </a>
          <a
            href="https://lin.ee/4Vl9v91"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 bg-[#06C755] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            LINE公式アカウントを開く
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-2xl border border-sand-300 shadow-lg space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            貴社名 / 屋号
          </label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            placeholder="例：株式会社〇〇（個人の場合は空欄可）"
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例：山田 太郎"
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="例：info@example.com"
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            お電話番号 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="例：090-1234-5678"
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          ご関心のあるテーマ・ご相談種別 <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.service_interest}
          onChange={(e) => setFormData({ ...formData, service_interest: e.target.value })}
          className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm bg-white transition"
        >
          <option value="経営戦略・利益改善顧問">経営戦略・利益改善顧問（経営課題の整理・利益向上）</option>
          <option value="業務改善・IT・DX・AI顧問">業務改善・IT・DX・AI顧問（業務属人化の解消・自動化）</option>
          <option value="システム構築・業務自動化">システム構築・自動化実装（GAS/Webアプリ/ツール構築）</option>
          <option value="マーケティング・集客導線構築">マーケティング・集客導線構築（LP/HP/導線設計）</option>
          <option value="新規事業の企画・立ち上げ">新規事業の企画・立ち上げ・仕組み化支援</option>
          <option value="介護保険外サービス開業支援">介護保険外サービス開業パッケージについて</option>
          <option value="その他・全般相談">その他・まずは何から相談すべきか整理したい</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          現在の会社のステージ・年商規模（任意）
        </label>
        <select
          value={formData.current_status}
          onChange={(e) => setFormData({ ...formData, current_status: e.target.value })}
          className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm bg-white transition"
        >
          <option value="">選択してください（任意）</option>
          <option value="創業準備中・個人事業主">創業準備中 / 個人事業主</option>
          <option value="年商3,000万円未満">法人化直後〜年商3,000万円未満</option>
          <option value="年商3,000万〜1億円">年商3,000万〜1億円</option>
          <option value="年商1億〜3億円">年商1億〜3億円</option>
          <option value="年商3億円以上">年商3億円以上</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          ご相談内容・現在のお困りごと <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={5}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="例：売上はあるものの現場業務に追われ、手元に利益が残りにくい状態が続いています。業務の棚卸しと利益改善の進め方について相談したいです。"
          className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm transition"
        ></textarea>
      </div>

      <div className="text-xs text-gray-500 leading-relaxed">
        送信いただく前に、当社の<a href="/privacy" target="_blank" className="text-brand-700 underline">プライバシーポリシー</a>をご確認ください。ご入力いただいた情報は、お問い合わせ対応および改善ご提案の目的のみに利用いたします。
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 px-6 bg-brand-900 hover:bg-brand-800 text-white font-bold rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <span>送信処理中...</span>
        ) : (
          <>
            <span>無料で初回相談を申し込む</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}
