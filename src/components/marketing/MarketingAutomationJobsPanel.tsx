import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

export interface MarketingAutomationHealth {
  emailConfigured: boolean;
  lineConfigured: boolean;
  runnerLastRunAt: string | null;
  queuedCount: number;
  failedCount: number;
  killSwitch?: {
    paused: boolean;
    reason: string;
    target: string;
    updatedAt?: string;
  };
  statusCounts?: Record<JobStatus, number>;
  nextDueAt?: string | null;
  recentErrors?: Array<{
    id: string;
    scenario_id: string;
    contact_id: string;
    channel: string;
    error_message: string;
    updated_at: string;
  }>;
}

type JobStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'skipped' | 'canceled';
type JobRow = {
  id: string;
  status: JobStatus;
  scenario_id: string;
  contact_id: string;
  channel: 'email' | 'line';
  due_at: string;
  error_message: string | null;
};
type JobView = JobRow & { scenarioName: string; contactName: string };

const statusLabels: Record<JobStatus, string> = {
  queued: '待機中', sending: '送信中', sent: '送信済み', failed: '失敗', skipped: 'スキップ', canceled: '取消済み',
};
const statuses: JobStatus[] = ['queued', 'sending', 'sent', 'failed', 'skipped', 'canceled'];
const activeStatuses: JobStatus[] = ['queued', 'sending', 'sent', 'failed', 'skipped'];

export class MarketingApiAuthError extends Error {
  status: number;
  constructor(message = '認証エラー（401）: ログインが必要です。') {
    super(message);
    this.name = 'MarketingApiAuthError';
    this.status = 401;
  }
}

export function isMarketingAuthError(error: any): boolean {
  if (!error) return false;
  if (error instanceof MarketingApiAuthError) return true;
  const status = error.status || (error.response && error.response.status);
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    code === '401' ||
    code === '403' ||
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('401') ||
    msg.includes('jwt') ||
    msg.includes('permission denied') ||
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    msg.includes('row-level security')
  );
}

