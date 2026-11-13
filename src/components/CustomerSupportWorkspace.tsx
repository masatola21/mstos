import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Check, ClipboardList, FileText, Loader2, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../lib/supabaseClient';
import { InlineDeleteButton } from './InlineDeleteButton';
import type { ManagedInvoice } from '../types/matrix';
import type { Priority, TaskItem } from '../types';
import { todayJst } from '../utils/date';

type Row = Record<string, any>;
type SupportDetails = {
  phase?: string;
  phases?: string[];
  purpose?: string;
  startedAt?: string;
  ownerName?: string;
  currentTheme?: string;
  nextTheme?: string;
  nextChecklist?: string;
  keyIssue?: string;
  progressStatus?: 'not_started' | 'on_track' | 'at_risk' | 'delayed' | 'completed';
  progressNote?: string;
};
type MeetingDraft = {
  occurred_at: string;
  purpose: string;
  topic: string;
  discussion: string;
  decisions: string;
  unresolved_items: string;
  client_homework: string;
  mst_homework: string;
  next_topic: string;
  next_meeting_at: string;
};
type TaskDraft = {
  title: string;
  description: string;
  taskOwnerSide: 'client' | 'mst';
  supportAssigneeName: string;
  dueDate: string;
  priority: Priority;
  status: TaskItem['status'];
  supportMeetingId: string;
};

const PHASES = [
  '初回ヒアリング', '現状分析', '課題整理', '改善方針の設計',
  'システム・業務フローの構築', 'テスト・検証', '導入・運用開始',
  '効果測定・改善', '完了',
];
const PURPOSE_OPTIONS: Record<'retainer' | 'implementation_support', string[]> = {
  retainer: ['経営課題の整理と優先順位付け', '売上・利益改善の伴走', '月次経営会議・意思決定支援', '業務改善・標準化'],
  implementation_support: ['業務フローの可視化・再設計', 'システム導入・初期設定', 'AI活用・業務自動化の構築', '導入後のテスト・定着支援'],
};
const THEME_OPTIONS: Record<'retainer' | 'implementation_support', string[]> = {
  retainer: ['経営課題の整理', '売上・利益の改善', '業務改善', '採用・組織づくり', '資金繰り・財務', '次回テーマを決める'],
  implementation_support: ['現状業務の整理', '要件・仕様の確認', 'システム構築', 'テスト・検証', '導入・操作説明', '効果測定・改善', '次回テーマを決める'],
};
const EMPTY_MEETING: MeetingDraft = {
  occurred_at: '', purpose: '', topic: '', discussion: '', decisions: '',
  unresolved_items: '', client_homework: '', mst_homework: '',
  next_topic: '', next_meeting_at: '',
};
const EMPTY_TASK: TaskDraft = {
  title: '', description: '', taskOwnerSide: 'mst', supportAssigneeName: '',
  dueDate: '', priority: 'medium', status: 'waiting', supportMeetingId: '',
};
const PROGRESS_LABELS: Record<NonNullable<SupportDetails['progressStatus']>, string> = {
  not_started: '未着手', on_track: '順調', at_risk: '要確認', delayed: '遅延', completed: '完了',
};
const TASK_STATUS_LABELS: Record<TaskItem['status'], string> = {
  waiting: '未着手', in_progress: '進行中', pending_approval: '確認待ち', completed: '完了', blocked: '保留',
};
const asDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const supportErrorMessage = (error: any, fallback: string) =>
  error?.code === '42P01' || error?.code === '42703'
    ? '支援管理DBのマイグレーションが未適用です。supabase/migrations/20261019030537_customer_support_management.sql を適用してから再読み込みしてください。'
    : error?.message || fallback;
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleString('ja-JP') : '未設定';

interface Props {
  companyId?: string;
  initialSection?: 'overview' | 'meetings' | 'tasks' | 'delivery';
  companies: Row[];
  engagements: Row[];
  invoices: ManagedInvoice[];
  tasks: TaskItem[];
  onCreateTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (task: TaskItem) => void;
  onRefresh: () => Promise<void>;
  onAddMilestone: (engagement: Row, title: string, dueDate?: string) => Promise<void>;
  onCompleteMilestone: (engagement: Row, milestoneId: string) => Promise<void>;
  onDeleteMilestone?: (engagement: Row, milestoneId: string) => Promise<void>;
  onToggleMilestone?: (engagement: Row, milestoneId: string, nextStatus: 'pending' | 'completed') => Promise<void>;
}

