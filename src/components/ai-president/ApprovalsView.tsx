import React, { useState } from 'react';
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
} from 'lucide-react';
import { ApprovalItem, ActivityLog, ApprovalStatus } from '../types';

interface ApprovalsViewProps {
  approvals: ApprovalItem[];
  activityLogs: ActivityLog[];
  onResolveApproval: (id: string, status: 'approved' | 'rejected', note?: string) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  approvals,
  activityLogs,
  onResolveApproval,
}) => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'logs'>('approvals');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});

  const filteredApprovals = approvals.filter((a) => {
    if (approvalFilter === 'all') return true;
    return a.status === approvalFilter;
  });

  const handleResolve = (id: string, status: 'approved' | 'rejected') => {
    const note = resolutionNote[id] || '';
    onResolveApproval(id, status, note);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
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

        {/* Tab Switcher */}
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
            承認管理 ({approvals.filter((a) => a.status === 'pending').length}件待ち)
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

      {/* Tab: Approvals */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {/* Sub filter */}
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
            {[
              { id: 'all', label: `すべて (${approvals.length})` },
              { id: 'pending', label: `確認待ち (${approvals.filter((a) => a.status === 'pending').length})` },
              { id: 'approved', label: `承認済み (${approvals.filter((a) => a.status === 'approved').length})` },
              { id: 'rejected', label: `却下 (${approvals.filter((a) => a.status === 'rejected').length})` },
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
              {filteredApprovals.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
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

                    <div className="text-[11px] text-slate-400">
                      申請日時: {new Date(item.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                        <span className="font-semibold text-emerald-400">判断メモ:</span> {item.resolutionNote}
                      </div>
                    )}
                  </div>

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
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Real Activity Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            ※ 本ログは、アプリ内で実際に実行された操作（タスク作成・更新・ステータス変更・承認判断）のみを厳密に記録しています。
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
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3 text-xs"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                      <span className="font-semibold text-slate-300">{log.actor}</span>
                      <span>{new Date(log.timestamp).toLocaleString('ja-JP')}</span>
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
    </div>
  );
};
