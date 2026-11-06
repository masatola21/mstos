import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Check, ClipboardList, Plus, Trash2, AlertCircle } from 'lucide-react';
import { AI_WORK_MODES, resolveWorkMode } from '../../data/aiWorkModes';
export const PlanRegistrationModal = ({ plan, isOpen, onClose, characters, roleOverrides = {}, onConfirmRegistration, }) => {
    const [projectName, setProjectName] = useState(plan.projectName || '新規プロジェクト');
    const [projectObjective, setProjectObjective] = useState(plan.projectObjective || '');
    const [projectPriority, setProjectPriority] = useState(plan.priority || 'high');
    const [dueDate, setDueDate] = useState(plan.dueDate || '');
    const [tasks, setTasks] = useState(plan.tasks.map((t) => {
        let assignee = { type: 'role_ai', workModeId: 'president', name: 'シドウ（AI社長・統括）' };
        if (t.suggestedAssignee?.includes('人間') || t.suggestedAssignee?.includes('あなた')) {
            assignee = { type: 'human', name: '人間 (あなた)' };
        }
        else if (t.suggestedAssignee?.includes('開発エージェント')) {
            assignee = { type: 'dev_agent', name: '開発エージェント' };
        }
        else {
            const foundMode = AI_WORK_MODES.find((mode) => {
                const resolved = resolveWorkMode(mode, roleOverrides);
                return t.suggestedAssignee?.includes(mode.label) || t.suggestedAssignee?.includes(mode.name) || t.suggestedAssignee?.includes(resolved.name) || (mode.id === 'president' && /AI社長|社長/.test(t.suggestedAssignee || ''));
            });
            const found = characters.find((c) => t.suggestedAssignee?.includes(c.name));
            if (foundMode) {
                const resolved = resolveWorkMode(foundMode, roleOverrides);
                assignee = { type: 'role_ai', workModeId: foundMode.id, name: `${resolved.name}（${resolved.label}）` };
            }
            else if (found) {
                assignee = { type: 'custom_ai', id: found.id, name: found.name };
            }
        }
        return {
            title: t.title,
            description: t.objective || '',
            priority: t.priority || 'medium',
            completionCriteria: t.completionCriteria || '',
            assignee,
        };
    }));
    if (!isOpen)
        return null;
    const handleTaskChange = (index, field, value) => {
        setTasks((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
    };
    const handleAssigneeChange = (index, rawVal) => {
        let assignee;
        if (rawVal === 'human') {
            assignee = { type: 'human', name: '人間 (あなた)' };
        }
        else if (rawVal === 'ai_ceo') {
            assignee = { type: 'ai_ceo', name: 'AI社長' };
        }
        else if (rawVal === 'dev_agent') {
            assignee = { type: 'dev_agent', name: '開発エージェント' };
        }
        else if (rawVal.startsWith('role:')) {
            const workModeId = rawVal.slice('role:'.length);
            const mode = AI_WORK_MODES.find((item) => item.id === workModeId);
            const resolved = mode ? resolveWorkMode(mode, roleOverrides) : undefined;
            assignee = mode && resolved
                ? { type: 'role_ai', workModeId, name: `${resolved.name}（${resolved.label}）` }
                : { type: 'ai_ceo', name: 'AI社長' };
        }
        else {
            const char = characters.find((c) => c.id === rawVal);
            assignee = {
                type: 'custom_ai',
                id: char?.id,
                name: char ? `${char.name} (${char.role})` : '専門AI',
            };
        }
        handleTaskChange(index, 'assignee', assignee);
    };
    const addTaskRow = () => {
        setTasks((prev) => [
            ...prev,
            {
                title: '新規タスク',
                description: '',
                priority: 'medium',
                completionCriteria: '',
                assignee: { type: 'human', name: '人間 (あなた)' },
            },
        ]);
    };
    const removeTaskRow = (index) => {
        setTasks((prev) => prev.filter((_, idx) => idx !== index));
    };
    const handleRegister = () => {
        if (!projectName.trim()) {
            alert('プロジェクト名を入力してください。');
            return;
        }
        if (tasks.length === 0) {
            alert('最低1つのタスクが必要です。');
            return;
        }
        onConfirmRegistration(projectName.trim(), projectObjective.trim(), projectPriority, dueDate, tasks);
        onClose();
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in", children: _jsxs("div", { className: "w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: "w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400", children: _jsx(ClipboardList, { className: "w-4 h-4" }) }), _jsxs("div", { children: [_jsxs("h2", { className: "text-sm sm:text-base font-bold text-white flex items-center gap-2", children: [_jsx("span", { children: "AI\u793E\u9577\u306E\u63D0\u6848\u8A08\u753B\u3092\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3068\u3057\u3066\u767B\u9332" }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30", children: "\u78BA\u8A8D\u30FB\u672A\u627F\u8A8D" })] }), _jsx("p", { className: "text-[11px] text-slate-400", children: "\u5185\u5BB9\u3092\u78BA\u8A8D\u30FB\u7DE8\u96C6\u3057\u3001\u627F\u8A8D\u3057\u305F\u5834\u5408\u306E\u307F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3068\u30BF\u30B9\u30AF\u3078\u767B\u9332\u3055\u308C\u307E\u3059\u3002" })] })] }), _jsx("button", { type: "button", onClick: onClose, className: "text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "px-5 py-2.5 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center gap-2 text-xs text-indigo-200", children: [_jsx(AlertCircle, { className: "w-4 h-4 text-indigo-400 shrink-0" }), _jsx("span", { children: "AI\u793E\u9577\u306F\u81EA\u52D5\u5B9F\u884C\u3092\u884C\u3044\u307E\u305B\u3093\u3002\u5404\u30BF\u30B9\u30AF\u306E\u5185\u5BB9\u30FB\u62C5\u5F53\u30FB\u5B8C\u4E86\u6761\u4EF6\u3092\u78BA\u8A8D\u3057\u3066\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-5 space-y-5", children: [_jsxs("div", { className: "p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3", children: [_jsx("h3", { className: "text-xs font-bold text-indigo-300 uppercase tracking-wider", children: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u57FA\u672C\u60C5\u5831" }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: [_jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "block text-[11px] font-semibold text-slate-300 mb-1", children: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D" }), _jsx("input", { type: "text", value: projectName, onChange: (e) => setProjectName(e.target.value), className: "w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-semibold text-slate-300 mb-1", children: "\u512A\u5148\u9806\u4F4D" }), _jsxs("select", { value: projectPriority, onChange: (e) => setProjectPriority(e.target.value), className: "w-full rounded-xl bg-slate-900 border border-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer", children: [_jsx("option", { value: "high", children: "\u9AD8 (High)" }), _jsx("option", { value: "medium", children: "\u4E2D (Medium)" }), _jsx("option", { value: "low", children: "\u4F4E (Low)" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-semibold text-slate-300 mb-1", children: "\u76EE\u7684\u30FB\u9054\u6210\u76EE\u6A19" }), _jsx("textarea", { rows: 2, value: projectObjective, onChange: (e) => setProjectObjective(e.target.value), placeholder: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u76EE\u7684\u3084\u9054\u6210\u57FA\u6E96\u3092\u8A18\u8F09", className: "w-full rounded-xl bg-slate-900 border border-slate-800 p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-semibold text-slate-300 mb-1", children: "\u76EE\u6A19\u671F\u9650 (\u4EFB\u610F)" }), _jsx("input", { type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value), className: "rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-xs font-bold text-indigo-300 uppercase tracking-wider", children: ["\u5206\u89E3\u3055\u308C\u305F\u30BF\u30B9\u30AF\u4E00\u89A7 (", tasks.length, "\u4EF6)"] }), _jsxs("button", { type: "button", onClick: addTaskRow, className: "flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), " \u30BF\u30B9\u30AF\u8FFD\u52A0"] })] }), _jsx("div", { className: "space-y-3", children: tasks.map((task, idx) => (_jsxs("div", { className: "p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 relative group", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("span", { className: "text-[11px] font-bold text-indigo-400", children: ["\u30BF\u30B9\u30AF #", idx + 1] }), _jsx("button", { type: "button", onClick: () => removeTaskRow(idx), title: "\u3053\u306E\u30BF\u30B9\u30AF\u3092\u524A\u9664", className: "text-slate-500 hover:text-rose-400 text-xs p-1 cursor-pointer", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-2", children: [_jsxs("div", { className: "sm:col-span-2", children: [_jsx("label", { className: "block text-[10px] font-semibold text-slate-400 mb-0.5", children: "\u30BF\u30B9\u30AF\u540D" }), _jsx("input", { type: "text", value: task.title, onChange: (e) => handleTaskChange(idx, 'title', e.target.value), className: "w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[10px] font-semibold text-slate-400 mb-0.5", children: "\u512A\u5148\u5EA6" }), _jsxs("select", { value: task.priority, onChange: (e) => handleTaskChange(idx, 'priority', e.target.value), className: "w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer", children: [_jsx("option", { value: "high", children: "\u9AD8 (High)" }), _jsx("option", { value: "medium", children: "\u4E2D (Medium)" }), _jsx("option", { value: "low", children: "\u4F4E (Low)" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[10px] font-semibold text-slate-400 mb-0.5", children: "\u62C5\u5F53\u306E\u5272\u308A\u5F53\u3066" }), _jsxs("select", { value: task.assignee.type === 'custom_ai'
                                                                    ? task.assignee.id || 'custom'
                                                                    : task.assignee.type === 'role_ai'
                                                                        ? `role:${task.assignee.workModeId || 'president'}`
                                                                        : task.assignee.type, onChange: (e) => handleAssigneeChange(idx, e.target.value), className: "w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer", children: [_jsx("option", { value: "human", children: "\uD83D\uDC64 \u4EBA\u9593 (\u3042\u306A\u305F)" }), _jsx("option", { value: "dev_agent", children: "\u2699\uFE0F \u958B\u767A\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8" }), _jsx("optgroup", { label: "\u5F79\u5272AI", children: AI_WORK_MODES.map((mode) => {
                                                                            const resolved = resolveWorkMode(mode, roleOverrides);
                                                                            return _jsxs("option", { value: `role:${mode.id}`, children: [resolved.avatarEmoji, " ", resolved.name, "\uFF08", resolved.label, "\uFF09"] }, mode.id);
                                                                        }) }), _jsx("optgroup", { label: "\u767B\u9332\u6E08\u307FAI", children: characters
                                                                            .filter((c) => c.id !== 'preset-ceo')
                                                                            .map((c) => (_jsxs("option", { value: c.id, children: [c.avatarEmoji || '🤖', " ", c.name, " (", c.role, ")"] }, c.id))) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[10px] font-semibold text-slate-400 mb-0.5", children: "\u5B8C\u4E86\u6761\u4EF6 (\u30C1\u30A7\u30C3\u30AF\u57FA\u6E96)" }), _jsx("input", { type: "text", value: task.completionCriteria, onChange: (e) => handleTaskChange(idx, 'completionCriteria', e.target.value), placeholder: "\u4F8B: \u30EC\u30D3\u30E5\u30FC\u5B8C\u4E86\u3001\u6210\u679C\u7269\u63D0\u51FA\u306A\u3069", className: "w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[10px] font-semibold text-slate-400 mb-0.5", children: "\u8AAC\u660E\u30FB\u5B9F\u65BD\u76EE\u7684" }), _jsx("input", { type: "text", value: task.description, onChange: (e) => handleTaskChange(idx, 'description', e.target.value), placeholder: "\u30BF\u30B9\u30AF\u306E\u8A73\u7D30\u3084\u80CC\u666F", className: "w-full rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" })] })] }, idx))) })] })] }), _jsxs("div", { className: "px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsxs("button", { type: "button", onClick: handleRegister, className: "flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer", children: [_jsx(Check, { className: "w-4 h-4" }), _jsx("span", { children: "\u78BA\u8A8D\u6E08\u307F\uFF1A\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\uFF06\u30BF\u30B9\u30AF\u3068\u3057\u3066\u767B\u9332" })] })] })] }) }));
};
