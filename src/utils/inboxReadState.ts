/**
 * 統合受信トレイ（メール / LINE）の既読・未読判定ユーティリティ。
 *
 * - メール: DBの `is_read` カラムを優先し、マイグレーション未適用環境では localStorage にフォールバックする。
 * - LINE: `direction === 'inbound'` かつ `status !== 'read'` を未読として集計する。
 */

export const EMAIL_READ_IDS_STORAGE_KEY = 'mst_email_read_ids';
const MAX_LOCAL_READ_IDS = 2000;

export function loadLocalReadEmailIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(EMAIL_READ_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function saveLocalReadEmailIds(ids: ReadonlySet<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const arr = Array.from(ids);
    const trimmed = arr.length > MAX_LOCAL_READ_IDS ? arr.slice(arr.length - MAX_LOCAL_READ_IDS) : arr;
    localStorage.setItem(EMAIL_READ_IDS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage quota errors
  }
}

export function updateLocalEmailReadIds(
  current: ReadonlySet<string>,
  targetIds: readonly string[],
  isRead: boolean,
): Set<string> {
  const next = new Set(current);
  for (const id of targetIds) {
    if (!id) continue;
    if (isRead) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  saveLocalReadEmailIds(next);
  return next;
}

export function isEmailMessageRead(
  message: { id: string; is_read?: boolean | null },
  localReadIds: ReadonlySet<string>,
): boolean {
  if (typeof message.is_read === 'boolean') {
    return message.is_read;
  }
  return localReadIds.has(message.id);
}

export function countUnreadEmails(
  messages: readonly { id: string; is_read?: boolean | null }[],
  localReadIds: ReadonlySet<string>,
): number {
  let count = 0;
  for (const m of messages) {
    if (!isEmailMessageRead(m, localReadIds)) count += 1;
  }
  return count;
}

export function isLineMessageUnread(message: {
  direction: 'inbound' | 'outbound' | string;
  status?: string | null;
}): boolean {
  return message.direction === 'inbound' && message.status !== 'read';
}

export function countUnreadLineMessages(
  messages: readonly { direction: 'inbound' | 'outbound' | string; status?: string | null }[],
): number {
  let count = 0;
  for (const m of messages) {
    if (isLineMessageUnread(m)) count += 1;
  }
  return count;
}

export function countUnreadLineByUser(
  messages: readonly {
    line_user_id: string;
    direction: 'inbound' | 'outbound' | string;
    status?: string | null;
  }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of messages) {
    if (!m.line_user_id) continue;
    if (isLineMessageUnread(m)) {
      map.set(m.line_user_id, (map.get(m.line_user_id) || 0) + 1);
    }
  }
  return map;
}

export const LINE_AUTOMATED_OUTBOUND_PREFIXES = [
  'welcome-',
  'postback-',
  'reply-',
  'reply-postback-',
  'alert-postback-',
  'care-q-',
  'sub-',
] as const;

export const LINE_AWAITING_DISMISSED_STORAGE_KEY = 'mst_line_awaiting_dismissed_v1';

export interface LineAwaitingMessageLike {
  line_user_id?: string | null;
  line_event_id?: string | null;
  direction: 'inbound' | 'outbound' | string;
  received_at?: string | null;
}

export function isAutomatedLineOutboundMessage(message: {
  direction: string;
  line_event_id?: string | null;
}): boolean {
  if (message.direction !== 'outbound') return false;
  const eventId = String(message.line_event_id || '').trim();
  if (!eventId) return false;
  return LINE_AUTOMATED_OUTBOUND_PREFIXES.some((prefix) => eventId.startsWith(prefix));
}

export function isManualLineOutboundMessage(message: {
  direction: string;
  line_event_id?: string | null;
}): boolean {
  return message.direction === 'outbound' && !isAutomatedLineOutboundMessage(message);
}

export function getLatestLineInboundAt(
  messages: readonly LineAwaitingMessageLike[],
): string | null {
  let latestMs = -1;
  let latestIso: string | null = null;
  for (const m of messages) {
    if (m.direction !== 'inbound') continue;
    const ms = Date.parse(String(m.received_at || ''));
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
      latestIso = String(m.received_at);
    } else if (latestIso === null && m.received_at) {
      latestIso = String(m.received_at);
    }
  }
  return latestIso;
}

/**
 * LINEトークが「要返信（ボールがこちらにある状態）」かを判定する。
 * - 顧客からの受信(inbound)が1件以上あること
 * - 最後の「手動返信(outbound かつ 自動送信プレフィックス以外)」より後に顧客からの受信があること
 *   （自動返信の reply-... 等だけでは「手動対応済み」にせず、要返信として残す）
 * - 「返信不要で対応済み」にした場合は、その時点の最新受信時刻以降の新しい受信が来るまで除外する
 */
export function isLineConversationAwaitingReply(
  messages: readonly LineAwaitingMessageLike[],
  dismissedUntil?: string | number | null,
): boolean {
  let latestInboundMs = -1;
  let hasInbound = false;
  let latestManualOutboundMs = -1;
  let hasManualOutbound = false;

  for (const m of messages) {
    const ms = Date.parse(String(m.received_at || ''));
    const safeMs = Number.isFinite(ms) ? ms : 0;
    if (m.direction === 'inbound') {
      hasInbound = true;
      if (safeMs >= latestInboundMs) latestInboundMs = safeMs;
    } else if (isManualLineOutboundMessage(m)) {
      hasManualOutbound = true;
      if (safeMs >= latestManualOutboundMs) latestManualOutboundMs = safeMs;
    }
  }

  if (!hasInbound) return false;
  if (hasManualOutbound && latestManualOutboundMs >= latestInboundMs) {
    return false;
  }

  if (dismissedUntil !== undefined && dismissedUntil !== null && dismissedUntil !== '') {
    const dismissedMs =
      typeof dismissedUntil === 'number'
        ? dismissedUntil
        : Date.parse(String(dismissedUntil));
    if (Number.isFinite(dismissedMs) && dismissedMs >= latestInboundMs) {
      return false;
    }
  }

  return true;
}

export function loadDismissedLineAwaitingMap(): Record<string, string> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(LINE_AWAITING_DISMISSED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && typeof v === 'string' && k && v) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDismissedLineAwaitingMap(map: Record<string, string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LINE_AWAITING_DISMISSED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

