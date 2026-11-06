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
  Tag as TagIcon,
  Building2,
  Users
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
  onNavigateTab: (tab: any, options?: any) => void;
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
  const [activeChannel, setActiveChannel] = useState<InboxChannel>(() => {
    if (initialChannel && initialChannel !== 'forms') return initialChannel;
    try {
      const saved = localStorage.getItem('unified_inbox_active_channel') as InboxChannel | null;
      if (saved && ['line', 'email', 'social_dm', 'forms'].includes(saved)) {
        return saved;
      }
    } catch {}
    return initialChannel || 'forms';
  });

  useEffect(() => {
    if (initialChannel) {
      setActiveChannel(initialChannel);
    }
  }, [initialChannel]);

  const handleSelectChannel = (ch: InboxChannel) => {
    setActiveChannel(ch);
    try {
      localStorage.setItem('unified_inbox_active_channel', ch);
    } catch {}
  };

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
  const [customerCompanyIds, setCustomerCompanyIds] = useState<Set<string>>(new Set());
  const [customerStageFilter, setCustomerStageFilter] = useState<'all' | 'leads' | 'customers'>('all');
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

  // Load Form Submissions & Definitions & Customer Status
  const loadSubmissions = async () => {
    if (!db) return;
    setLoadingSubmissions(true);
    setSubmissionError('');
    try {
      const [subRes, formRes, custRes] = await Promise.all([
        db.from('diagnosis_submissions').select('*').order('submitted_at', { ascending: false }).limit(200),
        db.from('diagnosis_forms').select('id,name,form_type,public_slug,definition'),
        db.from('customers').select('company_id'),
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

      if (custRes.data) {
        setCustomerCompanyIds(new Set(custRes.data.map((c: any) => c.company_id).filter(Boolean)));
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
      const isContracted = sub.company_id ? customerCompanyIds.has(sub.company_id) : false;
      if (customerStageFilter === 'customers' && !isContracted) return false;
      if (customerStageFilter === 'leads' && isContracted) return false;
      if (!formSearchQuery.trim()) return true;
      const q = formSearchQuery.toLowerCase();
      const name = (sub.respondent_name || '').toLowerCase();
      const email = (sub.respondent_email || '').toLowerCase();
      const company = (sub.respondent_company_name || '').toLowerCase();
      const formName = (formsMeta.get(sub.form_id)?.name || '').toLowerCase();
      return name.includes(q) || email.includes(q) || company.includes(q) || formName.includes(q);
    });
  }, [submissions, formFilterStatus, customerStageFilter, formSearchQuery, formsMeta, customerCompanyIds]);

  const totalInboundNeedsAttention =
    counts.lineInbound + counts.dmInboundWaiting + counts.formsReceived;

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">
          統合受信トレイ
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              void loadCounts();
              void loadSubmissions();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer"
            title="最新の受信状態を再読み込み"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>更新</span>
          </button>
          <button
            onClick={() => onNavigateTab('leads')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            <span>反響リード</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={() => onNavigateTab('customers')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            <span>契約顧客台帳</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={() => onNavigateTab('document_templates')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-purple-600" />
            <span>書類・提案書作成</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={() => onNavigateTab('communication_send')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-xs font-medium text-white transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>送信センター</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Channel Navigation Tabs (統合タブバー・件数集約) ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => handleSelectChannel('forms')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeChannel === 'forms'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className={`w-4 h-4 ${activeChannel === 'forms' ? 'text-white' : 'text-emerald-600'}`} />
          <span>フォーム・無料診断回答</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeChannel === 'forms' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'
          }`}>
            {counts.formsTotal}件
          </span>
          {counts.formsReceived > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeChannel === 'forms' ? 'bg-amber-300 text-amber-950' : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
            }`}>
              未対応 {counts.formsReceived}
            </span>
          )}
        </button>

        <button
          onClick={() => handleSelectChannel('line')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeChannel === 'line'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className={`w-4 h-4 ${activeChannel === 'line' ? 'text-white' : 'text-emerald-600'}`} />
          <span>LINE公式チャット</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeChannel === 'line' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'
          }`}>
            {counts.lineTotal}通
          </span>
          {counts.lineInbound > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeChannel === 'line' ? 'bg-emerald-300 text-emerald-950' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              受信 {counts.lineInbound}
            </span>
          )}
        </button>

        <button
          onClick={() => handleSelectChannel('email')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeChannel === 'email'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Mail className={`w-4 h-4 ${activeChannel === 'email' ? 'text-white' : 'text-sky-600'}`} />
          <span>メール受信箱</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeChannel === 'email' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'
          }`}>
            {counts.emailTotal}通
          </span>
        </button>

        <button
          onClick={() => handleSelectChannel('social_dm')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeChannel === 'social_dm'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Share2 className={`w-4 h-4 ${activeChannel === 'social_dm' ? 'text-white' : 'text-purple-600'}`} />
          <span>SNS DM営業・受信</span>
          {counts.dmInboundWaiting > 0 ? (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeChannel === 'social_dm' ? 'bg-purple-300 text-purple-950' : 'bg-purple-100 text-purple-800 border border-purple-300 animate-pulse'
            }`}>
              返信待ち {counts.dmInboundWaiting}
            </span>
          ) : (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeChannel === 'social_dm' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-700'
            }`}>
              0件
            </span>
          )}
        </button>
      </div>

      {/* ── Notification & Alert Banners ── */}
      {submissionNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between">
          <span>{submissionNotice}</span>
          <button onClick={() => setSubmissionNotice('')} className="text-emerald-600 hover:text-emerald-800 font-bold">
            ×
          </button>
        </div>
      )}
      {submissionError && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
          <span>{submissionError}</span>
          <button onClick={() => setSubmissionError('')} className="text-rose-600 hover:text-rose-800 font-bold">
            ×
          </button>
        </div>
      )}

      {/* ── Active Channel View ── */}
      {/* 1. FORMS & DIAGNOSIS SUBMISSIONS */}
      {activeChannel === 'forms' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Lifecycle Stage Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setCustomerStageFilter('all')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    customerStageFilter === 'all'
                      ? 'bg-purple-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  全対象 ({submissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerStageFilter('leads')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                    customerStageFilter === 'leads'
                      ? 'bg-purple-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>反響・リード</span>
                  <span className="text-[10px] opacity-75">
                    ({submissions.filter((s) => !s.company_id || !customerCompanyIds.has(s.company_id)).length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerStageFilter('customers')}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                    customerStageFilter === 'customers'
                      ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3 h-3 text-emerald-200" />
                  <span>契約中クライアント</span>
                  <span className="text-[10px] opacity-75">
                    ({submissions.filter((s) => s.company_id && customerCompanyIds.has(s.company_id)).length})
                  </span>
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> 状態:
                </span>
                {[
                  { key: 'all', label: `すべて` },
                  {
                    key: 'received',
                    label: `未対応 (${submissions.filter((s) => s.status === 'received').length})`,
                    color: 'text-amber-700 font-bold',
                  },
                  { key: 'reviewing', label: `対応中 (${submissions.filter((s) => s.status === 'reviewing').length})` },
                  { key: 'completed', label: `完了 (${submissions.filter((s) => s.status === 'completed').length})` },
                  { key: 'rejected', label: `対象外 (${submissions.filter((s) => s.status === 'rejected').length})` },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setFormFilterStatus(filter.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      formFilterStatus === filter.key
                        ? 'bg-slate-900 text-white font-semibold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={filter.color}>{filter.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formSearchQuery}
                onChange={(e) => setFormSearchQuery(e.target.value)}
                placeholder="回答者名・会社名・メール検索..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Submissions List */}
          {loadingSubmissions ? (
            <div className="p-12 text-center text-sm text-slate-500 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
              回答データを読み込み中...
            </div>
          ) : visibleSubmissions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-xs">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-800">該当する回答データはありません。</p>
              <p className="text-xs text-slate-500 mt-1">
                HPや公開診断フォームからの回答を受信すると、ここに即時蓄積されます。
              </p>
              <button
                onClick={() => onNavigateTab('mst_diagnoses')}
                className="mt-4 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-xs text-purple-700 font-semibold border border-purple-200 transition cursor-pointer"
              >
                フォーム・診断の公開設定を確認する
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSubmissions.map((sub) => {
                const form = formsMeta.get(sub.form_id);
                const isExpanded = expandedSubmissionId === sub.id;
                const isContracted = sub.company_id ? customerCompanyIds.has(sub.company_id) : false;
                const statusBadge =
                  sub.status === 'received'
                    ? { label: '未対応（新規受付）', color: 'bg-amber-50 text-amber-800 border-amber-300' }
                    : sub.status === 'reviewing'
                    ? { label: '対応中', color: 'bg-purple-50 text-purple-700 border-purple-300' }
                    : sub.status === 'completed'
                    ? { label: '完了', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' }
                    : { label: '対象外', color: 'bg-slate-100 text-slate-600 border-slate-300' };

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-purple-300 transition-all shadow-xs"
                  >
                    {/* Upper row: Respondent info & status */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                          {isContracted ? (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              契約中クライアント
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                              反響リード
                            </span>
                          )}
                          <span className="text-sm font-bold text-slate-900">
                            {sub.respondent_name || sub.respondent_email || '回答者（氏名未入力）'}
                          </span>
                          {sub.respondent_company_name && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                              {sub.respondent_company_name}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            受付日時: {new Date(sub.submitted_at).toLocaleString('ja-JP')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                          <span>
                            フォーム: <strong className="text-slate-800">{form?.name || sub.form_id.slice(0, 8)}</strong>
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
                              <span className="text-purple-700 font-semibold">診断スコア: {sub.score}点</span>
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
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-xs"
                        >
                          <option value="received">未対応（受付）</option>
                          <option value="reviewing">対応中</option>
                          <option value="completed">完了</option>
                          <option value="rejected">対象外</option>
                        </select>

                        {/* Customer Workspace Shortcut for Contracted Clients */}
                        {isContracted && sub.company_id && (
                          <button
                            type="button"
                            onClick={() => onOpenCustomerWorkspace?.(sub.company_id!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-300 shadow-xs transition cursor-pointer"
                            title="契約顧客カルテ・支援タスクを開く"
                          >
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>顧客カルテ</span>
                          </button>
                        )}

                        {/* 1-click Lead Conversion */}
                        {!sub.lead_id ? (
                          <button
                            onClick={() => void handleConvertToLead(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                            title="この回答内容を営業リード台帳に登録"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>反響リードに登録</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigateTab('leads')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-700 border border-purple-200 transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                            <span>リード登録済</span>
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
                                sendKind: isContracted ? 'customer_meeting' : 'deal',
                              });
                            }
                            onNavigateTab(isContracted ? 'customer_meeting_invitations' : 'deal_invitations');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          <span>{isContracted ? '面談案内' : '商談案内'}</span>
                        </button>

                        {/* Direct Proposal & Report Creation */}
                        <button
                          onClick={() => {
                            if (onOpenCustomerWorkspace && sub.company_id) {
                              onOpenCustomerWorkspace(sub.company_id, 'documents');
                            } else {
                              onNavigateTab('document_templates');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-200 transition cursor-pointer"
                          title="フォーム回答を基に重要書類（診断レポート・提案書）を直接AI生成・作成します"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>提案書・レポート作成</span>
                        </button>

                        {/* Expand Details Toggle */}
                        <button
                          onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer"
                        >
                          <span>{isExpanded ? '回答を閉じる' : '回答を見る'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Answer Questionnaire Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
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
                                      className="grid sm:grid-cols-[220px_1fr] gap-2 p-3 rounded-lg bg-white border border-slate-200 text-xs"
                                    >
                                      <div className="font-semibold text-slate-600 break-words">
                                        {questionLabel}
                                      </div>
                                      <div className="text-slate-900 whitespace-pre-wrap break-words font-sans">
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
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                          />
                          <span className="text-[11px] text-slate-400 self-center">
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>
                LINE公式アカウントの1:1個別チャット画面です。友だちへの個別返信やメッセージ履歴を閲覧できます。
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('contacts')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-xs transition cursor-pointer"
              >
                <TagIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>友だち・タグ管理</span>
              </button>
              <button
                onClick={() => onNavigateTab('marketing_automation')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                title="マーケティング自動化のLINE設定へ"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>ウェルカムFlex・自動返信設定へ</span>
              </button>
            </div>
          </div>

          <MarketingLineInboxView
            initialLineUserId={initialLineUserId}
            chatOnly={true}
            onNavigateSettings={() => onNavigateTab('marketing_automation')}
          />
        </div>
      )}

      {/* 3. EMAIL INBOX */}
      {activeChannel === 'email' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-purple-200 bg-purple-50/70 text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <span>
                受信用メールアドレス宛に届いたお問い合わせやアウトリーチ返信を閲覧・管理します。
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('communication_send')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200 shadow-xs transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-purple-600" />
              <span>送信センター（返信・商談案内）を開く</span>
            </button>
          </div>

          <MarketingEmailInboxView />
        </div>
      )}

      {/* 4. SOCIAL DM STUDIO */}
      {activeChannel === 'social_dm' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-purple-200 bg-purple-50/70 text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
              <span>
                SNSから届いたDM・問い合わせの受信トレイです。テンプレ選択や手動返信、CRM見込み客登録を行えます。
              </span>
            </div>
            <button
              onClick={() => {
                try {
                  localStorage.setItem('ai_acquisition_active_tab', 'social_studio');
                  localStorage.setItem('social_studio_mode', 'dm_sales');
                } catch {}
                onNavigateTab('ai_acquisition', { acquisitionTab: 'social_studio', studioMode: 'dm_sales' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>🎯 攻めのDM営業（リストアップ・テンプレ送信）へ</span>
            </button>
          </div>

          <SocialDmSalesStudio mode="inbound" onNavigateTab={onNavigateTab} />
        </div>
      )}
    </div>
  );
};
