import React, { useMemo, useState } from 'react';
import { BookOpen, FilePlus2, Search, Trash2, Save } from 'lucide-react';
import { KnowledgeCategory, KnowledgeItem } from '../types';

interface KnowledgeHubViewProps {
  items: KnowledgeItem[];
  onSave: (item: KnowledgeItem) => void;
  onDelete: (id: string) => void;
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

export const KnowledgeHubView: React.FC<KnowledgeHubViewProps> = ({ items, onSave, onDelete }) => {
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [tagText, setTagText] = useState('');

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
              </button>
              <button onClick={() => { if (window.confirm(`「${item.title}」を削除しますか？`)) onDelete(item.id); }} title="削除" className="p-2 text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
            </div>
            <p className="mt-2 text-xs text-slate-400 whitespace-pre-wrap line-clamp-4">{item.content}</p>
            <div className="flex flex-wrap gap-1 mt-3">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">#{tag}</span>)}</div>
          </article>
        ))}
        {visibleItems.length === 0 && <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">資料はまだありません。最初の方針書やMDを登録できます。</div>}
      </div>
      <p className="text-[11px] text-slate-500">現在はテキスト資料を保存します。ファイル添付・自動要約・ベクトル検索は後続拡張です。</p>
    </div>
  );
};

