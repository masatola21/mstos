import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
  MessageCircle,
  Mail,
  Save,
  Trash2,
  Smartphone,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  MarketingScenario,
  MarketingTrigger,
  MarketingChannel,
  MarketingLineMessageType,
} from '../../types/marketing';
import { LineMessagePreview } from '../LineMessagePreview';
import { renderPlaceholders, PLACEHOLDER_SAMPLE_VALUES } from '../../utils/placeholders';
import { UNIFIED_TAG_MASTER } from '../../constants/tagMaster';
import { QUESTIONNAIRE_V1 } from '../../constants/questionnaire';
import { getSupabase } from '../../lib/supabaseClient';
import { ONE_SHOT_SCENARIO_ID, getOneShotOutreachTemplate } from '../../utils/salesOutreachTemplates';
import { appendEmailFooter } from '../../../server/emailFooter';
import { PlaceholderAssist } from '../common/PlaceholderAssist';
import { ScenarioDryRunModal } from './ScenarioDryRunModal';

interface FlowStepInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: MarketingScenario | null;
  onSave: (scenario: MarketingScenario) => void;
  onDelete?: (scenarioId: string) => void;
  allScenarios?: MarketingScenario[];
}

const TRIGGER_LABELS: Record<string, string> = {
  tag_added: '指定タグが付いた時',
  line_registered: 'LINE友だち追加時',
  diagnosis_completed: '無料診断の回答完了時',
  report_approved: '診断レポート承認時',
  report_sent: '診断レポート送付時',
  lead_created: '見込み客登録時',
  outreach_first_sent: '営業メール第1通送信時',
  booking_created: '個別相談予約時',
  manual: '手動開始',
};

const ONE_SHOT_PLACEHOLDERS = [
  { token: '{会社名}', label: '会社名' },
  { token: '{お名前}', label: '担当者名' },
  { token: '{業種}', label: '業種' },
  { token: '{案内URL}', label: '診断URL' },
];

