import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileText
} from 'lucide-react';

interface PublicDocument {
  id: string;
  title: string;
  documentType: string;
  status: string;
  bodyHtml: string;
  companyId?: string;
  companyName?: string;
  dealId?: string;
  dealStatus?: string;
  dealAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface PublicDocumentApplyViewProps {
  documentId: string;
}

export const PublicDocumentApplyView: React.FC<PublicDocumentApplyViewProps> = ({ documentId }) => {
  const [doc, setDoc] = useState<PublicDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [resultDealId, setResultDealId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/api/public/documents/${encodeURIComponent(documentId)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '書類が見つかりませんでした。');
        }
        const data = await res.json();
        if (cancelled) return;
        setDoc(data.document);
        if (data.document?.status === 'approved' || data.document?.dealStatus === '成約' || data.document?.dealStatus === '受注') {
          setApplied(true);
          setResultDealId(data.document.dealId || null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || '書類の読み込みに失敗しました。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchDocument();
    return () => { cancelled = true; };
  }, [documentId]);

  const handleExecuteApply = async () => {
    try {
      setSubmitting(true);
      setError('');
      setShowConfirmModal(false);

      const res = await fetch(`/api/public/documents/${encodeURIComponent(documentId)}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'お申し込みの処理に失敗しました。');
      }

      setApplied(true);
      setResultDealId(data.dealId || null);
      if (doc) {
        setDoc({
          ...doc,
          status: 'approved',
          dealId: data.dealId,
          dealStatus: '成約',
        });
      }
    } catch (err: any) {
      setError(err.message || 'お申し込みを完了できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-6">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
        <p className="text-sm font-medium">書類情報を確認しています…</p>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">書類を表示できません</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            トップページへ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="no-print sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-600/30">
            MST
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">有限会社MST</div>
            <div className="text-[10px] text-slate-400">公式Web申込・電子承諾ポータル</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">印刷 / PDF保存</span>
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* 成約完了バナー */}
        {applied && (
          <div className="no-print rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">
                    成約・お申し込み完了
                  </span>
                  {resultDealId && (
                    <span className="text-xs font-mono text-slate-400">
                      商談管理番号: {resultDealId}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  お申し込み誠にありがとうございます！
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  本提案・見積内容でのお申し込みが正常に受理され、システム上で<strong className="text-emerald-400 font-semibold">「即時成約（受注）」</strong>として確定いたしました。<br />
                  担当責任者（大橋真人）より、初回キックオフおよび今後の進め方について折り返しご連絡差し上げます。
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>成約控えを印刷・PDF保存</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 書類カード */}
        <div className="print-area rounded-2xl border border-slate-800 bg-white text-slate-900 shadow-2xl overflow-hidden">
          {/* 書類タイトルバー（Web閲覧時） */}
          <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-800">{doc?.title}</span>
            </div>
            {doc?.companyName && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Building2 className="w-3.5 h-3.5" />
                <span>宛先: <strong>{doc.companyName}</strong> 御中</span>
              </div>
            )}
          </div>

          {/* 書類本文HTML */}
          <div
            className="p-6 sm:p-12 document-body"
            dangerouslySetInnerHTML={{ __html: doc?.bodyHtml || '' }}
          />
        </div>

        {/* Web申込CTAセクション（未成約の場合に表示） */}
        {!applied && (
          <div className="no-print rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">
                    ワンタップオンライン発注
                  </span>
                  <span className="text-xs text-slate-400">即時成約システム</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  この内容で申し込む（発注を確定する）
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  上記のお見積もり・提案内容をご確認いただき、よろしければ下記よりお申し込みください。<br className="hidden sm:inline" />
                  Web上で確定された瞬間に商談が起票され、正式に成約手続きが行われます。
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* 同意チェック */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  上記の内容（金額、委託範囲、支払条件等）を確認し、本内容での発注および申し込みに同意します。
                </span>
              </label>
            </div>

            {/* 申込ボタン */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>有限会社MST SSL暗号化セキュア成約システム</span>
              </div>

              <button
                type="button"
                disabled={!agreeChecked || submitting}
                onClick={() => setShowConfirmModal(true)}
                className={`px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                  agreeChecked && !submitting
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:scale-[1.01]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>成約処理中…</span>
                  </>
                ) : (
                  <>
                    <span>この内容で申し込む</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 確認モーダル */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">お申し込みの最終確認</h3>
                <p className="text-xs text-slate-400">成約の確定手続き</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">書類件名:</span>
                <span className="font-medium text-white text-right">{doc?.title}</span>
              </div>
              {doc?.companyName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">宛先企業:</span>
                  <span className="font-medium text-white">{doc.companyName} 様</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              「確定して申し込む」を押すと、即座に商談が起票され成約（受注）として受理されます。よろしいですか？
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExecuteApply}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                確定して申し込む
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フッター */}
      <footer className="no-print mt-auto border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} 有限会社MST. All rights reserved.
      </footer>
    </div>
  );
};
