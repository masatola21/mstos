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
