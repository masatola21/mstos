import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { MarketingScenario } from '../../types/marketing';

interface SimulatedJob {
  channel: 'line' | 'email';
  recipient: string;
  recipientName: string;
  dueAt: string;
  waitMinutes: number;
  status: 'eligible' | 'skipped';
  skipReason: string | null;
  subject?: string;
  bodyText: string;
  linePayload?: any;
  consentBasis: string;
}

interface DryRunResult {
  success: boolean;
  scenarioName: string;
  trigger: string;
  killSwitch: { paused: boolean; reason: string; target: string };
  contact: {
    id: string;
    fullName: string;
    email: string | null;
    companyName: string;
    lineUserId: string | null;
  };
  simulatedJobs: SimulatedJob[];
  timing: {
    waitMinutes: number;
    scheduledTime: string;
    sendTimeWindow: string;
  };
}

interface ContactOption {
  id: string;
  full_name: string;
  email: string | null;
  line_user_id: string | null;
  company_name?: string;
}

interface Props {
  scenario: MarketingScenario;
  isOpen: boolean;
  onClose: () => void;
}

export const ScenarioDryRunModal: React.FC<Props> = ({ scenario, isOpen, onClose }) => {
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string>('sample');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string>('');

  const loadContacts = useCallback(async () => {
    const db = getSupabase();
    if (!db) return;
    setLoadingContacts(true);
    try {
      const [cRes, coRes] = await Promise.all([
        db.from('contacts').select('id, full_name, email, line_user_id, company_id').order('created_at', { ascending: false }).limit(60),
        db.from('companies').select('id, company_name').limit(200),
      ]);
      const companyMap = new Map((coRes.data || []).map((c: any) => [c.id, c.company_name]));
      const list = (cRes.data || []).map((row: any) => ({
        id: row.id,
        full_name: row.full_name || '名前未設定',
        email: row.email,
        line_user_id: row.line_user_id,
        company_name: row.company_id ? companyMap.get(row.company_id) : '会社未設定',
      }));
      setContacts(list);
    } catch (_) {
      // ignore
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadContacts();
      void runDryRun('sample');
    }
  }, [isOpen, loadContacts]);

  const runDryRun = async (contactIdToUse?: string) => {
    const targetContactId = contactIdToUse || selectedContactId;
    setIsRunning(true);
    setError('');
    const db = getSupabase();
    if (!db) {
      setError('データベースに接続できません。');
      setIsRunning(false);
      return;
    }

    try {
      const { data: { session } } = await db.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/marketing/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scenarioId: scenario.id,
          scenarioConfig: scenario,
          contactId: targetContactId === 'sample' ? undefined : targetContactId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `ドライラン実行エラー (HTTP ${res.status})`);
      }

      setResult(json as DryRunResult);
    } catch (err: any) {
      setError(err.message || 'ドライランの実行中にエラーが発生しました。');
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                  シナリオ・ドライラン（送信シミュレーション）
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {scenario.name || scenario.id}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                安全プレビュー ＆ ジョブ生成シミュレーション
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {/* Target Contact Selector */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <User className="w-4 h-4 text-indigo-600" />
                <span>シミュレーション対象者の選択</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactId('sample');
                    void runDryRun('sample');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    selectedContactId === 'sample'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  🧪 テスト用代表サンプル（全項目設定済み）
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">実在連絡先から選択</label>
                <div className="relative">
                  <select
                    value={selectedContactId}
                    onChange={(e) => {
                      setSelectedContactId(e.target.value);
                      void runDryRun(e.target.value);
                    }}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="sample">【サンプル】山田 太郎 様（サンプル株式会社 / LINE・メール両方あり）</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} 様 ({c.company_name || '会社未設定'}) {c.email ? '✉️' : ''} {c.line_user_id ? '🟢LINE' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">候補検索</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="氏名・会社名・メールで絞り込み..."
                      className="w-full text-xs rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => runDryRun()}
                  disabled={isRunning}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                  <span>再計算</span>
                </button>
              </div>
            </div>

            {searchQuery && filteredContacts.length > 0 && (
              <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {filteredContacts.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedContactId(c.id);
                      void runDryRun(c.id);
                    }}
                    className={`text-[11px] px-2 py-1 rounded-md border transition cursor-pointer ${
                      selectedContactId === c.id
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {c.full_name} ({c.company_name})
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Error Notice */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">ドライラン実行中にエラーが発生しました</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-4">
              {/* Killswitch Notice */}
              {result.killSwitch?.paused && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">⚠️ キルスイッチ（緊急停止）作動中</p>
                    <p className="mt-0.5">
                      理由: {result.killSwitch.reason || '配信停止中'}
                      <br />
                      ※ 本番環境ではジョブが生成されても送信処理が自動停止されます。ドライランではプレビューのみ正常に行われます。
                    </p>
                  </div>
                </div>
              )}

              {/* Status Header Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[11px]">トリガー種別</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{result.trigger}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[11px]">配信予定タイミング</span>
                  <div className="flex items-center gap-1 font-bold text-slate-900 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {result.timing.waitMinutes === 0
                        ? '即時配信（0分）'
                        : `${result.timing.waitMinutes}分後 (${new Date(result.timing.scheduledTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})`}
                    </span>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[11px]">対象宛先（解決値）</span>
                  <span className="font-bold text-slate-900 mt-0.5 block truncate">
                    {result.contact.companyName} / {result.contact.fullName} 様
                  </span>
                </div>
              </div>

              {/* Simulated Jobs List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-600" />
                  <span>生成される予定の配信ジョブ ({result.simulatedJobs.length}件)</span>
                </h4>

                {result.simulatedJobs.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                    設定されたチャンネル条件に該当するジョブはありません。
                  </div>
                ) : (
                  result.simulatedJobs.map((job, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-5 shadow-xs transition ${
                        job.status === 'eligible'
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50 border-slate-200/80 opacity-90'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                              job.channel === 'line'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {job.channel === 'line' ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                            <span>{job.channel === 'line' ? 'LINE Messaging API' : 'メール (Resend)'}</span>
                          </span>

                          <span className="text-xs font-semibold text-slate-700">宛先: {job.recipient}</span>
                        </div>

                        <div>
                          {job.status === 'eligible' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>送信適格（送信予定ジョブとして投入）</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>スキップ（送信されません: {job.skipReason}）</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Preview */}
                      <div className="mt-4 space-y-3 text-xs">
                        {job.channel === 'email' && job.subject && (
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 block mb-0.5">差し込み解決後 件名:</span>
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-900">
                              {job.subject}
                            </div>
                          </div>
                        )}

                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block mb-0.5">差し込み解決後 本文プレビュー:</span>
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                            {job.bodyText || <span className="text-slate-400">（本文なし）</span>}
                          </div>
                        </div>

                        {job.linePayload && (
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 block mb-0.5">LINE Flexメッセージ構造:</span>
                            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 font-mono overflow-x-auto">
                              タイトル: {job.linePayload?.contents?.body?.contents?.[0]?.text}
                              <br />
                              ボタン: {job.linePayload?.contents?.footer?.contents?.[0]?.action?.label} ➔ {job.linePayload?.contents?.footer?.contents?.[0]?.action?.uri}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                          <span>同意根拠: {job.consentBasis}</span>
                          <span>
                            実行予定時刻: {new Date(job.dueAt).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Safety Notice Banner */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center gap-3 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">安心の安全設計（Side-Effect Free）:</span>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                ドライランでは実際のメッセージ送信やデータベースへのジョブ追加は一切行われません。変数の置換や宛先の適格性、遅延時刻の整合性のみを安全に検証します。
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            対象者と文面を確認し、問題なければステップ設定を保存して運用してください。
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
