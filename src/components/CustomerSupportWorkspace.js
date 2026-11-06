import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, FileText, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';
import { InlineDeleteButton } from './InlineDeleteButton';
import { todayJst } from '../utils/date';
const PHASES = [
    '初回ヒアリング', '現状分析', '課題整理', '改善方針の設計',
    'システム・業務フローの構築', 'テスト・検証', '導入・運用開始',
    '効果測定・改善', '完了',
];
const PURPOSE_OPTIONS = {
    retainer: ['経営課題の整理と優先順位付け', '売上・利益改善の伴走', '月次経営会議・意思決定支援', '業務改善・標準化'],
    implementation_support: ['業務フローの可視化・再設計', 'システム導入・初期設定', 'AI活用・業務自動化の構築', '導入後のテスト・定着支援'],
};
const THEME_OPTIONS = {
    retainer: ['経営課題の整理', '売上・利益の改善', '業務改善', '採用・組織づくり', '資金繰り・財務', '次回テーマを決める'],
    implementation_support: ['現状業務の整理', '要件・仕様の確認', 'システム構築', 'テスト・検証', '導入・操作説明', '効果測定・改善', '次回テーマを決める'],
};
const EMPTY_MEETING = {
    occurred_at: '', purpose: '', topic: '', discussion: '', decisions: '',
    unresolved_items: '', client_homework: '', mst_homework: '',
    next_topic: '', next_meeting_at: '',
};
const EMPTY_TASK = {
    title: '', description: '', taskOwnerSide: 'mst', supportAssigneeName: '',
    dueDate: '', priority: 'medium', status: 'waiting', supportMeetingId: '',
};
const PROGRESS_LABELS = {
    not_started: '未着手', on_track: '順調', at_risk: '要確認', delayed: '遅延', completed: '完了',
};
const TASK_STATUS_LABELS = {
    waiting: '未着手', in_progress: '進行中', pending_approval: '確認待ち', completed: '完了', blocked: '保留',
};
const asDateTimeLocal = (value) => {
    if (!value)
        return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const supportErrorMessage = (error, fallback) => error?.code === '42P01' || error?.code === '42703'
    ? '支援管理DBのマイグレーションが未適用です。supabase/migrations/20261019030537_customer_support_management.sql を適用してから再読み込みしてください。'
    : error?.message || fallback;
const displayDate = (value) => value ? new Date(value).toLocaleString('ja-JP') : '未設定';
export const CustomerSupportWorkspace = ({ companyId, companies, engagements, invoices, tasks, onCreateTask, onUpdateTask, onRefresh, onAddMilestone, onCompleteMilestone, }) => {
    const [selectedId, setSelectedId] = useState('');
    const [activeSection, setActiveSection] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [meetings, setMeetings] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [serviceContracts, setServiceContracts] = useState([]);
    const [meetingDraft, setMeetingDraft] = useState(EMPTY_MEETING);
    const [editingMeetingId, setEditingMeetingId] = useState('');
    const [taskDraft, setTaskDraft] = useState(EMPTY_TASK);
    const [editingTaskId, setEditingTaskId] = useState('');
    const [milestoneDraft, setMilestoneDraft] = useState('');
    const [milestoneDueDate, setMilestoneDueDate] = useState('');
    const [customPhaseDraft, setCustomPhaseDraft] = useState('');
    const [showNewSupport, setShowNewSupport] = useState(false);
    const [newSupport, setNewSupport] = useState({
        title: '', company_id: '', contract_id: '', service_type: 'implementation_support',
        purpose: '', startedAt: todayJst(), ownerName: '',
    });
    const [summaryDraft, setSummaryDraft] = useState({});
    const selected = engagements.find((row) => row.id === selectedId) || engagements[0] || null;
    const selectedCompanyId = selected?.company_id || '';
    const detail = (selected?.support_details && typeof selected.support_details === 'object'
        ? selected.support_details : {});
    const supportTasks = useMemo(() => selected ? tasks.filter((task) => task.supportEngagementId === selected.id) : [], [tasks, selected?.id]);
    const companyTasks = useMemo(() => supportTasks.filter((task) => task.status !== 'completed'), [supportTasks]);
    const overdueTasks = useMemo(() => companyTasks.filter((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10)), [companyTasks]);
    const activeContract = selected?.contract_id
        ? serviceContracts.find((item) => item.id === selected.contract_id) : undefined;
    const companyInvoices = invoices.filter((item) => item.companyId === selectedCompanyId);
    const companyName = (id) => companies.find((item) => item.id === id)?.company_name || id || '会社未設定';
    const phaseOptions = [...PHASES, ...(Array.isArray(detail.phases) ? detail.phases : []), ...(detail.phase ? [detail.phase] : [])]
        .filter((value, index, all) => all.indexOf(value) === index);
    useEffect(() => {
        if (!selectedId && engagements[0])
            setSelectedId(engagements[0].id);
        if (selectedId && !engagements.some((item) => item.id === selectedId))
            setSelectedId(engagements[0]?.id || '');
    }, [engagements, selectedId]);
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
            if (cancelled)
                return;
            if (meetingResult.error)
                throw meetingResult.error;
            if (contractResult.error)
                throw contractResult.error;
            if (documentResult.error)
                throw documentResult.error;
            setMeetings(meetingResult.data || []);
            setServiceContracts(contractResult.data || []);
            setDocuments(documentResult.data || []);
        }).catch((loadError) => {
            if (!cancelled)
                setError(supportErrorMessage(loadError, '支援履歴を読み込めませんでした。'));
        }).finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; };
    }, [selected?.id, selectedCompanyId]);
    const saveSummary = async (event) => {
        event.preventDefault();
        if (!selected)
            return;
        const supabase = getSupabase();
        if (!supabase) {
            setError('Supabaseに接続してください。');
            return;
        }
        setError('');
        setNotice('');
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
        if (saveError) {
            setError(supportErrorMessage(saveError, '支援状況を保存できませんでした。'));
            return;
        }
        setNotice('支援状況を保存しました。');
        await onRefresh();
    };
    const createSupport = async (event) => {
        event.preventDefault();
        const supabase = getSupabase();
        if (!supabase) {
            setError('Supabaseに接続してください。');
            return;
        }
        if (!newSupport.company_id) {
            setError('顧客を選択してください。');
            return;
        }
        setError('');
        setNotice('');
        const supportDetails = {
            purpose: newSupport.purpose.trim() || PURPOSE_OPTIONS[newSupport.service_type][0],
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
        if (insertError) {
            setError(supportErrorMessage(insertError, '顧客支援を登録できませんでした。'));
            return;
        }
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
    const deletePlannedEngagement = async (engagement) => {
        if (engagement.status !== 'planned')
            return;
        const supabase = getSupabase();
        if (!supabase)
            return;
        if (engagement.contract_id || tasks.some((task) => task.supportEngagementId === engagement.id) || (Array.isArray(engagement.milestone_data) && engagement.milestone_data.length > 0)) {
            setError('契約・タスク・マイルストーンに関連しているため削除できません。既存の紐づきを保護しました。');
            return;
        }
        const { data: history, error: historyError } = await supabase
            .from('customer_service_meetings').select('id').eq('engagement_id', engagement.id).limit(1);
        if (historyError) {
            setError(supportErrorMessage(historyError, '履歴を確認できないため削除を中止しました。'));
            return;
        }
        if (history?.length) {
            setError('打ち合わせ履歴があるため削除できません。支援履歴を保持しました。');
            return;
        }
        const { data: deleted, error: deleteError } = await supabase.from('customer_service_engagements')
            .delete().eq('id', engagement.id).eq('status', 'planned').select('id').maybeSingle();
        if (deleteError) {
            setError(supportErrorMessage(deleteError, '支援を削除できませんでした。'));
            return;
        }
        if (!deleted) {
            setError('削除対象が見つからないか、削除権限がありません。');
            return;
        }
        setNotice('未開始の顧客支援を削除しました。');
        if (selectedId === engagement.id)
            setSelectedId('');
        await onRefresh();
    };
    const saveMeeting = async (event) => {
        event.preventDefault();
        if (!selected)
            return;
        const supabase = getSupabase();
        if (!supabase) {
            setError('Supabaseに接続してください。');
            return;
        }
        if (!meetingDraft.occurred_at || !meetingDraft.topic.trim()) {
            setError('打ち合わせ日時と今回のテーマを入力してください。');
            return;
        }
        setError('');
        setNotice('');
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
        if (result.error) {
            setError(supportErrorMessage(result.error, '打ち合わせ履歴を保存できませんでした。'));
            return;
        }
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
            if (summaryError) {
                setError(supportErrorMessage(summaryError, '支援の次回予定を更新できませんでした。'));
                return;
            }
        }
        setMeetingDraft(EMPTY_MEETING);
        setEditingMeetingId('');
        setNotice('打ち合わせ履歴を保存しました。宿題は一覧から担当と期限を設定できます。');
        const { data } = await supabase.from('customer_service_meetings').select('*')
            .eq('engagement_id', selected.id).order('occurred_at', { ascending: false });
        setMeetings(data || []);
        await onRefresh();
    };
    const editMeeting = (meeting) => {
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
    const saveTask = (event) => {
        event.preventDefault();
        if (!selected || !taskDraft.title.trim())
            return;
        const now = Date.now();
        const relatedRecord = { type: 'company', id: selected.company_id, label: companyName(selected.company_id) };
        const assignee = { type: 'human', name: taskDraft.supportAssigneeName.trim() || (taskDraft.taskOwnerSide === 'client' ? '顧客側担当' : 'MST担当') };
        if (editingTaskId) {
            const original = supportTasks.find((task) => task.id === editingTaskId);
            if (!original)
                return;
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
        }
        else {
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
    const editTask = (task) => {
        setEditingTaskId(task.id);
        setTaskDraft({
            title: task.title, description: task.description || '',
            taskOwnerSide: task.taskOwnerSide || 'mst',
            supportAssigneeName: task.supportAssigneeName || task.assignee?.name || '',
            dueDate: task.dueDate || '', priority: task.priority || 'medium',
            status: task.status, supportMeetingId: task.supportMeetingId || '',
        });
    };
    const setTaskStatus = (task, status) => {
        const now = Date.now();
        onUpdateTask({
            ...task, status,
            completedAt: status === 'completed' ? (task.completedAt || now) : undefined,
            updatedAt: now,
        });
    };
    const addCustomPhase = (input) => {
        const value = input.trim();
        if (!value || !selected)
            return;
        setSummaryDraft((current) => ({
            ...current,
            phases: [...new Set([...(current.phases || []), value])],
            phase: current.phase || value,
        }));
        setCustomPhaseDraft('');
    };
    const addMilestone = async (event) => {
        event.preventDefault();
        if (!selected || !milestoneDraft.trim())
            return;
        await onAddMilestone(selected, milestoneDraft.trim(), milestoneDueDate || undefined);
        setMilestoneDraft('');
        setMilestoneDueDate('');
    };
    const openTaskEditor = (task) => {
        if (task)
            editTask(task);
        else {
            setEditingTaskId('');
            setTaskDraft(EMPTY_TASK);
        }
    };
    const sections = [
        ['overview', '支援状況'], ['meetings', '打ち合わせ履歴'],
        ['tasks', '宿題・TODO'], ['delivery', '構築・納品・契約'],
    ];
    return _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "\u9867\u5BA2\u652F\u63F4\u30FB\u69CB\u7BC9\u7BA1\u7406" }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "\u9867\u5BA2\u3054\u3068\u306E\u30D5\u30A7\u30FC\u30BA\u3001\u6B21\u56DE\u4E88\u5B9A\u3001\u5C65\u6B74\u3001\u5BBF\u984C\u3001\u7D0D\u54C1\u72B6\u6CC1\u3092\u307E\u3068\u3081\u3066\u78BA\u8A8D\u3057\u307E\u3059\u3002" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { type: "button", onClick: () => void onRefresh(), className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs", children: [_jsx(RefreshCw, { className: "h-3.5 w-3.5" }), "\u66F4\u65B0"] }), _jsxs("button", { type: "button", onClick: () => { setShowNewSupport((value) => !value); setNewSupport((value) => { const nextCompanyId = companyId || value.company_id; const candidates = serviceContracts.filter((item) => item.company_id === nextCompanyId); const linkedContract = value.contract_id ? candidates.find((item) => item.id === value.contract_id) : candidates.length === 1 ? candidates[0] : undefined; return { ...value, company_id: nextCompanyId, contract_id: linkedContract?.id || value.contract_id, startedAt: linkedContract?.start_date || value.startedAt || todayJst(), ownerName: value.ownerName || 'MST担当', purpose: value.purpose || PURPOSE_OPTIONS[value.service_type][0] }; }); }, className: "inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer shadow-xs shadow-purple-600/20", children: [_jsx(Plus, { className: "h-4 w-4" }), "\u652F\u63F4\u3092\u767B\u9332"] })] })] }), error && _jsx("div", { role: "alert", className: "mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs", children: error }), notice && _jsx("div", { role: "status", className: "mt-3 rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 shadow-2xs", children: notice })] }), showNewSupport && _jsxs("form", { onSubmit: createSupport, className: "grid gap-3.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 shadow-xs", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u652F\u63F4\u540D\uFF08\u81EA\u52D5\uFF09", _jsx("input", { readOnly: true, value: `${newSupport.company_id ? companyName(newSupport.company_id) : '顧客未選択'} ${newSupport.service_type === 'retainer' ? '顧問支援' : '構築支援'}`, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u9867\u5BA2", _jsxs("select", { required: true, value: companyId || newSupport.company_id, disabled: Boolean(companyId), onChange: (event) => { const nextCompanyId = event.target.value; const candidates = serviceContracts.filter((item) => item.company_id === nextCompanyId); const linkedContract = candidates.length === 1 ? candidates[0] : undefined; setNewSupport({ ...newSupport, company_id: nextCompanyId, contract_id: linkedContract?.id || '', startedAt: linkedContract?.start_date || todayJst() }); }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "", children: "\u9867\u5BA2\u3092\u9078\u629E" }), companies.map((item) => _jsx("option", { value: item.id, children: item.company_name }, item.id))] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u5951\u7D04", _jsxs("select", { value: newSupport.contract_id, onChange: (event) => { const contractId = event.target.value; const contract = serviceContracts.find((item) => item.id === contractId); setNewSupport({ ...newSupport, contract_id: contractId, startedAt: contract?.start_date || newSupport.startedAt || todayJst() }); }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "", children: "\u5951\u7D04\u3068\u7D10\u4ED8\u3051\u306A\u3044" }), serviceContracts.filter((item) => item.company_id === (companyId || newSupport.company_id)).map((item) => _jsxs("option", { value: item.id, children: [item.title, " \u00B7 ", item.status] }, item.id))] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u652F\u63F4\u7A2E\u5225", _jsxs("select", { value: newSupport.service_type, onChange: (event) => { const serviceType = event.target.value; setNewSupport({ ...newSupport, service_type: serviceType, purpose: PURPOSE_OPTIONS[serviceType].includes(newSupport.purpose) ? newSupport.purpose : PURPOSE_OPTIONS[serviceType][0] }); }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "implementation_support", children: "\u69CB\u7BC9\u652F\u63F4" }), _jsx("option", { value: "retainer", children: "\u9867\u554F" })] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u958B\u59CB\u65E5\uFF08\u5951\u7D04\u304B\u3089\u81EA\u52D5\u5165\u529B\uFF09", _jsx("input", { type: "date", value: newSupport.startedAt, onChange: (event) => setNewSupport({ ...newSupport, startedAt: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u62C5\u5F53\u8005", _jsxs("select", { value: newSupport.ownerName || 'MST担当', onChange: (event) => setNewSupport({ ...newSupport, ownerName: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "MST\u62C5\u5F53", children: "MST\u62C5\u5F53" }), _jsx("option", { value: "\u9867\u5BA2\u5074\u62C5\u5F53", children: "\u9867\u5BA2\u5074\u62C5\u5F53" })] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700 md:col-span-2", children: ["\u652F\u63F4\u5185\u5BB9\u30FB\u76EE\u7684", _jsx("select", { value: newSupport.purpose, onChange: (event) => setNewSupport({ ...newSupport, purpose: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: PURPOSE_OPTIONS[newSupport.service_type].map((purpose) => _jsx("option", { value: purpose, children: purpose }, purpose)) })] }), _jsx("p", { className: "text-xs text-slate-500 md:col-span-2", children: "\u9867\u5BA2\u30FB\u652F\u63F4\u7A2E\u5225\u304B\u3089\u652F\u63F4\u540D\u3092\u4F5C\u6210\u3057\u3001\u5951\u7D04\u304C1\u4EF6\u3060\u3051\u306A\u3089\u81EA\u52D5\u3067\u95A2\u9023\u4ED8\u3051\u307E\u3059\u3002\u958B\u59CB\u65E5\u306F\u5951\u7D04\u60C5\u5831\u3092\u5F15\u304D\u7D99\u304E\u307E\u3059\u3002" }), _jsx("div", { className: "md:col-span-2", children: _jsx("button", { className: "rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 cursor-pointer", children: "\u767B\u9332\u3059\u308B" }) })] }), _jsxs("div", { className: "grid gap-3.5 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]", children: [_jsxs("section", { className: "space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs", children: [_jsxs("h3", { className: "font-bold text-sm text-slate-900", children: ["\u9867\u5BA2\u652F\u63F4\u4E00\u89A7 (", engagements.length, ")"] }), engagements.length === 0 ? _jsx("p", { className: "text-xs text-slate-400 py-6 text-center", children: "\u9867\u5BA2\u652F\u63F4\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u300C\u652F\u63F4\u3092\u767B\u9332\u300D\u304B\u3089\u4F5C\u6210\u3067\u304D\u307E\u3059\u3002" }) :
                                _jsx("ul", { className: "space-y-2", children: engagements.map((item) => {
                                        const itemDetail = (item.support_details && typeof item.support_details === 'object' ? item.support_details : {});
                                        const itemTasks = tasks.filter((task) => task.supportEngagementId === item.id);
                                        const open = itemTasks.filter((task) => task.status !== 'completed');
                                        const overdue = open.some((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10));
                                        const lateMilestone = Array.isArray(item.milestone_data) && item.milestone_data.some((milestone) => milestone.due_date && milestone.due_date < new Date().toISOString().slice(0, 10) && milestone.status !== 'completed');
                                        const lateMeeting = item.next_meeting_at && new Date(item.next_meeting_at).getTime() < Date.now();
                                        const warning = overdue || lateMilestone || lateMeeting || item.status === 'paused' || itemDetail.progressStatus === 'delayed' || itemDetail.progressStatus === 'at_risk';
                                        return _jsxs("li", { className: "flex items-stretch gap-2", children: [_jsxs("button", { type: "button", onClick: () => { setSelectedId(item.id); setActiveSection('overview'); setNotice(''); setError(''); }, className: 'min-w-0 flex-1 rounded-xl border p-3 text-left transition-all cursor-pointer ' + (selected?.id === item.id ? 'border-purple-600 bg-purple-50/70 shadow-2xs' : 'border-slate-200 bg-white hover:border-purple-200'), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx("span", { className: "font-bold text-xs text-slate-900", children: companyName(item.company_id) }), warning && _jsx(AlertTriangle, { className: "h-4 w-4 shrink-0 text-amber-500" })] }), _jsx("div", { className: "mt-1 text-xs font-medium text-slate-700", children: item.title }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500", children: [_jsx("span", { children: itemDetail.phase || PHASES[0] }), _jsx("span", { children: itemDetail.currentTheme || 'テーマ未設定' }), _jsxs("span", { children: ["\u6B21\u56DE ", displayDate(item.next_meeting_at)] }), _jsxs("span", { children: ["\u672A\u5B8C\u4E86 ", open.length, "\u4EF6"] }), _jsx("span", { children: PROGRESS_LABELS[itemDetail.progressStatus || 'not_started'] })] }), warning && _jsx("div", { className: "mt-2 text-[11px] text-amber-700 font-semibold", children: overdue ? '期限超過タスクあり' : lateMilestone ? '期限超過マイルストーンあり' : lateMeeting ? '次回予定日を過ぎています' : itemDetail.progressStatus === 'delayed' ? '進捗遅延' : itemDetail.progressStatus === 'at_risk' ? '支援上の確認が必要です' : '支援が保留中です' })] }), item.status === 'planned' && _jsx(InlineDeleteButton, { onConfirm: () => void deletePlannedEngagement(item), warning: `「${item.title}」を削除しますか？`, className: "self-start rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 cursor-pointer shadow-2xs", ariaLabel: `顧客支援「${item.title}」を削除`, children: _jsx(Trash2, { className: "h-4 w-4" }) })] }, item.id);
                                    }) })] }), selected ? _jsxs("section", { className: "min-w-0 rounded-2xl border border-slate-200 bg-white shadow-xs", children: [_jsx("div", { className: "border-b border-slate-100 p-4", children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("h3", { className: "font-bold text-slate-900 text-sm", children: [companyName(selected.company_id), " \u00B7 ", selected.title] }), _jsxs("div", { className: "mt-0.5 text-xs text-slate-500", children: [selected.service_type === 'implementation_support' ? '構築支援' : '顧問', " \u00B7 ", selected.status] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: sections.map(([key, label]) => _jsx("button", { type: "button", onClick: () => setActiveSection(key), className: 'rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ' + (activeSection === key ? 'bg-purple-600 text-white shadow-2xs' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'), children: label }, key)) })] }) }), activeSection === 'overview' && _jsxs("form", { onSubmit: saveSummary, className: "grid gap-3.5 p-4 md:grid-cols-2", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u652F\u63F4\u540D", _jsx("input", { value: selected.title || '', readOnly: true, className: "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u5951\u7D04", _jsxs("select", { value: selected.contract_id || '', onChange: async (event) => {
                                                    const supabase = getSupabase();
                                                    if (!supabase)
                                                        return;
                                                    const { error: updateError } = await supabase.from('customer_service_engagements').update({ contract_id: event.target.value || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
                                                    if (updateError)
                                                        setError(updateError.message);
                                                    else {
                                                        setNotice('契約との関連付けを更新しました。');
                                                        await onRefresh();
                                                    }
                                                }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "", children: "\u672A\u95A2\u9023\u4ED8\u3051" }), serviceContracts.filter((item) => item.company_id === selected.company_id).map((item) => _jsxs("option", { value: item.id, children: [item.title, " \u00B7 ", item.status] }, item.id))] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u652F\u63F4\u30D5\u30A7\u30FC\u30BA", _jsx("select", { value: summaryDraft.phase || PHASES[0], onChange: (event) => setSummaryDraft({ ...summaryDraft, phase: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: phaseOptions.map((phase) => _jsx("option", { value: phase, children: phase }, phase)) })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u652F\u63F4\u72B6\u6CC1", _jsxs("select", { value: selected.status || 'planned', onChange: async (event) => {
                                                    const supabase = getSupabase();
                                                    if (!supabase)
                                                        return;
                                                    const { error: updateError } = await supabase.from('customer_service_engagements').update({ status: event.target.value, updated_at: new Date().toISOString() }).eq('id', selected.id);
                                                    if (updateError)
                                                        setError(updateError.message);
                                                    else
                                                        await onRefresh();
                                                }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "planned", children: "\u4E88\u5B9A" }), _jsx("option", { value: "active", children: "\u9032\u884C\u4E2D" }), _jsx("option", { value: "paused", children: "\u4FDD\u7559" }), _jsx("option", { value: "completed", children: "\u5B8C\u4E86" }), _jsx("option", { value: "canceled", children: "\u4E2D\u6B62" })] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u73FE\u5728\u306E\u30C6\u30FC\u30DE", _jsx("input", { list: "support-theme-options", value: summaryDraft.currentTheme || '', onChange: (event) => setSummaryDraft({ ...summaryDraft, currentTheme: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" }), _jsx("datalist", { id: "support-theme-options", children: THEME_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'].map((theme) => _jsx("option", { value: theme }, theme)) })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u6B21\u56DE\u306E\u30C6\u30FC\u30DE", _jsx("input", { list: "support-theme-options", value: summaryDraft.nextTheme || '', onChange: (event) => setSummaryDraft({ ...summaryDraft, nextTheme: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u6B21\u56DE\u306E\u6253\u3061\u5408\u308F\u305B\u65E5\u6642", _jsx("input", { type: "datetime-local", value: asDateTimeLocal(selected.next_meeting_at), onChange: async (event) => {
                                                    const supabase = getSupabase();
                                                    if (!supabase)
                                                        return;
                                                    const { error: updateError } = await supabase.from('customer_service_engagements').update({ next_meeting_at: event.target.value ? new Date(event.target.value).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', selected.id);
                                                    if (updateError)
                                                        setError(updateError.message);
                                                    else
                                                        await onRefresh();
                                                }, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u9032\u6357\u72B6\u6CC1", _jsx("select", { value: summaryDraft.progressStatus || 'not_started', onChange: (event) => setSummaryDraft({ ...summaryDraft, progressStatus: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: Object.entries(PROGRESS_LABELS).map(([key, label]) => _jsx("option", { value: key, children: label }, key)) })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u652F\u63F4\u958B\u59CB\u65E5", _jsx("input", { type: "date", value: summaryDraft.startedAt || '', onChange: (event) => setSummaryDraft({ ...summaryDraft, startedAt: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["MST\u62C5\u5F53\u8005", _jsxs("select", { value: summaryDraft.ownerName || 'MST担当', onChange: (event) => setSummaryDraft({ ...summaryDraft, ownerName: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [summaryDraft.ownerName && !['MST担当', '顧客側担当'].includes(summaryDraft.ownerName) && _jsx("option", { value: summaryDraft.ownerName, children: summaryDraft.ownerName }), _jsx("option", { value: "MST\u62C5\u5F53", children: "MST\u62C5\u5F53" }), _jsx("option", { value: "\u9867\u5BA2\u5074\u62C5\u5F53", children: "\u9867\u5BA2\u5074\u62C5\u5F53" })] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700 md:col-span-2", children: ["\u652F\u63F4\u5185\u5BB9\u30FB\u76EE\u7684", _jsxs("select", { value: summaryDraft.purpose || PURPOSE_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'][0], onChange: (event) => setSummaryDraft({ ...summaryDraft, purpose: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [summaryDraft.purpose && !PURPOSE_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'].includes(summaryDraft.purpose) && _jsx("option", { value: summaryDraft.purpose, children: summaryDraft.purpose }), PURPOSE_OPTIONS[selected.service_type === 'retainer' ? 'retainer' : 'implementation_support'].map((purpose) => _jsx("option", { value: purpose, children: purpose }, purpose))] })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700 md:col-span-2", children: ["\u9032\u6357\u30E1\u30E2", _jsx("textarea", { value: summaryDraft.progressNote || '', onChange: (event) => setSummaryDraft({ ...summaryDraft, progressNote: event.target.value }), rows: 2, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700 md:col-span-2", children: ["\u91CD\u8981\u306A\u8AB2\u984C\u30FB\u78BA\u8A8D\u4E8B\u9805", _jsx("textarea", { value: summaryDraft.keyIssue || '', onChange: (event) => setSummaryDraft({ ...summaryDraft, keyIssue: event.target.value }), rows: 2, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700 md:col-span-2", children: ["\u6B21\u56DE\u307E\u3067\u306B\u78BA\u8A8D\u3057\u3066\u304A\u304F\u4E8B\u9805", _jsx("textarea", { value: summaryDraft.nextChecklist || '', onChange: (event) => setSummaryDraft({ ...summaryDraft, nextChecklist: event.target.value }), rows: 2, className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("div", { className: "mb-2 text-xs font-semibold text-slate-700", children: "\u9867\u5BA2\u3054\u3068\u306E\u30D5\u30A7\u30FC\u30BA\u5019\u88DC" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { value: customPhaseDraft, onChange: (event) => setCustomPhaseDraft(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            addCustomPhase(customPhaseDraft);
                                                        } }, placeholder: "\u500B\u5225\u30D5\u30A7\u30FC\u30BA\u3092\u8FFD\u52A0", className: "min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" }), _jsx("button", { type: "button", onClick: () => addCustomPhase(customPhaseDraft), className: "rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs", children: "\u8FFD\u52A0" })] }), summaryDraft.phases?.length ? _jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: summaryDraft.phases.map((phase) => _jsx("span", { className: "rounded-lg bg-purple-50 border border-purple-200 px-2 py-1 text-xs text-purple-700 font-semibold", children: phase }, phase)) }) : null] }), _jsxs("div", { className: "flex items-center justify-between gap-3 md:col-span-2 pt-2 border-t border-slate-100", children: [_jsx("span", { className: "text-xs text-slate-500", children: "\u5951\u7D04\u30FB\u9867\u5BA2\u60C5\u5831\u306F\u65E2\u5B58\u30EC\u30B3\u30FC\u30C9\u3092\u53C2\u7167\u3057\u3066\u3044\u307E\u3059\u3002" }), _jsxs("button", { className: "inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition cursor-pointer shadow-xs shadow-purple-600/20", children: [_jsx(Save, { className: "h-4 w-4" }), "\u652F\u63F4\u72B6\u6CC1\u3092\u4FDD\u5B58"] })] })] }), activeSection === 'meetings' && _jsxs("div", { className: "grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]", children: [_jsxs("form", { onSubmit: saveMeeting, className: "space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs", children: [_jsx("h4", { className: "font-bold text-slate-900 text-sm", children: editingMeetingId ? '打ち合わせ履歴を編集' : '打ち合わせを記録' }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u65E5\u6642", _jsx("input", { required: true, type: "datetime-local", value: meetingDraft.occurred_at, onChange: (event) => setMeetingDraft({ ...meetingDraft, occurred_at: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u76EE\u7684", _jsx("input", { value: meetingDraft.purpose, onChange: (event) => setMeetingDraft({ ...meetingDraft, purpose: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u4ECA\u56DE\u306E\u30C6\u30FC\u30DE", _jsx("input", { required: true, value: meetingDraft.topic, onChange: (event) => setMeetingDraft({ ...meetingDraft, topic: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u8A71\u3057\u5408\u3063\u305F\u5185\u5BB9", _jsx("textarea", { rows: 3, value: meetingDraft.discussion, onChange: (event) => setMeetingDraft({ ...meetingDraft, discussion: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u6C7A\u5B9A\u4E8B\u9805", _jsx("textarea", { rows: 2, value: meetingDraft.decisions, onChange: (event) => setMeetingDraft({ ...meetingDraft, decisions: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u4FDD\u7559\u4E8B\u9805\u30FB\u672A\u89E3\u6C7A\u8AB2\u984C", _jsx("textarea", { rows: 2, value: meetingDraft.unresolved_items, onChange: (event) => setMeetingDraft({ ...meetingDraft, unresolved_items: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u9867\u5BA2\u5074\u306E\u5BBF\u984C", _jsx("textarea", { rows: 2, value: meetingDraft.client_homework, onChange: (event) => setMeetingDraft({ ...meetingDraft, client_homework: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["MST\u5074\u306E\u5BBF\u984C", _jsx("textarea", { rows: 2, value: meetingDraft.mst_homework, onChange: (event) => setMeetingDraft({ ...meetingDraft, mst_homework: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u6B21\u56DE\u30C6\u30FC\u30DE", _jsx("input", { value: meetingDraft.next_topic, onChange: (event) => setMeetingDraft({ ...meetingDraft, next_topic: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u6B21\u56DE\u65E5\u6642", _jsx("input", { type: "datetime-local", value: meetingDraft.next_meeting_at, onChange: (event) => setMeetingDraft({ ...meetingDraft, next_meeting_at: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 cursor-pointer", children: editingMeetingId ? '変更を保存' : '記録を保存' }), editingMeetingId && _jsx("button", { type: "button", onClick: () => { setEditingMeetingId(''); setMeetingDraft(EMPTY_MEETING); }, className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer", children: "\u7DE8\u96C6\u3092\u53D6\u308A\u6D88\u3059" })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("h4", { className: "font-bold text-slate-900 text-sm", children: "\u3053\u308C\u307E\u3067\u306E\u6253\u3061\u5408\u308F\u305B\uFF08\u65B0\u3057\u3044\u9806\uFF09" }), loading ? _jsx("p", { className: "text-xs text-slate-400", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" }) : meetings.length === 0 ? _jsx("p", { className: "text-xs text-slate-400 py-6 text-center", children: "\u5C65\u6B74\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002" }) : meetings.map((meeting) => _jsxs("article", { className: "rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("div", { className: "font-bold text-xs text-slate-900", children: meeting.topic }), _jsxs("div", { className: "mt-0.5 text-[11px] text-slate-500", children: [displayDate(meeting.occurred_at), " \u00B7 ", meeting.purpose || '目的未設定'] })] }), _jsx("button", { type: "button", onClick: () => editMeeting(meeting), className: "rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-2xs", children: "\u7DE8\u96C6" })] }), meeting.discussion && _jsx("p", { className: "mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700", children: meeting.discussion }), meeting.decisions && _jsxs("p", { className: "mt-2 whitespace-pre-wrap text-xs text-emerald-800 font-medium", children: ["\u6C7A\u5B9A: ", meeting.decisions] }), meeting.unresolved_items && _jsxs("p", { className: "mt-2 whitespace-pre-wrap text-xs text-amber-800 font-medium", children: ["\u4FDD\u7559: ", meeting.unresolved_items] }), meeting.client_homework && _jsxs("p", { className: "mt-2 whitespace-pre-wrap text-xs text-purple-800 font-medium", children: ["\u9867\u5BA2\u5074TODO: ", meeting.client_homework] }), meeting.mst_homework && _jsxs("p", { className: "mt-2 whitespace-pre-wrap text-xs text-indigo-800 font-medium", children: ["MST\u5074TODO: ", meeting.mst_homework] }), meeting.next_topic && _jsxs("p", { className: "mt-2 text-[11px] text-slate-500", children: ["\u6B21\u56DE: ", meeting.next_topic, " \u00B7 ", displayDate(meeting.next_meeting_at)] })] }, meeting.id))] })] }), activeSection === 'tasks' && _jsxs("div", { className: "grid gap-4 p-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]", children: [_jsxs("form", { onSubmit: saveTask, className: "space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs", children: [_jsx("h4", { className: "font-bold text-slate-900 text-sm", children: editingTaskId ? '宿題・TODOを編集' : '宿題・TODOを追加' }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u30BF\u30B9\u30AF\u540D", _jsx("input", { required: true, value: taskDraft.title, onChange: (event) => setTaskDraft({ ...taskDraft, title: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u62C5\u5F53\u533A\u5206", _jsxs("select", { value: taskDraft.taskOwnerSide, onChange: (event) => setTaskDraft({ ...taskDraft, taskOwnerSide: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "client", children: "\u9867\u5BA2\u5074" }), _jsx("option", { value: "mst", children: "MST\u5074" })] })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u62C5\u5F53\u8005", _jsx("input", { value: taskDraft.supportAssigneeName, onChange: (event) => setTaskDraft({ ...taskDraft, supportAssigneeName: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u95A2\u9023\u3059\u308B\u6253\u3061\u5408\u308F\u305B", _jsxs("select", { value: taskDraft.supportMeetingId, onChange: (event) => setTaskDraft({ ...taskDraft, supportMeetingId: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "", children: "\u6307\u5B9A\u3057\u306A\u3044" }), meetings.map((meeting) => _jsxs("option", { value: meeting.id, children: [displayDate(meeting.occurred_at), " \u00B7 ", meeting.topic] }, meeting.id))] })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u671F\u9650", _jsx("input", { type: "date", value: taskDraft.dueDate, onChange: (event) => setTaskDraft({ ...taskDraft, dueDate: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u72B6\u614B", _jsx("select", { value: taskDraft.status, onChange: (event) => setTaskDraft({ ...taskDraft, status: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: Object.entries(TASK_STATUS_LABELS).filter(([key]) => key !== 'pending_approval').map(([key, label]) => _jsx("option", { value: key, children: label }, key)) })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u512A\u5148\u5EA6", _jsxs("select", { value: taskDraft.priority, onChange: (event) => setTaskDraft({ ...taskDraft, priority: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs", children: [_jsx("option", { value: "high", children: "\u9AD8" }), _jsx("option", { value: "medium", children: "\u4E2D" }), _jsx("option", { value: "low", children: "\u4F4E" })] })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-700", children: ["\u8A73\u7D30", _jsx("textarea", { rows: 3, value: taskDraft.description, onChange: (event) => setTaskDraft({ ...taskDraft, description: event.target.value }), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-purple-600/20 cursor-pointer", children: editingTaskId ? '変更を保存' : 'タスクを登録' }), editingTaskId && _jsx("button", { type: "button", onClick: () => openTaskEditor(), className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer", children: "\u65B0\u898F\u5165\u529B\u3078" })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("h4", { className: "font-bold text-slate-900 text-sm", children: ["\u672A\u5B8C\u4E86 ", companyTasks.length, "\u4EF6 \u00B7 \u671F\u9650\u8D85\u904E ", overdueTasks.length, "\u4EF6"] }), _jsx(ClipboardList, { className: "h-4 w-4 text-slate-400" })] }), ['client', 'mst'].map((side) => _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs", children: [_jsx("h5", { className: "mb-2 text-xs font-bold text-slate-900", children: side === 'client' ? '顧客側の宿題' : 'MST側のTODO' }), supportTasks.filter((task) => (task.taskOwnerSide || 'mst') === side).length === 0 ? _jsx("p", { className: "text-xs text-slate-400", children: "\u30BF\u30B9\u30AF\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }) :
                                                        _jsx("ul", { className: "divide-y divide-slate-100", children: supportTasks.filter((task) => (task.taskOwnerSide || 'mst') === side).map((task) => _jsx("li", { className: "py-2.5", children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("div", { className: 'text-xs font-semibold ' + (task.status === 'completed' ? 'text-emerald-700 line-through' : 'text-slate-800'), children: task.title }), _jsxs("div", { className: "mt-1 text-[11px] text-slate-500", children: [task.supportAssigneeName || task.assignee?.name || '担当未設定', " \u00B7 \u671F\u9650 ", task.dueDate || '未設定', " \u00B7 \u512A\u5148\u5EA6 ", task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中', task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'completed' ? ' · 期限超過' : ''] }), task.description && _jsx("p", { className: "mt-1 whitespace-pre-wrap text-xs text-slate-600", children: task.description })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("select", { "aria-label": task.title + 'の状態', value: task.status, onChange: (event) => setTaskStatus(task, event.target.value), className: "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-purple-600 shadow-2xs", children: Object.entries(TASK_STATUS_LABELS).map(([key, label]) => _jsx("option", { value: key, children: label }, key)) }), _jsx("button", { type: "button", onClick: () => openTaskEditor(task), className: "rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-2xs", children: "\u7DE8\u96C6" })] })] }) }, task.id)) })] }, side))] })] }), activeSection === 'delivery' && _jsxs("div", { className: "space-y-4 p-4", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xs", children: [_jsx("h4", { className: "mb-3 font-bold text-slate-900 text-sm", children: "\u69CB\u7BC9\u30BF\u30B9\u30AF\u30FB\u30DE\u30A4\u30EB\u30B9\u30C8\u30FC\u30F3" }), _jsxs("form", { onSubmit: addMilestone, className: "mb-3 flex flex-wrap items-end gap-2", children: [_jsx("input", { value: milestoneDraft, onChange: (event) => setMilestoneDraft(event.target.value), placeholder: "\u7BC0\u76EE\u3092\u8FFD\u52A0", className: "min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" }), _jsxs("label", { className: "text-xs font-semibold text-slate-600", children: ["\u5B8C\u4E86\u4E88\u5B9A\u65E5", _jsx("input", { type: "date", value: milestoneDueDate, onChange: (event) => setMilestoneDueDate(event.target.value), className: "mt-1 block rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-2xs" })] }), _jsx("button", { className: "rounded-xl bg-purple-600 hover:bg-purple-700 px-3 py-2 text-xs font-bold text-white shadow-2xs cursor-pointer", children: "\u8FFD\u52A0" })] }), Array.isArray(selected.milestone_data) && selected.milestone_data.length > 0 ? _jsx("ul", { className: "space-y-2", children: selected.milestone_data.map((milestone) => {
                                                    const overdue = milestone.due_date && milestone.due_date < new Date().toISOString().slice(0, 10) && milestone.status !== 'completed';
                                                    return _jsxs("li", { className: "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs", children: [_jsxs("div", { children: [_jsxs("span", { className: "text-xs font-bold text-slate-800", children: [milestone.status === 'completed' ? '✓' : '○', " ", milestone.title] }), _jsxs("div", { className: 'mt-1 text-[11px] ' + (overdue ? 'text-amber-700 font-semibold' : 'text-slate-500'), children: [milestone.due_date ? '完了予定 ' + milestone.due_date : '完了予定日未設定', overdue ? ' · 期限超過' : ''] })] }), milestone.status === 'completed' ? _jsxs("span", { className: "text-xs font-semibold text-emerald-700", children: ["\u5B8C\u4E86 ", milestone.completed_at ? displayDate(milestone.completed_at) : ''] }) : _jsx("button", { type: "button", onClick: () => void onCompleteMilestone(selected, milestone.id), className: "rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 cursor-pointer shadow-2xs", children: "\u5B8C\u4E86\u3092\u8A18\u9332" })] }, milestone.id);
                                                }) }) : _jsx("p", { className: "text-xs text-slate-400", children: "\u30DE\u30A4\u30EB\u30B9\u30C8\u30FC\u30F3\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002" }), _jsx("p", { className: "mt-3 text-[11px] text-slate-500", children: "\u5B8C\u4E86\u6642\u306F\u65E2\u5B58\u306E\u30DE\u30A4\u30EB\u30B9\u30C8\u30FC\u30F3\u9023\u643A\u304B\u3089\u3001\u8A2D\u5B9A\u6E08\u307F\u306E\u5834\u5408\u306BAI\u793E\u9577\u30BF\u30B9\u30AF\u304C\u4F5C\u6210\u3055\u308C\u307E\u3059\u3002" })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs", children: [_jsxs("h4", { className: "mb-3 flex items-center gap-2 font-bold text-slate-900 text-sm", children: [_jsx(FileText, { className: "h-4 w-4 text-purple-600" }), "\u9867\u5BA2\u3078\u306E\u7D0D\u54C1\u7269\u30FB\u63D0\u51FA\u7269"] }), documents.length === 0 ? _jsx("p", { className: "text-xs text-slate-400 py-4 text-center", children: "\u3053\u306E\u9867\u5BA2\u306B\u7D10\u4ED8\u304F\u66F8\u985E\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }) : _jsx("ul", { className: "divide-y divide-slate-100", children: documents.map((document) => _jsxs("li", { className: "flex flex-wrap items-center justify-between gap-2 py-2.5", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-bold text-slate-900", children: document.title }), _jsxs("div", { className: "text-[11px] text-slate-500", children: [document.document_type, " \u00B7 ", displayDate(document.created_at)] })] }), _jsx("span", { className: "rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700", children: document.status })] }, document.id)) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs", children: [_jsx("h4", { className: "mb-2 font-bold text-slate-900 text-sm", children: "\u5951\u7D04\u60C5\u5831" }), activeContract ? _jsxs("div", { className: "space-y-1 text-xs text-slate-700", children: [_jsxs("div", { className: "font-semibold text-slate-900", children: [activeContract.title, " \u00B7 ", activeContract.status] }), _jsxs("div", { children: [activeContract.start_date || '開始日未設定', " \uFF5E ", activeContract.end_date || '終了日未設定'] }), _jsxs("div", { children: ["\u7A0E\u629C \u00A5", Number(activeContract.amount || 0).toLocaleString('ja-JP'), " ", _jsxs("span", { className: "text-[11px] text-purple-700 font-semibold", children: ["\uFF08\u7A0E\u8FBC \u00A5", Math.floor(Number(activeContract.amount || 0) * 1.1).toLocaleString('ja-JP'), "\uFF09"] })] })] }) : _jsx("p", { className: "text-xs text-slate-400", children: "\u95A2\u9023\u5951\u7D04\u306F\u3042\u308A\u307E\u305B\u3093\u3002" })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs", children: [_jsxs("h4", { className: "mb-2 font-bold text-slate-900 text-sm", children: ["\u8ACB\u6C42\u60C5\u5831 (", companyInvoices.length, ")"] }), companyInvoices.length ? _jsx("ul", { className: "space-y-1 text-xs text-slate-700", children: companyInvoices.map((invoice) => _jsxs("li", { children: [invoice.title, " \u00B7 ", invoice.status, " \u00B7 \u7A0E\u629C \u00A5", Number(invoice.amount || 0).toLocaleString('ja-JP'), " ", _jsxs("span", { className: "text-[11px] text-purple-700 font-semibold", children: ["\uFF08\u7A0E\u8FBC \u00A5", Math.floor(Number(invoice.amount || 0) * 1.1).toLocaleString('ja-JP'), "\uFF09"] }), " \u00B7 \u671F\u9650 ", invoice.dueDate || '未設定'] }, invoice.id)) }) : _jsx("p", { className: "text-xs text-slate-400", children: "\u8ACB\u6C42\u306F\u3042\u308A\u307E\u305B\u3093\u3002" })] })] })] })] }) : _jsx("section", { className: "rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400", children: "\u9867\u5BA2\u652F\u63F4\u3092\u767B\u9332\u3059\u308B\u3068\u3001\u3053\u3053\u306B\u73FE\u5728\u306E\u72B6\u6CC1\u3068\u6B21\u306E\u5BFE\u5FDC\u3092\u8868\u793A\u3057\u307E\u3059\u3002" })] })] });
};
