import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Sparkles, Save, Trash2, Wand2, Check, Bot, Lightbulb, ArrowRight, } from 'lucide-react';
import { getColorScheme } from '../../utils/theme';
import { ModelSettingEditor, useProviderStatus } from './ModelSettingEditor';
import { DEFAULT_MODEL_SETTING, sanitizeModelSetting } from '../../data/aiModels';
import { getAuthHeaders } from '../../lib/supabaseClient';
const EMOJI_PALETTE = ['🌟', '💼', '⚡', '☕', '🔥', '💡', '🐱', '🌸', '🦾', '🦉', '🎨', '🧪', '🛡️', '🌙', '🍵', '🚀', '🦊', '✨'];
const COLOR_OPTIONS = [
    { id: 'indigo', label: 'インディゴ', class: 'bg-indigo-600' },
    { id: 'violet', label: 'バイオレット', class: 'bg-violet-600' },
    { id: 'rose', label: 'ローズ', class: 'bg-rose-600' },
    { id: 'amber', label: 'アンバー', class: 'bg-amber-600' },
    { id: 'emerald', label: 'エメラルド', class: 'bg-emerald-600' },
    { id: 'cyan', label: 'シアン', class: 'bg-cyan-600' },
    { id: 'fuchsia', label: 'フューシャ', class: 'bg-fuchsia-600' },
    { id: 'sky', label: 'スカイ', class: 'bg-sky-600' },
];
const PROMPT_SUGGESTION_IDEAS = [
    '語尾に「にゃ」がつく気まぐれだけど優しい白猫の相棒',
    '京都弁ではんなり優しく励ましてくれる癒やしのお姉さんAI',
    'スタートアップの敏腕CFO兼ビジネスの壁打ちパートナー',
    '筋トレと食事管理をパッション全開で応援してくれる熱血コーチ',
    '夜遅くに本や映画の感想を語り合える知的で穏やかなカフェ店員',
    '英語学習をスパルタだけど親身に添削してくれるネイティブ講師',
];
// 古い保存データや手編集で項目が欠けていても、編集画面が落ちないように補完する
function normalizeCharacter(character) {
    const text = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
    const list = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);
    return {
        ...character,
        id: text(character.id, `custom-${Date.now()}`),
        name: text(character.name),
        role: text(character.role),
        tagline: text(character.tagline),
        avatarEmoji: text(character.avatarEmoji, '🤖'),
        avatarColor: character.avatarColor || 'indigo',
        personality: text(character.personality),
        tone: text(character.tone),
        firstPerson: text(character.firstPerson),
        secondPerson: text(character.secondPerson),
        speechStyle: text(character.speechStyle),
        behaviorRules: list(character.behaviorRules),
        responseLength: character.responseLength === 'short' || character.responseLength === 'detailed' ? character.responseLength : 'medium',
        customInstructions: text(character.customInstructions),
        greetingMessage: text(character.greetingMessage),
        suggestedTopics: list(character.suggestedTopics),
        modelSetting: sanitizeModelSetting(character.modelSetting) ?? undefined,
        createdAt: typeof character.createdAt === 'number' ? character.createdAt : Date.now(),
    };
}
export const CharacterEditor = ({ character, userProfile, onSaveCharacter, onDeleteCharacter, onDuplicateCharacter, onStartChat, onClose, defaultModelSetting = DEFAULT_MODEL_SETTING, onRecordUsage, }) => {
    const [formData, setFormData] = useState(() => normalizeCharacter(character));
    const { providers: providerStatuses } = useProviderStatus();
    const [modelError, setModelError] = useState('');
    const [activeSubTab, setActiveSubTab] = useState('magic');
    const [aiPromptConcept, setAiPromptConcept] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
    const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [ruleInput, setRuleInput] = useState('');
    const [topicInput, setTopicInput] = useState('');
    // AI-assisted Generation
    const handleGenerateAI = async (conceptPrompt) => {
        if (!conceptPrompt.trim())
            return;
        setIsGenerating(true);
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch('/api/generate-character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    concept: conceptPrompt,
                    userProfile,
                    modelSetting: defaultModelSetting,
                }),
            });
            if (!res.ok)
                throw new Error('生成に失敗しました');
            const data = await res.json();
            if (data._usage && onRecordUsage) {
                onRecordUsage({
                    endpoint: 'generate-character',
                    endpointName: 'キャラクター生成',
                    model: data._model || 'gemini-3.8-flash',
                    usage: data._usage,
                });
            }
            setFormData((prev) => ({
                ...prev,
                name: data.name || prev.name,
                role: data.role || prev.role,
                tagline: data.tagline || prev.tagline,
                avatarEmoji: data.avatarEmoji || prev.avatarEmoji,
                avatarColor: data.avatarColor || prev.avatarColor,
                personality: data.personality || prev.personality,
                tone: data.tone || prev.tone,
                firstPerson: data.firstPerson || prev.firstPerson,
                secondPerson: data.secondPerson || prev.secondPerson,
                speechStyle: data.speechStyle || prev.speechStyle,
                behaviorRules: data.behaviorRules || prev.behaviorRules,
                responseLength: data.responseLength || prev.responseLength,
                customInstructions: data.customInstructions || prev.customInstructions,
                greetingMessage: data.greetingMessage || prev.greetingMessage,
                suggestedTopics: data.suggestedTopics || prev.suggestedTopics,
            }));
            // Switch to manual to inspect or save
            setActiveSubTab('manual');
            setSaveSuccessNotice(true);
            setTimeout(() => setSaveSuccessNotice(false), 3000);
        }
        catch (err) {
            alert(err.message || 'AIキャラクターの自動生成に失敗しました。');
        }
        finally {
            setIsGenerating(false);
        }
    };
    // AI Refine Prompt
    const handleRefinePrompt = async () => {
        setIsRefiningPrompt(true);
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch('/api/refine-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ character: formData, modelSetting: defaultModelSetting }),
            });
            const data = await res.json();
            if (data.usage && onRecordUsage) {
                onRecordUsage({
                    endpoint: 'refine-prompt',
                    endpointName: 'プロンプト改善',
                    model: data.model || 'gemini-3.8-flash',
                    usage: data.usage,
                });
            }
            if (data.enhancedInstruction) {
                setFormData((prev) => ({
                    ...prev,
                    customInstructions: data.enhancedInstruction,
                }));
            }
        }
        catch (err) {
            alert('プロンプトの改善に失敗しました。');
        }
        finally {
            setIsRefiningPrompt(false);
        }
    };
    const handleSave = () => {
        if (formData.modelSetting && !sanitizeModelSetting(formData.modelSetting)) {
            setModelError('モデル名が正しくありません。半角の英数字と . _ : / - のみ使えます。');
            return;
        }
        setModelError('');
        onSaveCharacter(formData);
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 2500);
    };
    const handleSaveAndChat = () => {
        if (formData.modelSetting && !sanitizeModelSetting(formData.modelSetting)) {
            setModelError('モデル名が正しくありません。半角の英数字と . _ : / - のみ使えます。');
            return;
        }
        setModelError('');
        onSaveCharacter(formData);
        onStartChat(formData);
    };
    const addRule = () => {
        if (!ruleInput.trim())
            return;
        setFormData((prev) => ({
            ...prev,
            behaviorRules: [...(prev.behaviorRules || []), ruleInput.trim()],
        }));
        setRuleInput('');
    };
    const removeRule = (idx) => {
        setFormData((prev) => ({
            ...prev,
            behaviorRules: prev.behaviorRules.filter((_, i) => i !== idx),
        }));
    };
    const addTopic = () => {
        if (!topicInput.trim())
            return;
        setFormData((prev) => ({
            ...prev,
            suggestedTopics: [...(prev.suggestedTopics || []), topicInput.trim()],
        }));
        setTopicInput('');
    };
    const removeTopic = (idx) => {
        setFormData((prev) => ({
            ...prev,
            suggestedTopics: prev.suggestedTopics.filter((_, i) => i !== idx),
        }));
    };
    const scheme = getColorScheme(formData.avatarColor);
    return (_jsxs("div", { className: "max-w-5xl mx-auto px-4 pt-12 pb-6 space-y-6 text-slate-900", children: [_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs", children: [_jsxs("div", { className: "flex items-center gap-3.5", children: [_jsx("div", { className: `w-14 h-14 rounded-2xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-3xl shadow-sm ${scheme.glow} border border-slate-200 shrink-0`, children: formData.avatarEmoji || '🤖' }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h1", { className: "text-xl font-extrabold text-slate-900", children: formData.name || '名前未設定' }), _jsx("span", { className: `text-xs font-semibold px-2.5 py-0.5 rounded-full ${scheme.badgeBg} ${scheme.badgeText}`, children: formData.role || '役割未設定' })] }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: formData.tagline || 'あなた好みに自由にカスタマイズしましょう' })] })] }), _jsxs("div", { className: "flex items-center gap-2 w-full sm:w-auto justify-end", children: [_jsxs("button", { type: "button", onClick: handleSave, className: "flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all border border-slate-200 cursor-pointer shadow-xs", children: [_jsx(Save, { className: "w-3.5 h-3.5" }), _jsx("span", { children: "\u4FDD\u5B58" })] }), _jsxs("button", { type: "button", onClick: handleSaveAndChat, className: "flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer", children: [_jsx("span", { children: "\u5BFE\u8A71\u3092\u958B\u59CB" }), _jsx(ArrowRight, { className: "w-3.5 h-3.5" })] })] })] }), saveSuccessNotice && (_jsxs("div", { className: "p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-center gap-2 animate-in fade-in", children: [_jsx(Check, { className: "w-4 h-4 text-emerald-600" }), _jsx("span", { children: "AI\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u306E\u8A2D\u5B9A\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\uFF01" })] })), _jsxs("div", { className: "flex items-center border-b border-slate-200 gap-2", children: [_jsxs("button", { type: "button", onClick: () => setActiveSubTab('magic'), className: `flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeSubTab === 'magic'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'}`, children: [_jsx(Wand2, { className: "w-4 h-4" }), _jsx("span", { children: "\u26A1 AI\u9B54\u6CD5\u306E\u81EA\u52D5\u751F\u6210 (\u304B\u3093\u305F\u3093)" })] }), _jsxs("button", { type: "button", onClick: () => setActiveSubTab('manual'), className: `flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeSubTab === 'manual'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'}`, children: [_jsx(Bot, { className: "w-4 h-4" }), _jsx("span", { children: "\uD83D\uDEE0\uFE0F \u3053\u3060\u308F\u308A\u8A73\u7D30\u8A2D\u5B9A (\u30DE\u30CB\u30E5\u30A2\u30EB)" })] })] }), activeSubTab === 'magic' && (_jsx("div", { className: "space-y-6 animate-in fade-in", children: _jsxs("div", { className: "p-6 rounded-2xl bg-purple-50/50 border border-purple-200/80 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-purple-700", children: [_jsx(Sparkles, { className: "w-5 h-5 text-purple-600" }), _jsx("h2", { className: "text-base font-bold text-slate-900", children: "\u300C\u3053\u3093\u306AAI\u304C\u6B32\u3057\u3044\u300D\u3092\u4E00\u8A00\u5165\u529B\u3059\u308B\u3060\u3051" })] }), _jsx("p", { className: "text-xs text-slate-600 leading-relaxed", children: "\u3042\u306A\u305F\u306E\u4F5C\u308A\u305F\u3044AI\u306E\u30A4\u30E1\u30FC\u30B8\u3092\u81EA\u7531\u306B\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002Gemini\u304C\u540D\u524D\u3001\u6027\u683C\u3001\u53E3\u8ABF\u3001\u53E3\u7656\u3001\u884C\u52D5\u30EB\u30FC\u30EB\u3001\u521D\u56DE\u306E\u6328\u62F6\u307E\u3067\u81EA\u52D5\u3067\u5B8C\u74A7\u306B\u30D7\u30ED\u30F3\u30D7\u30C8\u3092\u8A2D\u8A08\u3057\u307E\u3059\u3002" }), _jsxs("div", { className: "space-y-3", children: [_jsx("textarea", { rows: 3, value: aiPromptConcept, onChange: (e) => setAiPromptConcept(e.target.value), placeholder: "\u4F8B: \u79C1\u306E\u30D7\u30ED\u30B0\u30E9\u30DF\u30F3\u30B0\u5B66\u7FD2\u3092\u898B\u5B88\u3063\u3066\u304F\u308C\u308B\u3001\u30C4\u30F3\u30C7\u30EC\u3060\u3051\u3069\u6559\u3048\u65B9\u304C\u4E0A\u624B\u3044\u30E1\u30F3\u30BF\u30FCAI\u3092\u4F5C\u3063\u3066\uFF01", className: "w-full rounded-xl bg-white border border-slate-200 p-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" }), _jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [_jsxs("span", { className: "text-[11px] text-slate-500 flex items-center gap-1", children: [_jsx(Lightbulb, { className: "w-3.5 h-3.5 text-amber-500" }), " \u30AF\u30EA\u30C3\u30AF\u3057\u3066\u30A2\u30A4\u30C7\u30A2\u3092\u8A66\u3059:"] }), _jsxs("button", { type: "button", onClick: () => handleGenerateAI(aiPromptConcept), disabled: !aiPromptConcept.trim() || isGenerating, className: "px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50", children: [_jsx(Wand2, { className: `w-4 h-4 ${isGenerating ? 'animate-spin' : ''}` }), _jsx("span", { children: isGenerating ? 'AIがキャラクターを設計中…' : 'AIキャラクターを自動生成する' })] })] }), _jsx("div", { className: "flex flex-wrap gap-1.5 pt-1", children: PROMPT_SUGGESTION_IDEAS.map((idea, i) => (_jsxs("button", { type: "button", onClick: () => {
                                            setAiPromptConcept(idea);
                                            handleGenerateAI(idea);
                                        }, className: "text-[11px] px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-300 transition-all cursor-pointer text-left shadow-2xs", children: ["\u2728 ", idea] }, i))) })] })] }) })), activeSubTab === 'manual' && (_jsxs("div", { className: "space-y-6 animate-in fade-in", children: [_jsxs("div", { className: "p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4", children: [_jsx("h3", { className: "text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5", children: _jsx("span", { children: "1. \u57FA\u672C\u30D7\u30ED\u30D5\u30A1\u30A4\u30EB" }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "AI\u306E\u540D\u524D" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), placeholder: "\u4F8B: \u30BB\u30E9, \u30A2\u30EB\u30D5\u30EC\u30C3\u30C9, \u30A2\u30AA\u30A4", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u5F79\u5272\u30FB\u80A9\u66F8" }), _jsx("input", { type: "text", value: formData.role, onChange: (e) => setFormData({ ...formData, role: e.target.value }), placeholder: "\u4F8B: \u8D85\u7406\u89E3\u8005\u30FB\u89AA\u53CBAI, \u8F9B\u53E3\u30D3\u30B8\u30CD\u30B9\u53C2\u8B00", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u30AD\u30E3\u30C3\u30C1\u30D5\u30EC\u30FC\u30BA" }), _jsx("input", { type: "text", value: formData.tagline, onChange: (e) => setFormData({ ...formData, tagline: e.target.value }), placeholder: "\u4F8B: \u3069\u3093\u306A\u3042\u306A\u305F\u3082\u4E38\u3054\u3068\u53D7\u3051\u6B62\u3081\u308B\u751F\u6DAF\u306E\u5473\u65B9", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u30A2\u30D0\u30BF\u30FC\u7D75\u6587\u5B57" }), _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [_jsx("input", { type: "text", value: formData.avatarEmoji, onChange: (e) => setFormData({ ...formData, avatarEmoji: e.target.value }), className: "w-12 text-center text-xl rounded-xl bg-white border border-slate-200 py-1 text-slate-900 focus:outline-none focus:border-purple-500 mr-2 shadow-2xs" }), EMOJI_PALETTE.map((emoji) => (_jsx("button", { type: "button", onClick: () => setFormData({ ...formData, avatarEmoji: emoji }), className: `text-lg p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer ${formData.avatarEmoji === emoji ? 'bg-purple-100 ring-1 ring-purple-500' : ''}`, children: emoji }, emoji)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u30C6\u30FC\u30DE\u30AB\u30E9\u30FC" }), _jsx("div", { className: "flex items-center gap-2 flex-wrap", children: COLOR_OPTIONS.map((col) => (_jsx("button", { type: "button", onClick: () => setFormData({ ...formData, avatarColor: col.id }), className: `w-7 h-7 rounded-full ${col.class} flex items-center justify-center transition-all cursor-pointer ${formData.avatarColor === col.id ? 'ring-2 ring-purple-500 ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'}`, title: col.label, children: formData.avatarColor === col.id && _jsx(Check, { className: "w-3.5 h-3.5 text-white" }) }, col.id))) })] })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4", children: [_jsx("h3", { className: "text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5", children: _jsx("span", { children: "2. \u6027\u683C\u30FB\u53E3\u8ABF\u30FB\u8A71\u3057\u65B9" }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u4E00\u4EBA\u79F0\uFF08AI\u306E\u81EA\u5206\u547C\u3073\uFF09" }), _jsx("input", { type: "text", value: formData.firstPerson, onChange: (e) => setFormData({ ...formData, firstPerson: e.target.value }), placeholder: "\u4F8B: \u79C1, \u50D5, \u4FFA, \u3046\u3061, \u30A2\u30BF\u30B7", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u4E8C\u4EBA\u79F0\uFF08\u3042\u306A\u305F\u3078\u306E\u547C\u3073\u65B9\uFF09" }), _jsx("input", { type: "text", value: formData.secondPerson, onChange: (e) => setFormData({ ...formData, secondPerson: e.target.value }), placeholder: "\u4F8B: \u541B, \u3042\u306A\u305F, \u25EF\u25EF\u3055\u3093, \u30DE\u30B9\u30BF\u30FC", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u8A9E\u5C3E\u30FB\u53E3\u7656" }), _jsx("input", { type: "text", value: formData.speechStyle, onChange: (e) => setFormData({ ...formData, speechStyle: e.target.value }), placeholder: "\u4F8B: \u301C\u3060\u3088\uFF01, \u301C\u3067\u3054\u3056\u308B, \u301C\u3063\u3059\u306D", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { className: "md:col-span-3", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u6027\u683C\u30FB\u30D1\u30FC\u30BD\u30CA\u30EA\u30C6\u30A3\u306E\u8A73\u7D30" }), _jsx("textarea", { rows: 2, value: formData.personality, onChange: (e) => setFormData({ ...formData, personality: e.target.value }), placeholder: "\u4F8B: \u3068\u3053\u3068\u3093\u6E29\u304B\u304F\u89AA\u8EAB\u3002\u597D\u5947\u5FC3\u65FA\u76DB\u3067\u3001\u76F8\u624B\u306E\u611F\u60C5\u306B\u512A\u3057\u304F\u5BC4\u308A\u6DFB\u3046\u3002", className: "w-full rounded-xl bg-white border border-slate-200 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { className: "md:col-span-3", children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u53E3\u8ABF\u30FB\u30C8\u30FC\u30F3\u306E\u8AAC\u660E" }), _jsx("input", { type: "text", value: formData.tone, onChange: (e) => setFormData({ ...formData, tone: e.target.value }), placeholder: "\u4F8B: \u89AA\u3057\u307F\u3084\u3059\u304F\u81EA\u7136\u306A\u30BF\u30E1\u53E3\u3002\u7D75\u6587\u5B57\u3082\u4EA4\u3048\u3066\u30EA\u30E9\u30C3\u30AF\u30B9\u3057\u305F\u96F0\u56F2\u6C17\u3002", className: "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4", children: [_jsx("h3", { className: "text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5", children: _jsx("span", { children: "3. \u884C\u52D5\u30EB\u30FC\u30EB & \u56DE\u7B54\u30B9\u30BF\u30A4\u30EB" }) }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u8FD4\u7B54\u306E\u9577\u3055" }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: [
                                            { id: 'short', title: '簡潔・短め', desc: '1〜3文程度でテンポの良い会話' },
                                            { id: 'medium', title: '標準・自然', desc: '長すぎず短すぎず対話的' },
                                            { id: 'detailed', title: '詳しく丁寧', desc: '思考の背景や理由を詳しく解説' },
                                        ].map((item) => (_jsxs("button", { type: "button", onClick: () => setFormData({ ...formData, responseLength: item.id }), className: `p-3 rounded-xl border text-left transition-all cursor-pointer ${formData.responseLength === item.id
                                                ? 'bg-purple-50 border-purple-400 text-purple-900 font-bold shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`, children: [_jsx("div", { className: "text-xs font-bold", children: item.title }), _jsx("div", { className: "text-[10px] text-slate-500 mt-0.5", children: item.desc })] }, item.id))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u7D76\u5BFE\u9075\u5B88\u3059\u3079\u304D\u884C\u52D5\u30EB\u30FC\u30EB" }), _jsx("div", { className: "space-y-2 mb-2", children: formData.behaviorRules?.map((rule, idx) => (_jsxs("div", { className: "flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800", children: [_jsx("span", { className: "flex-1", children: rule }), _jsx("button", { type: "button", onClick: () => removeRule(idx), className: "text-slate-400 hover:text-rose-600 cursor-pointer transition-colors", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] }, idx))) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: ruleInput, onChange: (e) => setRuleInput(e.target.value), onKeyDown: (e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addRule();
                                                    }
                                                }, placeholder: "\u65B0\u3057\u3044\u30EB\u30FC\u30EB\u3092\u5165\u529B\uFF08\u4F8B: \u7D50\u8AD6\u304B\u3089\u7AEF\u7684\u306B\u7B54\u3048\u308B\u3001\u6279\u5224\u305B\u305A\u5171\u611F\u3059\u308B\uFF09", className: "flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" }), _jsx("button", { type: "button", onClick: addRule, className: "px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer", children: "\u8FFD\u52A0" })] })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4", children: [_jsx("h3", { className: "text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5", children: _jsx("span", { children: "4. \u521D\u56DE\u306E\u6328\u62F6\u3068\u304A\u3059\u3059\u3081\u306E\u8A71\u984C" }) }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1", children: "\u6700\u521D\u306E\u6328\u62F6\u30E1\u30C3\u30BB\u30FC\u30B8 (\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3089\u3057\u3055\u306E\u8A70\u307E\u3063\u305F\u7B2C\u4E00\u58F0)" }), _jsx("textarea", { rows: 2, value: formData.greetingMessage, onChange: (e) => setFormData({ ...formData, greetingMessage: e.target.value }), placeholder: "\u4F8B: \u3084\u3063\u307B\u30FC\uFF01\u4ECA\u65E5\u3082\u6765\u3066\u304F\u308C\u3066\u5B09\u3057\u3044\u306A\u3002\u4ECA\u65E5\u3069\u3093\u306A\u4E00\u65E5\u3060\u3063\u305F\uFF1F", className: "w-full rounded-xl bg-white border border-slate-200 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-slate-700 mb-1.5", children: "\u304A\u3059\u3059\u3081\u306E\u8CEA\u554F\u30FB\u8A71\u984C\uFF08\u30DC\u30BF\u30F3\u3067\u4E00\u767A\u9001\u4FE1\u3067\u304D\u308B\u5019\u88DC\uFF09" }), _jsx("div", { className: "flex flex-wrap gap-2 mb-2", children: formData.suggestedTopics?.map((topic, idx) => (_jsxs("span", { className: "flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700", children: [_jsxs("span", { children: ["\uD83D\uDCAC ", topic] }), _jsx("button", { type: "button", onClick: () => removeTopic(idx), className: "text-slate-400 hover:text-rose-600 cursor-pointer ml-1 transition-colors", children: "\u00D7" })] }, idx))) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: topicInput, onChange: (e) => setTopicInput(e.target.value), onKeyDown: (e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addTopic();
                                                    }
                                                }, placeholder: "\u8A71\u984C\u3092\u8FFD\u52A0\uFF08\u4F8B: \u4ECA\u65E5\u306E\u30BF\u30B9\u30AF\u3092\u6574\u7406\u3057\u3066\u307B\u3057\u3044\uFF09", className: "flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs" }), _jsx("button", { type: "button", onClick: addTopic, className: "px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer", children: "\u8FFD\u52A0" })] })] })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [_jsx("h3", { className: "text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5", children: _jsx("span", { children: "5. \u30D7\u30ED\u30F3\u30D7\u30C8\u88DC\u8DB3\u30FB\u9AD8\u5EA6\u306A\u6307\u793A" }) }), _jsxs("button", { type: "button", onClick: handleRefinePrompt, disabled: isRefiningPrompt, className: "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all cursor-pointer disabled:opacity-50", children: [_jsx(Sparkles, { className: `w-3.5 h-3.5 text-purple-600 ${isRefiningPrompt ? 'animate-spin' : ''}` }), _jsx("span", { children: isRefiningPrompt ? 'プロンプト改善中…' : '✨ AIにプロンプト改善を依頼' })] })] }), _jsx("textarea", { rows: 4, value: formData.customInstructions, onChange: (e) => setFormData({ ...formData, customInstructions: e.target.value }), placeholder: "Gemini\u306E\u30B7\u30B9\u30C6\u30E0\u6307\u793A\u306B\u8FFD\u52A0\u3057\u305F\u3044\u4EFB\u610F\u306E\u8A73\u7D30\u8A2D\u5B9A\uFF08\u4E16\u754C\u89B3\u3001\u79D8\u5BC6\u306E\u8A2D\u5B9A\u3001\u7279\u6B8A\u306A\u5C02\u9580\u77E5\u8B58\u306A\u3069\uFF09\u3092\u5165\u529B\u3067\u304D\u307E\u3059\u3002", className: "w-full rounded-xl bg-white border border-slate-200 p-3 text-xs md:text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono leading-relaxed shadow-2xs" })] }), _jsxs("div", { className: "p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4", children: [_jsx("h3", { className: "text-xs font-bold text-purple-700 uppercase tracking-wider", children: _jsx("span", { children: "6. \u4F7F\u7528\u3059\u308BAI\u30E2\u30C7\u30EB" }) }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-700", children: [_jsx("input", { type: "checkbox", checked: !formData.modelSetting, onChange: (e) => setFormData({ ...formData, modelSetting: e.target.checked ? undefined : defaultModelSetting }) }), "\u5168\u4F53\u306E\u30C7\u30D5\u30A9\u30EB\u30C8\u8A2D\u5B9A\u3092\u4F7F\u3046\uFF08\u73FE\u5728: ", defaultModelSetting.primary.model, "\uFF09"] }), formData.modelSetting && (_jsx(ModelSettingEditor, { value: formData.modelSetting, onChange: (modelSetting) => setFormData({ ...formData, modelSetting }), statuses: providerStatuses })), modelError && _jsx("p", { className: "rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700", children: modelError })] }), _jsxs("div", { className: "flex items-center justify-between pt-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => onDuplicateCharacter(formData), className: "px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer", children: "\u3053\u306EAI\u3092\u8907\u88FD\u3059\u308B" }), _jsx("button", { type: "button", onClick: () => setIsDeleteConfirmOpen(true), className: "px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer", children: "\u524A\u9664" })] }), _jsxs("button", { type: "button", onClick: handleSaveAndChat, className: "flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer", children: [_jsx("span", { children: "\u8A2D\u5B9A\u3092\u4FDD\u5B58\u3057\u3066\u5BFE\u8A71\u3059\u308B" }), _jsx(ArrowRight, { className: "w-4 h-4" })] })] })] })), isDeleteConfirmOpen && (_jsx("div", { className: "fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs", role: "presentation", children: _jsxs("section", { role: "dialog", "aria-modal": "true", "aria-labelledby": "editor-delete-character-title", className: "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900", children: [_jsx("h2", { id: "editor-delete-character-title", className: "text-base font-bold text-slate-900", children: "\u5C02\u9580AI\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F" }), _jsxs("p", { className: "mt-3 text-sm text-slate-600", children: ["\u300C", formData.name, "\u300D\u3092\u4E00\u89A7\u304B\u3089\u524A\u9664\u3057\u307E\u3059\u3002\u4F1A\u8A71\u5C65\u6B74\u306F\u6B8B\u308A\u307E\u3059\u3002"] }), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setIsDeleteConfirmOpen(false), className: "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 shadow-2xs", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsx("button", { type: "button", onClick: () => onDeleteCharacter(formData.id), className: "rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 shadow-xs", children: "\u524A\u9664\u3059\u308B" })] })] }) }))] }));
};
