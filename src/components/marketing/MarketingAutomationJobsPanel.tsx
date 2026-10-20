import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, X } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

export interface MarketingAutomationHealth {
  emailConfigured: boolean;
  lineConfigured: boolean;
  runnerLastRunAt: string | null;
  queuedCount: number;
  failedCount: number;
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

export async function fetchMarketingAutomationHealth(): Promise<MarketingAutomationHealth | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data: { session } } = await db.auth.getSession();
  if (!session?.access_token) return null;
  const response = await fetch('/api/marketing/health', { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) return null;
  return await response.json() as MarketingAutomationHealth;
}

interface Props {
  health: MarketingAutomationHealth | null;
  onHealthChange: (health: MarketingAutomationHealth | null) => void;
}

export const MarketingAutomationJobsPanel: React.FC<Props> = ({ health, onHealthChange }) => {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyJobId, setBusyJobId] = useState('');
  const db = getSupabase();

  const refresh = useCallback(async () => {
    if (!db) { setError('データベースに接続できません。'); setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await db.from('marketing_automation_jobs')
      .select('id,status,scenario_id,contact_id,channel,due_at,error_message')
      .order('created_at', { ascending: false }).limit(200);
    if (queryError) { setError('配信ジョブを読み込めませんでした。'); setLoading(false); return; }
    const rows = (data || []) as unknown as JobRow[];
    const contactIds = [...new Set(rows.map((row) => row.contact_id).filter(Boolean))];
    const scenarioIds = [...new Set(rows.map((row) => row.scenario_id).filter(Boolean))];
    const [contactsResult, scenariosResult] = await Promise.all([
      contactIds.length ? db.from('contacts').select('id,full_name').in('id', contactIds) : Promise.resolve({ data: [], error: null }),
      scenarioIds.length ? db.from('marketing_automation_scenarios').select('scenario_id,config').in('scenario_id', scenarioIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const contactsById = new Map((contactsResult.data || []).map((contact: any) => [contact.id, contact.full_name]));
    const scenariosById = new Map((scenariosResult.data || []).map((scenario: any) => [scenario.scenario_id, scenario.config?.name || scenario.scenario_id]));
    setJobs(rows.map((row) => ({ ...row, contactName: String(contactsById.get(row.contact_id) || '連絡先不明'), scenarioName: String(scenariosById.get(row.scenario_id) || row.scenario_id || 'シナリオ不明') })));
    setError(contactsResult.error || scenariosResult.error ? '連絡先またはシナリオ名を取得できないジョブがあります。' : '');
    setLoading(false);
  }, [db]);

  const refreshHealth = useCallback(async () => {
    try { onHealthChange(await fetchMarketingAutomationHealth()); } catch { onHealthChange(null); }
  }, [onHealthChange]);

  useEffect(() => {
    void refresh();
    void refreshHealth();
    const timer = window.setInterval(() => { void refresh(); void refreshHealth(); }, 60000);
    return () => window.clearInterval(timer);
  }, [refresh, refreshHealth]);

  const changeJob = async (job: JobView, action: 'retry' | 'cancel') => {
    const label = action === 'retry' ? '再実行待ちに戻しますか？' : 'この配信ジョブを取り消しますか？';
    if (!window.confirm(`${label}\n${job.scenarioName} / ${job.contactName}`)) return;
    if (!db) return;
    setBusyJobId(job.id);
    setError('');
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) throw new Error('ログインしてください。');
      const response = await fetch(`/api/marketing/jobs/${encodeURIComponent(job.id)}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '操作に失敗しました。');
      await Promise.all([refresh(), refreshHealth()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作に失敗しました。');
    } finally { setBusyJobId(''); }
  };

  const counts = useMemo(() => statuses.reduce((result, status) => {
    result[status] = jobs.filter((job) => job.status === status).length;
    return result;
  }, {} as Record<JobStatus, number>), [jobs]);
  const visibleJobs = filter === 'all' ? jobs : jobs.filter((job) => job.status === filter);
  const runnerIsStale = !health?.runnerLastRunAt || Date.now() - Date.parse(health.runnerLastRunAt) > 15 * 60 * 1000;

  return <div className="space-y-4">
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Activity className="h-4 w-4 text-indigo-300" />自動配信の稼働状況</div>
      <div className="flex flex-wrap gap-2">
        {health && !health.emailConfigured && <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">メール未設定</span>}
        {health && !health.lineConfigured && <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">LINE未設定</span>}
        {health && runnerIsStale && <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">自動配信の実行が15分以上確認できません</span>}
        {health && <span className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">待機 {health.queuedCount}件 / 失敗 {health.failedCount}件</span>}
        {!health && <span className="text-xs text-slate-400">稼働状況を取得できません。ログイン状態とサーバー設定を確認してください。</span>}
      </div>
      {health?.runnerLastRunAt && <p className="mt-2 text-[11px] text-slate-500">最終確認: {new Date(health.runnerLastRunAt).toLocaleString('ja-JP')}</p>}
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
        <div><h2 className="font-bold text-white">配信ジョブ</h2><p className="mt-1 text-xs text-slate-400">最新200件。状態とエラーを確認し、失敗ジョブを再実行できます。</p></div>
        <div className="flex items-center gap-2">
          <select aria-label="状態で絞り込み" value={filter} onChange={(event) => setFilter(event.target.value as JobStatus | 'all')} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <option value="all">すべて</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <button onClick={() => { void refresh(); void refreshHealth(); }} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" aria-label="再読み込み"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-800 px-4 py-3">{statuses.map((status) => <button key={status} onClick={() => setFilter(filter === status ? 'all' : status)} className={`rounded-full border px-2.5 py-1 text-[11px] ${filter === status ? 'border-indigo-400/50 bg-indigo-500/10 text-indigo-200' : 'border-slate-700 text-slate-400'}`}>{statusLabels[status]} {counts[status] ?? 0}</button>)}</div>
      {error && <p role="alert" className="border-b border-slate-800 px-4 py-3 text-xs text-amber-200">{error}</p>}
      {loading ? <p className="p-6 text-sm text-slate-400">読み込み中…</p> : visibleJobs.length === 0 ? <p className="p-6 text-sm text-slate-400">該当する配信ジョブはありません。</p> : <div className="divide-y divide-slate-800">
        {visibleJobs.map((job) => <article key={job.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200">{statusLabels[job.status] || job.status}</span><span className="text-xs text-slate-400">{job.channel === 'email' ? 'メール' : 'LINE'}</span></div>
            <p className="mt-2 truncate text-sm font-semibold text-white">{job.scenarioName}</p><p className="mt-1 text-xs text-slate-400">{job.contactName} · 予定 {new Date(job.due_at).toLocaleString('ja-JP')}</p>
            {job.error_message && <p className="mt-2 break-words text-xs text-rose-200">{job.error_message}</p>}
          </div>
          <div className="flex gap-2">{job.status === 'failed' && <button disabled={busyJobId === job.id} onClick={() => void changeJob(job, 'retry')} className="flex items-center gap-1 rounded-lg border border-indigo-500/40 px-3 py-2 text-xs text-indigo-200 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />再実行</button>}{job.status === 'queued' && <button disabled={busyJobId === job.id} onClick={() => void changeJob(job, 'cancel')} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"><X className="h-3.5 w-3.5" />取消</button>}</div>
        </article>)}
      </div>}
    </section>
  </div>;
};

