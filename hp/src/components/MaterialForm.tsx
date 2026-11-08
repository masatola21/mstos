import React, { useState, useEffect } from 'react';
import { submitIntakeToCRM, resolveApiEndpoint, OFFICIAL_TIMEREX_BOOKING_URL } from '../lib/supabase';

interface MaterialItem {
  key: string;
  label: string;
  description: string;
  url: string;
  category?: string;
  sort_order?: number;
}

const FALLBACK_MATERIALS: MaterialItem[] = [
  {
    key: 'management-guide',
    label: '① 経営改善実務ガイドブック（要点解説スライド）',
    description: '中小企業が「手作業の山」「属人化」から脱却し、利益を残すための仕組み化実践論。',
    url: '/materials/mst-management-guide.pdf',
    category: '経営実務・仕組み化',
  },
  {
    key: 'care-package-overview',
    label: '② 介護保険外サービス開業・収益化パッケージ資料',
    description: '直営店舗の実践データ、初期収支モデル、集客・カルテ自動化の開業手順を網羅。',
    url: '/materials/care-package-overview.pdf',
    category: '開業パッケージ',
  },
];

export default function MaterialForm() {
  const [availableMaterials, setAvailableMaterials] = useState<MaterialItem[]>(FALLBACK_MATERIALS);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['management-guide', 'care-package-overview']);
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    hear_about: '',
  });

  const [source, setSource] = useState('corporate_website');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingUrl, setBookingUrl] = useState('');
  const [downloadUrls, setDownloadUrls] = useState<Array<{ key?: string; label: string; url: string }>>([]);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. クライアント側でOSの /api/public/materials から公開資料マスタを動的取得
  useEffect(() => {
    let cancelled = false;

    async function fetchMaterials() {
      try {
        const endpoint = resolveApiEndpoint('/api/public/materials');
        const res = await fetch(endpoint, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.materials) && data.materials.length > 0) {
          setAvailableMaterials(data.materials);

          // URLパラメータに応じた事前選択
          const params = new URLSearchParams(window.location.search);
          const typeParam = params.get('type') || params.get('material') || '';
          if (typeParam === 'care' || typeParam === 'care-package' || typeParam === 'care-package-overview') {
            setSelectedKeys(['care-package-overview']);
          } else if (typeParam === 'management' || typeParam === 'guide' || typeParam === 'management-guide') {
            setSelectedKeys(['management-guide']);
          } else if (typeParam === 'both' || !typeParam) {
            setSelectedKeys(data.materials.map((m: MaterialItem) => m.key));
          } else if (typeParam) {
            const matched = data.materials.find((m: MaterialItem) => m.key === typeParam);
            if (matched) setSelectedKeys([matched.key]);
          }
        }
      } catch (e) {
        console.warn('[MaterialForm] Failed to fetch dynamic materials, falling back to static:', e);
      }
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get('type') || params.get('material') || '';
      if (typeParam === 'care' || typeParam === 'care-package' || typeParam === 'care-package-overview') {
        setSelectedKeys(['care-package-overview']);
      } else if (typeParam === 'management' || typeParam === 'guide' || typeParam === 'management-guide') {
        setSelectedKeys(['management-guide']);
      } else {
        setSelectedKeys(['management-guide', 'care-package-overview']);
      }
      const sourceParam = params.get('source');
      if (sourceParam) setSource(sourceParam);

      void fetchMaterials();
    }

    return () => { cancelled = true; };
  }, []);

  const toggleMaterial = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const selectAll = () => {
    setSelectedKeys(availableMaterials.map((m) => m.key));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedKeys.length === 0) {
      setErrorMsg('ご希望の資料を1つ以上選択してください。');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const chosenItems = availableMaterials.filter((m) => selectedKeys.includes(m.key));
    const choiceLabel = chosenItems.map((m) => m.label).join('、');
    const isCareOnly = selectedKeys.length === 1 && selectedKeys[0] === 'care-package-overview';

    try {
      const res = await submitIntakeToCRM({
        slug: 'material-download',
        name: formData.name,
        companyName: formData.company_name,
        email: formData.email,
        phone: formData.phone,
        inquiryType: isCareOnly ? 'care_package' : 'material',
        source: source,
        notes: `【資料請求】ご希望資料: ${choiceLabel}${formData.hear_about ? `\n【認知経路】${formData.hear_about}` : ''}`,
        answers: {
          material_keys: selectedKeys,
          choice_label: choiceLabel,
          q_hear_about: formData.hear_about,
          hear_about: formData.hear_about,
        },
        customFields: {
          material_keys: selectedKeys,
          choice_label: choiceLabel,
          hear_about: formData.hear_about,
        },
      });

      if (res.success) {
        // ラウンド2-6: TimeRex公式URLへのフォールバック ＆ 事前入力クエリ付与
        let targetBookingUrl = res.bookingUrl || OFFICIAL_TIMEREX_BOOKING_URL;
        if (targetBookingUrl.includes('timerex') || targetBookingUrl.includes('booking') || targetBookingUrl.includes('calendar')) {
          const delim = targetBookingUrl.includes('?') ? '&' : '?';
          targetBookingUrl += `${delim}name=${encodeURIComponent(formData.name)}&email=${encodeURIComponent(formData.email)}`;
        }
        setBookingUrl(targetBookingUrl);

        // ラウンド2-2: サーバーレスポンスの materialUrls を優先してダウンロード一覧を構築
        if (res.materialUrls && Array.isArray(res.materialUrls) && res.materialUrls.length > 0) {
          setDownloadUrls(res.materialUrls);
        } else if (res.materialUrl) {
          setDownloadUrls([{ label: choiceLabel, url: res.materialUrl }]);
        } else {
          // フォールバック
          setDownloadUrls(chosenItems.map((m) => ({ key: m.key, label: m.label, url: m.url })));
        }

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

        {/* ダウンロードボタン一覧（動的生成） */}
        <div className="p-6 bg-sand-50/80 rounded-2xl border border-sand-200 space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-center">
            ご請求いただいたPDF資料
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {downloadUrls.map((item, idx) => (
              <a
                key={item.url || idx}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-brand-900 hover:bg-brand-800 text-white rounded-xl shadow transition text-center flex flex-col justify-center items-center gap-1 group"
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <svg className="w-4 h-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {item.label}
                </div>
                <span className="text-[11px] text-slate-300 group-hover:text-white">
                  PDFを開く・ダウンロードする →
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* 無料面談・相談案内 */}
        <div className="p-6 bg-brand-50/50 rounded-2xl border border-brand-200 text-center space-y-4">
          <span className="text-xs font-bold text-brand-700 bg-brand-100/60 px-3 py-1 rounded-full uppercase tracking-wider border border-brand-300">
            代表または専任コンサルタントによる個別相談
          </span>
          <h4 className="text-lg sm:text-xl font-bold font-serif text-slate-900">
            資料の内容を自社に落とし込む「30分無料オンライン相談」
          </h4>
          <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
            「自社の場合、どのツールで自動化できるか」「自社の業態で介護保険外サービスを開業できるか」など、具体的な疑問を直接画面共有しながら相談いただけます。
          </p>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              無料相談の日程を予約する（TimeRex・30分）
            </a>
            <a
              href="https://lin.ee/qWsuD6f"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl text-xs sm:text-sm transition shadow"
            >
              LINEで質問・日程調整する
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

      {/* ご希望の資料（動的複数選択チェックボックスUI） */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-slate-800">
            ご希望の資料を選択してください（複数選択可） <span className="text-rose-500">*</span>
          </label>
          {availableMaterials.length > 1 && (
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] font-bold text-brand-700 hover:text-brand-900 underline"
            >
              すべて選択
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {availableMaterials.map((mat) => {
            const isChecked = selectedKeys.includes(mat.key);
            return (
              <label
                key={mat.key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  isChecked
                    ? 'border-brand-700 bg-brand-50/60 shadow-sm'
                    : 'border-sand-300 bg-white hover:bg-sand-50/50'
                }`}
              >
                <input
                  type="checkbox"
                  name="material_keys"
                  value={mat.key}
                  checked={isChecked}
                  onChange={() => toggleMaterial(mat.key)}
                  className="mt-1 text-brand-700 rounded focus:ring-brand-500"
                />
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    {mat.label}
                  </div>
                  {mat.description && (
                    <div className="text-[11px] text-gray-600 mt-0.5">
                      {mat.description}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 連絡先入力欄 */}
      <div className="space-y-4 pt-2">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            会社名・屋号 <span className="text-gray-400 font-normal">（個人の場合は「個人」とご記入ください）</span>
          </label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            placeholder="例: 有限会社〇〇 / 個人開業準備中"
            className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              お名前 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例: 山田 太郎"
              className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              メールアドレス <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="例: yamada@example.com"
              className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            電話番号 <span className="text-gray-400 font-normal">（任意）</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="例: 090-1234-5678"
            className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            どこで知りましたか？ <span className="text-gray-400 font-normal">（任意）</span>
          </label>
          <select
            value={formData.hear_about}
            onChange={(e) => setFormData({ ...formData, hear_about: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-sand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs sm:text-sm bg-white text-slate-800 cursor-pointer"
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
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-brand-900 hover:bg-brand-800 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm sm:text-base group disabled:opacity-50"
        >
          {loading ? (
            <span className="animate-pulse">送信中...</span>
          ) : (
            <>
              <span>無料資料を今すぐ受け取る</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
        <p className="text-[11px] text-gray-500 text-center mt-2">
          ご入力いただいた情報は、資料送付および関連するご案内のみに使用いたします。強引な営業は一切行いません。
        </p>
      </div>
    </form>
  );
}
