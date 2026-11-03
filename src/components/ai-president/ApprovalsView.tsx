import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  User,
  Filter,
  Check,
  X,
  FileText,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { ApprovalItem, ActivityLog, TaskItem } from '../types';

interface ApprovalsViewProps {
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  onResolveApproval: (id: string, status: 'approved' | 'rejected', note?: string) => void;
  onDeleteApproval?: (id: string) => void;
  onClearApprovals?: (statusFilter?: 'pending' | 'approved' | 'rejected' | 'all') => void;
  onDeleteActivityLog?: (id: string) => void;
  onClearActivityLogs?: () => void;
  initialTab?: 'approvals' | 'logs';
  embedded?: boolean;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  tasks,
  approvals,
  activityLogs,
  onResolveApproval,
  onDeleteApproval,
  onClearApprovals,
  onDeleteActivityLog,
  onClearActivityLogs,
  initialTab = 'approvals',
  embedded = false,
}) => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'logs'>(initialTab);
  useEffect(() => setActiveTab(initialTab), [initialTab]);
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});

  // Deletion modals state
  const [approvalToDelete, setApprovalToDelete] = useState<ApprovalItem | null>(null);
  const [batchDeleteType, setBatchDeleteType] = useState<'all' | 'rejected' | 'approved' | 'pending' | null>(null);
  const [isClearingLogsModalOpen, setIsClearingLogsModalOpen] = useState(false);

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;
  const approvedApprovalsCount = approvals.filter((a) => a.status === 'approved').length;
  const rejectedApprovalsCount = approvals.filter((a) => a.status === 'rejected').length;

  const filteredApprovals = approvals.filter((a) => {
    if (approvalFilter === 'all') return true;
    return a.status === approvalFilter;
  });

  const handleResolve = (id: string, status: 'approved' | 'rejected') => {
    const note = resolutionNote[id] || '';
    onResolveApproval(id, status, note);
  };

  const confirmDeleteSingleApproval = () => {
    if (!approvalToDelete || !onDeleteApproval) return;
    onDeleteApproval(approvalToDelete.id);
    setApprovalToDelete(null);
  };

  const confirmBatchDeleteApprovals = () => {
    if (!batchDeleteType || !onClearApprovals) return;
    onClearApprovals(batchDeleteType);
    setBatchDeleteType(null);
  };

  const confirmClearAllLogs = () => {
    if (!onClearActivityLogs) return;
    onClearActivityLogs();
    setIsClearingLogsModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {!embedded && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">承認・活動履歴</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                人間の判断・意思決定が必要な承認待ち項目と、アプリ内で実際に起きた操作の監査ログ
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'approvals'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              承認管理 ({pendingApprovalsCount}件待ち)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              活動・監査ログ ({activityLogs.length}件)
            </button>
          </div>
        </div>
      )}

      {/* Tab: Approvals */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {/* Sub filter & Batch Delete Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: `すべて (${approvals.length})` },
                { id: 'pending', label: `確認待ち (${pendingApprovalsCount})` },
                { id: 'approved', label: `承認済み (${approvedApprovalsCount})` },
                { id: 'rejected', label: `却下 (${rejectedApprovalsCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setApprovalFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    approvalFilter === f.id
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {onClearApprovals && approvals.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                {pendingApprovalsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchDeleteType('pending')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer shadow-2xs"
                    title="確認待ちの承認申請を一括削除"
                  >
                    <Trash2 className="w-3 h-3 text-amber-600" />
                    <span>確認待ちを一括削除 ({pendingApprovalsCount})</span>
                  </button>
                )}
                {rejectedApprovalsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchDeleteType('rejected')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                    title="却下された承認履歴を一括削除"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>却下済みを全削除 ({rejectedApprovalsCount})</span>
                  </button>
                )}
                {approvedApprovalsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchDeleteType('approved')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                    title="承認済みの履歴を一括削除"
                  >
                    <Trash2 className="w-3 h-3 text-slate-400" />
                    <span>承認済みを全削除 ({approvedApprovalsCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBatchDeleteType(approvalFilter === 'all' ? 'all' : (approvalFilter as any))}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
                  title="表示中の承認項目を一括削除"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{approvalFilter === 'all' ? '承認全件クリア' : '表示中を一括削除'}</span>
                </button>
              </div>
            )}
          </div>

          {filteredApprovals.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-2 shadow-xs">
              <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">表示できる承認項目がありません</h3>
              <p className="text-xs text-slate-500">
                タスク管理画面から承認待ちへ遷移したタスクや、承認申請がここに表示されます。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApprovals.map((item) => {
                const relatedTask = item.taskId ? tasks.find((task) => task.id === item.taskId) : undefined;
                const reviewArtifact = item.reviewArtifact || relatedTask?.draftArtifact;
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs group hover:border-purple-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.status === 'pending' && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3 h-3" /> 確認待ち
                          </span>
                        )}
                        {item.status === 'approved' && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> 承認済み
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> 却下
                          </span>
                        )}

                        <span className="text-xs font-bold text-slate-900">{item.actionTitle}</span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <div className="text-[11px] text-slate-400">
                          申請日時: {new Date(item.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {onDeleteApproval && (
                          <button
                            type="button"
                            onClick={() => setApprovalToDelete(item)}
                            title="この承認履歴を削除"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 block text-[11px]">対象タスク</span>
                        <span className="font-semibold text-slate-800">{item.taskTitle}</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">申請者: {item.requestedBy}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">申請理由・背景</span>
                        <p className="text-slate-700 mt-0.5">{item.reason}</p>
                      </div>
                    </div>

                    {/* Review Artifact / Draft */}
                    {reviewArtifact && (
                      <div className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-purple-900 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-purple-600" />
                            AI作成ドラフト / 成果物確認
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                            {reviewArtifact.category}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{reviewArtifact.title}</h4>
                        <div className="max-h-40 overflow-y-auto p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap">
                          {reviewArtifact.content}
                        </div>
                      </div>
                    )}

                    {/* Resolution Form or Status Record */}
                    {item.status === 'pending' ? (
                      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
                        <input
                          type="text"
                          placeholder="承認・却下時の判断メモ（任意）"
                          value={resolutionNote[item.id] || ''}
                          onChange={(e) =>
                            setResolutionNote({ ...resolutionNote, [item.id]: e.target.value })
                          }
                          className="flex-1 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs"
                        />
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResolve(item.id, 'approved')}
                            className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>承認する</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolve(item.id, 'rejected')}
                            className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>却下する</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div>
                          判断日時: {new Date(item.resolvedAt || item.createdAt).toLocaleString('ja-JP')}
                          {item.resolutionNote && (
                            <span className="ml-2 font-medium text-slate-700">「{item.resolutionNote}」</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Activity className="w-4 h-4 text-purple-600" />
              <span>全 {activityLogs.length} 件のシステム活動記録</span>
            </div>
            {onClearActivityLogs && activityLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearingLogsModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3 h-3" />
                <span>ログ全件クリア</span>
              </button>
            )}
          </div>

          {activityLogs.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-2 shadow-xs">
              <Activity className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">活動ログがありません</h3>
              <p className="text-xs text-slate-500">
                AI社長によるタスク実行や、ユーザーの操作記録がここに時系列で残ります。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-start gap-3 shadow-2xs group hover:border-purple-200 transition-all"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-900">{log.actor}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString('ja-JP')}
                        </span>
                        {onDeleteActivityLog && (
                          <button
                            type="button"
                            onClick={() => onDeleteActivityLog(log.id)}
                            title="この履歴を削除"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-700 text-xs leading-relaxed">{log.summary}</p>
                    {log.details && (
                      <p className="text-[11px] text-slate-500 mt-1 font-mono bg-slate-50 p-1.5 rounded border border-slate-200">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Single Approval Modal */}
      {approvalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">承認項目の削除</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <p>以下の承認項目を削除しますか？</p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">{approvalToDelete.actionTitle}</div>
                <div className="text-slate-500">対象: {approvalToDelete.taskTitle}</div>
                <div className="text-slate-500">状態: {
                  approvalToDelete.status === 'pending'
                    ? '確認待ち（削除すると紐づくタスクは進行中に戻ります）'
                    : approvalToDelete.status === 'rejected'
                    ? '却下済み'
                    : '承認済み'
                }</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovalToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingleApproval}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Approvals Modal */}
      {batchDeleteType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {batchDeleteType === 'rejected'
                  ? '却下項目の全削除'
                  : batchDeleteType === 'approved'
                  ? '承認済み項目の全削除'
                  : batchDeleteType === 'pending'
                  ? '確認待ち項目の全削除'
                  : '承認項目の全件クリア'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {batchDeleteType === 'rejected' && `却下済みの承認項目（全${rejectedApprovalsCount}件）を一括削除します。`}
              {batchDeleteType === 'approved' && `承認済みの項目（全${approvedApprovalsCount}件）を一括削除します。`}
              {batchDeleteType === 'pending' && `確認待ちの項目（全${pendingApprovalsCount}件）を一括削除します。関連するタスクは「進行中」に戻ります。`}
              {batchDeleteType === 'all' && `記録されているすべての承認項目（全${approvals.length}件）を削除します。確認待ちタスクは「進行中」に戻ります。`}
              <br />
              この操作は取り消せません。実行しますか？
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBatchDeleteType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmBatchDeleteApprovals}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer"
              >
                一括削除を実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Logs Modal */}
      {isClearingLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">活動・監査ログの全削除</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              記録されているすべての活動履歴ログ（全{activityLogs.length}件）を完全にクリアします。
              <br />
              この操作は取り消せません。本当に削除しますか？
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClearingLogsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmClearAllLogs}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer"
              >
                すべての履歴を削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
