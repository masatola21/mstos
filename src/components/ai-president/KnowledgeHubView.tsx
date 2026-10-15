import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, FilePlus2, Search, Trash2, Save, Download, Paperclip, Loader2 } from 'lucide-react';
import { KnowledgeAttachment, KnowledgeCategory, KnowledgeItem } from '../types';

interface KnowledgeHubViewProps {
  items: KnowledgeItem[];
  onSave: (item: KnowledgeItem) => void;
  onDelete: (id: string) => void;
  selectedItemId?: string | null;
  onUploadAttachment: (itemId: string, file: File) => Promise<KnowledgeAttachment>;
  onDownloadAttachment: (attachment: KnowledgeAttachment) => Promise<Blob>;
  onDeleteAttachment: (attachment: KnowledgeAttachment) => Promise<void>;
}

const CATEGORIES: { id: KnowledgeCategory; label: string }[] = [
  { id: 'business', label: '事業方針・共通資料' },
  { id: 'product', label: '商品情報' },
  { id: 'customer', label: '顧客情報' },
  { id: 'decision', label: '決定事項' },
  { id: 'research', label: '調査・根拠資料' },
  { id: 'deliverable', label: '成果物' },
];

const blankItem = (): KnowledgeItem => ({
  id: `knowledge-${Date.now()}`,
  title: '',
  category: 'business',
  content: '',
  tags: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const KnowledgeHubView: React.FC<KnowledgeHubViewProps> = ({ items, onSave, onDelete, selectedItemId, onUploadAttachment, onDownloadAttachment, onDeleteAttachment }) => {
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [tagText, setTagText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [itemToDelete, setItemToDelete] = useState<KnowledgeItem | null>(null);
  const lastOpenedSelection = useRef<string | null>(null);

  const saveMarkdown = (item: KnowledgeItem) => {
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

  const uploadAttachments = async (fileList: FileList | null) => {
    if (!editing || !fileList?.length) return;
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
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'ファイルを添付できませんでした。');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadAttachment = async (attachment: KnowledgeAttachment) => {
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
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'ファイルをダウンロードできませんでした。');
    }
  };

  const removeAttachment = async (attachment: KnowledgeAttachment) => {
    if (!editing) return;
    setAttachmentError('');
    try {
      await onDeleteAttachment(attachment);
      const updated = { ...editing, attachments: (editing.attachments || []).filter((item) => item.id !== attachment.id), updatedAt: Date.now() };
      setEditing(updated);
      onSave(updated);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'ファイルを削除できませんでした。');
    }
  };

  useEffect(() => {
    if (!selectedItemId || lastOpenedSelection.current === selectedItemId) return;
    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem) return;
    lastOpenedSelection.current = selectedItemId;
    setActiveCategory('all');
    setQuery('');
    setEditing({ ...selectedItem });
    setTagText(selectedItem.tags.join(', '));
  }, [selectedItemId, items]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const categoryMatches = activeCategory === 'all' || item.category === activeCategory;
    const text = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
    return categoryMatches && text.includes(query.toLowerCase());
  }), [items, activeCategory, query]);

  const startNew = () => { setEditing(blankItem()); setTagText(''); };
  const startEdit = (item: KnowledgeItem) => { setEditing({ ...item }); setTagText(item.tags.join(', ')); };
  const save = () => {
    if (!editing?.title.trim() || !editing.content.trim()) return;
    onSave({ ...editing, title: editing.title.trim(), tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean), updatedAt: Date.now() });
    setEditing(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center"><BookOpen /></div>
          <div>
            <h1 className="text-lg font-extrabold text-white">事業ナレッジ・成果物</h1>
            <p className="text-xs text-slate-400 mt-1">MDの方針書、商品情報、決定事項、調査結果などを保存。関連資料はAIへの依頼時に必要な分だけ参照します。</p>
          </div>
        </div>
        <button onClick={startNew} className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white flex items-center gap-2"><FilePlus2 className="w-4 h-4" />資料を追加</button>
      </div>

      {editing && (
        <section className="rounded-2xl border border-indigo-500/40 bg-slate-900 p-5 space-y-3">
          <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="タイトル（例：事業方針.md）" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <div className="grid md:grid-cols-2 gap-3">
            <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as KnowledgeCategory })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
            <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="タグ（カンマ区切り）" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
          <textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} rows={8} placeholder="本文を貼り付けて保存。AIは依頼内容に関連する資料を最大3件参照します。" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-200">添付ファイル</h3>
                <p className="mt-1 text-[11px] text-slate-500">Supabase Storageに非公開で保存。1ファイル20MBまで。</p>
              </div>
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 ${isUploading || !items.some((item) => item.id === editing.id) ? 'pointer-events-none opacity-50' : ''}`}>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                {isUploading ? 'アップロード中…' : 'ファイルを添付'}
                <input type="file" multiple className="hidden" disabled={isUploading || !items.some((item) => item.id === editing.id)} onChange={(event) => { void uploadAttachments(event.target.files); event.currentTarget.value = ''; }} />
              </label>
            </div>
            {(editing.attachments || []).map((attachment) => (
              <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2">
                <span className="min-w-0 truncate text-xs text-slate-300">{attachment.fileName} <span className="text-slate-500">({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span></span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void downloadAttachment(attachment)} className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"><Download className="h-3.5 w-3.5" />ダウンロード</button>
                  <button type="button" onClick={() => void removeAttachment(attachment)} className="text-xs text-rose-300 hover:text-rose-200">削除</button>
                </div>
              </div>
            ))}
            {attachmentError && <p role="alert" className="text-xs text-rose-300">{attachmentError}</p>}
          </div>
          {items.some((item) => item.id === editing.id) && (
            <button type="button" onClick={() => saveMarkdown(editing)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"><Download className="h-4 w-4" />本文をMarkdownでダウンロード</button>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-2 text-sm text-slate-300">キャンセル</button>
            <button onClick={save} disabled={!editing.title.trim() || !editing.content.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40 flex items-center gap-2"><Save className="w-4 h-4" />保存</button>
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="タイトル・本文・タグを検索" className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 py-2 text-sm text-white" /></div>
        <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value as KnowledgeCategory | 'all')} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white">
          <option value="all">すべての分類</option>
          {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {visibleItems.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex justify-between gap-3">
              <button onClick={() => startEdit(item)} className="text-left min-w-0 flex-1">
                <span className="text-[10px] text-indigo-300">{CATEGORIES.find((category) => category.id === item.category)?.label}</span>
                <h2 className="font-bold text-white truncate">{item.title}</h2>
                {item.sourceTaskId && <span className="mt-1 inline-block text-[10px] text-emerald-300">タスク成果物 · {item.sourceRoleId || '担当AI'}</span>}
                {!!item.attachments?.length && <span className="mt-1 inline-block text-[10px] text-cyan-300">添付 {item.attachments.length}件</span>}
              </button>
              <div className="flex shrink-0 items-start gap-1">
                <button onClick={() => saveMarkdown(item)} title="Markdownをダウンロード" className="p-2 text-slate-500 hover:text-cyan-300"><Download className="w-4 h-4" /></button>
                <button onClick={() => setItemToDelete(item)} title="削除" className="p-2 text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400 whitespace-pre-wrap line-clamp-4">{item.content}</p>
            <div className="flex flex-wrap gap-1 mt-3">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">#{tag}</span>)}</div>
          </article>
        ))}
        {visibleItems.length === 0 && <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">資料はまだありません。最初の方針書やMDを登録できます。</div>}
      </div>
      {itemToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-knowledge-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 id="delete-knowledge-title" className="text-base font-bold text-white">資料を削除しますか？</h2>
            <p className="mt-3 text-sm text-slate-300">「{itemToDelete.title}」と添付ファイルを削除します。</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setItemToDelete(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">キャンセル</button>
              <button type="button" onClick={() => { onDelete(itemToDelete.id); setItemToDelete(null); }} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">削除する</button>
            </div>
          </section>
        </div>
      )}
      <p className="text-[11px] text-slate-500">本文はMarkdownで書き出せます。添付ファイルはSupabase Storageに非公開で保存されます。</p>
    </div>
  );
};

