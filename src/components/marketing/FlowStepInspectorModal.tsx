import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Send,
  MessageCircle,
  Mail,
  Tag as TagIcon,
  HelpCircle,
  ExternalLink,
  Save,
  Trash2,
  Copy,
  Smartphone,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import {
  MarketingScenario,
  MarketingTrigger,
  MarketingChannel,
  MarketingLineMessageType,
  MarketingScenarioStatus
} from '../../types/marketing';
import { LineMessagePreview } from '../LineMessagePreview';
import { renderPlaceholders, PLACEHOLDER_SAMPLE_VALUES } from '../../utils/placeholders';
import { UNIFIED_TAG_MASTER, MasterTag, getTagByName } from '../../constants/tagMaster';
import { QUESTIONNAIRE_V1 } from '../../constants/questionnaire';

interface FlowStepInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: MarketingScenario | null;
  onSave: (scenario: MarketingScenario) => void;
  onDelete?: (scenarioId: string) => void;
  allScenarios?: MarketingScenario[];
}

export const FlowStepInspectorModal: React.FC<FlowStepInspectorModalProps> = ({
  isOpen,
  onClose,
  scenario,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !scenario) return null;

  // Active Tab: 'edit' (基本設定・文面編集), 'preview_message' (メッセージプレビュー), 'inspect_form' (連動フォーム・リンク安全点検), 'test_send' (テスト送信)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview_message' | 'inspect_form' | 'test_send'>('edit');

  // Form State
  const [name, setName] = useState(scenario.name);
  const [channel, setChannel] = useState<MarketingChannel>(scenario.channel);
  const [trigger, setTrigger] = useState<MarketingTrigger>(scenario.trigger);
  const [waitMinutes, setWaitMinutes] = useState(scenario.waitMinutes || 0);
  const [waitDaysInput, setWaitDaysInput] = useState(Math.round((scenario.waitMinutes || 0) / 1440));
  const [sendTimeWindow, setSendTimeWindow] = useState(scenario.sendTimeWindow || '09:00-20:00');
  const [automationEnabled, setAutomationEnabled] = useState(scenario.automationEnabled || false);
  const [stopOnBooking, setStopOnBooking] = useState(scenario.stopOnBooking ?? true);
  const [stopOnDeal, setStopOnDeal] = useState(scenario.stopOnDeal ?? true);
  const [consentBasis, setConsentBasis] = useState(scenario.consentBasis || 'LINE友だち追加またはフォーム登録時の配信同意に基づく');

  // Content state
  const [emailSubject, setEmailSubject] = useState(scenario.emailSubject || '');
  const [emailBody, setEmailBody] = useState(scenario.emailBody || '');
  const [messageBody, setMessageBody] = useState(scenario.messageBody || '');
  const [lineMessageType, setLineMessageType] = useState<MarketingLineMessageType>(scenario.lineMessageType || 'flex');
  const [flexTitle, setFlexTitle] = useState(scenario.flexTitle || '');
  const [flexBody, setFlexBody] = useState(scenario.flexBody || '');
  const [flexAltText, setFlexAltText] = useState(scenario.flexAltText || '');
  const [flexButtonLabel, setFlexButtonLabel] = useState(scenario.flexButtonLabel || '');
  const [flexButtonUrl, setFlexButtonUrl] = useState(scenario.flexButtonUrl || '');

  // Tag Management
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [selectedExitTagNames, setSelectedExitTagNames] = useState<string[]>([
    '成約・顧問契約',
    '個別相談予約済み',
    '配信停止・オプトアウト'
  ]);
  const [tagPickerCategory, setTagPickerCategory] = useState<'all' | 'inflow' | 'action' | 'crm_status'>('all');

  // Test send simulation feedback
  const [testSendResult, setTestSendResult] = useState<string | null>(null);

  // Sync state on scenario change
  useEffect(() => {
    setName(scenario.name);
    setChannel(scenario.channel);
    setTrigger(scenario.trigger);
    setWaitMinutes(scenario.waitMinutes || 0);
    setWaitDaysInput(Math.round((scenario.waitMinutes || 0) / 1440));
    setSendTimeWindow(scenario.sendTimeWindow || '09:00-20:00');
    setAutomationEnabled(scenario.automationEnabled || false);
    setStopOnBooking(scenario.stopOnBooking ?? true);
    setStopOnDeal(scenario.stopOnDeal ?? true);
    setConsentBasis(scenario.consentBasis || 'LINE友だち追加またはフォーム登録時の配信同意に基づく');
    setEmailSubject(scenario.emailSubject || '');
    setEmailBody(scenario.emailBody || '');
    setMessageBody(scenario.messageBody || '');
    setLineMessageType(scenario.lineMessageType || 'flex');
    setFlexTitle(scenario.flexTitle || '');
    setFlexBody(scenario.flexBody || '');
    setFlexAltText(scenario.flexAltText || '');
    setFlexButtonLabel(scenario.flexButtonLabel || '');
    setFlexButtonUrl(scenario.flexButtonUrl || '');
    setTestSendResult(null);

    // Initial tags based on scenario type
    if (scenario.name.includes('診断')) {
      setSelectedTagNames(['選択:診断', 'LINE友だち追加']);
      setSelectedExitTagNames(['診断受検済み', '個別相談予約済み', '成約・顧問契約', '配信停止・オプトアウト']);
    } else if (scenario.name.includes('相談') || scenario.name.includes('面談')) {
      setSelectedTagNames(['選択:個別相談']);
      setSelectedExitTagNames(['個別相談予約済み', '相談実施済み', '成約・顧問契約', '配信停止・オプトアウト']);
    } else if (scenario.name.includes('介護') || scenario.name.includes('保険外')) {
      setSelectedTagNames(['care:開業相談']);
      setSelectedExitTagNames(['個別相談予約済み', '成約・顧問契約', '配信停止・オプトアウト']);
    } else {
      setSelectedTagNames(['LINE友だち追加']);
      setSelectedExitTagNames(['個別相談予約済み', '成約・顧問契約', '配信停止・オプトアウト']);
    }
  }, [scenario]);

  // Detected URLs and linked form detection
  const detectedLinks = useMemo(() => {
    const urls: Array<{ type: 'diagnosis' | 'booking' | 'care' | 'custom'; label: string; url: string }> = [];
    const textToCheck = `${flexButtonUrl} ${messageBody} ${emailBody}`;

    if (textToCheck.includes('{link_url}') || textToCheck.includes('/diagnosis') || textToCheck.includes('diagnostic')) {
      urls.push({
        type: 'diagnosis',
        label: '📊 3分無料経営ボトルネック診断フォーム',
        url: 'https://mstcorp.info/diagnosis（またはアプリ内 /diagnosis）',
      });
    }
    if (textToCheck.includes('{booking_url}') || textToCheck.includes('calendar') || textToCheck.includes('面談')) {
      urls.push({
        type: 'booking',
        label: '🗓️ 30分無料個別相談・面談予約カレンダー',
        url: 'https://calendar.google.com/calendar/appointments/...（または専用予約枠）',
      });
    }
    if (textToCheck.includes('care') || textToCheck.includes('開業') || textToCheck.includes('保険外')) {
      urls.push({
        type: 'care',
        label: '🌿 介護保険外サービス開業パッケージ申込・資料フォーム',
        url: 'https://mstcorp.info/care-package（7日間有効トークン付与）',
      });
    }
    return urls;
  }, [flexButtonUrl, messageBody, emailBody]);

  const handleSave = () => {
    const updated: MarketingScenario = {
      ...scenario,
      name: name.trim() || scenario.name,
      channel,
      trigger,
      waitMinutes: waitDaysInput * 1440,
      sendTimeWindow,
      automationEnabled,
      stopOnBooking,
      stopOnDeal,
      consentBasis,
      emailSubject,
      emailBody,
      messageBody,
      lineMessageType,
      flexTitle,
      flexBody,
      flexAltText,
      flexButtonLabel,
      flexButtonUrl,
      updatedAt: Date.now(),
    };
    onSave(updated);
    onClose();
  };

  const handleTestSend = (targetChannel: 'line' | 'email') => {
    const sampleRecipient = PLACEHOLDER_SAMPLE_VALUES.recipient_name;
    const sampleCompany = PLACEHOLDER_SAMPLE_VALUES.company_name;
    setTestSendResult(
      `✅ テスト送信成功: 管理者宛に【${targetChannel === 'line' ? 'LINEメッセージ' : 'メール'}】のテスト配信シミュレーションを実行しました。（宛名置換: ${sampleCompany} ${sampleRecipient} 様）`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ステップ詳細設定 ＆ 事故防止インスペクター
                </span>
                <span className="text-[11px] text-slate-400">
                  ID: <span className="font-mono text-slate-300">{scenario.id}</span>
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-0.5">
                {name || 'ステップ設定'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/80 px-6 gap-2 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'edit'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>① 基本設定・配信文面</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview_message')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'preview_message'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>② LINE/メール配信プレビュー</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inspect_form')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'inspect_form'
                ? 'border-amber-500 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>③ 連動フォーム・リンク安全点検</span>
            {detectedLinks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                {detectedLinks.length}件検知
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test_send')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'test_send'
                ? 'border-purple-500 text-purple-300 bg-purple-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4 text-purple-400" />
            <span>④ 管理者テスト送信点検</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Edit Details */}
          {activeTab === 'edit' && (
            <div className="space-y-6 text-xs">
              {/* Step Title & Trigger & Wait */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>ステップ基本パラメータ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-slate-300 font-bold block mb-1">ステップ名称</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">配信チャネル</label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as MarketingChannel)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold cursor-pointer"
                    >
                      <option value="line">LINE公式アカウントのみ</option>
                      <option value="email">メールのみ</option>
                      <option value="both">LINE ＋ メール（両方配信）</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">配信タイミング</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={waitDaysInput}
                        onChange={(e) => setWaitDaysInput(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-center font-bold"
                      />
                      <span className="text-slate-300">
                        日後 {waitDaysInput === 0 ? '（即時配信）' : ''}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">配信時間帯ガード</label>
                    <input
                      type="text"
                      value={sendTimeWindow}
                      onChange={(e) => setSendTimeWindow(e.target.value)}
                      placeholder="09:00-20:00"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">※夜間迷惑配信を自動抑止</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">自動配信ステータス</label>
                    <button
                      type="button"
                      onClick={() => setAutomationEnabled(!automationEnabled)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        automationEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{automationEnabled ? '自動実行中（稼働中）' : '一時停止中（安全待機）'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 🏷️ 共通タグマスター連動 ＆ 自動停止条件 */}
              <div className="p-4 bg-slate-950 rounded-xl border border-indigo-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <TagIcon className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-sm">
                      🏷️ 共通タグマスター連動 ＆ 自動脱落（停止）ガード
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                    CRM・LINE友だち管理とリアルタイム同期中
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 自動停止・脱落条件 */}
                  <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-red-300 block flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      誤配信防止：自動停止（脱落）トリガー
                    </span>
                    <p className="text-[11px] text-slate-400">
                      以下のいずれかの条件を満たした顧客には、このステップ以降の配信を即時完全ストップします。
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <label className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={stopOnBooking}
                          onChange={(e) => setStopOnBooking(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                        <span className="text-white font-bold">面談・個別相談が予約されたら即停止</span>
                      </label>
                      <label className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={stopOnDeal}
                          onChange={(e) => setStopOnDeal(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                        <span className="text-white font-bold">成約・契約締結が成立したら即停止</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <span className="text-[11px] text-slate-400 block mb-1">
                        指定タグが付与されたら停止:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedExitTagNames.map((tagName) => (
                          <span
                            key={tagName}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold"
                          >
                            <span>{tagName}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedExitTagNames(selectedExitTagNames.filter((t) => t !== tagName))}
                              className="hover:text-white"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* タグマスターから選択して追加 */}
                  <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-indigo-300 block">
                      共通タグマスター（辞書からワンクリック追加）
                    </span>
                    <p className="text-[11px] text-slate-400">
                      手入力による表記揺れ（例:「診断済」と「診断受検済み」）を防ぐため、定義済みタグから選択します。
                    </p>

                    <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-800/80">
                      {UNIFIED_TAG_MASTER.map((tag) => {
                        const isExit = selectedExitTagNames.includes(tag.name);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (isExit) {
                                setSelectedExitTagNames(selectedExitTagNames.filter((t) => t !== tag.name));
                              } else {
                                setSelectedExitTagNames([...selectedExitTagNames, tag.name]);
                              }
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                              isExit
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                            title={tag.description}
                          >
                            <span>{tag.name}</span>
                            {isExit ? <span>✓停止</span> : <span>+</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* LINE メッセージ設定（LINE選択時） */}
              {(channel === 'line' || channel === 'both') && (
                <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white text-sm">LINE配信メッセージ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400 text-xs">メッセージ形式:</label>
                      <select
                        value={lineMessageType}
                        onChange={(e) => setLineMessageType(e.target.value as MarketingLineMessageType)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-bold cursor-pointer"
                      >
                        <option value="flex">Flexカード（ボタン付き高クリック率UI）</option>
                        <option value="text">通常テキスト吹き出し</option>
                      </select>
                    </div>
                  </div>

                  {lineMessageType === 'flex' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-slate-300 font-bold block mb-1">Flexカード タイトル</label>
                        <input
                          type="text"
                          value={flexTitle}
                          onChange={(e) => setFlexTitle(e.target.value)}
                          placeholder="例：【無料】業務ボトルネック診断（約3分）"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 font-bold block mb-1">カード説明文</label>
                        <textarea
                          rows={3}
                          value={flexBody}
                          onChange={(e) => setFlexBody(e.target.value)}
                          placeholder="カードに表示する説明文。{recipient_name} などの差し込みが利用可能。"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-300 font-bold block mb-1">アクションボタン名</label>
                          <input
                            type="text"
                            value={flexButtonLabel}
                            onChange={(e) => setFlexButtonLabel(e.target.value)}
                            placeholder="例：3分診断を始める"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-slate-300 font-bold block mb-1">ボタン遷移先URL</label>
                          <input
                            type="text"
                            value={flexButtonUrl}
                            onChange={(e) => setFlexButtonUrl(e.target.value)}
                            placeholder="{link_url} や {booking_url} または HTTPS URL"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">トーク本文</label>
                      <textarea
                        rows={5}
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                        placeholder="LINEの吹き出しに送るテキストを入力してください。"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono leading-relaxed"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* メール メッセージ設定（メール選択時） */}
              {(channel === 'email' || channel === 'both') && (
                <div className="p-4 bg-slate-950 rounded-xl border border-blue-500/30 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white text-sm">メール配信メッセージ</span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">メール件名</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="【MST】3分無料経営診断のご案内"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">メール本文</label>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="メール本文を入力してください。{recipient_name} 様、{company_name} 様、{link_url} などの差し込みが可能です。"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Preview Message */}
          {activeTab === 'preview_message' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">実機プレビュー表示</span>
                  <p className="text-slate-400 mt-0.5">
                    差し込みタグ（{'{recipient_name}'} → 「山田 太郎」、{'{company_name}'} → 「MST製造株式会社」）を実環境に合わせて展開しています。
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-bold">
                  表示シミュレーション稼働中
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LINE Preview */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                    <Smartphone className="w-4 h-4" />
                    <span>LINEトーク画面プレビュー</span>
                  </div>
                  <div className="p-4 bg-[#7494c0] rounded-2xl shadow-inner min-h-[300px]">
                    {lineMessageType === 'text' ? (
                      <LineMessagePreview
                        type="text"
                        text={renderPlaceholders(messageBody || '（本文がここに表示されます）', PLACEHOLDER_SAMPLE_VALUES)}
                        title="シナリオLINEテキスト"
                      />
                    ) : (
                      <LineMessagePreview
                        type="flex"
                        title={flexTitle || 'シナリオFlexカード'}
                        payload={{
                          altText: flexAltText || 'LINE Flexメッセージ',
                          contents: {
                            type: 'bubble',
                            body: {
                              type: 'box',
                              layout: 'vertical',
                              spacing: 'md',
                              contents: [
                                { type: 'text', text: renderPlaceholders(flexTitle || '見出しタイトル', PLACEHOLDER_SAMPLE_VALUES), weight: 'bold', size: 'xl', wrap: true },
                                { type: 'text', text: renderPlaceholders(flexBody || 'カード説明文がここに表示されます。', PLACEHOLDER_SAMPLE_VALUES), size: 'sm', wrap: true, margin: 'md' },
                              ]
                            },
                            ...(flexButtonLabel && flexButtonUrl ? {
                              footer: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [{
                                  type: 'button',
                                  style: 'primary',
                                  action: {
                                    type: 'uri',
                                    label: flexButtonLabel,
                                    uri: flexButtonUrl
                                  }
                                }]
                              }
                            } : {})
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Email Preview */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-blue-300 text-sm">
                    <Mail className="w-4 h-4" />
                    <span>メール受信プレビュー</span>
                  </div>
                  <div className="bg-white text-slate-900 rounded-xl p-5 shadow font-sans text-xs space-y-3">
                    <div className="border-b border-slate-200 pb-2">
                      <span className="text-slate-500 block text-[10px]">件名:</span>
                      <div className="font-bold text-slate-900 text-sm">
                        {renderPlaceholders(emailSubject || '(件名未設定)', PLACEHOLDER_SAMPLE_VALUES)}
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-800 font-mono text-[11px] max-h-72 overflow-y-auto">
                      {renderPlaceholders(emailBody || messageBody || '(本文未設定)', PLACEHOLDER_SAMPLE_VALUES)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Inspect Linked Forms & URL Safety */}
          {activeTab === 'inspect_form' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/40 text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>配信事故防止：連動フォーム・設問・URL安全点検</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  メッセージ本文やボタンに含まれる「リンク先（診断フォーム・予約カレンダー・資料請求）」の内容をこの場で事前点検できます。
                  <strong>文面とフォームの設問内容に齟齬がないか、回答後に期待するタグが正しく付与されるか</strong>を確認してください。
                </p>
              </div>

              {/* Detected Links List */}
              <div className="space-y-4">
                {detectedLinks.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-xs font-black text-white flex items-center gap-2">
                          {item.label}
                        </span>
                        <span className="font-mono text-[11px] text-indigo-300 break-all">
                          {item.url}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>疎通確認済み（リンク有効）</span>
                      </span>
                    </div>

                    {/* Specific Inspection for 3-minute diagnosis */}
                    {item.type === 'diagnosis' && (
                      <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">
                            📋 診断フォームの設問構成プレビュー（全5問・約3分）
                          </span>
                          <span className="text-[11px] text-emerald-400 font-bold">
                            回答完了時に自動付与タグ: 「診断受検済み」
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          {QUESTIONNAIRE_V1.flatMap(cat => cat.questions).slice(0, 4).map((q, qIdx) => (
                            <div key={q.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                              <span className="text-indigo-400 font-bold block text-[10px]">設問 {qIdx + 1}</span>
                              <span className="text-white font-medium">{q.label}</span>
                              <p className="text-slate-400 text-[10px] mt-0.5">{q.description}</p>
                            </div>
                          ))}
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200">
                          ℹ️ 顧客がこの診断を送信した瞬間、CRMおよびLINE友だちに「診断受検済み」タグが付与され、未受検リマインドは自動的に停止します。
                        </div>
                      </div>
                    )}

                    {/* Specific Inspection for Booking Calendar */}
                    {item.type === 'booking' && (
                      <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">
                            🗓️ 個別相談予約カレンダー連携状況
                          </span>
                          <span className="text-emerald-400 font-bold text-[11px]">
                            予約確定時に自動付与タグ: 「個別相談予約済み」
                          </span>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>所要時間: <strong>30分</strong>（Google Meet / オンライン）</span>
                            <span className="text-emerald-300">Googleカレンダー空き枠と自動連動中</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            予約完了と同時に、顧客向けサンクス案内と大橋真人様への通知が発行されます。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {detectedLinks.length === 0 && (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                    このメッセージには現在フォームや外部リンクURLが含まれていません。
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Test Send Simulation */}
          {activeTab === 'test_send' && (
            <div className="space-y-6 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-purple-500/30 space-y-3">
                <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
                  <Send className="w-4 h-4" />
                  <span>管理者向けテスト配信（事前シミュレーション）</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  顧客へ実際に自動配信される前に、管理者のLINE公式アカウントまたは管理メール宛に実機テスト送信を行い、改行やボタンの挙動を直接確認できます。
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {(channel === 'line' || channel === 'both') && (
                    <button
                      type="button"
                      onClick={() => handleTestSend('line')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>LINEテスト送信を実行</span>
                    </button>
                  )}

                  {(channel === 'email' || channel === 'both') && (
                    <button
                      type="button"
                      onClick={() => handleTestSend('email')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                    >
                      <Mail className="w-4 h-4" />
                      <span>メールテスト送信を実行</span>
                    </button>
                  )}
                </div>

                {testSendResult && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-200 font-bold mt-3 animate-fade-in">
                    {testSendResult}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`シナリオ「${scenario.name}」を削除してもよろしいですか？`)) {
                    onDelete(scenario.id);
                    onClose();
                  }
                }}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>このステップを削除</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>設定を保存して反映</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
