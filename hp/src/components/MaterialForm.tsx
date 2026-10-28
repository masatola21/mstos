import React, { useState } from 'react';
import { submitLead } from '../lib/supabase';

export default function MaterialForm() {
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    industry: '',
    role: '代表取締役 / 役員',
  });

  const [loading, setLoading] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
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
        inquiry_type: 'material',
        notes: `【資料請求】経営改善実務ガイド・MST紹介資料\n【業種】${formData.industry}\n【役職】${formData.role}`,
        custom_fields: {
          industry: formData.industry,
          role: formData.role,
        },
      });

      if (res.success) {
        setDownloadReady(true);
      } else {
        setErrorMsg('送信に失敗しました。');
      }
    } catch (err) {
      setErrorMsg('エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  if (downloadReady) {
    return (
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-sand-300 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold font-serif text-slate-900">資料請求を受け付けました</h3>
        <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
          ご入力いただいたメールアドレス（{formData.email}）宛てに、資料ダウンロードURLを送付いたしました。以下のボタンからも直接資料をご覧いただけます。
        </p>

        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-4">
          <a
            href="/materials/mst-management-guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-brand-900 hover:bg-brand-800 text-white font-bold rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF資料を今すぐ閲覧する
          </a>
          <a
            href="/diagnosis"
            className="px-6 py-3 bg-sand-100 hover:bg-sand-200 text-slate-900 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 border border-sand-300"
          >
            自社のボトルネック無料診断に進む
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
        <h3 className="text-xl font-bold font-serif text-slate-900 mt-2">
          経営の仕組み化 × 利益改善 実務ガイド（全13スライド要点解説）
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          中小企業が直面するボトルネックの解消プロセス、実践的な業務改善・AI活用事例を網羅した特別資料です。
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            貴社名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            placeholder="例：株式会社〇〇"
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
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
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            メールアドレス（送付先） <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="例：yamada@example.co.jp"
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
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
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            業種
          </label>
          <select
            value={formData.industry}
            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white"
          >
            <option value="">選択してください</option>
            <option value="介護・福祉・医療">介護・福祉・医療</option>
            <option value="製造・卸・流通">製造・卸・流通</option>
            <option value="建設・不動産">建設・不動産</option>
            <option value="小売り・実店舗・サロン">小売り・実店舗・サロン</option>
            <option value="IT・士業・専門サービス">IT・士業・専門サービス</option>
            <option value="その他サービス業">その他サービス業</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            役職
          </label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full px-4 py-3 border border-sand-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white"
          >
            <option value="代表取締役 / 役員">代表取締役 / 役員</option>
            <option value="事業責任者 / 部長">事業責任者 / 部長</option>
            <option value="経営企画 / DX担当">経営企画 / DX担当</option>
            <option value="個人事業主 / 開業準備中">個人事業主 / 開業準備中</option>
            <option value="その他">その他</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-gray-500 leading-relaxed">
        ※ しつこい営業電話等は一切行いません。ご入力いただいた情報は当社の個人情報保護方針に則り厳重に管理いたします。
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 px-6 bg-brand-900 hover:bg-brand-800 text-white font-bold rounded-xl transition duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <span>準備中...</span>
        ) : (
          <>
            <svg className="w-5 h-5 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>資料を無料でダウンロードする</span>
          </>
        )}
      </button>
    </form>
  );
}
