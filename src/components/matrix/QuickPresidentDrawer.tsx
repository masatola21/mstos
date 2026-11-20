import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  Loader2, 
  ArrowRight, 
  Target, 
  Layers, 
  CheckCircle2, 
  Maximize2,
  Minimize2,
  Mic,
  MicOff
} from 'lucide-react';
import { ApiUsageData, CharacterConfig, ChatMessage, UserProfile } from '../../types/ai-president';
import { AI_WORK_MODES, AIWorkModeId } from '../../data/aiWorkModes';
import { getAuthHeaders } from '../../lib/supabaseClient';
import { getPageAssistantProfile, PageAssistantProfile } from '../../utils/pageAssistantProfiles';
export { getPageAssistantProfile, type PageAssistantProfile };

type RequestMode = 'consult' | 'action_plan' | 'external_prompt';

const getAvailableAssistantModes = (pageId: string) => {
  const defaultModeId = getPageAssistantProfile(pageId).mode;
  return AI_WORK_MODES.filter((mode) => mode.id === defaultModeId || mode.id === 'president');
};

interface QuickPresidentDrawerProps {
  isOpen: boolean;
  pageId: string;
  onClose: () => void;
  character: CharacterConfig;
  userProfile: UserProfile;
  onOpenPlanProposal?: (plan: any) => void;
  onRecordUsage?: (params: { endpoint: 'chat'; endpointName: string; model?: string; usage: ApiUsageData }) => void;
}

