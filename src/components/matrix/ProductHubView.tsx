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
  Check,
  GripVertical,
} from 'lucide-react';
import { ManagedProduct, PRODUCT_ARCHETYPES, ProductArchetype, ManagedContract, ManagedInvoice, ManagedToolAsset } from '../../types/matrix';
import { ApiUsageData, Project, TaskItem, CharacterConfig, UserProfile } from '../../types/ai-president';
import { ProductCoCreationWizard } from './ProductCoCreationWizard';
import { generateNextProductCode } from '../../services/productCatalogService';
import { calculateProductKPIs } from '../../services/businessSummaryService';

interface ProductHubViewProps {
  products: ManagedProduct[];
  contracts: ManagedContract[];
  invoices: ManagedInvoice[];
  tools: ManagedToolAsset[];
  tasks: TaskItem[];
  projects: Project[];
  onAddProduct: (product: Omit<ManagedProduct, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onUpdateProduct: (id: string, updates: Partial<ManagedProduct>) => void;
  onReorderProducts?: (reorderedProducts: ManagedProduct[]) => void;
  onDeleteProduct?: (id: string, archive: boolean) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  onRestoreProduct?: (id: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  onPublishProduct: (product: ManagedProduct, fees: { initialFee: number; monthlyFee: number }) => Promise<void>;
  onAddProjectWithTasks?: (project: Project, tasks: TaskItem[]) => void;
  onRecordUsage?: (params: { endpoint: 'chat'; endpointName: string; model?: string; usage: ApiUsageData }) => void;
  character?: CharacterConfig;
  userProfile?: UserProfile;
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
  onReorderProducts,
  onDeleteProduct,
  onRestoreProduct,
  onPublishProduct,
  onAddProjectWithTasks,
  onRecordUsage,
  character,
  userProfile,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [productListView, setProductListView] = useState<'active' | 'archived'>('active');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mst_product_category_order_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const distinctCategories = React.useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    const baseList = Array.from(cats);
    return baseList.sort((a, b) => {
      const idxA = categoryOrder.indexOf(a);
      const idxB = categoryOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [products, categoryOrder]);

  const handleCategoryDrop = (targetCat: string) => {
    if (!draggedCategory || draggedCategory === targetCat) return;
    const current = [...distinctCategories];
    const fromIdx = current.indexOf(draggedCategory);
    const toIdx = current.indexOf(targetCat);
    if (fromIdx === -1 || toIdx === -1) return;
    const [removed] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, removed);
    setCategoryOrder(current);
    try {
      localStorage.setItem('mst_product_category_order_v1', JSON.stringify(current));
    } catch {}
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  const handleProductDrop = (targetId: string) => {
    if (!draggedProductId || draggedProductId === targetId) return;
    const currentIndex = products.findIndex((p) => p.id === draggedProductId);
    const targetIndex = products.findIndex((p) => p.id === targetId);
    if (currentIndex === -1 || targetIndex === -1) return;

    const next = [...products];
    const [removed] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, removed);

    if (onReorderProducts) {
      onReorderProducts(next);
    }
    setDraggedProductId(null);
    setDragOverProductId(null);
  };

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
  const [manualTargetRevenue, setManualTargetRevenue] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const productContracts = contracts.filter((c) => c.productId === selectedProduct?.id);
  const productInvoices = invoices.filter((i) => i.productId === selectedProduct?.id);
  const productTools = tools.filter((t) => t.productId === selectedProduct?.id);
  const productProjects = projects.filter((p) => p.productId === selectedProduct?.id);
  const productProjectIds = new Set(productProjects.map((p) => p.id));
  const productTasks = tasks.filter(
    (task) =>
      (task.relatedRecord?.type === 'product' && task.relatedRecord.id === selectedProduct?.id) ||
      (task.projectId && productProjectIds.has(task.projectId))
  );

  const selectedProductKpi = selectedProduct
    ? calculateProductKPIs(selectedProduct, contracts, invoices)
    : null;

  const productHasReferences = Boolean(selectedProduct && (
    productContracts.length || productInvoices.length || productTools.length ||
    productTasks.length || productProjects.length
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
    const liveKpi = calculateProductKPIs(editProductDraft, contracts, invoices);
    const updates: Partial<ManagedProduct> = {
      ...editProductDraft,
      customFields,
      kpis: {
        targetRevenue: editProductDraft.kpis?.targetRevenue ?? 0,
        currentRevenue: liveKpi.currentRevenue,
        activeClients: liveKpi.activeClients,
      },
      updatedAt: Date.now(),
    };
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

    const derivedPrice = Number(manualPrice) || 0;
    const initialFee = manualArchetype === 'retainer' ? 0 : derivedPrice;
    const monthlyFee = manualArchetype === 'retainer' ? derivedPrice : 0;
    const generatedCode = generateNextProductCode(products, 'PRD');
    const defaultTarget = manualArchetype === 'retainer'
      ? (monthlyFee > 0 ? monthlyFee * 12 * 5 : 1000000)
      : (derivedPrice > 0 ? derivedPrice * 10 : 1000000);
    const userTarget = manualTargetRevenue !== '' ? Math.max(0, Number(manualTargetRevenue)) : defaultTarget;

    onAddProduct({
      id: generatedCode,
      code: generatedCode,
      name: manualName.trim(),
      archetype: manualArchetype,
      category: PRODUCT_ARCHETYPES[manualArchetype].label,
      price: derivedPrice,
      salesInitialFee: initialFee,
      salesMonthlyFee: monthlyFee,
      description: manualDesc.trim(),
      status: 'active',
      customFields: {
        phase: '商品設計',
      },
      kpis: {
        targetRevenue: userTarget,
        currentRevenue: 0,
        activeClients: 0,
      },
      salesCatalogPublishedAt: Date.now(),
    });

    setManualName('');
    setManualPrice('');
    setManualTargetRevenue('');
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

      {/* Product Selection List with Drag & Drop Reordering */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 shadow-lg">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 px-3 py-2.5 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {(['active', 'archived'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setProductListView(view)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    productListView === view ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {view === 'active' ? '取扱中' : '取扱停止'}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-indigo-400/90 font-medium hidden sm:inline-flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              <GripVertical className="w-3 h-3 text-indigo-400" />
              <span>ドラッグで並び替え可能</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>全 {products.filter((p) => (p.status === 'archived') === (productListView === 'archived')).length} 件</span>
          </div>
        </div>

        {/* Draggable Category Filter Bar */}
        {distinctCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-b border-slate-800/80 bg-slate-900/40 text-xs no-scrollbar">
            <span className="text-[10px] text-slate-500 shrink-0 font-semibold uppercase tracking-wider">カテゴリ:</span>
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                selectedCategoryFilter === 'ALL'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              すべて
            </button>
            {distinctCategories.map((cat) => {
              const isCatSelected = selectedCategoryFilter === cat;
              const isBeingDragged = draggedCategory === cat;
              const isDragOver = dragOverCategory === cat;
              return (
                <div
                  key={cat}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', cat);
                    setDraggedCategory(cat);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverCategory !== cat) setDragOverCategory(cat);
                  }}
                  onDragLeave={() => {
                    if (dragOverCategory === cat) setDragOverCategory(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleCategoryDrop(cat);
                  }}
                  onDragEnd={() => {
                    setDraggedCategory(null);
                    setDragOverCategory(null);
                  }}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  title="ドラッグでカテゴリの並び替えができます"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-grab active:cursor-grabbing transition-all select-none border ${
                    isCatSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-slate-800'
                  } ${isBeingDragged ? 'opacity-40 scale-95' : ''} ${isDragOver ? 'border-indigo-400 bg-indigo-500/20' : ''}`}
                >
                  <GripVertical className="w-3 h-3 text-slate-500 shrink-0 opacity-60" />
                  <span>{cat}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Column Headers */}
        <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(100px,0.35fr)_minmax(115px,0.4fr)] gap-3 border-b border-slate-800 px-4 py-2 text-[10px] font-semibold text-slate-500">
          <span title="並び替えハンドル">順</span>
          <span>商品名</span>
          <span>商品タイプ / 分類</span>
          <span className="text-right">価格</span>
        </div>

        {/* Product Rows */}
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/70">
          {(() => {
            const displayProducts = products
              .filter((p) => (p.status === 'archived') === (productListView === 'archived'))
              .filter((p) => selectedCategoryFilter === 'ALL' || p.category === selectedCategoryFilter);

            if (displayProducts.length === 0) {
              return (
                <p className="px-4 py-6 text-center text-xs text-slate-500">
                  {productListView === 'archived'
                    ? '取扱停止の商品はありません。'
                    : selectedCategoryFilter !== 'ALL'
                    ? `「${selectedCategoryFilter}」の商品はありません。`
                    : '商品はありません。'}
                </p>
              );
            }

            return displayProducts.map((p) => {
              const isSelected = p.id === selectedProductId;
              const isBeingDragged = draggedProductId === p.id;
              const isDragOver = dragOverProductId === p.id;
              const rawPrice = p.price || 0;
              const initFee = p.salesInitialFee ?? rawPrice;
              const monthlyFee = p.salesMonthlyFee ?? 0;
              const priceLabel = p.salesCatalogPublishedAt
                ? `初期 税抜¥${initFee.toLocaleString()} / 月額 税抜¥${monthlyFee.toLocaleString()}`
                : `税抜 ¥${rawPrice.toLocaleString()} (税込 ¥${Math.floor(rawPrice * 1.1).toLocaleString()})`;

              return (
                <div
                  key={p.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', p.id);
                    setDraggedProductId(p.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverProductId !== p.id) setDragOverProductId(p.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverProductId === p.id) setDragOverProductId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleProductDrop(p.id);
                  }}
                  onDragEnd={() => {
                    setDraggedProductId(null);
                    setDragOverProductId(null);
                  }}
                  onClick={() => setSelectedProductId(p.id)}
                  className={`grid w-full grid-cols-[28px_minmax(0,1fr)_minmax(100px,0.35fr)_minmax(115px,0.4fr)] items-center gap-3 px-4 py-2.5 text-left transition-all cursor-pointer ${
                    isSelected ? 'bg-indigo-500/15 text-white' : 'text-slate-300 hover:bg-slate-900'
                  } ${isBeingDragged ? 'opacity-40 bg-slate-900' : ''} ${
                    isDragOver ? 'border-t-2 border-indigo-400 bg-indigo-500/20' : ''
                  }`}
                >
                  <div
                    title="ドラッグして並び替え"
                    className="flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-500 hover:text-indigo-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="truncate text-xs font-semibold flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{p.name}</span>
                    {p.code && (
                      <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                        {p.code}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-[11px] text-slate-400">
                    {PRODUCT_ARCHETYPES[p.archetype]?.label || p.category}
                  </span>
                  <span className="truncate text-right text-[11px] text-slate-300 font-mono">
                    {priceLabel}
                  </span>
                </div>
              );
            });
          })()}
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

              {/* KPI Badges (契約書・請求書の実データから自動集計) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block">標準単価（税抜 / 税込）</span>
                  <span className="text-sm font-bold text-white block">
                    税抜 ¥{(selectedProduct.price || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] font-semibold text-cyan-300 block">
                    税込 ¥{Math.floor((selectedProduct.price || 0) * 1.1).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block">契約中社数 (自動集計)</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {selectedProductKpi?.activeClients ?? 0} 社
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">締結済契約より</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block">確定売上 (税込・自動集計)</span>
                  <span className="text-sm font-bold text-cyan-400">
                    ¥{(selectedProductKpi?.currentRevenue ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">入金済請求より</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block">目標売上 / 達成率</span>
                  <span className="text-sm font-bold text-purple-400">
                    ¥{(selectedProductKpi?.targetRevenue ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-purple-300 block mt-0.5 font-medium">
                    達成率: {selectedProductKpi?.achievementRate ?? 0}%
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
                    商品開発・推進タスク一覧 ({selectedProduct?.name})
                  </h4>
                  <span className="text-xs text-slate-400">
                    関連 {productTasks.length} 件 / 全 {tasks.length} タスク中
                  </span>
                </div>

                <div className="space-y-2">
                  {productTasks.length > 0 ? (
                    productTasks.map((task) => (
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
                            {task.dueDate && (
                              <span className="text-[10px] text-amber-400/90 font-mono mt-0.5 block">
                                期限: {task.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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
                    ))
                  ) : (
                    <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500 space-y-2">
                      <p>現在「{selectedProduct?.name}」に紐付く個別開発タスクはありません。</p>
                      <button
                        type="button"
                        onClick={() => setIsWizardOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AIとWBSタスクを自動策定する</span>
                      </button>
                    </div>
                  )}
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
            <label className="block text-xs text-slate-300">初期費用（税抜・円）
              <input type="number" min="0" step="1" value={publishInitialFee} onChange={(event) => setPublishInitialFee(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              {publishInitialFee && !isNaN(Number(publishInitialFee)) && (
                <span className="mt-1 block text-[11px] text-cyan-300 font-medium">税込 (10%): ¥{Math.floor(Number(publishInitialFee) * 1.1).toLocaleString()}</span>
              )}
            </label>
            <label className="block text-xs text-slate-300">月額費用（税抜・円）
              <input type="number" min="0" step="1" value={publishMonthlyFee} onChange={(event) => setPublishMonthlyFee(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              {publishMonthlyFee && !isNaN(Number(publishMonthlyFee)) && (
                <span className="mt-1 block text-[11px] text-cyan-300 font-medium">税込 (10%): ¥{Math.floor(Number(publishMonthlyFee) * 1.1).toLocaleString()}</span>
              )}
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
              <label className="space-y-1 text-xs text-slate-300">
                標準価格（税抜・円）
                <input type="number" min="0" value={editProductDraft.price ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,price:e.target.value===''?undefined:Number(e.target.value)})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
                {editProductDraft.price != null && !isNaN(editProductDraft.price) && (
                  <span className="block text-[11px] text-cyan-300 font-medium">税込 (10%): ¥{Math.floor(editProductDraft.price * 1.1).toLocaleString()}</span>
                )}
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                営業マスタ 初期費用（税抜・円）
                <input type="number" min="0" value={editProductDraft.salesInitialFee ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,salesInitialFee:e.target.value===''?undefined:Number(e.target.value)})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
                {editProductDraft.salesInitialFee != null && !isNaN(editProductDraft.salesInitialFee) && (
                  <span className="block text-[11px] text-cyan-300 font-medium">税込 (10%): ¥{Math.floor(editProductDraft.salesInitialFee * 1.1).toLocaleString()}</span>
                )}
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                営業マスタ 月額費用（税抜・円）
                <input type="number" min="0" value={editProductDraft.salesMonthlyFee ?? ''} onChange={e=>setEditProductDraft({...editProductDraft,salesMonthlyFee:e.target.value===''?undefined:Number(e.target.value)})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
                {editProductDraft.salesMonthlyFee != null && !isNaN(editProductDraft.salesMonthlyFee) && (
                  <span className="block text-[11px] text-cyan-300 font-medium">税込 (10%): ¥{Math.floor(editProductDraft.salesMonthlyFee * 1.1).toLocaleString()}</span>
                )}
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                目標売上（税抜・円）
                <input
                  type="number"
                  min="0"
                  placeholder="例: 10000000"
                  value={editProductDraft.kpis?.targetRevenue ?? ''}
                  onChange={e=>setEditProductDraft({...editProductDraft,kpis:{...editProductDraft.kpis,targetRevenue:e.target.value===''?undefined:Number(e.target.value)}})}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white"
                />
                <span className="block text-[10px] text-slate-500">事業で目指す売上目標額を入力</span>
              </label>
              <div className="space-y-1 text-xs text-slate-400 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="block font-semibold text-slate-300">現在売上（税込・自動集計）</span>
                <span className="text-sm font-bold text-cyan-300 block">
                  ¥{(selectedProductKpi?.currentRevenue ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500">※入金済み請求書から自動計算</span>
              </div>
              <div className="space-y-1 text-xs text-slate-400 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="block font-semibold text-slate-300">稼働顧客数（自動集計）</span>
                <span className="text-sm font-bold text-emerald-300 block">
                  {selectedProductKpi?.activeClients ?? 0} 社
                </span>
                <span className="text-[10px] text-slate-500">※締結済み契約書から自動計算</span>
              </div>
              {PRODUCT_ARCHETYPES[editProductDraft.archetype]?.customFieldTemplates.map((field) => <label key={field.key} className="space-y-1 text-xs text-slate-300">{field.label}<input type={field.type==='date'?'date':field.type==='number'?'number':field.type==='url'?'url':'text'} value={String(editProductDraft.customFields?.[field.key] ?? '')} onChange={e=>{const next={...(editProductDraft.customFields||{}),[field.key]:field.type==='number'?(e.target.value===''?undefined:Number(e.target.value)):e.target.value};setEditProductDraft({...editProductDraft,customFields:next});setEditCustomFieldsJson(JSON.stringify(next,null,2))}} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>)}
              <label className="space-y-1 text-xs text-slate-300 md:col-span-2">説明<textarea rows={4} value={editProductDraft.description || ''} onChange={e=>setEditProductDraft({...editProductDraft,description:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <details className="md:col-span-2"><summary className="cursor-pointer text-xs text-slate-400">その他の追加項目をJSONで編集</summary><textarea aria-label="すべての追加項目（JSON）" rows={7} value={editCustomFieldsJson} onChange={e=>setEditCustomFieldsJson(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-white" /><span className="text-[10px] text-slate-500">標準項目にない独自の追加項目はこちらで編集できます。</span></details>
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
          character={character}
          userProfile={userProfile}
          existingProducts={products}
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
                <label className="block text-xs font-medium text-slate-300 mb-1">標準価格 (税抜・円)</label>
                <input
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="例: 200000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                {manualPrice && !isNaN(Number(manualPrice)) && (
                  <p className="mt-1 text-[11px] font-medium text-cyan-300">
                    税込金額 (10%): ¥{Math.floor(Number(manualPrice) * 1.1).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">目標売上（税抜・円）</label>
                <input
                  type="number"
                  min="0"
                  value={manualTargetRevenue}
                  onChange={(e) => setManualTargetRevenue(e.target.value)}
                  placeholder={manualPrice ? `空欄時は自動目安: ¥${((Number(manualPrice) || 0) * (manualArchetype === 'retainer' ? 60 : 10)).toLocaleString()}` : '例: 10000000'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="block mt-1 text-[10px] text-slate-400">達成を目指す売上目標。空欄の場合は価格とモデル種別に応じた目安を自動設定します。</span>
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

