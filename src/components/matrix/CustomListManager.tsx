import React, { useState } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Filter, 
  FolderTree, 
  Tag, 
  Table, 
  Kanban, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileCheck2,
  Receipt,
  Wrench,
  ChevronDown,
  Layers,
  Edit2
} from 'lucide-react';
import { 
  CustomListDefinition, 
  CustomListCategory, 
  ManagedContract, 
  ManagedInvoice, 
  ManagedToolAsset, 
  ManagedProduct 
} from '../../types/matrix';
import { TaskItem } from '../../types/ai-president';

interface CustomListManagerProps {
  customLists: CustomListDefinition[];
  contracts: ManagedContract[];
  invoices: ManagedInvoice[];
  tools: ManagedToolAsset[];
  tasks: TaskItem[];
  products: ManagedProduct[];
  onAddContract: (c: Omit<ManagedContract, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddInvoice: (i: Omit<ManagedInvoice, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddTool: (t: Omit<ManagedToolAsset, 'id' | 'createdAt'>) => void;
  onUpdateInvoiceStatus: (id: string, status: any) => void;
}

export const CustomListManager: React.FC<CustomListManagerProps> = ({
  customLists,
  contracts,
  invoices,
  tools,
  tasks,
  products,
  onAddContract,
  onAddInvoice,
  onAddTool,
  onUpdateInvoiceStatus,
}) => {
  const [selectedListId, setSelectedListId] = useState<string>(customLists[0]?.id || 'list-contracts');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Modal states
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProductId, setNewProductId] = useState(products[0]?.id || '');
  const [newAmount, setNewAmount] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const currentList = customLists.find((l) => l.id === selectedListId) || customLists[0];

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (selectedListId === 'list-contracts') {
      onAddContract({
        title: newTitle.trim(),
        type: 'service_agreement',
        productId: newProductId || undefined,
        counterpartyName: newRecipient.trim() || '未設定',
        status: 'draft',
        amount: Number(newAmount) || 0,
        endDate: newDueDate || undefined,
      });
    } else if (selectedListId === 'list-invoices') {
      onAddInvoice({
        invoiceNumber: `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`,
        title: newTitle.trim(),
        productId: newProductId || undefined,
        recipientName: newRecipient.trim() || '未設定',
        amount: Number(newAmount) || 0,
        status: 'issued',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: newDueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      });
    } else if (selectedListId === 'list-tools') {
      onAddTool({
        name: newTitle.trim(),
        category: 'marketing',
        productId: newProductId || undefined,
        toolType: 'lp',
        description: newRecipient.trim() || '',
        status: 'active',
      });
    }

    setNewTitle('');
    setNewAmount('');
    setNewRecipient('');
    setNewDueDate('');
    setIsAddItemOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-cyan-400" />
              リスト＆リストカテゴリー管理
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
              動的カテゴリー分類
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            契約書・請求書・販促ツール・開発タスク等のリストをカテゴリー・商品別に自在に整理・集計
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>テーブル</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'kanban' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>カンバン</span>
            </button>
          </div>

          <button
            onClick={() => setIsAddItemOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新規レコード追加</span>
          </button>
        </div>
      </div>

      {/* List Type Selector Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        {customLists.map((list) => {
          const isSelected = list.id === selectedListId;
          return (
            <button
              key={list.id}
              onClick={() => {
                setSelectedListId(list.id);
                setSelectedCategoryFilter('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {list.id === 'list-contracts' && <FileCheck2 className="w-3.5 h-3.5" />}
              {list.id === 'list-invoices' && <Receipt className="w-3.5 h-3.5" />}
              {list.id === 'list-tools' && <Wrench className="w-3.5 h-3.5" />}
              <span>{list.name}</span>
            </button>
          );
        })}
      </div>

      {/* Filter and Category Ribbon */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
        {/* Category pills for the selected list */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Tag className="w-3.5 h-3.5" />
            分類:
          </span>
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedCategoryFilter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            すべて
          </button>
          {currentList?.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedCategoryFilter === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Filter & Search */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">全商品</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="検索..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36"
            />
          </div>
        </div>
      </div>

      {/* Main List Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* 1. CONTRACTS LIST */}
        {selectedListId === 'list-contracts' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 pb-2">
                  <th className="py-2 px-3 font-semibold">契約書名</th>
                  <th className="py-2 px-3 font-semibold">相手先 (企業/個人)</th>
                  <th className="py-2 px-3 font-semibold">紐づき商品</th>
                  <th className="py-2 px-3 font-semibold">金額</th>
                  <th className="py-2 px-3 font-semibold">ステータス</th>
                  <th className="py-2 px-3 font-semibold">契約期間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {contracts
                  .filter((c) => selectedProductFilter === 'all' || c.productId === selectedProductFilter)
                  .filter((c) => !searchQuery || c.title.includes(searchQuery) || c.counterpartyName.includes(searchQuery))
                  .map((c) => {
                    const prod = products.find((p) => p.id === c.productId);
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">{c.title}</td>
                        <td className="py-3 px-3 text-slate-300">{c.counterpartyName}</td>
                        <td className="py-3 px-3 text-slate-400">{prod ? prod.name : '全社共通'}</td>
                        <td className="py-3 px-3 font-bold text-emerald-400">
                          ¥{(c.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            c.status === 'signed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {c.status === 'signed' ? '締結完了' : '確認中/ドラフト'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {c.startDate || '未定'} 〜 {c.endDate || '自動更新'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. INVOICES LIST */}
        {selectedListId === 'list-invoices' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 pb-2">
                  <th className="py-2 px-3 font-semibold">請求書番号 / 項目名</th>
                  <th className="py-2 px-3 font-semibold">請求先</th>
                  <th className="py-2 px-3 font-semibold">対象商品</th>
                  <th className="py-2 px-3 font-semibold">請求金額</th>
                  <th className="py-2 px-3 font-semibold">期日</th>
                  <th className="py-2 px-3 font-semibold">ステータス / アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices
                  .filter((i) => selectedProductFilter === 'all' || i.productId === selectedProductFilter)
                  .filter((i) => !searchQuery || i.title.includes(searchQuery) || i.recipientName.includes(searchQuery))
                  .map((inv) => {
                    const prod = products.find((p) => p.id === inv.productId);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">
                          <div>{inv.title}</div>
                          <span className="text-[10px] text-slate-500 font-mono">{inv.invoiceNumber}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{inv.recipientName}</td>
                        <td className="py-3 px-3 text-slate-400">{prod ? prod.name : '一般'}</td>
                        <td className="py-3 px-3 font-black text-cyan-400">
                          ¥{inv.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{inv.dueDate}</td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => onUpdateInvoiceStatus(inv.id, inv.status === 'paid' ? 'issued' : 'paid')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              inv.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-emerald-600 hover:text-white'
                            }`}
                          >
                            {inv.status === 'paid' ? '✓ 入金確認済' : '入金待ち (完了にする)'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. TOOLS LIST */}
        {selectedListId === 'list-tools' && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tools
              .filter((t) => selectedProductFilter === 'all' || t.productId === selectedProductFilter)
              .filter((t) => !searchQuery || t.name.includes(searchQuery))
              .map((t) => {
                const prod = products.find((p) => p.id === t.productId);
                return (
                  <div key={t.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{t.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        {t.toolType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{t.description || '説明なし'}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                      <span>商品: {prod ? prod.name : '共通'}</span>
                      {t.url && <span className="text-blue-400">URL設定あり</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">
              {selectedListId === 'list-contracts' && '新規契約書を登録'}
              {selectedListId === 'list-invoices' && '新規請求書を発行・登録'}
              {selectedListId === 'list-tools' && '新規ツール・LPを登録'}
            </h3>
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  タイトル / 項目名
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例: 月額顧問契約書 / 11月分請求書"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  紐づき商品
                </label>
                <select
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">全社共通 / 指定なし</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  相手先 / 請求先企業名
                </label>
                <input
                  type="text"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  placeholder="例: 株式会社クライアント"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {selectedListId !== 'list-tools' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      金額 (円)
                    </label>
                    <input
                      type="number"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="例: 250000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      期日
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