export const QuickPresidentDrawer: React.FC<QuickPresidentDrawerProps> = ({
  isOpen,
  pageId,
  onClose,
  character,
  userProfile,
  onOpenPlanProposal,
  onRecordUsage,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'quick-welcome',
      role: 'assistant',
      content: `お疲れ様です、オーナー。AI社長の${character.name}です。\n業務画面を見ながらのご相談や、目標・課題のタスク分解、新商品のアイデア出しなど、いつでもこちらからご指示ください。`,
      timestamp: Date.now(),
    },
  ]);
  const pageProfile = getPageAssistantProfile(pageId);
  const [selectedWorkModeId, setSelectedWorkModeId] = useState<AIWorkModeId>(pageProfile.mode);
  const [requestMode, setRequestMode] = useState<RequestMode>('consult');
  const selectedWorkMode = AI_WORK_MODES.find((mode) => mode.id === selectedWorkModeId) ?? AI_WORK_MODES[0];
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result?.[0]?.transcript || '')
        .join('');
      const base = baseInputRef.current;
      setInput(base ? `${base}${transcript}` : transcript);
      setVoiceError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      const code = String(event?.error || '');
      if (code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setVoiceError('マイクの使用が許可されていません。ブラウザの権限設定をご確認ください。');
      } else if (code === 'no-speech') {
        setVoiceError('音声を検出できませんでした。マイクに近づいて再度お試しください。');
      } else if (code === 'audio-capture') {
        setVoiceError('マイクが見つかりません。機器の接続をご確認ください。');
      } else if (code === 'network') {
        setVoiceError('音声認識の通信エラーが発生しました。');
      } else {
        setVoiceError('音声認識を完了できませんでした。もう一度お試しください。');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // ignore cleanup error
      }
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore if already stopped
      }
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    setVoiceError(null);
    if (!recognitionRef.current) {
      setVoiceError('お使いのブラウザは音声入力に対応していません（Chrome・Edge・Safari等でご利用ください）。');
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }
    try {
      baseInputRef.current = input;
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setVoiceError('音声入力を開始できませんでした。少し待ってから再度お試しください。');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopListening();
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages]);

  useEffect(() => {
    stopListening();
    const profile = getPageAssistantProfile(pageId);
    setSelectedWorkModeId(profile.mode);
    setRequestMode('consult');
    setVoiceError(null);
    setMessages([{
      id: 'page-welcome-' + pageId,
      role: 'assistant',
      content: profile.label + 'の画面を開いています。担当AIを選んで相談できます。画面上の顧客・案件データは自動送信しません。必要な情報をメッセージに含めてください。',
      timestamp: Date.now(),
    }]);
  }, [pageId]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    stopListening();
    setVoiceError(null);
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) {
      setInput('');
      baseInputRef.current = '';
    }
    setIsLoading(true);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          character,
          userProfile,
          workModeId: selectedWorkModeId,
          roleOverride: requestMode === 'consult' ? undefined : { extraInstruction: requestMode === 'external_prompt' ? '外部のAI・開発者・業者へそのまま渡せる日本語の依頼プロンプトを作成してください。背景、目的、作業範囲、守る制約、完了条件を明記し、不明な事実は捏造せず確認事項として残してください。プロンプト本文を独立してコピーできる形で提示してください。' : 'この画面で解決したい依頼について、実行可能な操作と必要な確認を分けた具体的な実行案を作成してください。データ変更・送信・削除は必ず事前確認を求め、接続されていない機能を実行できると主張せず、実行したふりをしないでください。' },
          knowledgeContext: '現在開いているページ: ' + pageProfile.label + '（画面ID: ' + pageId + '）。依頼モード: ' + requestMode + '。ページ固有の業務役割を選んで回答してください。実データは自動共有されていないため、未提示の情報を推測しないでください。',
        }),
      });

      const data = await response.json();
      if (data.usage) {
        onRecordUsage?.({
          endpoint: 'chat',
          endpointName: 'AI社長ページ相談',
          model: data.model,
          usage: data.usage,
        });
      }
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.text || '申し訳ございません。応答を取得できませんでした。',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Check if plan block is present
      if (data.plan && onOpenPlanProposal) {
        onOpenPlanProposal(data.plan);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          role: 'assistant',
          content: '通信エラーが発生しました。時間を置いて再度お試しください。',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    '今週の全社最優先タスクを3つに整理して',
    '新商品の企画・タスク分解をしてほしい',
    '商談成約後のオンボーディング体制を作りたい',
    '未入金請求のフォロー方針を教えて',
  ];

  return (
    <div className={isExpanded
      ? "fixed inset-4 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col"
      : "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"}>
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white text-lg shadow-sm">
            {selectedWorkMode.avatarEmoji || character.avatarEmoji || '👔'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">{selectedWorkMode.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                クイック相談
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{selectedWorkMode.label}担当</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={isExpanded ? "相談パネルを元の大きさに戻す" : "相談パネルを拡大"}
            aria-label={isExpanded ? "相談パネルを元の大きさに戻す" : "相談パネルを拡大"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              stopListening();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="クイック相談を閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">依頼の種類</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button type="button" onClick={() => setRequestMode('consult')} className={`rounded-xl px-2 py-1.5 text-[10px] font-semibold transition cursor-pointer ${requestMode === 'consult' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>相談</button>
            <button type="button" onClick={() => setRequestMode('action_plan')} className={`rounded-xl px-2 py-1.5 text-[10px] font-semibold transition cursor-pointer ${requestMode === 'action_plan' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>操作の実行案</button>
            <button type="button" onClick={() => setRequestMode('external_prompt')} className={`rounded-xl px-2 py-1.5 text-[10px] font-semibold transition cursor-pointer ${requestMode === 'external_prompt' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>外部依頼文</button>
          </div>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
          <span>相談するAI</span>
          <select value={selectedWorkModeId} onChange={(event) => setSelectedWorkModeId(event.target.value as AIWorkModeId)} className="max-w-[220px] rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-2xs">
            {getAvailableAssistantModes(pageId).map((mode) => <option key={mode.id} value={mode.id}>{mode.id === 'marketing_execution' ? 'マーケティングAI' : mode.label}</option>)}
          </select>
        </label>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">現在の画面に合わせたAIを初期選択しています。実行案も操作内容を提案する段階で、この窓から直接保存・送信はしません。画面データは自動送信されないため、必要な情報を入力してください。外部依頼文はコピーして他のAIや依頼先に渡せます。</p>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-xs shadow-sm'
                  : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs shadow-2xs'
              }`}
            >
              {m.content}
            </div>
            <span className="text-[9px] text-slate-400 mt-1 px-1">
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 shadow-2xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
            <span>AI社長が思考中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 border-t border-slate-200 bg-white flex gap-1.5 overflow-x-auto scrollbar-none">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors cursor-pointer shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-200 bg-white space-y-2">
        {isListening && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>音声入力中… 話しかけてください</span>
            </div>
            <button
              type="button"
              onClick={stopListening}
              className="text-[10px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
            >
              停止
            </button>
          </div>
        )}
        {voiceError && (
          <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="text-amber-600 hover:text-amber-900 p-0.5 cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-1.5"
        >
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={speechSupported ? 'AI社長に指示・相談を入力（マイクで音声入力も可能）...' : 'AI社長に指示・相談を入力...'}
            disabled={isLoading}
            className="flex-1 resize-none bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xs leading-relaxed max-h-28 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={toggleListening}
            disabled={isLoading}
            title={isListening ? '音声入力を停止' : '音声で入力'}
            aria-label={isListening ? '音声入力を停止' : '音声で入力'}
            className={`p-2 rounded-xl border transition-colors shadow-2xs cursor-pointer disabled:opacity-40 ${
              isListening
                ? 'bg-rose-50 text-rose-600 border-rose-300 animate-pulse'
                : 'bg-white text-slate-500 border-slate-200 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-200'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            title="送信"
            aria-label="送信"
            className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

