import React, { useState, useEffect } from 'react';
import { TableKey, TABLE_CONFIGS } from '../types/database';
import { deleteTableRecord, fetchTableData, updateRecord, bulkDeleteTableRecords, cleanDummyData, DataFetchError } from '../services/dataService';
import { InlineDeleteButton } from './InlineDeleteButton';
import { RecordDetailModal } from './RecordDetailModal';
import { RecordFormModal } from './RecordFormModal';
import { StageTransitionModal, TransitionType } from './StageTransitionModal';
import { ProspectResearchImportModal } from './ProspectResearchImportModal';
import { getStatusBadgeClass } from '../utils/statusBadges';
import { Customer } from '../types/database';
import { 
  Search, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  ShieldAlert, 
  FileCode2, 
  Inbox, 
  Eye, 
  Edit3, 
  ArrowUpDown,
  Building2,
  Calendar,
  ExternalLink,
  Phone,
  Mail,
  Tag,
  CheckCircle2,
  Layers,
  Briefcase,
  UserCheck,
  Check,
  Trash2,
  Send,
  GripVertical,
  LayoutGrid,
  List
} from 'lucide-react';
import { matrixService } from '../services/matrixService';

interface TableManagerProps {
  currentTable: TableKey;
  onTableChange: (table: TableKey) => void;
  onOpenRls: () => void;
  onOpenCreateTrigger?: boolean;
  onStageTransitionTask?: (event: { transitionType: TransitionType; sourceRecord: any; targetTable: 'leads' | 'deals' | 'customers'; targetRecordId?: string | number }) => void;
  onOpenCustomerWorkspace?: (companyId: string, destination: 'documents' | 'operations' | 'diagnoses' | 'forms' | 'send', recordContext?: { tableKey: TableKey; recordId: string; leadId?: string; contactId?: string }) => void;
}

