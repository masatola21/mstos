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
  'rule-reply-',
  'reply-postback-',
  'alert-postback-',
  'care-q-',
  'sub-',
  'broadcast-',
] as const;

export const LINE_RULE_RESOLVED_PREFIX = 'rule-reply-';

export const LINE_AWAITING_DISMISSED_STORAGE_KEY = 'mst_line_awaiting_dismissed_v1';

export interface LineAwaitingMessageLike {
  line_user_id?: string | null;
  line_event_id?: string | null;
  direction: 'inbound' | 'outbound' | string;
  body?: string | null;
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

const NO_REPLY_QUESTION_OR_REQUEST_RE =
  /[?？]|教えて|お願い|相談|質問|希望|予約|日程|いつ|どこ|いくら|どう|でき|可能|確認したい|知りたい|検討|見積|資料|連絡/;

const NO_REPLY_EXACT_PHRASES = new Set([
  'ありがとう',
  'ありがとうございます',
  'ありがとうございました',
  'どうもありがとうございます',
  '誠にありがとうございます',
  '感謝します',
  '感謝いたします',
  '承知',
  '承知です',
  '承知しました',
  '承知いたしました',
  'かしこまりました',
  '了解',
  '了解です',
  '了解しました',
  '了解いたしました',
  'りょ',
  'りょうかい',
  '確認しました',
  '確認いたしました',
  '拝見しました',
  '拝見いたしました',
  '受け取りました',
  '受領しました',
  '受領いたしました',
  'お疲れ様です',
  'お疲れさまです',
  'おつかれさまです',
  '失礼します',
  '失礼いたします',
  'ok',
  'okay',
  'thanks',
  'thank you',
  'thankyou',
  'got it',
  'roger',
  '[スタンプ]',
]);

/**
 * 「ありがとうございます」「承知しました」「OK」などの短いお礼・了解のみで、
 * 新たな質問や対応依頼を含まない受信メッセージかを判定する。
 */
export function isLineNoReplyInboundText(body?: string | null): boolean {
  if (typeof body !== 'string') return false;
  const trimmed = body.normalize('NFKC').trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (NO_REPLY_QUESTION_OR_REQUEST_RE.test(trimmed)) return false;

  const normalized = trimmed
    .toLowerCase()
    .replace(/[\s!！。．.、,〜~♪♡♥★☆🙇🙏👍👌😊😄🎉✨]+$/gu, '')
    .replace(/^[\s🙇🙏👍👌😊😄🎉✨]+/gu, '')
    .trim();

  if (!normalized) {
    // 絵文字リアクション単体（👍 / 🙇 / 🙏 等）は返信不要とみなす
    return /^[🙇🙏👍👌🙆‍♂️🙆‍♀️🙆😊😄🎉✨]+$/u.test(trimmed.replace(/\s+/g, ''));
  }

  return NO_REPLY_EXACT_PHRASES.has(normalized);
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
 * - 自動返信ルールで応答済みの受信（rule-reply-{eventId} が存在）や、
 *   「ありがとうございます」「承知しました」等の返信不要な短文のみは要返信にしない
 * - 汎用自動受付返信（reply-...）や一斉配信（broadcast-...）だけでは「手動対応済み」にせず、要返信として残す
 * - 手動返信（manual-... 等）が最新の要返信受信以降に送られていれば解消する
 * - 「返信不要で対応済み」にした場合は、その時点以降の新しい要返信受信が来るまで除外する
 */
export function isLineConversationAwaitingReply(
  messages: readonly LineAwaitingMessageLike[],
  dismissedUntil?: string | number | null,
): boolean {
  const ruleResolvedEventIds = new Set<string>();
  let latestManualOutboundMs = -1;
  let hasManualOutbound = false;

  for (const m of messages) {
    if (m.direction !== 'outbound') continue;
    const eventId = String(m.line_event_id || '').trim();
    if (eventId.startsWith(LINE_RULE_RESOLVED_PREFIX)) {
      const targetInboundId = eventId.slice(LINE_RULE_RESOLVED_PREFIX.length);
      if (targetInboundId) ruleResolvedEventIds.add(targetInboundId);
      continue;
    }
    if (isManualLineOutboundMessage(m)) {
      const ms = Date.parse(String(m.received_at || ''));
      const safeMs = Number.isFinite(ms) ? ms : 0;
      hasManualOutbound = true;
      if (safeMs >= latestManualOutboundMs) latestManualOutboundMs = safeMs;
    }
  }

  let latestActionableInboundMs = -1;
  let hasActionableInbound = false;

  for (const m of messages) {
    if (m.direction !== 'inbound') continue;
    const eventId = String(m.line_event_id || '').trim();
    if (eventId && ruleResolvedEventIds.has(eventId)) {
      continue;
    }
    if (isLineNoReplyInboundText(m.body)) {
      continue;
    }
    const ms = Date.parse(String(m.received_at || ''));
    const safeMs = Number.isFinite(ms) ? ms : 0;
    hasActionableInbound = true;
    if (safeMs >= latestActionableInboundMs) latestActionableInboundMs = safeMs;
  }

  if (!hasActionableInbound) return false;
  if (hasManualOutbound && latestManualOutboundMs >= latestActionableInboundMs) {
    return false;
  }

  if (dismissedUntil !== undefined && dismissedUntil !== null && dismissedUntil !== '') {
    const dismissedMs =
      typeof dismissedUntil === 'number'
        ? dismissedUntil
        : Date.parse(String(dismissedUntil));
    if (Number.isFinite(dismissedMs) && dismissedMs >= latestActionableInboundMs) {
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

