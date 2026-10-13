import React, { useState } from 'react';
import { 
  Package, 
  Sparkles, 
  Plus, 
  Code2, 
  Award, 
  TrendingUp, 
  FileText, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  DollarSign,
  ChevronRight,
  Layers,
  FileCheck2,
  Receipt,
  Wrench,
  BarChart3,
  Edit2
} from 'lucide-react';
import { ManagedProduct, PRODUCT_ARCHETYPES, ProductArchetype, ManagedContract, ManagedInvoice, ManagedToolAsset } from '../../types/matrix';
import { Project, TaskItem } from '../../types/ai-president';
import { ProductCoCreationWizard } from './ProductCoCreationWizard';

interface ProductHubViewProps {
  products: ManagedProduct[];
  contracts: ManagedContract[];
  invoices: ManagedInvoice[];
  tools: ManagedToolAsset[];
  tasks: TaskItem[];
  projects: Project[];
  onAddProduct: (product: Omit<ManagedProduct, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProduct: (id: string, updates: Partial<ManagedProduct>) => void;
  onAddProjectWithTasks?: (project: Project, tasks: TaskItem[]) => void;
}

export const ProductHubView: React.FC<ProductHubViewProps> = ({
  products,
  contracts,
  invoices,
  tools,
  tasks,
  projects,
  onAddProduct,
  onUpdateProduct,
  onAddProjectWithTasks,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'marketing' | 'finance'>('overview');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);

  // New product manual form
  const [manualName, setManualName] = useState('');
  const [manualArchetype, setManualArchetype] = useState<ProductArchetype>('service_project');
  const [manualPrice, setManualPrice] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const productContracts = contracts.filter((c) => c.productId === selectedProduct?.id);
  const productInvoices = invoices.filter((i) => i.productId === selectedProduct?.id);
  const productTools = tools.filter((t) => t.productId === selectedProduct?.id);

  const getArchetypeIcon = (archetype: ProductArchetype) => {
    switch (archetype) {
      case 'service_project':
        return <Code2 className="w-4 h-4 text-blue-400" />;
      case 'retainer':
        return <Award className="w-4 h-4 text-emerald-400" />;
      case 'digital_asset':
        return <Package className="w-4 h-4 text-amber-400" />;
      case 'media_content':
        return <TrendingUp className="w-4 h-4 text-purple-400" />;
      default:
        return <Layers className="w-4 h-4 text-cyan-400" />;
    }
  };

  const handleManualCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    onAddProduct({
      name: manualName.trim(),
      archetype: manualArchetype,
      category: PRODUCT_ARCHETYPES[manualArchetype].label,
      price: Number(manualPrice) || 0,
      description: manualDesc.trim(),
      status: 'active',
      kpis: {
        targetRevenue: (Number(manualPrice) || 100000) * 10,
        currentRevenue: 0,
        activeClients: 0,
      },
    });

    setManualName('');
    setManualPrice('');
    setManualDesc('');
    setIsNewProductModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-400" />
              商品別ハブ (プロダクト・全業種管理)
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
              マトリクス縦串ビュー
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            システム受託・顧問・デジタル商材・メディアアフィリエイト等、全商材の開発・マーケ・契約・請求を1箇所で串刺し管理
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI社長と新商品を共創する</span>
          </button>
          <button
            onClick={() => setIsNewProductModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>商品手動登録</span>
          </button>
        </div>
      </div>

      {/* Product Selection Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {products.map((p) => {
          const isSelected = p.id === selectedProductId;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              className={`px-4 py-3 rounded-xl border whitespace-nowrap text-left transition-all flex items-center gap-3 shrink-0 ${
                isSelected
                  ? 'bg-slate-900 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:bg-slate-900/60 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="p-2 rounded-lg bg-slate-800/80">
                {getArchetypeIcon(p.archetype)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {p.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    {PRODUCT_ARCHETYPES[p.archetype]?.label || p.category}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  売上: ¥{(p.kpis?.currentRevenue || 0).toLocaleString()} / 目標: ¥{(p.kpis?.targetRevenue || 0).toLocaleString()}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Product Detail Card & Subtabs */}
      {selectedProduct && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Product Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-950/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                    {getArchetypeIcon(selectedProduct.archetype)}
                    {PRODUCT_ARCHETYPES[selectedProduct.archetype]?.label}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    コード: {selectedProduct.code || selectedProduct.id}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                    selectedProduct.status === 'active' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {selectedProduct.status === 'active' ? '運用中' : '開発・準備中'}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                  {selectedProduct.description || '概要未入力'}
                </p>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block">標準単価 / 報酬</span>
                  <span className="text-sm font-bold text-white">
                    ¥{(selectedProduct.price || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block">契約中 / 顧客数</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {selectedProduct.kpis?.activeClients || 0} 件
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block">累計売上</span>
                  <span className="text-sm font-bold text-cyan-400">
                    ¥{(selectedProduct.kpis?.currentRevenue || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="flex space-x-2 mt-6 border-t border-slate-800 pt-4">
              {[
                { id: 'overview', label: '① 概要・カスタム属性', icon: Layers },
                { id: 'tasks', label: '② 開発・WBSタスク', icon: Code2 },
                { id: 'marketing', label: '③ マーケティング・販促', icon: TrendingUp },
                { id: 'finance', label: '④ 契約書・請求書', icon: FileCheck2 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subtab Contents */}
          <div className="p-6">
            {/* 1. OVERVIEW & CUSTOM ATTRIBUTES */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    商品タイプ別 特有属性（カスタムフィールド）
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Archetype custom fields */}
                    {PRODUCT_ARCHETYPES[selectedProduct.archetype]?.customFieldTemplates.map((field) => {
                      const val = selectedProduct.customFields?.[field.key];
                      return (
                        <div key={field.key} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-xs font-medium text-slate-400 block mb-1">
                            {field.label}
                          </span>
                          {field.type === 'url' && val ? (
                            <a
                              href={String(val)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-400 hover:underline flex items-center gap-1 truncate"
                            >
                              <span>{String(val)}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-sm font-semibold text-white">
                              {val !== undefined && val !== null ? String(val) : '未設定'}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs font-medium text-slate-400 block mb-1">
                        目標売上 KPI
                      </span>
                      <span className="text-sm font-semibold text-white">
                        ¥{(selectedProduct.kpis?.targetRevenue || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Typical Items for this archetype */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-xs font-semibold text-slate-300 block mb-2">
                    💡 {PRODUCT_ARCHETYPES[selectedProduct.archetype]?.label} で推奨される標準管理セット:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_ARCHETYPES[selectedProduct.archetype]?.typicalItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. TASKS / WBS */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-400" />
                    開発・推進タスク一覧
                  </h4>
                  <span className="text-xs text-slate-400">
                    全 {tasks.length} タスク中
                  </span>
                </div>

                <div className="space-y-2">
                  {tasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          task.status === 'completed'
                            ? 'bg-emerald-500'
                            : task.status === 'in_progress'
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-slate-600'
                        }`} />
                        <div>
                          <span className="font-semibold text-white">{task.title}</span>
                          <p className="text-[10px] text-slate-400">{task.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {task.assignee?.name || '担当者'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          task.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {task.priority === 'high' ? '高' : '通常'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. MARKETING & TOOLS */}
            {activeTab === 'marketing' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    マーケティング施策・販促ツール
                  </h4>
                  <span className="text-xs text-slate-400">
                    紐づきツール: {productTools.length} 件
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {productTools.length > 0 ? (
                    productTools.map((t) => (
                      <div key={t.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{t.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {t.toolType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{t.description}</p>
                        {t.url && (
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <span>リンクを開く</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center col-span-2 text-xs text-slate-500">
                      現在この商品に紐づいたプロモーションツールはありません。「販促ツール一覧」より追加できます。
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. FINANCE (CONTRACTS & INVOICES) */}
            {activeTab === 'finance' && (
              <div className="space-y-6">
                {/* Contracts */}
                <div>
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    関連契約書 ({productContracts.length} 件)
                  </h4>
                  <div className="space-y-2">
                    {productContracts.length > 0 ? (
                      productContracts.map((cnt) => (
                        <div
                          key={cnt.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">{cnt.title}</span>
                            <span className="text-slate-400 ml-2">相手先: {cnt.counterpartyName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">
                              ¥{(cnt.amount || 0).toLocaleString()}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                              cnt.status === 'signed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {cnt.status === 'signed' ? '締結済' : '確認中'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 text-center">
                        登録された契約書はありません
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoices */}
                <div>
                  <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-cyan-400" />
                    関連請求書・入金状況 ({productInvoices.length} 件)
                  </h4>
                  <div className="space-y-2">
                    {productInvoices.length > 0 ? (
                      productInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">{inv.title}</span>
                            <span className="text-slate-400 ml-2">({inv.invoiceNumber}) - {inv.recipientName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 font-bold">
                              ¥{inv.amount.toLocaleString()}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                              inv.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {inv.status === 'paid' ? '入金済' : '入金待ち'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 text-center">
                        登録された請求書はありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Co-creation Wizard Modal */}
      {isWizardOpen && (
        <ProductCoCreationWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onComplete={(newProduct, newProject, newTasks) => {
            onAddProduct(newProduct);
            if (newProject && newTasks && onAddProjectWithTasks) {
              onAddProjectWithTasks(newProject, newTasks);
            }
            setSelectedProductId(newProduct.id);
          }}
        />
      )}

      {/* Manual Product Create Modal */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">新規商品を手動登録</h3>
            <form onSubmit={handleManualCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">商品名</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="例: 法人向け顧問AI伴走プラン"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">商品タイプ</label>
                <select
                  value={manualArchetype}
                  onChange={(e) => setManualArchetype(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {(Object.keys(PRODUCT_ARCHETYPES) as ProductArchetype[]).map((key) => (
                    <option key={key} value={key}>
                      {PRODUCT_ARCHETYPES[key].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">標準価格 (円)</label>
                <input
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="例: 200000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">概要・詳細</label>
                <textarea
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="商品やサービスの内容を入力"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
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
