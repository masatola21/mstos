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
  Minimize2 
} from 'lucide-react';
import { ApiUsageData, CharacterConfig, ChatMessage, UserProfile } from '../../types/ai-president';
import { AI_WORK_MODES, AIWorkModeId } from '../../data/aiWorkModes';

type PageAssistantProfile = { label: string; mode: AIWorkModeId };
type RequestMode = 'consult' | 'action_plan' | 'external_prompt';
export const getPageAssistantProfile = (pageId: string): PageAssistantProfile => {
  if (pageId === 'marketing_automation' || pageId === 'ai_acquisition') return { label: 'マーケティング', mode: 'marketing_execution' };
  if (pageId === 'mst_diagnoses') return { label: '診断・提案', mode: 'diagnosis' };
  if (pageId === 'product_hub' || pageId === 'category_hub') return { label: '商品設計', mode: 'new_product' };
  if (pageId === 'communication_send') return { label: '配信・顧客フォロー', mode: 'marketing_execution' };
  if (['invoices', 'contracts', 'customer_invoices', 'customer_contracts'].includes(pageId)) return { label: '契約・請求管理', mode: 'billing_operations' };
  if (pageId === 'customer_operations' || ['contacts', 'companies', 'leads', 'deals', 'customers', 'prospects', 'deal_invitations'].includes(pageId)) return { label: '営業・顧客管理', mode: 'sales_operations' };
  if (pageId === 'ai_projects' || pageId === 'ai_tasks' || pageId === 'automations') return { label: 'プロジェクト・業務改善', mode: 'operations_management' };
  return { label: '経営OS全体', mode: 'president' };
};

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  useEffect(() => {
    const profile = getPageAssistantProfile(pageId);
    setSelectedWorkModeId(profile.mode);
    setRequestMode('consult');
    setMessages([{
      id: 'page-welcome-' + pageId,
      role: 'assistant',
      content: profile.label + 'の画面を開いています。担当AIを選んで相談できます。画面上の顧客・案件データは自動送信しません。必要な情報をメッセージに含めてください。',
      timestamp: Date.now(),
    }]);
  }, [pageId]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      ? "fixed inset-4 z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
      : "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"}>
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white text-lg shadow-lg shadow-indigo-500/20">
            {selectedWorkMode.avatarEmoji || character.avatarEmoji || '👔'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm">{selectedWorkMode.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                クイック相談
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{selectedWorkMode.label}担当</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isExpanded ? "相談パネルを元の大きさに戻す" : "相談パネルを拡大"}
            aria-label={isExpanded ? "相談パネルを元の大きさに戻す" : "相談パネルを拡大"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
        <div>
          <p className="text-xs text-slate-300">依頼の種類</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button type="button" onClick={() => setRequestMode('consult')} className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold ${requestMode === 'consult' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>相談</button>
            <button type="button" onClick={() => setRequestMode('action_plan')} className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold ${requestMode === 'action_plan' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>操作の実行案</button>
            <button type="button" onClick={() => setRequestMode('external_prompt')} className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold ${requestMode === 'external_prompt' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>外部依頼文</button>
          </div>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-300">
          <span>相談するAI</span>
          <select value={selectedWorkModeId} onChange={(event) => setSelectedWorkModeId(event.target.value as AIWorkModeId)} className="max-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
            {getAvailableAssistantModes(pageId).map((mode) => <option key={mode.id} value={mode.id}>{mode.id === 'marketing_execution' ? 'マーケティングAI' : mode.label}</option>)}
          </select>
        </label>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">現在の画面に合わせたAIを初期選択しています。実行案も操作内容を提案する段階で、この窓から直接保存・送信はしません。画面データは自動送信されないため、必要な情報を入力してください。外部依頼文はコピーして他のAIや依頼先に渡せます。</p>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20'
                  : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-none shadow-md'
              }`}
            >
              {m.content}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 px-1">
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>AI社長が思考中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/60 flex gap-1.5 overflow-x-auto scrollbar-none">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-800 bg-slate-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="AI社長に指示・相談を入力..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

