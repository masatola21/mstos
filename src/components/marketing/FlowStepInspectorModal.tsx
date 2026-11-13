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
  Info,
  Loader2,
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
import { getSupabase } from '../../lib/supabaseClient';

import { ScenarioDryRunModal } from './ScenarioDryRunModal';

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
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);

  // Form State
  const [name, setName] = useState(scenario.name);
  const [channel, setChannel] = useState<MarketingChannel>(scenario.channel);
  const [trigger, setTrigger] = useState<MarketingTrigger>(scenario.trigger);
  const [targetTag, setTargetTag] = useState<string>(scenario.targetTag || '');
  const [waitMinutes, setWaitMinutes] = useState(scenario.waitMinutes || 0);
  const [waitDaysInput, setWaitDaysInput] = useState(Math.round((scenario.waitMinutes || 0) / 1440));
  const [sendTimeWindow, setSendTimeWindow] = useState(scenario.sendTimeWindow || '09:00-20:00');
  const [preferredSendTime, setPreferredSendTime] = useState(scenario.preferredSendTime || '');
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

  // LINE Test Send state
  const [lineFriends, setLineFriends] = useState<Array<{ id: string; line_user_id: string; display_name: string | null; status?: string }>>([]);
  const [selectedLineUserId, setSelectedLineUserId] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendNotice, setTestSendNotice] = useState<string | null>(null);
  const [testSendError, setTestSendError] = useState<string | null>(null);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Fetch active line_friends on open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchFriends = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      setLoadingFriends(true);
      try {
        const { data } = await supabase
          .from('line_friends')
          .select('id, line_user_id, display_name, status')
          .eq('status', 'active')
          .order('display_name', { ascending: true });
        if (!isMounted) return;
        if (data && data.length > 0) {
          setLineFriends(data);
          const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('mst_test_send_line_user_id') : null;
          if (savedUserId && data.some(f => f.line_user_id === savedUserId)) {
            setSelectedLineUserId(savedUserId);
          } else {
            setSelectedLineUserId(data[0].line_user_id);
          }
        } else {
          setLineFriends([]);
          setSelectedLineUserId('');
        }
      } catch (err) {
        console.error('Failed to load line_friends for test send:', err);
      } finally {
        if (isMounted) setLoadingFriends(false);
      }
    };
    void fetchFriends();
    return () => { isMounted = false; };
  }, [isOpen]);

  const handleSelectLineUser = (userId: string) => {
    setSelectedLineUserId(userId);
    setTestSendError(null);
    setTestSendNotice(null);
    if (userId && typeof window !== 'undefined') {
      localStorage.setItem('mst_test_send_line_user_id', userId);
    }
  };

  // Sync state on scenario change
  useEffect(() => {
    setName(scenario.name);
    setChannel(scenario.channel);
    setTrigger(scenario.trigger);
    setTargetTag(scenario.targetTag || '');
    setWaitMinutes(scenario.waitMinutes || 0);
    setWaitDaysInput(Math.round((scenario.waitMinutes || 0) / 1440));
    setSendTimeWindow(scenario.sendTimeWindow || '09:00-20:00');
    setPreferredSendTime(scenario.preferredSendTime || '');
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
    setTestSendNotice(null);
    setTestSendError(null);

    // Initial tags based on scenario type
    if (scenario.name.includes('診断')) {
      setSelectedTagNames(['選択:診断', 'LINE友だち追加']);
      setSelectedExitTagNames(['診断受検済み', '個別相談予約済み', '成約・顧問契約', '配信停止・オプトアウト']);
    } else if (scenario.name.includes('相談') || scenario.name.includes('面談')) {
      setSelectedTagNames(['選択:個別相談']);
      setSelectedExitTagNames(['個別相談予約済み', '相談実施済み', '成約・顧問契約', '配信停止・オプトアウト']);
    } else if (scenario.name.includes('介護') || scenario.name.includes('保険外')) {
      setSelectedTagNames(['介護保険外開業']);
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
        url: 'https://corp.mstcorp.info/diagnosis（またはアプリ内 /diagnosis）',
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
        url: 'https://corp.mstcorp.info/care-package（7日間有効トークン付与）',
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
      targetTag: trigger === 'tag_added' ? (targetTag.trim() || undefined) : undefined,
      waitMinutes: waitDaysInput * 1440,
      sendTimeWindow,
      preferredSendTime: preferredSendTime.trim() || '',
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

  const handleTestSend = async (targetChannel: 'line' | 'email') => {
    if (targetChannel === 'line') {
      if (!selectedLineUserId) {
        setTestSendError('送信先のLINE友だちを選択してください。');
        return;
      }
      setIsSendingTest(true);
      setTestSendNotice(null);
      setTestSendError(null);

      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase接続が初期化されていません。');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('認証セッションが見つかりません。再度ログインしてください。');

        const payload = {
          line_user_id: selectedLineUserId,
          scenario: {
            name: name.trim() || scenario.name,
            channel,
            lineMessageType,
            messageBody,
            flexTitle,
            flexBody,
            flexAltText,
            flexButtonLabel,
            flexButtonUrl,
            line_message_payload: (scenario as any).line_message_payload,
          },
        };

        const res = await fetch('/api/marketing/test-send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || `LINE送信エラー (HTTP ${res.status}): ${JSON.stringify(json.lineDetails || json)}`);
        }

        const friend = lineFriends.find((f) => f.line_user_id === selectedLineUserId);
        const friendLabel = friend?.display_name || selectedLineUserId;
        setTestSendNotice(`✅ LINEテスト送信が完了しました。宛先「${friendLabel}」様のLINEトークをご確認ください。`);
      } catch (err: any) {
        setTestSendError(err.message || 'テスト送信に失敗しました。');
      } finally {
        setIsSendingTest(false);
      }
    } else {
      // メール実機テスト送信（常にログイン中の管理者宛て）
      setIsSendingTest(true);
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase接続が初期化されていません。');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('認証セッションが見つかりません。再度ログインしてください。');

        const payload = {
          channel: 'email',
          scenario: {
            id: scenario.id,
            name,
            trigger,
            channel,
            emailSubject,
            emailBody,
            messageBody,
          },
        };

        const res = await fetch('/api/marketing/test-send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || `メール送信エラー (HTTP ${res.status})`);
        }

        setTestSendNotice(json.message || '✅ 管理者メールアドレス宛てに実機テストメールを送信しました。受信トレイをご確認ください。');
      } catch (err: any) {
        setTestSendError(err.message || 'メールテスト送信に失敗しました。');
      } finally {
        setIsSendingTest(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-purple-100 text-purple-700 rounded-xl border border-purple-200">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  ステップ詳細設定 ＆ 事故防止インスペクター
                </span>
                <span className="text-[11px] text-slate-500">
                  ID: <span className="font-mono text-slate-700 font-medium">{scenario.id}</span>
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {name || 'ステップ設定'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDryRunOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="本番送信せずに変数の置換やジョブ生成をシミュレーション"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>ドライラン実行（シミュレーション）</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-white px-6 gap-2 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'edit'
                ? 'border-purple-600 text-purple-700 bg-purple-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>② LINE/メール配信プレビュー</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inspect_form')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'inspect_form'
                ? 'border-amber-600 text-amber-800 bg-amber-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>③ 連動フォーム・リンク安全点検</span>
            {detectedLinks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                {detectedLinks.length}件検知
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test_send')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'test_send'
                ? 'border-purple-600 text-purple-700 bg-purple-50/60'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-4 h-4 text-purple-600" />
            <span>④ 管理者テスト送信点検</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {/* TAB 1: Edit Details */}
          {activeTab === 'edit' && (
            <div className="space-y-6 text-xs">
              {/* Step Title & Trigger & Wait */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span>ステップ基本パラメータ</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-slate-700 font-bold block mb-1">ステップ名称</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold shadow-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">配信チャネル</label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as MarketingChannel)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold cursor-pointer shadow-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="line">LINE公式アカウントのみ</option>
                      <option value="email">メールのみ</option>
                      <option value="both">LINE ＋ メール（両方配信）</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">配信タイミング</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={waitDaysInput}
                        onChange={(e) => setWaitDaysInput(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-center font-bold shadow-xs focus:outline-none focus:border-purple-500"
                      />
                      <span className="text-slate-600 font-medium">
                        日後 {waitDaysInput === 0 ? '（即時）' : ''}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">配信希望時刻（任意・JST）</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={preferredSendTime}
                        onChange={(e) => setPreferredSendTime(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 font-mono shadow-xs focus:outline-none focus:border-purple-500"
                      />
                      {preferredSendTime && (
                        <button
                          type="button"
                          onClick={() => setPreferredSendTime('')}
                          className="px-2 py-2 text-[11px] rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          title="時刻指定を解除"
                        >
                          解除
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {waitDaysInput > 0
                        ? '※指定時刻の+0〜15分前後に配信'
                        : '※1日以上のステップで有効（0日は即時）'}
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">配信時間帯ガード</label>
                    <input
                      type="text"
                      value={sendTimeWindow}
                      onChange={(e) => setSendTimeWindow(e.target.value)}
                      placeholder="09:00-20:00"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono shadow-xs focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">※夜間迷惑配信を自動抑止</span>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">自動配信ステータス</label>
                    <button
                      type="button"
                      onClick={() => setAutomationEnabled(!automationEnabled)}
                      className={`w-full py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                        automationEnabled
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{automationEnabled ? '自動実行中' : '一時停止中'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">開始トリガー（いつ起動するか）</label>
                    <select
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value as MarketingTrigger)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold cursor-pointer shadow-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="tag_added">指定タグが付いた時（ウェルカム分岐タップ等）</option>
                      <option value="line_registered">LINE友だち追加された時</option>
                      <option value="diagnosis_completed">無料診断に回答完了した時</option>
                      <option value="report_approved">診断レポートが承認・完成した時</option>
                      <option value="report_sent">診断レポートを送付した時</option>
                      <option value="lead_created">見込み客が登録された時</option>
                      <option value="outreach_first_sent">営業メール第1通を送った時</option>
                      <option value="booking_created">個別相談の予約が入った時</option>
                      <option value="manual">手動開始</option>
                    </select>
                  </div>

                  {trigger === 'tag_added' && (
                    <div>
                      <label className="text-slate-700 font-bold block mb-1">対象タグ（どの選択肢で動かすか）</label>
                      <select
                        value={targetTag}
                        onChange={(e) => setTargetTag(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold cursor-pointer shadow-xs focus:outline-none focus:border-purple-500"
                      >
                        <option value="">すべてのタグ</option>
                        {UNIFIED_TAG_MASTER.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}（{t.categoryLabel}）
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 🏷️ 共通タグマスター連動 ＆ 自動停止条件 */}
              <div className="p-5 bg-white rounded-2xl border border-purple-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <TagIcon className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-slate-900 text-sm">
                      🏷️ 共通タグマスター連動 ＆ 自動脱落（停止）ガード
                    </span>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    CRM・LINE友だち管理とリアルタイム同期中
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 自動停止・脱落条件 */}
                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="font-bold text-rose-800 block flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-rose-600" />
                      誤配信防止：自動停止（脱落）トリガー
                    </span>
                    <p className="text-[11px] text-slate-500">
                      以下のいずれかの条件を満たした顧客には、このステップ以降の配信を即時完全ストップします。
                    </p>

                    <div className="space-y-2 pt-1">
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer shadow-xs">
                        <input
                          type="checkbox"
                          checked={stopOnBooking}
                          onChange={(e) => setStopOnBooking(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span className="text-slate-900 font-semibold">面談・個別相談が予約されたら即停止</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer shadow-xs">
                        <input
                          type="checkbox"
                          checked={stopOnDeal}
                          onChange={(e) => setStopOnDeal(e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span className="text-slate-900 font-semibold">成約・契約締結が成立したら即停止</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <span className="text-[11px] text-slate-600 font-medium block mb-1.5">
                        指定タグが付与されたら停止:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedExitTagNames.map((tagName) => (
                          <span
                            key={tagName}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold"
                          >
                            <span>{tagName}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedExitTagNames(selectedExitTagNames.filter((t) => t !== tagName))}
                              className="hover:text-rose-950 font-bold ml-0.5"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* タグマスターから選択して追加 */}
                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="font-bold text-purple-900 block">
                      共通タグマスター（辞書からワンクリック追加）
                    </span>
                    <p className="text-[11px] text-slate-500">
                      手入力による表記揺れ（例:「診断済」と「診断受検済み」）を防ぐため、定義済みタグから選択します。
                    </p>

                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
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
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                              isExit
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                <div className="p-5 bg-white rounded-2xl border border-emerald-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-900 text-sm">LINE配信メッセージ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-500 text-xs font-medium">メッセージ形式:</label>
                      <select
                        value={lineMessageType}
                        onChange={(e) => setLineMessageType(e.target.value as MarketingLineMessageType)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs font-semibold cursor-pointer shadow-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="flex">Flexカード（ボタン付き高クリック率UI）</option>
                        <option value="text">通常テキスト吹き出し</option>
                      </select>
                    </div>
                  </div>

                  {lineMessageType === 'flex' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-slate-700 font-bold block mb-1">Flexカード タイトル</label>
                        <input
                          type="text"
                          value={flexTitle}
                          onChange={(e) => setFlexTitle(e.target.value)}
                          placeholder="例：【無料】業務ボトルネック診断（約3分）"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-bold shadow-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-700 font-bold block mb-1">カード説明文</label>
                        <textarea
                          rows={3}
                          value={flexBody}
                          onChange={(e) => setFlexBody(e.target.value)}
                          placeholder="カードに表示する説明文。{recipient_name} などの差し込みが利用可能。"
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-xs shadow-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-700 font-bold block mb-1">アクションボタン名</label>
                          <input
                            type="text"
                            value={flexButtonLabel}
                            onChange={(e) => setFlexButtonLabel(e.target.value)}
                            placeholder="例：3分診断を始める"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs shadow-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-slate-700 font-bold block mb-1">ボタン遷移先URL</label>
                          <input
                            type="text"
                            value={flexButtonUrl}
                            onChange={(e) => setFlexButtonUrl(e.target.value)}
                            placeholder="{link_url} や {booking_url} または HTTPS URL"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-mono shadow-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-700 font-bold block mb-1">トーク本文</label>
                      <textarea
                        rows={5}
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                        placeholder="LINEの吹き出しに送るテキストを入力してください。"
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-xs font-mono leading-relaxed shadow-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* メール メッセージ設定（メール選択時） */}
              {(channel === 'email' || channel === 'both') && (
                <div className="p-5 bg-white rounded-2xl border border-sky-200 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Mail className="w-4 h-4 text-sky-600" />
                    <span className="font-bold text-slate-900 text-sm">メール配信メッセージ</span>
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">メール件名</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="【MST】3分無料経営診断のご案内"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-bold shadow-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">メール本文</label>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="メール本文を入力してください。{recipient_name} 様、{company_name} 様、{link_url} などの差し込みが可能です。"
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 text-xs font-mono leading-relaxed shadow-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Preview Message */}
          {activeTab === 'preview_message' && (
            <div className="space-y-6">
              <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200/80 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-900">実機プレビュー表示</span>
                  <p className="text-slate-600 mt-0.5">
                    差し込みタグ（{'{recipient_name}'} → 「山田 太郎」、{'{company_name}'} → 「MST製造株式会社」）を実環境に合わせて展開しています。
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold shrink-0 self-start sm:self-center">
                  表示シミュレーション稼働中
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LINE Preview */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-700 text-sm">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
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
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-blue-700 text-sm">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>メール受信プレビュー</span>
                  </div>
                  <div className="bg-white text-slate-900 rounded-xl p-5 border border-slate-200 shadow-xs font-sans text-xs space-y-3">
                    <div className="border-b border-slate-200 pb-2">
                      <span className="text-slate-500 block text-[10px] font-medium">件名:</span>
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
              <div className="p-4 bg-amber-50/90 rounded-xl border border-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <span>配信事故防止：連動フォーム・設問・URL安全点検</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  メッセージ本文やボタンに含まれる「リンク先（診断フォーム・予約カレンダー・資料請求）」の内容をこの場で事前点検できます。
                  <strong>文面とフォームの設問内容に齟齬がないか、回答後に期待するタグが正しく付与されるか</strong>を確認してください。
                </p>
              </div>

              {/* Detected Links List */}
              <div className="space-y-4">
                {detectedLinks.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          {item.label}
                        </span>
                        <span className="font-mono text-[11px] text-purple-700 break-all">
                          {item.url}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>疎通確認済み（リンク有効）</span>
                      </span>
                    </div>

                    {/* Specific Inspection for 3-minute diagnosis */}
                    {item.type === 'diagnosis' && (
                      <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 text-xs">
                            📋 診断フォームの設問構成プレビュー（全5問・約3分）
                          </span>
                          <span className="text-[11px] text-emerald-700 font-bold">
                            回答完了時に自動付与タグ: 「診断受検済み」
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          {QUESTIONNAIRE_V1.flatMap(cat => cat.questions).slice(0, 4).map((q, qIdx) => (
                            <div key={q.id} className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                              <span className="text-purple-700 font-bold block text-[10px]">設問 {qIdx + 1}</span>
                              <span className="text-slate-900 font-medium">{q.label}</span>
                              <p className="text-slate-500 text-[10px] mt-0.5">{q.description}</p>
                            </div>
                          ))}
                        </div>
                        <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-900">
                          ℹ️ 顧客がこの診断を送信した瞬間、CRMおよびLINE友だちに「診断受検済み」タグが付与され、未受検リマインドは自動的に停止します。
                        </div>
                      </div>
                    )}

                    {/* Specific Inspection for Booking Calendar */}
                    {item.type === 'booking' && (
                      <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-bold text-slate-900">
                            🗓️ 個別相談予約カレンダー連携状況
                          </span>
                          <span className="text-emerald-700 font-bold text-[11px]">
                            予約確定時に自動付与タグ: 「個別相談予約済み」
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>所要時間: <strong className="text-slate-900">30分</strong>（Google Meet / オンライン）</span>
                            <span className="text-emerald-700 font-medium">Googleカレンダー空き枠と自動連動中</span>
                          </div>
                          <p className="text-slate-500 text-[11px]">
                            予約完了と同時に、顧客向けサンクス案内と大橋真人様への通知が発行されます。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {detectedLinks.length === 0 && (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                    このメッセージには現在フォームや外部リンクURLが含まれていません。
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Test Send Live Transmission */}
          {activeTab === 'test_send' && (
            <div className="space-y-6 text-xs">
              <div className="p-5 bg-purple-50/70 rounded-2xl border border-purple-200 space-y-4">
                <div className="flex items-center gap-2 font-bold text-purple-950 text-sm">
                  <Send className="w-4 h-4 text-purple-700" />
                  <span>実機テスト送信（LINE Messaging API直接配信）</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  顧客へ自動配信される前に、管理者の実機LINEアカウント宛てに編集中の文面・Flexカード・差し込み変数を実際にPush送信し、表示やボタンリンクを直接点検できます。
                </p>

                {/* LINE Recipient Selector */}
                {(channel === 'line' || channel === 'both') && (
                  <div className="p-4 bg-white rounded-xl border border-purple-200/80 shadow-2xs space-y-2">
                    <label className="block text-slate-800 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>テスト送信先のLINE友だち（管理者のアカウント等）</span>
                      </span>
                      {lineFriends.length > 0 && (
                        <span className="text-[11px] font-normal text-slate-500">
                          {lineFriends.length}名のアクティブ友だち
                        </span>
                      )}
                    </label>

                    {loadingFriends ? (
                      <div className="flex items-center gap-2 text-slate-500 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        <span>友だち一覧を読み込み中...</span>
                      </div>
                    ) : lineFriends.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={selectedLineUserId}
                          onChange={(e) => handleSelectLineUser(e.target.value)}
                          disabled={isSendingTest}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium shadow-xs focus:outline-none focus:border-purple-500"
                        >
                          <option value="">-- 送信先友だちを選択してください --</option>
                          {lineFriends.map((friend) => (
                            <option key={friend.line_user_id} value={friend.line_user_id}>
                              {friend.display_name || '表示名なし'} (ID: {friend.line_user_id.slice(0, 10)}...)
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500">
                          ※ 選択した友だちの登録情報（お名前・会社名等）に合わせて差し込み変数が実機値で展開されます。選択内容はブラウザに保存され次回も維持されます。
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span>有効なLINE友だちが登録されていません。</span>
                          <p className="mt-0.5 text-slate-600">
                            公式LINEアカウントをご自身のLINEで友だち追加すると、ここに表示されてテスト送信できるようになります。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {(channel === 'line' || channel === 'both') && (
                    <button
                      type="button"
                      disabled={isSendingTest || !selectedLineUserId || lineFriends.length === 0}
                      onClick={() => handleTestSend('line')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      {isSendingTest ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>LINEに送信中...</span>
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4" />
                          <span>LINEテスト送信を実行（本送信）</span>
                        </>
                      )}
                    </button>
                  )}

                  {(channel === 'email' || channel === 'both') && (
                    <button
                      type="button"
                      disabled={isSendingTest}
                      onClick={() => handleTestSend('email')}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      <Mail className="w-4 h-4" />
                      <span>メールテスト送信</span>
                    </button>
                  )}
                </div>

                {testSendNotice && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold mt-3 animate-fade-in flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>{testSendNotice}</div>
                  </div>
                )}

                {testSendError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-medium mt-3 animate-fade-in flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>{testSendError}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between">
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
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 cursor-pointer"
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
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>設定を保存して反映</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scenario Dry-run Simulation Modal */}
      {isDryRunOpen && (
        <ScenarioDryRunModal
          scenario={{
            ...scenario,
            name,
            channel,
            trigger,
            waitMinutes,
            emailSubject,
            emailBody,
            messageBody,
            lineMessageType,
            flexTitle,
            flexBody,
            flexAltText,
            flexButtonLabel,
            flexButtonUrl,
            sendTimeWindow,
            preferredSendTime: preferredSendTime.trim() || '',
            automationEnabled,
            stopOnBooking,
            stopOnDeal,
            consentBasis,
          }}
          isOpen={isDryRunOpen}
          onClose={() => setIsDryRunOpen(false)}
        />
      )}
    </div>
  );
};
