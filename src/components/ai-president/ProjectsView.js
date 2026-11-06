import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Briefcase, Plus, Edit2, Trash2, Calendar, X, ArrowRight, Filter, } from 'lucide-react';
import { InlineDeleteButton } from '../InlineDeleteButton';
export const ProjectsView = ({ projects, tasks, onCreateProject, onUpdateProject, onDeleteProject, onNavigateToTasksWithFilter, }) => {
    const [filterStatus, setFilterStatus] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    // Form State
    const [name, setName] = useState('');
    const [objective, setObjective] = useState('');
    const [status, setStatus] = useState('in_progress');
    const [priority, setPriority] = useState('high');
    const [dueDate, setDueDate] = useState('');
    const openCreateModal = () => {
        setEditingProject(null);
        setName('');
        setObjective('');
        setStatus('in_progress');
        setPriority('high');
        setDueDate('');
        setIsModalOpen(true);
    };
    const openEditModal = (p) => {
        setEditingProject(p);
        setName(p.name);
        setObjective(p.objective);
        setStatus(p.status);
        setPriority(p.priority);
        setDueDate(p.dueDate || '');
        setIsModalOpen(true);
    };
    const handleSave = () => {
        if (!name.trim()) {
            alert('プロジェクト名を入力してください。');
            return;
        }
        if (editingProject) {
            onUpdateProject({
                ...editingProject,
                name: name.trim(),
                objective: objective.trim(),
                status,
                priority,
                dueDate,
                updatedAt: Date.now(),
            });
        }
        else {
            onCreateProject({
                name: name.trim(),
                objective: objective.trim(),
                status,
                priority,
                dueDate,
            });
        }
        setIsModalOpen(false);
    };
    const filteredProjects = projects.filter((p) => {
        if (filterStatus === 'all')
            return true;
        return p.status === filterStatus;
    });
    const getStatusBadge = (s) => {
        switch (s) {
            case 'in_progress':
                return _jsx("span", { className: "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200", children: "\u9032\u884C\u4E2D" });
            case 'planning':
                return _jsx("span", { className: "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200", children: "\u8A08\u753B\u4E2D" });
            case 'completed':
                return _jsx("span", { className: "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200", children: "\u5B8C\u4E86" });
            case 'on_hold':
                return _jsx("span", { className: "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200", children: "\u4FDD\u7559" });
        }
    };
    return (_jsxs("div", { className: "max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u65B0\u898F\u5546\u54C1\u4F01\u753B\u30FB\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u958B\u767A" }), _jsxs("button", { type: "button", onClick: openCreateModal, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-all cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u65B0\u898F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210" })] })] }), _jsx("div", { className: "flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-2", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Filter, { className: "w-3.5 h-3.5 text-slate-400 mr-1" }), [
                            { id: 'all', label: `すべて (${projects.length})` },
                            { id: 'in_progress', label: `進行中 (${projects.filter((p) => p.status === 'in_progress').length})` },
                            { id: 'planning', label: `計画中 (${projects.filter((p) => p.status === 'planning').length})` },
                            { id: 'completed', label: `完了 (${projects.filter((p) => p.status === 'completed').length})` },
                            { id: 'on_hold', label: `保留 (${projects.filter((p) => p.status === 'on_hold').length})` },
                        ].map((tab) => (_jsx("button", { type: "button", onClick: () => setFilterStatus(tab.id), className: `px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filterStatus === tab.id
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white'}`, children: tab.label }, tab.id)))] }) }), filteredProjects.length === 0 ? (_jsxs("div", { className: "p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-sm", children: [_jsx(Briefcase, { className: "w-8 h-8 text-slate-400 mx-auto" }), _jsx("h3", { className: "text-sm font-bold text-slate-900", children: "\u8868\u793A\u3067\u304D\u308B\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u304C\u3042\u308A\u307E\u305B\u3093" }), _jsx("p", { className: "text-xs text-slate-500 max-w-md mx-auto", children: "\u53F3\u4E0A\u306E\u300C\u65B0\u898F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u300D\u30DC\u30BF\u30F3\u304B\u3089\u4F5C\u6210\u3059\u308B\u304B\u3001AI\u793E\u9577\u30C1\u30E3\u30C3\u30C8\u3067\u4E8B\u696D\u76EE\u6A19\u3092\u76F8\u8AC7\u3057\u3066\u30BF\u30B9\u30AF\u5206\u89E3\u8A08\u753B\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), _jsxs("button", { type: "button", onClick: openCreateModal, className: "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u65B0\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u3059\u308B" })] })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: filteredProjects.map((p) => {
                    const relatedTasks = tasks.filter((t) => t.projectId === p.id);
                    const relatedTaskCount = relatedTasks.length;
                    const doneTasks = relatedTasks.filter((t) => t.status === 'completed');
                    const percent = relatedTasks.length > 0
                        ? Math.round((doneTasks.length / relatedTasks.length) * 100)
                        : 0;
                    return (_jsxs("div", { className: "p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 transition-all flex flex-col justify-between space-y-4 shadow-sm group", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [getStatusBadge(p.status), _jsxs("span", { className: `px-2 py-0.5 rounded-full text-[10px] font-bold border ${p.priority === 'high'
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : p.priority === 'medium'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-slate-100 text-slate-600 border-slate-200'}`, children: ["\u512A\u5148\u5EA6: ", p.priority === 'high' ? '高' : p.priority === 'medium' ? '中' : '低'] }), p.isSample && (_jsx("span", { className: "px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-medium", children: "\u30B5\u30F3\u30D7\u30EB" }))] }), _jsxs("div", { className: "flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity", children: [_jsx("button", { type: "button", onClick: () => openEditModal(p), title: "\u7DE8\u96C6", className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors", children: _jsx(Edit2, { className: "w-3.5 h-3.5" }) }), _jsx(InlineDeleteButton, { onConfirm: () => onDeleteProject(p.id), warning: relatedTaskCount > 0
                                                            ? `プロジェクト「${p.name}」と関連タスク${relatedTaskCount}件を削除します。この操作は元に戻せません。`
                                                            : `プロジェクト「${p.name}」を削除しますか？`, confirmLabel: relatedTaskCount > 0 ? 'プロジェクトとタスクを削除' : 'プロジェクト削除を確定', ariaLabel: `プロジェクト「${p.name}」を削除`, className: "p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-base font-bold text-slate-900 group-hover:text-purple-600 transition-colors", children: p.name }), _jsx("p", { className: "text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2", children: p.objective || '目的・目標未設定' })] }), _jsxs("div", { className: "flex items-center gap-4 text-[11px] text-slate-400 flex-wrap", children: [p.dueDate && (_jsxs("span", { className: "flex items-center gap-1 text-purple-700 font-medium", children: [_jsx(Calendar, { className: "w-3.5 h-3.5" }), " \u671F\u9650: ", p.dueDate] })), _jsxs("span", { children: ["\u4F5C\u6210\u65E5: ", new Date(p.createdAt).toLocaleDateString('ja-JP')] })] })] }), _jsxs("div", { className: "pt-3 border-t border-slate-100 space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-slate-500 font-medium", children: [_jsxs("span", { children: ["\u9032\u6357\u72B6\u6CC1 (", doneTasks.length, "/", relatedTasks.length, " \u5B8C\u4E86)"] }), _jsxs("span", { className: "font-bold text-slate-900", children: [percent, "%"] })] }), _jsx("div", { className: "h-2 w-full bg-slate-100 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-purple-600 transition-all duration-300", style: { width: `${percent}%` } }) }), _jsxs("button", { type: "button", onClick: () => onNavigateToTasksWithFilter(p.id), className: "w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-700 border border-purple-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1", children: [_jsxs("span", { children: ["\u3053\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u30BF\u30B9\u30AF\u4E00\u89A7\u3092\u898B\u308B (", relatedTasks.length, "\u4EF6)"] }), _jsx(ArrowRight, { className: "w-3.5 h-3.5" })] })] })] }, p.id));
                }) })), isModalOpen && (_jsx("div", { className: "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in", children: _jsxs("div", { className: "w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 pb-3", children: [_jsxs("h2", { className: "text-base font-bold text-slate-900 flex items-center gap-2", children: [_jsx(Briefcase, { className: "w-4 h-4 text-purple-600" }), _jsx("span", { children: editingProject ? 'プロジェクトを編集' : '新規プロジェクト作成' })] }), _jsx("button", { type: "button", onClick: () => setIsModalOpen(false), className: "text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "space-y-3.5", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: ["\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "\u4F8B: \u65B0\u898FWeb\u30B5\u30FC\u30D3\u30B9\u306EMVP\u958B\u767A", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u76EE\u7684\u30FB\u9054\u6210\u76EE\u6A19" }), _jsx("textarea", { rows: 3, value: objective, onChange: (e) => setObjective(e.target.value), placeholder: "\u3053\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3067\u9054\u6210\u3059\u3079\u304D\u6210\u679C\u3084\u5B8C\u4E86\u6761\u4EF6\u3092\u8A18\u8F09", className: "w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u72B6\u614B" }), _jsxs("select", { value: status, onChange: (e) => setStatus(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "in_progress", children: "\u9032\u884C\u4E2D" }), _jsx("option", { value: "planning", children: "\u8A08\u753B\u4E2D" }), _jsx("option", { value: "completed", children: "\u5B8C\u4E86" }), _jsx("option", { value: "on_hold", children: "\u4FDD\u7559" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u512A\u5148\u9806\u4F4D" }), _jsxs("select", { value: priority, onChange: (e) => setPriority(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 cursor-pointer shadow-2xs", children: [_jsx("option", { value: "high", children: "\u9AD8 (High)" }), _jsx("option", { value: "medium", children: "\u4E2D (Medium)" }), _jsx("option", { value: "low", children: "\u4F4E (Low)" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u76EE\u6A19\u671F\u65E5 (\u4EFB\u610F)" }), _jsx("input", { type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value), className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-3 border-t border-slate-200", children: [_jsx("button", { type: "button", onClick: () => setIsModalOpen(false), className: "px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", onClick: handleSave, className: "px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer", children: editingProject ? '変更を保存' : 'プロジェクトを作成' })] })] }) }))] }));
};
