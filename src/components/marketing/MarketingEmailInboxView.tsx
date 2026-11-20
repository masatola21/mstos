import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, MailOpen, Reply, Send, RefreshCw, Settings, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Copy, ShieldCheck, Activity, Sparkles, Globe, HelpCircle, Info, X, FileText, Maximize2, Minimize2, Ban, ShieldAlert, CalendarCheck, ExternalLink, Video } from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import { useSendDrawer } from '../../context/SendDrawerContext';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { syncTimeRexFromInboxHistory } from '../../services/calendarService';
import { LinkifiedText } from '../common/LinkifiedText';
import { extractQuickActionUrls, htmlToReadableTextPreservingLinks } from '../../utils/linkify';
import {
  newestReceivedAt,
  removeMessages,
  replaceMessagesIfChanged,
  sortByReceivedAtDesc,
  upsertMessages,
} from '../../utils/inboxSync';
import {
  countUnreadEmails,
  isEmailMessageRead,
  loadLocalReadEmailIds,
  saveLocalReadEmailIds,
  updateLocalEmailReadIds,
} from '../../utils/inboxReadState';

// 一覧の状態は本文なし（軽量）。本文は text_body / html_body が入っているときだけ読み込み済み。
type InboxMessage = {
  id: string;
  from_email: string;
  to_emails: string[];
  subject: string;
  text_body?: string;
  html_body?: string;
  received_at: string;
  backup_status?: 'sent' | 'failed' | 'skipped';
  backup_error?: string | null;
  is_read?: boolean;
  read_at?: string | null;
};

// 画面表示に影響しうる項目。これらが変わらなければ一覧を再描画しない。
const EMAIL_LIST_KEYS = ['subject', 'from_email', 'backup_status', 'backup_error', 'is_read'] as const satisfies readonly (keyof InboxMessage)[];

const hasBody = (m: InboxMessage) => m.text_body !== undefined || m.html_body !== undefined;
const bodyTextOf = (m: InboxMessage) => {
  const plain = (m.text_body || '').trim();
  if (plain) return plain;
  return htmlToReadableTextPreservingLinks(m.html_body || '');
};

// 一覧には本文を持たせない（Realtime通知などで本文付きの行が届いても取り除く）
function toLightMessage(row: any): InboxMessage {
  const { text_body: _text, html_body: _html, ...rest } = row || {};
  return rest as InboxMessage;
}

// 選択中メッセージに最新の一覧情報を反映する（本文は保持し、変化がなければ同じ参照を返す）
function mergeSelected(prev: InboxMessage | null, incoming: readonly InboxMessage[]): InboxMessage | null {
  if (!prev) return prev;
  const fresh = incoming.find((m) => m.id === prev.id);
  if (!fresh) return prev;
  const unchanged = EMAIL_LIST_KEYS.every((key) => prev[key] === fresh[key]);
  return unchanged ? prev : { ...prev, ...fresh };
}

// 送信元は「名前 <アドレス>」の形で届くことがあるため、名前とアドレスに分ける
function parseSender(raw: string): { name: string; address: string } {
  const text = (raw || '').trim();
  const match = text.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), address: match[2].trim() };
  return { name: '', address: text };
}

