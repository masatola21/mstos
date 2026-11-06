import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Send, Square, Volume2, VolumeX, Trash2, Sparkles, Mic, MicOff, Copy, Check, BrainCircuit, } from 'lucide-react';
import { ChatMessageContent } from './ChatMessageContent';
import { getColorScheme } from '../../utils/theme';
import { AI_WORK_MODES, getAIWorkMode, resolveWorkMode } from '../../data/aiWorkModes';
import { getAuthHeaders } from '../../lib/supabaseClient';
export const ChatView = ({ character, characters, onSelectCharacter, userProfile, messages, selectedWorkModeId, roleOverrides, onSelectWorkMode, onSendMessage, onClearMessages, onUpdateUserProfile, isStreaming, onStopStreaming, onOpenPlanProposal, onRecordUsage, }) => {
    const [inputText, setInputText] = useState('');
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [isExtractingMemory, setIsExtractingMemory] = useState(false);
    const [memoryNotification, setMemoryNotification] = useState(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const recognitionRef = useRef(null);
    const scheme = getColorScheme(character.avatarColor);
    const selectedWorkMode = resolveWorkMode(getAIWorkMode(selectedWorkModeId), roleOverrides);
    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    // Handle Speech Recognition (Web Speech API)
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'ja-JP';
            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map((result) => result[0].transcript)
                    .join('');
                setInputText(transcript);
            };
            recognition.onend = () => {
                setIsListening(false);
            };
            recognition.onerror = () => {
                setIsListening(false);
            };
            recognitionRef.current = recognition;
        }
    }, []);
    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('お使いのブラウザは音声入力に対応していません。');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
        else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            }
            catch (err) {
                console.error(err);
            }
        }
    };
    // Text-To-Speech function
    const speakText = (text) => {
        if (!window.speechSynthesis)
            return;
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#`_>-]/g, '').slice(0, 300);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ja-JP';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
    };
    // Auto speak response if enabled
    useEffect(() => {
        if (ttsEnabled && messages.length > 0 && !isStreaming) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
                speakText(lastMsg.content);
            }
        }
    }, [messages, isStreaming, ttsEnabled]);
    const handleSubmit = (e) => {
        if (e)
            e.preventDefault();
        if (!inputText.trim() || isStreaming)
            return;
        onSendMessage(inputText.trim(), selectedWorkModeId);
        setInputText('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };
    const handleTextareaChange = (e) => {
        setInputText(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
    };
    const handleCopy = (content, id) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };
    // Extract memory from current chat
    const handleExtractMemory = async () => {
        if (messages.length < 2) {
            setMemoryNotification('記憶を抽出するにはもう少し会話を重ねてください。');
            setTimeout(() => setMemoryNotification(null), 3000);
            return;
        }
        setIsExtractingMemory(true);
        setMemoryNotification(null);
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch('/api/extract-memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    messages,
                    currentNotes: userProfile.userNotes,
                }),
            });
            const data = await res.json();
            if (data.usage && onRecordUsage) {
                onRecordUsage({
                    endpoint: 'extract-memory',
                    endpointName: '記憶抽出',
                    model: data.model || 'gemini-3.8-flash',
                    usage: data.usage,
                });
            }
            if (data.newNotes && data.newNotes.trim()) {
                const updatedNotes = userProfile.userNotes
                    ? `${userProfile.userNotes}\n${data.newNotes.trim()}`
                    : data.newNotes.trim();
                onUpdateUserProfile({
                    ...userProfile,
                    userNotes: updatedNotes,
                });
                setMemoryNotification('✨ 新しい記憶をあなたのプロファイルに追加しました！');
            }
            else {
                setMemoryNotification('直近の会話から新しい記憶すべき情報は検出されませんでした。');
            }
        }
        catch (err) {
            setMemoryNotification('記憶抽出に失敗しました。');
        }
        finally {
            setIsExtractingMemory(false);
            setTimeout(() => setMemoryNotification(null), 4000);
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-[calc(100vh-180px)] min-h-[420px] bg-[#f8fafc] rounded-2xl border border-slate-200 shadow-sm overflow-hidden", children: [_jsxs("div", { className: "border-b border-slate-200 bg-white px-4 py-2", children: [_jsxs("div", { className: "max-w-4xl mx-auto flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: `w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-xl shadow-sm text-white shrink-0`, children: character.avatarEmoji || '🤖' }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h2", { className: "text-base font-bold text-slate-900 tracking-tight truncate", children: selectedWorkModeId === 'president' ? character.name : selectedWorkMode.name }), _jsx("span", { className: "text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200", children: selectedWorkModeId === 'president' ? character.role : selectedWorkMode.label }), selectedWorkModeId === 'president' && character.speechStyle && (_jsxs("span", { className: "hidden sm:inline-block text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 truncate max-w-[200px]", children: ["\u53E3\u7656: ", character.speechStyle] }))] }), _jsx("p", { className: "text-xs text-slate-500 truncate", children: selectedWorkModeId === 'president' ? character.tagline || character.personality : selectedWorkMode.description })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 shrink-0", children: [_jsxs("button", { type: "button", onClick: handleExtractMemory, disabled: isExtractingMemory, title: "\u4F1A\u8A71\u304B\u3089\u3042\u306A\u305F\u306E\u60C5\u5831\u3092\u8A18\u61B6", className: "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-all cursor-pointer disabled:opacity-50", children: [_jsx(BrainCircuit, { className: `w-3.5 h-3.5 ${isExtractingMemory ? 'animate-spin' : ''}` }), _jsx("span", { className: "hidden md:inline", children: "\u8A18\u61B6\u3092\u66F4\u65B0" })] }), _jsx("button", { type: "button", onClick: () => setTtsEnabled(!ttsEnabled), title: ttsEnabled ? '音声読み上げON (クリックでOFF)' : '音声読み上げOFF (クリックでON)', className: `p-2 rounded-xl border transition-all cursor-pointer ${ttsEnabled
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'text-slate-500 hover:text-slate-700 bg-slate-100 border-slate-200'}`, children: ttsEnabled ? _jsx(Volume2, { className: "w-4 h-4" }) : _jsx(VolumeX, { className: "w-4 h-4" }) }), _jsx("button", { type: "button", onClick: () => {
                                            if (window.confirm('このキャラクターとの対話履歴をリセットしますか？')) {
                                                onClearMessages();
                                            }
                                        }, title: "\u5C65\u6B74\u3092\u30AF\u30EA\u30A2", className: "p-2 rounded-xl text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }), _jsx("div", { className: "mt-2 pt-2 border-t border-slate-100", children: _jsxs("div", { className: "max-w-4xl mx-auto flex flex-wrap items-center gap-2", children: [_jsx("label", { htmlFor: "ai-work-mode", className: "shrink-0 text-xs font-bold text-purple-700", children: "\u62C5\u5F53AI" }), _jsxs("select", { id: "ai-work-mode", value: selectedWorkModeId === 'president' && character.id === 'preset-ceo' ? 'mode:president' : selectedWorkModeId === 'president' ? `character:${character.id}` : `mode:${selectedWorkModeId}`, onChange: (event) => {
                                        const [kind, id] = event.target.value.split(':', 2);
                                        if (kind === 'mode' && id === 'president')
                                            onSelectCharacter('preset-ceo');
                                        else if (kind === 'mode')
                                            onSelectWorkMode(id);
                                        else if (kind === 'character')
                                            onSelectCharacter(id);
                                    }, disabled: isStreaming, className: "max-w-full sm:max-w-72 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-900 focus:outline-none focus:border-purple-500 disabled:opacity-50 shadow-2xs", children: [_jsx("optgroup", { label: "\u5C02\u9580\u306E\u5F79\u5272", children: AI_WORK_MODES.map((baseMode) => {
                                                const mode = resolveWorkMode(baseMode, roleOverrides);
                                                return _jsxs("option", { value: `mode:${mode.id}`, children: [mode.avatarEmoji, " ", mode.name, "\uFF5C", mode.label] }, mode.id);
                                            }) }), _jsx("optgroup", { label: "\u767B\u9332\u6E08\u307FAI", children: characters.filter((registeredCharacter) => registeredCharacter.id !== 'preset-ceo').map((registeredCharacter) => (_jsxs("option", { value: `character:${registeredCharacter.id}`, children: [registeredCharacter.avatarEmoji, " ", registeredCharacter.name, "\uFF5C", registeredCharacter.role] }, registeredCharacter.id))) })] }), _jsx("p", { className: "min-w-0 flex-1 text-[11px] text-slate-500", children: selectedWorkMode.description })] }) }), memoryNotification && (_jsxs("div", { className: "max-w-4xl mx-auto mt-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between animate-in fade-in", children: [_jsx("span", { children: memoryNotification }), _jsx("button", { type: "button", onClick: () => setMemoryNotification(null), className: "text-purple-600 hover:text-purple-900 font-bold ml-2 cursor-pointer", children: "\u2715" })] }))] }), _jsx("div", { className: "flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 bg-[#f8fafc]", children: _jsxs("div", { className: "max-w-4xl mx-auto space-y-4", children: [messages.length === 0 && (_jsxs("div", { className: "space-y-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300", children: [_jsxs("div", { className: "p-6 rounded-2xl bg-white border border-slate-200 text-center shadow-sm", children: [_jsx("div", { className: "w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-3xl shadow-sm mx-auto mb-4 text-white", children: selectedWorkModeId === 'president' ? character.avatarEmoji || '🤖' : selectedWorkMode.avatarEmoji }), _jsx("h3", { className: "text-xl font-bold text-slate-900 mb-1", children: selectedWorkModeId === 'president' ? character.name : selectedWorkMode.name }), _jsx("p", { className: "text-sm font-semibold text-purple-700 mb-2", children: selectedWorkModeId === 'president' ? character.role : selectedWorkMode.label }), _jsx("p", { className: "text-xs text-slate-500 max-w-md mx-auto leading-relaxed mb-4", children: selectedWorkModeId === 'president' ? character.tagline || character.personality : selectedWorkMode.description }), selectedWorkModeId === 'president' && _jsx(_Fragment, { children: _jsx("div", { className: "flex flex-wrap items-center justify-center gap-1.5 max-w-lg mx-auto mb-6", children: userProfile.userName && (_jsxs("span", { className: "text-[11px] px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold", children: ["\u3042\u306A\u305F\u306E\u767B\u9332\u540D: ", userProfile.userName] })) }) }), _jsxs("div", { className: "p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 text-left max-w-xl mx-auto shadow-2xs", children: [_jsxs("div", { className: "text-xs font-semibold text-purple-800 mb-1 flex items-center gap-1", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5 text-purple-600" }), _jsxs("span", { children: [selectedWorkModeId === 'president' ? character.name : selectedWorkMode.name, " \u304B\u3089\u306E\u30E1\u30C3\u30BB\u30FC\u30B8"] })] }), _jsx("p", { className: "text-sm text-slate-800 leading-relaxed", children: selectedWorkModeId === 'president' ? character.greetingMessage || 'こんにちは！今日もよろしくお願いします。何でも話してくださいね。' : selectedWorkMode.description })] })] }), character.suggestedTopics && character.suggestedTopics.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-xs font-bold text-slate-500 uppercase tracking-wider text-center", children: "\u8A71\u3057\u304B\u3051\u308B\u304D\u3063\u304B\u3051\u30FB\u304A\u3059\u3059\u3081\u306E\u6307\u793A" }), _jsx("div", { className: "flex flex-wrap items-center justify-center gap-2", children: character.suggestedTopics.map((topic, i) => (_jsxs("button", { type: "button", onClick: () => onSendMessage(topic, selectedWorkModeId), className: "px-3.5 py-2 rounded-xl text-xs font-medium bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-200 shadow-2xs transition-all cursor-pointer text-left", children: ["\uD83D\uDCAC ", topic] }, i))) })] }))] })), messages.map((msg, index) => {
                            const isUser = msg.role === 'user';
                            return (_jsxs("div", { className: `flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`, children: [!isUser && (_jsx("div", { className: "w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-lg text-white shadow-sm shrink-0 mt-1", children: selectedWorkModeId === 'president' ? character.avatarEmoji || '🤖' : selectedWorkMode.avatarEmoji })), _jsxs("div", { className: `max-w-[88%] sm:max-w-[78%] group relative`, children: [_jsx("div", { className: `p-3.5 rounded-xl shadow-2xs ${isUser
                                                    ? 'bg-purple-600 text-white rounded-tr-xs'
                                                    : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'}`, children: isUser ? (_jsx("p", { className: "text-sm md:text-[15px] whitespace-pre-wrap leading-relaxed", children: msg.content })) : (_jsx(ChatMessageContent, { content: msg.content, onOpenPlanProposal: onOpenPlanProposal })) }), !isUser && msg.modelLabel && (_jsxs("p", { className: "mt-1 pl-1 text-[10px] text-slate-400", children: ["\u4F7F\u7528\u30E2\u30C7\u30EB: ", msg.modelLabel] })), !isUser && (_jsxs("div", { className: "flex items-center gap-2 mt-1.5 pl-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("button", { type: "button", onClick: () => handleCopy(msg.content, msg.id), className: "text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer", children: copiedId === msg.id ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3 h-3 text-emerald-600" }), _jsx("span", { className: "text-emerald-600 font-semibold", children: "\u30B3\u30D4\u30FC\u6E08\u307F" })] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3 h-3" }), _jsx("span", { children: "\u30B3\u30D4\u30FC" })] })) }), _jsxs("button", { type: "button", onClick: () => speakText(msg.content), className: "text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer", children: [_jsx(Volume2, { className: "w-3 h-3" }), _jsx("span", { children: "\u8AAD\u307F\u4E0A\u3052" })] })] }))] })] }, msg.id || index));
                        }), isStreaming && (_jsxs("div", { className: "flex items-center gap-3 animate-in fade-in", children: [_jsx("div", { className: "w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-lg text-white shadow-sm shrink-0", children: character.avatarEmoji || '🤖' }), _jsxs("div", { className: "px-4 py-3 rounded-2xl bg-white border border-slate-200 flex items-center gap-1.5 shadow-sm", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-purple-600 animate-bounce", style: { animationDelay: '0ms' } }), _jsx("span", { className: "w-2 h-2 rounded-full bg-purple-600 animate-bounce", style: { animationDelay: '150ms' } }), _jsx("span", { className: "w-2 h-2 rounded-full bg-purple-600 animate-bounce", style: { animationDelay: '300ms' } }), _jsxs("span", { className: "text-xs text-slate-500 ml-1.5 font-medium", children: [character.name, " \u304C\u601D\u8003\u4E2D\u2026"] })] })] })), _jsx("div", { ref: messagesEndRef })] }) }), _jsx("div", { className: "border-t border-slate-200 bg-white p-2.5 sm:p-3", children: _jsxs("div", { className: "max-w-4xl mx-auto space-y-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar", children: [_jsx("span", { className: "text-slate-500 shrink-0 font-semibold", children: "\u30AF\u30A4\u30C3\u30AF\u6307\u793A:" }), _jsx("button", { type: "button", onClick: () => setInputText('次の経営目標を達成するためのプロジェクト概要と具体的タスク一覧（目的、優先度、完了条件、担当案）を計画立案してください：\n「新規顧客獲得のためのプロモーション施策」'), className: "px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shrink-0 transition-colors cursor-pointer font-medium", children: "\u26A1 \u76EE\u6A19\u306E\u30BF\u30B9\u30AF\u5206\u89E3\u3092\u4F9D\u983C" }), _jsx("button", { type: "button", onClick: () => setInputText('現在のプロジェクト状況を踏まえ、今週最優先で着手すべきタスクとその理由を教えてください。'), className: "px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shrink-0 transition-colors cursor-pointer font-medium", children: "\uD83D\uDCCA \u4ECA\u9031\u306E\u512A\u5148\u30BF\u30B9\u30AF\u78BA\u8A8D" }), _jsx("button", { type: "button", onClick: () => setInputText('開発エージェントや各専門AIに割り当てるべき開発要件の定義をサポートしてください。'), className: "px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shrink-0 transition-colors cursor-pointer font-medium", children: "\u2699\uFE0F \u958B\u767A\u30BF\u30B9\u30AF\u306E\u5207\u308A\u51FA\u3057\u76F8\u8AC7" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "relative flex items-end gap-2 bg-white rounded-2xl border border-slate-200 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all p-1.5 shadow-2xs", children: [_jsx("textarea", { ref: textareaRef, rows: 1, value: inputText, onChange: handleTextareaChange, onKeyDown: handleKeyDown, placeholder: `${selectedWorkMode.name} に指示・相談を入力してください...`, disabled: isStreaming, className: "w-full resize-none bg-transparent px-3 py-2 text-sm md:text-[15px] text-slate-900 placeholder-slate-400 focus:outline-none min-h-[44px] max-h-[180px] leading-relaxed disabled:opacity-50" }), _jsxs("div", { className: "flex items-center gap-1 shrink-0 pb-1 pr-1", children: [_jsx("button", { type: "button", onClick: toggleListening, title: isListening ? '音声入力を停止' : '音声で入力', className: `p-2 rounded-xl transition-all cursor-pointer ${isListening
                                                ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse'
                                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`, children: isListening ? _jsx(MicOff, { className: "w-4 h-4" }) : _jsx(Mic, { className: "w-4 h-4" }) }), isStreaming ? (_jsx("button", { type: "button", onClick: onStopStreaming, title: "\u751F\u6210\u3092\u4E2D\u65AD", className: "p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-sm cursor-pointer", children: _jsx(Square, { className: "w-4 h-4 fill-white" }) })) : (_jsx("button", { type: "submit", disabled: !inputText.trim(), title: "\u9001\u4FE1", className: `p-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer ${inputText.trim()
                                                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`, children: _jsx(Send, { className: "w-4 h-4" }) }))] })] })] }) })] }));
};
