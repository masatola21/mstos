import React from 'react';
import { CHAPTERS, parseDiagnosisReport } from '../../constants/proposalChapters';

interface FormattedReportViewProps {
  text?: string | null;
  fallback?: string;
  compact?: boolean;
}

function normalizeBody(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[ \t]*[-*]\s+/gm, '・')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderInlineEmphasis(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  return parts.map((part, idx) => {
    const m = part.match(/^\*\*([^*\n]+?)\*\*$/);
    if (m) {
      return (
        <strong
          key={idx}
          className="font-bold text-blue-900 bg-amber-100/90 px-1 py-0.5 rounded"
        >
          {m[1]}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part.replace(/\*\*/g, '')}</React.Fragment>;
  });
}

export const FormattedReportView: React.FC<FormattedReportViewProps> = ({
  text,
  fallback = 'レポート本文はまだ作成されていません。',
  compact = false,
}) => {
  const raw = String(text ?? '').trim();
  if (!raw) {
    return <p className="text-sm text-slate-400">{fallback}</p>;
  }

  const parsed = parseDiagnosisReport(raw);
  if (parsed.legacy) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
        {renderInlineEmphasis(normalizeBody(raw))}
      </div>
    );
  }

  const visibleChapters = parsed.chapters.filter((c) => {
    const def = CHAPTERS.find((d) => d.id === c.id);
    return def?.customerVisible !== false;
  });

  if (visibleChapters.length === 0) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
        {renderInlineEmphasis(normalizeBody(raw))}
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {visibleChapters.map((c) => {
        const def = CHAPTERS.find((d) => d.id === c.id);
        const title = def ? def.title : c.id;
        const cardClass =
          c.id === 'D0'
            ? 'rounded-lg border border-blue-200 bg-blue-50/70 p-3'
            : c.id === 'D3'
              ? 'rounded-lg border border-slate-300 bg-slate-50 p-3'
              : 'px-1';
        return (
          <div key={c.id} className="space-y-1.5">
            <h4 className="flex items-center gap-2 border-l-4 border-blue-600 pl-2.5 text-sm font-bold text-blue-950">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-800">
                {c.id}
              </span>
              <span>{title}</span>
            </h4>
            <div className={`${cardClass} whitespace-pre-wrap text-sm leading-7 text-slate-800`}>
              {renderInlineEmphasis(normalizeBody(c.body))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
