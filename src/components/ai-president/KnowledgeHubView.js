import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Search, Trash2, Save, Download, Paperclip, Loader2 } from 'lucide-react';
import { AI_WORK_MODES } from '../../data/aiWorkModes';
const CATEGORIES = [
    { id: 'business', label: '事業方針・共通資料' },
    { id: 'product', label: '商品情報' },
    { id: 'customer', label: '顧客情報' },
    { id: 'decision', label: '決定事項' },
    { id: 'research', label: '調査・根拠資料' },
    { id: 'deliverable', label: '成果物' },
];
const blankItem = () => ({
    id: `knowledge-${Date.now()}`,
    title: '',
    category: 'business',
    content: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    knowledgeAccess: { scope: 'president', roleIds: [] },
});
export const KnowledgeHubView = ({ items, onSave, onDelete, selectedItemId, onUploadAttachment, onDownloadAttachment, onDeleteAttachment }) => {
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeRoleId, setActiveRoleId] = useState('all');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [tagText, setTagText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [attachmentError, setAttachmentError] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);
    const lastOpenedSelection = useRef(null);
    const saveMarkdown = (item) => {
        const safeTitle = item.title.trim().replace(/[\\/:*?"<>|]/g, '_') || 'knowledge';
        const tags = item.tags.length ? `\n\nタグ: ${item.tags.join(', ')}` : '';
        const markdown = `# ${item.title}\n\n分類: ${CATEGORIES.find((category) => category.id === item.category)?.label || item.category}${tags}\n\n${item.content}`;
        const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${safeTitle}.md`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const uploadAttachments = async (fileList) => {
        if (!editing || !fileList?.length)
            return;
        if (!items.some((item) => item.id === editing.id)) {
            setAttachmentError('先にタイトルと本文を保存してから、ファイルを添付してください。');
            return;
        }
        setAttachmentError('');
        setIsUploading(true);
        try {
            let updated = editing;
            for (const file of Array.from(fileList)) {
                const attachment = await onUploadAttachment(editing.id, file);
                updated = { ...updated, attachments: [...(updated.attachments || []), attachment], updatedAt: Date.now() };
                setEditing(updated);
                onSave(updated);
            }
        }
        catch (error) {
            setAttachmentError(error instanceof Error ? error.message : 'ファイルを添付できませんでした。');
        }
        finally {
            setIsUploading(false);
        }
    };
    const downloadAttachment = async (attachment) => {
        try {
            const blob = await onDownloadAttachment(attachment);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = attachment.fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        catch (error) {
            setAttachmentError(error instanceof Error ? error.message : 'ファイルをダウンロードできませんでした。');
        }
    };
    const removeAttachment = async (attachment) => {
        if (!editing)
            return;
        setAttachmentError('');
        try {
            await onDeleteAttachment(attachment);
            const updated = { ...editing, attachments: (editing.attachments || []).filter((item) => item.id !== attachment.id), updatedAt: Date.now() };
            setEditing(updated);
            onSave(updated);
        }
        catch (error) {
            setAttachmentError(error instanceof Error ? error.message : 'ファイルを削除できませんでした。');
        }
    };
    useEffect(() => {
        if (!selectedItemId || lastOpenedSelection.current === selectedItemId)
            return;
        const selectedItem = items.find((item) => item.id === selectedItemId);
        if (!selectedItem)
            return;
        lastOpenedSelection.current = selectedItemId;
        setActiveCategory('all');
        setQuery('');
        setEditing({ ...selectedItem });
        setTagText(selectedItem.tags.join(', '));
    }, [selectedItemId, items]);
    const visibleItems = useMemo(() => items.filter((item) => {
        const categoryMatches = activeCategory === 'all' || item.category === activeCategory;
        const access = item.knowledgeAccess;
        const roleMatches = activeRoleId === 'all'
            || (activeRoleId === 'president'
                ? !access || access.scope === 'all' || access.scope === 'president' || access.scope === 'roles'
                : Boolean(access && (access.scope === 'all' || (access.scope === 'roles' && (access.roleIds || []).includes(activeRoleId)))));
        const text = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
        return categoryMatches && roleMatches && text.includes(query.toLowerCase());
    }), [items, activeCategory, activeRoleId, query]);
    const startNew = () => { setEditing(blankItem()); setTagText(''); };
    const startEdit = (item) => { setEditing({ ...item }); setTagText(item.tags.join(', ')); };
    const save = () => {
        if (!editing?.title.trim() || !editing.content.trim())
            return;
        onSave({ ...editing, title: editing.title.trim(), tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean), updatedAt: Date.now() });
        setEditing(null);
    };
    return (_jsxs("div", { className: "max-w-6xl mx-auto px-4 py-6 space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u4E8B\u696D\u30CA\u30EC\u30C3\u30B8\u30FB\u6210\u679C\u7269" }), _jsxs("button", { onClick: startNew, className: "shrink-0 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white flex items-center gap-1.5 hover:bg-purple-700 transition cursor-pointer", children: [_jsx(FilePlus2, { className: "w-3.5 h-3.5" }), "\u8CC7\u6599\u3092\u8FFD\u52A0"] })] }), editing && (_jsxs("section", { className: "rounded-2xl border border-purple-200 bg-white p-5 space-y-3 shadow-md", children: [_jsx("input", { value: editing.title, onChange: (e) => setEditing({ ...editing, title: e.target.value }), placeholder: "\u30BF\u30A4\u30C8\u30EB\uFF08\u4F8B\uFF1A\u4E8B\u696D\u65B9\u91DD.md\uFF09", className: "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" }), _jsxs("div", { className: "grid md:grid-cols-2 gap-3", children: [_jsx("select", { value: editing.category, onChange: (e) => setEditing({ ...editing, category: e.target.value }), className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs", children: CATEGORIES.map((category) => _jsx("option", { value: category.id, children: category.label }, category.id)) }), _jsx("input", { value: tagText, onChange: (e) => setTagText(e.target.value), placeholder: "\u30BF\u30B0\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09", className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["AI\u306E\u53C2\u7167\u7BC4\u56F2", _jsxs("select", { value: editing.knowledgeAccess?.scope || 'president', onChange: (e) => setEditing({ ...editing, knowledgeAccess: { ...editing.knowledgeAccess, scope: e.target.value, roleIds: editing.knowledgeAccess?.roleIds || [] } }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs", children: [_jsx("option", { value: "all", children: "AI\u793E\u9577\u30FB\u3059\u3079\u3066\u306E\u5F79\u5272AI" }), _jsx("option", { value: "president", children: "AI\u793E\u9577\u306E\u307F" }), _jsx("option", { value: "roles", children: "AI\u793E\u9577\u3068\u6307\u5B9A\u3057\u305F\u5F79\u5272AI" })] })] }), editing.knowledgeAccess?.scope === 'roles' && (_jsxs("fieldset", { className: "rounded-xl border border-slate-200 bg-slate-50 p-3", children: [_jsx("legend", { className: "px-1 text-xs font-semibold text-slate-700", children: "\u53C2\u7167\u3092\u8A31\u53EF\u3059\u308B\u5F79\u5272AI" }), _jsx("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2", children: AI_WORK_MODES.filter((mode) => mode.id !== 'president').map((mode) => {
                                    const roleIds = editing.knowledgeAccess?.roleIds || [];
                                    return (_jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-700 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: roleIds.includes(mode.id), onChange: (e) => setEditing({
                                                    ...editing,
                                                    knowledgeAccess: {
                                                        scope: 'roles',
                                                        roleIds: e.target.checked ? [...roleIds, mode.id] : roleIds.filter((id) => id !== mode.id),
                                                    },
                                                }), className: "accent-purple-600" }), mode.avatarEmoji, " ", mode.label] }, mode.id));
                                }) }), !editing.knowledgeAccess?.roleIds?.length && _jsx("p", { className: "mt-2 text-[11px] text-amber-700 font-medium", children: "\u5F79\u5272AI\u30921\u3064\u4EE5\u4E0A\u9078\u3076\u307E\u3067\u3001\u3053\u306E\u8CC7\u6599\u306F\u5F79\u5272AI\u304B\u3089\u53C2\u7167\u3055\u308C\u307E\u305B\u3093\u3002" })] })), _jsx("textarea", { value: editing.content, onChange: (e) => setEditing({ ...editing, content: e.target.value }), rows: 8, placeholder: "\u672C\u6587\u3092\u8CBC\u308A\u4ED8\u3051\u3066\u4FDD\u5B58\u3002AI\u306F\u4F9D\u983C\u5185\u5BB9\u306B\u95A2\u9023\u3059\u308B\u8CC7\u6599\u3092\u6700\u59273\u4EF6\u53C2\u7167\u3057\u307E\u3059\u3002", className: "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" }), _jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold text-slate-700", children: "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB" }), _jsx("p", { className: "mt-1 text-[11px] text-slate-500", children: "Supabase Storage\u306B\u975E\u516C\u958B\u3067\u4FDD\u5B58\u30021\u30D5\u30A1\u30A4\u30EB20MB\u307E\u3067\u3002" })] }), _jsxs("label", { className: `inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition ${isUploading || !items.some((item) => item.id === editing.id) ? 'pointer-events-none opacity-50' : ''}`, children: [isUploading ? _jsx(Loader2, { className: "h-4 w-4 animate-spin text-purple-600" }) : _jsx(Paperclip, { className: "h-4 w-4 text-purple-600" }), isUploading ? 'アップロード中…' : 'ファイルを添付', _jsx("input", { type: "file", multiple: true, className: "hidden", disabled: isUploading || !items.some((item) => item.id === editing.id), onChange: (event) => { void uploadAttachments(event.target.files); event.currentTarget.value = ''; } })] })] }), (editing.attachments || []).map((attachment) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs", children: [_jsxs("span", { className: "min-w-0 truncate text-xs text-slate-700", children: [attachment.fileName, " ", _jsxs("span", { className: "text-slate-400", children: ["(", (attachment.size / 1024 / 1024).toFixed(2), " MB)"] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { type: "button", onClick: () => void downloadAttachment(attachment), className: "inline-flex items-center gap-1 text-xs text-purple-700 font-semibold hover:text-purple-800", children: [_jsx(Download, { className: "h-3.5 w-3.5" }), "\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9"] }), _jsx("button", { type: "button", onClick: () => void removeAttachment(attachment), className: "text-xs text-rose-600 font-medium hover:text-rose-700", children: "\u524A\u9664" })] })] }, attachment.id))), attachmentError && _jsx("p", { role: "alert", className: "text-xs text-rose-600 font-medium", children: attachmentError })] }), items.some((item) => item.id === editing.id) && (_jsxs("button", { type: "button", onClick: () => saveMarkdown(editing), className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs", children: [_jsx(Download, { className: "h-4 w-4 text-purple-600" }), "\u672C\u6587\u3092Markdown\u3067\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9"] })), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-slate-100", children: [_jsx("button", { onClick: () => setEditing(null), className: "rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsxs("button", { onClick: save, disabled: !editing.title.trim() || !editing.content.trim(), className: "rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-2 hover:bg-purple-700 shadow-sm transition", children: [_jsx(Save, { className: "w-4 h-4" }), "\u4FDD\u5B58"] })] })] })), _jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-3 top-2.5 w-4 h-4 text-slate-400" }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u30BF\u30A4\u30C8\u30EB\u30FB\u672C\u6587\u30FB\u30BF\u30B0\u3092\u691C\u7D22", className: "w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("select", { value: activeCategory, onChange: (e) => setActiveCategory(e.target.value), className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs", children: [_jsx("option", { value: "all", children: "\u3059\u3079\u3066\u306E\u5206\u985E" }), CATEGORIES.map((category) => _jsx("option", { value: category.id, children: category.label }, category.id))] }), _jsxs("select", { value: activeRoleId, onChange: (e) => setActiveRoleId(e.target.value), className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs", children: [_jsx("option", { value: "all", children: "\u3059\u3079\u3066\u306E\u62C5\u5F53AI" }), AI_WORK_MODES.map((mode) => _jsxs("option", { value: mode.id, children: [mode.label, "\u304C\u53C2\u7167\u3067\u304D\u308B\u8CC7\u6599"] }, mode.id))] })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-3", children: [visibleItems.map((item) => (_jsxs("article", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-purple-300 transition", children: [_jsxs("div", { className: "flex justify-between gap-3", children: [_jsxs("button", { onClick: () => startEdit(item), className: "text-left min-w-0 flex-1 cursor-pointer", children: [_jsxs("span", { className: "text-[10px] text-purple-700 font-semibold", children: [CATEGORIES.find((category) => category.id === item.category)?.label, " \u00B7 ", (item.knowledgeAccess?.scope || 'president') === 'president' ? 'AI社長のみ' : item.knowledgeAccess?.scope === 'roles' ? 'AI社長と指定役割' : '全AI共通'] }), _jsx("h2", { className: "font-bold text-slate-900 truncate mt-0.5", children: item.title }), item.sourceTaskId && _jsxs("span", { className: "mt-1 inline-block text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200", children: ["\u30BF\u30B9\u30AF\u6210\u679C\u7269 \u00B7 ", item.sourceRoleId || '担当AI'] }), !!item.attachments?.length && _jsxs("span", { className: "mt-1 ml-1 inline-block text-[10px] text-purple-700 font-medium bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200", children: ["\u6DFB\u4ED8 ", item.attachments.length, "\u4EF6"] })] }), _jsxs("div", { className: "flex shrink-0 items-start gap-1", children: [_jsx("button", { onClick: () => saveMarkdown(item), title: "Markdown\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9", className: "p-2 text-slate-400 hover:text-purple-600 cursor-pointer", children: _jsx(Download, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => setItemToDelete(item), title: "\u524A\u9664", className: "p-2 text-slate-400 hover:text-rose-600 cursor-pointer", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }), _jsx("p", { className: "mt-2 text-xs text-slate-500 whitespace-pre-wrap line-clamp-4", children: item.content }), _jsx("div", { className: "flex flex-wrap gap-1 mt-3", children: item.tags.map((tag) => _jsxs("span", { className: "rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600", children: ["#", tag] }, tag)) })] }, item.id))), visibleItems.length === 0 && _jsx("div", { className: "md:col-span-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 bg-white", children: "\u8CC7\u6599\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002\u6700\u521D\u306E\u65B9\u91DD\u66F8\u3084MD\u3092\u767B\u9332\u3067\u304D\u307E\u3059\u3002" })] }), itemToDelete && (_jsx("div", { className: "fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs", role: "presentation", children: _jsxs("section", { role: "dialog", "aria-modal": "true", "aria-labelledby": "delete-knowledge-title", className: "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl", children: [_jsx("h2", { id: "delete-knowledge-title", className: "text-base font-bold text-slate-900", children: "\u8CC7\u6599\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F" }), _jsxs("p", { className: "mt-3 text-sm text-slate-600", children: ["\u300C", itemToDelete.title, "\u300D\u3068\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3092\u524A\u9664\u3057\u307E\u3059\u3002"] }), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setItemToDelete(null), className: "rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", onClick: () => { onDelete(itemToDelete.id); setItemToDelete(null); }, className: "rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm transition", children: "\u524A\u9664\u3059\u308B" })] })] }) })), _jsx("p", { className: "text-[11px] text-slate-400", children: "\u672C\u6587\u306FMarkdown\u3067\u66F8\u304D\u51FA\u305B\u307E\u3059\u3002\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u306FSupabase Storage\u306B\u975E\u516C\u958B\u3067\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002" })] }));
};
