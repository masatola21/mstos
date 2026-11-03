import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  Inbox, 
  MessageSquare, 
  Mail, 
  Share2, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Filter, 
  ExternalLink, 
  UserCheck, 
  Calendar, 
  ArrowRight,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Tag as TagIcon
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { UnifiedNavTab } from '../UnifiedNavbar';
import { MarketingLineInboxView } from '../marketing/MarketingLineInboxView';
import { MarketingEmailInboxView } from '../marketing/MarketingEmailInboxView';
import { SocialDmSalesStudio, DmItem } from '../marketing/SocialDmSalesStudio';

export type InboxChannel = 'line' | 'email' | 'social_dm' | 'forms';

interface SubmissionItem {
  id: string;
  form_id: string;
  contact_id: string | null;
  company_id: string | null;
  respondent_company_name: string | null;
  lead_id: string | null;
  diagnosis_id?: string | null;
  status: 'received' | 'reviewing' | 'completed' | 'rejected';
  respondent_name: string | null;
  respondent_email: string | null;
  answers: Record<string, unknown>;
  score: number | null;
  submitted_at: string;
  reviewer_memo: string | null;
}

interface FormMeta {
  id: string;
  name: string;
  form_type: string;
  public_slug: string;
  definition: Record<string, unknown>;
}

interface UnifiedInboxViewProps {
  initialChannel?: InboxChannel;
  initialLineUserId?: string;
  onNavigateTab: (tab: UnifiedNavTab) => void;
  onOpenSendCenter?: (params: { companyId?: string; contactId?: string; formId?: string; sendKind?: 'announcement' | 'customer_meeting' | 'deal' | 'diagnosis' | 'form' }) => void;
  onOpenCustomerWorkspace?: (companyId: string, destination?: string) => void;
}

const STORAGE_DM_KEY = 'ai_social_dm_sales_items_v1';

