import React, { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { 
  Inbox, 
  MessageSquare, 
  Mail, 
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
  Users,
  Trash2,
  Square,
  X
} from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import { UnifiedNavTab } from '../UnifiedNavbar';
import { MarketingLineInboxView } from '../marketing/MarketingLineInboxView';
import { MarketingEmailInboxView } from '../marketing/MarketingEmailInboxView';
import { useSendDrawer } from '../../context/SendDrawerContext';
import { useVisiblePolling } from '../../hooks/useInboxRealtime';
import { MeetingSessionView } from '../meeting/MeetingSessionView';
import { countUnreadEmails, loadLocalReadEmailIds } from '../../utils/inboxReadState';

export type InboxChannel = 'line' | 'email' | 'forms';

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
  initialCompanyId?: string;
  initialLeadId?: string;
  initialFormTypeFilter?: 'all' | 'diagnosis' | 'inquiry';
  onNavigateTab: (tab: any, options?: any) => void;
  onOpenSendCenter?: (params: { companyId?: string; contactId?: string; formId?: string; sendKind?: 'announcement' | 'customer_meeting' | 'deal' | 'diagnosis' | 'form' }) => void;
  onOpenCustomerWorkspace?: (companyId: string, destination?: string) => void;
  onClearCompanyFilter?: () => void;
}