function getTimeRexInboxBadge(m: InboxMessage): { label: string; className: string } | null {
  const from = (m.from_email || '').toLowerCase();
  const subject = (m.subject || '').toLowerCase();
  const looksLikeTimeRex =
    from.includes('timerex') ||
    subject.includes('timerex') ||
    /日程(?:確定|調整完了|変更|キャンセル)|日時(?:確定|変更)|予約(?:完了|確定|変更|キャンセル)/.test(m.subject || '');
  if (!looksLikeTimeRex) return null;
  if (/キャンセル|取消|cancel/.test(subject)) {
    return { label: 'TimeRex キャンセル', className: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (/変更|再調整|resched/.test(subject)) {
    return { label: 'TimeRex 変更', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  if (/リマインド|まもなく|間もなく|reminder/.test(subject)) {
    return { label: 'TimeRex リマインド', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  return { label: 'TimeRex 予約', className: 'bg-sky-50 text-sky-700 border-sky-200' };
}

export interface MarketingEmailInboxViewProps {
  onNavigateSendCenter?: () => void;
  onUnreadCountChange?: (unreadCount: number) => void;
}

export const MarketingEmailInboxView: React.FC<MarketingEmailInboxViewProps> = ({
  onNavigateSendCenter,
  onUnreadCountChange,
}) => {
  const db = getSupabase();
  const { openSendDrawer } = useSendDrawer();
  const [ownerId, setOwnerId] = useState('');
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [syncingTimeRex, setSyncingTimeRex] = useState(false);

  useEffect(() => {
    if (!isBodyExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsBodyExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBodyExpanded]);

  // 画面遷移から戻ってきても設定が消えないよう localStorage を初期値として使用
  const [address, setAddress] = useState<string>(() => {
    try {
      return localStorage.getItem('mst_email_inbound_address') || 'contact@mstcorp.info';
    } catch {
      return 'contact@mstcorp.info';
    }
  });
  const [backupAddress, setBackupAddress] = useState<string>(() => {
    try {
      return localStorage.getItem('mst_email_backup_address') || 'mst.shikumikaizen@gmail.com';
    } catch {
      return 'mst.shikumikaizen@gmail.com';
    }
  });
  const [backupEnabled, setBackupEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mst_email_backup_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [savedConfig, setSavedConfig] = useState(() => {
    let savedIn = 'contact@mstcorp.info';
    let savedFwd = 'mst.shikumikaizen@gmail.com';
    let savedEn = false;
    try {
      savedIn = localStorage.getItem('mst_email_inbound_address') || 'contact@mstcorp.info';
      savedFwd = localStorage.getItem('mst_email_backup_address') || 'mst.shikumikaizen@gmail.com';
      savedEn = localStorage.getItem('mst_email_backup_enabled') === 'true';
    } catch {}
    return { address: savedIn, backupAddress: savedFwd, backupEnabled: savedEn };
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
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(() => loadLocalReadEmailIds());
  const [unreadOnlyFilter, setUnreadOnlyFilter] = useState(false);
  // 選択したメールの本文を読み込み中／失敗したときの状態
  const [bodyStatus, setBodyStatus] = useState<{ id: string; state: 'loading' | 'error' } | null>(null);

  // 差分取得の起点にするため、最新の一覧を ref でも保持
  const messagesRef = useRef<InboxMessage[]>([]);
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // メール受信診断・MXレコード判定状態
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  // テスト用受信シミュレータモーダル
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simSender, setSimSender] = useState('client.test@example.com');
  const [simSubject, setSimSubject] = useState('【業務改善の相談】システム導入と業務自動化について');
  const [simBody, setSimBody] = useState('有限会社MST 大橋様\n\nお世話になっております。業務改善について相談させていただけますでしょうか。\n\n株式会社テストクライアント\n担当: 田中 太郎');
  const [simulating, setSimulating] = useState(false);

  // 迷惑メール・受信拒否リスト状態
  type BlocklistItem = {
    id: string;
    pattern: string;
    match_type: 'address' | 'domain';
    reason?: string;
    created_at: string;
  };
  const [blocklist, setBlocklist] = useState<BlocklistItem[]>([]);
  const [loadingBlocklist, setLoadingBlocklist] = useState(false);
  const [showBlocklistModal, setShowBlocklistModal] = useState(false);
  const [newBlockPattern, setNewBlockPattern] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('迷惑メール・営業DM');

  const loadBlocklist = async () => {
    setLoadingBlocklist(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/email/blocklist', { headers: { ...authHeaders } });
      if (res.ok) {
        const data = await res.json();
        setBlocklist(data.blocklist || []);
      }
    } catch (err) {
      console.warn('Failed to load blocklist:', err);
    } finally {
      setLoadingBlocklist(false);
    }
  };

  const handleBlockSender = async (rawSender: string) => {
    const parsed = parseSender(rawSender);
    const targetEmail = (parsed.address || rawSender).trim().toLowerCase();
    if (!targetEmail) return;

    const domain = targetEmail.includes('@') ? '@' + targetEmail.split('@')[1] : '';
    const confirmMsg = `送信元「${targetEmail}」を受信拒否（迷惑メール登録）しますか？\n\n・今後このアドレスからのメールは自動でブロック（破棄）されます。\n・受信トレイにあるこの送信者からのメールも合わせて削除します。\n\n（※ドメイン全体「${domain}」をまとめて拒否したい場合は、受信拒否リスト管理画面から登録できます）`;

    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/email/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          pattern: targetEmail,
          match_type: 'address',
          reason: '受信箱からのワンクリック迷惑メール拒否',
          delete_existing: true,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '受信拒否の登録に失敗しました。');

      setNotice(`「${targetEmail}」を受信拒否リストに追加しました。受信トレイから ${result.deletedExistingCount || 0} 件の関連メールを削除しました。`);
      setSelected(null);
      await Promise.all([load(), loadBlocklist()]);
    } catch (err: any) {
      setError(err?.message || '受信拒否の登録に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveBlock = async (id: string, pattern: string) => {
    if (!window.confirm(`「${pattern}」の受信拒否を解除しますか？`)) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/email/blocklist/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders },
      });
      if (!res.ok) throw new Error('解除に失敗しました。');
      setNotice(`「${pattern}」の受信拒否を解除しました。`);
      await loadBlocklist();
    } catch (err: any) {
      setError(err?.message || '解除に失敗しました。');
    }
  };

  const handleAddCustomBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const pattern = newBlockPattern.trim().toLowerCase();
    if (!pattern) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/email/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          pattern,
          match_type: pattern.startsWith('@') ? 'domain' : 'address',
          reason: newBlockReason.trim() || '迷惑メール・営業DM',
          delete_existing: true,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '登録に失敗しました。');
      setNotice(`「${pattern}」を受信拒否リストに追加しました。`);
      setNewBlockPattern('');
      await Promise.all([load(), loadBlocklist()]);
    } catch (err: any) {
      setError(err?.message || '登録に失敗しました。');
    }
  };

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

  // 1件ぶんの本文を取得する（一覧は軽量化のため本文を含まない）
  const fetchMessageBody = async (id: string): Promise<{ text_body?: string; html_body?: string } | null> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/inbox/email/messages/${encodeURIComponent(id)}`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.success || !data.message) return null;
      return {
        text_body: data.message.text_body ?? '',
        html_body: data.message.html_body ?? '',
      };
    } catch {
      return null;
    }
  };

  const unreadCount = useMemo(
    () => countUnreadEmails(messages, localReadIds),
    [messages, localReadIds],
  );

  const displayedMessages = useMemo(
    () => (unreadOnlyFilter ? messages.filter((m) => !isEmailMessageRead(m, localReadIds)) : messages),
    [messages, unreadOnlyFilter, localReadIds],
  );

  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;
  useEffect(() => {
    if (hasLoadedRef.current) {
      onUnreadCountChangeRef.current?.(unreadCount);
    }
  }, [unreadCount]);

  const updateReadState = async (ids: string[], isRead: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const nowIso = isRead ? new Date().toISOString() : null;

    setLocalReadIds((prev) => updateLocalEmailReadIds(prev, ids, isRead));
    setMessages((prev) =>
      prev.map((m) => (idSet.has(m.id) ? { ...m, is_read: isRead, read_at: nowIso } : m)),
    );
    setSelected((prev) =>
      prev && idSet.has(prev.id) ? { ...prev, is_read: isRead, read_at: nowIso } : prev,
    );

    try {
      const headers = await getAuthHeaders();
      await fetch('/api/inbox/email/read-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ids, isRead }),
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mst_inbox_counts_updated'));
      }
    } catch {
      // non-blocking
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = messages
      .filter((m) => !isEmailMessageRead(m, localReadIds))
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    const idSet = new Set(unreadIds);
    const nowIso = new Date().toISOString();

    setLocalReadIds((prev) => updateLocalEmailReadIds(prev, unreadIds, true));
    setMessages((prev) =>
      prev.map((m) => (idSet.has(m.id) ? { ...m, is_read: true, read_at: nowIso } : m)),
    );
    setSelected((prev) => (prev ? { ...prev, is_read: true, read_at: nowIso } : prev));

    try {
      const headers = await getAuthHeaders();
      await fetch('/api/inbox/email/read-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ markAll: true, ids: unreadIds, isRead: true }),
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mst_inbox_counts_updated'));
      }
    } catch {
      // non-blocking
    }
  };

  // メールを選択し、既読化＆本文が未取得なら読み込む
  const selectMessage = async (m: InboxMessage) => {
    const alreadyRead = isEmailMessageRead(m, localReadIds);
    const optimistic = alreadyRead
      ? m
      : { ...m, is_read: true, read_at: m.read_at || new Date().toISOString() };
    setSelected(optimistic);

    if (!alreadyRead) {
      void updateReadState([m.id], true);
    }

    if (hasBody(m)) {
      setBodyStatus(null);
      return;
    }
    setBodyStatus({ id: m.id, state: 'loading' });
    const detail = await fetchMessageBody(m.id);
    if (detail) {
      setSelected((prev) => (prev && prev.id === m.id ? { ...prev, ...detail } : prev));
      setBodyStatus((prev) => (prev && prev.id === m.id ? null : prev));
    } else {
      setBodyStatus((prev) => (prev && prev.id === m.id ? { id: m.id, state: 'error' } : prev));
    }
  };

  const handleReplySelected = async () => {
    if (!selected) return;
    let target = selected;
    if (!hasBody(target)) {
      // 本文の読み込みが終わる前に返信が押された場合は、ここで取得してから引用する
      const detail = await fetchMessageBody(target.id);
      if (detail) target = { ...target, ...detail };
    }
    const cleanBody = bodyTextOf(target);
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
    let apiLoaded = false;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inbox/email/messages?light=1', { headers });
      if (res.ok) {
        const apiData = await res.json();
        if (apiData.success) {
          apiLoaded = true;
          inAddress = apiData.inboundAddress || 'contact@mstcorp.info';
          fwdAddress = apiData.backupForwardAddress || 'mst.shikumikaizen@gmail.com';
          fwdEnabled = Boolean(apiData.backupForwardEnabled);
          loadedMessages = ((apiData.messages || []) as any[]).map(toLightMessage);
        }
      }
    } catch {}

    if (loadedMessages.length === 0 && inAddress === '') {
      try {
        const [settings, inbox] = await Promise.all([
          db.from('email_channel_integrations').select('inbound_address').eq('owner_id', auth.user.id).maybeSingle(),
          db.from('email_inbox_messages').select('id, from_email, to_emails, subject, received_at').order('received_at', { ascending: false }).limit(500),
        ]);
        inAddress = settings.data?.inbound_address || 'contact@mstcorp.info';
        loadedMessages = (inbox.data || []) as InboxMessage[];
      } catch (err: any) {
        console.warn('Fallback direct query error:', err);
      }
    }

    const resolvedIn = inAddress || 'contact@mstcorp.info';
    const resolvedFwd = fwdAddress || 'mst.shikumikaizen@gmail.com';

    // サーバー設定の取得に失敗した時だけ localStorage をフォールバック参照する（取得成功時はサーバー状態を正とする）
    let finalFwdEnabled = fwdEnabled;
    if (!apiLoaded) {
      try {
        const stored = localStorage.getItem('mst_email_backup_enabled');
        if (stored === 'true') {
          finalFwdEnabled = true;
        }
      } catch {}
    }

    setAddress(resolvedIn);
    setBackupAddress(resolvedFwd);
    setBackupEnabled(finalFwdEnabled);
    setSavedConfig({
      address: resolvedIn,
      backupAddress: resolvedFwd,
      backupEnabled: finalFwdEnabled,
    });
    try {
      localStorage.setItem('mst_email_inbound_address', resolvedIn);
      localStorage.setItem('mst_email_backup_address', resolvedFwd);
      localStorage.setItem('mst_email_backup_enabled', String(finalFwdEnabled));
    } catch {}

    setMessages((prev) => replaceMessagesIfChanged(prev, loadedMessages, EMAIL_LIST_KEYS));
    hasLoadedRef.current = true;
    setCheckedIds([]);

    // 選択中メッセージのステータス同期（読み込み済みの本文は保持する）
    setSelected((prev) => mergeSelected(prev, loadedMessages));

    // 送信者の名前を連絡先から引く
    const { data: contacts } = await db.from('contacts').select('full_name,email').not('email', 'is', null).limit(5000);
    const names: Record<string, string> = {};
    (contacts || []).forEach((c: any) => {
      if (c.email && c.full_name) names[String(c.email).trim().toLowerCase()] = String(c.full_name);
    });
    setContactNames(names);
  };

  // メッセージのみの同期（入力中の設定を崩さずに新着を取得）。
  //   full=false: 最新の受信日時より新しいメールだけ取得（差分）
  //   full=true : 一覧を全件取得し直す（削除や控え転送の状態変化も反映）
  // どちらも本文は取得せず、内容が変わらなければ画面は再描画しない。
  const syncMessages = async (full: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ light: '1', messagesOnly: '1' });
      const since = full ? null : newestReceivedAt(messagesRef.current);
      if (since) params.set('since', since);
      const res = await fetch(`/api/inbox/email/messages?${params.toString()}`, { headers });
      if (!res.ok) return;
      const apiData = await res.json();
      if (!apiData.success || !Array.isArray(apiData.messages)) return;

      const incoming = (apiData.messages as any[]).map(toLightMessage);
      setMessages((prev) =>
        since
          ? upsertMessages(prev, incoming, EMAIL_LIST_KEYS)
          : replaceMessagesIfChanged(prev, sortByReceivedAtDesc(incoming), EMAIL_LIST_KEYS)
      );
      setSelected((prev) => mergeSelected(prev, incoming));
    } catch {}
  };

  useEffect(() => {
    void load();
    void loadBlocklist();
  }, [db]);

  // 自動更新: Supabase Realtime を主役にし、接続できないときだけ30秒間隔の差分ポーリングに切り替える。
  // タブが非表示の間は止まり、表示に戻ったときに1回だけ同期する。
  useInboxRealtime({
    db,
    channelName: 'email_inbox_realtime_sync',
    table: 'email_inbox_messages',
    onInsert: (row) => {
      setMessages((prev) => upsertMessages(prev, [toLightMessage(row)], EMAIL_LIST_KEYS));
    },
    onUpdate: (row) => {
      const updated = toLightMessage(row);
      setMessages((prev) => upsertMessages(prev, [updated], EMAIL_LIST_KEYS));
      setSelected((prev) => mergeSelected(prev, [updated]));
    },
    onDelete: (row) => {
      const id = row?.id ? String(row.id) : '';
      if (!id) {
        void syncMessages(true);
        return;
      }
      setMessages((prev) => removeMessages(prev, [id]));
      setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
      setSelected((prev) => (prev && prev.id === id ? null : prev));
    },
    onSync: syncMessages,
  });

  // 受信診断を実行
  const runDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const headers = await getAuthHeaders();
      const domain = (address.split('@')[1] || 'mstcorp.info').trim();
      const res = await fetch(`/api/inbox/email/diagnostics?domain=${encodeURIComponent(domain)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (err: any) {
      console.warn('Diagnostics error:', err);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  // テスト用受信シミュレーション実行
  const handleSimulateInbound = async () => {
    if (!simSender.trim() || !simSubject.trim()) return;
    setSimulating(true);
    setError('');
    setNotice('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/inbox/email/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          fromEmail: simSender.trim(),
          toEmail: address.trim() || 'contact@mstcorp.info',
          subject: simSubject.trim(),
          bodyText: simBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'テスト受信に失敗しました。');

      setNotice(
        `テストメールを受信トレイに登録しました！` +
        (data.forwardDecision?.shouldForward
          ? ` Gmail控え（${backupAddress}）へのコピー送信を実行しました。`
          : `（Gmail控え転送: ${data.forwardDecision?.reason || '無効'}）`)
      );
      setShowSimulateModal(false);
      await syncMessages(true);
    } catch (err: any) {
      setError(err?.message || 'テスト受信シミュレーション中にエラーが発生しました。');
    } finally {
      setSimulating(false);
    }
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mst_inbox_counts_updated'));
      }
    } catch (e: any) {
      setError(e?.message || 'メールを削除できませんでした。');
    } finally {
      setDeleting(false);
    }
  };

  const deleteAllMessages = async () => {
    setDeletingAll(true);
    setError('');
    setNotice('');
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/inbox/email/delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '受信メールの全削除に失敗しました。');
      const count = typeof result.deletedCount === 'number' ? result.deletedCount : messages.length;
      setMessages([]);
      setCheckedIds([]);
      setSelected(null);
      setIsBodyExpanded(false);
      saveLocalReadEmailIds(new Set());
      setLocalReadIds(new Set());
      setShowDeleteAllModal(false);
      setNotice(`受信トレイのメール（${count}件）をすべて削除しました。`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mst_inbox_counts_updated'));
      }
    } catch (e: any) {
      setError(e?.message || '受信メールの全削除に失敗しました。');
    } finally {
      setDeletingAll(false);
    }
  };

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
      try {
        localStorage.setItem('mst_email_inbound_address', inVal);
        localStorage.setItem('mst_email_backup_address', fwdVal);
        localStorage.setItem('mst_email_backup_enabled', String(backupEnabled));
      } catch {}
      setNotice('受信および控え自動転送の設定を保存しました。');
    } catch (e: any) {
      if (db) {
        let errResult: any = null;
        try {
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
          if (err) errResult = err;
        } catch (dbErr: any) {
          errResult = dbErr;
        }

        // スキーマキャッシュ未反映によるカラム欠落エラーの場合は基本情報のみ再保存
        if (errResult && /backup_forward_address/i.test(errResult?.message || '')) {
          try {
            await db.from('email_channel_integrations').upsert(
              {
                owner_id: ownerId,
                inbound_address: inVal,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'owner_id' }
            );
            errResult = null;
          } catch {}
        }

        if (errResult) {
          setError(errResult?.message || '設定の保存に失敗しました。');
        } else {
          setSavedConfig({
            address: inVal,
            backupAddress: fwdVal,
            backupEnabled,
          });
          try {
            localStorage.setItem('mst_email_inbound_address', inVal);
            localStorage.setItem('mst_email_backup_address', fwdVal);
            localStorage.setItem('mst_email_backup_enabled', String(backupEnabled));
          } catch {}
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

  const handleSyncTimeRexHistory = async () => {
    setSyncingTimeRex(true);
    setError('');
    setNotice('');
    try {
      const res = await syncTimeRexFromInboxHistory();
      if (!res.success) {
        setError(res.error || 'TimeRexメールのCRM同期に失敗しました。');
        return;
      }
      setNotice(
        `TimeRex履歴をCRM同期しました（検出 ${res.detectedTimeRexEmails}件 ／ リード・商談・タスク反映 ${res.syncedCount}件）`
      );
    } catch (err: any) {
      setError(err?.message || 'TimeRex履歴同期中にエラーが発生しました。');
    } finally {
      setSyncingTimeRex(false);
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
              onClick={() => {
                const nextState = !showConfig;
                setShowConfig(nextState);
                if (nextState && !diagnostics) void runDiagnostics();
              }}
              className="inline-flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
              title="Webhook設定とMXレコードの受信診断"
            >
              <Activity className="w-3 h-3 text-purple-600" />
              <span>{showConfig ? '診断・設定を閉じる' : '受信診断・ヘルプ'}</span>
            </button>
          </div>
        </div>

        {/* 状態・件数バー */}
        <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              受信数: <strong className="text-slate-800">{messages.length}件</strong>
            </span>
            <span>·</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
              unreadCount > 0
                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
              未読 {unreadCount}件
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
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>リアルタイム受信中（自動更新）</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={syncingTimeRex}
              onClick={() => void handleSyncTimeRexHistory()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="受信トレイ内のTimeRex通知メール（予約・変更・キャンセル）からリード・商談・タスクを最新化します"
            >
              <CalendarCheck className={`h-3 w-3 text-sky-600 ${syncingTimeRex ? 'animate-pulse' : ''}`} />
              <span>{syncingTimeRex ? 'TimeRex同期中...' : 'TimeRex履歴をCRM同期'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSimulateModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold shadow-xs transition cursor-pointer"
              title="画面からテストメールを受信トレイに流し込み、Gmail控え転送をテストします"
            >
              <Sparkles className="h-3 w-3 text-purple-600" />
              <span>テスト受信シミュレート</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBlocklistModal(true);
                void loadBlocklist();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-800 text-xs font-semibold shadow-2xs transition cursor-pointer"
              title="迷惑メールの受信拒否リスト（ブラックリスト）を確認・設定します"
            >
              <Ban className="h-3 w-3 text-rose-600" />
              <span>受信拒否 ({blocklist.length})</span>
            </button>
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
                  void handleReplySelected();
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
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-purple-600" />
              <span>受信メール連携診断・MXレコード確認</span>
            </h4>
            <button
              type="button"
              onClick={() => void runDiagnostics()}
              disabled={loadingDiagnostics}
              className="text-[11px] text-purple-700 hover:text-purple-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingDiagnostics ? 'animate-spin' : ''}`} />
              <span>再診断</span>
            </button>
          </div>

          {/* MXレコード診断結果アラート */}
          <div className="p-3 rounded-lg border bg-white space-y-2">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>【重要】個人のメールアドレスから contact@mstcorp.info に送信したメールが届かない理由:</span>
            </p>
            <div className="text-xs text-slate-600 space-y-1.5 pl-5">
              <p>
                ドメイン <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-semibold text-slate-800">mstcorp.info</code> のメール配送先（MXレコード）を調査したところ、現在は <strong>WebLife（BiNDupメール: bs-mail-mta01.weblife.me）</strong> に設定されています。
              </p>
              <p>
                そのため、外部のメールアドレスから <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-700">contact@mstcorp.info</code> へ送信されたメールは、インターネットの仕組み上、<strong>直接WebLifeのメールサーバー（BiNDupメールボックス）へ届き、本システムには届きません。</strong>
              </p>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 pl-5 space-y-1.5">
              <p className="font-semibold text-slate-800">本システムの受信トレイでメールを受け取るための設定手順（2通り）:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>
                  <strong className="text-slate-800">方法1（推奨・最も簡単）: WebLifeのメール自動転送設定</strong>
                  <div className="pl-4 text-[11px] text-slate-500">
                    WebLife（BiNDup）のメール管理画面にログインし、<code className="font-mono">contact@mstcorp.info</code> 宛てに届いたメールを、個人のGmail（<code className="font-mono">mst.shikumikaizen@gmail.com</code>）または受信用アドレスへ自動転送する設定を行います。
                  </div>
                </li>
                <li>
                  <strong className="text-slate-800">方法2: Resend Inbound の設定</strong>
                  <div className="pl-4 text-[11px] text-slate-500">
                    Resendの管理画面で受信ドメイン（例: <code className="font-mono">inbound.mstcorp.info</code>）のMXレコードを設定し、Webhook URL: <code className="font-mono bg-slate-100 px-1 rounded">{diagnostics?.webhookUrl || 'https://os.mstcorp.info/api/email/webhook'}</code> （イベント: <code className="font-mono">email.received</code>）を登録します。
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
            <span>
              ※ 実際のメール受信からGmail控え転送までのシステム動作は、右の「テスト受信シミュレート」ボタンから今すぐご確認いただけます。
            </span>
            <button
              type="button"
              onClick={() => setShowSimulateModal(true)}
              className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold transition cursor-pointer"
            >
              テスト受信シミュレータを開く
            </button>
          </div>
        </div>
      )}

      {/* テスト受信シミュレータ モーダル */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">メール受信シミュレータ（動作テスト）</h3>
                  <p className="text-[11px] text-slate-500">受信トレイへの登録とGmail自動控え転送を即座に検証できます</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  差出人メールアドレス（テスト送信元）:
                </label>
                <input
                  type="email"
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  placeholder="client.tanaka@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  受信先アドレス（To）:
                </label>
                <input
                  type="text"
                  disabled
                  value={address || 'contact@mstcorp.info'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  メール件名:
                </label>
                <input
                  type="text"
                  value={simSubject}
                  onChange={(e) => setSimSubject(e.target.value)}
                  placeholder="【ご相談】業務効率化とシステム導入について"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  メール本文:
                </label>
                <textarea
                  rows={4}
                  value={simBody}
                  onChange={(e) => setSimBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-[11px] text-purple-900 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>連動する動作:</span>
                </p>
                <p>1. 受信トレイに新規メールとして即座に保存されます。</p>
                <p>2. Gmail控え自動転送が有効な場合、控えメールが <strong>{backupAddress}</strong> 宛てへコピー送信されます。</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={simulating}
                onClick={() => void handleSimulateInbound()}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {simulating ? 'シミュレーション実行中...' : 'テストメールを受信させる'}
              </button>
            </div>
          </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  aria-label="すべて選択"
                  className="h-4 w-4 rounded border-slate-300 accent-purple-600"
                  checked={displayedMessages.length > 0 && displayedMessages.every((m) => checkedIds.includes(m.id))}
                  onChange={(e) =>
                    setCheckedIds(e.target.checked ? displayedMessages.map((m) => m.id) : [])
                  }
                />
                <span>受信メッセージ（{messages.length}）</span>
              </label>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  unreadCount > 0
                    ? 'bg-sky-100 text-sky-800 border border-sky-300'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                未読 {unreadCount}件
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setUnreadOnlyFilter((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  unreadOnlyFilter
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                未読のみ
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-sky-700 hover:bg-sky-50 border border-sky-200 bg-white transition cursor-pointer"
                  title="すべての未読メールを既読にします"
                >
                  すべて既読
                </button>
              )}
              <button
                type="button"
                disabled={checkedIds.length === 0 || deleting || deletingAll}
                onClick={() => void deleteMessages(checkedIds)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>{checkedIds.length > 0 ? '選択した' + checkedIds.length + '件を削除' : '削除'}</span>
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  disabled={deleting || deletingAll}
                  onClick={() => setShowDeleteAllModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  title="受信トレイ内のメールをすべて削除します"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>全削除</span>
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[65vh] overflow-auto divide-y divide-slate-100">
            {displayedMessages.map((m) => {
              const sender = senderOf(m.from_email);
              const isRead = isEmailMessageRead(m, localReadIds);
              const isSelected = selected?.id === m.id;
              const timeRexBadge = getTimeRexInboxBadge(m);
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 px-4 py-3 transition ${
                    isSelected
                      ? 'bg-purple-50/80 ring-1 ring-inset ring-purple-300'
                      : isRead
                        ? 'bg-slate-100/70 hover:bg-slate-100'
                        : 'bg-white hover:bg-purple-50/30'
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
                  <button onClick={() => void selectMessage(m)} className="block min-w-0 flex-1 text-left cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!isRead && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-sky-500 shrink-0"
                            title="未読"
                          />
                        )}
                        {timeRexBadge && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${timeRexBadge.className}`}>
                            {timeRexBadge.label}
                          </span>
                        )}
                        <div
                          className={`truncate text-sm ${
                            isRead ? 'font-normal text-slate-500' : 'font-bold text-slate-950'
                          }`}
                        >
                          {m.subject || '(件名なし)'}
                        </div>
                      </div>
                      {/* バックアップ転送バッジ */}
                      {m.backup_status === 'sent' && (
                        <span className={`shrink-0 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                          isRead
                            ? 'bg-emerald-50/60 text-emerald-600/80 border-emerald-200/70'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
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
                    <div className={`mt-1 truncate text-xs ${isRead ? 'text-slate-400' : 'text-slate-600'}`}>
                      {sender.name ? (
                        <>
                          <span className={isRead ? 'font-normal text-slate-500' : 'font-semibold text-slate-800'}>
                            {sender.name}
                          </span>
                          <span className="text-slate-400"> · {sender.address}</span>
                        </>
                      ) : (
                        sender.address
                      )}
                    </div>
                    <div className={`mt-1 text-[11px] ${isRead ? 'text-slate-400' : 'text-slate-500 font-medium'}`}>
                      {new Date(m.received_at).toLocaleString()}
                    </div>
                  </button>
                </div>
              );
            })}
            {displayedMessages.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-400">
                {unreadOnlyFilter && messages.length > 0
                  ? '未読のメールはありません。'
                  : '受信メールはまだありません。'}
              </p>
            )}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBodyExpanded(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs cursor-pointer transition whitespace-nowrap shrink-0"
                      title="メール本文を全画面で大きく表示します"
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-purple-600" />
                      <span>全画面表示</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateReadState([selected.id], !isEmailMessageRead(selected, localReadIds))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs cursor-pointer transition"
                      title={isEmailMessageRead(selected, localReadIds) ? 'このメールを未読に戻します' : 'このメールを既読にします'}
                    >
                      <MailOpen className="h-4 w-4 text-sky-600" />
                      <span>{isEmailMessageRead(selected, localReadIds) ? '未読に戻す' : '既読にする'}</span>
                    </button>
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
                      onClick={() => {
                        openSendDrawer({
                          channel: 'email',
                          kind: 'form',
                          initialRecipientEmail: parseSender(selected.from_email).address,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-purple-50 text-purple-700 text-xs font-bold border border-purple-300 shadow-xs cursor-pointer transition"
                      title="この送信者宛てにフォーム案内ドロワーを開きます"
                    >
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span>フォームを送る</span>
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
                    <button
                      type="button"
                      onClick={() => handleBlockSender(selected.from_email)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 shadow-xs cursor-pointer transition disabled:opacity-50"
                      title="この送信者を受信拒否（迷惑メール）に登録し、既存メールも破棄します"
                    >
                      <Ban className="h-4 w-4 text-rose-600" />
                      <span>迷惑メール拒否</span>
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
              {hasBody(selected) && (() => {
                const quickLinks = extractQuickActionUrls(selected.text_body, selected.html_body);
                if (quickLinks.length === 0) return null;
                return (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800">
                      <Video className="w-3.5 h-3.5 text-indigo-600" />
                      <span>会議・日程リンク:</span>
                    </span>
                    {quickLinks.map((item) => (
                      <a
                        key={item.url}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-300 px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-2xs transition"
                        title={item.url}
                      >
                        <span>{item.label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                );
              })()}
              <pre className="mt-4 flex-1 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {!hasBody(selected) && bodyStatus?.id === selected.id && bodyStatus.state === 'loading' ? (
                  '本文を読み込み中...'
                ) : !hasBody(selected) && bodyStatus?.id === selected.id && bodyStatus.state === 'error' ? (
                  '本文を読み込めませんでした。もう一度メールを選択してください。'
                ) : (
                  <LinkifiedText text={bodyTextOf(selected) || '(本文なし)'} />
                )}
              </pre>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-slate-400">
              左のメールを選択すると本文を表示します。
            </div>
          )}
        </article>
      </section>

      {isBodyExpanded &&
        selected &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="メール本文の全画面表示"
            className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 flex flex-col"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsBodyExpanded(false);
            }}
          >
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-start justify-between gap-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg text-slate-900">{selected.subject || '(件名なし)'}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    From:{' '}
                    {senderOf(selected.from_email).name ? (
                      <>
                        <span className="font-medium text-slate-800">{senderOf(selected.from_email).name}</span>
                        <span className="text-slate-500"> &lt;{senderOf(selected.from_email).address}&gt;</span>
                      </>
                    ) : (
                      <span className="font-medium text-slate-800">{senderOf(selected.from_email).address}</span>
                    )}
                    <span className="text-slate-400 ml-3">
                      宛先: {selected.to_emails.join(', ')} · {new Date(selected.received_at).toLocaleString()}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void updateReadState([selected.id], !isEmailMessageRead(selected, localReadIds))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 cursor-pointer transition whitespace-nowrap shrink-0"
                  >
                    <MailOpen className="h-4 w-4 text-sky-600" />
                    <span>{isEmailMessageRead(selected, localReadIds) ? '未読に戻す' : '既読にする'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBodyExpanded(false);
                      openSendDrawer({
                        channel: 'email',
                        kind: 'form',
                        initialRecipientEmail: parseSender(selected.from_email).address,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-purple-50 text-purple-700 text-xs font-bold border border-purple-300 cursor-pointer transition whitespace-nowrap shrink-0"
                  >
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span>フォームを送る</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBodyExpanded(false);
                      handleReplySelected();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer transition whitespace-nowrap shrink-0"
                  >
                    <Reply className="h-4 w-4" />
                    <span>返信する（ドロワー）</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBodyExpanded(false);
                      handleBlockSender(selected.from_email);
                    }}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 cursor-pointer transition whitespace-nowrap shrink-0 disabled:opacity-50"
                    title="この送信者を受信拒否（迷惑メール）に登録し、既存メールも破棄します"
                  >
                    <Ban className="h-4 w-4 text-rose-600" />
                    <span>迷惑メール拒否</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBodyExpanded(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold cursor-pointer transition whitespace-nowrap shrink-0"
                  >
                    <Minimize2 className="h-4 w-4" />
                    <span>元に戻す</span>
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-6 bg-slate-50 space-y-4">
                {hasBody(selected) && (() => {
                  const quickLinks = extractQuickActionUrls(selected.text_body, selected.html_body);
                  if (quickLinks.length === 0) return null;
                  return (
                    <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                        <Video className="w-4 h-4 text-indigo-600" />
                        <span>会議・日程リンク:</span>
                      </span>
                      {quickLinks.map((item) => (
                        <a
                          key={item.url}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-300 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs transition"
                          title={item.url}
                        >
                          <span>{item.label}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ))}
                    </div>
                  );
                })()}
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-900 bg-white p-6 rounded-xl border border-slate-200 max-w-4xl mx-auto shadow-2xs">
                  {!hasBody(selected) && bodyStatus?.id === selected.id && bodyStatus.state === 'loading' ? (
                    '本文を読み込み中...'
                  ) : !hasBody(selected) && bodyStatus?.id === selected.id && bodyStatus.state === 'error' ? (
                    '本文を読み込めませんでした。もう一度メールを選択してください。'
                  ) : (
                    <LinkifiedText text={bodyTextOf(selected) || '(本文なし)'} />
                  )}
                </pre>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 受信拒否（迷惑メール）管理モーダル */}
      {showBlocklistModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowBlocklistModal(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
              {/* ヘッダー */}
              <div className="px-6 py-4 border-b border-slate-200 bg-linear-to-r from-rose-50 via-white to-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">受信拒否（迷惑メール）リスト</h3>
                    <p className="text-xs text-slate-500">登録されたアドレス・ドメインからのメールは受信時に自動破棄されます</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBlocklistModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 手動追加フォーム */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/70">
                <form onSubmit={handleAddCustomBlock} className="space-y-3">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>新規ブロック追加</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      （特定アドレスまたは「@ドメイン」を指定）
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        value={newBlockPattern}
                        onChange={(e) => setNewBlockPattern(e.target.value)}
                        placeholder="例: spammer@bad.com または @spam-domain.com"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white"
                        required
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={newBlockReason}
                        onChange={(e) => setNewBlockReason(e.target.value)}
                        placeholder="理由（例: 営業DM・迷惑）"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={!newBlockPattern.trim()}
                        className="w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    ※ 追加すると、受信トレイ内にある該当送信元の既存メールも自動的に一括削除されます。
                  </p>
                </form>
              </div>

              {/* 一覧 */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700">登録済みパターン（{blocklist.length}件）</span>
                  <button
                    type="button"
                    onClick={() => void loadBlocklist()}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingBlocklist ? 'animate-spin' : ''}`} />
                    <span>再読み込み</span>
                  </button>
                </div>

                {loadingBlocklist && blocklist.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">読み込み中...</div>
                ) : blocklist.length === 0 ? (
                  <div className="py-10 text-center">
                    <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">現在、受信拒否リストに登録されているアドレスはありません。</p>
                    <p className="text-[11px] text-slate-400 mt-1">迷惑メールを受信した際は、詳細画面の「迷惑メール拒否」ボタンから即座に追加できます。</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {blocklist.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 truncate">
                              {item.pattern}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                item.match_type === 'domain' || item.pattern.startsWith('@')
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {item.match_type === 'domain' || item.pattern.startsWith('@')
                                ? 'ドメイン全体ブロック'
                                : 'アドレス個別ブロック'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>理由: {item.reason || '未指定'}</span>
                            <span>•</span>
                            <span>登録日: {new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemoveBlock(item.id, item.pattern)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer shrink-0"
                          title="受信拒否を解除します"
                        >
                          解除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowBlocklistModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {/* 受信メール全削除確認モーダル */}
      {showDeleteAllModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="受信メールの全削除確認"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
              if (!deletingAll && e.target === e.currentTarget) setShowDeleteAllModal(false);
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">受信メールをすべて削除</h3>
                  <p className="text-xs text-slate-500">受信トレイ内の全 {messages.length} 件を削除します</p>
                </div>
              </div>
              <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-3.5 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-rose-900">この操作は取り消せません。</p>
                <p>受信トレイに表示されているすべてのメール（既読・未読を含む全件）をデータベースから削除します。</p>
                <p className="text-[11px] text-slate-600">※ Gmail控え自動転送で外部メールボックスに転送済みのコピー自体は削除されません。また、迷惑メール拒否設定は維持されます。</p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deletingAll}
                  onClick={() => setShowDeleteAllModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={deletingAll}
                  onClick={() => void deleteAllMessages()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {deletingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span>{deletingAll ? '削除中...' : `全${messages.length}件を削除する`}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