export const FlowStepInspectorModal: React.FC<FlowStepInspectorModalProps> = ({
  isOpen,
  onClose,
  scenario,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !scenario) return null;

  const isOneShot =
    scenario.id === ONE_SHOT_SCENARIO_ID || (scenario.name || '').includes('一発直球');

  const [activeTab, setActiveTab] = useState<'editor' | 'safety'>('editor');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);

  // Form State
  const [name, setName] = useState(scenario.name);
  const [channel, setChannel] = useState<MarketingChannel>(scenario.channel);
  const [trigger, setTrigger] = useState<MarketingTrigger>(scenario.trigger);
  const [targetTag, setTargetTag] = useState<string>(scenario.targetTag || '');
  const [waitDaysInput, setWaitDaysInput] = useState(Math.round((scenario.waitMinutes || 0) / 1440));
  const [sendTimeWindow, setSendTimeWindow] = useState(scenario.sendTimeWindow || '09:00-20:00');
  const [preferredSendTime, setPreferredSendTime] = useState(scenario.preferredSendTime || '');
  const [automationEnabled, setAutomationEnabled] = useState(scenario.automationEnabled || false);
  const [stopOnBooking, setStopOnBooking] = useState(scenario.stopOnBooking ?? true);
  const [stopOnDeal, setStopOnDeal] = useState(scenario.stopOnDeal ?? true);
  const [consentBasis, setConsentBasis] = useState(
    scenario.consentBasis || 'LINE友だち追加またはフォーム登録時の配信同意に基づく'
  );

  // Content state
  const [emailSubject, setEmailSubject] = useState(scenario.emailSubject || '');
  const [emailBody, setEmailBody] = useState(scenario.emailBody || '');
  const [messageBody, setMessageBody] = useState(scenario.messageBody || '');
  const [lineMessageType, setLineMessageType] = useState<MarketingLineMessageType>(
    scenario.lineMessageType || 'flex'
  );
  const [flexTitle, setFlexTitle] = useState(scenario.flexTitle || '');
  const [flexBody, setFlexBody] = useState(scenario.flexBody || '');
  const [flexAltText, setFlexAltText] = useState(scenario.flexAltText || '');
  const [flexButtonLabel, setFlexButtonLabel] = useState(scenario.flexButtonLabel || '');
  const [flexButtonUrl, setFlexButtonUrl] = useState(scenario.flexButtonUrl || '');

  // Test Send state
  const [lineFriends, setLineFriends] = useState<
    Array<{ id: string; line_user_id: string; display_name: string | null; status?: string }>
  >([]);
  const [selectedLineUserId, setSelectedLineUserId] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSendNotice, setTestSendNotice] = useState<string | null>(null);
  const [testSendError, setTestSendError] = useState<string | null>(null);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDryRunOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isDryRunOpen, onClose]);

  // Fetch active line_friends on open (skip for email-only one-shot)
  useEffect(() => {
    if (!isOpen || isOneShot) return;
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
          const savedUserId =
            typeof window !== 'undefined'
              ? localStorage.getItem('mst_test_send_line_user_id')
              : null;
          if (savedUserId && data.some((f) => f.line_user_id === savedUserId)) {
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
    return () => {
      isMounted = false;
    };
  }, [isOpen, isOneShot]);

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
    setWaitDaysInput(Math.round((scenario.waitMinutes || 0) / 1440));
    setSendTimeWindow(scenario.sendTimeWindow || '09:00-20:00');
    setPreferredSendTime(scenario.preferredSendTime || '');
    setAutomationEnabled(scenario.automationEnabled || false);
    setStopOnBooking(scenario.stopOnBooking ?? true);
    setStopOnDeal(scenario.stopOnDeal ?? true);
    setConsentBasis(
      scenario.consentBasis || 'LINE友だち追加またはフォーム登録時の配信同意に基づく'
    );
    setEmailSubject(scenario.emailSubject || '');
    setEmailBody(scenario.emailBody || '');
    setMessageBody(scenario.messageBody || '');
    setLineMessageType(scenario.lineMessageType || 'flex');
    setFlexTitle(scenario.flexTitle || '');
    setFlexBody(scenario.flexBody || '');
    setFlexAltText(scenario.flexAltText || '');
    setFlexButtonLabel(scenario.flexButtonLabel || '');
    setFlexButtonUrl(scenario.flexButtonUrl || '');
    setActiveTab('editor');
    setShowAdvanced(false);
    setTestSendNotice(null);
    setTestSendError(null);
  }, [scenario]);

  // Detected URLs and linked form detection
  const detectedLinks = useMemo(() => {
    const urls: Array<{ type: 'diagnosis' | 'booking' | 'care' | 'custom'; label: string; url: string }> = [];
    const textToCheck = `${flexButtonUrl} ${messageBody} ${emailBody}`;

    if (
      textToCheck.includes('{link_url}') ||
      textToCheck.includes('{案内URL}') ||
      textToCheck.includes('/diagnosis') ||
      textToCheck.includes('diagnostic')
    ) {
      urls.push({
        type: 'diagnosis',
        label: '3分無料経営ボトルネック診断フォーム',
        url: 'https://corp.mstcorp.info/diagnosis（またはアプリ内 /diagnosis）',
      });
    }
    if (
      textToCheck.includes('{booking_url}') ||
      textToCheck.includes('{面談予約URL}') ||
      textToCheck.includes('calendar') ||
      textToCheck.includes('面談')
    ) {
      urls.push({
        type: 'booking',
        label: '30分無料個別相談・面談予約カレンダー',
        url: 'https://calendar.google.com/calendar/appointments/...（または専用予約枠）',
      });
    }
    if (
      textToCheck.includes('care') ||
      textToCheck.includes('開業') ||
      textToCheck.includes('保険外')
    ) {
      urls.push({
        type: 'care',
        label: '介護保険外サービス開業パッケージ資料・申込フォーム',
        url: 'https://corp.mstcorp.info/care-package',
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
      targetTag: trigger === 'tag_added' ? targetTag.trim() || undefined : undefined,
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

  const handleResetOneShotToDefault = () => {
    const rawDefault = getOneShotOutreachTemplate(
      '{company_name}',
      '{recipient_name}',
      undefined,
      '{link_url}'
    );
    setEmailSubject(rawDefault.subject);
    setEmailBody(rawDefault.body);
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
          throw new Error(
            json.error || `LINE送信エラー (HTTP ${res.status}): ${JSON.stringify(json.lineDetails || json)}`
          );
        }

        const friend = lineFriends.find((f) => f.line_user_id === selectedLineUserId);
        const friendLabel = friend?.display_name || selectedLineUserId;
        setTestSendNotice(`宛先「${friendLabel}」様のLINEトークへテスト送信しました。`);
      } catch (err: any) {
        setTestSendError(err.message || 'テスト送信に失敗しました。');
      } finally {
        setIsSendingTest(false);
      }
    } else {
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

        setTestSendNotice(
          json.message || '管理者メールアドレス宛てにテストメールを送信しました。'
        );
      } catch (err: any) {
        setTestSendError(err.message || 'メールテスト送信に失敗しました。');
      } finally {
        setIsSendingTest(false);
      }
    }
  };

  // Sample values for live preview (plus {industry} / {業種} fallback)
  const previewValues = useMemo(
    () => ({
      ...PLACEHOLDER_SAMPLE_VALUES,
      industry: '製造業',
      業種: '製造業',
    }),
    []
  );

  const renderedEmailSubject = useMemo(
    () => renderPlaceholders(emailSubject || '(件名未設定)', previewValues),
    [emailSubject, previewValues]
  );

  const renderedEmailBodyWithFooter = useMemo(() => {
    const raw = renderPlaceholders(emailBody || messageBody || '(本文未設定)', previewValues);
    return appendEmailFooter(raw, {
      senderEmail: 'contact@mstcorp.info',
      unsubscribeUrl: 'https://corp.mstcorp.info/unsubscribe（送信時に自動発行）',
    });
  }, [emailBody, messageBody, previewValues]);

  // ═══════════════════════════════════════════════════════════════
  // 専用シンプルUI: 単発営業メール（一発直球提案）テンプレート編集
  // ═══════════════════════════════════════════════════════════════
  if (isOneShot) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-2xl max-w-7xl w-[96vw] h-[92vh] shadow-2xl overflow-hidden flex flex-col">
          {/* Clean Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-purple-700">
                単発営業メール テンプレート編集
              </div>
              <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
                {name || '【一発直球】IT担当＋経営サポート「社外右腕」のご提案'}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetOneShotToDefault}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                title="入力欄を初期の標準テンプレート文面に戻します"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>標準文面に戻す</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2-Column Spacious Editor & Live Preview */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* Left: Large Editor */}
            <div className="lg:col-span-7 flex flex-col min-h-0 p-6 space-y-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">件名</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="IT担当と経営サポートを丸ごと引き受ける「社外右腕」のご提案"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-slate-700">本文</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">差し込み:</span>
                    {ONE_SHOT_PLACEHOLDERS.map((p) => (
                      <button
                        key={p.token}
                        type="button"
                        onClick={() => setEmailBody((curr) => `${curr}${p.token}`)}
                        className="px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-[11px] font-medium text-slate-700 hover:text-purple-800 transition cursor-pointer whitespace-nowrap"
                      >
                        + {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={18}
                  placeholder="営業メール本文を入力してください..."
                  className="flex-1 min-h-[360px] w-full bg-white border border-slate-300 rounded-xl p-4 text-sm text-slate-900 font-sans leading-relaxed focus:outline-none focus:border-purple-600 resize-y"
                />
                <p className="text-[11px] text-slate-500 mt-2">
                  ※ 送信時に末尾へ統一署名（会社情報・URL）と配信停止リンクが自動付与されます。
                </p>
              </div>
            </div>

            {/* Right: Live Email Preview & Quick Test Send */}
            <div className="lg:col-span-5 flex flex-col min-h-0 p-6 bg-slate-50/70 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>受信イメージプレビュー（サンプル差込済み）</span>
                </div>
                <button
                  type="button"
                  disabled={isSendingTest}
                  onClick={() => void handleTestSend('email')}
                  className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>管理者へテスト送信</span>
                </button>
              </div>

              {testSendNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{testSendNotice}</span>
                </div>
              )}
              {testSendError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{testSendError}</span>
                </div>
              )}

              <div className="flex-1 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/60 space-y-1">
                  <div className="text-[11px] text-slate-500">
                    宛先例: 株式会社サンプル（製造業） 山田 太郎 様
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{renderedEmailSubject}</div>
                </div>
                <div className="p-4 flex-1 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-800 text-xs font-sans">
                  {renderedEmailBodyWithFooter}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('カスタム編集をリセットして標準テンプレートに戻しますか？')) {
                      onDelete(scenario.id);
                      onClose();
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>保存済みのカスタム設定を解除（標準に戻す）</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>保存して反映</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 標準ステップ編集UI: 編集＋リアルタイムプレビュー横並び ＆ 安全点検
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-7xl w-[96vw] h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Clean Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-purple-700">配信ステップの編集・点検</span>
              <span>·</span>
              <span>{channel === 'line' ? 'LINE' : channel === 'email' ? 'メール' : 'LINE ＋ メール'}</span>
              <span>·</span>
              <span>{waitDaysInput === 0 ? '即時' : `${waitDaysInput}日後`}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
              {name || 'ステップ設定'}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAutomationEnabled(!automationEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border whitespace-nowrap ${
                automationEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{automationEnabled ? '自動実行: ON' : '自動実行: OFF（一時停止）'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Simple 2-Tab Bar */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/60 px-6 gap-2 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`py-2.5 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'editor'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>文面編集 ＆ プレビュー</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('safety')}
            className={`py-2.5 px-3.5 border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'safety'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>リンク確認 ＆ テスト送信</span>
            {detectedLinks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px]">
                {detectedLinks.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Split Edit + Live Preview */}
        {activeTab === 'editor' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Compact Top Settings Strip */}
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/40 shrink-0 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="text-slate-600 font-semibold block mb-1">ステップ名</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="text-slate-600 font-semibold block mb-1">配信チャネル</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as MarketingChannel)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    <option value="line">LINEのみ</option>
                    <option value="email">メールのみ</option>
                    <option value="both">LINE ＋ メール</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-slate-600 font-semibold block mb-1">タイミング</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={waitDaysInput}
                      onChange={(e) => setWaitDaysInput(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono text-center font-bold focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-slate-600 whitespace-nowrap">
                      {waitDaysInput === 0 ? '日後（即時）' : '日後'}
                    </span>
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <span>条件・停止設定</span>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Collapsible Advanced Trigger & Stop Conditions */}
              {showAdvanced && (
                <div className="pt-2.5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">開始トリガー</label>
                    <select
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value as MarketingTrigger)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                    >
                      <option value="tag_added">指定タグが付いた時</option>
                      <option value="line_registered">LINE友だち追加時</option>
                      <option value="diagnosis_completed">無料診断の回答完了時</option>
                      <option value="report_approved">診断レポート承認時</option>
                      <option value="report_sent">診断レポート送付時</option>
                      <option value="lead_created">見込み客登録時</option>
                      <option value="outreach_first_sent">営業メール第1通送信時</option>
                      <option value="booking_created">個別相談予約時</option>
                      <option value="manual">手動開始</option>
                    </select>
                  </div>

                  {trigger === 'tag_added' ? (
                    <div>
                      <label className="text-slate-600 font-semibold block mb-1">対象タグ</label>
                      <select
                        value={targetTag}
                        onChange={(e) => setTargetTag(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">すべてのタグ</option>
                        {UNIFIED_TAG_MASTER.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-600 font-semibold block mb-1">希望配信時刻（JST）</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={preferredSendTime}
                          onChange={(e) => setPreferredSendTime(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500"
                        />
                        {preferredSendTime && (
                          <button
                            type="button"
                            onClick={() => setPreferredSendTime('')}
                            className="px-2 py-1.5 text-[11px] rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            解除
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-slate-600 font-semibold block mb-1">配信時間帯ガード</label>
                    <input
                      type="text"
                      value={sendTimeWindow}
                      onChange={(e) => setSendTimeWindow(e.target.value)}
                      placeholder="09:00-20:00"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex flex-col justify-center gap-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={stopOnBooking}
                        onChange={(e) => setStopOnBooking(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>面談予約で自動停止</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={stopOnDeal}
                        onChange={(e) => setStopOnDeal(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>成約・契約締結で自動停止</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Main Side-by-Side Editor & Live Preview */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Column: Message Editors */}
              <div className="lg:col-span-7 p-6 overflow-y-auto space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200">
                {(channel === 'line' || channel === 'both') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>LINE配信メッセージ</span>
                      </div>
                      <select
                        value={lineMessageType}
                        onChange={(e) => setLineMessageType(e.target.value as MarketingLineMessageType)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 text-xs font-semibold cursor-pointer focus:outline-none focus:border-emerald-500"
                      >
                        <option value="flex">Flexカード（ボタン付き）</option>
                        <option value="text">通常テキスト</option>
                      </select>
                    </div>

                    {lineMessageType === 'flex' ? (
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-slate-700 font-bold block mb-1">カード見出し</label>
                          <input
                            type="text"
                            value={flexTitle}
                            onChange={(e) => setFlexTitle(e.target.value)}
                            placeholder="例：【無料】業務ボトルネック診断（約3分）"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-700 font-bold block mb-1">カード本文</label>
                          <textarea
                            rows={channel === 'line' ? 9 : 6}
                            value={flexBody}
                            onChange={(e) => setFlexBody(e.target.value)}
                            placeholder="カードに表示するメッセージ。{お名前} などの差し込みが利用できます。"
                            className="w-full min-h-[170px] bg-white border border-slate-300 rounded-xl p-3.5 text-sm text-slate-900 leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                          />
                          <PlaceholderAssist
                            text={flexBody}
                            onInsert={(token) => setFlexBody((curr) => curr + token)}
                            showPreview={false}
                            compact
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-700 font-bold block mb-1">ボタン名</label>
                            <input
                              type="text"
                              value={flexButtonLabel}
                              onChange={(e) => setFlexButtonLabel(e.target.value)}
                              placeholder="例：3分診断を始める"
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-slate-700 font-bold">ボタンURL</label>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => setFlexButtonUrl('{link_url}')}
                                  className="text-purple-700 hover:underline cursor-pointer"
                                >
                                  診断URL
                                </button>
                                <span className="text-slate-300">/</span>
                                <button
                                  type="button"
                                  onClick={() => setFlexButtonUrl('{booking_url}')}
                                  className="text-purple-700 hover:underline cursor-pointer"
                                >
                                  面談予約URL
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              value={flexButtonUrl}
                              onChange={(e) => setFlexButtonUrl(e.target.value)}
                              placeholder="{link_url} や {booking_url}"
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs">
                        <label className="text-slate-700 font-bold block mb-1">LINEトーク本文</label>
                        <textarea
                          rows={channel === 'line' ? 15 : 8}
                          value={messageBody}
                          onChange={(e) => setMessageBody(e.target.value)}
                          placeholder="LINEの吹き出しに送るテキストを入力してください。"
                          className="w-full min-h-[240px] bg-white border border-slate-300 rounded-xl p-4 text-sm text-slate-900 font-sans leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                        />
                        <PlaceholderAssist
                          text={messageBody}
                          onInsert={(token) => setMessageBody((curr) => curr + token)}
                          showPreview={false}
                          compact
                        />
                      </div>
                    )}
                  </div>
                )}

                {(channel === 'email' || channel === 'both') && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 font-bold text-slate-900 text-sm">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>メール配信メッセージ</span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">件名</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="【MST】3分無料経営診断のご案内"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">メール本文</label>
                      <textarea
                        rows={channel === 'email' ? 16 : 9}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="メール本文を入力してください。"
                        className="w-full min-h-[260px] bg-white border border-slate-300 rounded-xl p-4 text-sm text-slate-900 font-sans leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
                      />
                      <PlaceholderAssist
                        text={emailBody}
                        onInsert={(token) => setEmailBody((curr) => curr + token)}
                        showPreview={false}
                        compact
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Side-by-Side Preview */}
              <div className="lg:col-span-5 p-6 bg-slate-50/70 overflow-y-auto space-y-5">
                <div className="text-xs font-semibold text-slate-600">
                  リアルタイムプレビュー（サンプル差込済み）
                  {trigger !== 'tag_added' && (
                    <span className="ml-2 text-slate-400">
                      · 条件: {TRIGGER_LABELS[trigger] || trigger}
                    </span>
                  )}
                </div>

                {(channel === 'line' || channel === 'both') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>LINE表示イメージ</span>
                    </div>
                    <div className="p-3.5 bg-[#7494c0] rounded-2xl">
                      {lineMessageType === 'text' ? (
                        <LineMessagePreview
                          type="text"
                          text={renderPlaceholders(
                            messageBody || '（本文がここに表示されます）',
                            previewValues
                          )}
                          title="LINEメッセージ"
                        />
                      ) : (
                        <LineMessagePreview
                          type="flex"
                          title={flexTitle || 'LINE Flexカード'}
                          payload={{
                            altText: flexAltText || 'LINE Flexメッセージ',
                            contents: {
                              type: 'bubble',
                              body: {
                                type: 'box',
                                layout: 'vertical',
                                spacing: 'md',
                                contents: [
                                  {
                                    type: 'text',
                                    text: renderPlaceholders(flexTitle || '見出しタイトル', previewValues),
                                    weight: 'bold',
                                    size: 'xl',
                                    wrap: true,
                                  },
                                  {
                                    type: 'text',
                                    text: renderPlaceholders(
                                      flexBody || 'カード説明文がここに表示されます。',
                                      previewValues
                                    ),
                                    size: 'sm',
                                    wrap: true,
                                    margin: 'md',
                                  },
                                ],
                              },
                              ...(flexButtonLabel && flexButtonUrl
                                ? {
                                    footer: {
                                      type: 'box',
                                      layout: 'vertical',
                                      contents: [
                                        {
                                          type: 'button',
                                          style: 'primary',
                                          action: {
                                            type: 'uri',
                                            label: flexButtonLabel,
                                            uri: flexButtonUrl,
                                          },
                                        },
                                      ],
                                    },
                                  }
                                : {}),
                            },
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {(channel === 'email' || channel === 'both') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                      <Mail className="w-3.5 h-3.5" />
                      <span>メール受信イメージ</span>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="border-b border-slate-200 px-4 py-2.5 bg-slate-50/70">
                        <span className="text-[10px] text-slate-500 block">件名</span>
                        <div className="font-bold text-slate-900 text-xs">{renderedEmailSubject}</div>
                      </div>
                      <div className="p-4 whitespace-pre-wrap leading-relaxed text-slate-800 text-xs font-sans max-h-96 overflow-y-auto">
                        {renderedEmailBodyWithFooter}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Link Safety & Live Test Send */}
        {activeTab === 'safety' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 text-xs">
            {/* Test Send Section */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Send className="w-4 h-4 text-purple-600" />
                    <span>実機テスト送信</span>
                  </h4>
                  <p className="text-slate-500 mt-0.5">
                    編集中の文面やボタンリンクを管理者のLINE・メール宛に送って実機で確認できます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDryRunOpen(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>配信シミュレーション（ドライラン）</span>
                </button>
              </div>

              {(channel === 'line' || channel === 'both') && (
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-bold block">テスト送信先のLINE友だち</label>
                  {loadingFriends ? (
                    <div className="flex items-center gap-2 text-slate-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      <span>友だち一覧を読み込み中...</span>
                    </div>
                  ) : lineFriends.length > 0 ? (
                    <select
                      value={selectedLineUserId}
                      onChange={(e) => handleSelectLineUser(e.target.value)}
                      disabled={isSendingTest}
                      className="w-full max-w-md bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-purple-500"
                    >
                      <option value="">-- 送信先友だちを選択 --</option>
                      {lineFriends.map((friend) => (
                        <option key={friend.line_user_id} value={friend.line_user_id}>
                          {friend.display_name || '表示名なし'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                      有効なLINE友だちが登録されていません。公式LINEを自分のLINEで友だち追加すると選択できます。
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {(channel === 'line' || channel === 'both') && (
                  <button
                    type="button"
                    disabled={isSendingTest || !selectedLineUserId || lineFriends.length === 0}
                    onClick={() => handleTestSend('line')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    {isSendingTest ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MessageCircle className="w-4 h-4" />
                    )}
                    <span>LINEへテスト送信</span>
                  </button>
                )}

                {(channel === 'email' || channel === 'both') && (
                  <button
                    type="button"
                    disabled={isSendingTest}
                    onClick={() => handleTestSend('email')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>管理者宛にメールテスト送信</span>
                  </button>
                )}
              </div>

              {testSendNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>{testSendNotice}</div>
                </div>
              )}

              {testSendError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>{testSendError}</div>
                </div>
              )}
            </div>

            {/* Detected Linked Forms & URLs */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>文面内のリンク・フォーム連動チェック</span>
              </div>

              {detectedLinks.map((item, idx) => (
                <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">{item.label}</div>
                      <div className="font-mono text-[11px] text-purple-700 break-all">{item.url}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shrink-0 inline-flex items-center gap-1 self-start sm:self-auto">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>リンク検出済み</span>
                    </span>
                  </div>

                  {item.type === 'diagnosis' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {QUESTIONNAIRE_V1.flatMap((cat) => cat.questions)
                        .slice(0, 4)
                        .map((q, qIdx) => (
                          <div key={q.id} className="p-2.5 rounded-lg bg-white border border-slate-200">
                            <span className="text-purple-700 font-bold block text-[10px]">
                              設問 {qIdx + 1}
                            </span>
                            <span className="text-slate-900 font-medium">{q.label}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {item.type === 'booking' && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700">
                      予約確定時に「個別相談予約済み」タグが付き、フォロー配信は自動停止します。
                    </div>
                  )}
                </div>
              ))}

              {detectedLinks.length === 0 && (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                  このメッセージにはフォームや予約カレンダーへのリンクが含まれていません。
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
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

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>保存して反映</span>
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
            waitMinutes: waitDaysInput * 1440,
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
