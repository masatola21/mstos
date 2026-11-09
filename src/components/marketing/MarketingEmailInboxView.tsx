import React, { useEffect, useState } from 'react';
import { Mail, Reply, Send, RefreshCw, Settings, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Copy, ShieldCheck } from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import { useSendDrawer } from '../../context/SendDrawerContext';

type InboxMessage = {
  id: string;
  from_email: string;
  to_emails: string[];
  subject: string;
  text_body: string;
  html_body: string;
  received_at: string;
  backup_status?: 'sent' | 'failed' | 'skipped';
  backup_error?: string | null;
};

// 送信元は「名前 <アドレス>」の形で届くことがあるため、名前とアドレスに分ける
function parseSender(raw: string): { name: string; address: string } {
  const text = (raw || '').trim();
  const match = text.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), address: match[2].trim() };
  return { name: '', address: text };
}

export interface MarketingEmailInboxViewProps {
  onNavigateSendCenter?: () => void;
}

export const MarketingEmailInboxView: React.FC<MarketingEmailInboxViewProps> = ({ onNavigateSendCenter }) => {
  const db = getSupabase();
  const { openSendDrawer } = useSendDrawer();
  const [ownerId, setOwnerId] = useState('');
  const [address, setAddress] = useState('');
  const [backupAddress, setBackupAddress] = useState('mst.shikumikaizen@gmail.com');
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [savedConfig, setSavedConfig] = useState({
    address: '',
    backupAddress: 'mst.shikumikaizen@gmail.com',
    backupEnabled: false,
  });

  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [testingForward, setTestingForward] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // 未保存の変更があるかどうか判定
  const isDirty =
    address.trim().toLowerCase() !== savedConfig.address.trim().toLowerCase() ||
    backupAddress.trim().toLowerCase() !== savedConfig.backupAddress.trim().toLowerCase() ||
    backupEnabled !== savedConfig.backupEnabled;

  // 連絡先に登録されている名前を優先し、なければメールの送信者名を使う
  const senderOf = (raw: string) => {
    const parsed = parseSender(raw);
    const name = contactNames[parsed.address.toLowerCase()] || parsed.name;
    return { name: name && name.toLowerCase() !== parsed.address.toLowerCase() ? name : '', address: parsed.address };
  };

  const handleReplySelected = () => {
    if (!selected) return;
    const cleanBody = selected.text_body || selected.html_body.replace(/<[^>]*>/g, ' ');
    const quote = `\n\n\n--- ${selected.from_email} からの引用メッセージ ---\n${cleanBody.trim()}`;
    const replySubject = selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject || ''}`;
    openSendDrawer({
      channel: 'email',
      kind: 'announcement',
      subject: replySubject,
      body: quote,
      initialRecipientEmail: parseSender(selected.from_email).address,
    });
  };

  const load = async () => {
    if (!db) return;
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) {
      setError('ログインしてください。');
      return;
    }
    setOwnerId(auth.user.id);

    let inAddress = '';
    let fwdAddress = 'mst.shikumikaizen@gmail.com';
    let fwdEnabled = false;
    let loadedMessages: InboxMessage[] = [];

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inbox/email/messages', { headers });
      if (res.ok) {
        const apiData = await res.json();
        if (apiData.success) {
          inAddress = apiData.inboundAddress || '';
          fwdAddress = apiData.backupForwardAddress || 'mst.shikumikaizen@gmail.com';
          fwdEnabled = Boolean(apiData.backupForwardEnabled);
          loadedMessages = (apiData.messages || []) as InboxMessage[];
        }
      }
    } catch {}

    if (loadedMessages.length === 0 && inAddress === '') {
      try {
        const [settings, inbox] = await Promise.all([
          db.from('email_channel_integrations').select('inbound_address, backup_forward_address, backup_forward_enabled').eq('owner_id', auth.user.id).maybeSingle(),
          db.from('email_inbox_messages').select('id, from_email, to_emails, subject, text_body, html_body, received_at, backup_status, backup_error').order('received_at', { ascending: false }).limit(500),
        ]);
        inAddress = settings.data?.inbound_address || '';
        fwdAddress = settings.data?.backup_forward_address || 'mst.shikumikaizen@gmail.com';
        fwdEnabled = Boolean(settings.data?.backup_forward_enabled);
        loadedMessages = (inbox.data || []) as InboxMessage[];
      } catch (err: any) {
        console.warn('Fallback direct query error:', err);
      }
    }
    setMessages(loadedMessages);
    setCheckedIds([]);

    // 選択中メッセージのステータス同期
    if (selected) {
      const refreshed = loadedMessages.find((m) => m.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }

    // 送信者の名前を連絡先から引く
    const { data: contacts } = await db.from('contacts').select('full_name,email').not('email', 'is', null).limit(5000);
    const names: Record<string, string> = {};
    (contacts || []).forEach((c: any) => {
      if (c.email && c.full_name) names[String(c.email).trim().toLowerCase()] = String(c.full_name);
    });
    setContactNames(names);
 (fix: resolve email inbox permission denial, restore selectable materials checkboxes, and revert contact form options to 4 themes)
  };

  const deleteMessages = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(ids.length + '件のメールを受信箱から削除します。元に戻せません。よろしいですか？')) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/inbox/email/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ids }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'メールを削除できませんでした。');
      const deleted = new Set<string>((result.deletedIds || []).map(String));
      setMessages((prev) => prev.filter((m) => !deleted.has(m.id)));
      setCheckedIds((prev) => prev.filter((id) => !deleted.has(id)));
      setSelected((current) => (current && deleted.has(current.id) ? null : current));
      const failed = ids.length - deleted.size;
      setNotice(deleted.size + '件のメールを削除しました。' + (failed > 0 ? '（' + failed + '件は削除できませんでした）' : ''));
    } catch (e: any) {
      setError(e?.message || 'メールを削除できませんでした。');
    } finally {
      setDeleting(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!ownerId) return;
    const inVal = address.trim().toLowerCase();
    const fwdVal = backupAddress.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (inVal && !emailPattern.test(inVal)) {
      setError('受信用メールアドレスを正しく入力してください。');
      return;
    }
    if (backupEnabled && (!fwdVal || !emailPattern.test(fwdVal))) {
      setError('控えの自動転送先メールアドレスを正しく入力してください。');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/inbox/email/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ address: inVal, backupAddress: fwdVal, backupEnabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '設定を保存できませんでした。');

      setSavedConfig({
        address: inVal,
        backupAddress: fwdVal,
        backupEnabled,
      });
      setNotice('受信および控え自動転送の設定を保存しました。');
    } catch (e: any) {
      if (db) {
        const { error: err } = await db.from('email_channel_integrations').upsert(
          {
            owner_id: ownerId,
            inbound_address: inVal,
            backup_forward_address: fwdVal,
            backup_forward_enabled: backupEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'owner_id' }
        );
        if (err) setError(err.message);
        else {
          setSavedConfig({
            address: inVal,
            backupAddress: fwdVal,
            backupEnabled,
          });
          setNotice('受信および控え自動転送の設定を保存しました。');
        }
      } else {
        setError(e?.message || '設定の保存に失敗しました。');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTestForward = async () => {
    const fwdVal = backupAddress.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!fwdVal || !emailPattern.test(fwdVal)) {
      setError('テスト送信先のバックアップアドレスを正しく入力してください。');
      return;
    }

    setTestingForward(true);
    setError('');
    setNotice('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/email/test-backup-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ backup_forward_address: fwdVal }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'テスト送信に失敗しました。');
      setNotice(`控え転送のテストメールを「${fwdVal}」宛てに送信しました。Gmail等で受信をご確認ください。`);
    } catch (err: any) {
      setError(err?.message || 'テスト送信中にエラーが発生しました。');
    } finally {
      setTestingForward(false);
    }
  };

  const handleRetryBackup = async (msgId: string) => {
    setRetryingId(msgId);
    setError('');
    setNotice('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/email/inbox/${encodeURIComponent(msgId)}/retry-backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || '控え転送の再送に失敗しました。');
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, backup_status: 'sent', backup_error: null } : m))
      );
      if (selected && selected.id === msgId) {
        setSelected({ ...selected, backup_status: 'sent', backup_error: null });
      }
      setNotice('控えメールを再送しました（Gmail等へコピー送信完了）。');
    } catch (err: any) {
      setError(err?.message || '控えメールの再送に失敗しました。');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 受信設定および控え転送（Gmailコピー）統合設定ツールバー */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:px-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* 受信アドレス設定 */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${address ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span>受信アドレス:</span>
              </span>
              <input
                type="email"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="contact@mstcorp.info"
                maxLength={254}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 w-44 sm:w-52"
              />
            </div>

            <span className="text-slate-300 hidden sm:inline">|</span>

            {/* バックアップ自動転送設定 */}
            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={backupEnabled}
                  onChange={(e) => setBackupEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-purple-600 cursor-pointer"
                />
                <span className={`text-xs font-semibold ${backupEnabled ? 'text-purple-700' : 'text-slate-600'}`}>
                  Gmail控え自動転送
                </span>
              </label>

              <input
                type="email"
                value={backupAddress}
                onChange={(e) => setBackupAddress(e.target.value)}
                placeholder="mst.shikumikaizen@gmail.com"
                maxLength={254}
                disabled={!backupEnabled}
                className="px-2 py-0.5 text-xs rounded border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 w-48 sm:w-56 disabled:opacity-50"
                title="受信トレイに届いたメールの控え（コピー）を自動転送する宛先"
              />

              <button
                type="button"
                onClick={() => void handleTestForward()}
                disabled={testingForward}
                className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                title="入力中の転送先宛てに控えテストメールを即座に送信します"
              >
                {testingForward ? '送信中...' : 'テスト送信'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
            {isDirty && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse">
                ● 未保存の変更があります
              </span>
            )}
            <button
              disabled={busy}
              onClick={() => void save()}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {busy ? '保存中...' : '設定を保存'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
              title="Webhook設定の詳細を表示/非表示"
            >
              {showConfig ? '閉じる' : '連携ヘルプ'}
            </button>
          </div>
        </div>

        {/* 状態・件数バー */}
        <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-3">
            <span>
              受信数: <strong className="text-slate-800">{messages.length}件</strong>
            </span>
            <span>·</span>
            <span>
              転送状態:{' '}
              {backupEnabled ? (
                <span className="text-emerald-700 font-semibold">ON ({backupAddress})</span>
              ) : (
                <span className="text-slate-500">OFF（控え転送なし）</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              title="最新メールを再読み込み"
            >
              <RefreshCw className="h-3 w-3" />
              <span>更新</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (selected) {
                  handleReplySelected();
                } else {
                  openSendDrawer({ channel: 'email', kind: 'announcement' });
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold transition cursor-pointer"
            >
              <Send className="h-3 w-3" />
              <span>{selected ? '返信作成' : 'メール作成'}</span>
            </button>
          </div>
        </div>
      </div>

      {showConfig && (
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-slate-800">【2-8-6】受信メール＆Gmail自動バックアップ転送の仕組み:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
            <li>
              Resend Inbound Webhook (<code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-purple-700">/api/email/webhook</code>) により、OSの受信トレイにメールが保存されます。
            </li>
            <li>
              新規メール保存時に、指定したバックアップ先アドレス（個人のGmailなど）へ即座に控えコピーを自動転送します。
            </li>
            <li>
              転送メールには <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">X-MST-Backup-Copy: 1</code> ヘッダーを付与し、ループや再転送を完全に防止します。
            </li>
            <li>
              届いた控えメールにそのまま返信しても、返信先（Reply-To）は元の送信者宛てになるため業務に支障がありません。
            </li>
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="すべて選択"
                className="h-4 w-4 rounded border-slate-300 accent-purple-600"
                checked={messages.length > 0 && checkedIds.length === messages.length}
                onChange={(e) => setCheckedIds(e.target.checked ? messages.map((m) => m.id) : [])}
              />
              <span>受信メッセージ（{messages.length}）</span>
            </label>
            <button
              type="button"
              disabled={checkedIds.length === 0 || deleting}
              onClick={() => void deleteMessages(checkedIds)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>{checkedIds.length > 0 ? '選択した' + checkedIds.length + '件を削除' : '削除'}</span>
            </button>
          </div>
          <div className="max-h-[65vh] overflow-auto divide-y divide-slate-100">
            {messages.map((m) => {
              const sender = senderOf(m.from_email);
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 px-4 py-3 transition ${
                    selected?.id === m.id ? 'bg-purple-50/80 ring-1 ring-inset ring-purple-300' : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label="このメールを選択"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-purple-600 cursor-pointer"
                    checked={checkedIds.includes(m.id)}
                    onChange={(e) =>
                      setCheckedIds((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))
                    }
                  />
                  <button onClick={() => setSelected(m)} className="block min-w-0 flex-1 text-left cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">{m.subject || '(件名なし)'}</div>
                      {/* バックアップ転送バッジ */}
                      {m.backup_status === 'sent' && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          控え済
                        </span>
                      )}
                      {m.backup_status === 'failed' && (
                        <span
                          className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                          title={m.backup_error || '控え転送に失敗しました'}
                        >
                          控え失敗
                        </span>
                      )}
                      {m.backup_status === 'skipped' && (
                        <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] text-slate-400 bg-slate-100">
                          控えスキップ
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {sender.name ? (
                        <>
                          <span className="font-medium text-slate-700">{sender.name}</span>
                          <span className="text-slate-400"> · {sender.address}</span>
                        </>
                      ) : (
                        sender.address
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">{new Date(m.received_at).toLocaleString()}</div>
                  </button>
                </div>
              );
            })}
            {messages.length === 0 && <p className="p-8 text-center text-sm text-slate-400">受信メールはまだありません。</p>}
          </div>
        </div>

        <article className="min-h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col">
          {selected ? (
            <>
              <div className="border-b border-slate-200 pb-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{selected.subject || '(件名なし)'}</h3>
                    <p className="mt-1.5 text-xs text-slate-600">
                      From:{' '}
                      {senderOf(selected.from_email).name ? (
                        <>
                          <span className="font-medium text-slate-800">{senderOf(selected.from_email).name}</span>
                          <span className="text-slate-500"> &lt;{senderOf(selected.from_email).address}&gt;</span>
                        </>
                      ) : (
                        <span className="font-medium text-slate-800">{senderOf(selected.from_email).address}</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      宛先: {selected.to_emails.join(', ')} · {new Date(selected.received_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void deleteMessages([selected.id])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold border border-rose-300 shadow-xs cursor-pointer transition disabled:opacity-50"
                      title="このメールを受信箱から削除します"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>削除</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReplySelected}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
                      title="左のメール本文を見ながら右側のドロワーで返信を作成します"
                    >
                      <Reply className="h-4 w-4" />
                      <span>返信する（ドロワー）</span>
                    </button>
                  </div>
                </div>

                {/* バックアップ控え転送ステータス通知バー */}
                <div className="rounded-lg p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border bg-slate-50/70 border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">控え転送ステータス:</span>
                    {selected.backup_status === 'sent' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>送信完了（Gmailへコピー済）</span>
                      </span>
                    )}
                    {selected.backup_status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>転送失敗: {selected.backup_error || '送信エラー'}</span>
                      </span>
                    )}
                    {(!selected.backup_status || selected.backup_status === 'skipped') && (
                      <span className="text-slate-500">
                        スキップ（{selected.backup_error || '転送無効またはループ防止除外'}）
                      </span>
                    )}
                  </div>

                  {selected.backup_status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => void handleRetryBackup(selected.id)}
                      disabled={retryingId === selected.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                      title="失敗した控えメールをバックアップ宛先へ再送します"
                    >
                      {retryingId === selected.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>控えを再送する</span>
                    </button>
                  )}
                </div>
              </div>
              <pre className="mt-4 flex-1 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {selected.text_body || selected.html_body.replace(/<[^>]*>/g, ' ') || '(本文なし)'}
              </pre>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-slate-400">
              左のメールを選択すると本文を表示します。
            </div>
          )}
        </article>
      </section>
    </div>
  );
};
