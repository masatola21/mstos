import React, { useEffect, useMemo, useState } from 'react';
import {
  Inbox,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Eye,
  ShieldCheck,
  RotateCcw,
  Paperclip,
  FileText,
  Trash2,
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';

export interface OutboxMessage {
  id: string;
  channel: 'email' | 'line';
  source_type?: string | null;
  source_id?: string | null;
  recipient_address?: string | null;
  recipient_contact_id?: string | null;
  deal_id?: string | null;
  document_id?: string | null;
  subject?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  status: 'draft' | 'awaiting_approval' | 'queued' | 'sending' | 'sent' | 'failed' | 'canceled';
  consent_basis?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
  sent_at?: string | null;
}

interface Props {}

const statusLabels: Record<OutboxMessage['status'], { label: string; color: string; bg: string; border: string }> = {
  awaiting_approval: { label: '送信前（旧）', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  queued: { label: '送信待ち', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  sending: { label: '送信中', color: 'text-indigo-800', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  sent: { label: '送信完了', color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  failed: { label: '送信失敗', color: 'text-rose-800', bg: 'bg-rose-50', border: 'border-rose-200' },
  canceled: { label: '取消済み', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  draft: { label: '下書き', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
};

const sourceTypeLabels: Record<string, string> = {
  document: '重要書類送付',
  customer_document: '重要書類送付',
  deal_invitation: '商談予約案内',
  customer_meeting_invitation: '顧客面談案内',
  marketing_broadcast: '一斉配信',
  marketing_outreach: '営業メール配信',
  marketing_automation: '自動ステップ配信',
  announcement: '個別案内',
  form: '受付フォーム案内',
  diagnosis: '診断案内',
  material_download: '資料送付（自動）',
  care_package_inquiry: '開業パッケージ受付',
  diagnosis_submission: 'サンクス自動返信',
  intake_thanks: 'サンクス自動返信',
  marketing_test_send: 'テスト送信',
  manual_send: '手動個別送信',
  scenario_step: 'シナリオ自動配信',
  line_auto_reply: 'LINE自動応答',
};

export const CommunicationOutboxHistoryView: React.FC<Props> = () => {
  const [messages, setMessages] = useState<OutboxMessage[]>([]);
  const [contacts, setContacts] = useState<Record<string, { full_name: string; company_name?: string }>>({});
  const [emailContacts, setEmailContacts] = useState<Record<string, { full_name: string; company_name?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OutboxMessage['status']>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'line'>('all');
  const [selectedMessage, setSelectedMessage] = useState<OutboxMessage | null>(null);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const [outboxRes, contactsRes, companiesRes, leadsRes] = await Promise.all([
        supabase
          .from('communication_outbox')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('contacts').select('id, full_name, email, company_id'),
        supabase.from('companies').select('id, company_name'),
        supabase.from('leads').select('id, name, company_name, email'),
      ]);

      if (outboxRes.error) throw outboxRes.error;

      const compMap: Record<string, string> = {};
      (companiesRes.data || []).forEach((c: any) => {
        compMap[c.id] = c.company_name;
      });

      const contactMap: Record<string, { full_name: string; company_name?: string }> = {};
      const emailMap: Record<string, { full_name: string; company_name?: string }> = {};

      (leadsRes.data || []).forEach((ld: any) => {
        if (ld.email) {
          const cleanEmail = String(ld.email).trim().toLowerCase();
          emailMap[cleanEmail] = {
            full_name: ld.name,
            company_name: ld.company_name,
          };
        }
      });

      (contactsRes.data || []).forEach((ct: any) => {
        const info = {
          full_name: ct.full_name,
          company_name: ct.company_id ? compMap[ct.company_id] : undefined,
        };
        contactMap[ct.id] = info;
        if (ct.email) {
          emailMap[String(ct.email).trim().toLowerCase()] = info;
        }
      });

      setContacts(contactMap);
      setEmailContacts(emailMap);
      setMessages((outboxRes.data || []) as OutboxMessage[]);
      setLastUpdatedAt(new Date());
    } catch (err: any) {
      setError(err?.message || '送信履歴の読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const retryMessage = async (messageId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setError('');
    setNotice('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('ログイン状態を確認できません。');

      const { error: updateError } = await supabase
        .from('communication_outbox')
        .update({ status: 'queued', error_message: null, updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (updateError) throw updateError;

      const response = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outboxId: messageId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.status !== 'sent') {
        throw new Error(result.error || '再送信に失敗しました。');
      }
      setNotice('再送信を完了しました。');
      await loadData();
    } catch (err: any) {
      setError(err?.message || '再送信に失敗しました。');
      await loadData();
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!window.confirm('この送信履歴を削除しますか？\n（送信記録がデータベースから削除されます）')) return;
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { error: deleteError } = await supabase
        .from('communication_outbox')
        .delete()
        .eq('id', messageId);

      if (deleteError) throw deleteError;
      setNotice('送信履歴を削除しました。');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || '送信履歴の削除に失敗しました。');
    }
  };

  const deleteSelectedMessages = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`選択した ${selectedIds.size} 件の送信履歴を削除しますか？`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { error: deleteError } = await supabase
        .from('communication_outbox')
        .delete()
        .in('id', Array.from(selectedIds));

      if (deleteError) throw deleteError;
      setNotice(`${selectedIds.size} 件の送信履歴を削除しました。`);
      setSelectedIds(new Set());
      await loadData();
    } catch (err: any) {
      setError(err?.message || '選択した送信履歴の削除に失敗しました。');
    }
  };

  // Stats
  const counts = useMemo(() => {
    const res = {
      all: messages.length,
      sent: 0,
      failed: 0,
    };
    messages.forEach((m) => {
      if (m.status === 'sent') res.sent++;
      else if (m.status === 'failed') res.failed++;
    });
    return res;
  }, [messages]);

  // Filtered Messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) {
        return false;
      }
      if (channelFilter !== 'all' && m.channel !== channelFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contactInfo = (m.recipient_contact_id ? contacts[m.recipient_contact_id] : null) || (m.recipient_address ? emailContacts[m.recipient_address.trim().toLowerCase()] : null);
        const recipientText = (m.recipient_address || '').toLowerCase();
        const contactName = (contactInfo?.full_name || '').toLowerCase();
        const compName = (contactInfo?.company_name || '').toLowerCase();
        const subjectText = (m.subject || '').toLowerCase();
        const bodyText = (m.body_text || '').toLowerCase();
        if (!recipientText.includes(q) && !contactName.includes(q) && !compName.includes(q) && !subjectText.includes(q) && !bodyText.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [messages, statusFilter, channelFilter, searchQuery, contacts, emailContacts]);

  return (
    <div className="space-y-5">
      {/* ── Status KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'all'
              ? 'border-purple-500 bg-purple-50/50 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-500">全送信履歴</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{counts.all}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('sent')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'sent'
              ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-semibold text-emerald-700">送信完了</div>
          <div className="text-xl font-bold text-emerald-800 mt-1">{counts.sent}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('failed')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'failed'
              ? 'border-rose-500 bg-rose-50/50 shadow-xs'
              : counts.failed > 0
              ? 'border-rose-300 bg-rose-50/30 hover:bg-rose-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-semibold text-rose-700">送信失敗</div>
          <div className={`text-xl font-bold mt-1 ${counts.failed > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {counts.failed}
          </div>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="p-1 text-rose-500 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 shadow-2xs font-semibold flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="p-1 text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="宛先、件名、本文、会社名で検索…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none transition shadow-2xs"
            />
          </div>

          {/* Right Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setChannelFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  channelFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全チャンネル
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('email')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  channelFilter === 'email' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3 h-3 text-purple-600" />
                <span>メール</span>
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('line')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  channelFilter === 'line' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3 h-3 text-emerald-600" />
                <span>LINE</span>
              </button>
            </div>

            {lastUpdatedAt && (
              <span
                className="text-[11px] text-slate-500 whitespace-nowrap"
                title="この画面は自動更新されません。最新の状態は「更新」を押して確認してください。"
              >
                最終更新 {lastUpdatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => void deleteSelectedMessages()}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>選択した {selectedIds.size} 件を削除</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
              <span>更新</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Outbox Table / List ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-purple-600" />
            <span className="font-bold text-xs text-slate-900">
              送信履歴一覧 ({filteredMessages.length}件)
            </span>
          </div>
        </div>

        {loading && messages.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            送信履歴を読み込み中…
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">
              該当する送信メッセージはありません
            </p>
            <p className="text-[11px] text-slate-400">
              {searchQuery || statusFilter !== 'all' || channelFilter !== 'all'
                ? '検索条件やフィルターを変更してお試しください。'
                : '書類送付・一斉配信・営業メールを実行すると、この送信台帳に記録されます。'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="すべて選択"
                      checked={filteredMessages.length > 0 && selectedIds.size === filteredMessages.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      title="全選択 / 全解除"
                    />
                  </th>
                  <th className="py-2.5 px-4">状態</th>
                  <th className="py-2.5 px-4">チャンネル</th>
                  <th className="py-2.5 px-4">宛先・相手企業</th>
                  <th className="py-2.5 px-4">種別 / 件名・本文抜粋</th>
                  <th className="py-2.5 px-4">登録日時</th>
                  <th className="py-2.5 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredMessages.map((msg) => {
                  const statusMeta = statusLabels[msg.status] || {
                    label: msg.status,
                    color: 'text-slate-700',
                    bg: 'bg-slate-100',
                    border: 'border-slate-200',
                  };
                  const contactInfo = (msg.recipient_contact_id ? contacts[msg.recipient_contact_id] : null) || (msg.recipient_address ? emailContacts[msg.recipient_address.trim().toLowerCase()] : null);
                  const isSelected = selectedIds.has(msg.id);

                  return (
                    <tr
                      key={msg.id}
                      className={`hover:bg-purple-50/20 transition-colors cursor-pointer group ${isSelected ? 'bg-purple-50/30' : ''}`}
                      onClick={() => setSelectedMessage(msg)}
                    >
                      {/* チェックボックス */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`${msg.subject || '送信履歴'}を選択`}
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(msg.id);
                              else next.delete(msg.id);
                              return next;
                            });
                          }}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>

                      {/* 状態 */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusMeta.bg} ${statusMeta.color} ${statusMeta.border}`}>
                          {msg.status === 'sent' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {msg.status === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
                          <span>{statusMeta.label}</span>
                        </span>
                      </td>

                      {/* チャンネル */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          msg.channel === 'line'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-purple-50 text-purple-800 border border-purple-200'
                        }`}>
                          {msg.channel === 'line' ? <MessageSquare className="w-3 h-3 text-emerald-600" /> : <Mail className="w-3 h-3 text-purple-600" />}
                          <span>{msg.channel === 'line' ? 'LINE' : 'メール'}</span>
                        </span>
                      </td>

                      {/* 宛先 */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          {contactInfo ? contactInfo.full_name : msg.recipient_address || '宛先未指定'}
                        </div>
                        {contactInfo?.company_name && (
                          <div className="text-[11px] text-slate-500">
                            {contactInfo.company_name}
                          </div>
                        )}
                        {!contactInfo && msg.recipient_address && (
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                            {msg.recipient_address}
                          </div>
                        )}
                      </td>

                      {/* 件名・本文抜粋 */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {msg.source_type && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600">
                              {sourceTypeLabels[msg.source_type] || msg.source_type}
                            </span>
                          )}
                          {msg.document_id && (
                            <span className="inline-flex items-center text-purple-600 shrink-0" title="書類添付あり">
                              <Paperclip className="w-3 h-3" />
                            </span>
                          )}
                          <span className="font-semibold text-slate-900 truncate block">
                            {msg.subject || (msg.body_text ? msg.body_text.slice(0, 30) : '件名なし')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {msg.body_text ? msg.body_text.replace(/\s+/g, ' ').slice(0, 60) : '（本文なし）'}
                        </div>
                      </td>

                      {/* 日時 */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        <div>{new Date(msg.created_at).toLocaleDateString('ja-JP')}</div>
                        <div className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      {/* アクション */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {msg.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => void retryMessage(msg.id)}
                              className="rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 transition cursor-pointer flex items-center gap-1"
                              title="再送信を実行します"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>再送信</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedMessage(msg)}
                            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-1 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            title="詳細と本文を確認"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteMessage(msg.id)}
                            className="rounded-lg border border-slate-200 bg-white hover:bg-rose-50 p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="この送信履歴を削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-900">送信履歴の記録範囲について</p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            個別送信・一斉配信・重要書類送付・LINE応答・自動ステップ配信など、実際に送信されたメール・LINEの履歴がすべてこの台帳に記録されます。送信失敗時は「再送信」からやり直せます。
          </p>
        </div>
      </div>

      {/* ── Message Detail Modal ── */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                  selectedMessage.channel === 'line'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-purple-50 text-purple-800 border border-purple-200'
                }`}>
                  {selectedMessage.channel === 'line' ? 'LINE送信' : 'メール送信'}
                </span>
                <span className="font-bold text-sm text-slate-900">
                  送信メッセージ詳細
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Status and dates */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">ステータス</span>
                  <span className="font-bold text-slate-900">
                    {statusLabels[selectedMessage.status]?.label || selectedMessage.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">登録日時</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(selectedMessage.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">送信先 / 企業・担当者</span>
                  <div className="font-semibold text-slate-800">
                    {(() => {
                      const c = (selectedMessage.recipient_contact_id ? contacts[selectedMessage.recipient_contact_id] : null) || (selectedMessage.recipient_address ? emailContacts[selectedMessage.recipient_address.trim().toLowerCase()] : null);
                      if (c) {
                        return (
                          <span>
                            {c.full_name} {c.company_name ? `(${c.company_name})` : ''}
                            <span className="block font-mono text-[11px] text-slate-500 break-all">{selectedMessage.recipient_address}</span>
                          </span>
                        );
                      }
                      return <span className="font-mono text-slate-800 break-all">{selectedMessage.recipient_address || '未指定'}</span>;
                    })()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">同意根拠（オプトイン）</span>
                  <span className="font-semibold text-slate-700">
                    {selectedMessage.consent_basis || '記録なし'}
                  </span>
                </div>
              </div>

              {selectedMessage.error_message && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
                  <div className="font-bold text-xs mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>送信エラー内容</span>
                  </div>
                  <div className="text-[11px] font-mono break-all">
                    {selectedMessage.error_message}
                  </div>
                </div>
              )}

              {/* Attached document if any */}
              {selectedMessage.document_id && (
                <div>
                  <span className="text-slate-500 block font-semibold mb-1 text-xs">添付・関連書類</span>
                  <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-purple-950 block truncate">
                          送信用添付書類 (ID: {selectedMessage.document_id})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          本文内の閲覧用URLで顧客に提示された重要書類です
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`/api/documents/${encodeURIComponent(selectedMessage.document_id!)}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                        title="添付されたPDFファイルをダウンロード確認"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>PDF確認</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewDocumentId(selectedMessage.document_id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-purple-300 text-purple-800 hover:bg-purple-100 text-xs font-bold shrink-0 cursor-pointer shadow-2xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>書類プレビュー</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Subject */}
              {selectedMessage.subject && (
                <div>
                  <span className="text-slate-500 block font-semibold mb-1">件名</span>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm">
                    {selectedMessage.subject}
                  </div>
                </div>
              )}

              {/* Body */}
              <div>
                <span className="text-slate-500 block font-semibold mb-1">本文プレビュー</span>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-800 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {selectedMessage.body_text || '（プレビュー用テキストなし）'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                {selectedMessage.status === 'failed' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await retryMessage(selectedMessage.id);
                      setSelectedMessage(null);
                    }}
                    className="rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 cursor-pointer"
                  >
                    再送信を実行
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const id = selectedMessage.id;
                    setSelectedMessage(null);
                    await deleteMessage(id);
                  }}
                  className="rounded-xl border border-rose-200 bg-white hover:bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 flex items-center gap-1 cursor-pointer transition"
                  title="この送信履歴を削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>削除</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添付書類プレビューモーダル */}
      {previewDocumentId && (
        <DocumentPreviewModal
          documentId={previewDocumentId}
          onClose={() => setPreviewDocumentId(null)}
        />
      )}
    </div>
  );
};
