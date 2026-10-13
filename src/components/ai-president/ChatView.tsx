import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Square,
  Volume2,
  VolumeX,
  Trash2,
  Sliders,
  Sparkles,
  Mic,
  MicOff,
  Copy,
  Check,
  BrainCircuit,
  CornerDownLeft,
  RefreshCw,
  ClipboardList,
  Target,
} from 'lucide-react';
import { CharacterConfig, ChatMessage, UserProfile, ProposedPlan, ApiUsageData } from '../types';
import { ChatMessageContent } from './ChatMessageContent';
import { getColorScheme } from '../utils/theme';

interface ChatViewProps {
  character: CharacterConfig;
  userProfile: UserProfile;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearMessages: () => void;
  onEditCharacter: () => void;
  onUpdateUserProfile: (profile: UserProfile) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  onOpenPlanProposal?: (plan: ProposedPlan) => void;
  onRecordUsage?: (params: {
    endpoint: 'chat' | 'generate-character' | 'extract-memory' | 'refine-prompt';
    endpointName: string;
    model?: string;
    usage: ApiUsageData;
  }) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  character,
  userProfile,
  messages,
  onSendMessage,
  onClearMessages,
  onEditCharacter,
  onUpdateUserProfile,
  isStreaming,
  onStopStreaming,
  onOpenPlanProposal,
  onRecordUsage,
}) => {
  const [inputText, setInputText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExtractingMemory, setIsExtractingMemory] = useState(false);
  const [memoryNotification, setMemoryNotification] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const scheme = getColorScheme(character.avatarColor);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Speech Recognition (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
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
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Text-To-Speech function
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const handleCopy = (content: string, id: string) => {
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
      const res = await fetch('/api/extract-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      } else {
        setMemoryNotification('直近の会話から新しい記憶すべき情報は検出されませんでした。');
      }
    } catch (err) {
      setMemoryNotification('記憶抽出に失敗しました。');
    } finally {
      setIsExtractingMemory(false);
      setTimeout(() => setMemoryNotification(null), 4000);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] bg-slate-950">
      {/* Character Profile Top Banner */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-2xl shadow-lg ${scheme.glow} border border-white/10 shrink-0`}
            >
              {character.avatarEmoji || '🤖'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight truncate">{character.name}</h2>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${scheme.badgeBg} ${scheme.badgeText} border ${scheme.border}`}
                >
                  {character.role}
                </span>
                {character.speechStyle && (
                  <span className="hidden sm:inline-block text-[11px] text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/60 truncate max-w-[200px]">
                    口癖: {character.speechStyle}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{character.tagline || character.personality}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleExtractMemory}
              disabled={isExtractingMemory}
              title="会話からあなたの情報を記憶"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <BrainCircuit className={`w-3.5 h-3.5 ${isExtractingMemory ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">記憶を更新</span>
            </button>

            <button
              type="button"
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? '音声読み上げON (クリックでOFF)' : '音声読み上げOFF (クリックでON)'}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                ttsEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60 border-slate-700/60'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onEditCharacter}
              title="このAIを編集・調整"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('このキャラクターとの対話履歴をリセットしますか？')) {
                  onClearMessages();
                }
              }}
              title="履歴をクリア"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Memory Notification Banner */}
        {memoryNotification && (
          <div className="max-w-4xl mx-auto mt-2 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between animate-in fade-in">
            <span>{memoryNotification}</span>
            <button
              type="button"
              onClick={() => setMemoryNotification(null)}
              className="text-indigo-400 hover:text-white font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Welcome Card & Greeting */}
          {messages.length === 0 && (
            <div className="space-y-6 py-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 text-center shadow-xl">
                <div
                  className={`w-16 h-16 rounded-3xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-4xl shadow-xl ${scheme.glow} mx-auto mb-4 border border-white/20`}
                >
                  {character.avatarEmoji || '🤖'}
                </div>
                <h3 className="text-xl font-extrabold text-white mb-1">{character.name}</h3>
                <p className="text-sm font-medium text-indigo-300 mb-2">{character.role}</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed mb-4">
                  {character.tagline || character.personality}
                </p>

                {/* Character Traits Pills */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-lg mx-auto mb-6">
                  {character.firstPerson && (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      一人称: {character.firstPerson}
                    </span>
                  )}
                  {character.secondPerson && (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      あなたへの呼び名: {character.secondPerson}
                    </span>
                  )}
                  {character.tone && (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      口調: {character.tone}
                    </span>
                  )}
                  {userProfile.userName && (
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                      あなたの登録名: {userProfile.userName}
                    </span>
                  )}
                </div>

                {/* Greeting Speech Bubble */}
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/70 text-left max-w-xl mx-auto shadow-md">
                  <div className="text-xs font-semibold text-indigo-400 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{character.name} からのメッセージ</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {character.greetingMessage || 'こんにちは！今日もよろしくお願いします。何でも話してくださいね。'}
                  </p>
                </div>
              </div>

              {/* Suggested conversation starters */}
              {character.suggestedTopics && character.suggestedTopics.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    話しかけるきっかけ・おすすめの指示
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {character.suggestedTopics.map((topic, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSendMessage(topic)}
                        className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-indigo-500/40 shadow-sm transition-all cursor-pointer text-left"
                      >
                        💬 {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages Loop */}
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
              >
                {!isUser && (
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-lg shadow-md shrink-0 border border-white/10 mt-1`}
                  >
                    {character.avatarEmoji || '🤖'}
                  </div>
                )}

                <div className={`max-w-[88%] sm:max-w-[78%] group relative`}>
                  <div
                    className={`p-4 rounded-2xl shadow-md ${
                      isUser
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs'
                        : 'bg-slate-900 border border-slate-800/90 text-slate-200 rounded-tl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm md:text-[15px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <ChatMessageContent
                        content={msg.content}
                        onOpenPlanProposal={onOpenPlanProposal}
                      />
                    )}
                  </div>

                  {/* Actions under bubble */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-1.5 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">コピー済み</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>コピー</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => speakText(msg.content)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>読み上げ</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Streaming Typing Indicator */}
          {isStreaming && (
            <div className="flex items-center gap-3 animate-in fade-in">
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-lg shadow-md shrink-0 border border-white/10`}
              >
                {character.avatarEmoji || '🤖'}
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs text-slate-400 ml-1.5 font-medium">{character.name} が思考中…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Box Bottom Bar */}
      <div className="border-t border-slate-800/80 bg-slate-900/90 p-3 sm:p-4 backdrop-blur-md">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Quick AI President Action Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            <span className="text-slate-400 shrink-0 font-semibold">クイック指示:</span>
            <button
              type="button"
              onClick={() =>
                setInputText(
                  '次の経営目標を達成するためのプロジェクト概要と具体的タスク一覧（目的、優先度、完了条件、担当案）を計画立案してください：\n「新規顧客獲得のためのプロモーション施策」'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 shrink-0 transition-colors cursor-pointer"
            >
              ⚡ 目標のタスク分解を依頼
            </button>
            <button
              type="button"
              onClick={() =>
                setInputText(
                  '現在のプロジェクト状況を踏まえ、今週最優先で着手すべきタスクとその理由を教えてください。'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 shrink-0 transition-colors cursor-pointer"
            >
              📊 今週の優先タスク確認
            </button>
            <button
              type="button"
              onClick={() =>
                setInputText(
                  '開発エージェントや各専門AIに割り当てるべき開発要件の定義をサポートしてください。'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 shrink-0 transition-colors cursor-pointer"
            >
              ⚙️ 開発タスクの切り出し相談
            </button>
          </div>

          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-slate-950 rounded-2xl border border-slate-800 focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all p-1.5 shadow-lg">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={`${character.name} に経営指示・タスク相談を入力してください...`}
              disabled={isStreaming}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm md:text-[15px] text-slate-100 placeholder-slate-500 focus:outline-none min-h-[44px] max-h-[180px] leading-relaxed disabled:opacity-50"
            />

            <div className="flex items-center gap-1 shrink-0 pb-1 pr-1">
              {/* Mic Speech Recognition button */}
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? '音声入力を停止' : '音声で入力'}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Stop Streaming or Send button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  title="生成を中断"
                  className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  title="送信"
                  className={`p-2.5 rounded-xl font-bold transition-all shadow-md cursor-pointer ${
                    inputText.trim()
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
