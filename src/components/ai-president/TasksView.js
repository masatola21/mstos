import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { CheckSquare, ClipboardCopy, Plus, Edit2, Trash2, Clock, CheckCircle2, AlertTriangle, User, Bot, Briefcase, X, ArrowRight, ShieldCheck, Loader2, Paperclip, Download, ChevronDown, Search, } from 'lucide-react';
import { ApprovalsView } from './ApprovalsView';
import { AI_WORK_MODES, resolveWorkMode } from '../../data/aiWorkModes';
import { todayJst } from '../../utils/date';
const TASK_WORK_AREAS = [
    { value: 'sales_customer', label: '営業・顧客' },
    { value: 'product_development', label: '商品開発' },
    { value: 'project', label: 'プロジェクト' },
    { value: 'post_contract_support', label: '契約後支援' },
];
const TASK_SOURCE_CATEGORIES = [
    { value: 'sales_customer', label: '営業・顧客' },
    { value: 'business_operations', label: '事業運営' },
    { value: 'ai_president', label: '経営・AI社長' },
];
const TASK_KINDS = [
    { value: 'response', label: '対応' },
    { value: 'review', label: '判断・確認' },
    { value: 'creation_analysis', label: '作成・分析' },
    { value: 'recurring', label: '定期業務' },
];
const RELATED_RECORD_TYPES = [
    { value: 'none', label: '関連先なし' }, { value: 'company', label: '会社' },
    { value: 'contact', label: '連絡先' }, { value: 'prospect', label: '見込み企業' },
    { value: 'lead', label: 'リード' }, { value: 'deal', label: '商談' },
    { value: 'customer', label: '顧客' }, { value: 'product', label: '商品・サービス' },
];
export const TasksView = ({ tasks, projects, characters, roleOverrides, selectedProjectId, onClearProjectFilter, onCreateTask, onUpdateTask, onDeleteTask, onDeleteCompletedTasks, onBatchDeleteTasks, onRunTask, onUploadAttachment, onDownloadAttachment, onDeleteAttachment, onOpenKnowledgeItem, onRequestApproval, approvals, activityLogs, onResolveApproval, onDeleteApproval, onClearApprovals, onDeleteActivityLog, onClearActivityLogs, initialSection = 'tasks', onSectionChange, }) => {
    const [activeSection, setActiveSection] = useState(initialSection);
    useEffect(() => setActiveSection(initialSection), [initialSection]);
    const selectSection = (section) => {
        setActiveSection(section);
        onSectionChange?.(section);
    };
    const [filterProject, setFilterProject] = useState(selectedProjectId || 'all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterAssignee, setFilterAssignee] = useState('all');
    const [filterWorkArea, setFilterWorkArea] = useState('all');
    const [filterTaskKind, setFilterTaskKind] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    // Batch delete tasks state
    const [batchDeleteState, setBatchDeleteState] = useState(null);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [batchDeleteError, setBatchDeleteError] = useState('');
    // Form Fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [projectId, setProjectId] = useState(projects[0]?.id || '');
    const [workArea, setWorkArea] = useState('project');
    const [sourceCategory, setSourceCategory] = useState('ai_president');
    const [dueDate, setDueDate] = useState('');
    const [taskKind, setTaskKind] = useState('response');
    const [relatedRecordType, setRelatedRecordType] = useState('none');
    const [relatedRecordId, setRelatedRecordId] = useState('');
    const [relatedRecordLabel, setRelatedRecordLabel] = useState('');
    const [priority, setPriority] = useState('medium');
    const [status, setStatus] = useState('waiting');
    const [assigneeType, setAssigneeType] = useState('human');
    const [completionCriteria, setCompletionCriteria] = useState('');
    const [resultNotes, setResultNotes] = useState('');
    const [artifactUrl, setArtifactUrl] = useState('');
    const [runningTaskIds, setRunningTaskIds] = useState(() => new Set());
    const [expandedDraftTaskIds, setExpandedDraftTaskIds] = useState(() => new Set());
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const [attachmentError, setAttachmentError] = useState('');
    // Approval Request Modal State
    const [approvalModalTask, setApprovalModalTask] = useState(null);
    const [approvalReason, setApprovalReason] = useState('');
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [isDeletingTask, setIsDeletingTask] = useState(false);
    const [deleteTaskError, setDeleteTaskError] = useState('');
    const confirmBatchDelete = async () => {
        if (!batchDeleteState)
            return;
        setIsBatchDeleting(true);
        setBatchDeleteError('');
        try {
            if (onBatchDeleteTasks) {
                await onBatchDeleteTasks(batchDeleteState.taskIds, batchDeleteState.label);
            }
            else if (batchDeleteState.target === 'completed' && onDeleteCompletedTasks) {
                await onDeleteCompletedTasks();
            }
            else {
                for (const id of batchDeleteState.taskIds) {
                    await onDeleteTask(id);
                }
            }
            setBatchDeleteState(null);
        }
        catch (e) {
            setBatchDeleteError(e?.message || '一括削除に失敗しました。');
        }
        finally {
            setIsBatchDeleting(false);
        }
    };
    const openCreateModal = () => {
        setEditingTask(null);
        setTitle('');
        setDescription('');
        setProjectId(filterProject !== 'all' && filterProject !== 'none' ? filterProject : projects[0]?.id || '');
        setWorkArea('project');
        setSourceCategory('ai_president');
        setDueDate('');
        setTaskKind('response');
        setRelatedRecordType('none');
        setRelatedRecordId('');
        setRelatedRecordLabel('');
        setPriority('medium');
        setStatus('waiting');
        setAssigneeType('human');
        setCompletionCriteria('');
        setResultNotes('');
        setArtifactUrl('');
        setAttachmentError('');
        setIsModalOpen(true);
    };
    const openEditModal = (task) => {
        setEditingTask(task);
        setTitle(task.title);
        setDescription(task.description || '');
        setProjectId(task.projectId || '');
        setWorkArea(task.workArea || 'project');
        setSourceCategory(task.sourceCategory || 'ai_president');
        setDueDate(task.dueDate || '');
        setTaskKind(task.taskKind || 'response');
        setRelatedRecordType(task.relatedRecord?.type || 'none');
        setRelatedRecordId(task.relatedRecord?.id || '');
        setRelatedRecordLabel(task.relatedRecord?.label || '');
        setPriority(task.priority);
        setStatus(task.status);
        setCompletionCriteria(task.completionCriteria || '');
        setResultNotes(task.resultNotes || '');
        setArtifactUrl(task.artifactUrl || '');
        setAttachmentError('');
        if (task.assignee.type === 'human')
            setAssigneeType('human');
        else if (task.assignee.type === 'external_ai')
            setAssigneeType('external_ai');
        else if (task.assignee.type === 'dev_agent')
            setAssigneeType('dev_agent');
        else if (task.assignee.type === 'role_ai' && (task.assignee.workModeId || task.assignee.roleId))
            setAssigneeType(`role:${task.assignee.workModeId || task.assignee.roleId}`);
        else if (task.assignee.type === 'ai_ceo')
            setAssigneeType('preset-ceo');
        else if (task.assignee.id)
            setAssigneeType(task.assignee.id);
        else
            setAssigneeType('human');
        setIsModalOpen(true);
    };
    const uploadTaskFiles = async (files) => {
        if (!editingTask || !files || files.length === 0)
            return;
        setIsUploadingAttachment(true);
        setAttachmentError('');
        try {
            const uploaded = [];
            for (const file of Array.from(files)) {
                const item = await onUploadAttachment(editingTask.id, file);
                uploaded.push(item);
            }
            const nextTask = {
                ...editingTask,
                attachments: [...(editingTask.attachments || []), ...uploaded],
                updatedAt: Date.now(),
            };
            setEditingTask(nextTask);
            onUpdateTask(nextTask);
        }
        catch (e) {
            setAttachmentError(e?.message || 'ファイルの添付に失敗しました。');
        }
        finally {
            setIsUploadingAttachment(false);
        }
    };
    const downloadTaskFile = async (attachment) => {
        try {
            const blob = await onDownloadAttachment(attachment);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
        catch (e) {
            alert(e?.message || 'ファイルのダウンロードに失敗しました。');
        }
    };
    const removeTaskFile = async (attachment) => {
        if (!editingTask)
            return;
        try {
            await onDeleteAttachment(attachment);
            const nextTask = {
                ...editingTask,
                attachments: (editingTask.attachments || []).filter((item) => item.id !== attachment.id),
                updatedAt: Date.now(),
            };
            setEditingTask(nextTask);
            onUpdateTask(nextTask);
        }
        catch (e) {
            alert(e?.message || '添付ファイルの削除に失敗しました。');
        }
    };
    const confirmDeleteTask = async () => {
        if (!taskToDelete)
            return;
        setIsDeletingTask(true);
        setDeleteTaskError('');
        try {
            await onDeleteTask(taskToDelete.id);
            setTaskToDelete(null);
        }
        catch (e) {
            setDeleteTaskError(e?.message || 'タスクの削除に失敗しました。');
        }
        finally {
            setIsDeletingTask(false);
        }
    };
    const handleSave = () => {
        if (!title.trim())
            return;
        let assignee = { type: 'human', name: '人間' };
        if (assigneeType === 'human') {
            assignee = { type: 'human', name: '人間' };
        }
        else if (assigneeType === 'external_ai') {
            assignee = { type: 'external_ai', name: '外部AI' };
        }
        else if (assigneeType === 'dev_agent') {
            assignee = { type: 'dev_agent', name: '開発エージェント' };
        }
        else if (assigneeType.startsWith('role:')) {
            const roleId = assigneeType.replace('role:', '');
            const mode = AI_WORK_MODES.find((m) => m.id === roleId);
            const resolved = mode ? resolveWorkMode(mode, roleOverrides) : null;
            assignee = {
                type: 'role_ai',
                workModeId: roleId,
                name: resolved ? resolved.name : '役割AI',
            };
        }
        else {
            const char = characters.find((c) => c.id === assigneeType);
            if (char) {
                assignee = {
                    type: char.id === 'preset-ceo' ? 'ai_ceo' : 'custom_ai',
                    id: char.id,
                    name: char.name,
                };
            }
        }
        if (editingTask) {
            let nextStatus = status;
            if (status === 'completed' && assignee.type !== 'human' && assignee.type !== 'external_ai') {
                nextStatus = editingTask.status === 'completed' ? 'in_progress' : editingTask.status;
            }
            onUpdateTask({
                ...editingTask,
                title: title.trim(),
                description: description.trim(),
                projectId,
                workArea,
                sourceCategory,
                dueDate: dueDate || undefined,
                taskKind,
                relatedRecord: relatedRecordType === 'none' ? undefined : { type: relatedRecordType, id: relatedRecordId.trim() || undefined, label: relatedRecordLabel.trim() || undefined },
                priority,
                status: nextStatus,
                assignee,
                completionCriteria: completionCriteria.trim(),
                resultNotes: resultNotes.trim(),
                artifactUrl: artifactUrl.trim(),
                updatedAt: Date.now(),
            });
        }
        else {
            onCreateTask({
                title: title.trim(),
                description: description.trim(),
                projectId,
                workArea,
                sourceCategory,
                dueDate: dueDate || undefined,
                taskKind,
                relatedRecord: relatedRecordType === 'none' ? undefined : { type: relatedRecordType, id: relatedRecordId.trim() || undefined, label: relatedRecordLabel.trim() || undefined },
                priority,
                status,
                assignee,
                completionCriteria: completionCriteria.trim(),
                resultNotes: resultNotes.trim(),
                artifactUrl: artifactUrl.trim(),
            });
        }
        setIsModalOpen(false);
    };
    const handleCopyExternalTaskRequest = async (task) => {
        const request = [
            `依頼: ${task.title}`,
            task.description && `依頼内容:\n${task.description}`,
            task.completionCriteria && `完了条件:\n${task.completionCriteria}`,
        ].filter(Boolean).join('\n\n');
        try {
            await navigator.clipboard.writeText(request);
            alert('外部AIへの依頼文をコピーしました。');
        }
        catch {
            alert('依頼文をコピーできませんでした。タスク内容を手動でコピーしてください。');
        }
    };
    const handleQuickStatusChange = (task, newStatus) => {
        if (newStatus === 'completed' && task.assignee.type !== 'human' && task.assignee.type !== 'external_ai')
            return;
        if (newStatus === 'completed' && task.assignee.type === 'external_ai' && !task.resultNotes?.trim() && !task.artifactUrl && !task.attachments?.length) {
            alert('外部AIの回答を成果メモに貼り付けるか、成果物を添付してから完了にしてください。');
            return;
        }
        if (newStatus === 'pending_approval') {
            setApprovalModalTask(task);
            setApprovalReason(`タスク「${task.title}」の完了条件を満たしたため、結果の承認を求めます。`);
            return;
        }
        onUpdateTask({
            ...task,
            status: newStatus,
            updatedAt: Date.now(),
        });
    };
    const submitApprovalRequest = () => {
        if (!approvalModalTask)
            return;
        onRequestApproval(approvalModalTask, approvalReason.trim() || '結果の確認と承認');
        setApprovalModalTask(null);
    };
    const runTask = async (task) => {
        setRunningTaskIds((current) => new Set(current).add(task.id));
        try {
            await onRunTask(task);
        }
        catch (error) {
            alert(error instanceof Error ? error.message : 'AIの実行に失敗しました。');
        }
        finally {
            setRunningTaskIds((current) => {
                const next = new Set(current);
                next.delete(task.id);
                return next;
            });
        }
    };
    const filteredTasks = tasks.filter((t) => {
        if (filterProject === 'none' && t.projectId && projects.some((project) => project.id === t.projectId))
            return false;
        if (filterProject !== 'all' && filterProject !== 'none' && t.projectId !== filterProject)
            return false;
        if (filterWorkArea !== 'all' && (t.workArea || 'project') !== filterWorkArea)
            return false;
        if (filterTaskKind !== 'all' && (t.taskKind || 'response') !== filterTaskKind)
            return false;
        if (filterStatus !== 'all' && t.status !== filterStatus)
            return false;
        if (filterAssignee !== 'all') {
            if (filterAssignee === 'human' && t.assignee.type !== 'human')
                return false;
            if (filterAssignee === 'external_ai' && t.assignee.type !== 'external_ai')
                return false;
            if (filterAssignee === 'ai_ceo' && t.assignee.type !== 'ai_ceo')
                return false;
            if (filterAssignee === 'role_ai' && t.assignee.type !== 'role_ai')
                return false;
            if (filterAssignee === 'dev_agent' && t.assignee.type !== 'dev_agent')
                return false;
            if (filterAssignee === 'custom_ai' && t.assignee.type !== 'custom_ai')
                return false;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTitle = t.title.toLowerCase().includes(q);
            const matchDesc = (t.description || '').toLowerCase().includes(q);
            const matchNotes = (t.resultNotes || '').toLowerCase().includes(q);
            const matchAssignee = (t.assignee.name || '').toLowerCase().includes(q);
            if (!matchTitle && !matchDesc && !matchNotes && !matchAssignee)
                return false;
        }
        return true;
    });
    const getStatusBadge = (st) => {
        switch (st) {
            case 'waiting':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200", children: [_jsx(Clock, { className: "w-3 h-3 text-slate-500" }), " \u5F85\u6A5F\u4E2D"] }));
            case 'in_progress':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-blue-600" }), " \u9032\u884C\u4E2D"] }));
            case 'pending_approval':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200", children: [_jsx(ShieldCheck, { className: "w-3 h-3 text-amber-600" }), " \u627F\u8A8D\u5F85\u3061"] }));
            case 'completed':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200", children: [_jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-600" }), " \u5B8C\u4E86"] }));
            case 'blocked':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200", children: [_jsx(AlertTriangle, { className: "w-3 h-3 text-rose-600" }), " \u554F\u984C\u3042\u308A"] }));
        }
    };
    const getAssigneeBadge = (assignee) => {
        switch (assignee.type) {
            case 'human':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700 border border-slate-200", children: [_jsx(User, { className: "w-3 h-3 text-slate-500" }), " ", assignee.name] }));
            case 'external_ai':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-amber-50 text-amber-800 border border-amber-200", children: [_jsx(Bot, { className: "w-3 h-3 text-amber-600" }), " ", assignee.name] }));
            case 'dev_agent':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200", children: [_jsx(Bot, { className: "w-3 h-3 text-indigo-600" }), " ", assignee.name] }));
            case 'ai_ceo':
                return (_jsxs("span", { className: "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-700 border border-purple-200 font-semibold", children: [_jsx(Bot, { className: "w-3 h-3 text-purple-600" }), " ", assignee.name] }));
            case 'role_ai':
            case 'custom_ai':
            default:
                return (_jsxs("span", { className: "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-700 border border-purple-200", children: [_jsx(Bot, { className: "w-3 h-3 text-purple-600" }), " ", assignee.name] }));
        }
    };
    return (_jsxs("div", { className: "max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u5168\u793E\u30BF\u30B9\u30AF\u30FB\u627F\u8A8D\u7BA1\u7406" }), activeSection === 'tasks' && (_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [tasks.some((t) => t.status === 'completed') && (_jsxs("button", { type: "button", onClick: () => setBatchDeleteState({
                                    target: 'completed',
                                    label: '完了タスク',
                                    taskIds: tasks.filter((t) => t.status === 'completed').map((t) => t.id),
                                }), className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium transition-all cursor-pointer", title: "\u5B8C\u4E86\u3057\u305F\u30BF\u30B9\u30AF\u3092\u4E00\u62EC\u524A\u9664\u3057\u3066\u4E00\u89A7\u3092\u6574\u7406", children: [_jsx(Trash2, { className: "w-3.5 h-3.5 text-slate-400" }), _jsxs("span", { children: ["\u5B8C\u4E86\u30BF\u30B9\u30AF\u6574\u7406 (", tasks.filter((t) => t.status === 'completed').length, ")"] })] })), _jsxs("button", { type: "button", onClick: openCreateModal, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-all cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u65B0\u898F\u30BF\u30B9\u30AF\u3092\u4F5C\u6210" })] })] }))] }), _jsx("div", { className: "flex flex-wrap gap-2 border-b border-slate-200 pb-3", children: [
                    { id: 'tasks', label: `タスク (${tasks.length})` },
                    { id: 'approvals', label: `承認待ち・判断 (${approvals.filter((item) => item.status === 'pending').length})` },
                    { id: 'logs', label: `活動履歴 (${activityLogs.length})` },
                ].map((section) => (_jsx("button", { type: "button", onClick: () => selectSection(section.id), className: `px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${activeSection === section.id
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`, children: section.label }, section.id))) }), activeSection === 'tasks' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs", children: [_jsxs("div", { className: "relative flex-1 min-w-[200px]", children: [_jsx(Search, { className: "w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" }), _jsx("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "\u30BF\u30B9\u30AF\u540D\u3001\u30E1\u30E2\u3001\u62C5\u5F53\u8005\u3067\u691C\u7D22...", className: "w-full rounded-xl bg-white border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-slate-500 text-[11px] font-semibold", children: "\u72B6\u614B:" }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsxs("option", { value: "all", children: ["\u3059\u3079\u3066 (", tasks.length, ")"] }), _jsxs("option", { value: "waiting", children: ["\u5F85\u6A5F\u4E2D (", tasks.filter(t => t.status === 'waiting').length, ")"] }), _jsxs("option", { value: "in_progress", children: ["\u9032\u884C\u4E2D (", tasks.filter(t => t.status === 'in_progress').length, ")"] }), _jsxs("option", { value: "pending_approval", children: ["\u627F\u8A8D\u5F85\u3061 (", tasks.filter(t => t.status === 'pending_approval').length, ")"] }), _jsxs("option", { value: "completed", children: ["\u5B8C\u4E86 (", tasks.filter(t => t.status === 'completed').length, ")"] }), _jsxs("option", { value: "blocked", children: ["\u554F\u984C\u3042\u308A (", tasks.filter(t => t.status === 'blocked').length, ")"] })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 min-w-[160px]", children: [_jsx("span", { className: "text-slate-500 text-[11px] font-semibold", children: "PJ:" }), _jsxs("select", { value: filterProject, onChange: (e) => setFilterProject(e.target.value), className: "rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "all", children: "\u5168\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8" }), _jsx("option", { value: "none", children: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u672A\u8A2D\u5B9A" }), projects.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-slate-500 text-[11px] font-semibold", children: "\u9818\u57DF:" }), _jsxs("select", { value: filterWorkArea, onChange: (e) => setFilterWorkArea(e.target.value), className: "rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "all", children: "\u3059\u3079\u3066\u306E\u9818\u57DF" }), TASK_WORK_AREAS.map((item) => _jsx("option", { value: item.value, children: item.label }, item.value))] })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-slate-500 text-[11px] font-semibold", children: "\u62C5\u5F53:" }), _jsxs("select", { value: filterAssignee, onChange: (e) => setFilterAssignee(e.target.value), className: "rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "all", children: "\u5168\u62C5\u5F53" }), _jsx("option", { value: "human", children: "\uD83D\uDC64 \u4EBA\u9593 (\u3042\u306A\u305F)" }), _jsx("option", { value: "external_ai", children: "\uD83C\uDF10 \u5916\u90E8AI\uFF08\u624B\u52D5\u4F9D\u983C\uFF09" }), _jsx("option", { value: "ai_ceo", children: "\uD83D\uDC54 AI\u793E\u9577" }), _jsx("option", { value: "role_ai", children: "\uD83E\uDDED \u5F79\u5272AI" }), _jsx("option", { value: "dev_agent", children: "\u2699\uFE0F \u958B\u767A\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8" }), _jsx("option", { value: "custom_ai", children: "\uD83E\uDD16 \u767B\u9332\u5C02\u9580AI" })] })] }), filteredTasks.length > 0 && (filterStatus !== 'all' || filterProject !== 'all' || filterWorkArea !== 'all' || filterTaskKind !== 'all' || filterAssignee !== 'all') && (_jsxs("button", { type: "button", onClick: () => setBatchDeleteState({
                                    target: 'filtered',
                                    label: '条件絞り込み中のタスク',
                                    taskIds: filteredTasks.map((t) => t.id),
                                }), className: "flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-[11px] font-medium transition-all cursor-pointer shadow-2xs", children: [_jsx(Trash2, { className: "w-3 h-3" }), _jsxs("span", { children: ["\u7D5E\u308A\u8FBC\u307F\u4E2D\u306E", filteredTasks.length, "\u4EF6\u3092\u4E00\u62EC\u524A\u9664"] })] })), selectedProjectId && (_jsx("button", { type: "button", onClick: () => {
                                    setFilterProject('all');
                                    if (onClearProjectFilter)
                                        onClearProjectFilter();
                                }, className: "ml-auto text-purple-600 hover:text-purple-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer", children: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u7D5E\u308A\u8FBC\u307F\u3092\u89E3\u9664" }))] }), filteredTasks.length === 0 ? (_jsxs("div", { className: "p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs", children: [_jsx(CheckSquare, { className: "w-8 h-8 text-slate-400 mx-auto" }), _jsx("h3", { className: "text-sm font-bold text-slate-800", children: "\u8A72\u5F53\u3059\u308B\u30BF\u30B9\u30AF\u304C\u3042\u308A\u307E\u305B\u3093" }), _jsx("p", { className: "text-xs text-slate-500 max-w-md mx-auto", children: "\u6761\u4EF6\u3092\u5909\u66F4\u3059\u308B\u304B\u3001\u53F3\u4E0A\u306E\u300C\u65B0\u898F\u30BF\u30B9\u30AF\u3092\u4F5C\u6210\u300D\u30DC\u30BF\u30F3\u304B\u3089\u30BF\u30B9\u30AF\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), _jsxs("button", { type: "button", onClick: openCreateModal, className: "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u65B0\u3057\u3044\u30BF\u30B9\u30AF\u3092\u767B\u9332\u3059\u308B" })] })] })) : (_jsx("div", { className: "space-y-3", children: filteredTasks.map((task) => {
                            const project = projects.find((p) => p.id === task.projectId);
                            return (_jsxs("div", { className: "p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 transition-all space-y-3 shadow-xs group", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [getStatusBadge(task.status), getAssigneeBadge(task.assignee), _jsx("span", { className: "rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200 font-medium", children: TASK_WORK_AREAS.find((item) => item.value === (task.workArea || 'project'))?.label || 'プロジェクト' }), _jsx("span", { className: "rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 border border-slate-200 font-medium", children: TASK_KINDS.find((item) => item.value === (task.taskKind || 'response'))?.label || '対応' }), task.dueDate && (_jsxs("span", { className: `rounded px-2 py-0.5 text-[10px] font-semibold ${task.dueDate < todayJst() && task.status !== 'completed'
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'}`, children: ["\u671F\u9650: ", task.dueDate] })), task.relatedRecord?.label && (_jsxs("span", { className: "rounded bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[10px] font-medium", children: ["\u95A2\u9023: ", task.relatedRecord.label] })), _jsxs("span", { className: `px-2 py-0.5 rounded text-[10px] font-bold ${task.priority === 'high'
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            : task.priority === 'medium'
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                : 'bg-slate-100 text-slate-600 border border-slate-200'}`, children: ["\u512A\u5148\u5EA6: ", task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'] }), project && (_jsxs("span", { className: "text-[11px] text-slate-600 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-medium", children: [_jsx(Briefcase, { className: "w-3 h-3 text-purple-600" }), project.name] }))] }), _jsxs("div", { className: "flex items-center gap-1 self-end sm:self-auto", children: [_jsx("button", { type: "button", onClick: () => openEditModal(task), title: "\u7DE8\u96C6", className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors", children: _jsx(Edit2, { className: "w-3.5 h-3.5" }) }), _jsx("button", { type: "button", onClick: () => setTaskToDelete(task), title: "\u524A\u9664", className: "p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 cursor-pointer transition-colors", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] }), _jsxs("div", { children: [_jsx("div", { className: "flex items-center gap-2", children: task.draftArtifact || task.knowledgeItemId ? (_jsxs("button", { type: "button", "aria-expanded": task.draftArtifact ? expandedDraftTaskIds.has(task.id) : undefined, onClick: () => {
                                                        if (task.draftArtifact) {
                                                            setExpandedDraftTaskIds((current) => {
                                                                const next = new Set(current);
                                                                if (next.has(task.id))
                                                                    next.delete(task.id);
                                                                else
                                                                    next.add(task.id);
                                                                return next;
                                                            });
                                                        }
                                                        else if (task.knowledgeItemId) {
                                                            onOpenKnowledgeItem(task.knowledgeItemId);
                                                        }
                                                    }, className: "flex items-center gap-1.5 text-left text-sm sm:text-base font-bold text-slate-900 hover:text-purple-700 cursor-pointer transition-colors", children: [_jsx("span", { children: task.title }), _jsx("span", { className: "text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200", children: task.draftArtifact
                                                                ? expandedDraftTaskIds.has(task.id) ? '成果物を閉じる' : '成果物を確認'
                                                                : '保存済み成果物を開く' }), task.draftArtifact ? (_jsx(ChevronDown, { className: `w-4 h-4 text-purple-600 transition-transform ${expandedDraftTaskIds.has(task.id) ? 'rotate-180' : ''}` })) : (_jsx(ArrowRight, { className: "w-4 h-4 text-purple-600" }))] })) : (_jsx("h3", { className: "text-sm sm:text-base font-bold text-slate-900", children: task.title })) }), task.description && (_jsx("p", { className: "text-xs text-slate-600 mt-1 leading-relaxed", children: task.description })), task.assignee.type === 'external_ai' && (_jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => void handleCopyExternalTaskRequest(task), className: "inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors", children: [_jsx(ClipboardCopy, { className: "h-3 w-3" }), _jsx("span", { children: "\u5916\u90E8AI\u3078\u306E\u4F9D\u983C\u6587\u3092\u30B3\u30D4\u30FC" })] }), _jsx("span", { className: "text-[10px] text-slate-400", children: "\u56DE\u7B54\u306F\u6210\u679C\u30FB\u30E1\u30E2\u3078\u8CBC\u308A\u4ED8\u3051\u308B\u304B\u3001\u30BF\u30B9\u30AF\u3092\u7DE8\u96C6\u3057\u3066\u30D5\u30A1\u30A4\u30EB\u6DFB\u4ED8" })] })), task.draftArtifact && expandedDraftTaskIds.has(task.id) && (_jsxs("section", { className: "mt-3 rounded-xl border border-purple-200 bg-purple-50/30 overflow-hidden", children: [_jsx("div", { className: "px-3 py-2 border-b border-purple-200 text-xs font-bold text-purple-900", children: "\u30EC\u30D3\u30E5\u30FC\u7528\u6210\u679C\u7269\uFF08\u627F\u8A8D\u524D\uFF09" }), _jsx("div", { className: "max-h-[520px] overflow-y-auto p-4 text-sm text-slate-800 bg-white font-mono whitespace-pre-wrap break-words", children: task.draftArtifact.content }), _jsx("p", { className: "px-3 py-2 border-t border-purple-100 text-[11px] text-slate-500", children: "\u627F\u8A8D\u753B\u9762\u3067\u78BA\u8A8D\u30FB\u627F\u8A8D\u3059\u308B\u3068\u30CA\u30EC\u30C3\u30B8\u306B\u767B\u9332\u3055\u308C\u307E\u3059\u3002" })] }))] }), (task.completionCriteria || task.resultNotes || task.artifactUrl || task.knowledgeItemId || task.attachments?.length) && (_jsxs("div", { className: "p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs space-y-1.5", children: [task.completionCriteria && (_jsxs("div", { className: "flex items-start gap-1.5 text-slate-700", children: [_jsx("span", { className: "font-bold text-purple-700 shrink-0", children: "\u5B8C\u4E86\u6761\u4EF6:" }), _jsx("span", { children: task.completionCriteria })] })), task.resultNotes && (_jsxs("div", { className: "flex items-start gap-1.5 text-slate-700", children: [_jsx("span", { className: "font-bold text-emerald-700 shrink-0", children: "\u6210\u679C\u30FB\u30E1\u30E2:" }), _jsx("span", { children: task.resultNotes })] })), task.knowledgeItemId && (_jsx("button", { type: "button", onClick: () => onOpenKnowledgeItem(task.knowledgeItemId), className: "text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:underline block", children: "\u4FDD\u5B58\u3057\u305F\u6210\u679C\u7269\u3092\u30CA\u30EC\u30C3\u30B8\u3067\u958B\u304F \u2192" })), task.artifactUrl && (_jsx("a", { href: task.artifactUrl, target: "_blank", rel: "noreferrer", className: "block text-[11px] font-semibold text-blue-600 hover:underline", children: "\u5916\u90E8\u6210\u679C\u7269\u3092\u958B\u304F \u2192" })), !!task.attachments?.length && (_jsxs("div", { className: "border-t border-slate-200 pt-2 mt-2 space-y-1", children: [_jsx("p", { className: "text-[10px] font-semibold text-slate-500", children: "\u30BF\u30B9\u30AF\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB" }), task.attachments.map((attachment) => (_jsxs("button", { type: "button", onClick: () => void downloadTaskFile(attachment), className: "flex max-w-full items-center gap-1.5 text-left text-[11px] font-semibold text-purple-700 hover:text-purple-800", children: [_jsx(Download, { className: "h-3 w-3 shrink-0" }), _jsx("span", { className: "truncate", children: attachment.fileName })] }, attachment.id)))] }))] })), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs", children: [_jsxs("span", { className: "text-[11px] text-slate-400", children: ["\u66F4\u65B0: ", new Date(task.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })] }), _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsx("span", { className: "text-[11px] text-slate-400 mr-1", children: "\u72B6\u614B\u5909\u66F4:" }), task.status !== 'pending_approval' && (task.assignee.type === 'role_ai' || task.assignee.type === 'ai_ceo' || task.assignee.type === 'custom_ai') && (_jsxs("button", { type: "button", disabled: runningTaskIds.has(task.id), onClick: () => void runTask(task), className: "inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer shadow-2xs transition-colors", children: [runningTaskIds.has(task.id) ? _jsx(Loader2, { className: "w-3 h-3 animate-spin" }) : _jsx(Bot, { className: "w-3 h-3" }), runningTaskIds.has(task.id) ? '実行中…' : '担当AIに依頼'] })), task.status !== 'in_progress' && (_jsx("button", { type: "button", onClick: () => handleQuickStatusChange(task, 'in_progress'), className: "px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold cursor-pointer transition-colors", children: "\u7740\u624B (\u9032\u884C\u4E2D\u3078)" })), task.status !== 'pending_approval' && task.status !== 'completed' && (_jsx("button", { type: "button", onClick: () => handleQuickStatusChange(task, 'pending_approval'), className: "px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-semibold cursor-pointer transition-colors", children: "\u627F\u8A8D\u3092\u7533\u8ACB" })), task.status !== 'completed' && (task.assignee.type === 'human' || task.assignee.type === 'external_ai') && (_jsx("button", { type: "button", onClick: () => handleQuickStatusChange(task, 'completed'), className: "px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold cursor-pointer transition-colors", children: "\u5B8C\u4E86\u306B\u3059\u308B" })), task.status !== 'blocked' && (_jsx("button", { type: "button", onClick: () => handleQuickStatusChange(task, 'blocked'), className: "px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer transition-colors", children: "\u554F\u984C\u3042\u308A" }))] })] })] }, task.id));
                        }) })), isModalOpen && (_jsx("div", { className: "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4", children: _jsxs("div", { className: "flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]", children: [_jsxs("div", { className: "flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6", children: [_jsxs("h2", { className: "text-base font-bold text-slate-900 flex items-center gap-2", children: [_jsx(CheckSquare, { className: "w-4 h-4 text-purple-600" }), _jsx("span", { children: editingTask ? 'タスクを編集' : '新規タスク作成' })] }), _jsx("button", { type: "button", onClick: () => setIsModalOpen(false), className: "text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4 sm:px-6 text-xs text-slate-700", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: ["\u30BF\u30B9\u30AF\u540D ", _jsx("span", { className: "text-rose-600", children: "*" })] }), _jsx("input", { type: "text", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "\u4F8B: \u30B3\u30A2\u6A5F\u80FD\u306E\u8981\u4EF6\u5B9A\u7FA9\u66F8\u3092\u4F5C\u6210", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: ["\u95A2\u9023\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8 ", _jsx("span", { className: "text-slate-400", children: "\u4EFB\u610F" })] }), _jsxs("select", { value: projectId, onChange: (e) => setProjectId(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "", children: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u7D10\u4ED8\u3051\u306A\u3044" }), projects.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-800", children: ["\u767A\u751F\u30AB\u30C6\u30B4\u30EA\u30FC", _jsx("select", { value: sourceCategory, onChange: (e) => setSourceCategory(e.target.value), className: "mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs", children: TASK_SOURCE_CATEGORIES.map((item) => _jsx("option", { value: item.value, children: item.label }, item.value)) })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-800", children: ["\u671F\u9650", _jsx("input", { type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value), className: "mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-800", children: ["\u4ED5\u4E8B\u306E\u9818\u57DF", _jsx("select", { value: workArea, onChange: (e) => setWorkArea(e.target.value), className: "mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs", children: TASK_WORK_AREAS.map((item) => _jsx("option", { value: item.value, children: item.label }, item.value)) })] }), _jsxs("label", { className: "block text-xs font-semibold text-slate-800", children: ["\u4F5C\u696D\u306E\u7A2E\u985E", _jsx("select", { value: taskKind, onChange: (e) => setTaskKind(e.target.value), className: "mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs", children: TASK_KINDS.map((item) => _jsx("option", { value: item.value, children: item.label }, item.value)) })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2", children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-800", children: ["\u95A2\u9023\u3059\u308BCRM\u30EC\u30B3\u30FC\u30C9\uFF0F\u5546\u54C1", _jsx("select", { value: relatedRecordType, onChange: (e) => setRelatedRecordType(e.target.value), className: "mt-1 w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs", children: RELATED_RECORD_TYPES.map((item) => _jsx("option", { value: item.value, children: item.label }, item.value)) })] }), relatedRecordType !== 'none' && (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("input", { value: relatedRecordLabel, onChange: (e) => setRelatedRecordLabel(e.target.value), placeholder: "\u95A2\u9023\u5148\u306E\u540D\u524D", className: "w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-2xs" }), _jsx("input", { value: relatedRecordId, onChange: (e) => setRelatedRecordId(e.target.value), placeholder: "\u30EC\u30B3\u30FC\u30C9ID\uFF08\u81EA\u52D5\u9023\u643A\u7528\uFF09", className: "w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-2xs" })] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u8AAC\u660E\u30FB\u5B9F\u65BD\u76EE\u7684" }), _jsx("textarea", { rows: 2, value: description, onChange: (e) => setDescription(e.target.value), placeholder: assigneeType === 'external_ai' ? '外部AIへ依頼する内容を記載（機密情報は含めない）' : 'タスクの具体的な背景や目的を記載', className: "w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u62C5\u5F53\u306E\u5272\u308A\u5F53\u3066" }), _jsxs("select", { value: assigneeType, onChange: (e) => setAssigneeType(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "human", children: "\uD83D\uDC64 \u4EBA\u9593 (\u3042\u306A\u305F)" }), _jsx("option", { value: "external_ai", children: "\uD83C\uDF10 \u5916\u90E8AI\uFF08\u624B\u52D5\u4F9D\u983C\uFF09" }), _jsx("option", { value: "dev_agent", children: "\u2699\uFE0F \u958B\u767A\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8" }), _jsx("optgroup", { label: "\u5F79\u5272AI", children: AI_WORK_MODES.map((mode) => {
                                                                        const resolved = resolveWorkMode(mode, roleOverrides);
                                                                        return _jsxs("option", { value: `role:${mode.id}`, children: [resolved.avatarEmoji, " ", resolved.name, "\uFF08", resolved.label, "\uFF09"] }, mode.id);
                                                                    }) }), _jsx("optgroup", { label: "\u767B\u9332\u6E08\u307FAI", children: characters
                                                                        .filter((c) => c.id !== 'preset-ceo')
                                                                        .map((c) => (_jsxs("option", { value: c.id, children: [c.avatarEmoji || '🤖', " ", c.name, " (", c.role, ")"] }, c.id))) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u72B6\u614B" }), _jsxs("select", { value: status, onChange: (e) => setStatus(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "waiting", children: "\u5F85\u6A5F\u4E2D" }), _jsx("option", { value: "in_progress", children: "\u9032\u884C\u4E2D" }), _jsx("option", { value: "pending_approval", children: "\u627F\u8A8D\u5F85\u3061" }), _jsx("option", { value: "completed", children: "\u5B8C\u4E86" }), _jsx("option", { value: "blocked", children: "\u554F\u984C\u3042\u308A" })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u512A\u5148\u5EA6" }), _jsxs("select", { value: priority, onChange: (e) => setPriority(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "high", children: "\u9AD8 (High)" }), _jsx("option", { value: "medium", children: "\u4E2D (Medium)" }), _jsx("option", { value: "low", children: "\u4F4E (Low)" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u5B8C\u4E86\u6761\u4EF6" }), _jsx("input", { type: "text", value: completionCriteria, onChange: (e) => setCompletionCriteria(e.target.value), placeholder: "\u4F55\u304C\u3067\u304D\u305F\u3089\u5B8C\u4E86\u304B", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u6210\u679C\u30FB\u30E1\u30E2" }), _jsx("textarea", { rows: 2, value: resultNotes, onChange: (e) => setResultNotes(e.target.value), placeholder: "\u5B9F\u884C\u7D50\u679C\u3001\u6210\u679C\u7269\u3078\u306E\u30EA\u30F3\u30AF\u3001\u7559\u610F\u70B9\u306A\u3069", className: "w-full rounded-xl bg-white border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u5916\u90E8\u6210\u679C\u7269URL\uFF08Drive\u7B49\uFF09" }), _jsx("input", { type: "url", value: artifactUrl, onChange: (e) => setArtifactUrl(e.target.value), placeholder: "https://...", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs" })] }), _jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800", children: "\u30BF\u30B9\u30AF\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB" }), _jsx("p", { className: "mt-1 text-[11px] text-slate-500", children: "Supabase\u306B\u975E\u516C\u958B\u4FDD\u5B58\u30021\u30D5\u30A1\u30A4\u30EB20MB\u307E\u3067\u3002" })] }), editingTask ? (_jsxs("label", { className: `inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 shadow-2xs ${isUploadingAttachment ? 'pointer-events-none opacity-50' : ''}`, children: [isUploadingAttachment ? _jsx(Loader2, { className: "h-4 w-4 animate-spin text-purple-600" }) : _jsx(Paperclip, { className: "h-4 w-4 text-purple-600" }), isUploadingAttachment ? 'アップロード中…' : 'ファイルを添付', _jsx("input", { type: "file", multiple: true, className: "hidden", disabled: isUploadingAttachment, onChange: (event) => { void uploadTaskFiles(event.target.files); event.currentTarget.value = ''; } })] })) : (_jsx("span", { className: "text-[11px] text-slate-400", children: "\u30BF\u30B9\u30AF\u4F5C\u6210\u5F8C\u3001\u7DE8\u96C6\u753B\u9762\u304B\u3089\u6DFB\u4ED8\u3067\u304D\u307E\u3059\u3002" }))] }), (editingTask?.attachments || []).map((attachment) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-2xs", children: [_jsxs("span", { className: "min-w-0 truncate text-xs text-slate-700", children: [attachment.fileName, " ", _jsxs("span", { className: "text-slate-400", children: ["(", (attachment.size / 1024 / 1024).toFixed(2), " MB)"] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("button", { type: "button", onClick: () => void downloadTaskFile(attachment), className: "inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium", children: [_jsx(Download, { className: "h-3.5 w-3.5" }), "\u4FDD\u5B58"] }), _jsx("button", { type: "button", onClick: () => void removeTaskFile(attachment), className: "text-xs text-rose-600 hover:text-rose-700 font-medium", children: "\u524A\u9664" })] })] }, attachment.id))), attachmentError && _jsx("p", { role: "alert", className: "text-xs text-rose-600", children: attachmentError })] })] }), _jsxs("div", { className: "flex shrink-0 items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6", children: [editingTask ? (_jsxs("button", { type: "button", onClick: () => {
                                                const toDelete = editingTask;
                                                setIsModalOpen(false);
                                                setTaskToDelete(toDelete);
                                            }, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs", children: [_jsx(Trash2, { className: "w-3.5 h-3.5 text-rose-600" }), _jsx("span", { children: "\u3053\u306E\u30BF\u30B9\u30AF\u3092\u524A\u9664" })] })) : _jsx("div", {}), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setIsModalOpen(false), className: "px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", onClick: handleSave, className: "px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer", children: editingTask ? '変更を保存' : 'タスクを作成' })] })] })] }) })), approvalModalTask && (_jsx("div", { className: "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-3", children: [_jsxs("h2", { className: "text-base font-bold text-slate-900 flex items-center gap-2", children: [_jsx(ShieldCheck, { className: "w-4 h-4 text-purple-600" }), _jsx("span", { children: "\u627F\u8A8D\u7533\u8ACB\u3092\u4F5C\u6210" })] }), _jsx("button", { type: "button", onClick: () => setApprovalModalTask(null), className: "text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500", children: "\u5BFE\u8C61\u30BF\u30B9\u30AF:" }), _jsx("div", { className: "text-sm font-bold text-slate-900", children: approvalModalTask.title })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-800 mb-1", children: "\u7533\u8ACB\u7406\u7531\u30FB\u627F\u8A8D\u3092\u6C42\u3081\u308B\u5185\u5BB9" }), _jsx("textarea", { rows: 3, value: approvalReason, onChange: (e) => setApprovalReason(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs" })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-3 border-t border-slate-100", children: [_jsx("button", { type: "button", onClick: () => setApprovalModalTask(null), className: "px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", onClick: submitApprovalRequest, className: "px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer", children: "\u627F\u8A8D\u7533\u8ACB\u3092\u63D0\u51FA" })] })] }) })), taskToDelete && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl", children: [_jsx("h2", { className: "text-base font-bold text-slate-900", children: "\u30BF\u30B9\u30AF\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F" }), _jsxs("p", { className: "mt-3 text-sm text-slate-600", children: ["\u300C", taskToDelete.title, "\u300D\u3068\u30BF\u30B9\u30AF\u306B\u6DFB\u4ED8\u3057\u305F\u30D5\u30A1\u30A4\u30EB\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u7D10\u3065\u304F\u627F\u8A8D\u5F85\u3061\u8A18\u9332\u3082\u5408\u308F\u305B\u3066\u6574\u7406\u3055\u308C\u307E\u3059\u3002"] }), deleteTaskError && _jsx("p", { role: "alert", className: "mt-3 text-xs text-rose-600", children: deleteTaskError }), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx("button", { type: "button", disabled: isDeletingTask, onClick: () => setTaskToDelete(null), className: "rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", disabled: isDeletingTask, onClick: () => void confirmDeleteTask(), className: "rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs", children: isDeletingTask ? '削除中…' : '削除する' })] })] }) })), batchDeleteState && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4", children: [_jsxs("h2", { className: "text-base font-bold text-slate-900 flex items-center gap-2", children: [_jsx(Trash2, { className: "w-5 h-5 text-rose-600" }), _jsxs("span", { children: [batchDeleteState.label, "\u306E\u4E00\u62EC\u524A\u9664"] })] }), _jsxs("p", { className: "mt-3 text-sm text-slate-600 leading-relaxed", children: ["\u5BFE\u8C61\u306E\u30BF\u30B9\u30AF\uFF08\u5168", batchDeleteState.taskIds.length, "\u4EF6\uFF09\u3092\u4E00\u62EC\u524A\u9664\u3057\u307E\u3059\u3002", _jsx("br", {}), "\u30BF\u30B9\u30AF\u306B\u6DFB\u4ED8\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB\u3084\u95A2\u9023\u3059\u308B\u627F\u8A8D\u5F85\u3061\u8A18\u9332\u3082\u5408\u308F\u305B\u3066\u6574\u7406\u3055\u308C\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002\u5B9F\u884C\u3057\u307E\u3059\u304B\uFF1F"] }), batchDeleteError && _jsx("p", { role: "alert", className: "text-xs text-rose-600", children: batchDeleteError }), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx("button", { type: "button", disabled: isBatchDeleting, onClick: () => setBatchDeleteState(null), className: "rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", disabled: isBatchDeleting, onClick: () => void confirmBatchDelete(), className: "rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs", children: isBatchDeleting ? '削除中…' : '一括削除する' })] })] }) }))] })), (activeSection === 'approvals' || activeSection === 'logs') && (_jsx(ApprovalsView, { tasks: tasks, approvals: approvals, activityLogs: activityLogs, onResolveApproval: onResolveApproval, onDeleteApproval: onDeleteApproval, onClearApprovals: onClearApprovals, onDeleteActivityLog: onDeleteActivityLog, onClearActivityLogs: onClearActivityLogs, initialTab: activeSection === 'logs' ? 'logs' : 'approvals', embedded: true }))] }));
};
