import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Printer, FileText, CheckCircle2, Clock, AlertCircle, Copy, Check } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

export interface PreviewableDocument {
  id: string;
  title: string;
  document_type?: string;
  status?: string;
  body_html?: string | null;
  company_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface DocumentPreviewModalProps {
  documentId?: string | null;
  document?: PreviewableDocument | null;
  companyName?: string;
  onClose: () => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  estimate: { label: '見積書', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  invoice: { label: '請求書', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  contract: { label: '契約書', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  proposal: { label: '提案書', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  diagnosis_report: { label: '診断レポート', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  monthly_report: { label: '月次報告書', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  other: { label: 'その他書類', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  awaiting_approval: { label: '承認待ち', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: '承認済み', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  queued: { label: '送信待ち', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  sent: { label: '送信済み', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  archived: { label: '保管済み', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  documentId,
  document: initialDoc,
  companyName: initialCompanyName,
  onClose,
}) => {
  const [doc, setDoc] = useState<PreviewableDocument | null>(initialDoc || null);
  const [companyName, setCompanyName] = useState<string>(initialCompanyName || '');
  const [loading, setLoading] = useState<boolean>(!initialDoc && Boolean(documentId));
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (initialDoc) {
      setDoc(initialDoc);
      if (initialCompanyName) setCompanyName(initialCompanyName);
      return;
    }

    if (!documentId) return;

    let cancelled = false;
    const fetchDoc = async () => {
      setLoading(true);
      setError('');
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('データベース接続が利用できません。');

        const { data, error: fetchErr } = await supabase
          .from('customer_documents')
          .select('id, title, document_type, status, body_html, company_id, created_at, updated_at')
          .eq('id', documentId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!data) throw new Error('指定された書類データが見つかりませんでした。');

        if (!cancelled) {
          setDoc(data);

          if (data.company_id && !initialCompanyName) {
            const { data: cData } = await supabase
              .from('companies')
              .select('company_name')
              .eq('id', data.company_id)
              .maybeSingle();
            if (cData?.company_name && !cancelled) {
              setCompanyName(cData.company_name);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || '書類の取得に失敗しました。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDoc();
    return () => {
      cancelled = true;
    };
  }, [documentId, initialDoc, initialCompanyName]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const docUrl = doc ? `${window.location.origin}/docs/${encodeURIComponent(doc.id)}` : '';

  const handleCopyUrl = async () => {
    if (!docUrl) return;
    try {
      await navigator.clipboard.writeText(docUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handlePrint = () => {
    if (!doc?.body_html) {
      window.print();
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${doc.title || '書類印刷'}</title>
            <meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20mm; color: #0f172a; line-height: 1.6; }
              table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
              th { background-color: #f8fafc; font-weight: bold; }
              @media print { body { margin: 10mm; } }
            </style>
          </head>
          <body>
            ${doc.body_html}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    } else {
      window.print();
    }
  };

  const docTypeInfo = typeLabels[doc?.document_type || ''] || typeLabels.other;
  const statusInfo = statusLabels[doc?.status || ''] || statusLabels.draft;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-slate-50 border border-slate-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${docTypeInfo.color}`}>
                  {docTypeInfo.label}
                </span>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {companyName && (
                  <span className="text-xs font-semibold text-slate-500 truncate max-w-[200px]">
                    · {companyName}
                  </span>
                )}
              </div>
              <h2 id="preview-modal-title" className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5">
                {doc?.title || '書類プレビュー'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {doc && (
              <a
                href={`/api/documents/${encodeURIComponent(doc.id)}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                title="PDFファイルを直接ダウンロード・確認"
              >
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">PDFダウンロード</span>
              </a>
            )}
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
                title="新しいタブで公開用閲覧画面を開く"
              >
                <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">公開ページを開く</span>
              </a>
            )}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !doc}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="印刷またはブラウザ印刷PDF保存"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">印刷</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata sub-bar */}
        <div className="bg-slate-100/80 px-5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            {companyName && (
              <div>
                <span className="text-slate-500">発行先: </span>
                <span className="font-semibold text-slate-800">{companyName} 様</span>
              </div>
            )}
            {doc?.created_at && (
              <div>
                <span className="text-slate-500">作成日: </span>
                <span className="font-mono text-slate-700">{doc.created_at.slice(0, 10)}</span>
              </div>
            )}
            <div className="text-[11px] text-purple-700 font-medium">
              ※ メール送信時、この書類のPDFファイルが自動添付され、本文にもセキュア閲覧URL（{'{書類URL}'}）が自動挿入されます
            </div>
          </div>

          {docUrl && (
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-700 hover:text-purple-900 cursor-pointer bg-white px-2 py-0.5 rounded border border-purple-200"
              title="書類URLをクリップボードにコピー"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'URLをコピーしました' : '書類URLをコピー'}</span>
            </button>
          )}
        </div>

        {/* Body / Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-200/50">
          {loading && (
            <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
              <Clock className="w-6 h-6 animate-spin text-purple-600" />
              <span>書類データを読み込み中…</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && doc && (
            <div className="mx-auto max-w-3xl bg-white border border-slate-300 rounded-xl shadow-md p-6 sm:p-10 min-h-[480px]">
              {doc.body_html ? (
                <div
                  className="prose prose-sm max-w-none text-slate-900 leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: doc.body_html }}
                />
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-600 text-sm">書類本文（HTML）が登録されていません</p>
                  <p className="text-xs text-slate-400 mt-1">「書類作成」画面からテンプレートを適用して内容を保存してください。</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            送信内容や添付内容に問題がないことを確認のうえ送信してください。
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
