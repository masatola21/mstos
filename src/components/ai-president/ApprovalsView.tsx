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
import { ApprovalItem, ActivityLog, ApprovalStatus, TaskItem } from '../types';

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white">承認・活動履歴</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                人間の判断・意思決定が必要な承認待ち項目と、アプリ内で実際に起きた操作の監査ログ
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('approvals')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'approvals'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              承認管理 ({pendingApprovalsCount}件待ち)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
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
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {onClearApprovals && approvals.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                {rejectedApprovalsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchDeleteType('rejected')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition-all cursor-pointer shadow-sm"
                    title="却下された承認履歴を一括削除"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>却下済みを全削除 ({rejectedApprovalsCount})</span>
                  </button>
                )}
                {approvedApprovalsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchDeleteType('approved')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                    title="承認済みの履歴を一括削除"
                  >
                    <Trash2 className="w-3 h-3 text-slate-400" />
                    <span>承認済みを全削除 ({approvedApprovalsCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBatchDeleteType(approvalFilter === 'all' ? 'all' : (approvalFilter as any))}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer"
                  title="表示中の承認項目を一括削除"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{approvalFilter === 'all' ? '承認全件クリア' : '表示中を一括削除'}</span>
                </button>
              </div>
            )}
          </div>

          {filteredApprovals.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">表示できる承認項目がありません</h3>
              <p className="text-xs text-slate-400">
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
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm group hover:border-slate-700 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.status === 'pending' && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                            <Clock className="w-3 h-3" /> 確認待ち
                          </span>
                        )}
                        {item.status === 'approved' && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> 承認済み
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <XCircle className="w-3 h-3" /> 却下
                          </span>
                        )}

                        <span className="text-xs font-bold text-white">{item.actionTitle}</span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <div className="text-[11px] text-slate-400">
                          申請日時: {new Date(item.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {onDeleteApproval && (
                          <button
                            type="button"
                            onClick={() => setApprovalToDelete(item)}
                            title="この承認項目を削除"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="text-slate-400">
                        <span className="font-semibold text-slate-300">対象タスク:</span> {item.taskTitle} (申請者: {item.requestedBy})
                      </div>
                      <div className="text-slate-300">
                        <span className="font-semibold text-indigo-400">申請理由:</span> {item.reason}
                      </div>
                      {item.resolutionNote && (
                        <div className="text-slate-300 pt-1 border-t border-slate-800/80">
                          <span className={`font-semibold ${item.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.status === 'approved' ? '承認メモ:' : '却下理由メモ:'}
                          </span>{' '}
                          {item.resolutionNote}
                        </div>
                      )}
                    </div>

                    {reviewArtifact && (
                      <section className="rounded-xl border border-indigo-500/30 bg-slate-950 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-bold text-indigo-300">担当AIの成果物（承認前）</h3>
                          <span className="text-[10px] text-slate-400">{reviewArtifact.category}</span>
                        </div>
                        <div className="max-h-[520px] overflow-y-auto p-4 text-sm text-slate-200 whitespace-pre-wrap break-words">
                          {reviewArtifact.content}
                        </div>
                        {item.status === 'pending' && (
                          <p className="px-3 py-2 border-t border-slate-800 text-[11px] text-slate-400">
                            承認すると、この成果物をナレッジに正式登録してタスクを完了します。
                          </p>
                        )}
                      </section>
                    )}

                    {item.status === 'pending' && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800/60">
                        <input
                          type="text"
                          value={resolutionNote[item.id] || ''}
                          onChange={(e) =>
                            setResolutionNote({ ...resolutionNote, [item.id]: e.target.value })
                          }
                          placeholder="承認または却下のメモ（任意）"
                          className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleResolve(item.id, 'approved')}
                            className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> 承認する
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolve(item.id, 'rejected')}
                            className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> 却下する
                          </button>
                          {onDeleteApproval && (
                            <button
                              type="button"
                              onClick={() => setApprovalToDelete(item)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs transition-all border border-slate-700/60 cursor-pointer"
                              title="承認待ち項目を削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> 削除
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {item.status !== 'pending' && onDeleteApproval && (
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                        <span>
                          {item.resolvedAt
                            ? `処理日時: ${new Date(item.resolvedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setApprovalToDelete(item)}
                          className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> この履歴を削除
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Real Activity Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-slate-400">
              ※ 本ログは、アプリ内で実際に実行された操作（タスク作成・更新・ステータス変更・承認判断）のみを厳密に記録しています。
            </p>
            {onClearActivityLogs && (
              <button
                type="button"
                disabled={activityLogs.length === 0}
                onClick={() => setIsClearingLogsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-300 border border-slate-700 hover:border-rose-500/50 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                履歴を全件クリア ({activityLogs.length}件)
              </button>
            )}
          </div>

          {activityLogs.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
              記録された活動履歴はありません。
            </div>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3 text-xs group hover:border-slate-700 transition-all"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                      <span className="font-semibold text-slate-300">{log.actor}</span>
                      <div className="flex items-center gap-2">
                        <span>{new Date(log.timestamp).toLocaleString('ja-JP')}</span>
                        {onDeleteActivityLog && (
                          <button
                            type="button"
                            onClick={() => onDeleteActivityLog(log.id)}
                            title="この履歴を削除"
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed">{log.summary}</p>
                    {log.details && (
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">{log.details}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">承認項目の削除</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <p>以下の承認項目を削除しますか？</p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white">{approvalToDelete.actionTitle}</div>
                <div className="text-slate-400">対象: {approvalToDelete.taskTitle}</div>
                <div className="text-slate-400">状態: {
                  approvalToDelete.status === 'pending'
                    ? '確認待ち（削除すると紐づくタスクは進行中に戻ります）'
                    : approvalToDelete.status === 'rejected'
                    ? '却下済み'
                    : '承認済み'
                }</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setApprovalToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingleApproval}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Approvals Modal */}
      {batchDeleteType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                {batchDeleteType === 'rejected'
                  ? '却下項目の全削除'
                  : batchDeleteType === 'approved'
                  ? '承認済み項目の全削除'
                  : batchDeleteType === 'pending'
                  ? '確認待ち項目の全削除'
                  : '承認項目の全件クリア'}
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {batchDeleteType === 'rejected' && `却下済みの承認項目（全${rejectedApprovalsCount}件）を一括削除します。`}
              {batchDeleteType === 'approved' && `承認済みの項目（全${approvedApprovalsCount}件）を一括削除します。`}
              {batchDeleteType === 'pending' && `確認待ちの項目（全${pendingApprovalsCount}件）を一括削除します。関連するタスクは「進行中」に戻ります。`}
              {batchDeleteType === 'all' && `記録されているすべての承認項目（全${approvals.length}件）を削除します。確認待ちタスクは「進行中」に戻ります。`}
              <br />
              この操作は取り消せません。実行しますか？
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBatchDeleteType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmBatchDeleteApprovals}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                一括削除を実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Logs Modal */}
      {isClearingLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">活動・監査ログの全削除</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              記録されているすべての活動履歴ログ（全{activityLogs.length}件）を完全にクリアします。
              <br />
              この操作は取り消せません。本当に削除しますか？
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsClearingLogsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmClearAllLogs}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 cursor-pointer"
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
