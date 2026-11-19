import React from 'react';
import { SENDER_PROFILE, stripTrailingLegacySignature } from '../../../server/emailFooter';

interface EmailHtmlPreviewCardProps {
  body: string;
  senderEmail?: string;
  unsubscribeUrl?: string;
  embeddedDocument?: {
    title?: string;
    documentType?: string;
    bodyHtml?: string | null;
    docUrl?: string;
    pdfUrl?: string;
  } | null;
  className?: string;
}

/**
 * 実際の送信メール（Resend HTMLメール）と同一構成のビジュアルプレビュー。
 * 末尾のMSTロゴ入りHTML署名・配信停止リンクを安全にJSXで描画する。
 */
export const EmailHtmlPreviewCard: React.FC<EmailHtmlPreviewCardProps> = ({
  body,
  senderEmail = 'contact@mstcorp.info',
  unsubscribeUrl,
  embeddedDocument,
  className = '',
}) => {
  const original = String(body || '').replace(/\s+$/, '');
  const { text: cleanBody, stripped } = stripTrailingLegacySignature(original);
  const shouldIncludeSignature = stripped || !cleanBody.includes(SENDER_PROFILE.addressMarker);
  const mail = String(senderEmail || '').trim();
  const cleanUnsub = String(unsubscribeUrl || '').trim();
  const isHttpUnsub = /^https?:\/\/[^\s<>"']+$/i.test(cleanUnsub);
  const sanitizedDocHtml = embeddedDocument?.bodyHtml
    ? String(embeddedDocument.bodyHtml)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    : '';

  return (
    <div className={`text-slate-800 ${className}`}>
      <div className="whitespace-pre-wrap leading-relaxed">
        {cleanBody}
      </div>

      {shouldIncludeSignature && (
        <div className="mt-6 pt-4 border-t border-slate-300 flex items-center gap-3.5">
          <div className="shrink-0 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <img
              src="/images/mst-logo.png"
              alt={SENDER_PROFILE.logoAlt}
              width={100}
              height={40}
              className="block w-[100px] h-[40px] object-contain"
            />
          </div>
          <div className="text-[11px] leading-relaxed text-slate-700 min-w-0">
            <div className="text-xs font-bold text-slate-900">
              {SENDER_PROFILE.companyLine}
            </div>
            <div>
              {SENDER_PROFILE.postalCode} {SENDER_PROFILE.address}
            </div>
            <div className="truncate">
              HP:{' '}
              <span className="text-sky-700 underline">
                {SENDER_PROFILE.website}
              </span>
            </div>
            {mail && (
              <div className="truncate">
                Mail: <span className="text-sky-700 underline">{mail}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {embeddedDocument && sanitizedDocHtml && (
        <div className="mt-6 rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-2">
            <div className="text-xs font-bold text-slate-900">
              送付書類：{embeddedDocument.title || '書類'}
            </div>
            <div className="flex flex-wrap gap-2">
              {embeddedDocument.docUrl && (
                <a
                  href={embeddedDocument.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold no-underline"
                >
                  {embeddedDocument.documentType === 'invoice' || embeddedDocument.documentType === 'monthly_report'
                    ? 'Web上で内容を確認・受領連絡'
                    : 'Web上で内容を確認・お申し込み'}
                </a>
              )}
              {embeddedDocument.pdfUrl && (
                <a
                  href={embeddedDocument.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-bold no-underline"
                >
                  PDFをダウンロード（印刷・保存用）
                </a>
              )}
            </div>
          </div>
          <div
            className="p-4 text-xs leading-relaxed text-slate-900 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: sanitizedDocHtml }}
          />
        </div>
      )}

      {cleanUnsub && (
        <div className="mt-3.5 pt-2.5 border-t border-dashed border-slate-200 text-[11px] text-slate-500 break-all">
          配信停止はこちら:{' '}
          {isHttpUnsub ? (
            <span className="underline">{cleanUnsub}</span>
          ) : (
            <span>{cleanUnsub}</span>
          )}
        </div>
      )}
    </div>
  );
};