export const UnifiedInboxView: React.FC<UnifiedInboxViewProps> = ({
  initialChannel = 'forms',
  initialLineUserId,
  onNavigateTab,
  onOpenSendCenter,
  onOpenCustomerWorkspace
}) => {
  const db = getSupabase();
  const [activeChannel, setActiveChannel] = useState<InboxChannel>(initialChannel);

  // Badge counters
  const [counts, setCounts] = useState({
    lineTotal: 0,
    lineInbound: 0,
    emailTotal: 0,
    dmInboundWaiting: 0,
    formsTotal: 0,
    formsReceived: 0,
  });

  // Forms & Submissions state
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [formsMeta, setFormsMeta] = useState<Map<string, FormMeta>>(new Map());
  const [formFilterStatus, setFormFilterStatus] = useState<string>('all');
  const [formSearchQuery, setFormSearchQuery] = useState('');
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [submissionError, setSubmissionError] = useState('');

  // Fetch summary counts for the 4 touchpoints
  const loadCounts = async () => {
    if (!db) return;
    try {
      const [lineRes, emailRes, subRes] = await Promise.all([
        db.from('line_inbox_messages').select('id,direction', { count: 'exact' }),
        db.from('email_inbox_messages').select('id', { count: 'exact' }),
        db.from('diagnosis_submissions').select('id,status'),
      ]);

      const lineList = (lineRes.data || []) as { id: string; direction: string }[];
      const lineInbound = lineList.filter((m) => m.direction === 'inbound').length;
      const emailTotal = emailRes.count || 0;

      const subList = (subRes.data || []) as { id: string; status: string }[];
      const formsReceived = subList.filter((s) => s.status === 'received').length;

      // DM count from localStorage
      let dmInbound = 0;
      try {
        const rawDm = localStorage.getItem(STORAGE_DM_KEY);
        if (rawDm) {
          const dmList = JSON.parse(rawDm) as DmItem[];
          dmInbound = dmList.filter((d) => d.status === 'inbound_waiting').length;
        }
      } catch {
        // ignore
      }

      setCounts({
        lineTotal: lineList.length,
        lineInbound,
        emailTotal,
        dmInboundWaiting: dmInbound,
        formsTotal: subList.length,
        formsReceived,
      });
    } catch {
      // quiet fallback
    }
  };

  // Load Form Submissions & Definitions
  const loadSubmissions = async () => {
    if (!db) return;
    setLoadingSubmissions(true);
    setSubmissionError('');
    try {
      const [subRes, formRes] = await Promise.all([
        db.from('diagnosis_submissions').select('*').order('submitted_at', { ascending: false }).limit(200),
        db.from('diagnosis_forms').select('id,name,form_type,public_slug,definition'),
      ]);

      if (subRes.error) {
        setSubmissionError(`回答一覧を取得できませんでした: ${subRes.error.message}`);
      } else {
        setSubmissions((subRes.data || []) as SubmissionItem[]);
      }

      if (formRes.data) {
        const map = new Map<string, FormMeta>();
        formRes.data.forEach((f: any) => {
          map.set(f.id, f as FormMeta);
        });
        setFormsMeta(map);
      }
    } catch (err: any) {
      setSubmissionError(err.message || 'データ取得エラー');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    void loadCounts();
    void loadSubmissions();
  }, []);

  // Update submission status
  const handleUpdateSubmissionStatus = async (sub: SubmissionItem, newStatus: SubmissionItem['status']) => {
    if (!db) return;
    const { error } = await db
      .from('diagnosis_submissions')
      .update({ status: newStatus })
      .eq('id', sub.id);
    if (error) {
      setSubmissionError(`更新に失敗しました: ${error.message}`);
    } else {
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: newStatus } : s)));
      void loadCounts();
    }
  };

  // Quick 1-click convert to Lead
  const handleConvertToLead = async (sub: SubmissionItem) => {
    if (!db) return;
    setSubmissionNotice('');
    setSubmissionError('');
    try {
      const formMeta = formsMeta.get(sub.form_id);
      const companyName = sub.respondent_company_name || '新規反響企業（フォーム経由）';

      // 1. Check or create company
      let companyId = sub.company_id;
      if (!companyId) {
        const { data: comp, error: compErr } = await db
          .from('companies')
          .insert({
            company_name: companyName,
            status: 'active',
          })
          .select('id')
          .single();
        if (!compErr && comp) {
          companyId = comp.id;
        }
      }

      // 2. Insert Lead
      const { data: newLead, error: leadErr } = await db
        .from('leads')
        .insert({
          company_id: companyId,
          source: 'form_diagnosis',
          status: 'uncontacted',
          inquiry_type: formMeta?.name || 'フォーム回答',
          notes: `【フォーム・診断回答より自動リード化】\n回答者: ${sub.respondent_name || '未記入'} (${sub.respondent_email || 'メール未記入'})\n受付日時: ${new Date(sub.submitted_at).toLocaleString('ja-JP')}`,
        })
        .select('id')
        .single();

      if (leadErr) {
        setSubmissionError(`リード作成に失敗しました: ${leadErr.message}`);
        return;
      }

      // 3. Update Submission with lead_id & company_id
      await db
        .from('diagnosis_submissions')
        .update({
          lead_id: newLead.id,
          company_id: companyId,
          status: 'reviewing',
        })
        .eq('id', sub.id);

      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, lead_id: newLead.id, company_id: companyId, status: 'reviewing' } : s))
      );
      setSubmissionNotice(`「${companyName}」を反響リードに登録しました。リード一覧で詳細確認やフォローが可能です。`);
      void loadCounts();
    } catch (err: any) {
      setSubmissionError(`エラーが発生しました: ${err.message}`);
    }
  };

  // Save reviewer memo
  const handleSaveMemo = async (subId: string, memo: string) => {
    if (!db) return;
    await db.from('diagnosis_submissions').update({ reviewer_memo: memo }).eq('id', subId);
    setSubmissions((prev) => prev.map((s) => (s.id === subId ? { ...s, reviewer_memo: memo } : s)));
  };

  // Filtered submissions
  const visibleSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (formFilterStatus !== 'all' && sub.status !== formFilterStatus) return false;
      if (!formSearchQuery.trim()) return true;
      const q = formSearchQuery.toLowerCase();
      const name = (sub.respondent_name || '').toLowerCase();
      const email = (sub.respondent_email || '').toLowerCase();
      const company = (sub.respondent_company_name || '').toLowerCase();
      const formName = (formsMeta.get(sub.form_id)?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || company.includes(q) || formName.includes(q);
    });
  }, [submissions, formFilterStatus, formSearchQuery, formsMeta]);

  const totalInboundNeedsAttention =
    counts.lineInbound + counts.dmInboundWaiting + counts.formsReceived;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Executive Summary Cockpit ── */}
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>統合受信トレイ</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                    全チャネル反響集約
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  LINE・メール・SNS DM・HP診断フォームの全受信反響を一元管理。見落としを防ぎ、1クリックでリード化・面談案内へ繋げます。
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void loadCounts();
                void loadSubmissions();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
              title="最新の受信状態を再読み込み"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>更新</span>
            </button>
            <button
              onClick={() => onNavigateTab('leads')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow transition"
            >
              <span>反響リード一覧へ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Channel Quick Overview Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {/* Channel 1: Form / Diagnoses */}
          <button
            onClick={() => setActiveChannel('forms')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeChannel === 'forms'
                ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <FileText className="w-4 h-4 text-emerald-400" />
                フォーム・診断回答
              </span>
              {counts.formsReceived > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                  未対応 {counts.formsReceived}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{counts.formsTotal}</span>
              <span className="text-xs text-slate-400">件受付</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              HP問い合わせ・ボトルネック診断
            </p>
          </button>

          {/* Channel 2: LINE */}
          <button
            onClick={() => setActiveChannel('line')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeChannel === 'line'
                ? 'bg-emerald-950/60 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                LINE公式アカウント
              </span>
              {counts.lineInbound > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  受信 {counts.lineInbound}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{counts.lineTotal}</span>
              <span className="text-xs text-slate-400">通履歴</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              友だち返信・個別チャット・自動応答
            </p>
          </button>

          {/* Channel 3: Email */}
          <button
            onClick={() => setActiveChannel('email')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeChannel === 'email'
                ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Mail className="w-4 h-4 text-sky-400" />
                メール受信箱
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                Resend連携
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{counts.emailTotal}</span>
              <span className="text-xs text-slate-400">通受信</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              問い合わせ・アウトリーチ返信
            </p>
          </button>

          {/* Channel 4: Social DM */}
          <button
            onClick={() => setActiveChannel('social_dm')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              activeChannel === 'social_dm'
                ? 'bg-purple-950/60 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Share2 className="w-4 h-4 text-purple-400" />
                SNS DM受信対応
              </span>
              {counts.dmInboundWaiting > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                  未対応 {counts.dmInboundWaiting}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{counts.dmInboundWaiting}</span>
              <span className="text-xs text-slate-400">件返信待ち</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              X・Instagram・LinkedIn・FB
            </p>
          </button>
        </div>
      </section>

      {/* ── Channel Navigation Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveChannel('forms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeChannel === 'forms'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>📝 フォーム・無料診断回答</span>
          {counts.formsReceived > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
              {counts.formsReceived}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveChannel('line')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeChannel === 'line'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>💬 LINE公式チャット・受信</span>
          {counts.lineInbound > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-white text-emerald-800">
              {counts.lineInbound}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveChannel('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeChannel === 'email'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>✉️ メール受信箱</span>
          {counts.emailTotal > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-indigo-950 text-indigo-200 border border-indigo-400/40">
              {counts.emailTotal}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveChannel('social_dm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeChannel === 'social_dm'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>📱 SNS DM営業・受信対応</span>
          {counts.dmInboundWaiting > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-purple-950 text-purple-200 border border-purple-400/40">
              {counts.dmInboundWaiting}
            </span>
          )}
        </button>
      </div>

      {/* ── Notification & Alert Banners ── */}
      {submissionNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-200 text-xs flex items-center justify-between">
          <span>{submissionNotice}</span>
          <button onClick={() => setSubmissionNotice('')} className="text-emerald-400 hover:text-emerald-200">
            ×
          </button>
        </div>
      )}
      {submissionError && (
        <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-200 text-xs flex items-center justify-between">
          <span>{submissionError}</span>
          <button onClick={() => setSubmissionError('')} className="text-rose-400 hover:text-rose-200">
            ×
          </button>
        </div>
      )}

      {/* ── Active Channel View ── */}
      {/* 1. FORMS & DIAGNOSIS SUBMISSIONS */}
      {activeChannel === 'forms' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> 状態:
              </span>
              {[
                { key: 'all', label: `すべて (${submissions.length})` },
                {
                  key: 'received',
                  label: `未対応 (${submissions.filter((s) => s.status === 'received').length})`,
                  color: 'text-amber-300 font-bold',
                },
                { key: 'reviewing', label: `対応中 (${submissions.filter((s) => s.status === 'reviewing').length})` },
                { key: 'completed', label: `完了 (${submissions.filter((s) => s.status === 'completed').length})` },
                { key: 'rejected', label: `対象外 (${submissions.filter((s) => s.status === 'rejected').length})` },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFormFilterStatus(filter.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    formFilterStatus === filter.key
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className={filter.color}>{filter.label}</span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formSearchQuery}
                onChange={(e) => setFormSearchQuery(e.target.value)}
                placeholder="回答者名・会社名・メール検索..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Submissions List */}
          {loadingSubmissions ? (
            <div className="p-12 text-center text-sm text-slate-400 rounded-2xl border border-slate-800 bg-slate-900">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
              回答データを読み込み中...
            </div>
          ) : visibleSubmissions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">該当する回答データはありません。</p>
              <p className="text-xs text-slate-500 mt-1">
                HPや公開診断フォームからの回答を受信すると、ここに即時蓄積されます。
              </p>
              <button
                onClick={() => onNavigateTab('mst_diagnoses')}
                className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-blue-300 border border-slate-700 transition"
              >
                フォーム・診断の公開設定を確認する
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSubmissions.map((sub) => {
                const form = formsMeta.get(sub.form_id);
                const isExpanded = expandedSubmissionId === sub.id;
                const statusBadge =
                  sub.status === 'received'
                    ? { label: '未対応（新規受付）', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                    : sub.status === 'reviewing'
                    ? { label: '対応中', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' }
                    : sub.status === 'completed'
                    ? { label: '完了', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
                    : { label: '対象外', color: 'bg-zinc-700/30 text-zinc-400 border-zinc-700' };

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-all shadow-sm"
                  >
                    {/* Upper row: Respondent info & status */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {sub.respondent_name || sub.respondent_email || '回答者（氏名未入力）'}
                          </span>
                          {sub.respondent_company_name && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {sub.respondent_company_name}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            受付日時: {new Date(sub.submitted_at).toLocaleString('ja-JP')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1.5">
                          <span>
                            フォーム: <strong className="text-slate-200">{form?.name || sub.form_id.slice(0, 8)}</strong>
                          </span>
                          {sub.respondent_email && (
                            <>
                              <span>·</span>
                              <span>✉️ {sub.respondent_email}</span>
                            </>
                          )}
                          {sub.score != null && (
                            <>
                              <span>·</span>
                              <span className="text-sky-300 font-semibold">診断スコア: {sub.score}点</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status selector */}
                        <select
                          value={sub.status}
                          onChange={(e) =>
                            void handleUpdateSubmissionStatus(sub, e.target.value as SubmissionItem['status'])
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="received">未対応（受付）</option>
                          <option value="reviewing">対応中</option>
                          <option value="completed">完了</option>
                          <option value="rejected">対象外</option>
                        </select>

                        {/* 1-click Lead Conversion */}
                        {!sub.lead_id ? (
                          <button
                            onClick={() => void handleConvertToLead(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow transition"
                            title="この回答内容を営業リード台帳に登録"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>反響リードに登録</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigateTab('leads')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-xs font-semibold text-indigo-300 border border-indigo-700/60 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>リード登録済（確認）</span>
                          </button>
                        )}

                        {/* Meeting Schedule / Communication Send */}
                        <button
                          onClick={() => {
                            if (onOpenSendCenter) {
                              onOpenSendCenter({
                                companyId: sub.company_id || undefined,
                                contactId: sub.contact_id || undefined,
                                formId: sub.form_id,
                                sendKind: 'deal',
                              });
                            }
                            onNavigateTab('deal_invitations');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                        >
                          <Calendar className="w-3.5 h-3.5 text-blue-400" />
                          <span>面談案内を作成</span>
                        </button>

                        {/* Expand Details Toggle */}
                        <button
                          onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                        >
                          <span>{isExpanded ? '回答を閉じる' : '回答を見る'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Answer Questionnaire Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                          <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                            <span>送信された設問回答一覧:</span>
                          </h4>

                          {(() => {
                            const entries = Object.entries(sub.answers || {});
                            if (!entries.length) {
                              return <p className="text-xs text-slate-500">回答データがありません。</p>;
                            }

                            // Read question labels from form definition if available
                            const defQuestions: any[] = (form?.definition as any)?.questions || [];
                            const questionMap = new Map<string, string>();
                            defQuestions.forEach((q) => {
                              if (q && q.id) questionMap.set(q.id, q.label || q.id);
                            });

                            return (
                              <div className="space-y-2.5">
                                {entries.map(([key, val]) => {
                                  const questionLabel = questionMap.get(key) || key;
                                  const formattedValue =
                                    typeof val === 'boolean'
                                      ? val
                                        ? 'はい'
                                        : 'いいえ'
                                      : Array.isArray(val)
                                      ? val.join('、')
                                      : typeof val === 'object' && val !== null
                                      ? JSON.stringify(val, null, 2)
                                      : String(val ?? '—');

                                  return (
                                    <div
                                      key={key}
                                      className="grid sm:grid-cols-[220px_1fr] gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs"
                                    >
                                      <div className="font-medium text-slate-400 break-words">
                                        {questionLabel}
                                      </div>
                                      <div className="text-slate-100 whitespace-pre-wrap break-words font-sans">
                                        {formattedValue}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Staff Review Memo */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            defaultValue={sub.reviewer_memo || ''}
                            onBlur={(e) => void handleSaveMemo(sub.id, e.target.value)}
                            placeholder="社内対応メモを入力（フォーカスが外れると自動保存されます）"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-[11px] text-slate-500 self-center">
                            自動保存済み
                          </span>
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

      {/* 2. LINE INBOX & INDIVIDUAL CHAT */}
      {activeChannel === 'line' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                LINE公式アカウントの個別チャットと受信メッセージです。友だちへの個別返信や自動応答ルールの設定が行えます。
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('contacts')}
              className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-semibold"
            >
              <TagIcon className="w-3.5 h-3.5" />
              <span>LINE友だち・タグ管理を開く</span>
            </button>
          </div>

          <MarketingLineInboxView initialLineUserId={initialLineUserId} />
        </div>
      )}

      {/* 3. EMAIL INBOX */}
      {activeChannel === 'email' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-950/20 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>
                受信用メールアドレス宛に届いたお問い合わせやアウトリーチ返信を閲覧・管理します。
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('communication_send')}
              className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 font-semibold"
            >
              <Send className="w-3.5 h-3.5" />
              <span>送信センター（返信・商談案内）を開く</span>
            </button>
          </div>

          <MarketingEmailInboxView />
        </div>
      )}

      {/* 4. SOCIAL DM STUDIO */}
      {activeChannel === 'social_dm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-purple-500/30 bg-purple-950/20 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span>
                X (Twitter)・Instagram・LinkedIn・Facebook等の受信DM対応およびアウトバウンド返信を管理します。
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('ai_acquisition')}
              className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 font-semibold"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>AI集客運用（SNS発信・HP分析）を開く</span>
            </button>
          </div>

          <SocialDmSalesStudio />
        </div>
      )}
    </div>
  );
};
