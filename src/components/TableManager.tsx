import React, { useState, useEffect } from 'react';
import { TableKey, TABLE_CONFIGS } from '../types/database';
import { fetchTableData, DataFetchError } from '../services/dataService';
import { RecordDetailModal } from './RecordDetailModal';
import { RecordFormModal } from './RecordFormModal';
import { StageTransitionModal, TransitionType } from './StageTransitionModal';
import { ProspectResearchImportModal } from './ProspectResearchImportModal';
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
  Check
} from 'lucide-react';

interface TableManagerProps {
  currentTable: TableKey;
  onTableChange: (table: TableKey) => void;
  onOpenRls: () => void;
  onOpenCreateTrigger?: boolean;
  onStageTransitionTask?: (event: { transitionType: TransitionType; sourceRecord: any; targetTable: 'leads' | 'deals' | 'customers'; targetRecordId?: string | number }) => void;
  onOpenCustomerWorkspace?: (companyId: string, destination: 'documents' | 'operations' | 'diagnoses' | 'forms', recordContext?: { tableKey: TableKey; recordId: string; leadId?: string }) => void;
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
  const [isProspectImportOpen, setIsProspectImportOpen] = useState(false);

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any | null>(null);

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
        setData(tableData);
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

  useEffect(() => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSelectedRecord(null);
    setIsDetailOpen(false);
    setIsFormOpen(false);
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

  // ステータス列のユニーク候補を取得（フィルタ用）
  const statusOptions = Array.from(
    new Set(
      data
        .map((d) => d.status || d.proposal_status || d.contract_status)
        .filter(Boolean)
    )
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Table Selector Sub-Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {config.label}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              {config.name}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{config.description}</p>
        </div>

        {/* Action Button: 新規登録 */}
        <div className="flex items-center gap-2">
          {currentTable === 'prospects' && (
            <button
              onClick={() => setIsProspectImportOpen(true)}
              className="px-3 py-2.5 rounded-xl font-bold text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 flex items-center gap-2 transition-colors"
            >
              <span>見込み企業調査</span>
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            title="再読み込み"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{config.label}を新規登録</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Keyword Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${config.label}内のキーワード、会社名、担当者、IDなどを検索...`}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 focus:border-blue-500 text-slate-200 text-xs placeholder:text-slate-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
            >
              クリア
            </button>
          )}
        </div>

        {/* Status Dropdown Filter (if available) */}
        {statusOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">状態絞込:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-xs outline-none focus:border-blue-500"
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
        <div className="text-xs text-slate-400 self-center whitespace-nowrap px-2">
          表示: <strong className="text-white font-mono">{filteredData.length}</strong> / {data.length} 件
        </div>
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
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
          <p className="text-sm font-semibold text-slate-300">
            {config.label}のデータを読み込み中...
          </p>
          <p className="text-xs text-slate-500">Supabaseデータベースと通信しています</p>
        </div>
      )}

      {/* 2. Error State: 権限不足 (RLS / 401 / 403 / 42501) */}
      {!loading && error && error.type === 'PERMISSION_DENIED' && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-3xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-amber-300">
              権限不足（Row Level Security: RLS ポリシー）
            </h3>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              テーブル <code>{currentTable}</code> に対するアクセス権限がSupabase側で許可されていません。
              社内認証ユーザー（authenticated）に対して SELECT/INSERT/UPDATE ポリシーを設定してください。
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onOpenRls}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <FileCode2 className="w-4 h-4" />
              <span>RLS推奨SQLを確認して適用する</span>
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            >
              再試行
            </button>
          </div>
        </div>
      )}

      {/* 3. Error State: 接続エラー / スキーマ不一致 */}
      {!loading && error && error.type !== 'PERMISSION_DENIED' && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-3xl p-8 text-center space-y-4 max-w-2xl mx-auto shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-rose-300">
              {error.type === 'CONNECTION_ERROR' ? '接続エラー' : 'データ取得エラー'}
            </h3>
            <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
              {error.message}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>再試行する</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Empty State (0件) */}
      {!loading && !error && filteredData.length === 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-300">
              {searchQuery ? '検索条件に一致するレコードがありません' : `${config.label}のレコードはまだありません`}
            </h3>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'キーワードを変更して再度お試しください。' : '「新規登録」ボタンから最初のレコードを登録してください。'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{config.label}を新規登録する</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Data View: Table on Desktop, Cards on Mobile */}
      {!loading && !error && filteredData.length > 0 && (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    {config.columnsToShow.map((colKey) => {
                      const fieldDef = config.fields.find((f) => f.key === colKey);
                      const label = fieldDef?.label || colKey;
                      return (
                        <th key={colKey} className="py-3 px-4 whitespace-nowrap">
                          {label}
                        </th>
                      );
                    })}
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredData.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenDetail(item)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {config.columnsToShow.map((colKey) => {
                        const val = item[colKey];

                        // 会社外部キーのレンダリング
                        if (colKey === 'company_id') {
                          return (
                            <td key={colKey} className="py-3 px-4">
                              {item.company?.company_name ? (
                                <div>
                                  <div className="font-bold text-blue-300 group-hover:text-blue-200">
                                    {item.company.company_name}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    {item.company_id}
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono text-slate-400">{val || '-'}</span>
                              )}
                            </td>
                          );
                        }

                        // 商品外部キーのレンダリング
                        if (colKey === 'product_id') {
                          return (
                            <td key={colKey} className="py-3 px-4">
                              {item.product?.product_name ? (
                                <div>
                                  <div className="font-semibold text-purple-300">
                                    {item.product.product_name}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    月額: ¥{Number(item.product.monthly_fee || 0).toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono text-slate-400">{val || '-'}</span>
                              )}
                            </td>
                          );
                        }

                        // ステータスバッジ
                        if (['status', 'proposal_status', 'contract_status'].includes(colKey) && val) {
                          return (
                            <td key={colKey} className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                {String(val)}
                              </span>
                            </td>
                          );
                        }

                        // 金額表示
                        if (['total_amount', 'monthly_fee', 'initial_fee', 'discount_amount'].includes(colKey)) {
                          return (
                            <td key={colKey} className="py-3 px-4 font-mono font-medium text-emerald-300 whitespace-nowrap">
                              {val !== null && val !== undefined ? `¥${Number(val).toLocaleString()}` : '-'}
                            </td>
                          );
                        }

                        // AIスコア表示
                        if (colKey === 'ai_score' && val !== null && val !== undefined) {
                          const scoreNum = Number(val);
                          return (
                            <td key={colKey} className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                                scoreNum >= 75 ? 'bg-emerald-500/20 text-emerald-300' :
                                scoreNum >= 50 ? 'bg-blue-500/20 text-blue-300' :
                                'bg-slate-800 text-slate-400'
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
                            <td key={colKey} className="py-3 px-4 font-bold text-white whitespace-nowrap">
                              {String(val || '-')}
                            </td>
                          );
                        }

                        // 商談名表示
                        if (colKey === 'proposal_plan_name') {
                          return (
                            <td key={colKey} className="py-3 px-4 font-bold text-white whitespace-nowrap">
                              {String(val || '-')}
                            </td>
                          );
                        }

                        // 日付・日時表示
                        if (['last_contacted_at', 'registered_at', 'contract_start_date', 'last_updated_at', 'meeting_date', 'proposal_date', 'next_followup_at', 'last_reply_at', 'first_registered_at', 'next_action_at', 'email_step_started_at', 'created_at'].includes(colKey) && val) {
                          const formattedDate = String(val).includes('T') ? String(val).split('T')[0] : String(val);
                          return (
                            <td key={colKey} className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                              {formattedDate}
                            </td>
                          );
                        }

                        return (
                          <td key={colKey} className="py-3 px-4 max-w-[200px] truncate">
                            {val !== null && val !== undefined ? String(val) : '-'}
                          </td>
                        );
                      })}

                      {/* Row Actions (View, Stage Progression & Edit, STRICTLY NO DELETE) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {currentTable === 'prospects' && (
                            <button
                              onClick={() => handleOpenTransition('prospect_to_lead', item)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600 hover:text-white border border-cyan-500/30 flex items-center gap-1 transition-colors"
                              title="見込み企業からリードへ進める"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>リードへ進める</span>
                            </button>
                          )}
                          {currentTable === 'leads' && (
                            <button
                              onClick={() => handleOpenTransition('lead_to_deal', item)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 flex items-center gap-1 transition-colors"
                              title="リードから商談を作成する"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                              <span>商談を作成</span>
                            </button>
                          )}
                          {currentTable === 'deals' && (
                            <button
                              onClick={() => handleOpenTransition('deal_to_customer', item)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-600/20 text-pink-300 hover:bg-pink-600 hover:text-white border border-pink-500/30 flex items-center gap-1 transition-colors"
                              title="商談から顧客として登録する"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>顧客として登録</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="詳細を見る"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition-colors"
                            title="編集する"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
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
                onClick={() => handleOpenDetail(item)}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 cursor-pointer hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-slate-500">ID: {item.id}</span>
                    <h3 className="font-bold text-white text-sm">
                      {item.company_name ||
                        item.proposal_plan_name ||
                        item.product_name ||
                        item.company?.company_name ||
                        `レコード #${item.id}`}
                    </h3>
                  </div>
                  {(item.status || item.proposal_status || item.contract_status) && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {item.status || item.proposal_status || item.contract_status}
                    </span>
                  )}
                </div>

                {/* Sub details */}
                <div className="space-y-1 text-xs text-slate-400">
                  {item.company_id && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>会社: {item.company?.company_name || item.company_id}</span>
                    </div>
                  )}
                  {item.total_amount && (
                    <div className="font-mono text-emerald-300 font-semibold">
                      想定総額: ¥{Number(item.total_amount).toLocaleString()}
                    </div>
                  )}
                  {item.monthly_fee && (
                    <div className="font-mono text-emerald-300">
                      月額: ¥{Number(item.monthly_fee).toLocaleString()}
                    </div>
                  )}
                  {item.ai_score !== undefined && item.ai_score !== null && (
                    <div className="font-mono text-blue-300">
                      AI確度スコア: {item.ai_score} 点
                    </div>
                  )}
                  {item.contact_name && (
                    <div>担当: {item.contact_name}</div>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-slate-500 text-[11px]">タップして詳細確認</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {currentTable === 'prospects' && (
                      <button
                        onClick={() => handleOpenTransition('prospect_to_lead', item)}
                        className="px-2 py-1 rounded-lg bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600 hover:text-white border border-cyan-500/30 flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <Layers className="w-3 h-3" />
                        <span>リードへ進める</span>
                      </button>
                    )}
                    {currentTable === 'leads' && (
                      <button
                        onClick={() => handleOpenTransition('lead_to_deal', item)}
                        className="px-2 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <Briefcase className="w-3 h-3" />
                        <span>商談を作成</span>
                      </button>
                    )}
                    {currentTable === 'deals' && (
                      <button
                        onClick={() => handleOpenTransition('deal_to_customer', item)}
                        className="px-2 py-1 rounded-lg bg-pink-600/20 text-pink-300 hover:bg-pink-600 hover:text-white border border-pink-500/30 flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>顧客として登録</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1"
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
    </div>
  );
};
