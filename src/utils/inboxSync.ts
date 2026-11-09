/**
 * 受信箱（LINE / メール）の同期用ユーティリティ。
 *
 * 目的: 取得結果が前回と同じなら「同じ配列参照」を返し、
 * React の無駄な再描画（500件ぶんのリスト描き直し）を防ぐ。
 */

function toTime(value: string | null | undefined): number {
  const t = Date.parse(value || '');
  return Number.isNaN(t) ? 0 : t;
}

/** 新しい順（received_at 降順）に並べ替える。元の配列は変更しない。 */
export function sortByReceivedAtDesc<T extends { received_at: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => toTime(b.received_at) - toTime(a.received_at));
}

/**
 * 並び順(id)と、指定したキーの値がすべて同じなら true。
 * keys には「画面表示に影響する、変わりうる項目」（status など）を渡す。
 */
export function isSameMessageList<T extends { id: string }>(
  prev: readonly T[],
  next: readonly T[],
  keys: readonly (keyof T)[] = [],
): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (a.id !== b.id) return false;
    for (const key of keys) {
      if (a[key] !== b[key]) return false;
    }
  }
  return true;
}

/**
 * incoming を prev に追加／同じ id なら置き換えて、新しい順に並べて返す。
 * 結果が prev と同じ内容なら prev そのものを返す（再描画されない）。
 */
export function upsertMessages<T extends { id: string; received_at: string }>(
  prev: readonly T[],
  incoming: readonly T[],
  keys: readonly (keyof T)[] = [],
  limit = 500,
): T[] {
  if (incoming.length === 0) return prev as T[];
  const byId = new Map<string, T>();
  prev.forEach((m) => byId.set(m.id, m));
  incoming.forEach((m) => byId.set(m.id, m));
  const sorted = sortByReceivedAtDesc([...byId.values()]);
  const trimmed = sorted.length > limit ? sorted.slice(0, limit) : sorted;
  return isSameMessageList(prev, trimmed, keys) ? (prev as T[]) : trimmed;
}

/** 指定した id を取り除く。該当がなければ prev そのものを返す。 */
export function removeMessages<T extends { id: string }>(prev: readonly T[], ids: readonly string[]): T[] {
  if (ids.length === 0) return prev as T[];
  const targets = new Set(ids);
  const next = prev.filter((m) => !targets.has(m.id));
  return next.length === prev.length ? (prev as T[]) : next;
}

/**
 * 全件取得した結果 next を反映する。内容が prev と同じなら prev を返す。
 */
export function replaceMessagesIfChanged<T extends { id: string }>(
  prev: readonly T[],
  next: readonly T[],
  keys: readonly (keyof T)[] = [],
): T[] {
  return isSameMessageList(prev, next, keys) ? (prev as T[]) : (next as T[]);
}

/** 一覧のうち最も新しい received_at（差分取得の起点）。空なら null。 */
export function newestReceivedAt(list: readonly { received_at: string }[]): string | null {
  let best: string | null = null;
  let bestTime = -Infinity;
  for (const m of list) {
    const t = Date.parse(m.received_at);
    if (!Number.isNaN(t) && t > bestTime) {
      bestTime = t;
      best = m.received_at;
    }
  }
  return best;
}
