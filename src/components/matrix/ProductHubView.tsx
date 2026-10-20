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
  Edit2,
  Link2,
  Trash2,
  Check
} from 'lucide-react';
import { ManagedProduct, PRODUCT_ARCHETYPES, ProductArchetype, ManagedContract, ManagedInvoice, ManagedToolAsset } from '../../types/matrix';
import { ApiUsageData, Project, TaskItem } from '../../types/ai-president';
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
  onDeleteProduct?: (id: string, archive: boolean) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  onRestoreProduct?: (id: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  onPublishProduct: (product: ManagedProduct, fees: { initialFee: number; monthlyFee: number }) => Promise<void>;
  onAddProjectWithTasks?: (project: Project, tasks: TaskItem[]) => void;
  onRecordUsage?: (params: { endpoint: 'chat'; endpointName: string; model?: string; usage: ApiUsageData }) => void;
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
  onDeleteProduct,
  onRestoreProduct,
  onPublishProduct,
  onAddProjectWithTasks,
  onRecordUsage,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [productListView, setProductListView] = useState<'active' | 'archived'>('active');
  const [showRemovalConfirmation, setShowRemovalConfirmation] = useState(false);
  const [isProductActionPending, setIsProductActionPending] = useState(false);
  const [productActionMessage, setProductActionMessage] = useState('');
  const [productActionIsError, setProductActionIsError] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'marketing' | 'finance'>('overview');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [editProductDraft, setEditProductDraft] = useState<ManagedProduct | null>(null);
  const [editCustomFieldsJson, setEditCustomFieldsJson] = useState('{}');
  const [editProductError, setEditProductError] = useState('');
  const [publishInitialFee, setPublishInitialFee] = useState('');
  const [publishMonthlyFee, setPublishMonthlyFee] = useState('');
  const [publishError, setPublishError] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // New product manual form
  const [manualName, setManualName] = useState('');
  const [manualArchetype, setManualArchetype] = useState<ProductArchetype>('service_project');
  const [manualPrice, setManualPrice] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const productContracts = contracts.filter((c) => c.productId === selectedProduct?.id);
  const productInvoices = invoices.filter((i) => i.productId === selectedProduct?.id);
  const productTools = tools.filter((t) => t.productId === selectedProduct?.id);
  const productHasReferences = Boolean(selectedProduct && (
    productContracts.length || productInvoices.length || productTools.length ||
    tasks.some((task) => task.relatedRecord?.type === 'product' && task.relatedRecord.id === selectedProduct.id) ||
    projects.some((project: any) => project.productId === selectedProduct.id)
  ));
  const openProductEditor = () => {
    if (!selectedProduct) return;
    setEditProductDraft(JSON.parse(JSON.stringify(selectedProduct)) as ManagedProduct);
    setEditCustomFieldsJson(JSON.stringify(selectedProduct.customFields || {}, null, 2));
    setEditProductError('');
  };

  const saveProductEditor = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editProductDraft || !editProductDraft.name.trim()) {
      setEditProductError('商品名を入力してください。');
      return;
    }
    let customFields: Record<string, any>;
    try {
      const parsed: unknown = JSON.parse(editCustomFieldsJson || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      customFields = parsed as Record<string, any>;
    } catch {
      setEditProductError('追加項目はJSONオブジェクト形式で入力してください。');
      return;
    }
    const id = editProductDraft.id;
    const updates: Partial<ManagedProduct> = { ...editProductDraft, customFields, updatedAt: Date.now() };
    delete updates.id;
    delete updates.createdAt;
    onUpdateProduct(id, updates);
    setEditProductDraft(null);
    setProductActionMessage('AIプロダクトを更新しました。');
    setProductActionIsError(false);
  };

  const requestProductRemoval = async () => {
    if (!selectedProduct || !onDeleteProduct || isProductActionPending) return;
    setIsProductActionPending(true);
    setShowRemovalConfirmation(false);
    const result = await onDeleteProduct(selectedProduct.id, productHasReferences);
    setProductActionMessage(result.message || (result.success ? '操作が完了しました。' : '操作に失敗しました。'));
    setProductActionIsError(!result.success);
    if (result.success && productHasReferences) setProductListView('archived');
    setIsProductActionPending(false);
  };

  const restoreProduct = async () => {
    if (!selectedProduct || !onRestoreProduct || isProductActionPending) return;
    setIsProductActionPending(true);
    const result = await onRestoreProduct(selectedProduct.id);
    setProductActionMessage(result.message || (result.success ? '取扱を再開しました。' : '取扱の再開に失敗しました。'));
    setProductActionIsError(!result.success);
    if (result.success) setProductListView('active');
    setIsProductActionPending(false);
  };

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
              AIプロダクト設計
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
              AI共創ワークスペース
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            AIと対話しながら事業アイデアをプロダクトとして設計し、仕様・提供内容・開発タスクを具体化します。設計したプロダクトの情報や販促素材も管理できます。顧客ごとの契約・請求は営業・顧客管理で扱います。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>AIとプロダクトを設計する</span>
          </button>
          <button
            onClick={() => setIsNewProductModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>設計済みプロダクトを登録</span>
          </button>
        </div>
      </div>

      {/* Product Selection List */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <div className="flex gap-1">
            {(['active', 'archived'] as const).map((view) => (
              <button key={view} type="button" onClick={() => setProductListView(view)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${productListView === view ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                {view === 'active' ? '取扱中' : '取扱停止'}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-500">{products.filter((p) => (p.status === 'archived') === (productListView === 'archived')).length}件</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(100px,0.35fr)_minmax(115px,0.4fr)] gap-3 border-b border-slate-800 px-4 py-2 text-[10px] font-semibold text-slate-500">
          <span>商品名</span><span>商品タイプ</span><span className="text-right">価格</span>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/70">
          {products.filter((p) => (p.status === 'archived') === (productListView === 'archived')).map((p) => {
            const isSelected = p.id === selectedProductId;
            const priceLabel = p.salesCatalogPublishedAt
              ? `初期 ¥${(p.salesInitialFee ?? p.price ?? 0).toLocaleString()} / 月額 ¥${(p.salesMonthlyFee ?? 0).toLocaleString()}`
              : `¥${(p.price || 0).toLocaleString()}`;
            return (
              <button key={p.id} type="button" onClick={() => setSelectedProductId(p.id)}
                className={`grid w-full grid-cols-[minmax(0,1fr)_minmax(100px,0.35fr)_minmax(115px,0.4fr)] items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-indigo-500/10 text-white' : 'text-slate-300 hover:bg-slate-900'}`}>
                <span className="truncate text-xs font-semibold">{p.name}</span>
                <span className="truncate text-[11px] text-slate-400">{PRODUCT_ARCHETYPES[p.archetype]?.label || p.category}</span>
                <span className="truncate text-right text-[11px] text-slate-300">{priceLabel}</span>
              </button>
            );
          })}
          {products.filter((p) => (p.status === 'archived') === (productListView === 'archived')).length === 0 &&
            <p className="px-4 py-5 text-center text-xs text-slate-500">{productListView === 'archived' ? '取扱停止の商品はありません。' : '商品はありません。'}</p>}
        </div>
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
                    {selectedProduct.status === 'active' ? '運用中' : selectedProduct.status === 'archived' ? '取扱停止' : '開発・準備中'}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                  {selectedProduct.description || '概要未入力'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={openProductEditor} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                    <Edit2 className="h-4 w-4" />AIプロダクトを編集
                  </button>
                  <button type="button" onClick={() => {
                    setPublishInitialFee(String(selectedProduct.salesInitialFee ?? selectedProduct.price ?? 0));
                    setPublishMonthlyFee(String(selectedProduct.salesMonthlyFee ?? 0));
                    setPublishError('');
                    setIsPublishModalOpen(true);
                  }} className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20">
                    {selectedProduct.salesCatalogPublishedAt ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    {selectedProduct.salesCatalogPublishedAt ? '営業商品マスタを更新' : '営業商品マスタに反映'}
                  </button>
                  {selectedProduct.salesCatalogPublishedAt && <span className="text-[10px] text-emerald-300">CRMと同じ商品IDで連携済み</span>}
                  {selectedProduct.status === 'archived' ? (
                    onRestoreProduct && <button type="button" disabled={isProductActionPending} onClick={() => void restoreProduct()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20">
                      <Check className="h-4 w-4" />取扱を再開
                    </button>
                  ) : onDeleteProduct && <button type="button" disabled={isProductActionPending} onClick={() => {
                    setProductActionMessage('');
                    setShowRemovalConfirmation(true);
                  }} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20">
                    <Trash2 className="h-4 w-4" />{productHasReferences ? '取扱停止' : '削除'}
                  </button>}
                </div>
                {showRemovalConfirmation && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100" role="group" aria-label="商品操作の確認">
                    <span className="mr-2">{productHasReferences
                      ? `「${selectedProduct.name}」の取扱を停止します。関連記録は保持されます。`
                      : `「${selectedProduct.name}」を商品マスタから削除します。この操作は元に戻せません。`}</span>
                    <button type="button" disabled={isProductActionPending} onClick={() => void requestProductRemoval()} className="rounded bg-rose-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
                      {isProductActionPending ? '処理中…' : productHasReferences ? '取扱停止を確定' : '削除を確定'}
                    </button>
                    <button type="button" disabled={isProductActionPending} onClick={() => setShowRemovalConfirmation(false)} className="rounded border border-slate-600 px-3 py-1.5 text-slate-200 disabled:opacity-50">キャンセル</button>
                  </div>
                )}
                {productActionMessage && (
                  <p role="status" aria-live="polite" className={`mt-2 text-xs ${productActionIsError ? 'text-rose-300' : 'text-emerald-300'}`}>{productActionMessage}</p>
                )}
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

      {isPublishModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={async (event) => {
            event.preventDefault();
            setIsPublishing(true);
            setPublishError('');
            try {
              await onPublishProduct(selectedProduct, {
                initialFee: Math.max(0, Number(publishInitialFee) || 0),
                monthlyFee: Math.max(0, Number(publishMonthlyFee) || 0),
              });
              setIsPublishModalOpen(false);
            } catch (error) {
              setPublishError(error instanceof Error ? error.message : '商品マスタを更新できませんでした。');
            } finally {
              setIsPublishing(false);
            }
          }} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-white">営業商品マスタに反映</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">「{selectedProduct.name}」をCRM商品マスタへ登録します。商品IDは維持し、同じIDを参照する契約・請求・商談と紐づけます。</p>
            </div>
            <label className="block text-xs text-slate-300">初期費用（円）
              <input type="number" min="0" step="1" value={publishInitialFee} onChange={(event) => setPublishInitialFee(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </label>
            <label className="block text-xs text-slate-300">月額費用（円）
              <input type="number" min="0" step="1" value={publishMonthlyFee} onChange={(event) => setPublishMonthlyFee(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </label>
            {publishError && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">{publishError}</p>}
            <p className="text-[11px] leading-5 text-slate-500">実行するとSupabaseのCRM商品マスタを作成または更新します。ローカルの商品・契約・請求データは削除しません。</p>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={isPublishing} onClick={() => setIsPublishModalOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300">キャンセル</button>
              <button type="submit" disabled={isPublishing} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{isPublishing ? '反映中…' : 'CRM商品マスタに保存'}</button>
            </div>
          </form>
        </div>
      )}

      {editProductDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={saveProductEditor} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">AIプロダクトを編集</h3>
            <p className="mb-5 text-xs text-slate-400">コード・価格・状態・KPI・追加項目を更新できます。IDは関連する契約やタスクの紐付け維持のため変更できません。</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-300">商品コード<input value={editProductDraft.code || ''} onChange={e=>setEditProductDraft({...editProductDraft,code:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">商品名<input required value={editProductDraft.name} onChange={e=>setEditProductDraft({...editProductDraft,name:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">商品タイプ<select value={editProductDraft.archetype} onChange={e=>setEditProductDraft({...editProductDraft,archetype:e.target.value as ProductArchetype})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white">{(Object.keys(PRODUCT_ARCHETYPES) as ProductArchetype[]).map(key=><option key={key} value={key}>{PRODUCT_ARCHETYPES[key].label}</option>)}</select></label>
              <label className="space-y-1 text-xs text-slate-300">分類<input value={editProductDraft.category || ''} onChange={e=>setEditProductDraft({...editProductDraft,category:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">ステータス<select value={editProductDraft.status} onChange={e=>setEditProductDraft({...editProductDraft,status:e.target.value as ManagedProduct['status']})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white"><option value="planning">企画中</option><option value="developing">開発中</option><option value="active">運用中</option><option value="archived">取扱停止</option></select></label>
              <label className="space-y-1 text-xs text-slate-300">標準価格<input type="number" min="0" value={editProductDraft.price ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,price:e.target.value===''?undefined:Number(e.target.value)})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">営業マスタ 初期費用<input type="number" min="0" value={editProductDraft.salesInitialFee ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,salesInitialFee:e.target.value===''?undefined:Number(e.target.value)})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">営業マスタ 月額費用<input type="number" min="0" value={editProductDraft.salesMonthlyFee ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,salesMonthlyFee:e.target.value===''?undefined:Number(e.target.value)})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">目標売上<input type="number" min="0" value={editProductDraft.kpis?.targetRevenue ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,kpis:{...editProductDraft.kpis,targetRevenue:e.target.value===''?undefined:Number(e.target.value)}})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">現在売上<input type="number" min="0" value={editProductDraft.kpis?.currentRevenue ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,kpis:{...editProductDraft.kpis,currentRevenue:e.target.value===''?undefined:Number(e.target.value)}})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300">稼働顧客数<input type="number" min="0" value={editProductDraft.kpis?.activeClients ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,kpis:{...editProductDraft.kpis,activeClients:e.target.value===''?undefined:Number(e.target.value)}})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300 md:col-span-2">説明<textarea rows={4} value={editProductDraft.description || ''} onChange={e=>setEditProductDraft({...editProductDraft,description:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <label className="space-y-1 text-xs text-slate-300 md:col-span-2">追加項目（JSON）<textarea rows={7} value={editCustomFieldsJson} onChange={e=>setEditCustomFieldsJson(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-white" /><span className="text-[10px] text-slate-500">商品タイプごとの独自項目を含め、追加項目をまとめて編集できます。</span></label>
            </div>
            {editProductError && <p role="alert" className="mt-3 text-sm text-rose-300">{editProductError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setEditProductDraft(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300">キャンセル</button><button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">変更を保存</button></div>
          </form>
        </div>
      )}

      {/* Product Co-creation Wizard Modal */}
      {isWizardOpen && (
        <ProductCoCreationWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onRecordUsage={onRecordUsage}
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
            <h3 className="text-base font-bold text-white mb-4">プロダクトを登録</h3>
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
                  placeholder="プロダクトの内容を入力"
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

