import React, { useState } from 'react';
import { Copy, Check, ClipboardList, CheckCircle2 } from 'lucide-react';
import { ProposedPlan } from '../types';

interface ChatMessageContentProps {
  content: string;
  onOpenPlanProposal?: (plan: ProposedPlan) => void;
}

export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({
  content,
  onOpenPlanProposal,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Simple and safe markdown parser for bold, italics, code blocks, lists, quotes, and headings
  const parseMarkdown = (raw: string) => {
    // Split into code blocks and normal text
    const parts = raw.split(/(```[\s\S]*?```)/g);

    return parts.map((part, partIdx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        let language = 'text';
        let codeBody = '';
        if (lines[0] && !lines[0].includes(' ') && lines[0].length < 20) {
          language = lines[0].trim().toLowerCase();
          codeBody = lines.slice(1).join('\n');
        } else {
          codeBody = lines.join('\n');
        }

        // Special handling for `plan` block
        if (language === 'plan') {
          try {
            const planData: ProposedPlan = JSON.parse(codeBody);
            return (
              <div
                key={partIdx}
                className="my-3.5 rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/40 to-slate-900/90 p-4 shadow-lg space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-indigo-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">AI社長の提案計画</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      未登録（要確認）
                    </span>
                  </div>
                  {onOpenPlanProposal && (
                    <button
                      type="button"
                      onClick={() => onOpenPlanProposal(planData)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>内容を確認してタスク登録</span>
                    </button>
                  )}
                </div>

                <div>
                  <div className="text-sm font-bold text-indigo-200">{planData.projectName}</div>
                  <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    {planData.projectObjective}
                  </div>
                </div>

                {/* Tasks preview list */}
                {planData.tasks && planData.tasks.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-semibold text-slate-400">
                      提案タスク一覧 ({planData.tasks.length}件):
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {planData.tasks.map((t, tIdx) => (
                        <div
                          key={tIdx}
                          className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-100">{t.title}</span>
                            {t.completionCriteria && (
                              <div className="text-[11px] text-slate-400 truncate">
                                完了条件: {t.completionCriteria}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              担当案: {t.suggestedAssignee}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                              優先度: {t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          } catch (e) {
            // fallback to code block if json invalid
          }
        }

        return (
          <div key={partIdx} className="my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900/95 shadow-md">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-xs text-slate-300">
              <span className="font-mono uppercase tracking-wider text-[11px] text-slate-400">{language || 'CODE'}</span>
              <button
                type="button"
                onClick={() => copyCode(codeBody, partIdx)}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-700/50"
              >
                {copiedIndex === partIdx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] text-emerald-400">コピー完了</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">コードをコピー</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 text-xs md:text-sm font-mono overflow-x-auto text-emerald-300/90 leading-relaxed whitespace-pre">
              <code>{codeBody}</code>
            </pre>
          </div>
        );
      }

      // Normal text: split by lines
      const lines = part.split('\n');
      return (
        <span key={partIdx}>
          {lines.map((line, lineIdx) => {
            // Header 3 or 2
            if (line.startsWith('### ')) {
              return (
                <h4 key={lineIdx} className="text-base font-bold text-indigo-200 mt-3 mb-1">
                  {renderInline(line.replace('### ', ''))}
                </h4>
              );
            }
            if (line.startsWith('## ')) {
              return (
                <h3 key={lineIdx} className="text-lg font-bold text-indigo-300 mt-4 mb-2 border-b border-indigo-500/20 pb-1">
                  {renderInline(line.replace('## ', ''))}
                </h3>
              );
            }
            if (line.startsWith('# ')) {
              return (
                <h2 key={lineIdx} className="text-xl font-extrabold text-white mt-4 mb-2">
                  {renderInline(line.replace('# ', ''))}
                </h2>
              );
            }

            // Bullet list
            if (line.startsWith('- ') || line.startsWith('* ')) {
              return (
                <div key={lineIdx} className="flex items-start gap-2 my-1 pl-1">
                  <span className="text-indigo-400 select-none mt-1 text-xs">•</span>
                  <div className="flex-1 leading-relaxed">{renderInline(line.slice(2))}</div>
                </div>
              );
            }

            // Numbered list
            const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
            if (numMatch) {
              return (
                <div key={lineIdx} className="flex items-start gap-2 my-1 pl-1">
                  <span className="text-indigo-400 font-semibold text-xs select-none mt-0.5">{numMatch[1]}.</span>
                  <div className="flex-1 leading-relaxed">{renderInline(numMatch[2])}</div>
                </div>
              );
            }

            // Quote block
            if (line.startsWith('> ')) {
              return (
                <blockquote key={lineIdx} className="border-l-2 border-indigo-400/60 pl-3 my-2 text-slate-300/90 italic bg-indigo-950/20 py-1 rounded-r">
                  {renderInline(line.replace('> ', ''))}
                </blockquote>
              );
            }

            // Empty line
            if (line.trim() === '') {
              return <div key={lineIdx} className="h-2" />;
            }

            return (
              <p key={lineIdx} className="leading-relaxed mb-1.5 last:mb-0">
                {renderInline(line)}
              </p>
            );
          })}
        </span>
      );
    });
  };

  // Inline formatting: `code`, **bold**, *italic*
  const renderInline = (text: string) => {
    // inline code
    const chunks = text.split(/(`[^`]+`)/g);
    return chunks.map((chunk, i) => {
      if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
        return (
          <code key={i} className="bg-slate-800 text-indigo-300 text-xs px-1.5 py-0.5 rounded font-mono border border-slate-700/60 mx-0.5">
            {chunk.slice(1, -1)}
          </code>
        );
      }

      // bold **text**
      const boldChunks = chunk.split(/(\*\*[^*]+\*\*)/g);
      return boldChunks.map((bChunk, bi) => {
        if (bChunk.startsWith('**') && bChunk.endsWith('**') && bChunk.length > 4) {
          return (
            <strong key={`${i}-${bi}`} className="font-semibold text-white">
              {bChunk.slice(2, -2)}
            </strong>
          );
        }
        return bChunk;
      });
    });
  };

  return <div className="space-y-1 text-sm md:text-[15px]">{parseMarkdown(content)}</div>;
};