export const CustomerSupportWorkspace: React.FC<Props> = ({
  companyId, initialSection, companies, engagements, invoices, tasks,
  onCreateTask, onUpdateTask, onRefresh, onAddMilestone, onCompleteMilestone,
  onDeleteMilestone, onToggleMilestone,
}) => {
  const [selectedId, setSelectedId] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'meetings' | 'tasks' | 'delivery'>(initialSection || 'overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [meetings, setMeetings] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [serviceContracts, setServiceContracts] = useState<Row[]>([]);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>(EMPTY_MEETING);
  const [editingMeetingId, setEditingMeetingId] = useState('');
  const [transcriptInput, setTranscriptInput] = useState('');
  const [organizingTranscript, setOrganizingTranscript] = useState(false);
  const [overwriteWithAi, setOverwriteWithAi] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [milestoneDraft, setMilestoneDraft] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');
  const [customPhaseDraft, setCustomPhaseDraft] = useState('');
  const [showNewSupport, setShowNewSupport] = useState(false);
  const [newSupport, setNewSupport] = useState({
    title: '', company_id: '', contract_id: '', service_type: 'implementation_support',
    purpose: '', startedAt: todayJst(), ownerName: '',
  });
  const [summaryDraft, setSummaryDraft] = useState<SupportDetails>({});

  const selected = engagements.find((row) => row.id === selectedId) || engagements[0] || null;
  const selectedCompanyId = selected?.company_id || '';
  const detail = (selected?.support_details && typeof selected.support_details === 'object'
    ? selected.support_details : {}) as SupportDetails;
  const supportTasks = useMemo(
    () => selected ? tasks.filter((task) => task.supportEngagementId === selected.id) : [],
    [tasks, selected?.id],
  );
  const companyTasks = useMemo(
    () => supportTasks.filter((task) => task.status !== 'completed'),
    [supportTasks],
  );
  const overdueTasks = useMemo(() => companyTasks.filter((task) =>
    task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10)), [companyTasks]);
  const activeContract = selected?.contract_id
    ? serviceContracts.find((item) => item.id === selected.contract_id) : undefined;
  const companyInvoices = invoices.filter((item) => item.companyId === selectedCompanyId);
  const companyName = (id?: string) => companies.find((item) => item.id === id)?.company_name || id || '会社未設定';
  const phaseOptions = [...PHASES, ...(Array.isArray(detail.phases) ? detail.phases : []), ...(detail.phase ? [detail.phase] : [])]
    .filter((value, index, all) => all.indexOf(value) === index);

  const rawMilestones = Array.isArray(selected?.milestone_data) ? selected.milestone_data : [];
  const normalizedMilestones = useMemo(() => {
    return rawMilestones.map((item: Row, index: number) => ({
      ...item,
      id: item.id || `ms_${String(selected?.id || '').slice(0, 8)}_${index}`,
      title: item.title || `マイルストーン ${index + 1}`,
      status: item.status || 'pending',
      due_date: item.due_date || item.target_period || '',
    }));
  }, [rawMilestones, selected?.id]);

  const handleToggleMilestone = async (engagement: Row, milestoneId: string, nextStatus: 'pending' | 'completed') => {
    if (onToggleMilestone) {
      await onToggleMilestone(engagement, milestoneId, nextStatus);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;
    const updated = normalizedMilestones.map((m: Row) =>
      m.id === milestoneId ? { ...m, status: nextStatus, completed_at: completedAt } : m
    );
    const { error: err } = await supabase.from('customer_service_engagements')
      .update({ milestone_data: updated, updated_at: new Date().toISOString() })
      .eq('id', engagement.id);
    if (err) setError(err.message);
    else await onRefresh();
  };

  const handleDeleteMilestone = async (engagement: Row, milestoneId: string) => {
    if (onDeleteMilestone) {
      await onDeleteMilestone(engagement, milestoneId);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const updated = normalizedMilestones.filter((m: Row) => m.id !== milestoneId);
    const { error: err } = await supabase.from('customer_service_engagements')
      .update({ milestone_data: updated, updated_at: new Date().toISOString() })
      .eq('id', engagement.id);
    if (err) setError(err.message);
    else await onRefresh();
  };

  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (companyId) {
      const matched = engagements.find((item) => item.company_id === companyId);
      if (matched && (!selectedId || !engagements.some((item) => item.id === selectedId && item.company_id === companyId))) {
        setSelectedId(matched.id);
        return;
      }
    }
    if (!selectedId && engagements[0]) setSelectedId(engagements[0].id);
    if (selectedId && !engagements.some((item) => item.id === selectedId)) setSelectedId(engagements[0]?.id || '');
  }, [engagements, selectedId, companyId]);

  useEffect(() => {
    const serviceType = selected?.service_type === 'retainer' ? 'retainer' : 'implementation_support';
    setSummaryDraft({
      ...detail,
      purpose: detail.purpose || PURPOSE_OPTIONS[serviceType][0],
      startedAt: detail.startedAt || activeContract?.start_date || todayJst(),
      ownerName: detail.ownerName || 'MST担当',
      phase: detail.phase || PHASES[0],
      progressStatus: detail.progressStatus || 'not_started',
    });
  }, [selected?.id, selected?.support_details, selected?.service_type, activeContract?.start_date]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();
    if (!supabase) {
      setMeetings([]);
      setDocuments([]);
      setServiceContracts([]);
      return () => { cancelled = true; };
    }
    setLoading(true);
    setError('');
    void Promise.all([
      selected?.id
        ? supabase.from('customer_service_meetings').select('*')
          .eq('engagement_id', selected.id).order('occurred_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('customer_contracts').select('id,title,status,company_id,start_date,end_date,amount').order('created_at', { ascending: false }),
      selectedCompanyId
        ? supabase.from('customer_documents').select('id,title,document_type,status,created_at,updated_at')
          .eq('company_id', selectedCompanyId).order('created_at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]).then(([meetingResult, contractResult, documentResult]) => {
      if (cancelled) return;
      if (meetingResult.error) throw meetingResult.error;
      if (contractResult.error) throw contractResult.error;
      if (documentResult.error) throw documentResult.error;
      setMeetings(meetingResult.data || []);
      setServiceContracts(contractResult.data || []);
      setDocuments(documentResult.data || []);
    }).catch((loadError: any) => {
      if (!cancelled) setError(supportErrorMessage(loadError, '支援履歴を読み込めませんでした。'));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.id, selectedCompanyId]);

  const saveSummary = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const supabase = getSupabase();
    if (!supabase) { setError('Supabaseに接続してください。'); return; }
    setError(''); setNotice('');
    const { error: saveError } = await supabase.from('customer_service_engagements')
      .update({
        title: selected.title,
        status: selected.status,
        next_meeting_at: selected.next_meeting_at || null,
        support_details: {
          ...summaryDraft,
          startedAt: summaryDraft.startedAt || activeContract?.start_date || todayJst(),
          ownerName: summaryDraft.ownerName || 'MST担当',
        },
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id);
    if (saveError) { setError(supportErrorMessage(saveError, '支援状況を保存できませんでした。')); return; }
    setNotice('支援状況を保存しました。');
    await onRefresh();
  };

  const createSupport = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) { setError('Supabaseに接続してください。'); return; }
    if (!newSupport.company_id) { setError('顧客を選択してください。'); return; }
    setError(''); setNotice('');
    const supportDetails: SupportDetails = {
      purpose: newSupport.purpose.trim() || PURPOSE_OPTIONS[newSupport.service_type as 'retainer' | 'implementation_support'][0],
      startedAt: newSupport.startedAt || serviceContracts.find((item) => item.id === newSupport.contract_id)?.start_date || todayJst(),
      ownerName: newSupport.ownerName.trim() || 'MST担当',
      phase: PHASES[0],
      progressStatus: 'not_started',
      phases: [],
    };
    const { data, error: insertError } = await supabase.from('customer_service_engagements')
      .insert({
        company_id: newSupport.company_id,
        contract_id: newSupport.contract_id || null,
        service_type: newSupport.service_type,
        title: `${companyName(newSupport.company_id)} ${newSupport.service_type === 'retainer' ? '顧問支援' : '構築支援'}`,
        status: 'planned',
        support_details: supportDetails,
      }).select('id').single();
    if (insertError) { setError(supportErrorMessage(insertError, '顧客支援を登録できませんでした。')); return; }
    setNewSupport({
      title: '', company_id: companyId || '', contract_id: '',
      service_type: 'implementation_support', purpose: PURPOSE_OPTIONS.implementation_support[0],
      startedAt: todayJst(), ownerName: 'MST担当',
    });
    setShowNewSupport(false);
    setNotice('顧客支援を登録しました。');
    await onRefresh();
    setSelectedId(data.id);
  };

  const deletePlannedEngagement = async (engagement: Row) => {
    if (engagement.status !== 'planned') return;
    const supabase = getSupabase();
    if (!supabase) return;
    if (engagement.contract_id || tasks.some((task) => task.supportEngagementId === engagement.id) || (Array.isArray(engagement.milestone_data) && engagement.milestone_data.length > 0)) {
      setError('契約・タスク・マイルストーンに関連しているため削除できません。既存の紐づきを保護しました。');
      return;
    }
    const { data: history, error: historyError } = await supabase
      .from('customer_service_meetings').select('id').eq('engagement_id', engagement.id).limit(1);
    if (historyError) { setError(supportErrorMessage(historyError, '履歴を確認できないため削除を中止しました。')); return; }
    if (history?.length) { setError('打ち合わせ履歴があるため削除できません。支援履歴を保持しました。'); return; }
    const { data: deleted, error: deleteError } = await supabase.from('customer_service_engagements')
      .delete().eq('id', engagement.id).eq('status', 'planned').select('id').maybeSingle();
    if (deleteError) { setError(supportErrorMessage(deleteError, '支援を削除できませんでした。')); return; }
    if (!deleted) { setError('削除対象が見つからないか、削除権限がありません。'); return; }
    setNotice('未開始の顧客支援を削除しました。');
    if (selectedId === engagement.id) setSelectedId('');
    await onRefresh();
  };

  const saveMeeting = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const supabase = getSupabase();
    if (!supabase) { setError('Supabaseに接続してください。'); return; }
    if (!meetingDraft.occurred_at || !meetingDraft.topic.trim()) {
      setError('打ち合わせ日時と今回のテーマを入力してください。'); return;
    }
    setError(''); setNotice('');
    const payload = {
      engagement_id: selected.id,
      company_id: selected.company_id,
      occurred_at: new Date(meetingDraft.occurred_at).toISOString(),
      purpose: meetingDraft.purpose.trim(),
      topic: meetingDraft.topic.trim(),
      discussion: meetingDraft.discussion.trim(),
      decisions: meetingDraft.decisions.trim(),
      unresolved_items: meetingDraft.unresolved_items.trim(),
      client_homework: meetingDraft.client_homework.trim(),
      mst_homework: meetingDraft.mst_homework.trim(),
      next_topic: meetingDraft.next_topic.trim(),
      next_meeting_at: meetingDraft.next_meeting_at ? new Date(meetingDraft.next_meeting_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const result = editingMeetingId
      ? await supabase.from('customer_service_meetings').update(payload).eq('id', editingMeetingId)
      : await supabase.from('customer_service_meetings').insert(payload);
    if (result.error) { setError(supportErrorMessage(result.error, '打ち合わせ履歴を保存できませんでした。')); return; }
    const latestMeeting = meetings[0];
    const isLatest = !latestMeeting || Date.parse(payload.occurred_at) >= Date.parse(latestMeeting.occurred_at);
    if (isLatest) {
      const nextDetails = {
        ...detail,
        currentTheme: payload.topic,
        nextTheme: payload.next_topic,
      };
      const { error: summaryError } = await supabase.from('customer_service_engagements')
        .update({
          support_details: nextDetails,
          next_meeting_at: payload.next_meeting_at,
          updated_at: new Date().toISOString(),
        }).eq('id', selected.id);
      if (summaryError) { setError(supportErrorMessage(summaryError, '支援の次回予定を更新できませんでした。')); return; }
    }
    setMeetingDraft(EMPTY_MEETING);
    setEditingMeetingId('');
    setTranscriptInput('');
    setNotice('打ち合わせ履歴を保存しました。宿題は一覧から担当と期限を設定できます。');
    const { data } = await supabase.from('customer_service_meetings').select('*')
      .eq('engagement_id', selected.id).order('occurred_at', { ascending: false });
    setMeetings(data || []);
    await onRefresh();
  };

  const organizeSupportTranscript = async () => {
    if (transcriptInput.trim().length < 20) {
      setError('文字起こし・議事メモを20文字以上貼り付けてください。');
      return;
    }
    setOrganizingTranscript(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/meetings/organize-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ kind: 'support_meeting', transcript: transcriptInput }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '文字起こしを整理できませんでした。');
      const notes = (data.supportNotes || {}) as Record<string, string>;
      let organizedDiscussion = notes.discussion || '';
      if (notes.decisions) organizedDiscussion += (organizedDiscussion ? '\n\n【決定事項】\n' : '【決定事項】\n') + notes.decisions;
      if (notes.unresolved_items) organizedDiscussion += (organizedDiscussion ? '\n\n【保留・未解決課題】\n' : '【保留・未解決課題】\n') + notes.unresolved_items;
      if (notes.client_homework) organizedDiscussion += (organizedDiscussion ? '\n\n【顧客側宿題】\n' : '【顧客側宿題】\n') + notes.client_homework;
      if (notes.mst_homework) organizedDiscussion += (organizedDiscussion ? '\n\n【MST側宿題】\n' : '【MST側宿題】\n') + notes.mst_homework;

      setMeetingDraft((prev) => {
        const pick = (currentVal: string, aiVal?: string) => {
          const val = String(aiVal || '').trim();
          if (!val) return currentVal;
          if (overwriteWithAi || !String(currentVal || '').trim()) return val;
          return currentVal;
        };
        return {
          ...prev,
          occurred_at: prev.occurred_at || asDateTimeLocal(new Date().toISOString()),
          topic: pick(prev.topic, notes.topic || '定例打ち合わせ'),
          discussion: pick(prev.discussion, organizedDiscussion),
        };
      });
      setNotice('AIが文字起こしを整理して議事ノートへ反映しました。内容を確認・修正してから「記録を保存」を押してください。');
    } catch (e: any) {
      setError(e?.message || '文字起こしを整理できませんでした。');
    } finally {
      setOrganizingTranscript(false);
    }
  };

  const editMeeting = (meeting: Row) => {
    setEditingMeetingId(meeting.id);
    let combinedNote = meeting.discussion || '';
    if (meeting.decisions && !combinedNote.includes(meeting.decisions)) {
      combinedNote += (combinedNote ? '\n\n【決定事項】\n' : '【決定事項】\n') + meeting.decisions;
    }
    if (meeting.unresolved_items && !combinedNote.includes(meeting.unresolved_items)) {
      combinedNote += (combinedNote ? '\n\n【保留・未解決課題】\n' : '【保留・未解決課題】\n') + meeting.unresolved_items;
    }
    if (meeting.client_homework && !combinedNote.includes(meeting.client_homework)) {
      combinedNote += (combinedNote ? '\n\n【顧客側宿題】\n' : '【顧客側宿題】\n') + meeting.client_homework;
    }
    if (meeting.mst_homework && !combinedNote.includes(meeting.mst_homework)) {
      combinedNote += (combinedNote ? '\n\n【MST側宿題】\n' : '【MST側宿題】\n') + meeting.mst_homework;
    }
    setMeetingDraft({
      occurred_at: asDateTimeLocal(meeting.occurred_at),
      purpose: meeting.purpose || '',
      topic: meeting.topic || '',
      discussion: combinedNote,
      decisions: '',
      unresolved_items: '',
      client_homework: '',
      mst_homework: '',
      next_topic: meeting.next_topic || '',
      next_meeting_at: asDateTimeLocal(meeting.next_meeting_at),
    });
    setActiveSection('meetings');
  };

  const saveTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !taskDraft.title.trim()) return;
    const now = Date.now();
    const relatedRecord = { type: 'company' as const, id: selected.company_id, label: companyName(selected.company_id) };
    const assignee = { type: 'human' as const, name: taskDraft.supportAssigneeName.trim() || (taskDraft.taskOwnerSide === 'client' ? '顧客側担当' : 'MST担当') };
    if (editingTaskId) {
      const original = supportTasks.find((task) => task.id === editingTaskId);
      if (!original) return;
      onUpdateTask({
        ...original,
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim(),
        taskOwnerSide: taskDraft.taskOwnerSide,
        supportAssigneeName: taskDraft.supportAssigneeName.trim(),
        dueDate: taskDraft.dueDate || undefined,
        priority: taskDraft.priority,
        status: taskDraft.status,
        supportMeetingId: taskDraft.supportMeetingId || undefined,
        completedAt: taskDraft.status === 'completed' ? (original.completedAt || now) : undefined,
        updatedAt: now,
      });
    } else {
      onCreateTask({
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim(),
        projectId: '',
        workArea: 'post_contract_support',
        sourceCategory: 'sales_customer',
        dueDate: taskDraft.dueDate || undefined,
        taskKind: 'response',
        relatedRecord,
        priority: taskDraft.priority,
        assignee,
        status: taskDraft.status,
        completionCriteria: '',
        taskOwnerSide: taskDraft.taskOwnerSide,
        supportAssigneeName: taskDraft.supportAssigneeName.trim(),
        supportEngagementId: selected.id,
        supportMeetingId: taskDraft.supportMeetingId || undefined,
        completedAt: taskDraft.status === 'completed' ? now : undefined,
        automationAutoRun: false,
      });
    }
    setTaskDraft(EMPTY_TASK);
    setEditingTaskId('');
  };

  const editTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setTaskDraft({
      title: task.title, description: task.description || '',
      taskOwnerSide: task.taskOwnerSide || 'mst',
      supportAssigneeName: task.supportAssigneeName || task.assignee?.name || '',
      dueDate: task.dueDate || '', priority: task.priority || 'medium',
      status: task.status, supportMeetingId: task.supportMeetingId || '',
    });
  };

  const setTaskStatus = (task: TaskItem, status: TaskItem['status']) => {
    const now = Date.now();
    onUpdateTask({
      ...task, status,
      completedAt: status === 'completed' ? (task.completedAt || now) : undefined,
      updatedAt: now,
    });
  };

  const addCustomPhase = (input: string) => {
    const value = input.trim();
    if (!value || !selected) return;
    setSummaryDraft((current) => ({
      ...current,
      phases: [...new Set([...(current.phases || []), value])],
      phase: current.phase || value,
    }));
    setCustomPhaseDraft('');
  };

  const addMilestone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !milestoneDraft.trim()) return;
    await onAddMilestone(selected, milestoneDraft.trim(), milestoneDueDate || undefined);
    setMilestoneDraft('');
    setMilestoneDueDate('');
  };

  const openTaskEditor = (task?: TaskItem) => {
    if (task) editTask(task);
    else { setEditingTaskId(''); setTaskDraft(EMPTY_TASK); }
  };

  const sections = [
    ['overview', '支援状況'], ['meetings', '打ち合わせ・ノート'],
    ['tasks', 'タスク・TODO'], ['delivery', '構築スケジュール・契約'],
  ] as const;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">顧客支援・構築管理</h2>
          <p className="mt-1 text-xs text-slate-500">顧客ごとのフェーズ、次回予定、履歴、宿題、納品状況をまとめて確認します。</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void onRefresh()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs">
            <RefreshCw className="h-3.5 w-3.5" />更新
          </button>
          <button type="button" onClick={() => { setShowNewSupport((value) => !value); setNewSupport((value) => { const nextCompanyId = companyId || value.company_id; const candidates = serviceContracts.filter((item) => item.company_id === nextCompanyId); const linkedContract = value.contract_id ? candidates.find((item) => item.id === value.contract_id) : candidates.length === 1 ? candidates[0] : undefined; return { ...value, company_id: nextCompanyId, contract_id: linkedContract?.id || value.contract_id, startedAt: linkedContract?.start_date || value.startedAt || todayJst(), ownerName: value.ownerName || 'MST担当', purpose: value.purpose || PURPOSE_OPTIONS[value.service_type as 'retainer' | 'implementation_support'][0] }; }); }} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer shadow-xs shadow-purple-600/20">
            <Plus className="h-4 w-4" />支援を登録
          </button>
        </div>
      </div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs">{error}</div>}
      {notice && <div role="status" className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 shadow-2xs">{notice}</div>}
    </div>

    {showNewSupport && <form onSubmit={createSupport} className="grid gap-3.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 shadow-xs">
      <label className="text-xs font-semibold text-slate-700">支援名（自動）<input readOnly value={`${newSupport.company_id ? companyName(newSupport.company_id) : '顧客未選択'} ${newSupport.service_type === 'retainer' ? '顧問支援' : '構築支援'}`} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-2xs" /></label>
      <label className="text-xs font-semibold text-slate-700">顧客<select required value={companyId || newSupport.company_id} disabled={Boolean(companyId)} onChange={(event) => { const nextCompanyId = event.target.value; const candidates = serviceContracts.filter((item) => item.company_id === nextCompanyId); const linkedContract = candidates.length === 1 ? candidates[0] : undefined; setNewSupport({ ...newSupport, company_id: nextCompanyId, contract_id: linkedContract?.id || '', startedAt: linkedContract?.start_date || todayJst() }); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="">顧客を選択</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.company_name}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-700">契約<select value={newSupport.contract_id} onChange={(event) => { const contractId = event.target.value; const contract = serviceContracts.find((item) => item.id === contractId); setNewSupport({ ...newSupport, contract_id: contractId, startedAt: contract?.start_date || newSupport.startedAt || todayJst() }); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="">契約と紐付けない</option>{serviceContracts.filter((item) => item.company_id === (companyId || newSupport.company_id)).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-700">支援種別<select value={newSupport.service_type} onChange={(event) => { const serviceType = event.target.value as 'retainer' | 'implementation_support'; setNewSupport({ ...newSupport, service_type: serviceType, purpose: PURPOSE_OPTIONS[serviceType].includes(newSupport.purpose) ? newSupport.purpose : PURPOSE_OPTIONS[serviceType][0] }); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="implementation_support">構築支援</option><option value="retainer">顧問</option></select></label>
      <label className="text-xs font-semibold text-slate-700">開始日（契約から自動入力）<input type="date" value={newSupport.startedAt} onChange={(event) => setNewSupport({ ...newSupport, startedAt: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
      <label className="text-xs font-semibold text-slate-700">担当者<select value={newSupport.ownerName || 'MST担当'} onChange={(event) => setNewSupport({ ...newSupport, ownerName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="MST担当">MST担当</option><option value="顧客側担当">顧客側担当</option></select></label>
      <label className="text-xs font-semibold text-slate-700 md:col-span-2">支援内容・目的<select value={newSupport.purpose} onChange={(event) => setNewSupport({ ...newSupport, purpose: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs">{PURPOSE_OPTIONS[newSupport.service_type as 'retainer' | 'implementation_support'].map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}</select></label>
      <p className="text-xs text-slate-500 md:col-span-2">顧客・支援種別から支援名を作成し、契約が1件だけなら自動で関連付けます。開始日は契約情報を引き継ぎます。</p>
      <div className="md:col-span-2"><button className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 cursor-pointer">登録する</button></div>
    </form>}

    <div className="grid gap-3.5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900">顧客支援一覧 ({engagements.length})</h3>
        {engagements.length === 0 ? <p className="text-xs text-slate-400 py-6 text-center">顧客支援がありません。「支援を登録」から作成できます。</p> :
          <ul className="space-y-2">{engagements.map((item) => {
            const itemDetail = (item.support_details && typeof item.support_details === 'object' ? item.support_details : {}) as SupportDetails;
            const itemTasks = tasks.filter((task) => task.supportEngagementId === item.id);
            const open = itemTasks.filter((task) => task.status !== 'completed');
            const overdue = open.some((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10));
            const lateMilestone = Array.isArray(item.milestone_data) && item.milestone_data.some((milestone: Row) => milestone.due_date && milestone.due_date < new Date().toISOString().slice(0, 10) && milestone.status !== 'completed');
            const lateMeeting = item.next_meeting_at && new Date(item.next_meeting_at).getTime() < Date.now();
            const warning = overdue || lateMilestone || lateMeeting || item.status === 'paused' || itemDetail.progressStatus === 'delayed' || itemDetail.progressStatus === 'at_risk';
            return <li key={item.id} className="flex items-stretch gap-2"><button type="button" onClick={() => { setSelectedId(item.id); setActiveSection('overview'); setNotice(''); setError(''); }} className={'min-w-0 flex-1 rounded-xl border p-3 text-left transition-all cursor-pointer ' + (selected?.id === item.id ? 'border-purple-600 bg-purple-50/70 shadow-2xs' : 'border-slate-200 bg-white hover:border-purple-200')}>
              <div className="flex items-start justify-between gap-2"><span className="font-bold text-xs text-slate-900">{companyName(item.company_id)}</span>{warning && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}</div>
              <div className="mt-1 text-xs font-medium text-slate-700">{item.title}</div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500"><span>{itemDetail.phase || PHASES[0]}</span><span>{itemDetail.currentTheme || 'テーマ未設定'}</span><span>次回 {displayDate(item.next_meeting_at)}</span><span>未完了 {open.length}件</span><span>{PROGRESS_LABELS[itemDetail.progressStatus || 'not_started']}</span></div>
              {warning && <div className="mt-2 text-[11px] text-amber-700 font-semibold">{overdue ? '期限超過タスクあり' : lateMilestone ? '期限超過マイルストーンあり' : lateMeeting ? '次回予定日を過ぎています' : itemDetail.progressStatus === 'delayed' ? '進捗遅延' : itemDetail.progressStatus === 'at_risk' ? '支援上の確認が必要です' : '支援が保留中です'}</div>}
            </button>{item.status==='planned'&&<InlineDeleteButton onConfirm={()=>void deletePlannedEngagement(item)} warning={`「${item.title}」を削除しますか？`} className="self-start rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 cursor-pointer shadow-2xs" ariaLabel={`顧客支援「${item.title}」を削除`}><Trash2 className="h-4 w-4"/></InlineDeleteButton>}</li>;
          })}</ul>}
      </section>

      {selected ? <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900 text-sm">{companyName(selected.company_id)} · {selected.title}</h3><div className="mt-0.5 text-xs text-slate-500">{selected.service_type === 'implementation_support' ? '構築支援' : '顧問'} · {selected.status}</div></div>
          <div className="flex flex-wrap gap-2">{sections.map(([key, label]) => <button key={key} type="button" onClick={() => setActiveSection(key)} className={'rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ' + (activeSection === key ? 'bg-purple-600 text-white shadow-2xs' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100')}>{label}</button>)}</div></div>
        </div>

        {activeSection === 'overview' && <form onSubmit={saveSummary} className="grid gap-3.5 p-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">支援名<input value={selected.title || ''} readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-2xs" /></label>
          <label className="text-xs font-semibold text-slate-700">契約<select value={selected.contract_id || ''} onChange={async (event) => {
            const supabase = getSupabase(); if (!supabase) return;
            const { error: updateError } = await supabase.from('customer_service_engagements').update({ contract_id: event.target.value || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
            if (updateError) setError(updateError.message); else { setNotice('契約との関連付けを更新しました。'); await onRefresh(); }
          }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="">未関連付け</option>{serviceContracts.filter((item) => item.company_id === selected.company_id).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">支援フェーズ<select value={summaryDraft.phase || PHASES[0]} onChange={(event) => setSummaryDraft({ ...summaryDraft, phase: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs">{phaseOptions.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">支援状況<select value={selected.status || 'planned'} onChange={async (event) => {
            const supabase = getSupabase(); if (!supabase) return;
            const { error: updateError } = await supabase.from('customer_service_engagements').update({ status: event.target.value, updated_at: new Date().toISOString() }).eq('id', selected.id);
            if (updateError) setError(updateError.message); else await onRefresh();
          }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="planned">予定</option><option value="active">進行中</option><option value="paused">保留</option><option value="completed">完了</option><option value="canceled">中止</option></select></label>
          <label className="text-xs font-semibold text-slate-700">現在のテーマ<input list="support-theme-options" value={summaryDraft.currentTheme || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, currentTheme: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /><datalist id="support-theme-options">{THEME_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'].map((theme) => <option key={theme} value={theme} />)}</datalist></label>
          <label className="text-xs font-semibold text-slate-700">次回の打ち合わせ日時<input type="datetime-local" value={asDateTimeLocal(selected.next_meeting_at)} onChange={async (event) => {
            const supabase = getSupabase(); if (!supabase) return;
            const { error: updateError } = await supabase.from('customer_service_engagements').update({ next_meeting_at: event.target.value ? new Date(event.target.value).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', selected.id);
            if (updateError) setError(updateError.message); else await onRefresh();
          }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
          <label className="text-xs font-semibold text-slate-700">進捗状況<select value={summaryDraft.progressStatus || 'not_started'} onChange={(event) => setSummaryDraft({ ...summaryDraft, progressStatus: event.target.value as SupportDetails['progressStatus'] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs">{Object.entries(PROGRESS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">支援開始日<input type="date" value={summaryDraft.startedAt || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, startedAt: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
          <label className="text-xs font-semibold text-slate-700 md:col-span-2">支援内容・目的<select value={summaryDraft.purpose || PURPOSE_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'][0]} onChange={(event) => setSummaryDraft({ ...summaryDraft, purpose: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs">{summaryDraft.purpose && !PURPOSE_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'].includes(summaryDraft.purpose) && <option value={summaryDraft.purpose}>{summaryDraft.purpose}</option>}{PURPOSE_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'].map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700 md:col-span-2">進捗メモ<textarea value={summaryDraft.progressNote || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, progressNote: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
          <div className="flex items-center justify-between gap-3 md:col-span-2 pt-2 border-t border-slate-100"><span className="text-xs text-slate-500">契約・顧客情報は既存レコードを参照しています。</span><button className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition cursor-pointer shadow-xs shadow-purple-600/20"><Save className="h-4 w-4" />支援状況を保存</button></div>
        </form>}

        {activeSection === 'meetings' && <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <form onSubmit={saveMeeting} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs">
            <h4 className="font-bold text-slate-900 text-sm">{editingMeetingId ? '打ち合わせ履歴を編集' : '打ち合わせを記録'}</h4>
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-900">文字起こし・メモからAI整理</span>
                  <p className="text-[11px] text-slate-500">Zoom / Google Meet の文字起こしを貼り付けると、各項目へ自動整理します（事前同意を取得してください）。</p>
                </div>
                <button
                  type="button"
                  onClick={() => void organizeSupportTranscript()}
                  disabled={organizingTranscript || transcriptInput.trim().length < 20}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {organizingTranscript ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{organizingTranscript ? '整理中…' : 'AIで整理して反映'}</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={transcriptInput}
                onChange={(event) => setTranscriptInput(event.target.value)}
                placeholder="ここに定例面談の文字起こし・議事メモを貼り付け（20文字以上）"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600"
              />
              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteWithAi}
                  onChange={(event) => setOverwriteWithAi(event.target.checked)}
                  className="rounded border-slate-300 accent-purple-600"
                />
                <span>すでに入力済みの項目もAIの整理結果で上書きする</span>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                日時 <span className="text-rose-500">*</span>
                <input required type="datetime-local" value={meetingDraft.occurred_at} onChange={(event) => setMeetingDraft({ ...meetingDraft, occurred_at: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                次回の打ち合わせ日時
                <input type="datetime-local" value={meetingDraft.next_meeting_at} onChange={(event) => setMeetingDraft({ ...meetingDraft, next_meeting_at: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              今回のテーマ <span className="text-rose-500">*</span>
              <input required value={meetingDraft.topic} onChange={(event) => setMeetingDraft({ ...meetingDraft, topic: event.target.value })} placeholder="例: 定例ミーティング・進捗確認" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              議事メモ・決定事項・ノート
              <span className="ml-1 text-[11px] font-normal text-slate-500">（決定事項・保留課題・宿題などもここにまとめて記録できます）</span>
              <textarea rows={6} value={meetingDraft.discussion} onChange={(event) => setMeetingDraft({ ...meetingDraft, discussion: event.target.value })} placeholder="・話し合った内容&#10;・決定したこと&#10;・次回までの確認点など" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" />
            </label>
            <div className="flex gap-2"><button className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 cursor-pointer">{editingMeetingId ? '変更を保存' : '記録を保存'}</button>{editingMeetingId && <button type="button" onClick={() => { setEditingMeetingId(''); setMeetingDraft(EMPTY_MEETING); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">編集を取り消す</button>}</div>
          </form>
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">これまでの打ち合わせ（新しい順）</h4>
            {loading ? <p className="text-xs text-slate-400">読み込み中…</p> : meetings.length === 0 ? <p className="text-xs text-slate-400 py-6 text-center">履歴はまだありません。</p> : meetings.map((meeting) => <article key={meeting.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-start justify-between gap-2"><div><div className="font-bold text-xs text-slate-900">{meeting.topic}</div><div className="mt-0.5 text-[11px] text-slate-500">{displayDate(meeting.occurred_at)}</div></div><button type="button" onClick={() => editMeeting(meeting)} className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-2xs">編集</button></div>
              {meeting.discussion && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{meeting.discussion}</p>}
              {meeting.decisions && !meeting.discussion?.includes(meeting.decisions) && <p className="mt-2 whitespace-pre-wrap text-xs text-emerald-800 font-medium">決定: {meeting.decisions}</p>}
              {meeting.unresolved_items && !meeting.discussion?.includes(meeting.unresolved_items) && <p className="mt-2 whitespace-pre-wrap text-xs text-amber-800 font-medium">保留: {meeting.unresolved_items}</p>}
              {meeting.next_meeting_at && <p className="mt-2 text-[11px] text-slate-500">次回予定: {displayDate(meeting.next_meeting_at)}</p>}
            </article>)}
          </div>
        </div>}

        {activeSection === 'tasks' && <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <form onSubmit={saveTask} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs">
            <h4 className="font-bold text-slate-900 text-sm">{editingTaskId ? '宿題・TODOを編集' : '宿題・TODOを追加'}</h4>
            <label className="block text-xs font-semibold text-slate-700">タスク名<input required value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
            <label className="block text-xs font-semibold text-slate-700">担当区分<select value={taskDraft.taskOwnerSide} onChange={(event) => setTaskDraft({ ...taskDraft, taskOwnerSide: event.target.value as TaskDraft['taskOwnerSide'] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="client">顧客側</option><option value="mst">MST側</option></select></label>
            <label className="block text-xs font-semibold text-slate-700">担当者<input value={taskDraft.supportAssigneeName} onChange={(event) => setTaskDraft({ ...taskDraft, supportAssigneeName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
            <label className="block text-xs font-semibold text-slate-700">関連する打ち合わせ<select value={taskDraft.supportMeetingId} onChange={(event) => setTaskDraft({ ...taskDraft, supportMeetingId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="">指定しない</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{displayDate(meeting.occurred_at)} · {meeting.topic}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-700">期限<input type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
            <label className="block text-xs font-semibold text-slate-700">状態<select value={taskDraft.status} onChange={(event) => setTaskDraft({ ...taskDraft, status: event.target.value as TaskItem['status'] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs">{Object.entries(TASK_STATUS_LABELS).filter(([key]) => key !== 'pending_approval').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-700">優先度<select value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as Priority })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs"><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
            <label className="block text-xs font-semibold text-slate-700">詳細<textarea rows={3} value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
            <div className="flex gap-2"><button className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 cursor-pointer">{editingTaskId ? '変更を保存' : 'タスクを登録'}</button>{editingTaskId && <button type="button" onClick={() => openTaskEditor()} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">新規入力へ</button>}</div>
          </form>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold text-slate-900 text-sm">未完了 {companyTasks.length}件 · 期限超過 {overdueTasks.length}件</h4><ClipboardList className="h-4 w-4 text-slate-400" /></div>
            {(['client', 'mst'] as const).map((side) => <section key={side} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <h5 className="mb-2 text-xs font-bold text-slate-900">{side === 'client' ? '顧客側の宿題' : 'MST側のTODO'}</h5>
              {supportTasks.filter((task) => (task.taskOwnerSide || 'mst') === side).length === 0 ? <p className="text-xs text-slate-400">タスクはありません。</p> :
                <ul className="divide-y divide-slate-100">{supportTasks.filter((task) => (task.taskOwnerSide || 'mst') === side).map((task) => <li key={task.id} className="py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><div className={'text-xs font-semibold ' + (task.status === 'completed' ? 'text-emerald-700 line-through' : 'text-slate-800')}>{task.title}</div><div className="mt-1 text-[11px] text-slate-500">{task.supportAssigneeName || task.assignee?.name || '担当未設定'} · 期限 {task.dueDate || '未設定'} · 優先度 {task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中'}{task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'completed' ? ' · 期限超過' : ''}</div>{task.description && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{task.description}</p>}</div>
                  <div className="flex items-center gap-2"><select aria-label={task.title + 'の状態'} value={task.status} onChange={(event) => setTaskStatus(task, event.target.value as TaskItem['status'])} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-purple-600 shadow-2xs">{Object.entries(TASK_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="button" onClick={() => openTaskEditor(task)} className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-2xs">編集</button></div>
                  </div>
                </li>)}</ul>}
            </section>)}
          </div>
        </div>}

        {activeSection === 'delivery' && <div className="space-y-4 p-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xs">
            <h4 className="mb-3 font-bold text-slate-900 text-sm">構築タスク・スケジュール管理</h4>
            <form onSubmit={addMilestone} className="mb-3 flex flex-wrap items-end gap-2">
              <input value={milestoneDraft} onChange={(event) => setMilestoneDraft(event.target.value)} placeholder="タスク・工程名を入力（例: システム要件定義、初期設定）" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" />
              <label className="text-xs font-semibold text-slate-600">完了予定日<input type="date" value={milestoneDueDate} onChange={(event) => setMilestoneDueDate(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" /></label>
              <button className="rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-bold text-white shadow-2xs cursor-pointer">追加</button>
            </form>
            {normalizedMilestones.length > 0 ? <ul className="space-y-2">{normalizedMilestones.map((milestone: Row) => {
              const isCompleted = milestone.status === 'completed';
              const overdue = milestone.due_date && milestone.due_date < new Date().toISOString().slice(0, 10) && !isCompleted;
              return <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => void handleToggleMilestone(selected, milestone.id, isCompleted ? 'pending' : 'completed')}
                    title={isCompleted ? '未完了に戻す' : '完了にする'}
                    className={`h-5 w-5 rounded border flex items-center justify-center transition cursor-pointer shrink-0 ${isCompleted ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 hover:border-purple-600 bg-white'}`}
                  >
                    {isCompleted && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0">
                    <span className={`text-xs font-bold ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {milestone.title}
                    </span>
                    <div className={`mt-0.5 text-[11px] ${overdue ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
                      {milestone.due_date ? `完了予定: ${milestone.due_date}` : '期日未設定'}
                      {overdue && ' · 期限超過'}
                      {isCompleted && milestone.completed_at && ` (完了: ${displayDate(milestone.completed_at)})`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isCompleted ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleMilestone(selected, milestone.id, 'pending')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer shadow-2xs"
                    >
                      未完了に戻す
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleToggleMilestone(selected, milestone.id, 'completed')}
                      className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-2xs"
                    >
                      完了を記録
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteMilestone(selected, milestone.id)}
                    title={`「${milestone.title}」を削除`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>;
            })}</ul> : <p className="text-xs text-slate-400">マイルストーン・タスクはまだありません。</p>}
            <p className="mt-3 text-[11px] text-slate-500">※ タスクごとに個別に完了・未完了の切り替えや削除が可能です。</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-900 text-sm"><FileText className="h-4 w-4 text-purple-600" />顧客への納品物・提出物</h4>
            {documents.length === 0 ? <p className="text-xs text-slate-400 py-4 text-center">この顧客に紐付く書類はありません。</p> : <ul className="divide-y divide-slate-100">{documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><div><div className="text-xs font-bold text-slate-900">{document.title}</div><div className="text-[11px] text-slate-500">{document.document_type} · {displayDate(document.created_at)}</div></div><span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">{document.status}</span></li>)}</ul>}
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"><h4 className="mb-2 font-bold text-slate-900 text-sm">契約情報</h4>{activeContract ? <div className="space-y-1 text-xs text-slate-700"><div className="font-semibold text-slate-900">{activeContract.title} · {activeContract.status}</div><div>{activeContract.start_date || '開始日未設定'} ～ {activeContract.end_date || '終了日未設定'}</div><div>税抜 ¥{Number(activeContract.amount || 0).toLocaleString('ja-JP')} <span className="text-[11px] text-purple-700 font-semibold">（税込 ¥{Math.floor(Number(activeContract.amount || 0) * 1.1).toLocaleString('ja-JP')}）</span></div></div> : <p className="text-xs text-slate-400">関連契約はありません。</p>}</section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"><h4 className="mb-2 font-bold text-slate-900 text-sm">請求情報 ({companyInvoices.length})</h4>{companyInvoices.length ? <ul className="space-y-1 text-xs text-slate-700">{companyInvoices.map((invoice) => <li key={invoice.id}>{invoice.title} · {invoice.status} · 税抜 ¥{Number(invoice.amount || 0).toLocaleString('ja-JP')} <span className="text-[11px] text-purple-700 font-semibold">（税込 ¥{Math.floor(Number(invoice.amount || 0) * 1.1).toLocaleString('ja-JP')}）</span> · 期限 {invoice.dueDate || '未設定'}</li>)}</ul> : <p className="text-xs text-slate-400">請求はありません。</p>}</section>
          </div>
        </div>}
      </section> : <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">顧客支援を登録すると、ここに現在の状況と次の対応を表示します。</section>}
    </div>
  </div>;
};
