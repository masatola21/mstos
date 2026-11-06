import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { TABLE_CONFIGS } from '../types/database';
import { deleteTableRecord, fetchTableData, updateRecord, bulkDeleteTableRecords, cleanDummyData } from '../services/dataService';
import { InlineDeleteButton } from './InlineDeleteButton';
import { RecordDetailModal } from './RecordDetailModal';
import { RecordFormModal } from './RecordFormModal';
import { StageTransitionModal } from './StageTransitionModal';
import { ProspectResearchImportModal } from './ProspectResearchImportModal';
import { getStatusBadgeClass } from '../utils/statusBadges';
import { Search, Plus, RefreshCw, AlertCircle, ShieldAlert, FileCode2, Inbox, Eye, Edit3, Building2, Calendar, Tag, CheckCircle2, Layers, Briefcase, UserCheck, Trash2, Send, GripVertical, LayoutGrid, List } from 'lucide-react';
import { matrixService } from '../services/matrixService';
export const TableManager = ({ currentTable, onTableChange, onOpenRls, onStageTransitionTask, onOpenCustomerWorkspace, }) => {
    const config = TABLE_CONFIGS[currentTable];
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [successBanner, setSuccessBanner] = useState(null);
    const [deletingRecordId, setDeletingRecordId] = useState(null);
    const [isProspectImportOpen, setIsProspectImportOpen] = useState(false);
    const [draggedProductId, setDraggedProductId] = useState(null);
    const [dragOverProductId, setDragOverProductId] = useState(null);
    const [reorderNotice, setReorderNotice] = useState(null);
    const [viewMode, setViewMode] = useState('table');
    // Modals state
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editRecord, setEditRecord] = useState(null);
    // 一括操作・エラーバナー・ダミーデータ整理状態
    const [rowActionError, setRowActionError] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isCleanDummyModalOpen, setIsCleanDummyModalOpen] = useState(false);
    const [cleanDummyTargets, setCleanDummyTargets] = useState(['prospects', 'leads', 'deals', 'customers', 'companies']);
    const [isCleaningDummy, setIsCleaningDummy] = useState(false);
    // ステージ移行モーダル状態
    const [transitionOpen, setTransitionOpen] = useState(false);
    const [transitionType, setTransitionType] = useState('prospect_to_lead');
    const [transitionSourceRecord, setTransitionSourceRecord] = useState(null);
    const handleOpenTransition = (type, record) => {
        setTransitionType(type);
        setTransitionSourceRecord(record);
        setTransitionOpen(true);
    };
    const handleTransitionSuccess = (targetTable, recordId) => {
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
    const handleViewExistingCustomer = (customer) => {
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
            }
            else {
                let sorted = tableData;
                if (currentTable === 'products') {
                    try {
                        const savedOrderStr = localStorage.getItem('crm_products_sort_order');
                        if (savedOrderStr) {
                            const savedOrder = JSON.parse(savedOrderStr);
                            const orderMap = new Map(savedOrder.map((id, index) => [String(id), index]));
                            sorted = [...tableData].sort((a, b) => {
                                const orderA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : 99999;
                                const orderB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : 99999;
                                return orderA - orderB;
                            });
                        }
                    }
                    catch {
                        // ignore
                    }
                }
                setData(sorted);
            }
        }
        catch (err) {
            setError({
                type: 'UNKNOWN',
                message: err.message || 'データの取得に失敗しました。',
            });
            setData([]);
        }
        finally {
            setLoading(false);
        }
    };
    const handleProductReorder = (draggedId, targetId) => {
        if (draggedId === targetId)
            return;
        const oldIndex = data.findIndex((item) => String(item.id) === draggedId);
        const newIndex = data.findIndex((item) => String(item.id) === targetId);
        if (oldIndex === -1 || newIndex === -1)
            return;
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
                    .map((item) => matrixMap.get(String(item.id)));
                const reorderedIds = new Set(reorderedMatrix.map((p) => p.id));
                const remaining = matrixList.filter((p) => !reorderedIds.has(p.id));
                matrixService.saveProducts([...reorderedMatrix, ...remaining]);
            }
        }
        catch {
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
            if (itemStatus !== statusFilter)
                return false;
        }
        if (!searchQuery.trim())
            return true;
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
    const handleOpenDetail = (record) => {
        setSelectedRecord(record);
        setIsDetailOpen(true);
    };
    const handleOpenCreate = () => {
        setEditRecord(null);
        setIsFormOpen(true);
    };
    const handleOpenEdit = (record) => {
        setEditRecord(record);
        setIsFormOpen(true);
    };
    const handleOpenRecordSend = (record) => {
        if (!record.company_id || !onOpenCustomerWorkspace)
            return;
        onOpenCustomerWorkspace(String(record.company_id), 'send', {
            tableKey: currentTable,
            recordId: String(record.id),
            leadId: currentTable === 'leads' ? String(record.id) : record.lead_id ? String(record.lead_id) : undefined,
            contactId: record.contact_id ? String(record.contact_id) : undefined,
        });
    };
    const [forceDeleteConfirmRecord, setForceDeleteConfirmRecord] = useState(null);
    const handleDeleteRecord = async (record, force = false) => {
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
        window.setTimeout(() => setSuccessBanner(null), 5000);
    };
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0)
            return;
        const confirmMsg = `選択した ${selectedIds.length} 件のレコードを一括削除しますか？\n（関連するデータがある場合は安全に解除または除外されます）`;
        if (!window.confirm(confirmMsg))
            return;
        setIsBulkDeleting(true);
        setRowActionError(null);
        const result = await bulkDeleteTableRecords(currentTable, selectedIds, { force: true });
        setIsBulkDeleting(false);
        if (result.error) {
            setRowActionError(result.error.message);
            return;
        }
        const count = result.successCount ?? selectedIds.length;
        setData((current) => current.filter((item) => !selectedIds.includes(String(item.id))));
        setSelectedIds([]);
        setSuccessBanner(`${count} 件のレコードを一括削除しました。`);
        window.setTimeout(() => setSuccessBanner(null), 5000);
    };
    const handleExecuteCleanDummy = async () => {
        if (cleanDummyTargets.length === 0)
            return;
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
    const handleQuickPricingModelChange = async (product, newModel) => {
        const label = product.product_name || product.id;
        const modelLabels = {
            fixed: '固定価格',
            starting_at: '最低価格〜（商談で本決め）',
            range: '価格帯（商談で本決め）',
            custom_quote: '個別見積・商談時決定',
        };
        // 楽観的UI更新
        setData((current) => current.map((item) => String(item.id) === String(product.id) ? { ...item, pricing_model: newModel } : item));
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
    const handleQuickStatusChange = async (record, newStatus) => {
        const statusField = currentTable === 'deals' ? 'proposal_status' : currentTable === 'customers' ? 'contract_status' : 'status';
        setData((current) => current.map((item) => String(item.id) === String(record.id) ? { ...item, [statusField]: newStatus } : item));
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
    const statusOptions = Array.from(new Set(data
        .map((d) => d.status || d.proposal_status || d.contract_status)
        .filter(Boolean)));
    // ステージ列（カンバン表示用）
    const kanbanColumns = React.useMemo(() => {
        const statusField = currentTable === 'deals' ? 'proposal_status' : currentTable === 'customers' ? 'contract_status' : 'status';
        const defaultCols = {
            deals: ['新規', '提案中', '見積提出', '成約', '失注', '保留'],
            leads: ['新規', '資料請求', 'ヒアリング済', '商談化', '失注・対象外'],
            prospects: ['未接触', 'アプローチ中', '検討中', '商談化', '保留'],
            customers: ['active', '契約中', '更新中', '解約'],
        };
        const base = defaultCols[currentTable] || [];
        const discovered = Array.from(new Set(data.map((d) => d[statusField]).filter(Boolean)));
        return Array.from(new Set([...base, ...discovered]));
    }, [currentTable, data]);
    return (_jsxs("div", { className: "space-y-6 animate-fade-in pb-12", children: [forceDeleteConfirmRecord && (_jsxs("div", { className: "rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-sm", children: "\u3010\u524A\u9664\u306E\u78BA\u8A8D\u3011\u95A2\u9023\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u3059" }), _jsxs("p", { className: "text-xs text-amber-800 mt-0.5", children: ["\u5546\u54C1\u300C", forceDeleteConfirmRecord.record.product_name || forceDeleteConfirmRecord.record.id, "\u300D\u306F\u300C", forceDeleteConfirmRecord.blockedBy, "\u300D\u7B49\u306B\u7D10\u4ED8\u3044\u3066\u3044\u307E\u3059\u3002\u95A2\u9023\u4ED8\u3051\u3092\u5B89\u5168\u306B\u89E3\u9664\uFF08NULL\u8A2D\u5B9A\uFF09\u3057\u305F\u4E0A\u3067\u5B8C\u5168\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F"] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("button", { onClick: () => {
                                    const rec = forceDeleteConfirmRecord.record;
                                    setForceDeleteConfirmRecord(null);
                                    void handleDeleteRecord(rec, true);
                                }, className: "rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 transition shadow-xs cursor-pointer", children: "\u53C2\u7167\u3092\u89E3\u9664\u3057\u3066\u5B8C\u5168\u524A\u9664" }), _jsx("button", { onClick: () => setForceDeleteConfirmRecord(null), className: "rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3 py-1.5 transition cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" })] })] })), rowActionError && (_jsxs("div", { className: "rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 flex items-center justify-between gap-3 animate-fade-in shadow-xs", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx(AlertCircle, { className: "w-4 h-4 text-rose-600 shrink-0" }), _jsx("span", { className: "font-semibold", children: rowActionError })] }), _jsx("button", { onClick: () => setRowActionError(null), className: "text-xs font-semibold text-rose-700 hover:text-rose-900 cursor-pointer", children: "\u9589\u3058\u308B" })] })), (currentTable === 'companies' || currentTable === 'products') && (_jsxs("div", { className: "flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80 w-fit mb-1", children: [_jsxs("button", { type: "button", onClick: () => onTableChange('companies'), className: `px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${currentTable === 'companies'
                            ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`, children: [_jsx(Building2, { className: `w-3.5 h-3.5 ${currentTable === 'companies' ? 'text-purple-600' : 'text-slate-400'}` }), _jsx("span", { children: "\u4F1A\u793E\u53F0\u5E33\uFF08\u6CD5\u4EBA\u30DE\u30B9\u30BF\uFF09" })] }), _jsxs("button", { type: "button", onClick: () => onTableChange('products'), className: `px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${currentTable === 'products'
                            ? 'bg-white text-purple-700 shadow-xs border border-purple-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`, children: [_jsx(Tag, { className: `w-3.5 h-3.5 ${currentTable === 'products' ? 'text-purple-600' : 'text-slate-400'}` }), _jsx("span", { children: "\u8CA9\u58F2\u5546\u54C1\u30FB\u6599\u91D1\u53F0\u5E33" })] })] })), _jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: config.label }), _jsx("span", { className: "text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-mono", children: config.name })] }), _jsxs("div", { className: "flex items-center gap-2", children: [currentTable === 'prospects' && (_jsx("button", { onClick: () => setIsProspectImportOpen(true), className: "px-3 py-1.5 rounded-md font-medium text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer", children: _jsx("span", { children: "\u898B\u8FBC\u307F\u4F01\u696D\u8ABF\u67FB" }) })), _jsxs("button", { onClick: () => setIsCleanDummyModalOpen(true), className: "px-3 py-1.5 rounded-md font-medium text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs", title: "\u30C0\u30DF\u30FC\u30FB\u30C6\u30B9\u30C8\u30C7\u30FC\u30BF\u3092\u5B89\u5168\u306B\u4E00\u62EC\u6574\u7406", children: [_jsx(Trash2, { className: "w-3.5 h-3.5 text-rose-600" }), _jsx("span", { children: "\u30C0\u30DF\u30FC\u30C7\u30FC\u30BF\u6574\u7406" })] }), _jsx("button", { onClick: loadData, disabled: loading, className: "p-1.5 rounded-md text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer", title: "\u518D\u8AAD\u307F\u8FBC\u307F", children: _jsx(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}` }) }), _jsxs("button", { onClick: handleOpenCreate, className: "px-3 py-1.5 rounded-md font-medium text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u65B0\u898F\u767B\u9332" })] })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" }), _jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: `${config.label}内のキーワード、会社名、担当者、IDなどを検索...`, className: "w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-200 focus:border-purple-500 text-slate-800 text-xs placeholder:text-slate-400 outline-none shadow-2xs transition-colors" }), searchQuery && (_jsx("button", { onClick: () => setSearchQuery(''), className: "absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer", children: "\u30AF\u30EA\u30A2" }))] }), ['deals', 'leads', 'prospects', 'customers'].includes(currentTable) && (_jsxs("div", { className: "flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0", children: [_jsxs("button", { type: "button", onClick: () => setViewMode('table'), className: `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${viewMode === 'table'
                                            ? 'bg-white text-purple-700 shadow-2xs font-bold'
                                            : 'text-slate-600 hover:text-slate-900 font-medium'}`, title: "\u30C6\u30FC\u30D6\u30EB\u4E00\u89A7\u8868\u793A", children: [_jsx(List, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u30EA\u30B9\u30C8" })] }), _jsxs("button", { type: "button", onClick: () => setViewMode('kanban'), className: `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${viewMode === 'kanban'
                                            ? 'bg-white text-purple-700 shadow-2xs font-bold'
                                            : 'text-slate-600 hover:text-slate-900 font-medium'}`, title: "\u30B9\u30C6\u30FC\u30B8\u5225\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3\uFF08\u30AB\u30F3\u30D0\u30F3\u8868\u793A\uFF09", children: [_jsx(LayoutGrid, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3 (\u30AB\u30F3\u30D0\u30F3)" })] })] })), statusOptions.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("span", { className: "text-xs text-slate-500 whitespace-nowrap", children: "\u72B6\u614B:" }), _jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs outline-none focus:border-purple-500 shadow-2xs cursor-pointer", children: [_jsx("option", { value: "ALL", children: "\u3059\u3079\u3066\u8868\u793A" }), statusOptions.map((st) => (_jsx("option", { value: st, children: st }, st)))] })] })), _jsxs("div", { className: "text-xs text-slate-500 self-center whitespace-nowrap px-2 shrink-0", children: ["\u8868\u793A: ", _jsx("strong", { className: "text-purple-700 font-mono font-bold", children: filteredData.length }), " / ", data.length, " \u4EF6"] })] }), statusOptions.length > 0 && (_jsxs("div", { className: "flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar", children: [_jsxs("button", { type: "button", onClick: () => setStatusFilter('ALL'), className: `px-3 py-1 rounded-full text-xs transition-colors shrink-0 cursor-pointer ${statusFilter === 'ALL'
                                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`, children: ["\u3059\u3079\u3066 (", data.length, ")"] }), statusOptions.map((st) => {
                                const count = data.filter((d) => (d.status || d.proposal_status || d.contract_status) === st).length;
                                const isActive = statusFilter === st;
                                return (_jsxs("button", { type: "button", onClick: () => setStatusFilter(isActive ? 'ALL' : st), className: `px-3 py-1 rounded-full text-xs transition-colors shrink-0 border cursor-pointer ${isActive
                                        ? 'bg-purple-50 text-purple-700 border-purple-300 font-bold shadow-xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`, children: [_jsx("span", { children: st }), _jsx("span", { className: `ml-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? 'bg-purple-200/60 text-purple-800' : 'bg-slate-100 text-slate-500'}`, children: count })] }, st));
                            })] }))] }), successBanner && (_jsxs("div", { className: "p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-center justify-between gap-3 animate-fade-in shadow-lg", children: [_jsxs("div", { className: "flex items-center gap-2.5 text-xs", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-400 shrink-0" }), _jsx("span", { className: "font-semibold", children: successBanner })] }), _jsx("button", { onClick: () => setSuccessBanner(null), className: "text-xs text-emerald-400 hover:text-emerald-200", children: "\u9589\u3058\u308B" })] })), reorderNotice && (_jsxs("div", { className: "p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 flex items-center justify-between gap-3 animate-fade-in shadow-lg", children: [_jsxs("div", { className: "flex items-center gap-2.5 text-xs", children: [_jsx(CheckCircle2, { className: "w-4 h-4 text-indigo-400 shrink-0" }), _jsx("span", { className: "font-semibold", children: reorderNotice })] }), _jsx("button", { onClick: () => setReorderNotice(null), className: "text-xs text-indigo-400 hover:text-indigo-200", children: "\u9589\u3058\u308B" })] })), currentTable === 'products' && (_jsxs("div", { className: "flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs shadow-xs", children: [_jsx(GripVertical, { className: "w-4 h-4 text-purple-600 shrink-0" }), _jsx("span", { children: "\u884C\u3092\u30C9\u30E9\u30C3\u30B0\uFF06\u30C9\u30ED\u30C3\u30D7\u3059\u308B\u3068\u5546\u54C1\u306E\u8868\u793A\u9806\u3092\u4E26\u3073\u66FF\u3048\u3067\u304D\u307E\u3059\uFF08\u30D6\u30E9\u30A6\u30B6\u3068\u5546\u54C1\u8A2D\u8A08\u306B\u81EA\u52D5\u4FDD\u5B58\u3055\u308C\u307E\u3059\uFF09" })] })), loading && (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs", children: [_jsx(RefreshCw, { className: "w-8 h-8 animate-spin mx-auto text-purple-600" }), _jsxs("p", { className: "text-sm font-semibold text-slate-800", children: [config.label, "\u306E\u30C7\u30FC\u30BF\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D..."] }), _jsx("p", { className: "text-xs text-slate-400", children: "Supabase\u30C7\u30FC\u30BF\u30D9\u30FC\u30B9\u3068\u901A\u4FE1\u3057\u3066\u3044\u307E\u3059" })] })), !loading && error && error.type === 'PERMISSION_DENIED' && (_jsxs("div", { className: "bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-xs text-amber-900", children: [_jsx("div", { className: "w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto", children: _jsx(ShieldAlert, { className: "w-6 h-6" }) }), _jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "text-base font-bold text-amber-900", children: "\u6A29\u9650\u4E0D\u8DB3\uFF08Row Level Security: RLS \u30DD\u30EA\u30B7\u30FC\uFF09" }), _jsxs("p", { className: "text-xs text-amber-800 leading-relaxed", children: ["\u30C6\u30FC\u30D6\u30EB ", _jsx("code", { children: currentTable }), " \u306B\u5BFE\u3059\u308B\u30A2\u30AF\u30BB\u30B9\u6A29\u9650\u304CSupabase\u5074\u3067\u8A31\u53EF\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002 \u793E\u5185\u8A8D\u8A3C\u30E6\u30FC\u30B6\u30FC\uFF08authenticated\uFF09\u306B\u5BFE\u3057\u3066 SELECT/INSERT/UPDATE \u30DD\u30EA\u30B7\u30FC\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"] })] }), _jsxs("div", { className: "pt-2 flex justify-center gap-3", children: [_jsxs("button", { onClick: onOpenRls, className: "px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs", children: [_jsx(FileCode2, { className: "w-4 h-4" }), _jsx("span", { children: "RLS\u63A8\u5968SQL\u3092\u78BA\u8A8D\u3057\u3066\u9069\u7528\u3059\u308B" })] }), _jsx("button", { onClick: loadData, className: "px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 transition-colors shadow-xs", children: "\u518D\u8A66\u884C" })] })] })), !loading && error && error.type !== 'PERMISSION_DENIED' && (_jsxs("div", { className: "bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-xs text-rose-900", children: [_jsx("div", { className: "w-12 h-12 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto", children: _jsx(AlertCircle, { className: "w-6 h-6" }) }), _jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "text-base font-bold text-rose-900", children: error.type === 'CONNECTION_ERROR' ? '接続エラー' : 'データ取得エラー' }), _jsx("p", { className: "text-xs text-rose-800 leading-relaxed font-mono", children: error.message })] }), _jsx("div", { className: "pt-2 flex justify-center gap-3", children: _jsxs("button", { onClick: loadData, className: "px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs", children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u518D\u8A66\u884C\u3059\u308B" })] }) })] })), !loading && !error && filteredData.length === 0 && (_jsxs("div", { className: "bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs", children: [_jsx("div", { className: "w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto", children: _jsx(Inbox, { className: "w-6 h-6" }) }), _jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "text-base font-bold text-slate-800", children: searchQuery ? '検索条件に一致するレコードがありません' : `${config.label}のレコードはまだありません` }), _jsx("p", { className: "text-xs text-slate-500", children: searchQuery ? 'キーワードを変更して再度お試しください。' : '「新規登録」ボタンから最初のレコードを登録してください。' })] }), !searchQuery && (_jsxs("button", { onClick: handleOpenCreate, className: "px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsxs("span", { children: [config.label, "\u3092\u65B0\u898F\u767B\u9332\u3059\u308B"] })] }))] })), !loading && !error && filteredData.length > 0 && viewMode === 'kanban' && ['deals', 'leads', 'prospects', 'customers'].includes(currentTable) && (_jsx("div", { className: "overflow-x-auto pb-4", children: _jsx("div", { className: "flex items-start gap-4 min-w-[900px]", children: kanbanColumns.map((colStatus) => {
                        const statusField = currentTable === 'deals' ? 'proposal_status' : currentTable === 'customers' ? 'contract_status' : 'status';
                        const columnRecords = filteredData.filter((item) => (item[statusField] || '') === colStatus);
                        const columnTotalAmount = currentTable === 'deals'
                            ? columnRecords.reduce((acc, cur) => acc + (Number(cur.total_amount) || 0), 0)
                            : 0;
                        return (_jsxs("div", { className: "flex-1 min-w-[280px] max-w-[340px] bg-slate-50/70 border border-slate-200 rounded-2xl p-3 flex flex-col max-h-[calc(100vh-280px)]", children: [_jsxs("div", { className: "flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: `px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(colStatus)}`, children: colStatus }), _jsx("span", { className: "text-xs font-mono font-semibold text-slate-500", children: columnRecords.length })] }), columnTotalAmount > 0 && (_jsxs("span", { className: "text-[11px] font-mono font-bold text-purple-700", children: ["\u00A5", columnTotalAmount.toLocaleString()] }))] }), _jsxs("div", { className: "space-y-2.5 overflow-y-auto flex-1 pr-1", children: [columnRecords.map((item) => {
                                            const title = item.proposal_plan_name || item.company_name || item.company?.company_name || `レコード #${item.id}`;
                                            const subTitle = item.company?.company_name || (item.company_id ? `会社ID: ${item.company_id}` : undefined);
                                            const amount = item.total_amount ? Number(item.total_amount) : item.monthly_fee ? Number(item.monthly_fee) : null;
                                            const dateField = item.meeting_date || item.proposal_date || item.last_contacted_at || item.contract_start_date;
                                            return (_jsxs("div", { onClick: () => handleOpenDetail(item), className: "bg-white border border-slate-200 hover:border-purple-300 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-2.5 group", children: [_jsx("div", { className: "flex items-start justify-between gap-2", children: _jsxs("div", { children: [_jsxs("div", { className: "text-[10px] font-mono text-slate-400", children: ["ID: ", item.id] }), _jsx("h4", { className: "font-bold text-xs text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-1", children: title }), subTitle && (_jsxs("div", { className: "text-[11px] text-slate-500 flex items-center gap-1 mt-0.5", children: [_jsx(Building2, { className: "w-3 h-3 text-purple-600 shrink-0" }), _jsx("span", { className: "truncate", children: subTitle })] }))] }) }), _jsxs("div", { className: "flex items-center justify-between text-xs pt-1 border-t border-slate-100", children: [amount !== null ? (_jsxs("div", { className: "font-mono", children: [_jsxs("span", { className: "font-bold text-slate-900", children: ["\u00A5", amount.toLocaleString()] }), _jsxs("span", { className: "text-[10px] text-purple-700 ml-1", children: ["(\u8FBC \u00A5", Math.floor(amount * 1.1).toLocaleString(), ")"] })] })) : item.ai_score !== undefined && item.ai_score !== null ? (_jsxs("span", { className: "text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200", children: ["AI\u78BA\u5EA6: ", item.ai_score, "\u70B9"] })) : (_jsx("span", { className: "text-[11px] text-slate-400 font-mono", children: "-" })), dateField && (_jsxs("div", { className: "flex items-center gap-1 text-[11px] text-slate-400 font-mono", children: [_jsx(Calendar, { className: "w-3 h-3" }), _jsx("span", { children: String(dateField).split('T')[0] })] }))] }), _jsxs("div", { className: "flex items-center justify-between pt-1 border-t border-slate-100 gap-1.5", onClick: (e) => e.stopPropagation(), children: [_jsx("select", { value: item[statusField] || colStatus, onChange: (e) => void handleQuickStatusChange(item, e.target.value), className: "text-[10px] py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 outline-none hover:bg-slate-100 cursor-pointer", title: "\u30B9\u30C6\u30FC\u30B8\u3092\u5909\u66F4", children: kanbanColumns.map((st) => (_jsx("option", { value: st, children: st }, st))) }), _jsxs("div", { className: "flex items-center gap-1", children: [currentTable === 'prospects' && (_jsx("button", { type: "button", onClick: () => handleOpenTransition('prospect_to_lead', item), className: "p-1 rounded bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 text-[10px] font-semibold cursor-pointer", title: "\u30EA\u30FC\u30C9\u3078\u9032\u3081\u308B", children: "\u30EA\u30FC\u30C9\u5316" })), currentTable === 'leads' && (_jsx("button", { type: "button", onClick: () => handleOpenTransition('lead_to_deal', item), className: "p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-semibold cursor-pointer", title: "\u5546\u8AC7\u3092\u4F5C\u6210", children: "\u5546\u8AC7\u5316" })), currentTable === 'deals' && (_jsx("button", { type: "button", onClick: () => handleOpenTransition('deal_to_customer', item), className: "p-1 rounded bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 text-[10px] font-semibold cursor-pointer", title: "\u9867\u5BA2\u3068\u3057\u3066\u767B\u9332", children: "\u6210\u7D04\u767B\u9332" })), _jsx("button", { type: "button", onClick: () => handleOpenDetail(item), className: "p-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded cursor-pointer", title: "\u8A73\u7D30\u30C9\u30ED\u30EF\u30FC\u3092\u958B\u304F", children: _jsx(Eye, { className: "w-3.5 h-3.5" }) })] })] })] }, item.id));
                                        }), columnRecords.length === 0 && (_jsx("div", { className: "h-24 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400", children: "\u8A72\u5F53\u306A\u3057" }))] })] }, colStatus));
                    }) }) })), !loading && !error && filteredData.length > 0 && (viewMode === 'table' || !['deals', 'leads', 'prospects', 'customers'].includes(currentTable)) && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { className: "bg-slate-50/80 text-slate-600 font-semibold text-[11px] tracking-wider border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "py-3 px-3 text-center w-10", children: _jsx("input", { type: "checkbox", checked: filteredData.length > 0 && selectedIds.length === filteredData.length, onChange: (e) => {
                                                            if (e.target.checked) {
                                                                setSelectedIds(filteredData.map((d) => String(d.id)));
                                                            }
                                                            else {
                                                                setSelectedIds([]);
                                                            }
                                                        }, "aria-label": "\u5168\u9078\u629E", className: "rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" }) }), currentTable === 'products' && (_jsx("th", { className: "py-3 px-3 text-center w-12 whitespace-nowrap", title: "\u30C9\u30E9\u30C3\u30B0\u3067\u4E26\u3073\u66FF\u3048", children: _jsxs("span", { className: "flex items-center justify-center gap-0.5 text-[11px] text-purple-600 font-semibold", children: [_jsx(GripVertical, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u9806" })] }) })), config.columnsToShow.map((colKey) => {
                                                    const fieldDef = config.fields.find((f) => f.key === colKey);
                                                    const label = fieldDef?.label || colKey;
                                                    return (_jsx("th", { className: "py-3 px-4 whitespace-nowrap text-slate-600", children: label }, colKey));
                                                }), _jsx("th", { className: "py-3 px-4 text-right text-slate-600", children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100 text-slate-700", children: filteredData.map((item) => (_jsxs("tr", { draggable: currentTable === 'products', onDragStart: currentTable === 'products' ? (e) => {
                                                e.dataTransfer.setData('text/plain', String(item.id));
                                                setDraggedProductId(String(item.id));
                                            } : undefined, onDragOver: currentTable === 'products' ? (e) => {
                                                e.preventDefault();
                                                if (dragOverProductId !== String(item.id))
                                                    setDragOverProductId(String(item.id));
                                            } : undefined, onDragLeave: currentTable === 'products' ? () => {
                                                if (dragOverProductId === String(item.id))
                                                    setDragOverProductId(null);
                                            } : undefined, onDrop: currentTable === 'products' ? (e) => {
                                                e.preventDefault();
                                                if (draggedProductId) {
                                                    handleProductReorder(draggedProductId, String(item.id));
                                                }
                                                setDraggedProductId(null);
                                                setDragOverProductId(null);
                                            } : undefined, onDragEnd: currentTable === 'products' ? () => {
                                                setDraggedProductId(null);
                                                setDragOverProductId(null);
                                            } : undefined, onClick: () => handleOpenDetail(item), className: `hover:bg-purple-50/40 cursor-pointer transition-colors group ${selectedIds.includes(String(item.id)) ? 'bg-purple-50/60' : ''} ${draggedProductId === String(item.id) ? 'opacity-40 bg-slate-100' : ''} ${dragOverProductId === String(item.id) ? 'border-t-2 border-purple-500 bg-purple-50' : ''}`, children: [_jsx("td", { className: "py-3 px-3 text-center w-10", onClick: (e) => e.stopPropagation(), children: _jsx("input", { type: "checkbox", checked: selectedIds.includes(String(item.id)), onChange: (e) => {
                                                            e.stopPropagation();
                                                            const sId = String(item.id);
                                                            if (e.target.checked) {
                                                                setSelectedIds((prev) => [...prev, sId]);
                                                            }
                                                            else {
                                                                setSelectedIds((prev) => prev.filter((id) => id !== sId));
                                                            }
                                                        }, "aria-label": `選択 ${item.id}`, className: "rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" }) }), currentTable === 'products' && (_jsx("td", { className: "py-3 px-2 text-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-purple-600", onClick: (e) => e.stopPropagation(), title: "\u30C9\u30E9\u30C3\u30B0\u3057\u3066\u4E26\u3073\u66FF\u3048", children: _jsx("div", { className: "flex items-center justify-center", children: _jsx(GripVertical, { className: "w-4 h-4" }) }) })), config.columnsToShow.map((colKey) => {
                                                    const val = item[colKey];
                                                    // 会社外部キーのレンダリング
                                                    if (colKey === 'company_id') {
                                                        return (_jsx("td", { className: "py-3 px-4", children: item.company?.company_name ? (_jsxs("div", { children: [_jsx("div", { className: "font-semibold text-slate-900 group-hover:text-purple-700", children: item.company.company_name }), _jsx("div", { className: "text-[10px] font-mono text-slate-400", children: item.company_id })] })) : (_jsx("span", { className: "font-mono text-slate-400", children: val || '-' })) }, colKey));
                                                    }
                                                    // 商品外部キーのレンダリング
                                                    if (colKey === 'product_id') {
                                                        const prod = item.product;
                                                        const priceStr = prod ? (prod.pricing_model === 'starting_at'
                                                            ? `最低月額: ¥${Number(prod.monthly_fee || prod.initial_fee || 0).toLocaleString()}〜 (商談で本決め)`
                                                            : prod.pricing_model === 'range'
                                                                ? `月額: ¥${Number(prod.monthly_fee || 0).toLocaleString()} 〜 ¥${Number(prod.price_range_max || 0).toLocaleString()}`
                                                                : prod.pricing_model === 'custom_quote'
                                                                    ? '個別見積・商談時決定'
                                                                    : `月額: ¥${Number(prod.monthly_fee || 0).toLocaleString()}`) : '';
                                                        return (_jsx("td", { className: "py-3 px-4", children: item.product?.product_name ? (_jsxs("div", { children: [_jsxs("div", { className: "font-semibold text-slate-900 flex items-center gap-1.5", children: [_jsx("span", { children: item.product.product_name }), prod?.pricing_model && prod.pricing_model !== 'fixed' && (_jsx("span", { className: "text-[10px] px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-purple-700 font-sans", children: "\u5546\u8AC7\u6642\u6C7A\u5B9A" }))] }), _jsx("div", { className: "text-[10px] text-slate-500 font-mono", children: priceStr })] })) : (_jsx("span", { className: "font-mono text-slate-400", children: val || '-' })) }, colKey));
                                                    }
                                                    // 料金体系（融通設定）セレクター
                                                    if (colKey === 'pricing_model') {
                                                        const model = String(val || 'fixed');
                                                        return (_jsx("td", { className: "py-2.5 px-4 whitespace-nowrap", onClick: (e) => e.stopPropagation(), children: _jsxs("div", { className: "relative inline-flex items-center", children: [_jsxs("select", { value: model, onChange: (e) => void handleQuickPricingModelChange(item, e.target.value), className: `appearance-none pl-2.5 pr-6 py-1 rounded-full text-[11px] font-medium border outline-none cursor-pointer transition-all ${model === 'starting_at'
                                                                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
                                                                            : model === 'range'
                                                                                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                                                                : model === 'custom_quote'
                                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`, title: "\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u6599\u91D1\u4F53\u7CFB\uFF08\u878D\u901A\u8A2D\u5B9A\uFF09\u3092\u76F4\u63A5\u5207\u308A\u66FF\u3048\u3089\u308C\u307E\u3059", children: [_jsx("option", { value: "fixed", children: "\u56FA\u5B9A\u4FA1\u683C" }), _jsx("option", { value: "starting_at", children: "\u6700\u4F4E\u4FA1\u683C\u301C\uFF08\u5546\u8AC7\u3067\u672C\u6C7A\u3081\uFF09" }), _jsx("option", { value: "range", children: "\u4FA1\u683C\u5E2F\uFF08\u5546\u8AC7\u3067\u672C\u6C7A\u3081\uFF09" }), _jsx("option", { value: "custom_quote", children: "\u500B\u5225\u898B\u7A4D\u30FB\u5546\u8AC7\u6642\u6C7A\u5B9A" })] }), _jsx("span", { className: "pointer-events-none absolute right-2 text-[8px] text-slate-400", children: "\u25BC" })] }) }, colKey));
                                                    }
                                                    // ステータスバッジ
                                                    if (['status', 'proposal_status', 'contract_status'].includes(colKey) && val) {
                                                        return (_jsx("td", { className: "py-3 px-4 whitespace-nowrap", children: _jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadgeClass(String(val))}`, children: String(val) }) }, colKey));
                                                    }
                                                    // 金額表示（税抜ベース + 税込自動表示）
                                                    if (['total_amount', 'monthly_fee', 'initial_fee', 'discount_amount'].includes(colKey)) {
                                                        if (val !== null && val !== undefined && val !== '' && !isNaN(Number(val))) {
                                                            const num = Number(val);
                                                            const withTax = Math.floor(num * 1.1);
                                                            const isStartingAt = item.pricing_model === 'starting_at';
                                                            const suffix = isStartingAt ? '〜' : '';
                                                            return (_jsxs("td", { className: "py-2.5 px-4 font-mono whitespace-nowrap", children: [_jsxs("div", { className: "text-slate-800 font-medium", children: ["\u00A5", num.toLocaleString(), suffix, " ", _jsx("span", { className: "text-[10px] text-slate-400 font-sans", children: "(\u7A0E\u629C)" })] }), _jsxs("div", { className: "text-xs text-purple-700 font-semibold", children: ["\u00A5", withTax.toLocaleString(), suffix, " ", _jsx("span", { className: "text-[10px] text-slate-400 font-sans", children: "(\u7A0E\u8FBC)" })] })] }, colKey));
                                                        }
                                                        return (_jsx("td", { className: "py-3 px-4 font-mono font-medium text-slate-400 whitespace-nowrap", children: "-" }, colKey));
                                                    }
                                                    // AIスコア表示
                                                    if (colKey === 'ai_score' && val !== null && val !== undefined) {
                                                        const scoreNum = Number(val);
                                                        return (_jsx("td", { className: "py-3 px-4 whitespace-nowrap", children: _jsxs("span", { className: `inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${scoreNum >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                    scoreNum >= 50 ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                                        'bg-slate-100 text-slate-600 border-slate-200'}`, children: [scoreNum, " \u70B9"] }) }, colKey));
                                                    }
                                                    // ID表示
                                                    if (colKey === 'id') {
                                                        return (_jsx("td", { className: "py-3 px-4 font-mono text-slate-400 font-semibold whitespace-nowrap", children: String(val) }, colKey));
                                                    }
                                                    // 会社名表示
                                                    if (colKey === 'company_name') {
                                                        return (_jsx("td", { className: "py-3 px-4 font-semibold text-slate-900 whitespace-nowrap", children: String(val || '-') }, colKey));
                                                    }
                                                    // 商談名表示
                                                    if (colKey === 'proposal_plan_name') {
                                                        return (_jsx("td", { className: "py-3 px-4 font-semibold text-slate-900 whitespace-nowrap", children: String(val || '-') }, colKey));
                                                    }
                                                    // 日付・日時表示
                                                    if (['last_contacted_at', 'registered_at', 'contract_start_date', 'last_updated_at', 'meeting_date', 'proposal_date', 'next_followup_at', 'last_reply_at', 'first_registered_at', 'next_action_at', 'email_step_started_at', 'created_at'].includes(colKey) && val) {
                                                        const formattedDate = String(val).includes('T') ? String(val).split('T')[0] : String(val);
                                                        return (_jsx("td", { className: "py-3 px-4 font-mono text-slate-500 whitespace-nowrap", children: formattedDate }, colKey));
                                                    }
                                                    return (_jsx("td", { className: "py-3 px-4 max-w-[200px] truncate text-slate-700", children: val !== null && val !== undefined ? String(val) : '-' }, colKey));
                                                }), _jsx("td", { className: "py-3 px-4 text-right whitespace-nowrap", onClick: (e) => e.stopPropagation(), children: _jsxs("div", { className: "flex items-center justify-end gap-1.5", children: [['prospects', 'leads', 'deals', 'customers'].includes(currentTable) && item.company_id && onOpenCustomerWorkspace && (_jsxs("button", { onClick: () => handleOpenRecordSend(item), className: "px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 flex items-center gap-1 transition-colors", title: "\u3053\u306E\u4F1A\u793E\u306E\u9023\u7D61\u5148\u3092\u9078\u3093\u3067\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC\u3092\u958B\u304F", children: [_jsx(Send, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u9023\u7D61\u30FB\u914D\u4FE1" })] })), currentTable === 'prospects' && (_jsxs("button", { onClick: () => handleOpenTransition('prospect_to_lead', item), className: "px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white border border-cyan-200 flex items-center gap-1 transition-colors", title: "\u898B\u8FBC\u307F\u4F01\u696D\u304B\u3089\u30EA\u30FC\u30C9\u3078\u9032\u3081\u308B", children: [_jsx(Layers, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u30EA\u30FC\u30C9\u3078\u9032\u3081\u308B" })] })), currentTable === 'leads' && (_jsxs("button", { onClick: () => handleOpenTransition('lead_to_deal', item), className: "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 flex items-center gap-1 transition-colors", title: "\u30EA\u30FC\u30C9\u304B\u3089\u5546\u8AC7\u3092\u4F5C\u6210\u3059\u308B", children: [_jsx(Briefcase, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u5546\u8AC7\u3092\u4F5C\u6210" })] })), currentTable === 'deals' && (_jsxs("button", { onClick: () => handleOpenTransition('deal_to_customer', item), className: "px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white border border-pink-200 flex items-center gap-1 transition-colors", title: "\u5546\u8AC7\u304B\u3089\u9867\u5BA2\u3068\u3057\u3066\u767B\u9332\u3059\u308B", children: [_jsx(UserCheck, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u9867\u5BA2\u3068\u3057\u3066\u767B\u9332" })] })), _jsx("button", { onClick: () => handleOpenDetail(item), className: "p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors", title: "\u8A73\u7D30\u3092\u898B\u308B", children: _jsx(Eye, { className: "w-3.5 h-3.5" }) }), _jsx("button", { onClick: () => handleOpenEdit(item), className: "p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors", title: "\u7DE8\u96C6\u3059\u308B", children: _jsx(Edit3, { className: "w-3.5 h-3.5" }) }), _jsx(InlineDeleteButton, { onConfirm: () => void handleDeleteRecord(item), disabled: deletingRecordId === String(item.id), warning: "\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F\u95A2\u9023\u30C7\u30FC\u30BF\u304B\u3089\u53C2\u7167\u3055\u308C\u3066\u3044\u308B\u5834\u5408\u306F\u524A\u9664\u3067\u304D\u307E\u305B\u3093\u3002", className: "p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50", ariaLabel: "\u524A\u9664\uFF08\u95A2\u9023\u30C7\u30FC\u30BF\u304C\u3042\u308B\u5834\u5408\u306F\u4FDD\u8B77\u3055\u308C\u307E\u3059\uFF09", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }) })] }, item.id))) })] }) }) }), _jsx("div", { className: "grid grid-cols-1 gap-3 md:hidden", children: filteredData.map((item) => (_jsxs("div", { draggable: currentTable === 'products', onDragStart: currentTable === 'products' ? (e) => {
                                e.dataTransfer.setData('text/plain', String(item.id));
                                setDraggedProductId(String(item.id));
                            } : undefined, onDragOver: currentTable === 'products' ? (e) => {
                                e.preventDefault();
                                if (dragOverProductId !== String(item.id))
                                    setDragOverProductId(String(item.id));
                            } : undefined, onDragLeave: currentTable === 'products' ? () => {
                                if (dragOverProductId === String(item.id))
                                    setDragOverProductId(null);
                            } : undefined, onDrop: currentTable === 'products' ? (e) => {
                                e.preventDefault();
                                if (draggedProductId) {
                                    handleProductReorder(draggedProductId, String(item.id));
                                }
                                setDraggedProductId(null);
                                setDragOverProductId(null);
                            } : undefined, onDragEnd: currentTable === 'products' ? () => {
                                setDraggedProductId(null);
                                setDragOverProductId(null);
                            } : undefined, onClick: () => handleOpenDetail(item), className: `bg-white border border-slate-200 rounded-xl p-4 space-y-3 cursor-pointer hover:border-purple-200 hover:shadow-xs transition-all ${draggedProductId === String(item.id) ? 'opacity-40 bg-slate-50' : ''} ${dragOverProductId === String(item.id) ? 'border-t-2 border-purple-500 bg-purple-50' : ''}`, children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start gap-2", children: [currentTable === 'products' && (_jsx("div", { className: "cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-purple-600 shrink-0 mt-0.5", onClick: (e) => e.stopPropagation(), title: "\u30C9\u30E9\u30C3\u30B0\u3067\u4E26\u3073\u66FF\u3048", children: _jsx(GripVertical, { className: "w-4 h-4" }) })), _jsxs("div", { children: [_jsxs("span", { className: "text-[11px] font-mono text-slate-400", children: ["ID: ", item.id] }), _jsx("h3", { className: "font-bold text-slate-900 text-sm", children: item.company_name ||
                                                                item.proposal_plan_name ||
                                                                item.product_name ||
                                                                item.company?.company_name ||
                                                                `レコード #${item.id}` })] })] }), (item.status || item.proposal_status || item.contract_status) && (_jsx("span", { className: `px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadgeClass(String(item.status || item.proposal_status || item.contract_status))}`, children: item.status || item.proposal_status || item.contract_status })), _jsx(InlineDeleteButton, { onConfirm: () => void handleDeleteRecord(item), disabled: deletingRecordId === String(item.id), className: "mt-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50", ariaLabel: "\u524A\u9664", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "space-y-1 text-xs text-slate-500", children: [item.company_id && (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Building2, { className: "w-3.5 h-3.5 text-purple-600 shrink-0" }), _jsxs("span", { children: ["\u4F1A\u793E: ", item.company?.company_name || item.company_id] })] })), item.total_amount && (_jsxs("div", { className: "font-mono text-xs", children: [_jsxs("span", { className: "text-slate-700", children: ["\u7A0E\u629C: \u00A5", Number(item.total_amount).toLocaleString()] }), _jsxs("span", { className: "ml-2 font-semibold text-purple-700", children: ["\u7A0E\u8FBC: \u00A5", Math.floor(Number(item.total_amount) * 1.1).toLocaleString()] })] })), item.monthly_fee && (_jsxs("div", { className: "font-mono text-xs", children: [_jsxs("span", { className: "text-slate-600", children: ["\u6708\u984D\uFF08\u7A0E\u629C\uFF09: \u00A5", Number(item.monthly_fee).toLocaleString(), item.pricing_model === 'starting_at' ? '〜' : ''] }), _jsxs("span", { className: "ml-2 text-purple-700 font-semibold", children: ["\uFF08\u7A0E\u8FBC \u00A5", Math.floor(Number(item.monthly_fee) * 1.1).toLocaleString(), item.pricing_model === 'starting_at' ? '〜' : '', "\uFF09"] })] })), currentTable === 'products' && (_jsxs("div", { className: "flex items-center gap-2 pt-1", onClick: (e) => e.stopPropagation(), children: [_jsx("span", { className: "text-[11px] text-slate-500", children: "\u6599\u91D1\u4F53\u7CFB:" }), _jsxs("select", { value: String(item.pricing_model || 'fixed'), onChange: (e) => void handleQuickPricingModelChange(item, e.target.value), className: "text-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 outline-none", children: [_jsx("option", { value: "fixed", children: "\u56FA\u5B9A\u4FA1\u683C" }), _jsx("option", { value: "starting_at", children: "\u6700\u4F4E\u4FA1\u683C\u301C\uFF08\u5546\u8AC7\u3067\u672C\u6C7A\u3081\uFF09" }), _jsx("option", { value: "range", children: "\u4FA1\u683C\u5E2F\uFF08\u5546\u8AC7\u3067\u672C\u6C7A\u3081\uFF09" }), _jsx("option", { value: "custom_quote", children: "\u500B\u5225\u898B\u7A4D\u30FB\u5546\u8AC7\u6642\u6C7A\u5B9A" })] })] })), item.ai_score !== undefined && item.ai_score !== null && (_jsxs("div", { className: "font-mono text-purple-700 font-semibold", children: ["AI\u78BA\u5EA6\u30B9\u30B3\u30A2: ", item.ai_score, " \u70B9"] })), item.contact_name && (_jsxs("div", { children: ["\u62C5\u5F53: ", item.contact_name] }))] }), _jsxs("div", { className: "pt-2 border-t border-slate-100 flex items-center justify-between text-xs", onClick: (e) => e.stopPropagation(), children: [_jsx("span", { className: "text-slate-400 text-[11px]", children: "\u30BF\u30C3\u30D7\u3057\u3066\u8A73\u7D30\u78BA\u8A8D" }), _jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [['prospects', 'leads', 'deals', 'customers'].includes(currentTable) && item.company_id && onOpenCustomerWorkspace && (_jsxs("button", { onClick: () => handleOpenRecordSend(item), className: "px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200 flex items-center gap-1 text-[11px] font-semibold", children: [_jsx(Send, { className: "w-3 h-3" }), _jsx("span", { children: "\u9023\u7D61\u30FB\u914D\u4FE1" })] })), currentTable === 'prospects' && (_jsxs("button", { onClick: () => handleOpenTransition('prospect_to_lead', item), className: "px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white border border-cyan-200 flex items-center gap-1 text-[11px] font-semibold", children: [_jsx(Layers, { className: "w-3 h-3" }), _jsx("span", { children: "\u30EA\u30FC\u30C9\u3078\u9032\u3081\u308B" })] })), currentTable === 'leads' && (_jsxs("button", { onClick: () => handleOpenTransition('lead_to_deal', item), className: "px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 flex items-center gap-1 text-[11px] font-semibold", children: [_jsx(Briefcase, { className: "w-3 h-3" }), _jsx("span", { children: "\u5546\u8AC7\u3092\u4F5C\u6210" })] })), currentTable === 'deals' && (_jsxs("button", { onClick: () => handleOpenTransition('deal_to_customer', item), className: "px-2 py-1 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white border border-pink-200 flex items-center gap-1 text-[11px] font-semibold", children: [_jsx(UserCheck, { className: "w-3 h-3" }), _jsx("span", { children: "\u9867\u5BA2\u3068\u3057\u3066\u767B\u9332" })] })), _jsxs("button", { onClick: () => handleOpenEdit(item), className: "px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-1 transition-colors", children: [_jsx(Edit3, { className: "w-3 h-3" }), _jsx("span", { children: "\u7DE8\u96C6" })] })] })] })] }, item.id))) })] })), isDetailOpen && (_jsx(RecordDetailModal, { tableKey: currentTable, record: selectedRecord, onClose: () => setIsDetailOpen(false), onEdit: (record) => {
                    setIsDetailOpen(false);
                    handleOpenEdit(record);
                }, onTransitionStage: handleOpenTransition, onOpenCustomerWorkspace: onOpenCustomerWorkspace })), isFormOpen && (_jsx(RecordFormModal, { isOpen: isFormOpen, tableKey: currentTable, editRecord: editRecord, onClose: () => setIsFormOpen(false), onSuccess: () => {
                    loadData();
                } })), isProspectImportOpen && currentTable === 'prospects' && (_jsx(ProspectResearchImportModal, { onClose: () => setIsProspectImportOpen(false), onImported: () => { void loadData(); } })), transitionOpen && (_jsx(StageTransitionModal, { isOpen: transitionOpen, type: transitionType, sourceRecord: transitionSourceRecord, onClose: () => setTransitionOpen(false), onSuccess: handleTransitionSuccess, onViewExistingCustomer: handleViewExistingCustomer })), selectedIds.length > 0 && (_jsxs("div", { className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-fade-in border border-slate-700", children: [_jsxs("div", { className: "text-xs font-semibold", children: [_jsx("span", { className: "text-purple-400 font-bold", children: selectedIds.length }), " \u4EF6\u3092\u9078\u629E\u4E2D"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: handleBulkDelete, disabled: isBulkDeleting, className: "px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50", children: [_jsx(Trash2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: isBulkDeleting ? '削除中...' : '選択したレコードを一括削除' })] }), _jsx("button", { onClick: () => setSelectedIds([]), className: "px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer", children: "\u9078\u629E\u89E3\u9664" })] })] })), isCleanDummyModalOpen && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in", children: _jsxs("div", { className: "bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between pb-3 border-b border-slate-100", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0", children: _jsx(Trash2, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-slate-900 text-base", children: "\u30C0\u30DF\u30FC\u30FB\u30C6\u30B9\u30C8\u30C7\u30FC\u30BF\u306E\u4E00\u62EC\u6574\u7406" }), _jsx("p", { className: "text-xs text-slate-500", children: "\u5916\u90E8\u30AD\u30FC\u5236\u7D04\u3092\u8003\u616E\u3057\u3001\u4F9D\u5B58\u95A2\u4FC2\u306E\u6DF1\u3044\u9806\u306B\u5B89\u5168\u306B\u4E00\u62EC\u524A\u9664\u3057\u307E\u3059" })] })] }), _jsx("button", { onClick: () => setIsCleanDummyModalOpen(false), className: "text-slate-400 hover:text-slate-600 p-1 cursor-pointer", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-2 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200", children: [_jsx("p", { className: "font-semibold text-slate-800 mb-1", children: "\u524A\u9664\u3059\u308B\u5BFE\u8C61\u30AB\u30C6\u30B4\u30EA\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\uFF1A" }), [
                                    { key: 'prospects', label: '見込み企業リスト (prospects)' },
                                    { key: 'leads', label: 'リード・反響一覧 (leads)' },
                                    { key: 'deals', label: '商談パイプライン (deals)' },
                                    { key: 'customers', label: '顧客・契約・請求書・送付書類 (customers, contracts, invoices)' },
                                    { key: 'companies', label: '法人マスタ・連絡先 (companies, contacts)' },
                                ].map((item) => (_jsxs("label", { className: "flex items-center gap-2.5 p-1.5 hover:bg-white rounded cursor-pointer transition", children: [_jsx("input", { type: "checkbox", checked: cleanDummyTargets.includes(item.key), onChange: (e) => {
                                                if (e.target.checked) {
                                                    setCleanDummyTargets([...cleanDummyTargets, item.key]);
                                                }
                                                else {
                                                    setCleanDummyTargets(cleanDummyTargets.filter((k) => k !== item.key));
                                                }
                                            }, className: "rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" }), _jsx("span", { className: "font-medium text-slate-800", children: item.label })] }, item.key))), _jsx("div", { className: "text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-2", children: "\u203B \u300C\u5546\u54C1\u30DE\u30B9\u30BF\u300D\u3084\u300CLINE\u8A2D\u5B9A\u30FB\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u300D\u306F\u4FDD\u8B77\u3055\u308C\u524A\u9664\u3055\u308C\u307E\u305B\u3093\u3002" })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-2", children: [_jsx("button", { onClick: () => setIsCleanDummyModalOpen(false), disabled: isCleaningDummy, className: "px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { onClick: handleExecuteCleanDummy, disabled: isCleaningDummy || cleanDummyTargets.length === 0, className: "px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs disabled:opacity-50", children: isCleaningDummy ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "w-3.5 h-3.5 animate-spin" }), _jsx("span", { children: "\u6574\u7406\u5B9F\u884C\u4E2D..." })] })) : (_jsxs(_Fragment, { children: [_jsx(Trash2, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u9078\u629E\u30AB\u30C6\u30B4\u30EA\u3092\u4E00\u62EC\u524A\u9664" })] })) })] })] }) }))] }));
};
