import React, { useState } from 'react';
import {
  Sparkles,
  Save,
  Plus,
  Trash2,
  Wand2,
  Check,
  RotateCcw,
  Bot,
  MessageSquare,
  HelpCircle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { CharacterConfig, AvatarColor, UserProfile, ApiUsageData } from '../types';
import { getColorScheme } from '../utils/theme';

interface CharacterEditorProps {
  character: CharacterConfig;
  userProfile: UserProfile;
  onSaveCharacter: (updated: CharacterConfig) => void;
  onDeleteCharacter: (id: string) => void;
  onDuplicateCharacter: (char: CharacterConfig) => void;
  onStartChat: (char: CharacterConfig) => void;
  onRecordUsage?: (params: {
    endpoint: 'chat' | 'generate-character' | 'extract-memory' | 'refine-prompt';
    endpointName: string;
    model?: string;
    usage: ApiUsageData;
  }) => void;
}

const EMOJI_PALETTE = ['🌟', '💼', '⚡', '☕', '🔥', '💡', '🐱', '🌸', '🦾', '🦉', '🎨', '🧪', '🛡️', '🌙', '🍵', '🚀', '🦊', '✨'];
const COLOR_OPTIONS: { id: AvatarColor; label: string; class: string }[] = [
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

export const CharacterEditor: React.FC<CharacterEditorProps> = ({
  character,
  userProfile,
  onSaveCharacter,
  onDeleteCharacter,
  onDuplicateCharacter,
  onStartChat,
  onRecordUsage,
}) => {
  const [formData, setFormData] = useState<CharacterConfig>({ ...character });
  const [activeSubTab, setActiveSubTab] = useState<'magic' | 'manual'>('magic');
  const [aiPromptConcept, setAiPromptConcept] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [ruleInput, setRuleInput] = useState('');
  const [topicInput, setTopicInput] = useState('');

  // AI-assisted Generation
  const handleGenerateAI = async (conceptPrompt: string) => {
    if (!conceptPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: conceptPrompt,
          userProfile,
        }),
      });

      if (!res.ok) throw new Error('生成に失敗しました');
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
        avatarColor: (data.avatarColor as AvatarColor) || prev.avatarColor,
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
    } catch (err: any) {
      alert(err.message || 'AIキャラクターの自動生成に失敗しました。');
    } finally {
      setIsGenerating(false);
    }
  };

  // AI Refine Prompt
  const handleRefinePrompt = async () => {
    setIsRefiningPrompt(true);
    try {
      const res = await fetch('/api/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: formData }),
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
    } catch (err) {
      alert('プロンプトの改善に失敗しました。');
    } finally {
      setIsRefiningPrompt(false);
    }
  };

  const handleSave = () => {
    onSaveCharacter(formData);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  const handleSaveAndChat = () => {
    onSaveCharacter(formData);
    onStartChat(formData);
  };

  const addRule = () => {
    if (!ruleInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      behaviorRules: [...(prev.behaviorRules || []), ruleInput.trim()],
    }));
    setRuleInput('');
  };

  const removeRule = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      behaviorRules: prev.behaviorRules.filter((_, i) => i !== idx),
    }));
  };

  const addTopic = () => {
    if (!topicInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      suggestedTopics: [...(prev.suggestedTopics || []), topicInput.trim()],
    }));
    setTopicInput('');
  };

  const removeTopic = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      suggestedTopics: prev.suggestedTopics.filter((_, i) => i !== idx),
    }));
  };

  const scheme = getColorScheme(formData.avatarColor);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${scheme.bgGradient} flex items-center justify-center text-3xl shadow-lg ${scheme.glow} border border-white/20 shrink-0`}
          >
            {formData.avatarEmoji || '🤖'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white">{formData.name || '名前未設定'}</h1>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${scheme.badgeBg} ${scheme.badgeText}`}>
                {formData.role || '役割未設定'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{formData.tagline || 'あなた好みに自由にカスタマイズしましょう'}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndChat}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            <span>対話を開始</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {saveSuccessNotice && (
        <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>AIキャラクターの設定を保存しました！</span>
        </div>
      )}

      {/* Sub Tabs: AI Auto Generator vs Manual Customization */}
      <div className="flex items-center border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('magic')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'magic'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          <span>⚡ AI魔法の自動生成 (かんたん)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('manual')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'manual'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>🛠️ こだわり詳細設定 (マニュアル)</span>
        </button>
      </div>

      {/* Tab Content: 1. Magic Generator */}
      {activeSubTab === 'magic' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-gradient-to-b from-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-4">
            <div className="flex items-center gap-2 text-indigo-300">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">「こんなAIが欲しい」を一言入力するだけ</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              あなたの作りたいAIのイメージを自由に教えてください。Geminiが名前、性格、口調、口癖、行動ルール、初回の挨拶まで自動で完璧にプロンプトを設計します。
            </p>

            <div className="space-y-3">
              <textarea
                rows={3}
                value={aiPromptConcept}
                onChange={(e) => setAiPromptConcept(e.target.value)}
                placeholder="例: 私のプログラミング学習を見守ってくれる、ツンデレだけど教え方が上手いメンターAIを作って！"
                className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />

              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> クリックしてアイデアを試す:
                </span>
                <button
                  type="button"
                  onClick={() => handleGenerateAI(aiPromptConcept)}
                  disabled={!aiPromptConcept.trim() || isGenerating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                >
                  <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'AIがキャラクターを設計中…' : 'AIキャラクターを自動生成する'}</span>
                </button>
              </div>

              {/* Ideas Pill List */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PROMPT_SUGGESTION_IDEAS.map((idea, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setAiPromptConcept(idea);
                      handleGenerateAI(idea);
                    }}
                    className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer text-left"
                  >
                    ✨ {idea}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: 2. Manual Customization */}
      {activeSubTab === 'manual' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Section 1: Basic Identity */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. 基本プロファイル</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">AIの名前</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例: セラ, アルフレッド, アオイ"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">役割・肩書</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="例: 超理解者・親友AI, 辛口ビジネス参謀"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">キャッチフレーズ</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="例: どんなあなたも丸ごと受け止める生涯の味方"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Emoji & Theme Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">アバター絵文字</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="text"
                    value={formData.avatarEmoji}
                    onChange={(e) => setFormData({ ...formData, avatarEmoji: e.target.value })}
                    className="w-12 text-center text-xl rounded-xl bg-slate-950 border border-slate-800 py-1 text-slate-100 focus:outline-none focus:border-indigo-500 mr-2"
                  />
                  {EMOJI_PALETTE.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatarEmoji: emoji })}
                      className={`text-lg p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer ${
                        formData.avatarEmoji === emoji ? 'bg-indigo-600/30 ring-1 ring-indigo-500' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">テーマカラー</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatarColor: col.id })}
                      className={`w-7 h-7 rounded-full ${col.class} flex items-center justify-center transition-all cursor-pointer ${
                        formData.avatarColor === col.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={col.label}
                    >
                      {formData.avatarColor === col.id && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Personality & Speech Style */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>2. 性格・口調・話し方</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">一人称（AIの自分呼び）</label>
                <input
                  type="text"
                  value={formData.firstPerson}
                  onChange={(e) => setFormData({ ...formData, firstPerson: e.target.value })}
                  placeholder="例: 私, 僕, 俺, うち, アタシ"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">二人称（あなたへの呼び方）</label>
                <input
                  type="text"
                  value={formData.secondPerson}
                  onChange={(e) => setFormData({ ...formData, secondPerson: e.target.value })}
                  placeholder="例: 君, あなた, ◯◯さん, マスター"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">語尾・口癖</label>
                <input
                  type="text"
                  value={formData.speechStyle}
                  onChange={(e) => setFormData({ ...formData, speechStyle: e.target.value })}
                  placeholder="例: 〜だよ！, 〜でござる, 〜っすね"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1">性格・パーソナリティの詳細</label>
                <textarea
                  rows={2}
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                  placeholder="例: とことん温かく親身。好奇心旺盛で、相手の感情に優しく寄り添う。"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1">口調・トーンの説明</label>
                <input
                  type="text"
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  placeholder="例: 親しみやすく自然なタメ口。絵文字も交えてリラックスした雰囲気。"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Rules & Response Style */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>3. 行動ルール & 回答スタイル</span>
            </h3>

            {/* Response length */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">返答の長さ</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'short', title: '簡潔・短め', desc: '1〜3文程度でテンポの良い会話' },
                  { id: 'medium', title: '標準・自然', desc: '長すぎず短すぎず対話的' },
                  { id: 'detailed', title: '詳しく丁寧', desc: '思考の背景や理由を詳しく解説' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, responseLength: item.id as any })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      formData.responseLength === item.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Behavior Rules List */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                絶対遵守すべき行動ルール
              </label>
              <div className="space-y-2 mb-2">
                {formData.behaviorRules?.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                  >
                    <span className="flex-1">{rule}</span>
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={ruleInput}
                  onChange={(e) => setRuleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRule();
                    }
                  }}
                  placeholder="新しいルールを入力（例: 結論から端的に答える、批判せず共感する）"
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={addRule}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  追加
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Greetings & Suggestions */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>4. 初回の挨拶とおすすめの話題</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                最初の挨拶メッセージ (キャラクターらしさの詰まった第一声)
              </label>
              <textarea
                rows={2}
                value={formData.greetingMessage}
                onChange={(e) => setFormData({ ...formData, greetingMessage: e.target.value })}
                placeholder="例: やっほー！今日も来てくれて嬉しいな。今日どんな一日だった？"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Suggested topics */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                おすすめの質問・話題（ボタンで一発送信できる候補）
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.suggestedTopics?.map((topic, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                  >
                    <span>💬 {topic}</span>
                    <button
                      type="button"
                      onClick={() => removeTopic(idx)}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTopic();
                    }
                  }}
                  placeholder="話題を追加（例: 今日のタスクを整理してほしい）"
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={addTopic}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  追加
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Advanced System Instructions & AI Refiner */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>5. プロンプト補足・高度な指示</span>
              </h3>

              <button
                type="button"
                onClick={handleRefinePrompt}
                disabled={isRefiningPrompt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${isRefiningPrompt ? 'animate-spin' : ''}`} />
                <span>{isRefiningPrompt ? 'プロンプト改善中…' : '✨ AIにプロンプト改善を依頼'}</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={formData.customInstructions}
              onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
              placeholder="Geminiのシステム指示に追加したい任意の詳細設定（世界観、秘密の設定、特殊な専門知識など）を入力できます。"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
            />
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDuplicateCharacter(formData)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                このAIを複製する
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`「${formData.name}」を削除してもよろしいですか？`)) {
                    onDeleteCharacter(formData.id);
                  }
                }}
                className="px-3.5 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
              >
                削除
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveAndChat}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <span>設定を保存して対話する</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