export async function fetchMarketingAutomationHealth(): Promise<MarketingAutomationHealth | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data: { session }, error: sessionError } = await db.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new MarketingApiAuthError('ログインしていません。');
  }
  const response = await fetch('/api/marketing/health', { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (response.status === 401 || response.status === 403) {
    throw new MarketingApiAuthError('401: 認証が切れているか、アクセス権限がありません。');
  }
  if (!response.ok) return null;
  return await response.json() as MarketingAutomationHealth;
}

interface Props {
  health: MarketingAutomationHealth | null;
  onHealthChange: (health: MarketingAutomationHealth | null) => void;
}

export const MarketingAutomationJobsPanel: React.FC<Props> = ({ health, onHealthChange }) => {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [jobCounts, setJobCounts] = useState<Record<JobStatus, number>>({ queued: 0, sending: 0, sent: 0, failed: 0, skipped: 0, canceled: 0 });
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authBlocked, setAuthBlocked] = useState(false);
  const authBlockedRef = React.useRef(false);
  const [busyJobId, setBusyJobId] = useState('');
  const [manualRunning, setManualRunning] = useState(false);
  const [manualNotice, setManualNotice] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [hidingCanceled, setHidingCanceled] = useState(false);
  const db = getSupabase();

  const handleRunNow = async () => {
    if (!db || manualRunning) return;
    setManualRunning(true);
    setManualNotice('');
    setError('');
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) throw new Error('ログインしてください。');

      const res = await fetch('/api/marketing/run-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '手動ジョブ実行に失敗しました。');

      setManualNotice(`✅ ジョブ実行完了: ${data.processed || 0}件を処理しました。`);
      await Promise.all([refresh(), refreshHealth()]);
    } catch (err: any) {
      setError(err.message || 'ジョブの手動実行中にエラーが発生しました。');
    } finally {
      setManualRunning(false);
    }
  };

  const handleHideCanceled = async () => {
    if (!db || hidingCanceled) return;
    const count = jobCounts.canceled || 0;
    if (count === 0) {
      alert('非表示にする取消済みジョブはありません。');
      return;
    }
    if (!window.confirm(`取消済みのジョブ（${count}件）を非表示にして整理しますか？\n※ 過去の配信履歴データはDBに保持され、同一トリガーの誤った再作成を防ぎます。`)) {
      return;
    }
    setHidingCanceled(true);
    setError('');
    setManualNotice('');
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) throw new Error('ログインしてください。');

      const res = await fetch('/api/marketing/jobs/hide-canceled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '整理に失敗しました。');

      setManualNotice(`✅ 取消済みジョブ ${data.hiddenCount || count}件を非表示に整理しました。`);
      await Promise.all([refresh(), refreshHealth()]);
    } catch (err: any) {
      setError(err?.message || '取消済みジョブの整理中にエラーが発生しました。');
    } finally {
      setHidingCanceled(false);
    }
  };

  const refresh = useCallback(async () => {
    if (authBlockedRef.current) return;
    if (!db) { setError('データベースに接続できません。'); setLoading(false); return; }
    setLoading(true);

    try {
      let query = db.from('marketing_automation_jobs')
        .select('id,status,scenario_id,contact_id,channel,due_at,error_message,hidden_at')
        .order('created_at', { ascending: false });

      if (!showHidden) {
        query = query.is('hidden_at', null);
      }

      let jobRows: any[] | null = null;
      let queryError: any = null;

      const res = await query.limit(200);
      if (res.error && res.error.message && res.error.message.includes('hidden_at')) {
        const fallback = await db.from('marketing_automation_jobs')
          .select('id,status,scenario_id,contact_id,channel,due_at,error_message')
          .order('created_at', { ascending: false })
          .limit(200);
        jobRows = fallback.data;
        queryError = fallback.error;
      } else {
        jobRows = res.data;
        queryError = res.error;
      }

      if (queryError) {
        if (isMarketingAuthError(queryError)) {
          authBlockedRef.current = true;
          setAuthBlocked(true);
          setError('権限エラー（401）: 配信ジョブへのアクセス権限がありません。無限リトライ防止のため処理を中断しました。');
          setLoading(false);
          return;
        }
        setError('配信ジョブを読み込めませんでした。');
        setLoading(false);
        return;
      }

      const rows = (jobRows || []) as unknown as JobRow[];
      const contactIds = [...new Set(rows.map((row) => row.contact_id).filter(Boolean))];
      const scenarioIds = [...new Set(rows.map((row) => row.scenario_id).filter(Boolean))];
      const [contactsResult, scenariosResult, ...countResults] = await Promise.all([
        contactIds.length ? db.from('contacts').select('id,full_name').in('id', contactIds) : Promise.resolve({ data: [], error: null }),
        scenarioIds.length ? db.from('marketing_automation_scenarios').select('scenario_id,config').in('scenario_id', scenarioIds) : Promise.resolve({ data: [], error: null }),
        ...statuses.map(async (status) => {
          let q = db.from('marketing_automation_jobs').select('id', { count: 'exact', head: true }).eq('status', status);
          if (!showHidden) {
            q = q.is('hidden_at', null);
          }
          const res = await q;
          if (res.error && res.error.message && res.error.message.includes('hidden_at')) {
            return db.from('marketing_automation_jobs').select('id', { count: 'exact', head: true }).eq('status', status);
          }
          return res;
        }),
      ]);

      const countAuthErr = countResults.find((r) => r.error && isMarketingAuthError(r.error));
      if (countAuthErr) {
        authBlockedRef.current = true;
        setAuthBlocked(true);
        setError('権限エラー（401）: 配信ジョブ集計へのアクセス権限がありません。処理を中断しました。');
        setLoading(false);
        return;
      }

      const contactsById = new Map((contactsResult.data || []).map((contact: any) => [contact.id, contact.full_name]));
      const scenariosById = new Map((scenariosResult.data || []).map((scenario: any) => [scenario.scenario_id, scenario.config?.name || scenario.scenario_id]));
      setJobs(rows.map((row) => ({ ...row, contactName: String(contactsById.get(row.contact_id) || '連絡先不明'), scenarioName: String(scenariosById.get(row.scenario_id) || row.scenario_id || 'シナリオ不明') })));
      setJobCounts(Object.fromEntries(statuses.map((status, index) => [status, countResults[index]?.count || 0])) as Record<JobStatus, number>);
      setError(contactsResult.error || scenariosResult.error ? '連絡先またはシナリオ名を取得できないジョブがあります。' : '');
    } catch (err: any) {
      if (isMarketingAuthError(err)) {
        authBlockedRef.current = true;
        setAuthBlocked(true);
        setError('権限エラー（401）: アクセス権限がありません。処理を中断しました。');
      } else {
        setError(err?.message || '配信ジョブの読み込み中にエラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  }, [db, showHidden]);

  const refreshHealth = useCallback(async () => {
    if (authBlockedRef.current) return;
    try {
      const h = await fetchMarketingAutomationHealth();
      onHealthChange(h);
    } catch (err: any) {
      if (isMarketingAuthError(err)) {
        authBlockedRef.current = true;
        setAuthBlocked(true);
        setError('権限エラー（401）: 自動配信の稼働状態へのアクセス権限がありません。処理を中断しました。');
      }
      onHealthChange(null);
    }
  }, [onHealthChange]);

  useEffect(() => {
    if (authBlocked) return;
    void refresh();
    void refreshHealth();
    const timer = window.setInterval(() => {
      if (authBlockedRef.current) {
        window.clearInterval(timer);
        return;
      }
      void refresh();
      void refreshHealth();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [refresh, refreshHealth, authBlocked]);

  const changeJob = async (job: JobView, action: 'retry' | 'cancel') => {
    if (!db) return;
    setBusyJobId(job.id);
    setError('');
    setManualNotice('');
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) throw new Error('ログインしてください。');
      const response = await fetch(`/api/marketing/jobs/${encodeURIComponent(job.id)}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '操作に失敗しました。');
      if (action === 'retry') {
        const statusMsg = result.status === 'sent' ? '✅ 送信完了しました！' : result.job?.error_message ? `⚠️ 再試行結果: ${result.job.error_message}` : '✅ 再試行を実行しました。';
        setManualNotice(statusMsg);
      } else {
        setManualNotice('ジョブを取り消しました。');
      }
      await Promise.all([refresh(), refreshHealth()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作に失敗しました。');
    } finally { setBusyJobId(''); }
  };

  const visibleJobs = jobs.filter((job) => {
    if (filter === 'all') {
      return showHidden || job.status !== 'canceled';
    }
    return job.status === filter;
  });
  const runnerIsStale = !health?.runnerLastRunAt || Date.now() - Date.parse(health.runnerLastRunAt) > 15 * 60 * 1000;
  const killSwitch = health?.killSwitch;

  return (
    <div className="space-y-5">
      {/* 診断パネル (System Health & Diagnostics Panel) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-base font-bold text-slate-900">
            <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">自動配信 診断コンソール ＆ 稼働状況</h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                キルスイッチ状態、最終実行時刻、次回予定、エラー内容をリアルタイム診断します。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunNow}
              disabled={manualRunning || Boolean(killSwitch?.paused)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${manualRunning ? 'animate-pulse' : ''}`} />
              <span>{manualRunning ? 'ジョブ処理実行中…' : '今すぐキューを実行（手動トリガー）'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void refresh();
                void refreshHealth();
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 shadow-xs transition cursor-pointer"
              aria-label="再読み込み"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {manualNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{manualNotice}</span>
          </div>
        )}

        {/* 4 Core Diagnostic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Card 1: キルスイッチ状態 */}
          <div className={`p-4 rounded-xl border transition ${
            killSwitch?.paused
              ? 'bg-rose-50/70 border-rose-300 text-rose-950'
              : 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold flex items-center gap-1.5 text-xs">
                {killSwitch?.paused ? <ShieldAlert className="w-4 h-4 text-rose-600" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                <span>キルスイッチ（緊急停止）</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                killSwitch?.paused ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {killSwitch?.paused ? '停止中' : '正常稼働中'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {killSwitch?.paused
                ? `⚠️ 理由: ${killSwitch.reason || '配信機能は緊急停止中です。全ジョブの送信が保留されています。'}`
                : '自動配信・メッセージ送信機能は安全に稼働可能です。'}
            </p>
          </div>

          {/* Card 2: 最終実行時刻（永続化） */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-900">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold flex items-center gap-1.5 text-xs text-slate-700">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>最終実行時刻（永続記録）</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                !health?.runnerLastRunAt
                  ? 'bg-slate-200 text-slate-700'
                  : runnerIsStale
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
              }`}>
                {!health?.runnerLastRunAt ? '未実行' : runnerIsStale ? '15分以上経過' : '高頻度稼働中'}
              </span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-900">
              {health?.runnerLastRunAt
                ? new Date(health.runnerLastRunAt).toLocaleString('ja-JP')
                : '実行ログなし'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              サーバーレスのコールドスタートをまたいでDB上に保持されます。
            </p>
          </div>

          {/* Card 3: 次回送信予定ジョブ */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-900">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold flex items-center gap-1.5 text-xs text-slate-700">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>次回実行予定（待機キュー）</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                待機 {jobCounts.queued} 件
              </span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-900">
              {health?.nextDueAt
                ? new Date(health.nextDueAt).toLocaleString('ja-JP')
                : '直近の待機ジョブなし'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {health?.nextDueAt
                ? Date.parse(health.nextDueAt) <= Date.now()
                  ? '⚡ 予定時刻到来済み（次回cronまたは手動実行で送信）'
                  : '⏳ スケジュール時刻待機中'
                : '全キュー処理済み（正常完了）'}
            </p>
          </div>

          {/* Card 4: 送信インフラ設定 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-900">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-700">送信サービス接続状況</span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span>メール (Resend):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${health?.emailConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {health?.emailConfigured ? '連携済' : '未設定'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>LINE (Messaging API):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${health?.lineConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {health?.lineConfigured ? '連携済' : '未設定'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 実行頻度 ＆ Vercel/GitHub Actions 運用ガイド (Requirement 3) */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-indigo-950">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>【重要】自動実行スケジュールの頻度とVercelプランについて</span>
          </div>
          <p className="text-slate-700 leading-relaxed text-[11px]">
            • <strong>Vercel Hobby（無料プラン）:</strong> cronの最短間隔が「1日1回（0 0 * * *）」に制限されており、ステップ配信の遅延原因となります。<br />
            • <strong>推奨解決策（GitHub Actions 5分毎実行 / 設定済み）:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono text-[10px]">.github/workflows/marketing-cron.yml</code> を追加済みです。GitHub Secretsに <code className="font-mono text-[10px]">CRON_SECRET</code> を登録することで、完全無料で5分ごとの高頻度ステップ配信が自律稼働します。<br />
            • <strong>Vercel Pro（有料プラン）の場合:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono text-[10px]">vercel.json</code> の schedule を <code className="font-mono text-[10px]">*/5 * * * *</code> に書き換えるだけで直接5分間隔に短縮可能です。
          </p>
        </div>

        {/* 直近のエラー内容 (Recent Errors) */}
        {health?.recentErrors && health.recentErrors.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>直近の送信エラー ({health.recentErrors.length}件)</span>
              </span>
              <span className="text-[10px] text-rose-700">エラー原因を確認して各行の「再実行」ボタンを押せます</span>
            </div>
            <div className="space-y-1.5">
              {health.recentErrors.map((errItem) => (
                <div key={errItem.id} className="p-2.5 bg-white rounded-lg border border-rose-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 uppercase">
                        {errItem.channel}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">{new Date(errItem.updated_at).toLocaleString('ja-JP')}</span>
                    </div>
                    <p className="text-rose-900 font-medium text-[11px] mt-0.5 break-all">
                      {errItem.error_message || '不明なエラー'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const matchJob = jobs.find((j) => j.id === errItem.id);
                      if (matchJob) {
                        void changeJob(matchJob, 'retry');
                      } else {
                        void changeJob({ id: errItem.id, status: 'failed', scenario_id: errItem.scenario_id, contact_id: errItem.contact_id, channel: errItem.channel as any, due_at: '', error_message: errItem.error_message, scenarioName: 'シナリオ', contactName: '連絡先' }, 'retry');
                      }
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold shrink-0 shadow-2xs transition cursor-pointer"
                  >
                    再実行
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 bg-slate-50/50">
          <div>
            <h2 className="font-bold text-slate-900">配信ジョブ</h2>
            <p className="mt-0.5 text-xs text-slate-500">最新200件。状態とエラーを確認し、失敗ジョブを再実行・取消できます。※ シナリオの配信チャネルが「LINE & メール両方（both）」の場合、1回のトリガーでLINE用とメール用の2つのジョブが作成されます。</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="状態で絞り込み"
              value={filter}
              onChange={(event) => setFilter(event.target.value as JobStatus | 'all')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-xs focus:outline-none focus:border-purple-500"
            >
              <option value="all">すべて（有効）</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                void refresh();
                void refreshHealth();
              }}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 shadow-xs transition cursor-pointer"
              aria-label="再読み込み"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 bg-white">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer ${
                filter === 'all'
                  ? 'border-purple-400 bg-purple-50 text-purple-700 font-semibold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              すべて（有効）
            </button>
            {activeStatuses.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(filter === status ? 'all' : status)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer ${
                  filter === status
                    ? 'border-purple-400 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {statusLabels[status]} {jobCounts[status] ?? 0}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setFilter(filter === 'canceled' ? 'all' : 'canceled')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                filter === 'canceled'
                  ? 'border-slate-400 bg-slate-200 text-slate-800 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
              title="取消済みジョブを表示"
            >
              <span>取消済み</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-600 font-bold">
                {jobCounts.canceled ?? 0}
              </span>
            </button>

            <button
              type="button"
              disabled={hidingCanceled || (jobCounts.canceled ?? 0) === 0}
              onClick={() => void handleHideCanceled()}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="取消済みのジョブを一括で非表示に整理します（DB履歴は保持され、同一トリガーの意図しない再作成を防ぎます）"
            >
              <Archive className="h-3.5 w-3.5 text-slate-500" />
              <span>{hidingCanceled ? '整理中…' : '取消済みを整理'}</span>
            </button>

            <label className="inline-flex items-center gap-1 text-[11px] text-slate-500 select-none cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-purple-600 cursor-pointer"
              />
              <span>整理済みも含める</span>
            </label>
          </div>
        </div>
        {error && (
          <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-center justify-between gap-3">
            <span>{error}</span>
            {authBlocked && (
              <button
                type="button"
                onClick={() => {
                  authBlockedRef.current = false;
                  setAuthBlocked(false);
                  setError('');
                  void refresh();
                  void refreshHealth();
                }}
                className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-xs shadow-xs transition cursor-pointer"
              >
                再試行
              </button>
            )}
          </div>
        )}
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">読み込み中…</p>
        ) : visibleJobs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">該当する配信ジョブはありません。</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleJobs.map((job) => (
              <article key={job.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center hover:bg-slate-50/70 transition">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                      job.status === 'queued' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      job.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      job.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {statusLabels[job.status] || job.status}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                      job.channel === 'email'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {job.channel === 'email' ? '✉️ メール' : '💬 LINE'}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-bold text-slate-900">{job.scenarioName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {job.contactName} · 予定 {new Date(job.due_at).toLocaleString('ja-JP')}
                  </p>
                  {job.error_message && <p className="mt-2 break-words text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded-lg border border-rose-200">{job.error_message}</p>}
                </div>
                <div className="flex gap-2">
                  {job.status === 'failed' && (
                    <button
                      disabled={busyJobId === job.id}
                      onClick={() => void changeJob(job, 'retry')}
                      className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 disabled:opacity-50 shadow-xs transition cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      再実行
                    </button>
                  )}
                  {job.status === 'queued' && (
                    <button
                      disabled={busyJobId === job.id}
                      onClick={() => void changeJob(job, 'cancel')}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50 shadow-xs transition cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      取消
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

