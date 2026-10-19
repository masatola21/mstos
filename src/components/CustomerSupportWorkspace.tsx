import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Check, ClipboardList, FileText, Plus, RefreshCw, Save } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';
import type { ManagedInvoice } from '../types/matrix';
import type { Priority, TaskItem } from '../types';

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
  companies: Row[];
  engagements: Row[];
  invoices: ManagedInvoice[];
  tasks: TaskItem[];
  onCreateTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (task: TaskItem) => void;
  onRefresh: () => Promise<void>;
  onAddMilestone: (engagement: Row, title: string, dueDate?: string) => Promise<void>;
  onCompleteMilestone: (engagement: Row, milestoneId: string) => Promise<void>;
}

export const CustomerSupportWorkspace: React.FC<Props> = ({
  companyId, companies, engagements, invoices, tasks,
  onCreateTask, onUpdateTask, onRefresh, onAddMilestone, onCompleteMilestone,
}) => {
  const [selectedId, setSelectedId] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'meetings' | 'tasks' | 'delivery'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [meetings, setMeetings] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [serviceContracts, setServiceContracts] = useState<Row[]>([]);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>(EMPTY_MEETING);
  const [editingMeetingId, setEditingMeetingId] = useState('');
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [milestoneDraft, setMilestoneDraft] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');
  const [customPhaseDraft, setCustomPhaseDraft] = useState('');
  const [showNewSupport, setShowNewSupport] = useState(false);
  const [newSupport, setNewSupport] = useState({
    title: '', company_id: '', contract_id: '', service_type: 'implementation_support',
    purpose: '', startedAt: new Date().toISOString().slice(0, 10), ownerName: '',
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

  useEffect(() => {
    if (!selectedId && engagements[0]) setSelectedId(engagements[0].id);
    if (selectedId && !engagements.some((item) => item.id === selectedId)) setSelectedId(engagements[0]?.id || '');
  }, [engagements, selectedId]);

  useEffect(() => {
    setSummaryDraft(detail);
  }, [selected?.id, selected?.support_details]);

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
        support_details: summaryDraft,
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
    if (!newSupport.company_id || !newSupport.title.trim()) { setError('顧客と支援名を入力してください。'); return; }
    setError(''); setNotice('');
    const supportDetails: SupportDetails = {
      purpose: newSupport.purpose.trim(),
      startedAt: newSupport.startedAt || undefined,
      ownerName: newSupport.ownerName.trim(),
      phase: PHASES[0],
      progressStatus: 'not_started',
      phases: [],
    };
    const { data, error: insertError } = await supabase.from('customer_service_engagements')
      .insert({
        company_id: newSupport.company_id,
        contract_id: newSupport.contract_id || null,
        service_type: newSupport.service_type,
        title: newSupport.title.trim(),
        status: 'planned',
        support_details: supportDetails,
      }).select('id').single();
    if (insertError) { setError(supportErrorMessage(insertError, '顧客支援を登録できませんでした。')); return; }
    setNewSupport({
      title: '', company_id: companyId || '', contract_id: '',
      service_type: 'implementation_support', purpose: '',
      startedAt: new Date().toISOString().slice(0, 10), ownerName: '',
    });
    setShowNewSupport(false);
    setNotice('顧客支援を登録しました。');
    await onRefresh();
    setSelectedId(data.id);
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
    setNotice('打ち合わせ履歴を保存しました。宿題は一覧から担当と期限を設定できます。');
    const { data } = await supabase.from('customer_service_meetings').select('*')
      .eq('engagement_id', selected.id).order('occurred_at', { ascending: false });
    setMeetings(data || []);
    await onRefresh();
  };

  const editMeeting = (meeting: Row) => {
    setEditingMeetingId(meeting.id);
    setMeetingDraft({
      occurred_at: asDateTimeLocal(meeting.occurred_at),
      purpose: meeting.purpose || '', topic: meeting.topic || '',
      discussion: meeting.discussion || '', decisions: meeting.decisions || '',
      unresolved_items: meeting.unresolved_items || '',
      client_homework: meeting.client_homework || '', mst_homework: meeting.mst_homework || '',
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
    ['overview', '支援状況'], ['meetings', '打ち合わせ履歴'],
    ['tasks', '宿題・TODO'], ['delivery', '構築・納品・契約'],
  ] as const;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-white">顧客支援・構築管理</h2><p className="mt-1 text-sm text-slate-400">顧客ごとのフェーズ、次回予定、履歴、宿題、納品状況をまとめて確認します。</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void onRefresh()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200"><RefreshCw className="h-4 w-4" />更新</button>
          <button type="button" onClick={() => { setShowNewSupport((value) => !value); setNewSupport((value) => ({ ...value, company_id: companyId || value.company_id })); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />支援を登録</button>
        </div>
      </div>
      {error && <div role="alert" className="mt-3 rounded-lg border border-rose-700/60 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</div>}
    </div>

    {showNewSupport && <form onSubmit={createSupport} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-2">
      <label className="text-xs text-slate-300">支援名<input required value={newSupport.title} onChange={(event) => setNewSupport({ ...newSupport, title: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="例：業務フロー構築支援" /></label>
      <label className="text-xs text-slate-300">顧客<select required value={companyId || newSupport.company_id} disabled={Boolean(companyId)} onChange={(event) => setNewSupport({ ...newSupport, company_id: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">顧客を選択</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.company_name}</option>)}</select></label>
      <label className="text-xs text-slate-300">契約<select value={newSupport.contract_id} onChange={(event) => setNewSupport({ ...newSupport, contract_id: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">契約と紐付けない</option>{serviceContracts.filter((item) => item.company_id === (companyId || newSupport.company_id)).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select></label>
      <label className="text-xs text-slate-300">支援種別<select value={newSupport.service_type} onChange={(event) => setNewSupport({ ...newSupport, service_type: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="implementation_support">構築支援</option><option value="retainer">顧問</option></select></label>
      <label className="text-xs text-slate-300">開始日<input type="date" value={newSupport.startedAt} onChange={(event) => setNewSupport({ ...newSupport, startedAt: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
      <label className="text-xs text-slate-300">担当者<input value={newSupport.ownerName} onChange={(event) => setNewSupport({ ...newSupport, ownerName: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="MST側担当" /></label>
      <label className="text-xs text-slate-300 md:col-span-2">支援内容・構築の目的<textarea value={newSupport.purpose} onChange={(event) => setNewSupport({ ...newSupport, purpose: event.target.value })} rows={3} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
      <div className="md:col-span-2"><button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">保存</button></div>
    </form>}

    <div className="grid gap-3 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]">
      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-semibold text-white">顧客支援一覧 ({engagements.length})</h3>
        {engagements.length === 0 ? <p className="text-sm text-slate-400">顧客支援がありません。「支援を登録」から作成できます。</p> :
          <ul className="space-y-2">{engagements.map((item) => {
            const itemDetail = (item.support_details && typeof item.support_details === 'object' ? item.support_details : {}) as SupportDetails;
            const itemTasks = tasks.filter((task) => task.supportEngagementId === item.id);
            const open = itemTasks.filter((task) => task.status !== 'completed');
            const overdue = open.some((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10));
            const lateMilestone = Array.isArray(item.milestone_data) && item.milestone_data.some((milestone: Row) => milestone.due_date && milestone.due_date < new Date().toISOString().slice(0, 10) && milestone.status !== 'completed');
            const lateMeeting = item.next_meeting_at && new Date(item.next_meeting_at).getTime() < Date.now();
            const warning = overdue || lateMilestone || lateMeeting || item.status === 'paused' || itemDetail.progressStatus === 'delayed' || itemDetail.progressStatus === 'at_risk';
            return <li key={item.id}><button type="button" onClick={() => { setSelectedId(item.id); setActiveSection('overview'); setNotice(''); setError(''); }} className={'w-full rounded-lg border p-3 text-left ' + (selected?.id === item.id ? 'border-blue-500 bg-blue-950/30' : 'border-slate-800 bg-slate-950 hover:border-slate-600')}>
              <div className="flex items-start justify-between gap-2"><span className="font-medium text-white">{companyName(item.company_id)}</span>{warning && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />}</div>
              <div className="mt-1 text-xs text-slate-300">{item.title}</div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>{itemDetail.phase || PHASES[0]}</span><span>{itemDetail.currentTheme || 'テーマ未設定'}</span><span>次回 {displayDate(item.next_meeting_at)}</span><span>未完了 {open.length}件</span><span>{PROGRESS_LABELS[itemDetail.progressStatus || 'not_started']}</span></div>
              {warning && <div className="mt-2 text-xs text-amber-300">{overdue ? '期限超過タスクあり' : lateMilestone ? '期限超過マイルストーンあり' : lateMeeting ? '次回予定日を過ぎています' : itemDetail.progressStatus === 'delayed' ? '進捗遅延' : itemDetail.progressStatus === 'at_risk' ? '支援上の確認が必要です' : '支援が保留中です'}</div>}
            </button></li>;
          })}</ul>}
      </section>

      {selected ? <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{companyName(selected.company_id)} · {selected.title}</h3><div className="mt-1 text-xs text-slate-400">{selected.service_type === 'implementation_support' ? '構築支援' : '顧問'} · {selected.status}</div></div>
          <div className="flex flex-wrap gap-2">{sections.map(([key, label]) => <button key={key} type="button" onClick={() => setActiveSection(key)} className={'rounded px-3 py-2 text-xs ' + (activeSection === key ? 'bg-blue-600 text-white' : 'border border-slate-700 text-slate-300')}>{label}</button>)}</div></div>
        </div>

        {activeSection === 'overview' && <form onSubmit={saveSummary} className="grid gap-3 p-4 md:grid-cols-2">
          <label className="text-xs text-slate-300">支援名<input value={selected.title || ''} readOnly className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-400" /></label>
          <label className="text-xs text-slate-300">契約<select value={selected.contract_id || ''} onChange={async (event) => {
            const supabase = getSupabase(); if (!supabase) return;
            const { error: updateError } = await supabase.from('customer_service_engagements').update({ contract_id: event.target.value || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
            if (updateError) setError(updateError.message); else { setNotice('契約との関連付けを更新しました。'); await onRefresh(); }
          }} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">未関連付け</option>{serviceContracts.filter((item) => item.company_id === selected.company_id).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}</select></label>
          <label className="text-xs text-slate-300">支援フェーズ<select value={summaryDraft.phase || PHASES[0]} onChange={(event) => setSummaryDraft({ ...summaryDraft, phase: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{phaseOptions.map((phase) => <option key={phase} value={phase}>{phase}</option>)}</select></label>
          <label className="text-xs text-slate-300">支援状況<select value={selected.status || 'planned'} onChange={async (event) => {
            const supabase = getSupabase(); if (!supabase) return;
            const { error: updateError } = await supabase.from('customer_service_engagements').update({ status: event.target.value, updated_at: new Date().toISOString() }).eq('id', selected.id);
            if (updateError) setError(updateError.message); else await onRefresh();
          }} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="planned">予定</option><option value="active">進行中</option><option value="paused">保留</option><option value="completed">完了</option><option value="canceled">中止</option></select></label>
          <label className="text-xs text-slate-300">現在のテーマ<input value={summaryDraft.currentTheme || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, currentTheme: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300">次回のテーマ<input value={summaryDraft.nextTheme || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, nextTheme: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300">次回の打ち合わせ日時<input type="datetime-local" value={asDateTimeLocal(selected.next_meeting_at)} onChange={async (event) => {
            const supabase = getSupabase(); if (!supabase) return;
            const { error: updateError } = await supabase.from('customer_service_engagements').update({ next_meeting_at: event.target.value ? new Date(event.target.value).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', selected.id);
            if (updateError) setError(updateError.message); else await onRefresh();
          }} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300">進捗状況<select value={summaryDraft.progressStatus || 'not_started'} onChange={(event) => setSummaryDraft({ ...summaryDraft, progressStatus: event.target.value as SupportDetails['progressStatus'] })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{Object.entries(PROGRESS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-xs text-slate-300">支援開始日<input type="date" value={summaryDraft.startedAt || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, startedAt: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300">MST担当者<input value={summaryDraft.ownerName || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, ownerName: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300 md:col-span-2">支援内容・構築の目的<textarea value={summaryDraft.purpose || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, purpose: event.target.value })} rows={3} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300 md:col-span-2">進捗メモ<textarea value={summaryDraft.progressNote || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, progressNote: event.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300 md:col-span-2">重要な課題・確認事項<textarea value={summaryDraft.keyIssue || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, keyIssue: event.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-300 md:col-span-2">次回までに確認しておく事項<textarea value={summaryDraft.nextChecklist || ''} onChange={(event) => setSummaryDraft({ ...summaryDraft, nextChecklist: event.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <div className="md:col-span-2">
            <div className="mb-2 text-xs text-slate-300">顧客ごとのフェーズ候補</div>
            <div className="flex gap-2">
              <input value={customPhaseDraft} onChange={(event) => setCustomPhaseDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomPhase(customPhaseDraft); } }} placeholder="個別フェーズを追加" className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
              <button type="button" onClick={() => addCustomPhase(customPhaseDraft)} className="rounded border border-slate-700 px-3 py-2 text-xs text-white">追加</button>
            </div>
            {summaryDraft.phases?.length ? <div className="mt-2 flex flex-wrap gap-2">{summaryDraft.phases.map((phase) => <span key={phase} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">{phase}</span>)}</div> : null}
          </div>
          <div className="flex items-center justify-between gap-3 md:col-span-2"><span className="text-xs text-slate-500">契約・顧客情報は既存レコードを参照しています。</span><button className="inline-flex items-center gap-2 rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"><Save className="h-4 w-4" />支援状況を保存</button></div>
        </form>}

        {activeSection === 'meetings' && <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <form onSubmit={saveMeeting} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h4 className="font-semibold text-white">{editingMeetingId ? '打ち合わせ履歴を編集' : '打ち合わせを記録'}</h4>
            <label className="block text-xs text-slate-300">日時<input required type="datetime-local" value={meetingDraft.occurred_at} onChange={(event) => setMeetingDraft({ ...meetingDraft, occurred_at: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">目的<input value={meetingDraft.purpose} onChange={(event) => setMeetingDraft({ ...meetingDraft, purpose: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">今回のテーマ<input required value={meetingDraft.topic} onChange={(event) => setMeetingDraft({ ...meetingDraft, topic: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">話し合った内容<textarea rows={3} value={meetingDraft.discussion} onChange={(event) => setMeetingDraft({ ...meetingDraft, discussion: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">決定事項<textarea rows={2} value={meetingDraft.decisions} onChange={(event) => setMeetingDraft({ ...meetingDraft, decisions: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">保留事項・未解決課題<textarea rows={2} value={meetingDraft.unresolved_items} onChange={(event) => setMeetingDraft({ ...meetingDraft, unresolved_items: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">顧客側の宿題<textarea rows={2} value={meetingDraft.client_homework} onChange={(event) => setMeetingDraft({ ...meetingDraft, client_homework: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">MST側の宿題<textarea rows={2} value={meetingDraft.mst_homework} onChange={(event) => setMeetingDraft({ ...meetingDraft, mst_homework: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">次回テーマ<input value={meetingDraft.next_topic} onChange={(event) => setMeetingDraft({ ...meetingDraft, next_topic: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">次回日時<input type="datetime-local" value={meetingDraft.next_meeting_at} onChange={(event) => setMeetingDraft({ ...meetingDraft, next_meeting_at: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <div className="flex gap-2"><button className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">{editingMeetingId ? '変更を保存' : '記録を保存'}</button>{editingMeetingId && <button type="button" onClick={() => { setEditingMeetingId(''); setMeetingDraft(EMPTY_MEETING); }} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300">編集を取り消す</button>}</div>
          </form>
          <div className="space-y-3">
            <h4 className="font-semibold text-white">これまでの打ち合わせ（新しい順）</h4>
            {loading ? <p className="text-sm text-slate-400">読み込み中…</p> : meetings.length === 0 ? <p className="text-sm text-slate-400">履歴はまだありません。</p> : meetings.map((meeting) => <article key={meeting.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-start justify-between gap-2"><div><div className="font-medium text-white">{meeting.topic}</div><div className="mt-1 text-xs text-slate-500">{displayDate(meeting.occurred_at)} · {meeting.purpose || '目的未設定'}</div></div><button type="button" onClick={() => editMeeting(meeting)} className="rounded border border-slate-700 px-2 py-1 text-xs text-cyan-200">編集</button></div>
              {meeting.discussion && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{meeting.discussion}</p>}
              {meeting.decisions && <p className="mt-2 whitespace-pre-wrap text-xs text-emerald-200">決定: {meeting.decisions}</p>}
              {meeting.unresolved_items && <p className="mt-2 whitespace-pre-wrap text-xs text-amber-200">保留: {meeting.unresolved_items}</p>}
              {meeting.client_homework && <p className="mt-2 whitespace-pre-wrap text-xs text-cyan-200">顧客側TODO: {meeting.client_homework}</p>}
              {meeting.mst_homework && <p className="mt-2 whitespace-pre-wrap text-xs text-violet-200">MST側TODO: {meeting.mst_homework}</p>}
              {meeting.next_topic && <p className="mt-2 text-xs text-slate-400">次回: {meeting.next_topic} · {displayDate(meeting.next_meeting_at)}</p>}
            </article>)}
          </div>
        </div>}

        {activeSection === 'tasks' && <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <form onSubmit={saveTask} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h4 className="font-semibold text-white">{editingTaskId ? '宿題・TODOを編集' : '宿題・TODOを追加'}</h4>
            <label className="block text-xs text-slate-300">タスク名<input required value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">担当区分<select value={taskDraft.taskOwnerSide} onChange={(event) => setTaskDraft({ ...taskDraft, taskOwnerSide: event.target.value as TaskDraft['taskOwnerSide'] })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="client">顧客側</option><option value="mst">MST側</option></select></label>
            <label className="block text-xs text-slate-300">担当者<input value={taskDraft.supportAssigneeName} onChange={(event) => setTaskDraft({ ...taskDraft, supportAssigneeName: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">関連する打ち合わせ<select value={taskDraft.supportMeetingId} onChange={(event) => setTaskDraft({ ...taskDraft, supportMeetingId: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">指定しない</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{displayDate(meeting.occurred_at)} · {meeting.topic}</option>)}</select></label>
            <label className="block text-xs text-slate-300">期限<input type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <label className="block text-xs text-slate-300">状態<select value={taskDraft.status} onChange={(event) => setTaskDraft({ ...taskDraft, status: event.target.value as TaskItem['status'] })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">{Object.entries(TASK_STATUS_LABELS).filter(([key]) => key !== 'pending_approval').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="block text-xs text-slate-300">優先度<select value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as Priority })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
            <label className="block text-xs text-slate-300">詳細<textarea rows={3} value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
            <div className="flex gap-2"><button className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white">{editingTaskId ? '変更を保存' : 'タスクを登録'}</button>{editingTaskId && <button type="button" onClick={() => openTaskEditor()} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300">新規入力へ</button>}</div>
          </form>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-white">未完了 {companyTasks.length}件 · 期限超過 {overdueTasks.length}件</h4><ClipboardList className="h-4 w-4 text-slate-500" /></div>
            {(['client', 'mst'] as const).map((side) => <section key={side} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <h5 className="mb-2 text-sm font-semibold text-white">{side === 'client' ? '顧客側の宿題' : 'MST側のTODO'}</h5>
              {supportTasks.filter((task) => (task.taskOwnerSide || 'mst') === side).length === 0 ? <p className="text-xs text-slate-500">タスクはありません。</p> :
                <ul className="divide-y divide-slate-800">{supportTasks.filter((task) => (task.taskOwnerSide || 'mst') === side).map((task) => <li key={task.id} className="py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><div className={'text-sm ' + (task.status === 'completed' ? 'text-emerald-300 line-through' : 'text-slate-100')}>{task.title}</div><div className="mt-1 text-xs text-slate-500">{task.supportAssigneeName || task.assignee?.name || '担当未設定'} · 期限 {task.dueDate || '未設定'} · 優先度 {task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中'}{task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'completed' ? ' · 期限超過' : ''}</div>{task.description && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{task.description}</p>}</div>
                  <div className="flex items-center gap-2"><select aria-label={task.title + 'の状態'} value={task.status} onChange={(event) => setTaskStatus(task, event.target.value as TaskItem['status'])} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white">{Object.entries(TASK_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="button" onClick={() => openTaskEditor(task)} className="rounded border border-slate-700 px-2 py-1 text-xs text-cyan-200">編集</button></div>
                  </div>
                </li>)}</ul>}
            </section>)}
          </div>
        </div>}

        {activeSection === 'delivery' && <div className="space-y-5 p-4">
          <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h4 className="mb-3 font-semibold text-white">構築タスク・マイルストーン</h4>
            <form onSubmit={addMilestone} className="mb-3 flex flex-wrap items-end gap-2"><input value={milestoneDraft} onChange={(event) => setMilestoneDraft(event.target.value)} placeholder="節目を追加" className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" /><label className="text-xs text-slate-400">完了予定日<input type="date" value={milestoneDueDate} onChange={(event) => setMilestoneDueDate(event.target.value)} className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white" /></label><button className="rounded bg-blue-700 px-3 py-2 text-xs text-white">追加</button></form>
            {Array.isArray(selected.milestone_data) && selected.milestone_data.length > 0 ? <ul className="space-y-2">{selected.milestone_data.map((milestone: Row) => {
              const overdue = milestone.due_date && milestone.due_date < new Date().toISOString().slice(0, 10) && milestone.status !== 'completed';
              return <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-3 py-2"><div><span className="text-sm text-slate-200">{milestone.status === 'completed' ? '✓' : '○'} {milestone.title}</span><div className={'mt-1 text-xs ' + (overdue ? 'text-amber-300' : 'text-slate-500')}>{milestone.due_date ? '完了予定 ' + milestone.due_date : '完了予定日未設定'}{overdue ? ' · 期限超過' : ''}</div></div>{milestone.status === 'completed' ? <span className="text-xs text-emerald-300">完了 {milestone.completed_at ? displayDate(milestone.completed_at) : ''}</span> : <button type="button" onClick={() => void onCompleteMilestone(selected, milestone.id)} className="rounded border border-emerald-800 px-2 py-1 text-xs text-emerald-200">完了を記録</button>}</li>;
            })}</ul> : <p className="text-sm text-slate-500">マイルストーンはまだありません。</p>}
            <p className="mt-3 text-xs text-slate-500">完了時は既存のマイルストーン連携から、設定済みの場合にAI社長タスクが作成されます。</p>
          </section>
          <section className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h4 className="mb-3 flex items-center gap-2 font-semibold text-white"><FileText className="h-4 w-4" />顧客への納品物・提出物</h4>
            {documents.length === 0 ? <p className="text-sm text-slate-500">この顧客に紐付く書類はありません。</p> : <ul className="divide-y divide-slate-800">{documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><div><div className="text-sm text-slate-200">{document.title}</div><div className="text-xs text-slate-500">{document.document_type} · {displayDate(document.created_at)}</div></div><span className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">{document.status}</span></li>)}</ul>}
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4"><h4 className="mb-2 font-semibold text-white">契約情報</h4>{activeContract ? <div className="space-y-1 text-sm text-slate-300"><div>{activeContract.title} · {activeContract.status}</div><div>{activeContract.start_date || '開始日未設定'} ～ {activeContract.end_date || '終了日未設定'}</div><div>{Number(activeContract.amount || 0).toLocaleString('ja-JP')}円</div></div> : <p className="text-sm text-slate-500">関連契約はありません。</p>}</section>
            <section className="rounded-lg border border-slate-800 bg-slate-950 p-4"><h4 className="mb-2 font-semibold text-white">請求情報 ({companyInvoices.length})</h4>{companyInvoices.length ? <ul className="space-y-1 text-sm text-slate-300">{companyInvoices.map((invoice) => <li key={invoice.id}>{invoice.title} · {invoice.status} · {Number(invoice.amount || 0).toLocaleString('ja-JP')}円 · 期限 {invoice.dueDate || '未設定'}</li>)}</ul> : <p className="text-sm text-slate-500">請求はありません。</p>}</section>
          </div>
        </div>}
      </section> : <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">顧客支援を登録すると、ここに現在の状況と次の対応を表示します。</section>}
    </div>
  </div>;
};