export const UnifiedInboxView: React.FC<UnifiedInboxViewProps> = ({
  initialChannel = 'forms',
  initialLineUserId,
  initialCompanyId,
  initialLeadId,
  initialFormTypeFilter = 'all',
  onNavigateTab,
  onOpenSendCenter,
  onOpenCustomerWorkspace,
  onClearCompanyFilter,
}) => {
  const db = getSupabase();
  const { openSendDrawer } = useSendDrawer();
  const [activeChannel, setActiveChannel] = useState<InboxChannel>(() => {
    if (initialChannel && initialChannel !== 'forms') return initialChannel;
    try {
      const saved = localStorage.getItem('unified_inbox_active_channel') as InboxChannel | null;
      if (saved && ['line', 'email', 'forms'].includes(saved)) {
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
    lineUnread: 0,
    emailTotal: 0,
    emailUnread: 0,
    formsTotal: 0,
    formsReceived: 0,
  });

  // Forms & Submissions state
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [formsMeta, setFormsMeta] = useState<Map<string, FormMeta>>(new Map());
  const [customerCompanyIds, setCustomerCompanyIds] = useState<Set<string>>(new Set());
  const [customerStageFilter, setCustomerStageFilter] = useState<'all' | 'leads' | 'customers'>('all');
  const [formFilterStatus, setFormFilterStatus] = useState<string>('all');
  const [formTypeCategory, setFormTypeCategory] = useState<'all' | 'diagnosis' | 'inquiry'>(initialFormTypeFilter || 'all');
  const [filterCompanyId, setFilterCompanyId] = useState<string | undefined>(initialCompanyId);
  const [filterLeadId, setFilterLeadId] = useState<string | undefined>(initialLeadId);
  const [formSearchQuery, setFormSearchQuery] = useState('');
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [reportingIds, setReportingIds] = useState<string[]>([]);
  const reportControllersRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    if (initialCompanyId !== undefined) {
      setFilterCompanyId(initialCompanyId);
      // 顧客指定で遷移した際はステージやステータスの絞り込みを全対象に初期化し、見落としを防止
      setCustomerStageFilter('all');
      setFormFilterStatus('all');
      setFormTypeCategory('all');
    }
  }, [initialCompanyId]);

  useEffect(() => {
    if (initialLeadId !== undefined) {
      setFilterLeadId(initialLeadId);
      setCustomerStageFilter('all');
      setFormFilterStatus('all');
    }
  }, [initialLeadId]);

  useEffect(() => {
    if (initialFormTypeFilter !== undefined) {
      setFormTypeCategory(initialFormTypeFilter);
    }
  }, [initialFormTypeFilter]);

  const handleCancelReport = (subId: string) => {
    const ctrl = reportControllersRef.current.get(subId);
    if (ctrl) {
      ctrl.abort();
      reportControllersRef.current.delete(subId);
    }
    setReportingIds((prev) => prev.filter((id) => id !== subId));
  };
  const [reportVersions, setReportVersions] = useState<Record<string, number>>({});
  const [meetingSub, setMeetingSub] = useState<SubmissionItem | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [deletingSubmissions, setDeletingSubmissions] = useState(false);
  const [noticeAction, setNoticeAction] = useState<{ label: string; run: () => void } | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [submissionError, setSubmissionError] = useState('');

  // Fetch summary counts for the touchpoints (LINE, Email, Forms)
  // 件数だけを取得する（head: true）。以前は全行を取得して数えていたため、件数が増えるほど重くなっていた。
  const loadCounts = async () => {
    if (!db) return;
    try {
      const countOf = (table: string, filter?: (query: any) => any) => {
        let query: any = db.from(table).select('id', { count: 'exact', head: true });
        if (filter) query = filter(query);
        return query;
      };
      const [lineTotalRes, lineUnreadRes, emailRes, subTotalRes, subReceivedRes] = await Promise.all([
        countOf('line_inbox_messages'),
        countOf('line_inbox_messages', (query) => query.eq('direction', 'inbound').neq('status', 'read')),
        countOf('email_inbox_messages'),
        countOf('diagnosis_submissions'),
        countOf('diagnosis_submissions', (query) => query.eq('status', 'received')),
      ]);

      let emailTotal: number = emailRes.count || 0;
      let emailUnread = 0;
      try {
        const authHeaders = await getAuthHeaders();
        const emailApiRes = await fetch('/api/inbox/email/messages?countOnly=1', { headers: authHeaders });
        if (emailApiRes.ok) {
          const emailData = await emailApiRes.json();
          if (!emailTotal && typeof emailData.count === 'number') {
            emailTotal = emailData.count;
          }
          if (typeof emailData.unreadCount === 'number') {
            emailUnread = emailData.unreadCount;
          } else if (emailTotal > 0) {
            const listRes = await fetch('/api/inbox/email/messages?light=1&messagesOnly=1', { headers: authHeaders });
            if (listRes.ok) {
              const listData = await listRes.json();
              if (Array.isArray(listData.messages)) {
                emailUnread = countUnreadEmails(listData.messages, loadLocalReadEmailIds());
              }
            }
          }
        }
      } catch {}

      const next = {
        lineTotal: (lineTotalRes.count as number | null) || 0,
        lineUnread: (lineUnreadRes.count as number | null) || 0,
        emailTotal,
        emailUnread,
        formsTotal: (subTotalRes.count as number | null) || 0,
        formsReceived: (subReceivedRes.count as number | null) || 0,
      };
      // 数字が変わっていなければ再描画しない
      setCounts((prev) =>
        prev.lineTotal === next.lineTotal &&
        prev.lineUnread === next.lineUnread &&
        prev.emailTotal === next.emailTotal &&
        prev.emailUnread === next.emailUnread &&
        prev.formsTotal === next.formsTotal &&
        prev.formsReceived === next.formsReceived
          ? prev
          : next
      );
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
        const loaded = (subRes.data || []) as SubmissionItem[];
        setSubmissions(loaded);

        // 診断レポートが作成済みの回答を調べる（ボタンを「作成済み」に切り替えるため）
        const diagnosisIds = Array.from(new Set(loaded.map((item) => item.diagnosis_id).filter(Boolean))) as string[];
        if (diagnosisIds.length) {
          const reportRes = await db
            .from('ai_reports')
            .select('diagnosis_id,version')
            .in('diagnosis_id', diagnosisIds)
            .eq('is_latest', true);
          if (reportRes.error) {
            console.warn('ai_reports load failed:', reportRes.error.message);
            setSubmissionError(`診断レポートの作成状況を取得できませんでした: ${reportRes.error.message}`);
          } else {
            const versions: Record<string, number> = {};
            (reportRes.data || []).forEach((row: any) => {
              versions[String(row.diagnosis_id)] = Number(row.version) || 1;
            });
            setReportVersions(versions);
          }
        } else {
          setReportVersions({});
        }
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

  // バッジ集計の自動更新: 60秒ごと。タブが非表示の間は止まり、表示に戻ったときに更新する。
  useVisiblePolling(loadCounts, 60_000);

  // 診断フォームの回答から、AIが診断レポート(D0〜D5)を自動作成する。提案書は商談後に別の操作で作る
  const handleGenerateReport = async (sub: SubmissionItem, force = false): Promise<void> => {
    setReportingIds((prev) => (prev.includes(sub.id) ? prev : [...prev, sub.id]));
    setSubmissionNotice('');
    setSubmissionError('');
    setNoticeAction(null);
    const controller = new AbortController();
    reportControllersRef.current.set(sub.id, controller);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/diagnosis-submissions/${encodeURIComponent(sub.id)}/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: controller.signal,
        body: JSON.stringify({ force }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'レポートを作成できませんでした。');

      if (result.alreadyExists) {
        // 画面の表示が古かった場合。作り直さず、作成済みの表示に切り替える
        setReportVersions((prev) => ({ ...prev, [String(result.diagnosisId)]: Number(result.reportVersion) || 1 }));
        setSubmissions((prev) => prev.map((item) => (item.id === sub.id ? { ...item, diagnosis_id: result.diagnosisId } : item)));
        return;
      }

      const name = sub.respondent_company_name || sub.respondent_name || '回答者';
      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === sub.id
            ? { ...item, diagnosis_id: result.diagnosisId, status: item.status === 'received' ? 'reviewing' : item.status }
            : item
        )
      );
      setSubmissionNotice(
        `「${name}」の診断レポート（v${result.version}）` +
          'を作成しました。書類で内容を確認し、承認してから送信してください。提案書は、商談後に書類の画面から作成します。' +
          (result.documentSynced ? '' : '（書類台帳への登録だけ失敗しました）')
      );
      setReportVersions((prev) => ({ ...prev, [String(result.diagnosisId)]: Number(result.version) || 1 }));
      void loadCounts();
      const companyId = result.companyId || sub.company_id;
      setNoticeAction({
        label: '書類を確認する',
        run: () => onNavigateTab('document_templates', { context: companyId ? { companyId } : undefined }),
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        const name = sub.respondent_company_name || sub.respondent_name || '回答者';
        setSubmissionNotice(`「${name}」のレポート生成を中断しました。`);
        return;
      }
      setSubmissionError(err?.message || 'レポートを作成できませんでした。');
    } finally {
      reportControllersRef.current.delete(sub.id);
      setReportingIds((prev) => prev.filter((id) => id !== sub.id));
    }
  };

  // 選択した回答を削除する（テスト回答の整理用）
  const handleDeleteSelectedSubmissions = async () => {
    const ids = selectedSubmissionIds.filter((id) => submissions.some((item) => item.id === id));
    if (ids.length === 0) return;
    const withReport = submissions.filter(
      (item) => ids.includes(item.id) && item.diagnosis_id && reportVersions[item.diagnosis_id]
    ).length;
    const message =
      `選択した${ids.length}件の回答を削除します。元に戻せません。` +
      (withReport > 0
        ? `\n\nレポート作成済みの${withReport}件は、回答だけが消え、診断・レポート・書類は残ります。`
        : '') +
      '\n\nよろしいですか？';
    if (!window.confirm(message)) return;

    setDeletingSubmissions(true);
    setSubmissionNotice('');
    setSubmissionError('');
    setNoticeAction(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/inbox/form-submissions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ids }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '回答を削除できませんでした。');
      const deleted = new Set<string>((result.deletedIds || []).map(String));
      setSubmissions((prev) => prev.filter((item) => !deleted.has(item.id)));
      setSelectedSubmissionIds((prev) => prev.filter((id) => !deleted.has(id)));
      setExpandedSubmissionId((current) => (current && deleted.has(current) ? null : current));
      const failed = ids.length - deleted.size;
      setSubmissionNotice(`${deleted.size}件の回答を削除しました。` + (failed > 0 ? `（${failed}件は削除できませんでした）` : ''));
      void loadCounts();
    } catch (err: any) {
      setSubmissionError(err?.message || '回答を削除できませんでした。');
    } finally {
      setDeletingSubmissions(false);
    }
  };

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
      const effectiveCompName = sub.respondent_company_name?.trim() || (sub.respondent_name ? `${sub.respondent_name}様（個人）` : '新規反響企業（フォーム経由）');

      // 1. Check or create company with valid CID
      let companyId = sub.company_id;
      if (!companyId) {
        const { data: existingComp } = await db
          .from('companies')
          .select('id')
          .eq('company_name', effectiveCompName)
          .maybeSingle();

        if (existingComp?.id) {
          companyId = existingComp.id;
        } else {
          const { data: existingCids } = await db
            .from('companies')
            .select('id')
            .like('id', 'CID-%')
            .limit(2000);
          const maxNum = Math.max(0, ...(existingCids || []).map((row: any) => Number(String(row.id).match(/^CID-(\d+)$/)?.[1] || 0)));
          const nextCid = `CID-${String(maxNum + 1).padStart(3, '0')}`;

          const { data: comp, error: compErr } = await db
            .from('companies')
            .insert({
              id: nextCid,
              company_name: effectiveCompName,
              contact_name: sub.respondent_name || null,
              email: sub.respondent_email || null,
            })
            .select('id')
            .single();

          if (!compErr && comp) {
            companyId = comp.id;
          } else if (compErr) {
            console.error('Failed to create company:', compErr);
            throw new Error(`会社マスタの作成に失敗しました: ${compErr.message}`);
          }
        }
      }

      // 2. Check or create contact
      let contactId = sub.contact_id;
      if (!contactId && (sub.respondent_name || sub.respondent_email)) {
        if (sub.respondent_email) {
          const { data: existingContact } = await db
            .from('contacts')
            .select('id')
            .eq('email', sub.respondent_email.trim().toLowerCase())
            .maybeSingle();
          if (existingContact?.id) {
            contactId = existingContact.id;
          }
        }
        if (!contactId) {
          const { data: newContact, error: cErr } = await db
            .from('contacts')
            .insert({
              full_name: sub.respondent_name || 'フォーム回答者',
              email: sub.respondent_email || null,
              company_id: companyId || null,
              source: 'public_form',
            })
            .select('id')
            .single();
          if (!cErr && newContact) {
            contactId = newContact.id;
          }
        }
      }

      // 3. Insert Lead (with fallback for schema mismatch)
      const leadPayload: Record<string, any> = {
        company_id: companyId,
        contact_id: contactId || null,
        source: 'Webフォーム',
        status: '新規',
        service_type: formMeta?.name || 'フォーム回答',
        notes: `【フォーム・診断回答より自動リード化】\n会社名: ${effectiveCompName}\n回答者: ${sub.respondent_name || '未記入'} (${sub.respondent_email || 'メール未記入'})\n受付日時: ${new Date(sub.submitted_at).toLocaleString('ja-JP')}`,
        first_registered_at: new Date().toISOString(),
        last_contacted_at: new Date().toISOString(),
      };

      let newLeadId: string | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: newLead, error: leadErr } = await db
          .from('leads')
          .insert(leadPayload)
          .select('id')
          .single();

        if (!leadErr && newLead?.id) {
          newLeadId = newLead.id;
          break;
        }

        const errMsg = leadErr?.message || '';
        const match = errMsg.match(/Could not find the '([^']+)' column/i) || errMsg.match(/column "([^"]+)" of relation/i);
        if (match && match[1] && match[1] in leadPayload) {
          delete leadPayload[match[1]];
          continue;
        }
        throw new Error(`リード作成に失敗しました: ${errMsg}`);
      }

      if (!newLeadId) {
        throw new Error('リード作成に失敗しました');
      }

      // 4. Update Submission with lead_id, company_id & contact_id
      await db
        .from('diagnosis_submissions')
        .update({
          lead_id: newLeadId,
          company_id: companyId,
          contact_id: contactId,
          status: 'reviewing',
        })
        .eq('id', sub.id);

      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, lead_id: newLeadId!, company_id: companyId, contact_id: contactId, status: 'reviewing' } : s))
      );
      setSubmissionNotice(`「${effectiveCompName}」を反響リードに登録しました。リード一覧で詳細確認やフォローが可能です。`);
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

  // フォーム回答の明確な種別判定（無料診断 vs 資料請求 vs お問い合わせ・相談）
  const getSubmissionCategory = (sub: SubmissionItem): 'diagnosis' | 'material' | 'inquiry' => {
    const form = formsMeta.get(sub.form_id);
    const answers = (sub.answers || {}) as Record<string, unknown>;

    // 1. 資料請求（material）の明示的判定:
    // - public_slug が material-download
    // - フォーム名に「資料」を含む
    // - answers に material_keys / material_choice / choice_label がある
    // - inquiryType が material または care_package
    if (
      form?.public_slug === 'material-download' ||
      (form?.name && form.name.includes('資料')) ||
      (form?.definition as any)?.category === '資料請求' ||
      Boolean(answers.material_keys) ||
      Boolean(answers.material_choice) ||
      answers.inquiryType === 'material' ||
      answers.inquiryType === 'care_package'
    ) {
      return 'material';
    }

    // 2. お問い合わせ・経営相談（inquiry）の明示的判定:
    // - public_slug が contact-inquiry
    // - form_type が consultation または meeting
    // - フォーム名に「お問い合わせ」または「相談」を含み、「診断」を含まない
    // - answers に service_interest や message がある
    if (
      form?.public_slug === 'contact-inquiry' ||
      form?.form_type === 'consultation' ||
      form?.form_type === 'meeting' ||
      (form?.name && (form.name.includes('お問い合わせ') || form.name.includes('相談')) && !form.name.includes('診断')) ||
      Boolean(answers.service_interest) ||
      answers.inquiryType === 'consultation'
    ) {
      return 'inquiry';
    }

    // 3. 無料診断（diagnosis）の判定:
    // 経営診断特有の急所設問（q_ops_bottleneck, q_profit_bottleneck, q_delay_reason, q_ideal_future など）があるか、
    // または form_type が diagnosis / 診断専用フォームの場合のみ
    const hasCoreDiagnosisQuestions = Boolean(
      answers.q_ops_bottleneck ||
      answers.q_profit_bottleneck ||
      answers.q_delay_reason ||
      answers.q_ideal_future ||
      Object.keys(answers).some((k) => k.includes('bottleneck') || k === 'q_bottleneck')
    );

    if (
      form?.form_type === 'diagnosis' ||
      form?.public_slug === 'business-diagnosis' ||
      (form?.name && (form.name.includes('診断') || form.name.toLowerCase().includes('diagnosis'))) ||
      hasCoreDiagnosisQuestions
    ) {
      return 'diagnosis';
    }

    // 4. それ以外（一般的なフォーム回答）はすべて「お問い合わせ・相談」として扱う
    return 'inquiry';
  };

  // 無料診断のみを抽出する判定
  const isDiagnosisSubmission = (sub: SubmissionItem): boolean => {
    return getSubmissionCategory(sub) === 'diagnosis';
  };

  const diagnosisCount = useMemo(() => {
    return submissions.filter(isDiagnosisSubmission).length;
  }, [submissions, formsMeta]);

  // 資料請求およびお問い合わせ相談を「お問い合わせ・相談のみ」として集約カウント
  const inquiryCount = useMemo(() => {
    return submissions.filter((s) => !isDiagnosisSubmission(s)).length;
  }, [submissions, formsMeta]);

  const matchedCompanyName = useMemo(() => {
    if (!filterCompanyId) return undefined;
    const fromSub = submissions.find((s) => s.company_id === filterCompanyId && s.respondent_company_name)?.respondent_company_name;
    return fromSub || undefined;
  }, [filterCompanyId, submissions]);

  // Base filtered submissions (before status filter, so status badge counts match active category/stage/search)
  const statusBaseSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (filterCompanyId) {
        const matchesCompany = sub.company_id === filterCompanyId;
        const matchesLead = filterLeadId ? sub.lead_id === filterLeadId : false;
        if (!matchesCompany && !matchesLead) return false;
      } else if (filterLeadId) {
        if (sub.lead_id !== filterLeadId) return false;
      }

      if (formTypeCategory === 'diagnosis' && !isDiagnosisSubmission(sub)) return false;
      if (formTypeCategory === 'inquiry' && isDiagnosisSubmission(sub)) return false;

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
  }, [submissions, customerStageFilter, formTypeCategory, formSearchQuery, formsMeta, customerCompanyIds, filterCompanyId, filterLeadId]);

  // Filtered submissions
  const visibleSubmissions = useMemo(() => {
    const list = statusBaseSubmissions.filter((sub) => {
      if (formFilterStatus !== 'all' && sub.status !== formFilterStatus) return false;
      return true;
    });

    // もし特定リードからの遷移の場合、そのリードに該当する回答を最上位に並べ替える
    if (filterLeadId) {
      return [...list].sort((a, b) => {
        const aIsLead = a.lead_id === filterLeadId ? 1 : 0;
        const bIsLead = b.lead_id === filterLeadId ? 1 : 0;
        if (aIsLead !== bIsLead) return bIsLead - aIsLead;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
    }

    return list;
  }, [statusBaseSubmissions, formFilterStatus, filterLeadId]);

  const statusCountsInScope = useMemo(() => {
    let received = 0;
    let reviewing = 0;
    let completed = 0;
    let rejected = 0;
    for (const s of statusBaseSubmissions) {
      if (s.status === 'received') received += 1;
      else if (s.status === 'reviewing') reviewing += 1;
      else if (s.status === 'completed') completed += 1;
      else if (s.status === 'rejected') rejected += 1;
    }
    return { total: statusBaseSubmissions.length, received, reviewing, completed, rejected };
  }, [statusBaseSubmissions]);

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
            onClick={() => openSendDrawer({ kind: 'announcement' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-xs font-medium text-white transition cursor-pointer"
            title="受信トレイを離れずに右側の送信ドロワーで個別連絡を作成します"
          >
            <Send className="w-3.5 h-3.5" />
            <span>個別送信（ドロワー）</span>
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
              未対応 {counts.formsReceived}件
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
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            counts.lineUnread > 0
              ? activeChannel === 'line'
                ? 'bg-emerald-300 text-emerald-950'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : activeChannel === 'line'
                ? 'bg-purple-700/70 text-purple-200'
                : 'bg-slate-100 text-slate-500'
          }`}>
            未読 {counts.lineUnread}件
          </span>
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
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            counts.emailUnread > 0
              ? activeChannel === 'email'
                ? 'bg-sky-300 text-sky-950'
                : 'bg-sky-100 text-sky-800 border border-sky-300'
              : activeChannel === 'email'
                ? 'bg-purple-700/70 text-purple-200'
                : 'bg-slate-100 text-slate-500'
          }`}>
            未読 {counts.emailUnread}件
          </span>
        </button>
      </div>

      {/* ── Notification & Alert Banners ── */}
      {submissionNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center justify-between">
          <span>{submissionNotice}</span>
          <div className="flex items-center gap-3 shrink-0 pl-3">
            {noticeAction && (
              <button
                onClick={noticeAction.run}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                {noticeAction.label}
              </button>
            )}
            <button onClick={() => { setSubmissionNotice(''); setNoticeAction(null); }} className="text-emerald-600 hover:text-emerald-800 font-bold">
              ×
            </button>
          </div>
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
          {/* 特定顧客（会社/リード）絞り込み中バナー */}
          {(filterCompanyId || filterLeadId) && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900">
                    {matchedCompanyName ? `「${matchedCompanyName}」` : '特定顧客'} のフォーム回答履歴
                  </span>
                  <span className="ml-1 text-purple-800 font-semibold">
                    ({visibleSubmissions.length} 件)
                  </span>
                  <span className="ml-2 text-slate-500 font-normal hidden sm:inline">
                    ※ リード・商談・契約のどこから遷移しても、同一顧客（会社）の全回答履歴を一貫して表示しています
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterCompanyId(undefined);
                  setFilterLeadId(undefined);
                  onClearCompanyFilter?.();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-purple-100 text-purple-700 font-semibold border border-purple-200 cursor-pointer shadow-2xs transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>すべての回答を表示（絞り込み解除）</span>
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            {/* Top row: フォーム種別フィルター & 検索窓 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 mr-0.5 flex items-center gap-1">
                  種別:
                </span>
                <div className="flex items-center bg-purple-50/70 p-1 rounded-lg border border-purple-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setFormTypeCategory('all')}
                    className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                      formTypeCategory === 'all'
                        ? 'bg-purple-700 text-white font-semibold shadow-xs'
                        : 'text-purple-900 hover:text-purple-950 hover:bg-purple-100/60'
                    }`}
                  >
                    全種別 ({submissions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTypeCategory('diagnosis')}
                    className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                      formTypeCategory === 'diagnosis'
                        ? 'bg-purple-700 text-white font-semibold shadow-xs'
                        : 'text-purple-900 hover:text-purple-950 hover:bg-purple-100/60'
                    }`}
                    title="設問・スコアリングを伴う無料診断フォームの回答のみを抽出"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                    <span>無料診断のみ ({diagnosisCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTypeCategory('inquiry')}
                    className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                      formTypeCategory === 'inquiry'
                        ? 'bg-sky-600 text-white font-semibold shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="お問い合わせ・資料請求・面談相談フォームの回答のみを抽出"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-200" />
                    <span>お問い合わせ・相談のみ ({inquiryCount})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setFormFilterStatus((prev) => (prev === 'received' ? 'all' : 'received'))}
                  aria-pressed={formFilterStatus === 'received'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    formFilterStatus === 'received'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                  title="「未対応」の回答だけを表示します"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>未対応のみ表示 ({statusCountsInScope.received})</span>
                </button>
              </div>

              <div className="relative min-w-[260px]">
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

            {/* Bottom row: 顧客ステージ & ステータスフィルター */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
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
                  { key: 'all', label: `すべて (${statusCountsInScope.total})` },
                  {
                    key: 'received',
                    label: `未対応 (${statusCountsInScope.received})`,
                    color: formFilterStatus === 'received' ? 'text-white font-bold' : 'text-amber-700 font-bold',
                  },
                  { key: 'reviewing', label: `対応中 (${statusCountsInScope.reviewing})` },
                  { key: 'completed', label: `完了 (${statusCountsInScope.completed})` },
                  { key: 'rejected', label: `対象外 (${statusCountsInScope.rejected})` },
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
          </div>

          {/* 選択・削除バー */}
          {!loadingSubmissions && visibleSubmissions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-purple-600"
                  checked={visibleSubmissions.length > 0 && visibleSubmissions.every((item) => selectedSubmissionIds.includes(item.id))}
                  onChange={(e) => {
                    const visibleIds = visibleSubmissions.map((item) => item.id);
                    setSelectedSubmissionIds((prev) =>
                      e.target.checked ? Array.from(new Set([...prev, ...visibleIds])) : prev.filter((id) => !visibleIds.includes(id))
                    );
                  }}
                />
                <span>表示中の{visibleSubmissions.length}件をすべて選択</span>
              </label>
              <div className="flex items-center gap-3">
                {selectedSubmissionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubmissionIds([])}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    選択を解除
                  </button>
                )}
                <button
                  type="button"
                  disabled={selectedSubmissionIds.length === 0 || deletingSubmissions}
                  onClick={() => void handleDeleteSelectedSubmissions()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletingSubmissions ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{selectedSubmissionIds.length > 0 ? `選択した${selectedSubmissionIds.length}件を削除` : '削除する回答を選択'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Submissions List */}
          {loadingSubmissions ? (
            <div className="p-12 text-center text-sm text-slate-500 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
              回答データを読み込み中...
            </div>
          ) : visibleSubmissions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-xs">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                {formFilterStatus === 'received' && statusCountsInScope.total > 0
                  ? '現在、未対応の回答はありません。'
                  : '該当する回答データはありません。'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {formFilterStatus === 'received' && statusCountsInScope.total > 0
                  ? `対応中・完了を含む ${statusCountsInScope.total} 件の回答があります。`
                  : 'HPや公開診断フォームからの回答を受信すると、ここに即時蓄積されます。'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {formFilterStatus === 'received' && statusCountsInScope.total > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormFilterStatus('all')}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs text-white font-semibold shadow-xs transition cursor-pointer"
                  >
                    すべて表示（{statusCountsInScope.total}件）
                  </button>
                )}
                <button
                  onClick={() => onNavigateTab('mst_diagnoses')}
                  className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-xs text-purple-700 font-semibold border border-purple-200 transition cursor-pointer"
                >
                  フォーム作成・配布資料の設定を確認する
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSubmissions.map((sub) => {
                const form = formsMeta.get(sub.form_id);
                const isExpanded = expandedSubmissionId === sub.id;
                const isContracted = sub.company_id ? customerCompanyIds.has(sub.company_id) : false;
                const isDiag = isDiagnosisSubmission(sub);
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
                    className={`rounded-2xl border bg-white p-5 transition-all shadow-xs ${selectedSubmissionIds.includes(sub.id) ? 'border-purple-400 ring-1 ring-purple-200' : 'border-slate-200 hover:border-purple-300'}`}
                  >
                    {/* Upper row: Respondent info & status */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label="この回答を選択"
                            className="h-4 w-4 rounded border-slate-300 accent-purple-600 cursor-pointer"
                            checked={selectedSubmissionIds.includes(sub.id)}
                            onChange={(e) =>
                              setSelectedSubmissionIds((prev) =>
                                e.target.checked ? [...prev, sub.id] : prev.filter((id) => id !== sub.id)
                              )
                            }
                          />
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                          {(() => {
                            const cat = getSubmissionCategory(sub);
                            if (cat === 'diagnosis') {
                              return (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold flex items-center gap-1 border border-purple-200">
                                  <Sparkles className="w-3 h-3 text-purple-600" />
                                  無料診断
                                </span>
                              );
                            }
                            if (cat === 'material') {
                              return (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold flex items-center gap-1 border border-amber-300">
                                  <FileText className="w-3 h-3 text-amber-600" />
                                  資料請求
                                </span>
                              );
                            }
                            return (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 font-medium flex items-center gap-1 border border-sky-200">
                                <FileText className="w-3 h-3 text-sky-600" />
                                お問い合わせ・相談
                              </span>
                            );
                          })()}
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
                          {filterLeadId && sub.lead_id === filterLeadId && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-semibold flex items-center gap-1 shadow-2xs">
                              ★ 選択中リードの回答
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
                            onClick={() => onOpenCustomerWorkspace?.(sub.company_id!, 'support_meetings')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-300 shadow-xs transition cursor-pointer"
                            title="契約顧客の支援状況・定例打ち合わせ履歴を開く"
                          >
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>顧客カルテ・定例</span>
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

                        {/* Meeting Schedule / Communication Send (Drawer) */}
                        <button
                          onClick={() => {
                            if (onOpenSendCenter) {
                              onOpenSendCenter({
                                companyId: sub.company_id || undefined,
                                contactId: sub.contact_id || undefined,
                                formId: sub.form_id,
                                sendKind: isContracted ? 'customer_meeting' : 'deal',
                              });
                            } else {
                              openSendDrawer({
                                kind: isContracted ? 'customer_meeting' : 'deal',
                                companyId: sub.company_id || undefined,
                                contactId: sub.contact_id || undefined,
                                formId: sub.form_id,
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          <span>{isContracted ? '面談案内（ドロワー）' : '商談案内（ドロワー）'}</span>
                        </button>

                        {/* 診断レポート作成（無料診断のみ） / 書類台帳（資料請求・お問い合わせ相談） */}
                        {(() => {
                          const isDiagnosisForm = isDiag;
                          const busy = reportingIds.includes(sub.id);
                          const needsCompany = isDiagnosisForm && !sub.company_id;
                          const reportVersion = sub.diagnosis_id ? reportVersions[sub.diagnosis_id] : undefined;
                          const alreadyCreated = isDiagnosisForm && Boolean(reportVersion);
                          const openDocuments = () =>
                            onNavigateTab('document_templates', { context: sub.company_id ? { companyId: sub.company_id } : undefined });

                          // 資料請求・お問い合わせ相談の場合：診断レポートではなく書類台帳／提案書ひな型への導線を表示
                          if (!isDiagnosisForm) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onOpenCustomerWorkspace && sub.company_id) {
                                    onOpenCustomerWorkspace(sub.company_id, 'documents');
                                  } else {
                                    onNavigateTab('document_templates', { context: sub.company_id ? { companyId: sub.company_id } : undefined });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer"
                                title="重要書類・提案書ひな型を開く"
                              >
                                <FileText className="w-3.5 h-3.5 text-purple-600" />
                                <span>書類台帳を開く</span>
                              </button>
                            );
                          }

                          if (alreadyCreated && !busy) {
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={openDocuments}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                                  title="作成済みの診断レポートを、書類の画面で確認します"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
                                  <span>作成済み（v{reportVersion}）・確認</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMeetingSub(sub)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                                  title="ヒアリングシートと面談メモを開き、画面共有用の表示も開けます"
                                >
                                  <span>商談を始める</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleGenerateReport(sub, true);
                                  }}
                                  className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                  title="AIで診断レポートを最新版として再生成します"
                                >
                                  再生成
                                </button>
                              </>
                            );
                          }

                          if (busy) {
                            return (
                              <div className="inline-flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-800 border border-emerald-200 shadow-2xs">
                                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                                  <span>AIが作成中…</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCancelReport(sub.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 border border-rose-200 transition cursor-pointer shadow-2xs"
                                  title="レポート作成を中断します"
                                >
                                  <Square className="w-3 h-3 fill-current" />
                                  <span>停止</span>
                                </button>
                              </div>
                            );
                          }

                          return (
                            <button
                              type="button"
                              disabled={needsCompany}
                              onClick={() => void handleGenerateReport(sub)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-200 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-50 shadow-2xs"
                              title={
                                needsCompany
                                  ? '会社が紐付いていません。先に「反響リードに登録」を押してください'
                                  : 'この回答をもとに、AIが診断レポートを自動で作成します'
                              }
                            >
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              <span>AI診断レポート作成</span>
                            </button>
                          );
                        })()}

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
        <MarketingLineInboxView
          initialLineUserId={initialLineUserId}
          chatOnly={true}
          onNavigateSettings={() => onNavigateTab('marketing_automation')}
          onNavigateContacts={() => onNavigateTab('contacts')}
          onUnreadCountChange={(unread) =>
            setCounts((prev) => (prev.lineUnread === unread ? prev : { ...prev, lineUnread: unread }))
          }
        />
      )}

      {/* 3. EMAIL INBOX */}
      {activeChannel === 'email' && (
        <MarketingEmailInboxView
          onNavigateSendCenter={() => onNavigateTab('communication_send')}
          onUnreadCountChange={(unread) =>
            setCounts((prev) => (prev.emailUnread === unread ? prev : { ...prev, emailUnread: unread }))
          }
        />
      )}

      {meetingSub && meetingSub.diagnosis_id && (
        <MeetingSessionView
          diagnosisId={meetingSub.diagnosis_id}
          companyId={meetingSub.company_id}
          companyName={meetingSub.respondent_company_name || ''}
          formAnswers={meetingSub.answers}
          onClose={() => setMeetingSub(null)}
        />
      )}
    </div>
  );
};
