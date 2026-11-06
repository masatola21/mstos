import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Copy, Check, ClipboardList, CheckCircle2 } from 'lucide-react';
export const ChatMessageContent = ({ content, onOpenPlanProposal, }) => {
    const [copiedIndex, setCopiedIndex] = useState(null);
    const copyCode = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };
    // Simple and safe markdown parser for bold, italics, code blocks, lists, quotes, and headings
    const parseMarkdown = (raw) => {
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
                }
                else {
                    codeBody = lines.join('\n');
                }
                // Special handling for `plan` block
                if (language === 'plan') {
                    try {
                        const planData = JSON.parse(codeBody);
                        return (_jsxs("div", { className: "my-3.5 rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/40 to-slate-900/90 p-4 shadow-lg space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 border-b border-indigo-500/20 pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(ClipboardList, { className: "w-4 h-4 text-indigo-400" }), _jsx("span", { className: "text-xs font-bold text-white", children: "AI\u793E\u9577\u306E\u63D0\u6848\u8A08\u753B" }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30", children: "\u672A\u767B\u9332\uFF08\u8981\u78BA\u8A8D\uFF09" })] }), onOpenPlanProposal && (_jsxs("button", { type: "button", onClick: () => onOpenPlanProposal(planData), className: "px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u30BF\u30B9\u30AF\u767B\u9332" })] }))] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-bold text-indigo-200", children: planData.projectName }), _jsx("div", { className: "text-xs text-slate-300 mt-0.5 leading-relaxed", children: planData.projectObjective })] }), planData.tasks && planData.tasks.length > 0 && (_jsxs("div", { className: "space-y-1.5 pt-1", children: [_jsxs("div", { className: "text-[11px] font-semibold text-slate-400", children: ["\u63D0\u6848\u30BF\u30B9\u30AF\u4E00\u89A7 (", planData.tasks.length, "\u4EF6):"] }), _jsx("div", { className: "grid grid-cols-1 gap-1.5", children: planData.tasks.map((t, tIdx) => (_jsxs("div", { className: "px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("span", { className: "font-semibold text-slate-100", children: t.title }), t.completionCriteria && (_jsxs("div", { className: "text-[11px] text-slate-400 truncate", children: ["\u5B8C\u4E86\u6761\u4EF6: ", t.completionCriteria] }))] }), _jsxs("div", { className: "flex items-center gap-1.5 shrink-0", children: [_jsxs("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300", children: ["\u62C5\u5F53\u6848: ", t.suggestedAssignee] }), _jsxs("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300", children: ["\u512A\u5148\u5EA6: ", t.priority === 'high' ? '高' : t.priority === 'medium' ? '中' : '低'] })] })] }, tIdx))) })] }))] }, partIdx));
                    }
                    catch (e) {
                        // fallback to code block if json invalid
                    }
                }
                return (_jsxs("div", { className: "my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900/95 shadow-md", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-xs text-slate-300", children: [_jsx("span", { className: "font-mono uppercase tracking-wider text-[11px] text-slate-400", children: language || 'CODE' }), _jsx("button", { type: "button", onClick: () => copyCode(codeBody, partIdx), className: "flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-700/50", children: copiedIndex === partIdx ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" }), _jsx("span", { className: "text-[11px] text-emerald-400", children: "\u30B3\u30D4\u30FC\u5B8C\u4E86" })] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), _jsx("span", { className: "text-[11px]", children: "\u30B3\u30FC\u30C9\u3092\u30B3\u30D4\u30FC" })] })) })] }), _jsx("pre", { className: "p-3 text-xs md:text-sm font-mono overflow-x-auto text-emerald-300/90 leading-relaxed whitespace-pre", children: _jsx("code", { children: codeBody }) })] }, partIdx));
            }
            // Normal text: split by lines
            const lines = part.split('\n');
            return (_jsx("span", { children: lines.map((line, lineIdx) => {
                    // Header 3 or 2
                    if (line.startsWith('### ')) {
                        return (_jsx("h4", { className: "text-base font-bold text-indigo-200 mt-3 mb-1", children: renderInline(line.replace('### ', '')) }, lineIdx));
                    }
                    if (line.startsWith('## ')) {
                        return (_jsx("h3", { className: "text-lg font-bold text-indigo-300 mt-4 mb-2 border-b border-indigo-500/20 pb-1", children: renderInline(line.replace('## ', '')) }, lineIdx));
                    }
                    if (line.startsWith('# ')) {
                        return (_jsx("h2", { className: "text-xl font-extrabold text-white mt-4 mb-2", children: renderInline(line.replace('# ', '')) }, lineIdx));
                    }
                    // Bullet list
                    if (line.startsWith('- ') || line.startsWith('* ')) {
                        return (_jsxs("div", { className: "flex items-start gap-2 my-1 pl-1", children: [_jsx("span", { className: "text-indigo-400 select-none mt-1 text-xs", children: "\u2022" }), _jsx("div", { className: "flex-1 leading-relaxed", children: renderInline(line.slice(2)) })] }, lineIdx));
                    }
                    // Numbered list
                    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
                    if (numMatch) {
                        return (_jsxs("div", { className: "flex items-start gap-2 my-1 pl-1", children: [_jsxs("span", { className: "text-indigo-400 font-semibold text-xs select-none mt-0.5", children: [numMatch[1], "."] }), _jsx("div", { className: "flex-1 leading-relaxed", children: renderInline(numMatch[2]) })] }, lineIdx));
                    }
                    // Quote block
                    if (line.startsWith('> ')) {
                        return (_jsx("blockquote", { className: "border-l-2 border-indigo-400/60 pl-3 my-2 text-slate-300/90 italic bg-indigo-950/20 py-1 rounded-r", children: renderInline(line.replace('> ', '')) }, lineIdx));
                    }
                    // Empty line
                    if (line.trim() === '') {
                        return _jsx("div", { className: "h-2" }, lineIdx);
                    }
                    return (_jsx("p", { className: "leading-relaxed mb-1.5 last:mb-0", children: renderInline(line) }, lineIdx));
                }) }, partIdx));
        });
    };
    // Inline formatting: `code`, **bold**, *italic*
    const renderInline = (text) => {
        // inline code
        const chunks = text.split(/(`[^`]+`)/g);
        return chunks.map((chunk, i) => {
            if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
                return (_jsx("code", { className: "bg-slate-800 text-indigo-300 text-xs px-1.5 py-0.5 rounded font-mono border border-slate-700/60 mx-0.5", children: chunk.slice(1, -1) }, i));
            }
            // bold **text**
            const boldChunks = chunk.split(/(\*\*[^*]+\*\*)/g);
            return boldChunks.map((bChunk, bi) => {
                if (bChunk.startsWith('**') && bChunk.endsWith('**') && bChunk.length > 4) {
                    return (_jsx("strong", { className: "font-semibold text-white", children: bChunk.slice(2, -2) }, `${i}-${bi}`));
                }
                return bChunk;
            });
        });
    };
    return _jsx("div", { className: "space-y-1 text-sm md:text-[15px]", children: parseMarkdown(content) });
};