export const TableManager: React.FC<TableManagerProps> = ({
  currentTable,
  onTableChange,
  onOpenRls,
  onStageTransitionTask,
  onOpenCustomerWorkspace,
}) => {
  const config = TABLE_CONFIGS[currentTable];

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DataFetchError | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [isProspectImportOpen, setIsProspectImportOpen] = useState(false);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [reorderNotice, setReorderNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any | null>(null);

  // 一括操作・エラーバナー・ダミーデータ整理状態
  const [rowActionError, setRowActionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isCleanDummyModalOpen, setIsCleanDummyModalOpen] = useState(false);
  const [cleanDummyTargets, setCleanDummyTargets] = useState<string[]>(['prospects', 'leads', 'deals', 'customers', 'companies']);
  const [isCleaningDummy, setIsCleaningDummy] = useState(false);

  // ステージ移行モーダル状態
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType>('prospect_to_lead');
  const [transitionSourceRecord, setTransitionSourceRecord] = useState<any>(null);

  const handleOpenTransition = (type: TransitionType, record: any) => {
    setTransitionType(type);
    setTransitionSourceRecord(record);
    setTransitionOpen(true);
  };

  const handleTransitionSuccess = (targetTable: 'leads' | 'deals' | 'customers', recordId?: string | number) => {
    onStageTransitionTask?.({ transitionType, sourceRecord: transitionSourceRecord, targetTable, targetRecordId: recordId });
    setTransitionOpen(false);
    onTableChange(targetTable);
    const messages = {
      leads: '見込み企業からリードを作成しました。会社IDを引き継いで連携しています。',
      deals: 'リードから商談を作成しました。リードID・会社IDを引き継いで連携しています。',
      customers: '商談から顧客レコードを作成しました。1社1件の契約として管理されます。',
    };
    setSuccessBanner(messages[targetTable]);
    setTimeout(() => {
      setSuccessBanner(null);
    }, 6000);
  };

  const handleViewExistingCustomer = (customer: Customer) => {
    setTransitionOpen(false);
    onTableChange('customers');
    setSelectedRecord(customer);
    setIsDetailOpen(true);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: tableData, error: fetchErr } = await fetchTableData(currentTable);
      if (fetchErr) {
        setError(fetchErr);
        setData([]);
      } else {
        let sorted = tableData;
        if (currentTable === 'products') {
          try {
            const savedOrderStr = localStorage.getItem('crm_products_sort_order');
            if (savedOrderStr) {
              const savedOrder: string[] = JSON.parse(savedOrderStr);
              const orderMap = new Map(savedOrder.map((id, index) => [String(id), index]));
              sorted = [...tableData].sort((a: any, b: any) => {
                const orderA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 99999;
                const orderB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 99999;
                return orderA - orderB;
              });
            }
          } catch {
            // ignore
          }
        }
        setData(sorted);
      }
    } catch (err: any) {
      setError({
        type: 'UNKNOWN',
        message: err.message || 'データの取得に失敗しました。',
      });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProductReorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const oldIndex = data.findIndex((item) => String(item.id) === draggedId);
    const newIndex = data.findIndex((item) => String(item.id) === targetId);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = [...data];
    const [removed] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, removed);
    setData(next);

    const newOrderIds = next.map((item) => String(item.id));
    localStorage.setItem('crm_products_sort_order', JSON.stringify(newOrderIds));

    try {
      const matrixList = matrixService.loadProducts();
      if (matrixList.length > 0) {
        const matrixMap = new Map(matrixList.map((p) => [p.id, p]));
        const reorderedMatrix = next
          .filter((item) => matrixMap.has(String(item.id)))
          .map((item) => matrixMap.get(String(item.id))!);
        const reorderedIds = new Set(reorderedMatrix.map((p) => p.id));
        const remaining = matrixList.filter((p) => !reorderedIds.has(p.id));
        matrixService.saveProducts([...reorderedMatrix, ...remaining]);
      }
    } catch {
      // ignore
    }

    setReorderNotice('商品の表示順を更新しました。');
    setTimeout(() => setReorderNotice(null), 3500);
  };

  useEffect(() => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSelectedRecord(null);
    setIsDetailOpen(false);
    setIsFormOpen(false);
    setSelectedIds([]);
    setRowActionError(null);
    loadData();
  }, [currentTable]);

  // フィルタリング & 検索
  const filteredData = data.filter((item) => {
    // ステータス絞り込み (該当テーブルにステータス列がある場合)
    if (statusFilter !== 'ALL') {
      const itemStatus = item.status || item.proposal_status || item.contract_status;
      if (itemStatus !== statusFilter) return false;
    }

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();

    // 複数カラムにわたる検索
    const searchableValues = [
      String(item.id || ''),
      String(item.company_name || ''),
      String(item.company?.company_name || ''),
      String(item.contact_name || ''),
      String(item.email || ''),
      String(item.phone || ''),
      String(item.social_account || ''),
      String(item.proposal_plan_name || ''),
      String(item.proposal_type || ''),
      String(item.proposal_status || ''),
      String(item.product_name || ''),
      String(item.product?.product_name || ''),
      String(item.industry || ''),
      String(item.status || ''),
      String(item.source || ''),
      String(item.approach_method || ''),
      String(item.service_type || ''),
      String(item.priority_channel || ''),
      String(item.contract_status || ''),
      String(item.notes || ''),
      String(item.memo || ''),
      String(item.ai_reason || ''),
    ];

    return searchableValues.some((v) => v.toLowerCase().includes(query));
  });

  const handleOpenDetail = (record: any) => {
    setSelectedRecord(record);
    setIsDetailOpen(true);
  };

  const handleOpenCreate = () => {
    setEditRecord(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (record: any) => {
    setEditRecord(record);
    setIsFormOpen(true);
  };

  const handleOpenRecordSend = (record: any) => {
    if (!record.company_id || !onOpenCustomerWorkspace) return;
    onOpenCustomerWorkspace(String(record.company_id), 'send', {
      tableKey: currentTable,
      recordId: String(record.id),
      leadId: currentTable === 'leads' ? String(record.id) : record.lead_id ? String(record.lead_id) : undefined,
      contactId: record.contact_id ? String(record.contact_id) : undefined,
    });
  };

  const [forceDeleteConfirmRecord, setForceDeleteConfirmRecord] = useState<{ record: any; blockedBy: string } | null>(null);

  const handleDeleteRecord = async (record: any, force = false) => {
    const label = record.company_name || record.full_name || record.proposal_plan_name || record.product_name || record.contact_name || String(record.id);
    setDeletingRecordId(String(record.id));
    setRowActionError(null);
    setSuccessBanner(null);
    const result = await deleteTableRecord(currentTable, { id: record.id, company_id: record.company_id }, { force });
    setDeletingRecordId(null);
    if (result.blockedBy && !force) {
      if (currentTable === 'products') {
        setForceDeleteConfirmRecord({ record, blockedBy: result.blockedBy });
        return;
      }
      setRowActionError(`関連する「${result.blockedBy}」データがあるため削除できません。先に関連データを整理してください。`);
      return;
    }
    if (result.error) {
      setRowActionError(result.error.message || '削除に失敗しました。');
      return;
    }
    setData((current) => current.filter((item) => String(item.id) !== String(record.id)));
    setSelectedIds((prev) => prev.filter((id) => id !== String(record.id)));
    setSuccessBanner(force ? `「${label}」を関連付け解除の上、完全削除しました。` : `「${label}」を削除しました。`);
    await loadData();
    window.setTimeout(() => setSuccessBanner(null), 5000);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmMsg = `選択した ${selectedIds.length} 件のレコードを一括削除しますか？\n（関連するデータがある場合は安全に解除または除外されます）`;
    if (!window.confirm(confirmMsg)) return;

    setIsBulkDeleting(true);
    setRowActionError(null);
    const result = await bulkDeleteTableRecords(currentTable, selectedIds, { force: true });
    setIsBulkDeleting(false);

    if (result.error && result.successCount === 0) {
      setRowActionError(result.error.message);
      return;
    }

    const count = result.successCount ?? 0;
    const failed = result.failedCount ?? 0;
    const deletedIds = result.deletedIds ?? [];

    setData((current) => current.filter((item) => !deletedIds.includes(String(item.id))));
    setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));

    if (count > 0 && failed > 0) {
      const reasonSummary = result.failedDetails?.[0]?.reason ? `（一部: ${result.failedDetails[0].reason}）` : '';
      setSuccessBanner(`${count} 件削除しました。${failed} 件は関連データ存在または制約のため削除できませんでした。${reasonSummary}`);
    } else if (count > 0) {
      setSuccessBanner(`${count} 件のレコードを一括削除しました。`);
    } else if (failed > 0) {
      const reasonSummary = result.failedDetails?.[0]?.reason || '対象が存在しないか制約のため';
      setRowActionError(`${failed} 件の削除に失敗しました（${reasonSummary}）。`);
    }

    // 必ず最新一覧をDBから再取得して整合性を担保
    await loadData();

    window.setTimeout(() => setSuccessBanner(null), 6000);
  };

  const handleExecuteCleanDummy = async () => {
    if (cleanDummyTargets.length === 0) return;
    setIsCleaningDummy(true);
    setRowActionError(null);
    const result = await cleanDummyData(cleanDummyTargets);
    setIsCleaningDummy(false);

    if (!result.success) {
      setRowActionError(result.error || 'ダミーデータ一括整理に失敗しました。');
      return;
    }

    setIsCleanDummyModalOpen(false);
    const deletedSummary = Object.entries(result.deleted || {})
      .filter(([, count]) => count > 0)
      .map(([table, count]) => `${table}: ${count}件`)
      .join('、 ');

    setSuccessBanner(`ダミーデータを安全に一括整理しました（${deletedSummary || '全対象 0件'}）。`);
    window.setTimeout(() => setSuccessBanner(null), 6000);
    await loadData();
  };

  const handleQuickPricingModelChange = async (product: any, newModel: string) => {
    const label = product.product_name || product.id;
    const modelLabels: Record<string, string> = {
      fixed: '固定価格',
      starting_at: '最低価格〜（商談で本決め）',
      range: '価格帯（商談で本決め）',
      custom_quote: '個別見積・商談時決定',
    };
    // 楽観的UI更新
    setData((current) =>
      current.map((item) =>
        String(item.id) === String(product.id) ? { ...item, pricing_model: newModel } : item
      )
    );
    setError(null);
    const result = await updateRecord('products', product.id, {
      ...product,
      pricing_model: newModel,
    });
    if (result.error) {
      setError(result.error);
      await loadData();
      return;
    }
    setSuccessBanner(`商品「${label}」の料金体系を「${modelLabels[newModel] || newModel}」に切り替えました。`);
    window.setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleQuickStatusChange = async (record: any, newStatus: string) => {
    const statusField = currentTable === 'deals' ? 'proposal_status' : currentTable === 'customers' ? 'contract_status' : 'status';
    setData((current) =>
      current.map((item) =>
        String(item.id) === String(record.id) ? { ...item, [statusField]: newStatus } : item
      )
    );
    const result = await updateRecord(currentTable, record.id, {
      ...record,
      [statusField]: newStatus,
    });
    if (result.error) {
      setError(result.error);
      await loadData();
      return;
    }
    setSuccessBanner(`「${record.company_name || record.proposal_plan_name || record.id}」の状態を「${newStatus}」に更新しました。`);
    window.setTimeout(() => setSuccessBanner(null), 3000);
  };

  // ステータス列のユニーク候補を取得（フィルタ用）
  const statusOptions = Array.from(
    new Set(
      data
        .map((d) => d.status || d.proposal_status || d.contract_status)
        .filter(Boolean)
    )
  );

  // ステージ列（カンバン表示用）
  const kanbanColumns = React.useMemo(() => {
    const statusField = currentTable === 'deals' ? 'proposal_status' : currentTable === 'customers' ? 'contract_status' : 'status';
    const defaultCols: Record<string, string[]> = {
      deals: ['新規', '提案中', '見積提出', '成約', '失注', '保留'],
      leads: ['新規', '資料請求', 'ヒアリング済', '商談化', '失注・対象外'],
      prospects: ['未接触', 'アプローチ中', '検討中', '商談化', '保留'],
      customers: ['active', '契約中', '更新中', '解約'],
    };
    const base = defaultCols[currentTable] || [];
    const discovered = Array.from(
      new Set(data.map((d) => d[statusField]).filter(Boolean))
    );
    return Array.from(new Set([...base, ...discovered]));
  }, [currentTable, data]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {forceDeleteConfirmRecord && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div>
            <p className="font-semibold text-sm">【削除の確認】関連データが存在します</p>
            <p className="text-xs text-amber-800 mt-0.5">
              商品「{forceDeleteConfirmRecord.record.product_name || forceDeleteConfirmRecord.record.id}」は「{forceDeleteConfirmRecord.blockedBy}」等に紐付いています。関連付けを安全に解除（NULL設定）した上で完全削除しますか？
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                const rec = forceDeleteConfirmRecord.record;
                setForceDeleteConfirmRecord(null);
                void handleDeleteRecord(rec, true);
              }}
              className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 transition shadow-xs cursor-pointer"
            >
              参照を解除して完全削除
            </button>
            <button
              onClick={() => setForceDeleteConfirmRecord(null)}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3 py-1.5 transition cursor-pointer"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
      {rowActionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 flex items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{rowActionError}</span>
          </div>
          <button
            onClick={() => setRowActionError(null)}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 cursor-pointer"
          >
            閉じる
          </button>
        </div>
      )}
      {/* 会社・商品マスタ切り替えタブ */}
      {(currentTable === 'companies' || currentTable === 'products') && (
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 w-fit mb-1">
          <button
            type="button"
            onClick={() => onTableChange('companies')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              currentTable === 'companies'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building2 className={`w-3.5 h-3.5 ${currentTable === 'companies' ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>会社台帳（法人マスタ）</span>
          </button>
          <button
            type="button"
            onClick={() => onTableChange('products')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              currentTable === 'products'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Tag className={`w-3.5 h-3.5 ${currentTable === 'products' ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>販売商品・料金台帳</span>
          </button>
        </div>
      )}

      {/* Table Selector Sub-Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">
            {config.label}
          </h1>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-mono">
            {config.name}
          </span>
        </div>

        {/* Action Button: 新規登録 */}
        <div className="flex items-center gap-2">
          {currentTable === 'prospects' && (
            <button
              onClick={() => setIsProspectImportOpen(true)}
              className="px-3 py-1.5 rounded-md font-medium text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>見込み企業調査</span>
            </button>
          )}
          <button
            onClick={() => setIsCleanDummyModalOpen(true)}
            className="px-3 py-1.5 rounded-md font-medium text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="ダミー・テストデータを安全に一括整理"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>ダミーデータ整理</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
            title="再読み込み"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-3 py-1.5 rounded-md font-medium text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新規登録</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Keyword Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${config.label}内のキーワード、会社名、担当者、IDなどを検索...`}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-200 focus:border-purple-500 text-slate-800 text-xs placeholder:text-slate-400 outline-none shadow-2xs transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                クリア
              </button>
            )}
          </div>

          {/* View Mode Toggle (for pipeline tables) */}
          {['deals', 'leads', 'prospects', 'customers'].includes(currentTable) && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
                title="テーブル一覧表示"
              >
                <List className="w-3.5 h-3.5" />
                <span>リスト</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
                title="ステージ別パイプライン（カンバン表示）"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>パイプライン (カンバン)</span>
              </button>
            </div>
          )}

          {/* Status Dropdown Filter */}
          {statusOptions.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 whitespace-nowrap">状態:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs outline-none focus:border-purple-500 shadow-2xs cursor-pointer"
              >
                <option value="ALL">すべて表示</option>
                {statusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Record Count Badge */}
          <div className="text-xs text-slate-500 self-center whitespace-nowrap px-2 shrink-0">
            表示: <strong className="text-purple-700 font-mono font-bold">{filteredData.length}</strong> / {data.length} 件
          </div>
        </div>

        {/* Quick Filter Status Pills */}
        {statusOptions.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs transition-colors shrink-0 cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              すべて ({data.length})
            </button>
            {statusOptions.map((st) => {
              const count = data.filter((d) => (d.status || d.proposal_status || d.contract_status) === st).length;
              const isActive = statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(isActive ? 'ALL' : st)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors shrink-0 border cursor-pointer ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 border-purple-300 font-bold shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{st}</span>
                  <span className={`ml-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? 'bg-purple-200/60 text-purple-800' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-center justify-between gap-3 animate-fade-in shadow-lg">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-xs text-emerald-400 hover:text-emerald-200"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Reorder Notification Banner */}
      {reorderNotice && (
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 flex items-center justify-between gap-3 animate-fade-in shadow-lg">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold">{reorderNotice}</span>
          </div>
          <button
            onClick={() => setReorderNotice(null)}
            className="text-xs text-indigo-400 hover:text-indigo-200"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Product Master Drag Hint */}
      {currentTable === 'products' && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs shadow-xs">
          <GripVertical className="w-4 h-4 text-purple-600 shrink-0" />
          <span>行をドラッグ＆ドロップすると商品の表示順を並び替えできます（ブラウザと商品設計に自動保存されます）</span>
        </div>
      )}

      {/* =========================================================================
          DISTINCT STATE RENDERING:
          1. Loading (読み込み中)
          2. Error - Permission Denied (権限不足 / RLS)
          3. Error - Connection Error / Others (接続エラー)
          4. Empty (0件)
          5. Data Table / Cards
         ========================================================================= */}

      {/* 1. Loading State */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600" />
          <p className="text-sm font-semibold text-slate-800">
            {config.label}のデータを読み込み中...
          </p>
          <p className="text-xs text-slate-400">Supabaseデータベースと通信しています</p>
        </div>
      )}

      {/* 2. Error State: 権限不足 (RLS / 401 / 403 / 42501) */}
      {!loading && error && error.type === 'PERMISSION_DENIED' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-xs text-amber-900">
          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-amber-900">
              権限不足（Row Level Security: RLS ポリシー）
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              テーブル <code>{currentTable}</code> に対するアクセス権限がSupabase側で許可されていません。
              社内認証ユーザー（authenticated）に対して SELECT/INSERT/UPDATE ポリシーを設定してください。
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onOpenRls}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <FileCode2 className="w-4 h-4" />
              <span>RLS推奨SQLを確認して適用する</span>
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 transition-colors shadow-xs"
            >
              再試行
            </button>
          </div>
        </div>
      )}

      {/* 3. Error State: 接続エラー / スキーマ不一致 */}
      {!loading && error && error.type !== 'PERMISSION_DENIED' && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-xs text-rose-900">
          <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-900">
              {error.type === 'CONNECTION_ERROR' ? '接続エラー' : 'データ取得エラー'}
            </h3>
            <p className="text-xs text-rose-800 leading-relaxed font-mono">
              {error.message}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>再試行する</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Empty State (0件) */}
      {!loading && !error && filteredData.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {searchQuery ? '検索条件に一致するレコードがありません' : `${config.label}のレコードはまだありません`}
            </h3>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'キーワードを変更して再度お試しください。' : '「新規登録」ボタンから最初のレコードを登録してください。'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{config.label}を新規登録する</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Data View: Kanban Pipeline View */}
      {!loading && !error && filteredData.length > 0 && viewMode === 'kanban' && ['deals', 'leads', 'prospects', 'customers'].includes(currentTable) && (
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-4 min-w-[900px]">
            {kanbanColumns.map((colStatus) => {
              const statusField = currentTable === 'deals' ? 'proposal_status' : currentTable === 'customers' ? 'contract_status' : 'status';
              const columnRecords = filteredData.filter((item) => (item[statusField] || '') === colStatus);
              const columnTotalAmount = currentTable === 'deals' 
                ? columnRecords.reduce((acc, cur) => acc + (Number(cur.total_amount) || 0), 0)
                : 0;

              return (
                <div key={colStatus} className="flex-1 min-w-[280px] max-w-[340px] bg-slate-50/70 border border-slate-200 rounded-2xl p-3 flex flex-col max-h-[calc(100vh-280px)]">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(colStatus)}`}>
                        {colStatus}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-500">
                        {columnRecords.length}
                      </span>
                    </div>
                    {columnTotalAmount > 0 && (
                      <span className="text-[11px] font-mono font-bold text-purple-700">
                        ¥{columnTotalAmount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Cards container */}
                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                    {columnRecords.map((item) => {
                      const title = item.proposal_plan_name || item.company_name || item.company?.company_name || `レコード #${item.id}`;
                      const subTitle = item.company?.company_name || (item.company_id ? `会社ID: ${item.company_id}` : undefined);
                      const amount = item.total_amount ? Number(item.total_amount) : item.monthly_fee ? Number(item.monthly_fee) : null;
                      const dateField = item.meeting_date || item.proposal_date || item.last_contacted_at || item.contract_start_date;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleOpenDetail(item)}
                          className="bg-white border border-slate-200 hover:border-purple-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2.5 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-mono text-slate-400">ID: {item.id}</div>
                              <h4 className="font-bold text-xs text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-1">
                                {title}
                              </h4>
                              {subTitle && (
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span className="truncate">{subTitle}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Amounts & Indicators */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                            {amount !== null ? (
                              <div className="font-mono">
                                <span className="font-bold text-slate-900">¥{amount.toLocaleString()}</span>
                                <span className="text-[10px] text-purple-700 ml-1">
                                  (込 ¥{Math.floor(amount * 1.1).toLocaleString()})
                                </span>
                              </div>
                            ) : item.ai_score !== undefined && item.ai_score !== null ? (
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                AI確度: {item.ai_score}点
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">-</span>
                            )}

                            {dateField && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                                <Calendar className="w-3 h-3" />
                                <span>{String(dateField).split('T')[0]}</span>
                              </div>
                            )}
                          </div>

                          {/* Stage Dropdown & Action buttons */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={item[statusField] || colStatus}
                              onChange={(e) => void handleQuickStatusChange(item, e.target.value)}
                              className="text-[10px] py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 outline-none hover:bg-slate-100 cursor-pointer"
                              title="ステージを変更"
                            >
                              {kanbanColumns.map((st) => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1">
                              {currentTable === 'prospects' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenTransition('prospect_to_lead', item)}
                                  className="p-1 rounded bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 text-[10px] font-semibold cursor-pointer"
                                  title="リードへ進める"
                                >
                                  リード化
                                </button>
                              )}
                              {currentTable === 'leads' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenTransition('lead_to_deal', item)}
                                  className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-semibold cursor-pointer"
                                  title="商談を作成"
                                >
                                  商談化
                                </button>
                              )}
                              {currentTable === 'deals' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenTransition('deal_to_customer', item)}
                                  className="p-1 rounded bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 text-[10px] font-semibold cursor-pointer"
                                  title="顧客として登録"
                                >
                                  成約登録
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(item)}
                                className="p-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded cursor-pointer"
                                title="詳細ドロワーを開く"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {columnRecords.length === 0 && (
                      <div className="h-24 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400">
                        該当なし
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Data View: Table on Desktop, Cards on Mobile (When viewMode === 'table') */}
      {!loading && !error && filteredData.length > 0 && (viewMode === 'table' || !['deals', 'leads', 'prospects', 'customers'].includes(currentTable)) && (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold text-[11px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(filteredData.map((d) => String(d.id)));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                        aria-label="全選択"
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                    </th>
                    {currentTable === 'products' && (
                      <th className="py-3 px-3 text-center w-12 whitespace-nowrap" title="ドラッグで並び替え">
                        <span className="flex items-center justify-center gap-0.5 text-[11px] text-purple-600 font-semibold">
                          <GripVertical className="w-3.5 h-3.5" />
                          <span>順</span>
                        </span>
                      </th>
                    )}
                    {config.columnsToShow.map((colKey) => {
                      const fieldDef = config.fields.find((f) => f.key === colKey);
                      const label = fieldDef?.label || colKey;
                      return (
                        <th key={colKey} className="py-3 px-4 whitespace-nowrap text-slate-600">
                          {label}
                        </th>
                      );
                    })}
                    <th className="py-3 px-4 text-right text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredData.map((item) => (
                    <tr
                      key={item.id}
                      draggable={currentTable === 'products'}
                      onDragStart={currentTable === 'products' ? (e) => {
                        e.dataTransfer.setData('text/plain', String(item.id));
                        setDraggedProductId(String(item.id));
                      } : undefined}
                      onDragOver={currentTable === 'products' ? (e) => {
                        e.preventDefault();
                        if (dragOverProductId !== String(item.id)) setDragOverProductId(String(item.id));
                      } : undefined}
                      onDragLeave={currentTable === 'products' ? () => {
                        if (dragOverProductId === String(item.id)) setDragOverProductId(null);
                      } : undefined}
                      onDrop={currentTable === 'products' ? (e) => {
                        e.preventDefault();
                        if (draggedProductId) {
                          handleProductReorder(draggedProductId, String(item.id));
                        }
                        setDraggedProductId(null);
                        setDragOverProductId(null);
                      } : undefined}
                      onDragEnd={currentTable === 'products' ? () => {
                        setDraggedProductId(null);
                        setDragOverProductId(null);
                      } : undefined}
                      onClick={() => handleOpenDetail(item)}
                      className={`hover:bg-purple-50/40 cursor-pointer transition-colors group ${
                        selectedIds.includes(String(item.id)) ? 'bg-purple-50/60' : ''
                      } ${
                        draggedProductId === String(item.id) ? 'opacity-40 bg-slate-100' : ''
                      } ${
                        dragOverProductId === String(item.id) ? 'border-t-2 border-purple-500 bg-purple-50' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(String(item.id))}
                          onChange={(e) => {
                            e.stopPropagation();
                            const sId = String(item.id);
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, sId]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== sId));
                            }
                          }}
                          aria-label={`選択 ${item.id}`}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      {currentTable === 'products' && (
                        <td
                          className="py-3 px-2 text-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-purple-600"
                          onClick={(e) => e.stopPropagation()}
                          title="ドラッグして並び替え"
                        >
                          <div className="flex items-center justify-center">
                            <GripVertical className="w-4 h-4" />
                          </div>
                        </td>
                      )}
                      {config.columnsToShow.map((colKey) => {
                        const val = item[colKey];

                        // 会社外部キーのレンダリング
                        if (colKey === 'company_id') {
                          const compName = item.company?.company_name || item.company_name;
                          return (
                            <td key={colKey} className="py-3 px-4">
                              {compName ? (
                                <div>
                                  <div className="font-semibold text-slate-900 group-hover:text-purple-700">
                                    {compName}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {item.company_id}
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono text-slate-400">{val || '-'}</span>
                              )}
                            </td>
                          );
                        }

                        // 担当者名のレンダリング
                        if (colKey === 'contact_name') {
                          const contactName = item.contact_name || item.contact?.full_name || '';
                          return (
                            <td key={colKey} className="py-3 px-4 whitespace-nowrap">
                              {contactName ? (
                                <div className="font-medium text-slate-900 flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] flex items-center justify-center font-bold">
                                    {contactName[0]}
                                  </span>
                                  <span>{contactName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">-</span>
                              )}
                            </td>
                          );
                        }

                        // メールアドレスのレンダリング
                        if (colKey === 'email') {
                          const email = item.email || item.contact?.email || '';
                          return (
                            <td key={colKey} className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {email ? (
                                <a
                                  href={`mailto:${email}`}
                                  className="inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 hover:underline font-mono"
                                  title={`${email} にメール作成`}
                                >
                                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{email}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">-</span>
                              )}
                            </td>
                          );
                        }

                        // 電話番号のレンダリング
                        if (colKey === 'phone') {
                          const phone = item.phone || item.contact?.phone || '';
                          return (
                            <td key={colKey} className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {phone ? (
                                <a
                                  href={`tel:${phone}`}
                                  className="inline-flex items-center gap-1 text-xs text-slate-800 hover:text-purple-700 hover:underline font-mono"
                                  title={`${phone} に発信`}
                                >
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">-</span>
                              )}
                            </td>
                          );
                        }

                        // 商品外部キーのレンダリング
                        if (colKey === 'product_id') {
                          const prod = item.product;
                          const priceStr = prod ? (
                            prod.pricing_model === 'starting_at'
                              ? `最低月額: ¥${Number(prod.monthly_fee || prod.initial_fee || 0).toLocaleString()}〜 (商談で本決め)`
                              : prod.pricing_model === 'range'
                              ? `月額: ¥${Number(prod.monthly_fee || 0).toLocaleString()} 〜 ¥${Number(prod.price_range_max || 0).toLocaleString()}`
                              : prod.pricing_model === 'custom_quote'
                              ? '個別見積・商談時決定'
                              : `月額: ¥${Number(prod.monthly_fee || 0).toLocaleString()}`
                          ) : '';
                          return (
                            <td key={colKey} className="py-3 px-4">
                              {item.product?.product_name ? (
                                <div>
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <span>{item.product.product_name}</span>
                                    {prod?.pricing_model && prod.pricing_model !== 'fixed' && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-purple-700 font-sans">
                                        商談時決定
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {priceStr}
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono text-slate-400">{val || '-'}</span>
                              )}
                            </td>
                          );
                        }

                        // 料金体系（融通設定）セレクター
                        if (colKey === 'pricing_model') {
                          const model = String(val || 'fixed');
                          return (
                            <td key={colKey} className="py-2.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-flex items-center">
                                <select
                                  value={model}
                                  onChange={(e) => void handleQuickPricingModelChange(item, e.target.value)}
                                  className={`appearance-none pl-2.5 pr-6 py-1 rounded-full text-[11px] font-medium border outline-none cursor-pointer transition-all ${
                                    model === 'starting_at'
                                      ? 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
                                      : model === 'range'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                      : model === 'custom_quote'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                  title="クリックして料金体系（融通設定）を直接切り替えられます"
                                >
                                  <option value="fixed">固定価格</option>
                                  <option value="starting_at">最低価格〜（商談で本決め）</option>
                                  <option value="range">価格帯（商談で本決め）</option>
                                  <option value="custom_quote">個別見積・商談時決定</option>
                                </select>
                                <span className="pointer-events-none absolute right-2 text-[8px] text-slate-400">▼</span>
                              </div>
                            </td>
                          );
                        }

                        // ステータスバッジ
                        if (['status', 'proposal_status', 'contract_status'].includes(colKey) && val) {
                          return (
                            <td key={colKey} className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadgeClass(String(val))}`}>
                                {String(val)}
                              </span>
                            </td>
                          );
                        }

                        // 金額表示（税抜ベース + 税込自動表示）
                        if (['total_amount', 'monthly_fee', 'initial_fee', 'discount_amount'].includes(colKey)) {
                          if (val !== null && val !== undefined && val !== '' && !isNaN(Number(val))) {
                            const num = Number(val);
                            const withTax = Math.floor(num * 1.1);
                            const isStartingAt = item.pricing_model === 'starting_at';
                            const suffix = isStartingAt ? '〜' : '';
                            return (
                              <td key={colKey} className="py-2.5 px-4 font-mono whitespace-nowrap">
                                <div className="text-slate-800 font-medium">¥{num.toLocaleString()}{suffix} <span className="text-[10px] text-slate-400 font-sans">(税抜)</span></div>
                                <div className="text-xs text-purple-700 font-semibold">¥{withTax.toLocaleString()}{suffix} <span className="text-[10px] text-slate-400 font-sans">(税込)</span></div>
                              </td>
                            );
                          }
                          return (
                            <td key={colKey} className="py-3 px-4 font-mono font-medium text-slate-400 whitespace-nowrap">
                              -
                            </td>
                          );
                        }

                        // AIスコア表示
                        if (colKey === 'ai_score' && val !== null && val !== undefined) {
                          const scoreNum = Number(val);
                          return (
                            <td key={colKey} className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                                scoreNum >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                scoreNum >= 50 ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {scoreNum} 点
                              </span>
                            </td>
                          );
                        }

                        // ID表示
                        if (colKey === 'id') {
                          return (
                            <td key={colKey} className="py-3 px-4 font-mono text-slate-400 font-semibold whitespace-nowrap">
                              {String(val)}
                            </td>
                          );
                        }

                        // 会社名表示
                        if (colKey === 'company_name') {
                          return (
                            <td key={colKey} className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {String(val || '-')}
                            </td>
                          );
                        }

                        // 商談名表示
                        if (colKey === 'proposal_plan_name') {
                          return (
                            <td key={colKey} className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {String(val || '-')}
                            </td>
                          );
                        }

                        // 日付・日時表示
                        if (['last_contacted_at', 'registered_at', 'contract_start_date', 'last_updated_at', 'meeting_date', 'proposal_date', 'next_followup_at', 'last_reply_at', 'first_registered_at', 'next_action_at', 'email_step_started_at', 'created_at'].includes(colKey) && val) {
                          const formattedDate = String(val).includes('T') ? String(val).split('T')[0] : String(val);
                          return (
                            <td key={colKey} className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                              {formattedDate}
                            </td>
                          );
                        }

                        return (
                          <td key={colKey} className="py-3 px-4 max-w-[200px] truncate text-slate-700">
                            {val !== null && val !== undefined ? String(val) : '-'}
                          </td>
                        );
                      })}

                      {/* Row Actions (View, Stage Progression, Edit & Safe Delete) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {['prospects', 'leads', 'deals', 'customers'].includes(currentTable) && item.company_id && onOpenCustomerWorkspace && (
                            <button onClick={() => handleOpenRecordSend(item)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 flex items-center gap-1 transition-colors" title="この会社の連絡先を選んで送信センターを開く">
                              <Send className="w-3.5 h-3.5" /><span>連絡・配信</span>
                            </button>
                          )}
                          {currentTable === 'prospects' && (
                            <button
                              onClick={() => handleOpenTransition('prospect_to_lead', item)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white border border-cyan-200 flex items-center gap-1 transition-colors"
                              title="見込み企業からリードへ進める"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>リードへ進める</span>
                            </button>
                          )}
                          {currentTable === 'leads' && (
                            <button
                              onClick={() => handleOpenTransition('lead_to_deal', item)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 flex items-center gap-1 transition-colors"
                              title="リードから商談を作成する"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                              <span>商談を作成</span>
                            </button>
                          )}
                          {currentTable === 'deals' && (
                            <button
                              onClick={() => handleOpenTransition('deal_to_customer', item)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white border border-pink-200 flex items-center gap-1 transition-colors"
                              title="商談から顧客として登録する"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>顧客として登録</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="詳細を見る"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                            title="編集する"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <InlineDeleteButton onConfirm={() => void handleDeleteRecord(item)}
                            disabled={deletingRecordId === String(item.id)}
                            warning="削除しますか？関連データから参照されている場合は削除できません。"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            ariaLabel="削除（関連データがある場合は保護されます）">
                            <Trash2 className="w-3.5 h-3.5" />
                          </InlineDeleteButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredData.map((item) => (
              <div
                key={item.id}
                draggable={currentTable === 'products'}
                onDragStart={currentTable === 'products' ? (e) => {
                  e.dataTransfer.setData('text/plain', String(item.id));
                  setDraggedProductId(String(item.id));
                } : undefined}
                onDragOver={currentTable === 'products' ? (e) => {
                  e.preventDefault();
                  if (dragOverProductId !== String(item.id)) setDragOverProductId(String(item.id));
                } : undefined}
                onDragLeave={currentTable === 'products' ? () => {
                  if (dragOverProductId === String(item.id)) setDragOverProductId(null);
                } : undefined}
                onDrop={currentTable === 'products' ? (e) => {
                  e.preventDefault();
                  if (draggedProductId) {
                    handleProductReorder(draggedProductId, String(item.id));
                  }
                  setDraggedProductId(null);
                  setDragOverProductId(null);
                } : undefined}
                onDragEnd={currentTable === 'products' ? () => {
                  setDraggedProductId(null);
                  setDragOverProductId(null);
                } : undefined}
                onClick={() => handleOpenDetail(item)}
                className={`bg-white border border-slate-200 rounded-xl p-4 space-y-3 cursor-pointer hover:border-purple-200 hover:shadow-xs transition-all ${
                  draggedProductId === String(item.id) ? 'opacity-40 bg-slate-50' : ''
                } ${
                  dragOverProductId === String(item.id) ? 'border-t-2 border-purple-500 bg-purple-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {currentTable === 'products' && (
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-purple-600 shrink-0 mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                        title="ドラッグで並び替え"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] font-mono text-slate-400">ID: {item.id}</span>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {item.company_name ||
                          item.proposal_plan_name ||
                          item.product_name ||
                          item.company?.company_name ||
                          `レコード #${item.id}`}
                      </h3>
                    </div>
                  </div>
                  {(item.status || item.proposal_status || item.contract_status) && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadgeClass(String(item.status || item.proposal_status || item.contract_status))}`}>
                      {item.status || item.proposal_status || item.contract_status}
                    </span>
                  )}
                  <InlineDeleteButton onConfirm={() => void handleDeleteRecord(item)} disabled={deletingRecordId === String(item.id)} className="mt-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50" ariaLabel="削除"><Trash2 className="w-4 h-4" /></InlineDeleteButton>
                </div>

                {/* Sub details */}
                <div className="space-y-1 text-xs text-slate-500">
                  {item.company_id && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>会社: {item.company?.company_name || item.company_id}</span>
                    </div>
                  )}
                  {item.total_amount && (
                    <div className="font-mono text-xs">
                      <span className="text-slate-700">税抜: ¥{Number(item.total_amount).toLocaleString()}</span>
                      <span className="ml-2 font-semibold text-purple-700">税込: ¥{Math.floor(Number(item.total_amount) * 1.1).toLocaleString()}</span>
                    </div>
                  )}
                  {item.monthly_fee && (
                    <div className="font-mono text-xs">
                      <span className="text-slate-600">月額（税抜）: ¥{Number(item.monthly_fee).toLocaleString()}{item.pricing_model === 'starting_at' ? '〜' : ''}</span>
                      <span className="ml-2 text-purple-700 font-semibold">（税込 ¥{Math.floor(Number(item.monthly_fee) * 1.1).toLocaleString()}{item.pricing_model === 'starting_at' ? '〜' : ''}）</span>
                    </div>
                  )}
                  {currentTable === 'products' && (
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-slate-500">料金体系:</span>
                      <select
                        value={String(item.pricing_model || 'fixed')}
                        onChange={(e) => void handleQuickPricingModelChange(item, e.target.value)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 outline-none"
                      >
                        <option value="fixed">固定価格</option>
                        <option value="starting_at">最低価格〜（商談で本決め）</option>
                        <option value="range">価格帯（商談で本決め）</option>
                        <option value="custom_quote">個別見積・商談時決定</option>
                      </select>
                    </div>
                  )}
                  {item.ai_score !== undefined && item.ai_score !== null && (
                    <div className="font-mono text-purple-700 font-semibold">
                      AI確度スコア: {item.ai_score} 点
                    </div>
                  )}
                  {item.contact_name && (
                    <div>担当: {item.contact_name}</div>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-slate-400 text-[11px]">タップして詳細確認</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['prospects', 'leads', 'deals', 'customers'].includes(currentTable) && item.company_id && onOpenCustomerWorkspace && (
                      <button onClick={() => handleOpenRecordSend(item)} className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 flex items-center gap-1 text-[11px] font-semibold">
                        <Send className="w-3 h-3" /><span>連絡・配信</span>
                      </button>
                    )}
                    {currentTable === 'prospects' && (
                      <button
                        onClick={() => handleOpenTransition('prospect_to_lead', item)}
                        className="px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white border border-cyan-200 flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <Layers className="w-3 h-3" />
                        <span>リードへ進める</span>
                      </button>
                    )}
                    {currentTable === 'leads' && (
                      <button
                        onClick={() => handleOpenTransition('lead_to_deal', item)}
                        className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <Briefcase className="w-3 h-3" />
                        <span>商談を作成</span>
                      </button>
                    )}
                    {currentTable === 'deals' && (
                      <button
                        onClick={() => handleOpenTransition('deal_to_customer', item)}
                        className="px-2 py-1 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white border border-pink-200 flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>顧客として登録</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-1 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>編集</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailOpen && (
        <RecordDetailModal
          tableKey={currentTable}
          record={selectedRecord}
          onClose={() => setIsDetailOpen(false)}
          onEdit={(record) => {
            setIsDetailOpen(false);
            handleOpenEdit(record);
          }}
          onTransitionStage={handleOpenTransition}
          onOpenCustomerWorkspace={onOpenCustomerWorkspace}
        />
      )}

      {/* Form Modal (Create / Edit) */}
      {isFormOpen && (
        <RecordFormModal
          isOpen={isFormOpen}
          tableKey={currentTable}
          editRecord={editRecord}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {isProspectImportOpen && currentTable === 'prospects' && (
        <ProspectResearchImportModal
          onClose={() => setIsProspectImportOpen(false)}
          onImported={() => { void loadData(); }}
        />
      )}

      {/* Stage Transition Modal */}
      {transitionOpen && (
        <StageTransitionModal
          isOpen={transitionOpen}
          type={transitionType}
          sourceRecord={transitionSourceRecord}
          onClose={() => setTransitionOpen(false)}
          onSuccess={handleTransitionSuccess}
          onViewExistingCustomer={handleViewExistingCustomer}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-fade-in border border-slate-700">
          <div className="text-xs font-semibold">
            <span className="text-purple-400 font-bold">{selectedIds.length}</span> 件を選択中
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBulkDeleting ? '削除中...' : '選択したレコードを一括削除'}</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
            >
              選択解除
            </button>
          </div>
        </div>
      )}

      {/* Clean Dummy Data Modal */}
      {isCleanDummyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ダミー・テストデータの一括整理</h3>
                  <p className="text-xs text-slate-500">外部キー制約を考慮し、依存関係の深い順に安全に一括削除します</p>
                </div>
              </div>
              <button
                onClick={() => setIsCleanDummyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-800 mb-1">削除する対象カテゴリを選択してください：</p>
              {[
                { key: 'prospects', label: '見込み企業リスト (prospects)' },
                { key: 'leads', label: 'リード・反響一覧 (leads)' },
                { key: 'deals', label: '商談パイプライン (deals)' },
                { key: 'customers', label: '顧客・契約・請求書・送付書類 (customers, contracts, invoices)' },
                { key: 'companies', label: '法人マスタ・連絡先 (companies, contacts)' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2.5 p-1.5 hover:bg-white rounded cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={cleanDummyTargets.includes(item.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCleanDummyTargets([...cleanDummyTargets, item.key]);
                      } else {
                        setCleanDummyTargets(cleanDummyTargets.filter((k) => k !== item.key));
                      }
                    }}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="font-medium text-slate-800">{item.label}</span>
                </label>
              ))}
              <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-2">
                ※ 「商品マスタ」や「LINE設定・テンプレート」は保護され削除されません。
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCleanDummyModalOpen(false)}
                disabled={isCleaningDummy}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleExecuteCleanDummy}
                disabled={isCleaningDummy || cleanDummyTargets.length === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isCleaningDummy ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>整理実行中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>選択カテゴリを一括削除</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
